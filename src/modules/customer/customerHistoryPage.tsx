import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Loader2, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CustomerPage } from "./customerPageTypes";
import { customerErrorMessage } from "./customerBatch1";
import { customerMoneyCents } from "./customerFinancialDisplay";
import { CustomerRecordedCharges, formatCustomerCurrency } from "./customerRecordedCharges";
import { customerSnapshotModifierNames } from "./customerOrderItemPresentation";
import { formatCustomerOrderStatus, getCustomerOrderStatusPresentation } from "./components/CustomerStatusBadge";
interface CustomerOrderHistoryItemRow {
  order_id: string;
  item_name: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  modifiers: unknown;
}

interface CustomerOrderHistoryRow {
  id: string;
  order_number: string;
  grand_total: number | string;
  subtotal: number | string | null;
  delivery_fee: number | string | null;
  tax_amount: number | string | null;
  fulfillment_type: string;
  current_status: string;
  created_at: string;
  items: CustomerOrderHistoryItemRow[];
}

const isPastCustomerOrder = (order: CustomerOrderHistoryRow) =>
  ["delivered", "completed", "cancelled", "rejected"].includes(order.current_status);

// ── Order History ─────────────────────────────────────────────────
export function HistoryPage({
  nav,
  onNav,
  onTrackOrder,
}: {
  nav: ReactNode;
  onNav: (page: CustomerPage) => void;
  onTrackOrder: (orderId: string) => void;
}) {
  const [orders, setOrders] =
    useState<CustomerOrderHistoryRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

async function loadCustomerOrders() {
  setLoading(true);
  setErrorMessage(null);

  const {
    data: orderData,
    error: ordersError,
  } = await supabase
    .from("orders")
    .select(
      `
        id,
        order_number,
        subtotal,
        delivery_fee,
        tax_amount,
        grand_total,
        fulfillment_type,
        current_status,
        created_at
      `,
    )
    .order("created_at", {
      ascending: false,
    });

  if (!isMounted) {
    return;
  }

  if (ordersError) {
    console.error(
      "Unable to load customer orders:",
      ordersError,
    );

    setErrorMessage(customerErrorMessage(ordersError, "history"));

    setLoading(false);
    return;
  }

  const orderRows =
    (orderData ?? []) as Omit<
      CustomerOrderHistoryRow,
      "items"
    >[];

  if (orderRows.length === 0) {
    setOrders([]);
    setLoading(false);
    return;
  }

  const orderIds = orderRows.map(
    (order) => order.id,
  );

  const {
    data: itemData,
    error: itemsError,
  } = await supabase
    .from("order_items")
    .select(
      `
        order_id,
        item_name,
        quantity,
        unit_price,
        line_total,
        modifiers
      `,
    )
    .in("order_id", orderIds)
    .order("created_at", {
      ascending: true,
    });

  if (!isMounted) {
    return;
  }

  if (itemsError) {
    console.error(
      "Unable to load customer order items:",
      itemsError,
    );

    setErrorMessage(customerErrorMessage(itemsError, "history"));

    setLoading(false);
    return;
  }

  const itemRows =
    (itemData ??
      []) as CustomerOrderHistoryItemRow[];

  const itemsByOrder = new Map<
    string,
    CustomerOrderHistoryItemRow[]
  >();

  itemRows.forEach((item) => {
    const currentItems =
      itemsByOrder.get(item.order_id) ?? [];

    currentItems.push(item);

    itemsByOrder.set(
      item.order_id,
      currentItems,
    );
  });

  const ordersWithItems:
    CustomerOrderHistoryRow[] =
      orderRows.map((order) => ({
        ...order,
        items:
          itemsByOrder.get(order.id) ?? [],
      }));

  setOrders(ordersWithItems);
  setLoading(false);
}

    void loadCustomerOrders();

    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {nav}

      <div className="customer-storefront customer-history-screen flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-5 flex items-end justify-between gap-3 sm:mb-7">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Orders
              </h1>

            </div>

            {!loading && !errorMessage && orders.length > 0 ? (
              <span className="flex-none rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm">
                {orders.length} {orders.length === 1 ? "order" : "orders"}
              </span>
            ) : null}
          </div>

          {loading && (
            <div role="status" className="flex min-h-40 items-center justify-center rounded-2xl border border-border bg-card px-5 py-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </span>
                <div>
                  <p className="text-base font-bold text-foreground">Loading your orders…</p>
                </div>
              </div>
            </div>
          )}

          {!loading && errorMessage && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-base font-bold text-red-700">Unable to load orders</p>
              <p className="mt-1 max-w-xl text-sm leading-5 text-red-600">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="mt-4 min-h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !errorMessage && orders.length === 0 && (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/75 px-6 py-9 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-primary">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <h2 className="text-base font-extrabold text-foreground">No orders yet</h2>
              <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Orders you place will appear here with their current status.</p>
              <button
                type="button"
                onClick={() => onNav("menu")}
                className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-amber-800"
              >
                Browse the menu
              </button>
            </div>
          )}

          {!loading && !errorMessage && orders.length > 0 && (
            <div className="customer-history-groups">
              {[
                { title: "Current orders", rows: orders.filter((order) => !isPastCustomerOrder(order)) },
                { title: "Past orders", rows: orders.filter(isPastCustomerOrder) },
              ].filter((group) => group.rows.length > 0).map((group) => (
                <section key={group.title} aria-label={group.title}>
                  <h2>{group.title}</h2>
                  <div className="customer-history-list grid gap-3 sm:gap-4">
              {group.rows.map((order) => {
                const formattedDate = new Date(order.created_at).toLocaleString(
                  "en-PH",
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  },
                );
                const statusPresentation = getCustomerOrderStatusPresentation(
                  order.current_status,
                );
                const visibleItems = order.items.slice(0, 3);
                const remainingItems = order.items.slice(3);

                return (
                  <article
                    key={order.id}
                    className={`customer-history-order overflow-hidden rounded-2xl border ${statusPresentation.card}`}
                  >
                    <div className="customer-history-order-head grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-5 sm:p-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-base font-bold text-foreground">
                            {order.order_number}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-sm font-semibold ${statusPresentation.badge}`}>
                            {formatCustomerOrderStatus(order.current_status)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                          <p>{formattedDate}</p>
                          <p className="capitalize">{order.fulfillment_type.replace(/_/g, " ")}</p>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between gap-3 sm:block sm:text-right">
                        <p className="text-sm text-muted-foreground">Server-confirmed total</p>
                        <p className="text-xl font-bold tabular-nums text-foreground">
                          {customerMoneyCents(order.grand_total) === null ? "Unavailable" : formatCustomerCurrency(order.grand_total)}
                        </p>
                      </div>
                    </div>

                    <div className="customer-history-order-body grid border-t border-border px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-8">
                    <div className="min-w-0">
                      <p className="mb-3 text-sm font-semibold text-foreground">Items</p>
                      {order.items.length > 0 ? (
                        <div className="space-y-2">
                          {visibleItems.map((item, index) => (
                            <div key={`${item.order_id}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                              <span className="min-w-0 font-semibold text-foreground">
                                <span className="mr-1 font-black text-primary">{item.quantity}×</span>
                                {item.item_name ?? "Menu item"}
                                {customerSnapshotModifierNames(item.modifiers) ? <span className="block text-xs font-normal text-muted-foreground">{customerSnapshotModifierNames(item.modifiers)}</span> : null}
                              </span>
                              <span className="flex-none font-bold text-muted-foreground">
                                ₱{Number(item.line_total).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          ))}

                          {remainingItems.length > 0 ? (
                            <details className="group border-t border-border py-2">
                              <summary className="cursor-pointer text-sm font-bold text-primary marker:text-primary">
                                Show {remainingItems.length} more {remainingItems.length === 1 ? "item" : "items"}
                              </summary>
                              <div className="mt-2 space-y-2 border-t border-border pt-2">
                                {remainingItems.map((item, index) => (
                                  <div key={`${item.order_id}-more-${index}`} className="flex items-start justify-between gap-3 text-sm">
                                    <span className="min-w-0 font-semibold text-foreground"><span className="mr-1 font-black text-primary">{item.quantity}×</span>{item.item_name ?? "Menu item"}{customerSnapshotModifierNames(item.modifiers) ? <span className="block text-xs font-normal text-muted-foreground">{customerSnapshotModifierNames(item.modifiers)}</span> : null}</span>
                                    <span className="flex-none font-bold text-muted-foreground">₱{Number(item.line_total).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Item details are unavailable for this order.</p>
                      )}
                    </div>

                    <div className="customer-history-order-charges mt-4 border-t border-border pt-4 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      <CustomerRecordedCharges order={order} />
                    </div>
                    </div>

                    <div className="flex justify-end border-t border-border px-4 py-3 sm:px-5">
                      <button
                        type="button"
                        onClick={() => onTrackOrder(order.id)}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-amber-800 sm:w-auto"
                      >
                        View order
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
