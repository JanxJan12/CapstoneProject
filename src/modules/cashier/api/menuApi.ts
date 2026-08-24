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

export async function fetchCashierMenuItems(): Promise<MenuItem[]> {
  const [
    { data: categories, error: categoriesError },
    { data: items, error: itemsError },
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

  const categoryRows = (categories ?? []) as DatabaseMenuCategoryRow[];
  const itemRows = (items ?? []) as DatabaseMenuItemRow[];
  const categoryNameById = new Map(
    categoryRows.map((category) => [category.id, category.name]),
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

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      aliases: item.aliases,
      category,
      description: item.description ?? "",
      price,
      available: item.is_available,
    };
  });
}
