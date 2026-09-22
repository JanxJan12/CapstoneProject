import { supabase } from "@/lib/supabase";

import type { MenuItem } from "../types";

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

export async function fetchCashierMenuItems(): Promise<MenuItem[]> {
  const [
    { data: categories, error: categoriesError },
    { data: items, error: itemsError },
    { data: availability, error: availabilityError },
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

  const categoryRows = (categories ?? []) as DatabaseMenuCategoryRow[];
  const itemRows = (items ?? []) as DatabaseMenuItemRow[];
  const availabilityRows = (availability ??
    []) as DatabaseMenuEffectiveAvailabilityRow[];
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

    const price = Number(item.price);
    if (!Number.isFinite(price)) {
      throw new Error(`Cashier menu item ${item.id} has an invalid price.`);
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
      available: effectiveAvailable,
    };
  });
}

export async function refreshCashierMenuAvailability(
  currentItems: MenuItem[],
): Promise<MenuItem[]> {
  if (currentItems.length === 0) {
    return fetchCashierMenuItems();
  }

  const { data, error } = await supabase.rpc(
    "get_menu_effective_availability",
  );

  if (error) {
    throw new Error(
      `Unable to refresh effective cashier menu availability: ${error.message}`,
    );
  }

  const rows = (data ?? []) as DatabaseMenuEffectiveAvailabilityRow[];
  const availabilityByItemId = new Map(
    rows.map((entry) => [entry.menu_item_id, entry.effective_available]),
  );
  const missingItem = currentItems.find(
    (item) => !availabilityByItemId.has(item.id),
  );

  if (missingItem) {
    throw new Error(
      `Cashier menu item ${missingItem.id} has no effective availability result.`,
    );
  }

  return currentItems.map((item) => ({
    ...item,
    available: availabilityByItemId.get(item.id) ?? false,
  }));
}
