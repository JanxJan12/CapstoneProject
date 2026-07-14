import { Wifi } from "lucide-react";

export function MobileFrame({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="group flex flex-shrink-0 flex-col gap-3 [perspective:1200px]">
      {tag && (
        <p className="pl-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/35">
          {tag}
        </p>
      )}

      <div className="relative">
        <div className="absolute -left-[3px] top-24 h-9 w-[3px] rounded-l bg-zinc-700 shadow-sm" />
        <div className="absolute -left-[3px] top-[8.7rem] h-14 w-[3px] rounded-l bg-zinc-700 shadow-sm" />
        <div className="absolute -right-[3px] top-32 h-20 w-[3px] rounded-r bg-zinc-700 shadow-sm" />

        <div
          className="rrj-mobile-frame relative flex flex-col overflow-hidden rounded-[2.55rem] bg-gradient-to-br from-zinc-700 via-zinc-950 to-black p-[7px] shadow-[0_36px_65px_-30px_rgba(20,12,7,0.62),0_16px_28px_-18px_rgba(20,12,7,0.4),inset_0_1px_rgba(255,255,255,0.28)] ring-1 ring-black/80 transition-[transform,box-shadow] duration-500 ease-out group-hover:-translate-y-1 group-hover:[transform:rotateX(1deg)_rotateY(-1.5deg)_translateY(-4px)] group-hover:shadow-[0_44px_80px_-28px_rgba(20,12,7,0.68),0_20px_36px_-18px_rgba(20,12,7,0.45)]"
          style={{ width: 300, height: 606 }}
        >
          <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[2.08rem] bg-zinc-950 ring-1 ring-white/[0.08]">
            <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-[18px] w-[70px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_-1px_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.4)]">
              <div className="absolute right-[9px] top-[6px] h-[5px] w-[5px] rounded-full bg-blue-950 ring-1 ring-blue-900/70" />
            </div>

            <div className="relative z-10 flex h-8 flex-shrink-0 items-center justify-between bg-zinc-950 px-4 pb-1 pt-1.5">
              <span className="pl-1 text-[9px] font-extrabold tracking-tight text-white">9:41</span>
              <div className="flex items-center gap-1.5 text-white">
                <div className="flex h-2.5 items-end gap-[1px]" aria-label="Strong signal">
                  {[4, 6, 8, 10].map((height) => (
                    <span key={height} className="w-[2px] rounded-full bg-white" style={{ height }} />
                  ))}
                </div>
                <Wifi className="h-3 w-3" strokeWidth={2.7} />
                <div className="relative h-[9px] w-[18px] rounded-[3px] border border-white/75 p-[1px]" aria-label="Battery at 78 percent">
                  <span className="block h-full w-[78%] rounded-[1px] bg-emerald-400" />
                  <span className="absolute -right-[3px] top-[2px] h-[3px] w-[2px] rounded-r bg-white/60" />
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
              {children}
            </div>

            <div className="flex flex-shrink-0 items-center justify-center bg-background pb-2 pt-1.5">
              <div className="h-[3px] w-20 rounded-full bg-zinc-800/80" />
            </div>

            <div className="pointer-events-none absolute inset-0 rounded-[2.08rem] bg-gradient-to-br from-white/[0.045] via-transparent to-transparent" />
          </div>
        </div>
      </div>

      <figcaption className="flex items-center gap-2 px-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/70 ring-4 ring-primary/10" />
        <p className="text-[11px] font-extrabold tracking-tight text-foreground/65">{title}</p>
      </figcaption>
    </figure>
  );
}
