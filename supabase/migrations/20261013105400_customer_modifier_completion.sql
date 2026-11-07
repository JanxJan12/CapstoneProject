begin;

-- The catalog is read through one deliberately narrow authenticated projection.
-- Modifier tables retain their existing RLS and table grants.
create or replace function public.get_customer_menu_modifiers()
returns table(menu_item_id uuid, group_id varchar, group_name varchar,
  selection_type public.modifier_selection_type, min_selections smallint,
  max_selections smallint, option_id varchar, option_name varchar,
  price_adjustment numeric, group_sort_order integer, option_sort_order integer)
language plpgsql security definer set search_path = ''
as $$
begin
  -- The public menu is browsable before sign-in; expose only active catalog rows.
  return query
  select mimg.menu_item_id, mg.id, mg.name, mg.selection_type,
    mg.min_selections, mg.max_selections, mo.id, mo.name,
    mo.price_adjustment, mimg.sort_order, mo.sort_order
  from public.menu_item_modifier_groups mimg
  join public.menu_items mi on mi.id = mimg.menu_item_id
    and mi.is_active and mi.is_available
  join public.menu_modifier_groups mg on mg.id = mimg.group_id and mg.is_active
  left join public.menu_modifier_options mo on mo.group_id = mg.id and mo.is_active
  order by mimg.menu_item_id, mimg.sort_order, mg.id, mo.sort_order, mo.id;
end;
$$;
revoke all on function public.get_customer_menu_modifiers() from public, anon;
grant execute on function public.get_customer_menu_modifiers() to anon, authenticated, service_role;

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
      where mi.id = (v_item->>'id')::uuid and mi.is_active and mi.is_available;
    if not found then raise exception 'One or more menu items are unavailable or invalid.'; end if;
    if v_item ? 'modifier_ids' and jsonb_typeof(v_item->'modifier_ids') <> 'array' then
      raise exception 'Invalid modifiers for %.', v_menu.name;
    end if;
    v_ids := coalesce(v_item->'modifier_ids', '[]'::jsonb);
    if jsonb_typeof(v_ids) <> 'array' or jsonb_array_length(v_ids) > 50 then
      raise exception 'Invalid modifiers for %.', v_menu.name;
    end if;
    if exists (select 1 from jsonb_array_elements(v_ids) selected(value)
      where jsonb_typeof(selected.value) <> 'string'
        or length(selected.value #>> '{}') > 50) then
      raise exception 'Invalid modifiers for %.', v_menu.name;
    end if;
    select count(*) into v_option_count from jsonb_array_elements_text(v_ids) selected(id);
    if v_option_count <> (select count(distinct selected.id)
        from jsonb_array_elements_text(v_ids) selected(id)) then
      raise exception 'Duplicate modifiers are not allowed for %.', v_menu.name;
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_ids) selected(id)
      left join public.menu_modifier_options mo on mo.id = selected.id and mo.is_active
      left join public.menu_modifier_groups mg on mg.id = mo.group_id and mg.is_active
      left join public.menu_item_modifier_groups mimg
        on mimg.menu_item_id = v_menu.id and mimg.group_id = mg.id
      where mo.id is null or mg.id is null or mimg.menu_item_id is null) then
      raise exception 'One or more selected modifiers are invalid for %.', v_menu.name;
    end if;
    for v_group in select mg.id, mg.name, mg.min_selections, mg.max_selections
      from public.menu_item_modifier_groups mimg
      join public.menu_modifier_groups mg on mg.id = mimg.group_id and mg.is_active
      where mimg.menu_item_id = v_menu.id loop
      select count(*) into v_group_count from jsonb_array_elements_text(v_ids) selected(id)
      join public.menu_modifier_options mo on mo.id = selected.id and mo.group_id = v_group.id;
      if v_group_count < v_group.min_selections then
        raise exception '% requires % selection(s).', v_group.name, v_group.min_selections;
      end if;
      if v_group_count > v_group.max_selections then
        raise exception '% allows at most % selection(s).', v_group.name, v_group.max_selections;
      end if;
    end loop;
    select coalesce(sum(mo.price_adjustment), 0),
      coalesce(jsonb_agg(jsonb_build_object('id', mo.id, 'name', mo.name,
        'price', mo.price_adjustment) order by mo.group_id, mo.sort_order, mo.id), '[]'::jsonb)
      into v_adjustment, v_snapshot
    from jsonb_array_elements_text(v_ids) selected(id)
    join public.menu_modifier_options mo on mo.id = selected.id;
    v_subtotal := v_subtotal + (v_menu.price + v_adjustment) * v_qty;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'id', v_menu.id, 'name', v_menu.name, 'qty', v_qty,
      'unit_price', v_menu.price + v_adjustment, 'modifiers', v_snapshot));
  end loop;
  if exists (select 1 from (select line->>'id' id, sum((line->>'qty')::integer) qty
    from jsonb_array_elements(v_lines) line group by line->>'id') totals where qty > 99) then
    raise exception 'A menu item quantity cannot exceed 99.';
  end if;
  select jsonb_agg(jsonb_build_object('id', totals.id, 'qty', totals.qty))
    into v_inventory_items from (select line->>'id' id, sum((line->>'qty')::integer) qty
      from jsonb_array_elements(v_lines) line group by line->>'id') totals;
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
revoke all on function public.place_customer_order(text,text,text,text,jsonb,uuid) from public, anon;
grant execute on function public.place_customer_order(text,text,text,text,jsonb,uuid)
  to authenticated, service_role;
commit;
