import { STATUS_MAP } from "../../constants";
import type { BadgeVariant } from "../../types";

export function Badge({ children, variant = "neutral" }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const s: Record<BadgeVariant, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-green-100 text-green-700 border border-green-200",
    warning: "bg-amber-100 text-amber-700 border border-amber-200",
    danger: "bg-red-100 text-red-700 border border-red-200",
    info: "bg-blue-100 text-blue-700 border border-blue-200",
    neutral: "bg-zinc-100 text-zinc-600 border border-zinc-200",
    purple: "bg-violet-100 text-violet-700 border border-violet-200",
    orange: "bg-orange-100 text-orange-700 border border-orange-200",
  };
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] shadow-[0_1px_2px_rgba(36,26,19,0.03)] ${s[variant]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_MAP[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
