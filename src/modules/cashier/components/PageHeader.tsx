import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

export interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow = "Cashier operations",
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_4px_rgba(184,79,10,0.1)]"
            aria-hidden="true"
          />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/75">
            {eyebrow}
          </p>
        </div>
        <h1 className="text-2xl font-black tracking-[-0.025em] text-foreground sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs font-medium leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-black tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[11px] font-medium leading-4 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { SectionHeader as SectionHeading };
