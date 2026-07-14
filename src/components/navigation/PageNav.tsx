import { UtensilsCrossed } from "lucide-react";
import { PAGE_LIST } from "../../constants";
import type { PageId } from "../../types";

export function PageNav({ active, onSelect }: { active: PageId; onSelect: (p: PageId) => void }) {
  return (
    <aside className="w-56 flex-shrink-0 bg-[#1e1e1e] flex flex-col h-full overflow-hidden">
      <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <UtensilsCrossed className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-none">RRJ Food-House</div>
            <div className="text-[9px] text-white/40 font-medium mt-0.5 uppercase tracking-widest">UI/UX Blueprint</div>
          </div>
        </div>
      </div>
      <div className="px-4 py-2 border-b border-white/10 flex-shrink-0">
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Pages</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {PAGE_LIST.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all group ${active === p.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"}`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${active === p.id ? "bg-primary text-white" : "bg-white/10 text-white/40 group-hover:bg-white/15"}`}>{p.num}</div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold truncate">{p.label}</div>
              <div className="text-[9px] opacity-50 truncate">{p.sub}</div>
            </div>
          </button>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
        <p className="text-[9px] text-white/25 text-center">RRJ Capstone Project · 2024</p>
      </div>
    </aside>
  );
}
