import { supabase } from "@/lib/supabase";

import type { MenuItem, DrinkChoiceGroup } from "../types";

interface ModifierRow {
  menu_item_id: string;
  choice_kind: "flavor" | "size";
  option_id: string;
  option_name: string;
  price_adjustment: number | string;
}

async function loadCashierDrinkChoices(): Promise<ModifierRow[]> {
  const { data, error } = await supabase.rpc("get_drink_choices");
  if (error || !Array.isArray(data)) throw new Error(`Unable to fetch cashier drink choices: ${error?.message ?? "Invalid response"}`);
  return data as ModifierRow[];
}

function groupDrinkChoices(rows: ModifierRow[]): Map<string, DrinkChoiceGroup[]> {
  const byItem = new Map<string, Map<string, DrinkChoiceGroup>>();
  for (const row of rows) {
    let itemGroups = byItem.get(row.menu_item_id);
    if (!itemGroups) {
      itemGroups = new Map();
      byItem.set(row.menu_item_id, itemGroups);
    }
    let group = itemGroups.get(row.choice_kind);
    if (!group) {
      group = {
        id: row.choice_kind,
        name: row.choice_kind === "flavor" ? "Drink flavor" : "Drink size",
        selection: "single",
        required: true,
        minSelections: 1,
        maxSelections: 1,
        options: [],
      };
      itemGroups.set(row.choice_kind, group);
    }
    if (row.option_id && row.option_name) {
      const price = Number(row.price_adjustment);
      if (!Number.isFinite(price)) throw new Error(`Invalid modifier price for ${row.option_name}.`);
      group.options.push({ id: row.option_id, name: row.option_name, price });
    }
  }
  return new Map([...byItem].map(([id, groups]) => [id, [...groups.values()]]));
}

interface DatabaseMenuCategoryRow {
  id: string;
  name: string;
}

interface DatabaseMenuItemRow {
  id: string;
  category_id: string;
  code: string;
  name: string;
  aliases: string[];
  description: string | null;
  price: number | string;
  is_available: boolean;
}

interface DatabaseMenuEffectiveAvailabilityRow {
  menu_item_id: string;
  effective_available: boolean;
}

interface FixedMealOptionRow {
  menu_item_id: string;
  standard_price: number | string;
  without_rice_price: number | string;
  with_rice_available: boolean;
  without_rice_available: boolean;
}

export async function fetchCashierMenuItems(): Promise<MenuItem[]> {
  const [
    { data: categories, error: categoriesError },
    { data: items, error: itemsError },
    { data: availability, error: availabilityError },
    drinkChoices,
    { data: fixedOptions, error: fixedOptionsError },
  ] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("menu_items")
      .select(
        `
          id,
          category_id,
          code,
          name,
          aliases,
          description,
          price,
          is_available
        `,
      )
      .eq("is_active", true)
      .order("name"),
    supabase.rpc("get_menu_effective_availability"),
    loadCashierDrinkChoices(),
    supabase.rpc("get_fixed_meal_options"),
  ]);

  if (categoriesError) {
    throw new Error(
      `Unable to fetch active cashier menu categories: ${categoriesError.message}`,
    );
  }

  if (itemsError) {
    throw new Error(
      `Unable to fetch active cashier menu items: ${itemsError.message}`,
    );
  }

  if (availabilityError) {
    throw new Error(
      `Unable to fetch effective cashier menu availability: ${availabilityError.message}`,
    );
  }

  if (fixedOptionsError && fixedOptionsError.code !== "PGRST202") {
    throw new Error(`Unable to fetch fixed meal options: ${fixedOptionsError.message}`);
  }

  const categoryRows = (categories ?? []) as DatabaseMenuCategoryRow[];
  const itemRows = (items ?? []) as DatabaseMenuItemRow[];
  const availabilityRows = (availability ??
    []) as DatabaseMenuEffectiveAvailabilityRow[];
  const drinksByItem = groupDrinkChoices(drinkChoices);
  const fixedPriceByItem = new Map(
    ((fixedOptions ?? []) as FixedMealOptionRow[]).map((entry) => [
      entry.menu_item_id,
      { standard: Number(entry.standard_price), withoutRice: Number(entry.without_rice_price),
        withRiceAvailable: entry.with_rice_available,
        withoutRiceAvailable: entry.without_rice_available },
    ]),
  );
  const categoryNameById = new Map(
    categoryRows.map((category) => [category.id, category.name]),
  );
  const effectiveAvailabilityByItemId = new Map(
    availabilityRows.map((entry) => [
      entry.menu_item_id,
      entry.effective_available,
    ]),
  );

  return itemRows.map((item) => {
    const category = categoryNameById.get(item.category_id);
    if (!category) {
      throw new Error(
        `Cashier menu item ${item.id} is not assigned to an active menu category.`,
      );
    }

    const fixedPrice = fixedPriceByItem.get(item.id);
    const price = fixedPrice?.standard ?? Number(item.price);
    if (!Number.isFinite(price)) {
      throw new Error(`Cashier menu item ${item.id} has an invalid price.`);
    }
    const withoutRicePrice = fixedPrice?.withoutRice;
    if (withoutRicePrice !== undefined &&
      (!Number.isFinite(withoutRicePrice) || withoutRicePrice <= 0 || withoutRicePrice >= price ||
        typeof fixedPrice?.withRiceAvailable !== "boolean" ||
        typeof fixedPrice?.withoutRiceAvailable !== "boolean")) {
      throw new Error(`Cashier meal option price is invalid for ${item.id}.`);
    }

    const effectiveAvailable = effectiveAvailabilityByItemId.get(item.id);
    if (effectiveAvailable === undefined) {
      throw new Error(
        `Cashier menu item ${item.id} has no effective availability result.`,
      );
    }

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      aliases: item.aliases,
      category,
      description: item.description ?? "",
      price,
      withoutRicePrice,
      available: effectiveAvailable || fixedPrice?.withoutRiceAvailable === true,
      withRiceAvailable: fixedPrice?.withRiceAvailable,
      withoutRiceAvailable: fixedPrice?.withoutRiceAvailable,
      drinkChoiceGroups: drinksByItem.get(item.id) ?? [],
    };
  });
}

export async function refreshCashierMenuAvailability(
  _currentItems: MenuItem[],
): Promise<MenuItem[]> {
  return fetchCashierMenuItems();
}
