import type { ElementType } from "react";

export function OrderDetailInfo({
  icon: Icon,
  label,
  value,
  wide,
}: {
  icon: ElementType;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" /> {label}
      </p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
