begin;

do $$
declare
  v_order_id uuid;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'orders' and column_name in
        ('notes','table_number','discount_type','discount_reference','discount_amount'))
        or column_name in ('table_number','discount_type','discount_reference','discount_amount'))
  ) then
    raise exception 'Unapproved order feature columns remain';
  end if;

  if to_regprocedure('public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,text,text,text,text,public.payment_method,numeric,text,jsonb)') is not null
    or to_regprocedure('public.update_cashier_order_operational_details(uuid,text,text,text,text,text)') is not null
    or to_regprocedure('public.release_ready_order(uuid,text)') is not null then
    raise exception 'Legacy order feature RPC signatures remain';
  end if;

  if to_regprocedure('public.create_walk_in_sale(uuid,public.fulfillment_type,text,text,public.payment_method,numeric,text,jsonb)') is null
    or to_regprocedure('public.update_cashier_order_operational_details(uuid,text,text,text)') is null
    or to_regprocedure('public.release_ready_order(uuid)') is null then
    raise exception 'Approved order RPC signatures are missing';
  end if;

  if pg_get_function_result('public.get_kds_queue(uuid,text)'::regprocedure) ilike '%notes%'
    or pg_get_function_result('public.get_kds_queue_v2(uuid,text)'::regprocedure) ilike '%notes%'
    or pg_get_function_result('public.quote_customer_order(text,text,text,text,jsonb,uuid)'::regprocedure) ilike '%discount%' then
    raise exception 'Unapproved feature remains in a read contract';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* 'discount_amount|discount_type|discount_reference|table_number|o[.]notes'
  ) then
    raise exception 'Unapproved order feature remains in an active RPC';
  end if;

  if not exists (
    select 1 from information_schema.columns where table_schema='public'
      and table_name='order_items' and column_name='special_instructions'
  ) or not exists (
    select 1 from information_schema.columns where table_schema='public'
      and table_name='order_status_history' and column_name='notes'
  ) then
    raise exception 'Item instructions or status evidence were removed';
  end if;

  select id into v_order_id from public.orders limit 1;
  if v_order_id is not null then
    begin
      update public.orders set grand_total = grand_total + 1 where id = v_order_id;
      raise exception 'Invalid future total was accepted';
    exception when check_violation then
      null;
    end;
  end if;
end;
$$;

rollback;
