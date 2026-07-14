import { LayoutDashboard, Bike, History, User, MapPin, Navigation, Check, X } from "lucide-react";
import { StatusBadge } from "../../../components/common/Badge";

const tabs = [{ l: "Home", i: LayoutDashboard }, { l: "Deliveries", i: Bike, a: true }, { l: "History", i: History }, { l: "Profile", i: User }];

export function DeliveryRequests() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex-shrink-0">
        <p className="text-white font-bold text-sm">Delivery Request</p>
        <p className="text-red-200 text-[9px]">New delivery available</p>
      </div>
      <div className="-mt-3 rounded-t-2xl bg-background flex-1 px-4 pt-4 overflow-y-auto">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex justify-between mb-2"><span className="font-mono text-[9px] font-bold text-primary">ORD-1052</span><StatusBadge status="confirmed" /></div>
          <p className="text-xs font-bold mb-2">Grace Villanueva</p>
          <div className="flex flex-col gap-1.5 mb-2.5">
            <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground"><MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" /><span><span className="font-semibold text-foreground">Pickup:</span> RRJ Food-House</span></div>
            <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground"><MapPin className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" /><span><span className="font-semibold text-foreground">Deliver:</span> 12 Mabini Ave., Makati</span></div>
            <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground"><Navigation className="w-3 h-3 mt-0.5 flex-shrink-0" /><span>Landmark: Near BPI Bank</span></div>
          </div>
          <div className="bg-muted/60 rounded-lg p-2 mb-3"><p className="text-[8px] font-bold text-muted-foreground mb-0.5">ITEMS</p><p className="text-[9px] text-foreground">Sinigang na Baka, White Rice · ₱190</p></div>
          <div className="grid grid-cols-2 gap-1.5">
            <button className="py-2.5 rounded-xl bg-primary text-white text-[10px] font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" />Accept</button>
            <button className="py-2.5 rounded-xl border border-border bg-white text-[10px] font-bold text-muted-foreground flex items-center justify-center gap-1"><X className="w-3 h-3" />Reject</button>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 bg-white border-t border-border flex items-center">
        {tabs.map((t) => { const Icon = t.i; return (<button key={t.l} className={`flex-1 flex flex-col items-center gap-0.5 py-2 ${t.a ? "text-primary" : "text-muted-foreground"}`}><Icon className="w-4 h-4" strokeWidth={t.a ? 2.5 : 1.8} /><span className="text-[8px] font-semibold">{t.l}</span></button>); })}
      </div>
    </div>
  );
}
