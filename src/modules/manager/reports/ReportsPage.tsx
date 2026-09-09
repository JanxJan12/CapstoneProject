import { useCallback, useEffect, useState } from "react";
import {
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
    <div>
      <div className="mb-4">
        <h1 className="text-base font-bold text-foreground">Reports</h1>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Verified-payment revenue and order activity
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <label className="flex flex-col gap-1 text-[10px] font-semibold text-muted-foreground">
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-lg border border-border bg-input-background px-3 py-2 text-xs font-normal text-foreground focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold text-muted-foreground">
          End date
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-lg border border-border bg-input-background px-3 py-2 text-xs font-normal text-foreground focus:outline-none"
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

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-bold">Daily Sales Performance</p>
            <p className="mb-3 mt-0.5 text-[10px] text-muted-foreground">
              Every calendar day in the selected range, including zero-sales
              days
            </p>
            {report.dailySales.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                No daily sales data is available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={report.dailySales}
                  margin={{ top: 2, right: 2, left: -8, bottom: 0 }}
                  id="daily-sales-chart"
                >
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
                  <Bar dataKey="sales" fill="#b45309" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
