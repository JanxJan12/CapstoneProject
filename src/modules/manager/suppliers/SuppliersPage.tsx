import { Plus, Edit2 } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import { suppliers } from "../../../data/mockData";

export function SuppliersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-foreground">Suppliers</h1>
        <Button variant="primary" size="sm"><Plus className="w-3 h-3" />Add Supplier</Button>
      </div>
      <Table headers={["Supplier", "Contact", "Address", "Items", "POs", "Actions"]}>
        {suppliers.map((s) => (
          <tr key={s.id} className="hover:bg-muted/30">
            <Td className="font-semibold text-xs">{s.name}</Td>
            <Td className="font-mono text-[10px]">{s.contact}</Td>
            <Td className="text-muted-foreground text-xs">{s.address}</Td>
            <Td className="text-xs">{s.items}</Td>
            <Td className="text-xs">{s.pos}</Td>
            <Td>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm">View</Button>
                <Button variant="ghost" size="sm"><Edit2 className="w-3 h-3" /></Button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
