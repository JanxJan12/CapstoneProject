import { useState } from "react";
import { Check, Clock, ChefHat } from "lucide-react";
import { StatusBadge } from "../../../components/common/Badge";
import { kitchenOrders } from "../../../data/mockData";
import type { KitchenTab } from "../../../types";

function ElapsedBadge({ elapsed }: { elapsed: string }) {
  const m = parseInt(elapsed);
  const c = m >= 30 ? "bg-red-100 text-red-700 border-red-200" : m >= 15 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-green-100 text-green-700 border-green-200";
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${c}`}><Clock className="w-2.5 h-2.5" />{elapsed}</span>;
}

export function KitchenMonitorPage() {
  const [orders, setOrders] = useState(kitchenOrders);
  const cols: { status: KitchenTab; label: string; hdr: string; btn?: string; next?: string }[] = [
    { status: "confirmed", label: "Confirmed", hdr: "bg-blue-50 border-blue-200 text-blue-700", btn: "Start Preparing", next: "preparing" },
    { status: "preparing", label: "Preparing", hdr: "bg-amber-50 border-amber-200 text-amber-700", btn: "Mark as Ready", next: "ready" },
    { status: "ready", label: "Ready", hdr: "bg-violet-50 border-violet-200 text-violet-700", btn: "Complete", next: "completed" },
    { status: "completed", label: "Completed", hdr: "bg-green-50 border-green-200 text-green-700" },
  ];
  const advance = (id: string, next: string) => setOrders((p) => p.map((o) => o.id === id ? { ...o, status: next } : o));
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">Kitchen Queue</h1>
          <p className="text-xs text-muted-foreground">Real-time kanban — click to advance orders</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-muted-foreground">Live</span>
        </div>
      </div>
      <div className="flex gap-3 flex-1 overflow-x-auto overflow-y-hidden min-h-0 pb-2">
        {cols.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className="flex flex-col gap-2 overflow-hidden flex-shrink-0 w-[220px] sm:flex-1 sm:w-auto">
              <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg border ${col.hdr} flex-shrink-0`}>
                <span className="text-[11px] font-bold">{col.label}</span>
                <span className="w-5 h-5 rounded-full bg-white/70 flex items-center justify-center text-[9px] font-bold">{colOrders.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {colOrders.map((o) => (
                  <div key={o.id} className="bg-card rounded-xl border border-border p-3 flex-shrink-0">
                    <div className="flex justify-between mb-1.5"><span className="font-mono text-[10px] font-bold text-primary">{o.id}</span><ElapsedBadge elapsed={o.elapsed} /></div>
                    <div className="mb-1.5"><StatusBadge status={o.type.toLowerCase() === "walk-in" ? "walk-in" : "delivery"} /></div>
                    <p className="text-[11px] font-semibold text-foreground mb-2">{o.customer}</p>
                    <div className="flex flex-col gap-1 mb-2.5">
                      {o.items.map((item, i) => <div key={i} className="flex justify-between text-[10px]"><span className="text-muted-foreground">{item.name}</span><span className="font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">×{item.qty}</span></div>)}
                    </div>
                    {col.btn && col.next && (
                      <button onClick={() => advance(o.id, col.next!)} className="w-full py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold hover:bg-amber-800 flex items-center justify-center gap-1">
                        {col.status === "confirmed" ? <ChefHat className="w-3 h-3" /> : <Check className="w-3 h-3" />}{col.btn}
                      </button>
                    )}
                  </div>
                ))}
                {colOrders.length === 0 && <div className="flex items-center justify-center h-16 text-[11px] text-muted-foreground">No orders</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
