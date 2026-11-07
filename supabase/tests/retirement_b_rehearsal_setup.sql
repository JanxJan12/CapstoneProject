-- Run only in disposable retirement_b_rehearsal_20261022 cloned from the
-- prior post-transition/post-drop targeted fixture. Recreate the hosted legacy
-- table definitions and seven synthetic source choices before exact B replay.
begin;

create table public.menu_modifier_groups (
  id varchar(50) primary key,
  name varchar(80) not null,
  selection_type public.modifier_selection_type not null,
  min_selections smallint not null default 0 check (min_selections >= 0),
  max_selections smallint not null check (max_selections >= 1),
  is_active boolean not null default true,
  constraint menu_modifier_groups_range_chk check (min_selections <= max_selections),
  constraint menu_modifier_groups_single_max_chk check (selection_type <> 'single' or max_selections = 1)
);
create table public.menu_modifier_options (
  id varchar(50) primary key,
  group_id varchar(50) not null references public.menu_modifier_groups(id) on delete cascade,
  name varchar(80) not null,
  price_adjustment numeric(12,2) not null default 0 check (price_adjustment >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  unique (group_id,name)
);
create table public.menu_item_modifier_groups (
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  group_id varchar(50) not null references public.menu_modifier_groups(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (menu_item_id,group_id)
);
alter table public.menu_modifier_groups enable row level security;
alter table public.menu_modifier_options enable row level security;
alter table public.menu_item_modifier_groups enable row level security;
revoke all on public.menu_modifier_groups, public.menu_modifier_options, public.menu_item_modifier_groups from public, anon, authenticated;
grant all on public.menu_modifier_groups, public.menu_modifier_options, public.menu_item_modifier_groups to service_role;

insert into public.menu_modifier_groups(id,name,selection_type,min_selections,max_selections)
values ('softdrink-flavor','Softdrink flavor','single',1,1), ('drink-size','Drink size','single',1,1);
insert into public.menu_modifier_options(id,group_id,name,price_adjustment,sort_order)
select distinct on (dc.option_id) dc.option_id,
  case when dc.choice_kind='flavor' then 'softdrink-flavor' else 'drink-size' end,
  dc.option_name, dc.price_adjustment, dc.sort_order
from public.drink_choices dc order by dc.option_id, dc.menu_item_id;
insert into public.menu_item_modifier_groups(menu_item_id,group_id,sort_order)
select distinct dc.menu_item_id,
  case when dc.choice_kind='flavor' then 'softdrink-flavor' else 'drink-size' end,
  case when dc.choice_kind='flavor' then 1 else 2 end
from public.drink_choices dc;

commit;
