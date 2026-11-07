-- Run after applying the exact MGR-REC-02B migration to the disposable database.
do $assert$
declare v_report uuid; v_before jsonb; v_after jsonb; v_line uuid; v_request uuid;
begin
  select report_id, snapshot into v_report, v_before
    from public.mgr_rec_02c_history_baseline;
  if v_report is null then raise exception 'Historical baseline missing'; end if;
  select id into v_line from public.receiving_report_items where receiving_report_id = v_report;
  select inventory_request_id into v_request from public.receiving_reports where id = v_report;
  select jsonb_build_object(
    'report', (select to_jsonb(r) from public.receiving_reports r where r.id = v_report),
    'lines', (select jsonb_agg(to_jsonb(i) order by i.id) from public.receiving_report_items i
      where i.receiving_report_id = v_report),
    'batches', (select jsonb_agg(to_jsonb(b) order by b.id) from public.inventory_batches b
      where b.receiving_report_item_id = v_line),
    'movements', (select jsonb_agg(to_jsonb(t) order by t.id)
      from public.inventory_transactions t join public.inventory_batches b on b.id = t.inventory_batch_id
      where b.receiving_report_item_id = v_line),
    'request', (select to_jsonb(d) from public.inventory_request_documents d where d.id = v_request)
  ) into v_after;
  if v_before is distinct from v_after
     or v_after->'report'->>'inspected_by_name' <> 'Legacy Synthetic Inspector' then
    raise exception 'Historical report, lines, batches, movements, or request changed';
  end if;
  raise notice 'Historical synthetic receipt % unchanged across exact 02B migration', v_report;
end;
$assert$;
