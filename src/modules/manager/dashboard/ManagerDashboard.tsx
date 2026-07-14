import { BarChart2, Plus, DollarSign, ShoppingCart, CreditCard, Package, Bike, Sparkles, Store } from "lucide-react";
import { Button }      from "../../../components/common/Button";
import { StatCard }    from "../../../components/common/StatCard";
import { StatusBadge } from "../../../components/common/Badge";
import { salesData, orderStatusData, allOrders, inventoryItems } from "../../../data/mockData";

function SparkAreaChart({ data }: { data: { day: string; sales: number }[] }) {
  const W = 500, H = 130, padL = 36, padR = 8, padT = 8, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.sales));
  const minVal = Math.min(...data.map((d) => d.sales));
  const range = maxVal - minVal || 1;
  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * innerW);
  const ys = data.map((d) => padT + innerH - ((d.sales - minVal) / range) * innerH);
  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const areaPath = `${linePath} L${xs[xs.length - 1]},${padT + innerH} L${xs[0]},${padT + innerH} Z`;
  const ticks = [minVal, (minVal + maxVal) / 2, maxVal];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: "visible" }}>
      {[0, 0.5, 1].map((t, i) => {
        const y = padT + innerH - t * innerH;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#f0f0f2" strokeDasharray="3 3" />
            <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
              ₱{(ticks[i] / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}
      {data.map((d, i) => (
        <text key={i} x={xs[i]} y={H - 4} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.day}</text>
      ))}
      <path d={areaPath} fill="#b45309" fillOpacity={0.08} />
      <path d={linePath} fill="none" stroke="#dc2626" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r={3} fill="#b45309" />
      ))}
    </svg>
  );
}

export function ManagerDashboard() {
  const totalStatusCount = orderStatusData.reduce((s, d) => s + d.value, 0);
  const today = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="manager-dashboard space-y-4">
      <section className="manager-welcome relative isolate overflow-hidden rounded-[22px] border border-white/10 bg-[#211711] px-5 py-5 text-white shadow-[0_24px_60px_rgba(48,29,17,0.16)] sm:px-6 sm:py-6">
        <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-12 h-28 w-28 rounded-full border border-white/[0.06] shadow-[0_0_0_32px_rgba(255,255,255,0.025),0_0_0_64px_rgba(255,255,255,0.015)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.19em] text-amber-300/80">
              <Sparkles className="h-3.5 w-3.5" /> Daily command center
            </div>
            <h1 className="font-['Fraunces'] text-[30px] font-bold leading-none tracking-[-0.035em] text-white sm:text-[36px]">
              Good day, Maria.
            </h1>
            <p className="mt-2.5 flex items-center gap-2 text-xs font-medium text-white/55">
              <Store className="h-3.5 w-3.5 text-amber-300/70" /> RRJ's Food-Haus · {today}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="border-white/15 bg-white/10 text-white shadow-none hover:bg-white/15 hover:text-white"><BarChart2 className="h-3.5 w-3.5" />Reports</Button>
            <Button variant="primary" size="sm"><Plus className="h-3.5 w-3.5" />Quick Add</Button>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Sales Today"       value="₱12,450" icon={DollarSign}  iconBg="bg-green-50"  iconColor="text-green-600"  sub="+12% vs yesterday" />
        <StatCard label="Orders Today"      value="47"       icon={ShoppingCart} iconBg="bg-blue-50"   iconColor="text-blue-600" />
        <StatCard label="Pending Payments"  value="3"        icon={CreditCard}   iconBg="bg-amber-50"  iconColor="text-amber-600"  sub="Needs review"   subColor="text-amber-600" />
        <StatCard label="Low Stock"         value="3 items"  icon={Package}      iconBg="bg-red-50"    iconColor="text-red-600"    sub="Needs restock"  subColor="text-red-500" />
        <StatCard label="Active Riders"     value="1 / 3"    icon={Bike}         iconBg="bg-violet-50" iconColor="text-violet-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rrj-card lg:col-span-2 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-extrabold text-foreground">Revenue trend</p>
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Sales performance across the week</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold text-emerald-700 ring-1 ring-emerald-200">+12.4%</span>
          </div>
          <SparkAreaChart data={salesData} />
        </div>

        {/* Orders by status — custom bars instead of recharts PieChart to avoid internal key conflicts */}
        <div className="rrj-card p-5">
          <p className="mb-1 text-sm font-extrabold text-foreground">Orders by status</p>
          <p className="mb-4 text-[10px] text-muted-foreground">Live kitchen and fulfillment mix</p>
          <div className="flex flex-col gap-2.5">
            {orderStatusData.map((d) => {
              const pct = Math.round((d.value / totalStatusCount) * 100);
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{d.value}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: d.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            {totalStatusCount} orders today
          </p>
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Recent orders */}
        <div className="rrj-card overflow-hidden">
          <div className="border-b border-border px-4 py-3.5">
            <p className="text-sm font-extrabold text-foreground">Recent orders</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Latest activity across all channels</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-muted/60">
                {["Order", "Customer", "Total", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allOrders.slice(0, 4).map((o) => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-[10px] font-bold text-primary">{o.id}</td>
                  <td className="px-3 py-2 text-xs">{o.customer}</td>
                  <td className="px-3 py-2 text-xs font-bold">₱{o.total}</td>
                  <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inventory alerts */}
        <div className="rrj-card overflow-hidden">
          <div className="border-b border-border px-4 py-3.5">
            <p className="text-sm font-extrabold text-foreground">Inventory alerts</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Items that need your attention</p>
          </div>
          {inventoryItems
            .filter((i) => i.status !== "healthy")
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.qty} {item.unit} — reorder at {item.reorder}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
