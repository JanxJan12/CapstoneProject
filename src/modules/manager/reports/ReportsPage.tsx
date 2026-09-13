import { useCallback, useEffect, useState } from "react";
import {
  CalendarRange,
  DollarSign,
  RefreshCw,
  ShoppingCart,
  Tag,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "../../../components/common/Button";
import { StatCard } from "../../../components/common/StatCard";
import {
  getManagerSalesReport,
  type ManagerSalesReport,
} from "../api/managerApi";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 6);

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(today),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load the manager sales report.";
}

const DEFAULT_DATE_RANGE = getDefaultDateRange();

export function ReportsPage() {
  const [startDate, setStartDate] = useState(DEFAULT_DATE_RANGE.startDate);
  const [endDate, setEndDate] = useState(DEFAULT_DATE_RANGE.endDate);
  const [report, setReport] = useState<ManagerSalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (start: string, end: string) => {
    setLoading(true);
    setError(null);

    try {
      setReport(await getManagerSalesReport(start, end));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(DEFAULT_DATE_RANGE.startDate, DEFAULT_DATE_RANGE.endDate);
  }, [loadReport]);

  return (
    <div className="manager-reports">
      <header className="manager-page-header mb-3">
        <h1 className="text-base font-bold text-foreground">Reports</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Verified-payment revenue and order activity
        </p>
      </header>

      <div className="manager-report-toolbar mb-4 flex flex-wrap items-end gap-2.5 rounded-xl border border-border bg-card p-2.5">
        <div className="mr-1 flex min-h-10 items-center gap-2 border-border pr-2 sm:border-r">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarRange className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Report period
            </p>
            <p className="text-xs font-semibold text-foreground">
              Select dates, then apply
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2.5">
          <label className="flex min-w-[145px] flex-1 flex-col gap-1 text-[10px] font-semibold text-muted-foreground sm:max-w-[175px]">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="min-h-10 rounded-lg border border-border bg-input-background px-3 text-xs font-normal text-foreground focus:border-primary/50 focus:outline-none"
            />
          </label>
          <span className="hidden pb-3 text-xs text-muted-foreground sm:block">
            →
          </span>
          <label className="flex min-w-[145px] flex-1 flex-col gap-1 text-[10px] font-semibold text-muted-foreground sm:max-w-[175px]">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="min-h-10 rounded-lg border border-border bg-input-background px-3 text-xs font-normal text-foreground focus:border-primary/50 focus:outline-none"
            />
          </label>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            onClick={() => void loadReport(startDate, endDate)}
          >
            Apply
          </Button>
        </div>
      </div>

      {loading && !report ? (
        <div className="rrj-card p-8 text-center text-xs text-muted-foreground">
          Loading sales report…
        </div>
      ) : error && !report ? (
        <div className="rrj-card mb-4 flex flex-col items-start gap-3 p-5">
          <div>
            <p className="text-xs font-bold text-red-700">Report unavailable</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadReport(startDate, endDate)}
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        </div>
      ) : report ? (
        <>
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
              <span>{error}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadReport(startDate, endDate)}
              >
                Retry
              </Button>
            </div>
          )}

          <div className="manager-report-metrics mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={formatCurrency(report.totalRevenue)}
              icon={DollarSign}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <StatCard
              label="Total Orders"
              value={report.totalOrders.toLocaleString("en-PH")}
              icon={ShoppingCart}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              label="Avg. Order Value"
              value={formatCurrency(report.averageOrderValue)}
              icon={TrendingUp}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
            />
            <StatCard
              label="Top Item"
              value={report.topItemName ?? "—"}
              icon={Tag}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-[0_8px_22px_rgba(67,42,23,0.035)]">
            <p className="text-xs font-bold">Daily Sales Performance</p>
            <p className="mb-2.5 mt-0.5 text-[10px] text-muted-foreground">
              Every date stays on the timeline; zero-sales days remain at the
              baseline
            </p>
            {report.dailySales.length === 0 ? (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                No daily sales data is available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart
                  data={report.dailySales}
                  margin={{ top: 2, right: 2, left: -8, bottom: 0 }}
                  id="daily-sales-chart"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eadfd4" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "#68574a" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#68574a" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) =>
                      value >= 1000
                        ? `₱${(value / 1000).toFixed(0)}k`
                        : `₱${value.toFixed(0)}`
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      formatCurrency(value),
                      "Sales",
                    ]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date ?? ""
                    }
                    contentStyle={{
                      fontSize: 10,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                  <Bar
                    dataKey="sales"
                    fill="#b45309"
                    maxBarSize={34}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
