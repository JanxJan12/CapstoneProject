export function DesktopFrame({ title, tag, w = 720, h = 480, children }: {
  title: string;
  tag?: string;
  w?: number;
  h?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 flex-shrink-0">
      {tag && <p className="text-[9px] font-mono uppercase tracking-widest text-foreground/35">{tag}</p>}
      <div className="rounded-xl overflow-hidden shadow-2xl border border-black/[0.08] flex-shrink-0 bg-background" style={{ width: w, height: h }}>
        <div style={{ width: w, height: h, overflow: "hidden", position: "relative" }}>{children}</div>
      </div>
      <p className="text-[11px] font-semibold text-foreground/60">{title}</p>
    </div>
  );
}
