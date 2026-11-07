import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import {
  getManagerCustomers,
  type ManagerCustomer,
} from "../api/managerPhase2Api";

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function isAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("authentication required") ||
    message.includes("active manager access required") ||
    message.includes("permission denied") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("jwt expired")
  );
}

function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (isAccessError(error)) {
    return "Active Manager access is required to view customer records.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Customer records could not be reached. Check your connection and try again.";
  }

  return "Customer records could not be loaded. Try again.";
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<ManagerCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const loadCustomers = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const records = await getManagerCustomers();
      if (version === requestVersion.current) {
        setCustomers(records);
        setHasLoaded(true);
      }
    } catch (loadError) {
      if (version === requestVersion.current) {
        if (isAccessError(loadError)) {
          setCustomers([]);
          setHasLoaded(false);
        }
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return customers;
    }

    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(normalizedSearch) ||
        customer.contactNumber?.toLowerCase().includes(normalizedSearch),
    );
  }, [customers, search]);
  const hasResults = hasLoaded && filteredCustomers.length > 0;

  return (
    <div className="manager-customers min-w-0">
      <header className="manager-page-header mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="manager-page-context">
            Business Management / Customers
          </p>
          <h1 className="text-base font-bold text-foreground">Customers</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Read-only registered customer accounts and linked order totals
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => void loadCustomers()}
          loading={loading}
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </header>

      <div className="manager-customer-toolbar mb-4 rounded-xl border border-border bg-card p-3 sm:p-4">
        <label
          htmlFor="manager-customer-search"
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          Search customers
        </label>
        <div className="relative w-full sm:max-w-md">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="manager-customer-search"
            type="text"
            inputMode="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or contact…"
            className="min-h-11 w-full rounded-lg border border-border bg-input-background pl-10 pr-12 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear customer search"
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {hasLoaded ? (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            Showing {filteredCustomers.length.toLocaleString("en-PH")} of{" "}
            {customers.length.toLocaleString("en-PH")} loaded customer records
            {error ? " · Last refresh failed" : ""}.
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-semibold">
            {hasLoaded
              ? "Customer records could not be refreshed"
              : "Customer records could not be loaded"}
          </p>
          <p className="mt-1">{error}</p>
          {hasLoaded ? (
            <p className="mt-1">
              Previously loaded records remain visible and may be out of date.
            </p>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 min-h-11"
            onClick={() => void loadCustomers()}
            loading={loading}
          >
            Try Again
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {hasLoaded
            ? "Refreshing customer records…"
            : "Loading registered customers…"}
        </p>
      ) : null}

      {!loading && !error && hasLoaded && !hasResults ? (
        <div
          role="status"
          className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground"
        >
          <p className="font-semibold text-foreground">
            {customers.length === 0
              ? "No customer records"
              : "No matching customers"}
          </p>
          <p className="mt-1">
            {customers.length === 0
              ? "No registered customer records are available."
              : "Try another name or contact number, or clear the search."}
          </p>
          {customers.length > 0 && search ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 min-h-11"
              onClick={() => setSearch("")}
            >
              Clear Search
            </Button>
          ) : null}
        </div>
      ) : null}

      {hasResults ? (
        <ul className="space-y-3 xl:hidden" aria-label="Customer records">
          {filteredCustomers.map((customer) => (
            <li
              key={customer.id}
              className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-foreground">
                    {customer.name}
                  </p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {customer.contactNumber ?? "Contact not recorded"}
                  </p>
                </div>
                <div className="shrink-0">
                  <Badge variant={customer.isActive ? "success" : "neutral"}>
                    {customer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Orders</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">
                    {customer.orderCount.toLocaleString("en-PH")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Registered</dt>
                  <dd className="mt-0.5 text-foreground">
                    {dateTimeFormatter.format(new Date(customer.createdAt))}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Last order</dt>
                  <dd className="mt-0.5 text-foreground">
                    {customer.lastOrderAt
                      ? dateTimeFormatter.format(new Date(customer.lastOrderAt))
                      : "No linked orders"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : null}

      {hasResults ? (
        <div className="hidden min-w-0 xl:block">
          <Table
            headers={[
              "Customer",
              "Account",
              "Orders",
              "Last Order",
              "Registered",
            ]}
          >
            {filteredCustomers.map((customer) => (
              <tr key={customer.id} className="hover:bg-muted/30">
                <Td>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-[10px] font-bold text-primary">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-xs font-semibold">
                        {customer.name}
                      </p>
                      <p className="mt-0.5 break-words font-mono text-[10px] text-muted-foreground">
                        {customer.contactNumber ?? "Contact not recorded"}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge variant={customer.isActive ? "success" : "neutral"}>
                    {customer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-xs font-bold">
                  {customer.orderCount.toLocaleString("en-PH")}
                </Td>
                <Td className="text-xs text-foreground">
                  {customer.lastOrderAt
                    ? dateTimeFormatter.format(new Date(customer.lastOrderAt))
                    : "No linked orders"}
                </Td>
                <Td className="text-[10px] text-muted-foreground">
                  {dateTimeFormatter.format(new Date(customer.createdAt))}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </div>
  );
}
