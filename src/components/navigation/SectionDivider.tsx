export function SectionDivider({ label, desc }: { label: string; desc?: string }) {
  return (
    <div className="mb-5 mt-1">
      <div className="flex items-center gap-4 mb-1">
        <div className="h-px flex-1 bg-black/12" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-foreground/55 tracking-widest uppercase whitespace-nowrap">{label}</span>
        </div>
        <div className="h-px flex-1 bg-black/12" />
      </div>
      {desc && <p className="text-center text-[10px] text-foreground/35">{desc}</p>}
    </div>
  );
}
