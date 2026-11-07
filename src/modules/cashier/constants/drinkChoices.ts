import type { MenuItem } from "../types";

export function drinkChoiceGroupsFor(item: MenuItem) {
  return item.drinkChoiceGroups ?? [];
}
