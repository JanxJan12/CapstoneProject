begin;
-- Local transition for drink choices and active ordering. Apply only after hosted approval.
-- The existing modifier_ids wire key is retained for frontend/backend rollout compatibility;
-- after cutover it accepts only product-specific drink choices.
create table public.drink_choices (
  menu_item_id uuid not null references public.menu_items(id),
  choice_kind text not null check (choice_kind in ('flavor', 'size')),
  option_id varchar(50) not null,
  option_name varchar(100) not null,
  price_adjustment numeric(12,2) not null check (price_adjustment >= 0),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  primary key (menu_item_id, option_id)
);
create index drink_choices_product_kind_idx on public.drink_choices(menu_item_id, choice_kind, sort_order);
alter table public.drink_choices enable row level security;
revoke all on public.drink_choices from public, anon, authenticated;
grant all on public.drink_choices to service_role;

do $$
begin
  if (select count(*) from public.menu_item_modifier_groups link
      join public.menu_items mi on mi.id=link.menu_item_id and mi.code in ('D1','D2')
      join public.menu_modifier_groups grp on grp.id=link.group_id and grp.is_active
      join public.menu_modifier_options opt on opt.group_id=grp.id and opt.is_active
      where (mi.code='D1' and grp.id in ('softdrink-flavor','drink-size'))
         or (mi.code='D2' and grp.id='drink-size')) <> 7
    or exists (select 1 from public.menu_item_modifier_groups link
      join public.menu_items mi on mi.id=link.menu_item_id and mi.code in ('D1','D2')
      join public.menu_modifier_groups grp on grp.id=link.group_id
      where grp.min_selections <> 1 or grp.max_selections <> 1 or not grp.is_active)
  then raise exception 'Hosted drink choice catalog differs from reviewed 7-option configuration.'; end if;
end $$;

insert into public.drink_choices(menu_item_id, choice_kind, option_id, option_name,
  price_adjustment, sort_order, is_active)
select mi.id, case when grp.id='softdrink-flavor' then 'flavor' else 'size' end,
  opt.id, opt.name, opt.price_adjustment, opt.sort_order, opt.is_active
from public.menu_item_modifier_groups link
join public.menu_items mi on mi.id=link.menu_item_id
join public.menu_modifier_groups grp on grp.id=link.group_id
join public.menu_modifier_options opt on opt.group_id=grp.id
where (mi.code='D1' and grp.id in ('softdrink-flavor','drink-size'))
   or (mi.code='D2' and grp.id='drink-size');

create or replace function public.get_drink_choices()
returns table(menu_item_id uuid, choice_kind text, option_id varchar,
  option_name varchar, price_adjustment numeric, sort_order integer)
language sql stable security definer set search_path = '' as $$
  select dc.menu_item_id, dc.choice_kind, dc.option_id, dc.option_name,
    dc.price_adjustment, dc.sort_order
  from public.drink_choices dc join public.menu_items mi on mi.id=dc.menu_item_id
  where mi.is_active and dc.is_active
  order by dc.menu_item_id, dc.choice_kind, dc.sort_order, dc.option_id;
$$;
revoke all on function public.get_drink_choices() from public;
grant execute on function public.get_drink_choices() to anon, authenticated, service_role;

create or replace function public.get_manager_drink_choices()
returns setof public.drink_choices
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id=auth.uid()
    and p.role='manager'::public.user_role and p.is_active) then
    raise exception 'Active manager access required.' using errcode='42501';
  end if;
  return query select dc.* from public.drink_choices dc
    order by dc.menu_item_id, dc.choice_kind, dc.sort_order;
end $$;
revoke all on function public.get_manager_drink_choices() from public, anon;
grant execute on function public.get_manager_drink_choices() to authenticated, service_role;

create or replace function public.set_manager_drink_choice(
  p_menu_item_id uuid, p_option_id text, p_price_adjustment numeric, p_is_active boolean)
returns public.drink_choices
language plpgsql security definer set search_path = '' as $$
declare v_choice public.drink_choices%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id=auth.uid()
    and p.role='manager'::public.user_role and p.is_active) then
    raise exception 'Active manager access required.' using errcode='42501';
  end if;
  if p_price_adjustment is null or p_price_adjustment::text in ('NaN','Infinity','-Infinity')
    or p_price_adjustment < 0 or p_price_adjustment <> round(p_price_adjustment,2)
    or p_is_active is null then
    raise exception 'Invalid drink choice configuration.' using errcode='22023';
  end if;
  perform 1 from public.menu_items where id=p_menu_item_id for update;
  update public.drink_choices set price_adjustment=p_price_adjustment, is_active=p_is_active
    where menu_item_id=p_menu_item_id and option_id=p_option_id returning * into v_choice;
  if not found then raise exception 'Drink choice not found.' using errcode='P0002'; end if;
  if not exists (select 1 from public.drink_choices dc
    where dc.menu_item_id=p_menu_item_id and dc.choice_kind=v_choice.choice_kind and dc.is_active) then
    raise exception 'At least one active % choice is required.', v_choice.choice_kind using errcode='22023';
  end if;
  return v_choice;
end $$;
revoke all on function public.set_manager_drink_choice(uuid,text,numeric,boolean) from public, anon;
grant execute on function public.set_manager_drink_choice(uuid,text,numeric,boolean) to authenticated, service_role;

create or replace function public.set_manager_fixed_meal_option(
  p_menu_item_id uuid, p_standard_price numeric, p_without_rice_price numeric,
  p_without_rice_inventory_item_id uuid default null,
  p_rice_quantity_required numeric default null)
returns table(menu_item_id uuid, standard_price numeric, without_rice_price numeric,
  without_rice_inventory_item_id uuid)
language plpgsql security definer set search_path = ''
as $function$
declare v_item public.menu_items%rowtype;
  v_inventory public.inventory_items%rowtype;
  v_existing_quantity numeric;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.role = 'manager'::public.user_role and p.is_active
  ) then raise exception 'Active manager access required.' using errcode='42501'; end if;
  if p_menu_item_id is null or p_standard_price is null
     or p_standard_price::text in ('NaN','Infinity','-Infinity')
     or p_standard_price <= 0
     or p_standard_price <> round(p_standard_price,2)
     or (p_without_rice_price is not null and
       (p_without_rice_price::text in ('NaN','Infinity','-Infinity')
        or p_without_rice_price <= 0 or p_without_rice_price >= p_standard_price
        or p_without_rice_price <> round(p_without_rice_price,2)))
     or ((p_without_rice_price is null) <> (p_without_rice_inventory_item_id is null))
     or (p_rice_quantity_required is not null and
       (p_without_rice_inventory_item_id is null
        or p_rice_quantity_required::text in ('NaN','Infinity','-Infinity')
        or p_rice_quantity_required <= 0
        or p_rice_quantity_required <> round(p_rice_quantity_required,3)))
  then raise exception 'Invalid fixed meal prices or ingredient mapping.' using errcode='22023'; end if;
  select mi.* into v_item from public.menu_items mi where mi.id=p_menu_item_id for update;
  if not found then raise exception 'Menu item not found.' using errcode='P0002'; end if;
  if v_item.without_rice_inventory_item_id is not null
    and p_without_rice_price is not null
    and p_without_rice_inventory_item_id is distinct from v_item.without_rice_inventory_item_id then
    raise exception 'Existing rice recipe selection cannot be changed through meal pricing.' using errcode='22023';
  end if;
  if p_without_rice_price is not null and exists (select 1 from public.drink_choices dc
    where dc.menu_item_id=p_menu_item_id) then
    raise exception 'Drink products cannot have fixed meal options.' using errcode='22023';
  end if;
  if p_without_rice_inventory_item_id is not null then
    select ii.* into v_inventory from public.inventory_items ii
      where ii.id=p_without_rice_inventory_item_id and ii.is_active;
    if not found then
      raise exception 'Select an active inventory item.' using errcode='22023';
    end if;
    if p_rice_quantity_required is not null and not public.inventory_quantity_matches_scale(
      p_rice_quantity_required, v_inventory.quantity_scale) then
      raise exception 'Rice quantity exceeds the inventory item unit precision.' using errcode='22023';
    end if;
    select ing.quantity_required into v_existing_quantity
      from public.menu_ingredients ing
      where ing.menu_item_id=p_menu_item_id
        and ing.inventory_item_id=p_without_rice_inventory_item_id;
    if found then
      if not public.inventory_quantity_matches_scale(
        v_existing_quantity, v_inventory.quantity_scale) then
        raise exception 'Existing recipe quantity exceeds the inventory item unit precision.' using errcode='22023';
      end if;
      if p_rice_quantity_required is not null
        and p_rice_quantity_required <> v_existing_quantity then
        raise exception 'Existing recipe quantity differs; this action cannot rewrite it.' using errcode='22023';
      end if;
    else
      if p_rice_quantity_required is null then
        raise exception 'Enter the Manager-approved rice quantity in the inventory base unit.' using errcode='22023';
      end if;
      insert into public.menu_ingredients(
        menu_item_id,inventory_item_id,quantity_required,fixed_meal_added_at)
      values (p_menu_item_id,p_without_rice_inventory_item_id,
        p_rice_quantity_required,clock_timestamp());
    end if;
  end if;
  update public.menu_items mi set price=p_standard_price,
    without_rice_price=p_without_rice_price,
    without_rice_inventory_item_id=p_without_rice_inventory_item_id,
    updated_at=now() where mi.id=p_menu_item_id;
  return query select mi.id, mi.price, mi.without_rice_price,
    mi.without_rice_inventory_item_id from public.menu_items mi where mi.id=p_menu_item_id;
end;
$function$;
revoke all on function public.set_manager_fixed_meal_option(uuid,numeric,numeric,uuid,numeric) from public, anon;
grant execute on function public.set_manager_fixed_meal_option(uuid,numeric,numeric,uuid,numeric)
  to authenticated, service_role;

create or replace function public.place_customer_order(
  p_customer_name text, p_contact_number text, p_delivery_address text,
  p_landmark text, p_items jsonb, p_request_id uuid)
returns table(order_id uuid, order_number varchar, subtotal numeric,
  delivery_fee numeric, grand_total numeric, current_status public.order_status)
language plpgsql security definer set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_existing_order public.orders%rowtype;
  v_order_id uuid;
  v_order_number varchar;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 50;
  v_item jsonb;
  v_ids jsonb;
  v_menu public.menu_items%rowtype;
  v_qty integer;
  v_total_qty integer;
  v_option_count integer;
  v_snapshot jsonb;
  v_adjustment numeric;
  v_group record;
  v_group_count integer;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_inventory_items jsonb;
  v_meal_option text;
  v_excluded_inventory_item_id uuid;
begin
  if v_customer_id is null then
    raise exception 'Authentication is required to place an order.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_customer_id
      and p.role = 'customer'::public.user_role and p.is_active) then
    raise exception 'Only an active customer account may place an order.';
  end if;
  if p_request_id is null then raise exception 'Order request ID is required.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_customer_id::text || ':' || p_request_id::text, 0));
  select o.* into v_existing_order from public.orders o
  where o.customer_id = v_customer_id and o.customer_request_id = p_request_id limit 1;
  if found then
    return query select v_existing_order.id, v_existing_order.order_number,
      v_existing_order.subtotal, v_existing_order.delivery_fee,
      v_existing_order.grand_total, v_existing_order.current_status;
    return;
  end if;
  if nullif(pg_catalog.btrim(p_customer_name), '') is null then
    raise exception 'Customer name is required.';
  end if;
  if pg_catalog.btrim(coalesce(p_contact_number, '')) !~ '^09[0-9]{9}$' then
    raise exception 'A valid Philippine mobile number is required.';
  end if;
  if nullif(pg_catalog.btrim(p_delivery_address), '') is null then
    raise exception 'Delivery address is required.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
      or jsonb_array_length(p_items) not between 1 and 99 then
    raise exception 'The order must contain 1 to 99 cart lines.';
  end if;

  -- Each line has its own option set; only quantities are combined for inventory.
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(v_item->'qty') <> 'number'
      or coalesce(v_item->>'qty', '') !~ '^([1-9]|[1-9][0-9])$' then
      raise exception 'One or more cart items are invalid.';
    end if;
    v_qty := (v_item->>'qty')::integer;
    select mi.* into v_menu from public.menu_items mi
      where mi.id = (v_item->>'id')::uuid and mi.is_active and mi.is_available
      for share;
    if not found then raise exception 'One or more menu items are unavailable or invalid.'; end if;
    if v_item ? 'modifier_ids' and jsonb_typeof(v_item->'modifier_ids') <> 'array' then
      raise exception 'Invalid drink choices for %.', v_menu.name;
    end if;
    v_ids := coalesce(v_item->'modifier_ids', '[]'::jsonb);
    if jsonb_array_length(v_ids) > 2 or exists (
      select 1 from jsonb_array_elements(v_ids) selected(value)
      where jsonb_typeof(selected.value) <> 'string'
        or length(selected.value #>> '{}') > 50
    ) then raise exception 'Invalid drink choices for %.', v_menu.name; end if;
    select count(*) into v_option_count from jsonb_array_elements_text(v_ids);
    if v_option_count <> (select count(distinct selected.id)
      from jsonb_array_elements_text(v_ids) selected(id)) then
      raise exception 'Duplicate drink choices are not allowed for %.', v_menu.name;
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_ids) selected(id)
      left join public.drink_choices dc on dc.menu_item_id = v_menu.id
        and dc.option_id = selected.id and dc.is_active
      where dc.option_id is null) then
      raise exception 'Invalid drink choice for %.', v_menu.name;
    end if;
    for v_group in select distinct choice_kind from public.drink_choices
      where menu_item_id = v_menu.id loop
      select count(*) into v_group_count from jsonb_array_elements_text(v_ids) selected(id)
        join public.drink_choices dc on dc.menu_item_id = v_menu.id
          and dc.option_id = selected.id and dc.choice_kind = v_group.choice_kind and dc.is_active;
      if v_group_count <> 1 then
        raise exception '% requires exactly one % choice.', v_menu.name, v_group.choice_kind;
      end if;
    end loop;
    select coalesce(sum(dc.price_adjustment), 0),
      coalesce(jsonb_agg(jsonb_build_object('id', dc.option_id, 'name', dc.option_name,
        'price', dc.price_adjustment, 'choice_kind', dc.choice_kind)
        order by dc.choice_kind, dc.sort_order), '[]'::jsonb)
      into v_adjustment, v_snapshot
    from jsonb_array_elements_text(v_ids) selected(id)
    join public.drink_choices dc on dc.menu_item_id = v_menu.id and dc.option_id = selected.id;
    -- Fixed meal pricing is computed from the locked catalog row, never the cart.
    v_meal_option := null;
    v_excluded_inventory_item_id := null;
    if v_menu.without_rice_price is not null
      and v_menu.without_rice_inventory_item_id is not null then
      if v_option_count <> 0 then
        raise exception 'Drink choices cannot be combined with meal options for %.', v_menu.name;
      end if;
      if v_item ? 'meal_option' and jsonb_typeof(v_item->'meal_option') <> 'string' then
        raise exception 'Invalid meal option for %.', v_menu.name;
      end if;
      v_meal_option := coalesce(v_item->>'meal_option', 'with_rice');
      if v_meal_option not in ('with_rice', 'without_rice') then
        raise exception 'Invalid meal option for %.', v_menu.name;
      end if;
      v_adjustment := case when v_meal_option = 'without_rice'
        then v_menu.without_rice_price - v_menu.price else 0 end;
      v_excluded_inventory_item_id := case when v_meal_option = 'without_rice'
        then v_menu.without_rice_inventory_item_id else null end;
      v_snapshot := jsonb_build_array(jsonb_build_object(
        'id', 'fixed_meal:' || v_meal_option,
        'name', case when v_meal_option = 'with_rice' then 'With Rice' else 'Without Rice' end,
        'price', v_adjustment,
        'rice_inventory_item_id', v_menu.without_rice_inventory_item_id,
        'excluded_inventory_item_id', v_excluded_inventory_item_id));
    elsif v_item ? 'meal_option' then
      raise exception 'Meal option is unavailable for %.', v_menu.name;
    end if;
    v_subtotal := v_subtotal + (v_menu.price + v_adjustment) * v_qty;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'id', v_menu.id, 'name', v_menu.name, 'qty', v_qty,
      'unit_price', v_menu.price + v_adjustment, 'modifiers', v_snapshot));
  end loop;
  if exists (select 1 from (select line->>'id' id, sum((line->>'qty')::integer) qty
    from jsonb_array_elements(v_lines) line group by line->>'id') totals where qty > 99) then
    raise exception 'A menu item quantity cannot exceed 99.';
  end if;
  v_inventory_items := v_lines;
  perform public.assert_inventory_available_for_requested_items(v_inventory_items);
  if v_subtotal <= 0 then raise exception 'The order subtotal must be greater than zero.'; end if;

  v_order_id := gen_random_uuid();
  v_order_number := 'ORD-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  insert into public.orders (id, order_number, customer_id, processed_by,
    order_channel, fulfillment_type, customer_name, customer_contact_number,
    delivery_address, landmark, current_status, subtotal, delivery_fee,
    grand_total, customer_request_id)
  values (v_order_id, v_order_number, v_customer_id, null,
    'online'::public.order_channel, 'delivery'::public.fulfillment_type,
    btrim(p_customer_name), btrim(p_contact_number), btrim(p_delivery_address),
    nullif(btrim(coalesce(p_landmark, '')), ''),
    'waiting_payment_verification'::public.order_status, v_subtotal,
    v_delivery_fee, v_subtotal + v_delivery_fee, p_request_id);
  for v_line in select value from jsonb_array_elements(v_lines) loop
    insert into public.order_items (order_id, menu_item_id, item_name,
      quantity, unit_price, line_total, modifiers)
    values (v_order_id, (v_line->>'id')::uuid, v_line->>'name',
      (v_line->>'qty')::integer, (v_line->>'unit_price')::numeric,
      (v_line->>'unit_price')::numeric * (v_line->>'qty')::integer,
      v_line->'modifiers');
  end loop;
  insert into public.order_status_history (order_id, status, changed_by, notes)
  values (v_order_id, 'waiting_payment_verification'::public.order_status,
    v_customer_id, 'Order created');
  return query select v_order_id, v_order_number, v_subtotal, v_delivery_fee,
    v_subtotal + v_delivery_fee, 'waiting_payment_verification'::public.order_status;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."create_walk_in_sale"("p_request_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type", "p_customer_name" "text", "p_contact_number" "text", "p_table_number" "text", "p_discount_type" "text", "p_discount_reference" "text", "p_order_instructions" "text", "p_payment_method" "public"."payment_method", "p_cash_received" numeric, "p_gcash_reference_number" "text", "p_items" "jsonb") RETURNS TABLE("order_id" "uuid", "order_number" character varying, "transaction_id" "uuid", "transaction_number" character varying, "receipt_number" character varying, "payment_id" "uuid", "shift_id" "uuid", "subtotal" numeric, "discount_amount" numeric, "tax_amount" numeric, "grand_total" numeric, "payment_method" "public"."payment_method", "cash_received" numeric, "change_due" numeric, "current_status" "public"."order_status", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_cashier_id uuid;
  v_shift_id uuid;
  v_existing_cashier_id uuid;

  v_customer_name varchar(80);
  v_contact_number varchar(20);
  v_table_number varchar(20);
  v_discount_type varchar(40);
  v_discount_reference varchar(100);
  v_order_notes text;

  v_item jsonb;
  v_menu_item public.menu_items%rowtype;
  v_menu_item_id uuid;
  v_quantity integer;

  v_modifier_ids jsonb;
  v_modifier_count integer;
  v_distinct_modifier_count integer;
  v_modifier_total numeric(12,2);
  v_canonical_modifiers jsonb;
  v_meal_option text;
  v_excluded_inventory_item_id uuid;

  v_group record;
  v_group_count integer;

  v_note text;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);

  v_validated_items jsonb := '[]'::jsonb;

  v_subtotal numeric(12,2) := 0;
  v_discount_amount numeric(12,2) := 0;
  v_tax_amount numeric(12,2) := 0;
  v_grand_total numeric(12,2);

  v_cash_received numeric(12,2);
  v_gcash_reference varchar;

  v_order_id uuid;
  v_order_number varchar;

  v_payment_id uuid;

  v_transaction_id uuid;
  v_transaction_sequence bigint;
  v_transaction_number varchar;
  v_receipt_number varchar;

  v_created_at timestamptz;
  v_validated_line jsonb;
begin

  -- ============================================================
  -- 1. AUTHENTICATION / AUTHORIZATION
  -- ============================================================

  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to create a walk-in sale.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may create a walk-in sale.';
  end if;


  -- ============================================================
  -- 2. IDEMPOTENCY
  --
  -- A retry with the same request UUID returns the original sale
  -- instead of creating another order.
  -- ============================================================

  if p_request_id is null then
    raise exception
      'A checkout request ID is required.';
  end if;

  select t.cashier_id
  into v_existing_cashier_id
  from public.cashier_transactions t
  where t.request_id = p_request_id;

  if found then

    if v_existing_cashier_id <> v_cashier_id then
      raise exception
        'This checkout request ID has already been used.';
    end if;

    return query
    select
      o.id,
      o.order_number,
      t.id,
      t.transaction_number,
      t.receipt_number,
      p.id,
      t.shift_id,
      o.subtotal,
      o.discount_amount,
      o.tax_amount,
      o.grand_total,
      p.payment_method,
      p.cash_received,
      case
        when p.payment_method =
          'cash'::public.payment_method
        then round(
          p.cash_received - p.amount,
          2
        )
        else null
      end,
      o.current_status,
      o.created_at
    from public.cashier_transactions t
    join public.orders o
      on o.id = t.order_id
    join public.payments p
      on p.id = t.payment_id
    where t.request_id = p_request_id;

    return;
  end if;


  -- ============================================================
  -- 3. ACTIVE SHIFT
  --
  -- Lock it so shift closing and sale creation cannot race.
  -- ============================================================

  select s.id
  into v_shift_id
  from public.cashier_shifts s
  where s.cashier_id = v_cashier_id
    and s.status =
      'open'::public.cashier_shift_status
  for update;

  if not found then
    raise exception
      'Start a cashier shift before placing an order.';
  end if;


  -- ============================================================
  -- 4. FULFILLMENT
  --
  -- The current walk-in POS supports Dine-in and Take-out.
  -- Delivery remains part of the wider order system but is not
  -- created by this counter-sale RPC.
  -- ============================================================

  if p_fulfillment_type not in (
    'dine_in'::public.fulfillment_type,
    'takeout'::public.fulfillment_type
  ) then
    raise exception
      'Walk-in POS supports only dine-in or take-out orders.';
  end if;


  -- ============================================================
  -- 5. CUSTOMER DETAILS
  -- ============================================================

  v_customer_name :=
    coalesce(
      nullif(
        btrim(coalesce(p_customer_name, '')),
        ''
      ),
      'Walk-in Customer'
    );

  if char_length(v_customer_name) > 80 then
    raise exception
      'Customer name must be 80 characters or fewer.';
  end if;


  v_contact_number :=
    nullif(
      btrim(coalesce(p_contact_number, '')),
      ''
    );

  if v_contact_number is not null
     and char_length(v_contact_number) > 20
  then
    raise exception
      'Contact number must be 20 characters or fewer.';
  end if;


  -- ============================================================
  -- 6. DINE-IN TABLE
  -- ============================================================

  if p_fulfillment_type =
     'dine_in'::public.fulfillment_type
  then

    v_table_number :=
      nullif(
        btrim(coalesce(p_table_number, '')),
        ''
      );

    if v_table_number is not null then

      -- "001" → "1", "010" → "10"
      v_table_number :=
        regexp_replace(
          v_table_number,
          '^0+([0-9])',
          '\1'
        );

      if char_length(v_table_number) > 20 then
        raise exception
          'Table number cannot exceed 20 characters.';
      end if;

      if exists (
        select 1
        from public.orders o
        where o.fulfillment_type =
          'dine_in'::public.fulfillment_type
          and o.table_number is not null
          and lower(o.table_number) =
              lower(v_table_number)
          and o.current_status not in (
            'completed'::public.order_status,
            'cancelled'::public.order_status,
            'rejected'::public.order_status
          )
      ) then
        raise exception
          'Table % already has an active order.',
          v_table_number;
      end if;

    end if;

  else
    v_table_number := null;
  end if;


  -- ============================================================
  -- 7. DISCOUNT
  --
  -- Current POS rules:
  -- Senior Citizen = 20%
  -- PWD            = 20%
  -- ============================================================

  v_discount_type :=
    nullif(
      btrim(coalesce(p_discount_type, '')),
      ''
    );

  if v_discount_type is not null
     and v_discount_type not in (
       'Senior Citizen',
       'PWD'
     )
  then
    raise exception
      'Invalid discount type.';
  end if;


  if v_discount_type is not null then

    v_discount_reference :=
      nullif(
        btrim(
          coalesce(
            p_discount_reference,
            ''
          )
        ),
        ''
      );

    if v_discount_reference is null then
      raise exception
        'ID or reference is required for this discount.';
    end if;

    if char_length(v_discount_reference) > 100 then
      raise exception
        'Discount reference cannot exceed 100 characters.';
    end if;

  else
    v_discount_reference := null;
  end if;


  v_order_notes :=
    nullif(
      btrim(
        coalesce(
          p_order_instructions,
          ''
        )
      ),
      ''
    );


  -- ============================================================
  -- 8. CART STRUCTURE
  --
  -- Expected item:
  --
  -- {
  --   "menu_item_id": "<uuid>",
  --   "quantity": 2,
  --   "modifier_ids": ["drink-coke", "drink-large"],
  --   "note": "..."
  -- }
  -- ============================================================

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception
      'Add at least one menu item.';
  end if;


  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where
      jsonb_typeof(item) <> 'object'

      or coalesce(
        item ->> 'menu_item_id',
        ''
      ) !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

      or not (
        coalesce(
          item ->> 'quantity',
          ''
        ) ~ '^[1-9][0-9]*$'
      )

      or (
        case
          when coalesce(
            item ->> 'quantity',
            ''
          ) ~ '^[1-9][0-9]*$'
          then
            (item ->> 'quantity')::integer > 99
          else true
        end
      )

      or (
        item ? 'modifier_ids'
        and jsonb_typeof(
          item -> 'modifier_ids'
        ) <> 'array'
      )
  ) then
    raise exception
      'One or more cart items are invalid.';
  end if;


  -- Aggregate quantity for the same menu item must also stay <= 99.
  if exists (
    select 1
    from (
      select
        (item ->> 'menu_item_id')::uuid
          as menu_item_id,
        sum(
          (item ->> 'quantity')::integer
        ) as quantity
      from jsonb_array_elements(p_items) item
      group by
        (item ->> 'menu_item_id')::uuid
    ) q
    where q.quantity > 99
  ) then
    raise exception
      'A menu item quantity cannot exceed 99.';
  end if;


  -- ============================================================
  -- 9. SERVER-AUTHORITATIVE ITEM + MODIFIER PRICING
  -- ============================================================

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop

    v_menu_item_id :=
      (v_item ->> 'menu_item_id')::uuid;

    v_quantity :=
      (v_item ->> 'quantity')::integer;


    select mi.*
    into v_menu_item
    from public.menu_items mi
    where mi.id = v_menu_item_id
      and mi.is_active = true
      and mi.is_available = true
    for share;

    if not found then
      raise exception
        'One or more menu items are unavailable or invalid.';
    end if;


    v_modifier_ids := coalesce(v_item -> 'modifier_ids', '[]'::jsonb);
    if jsonb_typeof(v_modifier_ids) <> 'array' or jsonb_array_length(v_modifier_ids) > 2
      or exists (select 1 from jsonb_array_elements(v_modifier_ids) selected(value)
        where jsonb_typeof(selected.value) <> 'string'
          or length(selected.value #>> '{}') > 50) then
      raise exception 'Invalid drink choices for %.', v_menu_item.name;
    end if;
    v_modifier_count := jsonb_array_length(v_modifier_ids);
    select count(distinct selected.option_id) into v_distinct_modifier_count
      from jsonb_array_elements_text(v_modifier_ids) selected(option_id);
    if v_modifier_count <> v_distinct_modifier_count then
      raise exception 'Duplicate drink choices are not allowed for %.', v_menu_item.name;
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_modifier_ids) selected(option_id)
      left join public.drink_choices dc on dc.menu_item_id = v_menu_item.id
        and dc.option_id = selected.option_id and dc.is_active
      where dc.option_id is null) then
      raise exception 'Invalid drink choice for %.', v_menu_item.name;
    end if;
    for v_group in select distinct choice_kind from public.drink_choices
      where menu_item_id = v_menu_item.id loop
      select count(*) into v_group_count from jsonb_array_elements_text(v_modifier_ids) selected(option_id)
        join public.drink_choices dc on dc.menu_item_id = v_menu_item.id
          and dc.option_id = selected.option_id and dc.choice_kind = v_group.choice_kind and dc.is_active;
      if v_group_count <> 1 then
        raise exception '% requires exactly one % choice.', v_menu_item.name, v_group.choice_kind;
      end if;
    end loop;
    select coalesce(sum(dc.price_adjustment), 0),
      coalesce(jsonb_agg(jsonb_build_object('id', dc.option_id, 'name', dc.option_name,
        'price', dc.price_adjustment, 'choice_kind', dc.choice_kind)
        order by selected.ordinality), '[]'::jsonb)
      into v_modifier_total, v_canonical_modifiers
      from jsonb_array_elements_text(v_modifier_ids) with ordinality selected(option_id, ordinality)
      join public.drink_choices dc on dc.menu_item_id = v_menu_item.id
        and dc.option_id = selected.option_id;
    -- Meal choices use their own fixed configuration. Existing modifiers
    -- continue working on ordinary products during the transition.
    v_meal_option := null;
    v_excluded_inventory_item_id := null;
    if v_menu_item.without_rice_price is not null
      and v_menu_item.without_rice_inventory_item_id is not null then
      if v_modifier_count <> 0 then
        raise exception 'Drink choices cannot be combined with meal options for %.', v_menu_item.name;
      end if;
      if v_item ? 'meal_option' and jsonb_typeof(v_item->'meal_option') <> 'string' then
        raise exception 'Invalid meal option for %.', v_menu_item.name;
      end if;
      v_meal_option := coalesce(v_item->>'meal_option', 'with_rice');
      if v_meal_option not in ('with_rice', 'without_rice') then
        raise exception 'Invalid meal option for %.', v_menu_item.name;
      end if;
      v_modifier_total := case when v_meal_option = 'without_rice'
        then v_menu_item.without_rice_price - v_menu_item.price else 0 end;
      v_excluded_inventory_item_id := case when v_meal_option = 'without_rice'
        then v_menu_item.without_rice_inventory_item_id else null end;
      v_canonical_modifiers := jsonb_build_array(jsonb_build_object(
        'id', 'fixed_meal:' || v_meal_option,
        'name', case when v_meal_option = 'with_rice' then 'With Rice' else 'Without Rice' end,
        'price', v_modifier_total,
        'rice_inventory_item_id', v_menu_item.without_rice_inventory_item_id,
        'excluded_inventory_item_id', v_excluded_inventory_item_id));
    elsif v_item ? 'meal_option' then
      raise exception 'Meal option is unavailable for %.', v_menu_item.name;
    end if;
    v_unit_price := round(v_menu_item.price + v_modifier_total, 2);


    v_line_total :=
      round(
        v_unit_price * v_quantity,
        2
      );


    v_note :=
      nullif(
        btrim(
          coalesce(
            v_item ->> 'note',
            ''
          )
        ),
        ''
      );

    if v_note is not null
       and char_length(v_note) > 120
    then
      v_note := left(v_note, 120);
    end if;


    v_validated_items :=
      v_validated_items ||
      jsonb_build_array(
        jsonb_build_object(
          'menu_item_id',
            v_menu_item.id,
          'item_name',
            v_menu_item.name,
          'quantity',
            v_quantity,
          'unit_price',
            v_unit_price,
          'line_total',
            v_line_total,
          'note',
            v_note,
          'modifiers',
            v_canonical_modifiers
        )
      );


    v_subtotal :=
      v_subtotal + v_line_total;

  end loop;


  v_subtotal :=
    round(v_subtotal, 2);


  if v_subtotal <= 0 then
    raise exception
      'Order subtotal must be greater than zero.';
  end if;


  -- ============================================================
  -- 10. DISCOUNT / TAX / TOTAL
  --
  -- Tax is intentionally 0 because POS_TAX_ENABLED is currently
  -- false.
  -- ============================================================

  if v_discount_type is not null then
    v_discount_amount :=
      round(
        v_subtotal * 0.20,
        2
      );
  else
    v_discount_amount := 0;
  end if;


  v_tax_amount := 0;


  v_grand_total :=
    round(
      v_subtotal
      - v_discount_amount
      + v_tax_amount,
      2
    );


  if v_grand_total < 0 then
    raise exception
      'Order total cannot be negative.';
  end if;


  -- ============================================================
  -- 11. PAYMENT VALIDATION
  -- ============================================================

  if p_payment_method =
     'cash'::public.payment_method
  then

    if p_cash_received is null then
      raise exception
        'Cash received is required.';
    end if;

    if p_cash_received::text in (
      'NaN',
      'Infinity',
      '-Infinity'
    ) then
      raise exception
        'Cash received is invalid.';
    end if;


    v_cash_received :=
      round(p_cash_received, 2);


    if v_cash_received <
       v_grand_total
    then
      raise exception
        'Cash received is less than the order total.';
    end if;


    v_gcash_reference := null;


  elsif p_payment_method =
        'gcash'::public.payment_method
  then

    v_cash_received := null;


    v_gcash_reference :=
      nullif(
        btrim(
          coalesce(
            p_gcash_reference_number,
            ''
          )
        ),
        ''
      );


    if v_gcash_reference is null then
      raise exception
        'GCash reference number is required.';
    end if;


    if char_length(v_gcash_reference) > 100 then
      raise exception
        'GCash reference number cannot exceed 100 characters.';
    end if;


    if exists (
      select 1
      from public.payments p
      where p.payment_method =
        'gcash'::public.payment_method
        and lower(
          btrim(
            p.gcash_reference_number
          )
        ) =
        lower(
          btrim(
            v_gcash_reference
          )
        )
    ) then
      raise exception
        'This GCash reference number has already been used.';
    end if;


  else
    raise exception
      'Unsupported payment method.';
  end if;


  -- ============================================================
  -- 12. SERVER-GENERATED IDENTIFIERS
  -- ============================================================

  v_created_at := now();

  v_order_id :=
    gen_random_uuid();


  v_order_number :=
    'ORD-' ||
    lpad(
      nextval(
        'public.order_number_seq'
      )::text,
      6,
      '0'
    );


  v_payment_id :=
    gen_random_uuid();


  v_transaction_id :=
    gen_random_uuid();


  v_transaction_sequence :=
    nextval(
      'public.cashier_transaction_number_seq'
    );


  v_transaction_number :=
    'TXN-' ||
    lpad(
      v_transaction_sequence::text,
      6,
      '0'
    );


  v_receipt_number :=
    'RCP-' ||
    lpad(
      v_transaction_sequence::text,
      6,
      '0'
    );


  -- ============================================================
  -- 13. ORDER
  -- ============================================================

  insert into public.orders (
    id,
    order_number,
    customer_id,
    processed_by,
    order_channel,
    fulfillment_type,

    customer_name,
    customer_contact_number,

    delivery_address,
    landmark,
    table_number,

    current_status,

    subtotal,
    delivery_fee,
    discount_type,
    discount_reference,
    discount_amount,
    tax_amount,
    grand_total,

    notes,

    confirmed_at,
    created_at
  )
  values (
    v_order_id,
    v_order_number,
    null,
    v_cashier_id,
    'walk_in'::public.order_channel,
    p_fulfillment_type,

    v_customer_name,
    v_contact_number,

    null,
    null,
    v_table_number,

    'confirmed'::public.order_status,

    v_subtotal,
    0,
    v_discount_type,
    v_discount_reference,
    v_discount_amount,
    v_tax_amount,
    v_grand_total,

    v_order_notes,

    v_created_at,
    v_created_at
  );


  -- ============================================================
  -- 14. ORDER ITEMS
  -- ============================================================

  for v_validated_line in
    select value
    from jsonb_array_elements(
      v_validated_items
    )
  loop

    insert into public.order_items (
      order_id,
      menu_item_id,
      item_name,
      quantity,
      unit_price,
      line_total,
      special_instructions,
      modifiers,
      created_at
    )
    values (
      v_order_id,

      (
        v_validated_line
          ->> 'menu_item_id'
      )::uuid,

      v_validated_line
        ->> 'item_name',

      (
        v_validated_line
          ->> 'quantity'
      )::integer,

      (
        v_validated_line
          ->> 'unit_price'
      )::numeric,

      (
        v_validated_line
          ->> 'line_total'
      )::numeric,

      nullif(
        v_validated_line
          ->> 'note',
        ''
      ),

      coalesce(
        v_validated_line
          -> 'modifiers',
        '[]'::jsonb
      ),

      v_created_at
    );

  end loop;


  -- ============================================================
  -- 15. PAYMENT
  --
  -- Counter Cash and counter GCash are verified immediately.
  -- ============================================================

  insert into public.payments (
    id,
    order_id,
    payment_method,
    amount,

    gcash_reference_number,
    proof_image_path,

    cash_received,

    status,
    verified_by,
    verified_at,

    created_at,
    updated_at
  )
  values (
    v_payment_id,
    v_order_id,
    p_payment_method,
    v_grand_total,

    v_gcash_reference,
    null,

    v_cash_received,

    'verified'::public.payment_status,
    v_cashier_id,
    v_created_at,

    v_created_at,
    v_created_at
  );


  -- ============================================================
  -- 16. CASHIER TRANSACTION
  -- ============================================================

  insert into public.cashier_transactions (
    id,
    transaction_number,
    receipt_number,

    order_id,
    payment_id,
    shift_id,
    cashier_id,

    status,
    request_id,

    created_at
  )
  values (
    v_transaction_id,
    v_transaction_number,
    v_receipt_number,

    v_order_id,
    v_payment_id,
    v_shift_id,
    v_cashier_id,

    'completed'::public.cashier_transaction_status,
    p_request_id,

    v_created_at
  );


  -- ============================================================
  -- 17. ORDER STATUS HISTORY
  -- ============================================================

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes,
    created_at
  )
  values (
    v_order_id,
    'confirmed'::public.order_status,
    v_cashier_id,
    'Walk-in sale created and payment verified',
    v_created_at
  );


  -- ============================================================
  -- 18. RETURN COMPLETE SALE
  -- ============================================================

  return query
  select
    v_order_id,
    v_order_number,

    v_transaction_id,
    v_transaction_number,
    v_receipt_number,

    v_payment_id,
    v_shift_id,

    v_subtotal,
    v_discount_amount,
    v_tax_amount,
    v_grand_total,

    p_payment_method,
    v_cash_received,

    case
      when p_payment_method =
        'cash'::public.payment_method
      then
        round(
          v_cash_received -
          v_grand_total,
          2
        )
      else null
    end,

    'confirmed'::public.order_status,
    v_created_at;

end;
$_$;


revoke all on function public.place_customer_order(text,text,text,text,jsonb,uuid) from public, anon;
grant execute on function public.place_customer_order(text,text,text,text,jsonb,uuid)
  to authenticated, service_role;
revoke all on function public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,text,text,text,text,public.payment_method,numeric,text,jsonb)
  from public, anon;
grant execute on function public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,text,text,text,text,public.payment_method,numeric,text,jsonb)
  to authenticated, service_role;
revoke all on function public.assert_inventory_available_for_requested_items(jsonb) from public, anon, authenticated;
grant execute on function public.assert_inventory_available_for_requested_items(jsonb) to service_role;
revoke all on function public.deduct_inventory_for_confirmed_order(uuid) from public, anon, authenticated;
grant execute on function public.deduct_inventory_for_confirmed_order(uuid) to service_role;
commit;
