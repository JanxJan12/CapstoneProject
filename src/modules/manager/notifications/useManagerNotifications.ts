import { useCallback, useEffect, useRef, useState } from "react";
import { getManagerDashboard } from "../api/managerApi";
import { getManagerRiders } from "../api/managerPhase2Api";
import { getManagerStockSummary } from "../inventory/inventoryApi";
import { stockAlerts } from "../inventory/inventoryOverview";

export type ManagerNotificationPage = "orders" | "inventory" | "riders";

export interface ManagerNotification {
  id: string;
  title: string;
  message: string;
  page: ManagerNotificationPage;
  read: boolean;
}

type Notice = Omit<ManagerNotification, "read">;

function readAcknowledgements(managerId: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(`manager-notifications:${managerId}`) ?? "[]");
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function saveAcknowledgements(managerId: string, ids: string[]) {
  try {
    window.localStorage.setItem(`manager-notifications:${managerId}`, JSON.stringify(ids));
  } catch {
    // Notifications still work for the current page when storage is unavailable.
  }
}

export function useManagerNotifications(managerId: string | null) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const requestVersion = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!managerId || inFlight.current) return;
    inFlight.current = true;
    const version = ++requestVersion.current;
    const results = await Promise.allSettled([
      getManagerDashboard(),
      getManagerStockSummary(),
      getManagerRiders(),
    ]);
    if (version !== requestVersion.current) return;

    const next: Notice[] = [];
    const [dashboard, stocks, riders] = results;
    if (dashboard.status === "fulfilled" && dashboard.value.pendingPayments > 0) {
      const count = dashboard.value.pendingPayments;
      next.push({
        id: `payments:${count}`,
        title: "Payments need review",
        message: `${count} ${count === 1 ? "payment is" : "payments are"} awaiting verification. Open Orders to review.`,
        page: "orders",
      });
    }
    if (stocks.status === "fulfilled") {
      const low = stocks.value.filter((stock) => {
        const alerts = stockAlerts(stock);
        return alerts.includes("usable-out") || alerts.includes("low-usable");
      });
      if (low.length > 0) {
        next.push({
          id: `stock:${low.map((stock) => stock.id).sort().join(",")}`,
          title: "Low usable stock",
          message: `${low.length} ${low.length === 1 ? "item needs" : "items need"} stock attention. Open Stock Overview.`,
          page: "inventory",
        });
      }
    }
    if (riders.status === "fulfilled") {
      const pending = riders.value.filter((rider) => rider.approvalStatus === "pending");
      if (pending.length > 0) {
        next.push({
          id: `riders:${pending.map((rider) => rider.id).sort().join(",")}`,
          title: "Rider applications",
          message: `${pending.length} ${pending.length === 1 ? "application needs" : "applications need"} review. Open Riders.`,
          page: "riders",
        });
      }
    }
    setNotices((current) => [
      ...next,
      ...current.filter((notice) => {
        const source = notice.page === "orders" ? dashboard
          : notice.page === "inventory" ? stocks : riders;
        return source.status === "rejected";
      }),
    ]);
    setError(results.some((result) => result.status === "rejected"));
    inFlight.current = false;
  }, [managerId]);

  useEffect(() => {
    requestVersion.current += 1;
    inFlight.current = false;
    setNotices([]);
    setError(false);
    setAcknowledged(managerId ? readAcknowledgements(managerId) : []);
    if (!managerId) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      requestVersion.current += 1;
      inFlight.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [managerId, refresh]);

  const markRead = useCallback((ids: string[]) => {
    if (!managerId) return;
    setAcknowledged((current) => {
      const next = [...new Set([...current, ...ids])].slice(-100);
      saveAcknowledgements(managerId, next);
      return next;
    });
  }, [managerId]);

  return {
    notifications: notices.map((notice) => ({
      ...notice,
      read: acknowledged.includes(notice.id),
    })),
    error,
    refresh,
    markRead,
  };
}
