begin;

-- Phase 6B.5C configures only client-confirmed Foodhouse stock identities,
-- sellable menu records, and their ID-based recipe quantities.
-- Opening quantities, batches, ledger movements, and FIFO consumption remain
-- deliberately out of scope.

lock table
  public.inventory_items,
  public.menu_items,
  public.menu_ingredients
in share row exclusive mode;

do $phase_6b5c$
declare
  v_viands_category_id uuid;
  v_inventory_count_before bigint;
  v_menu_count_before bigint;
  v_ingredient_count_before bigint;
  v_transaction_count_before bigint;
  v_receiving_report_count_before bigint;
  v_receiving_line_count_before bigint;
  v_purchase_order_count_before bigint;
  v_batch_count_before bigint;
  v_opening_count_before bigint;
  v_missing_inventory_count bigint;
  v_missing_menu_count bigint;
  v_missing_ingredient_count bigint;
  v_chicken_before jsonb;
  v_chicken_recipes_before jsonb;
begin
  create temporary table phase_6b5c_inventory_config (
    item_name text primary key
  ) on commit drop;

  insert into phase_6b5c_inventory_config (item_name)
  values
    ('Marinated Chicken - Paa'),
    ('Marinated Chicken - Pecho'),
    ('Biryani Chicken - Breast'),
    ('Fried Chicken - Quarter Leg');

  create temporary table phase_6b5c_menu_config (
    menu_name text primary key,
    menu_code text not null unique,
    price numeric(10,2) not null,
    inventory_name text not null,
    quantity_required numeric(12,3) not null
  ) on commit drop;

  insert into phase_6b5c_menu_config (
    menu_name,
    menu_code,
    price,
    inventory_name,
    quantity_required
  )
  values
    ('Inasal Paa Unli Rice', 'I1', 139, 'Marinated Chicken - Paa', 1),
    ('Inasal Paa Regular', 'I2', 129, 'Marinated Chicken - Paa', 1),
    ('Inasal Paa No Rice', 'I3', 119, 'Marinated Chicken - Paa', 1),
    ('Inasal Pecho Unli Rice', 'I4', 145, 'Marinated Chicken - Pecho', 1),
    ('Inasal Pecho Regular', 'I5', 135, 'Marinated Chicken - Pecho', 1),
    ('Inasal Pecho No Rice', 'I6', 129, 'Marinated Chicken - Pecho', 1),
    ('Fried Chicken Unli Rice', 'F1', 149, 'Fried Chicken - Quarter Leg', 2),
    ('Fried Chicken Regular', 'F2', 129, 'Fried Chicken - Quarter Leg', 2),
    ('Fried Chicken No Rice', 'F3', 119, 'Fried Chicken - Quarter Leg', 2),
    ('Chicken Biryani', 'B3', 209, 'Biryani Chicken - Breast', 1);

  select count(*) into v_inventory_count_before from public.inventory_items;
  select count(*) into v_menu_count_before from public.menu_items;
  select count(*) into v_ingredient_count_before from public.menu_ingredients;
  select count(*) into v_transaction_count_before from public.inventory_transactions;
  select count(*) into v_receiving_report_count_before from public.receiving_reports;
  select count(*) into v_receiving_line_count_before from public.receiving_report_items;
  select count(*) into v_purchase_order_count_before from public.purchase_orders;
  select count(*) into v_batch_count_before from public.inventory_batches;
  select count(*) into v_opening_count_before from public.inventory_opening_balances;

  select to_jsonb(chicken)
  into strict v_chicken_before
  from public.inventory_items chicken
  where chicken.item_name = 'Chicken'
    and chicken.unit = 'kg';

  select coalesce(jsonb_agg(to_jsonb(recipe) order by recipe.menu_name, recipe.inventory_name), '[]'::jsonb)
  into v_chicken_recipes_before
  from (
    select menu.name as menu_name, inventory.item_name as inventory_name,
           ingredient.quantity_required, inventory.unit
    from public.menu_ingredients ingredient
    join public.menu_items menu on menu.id = ingredient.menu_item_id
    join public.inventory_items inventory on inventory.id = ingredient.inventory_item_id
    where menu.name in ('Adobong Manok', 'Chicken Bicol Express')
  ) recipe;

  begin
    select category.id
    into strict v_viands_category_id
    from public.menu_categories category
    where category.name = 'Viands'
      and category.is_active = true;
  exception
    when no_data_found or too_many_rows then
      raise exception 'Phase 6B.5C requires exactly one active Viands menu category.'
        using errcode = 'P0001';
  end;

  if exists (
    select 1
    from phase_6b5c_inventory_config config
    join public.inventory_items item
      on lower(item.item_name) = lower(config.item_name)
    where item.item_name <> config.item_name
       or item.unit <> 'pcs'
       or item.secondary_unit is not null
       or item.quantity_scale <> 0
       or item.quantity_on_hand <> 0
       or item.reorder_level <> 0
       or item.inventory_category <> 'Ready-to-Cook'
       or item.item_kind is not null
       or item.rotation_policy <> 'fifo'
       or not item.expiry_required
       or item.shelf_life_days <> 2
       or not item.batch_consumption_enabled
       or not item.is_active
  ) then
    raise exception 'A Phase 6B.5C inventory name already exists with conflicting configuration.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from phase_6b5c_inventory_config config
    join public.inventory_items item
      on lower(item.item_name) = lower(config.item_name)
    group by config.item_name
    having count(*) > 1
  ) then
    raise exception 'Duplicate Phase 6B.5C inventory identities already exist.'
      using errcode = 'P0001';
  end if;

  select count(*)
  into v_missing_inventory_count
  from phase_6b5c_inventory_config config
  where not exists (
    select 1 from public.inventory_items item
    where lower(item.item_name) = lower(config.item_name)
  );

  insert into public.inventory_items (
    item_name,
    unit,
    secondary_unit,
    quantity_on_hand,
    reorder_level,
    inventory_category,
    item_kind,
    quantity_scale,
    rotation_policy,
    expiry_required,
    shelf_life_days,
    batch_consumption_enabled,
    is_active
  )
  select
    config.item_name,
    'pcs',
    null,
    0,
    0,
    'Ready-to-Cook',
    null,
    0,
    'fifo',
    true,
    2,
    true,
    true
  from phase_6b5c_inventory_config config
  where not exists (
    select 1 from public.inventory_items item
    where lower(item.item_name) = lower(config.item_name)
  );

  if (select count(*) from public.inventory_items) <> v_inventory_count_before + v_missing_inventory_count
     or exists (
       select 1
       from phase_6b5c_inventory_config config
       where (
         select count(*) from public.inventory_items item
         where lower(item.item_name) = lower(config.item_name)
       ) <> 1
     )
  then
    raise exception 'Phase 6B.5C inventory insertion was not exact.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from phase_6b5c_menu_config config
    join public.menu_items menu on lower(menu.name) = lower(config.menu_name)
    where menu.name <> config.menu_name
       or menu.code <> config.menu_code
       or menu.price <> config.price
       or menu.category_id <> v_viands_category_id
       or menu.description is not null
       or menu.image_path is not null
       or menu.aliases <> '{}'::text[]
       or not menu.is_available
       or not menu.is_active
  ) then
    raise exception 'A Phase 6B.5C menu name already exists with conflicting configuration.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from phase_6b5c_menu_config config
    join public.menu_items menu on menu.code = config.menu_code
    where lower(menu.name) <> lower(config.menu_name)
  ) then
    raise exception 'A required Phase 6B.5C menu code is already used by another menu item.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from phase_6b5c_menu_config config
    join public.menu_items menu on lower(menu.name) = lower(config.menu_name)
    group by config.menu_name
    having count(*) > 1
  ) then
    raise exception 'Duplicate Phase 6B.5C menu identities already exist.'
      using errcode = 'P0001';
  end if;

  select count(*)
  into v_missing_menu_count
  from phase_6b5c_menu_config config
  where not exists (
    select 1 from public.menu_items menu
    where lower(menu.name) = lower(config.menu_name)
  );

  insert into public.menu_items (
    category_id,
    name,
    price,
    is_available,
    is_active,
    code
  )
  select
    v_viands_category_id,
    config.menu_name,
    config.price,
    true,
    true,
    config.menu_code
  from phase_6b5c_menu_config config
  where not exists (
    select 1 from public.menu_items menu
    where lower(menu.name) = lower(config.menu_name)
  );

  if (select count(*) from public.menu_items) <> v_menu_count_before + v_missing_menu_count
     or exists (
       select 1
       from phase_6b5c_menu_config config
       where (
         select count(*) from public.menu_items menu
         where lower(menu.name) = lower(config.menu_name)
       ) <> 1
     )
  then
    raise exception 'Phase 6B.5C menu insertion was not exact.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from phase_6b5c_menu_config config
    join public.menu_items menu on menu.name = config.menu_name
    join public.menu_ingredients ingredient on ingredient.menu_item_id = menu.id
    join public.inventory_items inventory on inventory.id = ingredient.inventory_item_id
    where inventory.item_name <> config.inventory_name
       or ingredient.quantity_required <> config.quantity_required
  ) then
    raise exception 'A Phase 6B.5C menu already has an unintended recipe mapping.'
      using errcode = 'P0001';
  end if;

  select count(*)
  into v_missing_ingredient_count
  from phase_6b5c_menu_config config
  join public.menu_items menu on menu.name = config.menu_name
  join public.inventory_items inventory on inventory.item_name = config.inventory_name
  where not exists (
    select 1
    from public.menu_ingredients ingredient
    where ingredient.menu_item_id = menu.id
      and ingredient.inventory_item_id = inventory.id
      and ingredient.quantity_required = config.quantity_required
  );

  insert into public.menu_ingredients (
    menu_item_id,
    inventory_item_id,
    quantity_required
  )
  select menu.id, inventory.id, config.quantity_required
  from phase_6b5c_menu_config config
  join public.menu_items menu on menu.name = config.menu_name
  join public.inventory_items inventory on inventory.item_name = config.inventory_name
  where not exists (
    select 1
    from public.menu_ingredients ingredient
    where ingredient.menu_item_id = menu.id
      and ingredient.inventory_item_id = inventory.id
  );

  if (select count(*) from public.menu_ingredients) <> v_ingredient_count_before + v_missing_ingredient_count
     or exists (
       select 1
       from phase_6b5c_menu_config config
       join public.menu_items menu on menu.name = config.menu_name
       where (
         select count(*)
         from public.menu_ingredients ingredient
         join public.inventory_items inventory on inventory.id = ingredient.inventory_item_id
         where ingredient.menu_item_id = menu.id
           and inventory.item_name = config.inventory_name
           and ingredient.quantity_required = config.quantity_required
       ) <> 1
       or (
         select count(*)
         from public.menu_ingredients ingredient
         where ingredient.menu_item_id = menu.id
       ) <> 1
     )
  then
    raise exception 'Phase 6B.5C recipe insertion was not exact.' using errcode = 'P0001';
  end if;

  if (select to_jsonb(chicken) from public.inventory_items chicken where chicken.id = (v_chicken_before ->> 'id')::uuid)
       is distinct from v_chicken_before
     or (
       select coalesce(jsonb_agg(to_jsonb(recipe) order by recipe.menu_name, recipe.inventory_name), '[]'::jsonb)
       from (
         select menu.name as menu_name, inventory.item_name as inventory_name,
                ingredient.quantity_required, inventory.unit
         from public.menu_ingredients ingredient
         join public.menu_items menu on menu.id = ingredient.menu_item_id
         join public.inventory_items inventory on inventory.id = ingredient.inventory_item_id
         where menu.name in ('Adobong Manok', 'Chicken Bicol Express')
       ) recipe
     ) is distinct from v_chicken_recipes_before
  then
    raise exception 'Historical Chicken or its existing recipes changed.' using errcode = 'P0001';
  end if;

  if (select count(*) from public.inventory_transactions) <> v_transaction_count_before
     or (select count(*) from public.receiving_reports) <> v_receiving_report_count_before
     or (select count(*) from public.receiving_report_items) <> v_receiving_line_count_before
     or (select count(*) from public.purchase_orders) <> v_purchase_order_count_before
     or (select count(*) from public.inventory_batches) <> v_batch_count_before
     or (select count(*) from public.inventory_opening_balances) <> v_opening_count_before
  then
    raise exception 'Phase 6B.5C unexpectedly changed operational inventory documents or history.'
      using errcode = 'P0001';
  end if;
end
$phase_6b5c$;

commit;
