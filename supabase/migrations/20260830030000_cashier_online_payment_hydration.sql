create or replace function public.get_cashier_online_payments()
returns table (
  payment_id uuid,
  database_order_id uuid,
  order_number varchar,
  amount numeric,
  payment_method public.payment_method,
  gcash_reference_number varchar,
  proof_image_path text,
  payment_status public.payment_status,
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  payment_created_at timestamptz,
  payment_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cashier_id uuid;
begin
  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to read online payments.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_cashier_id
      and profile.role = 'cashier'::public.user_role
      and profile.is_active = true
  ) then
    raise exception
      'Only an active cashier account may read online payments.'
      using errcode = '42501';
  end if;

  return query
  select
    payment.id,
    target_order.id,
    target_order.order_number,
    payment.amount,
    payment.payment_method,
    payment.gcash_reference_number,
    payment.proof_image_path,
    payment.status,
    payment.verified_by,
    payment.verified_at,
    payment.rejection_reason,
    payment.created_at,
    payment.updated_at
  from public.payments payment
  inner join public.orders target_order
    on target_order.id = payment.order_id
  where target_order.order_channel =
      'online'::public.order_channel
    and payment.status in (
      'pending'::public.payment_status,
      'verified'::public.payment_status,
      'rejected'::public.payment_status
    )
  order by
    payment.created_at desc,
    payment.id desc;
end;
$$;

revoke all
on function public.get_cashier_online_payments()
from public;

grant execute
on function public.get_cashier_online_payments()
to authenticated;

grant execute
on function public.get_cashier_online_payments()
to service_role;

create or replace function public.submit_customer_payment(
  p_order_id uuid,
  p_gcash_reference_number text,
  p_proof_image_path text
)
returns table (
  payment_id uuid,
  order_id uuid,
  amount numeric,
  payment_method public.payment_method,
  gcash_reference_number varchar,
  proof_image_path text,
  status public.payment_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_order public.orders%rowtype;
  v_existing_payment public.payments%rowtype;
  v_reference text;
  v_normalized_reference text;
  v_proof_path text;
  v_payment_id uuid;
  v_created_at timestamptz;
begin
  v_customer_id := auth.uid();

  if v_customer_id is null then
    raise exception
      'Authentication is required to submit a payment.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_customer_id
      and profile.role = 'customer'::public.user_role
      and profile.is_active = true
  ) then
    raise exception
      'Only an active customer account may submit a payment.'
      using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception
      'An order ID is required to submit a payment.'
      using errcode = '22023';
  end if;

  v_reference := btrim(
    coalesce(p_gcash_reference_number, '')
  );

  if v_reference = '' then
    raise exception
      'GCash reference number is required.'
      using errcode = '22023';
  end if;

  if char_length(v_reference) > 100 then
    raise exception
      'GCash reference number must be 100 characters or fewer.'
      using errcode = '22023';
  end if;

  v_normalized_reference := lower(v_reference);

  v_proof_path := trim(
    both '/'
    from btrim(coalesce(p_proof_image_path, ''))
  );

  if v_proof_path = '' then
    raise exception
      'A payment proof path is required.'
      using errcode = '22023';
  end if;

  select target_order.*
  into v_order
  from public.orders target_order
  where target_order.id = p_order_id
  for update;

  if not found then
    raise exception
      'The order was not found.'
      using errcode = 'P0002';
  end if;

  if v_order.customer_id is distinct from v_customer_id then
    raise exception
      'This order does not belong to the authenticated customer.'
      using errcode = '42501';
  end if;

  if v_order.order_channel <>
    'online'::public.order_channel
  then
    raise exception
      'Only online customer orders may receive a customer payment submission.'
      using errcode = '22023';
  end if;

  if v_order.current_status <>
    'waiting_payment_verification'::public.order_status
  then
    raise exception
      'This order is no longer waiting for payment verification.'
      using errcode = '22023';
  end if;

  if split_part(v_proof_path, '/', 1) <>
    v_customer_id::text
  then
    raise exception
      'The payment proof path does not belong to the authenticated customer.'
      using errcode = '42501';
  end if;

  if split_part(v_proof_path, '/', 2) <>
    p_order_id::text
  then
    raise exception
      'The payment proof path does not belong to this order.'
      using errcode = '22023';
  end if;

  if split_part(v_proof_path, '/', 3) = '' then
    raise exception
      'The payment proof path must include a file name.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects stored_object
    where stored_object.bucket_id = 'payment-proofs'
      and stored_object.name = v_proof_path
  ) then
    raise exception
      'The uploaded payment proof file was not found.'
      using errcode = 'P0002';
  end if;

  select existing_payment.*
  into v_existing_payment
  from public.payments existing_payment
  where existing_payment.order_id = p_order_id;

  if found then
    if v_existing_payment.payment_method =
        'gcash'::public.payment_method
      and lower(
        btrim(v_existing_payment.gcash_reference_number)
      ) = v_normalized_reference
      and v_existing_payment.proof_image_path =
        v_proof_path
      and v_existing_payment.amount =
        v_order.grand_total
      and v_existing_payment.status =
        'pending'::public.payment_status
    then
      return query
      select
        v_existing_payment.id,
        v_existing_payment.order_id,
        v_existing_payment.amount,
        v_existing_payment.payment_method,
        v_existing_payment.gcash_reference_number,
        v_existing_payment.proof_image_path,
        v_existing_payment.status,
        v_existing_payment.created_at;

      return;
    end if;

    raise exception
      'A payment has already been submitted for this order.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.payments existing_payment
    where existing_payment.payment_method =
      'gcash'::public.payment_method
      and lower(
        btrim(existing_payment.gcash_reference_number)
      ) = v_normalized_reference
  ) then
    raise exception
      'This GCash reference number has already been used.'
      using errcode = '23505';
  end if;

  begin
    insert into public.payments (
      order_id,
      payment_method,
      amount,
      gcash_reference_number,
      proof_image_path,
      status,
      verified_by,
      verified_at,
      rejection_reason,
      cash_received
    )
    values (
      v_order.id,
      'gcash'::public.payment_method,
      v_order.grand_total,
      v_reference,
      v_proof_path,
      'pending'::public.payment_status,
      null,
      null,
      null,
      null
    )
    returning
      payments.id,
      payments.created_at
    into
      v_payment_id,
      v_created_at;
  exception
    when unique_violation then
      if exists (
        select 1
        from public.payments existing_payment
        where existing_payment.order_id = p_order_id
      ) then
        raise exception
          'A payment has already been submitted for this order.'
          using errcode = '23505';
      end if;

      raise exception
        'This GCash reference number has already been used.'
        using errcode = '23505';
  end;

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes
  )
  values (
    v_order.id,
    'waiting_payment_verification'::public.order_status,
    v_customer_id,
    'GCash payment proof submitted'
  );

  return query
  select
    v_payment_id,
    v_order.id,
    v_order.grand_total,
    'gcash'::public.payment_method,
    v_reference::varchar,
    v_proof_path,
    'pending'::public.payment_status,
    v_created_at;
end;
$$;

revoke all
on function public.submit_customer_payment(uuid, text, text)
from public;

grant execute
on function public.submit_customer_payment(uuid, text, text)
to authenticated;

grant execute
on function public.submit_customer_payment(uuid, text, text)
to service_role;
