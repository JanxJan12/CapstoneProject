import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import { StatusBadge } from "../../../components/common/Badge";
import { purchaseOrders } from "../../../data/mockData";

export function PurchaseOrdersPage() {
  const [sel, setSel] = useState<typeof purchaseOrders[0] | null>(null);
  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-bold text-foreground">Purchase Orders</h1>
          <Button variant="primary" size="sm"><Plus className="w-3 h-3" />Create PO</Button>
        </div>
        <Table headers={["PO Number", "Supplier", "Status", "Items", "Total", "Date", ""]}>
          {purchaseOrders.map((po) => (
            <tr key={po.id} onClick={() => setSel(po)} className={`hover:bg-muted/30 cursor-pointer ${sel?.id === po.id ? "bg-red-50/40" : ""}`}>
              <Td><span className="font-mono text-[10px] font-bold text-primary">{po.id}</span></Td>
              <Td className="font-semibold text-xs">{po.supplier}</Td>
              <Td><StatusBadge status={po.status} /></Td>
              <Td className="text-xs">{po.items.length} items</Td>
              <Td className="font-bold text-xs">₱{po.total.toLocaleString()}</Td>
              <Td className="text-muted-foreground text-[10px]">{po.date}</Td>
              <Td><Button variant="ghost" size="sm">View</Button></Td>
            </tr>
          ))}
        </Table>
      </div>
      {sel && (
        <div className="w-60 flex-shrink-0 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div><p className="font-mono text-[10px] font-bold text-primary">{sel.id}</p><StatusBadge status={sel.status} /></div>
            <button onClick={() => setSel(null)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
          </div>
          <div className="flex-1 p-4">
            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Supplier</p>
            <p className="text-xs font-semibold mb-3">{sel.supplier}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-2">Items</p>
            {sel.items.map((i, idx) => <div key={idx} className="flex justify-between text-[10px] py-1 border-b border-border last:border-0"><span>{i.name} {i.qty} {i.unit}</span><span className="font-bold">₱{i.cost}</span></div>)}
            <div className="flex justify-between text-xs font-bold mt-2 pt-2 border-t border-border"><span>Total</span><span className="text-primary">₱{sel.total.toLocaleString()}</span></div>
          </div>
          {sel.status === "pending" && (
            <div className="px-4 py-3 border-t border-border">
              <Button variant="primary" size="sm" className="w-full"><Check className="w-3 h-3" />Receive PO</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
