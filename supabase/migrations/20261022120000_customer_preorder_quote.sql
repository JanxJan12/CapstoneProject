-- Local preparation only. Deploy with a controlled frontend cutover.
create schema customer_quote_private;
revoke all on schema customer_quote_private from public, anon, authenticated;
create table customer_quote_private.signing_key (
  singleton boolean primary key default true check (singleton),
  secret bytea not null check (octet_length(secret) = 32)
);
revoke all on customer_quote_private.signing_key from public, anon, authenticated;
alter table customer_quote_private.signing_key enable row level security;
insert into customer_quote_private.signing_key (singleton, secret)
values (true, extensions.gen_random_bytes(32));

create function public.customer_order_pricing(p_items jsonb)
returns table(subtotal numeric, delivery_fee numeric, grand_total numeric, lines jsonb)
language plpgsql stable security definer set search_path = '' as $pricing$
declare
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 50;
  v_item jsonb;
  v_ids jsonb;
  v_menu public.menu_items%rowtype;
  v_qty integer;
  v_option_count integer;
  v_snapshot jsonb;
  v_adjustment numeric;
  v_group record;
  v_group_count integer;
  v_lines jsonb := '[]'::jsonb;
  v_inventory_items jsonb;
  v_meal_option text;
  v_excluded_inventory_item_id uuid;
begin
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
;
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

  return query select v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee, v_lines;
end;
$pricing$;
revoke all on function public.customer_order_pricing(jsonb) from public, anon, authenticated;

create function public.customer_quote_terms(
  p_customer_name text, p_contact_number text, p_delivery_address text,
  p_landmark text, p_items jsonb)
returns text language sql immutable set search_path = '' as $terms$
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('customer_name', pg_catalog.btrim(p_customer_name),
      'contact_number', pg_catalog.btrim(p_contact_number),
      'delivery_address', pg_catalog.btrim(p_delivery_address),
      'landmark', nullif(pg_catalog.btrim(coalesce(p_landmark, '')), ''),
      'items', p_items)::text, 'UTF8'), 'sha256'), 'hex');
$terms$;
revoke all on function public.customer_quote_terms(text,text,text,text,jsonb) from public, anon, authenticated;

create function public.quote_customer_order(
  p_customer_name text, p_contact_number text, p_delivery_address text,
  p_landmark text, p_items jsonb, p_request_id uuid)
returns table(subtotal numeric, delivery_fee numeric, discount_amount numeric,
  tax_amount numeric, grand_total numeric, calculated_at timestamptz,
  expires_at timestamptz, quote_token text)
language plpgsql stable security definer set search_path = '' as $quote$
declare
  v_customer_id uuid := auth.uid();
  v_session_id text := nullif(auth.jwt()->>'session_id', '');
  v_secret bytea;
  v_lines jsonb;
  v_payload text;
begin
  if v_customer_id is null or v_session_id is null or not exists (
    select 1 from public.profiles p where p.id = v_customer_id
      and p.role = 'customer'::public.user_role and p.is_active) then
    raise exception 'Active customer access required.' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Order request ID is required.'; end if;
  if nullif(pg_catalog.btrim(p_customer_name), '') is null then
    raise exception 'Customer name is required.';
  end if;
  if pg_catalog.btrim(coalesce(p_contact_number, '')) !~ '^09[0-9]{9}$' then
    raise exception 'A valid Philippine mobile number is required.';
  end if;
  if nullif(pg_catalog.btrim(p_delivery_address), '') is null then
    raise exception 'Delivery address is required.';
  end if;
  select p.subtotal, p.delivery_fee, p.grand_total, p.lines
    into subtotal, delivery_fee, grand_total, v_lines
    from public.customer_order_pricing(p_items) p;
  discount_amount := 0;
  tax_amount := 0;
  calculated_at := pg_catalog.statement_timestamp();
  expires_at := calculated_at + interval '5 minutes';
  select k.secret into v_secret from customer_quote_private.signing_key k where k.singleton;
  v_payload := pg_catalog.jsonb_build_object(
    'customer_id', v_customer_id, 'session_id', v_session_id,
    'request_id', p_request_id,
    'terms', public.customer_quote_terms(p_customer_name,p_contact_number,p_delivery_address,p_landmark,p_items),
    'pricing', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      pg_catalog.jsonb_build_object('subtotal',subtotal,'delivery_fee',delivery_fee,
        'discount_amount',discount_amount,'tax_amount',tax_amount,
        'grand_total',grand_total,'lines',v_lines)::text, 'UTF8'), 'sha256'), 'hex'),
    'expires_at', expires_at)::text;
  quote_token := pg_catalog.encode(pg_catalog.convert_to(v_payload, 'UTF8'), 'hex')
    || '.' || pg_catalog.encode(extensions.hmac(pg_catalog.convert_to(v_payload,'UTF8'), v_secret, 'sha256'), 'hex');
  return next;
end;
$quote$;
revoke all on function public.quote_customer_order(text,text,text,text,jsonb,uuid) from public, anon;
grant execute on function public.quote_customer_order(text,text,text,text,jsonb,uuid) to authenticated, service_role;

create function public.place_customer_order_confirmed(
  p_customer_name text, p_contact_number text, p_delivery_address text,
  p_landmark text, p_items jsonb, p_request_id uuid, p_quote_token text)
returns table(order_id uuid, order_number varchar, subtotal numeric,
  delivery_fee numeric, grand_total numeric, current_status public.order_status)
language plpgsql security definer set search_path = '' as $confirmed$
declare
  v_customer_id uuid := auth.uid();
  v_session_id text := nullif(auth.jwt()->>'session_id', '');
  v_existing_order public.orders%rowtype;
  v_order_id uuid;
  v_order_number varchar;
  v_subtotal numeric;
  v_delivery_fee numeric;
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
  v_lines jsonb;
  v_line jsonb;
  v_inventory_items jsonb;
  v_meal_option text;
  v_excluded_inventory_item_id uuid;
  v_quote_payload jsonb;
  v_quote_text text;
  v_secret bytea;
  v_expected_signature text;
  v_pricing_hash text;
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

  if p_quote_token is null or p_quote_token !~ '^[0-9a-f]+[.][0-9a-f]{64}$'
    or length(p_quote_token) > 8192 then
    raise exception 'Quote is invalid or has expired.' using errcode='P0001';
  end if;
  select k.secret into v_secret from customer_quote_private.signing_key k where k.singleton;
  v_quote_text := pg_catalog.convert_from(pg_catalog.decode(split_part(p_quote_token,'.',1), 'hex'), 'UTF8');
  v_expected_signature := pg_catalog.encode(extensions.hmac(
    pg_catalog.convert_to(v_quote_text,'UTF8'), v_secret, 'sha256'), 'hex');
  if v_expected_signature <> split_part(p_quote_token,'.',2) then
    raise exception 'Quote is invalid or has expired.' using errcode='P0001';
  end if;
  v_quote_payload := v_quote_text::jsonb;
  if v_session_id is null
    or v_quote_payload->>'session_id' is distinct from v_session_id
    or v_quote_payload->>'customer_id' is distinct from v_customer_id::text
    or v_quote_payload->>'request_id' is distinct from p_request_id::text
    or (v_quote_payload->>'expires_at')::timestamptz <= pg_catalog.statement_timestamp()
    or v_quote_payload->>'terms' is distinct from public.customer_quote_terms(
      p_customer_name,p_contact_number,p_delivery_address,p_landmark,p_items) then
    raise exception 'Quote is stale. Review the latest total before ordering.' using errcode='P0001';
  end if;
  -- Manager choice changes lock the parent menu row; lock all requested rows in
  -- deterministic order before recalculating and retain locks through insertion.
  perform 1 from public.menu_items mi where mi.id in (
    select (item->>'id')::uuid from pg_catalog.jsonb_array_elements(p_items) item
      where item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    order by mi.id for share;
  select p.subtotal, p.delivery_fee, p.grand_total, p.lines
    into v_subtotal, v_delivery_fee, grand_total, v_lines
    from public.customer_order_pricing(p_items) p;
  v_pricing_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('subtotal',v_subtotal,'delivery_fee',v_delivery_fee,
      'discount_amount',0,'tax_amount',0,'grand_total',grand_total,
      'lines',v_lines)::text, 'UTF8'), 'sha256'), 'hex');
  if v_quote_payload->>'pricing' is distinct from v_pricing_hash then
    raise exception 'Quote is stale. Review the latest total before ordering.' using errcode='P0001';
  end if;

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
$confirmed$;
revoke all on function public.place_customer_order_confirmed(text,text,text,text,jsonb,uuid,text) from public, anon;
grant execute on function public.place_customer_order_confirmed(text,text,text,text,jsonb,uuid,text) to authenticated, service_role;

-- The old Customer writer has no quote gate. It must not remain callable.
revoke all on function public.place_customer_order(text,text,text,text,jsonb,uuid)
  from public, anon, authenticated;
