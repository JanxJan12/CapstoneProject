import type { MenuItem, MenuModifierGroup, OrderItemModifier } from "../types";

const FOOD_ADD_ONS: MenuModifierGroup = {
  id: "food-add-ons",
  name: "Add-ons",
  selection: "multiple",
  required: false,
  options: [
    { id: "extra-rice", name: "Extra rice", price: 35 },
    { id: "extra-sauce", name: "Extra sauce", price: 15 },
  ],
};

const FOOD_PREFERENCES: MenuModifierGroup = {
  id: "food-preferences",
  name: "Preparation preferences",
  selection: "multiple",
  required: false,
  options: [
    { id: "no-onions", name: "No onion", price: 0 },
    { id: "less-salt", name: "Less salt", price: 0 },
  ],
};

const SPICY_LEVEL: MenuModifierGroup = {
  id: "spicy-level",
  name: "Spicy level",
  selection: "single",
  required: false,
  options: [
    { id: "spice-mild", name: "Mild", price: 0 },
    { id: "spice-regular", name: "Regular", price: 0 },
    { id: "spice-hot", name: "Spicy", price: 0 },
    { id: "spice-extra-hot", name: "Extra spicy", price: 0 },
  ],
};

const COOKING_PREFERENCE: MenuModifierGroup = {
  id: "cooking-preference",
  name: "Cooking preference",
  selection: "single",
  required: false,
  options: [
    { id: "regular-cook", name: "Regular", price: 0 },
    { id: "extra-crispy", name: "Extra crispy", price: 0 },
    { id: "well-done", name: "Well done", price: 0 },
  ],
};

const DRINK_SIZE: MenuModifierGroup = {
  id: "drink-size",
  name: "Drink size",
  selection: "single",
  required: true,
  options: [
    { id: "drink-regular", name: "Regular", price: 0 },
    { id: "drink-large", name: "Large", price: 15 },
  ],
};

export function modifierGroupsFor(item: MenuItem): MenuModifierGroup[] {
  if (item.category === "Beverages") return [DRINK_SIZE];
  if (item.category === "Rice") return [];
  return [FOOD_ADD_ONS, FOOD_PREFERENCES, SPICY_LEVEL, COOKING_PREFERENCE];
}

export function defaultModifiersFor(item: MenuItem): OrderItemModifier[] {
  return modifierGroupsFor(item).flatMap((group) =>
    group.required && group.selection === "single" && group.options[0]
      ? [{ ...group.options[0] }]
      : [],
  );
}

export function validateMenuModifiers(
  item: MenuItem,
  selections: OrderItemModifier[] | undefined,
): OrderItemModifier[] {
  const groups = modifierGroupsFor(item);
  const allowed = new Map(
    groups.flatMap((group) =>
      group.options.map((option) => [option.id, { option, group }] as const),
    ),
  );
  const seen = new Set<string>();
  const singleSelections = new Set<string>();
  const validated = (selections ?? []).map((selection) => {
    const match = allowed.get(selection.id);
    if (!match)
      throw new Error(`${selection.name} is not available for ${item.name}.`);
    if (seen.has(selection.id))
      throw new Error(
        `Duplicate modifier ${match.option.name} is not allowed.`,
      );
    seen.add(selection.id);
    if (match.group.selection === "single") {
      if (singleSelections.has(match.group.id))
        throw new Error(
          `Choose only one ${match.group.name.toLowerCase()} option.`,
        );
      singleSelections.add(match.group.id);
    }
    return { ...match.option };
  });
  const selectedIds = new Set(validated.map((selection) => selection.id));
  for (const group of groups) {
    if (
      group.required &&
      !group.options.some((option) => selectedIds.has(option.id))
    ) {
      throw new Error(`${group.name} requires a selection.`);
    }
  }
  return validated;
}
