import { ArrowLeft, MapPin, Phone, Navigation, ArrowUpRight } from "lucide-react";
import { StatusBadge } from "../../../components/common/Badge";

export function DeliveryDetail() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex items-center gap-2.5 flex-shrink-0">
        <ArrowLeft className="w-4 h-4 text-white" />
        <p className="text-white font-bold text-sm">Delivery Detail</p>
      </div>
      <div className="flex-1 bg-background overflow-y-auto px-4 py-3">
        <div className="mb-2 flex gap-2"><span className="font-mono text-[9px] font-bold text-primary">ORD-1052</span><StatusBadge status="out-for-delivery" /></div>
        <div className="bg-card rounded-xl border border-border p-3 mb-2">
          <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Customer</p>
          <p className="text-xs font-bold">Grace Villanueva</p>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5"><Phone className="w-3 h-3" /><span>09282345678</span></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 mb-2">
          <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Delivery Address</p>
          <div className="flex items-start gap-1.5 text-[9px]"><MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" /><p className="font-semibold">12 Mabini Ave., Makati City</p></div>
          <p className="text-[9px] text-muted-foreground mt-0.5 ml-4">Landmark: Near BPI Bank</p>
          <div className="mt-2 h-16 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-center gap-1.5 text-[9px] text-blue-600 font-semibold cursor-pointer"><Navigation className="w-3.5 h-3.5" />Open in Maps</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 mb-3">
          <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Items</p>
          <div className="flex justify-between text-[9px] mb-0.5"><span>Sinigang na Baka</span><span className="font-bold">×1</span></div>
          <div className="flex justify-between text-[9px] mb-1.5"><span>White Rice</span><span className="font-bold">×1</span></div>
          <div className="flex justify-between font-bold text-xs border-t border-border pt-1.5"><span>Total</span><span className="text-primary">₱190</span></div>
        </div>
        <button className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-[10px] flex items-center justify-center gap-1.5"><ArrowUpRight className="w-3.5 h-3.5" />Update Delivery Status</button>
      </div>
    </div>
  );
}
