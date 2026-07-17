import { memo, useMemo } from "react";
import {
  Beef,
  CakeSlice,
  CupSoda,
  Flame,
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

const QUICK_VIEWS = [
  { id: "Best sellers", label: "Best sellers", icon: Flame },
] as const;

export interface CategorySidebarProps {
  menuItems: MenuItem[];
  value: string;
  bestSellerCount: number;
  onChange: (category: string) => void;
}

export const CategorySidebar = memo(function CategorySidebar({
  menuItems,
  value,
  bestSellerCount,
  onChange,
}: CategorySidebarProps) {
  const counts = useMemo(() => {
    const result = new Map<string, number>([["All", menuItems.length]]);
    for (const item of menuItems) {
      result.set(item.category, (result.get(item.category) ?? 0) + 1);
    }
    return result;
  }, [menuItems]);
  const quickCounts: Record<(typeof QUICK_VIEWS)[number]["id"], number> = {
    "Best sellers": bestSellerCount,
  };
  const categories = useMemo(() => {
    const configured = MENU_CATEGORIES.filter(
      (category) => category === "All" || (counts.get(category) ?? 0) > 0,
    );
    const discovered = [...counts.keys()].filter(
      (category) => !configured.includes(category),
    );
    return [...configured, ...discovered];
  }, [counts]);

  return (
    <nav
      className="pos-category-rail shrink-0 overflow-auto border-r p-2"
      aria-label="Menu categories and quick views"
    >
      <p className="pos-category-label px-2 pb-1 pt-1 text-[8px] font-black uppercase tracking-[0.18em]">
        Quick views
      </p>
      {QUICK_VIEWS.map(({ id, label, icon }) => (
        <CategoryButton
          key={id}
          label={label}
          icon={icon}
          count={quickCounts[id]}
          active={value === id}
          onClick={() => onChange(id)}
        />
      ))}
      <p className="pos-category-label px-2 pb-1 pt-3 text-[8px] font-black uppercase tracking-[0.18em]">
        Categories
      </p>
      {categories.map((category) => (
        <CategoryButton
          key={category}
          label={category}
          icon={CATEGORY_ICONS[category] ?? Grid2X2}
          count={counts.get(category) ?? 0}
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
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`pos-category-button ${active ? "is-active" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}
