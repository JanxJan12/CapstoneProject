import { supabase } from "@/lib/supabase";

export interface ManagerFixedMealOption {
  menuItemId: string;
  withoutRicePrice: number | null;
  withoutRiceInventoryItemId: string | null;
}

export interface ManagerMealIngredient {
  menuItemId: string;
  inventoryItemId: string;
  inventoryName: string;
  quantityRequired: number;
}

export interface ManagerMealInventoryCandidate {
  inventoryItemId: string;
  inventoryName: string;
  inventoryUnit: string;
}

export async function getManagerMealInventoryCandidates(): Promise<ManagerMealInventoryCandidate[]> {
  const { data, error } = await supabase.rpc("get_manager_fixed_meal_inventory_candidates");
  if (error || !Array.isArray(data)) throw new Error(error?.message ?? "Inventory choices could not be loaded.");
  return data.map((row) => ({
    inventoryItemId: String(row.inventory_item_id),
    inventoryName: String(row.inventory_name),
    inventoryUnit: String(row.inventory_unit),
  }));
}

export async function getManagerFixedMealOptions(): Promise<ManagerFixedMealOption[]> {
  const { data, error } = await supabase.rpc("get_manager_fixed_meal_options");
  if (error || !Array.isArray(data)) throw new Error(error?.message ?? "Meal options could not be loaded.");
  return data.map((row) => ({
    menuItemId: String(row.menu_item_id),
    withoutRicePrice: row.without_rice_price === null ? null : Number(row.without_rice_price),
    withoutRiceInventoryItemId: row.without_rice_inventory_item_id ?? null,
  }));
}

export async function getManagerMealIngredients(): Promise<ManagerMealIngredient[]> {
  const { data, error } = await supabase.rpc("get_manager_fixed_meal_ingredients");
  if (error || !Array.isArray(data)) throw new Error(error?.message ?? "Meal ingredients could not be loaded.");
  return data.map((row) => ({
    menuItemId: String(row.menu_item_id),
    inventoryItemId: String(row.inventory_item_id),
    inventoryName: String(row.inventory_name),
    quantityRequired: Number(row.quantity_required),
  }));
}

export async function setManagerFixedMealOption(
  menuItemId: string,
  standardPrice: number,
  withoutRicePrice: number | null,
  withoutRiceInventoryItemId: string | null,
  riceQuantityRequired: number | null,
): Promise<ManagerFixedMealOption> {
  const { data, error } = await supabase.rpc("set_manager_fixed_meal_option", {
    p_menu_item_id: menuItemId,
    p_standard_price: standardPrice,
    p_without_rice_price: withoutRicePrice,
    p_without_rice_inventory_item_id: withoutRiceInventoryItemId,
    p_rice_quantity_required: riceQuantityRequired,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error(error?.message ?? "Meal option update could not be confirmed.");
  }
  return {
    menuItemId: String(data[0].menu_item_id),
    withoutRicePrice: data[0].without_rice_price === null ? null : Number(data[0].without_rice_price),
    withoutRiceInventoryItemId: data[0].without_rice_inventory_item_id ?? null,
  };
}
