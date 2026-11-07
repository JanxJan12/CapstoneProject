-- Read-only Phase 6B.7B gate. Run immediately before physical opening.
-- Every target row must report ready=true; investigate any blocker and rerun.
with target(item_name) as (
  values
    ('Marinated Chicken - Paa'),
    ('Marinated Chicken - Pecho'),
    ('Biryani Chicken - Breast'),
    ('Fried Chicken - Quarter Leg')
), expected_menu(item_name, menu_name, quantity_required) as (
  values
    ('Marinated Chicken - Paa','Inasal Paa No Rice',1::numeric),
    ('Marinated Chicken - Paa','Inasal Paa Regular',1::numeric),
    ('Marinated Chicken - Paa','Inasal Paa Unli Rice',1::numeric),
    ('Marinated Chicken - Pecho','Inasal Pecho No Rice',1::numeric),
    ('Marinated Chicken - Pecho','Inasal Pecho Regular',1::numeric),
    ('Marinated Chicken - Pecho','Inasal Pecho Unli Rice',1::numeric),
    ('Biryani Chicken - Breast','Chicken Biryani',1::numeric),
    ('Fried Chicken - Quarter Leg','Fried Chicken No Rice',2::numeric),
    ('Fried Chicken - Quarter Leg','Fried Chicken Regular',2::numeric),
    ('Fried Chicken - Quarter Leg','Fried Chicken Unli Rice',2::numeric)
), actual_menu as (
  select i.item_name, m.name as menu_name, mi.quantity_required, m.is_active
  from public.menu_ingredients mi
  join public.inventory_items i on i.id=mi.inventory_item_id
  join public.menu_items m on m.id=mi.menu_item_id
  where i.item_name in (select item_name from target)
), menu_check as (
  select t.item_name,
    not exists (
      select 1 from expected_menu e
      where e.item_name=t.item_name and not exists (
        select 1 from actual_menu a where a.item_name=e.item_name
          and a.menu_name=e.menu_name and a.quantity_required=e.quantity_required
          and a.is_active
      )
    ) and not exists (
      select 1 from actual_menu a
      where a.item_name=t.item_name and not exists (
        select 1 from expected_menu e where e.item_name=a.item_name
          and e.menu_name=a.menu_name and e.quantity_required=a.quantity_required
          and a.is_active
      )
    ) as expected_mappings_match
  from target t
), state as (
  select t.item_name, i.id, i.is_active, i.batch_consumption_enabled,
         i.unit, i.secondary_unit, i.quantity_scale, i.rotation_policy,
         i.expiry_required, i.shelf_life_days, i.quantity_on_hand,
         (select count(*) from public.inventory_batches b where b.inventory_item_id=i.id) as batch_count,
         (select coalesce(sum(b.quantity_on_hand),0) from public.inventory_batches b where b.inventory_item_id=i.id) as batch_qoh,
         (select count(*) from public.inventory_opening_balances o where o.inventory_item_id=i.id) as opening_count,
         (select count(*) from public.inventory_transactions x where x.inventory_item_id=i.id) as transaction_count,
         mc.expected_mappings_match
  from target t
  left join public.inventory_items i on i.item_name=t.item_name
  join menu_check mc on mc.item_name=t.item_name
), evaluated as (
  select state.*,
         (select version from supabase_migrations.schema_migrations order by version desc limit 1) as latest_migration,
         array_remove(array[
           case when id is null then 'inventory item missing' end,
           case when is_active is distinct from true then 'item not active' end,
           case when batch_consumption_enabled is distinct from true then 'batch policy incorrect' end,
           case when unit is distinct from 'pcs' or secondary_unit is not null then 'units incorrect' end,
           case when quantity_scale is distinct from 0 then 'quantity scale incorrect' end,
           case when rotation_policy is distinct from 'fifo' then 'rotation policy incorrect' end,
           case when expiry_required is distinct from true or shelf_life_days is distinct from 2 then 'expiry policy incorrect' end,
           case when quantity_on_hand is distinct from 0 then 'aggregate QOH is not zero' end,
           case when batch_count <> 0 then 'batch already exists' end,
           case when opening_count <> 0 then 'opening already exists' end,
           case when transaction_count <> 0 then 'inventory transaction already exists' end,
           case when quantity_on_hand is distinct from batch_qoh then 'aggregate/batch mismatch' end,
           case when expected_mappings_match is distinct from true then 'menu mappings differ from verified contract' end,
           case when (select version from supabase_migrations.schema_migrations order by version desc limit 1)
                     <> '20261005013037' then 'migration baseline changed; re-audit before cutover' end
         ], null)::text[] as blockers
  from state
)
select item_name, id as inventory_item_id, latest_migration, is_active,
       batch_consumption_enabled, unit, secondary_unit, quantity_scale,
       rotation_policy, expiry_required, shelf_life_days, quantity_on_hand,
       batch_count, batch_qoh, opening_count, transaction_count,
       expected_mappings_match, cardinality(blockers)=0 as ready, blockers
from evaluated
order by item_name;
