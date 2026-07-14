import { useState } from "react";
import { Plus, Search, Filter, MapPin, Check, X } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import { StatusBadge } from "../../../components/common/Badge";
import { allOrders } from "../../../data/mockData";
import { ORDER_TIMELINE, ORDER_STEP_MAP } from "../../../constants";

export function OrdersPage() {
  const [sel, setSel] = useState<typeof allOrders[0] | null>(null);
  const step = sel ? (ORDER_STEP_MAP[sel.status] ?? 0) : 0;
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-foreground">Orders</h1>
          <Button variant="primary" size="sm"><Plus className="w-3 h-3" />New Order</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input placeholder="Search by order ID or customer…" className="w-full pl-8 pr-3 py-2 text-xs bg-input-background border border-border rounded-lg focus:outline-none" />
          </div>
          <select className="px-3 py-2 text-xs bg-input-background border border-border rounded-lg focus:outline-none text-foreground"><option>All Statuses</option></select>
          <Button variant="secondary" size="sm"><Filter className="w-3 h-3" />Filter</Button>
        </div>
        <Table headers={["Order ID", "Customer", "Type", "Total", "Status", "Rider", "Time", ""]}>
          {allOrders.map((o) => (
            <tr key={o.id} onClick={() => setSel(o)} className={`hover:bg-muted/30 cursor-pointer ${sel?.id === o.id ? "bg-red-50/40" : ""}`}>
              <Td><span className="font-mono text-[10px] font-bold text-primary">{o.id}</span></Td>
              <Td className="font-semibold text-xs">{o.customer}</Td>
              <Td><StatusBadge status={o.type} /></Td>
              <Td className="font-bold text-xs">₱{o.total}</Td>
              <Td><StatusBadge status={o.status} /></Td>
              <Td className="text-muted-foreground text-[10px]">{o.rider}</Td>
              <Td className="text-muted-foreground text-[10px]">{o.time}</Td>
              <Td><Button variant="ghost" size="sm">View</Button></Td>
            </tr>
          ))}
        </Table>
      </div>
      {sel && (
        <div className="w-full lg:w-72 flex-shrink-0 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div><p className="font-mono text-xs font-bold text-primary">{sel.id}</p><StatusBadge status={sel.status} /></div>
            <button onClick={() => setSel(null)} className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3">
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Customer</p>
              <p className="text-xs font-semibold">{sel.customer}</p>
              {sel.phone !== "—" && <p className="text-[10px] text-muted-foreground">{sel.phone}</p>}
              {sel.addr !== "—" && <p className="text-[10px] text-muted-foreground flex gap-1 mt-0.5"><MapPin className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />{sel.addr}</p>}
            </div>
            <div className="mb-3">
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Items</p>
              {sel.items.map((i, idx) => <div key={idx} className="flex justify-between text-[10px] py-0.5 border-b border-border last:border-0"><span>{i.name}</span><span className="font-bold">×{i.qty}</span></div>)}
              <div className="flex justify-between text-xs font-bold pt-1.5 mt-1 border-t border-border"><span>Total</span><span className="text-primary">₱{sel.total}</span></div>
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-2">Timeline</p>
              {ORDER_TIMELINE.map((s, i) => (
                <div key={s} className="flex items-start gap-2">
                  <div className="flex flex-col items-center">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${i < step ? "bg-green-500 border-green-500" : i === step ? "bg-primary border-primary" : "border-border bg-white"}`}>
                      {i < step ? <Check className="w-2.5 h-2.5 text-white" /> : i === step ? <div className="w-1 h-1 rounded-full bg-white" /> : null}
                    </div>
                    {i < ORDER_TIMELINE.length - 1 && <div className={`w-0.5 h-4 ${i < step ? "bg-green-400" : "bg-border"}`} />}
                  </div>
                  <p className={`text-[10px] pb-3 leading-tight ${i <= step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 py-3 border-t border-border flex gap-2">
            <Button variant="primary" size="sm" className="flex-1">Update Status</Button>
            <Button variant="secondary" size="sm">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
