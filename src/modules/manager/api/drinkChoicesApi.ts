import { supabase } from "@/lib/supabase";

export interface ManagerDrinkChoice {
  menuItemId: string;
  choiceKind: "flavor" | "size";
  optionId: string;
  optionName: string;
  priceAdjustment: number;
  isActive: boolean;
}

function parseChoice(row: Record<string, unknown>): ManagerDrinkChoice {
  return {
    menuItemId: String(row.menu_item_id),
    choiceKind: row.choice_kind as "flavor" | "size",
    optionId: String(row.option_id),
    optionName: String(row.option_name),
    priceAdjustment: Number(row.price_adjustment),
    isActive: row.is_active === true,
  };
}

export async function getManagerDrinkChoices(): Promise<ManagerDrinkChoice[]> {
  const { data, error } = await supabase.rpc("get_manager_drink_choices");
  if (error || !Array.isArray(data)) throw new Error(error?.message ?? "Drink choices could not be loaded.");
  return data.map((row) => parseChoice(row as Record<string, unknown>));
}

export async function setManagerDrinkChoice(choice: ManagerDrinkChoice): Promise<ManagerDrinkChoice> {
  const { data, error } = await supabase.rpc("set_manager_drink_choice", {
    p_menu_item_id: choice.menuItemId,
    p_option_id: choice.optionId,
    p_price_adjustment: choice.priceAdjustment,
    p_is_active: choice.isActive,
  });
  if (error || !data) throw new Error(error?.message ?? "Drink choice update could not be confirmed.");
  return parseChoice(data as Record<string, unknown>);
}
