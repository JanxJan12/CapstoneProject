import type { ElementType } from "react";

export function TransactionDetailCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rrj-card p-3">
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" /> {label}
      </p>
      <p className="mt-1 truncate text-xs font-black" title={value}>
        {value}
      </p>
    </div>
  );
}

export function FinancialLine({
  label,
  value,
  tone = "text-foreground",
  strong = false,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${strong ? "border-t border-border pt-2 text-sm font-black" : ""}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${tone}`}>{value}</span>
    </div>
  );
}
