begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns where table_schema='public'
      and table_name in ('receiving_reports','receiving_report_items','purchase_orders')
      and column_name='notes'
  ) then
    raise exception 'General receiving or purchase order notes remain';
  end if;

  if to_regprocedure('public.create_emergency_production_receiving(uuid,timestamptz,text,text,text,text)') is not null
    or to_regprocedure('public.save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date,text)') is not null then
    raise exception 'Legacy receiving notes RPC signatures remain';
  end if;

  if to_regprocedure('public.create_emergency_production_receiving(uuid,timestamptz,text,text,text)') is null
    or to_regprocedure('public.save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date)') is null then
    raise exception 'Required receiving RPC signatures are missing';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public'
      and table_name='receiving_report_items' and column_name='rejection_reason')
    or not exists (select 1 from information_schema.columns where table_schema='public'
      and table_name='receiving_reports' and column_name='inspection_note')
    or not exists (select 1 from information_schema.columns where table_schema='public'
      and table_name='inventory_transactions' and column_name='reason') then
    raise exception 'Receiving or inventory evidence was removed';
  end if;
end;
$$;

rollback;
