import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load manager customers.";
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<ManagerCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setCustomers(await getManagerCustomers());
    } catch (loadError) {
      setCustomers([]);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
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

  return (
    <div className="manager-customers">
      <header className="manager-page-header mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground">Customers</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Read-only registered customer accounts and linked order totals
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadCustomers()}
          loading={loading}
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </header>

      <div className="manager-customer-toolbar mb-4 rounded-xl border border-border bg-card p-2.5">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or contact…"
            aria-label="Search customers by name or contact"
            className="min-h-10 w-full rounded-lg border border-border bg-input-background pl-9 pr-3 text-xs focus:border-primary/50 focus:outline-none"
          />
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <Table
        headers={["Customer", "Account", "Orders", "Last Order", "Registered"]}
      >
        {loading ? (
          <tr>
            <td
              colSpan={5}
              className="px-4 py-8 text-center text-xs text-muted-foreground"
            >
              Loading registered customers…
            </td>
          </tr>
        ) : filteredCustomers.length === 0 ? (
          <tr>
            <td
              colSpan={5}
              className="px-4 py-8 text-center text-xs text-muted-foreground"
            >
              {customers.length === 0
                ? "No registered customer accounts were returned by PostgreSQL."
                : "No customers match the current search."}
            </td>
          </tr>
        ) : (
          filteredCustomers.map((customer) => (
            <tr key={customer.id} className="hover:bg-muted/30">
              <Td>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-[10px] font-bold text-primary">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{customer.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
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
          ))
        )}
      </Table>
    </div>
  );
}
