import { memo, useMemo } from "react";
import {
  Beef,
  CakeSlice,
  CupSoda,
  Grid2X2,
  Package,
  PlusCircle,
  Salad,
  Soup,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { MENU_CATEGORIES } from "../constants";
import type { MenuItem } from "../types";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  All: Grid2X2,
  Viands: Beef,
  Soups: Soup,
  Vegetables: Salad,
  Rice: Wheat,
  Beverages: CupSoda,
  Desserts: CakeSlice,
  Sides: Package,
  "Add-ons": PlusCircle,
};

export interface CategorySidebarProps {
  menuItems: MenuItem[];
  value: string;
  showUnavailable: boolean;
  onChange: (category: string) => void;
}

export const CategorySidebar = memo(function CategorySidebar({
  menuItems,
  value,
  showUnavailable,
  onChange,
}: CategorySidebarProps) {
  const counts = useMemo(() => {
    const result = new Map<string, number>([["All", 0]]);
    for (const item of menuItems) {
      if (!showUnavailable && !item.available) continue;
      result.set("All", (result.get("All") ?? 0) + 1);
      result.set(item.category, (result.get(item.category) ?? 0) + 1);
    }
    return result;
  }, [menuItems, showUnavailable]);
  const categories = useMemo(() => {
    const configured = MENU_CATEGORIES.filter(
      (category) => category === "All" || (counts.get(category) ?? 0) > 0,
    );
    const discovered = [...new Set(menuItems.map((item) => item.category))].filter(
      (category) => !configured.includes(category),
    );
    return [...configured, ...discovered];
  }, [counts, menuItems]);

  return (
    <nav
      className="pos-category-rail shrink-0 overflow-auto border-r p-2"
      aria-label="Menu categories"
    >
      {categories.map((category) => (
        <CategoryButton
          key={category}
          label={category}
          icon={CATEGORY_ICONS[category] ?? Grid2X2}
          count={counts.get(category) ?? 0}
          countLabel={showUnavailable ? "menu items" : "available items"}
          active={value === category}
          onClick={() => onChange(category)}
        />
      ))}
    </nav>
  );
});

function CategoryButton({
  label,
  icon: Icon,
  count,
  countLabel = "items",
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  count: number;
  countLabel?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label}, ${count} ${countLabel}`}
      onClick={onClick}
      className={`pos-category-button ${active ? "is-active" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}
