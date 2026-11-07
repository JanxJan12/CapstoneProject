-- Prepared only. Deploy separately after review of hosted function/schema drift.
-- All predicates are evaluated before LIMIT so screen counts and CSV share one population.
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
    select tx.id, tx.transaction_number, tx.receipt_number, tx.order_id,
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
        tx.transaction_number ilike '%' || (p_filters->>'search') || '%' or
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
