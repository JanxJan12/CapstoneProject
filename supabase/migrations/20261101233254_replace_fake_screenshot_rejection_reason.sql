-- Replace the accepted reason for future GCash proof rejections without changing historical records.
create or replace function public.reject_customer_gcash_payment(
  p_payment_id uuid,
  p_reason text,
  p_notes text default null
)
returns table (
  database_order_id uuid,
  order_number varchar,
  payment_id uuid,
  payment_status public.payment_status,
  order_status public.order_status,
  rejection_reason text,
  rejection_notes text,
  rejected_by uuid,
  rejected_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cashier_id uuid;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_reason text;
  v_notes text;
  v_proof_path text;
  v_rejected_at timestamptz;
  v_history_note text;
begin
  if p_payment_id is null then
    raise exception
      'A payment ID is required.'
      using errcode = '22023';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  if v_reason not in (
    'Wrong Amount',
    'Unreadable Proof',
    'Duplicate Payment',
    'Invalid Proof',
    'Reference Not Found',
    'Other'
  ) then
    raise exception
      'Select a valid customer GCash rejection reason.'
      using errcode = '22023';
  end if;

  if v_reason = 'Other' and v_notes is null then
    raise exception
      'Rejection notes are required when the reason is Other.'
      using errcode = '22023';
  end if;

  if v_notes is not null and char_length(v_notes) > 300 then
    raise exception
      'Rejection notes must be 300 characters or fewer.'
      using errcode = '22023';
  end if;

  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to reject a customer GCash payment.'
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
      'Only an active cashier account may reject a customer GCash payment.'
      using errcode = '42501';
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

  if v_order.order_channel <> 'online'::public.order_channel then
    raise exception
      'Only an online customer order may use manual GCash proof rejection.'
      using errcode = '22023';
  end if;

  if v_payment.payment_method <> 'gcash'::public.payment_method then
    raise exception
      'Only a GCash payment may use manual GCash proof rejection.'
      using errcode = '22023';
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

  v_proof_path := btrim(coalesce(v_payment.proof_image_path, ''));

  if v_proof_path = ''
    or v_order.customer_id is null
    or split_part(v_proof_path, '/', 1) <> v_order.customer_id::text
    or split_part(v_proof_path, '/', 2) <> v_order.id::text
    or split_part(v_proof_path, '/', 3) = ''
    or split_part(v_proof_path, '/', 4) <> ''
  then
    raise exception
      'The customer GCash proof does not belong to this order.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from storage.objects proof_object
    where proof_object.bucket_id = 'payment-proofs'
      and proof_object.name = v_proof_path
  ) then
    raise exception
      'The uploaded customer GCash proof could not be found.'
      using errcode = 'P0002';
  end if;

  v_rejected_at := now();

  update public.payments
  set
    status = 'rejected'::public.payment_status,
    verified_by = null,
    verified_at = null,
    rejection_reason = v_reason,
    rejection_notes = v_notes,
    rejected_by = v_cashier_id,
    rejected_at = v_rejected_at,
    updated_at = v_rejected_at
  where id = p_payment_id;

  v_history_note := 'GCash payment rejected: ' || v_reason;

  if v_notes is not null then
    v_history_note := v_history_note || '. Notes: ' || v_notes;
  end if;

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes,
    created_at
  )
  values (
    v_order.id,
    'waiting_payment_verification'::public.order_status,
    v_cashier_id,
    v_history_note,
    v_rejected_at
  );

  return query
  select
    v_order.id,
    v_order.order_number,
    p_payment_id,
    'rejected'::public.payment_status,
    v_order.current_status,
    v_reason,
    v_notes,
    v_cashier_id,
    v_rejected_at,
    v_rejected_at;
end;
$$;
