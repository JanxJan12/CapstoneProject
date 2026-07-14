import { ArrowUpRight } from "lucide-react";

export function StatCard({ label, value, icon: Icon, iconBg, iconColor, sub, subColor = "text-green-600" }: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <article className="rrj-stat-card group relative flex min-h-[132px] flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4.5">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <p className="max-w-[70%] text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${iconBg} ring-1 ring-black/[0.035] transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105`}>
          <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={2.2} />
        </div>
      </div>
      <p className="font-['Fraunces'] text-[22px] font-bold leading-none tracking-[-0.035em] text-foreground">{value}</p>
      {sub && <p className={`mt-auto flex items-center gap-1 text-[10px] font-bold ${subColor}`}>{sub.includes("%") ? <ArrowUpRight className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}{sub}</p>}
    </article>
  );
}
