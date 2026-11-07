begin;

-- Preserve the five-argument RPC for existing callers. The legacy inspector
-- argument is deliberately ignored: a caller cannot nominate another person.
-- The profile UUID is an authenticated, immutable account identifier; profile
-- first/last names are self-editable and are not used as audit authority.
create or replace function public.start_inventory_request_receiving(
  p_request_id uuid, p_revision integer, p_report_id uuid, p_inspected_by_name text,
  p_inspection_note text
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid := public.inventory_request_manager_required();
  v_doc public.inventory_request_documents%rowtype;
  v_report public.receiving_reports%rowtype;
  v_now timestamptz := now();
begin
  if p_report_id is null then
    raise exception 'Receiving ID required.' using errcode = '22023';
  end if;
  select * into v_doc from public.inventory_request_documents where id = p_request_id for update;
  if not found or v_doc.status not in ('issued', 'partially_received')
    or v_doc.current_revision <> p_revision then
    raise exception 'Current open request required.' using errcode = '22023';
  end if;
  select * into v_report from public.receiving_reports where id = p_report_id;
  if found then
    if v_report.inventory_request_id is distinct from p_request_id
       or v_report.inventory_request_revision is distinct from p_revision then
      raise exception 'Receiving ID reused for another request.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', v_report.id, 'rr_number', v_report.rr_number, 'status', v_report.status);
  end if;
  insert into public.receiving_reports
    (id, rr_number, source_type, source_reference, received_at, received_by,
     inventory_request_id, inventory_request_revision, inspected_by_name, inspection_note)
  values (p_report_id,
    'RR-' || to_char(v_now at time zone 'Asia/Manila', 'YYYYMMDD') || '-'
      || upper(substr(replace(p_report_id::text, '-', ''), 1, 8)),
    'production_team', v_doc.request_number || ' Rev ' || p_revision,
    v_now, v_actor, p_request_id, p_revision, v_actor::text,
    nullif(btrim(p_inspection_note), ''))
  returning * into v_report;
  insert into public.inventory_request_events(request_id, revision, event_type, actor_id, details)
    values (p_request_id, p_revision, 'delivery_started', v_actor,
      jsonb_build_object('receiving_report_id', p_report_id, 'inspected_by_name', v_actor::text));
  return jsonb_build_object('id', v_report.id, 'rr_number', v_report.rr_number, 'status', v_report.status);
end;
$function$;

-- CREATE OR REPLACE retains the existing ownership and EXECUTE grants.
-- Revoke PUBLIC/anon explicitly so the contract remains narrow on a fresh fixture.
revoke all on function public.start_inventory_request_receiving(uuid,integer,uuid,text,text)
  from public, anon;
grant execute on function public.start_inventory_request_receiving(uuid,integer,uuid,text,text)
  to authenticated, service_role;

commit;
