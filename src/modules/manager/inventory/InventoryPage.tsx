import { Plus, RefreshCw, Edit2, MoreHorizontal, CheckCircle, AlertCircle, Package } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Badge, StatusBadge } from "../../../components/common/Badge";
import { Table, Td } from "../../../components/common/Table";
import { StatCard } from "../../../components/common/StatCard";
import { inventoryItems } from "../../../data/mockData";

export function InventoryPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-foreground">Inventory</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><RefreshCw className="w-3 h-3" />Record</Button>
          <Button variant="primary" size="sm"><Plus className="w-3 h-3" />Add Item</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Items" value="10" icon={Package} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label="Healthy" value="5" icon={CheckCircle} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatCard label="Reorder Soon" value="2" icon={AlertCircle} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard label="Critical" value="3" icon={AlertCircle} iconBg="bg-red-50" iconColor="text-red-600" />
      </div>
      <Table headers={["Item Name", "Category", "Unit", "Quantity", "Reorder Level", "Status", "Last Updated", "Actions"]}>
        {inventoryItems.map((item) => (
          <tr key={item.id} className="hover:bg-muted/30">
            <Td className="font-semibold text-xs">{item.name}</Td>
            <Td><Badge>{item.category}</Badge></Td>
            <Td className="text-muted-foreground text-xs">{item.unit}</Td>
            <Td className={`font-bold text-xs ${item.status === "critical" ? "text-red-600" : item.status === "reorder-soon" ? "text-amber-600" : "text-foreground"}`}>{item.qty}</Td>
            <Td className="text-muted-foreground text-xs">{item.reorder} {item.unit}</Td>
            <Td><StatusBadge status={item.status} /></Td>
            <Td className="text-muted-foreground text-[10px]">{item.updated}</Td>
            <Td>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm"><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="sm"><MoreHorizontal className="w-3 h-3" /></Button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
