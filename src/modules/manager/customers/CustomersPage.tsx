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
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground">Customers</h1>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
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
      </div>

      <div className="relative mb-4 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or contact…"
          className="w-full rounded-lg border border-border bg-input-background py-2 pl-8 pr-3 text-xs focus:outline-none"
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <Table
        headers={[
          "Customer",
          "Contact",
          "Orders",
          "Last Order",
          "Account",
          "Registered",
        ]}
      >
        {loading ? (
          <tr>
            <td
              colSpan={6}
              className="px-4 py-10 text-center text-xs text-muted-foreground"
            >
              Loading registered customers…
            </td>
          </tr>
        ) : filteredCustomers.length === 0 ? (
          <tr>
            <td
              colSpan={6}
              className="px-4 py-10 text-center text-xs text-muted-foreground"
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
                  <span className="text-xs font-semibold">{customer.name}</span>
                </div>
              </Td>
              <Td className="font-mono text-[10px]">
                {customer.contactNumber ?? "—"}
              </Td>
              <Td className="text-xs font-bold">
                {customer.orderCount.toLocaleString("en-PH")}
              </Td>
              <Td className="text-[10px] text-muted-foreground">
                {customer.lastOrderAt
                  ? dateTimeFormatter.format(new Date(customer.lastOrderAt))
                  : "No linked orders"}
              </Td>
              <Td>
                <Badge variant={customer.isActive ? "success" : "neutral"}>
                  {customer.isActive ? "Active" : "Inactive"}
                </Badge>
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
