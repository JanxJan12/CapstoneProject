-- Execute only after the drink transition and frontend cutover are verified.
-- Historical order_items.modifiers snapshots are deliberately preserved.
begin;

do $$
declare v_dependency text;
begin
  if (select count(*) from public.drink_choices) <> 7 then
    raise exception 'Drink choice migration must be verified before retiring legacy tables.';
  end if;
  select p.oid::regprocedure::text into v_dependency
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
    and p.proname <> 'get_customer_menu_modifiers'
    and (p.prosrc ilike '%menu_modifier_groups%'
      or p.prosrc ilike '%menu_modifier_options%'
      or p.prosrc ilike '%menu_item_modifier_groups%')
  limit 1;
  if v_dependency is not null then
    raise exception 'Live function still references legacy modifiers: %', v_dependency;
  end if;
end $$;

drop function if exists public.get_customer_menu_modifiers();
drop table public.menu_item_modifier_groups;
drop table public.menu_modifier_options;
drop table public.menu_modifier_groups;

commit;
