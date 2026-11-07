-- Retire unapproved order discounts, dine-in table numbers and general order notes.
-- Keep item special instructions, status history, refund reasons and other evidence.


drop function if exists public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,text,text,text,text,public.payment_method,numeric,text,jsonb);

drop function if exists public.update_cashier_order_operational_details(uuid,text,text,text,text,text);

drop function if exists public.quote_customer_order(text,text,text,text,jsonb,uuid);

drop function if exists public.get_kds_queue_v2(uuid,text);

drop function if exists public.get_kds_queue(uuid,text);

alter table public.orders drop constraint if exists orders_grand_total_matches_chk;

alter table public.orders add constraint orders_grand_total_matches_chk check (grand_total <= subtotal + tax_amount + delivery_fee);

alter table public.orders drop column notes, drop column table_number, drop column discount_type, drop column discount_reference, drop column discount_amount;

-- Existing financial snapshots remain untouched. New financial writes must
-- match the approved subtotal + tax + delivery fee calculation exactly.
create function public.enforce_order_total_without_discount()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.grand_total <> new.subtotal + new.tax_amount + new.delivery_fee then
    raise exception 'Order total must equal subtotal, tax, and delivery fee.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger orders_approved_total_write
before insert or update of subtotal, tax_amount, delivery_fee, grand_total
on public.orders for each row execute function public.enforce_order_total_without_discount();

CREATE OR REPLACE FUNCTION public.create_walk_in_sale(p_request_id uuid, p_fulfillment_type fulfillment_type, p_customer_name text, p_contact_number text, p_payment_method payment_method, p_cash_received numeric, p_gcash_reference_number text, p_items jsonb)
 RETURNS TABLE(order_id uuid, order_number character varying, transaction_id uuid, receipt_number character varying, payment_id uuid, shift_id uuid, subtotal numeric, tax_amount numeric, grand_total numeric, payment_method payment_method, cash_received numeric, change_due numeric, current_status order_status, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cashier_id uuid;
  v_shift_id uuid;
  v_existing_cashier_id uuid;

  v_customer_name varchar(80);
  v_contact_number varchar(20);

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
  v_tax_amount numeric(12,2) := 0;
  v_grand_total numeric(12,2);

  v_cash_received numeric(12,2);
  v_gcash_reference varchar;

  v_order_id uuid;
  v_order_number varchar;

  v_payment_id uuid;

  v_transaction_id uuid;
  v_transaction_sequence bigint;
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
      t.receipt_number,
      p.id,
      t.shift_id,
      o.subtotal,
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
  -- 10. TAX / TOTAL
  --
  -- Tax is intentionally 0 because POS_TAX_ENABLED is currently
  -- false.
  -- ============================================================

  v_tax_amount := 0;


  v_grand_total :=
    round(
      v_subtotal
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
      'public.cashier_receipt_number_seq'
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

    current_status,

    subtotal,
    delivery_fee,
    tax_amount,
    grand_total,


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

    'confirmed'::public.order_status,

    v_subtotal,
    0,
    v_tax_amount,
    v_grand_total,


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
    v_receipt_number,

    v_payment_id,
    v_shift_id,

    v_subtotal,
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
$function$;

revoke all on function public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,public.payment_method,numeric,text,jsonb) from public, anon;

grant execute on function public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,public.payment_method,numeric,text,jsonb) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_cashier_sale(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cashier_id uuid;
  v_result jsonb;
begin
  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may view a cashier sale.';
  end if;

  select jsonb_build_object(
    'order',
    jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'processed_by', o.processed_by,
      'order_channel', o.order_channel,
      'fulfillment_type', o.fulfillment_type,
      'customer_name', o.customer_name,
      'customer_contact_number', o.customer_contact_number,
      'delivery_address', o.delivery_address,
      'landmark', o.landmark,
      'current_status', o.current_status,
      'subtotal', o.subtotal,
      'tax_amount', o.tax_amount,
      'grand_total', o.grand_total,
      'confirmed_at', o.confirmed_at,
      'created_at', o.created_at
    ),
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'item_name', oi.item_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'line_total', oi.line_total,
            'special_instructions', oi.special_instructions,
            'modifiers', oi.modifiers,
            'created_at', oi.created_at
          )
          order by oi.created_at asc
        )
        from public.order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    ),
    'payment',
    jsonb_build_object(
      'id', pay.id,
      'order_id', pay.order_id,
      'payment_method', pay.payment_method,
      'amount', pay.amount,
      'gcash_reference_number', pay.gcash_reference_number,
      'proof_image_path', pay.proof_image_path,
      'status', pay.status,
      'cash_received', pay.cash_received,
      'verified_by', pay.verified_by,
      'verified_at', pay.verified_at,
      'rejection_reason', pay.rejection_reason,
      'created_at', pay.created_at,
      'updated_at', pay.updated_at
    ),
    'transaction',
    jsonb_build_object(
      'id', tx.id,
      'receipt_number', tx.receipt_number,
      'order_id', tx.order_id,
      'payment_id', tx.payment_id,
      'shift_id', tx.shift_id,
      'cashier_id', tx.cashier_id,
      'status', tx.status,
      'void_reason', tx.void_reason,
      'voided_at', tx.voided_at,
      'request_id', tx.request_id,
      'created_at', tx.created_at
    ),
    'history',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', h.id,
            'status', h.status,
            'changed_by', h.changed_by,
            'notes', h.notes,
            'created_at', h.created_at
          )
          order by h.created_at asc
        )
        from public.order_status_history h
        where h.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.orders o
  join public.cashier_transactions tx
    on tx.order_id = o.id
  join public.payments pay
    on pay.id = tx.payment_id
  where o.id = p_order_id
    and tx.cashier_id = v_cashier_id
  limit 1;

  if v_result is null then
    raise exception
      'Cashier sale was not found or does not belong to the authenticated cashier.';
  end if;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_shift_cashier_sales()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cashier_id uuid;
  v_shift_id uuid;
  v_result jsonb;
begin
  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to recover current-shift cashier sales.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may recover current-shift cashier sales.'
      using errcode = '42501';
  end if;

  select s.id
  into v_shift_id
  from public.cashier_shifts s
  where s.cashier_id = v_cashier_id
    and s.status = 'open'::public.cashier_shift_status
  order by s.started_at desc
  limit 1;

  if v_shift_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order',
        jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'processed_by', o.processed_by,
          'order_channel', o.order_channel,
          'fulfillment_type', o.fulfillment_type,
          'customer_name', o.customer_name,
          'customer_contact_number', o.customer_contact_number,
          'delivery_address', o.delivery_address,
          'landmark', o.landmark,
          'current_status', o.current_status,
          'subtotal', o.subtotal,
          'tax_amount', o.tax_amount,
          'grand_total', o.grand_total,
          'confirmed_at', o.confirmed_at,
          'created_at', o.created_at
        ),
        'items',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', oi.id,
                'menu_item_id', oi.menu_item_id,
                'item_name', oi.item_name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'line_total', oi.line_total,
                'special_instructions', oi.special_instructions,
                'modifiers', oi.modifiers,
                'created_at', oi.created_at
              )
              order by oi.created_at asc
            )
            from public.order_items oi
            where oi.order_id = o.id
          ),
          '[]'::jsonb
        ),
        'payment',
        jsonb_build_object(
          'id', pay.id,
          'order_id', pay.order_id,
          'payment_method', pay.payment_method,
          'amount', pay.amount,
          'gcash_reference_number', pay.gcash_reference_number,
          'proof_image_path', pay.proof_image_path,
          'status', pay.status,
          'cash_received', pay.cash_received,
          'verified_by', pay.verified_by,
          'verified_at', pay.verified_at,
          'rejection_reason', pay.rejection_reason,
          'created_at', pay.created_at,
          'updated_at', pay.updated_at
        ),
        'transaction',
        jsonb_build_object(
          'id', tx.id,
          'receipt_number', tx.receipt_number,
          'order_id', tx.order_id,
          'payment_id', tx.payment_id,
          'shift_id', tx.shift_id,
          'cashier_id', tx.cashier_id,
          'status', tx.status,
          'void_reason', tx.void_reason,
          'voided_at', tx.voided_at,
          'request_id', tx.request_id,
          'created_at', tx.created_at
        ),
        'history',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', h.id,
                'status', h.status,
                'changed_by', h.changed_by,
                'notes', h.notes,
                'created_at', h.created_at
              )
              order by h.created_at asc
            )
            from public.order_status_history h
            where h.order_id = o.id
          ),
          '[]'::jsonb
        )
      )
      order by tx.created_at asc, tx.id asc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.cashier_transactions tx
  join public.orders o
    on o.id = tx.order_id
  join public.payments pay
    on pay.id = tx.payment_id
  where tx.cashier_id = v_cashier_id
    and tx.shift_id = v_shift_id
    and tx.status = 'completed'::public.cashier_transaction_status;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_shift_walk_in_sales()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cashier_id uuid;
  v_shift_id uuid;
  v_result jsonb;
begin
  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to recover current-shift cashier sales.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may recover current-shift cashier sales.'
      using errcode = '42501';
  end if;

  select s.id
  into v_shift_id
  from public.cashier_shifts s
  where s.cashier_id = v_cashier_id
    and s.status = 'open'::public.cashier_shift_status
  order by s.started_at desc
  limit 1;

  if v_shift_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order',
        jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'processed_by', o.processed_by,
          'fulfillment_type', o.fulfillment_type,
          'customer_name', o.customer_name,
          'customer_contact_number', o.customer_contact_number,
          'current_status', o.current_status,
          'subtotal', o.subtotal,
          'tax_amount', o.tax_amount,
          'grand_total', o.grand_total,
          'confirmed_at', o.confirmed_at,
          'created_at', o.created_at
        ),

        'items',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', oi.id,
                'menu_item_id', oi.menu_item_id,
                'item_name', oi.item_name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'line_total', oi.line_total,
                'special_instructions', oi.special_instructions,
                'modifiers', oi.modifiers,
                'created_at', oi.created_at
              )
              order by oi.created_at asc
            )
            from public.order_items oi
            where oi.order_id = o.id
          ),
          '[]'::jsonb
        ),

        'payment',
        jsonb_build_object(
          'id', pay.id,
          'order_id', pay.order_id,
          'payment_method', pay.payment_method,
          'amount', pay.amount,
          'gcash_reference_number', pay.gcash_reference_number,
          'status', pay.status,
          'cash_received', pay.cash_received,
          'verified_by', pay.verified_by,
          'verified_at', pay.verified_at,
          'created_at', pay.created_at
        ),

        'transaction',
        jsonb_build_object(
          'id', tx.id,
          'receipt_number', tx.receipt_number,
          'order_id', tx.order_id,
          'payment_id', tx.payment_id,
          'shift_id', tx.shift_id,
          'cashier_id', tx.cashier_id,
          'status', tx.status,
          'void_reason', tx.void_reason,
          'voided_at', tx.voided_at,
          'request_id', tx.request_id,
          'created_at', tx.created_at
        ),

        'history',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', h.id,
                'status', h.status,
                'changed_by', h.changed_by,
                'notes', h.notes,
                'created_at', h.created_at
              )
              order by h.created_at asc
            )
            from public.order_status_history h
            where h.order_id = o.id
          ),
          '[]'::jsonb
        )
      )
      order by tx.created_at asc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.cashier_transactions tx
  join public.orders o
    on o.id = tx.order_id
  join public.payments pay
    on pay.id = tx.payment_id
  where tx.cashier_id = v_cashier_id
    and tx.shift_id = v_shift_id
    and o.order_channel = 'walk_in'::public.order_channel;

  return v_result;
end;
$function$;

create or replace function public.get_cashier_transaction_history(
  p_limit integer default 50,
  p_offset integer default 0,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cashier uuid := auth.uid();
  v_result jsonb;
begin
  if v_cashier is null or not exists (
    select 1 from public.profiles p
    where p.id = v_cashier and p.role = 'cashier'::public.user_role and p.is_active = true
  ) then
    raise exception 'Active Cashier access required' using errcode = '42501';
  end if;
  if p_limit is null or p_offset is null
     or p_limit < 1 or p_limit > 100 or p_offset < 0 or p_offset > 10000 then
    raise exception 'Invalid history page' using errcode = '22023';
  end if;
  if coalesce(p_filters->>'status', '') not in ('', 'completed', 'voided')
     or coalesce(p_filters->>'method', '') not in ('', 'cash', 'gcash') then
    raise exception 'Invalid history filter' using errcode = '22023';
  end if;

  with matched as (
    select tx.id, tx.receipt_number, tx.order_id,
      tx.payment_id, tx.shift_id, tx.cashier_id, tx.status, tx.void_reason,
      tx.created_at, o.order_number, o.customer_name, o.grand_total,
      o.subtotal, o.delivery_fee, o.tax_amount,
      pay.payment_method, pay.gcash_reference_number, s.terminal
    from public.cashier_transactions tx
    join public.orders o on o.id = tx.order_id
    join public.payments pay on pay.id = tx.payment_id
    join public.cashier_shifts s on s.id = tx.shift_id
    where tx.cashier_id = v_cashier
      and s.cashier_id = v_cashier
      and (coalesce(p_filters->>'status', '') = '' or tx.status::text = p_filters->>'status')
      and (coalesce(p_filters->>'method', '') = '' or pay.payment_method::text = p_filters->>'method')
      and (coalesce(p_filters->>'from', '') = '' or (tx.created_at at time zone 'Asia/Manila')::date >= (p_filters->>'from')::date)
      and (coalesce(p_filters->>'to', '') = '' or (tx.created_at at time zone 'Asia/Manila')::date <= (p_filters->>'to')::date)
      and (coalesce(p_filters->>'shift', '') = '' or tx.shift_id = (p_filters->>'shift')::uuid)
      and (coalesce(p_filters->>'terminal', '') = '' or s.terminal = p_filters->>'terminal')
      and (coalesce(p_filters->>'customer', '') = '' or o.customer_name ilike '%' || (p_filters->>'customer') || '%')
      and (coalesce(p_filters->>'orderId', '') = '' or o.order_number ilike '%' || (p_filters->>'orderId') || '%')
      and (coalesce(p_filters->>'receiptNumber', '') = '' or tx.receipt_number ilike '%' || (p_filters->>'receiptNumber') || '%')
      and (coalesce(p_filters->>'search', '') = '' or
        tx.id::text ilike '%' || (p_filters->>'search') || '%' or
        tx.receipt_number ilike '%' || (p_filters->>'search') || '%' or
        pay.gcash_reference_number ilike '%' || (p_filters->>'search') || '%')
  ), page as (
    select * from matched order by created_at desc, id desc limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'rows', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.update_cashier_order_operational_details(
  p_order_id uuid,
  p_customer_name text,
  p_contact_number text,
  p_delivery_address text default null
)
returns table (
  order_id uuid,
  order_number varchar,
  current_status public.order_status,
  edited_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cashier_id uuid;
  v_order_number varchar;
  v_current_status public.order_status;
  v_fulfillment_type public.fulfillment_type;
  v_customer_name text;
  v_contact_number text;
  v_delivery_address text;
  v_edited_at timestamptz;
begin
  if p_order_id is null then
    raise exception 'Order is required.'
      using errcode = '22023';
  end if;

  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  perform 1
  from public.profiles profile
  where profile.id = v_cashier_id
    and profile.role = 'cashier'::public.user_role
    and profile.is_active = true
  for share;

  if not found then
    raise exception
      'Only an active cashier account may edit order operational details.'
      using errcode = '42501';
  end if;

  v_customer_name := nullif(btrim(p_customer_name), '');
  v_contact_number := nullif(btrim(p_contact_number), '');
  v_delivery_address := nullif(btrim(p_delivery_address), '');

  if v_customer_name is null then
    raise exception 'Customer name is required.'
      using errcode = '22023';
  end if;

  if char_length(v_customer_name) > 80 then
    raise exception 'Customer name must not exceed 80 characters.'
      using errcode = '22023';
  end if;

  if v_contact_number is null then
    raise exception 'Contact number is required.'
      using errcode = '22023';
  end if;

  if char_length(v_contact_number) > 20 then
    raise exception 'Contact number must not exceed 20 characters.'
      using errcode = '22023';
  end if;

  if v_delivery_address is not null
    and char_length(v_delivery_address) > 200
  then
    raise exception 'Delivery address must not exceed 200 characters.'
      using errcode = '22023';
  end if;

  select
    orders.order_number,
    orders.current_status,
    orders.fulfillment_type
  into
    v_order_number,
    v_current_status,
    v_fulfillment_type
  from public.orders orders
  where orders.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.'
      using errcode = 'P0002';
  end if;

  if v_current_status not in (
    'waiting_payment_verification'::public.order_status,
    'confirmed'::public.order_status,
    'preparing'::public.order_status,
    'ready'::public.order_status,
    'waiting_for_rider'::public.order_status
  ) then
    raise exception
      'This order can no longer be edited at its current stage.'
      using errcode = '22023';
  end if;

  if v_fulfillment_type = 'delivery'::public.fulfillment_type
    and v_delivery_address is null
  then
    raise exception 'Delivery address is required for delivery orders.'
      using errcode = '22023';
  end if;

  v_edited_at := now();

  update public.orders orders
  set
    customer_name = v_customer_name,
    customer_contact_number = v_contact_number,
    delivery_address = case
      when v_fulfillment_type = 'delivery'::public.fulfillment_type
        then v_delivery_address
      else null
    end
  where orders.id = p_order_id;

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes,
    created_at
  )
  values (
    p_order_id,
    v_current_status,
    v_cashier_id,
    'Operational order details updated by cashier',
    v_edited_at
  );

  return query
  select
    p_order_id,
    v_order_number,
    v_current_status,
    v_edited_at;
end;
$$;

revoke all on function public.update_cashier_order_operational_details(uuid,text,text,text) from public, anon;

grant execute on function public.update_cashier_order_operational_details(uuid,text,text,text) to authenticated, service_role;

CREATE OR REPLACE FUNCTION "public"."get_kds_queue"("p_terminal_id" "uuid", "p_terminal_secret" "text") RETURNS TABLE("order_id" "uuid", "order_number" character varying, "fulfillment_type" "public"."fulfillment_type", "current_status" "public"."order_status", "created_at" timestamp with time zone, "items" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_secret text;
  v_secret_hash text;
begin
  -- Normalize the supplied device secret.
  v_secret := trim(p_terminal_secret);

  -- Reject missing credentials immediately.
  if p_terminal_id is null
     or v_secret is null
     or v_secret = '' then
    raise exception
      'Invalid kitchen terminal credential.';
  end if;

  -- Hash the secret supplied by the KDS.
  v_secret_hash :=
    encode(
      extensions.digest(
        v_secret,
        'sha256'
      ),
      'hex'
    );

  -- Verify:
  -- 1. terminal exists
  -- 2. terminal is active
  -- 3. supplied secret matches stored hash
  if not exists (
    select 1
    from public.kds_terminals kt
    where kt.id = p_terminal_id
      and kt.is_active = true
      and kt.secret_hash = v_secret_hash
  ) then
    raise exception
      'Invalid or inactive kitchen terminal credential.';
  end if;

  -- Record successful terminal use.
  update public.kds_terminals
  set last_used_at = now()
  where id = p_terminal_id;

  -- Return only orders relevant to the kitchen.
  return query
  select
    o.id,
    o.order_number,
    o.fulfillment_type,
    o.current_status,
    o.created_at,

    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'item_name', oi.item_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'special_instructions',
              oi.special_instructions
          )
          order by oi.created_at asc
        )
        from public.order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    ) as items

  from public.orders o
  where o.current_status in (
    'confirmed'::public.order_status,
    'preparing'::public.order_status,
    'ready'::public.order_status
  )
  order by o.created_at asc;
end;
$$;

revoke all on function public.get_kds_queue(uuid,text) from public;

grant execute on function public.get_kds_queue(uuid,text) to anon, authenticated, service_role;

create function public.get_kds_queue_v2(
  p_terminal_id uuid,
  p_terminal_secret text
)
returns table (
  order_id uuid,
  order_number varchar,
  fulfillment_type public.fulfillment_type,
  current_status public.order_status,
  created_at timestamptz,
  items jsonb,
  order_channel public.order_channel
)
language sql
security definer
set search_path = ''
as $$
  select q.order_id, q.order_number, q.fulfillment_type,
         q.current_status, q.created_at,
         coalesce((
           select jsonb_agg(
             jsonb_set(entry.item, '{modifiers}', coalesce((
               select jsonb_agg(jsonb_build_object(
                 'id', modifier.value->'id',
                 'name', modifier.value->'name',
                 'price', modifier.value->'price'
               ) order by modifier.ordinality)
               from jsonb_array_elements(case
                 when jsonb_typeof(oi.modifiers) = 'array' then oi.modifiers
                 else '[]'::jsonb
               end) with ordinality as modifier(value, ordinality)
               where jsonb_typeof(modifier.value->'id') = 'string'
                 and jsonb_typeof(modifier.value->'name') = 'string'
                 and jsonb_typeof(modifier.value->'price') = 'number'
             ), '[]'::jsonb), true)
             order by entry.ordinality
           )
           from jsonb_array_elements(q.items) with ordinality as entry(item, ordinality)
           left join public.order_items oi
             on oi.id = (entry.item->>'id')::uuid
            and oi.order_id = q.order_id
         ), '[]'::jsonb),
         o.order_channel
  from public.get_kds_queue(p_terminal_id, p_terminal_secret) q
  join public.orders o on o.id = q.order_id
  order by q.created_at, q.order_id;
$$;

revoke all on function public.get_kds_queue_v2(uuid,text) from public;

grant execute on function public.get_kds_queue_v2(uuid,text) to anon, authenticated, service_role;

create function public.quote_customer_order(
  p_customer_name text, p_contact_number text, p_delivery_address text,
  p_landmark text, p_items jsonb, p_request_id uuid)
returns table(subtotal numeric, delivery_fee numeric,
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
        'tax_amount',tax_amount,
        'grand_total',grand_total,'lines',v_lines)::text, 'UTF8'), 'sha256'), 'hex'),
    'expires_at', expires_at)::text;
  quote_token := pg_catalog.encode(pg_catalog.convert_to(v_payload, 'UTF8'), 'hex')
    || '.' || pg_catalog.encode(extensions.hmac(pg_catalog.convert_to(v_payload,'UTF8'), v_secret, 'sha256'), 'hex');
  return next;
end;
$quote$;

revoke all on function public.quote_customer_order(text,text,text,text,jsonb,uuid) from public, anon;

grant execute on function public.quote_customer_order(text,text,text,text,jsonb,uuid) to authenticated, service_role;

create or replace function public.place_customer_order_confirmed(
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
      'tax_amount',0,'grand_total',grand_total,
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
