-- Restore the existing public menu modifier projection without applying the
-- unrelated Customer checkout changes in the original completion migration.
-- Modifier tables retain their existing RLS and table grants.
create or replace function public.get_customer_menu_modifiers()
returns table(menu_item_id uuid, group_id varchar, group_name varchar,
  selection_type public.modifier_selection_type, min_selections smallint,
  max_selections smallint, option_id varchar, option_name varchar,
  price_adjustment numeric, group_sort_order integer, option_sort_order integer)
language plpgsql security definer set search_path = ''
as $$
begin
  -- The public menu is browsable before sign-in; expose only active catalog rows.
  return query
  select mimg.menu_item_id, mg.id, mg.name, mg.selection_type,
    mg.min_selections, mg.max_selections, mo.id, mo.name,
    mo.price_adjustment, mimg.sort_order, mo.sort_order
  from public.menu_item_modifier_groups mimg
  join public.menu_items mi on mi.id = mimg.menu_item_id
    and mi.is_active and mi.is_available
  join public.menu_modifier_groups mg on mg.id = mimg.group_id and mg.is_active
  left join public.menu_modifier_options mo on mo.group_id = mg.id and mo.is_active
  order by mimg.menu_item_id, mimg.sort_order, mg.id, mo.sort_order, mo.id;
end;
$$;
revoke all on function public.get_customer_menu_modifiers() from public, anon;
grant execute on function public.get_customer_menu_modifiers() to anon, authenticated, service_role;
