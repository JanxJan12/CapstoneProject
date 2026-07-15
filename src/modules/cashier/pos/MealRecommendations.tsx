import { Plus, Sparkles } from "lucide-react";
import { formatMoney } from "../constants";
import type { MenuItem } from "../types";
import type { MealRecommendations as MealRecommendationsModel } from "./posOperations";

export function MealRecommendations({
  recommendations,
  onAdd,
}: {
  recommendations: MealRecommendationsModel;
  onAdd: (item: MenuItem) => void;
}) {
  if (!recommendations.items.length) return null;

  return (
    <section className="pos-meal-recommendations shrink-0 border-t px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles
          className="h-3.5 w-3.5 text-[var(--pos-orange-soft)]"
          aria-hidden="true"
        />
        <p className="text-[10px] font-black">{recommendations.title}</p>
        <span className="ml-auto text-[8px] font-bold uppercase tracking-wider text-[var(--pos-muted)]">
          One-tap add
        </span>
      </div>
      <div className="pos-recommendation-strip flex gap-2 overflow-x-auto pb-1">
        {recommendations.items.map((item) => (
          <article
            key={item.id}
            className="pos-recommendation-card flex min-w-40 items-center gap-2 rounded-lg border p-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black">{item.name}</p>
              <p className="mt-1 text-[9px] font-bold text-[var(--pos-orange-soft)]">
                {formatMoney(item.price)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAdd(item)}
              aria-label={`Add recommended ${item.name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
