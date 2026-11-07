begin;

-- Phase 6B.5B: generic inventory master-data foundations only.
-- No inventory master data, opening counts, or consumption behavior is created.

-- ---------------------------------------------------------------------------
-- Item policy metadata
-- ---------------------------------------------------------------------------

alter table public.inventory_items
  add column shelf_life_days smallint,
  add column batch_consumption_enabled boolean not null default false;

alter table public.inventory_items
  drop constraint inventory_items_quantity_scale_chk,
  drop constraint inventory_items_expiry_policy_chk,
  add constraint inventory_items_quantity_scale_chk
    check (quantity_scale between 0 and 3),
  add constraint inventory_items_shelf_life_days_chk
    check (shelf_life_days is null or shelf_life_days > 0),
  add constraint inventory_items_shelf_life_requires_expiry_chk
    check (shelf_life_days is null or expiry_required);

comment on column public.inventory_items.quantity_scale is
  'Authoritative base-unit precision from 0 through 3 decimal places, matching physical numeric(12,3) quantity storage.';
comment on column public.inventory_items.rotation_policy is
  'Stock-rotation policy metadata: fifo or fefo. Rotation is independent of expiry policy and does not implement allocation.';
comment on column public.inventory_items.expiry_required is
  'Whether receipt and batch records require a use-by date. This is independent of fifo/fefo rotation.';
comment on column public.inventory_items.shelf_life_days is
  'Optional Foodhouse calendar-day shelf life. Day 1 is the Asia/Manila receipt date; a configured value requires expiry_required.';
comment on column public.inventory_items.batch_consumption_enabled is
  'Policy switch for batch-authoritative consumption. False preserves aggregate-only behavior. Phase 6B.5B does not change consumption; Phase 6B.6 must keep aggregate and batch deductions in lockstep when true.';

-- ---------------------------------------------------------------------------
-- Reusable base-quantity precision authority
-- ---------------------------------------------------------------------------

create function public.inventory_quantity_matches_scale(
  p_quantity numeric,
  p_quantity_scale smallint
)
returns boolean
language sql
immutable
parallel safe
set search_path = public, extensions, pg_temp
as $function$
  select
    p_quantity is null
    or (
      p_quantity not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
      and p_quantity_scale between 0 and 3
      and p_quantity = trunc(p_quantity, p_quantity_scale)
    );
$function$;

revoke all on function public.inventory_quantity_matches_scale(numeric, smallint) from public;
grant execute on function public.inventory_quantity_matches_scale(numeric, smallint) to service_role;

alter table public.inventory_items
  add constraint inventory_items_quantity_on_hand_scale_chk
    check (public.inventory_quantity_matches_scale(quantity_on_hand, quantity_scale)),
  add constraint inventory_items_reorder_level_scale_chk
    check (public.inventory_quantity_matches_scale(reorder_level, quantity_scale));

create function public.enforce_inventory_item_quantity_policy()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $function$
begin
  if not public.inventory_quantity_matches_scale(new.quantity_on_hand, new.quantity_scale)
     or not public.inventory_quantity_matches_scale(new.reorder_level, new.quantity_scale)
  then
    raise exception 'Inventory item base quantities exceed quantity_scale %.', new.quantity_scale
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and new.quantity_scale is distinct from old.quantity_scale then
    if exists (
      select 1 from public.inventory_batches batch
      where batch.inventory_item_id = new.id
        and (
          not public.inventory_quantity_matches_scale(batch.quantity_initial, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(batch.quantity_on_hand, new.quantity_scale)
        )
    ) or exists (
      select 1 from public.inventory_transactions transaction_record
      where transaction_record.inventory_item_id = new.id
        and (
          not public.inventory_quantity_matches_scale(transaction_record.quantity_change, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(transaction_record.quantity_before, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(transaction_record.quantity_after, new.quantity_scale)
        )
    ) or exists (
      select 1 from public.receiving_report_items report_item
      left join public.purchase_order_items purchase_order_item
        on purchase_order_item.id = report_item.purchase_order_item_id
      where coalesce(report_item.inventory_item_id, purchase_order_item.inventory_item_id) = new.id
        and (
          not public.inventory_quantity_matches_scale(report_item.quantity_delivered, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(report_item.quantity_accepted, new.quantity_scale)
        )
    ) or exists (
      select 1 from public.purchase_order_items purchase_order_item
      where purchase_order_item.inventory_item_id = new.id
        and (
          not public.inventory_quantity_matches_scale(purchase_order_item.quantity_ordered, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(purchase_order_item.quantity_received, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(purchase_order_item.quantity_cancelled, new.quantity_scale)
        )
    ) or exists (
      select 1 from public.menu_ingredients ingredient
      where ingredient.inventory_item_id = new.id
        and not public.inventory_quantity_matches_scale(ingredient.quantity_required, new.quantity_scale)
    ) then
      raise exception 'quantity_scale % conflicts with stored base quantities for this inventory item.', new.quantity_scale
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$function$;

create trigger inventory_items_enforce_quantity_policy
before insert or update of quantity_on_hand, reorder_level, quantity_scale
on public.inventory_items
for each row execute function public.enforce_inventory_item_quantity_policy();

create function public.enforce_inventory_related_quantity_scale()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $function$
declare
  v_inventory_item_id uuid;
  v_quantity_scale smallint;
begin
  if tg_table_name = 'inventory_batches' then
    v_inventory_item_id := new.inventory_item_id;
  elsif tg_table_name = 'inventory_transactions' then
    v_inventory_item_id := new.inventory_item_id;
  elsif tg_table_name = 'receiving_report_items' then
    v_inventory_item_id := new.inventory_item_id;
    if v_inventory_item_id is null then
      select purchase_order_item.inventory_item_id
      into v_inventory_item_id
      from public.purchase_order_items purchase_order_item
      where purchase_order_item.id = new.purchase_order_item_id;
    end if;
  elsif tg_table_name = 'purchase_order_items' then
    v_inventory_item_id := new.inventory_item_id;
  elsif tg_table_name = 'menu_ingredients' then
    v_inventory_item_id := new.inventory_item_id;
  elsif tg_table_name = 'inventory_opening_balances' then
    v_inventory_item_id := new.inventory_item_id;
  else
    raise exception 'Unsupported inventory quantity trigger table: %.', tg_table_name;
  end if;

  select inventory_item.quantity_scale
  into v_quantity_scale
  from public.inventory_items inventory_item
  where inventory_item.id = v_inventory_item_id;

  if v_quantity_scale is null then
    raise exception 'Inventory item was not found for quantity validation.' using errcode = '23503';
  end if;

  if tg_table_name = 'inventory_batches' then
    if not public.inventory_quantity_matches_scale(new.quantity_initial, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_on_hand, v_quantity_scale)
    then
      raise exception 'Inventory batch base quantities exceed quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  elsif tg_table_name = 'inventory_transactions' then
    if not public.inventory_quantity_matches_scale(new.quantity_change, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_before, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_after, v_quantity_scale)
    then
      raise exception 'Inventory transaction base quantities exceed quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  elsif tg_table_name = 'receiving_report_items' then
    if not public.inventory_quantity_matches_scale(new.quantity_delivered, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_accepted, v_quantity_scale)
    then
      raise exception 'Receiving base quantities exceed quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  elsif tg_table_name = 'purchase_order_items' then
    if not public.inventory_quantity_matches_scale(new.quantity_ordered, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_received, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_cancelled, v_quantity_scale)
    then
      raise exception 'Purchase-order base quantities exceed quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  elsif tg_table_name = 'menu_ingredients' then
    if not public.inventory_quantity_matches_scale(new.quantity_required, v_quantity_scale) then
      raise exception 'Recipe base quantity exceeds quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  elsif tg_table_name = 'inventory_opening_balances' then
    if not public.inventory_quantity_matches_scale(new.quantity_total, v_quantity_scale) then
      raise exception 'Opening-balance total exceeds quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$function$;

create trigger inventory_batches_enforce_quantity_scale
before insert or update of inventory_item_id, quantity_initial, quantity_on_hand
on public.inventory_batches
for each row execute function public.enforce_inventory_related_quantity_scale();

create trigger inventory_transactions_enforce_quantity_scale
before insert or update of inventory_item_id, quantity_change, quantity_before, quantity_after
on public.inventory_transactions
for each row execute function public.enforce_inventory_related_quantity_scale();

create trigger receiving_report_items_enforce_quantity_scale
before insert or update of inventory_item_id, purchase_order_item_id, quantity_delivered, quantity_accepted
on public.receiving_report_items
for each row execute function public.enforce_inventory_related_quantity_scale();

create trigger purchase_order_items_enforce_quantity_scale
before insert or update of inventory_item_id, quantity_ordered, quantity_received, quantity_cancelled
on public.purchase_order_items
for each row execute function public.enforce_inventory_related_quantity_scale();

create trigger menu_ingredients_enforce_quantity_scale
before insert or update of inventory_item_id, quantity_required
on public.menu_ingredients
for each row execute function public.enforce_inventory_related_quantity_scale();

-- ---------------------------------------------------------------------------
-- Authoritative shelf-life dates on receiving lines and physical batches
-- ---------------------------------------------------------------------------

create function public.derive_inventory_use_by_date(
  p_received_at timestamp with time zone,
  p_shelf_life_days smallint
)
returns date
language sql
immutable
parallel safe
set search_path = public, extensions, pg_temp
as $function$
  select (p_received_at at time zone 'Asia/Manila')::date + (p_shelf_life_days - 1);
$function$;

revoke all on function public.derive_inventory_use_by_date(timestamp with time zone, smallint) from public;
grant execute on function public.derive_inventory_use_by_date(timestamp with time zone, smallint) to service_role;

create function public.enforce_receiving_item_shelf_life()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $function$
declare
  v_inventory_item_id uuid;
  v_received_at timestamptz;
  v_expiry_required boolean;
  v_shelf_life_days smallint;
  v_po_expiration date;
  v_supplied_use_by date;
  v_derived_use_by date;
begin
  v_inventory_item_id := new.inventory_item_id;

  if new.purchase_order_item_id is not null then
    select purchase_order_item.inventory_item_id, purchase_order_item.expiration_date
    into v_inventory_item_id, v_po_expiration
    from public.purchase_order_items purchase_order_item
    where purchase_order_item.id = new.purchase_order_item_id;
  end if;

  select report.received_at, inventory_item.expiry_required, inventory_item.shelf_life_days
  into v_received_at, v_expiry_required, v_shelf_life_days
  from public.receiving_reports report
  join public.inventory_items inventory_item on inventory_item.id = v_inventory_item_id
  where report.id = new.receiving_report_id;

  if not found then
    raise exception 'Receiving report or inventory item was not found.' using errcode = '23503';
  end if;

  v_supplied_use_by := coalesce(new.use_by_date, v_po_expiration);

  if v_shelf_life_days is not null then
    v_derived_use_by := public.derive_inventory_use_by_date(v_received_at, v_shelf_life_days);
    if v_supplied_use_by is not null and v_supplied_use_by <> v_derived_use_by then
      raise exception 'Supplied use-by date conflicts with the inventory shelf-life policy.' using errcode = '22023';
    end if;
    new.use_by_date := v_derived_use_by;
  elsif v_expiry_required then
    if v_supplied_use_by is null then
      raise exception 'Expiry-required inventory must include a use-by date.' using errcode = '22023';
    end if;
    new.use_by_date := v_supplied_use_by;
  end if;

  if new.manufactured_on is not null
     and new.use_by_date is not null
     and new.manufactured_on > new.use_by_date
  then
    raise exception 'Manufactured date cannot be after the use-by date.' using errcode = '22023';
  end if;

  return new;
end;
$function$;

create trigger receiving_report_items_enforce_shelf_life
before insert or update of receiving_report_id, inventory_item_id, purchase_order_item_id, manufactured_on, use_by_date
on public.receiving_report_items
for each row execute function public.enforce_receiving_item_shelf_life();

create function public.enforce_inventory_batch_shelf_life()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $function$
declare
  v_expiry_required boolean;
  v_shelf_life_days smallint;
  v_derived_use_by date;
begin
  select inventory_item.expiry_required, inventory_item.shelf_life_days
  into v_expiry_required, v_shelf_life_days
  from public.inventory_items inventory_item
  where inventory_item.id = new.inventory_item_id;

  if not found then
    raise exception 'Inventory item was not found for batch policy validation.' using errcode = '23503';
  end if;

  if v_shelf_life_days is not null then
    v_derived_use_by := public.derive_inventory_use_by_date(new.received_at, v_shelf_life_days);
    if new.use_by_date is not null and new.use_by_date <> v_derived_use_by then
      raise exception 'Supplied batch use-by date conflicts with the inventory shelf-life policy.' using errcode = '22023';
    end if;
    new.use_by_date := v_derived_use_by;
  elsif v_expiry_required and new.use_by_date is null then
    raise exception 'Expiry-required inventory batches must include a use-by date.' using errcode = '22023';
  end if;

  if new.manufactured_on is not null
     and new.use_by_date is not null
     and new.manufactured_on > new.use_by_date
  then
    raise exception 'Manufactured date cannot be after the use-by date.' using errcode = '22023';
  end if;

  return new;
end;
$function$;

create trigger inventory_batches_enforce_shelf_life
before insert or update of inventory_item_id, received_at, manufactured_on, use_by_date
on public.inventory_batches
for each row execute function public.enforce_inventory_batch_shelf_life();

-- ---------------------------------------------------------------------------
-- Dedicated, auditable opening-balance authority
-- ---------------------------------------------------------------------------

alter type public.inventory_transaction_type add value if not exists 'opening_balance';

create table public.inventory_opening_balances (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  inventory_item_id uuid not null unique,
  verified_by uuid not null,
  verified_at timestamp with time zone not null,
  quantity_total numeric(12,3) not null,
  batch_count integer not null,
  request_payload jsonb not null,
  notes text,
  created_at timestamp with time zone not null default now(),
  constraint inventory_opening_balances_inventory_item_id_fkey
    foreign key (inventory_item_id) references public.inventory_items(id),
  constraint inventory_opening_balances_verified_by_fkey
    foreign key (verified_by) references public.profiles(id),
  constraint inventory_opening_balances_quantity_total_nonneg_chk
    check (quantity_total >= 0 and quantity_total <> 'NaN'::numeric),
  constraint inventory_opening_balances_batch_count_nonneg_chk
    check (batch_count >= 0),
  constraint inventory_opening_balances_zero_shape_chk
    check ((quantity_total = 0) = (batch_count = 0))
);

alter table public.inventory_opening_balances enable row level security;
revoke all privileges on table public.inventory_opening_balances from public, anon, authenticated;
grant all privileges on table public.inventory_opening_balances to service_role;

comment on table public.inventory_opening_balances is
  'One-time, verified Foodhouse cutover count per batch-managed inventory item. Zero counts are recorded here without creating a batch or ledger movement.';
comment on column public.inventory_opening_balances.request_id is
  'Globally unique idempotency key for opening initialization.';
comment on column public.inventory_opening_balances.request_payload is
  'Exact normalized request used to distinguish safe replays from conflicting reuse.';

alter table public.inventory_batches
  add column opening_balance_id uuid,
  add column received_at_is_estimated boolean not null default false,
  add column notes text,
  add constraint inventory_batches_opening_balance_id_fkey
    foreign key (opening_balance_id)
    references public.inventory_opening_balances(id);

alter table public.inventory_batches
  drop constraint inventory_batches_origin_reference_chk,
  add constraint inventory_batches_origin_reference_chk
    check (
      (
        origin_type = 'receiving'
        and receiving_report_item_id is not null
        and opening_balance_id is null
        and not received_at_is_estimated
      )
      or
      (
        origin_type = 'legacy_opening'
        and receiving_report_item_id is null
        and opening_balance_id is not null
      )
    );

create index inventory_batches_opening_balance_id_idx
  on public.inventory_batches using btree (opening_balance_id);

alter table public.inventory_transactions
  add column opening_balance_id uuid,
  add constraint inventory_transactions_opening_balance_id_fkey
    foreign key (opening_balance_id)
    references public.inventory_opening_balances(id);

create unique index inventory_transactions_opening_balance_id_uidx
  on public.inventory_transactions using btree (opening_balance_id)
  where opening_balance_id is not null;

comment on column public.inventory_batches.opening_balance_id is
  'Opening authority that verified this legacy_opening batch; null for formal receiving batches.';
comment on column public.inventory_batches.received_at_is_estimated is
  'True only when a legacy opening batch had no known receipt timestamp and verification time was used as a rotation-order fallback.';
comment on column public.inventory_transactions.opening_balance_id is
  'Links the single aggregate opening_balance ledger movement to its verified opening authority.';

create trigger inventory_opening_balances_enforce_quantity_scale
before insert or update of inventory_item_id, quantity_total
on public.inventory_opening_balances
for each row execute function public.enforce_inventory_related_quantity_scale();

create function public.initialize_inventory_opening_balance(
  p_inventory_item_id uuid,
  p_batches jsonb,
  p_notes text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_item public.inventory_items%rowtype;
  v_opening public.inventory_opening_balances%rowtype;
  v_payload jsonb;
  v_notes text := nullif(btrim(p_notes), '');
  v_batch jsonb;
  v_quantity numeric;
  v_quantity_total numeric := 0;
  v_batch_count integer := 0;
  v_batch_number integer := 0;
  v_verified_at timestamptz := now();
  v_received_at timestamptz;
  v_received_at_is_estimated boolean;
  v_manufactured_on date;
  v_use_by_date date;
  v_derived_use_by date;
  v_source_lot_code text;
  v_batch_notes text;
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'Opening-balance request ID is required.' using errcode = '22023';
  end if;

  if p_inventory_item_id is null then
    raise exception 'Inventory item is required.' using errcode = '22023';
  end if;

  if p_batches is null or jsonb_typeof(p_batches) <> 'array' then
    raise exception 'Opening batches must be a JSON array.' using errcode = '22023';
  end if;

  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Opening notes must not exceed 500 characters.' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object('batches', p_batches, 'notes', v_notes);

  perform pg_advisory_xact_lock(hashtextextended('inventory-opening-request:' || p_request_id::text, 0));

  select opening.* into v_opening
  from public.inventory_opening_balances opening
  where opening.request_id = p_request_id;

  if found then
    if v_opening.inventory_item_id <> p_inventory_item_id
       or v_opening.request_payload <> v_payload
    then
      raise exception 'Opening-balance request ID was already used for a different initialization.'
        using errcode = '22023';
    end if;

    select jsonb_build_object(
      'opening_balance_id', v_opening.id,
      'request_id', v_opening.request_id,
      'inventory_item_id', v_opening.inventory_item_id,
      'quantity_total', v_opening.quantity_total,
      'batch_count', v_opening.batch_count,
      'verified_by', v_opening.verified_by,
      'verified_at', v_opening.verified_at,
      'replayed', true,
      'batches', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', batch.id,
          'batch_code', batch.batch_code,
          'quantity', batch.quantity_initial,
          'received_at', batch.received_at,
          'received_at_is_estimated', batch.received_at_is_estimated,
          'manufactured_on', batch.manufactured_on,
          'use_by_date', batch.use_by_date,
          'source_lot_code', batch.supplier_lot_code
        ) order by batch.created_at, batch.id)
        from public.inventory_batches batch
        where batch.opening_balance_id = v_opening.id
      ), '[]'::jsonb)
    ) into v_result;
    return v_result;
  end if;

  select item.* into v_item
  from public.inventory_items item
  where item.id = p_inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inventory-opening-item:' || p_inventory_item_id::text, 0));

  if not v_item.is_active then
    raise exception 'Inactive inventory items cannot be initialized.' using errcode = '22023';
  end if;

  if not v_item.batch_consumption_enabled then
    raise exception 'Opening initialization requires batch-authoritative consumption policy.' using errcode = '22023';
  end if;

  if v_item.quantity_on_hand <> 0
     or exists (select 1 from public.inventory_batches batch where batch.inventory_item_id = v_item.id)
     or exists (select 1 from public.inventory_transactions transaction_record where transaction_record.inventory_item_id = v_item.id)
     or exists (select 1 from public.inventory_opening_balances opening where opening.inventory_item_id = v_item.id)
  then
    raise exception 'Inventory item has already entered stock history and cannot receive an opening initialization.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.inventory_transactions transaction_record
    where transaction_record.performed_by = v_actor_id
      and transaction_record.mutation_request_id = p_request_id
  ) then
    raise exception 'Request ID was already used for a different inventory mutation.' using errcode = '22023';
  end if;

  for v_batch in select value from jsonb_array_elements(p_batches)
  loop
    if jsonb_typeof(v_batch) <> 'object'
       or jsonb_typeof(v_batch -> 'quantity') <> 'number'
       or (v_batch - array['quantity', 'received_at', 'manufactured_on', 'use_by_date', 'source_lot_code', 'notes']) <> '{}'::jsonb
    then
      raise exception 'Each opening batch must be an object containing only supported metadata.' using errcode = '22023';
    end if;

    v_quantity := (v_batch ->> 'quantity')::numeric;
    if v_quantity <= 0
       or not public.inventory_quantity_matches_scale(v_quantity, v_item.quantity_scale)
    then
      raise exception 'Opening batch quantity must be positive and match quantity_scale %.', v_item.quantity_scale
        using errcode = '22023';
    end if;

    v_quantity_total := v_quantity_total + v_quantity;
    v_batch_count := v_batch_count + 1;
  end loop;

  if not public.inventory_quantity_matches_scale(v_quantity_total, v_item.quantity_scale) then
    raise exception 'Opening total does not match quantity_scale %.', v_item.quantity_scale using errcode = '22023';
  end if;

  insert into public.inventory_opening_balances (
    request_id,
    inventory_item_id,
    verified_by,
    verified_at,
    quantity_total,
    batch_count,
    request_payload,
    notes
  ) values (
    p_request_id,
    v_item.id,
    v_actor_id,
    v_verified_at,
    v_quantity_total,
    v_batch_count,
    v_payload,
    v_notes
  ) returning * into v_opening;

  for v_batch in select value from jsonb_array_elements(p_batches)
  loop
    v_batch_number := v_batch_number + 1;
    v_quantity := (v_batch ->> 'quantity')::numeric;
    v_received_at_is_estimated := nullif(v_batch ->> 'received_at', '') is null;
    v_received_at := coalesce(nullif(v_batch ->> 'received_at', '')::timestamptz, v_verified_at);
    v_manufactured_on := nullif(v_batch ->> 'manufactured_on', '')::date;
    v_use_by_date := nullif(v_batch ->> 'use_by_date', '')::date;
    v_source_lot_code := nullif(btrim(v_batch ->> 'source_lot_code'), '');
    v_batch_notes := nullif(btrim(v_batch ->> 'notes'), '');

    if v_item.shelf_life_days is not null then
      if v_received_at_is_estimated then
        raise exception 'received_at is required when shelf_life_days is configured.' using errcode = '22023';
      end if;
      v_derived_use_by := public.derive_inventory_use_by_date(v_received_at, v_item.shelf_life_days);
      if v_use_by_date is not null and v_use_by_date <> v_derived_use_by then
        raise exception 'Supplied opening use-by date conflicts with the inventory shelf-life policy.' using errcode = '22023';
      end if;
      v_use_by_date := v_derived_use_by;
    elsif v_item.expiry_required and v_use_by_date is null then
      raise exception 'Expiry-required opening batches must include a use-by date.' using errcode = '22023';
    end if;

    if v_manufactured_on is not null
       and v_use_by_date is not null
       and v_manufactured_on > v_use_by_date
    then
      raise exception 'Manufactured date cannot be after the use-by date.' using errcode = '22023';
    end if;

    insert into public.inventory_batches (
      batch_code,
      inventory_item_id,
      origin_type,
      opening_balance_id,
      supplier_lot_code,
      received_at,
      received_at_is_estimated,
      manufactured_on,
      use_by_date,
      quantity_initial,
      quantity_on_hand,
      notes
    ) values (
      'OPEN-' || replace(v_opening.id::text, '-', '') || '-' || lpad(v_batch_number::text, 4, '0'),
      v_item.id,
      'legacy_opening',
      v_opening.id,
      v_source_lot_code,
      v_received_at,
      v_received_at_is_estimated,
      v_manufactured_on,
      v_use_by_date,
      v_quantity,
      v_quantity,
      v_batch_notes
    );
  end loop;

  if v_quantity_total > 0 then
    update public.inventory_items
    set quantity_on_hand = v_quantity_total,
        updated_at = v_verified_at
    where id = v_item.id;

    insert into public.inventory_transactions (
      inventory_item_id,
      performed_by,
      transaction_type,
      quantity_change,
      quantity_before,
      quantity_after,
      reason,
      mutation_request_id,
      opening_balance_id,
      created_at
    ) values (
      v_item.id,
      v_actor_id,
      'opening_balance'::public.inventory_transaction_type,
      v_quantity_total,
      0,
      v_quantity_total,
      'Verified physical opening balance',
      p_request_id,
      v_opening.id,
      v_verified_at
    );
  end if;

  select jsonb_build_object(
    'opening_balance_id', v_opening.id,
    'request_id', v_opening.request_id,
    'inventory_item_id', v_opening.inventory_item_id,
    'quantity_total', v_opening.quantity_total,
    'batch_count', v_opening.batch_count,
    'verified_by', v_opening.verified_by,
    'verified_at', v_opening.verified_at,
    'replayed', false,
    'batches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', batch.id,
        'batch_code', batch.batch_code,
        'quantity', batch.quantity_initial,
        'received_at', batch.received_at,
        'received_at_is_estimated', batch.received_at_is_estimated,
        'manufactured_on', batch.manufactured_on,
        'use_by_date', batch.use_by_date,
        'source_lot_code', batch.supplier_lot_code
      ) order by batch.created_at, batch.id)
      from public.inventory_batches batch
      where batch.opening_balance_id = v_opening.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.initialize_inventory_opening_balance(uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.initialize_inventory_opening_balance(uuid, jsonb, text, uuid) to authenticated, service_role;

comment on function public.initialize_inventory_opening_balance(uuid, jsonb, text, uuid) is
  'Manager-only, one-time, idempotent verified opening count. Preserves physical batches and writes one aggregate opening_balance ledger movement when total is positive.';

-- Keep already-authored shelf-derived lines synchronized if a draft header's
-- receipt timestamp is changed before posting.
create function public.refresh_receiving_item_shelf_life()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $function$
begin
  if new.received_at is distinct from old.received_at and new.status = 'draft' then
    update public.receiving_report_items report_item
    set use_by_date = public.derive_inventory_use_by_date(new.received_at, inventory_item.shelf_life_days)
    from public.inventory_items inventory_item
    where report_item.receiving_report_id = new.id
      and inventory_item.id = coalesce(
        report_item.inventory_item_id,
        (
          select purchase_order_item.inventory_item_id
          from public.purchase_order_items purchase_order_item
          where purchase_order_item.id = report_item.purchase_order_item_id
        )
      )
      and inventory_item.shelf_life_days is not null;
  end if;
  return new;
end;
$function$;

create trigger receiving_reports_refresh_shelf_life
after update of received_at on public.receiving_reports
for each row execute function public.refresh_receiving_item_shelf_life();

-- The draft authoring RPC previously required a manual use-by date before a
-- row trigger could derive it. Preserve its API and all other behavior while
-- delegating expiry/shelf validation to the authoritative row trigger.
create or replace function public.save_receiving_report_item(
  p_receiving_report_id uuid,
  p_receiving_report_item_id uuid,
  p_inventory_item_id uuid,
  p_purchase_order_item_id uuid,
  p_quantity_delivered numeric,
  p_quantity_accepted numeric,
  p_secondary_quantity_delivered numeric,
  p_secondary_quantity_accepted numeric,
  p_rejection_reason text,
  p_source_lot_code text,
  p_manufactured_on date,
  p_use_by_date date,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
  v_existing public.receiving_report_items%rowtype;
  v_item_id uuid;
  v_item_name text;
  v_secondary_unit text;
  v_quantity_scale smallint;
  v_po_remaining numeric;
  v_rejection_reason text := nullif(btrim(p_rejection_reason), '');
  v_source_lot_code text := nullif(btrim(p_source_lot_code), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_saved public.receiving_report_items%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  if p_receiving_report_item_id is null then
    raise exception 'Receiving line request ID is required.' using errcode = '22023';
  end if;

  select report.* into v_report
  from public.receiving_reports report
  where report.id = p_receiving_report_id
  for update;

  if not found then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;

  if v_report.status <> 'draft' then
    raise exception 'Only draft receiving reports can be edited.' using errcode = '22023';
  end if;

  select report_item.* into v_existing
  from public.receiving_report_items report_item
  where report_item.id = p_receiving_report_item_id
  for update;

  if found and v_existing.receiving_report_id <> v_report.id then
    raise exception 'Receiving line request ID belongs to another report.' using errcode = '23505';
  end if;

  if p_quantity_delivered is null
     or p_quantity_delivered in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_quantity_delivered <= 0
     or p_quantity_accepted is null
     or p_quantity_accepted in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_quantity_accepted < 0
     or p_quantity_accepted > p_quantity_delivered
  then
    raise exception 'Delivered and accepted quantities are invalid.' using errcode = '22023';
  end if;

  if v_report.source_type = 'production_team' then
    if p_inventory_item_id is null or p_purchase_order_item_id is not null then
      raise exception 'Production Team lines require an inventory item and cannot reference a PO item.'
        using errcode = '22023';
    end if;

    select
      inventory_item.id,
      inventory_item.item_name,
      inventory_item.secondary_unit,
      inventory_item.quantity_scale
    into v_item_id, v_item_name, v_secondary_unit, v_quantity_scale
    from public.inventory_items inventory_item
    where inventory_item.id = p_inventory_item_id
      and inventory_item.is_active = true;
  else
    if p_purchase_order_item_id is null or p_inventory_item_id is not null then
      raise exception 'Direct supplier lines require a PO item and cannot directly identify inventory.'
        using errcode = '22023';
    end if;

    select
      inventory_item.id,
      inventory_item.item_name,
      inventory_item.secondary_unit,
      inventory_item.quantity_scale,
      purchase_order_item.quantity_remaining
    into
      v_item_id,
      v_item_name,
      v_secondary_unit,
      v_quantity_scale,
      v_po_remaining
    from public.purchase_order_items purchase_order_item
    join public.inventory_items inventory_item
      on inventory_item.id = purchase_order_item.inventory_item_id
    where purchase_order_item.id = p_purchase_order_item_id
      and purchase_order_item.purchase_order_id = v_report.purchase_order_id
      and inventory_item.is_active = true
    for update of purchase_order_item;
  end if;

  if v_item_id is null then
    raise exception 'Receiving line inventory item was not found or is inactive.' using errcode = 'P0002';
  end if;

  if not public.inventory_quantity_matches_scale(p_quantity_delivered, v_quantity_scale)
     or not public.inventory_quantity_matches_scale(p_quantity_accepted, v_quantity_scale)
  then
    raise exception 'Receiving base quantities exceed quantity_scale %.', v_quantity_scale using errcode = '22023';
  end if;

  if v_report.source_type = 'direct_supplier'
     and p_quantity_accepted > v_po_remaining
  then
    raise exception 'Accepted quantity exceeds the PO item remaining quantity.' using errcode = '22023';
  end if;

  if v_secondary_unit is null then
    if p_secondary_quantity_delivered is not null
       or p_secondary_quantity_accepted is not null
    then
      raise exception 'Secondary quantities are not allowed for this inventory item.' using errcode = '22023';
    end if;
  else
    if p_secondary_quantity_delivered is null
       or p_secondary_quantity_accepted is null
       or p_secondary_quantity_delivered in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or p_secondary_quantity_delivered <= 0
       or p_secondary_quantity_accepted in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or p_secondary_quantity_accepted < 0
       or p_secondary_quantity_accepted > p_secondary_quantity_delivered
       or ((p_quantity_accepted = 0) <> (p_secondary_quantity_accepted = 0))
    then
      raise exception 'Independent secondary receiving quantities are invalid.' using errcode = '22023';
    end if;
  end if;

  if (
    p_quantity_delivered - p_quantity_accepted > 0
    or coalesce(p_secondary_quantity_delivered - p_secondary_quantity_accepted, 0) > 0
  ) and v_rejection_reason is null then
    raise exception 'Rejection reason is required when any quantity is rejected.' using errcode = '22023';
  end if;

  insert into public.receiving_report_items (
    id,
    receiving_report_id,
    inventory_item_id,
    purchase_order_item_id,
    quantity_delivered,
    quantity_accepted,
    secondary_quantity_delivered,
    secondary_quantity_accepted,
    rejection_reason,
    source_lot_code,
    manufactured_on,
    use_by_date,
    notes
  ) values (
    p_receiving_report_item_id,
    v_report.id,
    p_inventory_item_id,
    p_purchase_order_item_id,
    p_quantity_delivered,
    p_quantity_accepted,
    p_secondary_quantity_delivered,
    p_secondary_quantity_accepted,
    v_rejection_reason,
    v_source_lot_code,
    p_manufactured_on,
    p_use_by_date,
    v_notes
  )
  on conflict (id) do update
  set
    inventory_item_id = excluded.inventory_item_id,
    purchase_order_item_id = excluded.purchase_order_item_id,
    quantity_delivered = excluded.quantity_delivered,
    quantity_accepted = excluded.quantity_accepted,
    secondary_quantity_delivered = excluded.secondary_quantity_delivered,
    secondary_quantity_accepted = excluded.secondary_quantity_accepted,
    rejection_reason = excluded.rejection_reason,
    source_lot_code = excluded.source_lot_code,
    manufactured_on = excluded.manufactured_on,
    use_by_date = excluded.use_by_date,
    notes = excluded.notes
  returning * into v_saved;

  return jsonb_build_object(
    'id', v_saved.id,
    'receiving_report_id', v_saved.receiving_report_id,
    'inventory_item_id', v_item_id,
    'inventory_item_name', v_item_name,
    'quantity_delivered', v_saved.quantity_delivered,
    'quantity_accepted', v_saved.quantity_accepted,
    'quantity_rejected', v_saved.quantity_rejected,
    'use_by_date', v_saved.use_by_date,
    'updated_at', v_saved.updated_at
  );
end;
$function$;

commit;
