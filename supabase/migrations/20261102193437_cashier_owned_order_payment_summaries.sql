-- Read only, owner-scoped payment summaries for the Cashier Orders list.
-- Rollback: revoke EXECUTE, then DROP FUNCTION public.get_cashier_order_payment_summaries(uuid[]).
create function public.get_cashier_order_payment_summaries(p_order_ids uuid[])
returns table (
  order_id uuid,
  payment_method public.payment_method,
  payment_status public.payment_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cashier_id uuid := auth.uid();
begin
  if p_order_ids is null
     or cardinality(p_order_ids) < 1
     or cardinality(p_order_ids) > 100
     or array_position(p_order_ids, null) is not null then
    raise exception 'Invalid order payment summary batch' using errcode = '22023';
  end if;

  if v_cashier_id is null or not exists (
    select 1 from public.profiles profile
    where profile.id = v_cashier_id
      and profile.is_active = true
      and profile.role = 'cashier'::public.user_role
  ) then
    raise exception 'Active Cashier access required' using errcode = '42501';
  end if;

  return query
  with requested as (
    select distinct input.id
    from unnest(p_order_ids) as input(id)
  )
  select
    orders.id,
    case when payment_counts.record_count = 1
      and transaction_counts.record_count = 1
      and transaction_row.cashier_id = v_cashier_id
      and transaction_row.payment_id = payment_row.id
      and payment_row.amount = orders.grand_total
      and (
        (payment_row.status = 'verified'::public.payment_status
          and transaction_row.status = 'completed'::public.cashier_transaction_status)
        or (payment_row.status = 'voided'::public.payment_status
          and transaction_row.status = 'voided'::public.cashier_transaction_status)
      )
      then payment_row.payment_method else null::public.payment_method end,
    case when payment_counts.record_count = 1
      and transaction_counts.record_count = 1
      and transaction_row.cashier_id = v_cashier_id
      and transaction_row.payment_id = payment_row.id
      and payment_row.amount = orders.grand_total
      and (
        (payment_row.status = 'verified'::public.payment_status
          and transaction_row.status = 'completed'::public.cashier_transaction_status)
        or (payment_row.status = 'voided'::public.payment_status
          and transaction_row.status = 'voided'::public.cashier_transaction_status)
      )
      then payment_row.status else null::public.payment_status end
  from requested
  join public.orders orders on orders.id = requested.id
  cross join lateral (
    select count(*) as record_count
    from public.payments payment
    where payment.order_id = orders.id
  ) payment_counts
  left join lateral (
    select payment.id, payment.payment_method, payment.status, payment.amount
    from public.payments payment
    where payment.order_id = orders.id
    limit 1
  ) payment_row on true
  cross join lateral (
    select count(*) as record_count
    from public.cashier_transactions transaction_record
    where transaction_record.order_id = orders.id
  ) transaction_counts
  left join lateral (
    select transaction_record.payment_id, transaction_record.cashier_id,
      transaction_record.status
    from public.cashier_transactions transaction_record
    where transaction_record.order_id = orders.id
    limit 1
  ) transaction_row on true
  where orders.order_channel = 'walk_in'::public.order_channel
    and exists (
      select 1 from public.cashier_transactions owned_transaction
      where owned_transaction.order_id = orders.id
        and owned_transaction.cashier_id = v_cashier_id
    );
end;
$$;

revoke all on function public.get_cashier_order_payment_summaries(uuid[]) from public, anon;
grant execute on function public.get_cashier_order_payment_summaries(uuid[]) to authenticated;
