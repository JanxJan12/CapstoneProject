import type { ButtonHTMLAttributes, ElementType, ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/components/ui/utils";

export interface MetricCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  label: string;
  value: string;
  detail: string;
  icon: ElementType;
  tone: string;
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  className,
  ...props
}: MetricCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "rrj-card rrj-card-hover group relative min-h-[116px] w-full overflow-hidden p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
      aria-label={`Open ${label}: ${value}`}
      {...props}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/75 via-orange-400/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/[0.03] transition-transform group-hover:scale-105",
            tone,
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1.5 truncate text-[19px] font-black tracking-[-0.03em] text-foreground sm:text-[21px]">
        {value}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="line-clamp-1 text-[10px] font-semibold text-muted-foreground">
          {detail}
        </p>
        <ArrowUpRight
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

export interface ActionCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  label: string;
  detail: string;
  icon: ElementType;
  primary?: boolean;
}

export function ActionCard({
  label,
  detail,
  icon: Icon,
  primary = false,
  className,
  ...props
}: ActionCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "cashier-action group flex min-h-[76px] items-center gap-3 rounded-xl border px-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45",
        primary
          ? "sm:col-span-2 border-primary bg-gradient-to-r from-primary to-orange-600 text-primary-foreground shadow-md shadow-orange-900/10 hover:-translate-y-0.5 hover:shadow-lg"
          : "border-border bg-white/90 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-amber-50/30 hover:shadow-md",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          primary ? "bg-white/15" : "bg-amber-50 text-primary",
        )}
      >
        <Icon
          className="h-4 w-4 transition-transform group-hover:scale-110"
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-black sm:text-xs">{label}</span>
        <span
          className={cn(
            "mt-0.5 block line-clamp-1 text-[9px] font-semibold sm:text-[10px]",
            primary ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {detail}
        </span>
      </span>
      <ArrowRight
        className="hidden h-4 w-4 shrink-0 opacity-35 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70 sm:block"
        aria-hidden="true"
      />
    </button>
  );
}

export interface SummaryCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: ElementType;
  tone?: string;
  className?: string;
  children?: ReactNode;
}

export function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "bg-amber-50 text-primary",
  className,
  children,
}: SummaryCardProps) {
  return (
    <article
      className={cn(
        "rrj-card rrj-card-hover group relative min-w-0 overflow-hidden p-3.5",
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-black/[0.03] transition-transform group-hover:scale-105",
            tone,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <p
        className={cn(
          "text-[9px] font-black uppercase tracking-widest text-muted-foreground",
          Icon && "mt-3",
        )}
      >
        {label}
      </p>
      <p
        className="mt-1 truncate text-base font-black text-foreground"
        title={value}
      >
        {value}
      </p>
      {detail ? (
        <p
          className="mt-0.5 truncate text-[9px] text-muted-foreground"
          title={detail}
        >
          {detail}
        </p>
      ) : null}
      {children}
    </article>
  );
}
