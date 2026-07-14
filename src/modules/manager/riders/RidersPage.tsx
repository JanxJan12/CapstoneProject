import { Bike, CheckCircle, Truck } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import { StatCard } from "../../../components/common/StatCard";
import { StatusBadge } from "../../../components/common/Badge";
import { riders } from "../../../data/mockData";

export function RidersPage() {
  const dotC: Record<string, string> = { available: "bg-green-500", on_delivery: "bg-blue-500", offline: "bg-zinc-400" };
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-foreground">Riders</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard label="Total Riders" value="3" icon={Bike} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label="Available" value="1" icon={CheckCircle} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatCard label="On Delivery" value="1" icon={Truck} iconBg="bg-violet-50" iconColor="text-violet-600" />
      </div>
      <Table headers={["Rider", "Contact", "Plate / Motor", "License", "Status", "Today", ""]}>
        {riders.map((r) => (
          <tr key={r.id} className="hover:bg-muted/30">
            <Td>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-[10px] font-bold text-primary">{r.name.charAt(0)}</span></div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${dotC[r.status]}`} />
                </div>
                <span className="text-xs font-semibold">{r.name}</span>
              </div>
            </Td>
            <Td className="font-mono text-[10px]">{r.phone}</Td>
            <Td className="text-[10px]"><div className="font-semibold">{r.plate}</div><div className="text-muted-foreground">{r.motor}</div></Td>
            <Td className="font-mono text-[10px]">{r.license}</Td>
            <Td><StatusBadge status={r.status} /></Td>
            <Td className="font-bold text-xs">{r.deliveries}</Td>
            <Td><Button variant="ghost" size="sm">View</Button></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
