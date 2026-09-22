import { Plus, Edit2 } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import { prototypeSuppliers } from "../../../data/mockData";

/** Prototype reference only. This page is not part of operational Manager routing. */
export function PrototypeSuppliersPage() {
  return (
    <div>
      <div role="note" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <p className="font-bold">Prototype only</p>
        <p className="mt-1">Fixture data for design reference. No authoritative supplier records or database-write workflow is connected.</p>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-foreground">Suppliers</h1>
        <Button variant="primary" size="sm" disabled><Plus className="w-3 h-3" />Add Supplier</Button>
      </div>
      <Table headers={["Supplier", "Contact", "Address", "Items", "POs", "Actions"]}>
        {prototypeSuppliers.map((s) => (
          <tr key={s.id} className="hover:bg-muted/30">
            <Td className="font-semibold text-xs">{s.name}</Td>
            <Td className="font-mono text-[10px]">{s.contact}</Td>
            <Td className="text-muted-foreground text-xs">{s.address}</Td>
            <Td className="text-xs">{s.items}</Td>
            <Td className="text-xs">{s.pos}</Td>
            <Td>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" disabled>View</Button>
                <Button variant="ghost" size="sm" disabled><Edit2 className="w-3 h-3" /></Button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
