import { useState } from "react";
import { LayoutDashboard, Bike, History, User, MapPin } from "lucide-react";
import { StatusBadge } from "../../../components/common/Badge";

const tabs = [{ l: "Home", i: LayoutDashboard, a: true }, { l: "Deliveries", i: Bike }, { l: "History", i: History }, { l: "Profile", i: User }];

export function RiderHome() {
  const [avail, setAvail] = useState(true);
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 pt-4 pb-8 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div><p className="text-red-200 text-[8px] font-semibold uppercase tracking-wide">Good morning,</p><p className="text-white font-bold text-sm">Ramil Abad</p></div>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><span className="text-white font-bold text-xs">R</span></div>
        </div>
        <div className="flex items-center justify-between bg-white/15 rounded-xl px-3 py-2.5">
          <div><p className="text-white text-[10px] font-bold">Availability</p><p className="text-red-200 text-[8px]">{avail ? "Accepting deliveries" : "Not accepting"}</p></div>
          <button onClick={() => setAvail(!avail)} className={`w-11 h-5 rounded-full transition-all relative ${avail ? "bg-green-400" : "bg-white/30"}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${avail ? "left-6" : "left-0.5"}`} />
          </button>
        </div>
      </div>
      <div className="-mt-4 rounded-t-2xl bg-background flex-1 px-4 pt-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[{ l: "Today", v: "5", c: "text-primary" }, { l: "Completed", v: "3", c: "text-green-600" }].map((s) => (
            <div key={s.l} className="bg-card rounded-xl border border-border p-3"><p className="text-[9px] text-muted-foreground mb-0.5">{s.l}</p><p className={`text-xl font-bold ${s.c}`}>{s.v}</p></div>
          ))}
        </div>
        <p className="text-[11px] font-bold text-foreground mb-2">Active Delivery</p>
        <div className="bg-card rounded-xl border border-border p-3 mb-3">
          <div className="flex justify-between mb-1.5"><span className="font-mono text-[9px] font-bold text-primary">ORD-1046</span><StatusBadge status="out-for-delivery" /></div>
          <p className="text-xs font-semibold mb-1">Juan dela Cruz</p>
          <div className="flex items-start gap-1 text-[9px] text-muted-foreground mb-2"><MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" /><span>23 Katipunan Ave., QC</span></div>
          <button className="w-full py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold">Update Status</button>
        </div>
      </div>
      <div className="flex-shrink-0 bg-white border-t border-border flex items-center">
        {tabs.map((t) => { const Icon = t.i; return (<button key={t.l} className={`flex-1 flex flex-col items-center gap-0.5 py-2 ${t.a ? "text-primary" : "text-muted-foreground"}`}><Icon className="w-4 h-4" strokeWidth={t.a ? 2.5 : 1.8} /><span className="text-[8px] font-semibold">{t.l}</span></button>); })}
      </div>
    </div>
  );
}
