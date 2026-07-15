import { ArrowUpRight } from "lucide-react";

export function CashierMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rrj-card rrj-card-hover group relative min-h-[116px] w-full overflow-hidden p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={`Open ${label}: ${value}`}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/75 via-orange-400/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/[0.03] transition-transform group-hover:scale-105 ${tone}`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-1.5 truncate text-[19px] font-black tracking-[-0.03em] text-foreground sm:text-[21px]">
        {value}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="line-clamp-1 text-[10px] font-semibold text-muted-foreground">
          {detail}
        </p>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </button>
  );
}
