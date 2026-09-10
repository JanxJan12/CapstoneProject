import type { ElementType, ReactNode } from "react";
import { PackageOpen } from "lucide-react";
import { cn } from "@/components/ui/utils";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ElementType;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = PackageOpen,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-gradient-to-b from-amber-50/35 to-white p-5 text-center",
        compact ? "min-h-32" : "min-h-40",
        className,
      )}
    >
      <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-border">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-black tracking-tight text-foreground">
        {title}
      </p>
      <p className="mt-1 max-w-sm text-[11px] leading-4 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
