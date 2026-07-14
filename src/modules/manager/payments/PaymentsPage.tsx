import { useState } from "react";
import { Check, X, ImageIcon } from "lucide-react";
import { Badge, StatusBadge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { pendingPayments } from "../../../data/mockData";

export function PaymentsPage() {
  const [sel, setSel] = useState<typeof pendingPayments[0]>(pendingPayments[0]);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-foreground">Payment Verification</h1>
        <Badge variant="warning">3 Pending</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2 flex flex-col gap-2">
          {pendingPayments.map((p) => (
            <button key={p.id} onClick={() => setSel(p)} className={`text-left p-3 rounded-xl border transition-all ${sel?.id === p.id ? "border-primary bg-red-50/50 ring-1 ring-primary/10" : "border-border bg-card hover:border-primary/30"}`}>
              <div className="flex justify-between mb-1"><span className="font-mono text-[10px] font-bold text-primary">{p.id}</span><Badge variant="warning">Pending</Badge></div>
              <p className="font-semibold text-xs text-foreground">{p.customer}</p>
              <p className="text-[10px] text-muted-foreground">₱{p.total} · GCash · {p.submitted}</p>
            </button>
          ))}
        </div>
        <div className="md:col-span-3 bg-card rounded-xl border border-border p-5">
          <div className="flex justify-between mb-4">
            <div><p className="font-mono text-sm font-bold text-primary">{sel.id}</p><Badge variant="warning">Awaiting Verification</Badge></div>
            <p className="text-xs text-muted-foreground">{sel.submitted}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            <div><p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Customer</p><p className="font-semibold">{sel.customer}</p></div>
            <div><p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Contact</p><p className="font-semibold">{sel.phone}</p></div>
            <div className="col-span-2"><p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Items</p><p className="font-semibold">{sel.items}</p></div>
            <div><p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">GCash Ref</p><p className="font-mono font-semibold">{sel.gcashRef}</p></div>
            <div><p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Amount</p><p className="text-xl font-bold text-foreground">₱{sel.total}</p></div>
          </div>
          <div className="flex flex-col items-center justify-center h-28 bg-muted/60 rounded-xl border border-border mb-4 gap-2">
            <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">GCash Proof of Payment</p>
          </div>
          <div className="flex gap-3">
            <Button variant="primary" size="md" className="flex-1"><Check className="w-4 h-4" />Verify Payment</Button>
            <Button variant="danger" size="md" className="flex-1"><X className="w-4 h-4" />Reject</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
