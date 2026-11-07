import type { ManagerMenuItem } from "../api/managerPhase2Api";
import type { ManagerDrinkChoice } from "../api/drinkChoicesApi";

// The restaurant's Viands category is the current meal classification. A
// recipe link does not prove that the rice serving itself has been approved.
export function eligibleMealProducts(
  items: ManagerMenuItem[],
  drinkChoices: ManagerDrinkChoice[],
): ManagerMenuItem[] {
  const drinkIds = new Set(drinkChoices.map((choice) => choice.menuItemId));
  return items.filter((item) => item.isActive &&
    item.categoryName.trim().toLowerCase() === "viands" && !drinkIds.has(item.id));
}
