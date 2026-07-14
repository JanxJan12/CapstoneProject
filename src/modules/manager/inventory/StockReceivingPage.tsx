import { useState } from "react";
import { CheckCircle, ArrowDownToLine } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { inventoryItems } from "../../../data/mockData";

export function StockReceivingPage() {
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty]         = useState("");
  const [unit, setUnit]       = useState("");
  const [supplier, setSupplier] = useState("");
  const [ref, setRef]         = useState("");
  const [saved, setSaved]     = useState(false);

  const selectedInv = inventoryItems.find((i) => i.name === selectedItem);

  const handleSave = () => {
    if (!selectedItem || !qty) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSelectedItem(""); setQty(""); setRef("");
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
          <ArrowDownToLine className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Stock Receiving</h1>
          <p className="text-xs text-muted-foreground">Record incoming stock from suppliers</p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-3 px-4 py-3 mb-5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Stock received and inventory updated successfully.
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Inventory Item</label>
            <select
              value={selectedItem}
              onChange={(e) => {
                setSelectedItem(e.target.value);
                const inv = inventoryItems.find((i) => i.name === e.target.value);
                if (inv) setUnit(inv.unit);
              }}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 text-foreground"
            >
              <option value="">Select inventory item…</option>
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.name}>{i.name}</option>
              ))}
            </select>
          </div>

          {selectedInv && (
            <div className="col-span-2 flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-lg border border-border text-xs">
              <div className="flex gap-6">
                <div><span className="text-muted-foreground">Current Stock:</span> <span className="font-bold">{selectedInv.qty} {selectedInv.unit}</span></div>
                <div><span className="text-muted-foreground">Unit:</span> <span className="font-bold">{selectedInv.unit}</span></div>
                <div><span className="text-muted-foreground">Reorder Level:</span> <span className="font-bold">{selectedInv.reorder} {selectedInv.unit}</span></div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Quantity Received</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50"
              />
              <div className="px-3 py-2.5 text-sm bg-muted border border-border rounded-lg text-muted-foreground min-w-[60px] text-center">
                {unit || "unit"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Supplier</label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 text-foreground"
            >
              <option value="">Select supplier…</option>
              <option>Metro Market Supplier</option>
              <option>Fresh Farm Distributors</option>
              <option>Pantranco Goods Supply</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Purchase Order Ref.</label>
            <input
              type="text"
              placeholder="e.g. PO-2024-031"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Date Received</label>
            <input
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 text-foreground"
            />
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Any remarks about the received stock…"
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border mt-2">
          {qty && selectedItem && (
            <div className="flex-1 text-xs text-muted-foreground">
              New stock level will be:{" "}
              <span className="font-bold text-green-600">
                {(selectedInv?.qty ?? 0) + Number(qty)} {unit}
              </span>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" size="md" onClick={() => { setSelectedItem(""); setQty(""); setRef(""); }}>
              Reset
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!selectedItem || !qty}
              onClick={handleSave}
            >
              <ArrowDownToLine className="w-4 h-4" />
              Record Stock Received
            </Button>
          </div>
        </div>
      </div>

      {/* Recent stock received */}
      <div className="mt-6">
        <p className="text-sm font-bold text-foreground mb-3">Recent Stock Received</p>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                {["Item", "Qty Received", "Supplier", "PO Ref.", "Date", "By"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { item: "Rice",                  qty: "+20 kg",    supplier: "Metro Market Supplier",  ref: "PO-2024-031", date: "Jul 4, 8:00 AM",  by: "Manager" },
                { item: "Marinated Chicken Pecho", qty: "+15 kg", supplier: "Pantranco Goods Supply", ref: "PO-2024-029", date: "Jun 28, 10:00 AM", by: "Manager" },
                { item: "Vegetables",            qty: "+10 kg",   supplier: "Fresh Farm Distributors", ref: "PO-2024-030", date: "Jun 28, 9:30 AM",  by: "Manager" },
              ].map((r, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-sm font-semibold text-foreground">{r.item}</td>
                  <td className="px-4 py-2.5 text-sm font-bold text-green-600 font-mono">{r.qty}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.supplier}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground">{r.ref}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
