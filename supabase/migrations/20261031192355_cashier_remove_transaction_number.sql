-- Remove the redundant TXN identifier while preserving the receipt counter and all sale links.
BEGIN;
LOCK TABLE public.cashier_transactions IN ACCESS EXCLUSIVE MODE;
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cashier_transactions' AND column_name='transaction_number')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.cashier_transactions'::regclass AND conname='cashier_transactions_transaction_number_key')
     OR to_regclass('public.cashier_transaction_number_seq') IS NULL
     OR to_regprocedure('public.get_cashier_transaction_history(integer,integer,jsonb)') IS NULL
     OR to_regprocedure('public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,text,text,text,text,public.payment_method,numeric,text,jsonb)') IS NULL
     OR to_regprocedure('public.verify_customer_gcash_payment(uuid,uuid)') IS NULL
     OR to_regprocedure('public.get_cashier_sale(uuid)') IS NULL
     OR to_regprocedure('public.get_current_shift_cashier_sales()') IS NULL
     OR to_regprocedure('public.get_current_shift_walk_in_sales()') IS NULL THEN
    RAISE EXCEPTION 'Cashier transaction-number schema drift' USING errcode='P0001';
  END IF;
END $guard$;

DROP FUNCTION public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,text,text,text,text,public.payment_method,numeric,text,jsonb);
CREATE OR REPLACE FUNCTION public.create_walk_in_sale(p_request_id uuid, p_fulfillment_type fulfillment_type, p_customer_name text, p_contact_number text, p_table_number text, p_discount_type text, p_discount_reference text, p_order_instructions text, p_payment_method payment_method, p_cash_received numeric, p_gcash_reference_number text, p_items jsonb)
 RETURNS TABLE(order_id uuid, order_number character varying, transaction_id uuid, receipt_number character varying, payment_id uuid, shift_id uuid, subtotal numeric, discount_amount numeric, tax_amount numeric, grand_total numeric, payment_method payment_method, cash_received numeric, change_due numeric, current_status order_status, created_at timestamp with time zone)
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
$function$;

REVOKE ALL ON FUNCTION public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,text,text,text,text,public.payment_method,numeric,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,text,text,text,text,public.payment_method,numeric,text,jsonb) TO authenticated, service_role;

DROP FUNCTION public.verify_customer_gcash_payment(uuid,uuid);
CREATE OR REPLACE FUNCTION public.verify_customer_gcash_payment(p_request_id uuid, p_payment_id uuid)
 RETURNS TABLE(database_order_id uuid, order_number character varying, payment_id uuid, request_id uuid, transaction_id uuid, receipt_number character varying, shift_id uuid, cashier_id uuid, payment_status payment_status, order_status order_status, verified_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cashier_id uuid;
  v_shift public.cashier_shifts%rowtype;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_existing_transaction public.cashier_transactions%rowtype;
  v_transaction_id uuid;
  v_transaction_sequence bigint;
  v_receipt_number varchar;
  v_created_at timestamptz;
begin
  if p_request_id is null then
    raise exception
      'A verification request ID is required.'
      using errcode = '22023';
  end if;

  if p_payment_id is null then
    raise exception
      'A payment ID is required.'
      using errcode = '22023';
  end if;

  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to verify a customer GCash payment.'
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
      'Only an active cashier account may verify a customer GCash payment.'
      using errcode = '42501';
  end if;

  -- A completed request remains retry-safe even after its shift has closed.
  select transaction_row.*
  into v_existing_transaction
  from public.cashier_transactions transaction_row
  where transaction_row.request_id = p_request_id
  for update;

  if found then
    if v_existing_transaction.payment_id <> p_payment_id
      or v_existing_transaction.cashier_id <> v_cashier_id
    then
      raise exception
        'This verification request ID belongs to another cashier transaction.'
        using errcode = '23505';
    end if;

    return query
    select
      target_order.id,
      target_order.order_number,
      payment.id,
      transaction_row.request_id,
      transaction_row.id,
      transaction_row.receipt_number,
      transaction_row.shift_id,
      transaction_row.cashier_id,
      payment.status,
      target_order.current_status,
      payment.verified_at,
      transaction_row.created_at
    from public.cashier_transactions transaction_row
    join public.payments payment
      on payment.id = transaction_row.payment_id
    join public.orders target_order
      on target_order.id = transaction_row.order_id
    where transaction_row.id = v_existing_transaction.id;

    return;
  end if;

  -- Locking the open shift prevents it from closing during verification.
  select shift_row.*
  into v_shift
  from public.cashier_shifts shift_row
  where shift_row.cashier_id = v_cashier_id
    and shift_row.status = 'open'::public.cashier_shift_status
  order by shift_row.started_at desc
  limit 1
  for update;

  if not found then
    raise exception
      'An open cashier shift is required to verify a customer GCash payment.';
  end if;

select payment.*
into v_payment
from public.payments payment
where payment.id = p_payment_id
for update;

if not found then
  raise exception
    'The customer GCash payment was not found.'
    using errcode = 'P0002';
end if;

select target_order.*
into v_order
from public.orders target_order
where target_order.id = v_payment.order_id
for update;

if not found then
  raise exception
    'The order linked to this GCash payment was not found.'
    using errcode = 'P0002';
end if;

  -- A concurrent retry may have completed while this call waited on locks.
  select transaction_row.*
  into v_existing_transaction
  from public.cashier_transactions transaction_row
  where transaction_row.request_id = p_request_id
  for update;

  if found then
    if v_existing_transaction.payment_id <> p_payment_id
      or v_existing_transaction.cashier_id <> v_cashier_id
    then
      raise exception
        'This verification request ID belongs to another cashier transaction.'
        using errcode = '23505';
    end if;

    return query
    select
      target_order.id,
      target_order.order_number,
      payment.id,
      transaction_row.request_id,
      transaction_row.id,
      transaction_row.receipt_number,
      transaction_row.shift_id,
      transaction_row.cashier_id,
      payment.status,
      target_order.current_status,
      payment.verified_at,
      transaction_row.created_at
    from public.cashier_transactions transaction_row
    join public.payments payment
      on payment.id = transaction_row.payment_id
    join public.orders target_order
      on target_order.id = transaction_row.order_id
    where transaction_row.id = v_existing_transaction.id;

    return;
  end if;

  -- A payment or order already settled under another request is never replayed.
  select transaction_row.*
  into v_existing_transaction
  from public.cashier_transactions transaction_row
  where transaction_row.payment_id = p_payment_id
    or transaction_row.order_id = v_order.id
  order by transaction_row.created_at asc
  limit 1
  for update;

  if found then
    raise exception
      'This payment or order has already been processed by another cashier transaction.'
      using errcode = '23505';
  end if;

  if v_order.order_channel <> 'online'::public.order_channel then
    raise exception
      'Only an online customer order may use manual GCash proof verification.'
      using errcode = '22023';
  end if;

  if v_payment.payment_method <> 'gcash'::public.payment_method then
    raise exception
      'Only a GCash payment may use manual GCash proof verification.'
      using errcode = '22023';
  end if;

  if nullif(btrim(v_payment.proof_image_path), '') is null then
    raise exception
      'An uploaded customer GCash proof is required for manual verification.'
      using errcode = '22023';
  end if;

  if v_order.customer_id is null
  or split_part(v_payment.proof_image_path, '/', 1) <>
    v_order.customer_id::text
  or split_part(v_payment.proof_image_path, '/', 2) <>
    v_order.id::text
then
  raise exception
    'The customer GCash proof does not belong to this order.'
    using errcode = '42501';
end if;

if not exists (
  select 1
  from storage.objects proof_object
  where proof_object.bucket_id = 'payment-proofs'
    and proof_object.name = v_payment.proof_image_path
) then
  raise exception
    'The uploaded customer GCash proof could not be found.'
    using errcode = 'P0002';
end if;

  if v_payment.status <> 'pending'::public.payment_status then
    raise exception
      'The customer GCash payment is no longer pending.'
      using errcode = '22023';
  end if;

  if v_order.current_status <>
    'waiting_payment_verification'::public.order_status
  then
    raise exception
      'The order is no longer waiting for payment verification.'
      using errcode = '22023';
  end if;

  if v_payment.amount <> v_order.grand_total then
    raise exception
      'The recorded payment amount does not match the authoritative order total.'
      using errcode = '22023';
  end if;

  v_created_at := now();
  v_transaction_id := gen_random_uuid();
  v_transaction_sequence :=
    nextval('public.cashier_receipt_number_seq');
  v_receipt_number :=
    'RCP-' || lpad(v_transaction_sequence::text, 6, '0');

  update public.payments
  set
    status = 'verified'::public.payment_status,
    verified_by = v_cashier_id,
    verified_at = v_created_at,
    rejection_reason = null,
    updated_at = v_created_at
  where id = p_payment_id;

  update public.orders
  set
    current_status = 'confirmed'::public.order_status,
    processed_by = v_cashier_id,
    confirmed_at = v_created_at
  where id = v_order.id;

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
    v_order.id,
    p_payment_id,
    v_shift.id,
    v_cashier_id,
    'completed'::public.cashier_transaction_status,
    p_request_id,
    v_created_at
  );

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes,
    created_at
  )
  values (
    v_order.id,
    'confirmed'::public.order_status,
    v_cashier_id,
    'GCash payment verified by cashier',
    v_created_at
  );

  return query
  select
    v_order.id,
    v_order.order_number,
    p_payment_id,
    p_request_id,
    v_transaction_id,
    v_receipt_number,
    v_shift.id,
    v_cashier_id,
    'verified'::public.payment_status,
    'confirmed'::public.order_status,
    v_created_at,
    v_created_at;
end;
$function$;

REVOKE ALL ON FUNCTION public.verify_customer_gcash_payment(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_customer_gcash_payment(uuid,uuid) TO authenticated, service_role;

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
      'table_number', o.table_number,
      'current_status', o.current_status,
      'subtotal', o.subtotal,
      'discount_type', o.discount_type,
      'discount_reference', o.discount_reference,
      'discount_amount', o.discount_amount,
      'tax_amount', o.tax_amount,
      'grand_total', o.grand_total,
      'notes', o.notes,
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
          'table_number', o.table_number,
          'current_status', o.current_status,
          'subtotal', o.subtotal,
          'discount_type', o.discount_type,
          'discount_reference', o.discount_reference,
          'discount_amount', o.discount_amount,
          'tax_amount', o.tax_amount,
          'grand_total', o.grand_total,
          'notes', o.notes,
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
          'table_number', o.table_number,
          'current_status', o.current_status,
          'subtotal', o.subtotal,
          'discount_type', o.discount_type,
          'discount_reference', o.discount_reference,
          'discount_amount', o.discount_amount,
          'tax_amount', o.tax_amount,
          'grand_total', o.grand_total,
          'notes', o.notes,
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
      o.discount_amount, o.subtotal, o.delivery_fee, o.tax_amount,
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

revoke all on function public.get_cashier_transaction_history(integer, integer, jsonb) from public;
grant execute on function public.get_cashier_transaction_history(integer, integer, jsonb) to authenticated;

ALTER SEQUENCE public.cashier_transaction_number_seq RENAME TO cashier_receipt_number_seq;
ALTER TABLE public.cashier_transactions DROP CONSTRAINT cashier_transactions_transaction_number_key;
ALTER TABLE public.cashier_transactions DROP COLUMN transaction_number;
COMMIT;
