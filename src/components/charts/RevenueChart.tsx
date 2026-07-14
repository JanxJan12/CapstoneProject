import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { salesData } from "../../data/mockData";

interface RevenueChartProps {
  height?: number;
}

export function RevenueChart({ height = 130 }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={salesData} margin={{ top: 2, right: 2, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v: number) => [`₱${v.toLocaleString()}`, "Sales"]}
          contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        {/* fillOpacity instead of a gradient URL — avoids SVG linearGradient ID collisions */}
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#dc2626"
          strokeWidth={2}
          fill="#dc2626"
          fillOpacity={0.08}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
