import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import { customers } from "../../../data/mockData";

export function CustomersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-foreground">Customers</h1>
      </div>
      <Table headers={["Name", "Email", "Contact", "Orders", "Last Order", ""]}>
        {customers.map((c) => (
          <tr key={c.id} className="hover:bg-muted/30">
            <Td>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-[10px] font-bold text-primary">{c.name.charAt(0)}</span></div>
                <span className="text-xs font-semibold">{c.name}</span>
              </div>
            </Td>
            <Td className="text-muted-foreground text-xs">{c.email}</Td>
            <Td className="font-mono text-[10px]">{c.phone}</Td>
            <Td className="font-bold text-xs">{c.orders}</Td>
            <Td className="text-muted-foreground text-[10px]">{c.last}</Td>
            <Td><Button variant="ghost" size="sm">View Orders</Button></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
