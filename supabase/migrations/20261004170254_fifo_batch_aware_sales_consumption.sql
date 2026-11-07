begin;

-- RRJ'S FOOD-HOUSE
-- Phase 6B.6A: FIFO/FEFO batch-aware confirmed-order consumption.
--
-- Batch-enabled inventory is authoritative in inventory_batches. Sales keep
-- aggregate quantity, one order/item issuance, and child batch allocations in
-- one transaction. Legacy inventory remains aggregate-authoritative.

-- ---------------------------------------------------------------------------
-- Issuance-to-batch audit structure
-- ---------------------------------------------------------------------------

create table public.inventory_transaction_batch_allocations (
  id uuid primary key default gen_random_uuid(),
  inventory_transaction_id uuid not null
    references public.inventory_transactions(id) on delete restrict,
  inventory_batch_id uuid not null
    references public.inventory_batches(id) on delete restrict,
  quantity numeric(12,3) not null,
  created_at timestamptz not null default now(),
  constraint inventory_transaction_batch_allocations_quantity_pos_chk
    check (quantity <> 'NaN'::numeric and quantity > 0),
  constraint inventory_transaction_batch_allocations_transaction_batch_key
    unique (inventory_transaction_id, inventory_batch_id)
);

create index inventory_transaction_batch_allocations_batch_id_idx
on public.inventory_transaction_batch_allocations (inventory_batch_id);

create index inventory_batches_positive_fifo_idx
on public.inventory_batches (inventory_item_id, received_at, id)
where quantity_on_hand > 0;

create index inventory_batches_positive_fefo_idx
on public.inventory_batches (inventory_item_id, use_by_date, received_at, id)
where quantity_on_hand > 0;

alter table public.inventory_transaction_batch_allocations
enable row level security;

revoke all privileges
on table public.inventory_transaction_batch_allocations
from public, anon, authenticated;

grant select, insert, update, delete
on table public.inventory_transaction_batch_allocations
to service_role;

comment on table public.inventory_transaction_batch_allocations is
  'Positive child allocations that reconcile one confirmed-order inventory issuance to the exact physical batches consumed.';

comment on column public.inventory_transaction_batch_allocations.quantity is
  'Positive base-unit quantity funded by this batch; the parent issuance stores the matching negative total.';

-- ---------------------------------------------------------------------------
-- Allocation integrity and quantity-scale authority
-- ---------------------------------------------------------------------------

create function public.enforce_inventory_batch_allocation_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transaction_item_id uuid;
  v_transaction_type public.inventory_transaction_type;
  v_transaction_order_id uuid;
  v_transaction_quantity numeric;
  v_batch_item_id uuid;
  v_batch_initial numeric;
  v_quantity_scale smallint;
begin
  select
    transaction_record.inventory_item_id,
    transaction_record.transaction_type,
    transaction_record.order_id,
    transaction_record.quantity_change
  into
    v_transaction_item_id,
    v_transaction_type,
    v_transaction_order_id,
    v_transaction_quantity
  from public.inventory_transactions transaction_record
  where transaction_record.id = new.inventory_transaction_id;

  if not found then
    raise exception 'Inventory issuance transaction was not found for batch allocation.'
      using errcode = '23503';
  end if;

  if v_transaction_type <> 'issuance'::public.inventory_transaction_type
     or v_transaction_order_id is null
     or v_transaction_quantity >= 0
  then
    raise exception 'Batch allocations require a negative confirmed-order issuance transaction.'
      using errcode = '23514';
  end if;

  select batch.inventory_item_id, batch.quantity_initial
  into v_batch_item_id, v_batch_initial
  from public.inventory_batches batch
  where batch.id = new.inventory_batch_id;

  if not found then
    raise exception 'Inventory batch was not found for batch allocation.'
      using errcode = '23503';
  end if;

  if v_batch_item_id <> v_transaction_item_id then
    raise exception 'Batch allocation item does not match its issuance transaction.'
      using errcode = '23514';
  end if;

  select inventory_item.quantity_scale
  into v_quantity_scale
  from public.inventory_items inventory_item
  where inventory_item.id = v_transaction_item_id;

  if not public.inventory_quantity_matches_scale(new.quantity, v_quantity_scale) then
    raise exception 'Batch allocation quantity exceeds inventory quantity_scale %.', v_quantity_scale
      using errcode = '22023';
  end if;

  if new.quantity > v_batch_initial then
    raise exception 'Batch allocation quantity exceeds the batch initial quantity.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all
on function public.enforce_inventory_batch_allocation_integrity()
from public, anon, authenticated;

grant execute
on function public.enforce_inventory_batch_allocation_integrity()
to service_role;

create trigger inventory_transaction_batch_allocations_enforce_integrity
before insert or update of inventory_transaction_id, inventory_batch_id, quantity
on public.inventory_transaction_batch_allocations
for each row
execute function public.enforce_inventory_batch_allocation_integrity();

-- ---------------------------------------------------------------------------
-- Reusable usable-quantity and aggregate/batch consistency authorities
-- ---------------------------------------------------------------------------

create function public.inventory_usable_quantity(
  p_inventory_item_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
  select
    case
      when inventory_item.batch_consumption_enabled then
        coalesce(
          (
            select sum(batch.quantity_on_hand)
            from public.inventory_batches batch
            where batch.inventory_item_id = inventory_item.id
              and batch.quantity_on_hand > 0
              and (
                not inventory_item.expiry_required
                or batch.use_by_date >=
                  (current_timestamp at time zone 'Asia/Manila')::date
              )
          ),
          0
        )
      else inventory_item.quantity_on_hand
    end
  from public.inventory_items inventory_item
  where inventory_item.id = p_inventory_item_id;
$function$;

revoke all
on function public.inventory_usable_quantity(uuid)
from public, anon, authenticated;

grant execute
on function public.inventory_usable_quantity(uuid)
to service_role;

comment on function public.inventory_usable_quantity(uuid) is
  'Internal sale-usable quantity: aggregate for legacy items; positive, non-expired batch balance for batch-enabled items using the Asia/Manila calendar date.';

create function public.assert_batch_inventory_consistent(
  p_inventory_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_batch_enabled boolean;
  v_aggregate_quantity numeric;
  v_batch_quantity numeric;
begin
  select
    inventory_item.batch_consumption_enabled,
    inventory_item.quantity_on_hand
  into v_batch_enabled, v_aggregate_quantity
  from public.inventory_items inventory_item
  where inventory_item.id = p_inventory_item_id;

  if not found then
    raise exception 'Inventory item not found for batch consistency validation.'
      using errcode = 'P0002';
  end if;

  if not v_batch_enabled then
    return;
  end if;

  select coalesce(sum(batch.quantity_on_hand), 0)
  into v_batch_quantity
  from public.inventory_batches batch
  where batch.inventory_item_id = p_inventory_item_id;

  if v_aggregate_quantity is distinct from v_batch_quantity then
    raise exception
      'Batch inventory integrity error for item %: aggregate %, batch total %.',
      p_inventory_item_id,
      v_aggregate_quantity,
      v_batch_quantity
      using errcode = '23514';
  end if;
end;
$function$;

revoke all
on function public.assert_batch_inventory_consistent(uuid)
from public, anon, authenticated;

grant execute
on function public.assert_batch_inventory_consistent(uuid)
to service_role;

-- ---------------------------------------------------------------------------
-- Effective availability and customer cart validation
-- ---------------------------------------------------------------------------

create or replace function public.get_menu_effective_availability()
returns table (
  menu_item_id uuid,
  effective_available boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    menu_item.id,
    menu_item.is_available
      and not exists (
        select 1
        from public.menu_ingredients menu_ingredient
        left join public.inventory_items inventory_item
          on inventory_item.id = menu_ingredient.inventory_item_id
        where menu_ingredient.menu_item_id = menu_item.id
          and (
            inventory_item.id is null
            or not inventory_item.is_active
            or public.inventory_usable_quantity(inventory_item.id)
              < menu_ingredient.quantity_required
          )
      )
  from public.menu_items menu_item
  where menu_item.is_active = true;
$function$;

revoke all
on function public.get_menu_effective_availability()
from public;

grant execute
on function public.get_menu_effective_availability()
to anon, authenticated, service_role;

create or replace function public.assert_inventory_available_for_requested_items(
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_inventory_item_id uuid;
  v_inventory_item_exists boolean;
  v_item_name text;
  v_is_active boolean;
  v_usable_quantity numeric;
  v_required_quantity numeric;
begin
  with requested_items as (
    select
      (item ->> 'id')::uuid as menu_item_id,
      sum((item ->> 'qty')::integer)::integer as quantity
    from jsonb_array_elements(p_items) item
    group by (item ->> 'id')::uuid
  ),
  required_inventory as (
    select
      menu_ingredient.inventory_item_id,
      sum(requested.quantity::numeric * menu_ingredient.quantity_required)
        as required_quantity
    from requested_items requested
    join public.menu_ingredients menu_ingredient
      on menu_ingredient.menu_item_id = requested.menu_item_id
    group by menu_ingredient.inventory_item_id
  )
  select
    requirement.inventory_item_id,
    inventory_item.id is not null,
    inventory_item.item_name,
    inventory_item.is_active,
    public.inventory_usable_quantity(inventory_item.id),
    requirement.required_quantity
  into
    v_inventory_item_id,
    v_inventory_item_exists,
    v_item_name,
    v_is_active,
    v_usable_quantity,
    v_required_quantity
  from required_inventory requirement
  left join public.inventory_items inventory_item
    on inventory_item.id = requirement.inventory_item_id
  where inventory_item.id is null
    or not inventory_item.is_active
    or public.inventory_usable_quantity(inventory_item.id)
      < requirement.required_quantity
  order by requirement.inventory_item_id
  limit 1;

  if not found then
    return;
  end if;

  if not v_inventory_item_exists then
    raise exception
      'Inventory item % required by the requested cart was not found.',
      v_inventory_item_id
      using errcode = 'P0002';
  end if;

  if not v_is_active then
    raise exception
      'Inventory item "%" required by the requested cart is inactive.',
      v_item_name
      using errcode = '22023';
  end if;

  raise exception
    'Insufficient usable stock for "%": available %, required %.',
    v_item_name,
    to_char(v_usable_quantity, 'FM999999999999990.000'),
    to_char(v_required_quantity, 'FM999999999999990.000')
    using errcode = '22023';
end;
$function$;

revoke all
on function public.assert_inventory_available_for_requested_items(jsonb)
from public, anon, authenticated;

grant execute
on function public.assert_inventory_available_for_requested_items(jsonb)
to service_role;

-- Keep both Manager menu surfaces aligned with the public availability RPC.
create or replace function public.get_manager_menu_items()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  category_name text,
  price numeric,
  is_active boolean,
  is_available boolean,
  effective_available boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  return query
  select
    menu_item.id,
    menu_item.code::text,
    menu_item.name::text,
    nullif(btrim(menu_item.description), '')::text,
    menu_category.name::text,
    menu_item.price,
    menu_item.is_active,
    menu_item.is_available,
    menu_item.is_active
      and menu_item.is_available
      and not exists (
        select 1
        from public.menu_ingredients menu_ingredient
        left join public.inventory_items inventory_item
          on inventory_item.id = menu_ingredient.inventory_item_id
        where menu_ingredient.menu_item_id = menu_item.id
          and (
            inventory_item.id is null
            or not inventory_item.is_active
            or public.inventory_usable_quantity(inventory_item.id)
              < menu_ingredient.quantity_required
          )
      ),
    menu_item.updated_at
  from public.menu_items menu_item
  join public.menu_categories menu_category
    on menu_category.id = menu_item.category_id
  order by menu_category.name, menu_item.name, menu_item.id;
end;
$function$;

create or replace function public.set_manager_menu_item_availability(
  p_menu_item_id uuid,
  p_is_available boolean
)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  category_name text,
  price numeric,
  is_active boolean,
  is_available boolean,
  effective_available boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_menu_item public.menu_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  if p_menu_item_id is null or p_is_available is null then
    raise exception 'Menu item and availability are required.'
      using errcode = '22023';
  end if;

  select menu_item.*
  into v_menu_item
  from public.menu_items menu_item
  where menu_item.id = p_menu_item_id
  for update;

  if not found then
    raise exception 'Menu item not found.' using errcode = 'P0002';
  end if;

  if not v_menu_item.is_active then
    raise exception 'Availability cannot be changed for an inactive menu item.'
      using errcode = '22023';
  end if;

  update public.menu_items menu_item
  set is_available = p_is_available, updated_at = now()
  where menu_item.id = v_menu_item.id
  returning menu_item.* into v_menu_item;

  return query
  select
    v_menu_item.id,
    v_menu_item.code::text,
    v_menu_item.name::text,
    nullif(btrim(v_menu_item.description), '')::text,
    menu_category.name::text,
    v_menu_item.price,
    v_menu_item.is_active,
    v_menu_item.is_available,
    v_menu_item.is_active
      and v_menu_item.is_available
      and not exists (
        select 1
        from public.menu_ingredients menu_ingredient
        left join public.inventory_items inventory_item
          on inventory_item.id = menu_ingredient.inventory_item_id
        where menu_ingredient.menu_item_id = v_menu_item.id
          and (
            inventory_item.id is null
            or not inventory_item.is_active
            or public.inventory_usable_quantity(inventory_item.id)
              < menu_ingredient.quantity_required
          )
      ),
    v_menu_item.updated_at
  from public.menu_categories menu_category
  where menu_category.id = v_menu_item.category_id;
end;
$function$;

revoke all on function public.get_manager_menu_items() from public, anon;
revoke all on function public.set_manager_menu_item_availability(uuid, boolean) from public, anon;
grant execute on function public.get_manager_menu_items() to authenticated, service_role;
grant execute on function public.set_manager_menu_item_availability(uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Confirmed-order allocation authority
-- ---------------------------------------------------------------------------

create or replace function public.deduct_inventory_for_confirmed_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order_status public.order_status;
  v_requirement record;
  v_item public.inventory_items%rowtype;
  v_existing_transaction record;
  v_existing_allocation_count bigint;
  v_existing_allocation_total numeric;
  v_batch record;
  v_batch_total numeric;
  v_usable_quantity numeric;
  v_quantity_after numeric;
  v_remaining numeric;
  v_allocation numeric;
  v_transaction_id uuid;
  v_now timestamptz;
begin
  if p_order_id is null then
    raise exception 'Order ID is required for inventory deduction.'
      using errcode = '22023';
  end if;

  select orders.current_status
  into v_order_status
  from public.orders orders
  where orders.id = p_order_id
  for share;

  if not found then
    raise exception 'Order not found for inventory deduction.'
      using errcode = 'P0002';
  end if;

  if v_order_status not in (
    'confirmed'::public.order_status,
    'preparing'::public.order_status,
    'ready'::public.order_status,
    'waiting_for_rider'::public.order_status,
    'rider_accepted'::public.order_status,
    'picked_up'::public.order_status,
    'out_for_delivery'::public.order_status,
    'delivered'::public.order_status,
    'completed'::public.order_status
  ) then
    raise exception
      'Order % is not confirmed or in the fulfilled lifecycle. Current status: %.',
      p_order_id,
      v_order_status
      using errcode = '22023';
  end if;

  for v_requirement in
    select
      menu_ingredient.inventory_item_id,
      sum(order_item.quantity::numeric * menu_ingredient.quantity_required)
        as required_quantity
    from public.order_items order_item
    join public.menu_ingredients menu_ingredient
      on menu_ingredient.menu_item_id = order_item.menu_item_id
    where order_item.order_id = p_order_id
    group by menu_ingredient.inventory_item_id
    order by menu_ingredient.inventory_item_id
  loop
    select inventory_item.*
    into v_item
    from public.inventory_items inventory_item
    where inventory_item.id = v_requirement.inventory_item_id
    for update;

    if not found then
      raise exception
        'Inventory item % required by order % was not found.',
        v_requirement.inventory_item_id,
        p_order_id
        using errcode = 'P0002';
    end if;

    if not v_item.is_active then
      raise exception
        'Inventory item "%" is inactive and cannot be deducted.',
        v_item.item_name
        using errcode = '22023';
    end if;

    select transaction_record.*
    into v_existing_transaction
    from public.inventory_transactions transaction_record
    where transaction_record.order_id = p_order_id
      and transaction_record.inventory_item_id = v_item.id
      and transaction_record.transaction_type =
        'issuance'::public.inventory_transaction_type;

    if found then
      if v_existing_transaction.quantity_change <>
           -v_requirement.required_quantity
      then
        raise exception
          'Inventory issuance replay integrity error for order % and item "%": existing %, expected %.',
          p_order_id,
          v_item.item_name,
          v_existing_transaction.quantity_change,
          -v_requirement.required_quantity
          using errcode = '23514';
      end if;

      select count(*), coalesce(sum(allocation.quantity), 0)
      into v_existing_allocation_count, v_existing_allocation_total
      from public.inventory_transaction_batch_allocations allocation
      join public.inventory_batches batch
        on batch.id = allocation.inventory_batch_id
      where allocation.inventory_transaction_id = v_existing_transaction.id
        and batch.inventory_item_id = v_item.id;

      if v_item.batch_consumption_enabled then
        if v_existing_allocation_count = 0
           or v_existing_allocation_total <> v_requirement.required_quantity
           or exists (
             select 1
             from public.inventory_transaction_batch_allocations allocation
             join public.inventory_batches batch
               on batch.id = allocation.inventory_batch_id
             where allocation.inventory_transaction_id = v_existing_transaction.id
               and batch.inventory_item_id <> v_item.id
           )
        then
          raise exception
            'Batch allocation replay integrity error for order % and item "%".',
            p_order_id,
            v_item.item_name
            using errcode = '23514';
        end if;
      elsif exists (
        select 1
        from public.inventory_transaction_batch_allocations allocation
        where allocation.inventory_transaction_id = v_existing_transaction.id
      ) then
        raise exception
          'Legacy aggregate issuance unexpectedly has batch allocations for order % and item "%".',
          p_order_id,
          v_item.item_name
          using errcode = '23514';
      end if;

      continue;
    end if;

    if not public.inventory_quantity_matches_scale(
      v_requirement.required_quantity,
      v_item.quantity_scale
    ) then
      raise exception
        'Order requirement for item "%" exceeds quantity_scale %.',
        v_item.item_name,
        v_item.quantity_scale
        using errcode = '22023';
    end if;

    if v_item.batch_consumption_enabled then
      perform public.assert_batch_inventory_consistent(v_item.id);

      -- Lock every eligible candidate in deterministic allocation order before
      -- rechecking usable quantity. Formal receiving/opening serialize on the
      -- already-held inventory item row.
      for v_batch in
        select batch.id
        from public.inventory_batches batch
        where batch.inventory_item_id = v_item.id
          and batch.quantity_on_hand > 0
          and (
            not v_item.expiry_required
            or batch.use_by_date >=
              (current_timestamp at time zone 'Asia/Manila')::date
          )
        order by
          case when v_item.rotation_policy = 'fefo' then batch.use_by_date end
            asc nulls last,
          batch.received_at asc,
          batch.id asc
        for update
      loop
        null;
      end loop;

      select coalesce(sum(batch.quantity_on_hand), 0)
      into v_usable_quantity
      from public.inventory_batches batch
      where batch.inventory_item_id = v_item.id
        and batch.quantity_on_hand > 0
        and (
          not v_item.expiry_required
          or batch.use_by_date >=
            (current_timestamp at time zone 'Asia/Manila')::date
        );

      if v_usable_quantity < v_requirement.required_quantity then
        raise exception
          'Insufficient usable batch stock for inventory item "%": available %, required %.',
          v_item.item_name,
          v_usable_quantity,
          v_requirement.required_quantity
          using errcode = '22023';
      end if;
    elsif v_item.quantity_on_hand < v_requirement.required_quantity then
      raise exception
        'Insufficient stock for inventory item "%": available %, required %.',
        v_item.item_name,
        v_item.quantity_on_hand,
        v_requirement.required_quantity
        using errcode = '22023';
    end if;

    v_quantity_after :=
      v_item.quantity_on_hand - v_requirement.required_quantity;
    v_now := now();

    update public.inventory_items inventory_item
    set quantity_on_hand = v_quantity_after, updated_at = v_now
    where inventory_item.id = v_item.id;

    insert into public.inventory_transactions (
      inventory_item_id,
      order_id,
      performed_by,
      transaction_type,
      quantity_change,
      quantity_before,
      quantity_after,
      reason,
      created_at
    ) values (
      v_item.id,
      p_order_id,
      null,
      'issuance'::public.inventory_transaction_type,
      -v_requirement.required_quantity,
      v_item.quantity_on_hand,
      v_quantity_after,
      'Automatic deduction for confirmed order',
      v_now
    )
    returning id into v_transaction_id;

    if v_item.batch_consumption_enabled then
      v_remaining := v_requirement.required_quantity;

      for v_batch in
        select batch.id, batch.quantity_on_hand
        from public.inventory_batches batch
        where batch.inventory_item_id = v_item.id
          and batch.quantity_on_hand > 0
          and (
            not v_item.expiry_required
            or batch.use_by_date >=
              (current_timestamp at time zone 'Asia/Manila')::date
          )
        order by
          case when v_item.rotation_policy = 'fefo' then batch.use_by_date end
            asc nulls last,
          batch.received_at asc,
          batch.id asc
      loop
        exit when v_remaining = 0;
        v_allocation := least(v_remaining, v_batch.quantity_on_hand);

        update public.inventory_batches batch
        set quantity_on_hand = batch.quantity_on_hand - v_allocation
        where batch.id = v_batch.id;

        insert into public.inventory_transaction_batch_allocations (
          inventory_transaction_id,
          inventory_batch_id,
          quantity,
          created_at
        ) values (
          v_transaction_id,
          v_batch.id,
          v_allocation,
          v_now
        );

        v_remaining := v_remaining - v_allocation;
      end loop;

      if v_remaining <> 0 then
        raise exception
          'Batch allocation integrity error for order % and item "%": unallocated quantity %.',
          p_order_id,
          v_item.item_name,
          v_remaining
          using errcode = '23514';
      end if;

      if (
        select coalesce(sum(allocation.quantity), 0)
        from public.inventory_transaction_batch_allocations allocation
        where allocation.inventory_transaction_id = v_transaction_id
      ) <> v_requirement.required_quantity then
        raise exception
          'Batch allocation total does not reconcile to issuance for order % and item "%".',
          p_order_id,
          v_item.item_name
          using errcode = '23514';
      end if;

      perform public.assert_batch_inventory_consistent(v_item.id);
    end if;
  end loop;
end;
$function$;

revoke all
on function public.deduct_inventory_for_confirmed_order(uuid)
from public, anon, authenticated;

grant execute
on function public.deduct_inventory_for_confirmed_order(uuid)
to service_role;

comment on function public.deduct_inventory_for_confirmed_order(uuid) is
  'Atomic confirmed-order inventory authority. Legacy items deduct aggregate stock; batch-enabled items allocate eligible physical batches and reconcile one issuance transaction. Future void/refund reversal must restore these exact allocations, not create a new FIFO intake.';

-- ---------------------------------------------------------------------------
-- Guard aggregate-only legacy mutators for batch-enabled items
-- ---------------------------------------------------------------------------

alter function public.receive_inventory_stock(uuid, numeric, text, uuid)
rename to receive_inventory_stock_legacy_aggregate;

alter function public.adjust_inventory_stock(uuid, numeric, text, uuid)
rename to adjust_inventory_stock_legacy_aggregate;

alter function public.record_inventory_waste(uuid, numeric, text, uuid)
rename to record_inventory_waste_legacy_aggregate;

revoke all on function public.receive_inventory_stock_legacy_aggregate(uuid, numeric, text, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.adjust_inventory_stock_legacy_aggregate(uuid, numeric, text, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.record_inventory_waste_legacy_aggregate(uuid, numeric, text, uuid)
from public, anon, authenticated, service_role;

create function public.receive_inventory_stock(
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_batch_enabled boolean;
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

  select inventory_item.batch_consumption_enabled
  into v_batch_enabled
  from public.inventory_items inventory_item
  where inventory_item.id = p_inventory_item_id;

  if not found then
    raise exception 'Inventory item not found.' using errcode = 'P0002';
  end if;
  if v_batch_enabled then
    raise exception
      'Batch-enabled inventory must be received through formal receiving; aggregate receive_inventory_stock is disabled.'
      using errcode = '22023';
  end if;

  return public.receive_inventory_stock_legacy_aggregate(
    p_inventory_item_id, p_quantity, p_reason, p_request_id
  );
end;
$function$;

create function public.adjust_inventory_stock(
  p_inventory_item_id uuid,
  p_quantity_change numeric,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_batch_enabled boolean;
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

  select inventory_item.batch_consumption_enabled
  into v_batch_enabled
  from public.inventory_items inventory_item
  where inventory_item.id = p_inventory_item_id;

  if not found then
    raise exception 'Inventory item not found.' using errcode = 'P0002';
  end if;
  if v_batch_enabled then
    raise exception
      'Batch-enabled inventory requires a batch-aware adjustment workflow; aggregate adjustment is disabled.'
      using errcode = '22023';
  end if;

  return public.adjust_inventory_stock_legacy_aggregate(
    p_inventory_item_id, p_quantity_change, p_reason, p_request_id
  );
end;
$function$;

create function public.record_inventory_waste(
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_batch_enabled boolean;
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

  select inventory_item.batch_consumption_enabled
  into v_batch_enabled
  from public.inventory_items inventory_item
  where inventory_item.id = p_inventory_item_id;

  if not found then
    raise exception 'Inventory item not found.' using errcode = 'P0002';
  end if;
  if v_batch_enabled then
    raise exception
      'Batch-enabled inventory requires a batch-aware waste workflow; aggregate waste is disabled.'
      using errcode = '22023';
  end if;

  return public.record_inventory_waste_legacy_aggregate(
    p_inventory_item_id, p_quantity, p_reason, p_request_id
  );
end;
$function$;

revoke all on function public.receive_inventory_stock(uuid, numeric, text, uuid)
from public, anon;
revoke all on function public.adjust_inventory_stock(uuid, numeric, text, uuid)
from public, anon;
revoke all on function public.record_inventory_waste(uuid, numeric, text, uuid)
from public, anon;

grant execute on function public.receive_inventory_stock(uuid, numeric, text, uuid)
to authenticated, service_role;
grant execute on function public.adjust_inventory_stock(uuid, numeric, text, uuid)
to authenticated, service_role;
grant execute on function public.record_inventory_waste(uuid, numeric, text, uuid)
to authenticated, service_role;

comment on function public.receive_inventory_stock(uuid, numeric, text, uuid) is
  'Legacy aggregate receiving only. Batch-enabled inventory must use formal receiving through post_receiving_report(uuid).';
comment on function public.adjust_inventory_stock(uuid, numeric, text, uuid) is
  'Legacy aggregate adjustment only. Batch-enabled inventory is rejected until a batch-aware correction workflow exists.';
comment on function public.record_inventory_waste(uuid, numeric, text, uuid) is
  'Legacy aggregate waste only. Batch-enabled inventory is rejected until a batch-aware waste workflow exists.';

commit;
