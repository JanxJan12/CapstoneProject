import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { fetchCashierMenuItems } from "../api/menuApi";
import {
  fetchCashierOnlinePayments,
  type HydratedOnlinePayment,
} from "../api/onlinePaymentApi";
import {
  fetchOpenCashierShift,
  type OpenCashierShiftResult,
} from "../api/shiftApi";
import {
  fetchCurrentShiftCashierSales,
  type HydratedCashierSale,
} from "../api/cashierSaleHydrationApi";
import { fetchCashierOrders } from "../services/supabaseOrderService";
import { OPTIMISTIC_DELAY_MS } from "../constants";
import { clearPOSDraft } from "../pos/posPersistence";
import { calculateShiftTotals } from "../services/cashierService";
import type { CashierState, Payment, ShiftTotals } from "../types";
import { loadCashierState, saveCashierState } from "./cashierPersistence";
import type {
  CashierCommit,
  CashierStoreValue,
  OptimisticCommit,
} from "./cashierStoreTypes";
import { useCashierActions } from "./useCashierActions";

const EMPTY_SHIFT_TOTALS: ShiftTotals = {
  cashSales: 0,
  gcashSales: 0,
  refunds: 0,
  cashRefunds: 0,
  voids: 0,
  discounts: 0,
  transactionCount: 0,
  ordersProcessed: 0,
  expectedCash: 0,
};

const CashierStore = createContext<CashierStoreValue | null>(null);

function mergePaymentMetadata(
  existing: Payment,
  incoming: Payment,
): Payment {
  return {
    ...existing,
    ...incoming,
    referenceNumber:
      incoming.referenceNumber ?? existing.referenceNumber,
    proofLabel:
      incoming.proofLabel ?? existing.proofLabel,
    proofUrl:
      incoming.proofUrl ?? existing.proofUrl,
    proofImagePath:
      incoming.proofImagePath ?? existing.proofImagePath,
    senderName:
      incoming.senderName ?? existing.senderName,
    receiverName:
      incoming.receiverName ?? existing.receiverName,
    uploadedBy:
      incoming.uploadedBy ?? existing.uploadedBy,
    updatedAt:
      incoming.updatedAt ?? existing.updatedAt,
  };
}

function mergeAuthoritativePayments(
  hydratedSales: HydratedCashierSale[],
  onlinePayments: HydratedOnlinePayment[],
): Payment[] {
  const paymentsById = new Map<string, Payment>();
  const paymentIdByOrderId = new Map<string, string>();

  const mergePayment = (payment: Payment) => {
    const existingById = paymentsById.get(payment.id);
    const existingPaymentId = paymentIdByOrderId.get(
      payment.orderId,
    );

    if (
      existingById &&
      existingById.orderId !== payment.orderId
    ) {
      throw new Error(
        "Authoritative cashier payment sources returned one payment ID for different orders.",
      );
    }

    if (
      existingPaymentId &&
      existingPaymentId !== payment.id
    ) {
      throw new Error(
        "Authoritative cashier payment sources returned multiple payment IDs for one order.",
      );
    }

    paymentsById.set(
      payment.id,
      existingById
        ? mergePaymentMetadata(existingById, payment)
        : payment,
    );
    paymentIdByOrderId.set(payment.orderId, payment.id);
  };

  for (const sale of hydratedSales) {
    mergePayment(sale.payment);
  }

  // Online hydration is applied second so its proof/reference metadata wins.
  for (const { payment } of onlinePayments) {
    mergePayment(payment);
  }

  return [...paymentsById.values()];
}

function mergeDatabaseRefresh(
  current: CashierState,
  databaseOrders: CashierState["orders"],
  hydratedSales: HydratedCashierSale[],
  onlinePayments: HydratedOnlinePayment[],
  openShift: OpenCashierShiftResult | null,
  cashierName: string,
): CashierState {
  if (!openShift && hydratedSales.length) {
    throw new Error(
      "Current-shift sales were returned without an open cashier shift.",
    );
  }

  const salesByDatabaseOrderId = new Map<
    string,
    HydratedCashierSale
  >();

  for (const sale of hydratedSales) {
    const databaseOrderId = sale.order.databaseId;

    if (!databaseOrderId) {
      throw new Error(
        "A hydrated cashier sale did not include its database order ID.",
      );
    }

    if (
      openShift &&
      sale.transaction.shiftId !== openShift.id
    ) {
      throw new Error(
        "A hydrated cashier sale did not belong to the recovered open shift.",
      );
    }

    salesByDatabaseOrderId.set(
      databaseOrderId,
      sale,
    );
  }

  const onlinePaymentsByDatabaseOrderId = new Map(
    onlinePayments.map((onlinePayment) => [
      onlinePayment.databaseOrderId,
      onlinePayment.payment,
    ]),
  );

  const enrichedDatabaseOrders = databaseOrders.map((order) => {
    const databaseOrderId = order.databaseId;
    const hydratedOrder = databaseOrderId
      ? salesByDatabaseOrderId.get(databaseOrderId)?.order
      : undefined;
    const authoritativeOrder = hydratedOrder ?? order;
    const onlinePayment = databaseOrderId
      ? onlinePaymentsByDatabaseOrderId.get(databaseOrderId)
      : undefined;

    if (!onlinePayment) {
      return authoritativeOrder;
    }

    if (onlinePayment.orderId !== order.id) {
      throw new Error(
        "An online payment did not match its database order number.",
      );
    }

    return {
      ...authoritativeOrder,
      paymentId: onlinePayment.id,
      paymentMethod: onlinePayment.method,
      paymentStatus: onlinePayment.status,
    };
  });

  const databaseOrderIds = new Set(
    databaseOrders.flatMap((order) =>
      order.databaseId ? [order.databaseId] : [],
    ),
  );

  const missingHydratedOrders = [
    ...salesByDatabaseOrderId.entries(),
  ]
    .filter(
      ([databaseOrderId]) =>
        !databaseOrderIds.has(databaseOrderId),
    )
    .map(([, sale]) => sale.order);

  const authoritativeOrderNumbers = new Set(
    [
      ...enrichedDatabaseOrders,
      ...missingHydratedOrders,
    ].map((order) => order.id),
  );

  const localOnlyOrders = current.orders.filter(
    (order) =>
      !order.databaseId &&
      !authoritativeOrderNumbers.has(order.id),
  );

  const authoritativePayments = mergeAuthoritativePayments(
    hydratedSales,
    onlinePayments,
  );
  const authoritativePaymentIds = new Set(
    authoritativePayments.map((payment) => payment.id),
  );
  const authoritativePaymentOrderIds = new Set(
    authoritativePayments.map((payment) => payment.orderId),
  );

  const databaseOrdersNeedingPayment = new Set(
    databaseOrders
      .filter((order) =>
        ["Pending", "Unpaid"].includes(order.paymentStatus),
      )
      .map((order) => order.id),
  );

  const cachedClosedShifts = current.shifts.filter(
    (shift) => shift.status !== "Open",
  );

  return {
    ...current,
    orders: [
      ...enrichedDatabaseOrders,
      ...missingHydratedOrders,
      ...localOnlyOrders,
    ],
    payments: [
      ...authoritativePayments,
      ...current.payments.filter(
        (payment) =>
          !authoritativePaymentIds.has(payment.id) &&
          !authoritativePaymentOrderIds.has(payment.orderId) &&
          !databaseOrdersNeedingPayment.has(payment.orderId),
      ),
    ],
    transactions: openShift
      ? [
          ...hydratedSales.map(
            (sale) => sale.transaction,
          ),
          ...current.transactions.filter(
            (transaction) =>
              transaction.shiftId !== openShift.id,
          ),
        ]
      : current.transactions,
    shifts: openShift
      ? [
          {
            id: openShift.id,
            cashierId: openShift.cashierId,
            cashierName,
            terminal: openShift.terminal,
            openingCash: openShift.openingCash,
            startedAt: openShift.startedAt,
            status: "Open",
          },
          ...cachedClosedShifts,
        ]
      : cachedClosedShifts,
  };
}

export function CashierProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();

  const [state, setState] = useState<CashierState>(loadCashierState);
  const [isHydrating, setIsHydrating] = useState(true);
  const [databaseLoading, setDatabaseLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState("");
  const [databaseRefreshRequest, setDatabaseRefreshRequest] = useState(0);
  const hydratedCashierIdRef = useRef<string | undefined>(undefined);
  const stateRef = useRef(state);

  const commit = useCallback<CashierCommit>((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    if (!session || session.role !== "cashier") {
      return;
    }

    const current = stateRef.current;
    const cashierChanged =
      current.cashier.id !== session.id;

    if (
      !cashierChanged &&
      current.cashier.name === session.name
    ) {
      return;
    }

    if (cashierChanged) {
      clearPOSDraft();
    }

    commit({
      ...current,
      cashier: {
        ...current.cashier,
        id: session.id,
        name: session.name,
      },
      heldOrders: cashierChanged
        ? []
        : current.heldOrders,
      notifications: cashierChanged
        ? []
        : current.notifications,
    });
  }, [commit, session]);

  const commitOptimistically = useCallback<OptimisticCommit>(
    async (next, previous, milliseconds = OPTIMISTIC_DELAY_MS.default) => {
      commit(next);
      try {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, milliseconds),
        );
      } catch (error) {
        if (stateRef.current === next) commit(previous);
        throw error;
      }
    },
    [commit],
  );

  const actions = useCashierActions(stateRef, commit, commitOptimistically);
  const refreshDatabaseState = useCallback(() => {
    setDatabaseRefreshRequest((current) => current + 1);
  }, []);

  useEffect(() => {
    stateRef.current = state;
    saveCashierState(state);
  }, [state]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!session || session.role !== "cashier") {
      hydratedCashierIdRef.current = undefined;
      setIsHydrating(false);
      setDatabaseLoading(false);
      setDatabaseError("");
      return;
    }

    let cancelled = false;
    let latestRefreshId = 0;

    if (hydratedCashierIdRef.current !== session.id) {
      setIsHydrating(true);
    }

    setDatabaseLoading(true);
    setDatabaseError("");

    const loadDatabaseState = async () => {
      const refreshId = ++latestRefreshId;

      try {
        const [
          databaseOrders,
          hydratedSales,
          onlinePayments,
          openShift,
          menuItems,
        ] = await Promise.all([
          fetchCashierOrders(),
          fetchCurrentShiftCashierSales(
            session.name,
          ),
          fetchCashierOnlinePayments(),
          fetchOpenCashierShift(),
          fetchCashierMenuItems(),
        ]);

        if (
          cancelled ||
          refreshId !== latestRefreshId
        ) {
          return;
        }

        commit({
          ...mergeDatabaseRefresh(
            stateRef.current,
            databaseOrders,
            hydratedSales,
            onlinePayments,
            openShift,
            session.name,
          ),
          menuItems,
        });
        setDatabaseError("");
      } catch (error) {
        if (cancelled || refreshId !== latestRefreshId) return;

        console.error(
          "Unable to refresh PostgreSQL cashier state:",
          error,
        );

        setDatabaseError(
          "Unable to load cashier operations. Please try again.",
        );
      } finally {
        if (cancelled || refreshId !== latestRefreshId) return;

        hydratedCashierIdRef.current = session.id;
        setDatabaseLoading(false);
        setIsHydrating(false);
      }
    };

    void loadDatabaseState();

    const channel = supabase
      .channel("cashier-orders-live")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        () => {
          void loadDatabaseState();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        () => {
          void loadDatabaseState();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_status_history",
        },
        () => {
          void loadDatabaseState();
        },
      )
      .subscribe((status, error) => {
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.error(
            "Cashier order realtime error:",
            status,
            error,
          );

          if (!cancelled) {
            setDatabaseError(
              "Cashier live updates are unavailable. Please try again.",
            );
          }
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [authLoading, commit, databaseRefreshRequest, session]);

  const activeShift = useMemo(
    () => state.shifts.find((entry) => entry.status === "Open"),
    [state.shifts],
  );
  const shiftTotals = useMemo(
    () =>
      activeShift
        ? calculateShiftTotals(state, activeShift.id)
        : EMPTY_SHIFT_TOTALS,
    [activeShift, state],
  );

  const value = useMemo<CashierStoreValue>(
    () => ({
      state,
      isHydrating,
      databaseLoading,
      databaseError,
      refreshDatabaseState,
      activeShift,
      shiftTotals,
      ...actions,
    }),
    [
      actions,
      activeShift,
      databaseError,
      databaseLoading,
      isHydrating,
      refreshDatabaseState,
      shiftTotals,
      state,
    ],
  );

  return (
    <CashierStore.Provider value={value}>{children}</CashierStore.Provider>
  );
}

export function useCashierStore() {
  const value = useContext(CashierStore);
  if (!value) {
    throw new Error("useCashierStore must be used inside CashierProvider");
  }
  return value;
}
