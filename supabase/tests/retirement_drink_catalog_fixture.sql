-- Synthetic catalog in a disposable database only. Mirrors the seven reviewed hosted choices.
insert into public.menu_categories(id,name) values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Beverages');
insert into public.menu_items(id,category_id,code,name,price) values
  ('3c78b355-2613-4f5b-af4d-ac2197d957fe','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D1','Softdrinks',30),
  ('e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D2','Buko Juice',35);
insert into public.menu_modifier_groups(id,name,selection_type,min_selections,max_selections) values
  ('softdrink-flavor','Drink flavor','single',1,1),
  ('drink-size','Drink size','single',1,1);
insert into public.menu_modifier_options(id,group_id,name,price_adjustment,sort_order) values
  ('drink-coke','softdrink-flavor','Coke',0,1),
  ('drink-sprite','softdrink-flavor','Sprite',0,2),
  ('drink-royal','softdrink-flavor','Royal',0,3),
  ('drink-regular','drink-size','Regular',0,1),
  ('drink-large','drink-size','Large',15,2);
insert into public.menu_item_modifier_groups(menu_item_id,group_id) values
  ('3c78b355-2613-4f5b-af4d-ac2197d957fe','softdrink-flavor'),
  ('3c78b355-2613-4f5b-af4d-ac2197d957fe','drink-size'),
  ('e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c','drink-size');
