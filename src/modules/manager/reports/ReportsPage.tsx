import { FileText, Clock, DollarSign, ShoppingCart, TrendingUp, Tag } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "../../../components/common/Button";
import { StatCard } from "../../../components/common/StatCard";
import { salesData } from "../../../data/mockData";

export function ReportsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-foreground">Reports</h1>
        <Button variant="secondary" size="sm"><FileText className="w-3 h-3" />Export</Button>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-lg text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />Jul 1 – Jul 4, 2024
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Revenue" value="₱80,600" icon={DollarSign} iconBg="bg-green-50" iconColor="text-green-600" sub="+8% this week" />
        <StatCard label="Total Orders" value="247" icon={ShoppingCart} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label="Avg. Order Value" value="₱266" icon={TrendingUp} iconBg="bg-violet-50" iconColor="text-violet-600" />
        <StatCard label="Top Item" value="Crispy Beef Tadyang" icon={Tag} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-xs font-bold mb-3">Daily Sales Performance</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={salesData} margin={{ top: 2, right: 2, left: -16, bottom: 0 }} id="daily-sales-chart">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [`₱${v.toLocaleString()}`, "Sales"]} contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Bar dataKey="sales" fill="#b45309" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
