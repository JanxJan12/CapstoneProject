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