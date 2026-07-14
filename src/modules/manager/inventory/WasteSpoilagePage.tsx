import { useState } from "react";
import { CheckCircle, Trash2 } from "lucide-react";
import { Button }          from "../../../components/common/Button";
import { StatusBadge }     from "../../../components/common/Badge";
import { inventoryItems }  from "../../../data/mockData";

type RecordType = "waste" | "spoilage";

const WASTE_REASONS   = ["Cooking error", "Spillage", "Over-preparation", "Expired", "Other"];
const SPOILAGE_REASONS = ["Improper storage", "Power outage", "Past shelf life", "Contamination", "Other"];

export function WasteSpoilagePage() {
  const [type, setType]           = useState<RecordType>("waste");
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty]             = useState("");
  const [reason, setReason]       = useState("");
  const [note, setNote]           = useState("");
  const [saved, setSaved]         = useState(false);

  const selectedInv = inventoryItems.find((i) => i.name === selectedItem);

  const handleSave = () => {
    if (!selectedItem || !qty || !reason) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSelectedItem(""); setQty(""); setReason(""); setNote("");
  };

  const reasons = type === "waste" ? WASTE_REASONS : SPOILAGE_REASONS;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
          <Trash2 className="w-4 h-4 text-red-600" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Waste & Spoilage Recording</h1>
          <p className="text-xs text-muted-foreground">Log inventory losses due to waste or spoilage</p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-3 px-4 py-3 mb-5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {type === "waste" ? "Waste" : "Spoilage"} record saved. Inventory updated.
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-6">
        {/* Type toggle */}
        <div className="flex gap-2 mb-5 p-1 bg-muted/60 rounded-xl w-fit">
          {(["waste", "spoilage"] as RecordType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setReason(""); }}
              className={[
                "px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all",
                type === t ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>

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
            <label className="text-xs font-semibold text-foreground">
              Quantity Lost ({selectedInv?.unit || "units"})
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Date & Time</label>
            <input
              type="datetime-local"
              defaultValue={new Date().toISOString().slice(0, 16)}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 text-foreground"
            />
          </div>

          {selectedInv && qty && (
            <div className="col-span-2 flex items-center gap-6 px-4 py-3 bg-red-50/60 rounded-lg border border-red-200 text-xs">
              <div><span className="text-muted-foreground">Current:</span> <span className="font-bold">{selectedInv.qty} {selectedInv.unit}</span></div>
              <div><span className="text-muted-foreground">Loss:</span> <span className="font-bold text-red-600">−{qty} {selectedInv.unit}</span></div>
              <div><span className="text-muted-foreground">Remaining:</span> <span className={`font-bold ${selectedInv.qty - Number(qty) < selectedInv.reorder ? "text-red-600" : "text-foreground"}`}>{selectedInv.qty - Number(qty)} {selectedInv.unit}</span></div>
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
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Describe the circumstances…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-border mt-2 justify-end">
          <Button variant="secondary" size="md" onClick={() => { setSelectedItem(""); setQty(""); setReason(""); }}>Reset</Button>
          <Button variant="danger" size="md" disabled={!selectedItem || !qty || !reason} onClick={handleSave}>
            <Trash2 className="w-4 h-4" /> Record {type === "waste" ? "Waste" : "Spoilage"}
          </Button>
        </div>
      </div>

      {/* Recent records */}
      <div className="mt-6">
        <p className="text-sm font-bold text-foreground mb-3">Recent Waste & Spoilage Records</p>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                {["Item", "Type", "Qty Lost", "Reason", "Date", "Recorded By"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { item: "Cooking Oil", type: "waste",    qty: "-1.5 liters", reason: "Spillage",           date: "Jul 3, 6:00 PM",  by: "Kitchen Staff" },
                { item: "Vegetables",  type: "spoilage", qty: "-3 kg",       reason: "Past shelf life",    date: "Jul 3, 5:30 PM",  by: "Kitchen Staff" },
                { item: "Garlic",      type: "spoilage", qty: "-1 kg",       reason: "Improper storage",   date: "Jul 2, 2:00 PM",  by: "Manager" },
                { item: "Flour",       type: "waste",    qty: "-0.5 kg",     reason: "Over-preparation",   date: "Jul 1, 11:00 AM", by: "Kitchen Staff" },
              ].map((r, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-sm font-semibold">{r.item}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={r.type} /></td>
                  <td className="px-4 py-2.5 text-sm font-bold text-red-600 font-mono">{r.qty}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.reason}</td>
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
