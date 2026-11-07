-- Dedicated, read-only ledger snapshots. Local source only until deployment approval.
-- An audit's stock reads and both inserts are one SQL statement at one MVCC snapshot.
begin;

create table public.inventory_audits (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  status text not null default 'completed' check (status = 'completed'),
  movement_rows_examined bigint not null check (movement_rows_examined >= 0),
  constraint inventory_audits_time_order check (completed_at >= started_at)
);

-- The composite key makes a referenced movement belong to this finding's item.
-- It adds an index, not a new movement writer or ordering assumption.
alter table public.inventory_transactions
  add constraint inventory_transactions_id_item_unique unique (id, inventory_item_id);

create table public.inventory_audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.inventory_audits(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  latest_movement_id uuid,
  item_name text not null check (btrim(item_name) <> ''),
  recorded_unit text not null check (btrim(recorded_unit) <> ''),
  book_quantity numeric(12,3) not null check (book_quantity >= 0),
  ledger_quantity numeric(12,3) check (ledger_quantity >= 0),
  result text not null check (result in ('matched', 'mismatch', 'incomplete')),
  finding_code text not null check (finding_code in (
    'matched', 'book_ledger_difference', 'no_history',
    'ambiguous_order', 'invalid_arithmetic', 'sequence_gap'
  )),
  movement_count integer not null check (movement_count >= 0),
  constraint inventory_audit_item_unique unique (audit_id, inventory_item_id),
  constraint inventory_audit_movement_item_fk
    foreign key (latest_movement_id, inventory_item_id)
    references public.inventory_transactions(id, inventory_item_id) on delete restrict,
  constraint inventory_audit_result_evidence check (
    (result = 'matched' and finding_code = 'matched' and ledger_quantity is not null
        and latest_movement_id is not null
        and ledger_quantity = book_quantity and movement_count > 0)
    or (result = 'mismatch' and finding_code = 'book_ledger_difference'
        and latest_movement_id is not null and ledger_quantity is not null
        and ledger_quantity <> book_quantity and movement_count > 0)
    or (result = 'incomplete' and finding_code in
        ('no_history', 'ambiguous_order', 'invalid_arithmetic', 'sequence_gap')
        and ledger_quantity is null and latest_movement_id is null
        and ((finding_code = 'no_history' and movement_count = 0)
          or (finding_code <> 'no_history' and movement_count > 0)))
  )
);

create index inventory_audits_completed_idx
  on public.inventory_audits (completed_at desc, id desc);
create index inventory_audit_items_audit_idx
  on public.inventory_audit_items (audit_id);

alter table public.inventory_audits enable row level security;
alter table public.inventory_audit_items enable row level security;
revoke all on public.inventory_audits, public.inventory_audit_items
  from public, anon, authenticated, service_role;

create function public.reject_inventory_audit_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Completed inventory audits cannot be changed.' using errcode = '42501';
end;
$$;
create trigger inventory_audits_immutable
  before update or delete on public.inventory_audits
  for each row execute function public.reject_inventory_audit_mutation();
create trigger inventory_audit_items_immutable
  before update or delete on public.inventory_audit_items
  for each row execute function public.reject_inventory_audit_mutation();
revoke all on function public.reject_inventory_audit_mutation()
  from public, anon, authenticated, service_role;

create function public.run_manager_inventory_ledger_audit(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_audit_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.role = 'manager'::public.user_role and p.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'Audit request ID is required.' using errcode = '22023';
  end if;

  -- Serialize retries of the same request, without locking restaurant stock.
  perform pg_catalog.pg_advisory_xact_lock(52814, pg_catalog.hashtext(p_request_id::text));
  select a.id into v_audit_id from public.inventory_audits a
    where a.request_id = p_request_id;
  if v_audit_id is not null then return v_audit_id; end if;

  -- One statement snapshot covers all inventory rows, all movement rows and both
  -- inserts, even under PostgreSQL's default READ COMMITTED isolation.
  with ordered as materialized (
    select t.id, t.inventory_item_id, t.created_at, t.quantity_before,
      t.quantity_change, t.quantity_after,
      row_number() over item_order as ordinal,
      count(*) over (partition by t.inventory_item_id) as item_count,
      count(*) over (partition by t.inventory_item_id, t.created_at) as timestamp_peers,
      lag(t.quantity_after) over item_order as preceding_after
    from public.inventory_transactions t
    window item_order as (partition by t.inventory_item_id order by t.created_at, t.id)
  ), evidence as materialized (
    select o.inventory_item_id, count(*)::integer as movement_count,
      min(o.quantity_before) filter (where o.ordinal = 1) as opening_quantity,
      sum(o.quantity_change) as net_change,
      (array_agg(o.id order by o.ordinal desc))[1] as latest_movement_id,
      bool_or(o.timestamp_peers > 1) as ambiguous_order,
      bool_or(o.quantity_before + o.quantity_change <> o.quantity_after) as invalid_arithmetic,
      bool_or(o.ordinal > 1 and o.quantity_before <> o.preceding_after) as sequence_gap
    from ordered o group by o.inventory_item_id
  ), findings as materialized (
    select i.id as inventory_item_id, i.item_name::text, i.unit::text as recorded_unit,
      i.quantity_on_hand as book_quantity, coalesce(e.movement_count, 0) as movement_count,
      case when coalesce(e.ambiguous_order, false) or coalesce(e.invalid_arithmetic, false)
             or coalesce(e.sequence_gap, false) then null::uuid
           else e.latest_movement_id end as latest_movement_id,
      case when e.movement_count is null or e.ambiguous_order or e.invalid_arithmetic
             or e.sequence_gap then null::numeric
           else e.opening_quantity + e.net_change end as ledger_quantity,
      case when e.movement_count is null then 'no_history'
           when e.ambiguous_order then 'ambiguous_order'
           when e.invalid_arithmetic then 'invalid_arithmetic'
           when e.sequence_gap then 'sequence_gap'
           when i.quantity_on_hand <> e.opening_quantity + e.net_change then 'book_ledger_difference'
           else 'matched' end as finding_code
    from public.inventory_items i left join evidence e on e.inventory_item_id = i.id
  ), audit as (
    insert into public.inventory_audits
      (request_id, performed_by, started_at, completed_at, movement_rows_examined)
    select p_request_id, auth.uid(), pg_catalog.statement_timestamp(),
      pg_catalog.statement_timestamp(), (select count(*) from ordered)
    returning id
  ), saved as (
    insert into public.inventory_audit_items
      (audit_id, inventory_item_id, latest_movement_id, item_name, recorded_unit,
       book_quantity, ledger_quantity, result, finding_code, movement_count)
    select audit.id, f.inventory_item_id, f.latest_movement_id, f.item_name,
      f.recorded_unit, f.book_quantity, f.ledger_quantity,
      case when f.finding_code = 'matched' then 'matched'
           when f.finding_code = 'book_ledger_difference' then 'mismatch'
           else 'incomplete' end,
      f.finding_code, f.movement_count
    from findings f cross join audit returning audit_id
  )
  select audit.id into v_audit_id from audit;
  return v_audit_id;
end;
$$;
revoke all on function public.run_manager_inventory_ledger_audit(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.run_manager_inventory_ledger_audit(uuid)
  to authenticated;

create function public.get_manager_inventory_audits(
  p_limit integer default 25,
  p_before_completed_at timestamptz default null,
  p_before_id uuid default null
)
returns table (id uuid, performed_by uuid, started_at timestamptz,
  completed_at timestamptz, status text, movement_rows_examined bigint,
  total_items bigint, matched_count bigint, mismatch_count bigint,
  incomplete_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.role = 'manager'::public.user_role and p.is_active = true
  ) then raise exception 'Active manager access required.' using errcode = '42501'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or (p_before_completed_at is null) <> (p_before_id is null) then
    raise exception 'Invalid audit history limit.' using errcode = '22023';
  end if;
  return query
    select a.id, a.performed_by, a.started_at, a.completed_at, a.status,
      a.movement_rows_examined, count(f.id),
      count(f.id) filter (where f.result = 'matched'),
      count(f.id) filter (where f.result = 'mismatch'),
      count(f.id) filter (where f.result = 'incomplete')
    from public.inventory_audits a
    left join public.inventory_audit_items f on f.audit_id = a.id
    where p_before_completed_at is null
      or (a.completed_at, a.id) < (p_before_completed_at, p_before_id)
    group by a.id order by a.completed_at desc, a.id desc limit p_limit;
end;
$$;
revoke all on function public.get_manager_inventory_audits(integer,timestamptz,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_manager_inventory_audits(integer,timestamptz,uuid)
  to authenticated;

create function public.get_manager_inventory_audit_items(p_audit_id uuid)
returns table (id uuid, audit_id uuid, inventory_item_id uuid,
  latest_movement_id uuid, item_name text, recorded_unit text,
  book_quantity numeric, ledger_quantity numeric, result text,
  finding_code text, movement_count integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.role = 'manager'::public.user_role and p.is_active = true
  ) then raise exception 'Active manager access required.' using errcode = '42501'; end if;
  return query select f.id, f.audit_id, f.inventory_item_id, f.latest_movement_id,
    f.item_name, f.recorded_unit, f.book_quantity, f.ledger_quantity,
    f.result, f.finding_code, f.movement_count
    from public.inventory_audit_items f where f.audit_id = p_audit_id
    order by case f.result when 'mismatch' then 0 when 'incomplete' then 1 else 2 end,
      f.item_name, f.inventory_item_id;
end;
$$;
revoke all on function public.get_manager_inventory_audit_items(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_manager_inventory_audit_items(uuid)
  to authenticated;

commit;
