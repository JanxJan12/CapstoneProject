import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

export interface SearchToolbarProps {
  label: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  quickFilters?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SearchToolbar({
  label,
  title,
  description,
  actions,
  quickFilters,
  children,
  className,
}: SearchToolbarProps) {
  return (
    <section
      className={cn("cashier-filter-bar rrj-card p-4", className)}
      aria-label={label}
    >
      {title || description || actions ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-xs font-black uppercase tracking-widest text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      {quickFilters ? <div className="mb-4">{quickFilters}</div> : null}
      {children}
    </section>
  );
}
