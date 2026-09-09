create or replace function public.verify_customer_gcash_payment(
  p_request_id uuid,
  p_payment_id uuid
)
returns table (
  database_order_id uuid,
  order_number varchar,
  payment_id uuid,
  request_id uuid,
  transaction_id uuid,
  transaction_number varchar,
  receipt_number varchar,
  shift_id uuid,
  cashier_id uuid,
  payment_status public.payment_status,
  order_status public.order_status,
  verified_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cashier_id uuid;
  v_shift public.cashier_shifts%rowtype;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_existing_transaction public.cashier_transactions%rowtype;
  v_transaction_id uuid;
  v_transaction_sequence bigint;
  v_transaction_number varchar;
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
      transaction_row.transaction_number,
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

-- Lock the submitted payment.
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

-- Lock the payment's linked order.
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
      transaction_row.transaction_number,
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
    nextval('public.cashier_transaction_number_seq');
  v_transaction_number :=
    'TXN-' || lpad(v_transaction_sequence::text, 6, '0');
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
    v_transaction_number,
    v_receipt_number,
    v_shift.id,
    v_cashier_id,
    'verified'::public.payment_status,
    'confirmed'::public.order_status,
    v_created_at,
    v_created_at;
end;
$$;

revoke all
on function public.verify_customer_gcash_payment(uuid, uuid)
from public;

grant execute
on function public.verify_customer_gcash_payment(uuid, uuid)
to authenticated;

grant execute
on function public.verify_customer_gcash_payment(uuid, uuid)
to service_role;

create or replace function public.get_cashier_sale(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
      'transaction_number', tx.transaction_number,
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
$$;

revoke all
on function public.get_cashier_sale(uuid)
from public;

grant execute
on function public.get_cashier_sale(uuid)
to authenticated;

grant execute
on function public.get_cashier_sale(uuid)
to service_role;

create or replace function public.get_current_shift_cashier_sales()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
          'transaction_number', tx.transaction_number,
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
$$;

revoke all
on function public.get_current_shift_cashier_sales()
from public;

grant execute
on function public.get_current_shift_cashier_sales()
to authenticated;

grant execute
on function public.get_current_shift_cashier_sales()
to service_role;
