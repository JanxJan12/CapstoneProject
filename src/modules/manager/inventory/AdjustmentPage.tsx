import { useState } from "react";
import { CheckCircle, Sliders } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { inventoryItems } from "../../../data/mockData";

const REASONS = [
  "Physical count correction",
  "Damaged stock write-off",
  "Transfer to another branch",
  "System error correction",
  "Opening balance adjustment",
  "Other",
];

export function AdjustmentPage() {
  const [selectedItem, setSelectedItem] = useState("");
  const [adjType, setAdjType] = useState<"add" | "subtract">("add");
  const [qty, setQty]    = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote]  = useState("");
  const [saved, setSaved] = useState(false);

  const selectedInv = inventoryItems.find((i) => i.name === selectedItem);
  const newQty = selectedInv
    ? adjType === "add"
      ? selectedInv.qty + Number(qty || 0)
      : selectedInv.qty - Number(qty || 0)
    : 0;

  const handleSave = () => {
    if (!selectedItem || !qty || !reason) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSelectedItem(""); setQty(""); setReason(""); setNote("");
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
          <Sliders className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Inventory Adjustment</h1>
          <p className="text-xs text-muted-foreground">Correct stock quantities with a reason</p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-3 px-4 py-3 mb-5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Inventory adjustment recorded successfully.
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Inventory Item</label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 text-foreground"
            >
              <option value="">Select inventory item…</option>
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.name}>{i.name} — {i.qty} {i.unit}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Adjustment Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAdjType("add")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-all ${adjType === "add" ? "bg-green-600 text-white border-green-600" : "bg-white border-border text-muted-foreground hover:text-foreground"}`}
              >
                + Add
              </button>
              <button
                onClick={() => setAdjType("subtract")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-all ${adjType === "subtract" ? "bg-red-600 text-white border-red-600" : "bg-white border-border text-muted-foreground hover:text-foreground"}`}
              >
                − Subtract
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Quantity ({selectedInv?.unit || "units"})
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50"
            />
          </div>

          {selectedInv && qty && (
            <div className="col-span-2 flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg border border-border text-xs">
              <div className="flex gap-6">
                <div><span className="text-muted-foreground">Current:</span> <span className="font-bold">{selectedInv.qty} {selectedInv.unit}</span></div>
                <div><span className="text-muted-foreground">Change:</span> <span className={`font-bold ${adjType === "add" ? "text-green-600" : "text-red-600"}`}>{adjType === "add" ? "+" : "-"}{qty} {selectedInv.unit}</span></div>
                <div><span className="text-muted-foreground">New Stock:</span> <span className={`font-bold ${newQty < selectedInv.reorder ? "text-red-600" : "text-foreground"}`}>{newQty} {selectedInv.unit}</span></div>
              </div>
              {newQty < selectedInv.reorder && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Below Reorder Level</span>}
            </div>
          )}

          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Reason <span className="text-red-500">*</span></label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 text-foreground"
            >
              <option value="">Select reason…</option>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Additional details about this adjustment…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-border mt-2 justify-end">
          <Button variant="secondary" size="md" onClick={() => { setSelectedItem(""); setQty(""); setReason(""); }}>Reset</Button>
          <Button variant="primary" size="md" disabled={!selectedItem || !qty || !reason} onClick={handleSave}>
            <Sliders className="w-4 h-4" /> Save Adjustment
          </Button>
        </div>
      </div>
    </div>
  );
}
