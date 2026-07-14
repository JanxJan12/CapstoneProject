import { ArrowLeft, Check } from "lucide-react";

export function UpdateStatus() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex items-center gap-2.5 flex-shrink-0">
        <ArrowLeft className="w-4 h-4 text-white" />
        <p className="text-white font-bold text-sm">Update Status</p>
      </div>
      <div className="flex-1 bg-background px-4 py-4 overflow-y-auto">
        <p className="font-mono text-[9px] font-bold text-primary mb-3">ORD-1052</p>
        {["Rider Accepted", "Picked Up", "Out for Delivery", "Delivered"].map((s, i) => (
          <div key={s} className={`flex items-center gap-2.5 p-3 mb-2 rounded-xl border transition-all ${i === 2 ? "border-primary bg-red-50/60" : "border-border bg-card"}`}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${i === 2 ? "border-primary bg-primary" : i < 2 ? "border-green-500 bg-green-500" : "border-border"}`}>
              {i <= 2 ? <Check className="w-2.5 h-2.5 text-white" /> : null}
            </div>
            <span className={`text-[10px] font-semibold ${i === 2 ? "text-primary" : i < 2 ? "text-green-700" : "text-muted-foreground"}`}>{s}</span>
          </div>
        ))}
        <button className="w-full mt-3 py-2.5 rounded-xl bg-primary text-white font-bold text-[11px]">Confirm Status</button>
      </div>
    </div>
  );
}
