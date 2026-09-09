create or replace function public.get_current_shift_walk_in_sales()
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
$$;

revoke all
on function public.get_current_shift_walk_in_sales()
from public;

grant execute
on function public.get_current_shift_walk_in_sales()
to authenticated;

grant execute
on function public.get_current_shift_walk_in_sales()
to service_role;
