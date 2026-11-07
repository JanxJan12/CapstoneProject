begin;

-- The Production Queue has no mounted application route. Preserve the legacy
-- data, Receiving linkage, trigger functions, and Manager historical read.
do $$
begin
  if to_regprocedure('public.advance_replenishment_request(uuid,text,text)') is null
     or to_regprocedure('public.get_replenishment_requests()') is null
     or to_regprocedure('public.start_replenishment_receiving(uuid)') is null
     or (position('p.role::text in (''manager'', ''production'')' in
       pg_get_functiondef('public.get_replenishment_requests()'::regprocedure)) = 0
       and position('p.role::text = ''manager''' in
       pg_get_functiondef('public.get_replenishment_requests()'::regprocedure)) = 0) then
    raise exception 'Expected legacy replenishment contracts changed; review before retiring access.';
  end if;
end $$;

-- A formerly active Production account must no longer advance the obsolete
-- queue. Preserve the existing service_role grant for privileged compatibility;
-- the function's actor check still applies to its caller.
revoke execute on function public.advance_replenishment_request(uuid, text, text)
  from public, anon, authenticated;

-- Manager Requests and Receiving still read old linked records. Keep the read
-- RPC and its authenticated grant, but remove Production profile authorization.
create or replace function public.get_replenishment_requests()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions, pg_temp as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = v_actor
      and p.role::text = 'manager' and p.is_active) then
    raise exception 'Active Manager access required.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'inventory_item_id', r.inventory_item_id,
    'item_name', i.item_name, 'unit', r.requested_unit,
    'quantity', r.requested_quantity, 'needed_at', r.needed_at,
    'priority', r.priority, 'note', r.note, 'status', r.status,
    'requested_by', r.requested_by,
    'requested_by_name', concat_ws(' ', p.first_name, p.last_name),
    'requested_at', r.requested_at, 'ready_at', r.ready_at,
    'closed_at', r.closed_at, 'receiving_report_id', report.id,
    'receiving_report_number', report.rr_number,
    'receiving_report_status', report.status,
    'delivered', line.quantity_delivered,
    'accepted', line.quantity_accepted,
    'rejected', line.quantity_rejected,
    'events', coalesce((select jsonb_agg(jsonb_build_object(
      'previous_status', e.previous_status, 'next_status', e.next_status,
      'changed_at', e.changed_at, 'changed_by', e.changed_by,
      'changed_by_name', concat_ws(' ', ep.first_name, ep.last_name)
    ) order by e.id)
      from public.production_replenishment_status_events e
      join public.profiles ep on ep.id = e.changed_by
      where e.request_id = r.id), '[]'::jsonb)
  ) order by (r.status = 'received'), r.requested_at desc), '[]'::jsonb)
  into v_result
  from public.production_replenishment_requests r
  join public.inventory_items i on i.id = r.inventory_item_id
  join public.profiles p on p.id = r.requested_by
  left join public.receiving_reports report
    on report.replenishment_request_id = r.id
  left join public.receiving_report_items line
    on line.receiving_report_id = report.id;
  return v_result;
end;
$function$;

-- Reassert explicit client grants; no table DML or RLS policy changes.
revoke execute on function public.get_replenishment_requests()
  from public, anon;
grant execute on function public.get_replenishment_requests()
  to authenticated, service_role;

commit;
