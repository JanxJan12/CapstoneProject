-- Disposable database only. Run with the original October 12 start RPC installed,
-- before applying the exact MGR-REC-02B migration. This seed intentionally commits;
-- the dedicated container is disposed after the post-migration comparison.
create table public.mgr_rec_02c_history_baseline (
  report_id uuid primary key,
  snapshot jsonb not null
);
do $seed$
declare
  v_manager uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_report uuid := gen_random_uuid();
  v_line uuid := gen_random_uuid();
  v_needed timestamptz := now() + interval '2 days';
  v_snapshot jsonb;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'mgr-rec-02c-history-' || v_manager || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, first_name, role, is_active)
  values (v_manager, 'Historical QA Manager', 'manager', true)
  on conflict (id) do update set role = excluded.role, is_active = true;
  insert into public.inventory_items (id, item_name, unit, quantity_on_hand,
    reorder_level, is_active, quantity_scale, rotation_policy, expiry_required)
  values (v_item, 'Synthetic Historical Receiving Item', 'pcs', 0, 1, true, 0, 'fifo', false);
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  perform public.issue_inventory_request(v_request, 'scheduled', v_needed,
    jsonb_build_array(jsonb_build_object('inventory_item_id', v_item,
      'quantity', 1, 'override_reason', 'Synthetic historical check')),
    public.get_inventory_request_proposal(v_needed));
  perform public.start_inventory_request_receiving(v_request, 1, v_report,
    'Legacy Synthetic Inspector', 'Historical inspection note');
  perform public.save_receiving_report_item(v_report, v_line, v_item, null,
    1, 1, null, null, null, null, null, null, null);
  perform public.post_receiving_report(v_report);
  if not exists (select 1 from public.receiving_reports where id = v_report
      and status = 'posted' and inspected_by_name = 'Legacy Synthetic Inspector') then
    raise exception 'Original RPC did not create historical posted inspector snapshot';
  end if;
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
  ) into v_snapshot;
  insert into public.mgr_rec_02c_history_baseline values (v_report, v_snapshot);
  raise notice 'Historical synthetic posted receipt % seeded; inspector %, stock 1, batch 1, movement 1',
    v_report, 'Legacy Synthetic Inspector';
end;
$seed$;
