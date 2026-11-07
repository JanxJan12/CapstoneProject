-- Run after 20261004163102_controlled_foodhouse_inventory_menu_configuration.sql.
-- All behavioral precision probes are isolated by the enclosing rollback.

begin;

do $phase_6b5c_verification$
declare
  v_blocked boolean;
  v_inventory_id uuid;
  v_ingredient_id uuid;
begin
  create temporary table phase_6b5c_expected_inventory (
    item_name text primary key
  ) on commit drop;

  insert into phase_6b5c_expected_inventory (item_name)
  values
    ('Marinated Chicken - Paa'),
    ('Marinated Chicken - Pecho'),
    ('Biryani Chicken - Breast'),
    ('Fried Chicken - Quarter Leg');

  create temporary table phase_6b5c_expected_menu (
    menu_name text primary key,
    menu_code text not null,
    price numeric(10,2) not null,
    inventory_name text not null,
    quantity_required numeric(12,3) not null
  ) on commit drop;

  insert into phase_6b5c_expected_menu (
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

  if (select count(*) from public.inventory_items) <> 16
     or (select count(*) from public.menu_items) <> 20
     or (select count(*) from public.menu_ingredients) <> 28
     or (select count(*) from public.menu_categories) <> 5
  then
    raise exception 'Phase 6B.5C expected business row counts are incorrect';
  end if;

  if exists (
    select 1
    from phase_6b5c_expected_inventory expected
    left join public.inventory_items item on item.item_name = expected.item_name
    where item.id is null
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
    raise exception 'A configured inventory item does not match the exact approved policy';
  end if;

  if exists (
    select expected.item_name
    from phase_6b5c_expected_inventory expected
    join public.inventory_items item on lower(item.item_name) = lower(expected.item_name)
    group by expected.item_name
    having count(*) <> 1
  ) then
    raise exception 'A configured inventory identity is duplicated';
  end if;

  if exists (
    select 1
    from phase_6b5c_expected_menu expected
    left join public.menu_items menu on menu.name = expected.menu_name
    left join public.menu_categories category on category.id = menu.category_id
    where menu.id is null
       or menu.code <> expected.menu_code
       or menu.price <> expected.price
       or category.name <> 'Viands'
       or not category.is_active
       or not menu.is_active
       or not menu.is_available
       or menu.description is not null
       or menu.image_path is not null
       or menu.aliases <> '{}'::text[]
  ) then
    raise exception 'A configured menu item does not match the exact approved price or sellable state';
  end if;

  if exists (
    select expected.menu_name
    from phase_6b5c_expected_menu expected
    join public.menu_items menu on lower(menu.name) = lower(expected.menu_name)
    group by expected.menu_name
    having count(*) <> 1
  ) then
    raise exception 'A configured menu identity is duplicated';
  end if;

  if exists (
    select 1
    from phase_6b5c_expected_menu expected
    join public.menu_items menu on menu.name = expected.menu_name
    left join public.menu_ingredients ingredient on ingredient.menu_item_id = menu.id
    left join public.inventory_items inventory on inventory.id = ingredient.inventory_item_id
    group by expected.menu_name, expected.inventory_name, expected.quantity_required
    having count(ingredient.id) <> 1
       or min(inventory.item_name) <> expected.inventory_name
       or min(ingredient.quantity_required) <> expected.quantity_required
  ) then
    raise exception 'A configured menu recipe is missing, duplicated, or incorrect';
  end if;

  if exists (
    select 1
    from phase_6b5c_expected_menu expected
    join public.menu_items menu on menu.name = expected.menu_name
    join public.menu_ingredients ingredient on ingredient.menu_item_id = menu.id
    join public.inventory_items inventory on inventory.id = ingredient.inventory_item_id
    where inventory.item_name = 'Rice'
       or inventory.item_name <> expected.inventory_name
       or ingredient.quantity_required <> expected.quantity_required
  ) then
    raise exception 'An unconfirmed or unintended recipe mapping was created';
  end if;

  if exists (
    select 1
    from phase_6b5c_expected_menu expected
    join public.menu_items menu on menu.name = expected.menu_name
    left join public.get_menu_effective_availability() availability
      on availability.menu_item_id = menu.id
    where availability.menu_item_id is null
       or availability.effective_available
  ) then
    raise exception 'A zero-stock configured menu is effectively available';
  end if;

  if not exists (
    select 1 from public.inventory_items chicken
    where chicken.item_name = 'Chicken'
      and chicken.unit = 'kg'
      and chicken.secondary_unit = 'pcs'
      and chicken.quantity_on_hand = 29.251
      and chicken.reorder_level = 3
      and chicken.item_kind = 'raw'
      and chicken.quantity_scale = 3
      and chicken.rotation_policy = 'fefo'
      and chicken.expiry_required
      and chicken.shelf_life_days is null
      and not chicken.batch_consumption_enabled
      and chicken.is_active
  ) then
    raise exception 'Historical Chicken changed';
  end if;

  if (
    select count(*)
    from public.menu_ingredients ingredient
    join public.menu_items menu on menu.id = ingredient.menu_item_id
    join public.inventory_items inventory on inventory.id = ingredient.inventory_item_id
    where menu.name = 'Adobong Manok'
      and (
        (inventory.item_name = 'Chicken' and inventory.unit = 'kg' and ingredient.quantity_required = 0.250)
        or (inventory.item_name = 'Soy Sauce' and inventory.unit = 'L' and ingredient.quantity_required = 0.030)
        or (inventory.item_name = 'Vinegar' and inventory.unit = 'L' and ingredient.quantity_required = 0.020)
      )
  ) <> 3
     or (
       select count(*) from public.menu_ingredients ingredient
       join public.menu_items menu on menu.id = ingredient.menu_item_id
       where menu.name = 'Adobong Manok'
     ) <> 3
  then
    raise exception 'Adobong Manok historical recipe changed';
  end if;

  if (
    select count(*)
    from public.menu_ingredients ingredient
    join public.menu_items menu on menu.id = ingredient.menu_item_id
    join public.inventory_items inventory on inventory.id = ingredient.inventory_item_id
    where menu.name = 'Chicken Bicol Express'
      and (
        (inventory.item_name = 'Chicken' and inventory.unit = 'kg' and ingredient.quantity_required = 0.250)
        or (inventory.item_name = 'Coconut Milk' and inventory.unit = 'L' and ingredient.quantity_required = 0.120)
      )
  ) <> 2
     or (
       select count(*) from public.menu_ingredients ingredient
       join public.menu_items menu on menu.id = ingredient.menu_item_id
       where menu.name = 'Chicken Bicol Express'
     ) <> 2
  then
    raise exception 'Chicken Bicol Express historical recipe changed';
  end if;

  if (select count(*) from public.inventory_transactions) <> 41
     or (select count(*) from public.receiving_reports) <> 1
     or (select count(*) from public.receiving_report_items) <> 0
     or (select count(*) from public.purchase_orders) <> 0
     or (select count(*) from public.purchase_order_items) <> 0
     or (select count(*) from public.inventory_batches) <> 0
     or (select count(*) from public.inventory_opening_balances) <> 0
     or exists (
       select 1 from public.inventory_transactions transaction_record
       join phase_6b5c_expected_inventory expected on expected.item_name = (
         select item.item_name from public.inventory_items item
         where item.id = transaction_record.inventory_item_id
       )
     )
     or exists (
       select 1 from public.inventory_batches batch
       join public.inventory_items item on item.id = batch.inventory_item_id
       join phase_6b5c_expected_inventory expected on expected.item_name = item.item_name
     )
     or exists (
       select 1 from public.inventory_opening_balances opening
       join public.inventory_items item on item.id = opening.inventory_item_id
       join phase_6b5c_expected_inventory expected on expected.item_name = item.item_name
     )
  then
    raise exception 'Configuration created stock, batches, opening balances, or operational documents';
  end if;

  if exists (
    select 1 from public.inventory_items item
    where lower(item.item_name) like '%squid roll%'
       or lower(item.item_name) like '%bilao%'
       or lower(item.item_name) like '%tray%'
  ) then
    raise exception 'Deferred Squid Roll, bilao, or tray inventory was created';
  end if;

  select item.id into strict v_inventory_id
  from public.inventory_items item
  where item.item_name = 'Marinated Chicken - Paa';

  update public.inventory_items set quantity_on_hand = 1 where id = v_inventory_id;
  update public.inventory_items set quantity_on_hand = 2 where id = v_inventory_id;
  update public.inventory_items set quantity_on_hand = 30 where id = v_inventory_id;
  update public.inventory_items set quantity_on_hand = 0 where id = v_inventory_id;

  v_blocked := false;
  begin
    update public.inventory_items set quantity_on_hand = 1.5 where id = v_inventory_id;
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Scale-0 inventory accepted 1.5'; end if;

  v_blocked := false;
  begin
    update public.inventory_items set quantity_on_hand = 2.25 where id = v_inventory_id;
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Scale-0 inventory accepted 2.25'; end if;

  select ingredient.id into strict v_ingredient_id
  from public.menu_ingredients ingredient
  join public.menu_items menu on menu.id = ingredient.menu_item_id
  where menu.name = 'Inasal Paa Regular';

  v_blocked := false;
  begin
    update public.menu_ingredients set quantity_required = 1.5 where id = v_ingredient_id;
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Scale-0 recipe accepted 1.5 pieces'; end if;
end
$phase_6b5c_verification$;

select 'Phase 6B.5C SQL verification: 44/44 checks passed.' as result;

rollback;
