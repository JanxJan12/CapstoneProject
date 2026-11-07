-- Phase 7B: documented Production requests; Foodhouse Receiving remains the
-- sole stock posting authority. No Production stock or costing model is added.
begin;

alter type public.user_role add value if not exists 'production';

create table public.production_replenishment_requests (
  id uuid primary key,
  inventory_item_id uuid not null references public.inventory_items(id),
  requested_unit text not null,
  requested_quantity numeric(12,3) not null check (requested_quantity > 0),
  needed_at timestamptz,
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  note text,
  status text not null default 'requested' check (status in (
    'requested', 'acknowledged', 'preparing', 'ready_for_delivery', 'received'
  )),
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  ready_at timestamptz,
  closed_at timestamptz,
  fulfilled_report_id uuid unique references public.receiving_reports(id),
  constraint production_request_urgent_note_chk check (
    priority <> 'urgent' or nullif(btrim(note), '') is not null
  ),
  constraint production_request_fulfillment_chk check (
    (status = 'received') = (fulfilled_report_id is not null and closed_at is not null)
  )
);

create index production_requests_queue_idx
  on public.production_replenishment_requests(status, requested_at desc);

create table public.production_replenishment_status_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.production_replenishment_requests(id),
  previous_status text,
  next_status text not null,
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now(),
  receiving_report_id uuid references public.receiving_reports(id)
);
create index production_request_events_idx
  on public.production_replenishment_status_events(request_id, id);

alter table public.receiving_reports
  add column replenishment_request_id uuid unique
    references public.production_replenishment_requests(id),
  add constraint receiving_report_replenishment_source_chk check (
    replenishment_request_id is null or
    (source_type = 'production_team' and purchase_order_id is null)
  );

alter table public.production_replenishment_requests enable row level security;
alter table public.production_replenishment_status_events enable row level security;
revoke all on public.production_replenishment_requests from public, anon, authenticated;
revoke all on public.production_replenishment_status_events from public, anon, authenticated;
revoke all on sequence public.production_replenishment_status_events_id_seq
  from public, anon, authenticated;
grant all on public.production_replenishment_requests to service_role;
grant all on public.production_replenishment_status_events to service_role;
grant all on sequence public.production_replenishment_status_events_id_seq
  to service_role;

create function public.guard_production_replenishment_request()
returns trigger language plpgsql set search_path = public, extensions, pg_temp
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.production_replenishment_status_events
      (request_id, previous_status, next_status, changed_by)
    values (new.id, null, new.status, new.requested_by);
    return new;
  end if;

  if new.inventory_item_id is distinct from old.inventory_item_id
     or new.requested_unit is distinct from old.requested_unit
     or new.requested_quantity is distinct from old.requested_quantity
     or new.needed_at is distinct from old.needed_at
     or new.priority is distinct from old.priority
     or new.note is distinct from old.note
     or new.requested_by is distinct from old.requested_by
     or new.requested_at is distinct from old.requested_at
  then
    raise exception 'Request identity and quantity are immutable.' using errcode = '22023';
  end if;
  if new.status is not distinct from old.status then
    raise exception 'Request update requires a status change.' using errcode = '22023';
  end if;
  if not (
    (old.status = 'requested' and new.status = 'acknowledged') or
    (old.status = 'acknowledged' and new.status = 'preparing') or
    (old.status = 'preparing' and new.status = 'ready_for_delivery') or
    (old.status = 'ready_for_delivery' and new.status = 'received')
  ) then
    raise exception 'Invalid replenishment status transition.' using errcode = '22023';
  end if;
  if new.status = 'ready_for_delivery' then
    new.ready_at := now();
  elsif new.ready_at is distinct from old.ready_at then
    raise exception 'Ready timestamp is immutable.' using errcode = '22023';
  end if;
  if new.status = 'received' then
    if new.fulfilled_report_id is null or new.closed_at is null then
      raise exception 'Posted receiving report required to close request.' using errcode = '22023';
    end if;
  elsif new.fulfilled_report_id is distinct from old.fulfilled_report_id
     or new.closed_at is distinct from old.closed_at then
    raise exception 'Fulfillment can change only when request closes.' using errcode = '22023';
  end if;
  insert into public.production_replenishment_status_events
    (request_id, previous_status, next_status, changed_by, receiving_report_id)
  values (new.id, old.status, new.status, auth.uid(), new.fulfilled_report_id);
  return new;
end;
$function$;

create trigger production_request_audit_insert
after insert on public.production_replenishment_requests
for each row execute function public.guard_production_replenishment_request();
create trigger production_request_guard_update
before update on public.production_replenishment_requests
for each row execute function public.guard_production_replenishment_request();

create function public.guard_open_replenishment_item_unit()
returns trigger language plpgsql set search_path = public, extensions, pg_temp
as $function$
begin
  if new.unit is distinct from old.unit and exists (
    select 1 from public.production_replenishment_requests request
    where request.inventory_item_id = old.id and request.status <> 'received'
  ) then
    raise exception 'Cannot change item unit while replenishment requests are open.'
      using errcode = '22023';
  end if;
  return new;
end;
$function$;
create trigger inventory_open_replenishment_unit_guard
before update of unit on public.inventory_items
for each row execute function public.guard_open_replenishment_item_unit();

create function public.guard_linked_replenishment_report()
returns trigger language plpgsql set search_path = public, extensions, pg_temp
as $function$
begin
  if tg_op = 'DELETE' then
    if old.replenishment_request_id is not null then
      raise exception 'Linked receiving draft cannot be deleted.' using errcode = '22023';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' and new.replenishment_request_id is not null then
    if not exists (
      select 1 from public.production_replenishment_requests request
      where request.id = new.replenishment_request_id
        and request.status = 'ready_for_delivery'
    ) then
      raise exception 'Only a ready request can link Receiving.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.replenishment_request_id is null
     and new.replenishment_request_id is not null then
    raise exception 'Existing receiving reports cannot be linked retroactively.'
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and old.replenishment_request_id is not null then
    if new.replenishment_request_id is distinct from old.replenishment_request_id
       or new.source_type is distinct from old.source_type
       or new.purchase_order_id is distinct from old.purchase_order_id
       or new.source_reference is distinct from old.source_reference
    then
      raise exception 'Linked receiving source and request cannot change.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$function$;
create trigger receiving_link_guard
before insert or update or delete on public.receiving_reports
for each row execute function public.guard_linked_replenishment_report();

create function public.guard_linked_replenishment_line()
returns trigger language plpgsql set search_path = public, extensions, pg_temp
as $function$
declare
  v_request_id uuid;
  v_item_id uuid;
begin
  select report.replenishment_request_id into v_request_id
  from public.receiving_reports report
  where report.id = new.receiving_report_id;
  if v_request_id is null then return new; end if;
  select request.inventory_item_id into v_item_id
  from public.production_replenishment_requests request
  where request.id = v_request_id;
  if new.inventory_item_id is distinct from v_item_id
     or new.purchase_order_item_id is not null then
    raise exception 'Linked receiving line must match the requested item.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.receiving_report_items line
    where line.receiving_report_id = new.receiving_report_id and line.id <> new.id
  ) then
    raise exception 'Linked receiving accepts one item line.' using errcode = '22023';
  end if;
  return new;
end;
$function$;
create trigger receiving_linked_line_guard
before insert or update on public.receiving_report_items
for each row execute function public.guard_linked_replenishment_line();

create function public.close_replenishment_from_receiving()
returns trigger language plpgsql set search_path = public, extensions, pg_temp
as $function$
declare
  v_request public.production_replenishment_requests%rowtype;
  v_lines integer;
begin
  if new.replenishment_request_id is null or new.status <> 'posted' then
    return new;
  end if;
  select * into v_request from public.production_replenishment_requests
  where id = new.replenishment_request_id for update;
  if v_request.status <> 'ready_for_delivery' or v_request.fulfilled_report_id is not null then
    raise exception 'Linked request is not ready for fulfillment.' using errcode = '22023';
  end if;
  select count(*) into v_lines from public.receiving_report_items line
  where line.receiving_report_id = new.id and line.inventory_item_id = v_request.inventory_item_id;
  if v_lines <> 1 then
    raise exception 'Linked receiving must have exactly one requested item line.' using errcode = '22023';
  end if;
  update public.production_replenishment_requests
  set status = 'received', fulfilled_report_id = new.id, closed_at = new.posted_at
  where id = v_request.id;
  return new;
end;
$function$;
create trigger receiving_closes_replenishment
after update of status on public.receiving_reports
for each row when (old.status is distinct from new.status)
execute function public.close_replenishment_from_receiving();

create function public.create_replenishment_request(
  p_request_id uuid, p_inventory_item_id uuid, p_quantity numeric,
  p_needed_at timestamptz, p_priority text, p_note text
) returns jsonb language plpgsql security definer
set search_path = public, extensions, pg_temp as $function$
declare
  v_actor uuid := auth.uid();
  v_item public.inventory_items%rowtype;
  v_existing public.production_replenishment_requests%rowtype;
  v_note text := nullif(btrim(p_note), '');
begin
  if not exists (select 1 from public.profiles p where p.id = v_actor
      and p.role::text = 'manager' and p.is_active) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  if p_request_id is null or p_inventory_item_id is null or p_quantity is null
     or p_quantity in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_quantity <= 0 or p_priority not in ('normal', 'urgent') then
    raise exception 'Invalid replenishment request.' using errcode = '22023';
  end if;
  select * into v_item from public.inventory_items
  where id = p_inventory_item_id and is_active;
  if not found then raise exception 'Active inventory item required.' using errcode = '22023'; end if;
  if p_quantity <> round(p_quantity, v_item.quantity_scale) then
    raise exception 'Quantity exceeds item precision.' using errcode = '22023';
  end if;
  select * into v_existing from public.production_replenishment_requests
  where id = p_request_id;
  if found then
    if v_existing.inventory_item_id is distinct from p_inventory_item_id
       or v_existing.requested_quantity is distinct from p_quantity
       or v_existing.needed_at is distinct from p_needed_at
       or v_existing.priority is distinct from p_priority
       or v_existing.note is distinct from v_note
       or v_existing.requested_by is distinct from v_actor then
      raise exception 'Request ID reused with different details.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status);
  end if;
  insert into public.production_replenishment_requests
    (id, inventory_item_id, requested_unit, requested_quantity,
     needed_at, priority, note, requested_by)
  values (p_request_id, v_item.id, v_item.unit, p_quantity,
          p_needed_at, p_priority, v_note, v_actor);
  return jsonb_build_object('id', p_request_id, 'status', 'requested');
end;
$function$;

create function public.advance_replenishment_request(
  p_request_id uuid, p_expected_status text, p_next_status text
) returns jsonb language plpgsql security definer
set search_path = public, extensions, pg_temp as $function$
declare
  v_actor uuid := auth.uid();
  v_request public.production_replenishment_requests%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = v_actor
      and p.role::text = 'production' and p.is_active) then
    raise exception 'Active Production access required.' using errcode = '42501';
  end if;
  select * into v_request from public.production_replenishment_requests
  where id = p_request_id for update;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
  if not (
    (p_expected_status = 'requested' and p_next_status = 'acknowledged') or
    (p_expected_status = 'acknowledged' and p_next_status = 'preparing') or
    (p_expected_status = 'preparing' and p_next_status = 'ready_for_delivery')
  ) then raise exception 'Invalid Production transition.' using errcode = '22023'; end if;
  if v_request.status = p_next_status then
    return jsonb_build_object('id', v_request.id, 'status', v_request.status);
  end if;
  if v_request.status <> p_expected_status then
    raise exception 'Request status changed. Refresh the queue.' using errcode = '22023';
  end if;
  update public.production_replenishment_requests
  set status = p_next_status where id = p_request_id;
  return jsonb_build_object('id', p_request_id, 'status', p_next_status);
end;
$function$;

create function public.start_replenishment_receiving(p_request_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions, pg_temp as $function$
declare
  v_actor uuid := auth.uid();
  v_request public.production_replenishment_requests%rowtype;
  v_report public.receiving_reports%rowtype;
  v_report_id uuid;
  v_received_at timestamptz := now();
begin
  if not exists (select 1 from public.profiles p where p.id = v_actor
      and p.role::text = 'manager' and p.is_active) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  select * into v_request from public.production_replenishment_requests
  where id = p_request_id for update;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
  select * into v_report from public.receiving_reports
  where replenishment_request_id = p_request_id;
  if found then
    return jsonb_build_object('id', v_report.id, 'rr_number', v_report.rr_number,
      'status', v_report.status);
  end if;
  if v_request.status <> 'ready_for_delivery' then
    raise exception 'Request must be ready before Receiving starts.' using errcode = '22023';
  end if;
  v_report_id := gen_random_uuid();
  insert into public.receiving_reports
    (id, rr_number, source_type, source_reference, received_at, received_by,
     replenishment_request_id)
  values (v_report_id,
    'RR-' || to_char(v_received_at at time zone 'Asia/Manila', 'YYYYMMDD') || '-'
      || upper(substr(replace(v_report_id::text, '-', ''), 1, 8)),
    'production_team', 'RPL-' || upper(substr(replace(p_request_id::text, '-', ''), 1, 8)),
    v_received_at, v_actor, p_request_id)
  returning * into v_report;
  return jsonb_build_object('id', v_report.id, 'rr_number', v_report.rr_number,
    'status', v_report.status);
end;
$function$;

create function public.get_replenishment_requests()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions, pg_temp as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = v_actor
      and p.role::text in ('manager', 'production') and p.is_active) then
    raise exception 'Manager or Production access required.' using errcode = '42501';
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
    on line.receiving_report_id = report.id
  ;
  return v_result;
end;
$function$;

revoke all on function public.create_replenishment_request(uuid, uuid, numeric, timestamptz, text, text)
  from public, anon, authenticated;
revoke all on function public.advance_replenishment_request(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.start_replenishment_receiving(uuid)
  from public, anon, authenticated;
revoke all on function public.get_replenishment_requests()
  from public, anon, authenticated;
revoke all on function public.guard_production_replenishment_request()
  from public, anon, authenticated;
revoke all on function public.guard_open_replenishment_item_unit()
  from public, anon, authenticated;
revoke all on function public.guard_linked_replenishment_report()
  from public, anon, authenticated;
revoke all on function public.guard_linked_replenishment_line()
  from public, anon, authenticated;
revoke all on function public.close_replenishment_from_receiving()
  from public, anon, authenticated;
grant execute on function public.create_replenishment_request(uuid, uuid, numeric, timestamptz, text, text)
  to authenticated, service_role;
grant execute on function public.advance_replenishment_request(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.start_replenishment_receiving(uuid)
  to authenticated, service_role;
grant execute on function public.get_replenishment_requests()
  to authenticated, service_role;

commit;
