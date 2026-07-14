import { LayoutDashboard, Bike, History, User, LogOut } from "lucide-react";
import { StatusBadge } from "../../../components/common/Badge";

const tabs = [{ l: "Home", i: LayoutDashboard }, { l: "Deliveries", i: Bike }, { l: "History", i: History }, { l: "Profile", i: User, a: true }];

export function RiderProfile() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-5 flex flex-col items-center gap-2 flex-shrink-0">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"><span className="text-white font-bold text-xl">R</span></div>
        <p className="text-white font-bold text-sm">Ramil Abad</p>
        <StatusBadge status="available" />
      </div>
      <div className="flex-1 bg-background px-4 py-4 overflow-y-auto">
        {[{ l: "Contact", v: "09172345678" }, { l: "License", v: "LIC-2021-001234" }, { l: "Plate", v: "ABD-1234" }, { l: "Motor", v: "Honda TMX 125" }].map((f) => (
          <div key={f.l} className="flex justify-between py-2.5 border-b border-border last:border-0 text-[10px]"><span className="text-muted-foreground">{f.l}</span><span className="font-semibold text-foreground">{f.v}</span></div>
        ))}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-card rounded-xl border border-border p-2.5 text-center"><p className="text-[8px] text-muted-foreground mb-0.5">Total</p><p className="text-base font-bold">128</p></div>
          <div className="bg-card rounded-xl border border-border p-2.5 text-center"><p className="text-[8px] text-muted-foreground mb-0.5">Today</p><p className="text-base font-bold text-primary">5</p></div>
        </div>
        <button className="w-full mt-4 py-2.5 rounded-xl border border-border bg-white text-[10px] font-bold text-muted-foreground flex items-center justify-center gap-1.5"><LogOut className="w-3 h-3" />Sign Out</button>
      </div>
      <div className="flex-shrink-0 bg-white border-t border-border flex items-center">
        {tabs.map((t) => { const Icon = t.i; return (<button key={t.l} className={`flex-1 flex flex-col items-center gap-0.5 py-2 ${t.a ? "text-primary" : "text-muted-foreground"}`}><Icon className="w-4 h-4" strokeWidth={t.a ? 2.5 : 1.8} /><span className="text-[8px] font-semibold">{t.l}</span></button>); })}
      </div>
    </div>
  );
}
