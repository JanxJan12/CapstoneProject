-- Additive Manager-issued Production documents. Legacy Phase 7B requests remain intact.
begin;

create sequence public.inventory_request_number_seq;
revoke all on sequence public.inventory_request_number_seq from public, anon, authenticated;

create table public.inventory_request_documents (
  id uuid primary key,
  request_number text not null unique,
  current_revision integer not null default 1 check (current_revision > 0),
  status text not null default 'issued' check (status in ('issued', 'partially_received', 'fulfilled', 'closed_short')),
  priority text not null check (priority in ('emergency', 'priority', 'scheduled')),
  needed_at timestamptz not null,
  reason text not null check (length(btrim(reason)) > 0),
  issue_input jsonb not null,
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  close_reason text,
  check ((status = 'closed_short') = (closed_at is not null and closed_by is not null and nullif(btrim(close_reason), '') is not null))
);
create table public.inventory_request_lines (
  request_id uuid not null references public.inventory_request_documents(id),
  inventory_item_id uuid not null references public.inventory_items(id),
  item_name text not null,
  requested_unit text not null,
  quantity_scale integer not null,
  requested_quantity numeric(12,3) not null check (requested_quantity > 0),
  recommendation jsonb not null,
  override_reason text,
  primary key (request_id, inventory_item_id)
);
create table public.inventory_request_revisions (
  request_id uuid not null references public.inventory_request_documents(id),
  revision integer not null check (revision > 0),
  snapshot jsonb not null,
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz not null default now(),
  primary key (request_id, revision)
);
create table public.inventory_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.inventory_request_documents(id),
  revision integer not null,
  event_type text not null check (event_type in ('issued', 'revised', 'dispatch', 'acknowledgment', 'delivery_started', 'delivery_cancelled', 'delivery_posted', 'closed_short')),
  actor_id uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index inventory_request_events_request_idx on public.inventory_request_events(request_id, id);
create index inventory_request_lines_item_idx on public.inventory_request_lines(inventory_item_id);

create function public.guard_open_inventory_request_master()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if (new.unit is distinct from old.unit or new.quantity_scale is distinct from old.quantity_scale)
     and exists (select 1 from public.inventory_request_lines l
       join public.inventory_request_documents d on d.id = l.request_id
       where l.inventory_item_id = old.id and d.status in ('issued', 'partially_received')) then
    raise exception 'Cannot change unit or precision while an issued request is open.' using errcode = '22023';
  end if;
  return new;
end;
$function$;
create trigger inventory_request_master_guard before update of unit, quantity_scale on public.inventory_items
  for each row execute function public.guard_open_inventory_request_master();

alter table public.receiving_reports
  add column inventory_request_id uuid references public.inventory_request_documents(id),
  add column inventory_request_revision integer,
  add column inspected_by_name text,
  add column inspection_note text,
  add constraint receiving_inventory_request_source_chk check (
    inventory_request_id is null or
    (source_type = 'production_team' and purchase_order_id is null and replenishment_request_id is null
     and inventory_request_revision is not null)
  );
create unique index one_open_inventory_request_receipt
  on public.receiving_reports(inventory_request_id) where inventory_request_id is not null and status = 'draft';
create index inventory_request_receipts_idx on public.receiving_reports(inventory_request_id, status);

alter table public.inventory_request_documents enable row level security;
alter table public.inventory_request_lines enable row level security;
alter table public.inventory_request_revisions enable row level security;
alter table public.inventory_request_events enable row level security;
revoke all on public.inventory_request_documents, public.inventory_request_lines,
  public.inventory_request_revisions, public.inventory_request_events from public, anon, authenticated;
revoke all on sequence public.inventory_request_events_id_seq from public, anon, authenticated;
grant all on public.inventory_request_documents, public.inventory_request_lines,
  public.inventory_request_revisions, public.inventory_request_events to service_role;
grant all on sequence public.inventory_request_events_id_seq, public.inventory_request_number_seq to service_role;

create function public.inventory_request_manager_required()
returns uuid language plpgsql stable security definer set search_path = '' as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.role = 'manager'::public.user_role and p.is_active
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$function$;
revoke all on function public.inventory_request_manager_required() from public, anon, authenticated;

create function public.get_inventory_request_proposal(p_needed_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_result jsonb;
begin
  perform public.inventory_request_manager_required();
  if p_needed_at is null or p_needed_at < now() then
    raise exception 'Future needed time required.' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'name', i.item_name, 'unit', i.unit, 'quantity_scale', i.quantity_scale,
    'reorder_level', i.reorder_level, 'usable_now', public.inventory_usable_quantity(i.id),
    'valid_at_need', case when i.batch_consumption_enabled and i.expiry_required then
      coalesce((select sum(b.quantity_on_hand) from public.inventory_batches b
        where b.inventory_item_id = i.id and b.quantity_on_hand > 0
          and b.use_by_date >= (p_needed_at at time zone 'Asia/Manila')::date), 0)
      else public.inventory_usable_quantity(i.id) end,
    'expiry_verified', i.batch_consumption_enabled and i.expiry_required,
    'outstanding', coalesce((select sum(greatest(l.requested_quantity - coalesce(r.accepted, 0), 0))
      from public.inventory_request_lines l
      join public.inventory_request_documents d on d.id = l.request_id
      left join lateral (
        select sum(ri.quantity_accepted) accepted from public.receiving_reports rr
        join public.receiving_report_items ri on ri.receiving_report_id = rr.id
        where rr.inventory_request_id = d.id and rr.status = 'posted'
          and ri.inventory_item_id = l.inventory_item_id
      ) r on true
      where l.inventory_item_id = i.id and d.status in ('issued', 'partially_received')), 0)
      + coalesce((select sum(legacy.requested_quantity)
        from public.production_replenishment_requests legacy
        where legacy.inventory_item_id = i.id and legacy.status <> 'received'), 0)
  ) order by i.item_name), '[]'::jsonb) into v_result
  from public.inventory_items i where i.is_active;
  return v_result;
end;
$function$;

create function public.issue_inventory_request(
  p_request_id uuid, p_priority text, p_needed_at timestamptz,
  p_reason text, p_lines jsonb, p_expected jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := public.inventory_request_manager_required();
  v_existing public.inventory_request_documents%rowtype;
  v_line jsonb;
  v_item public.inventory_items%rowtype;
  v_count integer := 0;
  v_number text;
  v_now timestamptz := now();
  v_snapshot jsonb;
  v_expected jsonb;
  v_issuer_name text;
  v_proposal_line jsonb;
  v_suggested numeric;
begin
  if p_request_id is null or p_priority not in ('emergency', 'priority', 'scheduled')
     or p_needed_at is null or p_needed_at <= v_now or nullif(btrim(p_reason), '') is null
     or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Complete request header and lines required.' using errcode = '22023';
  end if;
  -- Check retry IDs only after serializing issuers, including concurrent retries.
  perform pg_advisory_xact_lock(hashtext('inventory_request_issue'));
  select * into v_existing from public.inventory_request_documents where id = p_request_id;
  if found then
    if v_existing.issued_by <> v_actor or v_existing.priority <> p_priority
       or v_existing.needed_at <> p_needed_at or v_existing.reason <> btrim(p_reason)
       or v_existing.issue_input <> p_lines then
      raise exception 'Request ID reused with different details.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', v_existing.id, 'request_number', v_existing.request_number);
  end if;
  -- Posting is checked separately.
  perform 1 from public.inventory_items
    where id in (select (value->>'inventory_item_id')::uuid from jsonb_array_elements(p_lines))
    order by id for share;
  v_expected := public.get_inventory_request_proposal(p_needed_at);
  if p_expected is distinct from v_expected then
    raise exception 'Stock or outstanding requests changed. Review latest suggestions.' using errcode = '40001';
  end if;
  v_number := 'PR-' || to_char(v_now at time zone 'Asia/Manila', 'YYYYMMDD')
    || '-' || lpad(nextval('public.inventory_request_number_seq')::text, 6, '0');
  select concat_ws(' ', first_name, last_name) into v_issuer_name
    from public.profiles where id = v_actor;
  insert into public.inventory_request_documents
    (id, request_number, priority, needed_at, reason, issue_input, issued_by, issued_at)
  values (p_request_id, v_number, p_priority, p_needed_at, btrim(p_reason), p_lines, v_actor, v_now);
  for v_line in select value from jsonb_array_elements(p_lines) loop
    select * into v_item from public.inventory_items
      where id = (v_line->>'inventory_item_id')::uuid and is_active for share;
    if not found or (v_line->>'quantity') is null then
      raise exception 'Active inventory item and quantity required.' using errcode = '22023';
    end if;
    if (v_line->>'quantity')::numeric <= 0
       or (v_line->>'quantity')::numeric in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or (v_line->>'quantity')::numeric <> round((v_line->>'quantity')::numeric, v_item.quantity_scale)
       or (v_line->>'quantity')::numeric > 999999999.999 then
      raise exception 'Invalid item quantity or precision.' using errcode = '22023';
    end if;
    select value into v_proposal_line from jsonb_array_elements(v_expected)
      where value->>'id' = v_item.id::text;
    v_suggested := greatest((v_proposal_line->>'reorder_level')::numeric
      - (v_proposal_line->>'valid_at_need')::numeric
      - (v_proposal_line->>'outstanding')::numeric, 0);
    if (v_line->>'quantity')::numeric <> v_suggested
       and nullif(btrim(v_line->>'override_reason'), '') is null then
      raise exception 'Explain a quantity that differs from the provisional gap.' using errcode = '22023';
    end if;
    insert into public.inventory_request_lines
      (request_id, inventory_item_id, item_name, requested_unit, quantity_scale,
       requested_quantity, recommendation, override_reason)
    values (p_request_id, v_item.id, v_item.item_name, v_item.unit, v_item.quantity_scale,
      (v_line->>'quantity')::numeric,
      v_proposal_line,
      nullif(btrim(v_line->>'override_reason'), ''));
    v_count := v_count + 1;
  end loop;
  select jsonb_build_object('number', v_number, 'revision', 1, 'issued_at', v_now,
    'issued_by', v_actor, 'issued_by_name', v_issuer_name,
    'priority', p_priority, 'needed_at', p_needed_at,
    'reason', btrim(p_reason), 'destination', 'Production',
    'lines', coalesce(jsonb_agg(jsonb_build_object('inventory_item_id', l.inventory_item_id,
      'name', l.item_name, 'unit', l.requested_unit, 'quantity', l.requested_quantity)
      order by l.item_name), '[]'::jsonb)) into v_snapshot
  from public.inventory_request_lines l where l.request_id = p_request_id;
  insert into public.inventory_request_revisions(request_id, revision, snapshot, issued_by, issued_at)
    values (p_request_id, 1, v_snapshot, v_actor, v_now);
  insert into public.inventory_request_events(request_id, revision, event_type, actor_id)
    values (p_request_id, 1, 'issued', v_actor);
  return jsonb_build_object('id', p_request_id, 'request_number', v_number, 'line_count', v_count);
end;
$function$;

create function public.record_inventory_request_event(
  p_request_id uuid, p_revision integer, p_event_type text, p_details jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid := public.inventory_request_manager_required();
  v_doc public.inventory_request_documents%rowtype;
begin
  select * into v_doc from public.inventory_request_documents where id = p_request_id for update;
  if not found or v_doc.status in ('fulfilled', 'closed_short') or p_revision <> v_doc.current_revision
     or p_event_type not in ('dispatch', 'acknowledgment') or jsonb_typeof(p_details) <> 'object' then
    raise exception 'Current open request and valid event required.' using errcode = '22023';
  end if;
  if p_event_type = 'dispatch' and
     (nullif(btrim(p_details->>'recipient'), '') is null or
      nullif(btrim(p_details->>'channel'), '') is null) then
    raise exception 'Dispatch channel and recipient required.' using errcode = '22023';
  end if;
  if p_event_type = 'acknowledgment' and
     (nullif(btrim(p_details->>'responder'), '') is null or
      nullif(btrim(p_details->>'response'), '') is null) then
    raise exception 'Responder and response required.' using errcode = '22023';
  end if;
  insert into public.inventory_request_events(request_id, revision, event_type, actor_id, details)
    values (p_request_id, p_revision, p_event_type, v_actor, p_details);
  return jsonb_build_object('id', p_request_id, 'revision', p_revision, 'event_type', p_event_type);
end;
$function$;

create function public.start_inventory_request_receiving(
  p_request_id uuid, p_revision integer, p_report_id uuid, p_inspected_by_name text,
  p_inspection_note text
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid := public.inventory_request_manager_required();
  v_doc public.inventory_request_documents%rowtype;
  v_report public.receiving_reports%rowtype;
  v_now timestamptz := now();
begin
  if p_report_id is null or nullif(btrim(p_inspected_by_name), '') is null then
    raise exception 'Receiving ID and physical inspector required.' using errcode = '22023';
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
    v_now, v_actor, p_request_id, p_revision, btrim(p_inspected_by_name), nullif(btrim(p_inspection_note), ''))
  returning * into v_report;
  insert into public.inventory_request_events(request_id, revision, event_type, actor_id, details)
    values (p_request_id, p_revision, 'delivery_started', v_actor,
      jsonb_build_object('receiving_report_id', p_report_id, 'inspected_by_name', btrim(p_inspected_by_name)));
  return jsonb_build_object('id', v_report.id, 'rr_number', v_report.rr_number, 'status', v_report.status);
end;
$function$;

create function public.guard_inventory_request_receiving()
returns trigger language plpgsql set search_path = '' as $function$
declare v_doc public.inventory_request_documents%rowtype;
begin
  if tg_op = 'DELETE' then
    if old.inventory_request_id is not null then
      if old.status <> 'draft' or exists (select 1 from public.receiving_report_items
        where receiving_report_id = old.id) then
        raise exception 'Only an empty linked draft can be cancelled.' using errcode = '22023';
      end if;
      insert into public.inventory_request_events(request_id, revision, event_type, actor_id, details)
        values (old.inventory_request_id, old.inventory_request_revision, 'delivery_cancelled', auth.uid(),
          jsonb_build_object('receiving_report_id', old.id));
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.inventory_request_id is not null then
    if new.inventory_request_id is distinct from old.inventory_request_id
       or new.inventory_request_revision is distinct from old.inventory_request_revision
       or new.inspected_by_name is distinct from old.inspected_by_name
       or new.source_type is distinct from old.source_type
       or new.source_reference is distinct from old.source_reference
       or new.purchase_order_id is distinct from old.purchase_order_id then
      raise exception 'Linked request, source, and inspector are immutable.' using errcode = '22023';
    end if;
  elsif tg_op = 'UPDATE' and new.inventory_request_id is not null then
    raise exception 'Existing receiving cannot be linked retroactively.' using errcode = '22023';
  end if;
  if new.inventory_request_id is null then return new; end if;
  select * into v_doc from public.inventory_request_documents where id = new.inventory_request_id;
  if not found or v_doc.status not in ('issued', 'partially_received')
     or v_doc.current_revision <> new.inventory_request_revision then
    raise exception 'Linked request is closed or changed.' using errcode = '22023';
  end if;
  return new;
end;
$function$;
create trigger receiving_inventory_request_guard before insert or update or delete on public.receiving_reports
  for each row execute function public.guard_inventory_request_receiving();

create function public.guard_inventory_request_line()
returns trigger language plpgsql set search_path = '' as $function$
declare v_request_id uuid;
begin
  select inventory_request_id into v_request_id from public.receiving_reports where id = new.receiving_report_id;
  if v_request_id is not null and (new.purchase_order_item_id is not null or not exists (
    select 1 from public.inventory_request_lines l
    where l.request_id = v_request_id and l.inventory_item_id = new.inventory_item_id)) then
    raise exception 'Receiving line must match an issued request item.' using errcode = '22023';
  end if;
  return new;
end;
$function$;
create trigger receiving_inventory_request_line_guard before insert or update on public.receiving_report_items
  for each row execute function public.guard_inventory_request_line();

create function public.reconcile_inventory_request_receiving()
returns trigger language plpgsql set search_path = '' as $function$
declare v_doc public.inventory_request_documents%rowtype;
  v_line record;
  v_posted numeric;
  v_total integer;
  v_complete integer;
  v_accepted numeric;
begin
  if new.inventory_request_id is null or new.status <> 'posted' then return new; end if;
  select * into v_doc from public.inventory_request_documents where id = new.inventory_request_id for update;
  if v_doc.status not in ('issued', 'partially_received') or v_doc.current_revision <> new.inventory_request_revision then
    raise exception 'Request changed before receiving post.' using errcode = '22023';
  end if;
  for v_line in select * from public.receiving_report_items where receiving_report_id = new.id loop
    select coalesce(sum(ri.quantity_accepted), 0) into v_posted
      from public.receiving_reports rr join public.receiving_report_items ri on ri.receiving_report_id = rr.id
      where rr.inventory_request_id = v_doc.id and rr.status = 'posted'
        and ri.inventory_item_id = v_line.inventory_item_id;
    -- The new report is visible as posted in an AFTER trigger.
    if v_posted > (select requested_quantity from public.inventory_request_lines
                    where request_id = v_doc.id and inventory_item_id = v_line.inventory_item_id) then
      raise exception 'Accepted quantity exceeds request. Review latest balance.' using errcode = '22023';
    end if;
  end loop;
  select count(*), count(*) filter (where coalesce(a.accepted, 0) >= l.requested_quantity)
    into v_total, v_complete from public.inventory_request_lines l
    left join lateral (
      select sum(ri.quantity_accepted) accepted from public.receiving_reports rr
      join public.receiving_report_items ri on ri.receiving_report_id = rr.id
      where rr.inventory_request_id = l.request_id and rr.status = 'posted'
        and ri.inventory_item_id = l.inventory_item_id
    ) a on true where l.request_id = v_doc.id;
  select coalesce(sum(ri.quantity_accepted), 0) into v_accepted
    from public.receiving_reports rr join public.receiving_report_items ri on ri.receiving_report_id = rr.id
    where rr.inventory_request_id = v_doc.id and rr.status = 'posted';
  update public.inventory_request_documents
    set status = case when v_total = v_complete then 'fulfilled'
                      when v_accepted > 0 then 'partially_received' else 'issued' end
    where id = v_doc.id;
  insert into public.inventory_request_events(request_id, revision, event_type, actor_id, details)
    values (v_doc.id, v_doc.current_revision, 'delivery_posted', new.posted_by,
      jsonb_build_object('receiving_report_id', new.id, 'rr_number', new.rr_number));
  return new;
end;
$function$;
create trigger receiving_reconciles_inventory_request after update of status on public.receiving_reports
  for each row when (old.status is distinct from new.status)
  execute function public.reconcile_inventory_request_receiving();

create function public.close_inventory_request_short(p_request_id uuid, p_revision integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid := public.inventory_request_manager_required();
  v_doc public.inventory_request_documents%rowtype;
begin
  select * into v_doc from public.inventory_request_documents where id = p_request_id for update;
  if not found or v_doc.status not in ('issued', 'partially_received') or
     v_doc.current_revision <> p_revision or nullif(btrim(p_reason), '') is null or exists (
       select 1 from public.receiving_reports rr where rr.inventory_request_id = p_request_id and rr.status = 'draft'
     ) then
    raise exception 'Open current request, reason, and no draft receipt required.' using errcode = '22023';
  end if;
  update public.inventory_request_documents set status = 'closed_short',
    closed_at = now(), closed_by = v_actor, close_reason = btrim(p_reason) where id = p_request_id;
  insert into public.inventory_request_events(request_id, revision, event_type, actor_id, details)
    values (p_request_id, p_revision, 'closed_short', v_actor, jsonb_build_object('reason', btrim(p_reason)));
  return jsonb_build_object('id', p_request_id, 'status', 'closed_short');
end;
$function$;

-- Revisions are locked once any physical delivery draft has been started.
create function public.revise_inventory_request(
  p_request_id uuid, p_expected_revision integer, p_priority text,
  p_needed_at timestamptz, p_reason text, p_lines jsonb, p_expected jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid := public.inventory_request_manager_required();
  v_doc public.inventory_request_documents%rowtype;
  v_item public.inventory_items%rowtype;
  v_line jsonb;
  v_expected jsonb;
  v_snapshot jsonb;
  v_revision integer;
  v_now timestamptz := now();
  v_issuer_name text;
  v_proposal_line jsonb;
  v_suggested numeric;
begin
  select * into v_doc from public.inventory_request_documents where id = p_request_id for update;
  if not found or v_doc.status <> 'issued' or v_doc.current_revision <> p_expected_revision
     or exists (select 1 from public.receiving_reports where inventory_request_id = p_request_id)
     or p_priority not in ('emergency', 'priority', 'scheduled') or p_needed_at <= v_now
     or nullif(btrim(p_reason), '') is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 then
    raise exception 'Current undelivered request and complete revision required.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('inventory_request_issue'));
  perform 1 from public.inventory_items
    where id in (select (value->>'inventory_item_id')::uuid from jsonb_array_elements(p_lines))
    order by id for share;
  v_expected := public.get_inventory_request_proposal(p_needed_at);
  if p_expected is distinct from v_expected then
    raise exception 'Stock or outstanding requests changed. Review latest suggestions.' using errcode = '40001';
  end if;
  delete from public.inventory_request_lines where request_id = p_request_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    select * into v_item from public.inventory_items
      where id = (v_line->>'inventory_item_id')::uuid and is_active for share;
    if not found or (v_line->>'quantity') is null
       or (v_line->>'quantity')::numeric <= 0
       or (v_line->>'quantity')::numeric in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or (v_line->>'quantity')::numeric <> round((v_line->>'quantity')::numeric, v_item.quantity_scale)
       or (v_line->>'quantity')::numeric > 999999999.999 then
      raise exception 'Invalid revision item or quantity.' using errcode = '22023';
    end if;
    select value into v_proposal_line from jsonb_array_elements(v_expected)
      where value->>'id' = v_item.id::text;
    v_suggested := greatest((v_proposal_line->>'reorder_level')::numeric
      - (v_proposal_line->>'valid_at_need')::numeric
      - (v_proposal_line->>'outstanding')::numeric, 0);
    if (v_line->>'quantity')::numeric <> v_suggested
       and nullif(btrim(v_line->>'override_reason'), '') is null then
      raise exception 'Explain a revised quantity that differs from the provisional gap.' using errcode = '22023';
    end if;
    insert into public.inventory_request_lines
      (request_id, inventory_item_id, item_name, requested_unit, quantity_scale,
       requested_quantity, recommendation, override_reason)
    values (p_request_id, v_item.id, v_item.item_name, v_item.unit, v_item.quantity_scale,
      (v_line->>'quantity')::numeric,
      v_proposal_line,
      nullif(btrim(v_line->>'override_reason'), ''));
  end loop;
  v_revision := p_expected_revision + 1;
  select concat_ws(' ', first_name, last_name) into v_issuer_name
    from public.profiles where id = v_actor;
  update public.inventory_request_documents set current_revision = v_revision,
    priority = p_priority, needed_at = p_needed_at, reason = btrim(p_reason), issue_input = p_lines
    where id = p_request_id;
  select jsonb_build_object('number', v_doc.request_number, 'revision', v_revision,
    'issued_at', v_now, 'issued_by', v_actor, 'issued_by_name', v_issuer_name,
    'priority', p_priority,
    'needed_at', p_needed_at, 'reason', btrim(p_reason), 'destination', 'Production',
    'lines', coalesce(jsonb_agg(jsonb_build_object('inventory_item_id', l.inventory_item_id,
      'name', l.item_name, 'unit', l.requested_unit, 'quantity', l.requested_quantity)
      order by l.item_name), '[]'::jsonb)) into v_snapshot
  from public.inventory_request_lines l where l.request_id = p_request_id;
  insert into public.inventory_request_revisions(request_id, revision, snapshot, issued_by, issued_at)
    values (p_request_id, v_revision, v_snapshot, v_actor, v_now);
  insert into public.inventory_request_events(request_id, revision, event_type, actor_id)
    values (p_request_id, v_revision, 'revised', v_actor);
  return jsonb_build_object('id', p_request_id, 'request_number', v_doc.request_number,
    'revision', v_revision);
end;
$function$;

create function public.get_inventory_request_register()
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_result jsonb;
begin
  perform public.inventory_request_manager_required();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'number', d.request_number, 'revision', d.current_revision,
    'status', d.status, 'priority', d.priority, 'needed_at', d.needed_at,
    'reason', d.reason, 'issued_at', d.issued_at,
    'issued_by_name', concat_ws(' ', p.first_name, p.last_name),
    'close_reason', d.close_reason,
    'snapshot', (select snapshot from public.inventory_request_revisions
      where request_id = d.id and revision = d.current_revision),
    'revisions', (select coalesce(jsonb_agg(jsonb_build_object('revision', r.revision,
      'snapshot', r.snapshot) order by r.revision), '[]'::jsonb)
      from public.inventory_request_revisions r where r.request_id = d.id),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
      'inventory_item_id', l.inventory_item_id, 'name', l.item_name, 'unit', l.requested_unit,
      'quantity', l.requested_quantity, 'accepted', coalesce(a.accepted, 0),
      'rejected', coalesce(a.rejected, 0),
      'remaining', greatest(l.requested_quantity - coalesce(a.accepted, 0), 0)
    ) order by l.item_name), '[]'::jsonb) from public.inventory_request_lines l
      left join lateral (select sum(ri.quantity_accepted) accepted, sum(ri.quantity_rejected) rejected
        from public.receiving_reports rr join public.receiving_report_items ri on ri.receiving_report_id = rr.id
        where rr.inventory_request_id = d.id and rr.status = 'posted'
          and ri.inventory_item_id = l.inventory_item_id) a on true where l.request_id = d.id),
    'receipts', (select coalesce(jsonb_agg(jsonb_build_object('id', rr.id,
      'number', rr.rr_number, 'status', rr.status, 'inspector', rr.inspected_by_name,
      'posted_at', rr.posted_at) order by rr.received_at), '[]'::jsonb)
      from public.receiving_reports rr where rr.inventory_request_id = d.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('type', e.event_type,
      'revision', e.revision, 'at', e.recorded_at,
      'actor', concat_ws(' ', ep.first_name, ep.last_name), 'details', e.details)
      order by e.id), '[]'::jsonb) from public.inventory_request_events e
      join public.profiles ep on ep.id = e.actor_id where e.request_id = d.id)
  ) order by d.issued_at desc), '[]'::jsonb) into v_result
  from public.inventory_request_documents d join public.profiles p on p.id = d.issued_by;
  return v_result;
end;
$function$;

revoke all on function public.get_inventory_request_proposal(timestamptz),
  public.issue_inventory_request(uuid,text,timestamptz,text,jsonb,jsonb),
  public.record_inventory_request_event(uuid,integer,text,jsonb),
  public.start_inventory_request_receiving(uuid,integer,uuid,text,text),
  public.close_inventory_request_short(uuid,integer,text),
  public.revise_inventory_request(uuid,integer,text,timestamptz,text,jsonb,jsonb),
  public.get_inventory_request_register() from public, anon;
grant execute on function public.get_inventory_request_proposal(timestamptz),
  public.issue_inventory_request(uuid,text,timestamptz,text,jsonb,jsonb),
  public.record_inventory_request_event(uuid,integer,text,jsonb),
  public.start_inventory_request_receiving(uuid,integer,uuid,text,text),
  public.close_inventory_request_short(uuid,integer,text),
  public.revise_inventory_request(uuid,integer,text,timestamptz,text,jsonb,jsonb),
  public.get_inventory_request_register() to authenticated, service_role;

commit;
