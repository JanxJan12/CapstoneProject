export type CartItem =
  CustomerDatabaseMenuItem & {
    qty: number;
    lineKey: string;
    modifierIds: string[];
    modifiers: CustomerDrinkChoiceOption[];
    mealOption?: "with_rice" | "without_rice";
  };

export interface CustomerDrinkChoiceOption {
  id: string;
  name: string;
  price: number;
}

export interface CustomerDrinkChoiceGroup {
  id: string;
  name: string;
  selectionType: "single" | "multiple";
  min: number;
  max: number;
  options: CustomerDrinkChoiceOption[];
}

export interface CustomerDrinkChoiceRow {
  menu_item_id: string;
  choice_kind: "flavor" | "size";
  option_id: string;
  option_name: string;
  price_adjustment: number | string;
  sort_order: number;
}

export interface DatabaseMenuCategory {
  id: string;
  name: string;
}

export interface DatabaseMenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  is_available: boolean;
  is_active: boolean;
}

export interface DatabaseMenuEffectiveAvailability {
  menu_item_id: string;
  effective_available: boolean;
}

export interface CustomerDatabaseMenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  withoutRicePrice?: number;
  withRiceAvailable?: boolean;
  withoutRiceAvailable?: boolean;
  category: string;
  available: boolean;
  imagePath: string | null;
}
