import { useState } from "react";
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Badge } from "../../../components/common/Badge";
import { Table, Td } from "../../../components/common/Table";
import { menuItems as initialMenuItems } from "../../../data/mockData";
import { MENU_CATEGORIES } from "../../../constants";

export function MenuManagementPage() {
  const [items, setItems] = useState(initialMenuItems);
  const [cat, setCat] = useState("All");
  const filtered = items.filter((i) => cat === "All" || i.category === cat);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-foreground">Menu Management</h1>
        <Button variant="primary" size="sm"><Plus className="w-3 h-3" />Add Item</Button>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input placeholder="Search menu…" className="w-full pl-8 pr-3 py-2 text-xs bg-input-background border border-border rounded-lg focus:outline-none" />
        </div>
        <div className="flex gap-0.5 p-0.5 bg-white border border-border rounded-lg overflow-x-auto">
          {MENU_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${cat === c ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>{c}</button>
          ))}
        </div>
      </div>
      <Table headers={["Item", "Category", "Price", "Availability", "Description", "Actions"]}>
        {filtered.map((item) => (
          <tr key={item.id} className="hover:bg-muted/30">
            <Td className="font-semibold text-xs">{item.name}</Td>
            <Td><Badge>{item.category}</Badge></Td>
            <Td className="font-semibold text-xs">₱{item.price}</Td>
            <Td>
              <button onClick={() => setItems(items.map((i) => i.id === item.id ? { ...i, available: !i.available } : i))} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.available ? "bg-green-50 border-green-200 text-green-700" : "bg-zinc-100 border-zinc-200 text-zinc-500"}`}>
                {item.available ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}{item.available ? "Available" : "Unavailable"}
              </button>
            </Td>
            <Td className="text-muted-foreground text-xs">{item.desc}</Td>
            <Td>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm"><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="sm"><Trash2 className="w-3 h-3 text-red-400" /></Button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
