import { FileText } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import { StatusBadge } from "../../../components/common/Badge";
import { invTransactions } from "../../../data/mockData";

export function InvTransactionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-foreground">Inventory Transactions</h1>
        <Button variant="secondary" size="sm"><FileText className="w-3 h-3" />Export</Button>
      </div>
      <Table headers={["Transaction ID", "Item", "Type", "Qty Change", "Related Ref.", "Date", "By"]}>
        {invTransactions.map((t) => (
          <tr key={t.id} className="hover:bg-muted/30">
            <Td><span className="font-mono text-[10px] text-muted-foreground">{t.id}</span></Td>
            <Td className="font-semibold text-xs">{t.item}</Td>
            <Td><StatusBadge status={t.type} /></Td>
            <Td className={`font-mono text-xs font-bold ${t.qty.startsWith("+") ? "text-green-600" : "text-red-600"}`}>{t.qty}</Td>
            <Td className="font-mono text-[10px] text-muted-foreground">{t.ref}</Td>
            <Td className="text-muted-foreground text-[10px]">{t.date}</Td>
            <Td className="text-muted-foreground text-xs">{t.by}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
