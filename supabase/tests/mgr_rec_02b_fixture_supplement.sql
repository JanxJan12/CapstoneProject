-- Targeted disposable fixture supplement for manager_request_precision_disposable_setup.sql.
-- Supplies only the columns/constraint and exact Manager guard needed by the reviewed RPC.
create schema if not exists auth;
create function auth.uid() returns uuid language sql stable as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;
alter type public.user_role add value 'rider';
alter table public.receiving_reports
  add column source_type text,
  add column source_reference text,
  add column received_by uuid,
  add column inventory_request_revision integer,
  add column inspection_note text;
alter table public.receiving_reports alter column status set default 'draft';
create unique index one_open_inventory_request_receipt
  on public.receiving_reports(inventory_request_id)
  where inventory_request_id is not null and status = 'draft';

create function public.inventory_request_manager_required()
returns uuid language plpgsql stable security definer set search_path = '' as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.role = 'manager'::public.user_role and p.is_active
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$function$;
revoke all on function public.inventory_request_manager_required() from public, anon, authenticated;
