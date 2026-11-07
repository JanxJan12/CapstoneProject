import { supabase } from "@/lib/supabase";
import type { CartItem, CustomerDrinkChoiceOption, CustomerDrinkChoiceRow } from "./customerTypes";

export function customerLineKey(id: string, modifierIds: string[], mealOption?: string): string {
  return `${id}:${mealOption ?? "standard"}:${[...modifierIds].sort().join(",")}`;
}

export function customerUnitPrice(item: CartItem): number {
  return (item.mealOption === "without_rice" ? item.withoutRicePrice ?? item.price : item.price) +
    item.modifiers.reduce((sum, option) => sum + option.price, 0);
}

export function customerMealChoiceName(choice?: "with_rice" | "without_rice"): string {
  return choice === "with_rice" ? "With Rice" : choice === "without_rice" ? "Without Rice" : "";
}

export function customerDrinkChoiceNames(modifiers: CustomerDrinkChoiceOption[]): string {
  return modifiers.map((option) => option.name).join(", ");
}

export async function loadCustomerDrinkChoiceRows(): Promise<CustomerDrinkChoiceRow[]> {
  const { data, error } = await supabase.rpc("get_drink_choices");
  if (error || !Array.isArray(data)) throw new Error("Drink choices could not be refreshed. Try again.");
  return data as CustomerDrinkChoiceRow[];
}

export interface FixedMealPrices {
  standard: number;
  withoutRice: number;
  withRiceAvailable: boolean;
  withoutRiceAvailable: boolean;
}

export async function loadCustomerFixedMealPrices(): Promise<Map<string, FixedMealPrices>> {
  const { data, error } = await supabase.rpc("get_fixed_meal_options");
  if (error?.code === "PGRST202") return new Map();
  if (error || !Array.isArray(data)) throw new Error("Meal options could not be refreshed. Try again.");
  const prices = new Map<string, FixedMealPrices>();
  for (const row of data as { menu_item_id: string; standard_price: number | string;
    without_rice_price: number | string; with_rice_available: boolean; without_rice_available: boolean }[]) {
    const price = Number(row.without_rice_price);
    const standard = Number(row.standard_price);
    if (!Number.isFinite(price) || !Number.isFinite(standard) || price <= 0 || price >= standard ||
      typeof row.with_rice_available !== "boolean" || typeof row.without_rice_available !== "boolean")
      throw new Error("Invalid meal option price.");
    prices.set(row.menu_item_id, { standard, withoutRice: price,
      withRiceAvailable: row.with_rice_available, withoutRiceAvailable: row.without_rice_available });
  }
  return prices;
}

export function reconcileCustomerCart(cart: CartItem[], rows: CustomerDrinkChoiceRow[], fixedPrices: Map<string, FixedMealPrices>): {
  cart: CartItem[]; error: string | null;
} {
  let error: string | null = null;
  for (const id of new Set(cart.map((line) => line.id))) {
    if (cart.filter((line) => line.id === id).reduce((sum, line) => sum + line.qty, 0) > 99) {
      error = "A dish exceeds the 99-item limit across its options. Reduce its quantity before checkout.";
    }
  }
  const refreshed = cart.map((line) => {
    const fixedPrice = fixedPrices.get(line.id);
    const withoutRicePrice = fixedPrice?.withoutRice;
    if (line.mealOption && line.mealOption !== "with_rice" && line.mealOption !== "without_rice") {
      error = `Meal choice for ${line.name} is invalid. Remove this line and choose it again.`;
      return line;
    }
    if (line.mealOption && withoutRicePrice === undefined) {
      error = `Meal options for ${line.name} changed. Remove this line and choose it again.`;
      return line;
    }
    if (fixedPrice && (line.mealOption === "without_rice" ? !fixedPrice.withoutRiceAvailable : !fixedPrice.withRiceAvailable)) {
      error = `The selected rice option for ${line.name} is unavailable. Review this item.`;
    }
    if (withoutRicePrice !== undefined && line.modifierIds.length > 0) {
      error = `Options for ${line.name} changed. Remove this line and choose it again.`;
      return line;
    }
    const itemRows = rows.filter((row) => row.menu_item_id === line.id);
    const chosen = line.modifierIds.map((id) => itemRows.find((row) => row.option_id === id));
    if (chosen.some((row) => !row) || new Set(line.modifierIds).size !== line.modifierIds.length) {
      error = `Options for ${line.name} changed. Remove this line and choose it again.`;
      return line;
    }
    for (const choiceKind of new Set(itemRows.map((row) => row.choice_kind))) {
      const count = chosen.filter((row) => row?.choice_kind === choiceKind).length;
      if (count !== 1) {
        error = `Options for ${line.name} changed. Remove this line and choose it again.`;
      }
    }
    const modifiers = chosen.map((row) => ({ id: row!.option_id!,
      name: row!.option_name!, price: Number(row!.price_adjustment) }));
    const mealOption = withoutRicePrice !== undefined ? line.mealOption ?? "with_rice" as const : undefined;
    return { ...line, modifiers, withoutRicePrice,
      price: fixedPrice?.standard ?? line.price,
      available: fixedPrice ? fixedPrice.withRiceAvailable || fixedPrice.withoutRiceAvailable : line.available,
      withRiceAvailable: fixedPrice?.withRiceAvailable,
      withoutRiceAvailable: fixedPrice?.withoutRiceAvailable,
      mealOption, lineKey: customerLineKey(line.id, line.modifierIds, mealOption) };
  });
  return { cart: refreshed, error };
}

export async function fetchCustomerEffectiveAvailability(): Promise<
  Map<string, boolean>
> {
  const { data, error } = await supabase.rpc(
    "get_menu_effective_availability",
  );

  if (error) {
    console.error("Unable to refresh menu availability:", error.message);
    throw new Error(
      "We couldn't refresh menu availability. Check your connection and try again.",
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The server returned an invalid menu availability result.",
    );
  }

  const availabilityByItemId = new Map<string, boolean>();

  for (const value of data as unknown[]) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(
        "The server returned an invalid menu availability entry.",
      );
    }

    const row = value as Record<string, unknown>;

    if (
      typeof row.menu_item_id !== "string" ||
      typeof row.effective_available !== "boolean"
    ) {
      throw new Error(
        "The server returned an incomplete menu availability entry.",
      );
    }

    availabilityByItemId.set(
      row.menu_item_id,
      row.effective_available,
    );
  }

  return availabilityByItemId;
}
