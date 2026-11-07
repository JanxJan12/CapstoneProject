import { useCallback, useEffect, useRef, useState } from "react";
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

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  const manilaToday = `${part("year")}-${part("month")}-${part("day")}`;
  const [year, month, day] = manilaToday.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day - 6));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: manilaToday,
  };
}

type ReportRange = { startDate: string; endDate: string };

function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    message === "Start date must be a valid date." ||
    message === "End date must be a valid date." ||
    message === "End date must be on or after start date." ||
    message === "Report date range must not exceed 366 calendar days."
  )
    return message;
  if (
    message.includes("Active manager access required") ||
    message.includes("Authentication required")
  )
    return "Manager access is required to view this report.";
  return "The sales report could not be loaded. Check your connection or access, then retry.";
}

export function ReportsPage() {
  const [defaultDateRange] = useState(getDefaultDateRange);
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);
  const [report, setReport] = useState<ManagerSalesReport | null>(null);
  const [shownRange, setShownRange] = useState<ReportRange | null>(null);
  const [requestedRange, setRequestedRange] =
    useState<ReportRange>(defaultDateRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const loadReport = useCallback(async (start: string, end: string) => {
    const version = ++requestVersion.current;
    setRequestedRange({ startDate: start, endDate: end });
    setLoading(true);
    setError(null);
    setReport(null);
    setShownRange(null);

    try {
      const result = await getManagerSalesReport(start, end);
      if (version === requestVersion.current) {
        setReport(result);
        setShownRange({ startDate: start, endDate: end });
      }
    } catch (loadError) {
      if (version === requestVersion.current)
        setError(getErrorMessage(loadError));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(defaultDateRange.startDate, defaultDateRange.endDate);
    return () => {
      requestVersion.current += 1;
    };
  }, [defaultDateRange, loadReport]);

  const datesChanged =
    shownRange !== null &&
    (startDate !== shownRange.startDate || endDate !== shownRange.endDate);

  return (
    <div className="manager-reports min-w-0">
      <header className="manager-page-header mb-3">
        <p className="manager-page-context">Business Management / Reports</p>
        <h1 className="text-base font-bold text-foreground">Reports</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Verified-payment revenue from successfully fulfilled orders, grouped
          by fulfillment date.
        </p>
      </header>

      <div className="manager-report-toolbar mb-4 min-w-0 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarRange className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Report period
            </p>
            <p className="text-sm font-semibold text-foreground">
              fulfillment dates, inclusive
            </p>
          </div>
        </div>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="min-h-11 min-w-0 w-full rounded-lg border border-border bg-input-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="min-h-11 min-w-0 w-full rounded-lg border border-border bg-input-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <Button
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
            loading={loading}
            onClick={() => void loadReport(startDate, endDate)}
          >
            Apply dates
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {loading
            ? `Loading ${requestedRange.startDate} through ${requestedRange.endDate}…`
            : shownRange
              ? `Showing ${shownRange.startDate} through ${shownRange.endDate}.${datesChanged ? " Dates changed; apply to update the report." : ""}`
              : `Requested ${requestedRange.startDate} through ${requestedRange.endDate}; report unavailable.`}
        </p>
      </div>

      {loading && !report ? (
        <div
          className="rrj-card p-8 text-center text-sm text-muted-foreground"
          role="status"
        >
          Loading sales report…
        </div>
      ) : error && !report ? (
        <div
          className="rrj-card mb-4 flex flex-col items-start gap-3 p-5"
          role="alert"
        >
          <div>
            <p className="text-sm font-bold text-red-700">Report unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void loadReport(startDate, endDate)}
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        </div>
      ) : report ? (
        <>
          {report.totalOrders === 0 && (
            <p
              className="mb-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"
              role="status"
            >
              No successfully fulfilled orders were recorded for this period.
              The returned amounts and daily values are zero.
            </p>
          )}
          {report.totalOrders > 0 && report.totalRevenue === 0 && (
            <p
              className="mb-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"
              role="status"
            >
              Fulfilled orders were recorded, but no verified-payment revenue
              was returned for this period.
            </p>
          )}
          <p className="mb-2 text-sm font-semibold">
            Sales report for {shownRange?.startDate} through{" "}
            {shownRange?.endDate}
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            Fulfilled orders counts all successful fulfillments. Revenue and
            average include verified payments on fulfilled orders only; they may
            not move together.
          </p>
          <div className="manager-report-metrics mb-4 grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4 [&_.rrj-stat-card]:min-w-0 [&_.rrj-stat-card>p:last-child]:break-words [&_.rrj-stat-card>p:last-child]:leading-tight">
            <StatCard
              label="Verified-payment revenue"
              value={formatCurrency(report.totalRevenue)}
              icon={DollarSign}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <StatCard
              label="Fulfilled Orders"
              value={report.totalOrders.toLocaleString("en-PH")}
              icon={ShoppingCart}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              label="Avg. per verified order"
              value={formatCurrency(report.averageOrderValue)}
              icon={TrendingUp}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
            />
            <StatCard
              label="Top item by units"
              value={report.topItemName ?? "—"}
              icon={Tag}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
            />
          </div>

          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_8px_22px_rgba(67,42,23,0.035)]">
            <h2 className="text-sm font-bold">
              Daily verified-payment revenue
            </h2>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Grouped by fulfillment date. The server includes calendar
              days with zero recorded revenue.
            </p>
            {report.dailySales.length === 0 ? (
              <div
                className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground"
                role="status"
              >
                No daily sales data is available.
              </div>
            ) : (
              <div
                className="max-w-full overflow-x-auto"
                aria-label="Daily revenue chart; scroll horizontally for dates"
              >
                <div className="h-44 min-w-[440px]">
                  <ResponsiveContainer width="100%" height="100%">
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
                          "Verified-payment revenue",
                        ]}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.date ?? ""
                        }
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          maxWidth: "min(240px, calc(100vw - 48px))",
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
                </div>
              </div>
            )}
            {report.dailySales.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="min-h-11 cursor-pointer rounded-lg px-2 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  View daily values
                </summary>
                <div className="max-h-64 overflow-auto rounded-lg border border-border">
                  <table className="w-full min-w-[260px] text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left">
                          Date
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          Verified-payment revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.dailySales.map((day) => (
                        <tr key={day.date} className="border-t border-border">
                          <th
                            scope="row"
                            className="px-3 py-2 text-left font-normal"
                          >
                            {day.date}
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency(day.sales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
