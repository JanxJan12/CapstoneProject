import { LayoutDashboard, Bike, History, User } from "lucide-react";
import { StatusBadge } from "../../../components/common/Badge";

const tabs = [{ l: "Home", i: LayoutDashboard }, { l: "Deliveries", i: Bike }, { l: "History", i: History, a: true }, { l: "Profile", i: User }];

export function DeliveryHistory() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-background flex-1 overflow-y-auto px-4 pt-4">
        <p className="text-[11px] font-bold mb-3">Delivery History</p>
        {[
          { id: "ORD-1046", addr: "23 Katipunan Ave., QC", amt: "₱155", time: "10:35 AM" },
          { id: "ORD-1043", addr: "34 Shaw Blvd., Mandaluyong", amt: "₱175", time: "9:52 AM" },
          { id: "ORD-1041", addr: "78 Quezon Blvd., QC", amt: "₱220", time: "8:30 AM" },
          { id: "ORD-1039", addr: "12 Mabini Ave., Makati", amt: "₱190", time: "8:05 AM" }
        ].map((d) => (
          <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
            <div><span className="font-mono text-[9px] font-bold text-primary">{d.id}</span><p className="text-[9px] text-muted-foreground">{d.addr} · {d.time}</p></div>
            <div className="flex items-center gap-2"><span className="text-xs font-bold">{d.amt}</span><StatusBadge status="delivered" /></div>
          </div>
        ))}
      </div>
      <div className="flex-shrink-0 bg-white border-t border-border flex items-center">
        {tabs.map((t) => { const Icon = t.i; return (<button key={t.l} className={`flex-1 flex flex-col items-center gap-0.5 py-2 ${t.a ? "text-primary" : "text-muted-foreground"}`}><Icon className="w-4 h-4" strokeWidth={t.a ? 2.5 : 1.8} /><span className="text-[8px] font-semibold">{t.l}</span></button>); })}
      </div>
    </div>
  );
}
