import type {
  MenuItem,
  MenuModifierGroup,
  OrderItemModifier,
} from "../types";

const FOOD_ADD_ONS: MenuModifierGroup = {
  id: "food-add-ons",
  name: "Add-ons",
  selection: "multiple",
  options: [
    { id: "extra-rice", name: "Extra rice", price: 35 },
    { id: "extra-sauce", name: "Extra sauce", price: 15 },
  ],
};

const FOOD_PREFERENCES: MenuModifierGroup = {
  id: "food-preferences",
  name: "Preparation",
  selection: "multiple",
  options: [
    { id: "no-onions", name: "No onions", price: 0 },
    { id: "less-spicy", name: "Less spicy", price: 0 },
  ],
};

const DRINK_SIZE: MenuModifierGroup = {
  id: "drink-size",
  name: "Drink size",
  selection: "single",
  options: [
    { id: "drink-regular", name: "Regular", price: 0 },
    { id: "drink-large", name: "Large", price: 15 },
  ],
};

export function modifierGroupsFor(item: MenuItem): MenuModifierGroup[] {
  if (item.category === "Beverages") return [DRINK_SIZE];
  if (item.category === "Rice") return [];
  return [FOOD_ADD_ONS, FOOD_PREFERENCES];
}

export function validateMenuModifiers(
  item: MenuItem,
  selections: OrderItemModifier[] | undefined,
): OrderItemModifier[] {
  if (!selections?.length) return [];

  const groups = modifierGroupsFor(item);
  const allowed = new Map(
    groups.flatMap((group) =>
      group.options.map((option) => [option.id, { option, group }] as const),
    ),
  );
  const seen = new Set<string>();
  const singleSelections = new Set<string>();

  return selections.map((selection) => {
    const match = allowed.get(selection.id);
    if (!match) throw new Error(`${selection.name} is not available for ${item.name}.`);
    if (seen.has(selection.id))
      throw new Error(`Duplicate modifier ${match.option.name} is not allowed.`);
    seen.add(selection.id);
    if (match.group.selection === "single") {
      if (singleSelections.has(match.group.id))
        throw new Error(`Choose only one ${match.group.name.toLowerCase()} option.`);
      singleSelections.add(match.group.id);
    }
    return { ...match.option };
  });
}
