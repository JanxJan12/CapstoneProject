import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  Package,
  RefreshCw,
  Bike,
  Users,
  BarChart2,
  Settings,
  ArrowDownToLine,
  Sliders,
  Trash2,
  ClipboardList,
  CalendarClock,
  Wrench,
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { NavGroup } from "../../types";
import type { InventoryWorkspacePage } from "./inventory/InventoryWorkspaceNav";
import { useManagerNotifications } from "./notifications/useManagerNotifications";

const ManagerDashboard = lazy(() =>
  import("./dashboard/ManagerDashboard").then((module) => ({
    default: module.ManagerDashboard,
  })),
);

const OrdersPage = lazy(() =>
  import("./orders/OrdersPage").then((module) => ({
    default: module.OrdersPage,
  })),
);

const MenuManagementPage = lazy(() =>
  import("./menu/MenuManagementPage").then((module) => ({
    default: module.MenuManagementPage,
  })),
);

const InventoryPage = lazy(() =>
  import("./inventory/InventoryPage").then((module) => ({
    default: module.InventoryPage,
  })),
);

const InventoryItemDetail = lazy(() =>
  import("./inventory/InventoryItemDetail").then((module) => ({
    default: module.InventoryItemDetail,
  })),
);

const InventoryAuditPage = lazy(() =>
  import("./inventory/InventoryAuditPage").then((module) => ({
    default: module.InventoryAuditPage,
  })),
);

const InvTransactionsPage = lazy(() =>
  import("./inventory/InvTransactionsPage").then((module) => ({
    default: module.InvTransactionsPage,
  })),
);

const StockReceivingPage = lazy(() =>
  import("./inventory/StockReceivingPage").then((module) => ({
    default: module.StockReceivingPage,
  })),
);

const ManagerRequestsPage = lazy(() =>
  import("./inventory/ManagerRequestsPage").then((module) => ({
    default: module.ManagerRequestsPage,
  })),
);

const AdjustmentPage = lazy(() =>
  import("./inventory/AdjustmentPage").then((module) => ({
    default: module.AdjustmentPage,
  })),
);

const WasteSpoilagePage = lazy(() =>
  import("./inventory/WasteSpoilagePage").then((module) => ({
    default: module.WasteSpoilagePage,
  })),
);

const RidersPage = lazy(() =>
  import("./riders/RidersPage").then((module) => ({
    default: module.RidersPage,
  })),
);

const CustomersPage = lazy(() =>
  import("./customers/CustomersPage").then((module) => ({
    default: module.CustomersPage,
  })),
);

const ReportsPage = lazy(() =>
  import("./reports/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);
const ClosedShiftHistory = lazy(() =>
  import("../cashier/shifts/ClosedShiftHistory").then((module) => ({
    default: module.ClosedShiftHistory,
  })),
);

const SettingsPage = lazy(() =>
  import("./settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

type ManagerPage =
  | "dashboard"
  | "orders"
  | "menu"
  | "inventory"
  | "inventory-item"
  | "replenishment"
  | "inventory-audit"
  | "inv-transactions"
  | "stock-receiving"
  | "adjustment"
  | "waste-spoilage"
  | "riders"
  | "customers"
  | "reports"
  | "shift-audit"
  | "settings";

export const MANAGER_NAV_GROUPS: NavGroup<ManagerPage>[] = [
  {
    label: "Dashboard",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Restaurant Operations",
    collapsible: true,
    icon: ShoppingCart,
    items: [
      { id: "orders", label: "Orders", icon: ShoppingCart },
      { id: "menu", label: "Menu Management", icon: BookOpen },
    ],
  },
  {
    label: "Inventory & Supply",
    icon: Package,
    collapsible: true,
    items: [
      {
        id: "inventory",
        label: "Stock Overview",
        icon: Package,
      },
      {
        id: "replenishment",
        label: "Inventory Requests",
        icon: ClipboardList,
      },
      {
        id: "stock-receiving",
        label: "Receiving",
        icon: ArrowDownToLine,
      },
    ],
    subgroups: [
      {
        label: "Inventory Tools",
        icon: Wrench,
        items: [
          { id: "inv-transactions", label: "Stock Movements", icon: RefreshCw },
          { id: "waste-spoilage", label: "Waste & Spoilage", icon: Trash2 },
          { id: "adjustment", label: "Adjustments", icon: Sliders },
          {
            id: "inventory-audit",
            label: "Inventory Audit",
            icon: ClipboardList,
          },
        ],
      },
    ],
  },
  {
    label: "Business Management",
    collapsible: true,
    icon: BarChart2,
    items: [
      { id: "riders", label: "Riders", icon: Bike },
      { id: "customers", label: "Customers", icon: Users },
      { id: "reports", label: "Reports", icon: BarChart2 },
      { id: "shift-audit", label: "Shift Audit", icon: CalendarClock },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const managerPages = new Set<ManagerPage>([
  ...MANAGER_NAV_GROUPS.flatMap((group) => [
    ...group.items.map((item) => item.id),
    ...(group.subgroups?.flatMap((subgroup) =>
      subgroup.items.map((item) => item.id),
    ) ?? []),
  ]),
  "inventory-item",
]);

function pageFromUrl(): ManagerPage {
  const value = new URLSearchParams(window.location.search).get("view");
  return value && managerPages.has(value as ManagerPage)
    ? (value as ManagerPage)
    : "dashboard";
}

function ManagerPageLoader() {
  return (
    <div
      role="status"
      className="flex min-h-64 items-center justify-center rounded-xl border border-border bg-card p-6 text-center"
    >
      <div>
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />

        <p className="mt-4 text-sm font-bold text-foreground">
          Loading manager workspace…
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Your data will appear as soon as this page is ready.
        </p>
      </div>
    </div>
  );
}

export function ManagerApp() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const managerNotifications = useManagerNotifications(
    session?.role === "manager" ? session.id : null,
  );
  const [page, setPageState] = useState<ManagerPage>(pageFromUrl);
  const [itemContext, setItemContext] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("item"),
  );
  const [itemOrigin, setItemOrigin] = useState<"audit" | null>(() =>
    new URLSearchParams(window.location.search).get("origin") === "audit"
      ? "audit"
      : null,
  );
  const [receivingReportId, setReceivingReportId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("report"),
  );
  const [movementReceiptRef, setMovementReceiptRef] = useState(
    () => new URLSearchParams(window.location.search).get("receiptRef") ?? "",
  );
  const [receivingSearch, setReceivingSearch] = useState(
    () => new URLSearchParams(window.location.search).get("receiptSearch") ?? "",
  );
  const [requestDocumentId, setRequestDocumentId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("request"),
  );
  const [requestHistory, setRequestHistory] = useState(
    () =>
      new URLSearchParams(window.location.search).get("requests") !== "sheet",
  );
  const requestDraftDirtyRef = useRef(false);
  const acceptedUrlRef = useRef(window.location.href);
  const [pendingLeave, setPendingLeave] = useState<{ run: () => void } | null>(null);
  const onRequestDirtyChange = useCallback((dirty: boolean) => {
    requestDraftDirtyRef.current = dirty;
  }, []);
  const leaveWithGuard = (run: () => void) => {
    if (page === "replenishment" && requestDraftDirtyRef.current) {
      setPendingLeave({ run });
      return;
    }
    run();
  };

  const setPage = (target: ManagerPage) => {
    if (target !== "inv-transactions") setMovementReceiptRef("");
    if (target !== "stock-receiving") setReceivingSearch("");
    if (
      ![
        "inventory-item",
        "inv-transactions",
        "adjustment",
        "waste-spoilage",
      ].includes(target)
    ) {
      setItemOrigin(null);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("view", target);
    url.searchParams.delete("item");
    url.searchParams.delete("report");
    url.searchParams.delete("request");
    url.searchParams.delete("requests");
    url.searchParams.delete("origin");
    if (target !== "inv-transactions") url.searchParams.delete("receiptRef");
    if (target !== "stock-receiving") url.searchParams.delete("receiptSearch");
    if (
      target !== "inventory-audit" &&
      target !== "inventory-item" &&
      target !== "inv-transactions"
    ) {
      url.searchParams.delete("audit");
    }
    window.history.pushState(null, "", url);
    setRequestHistory(target === "replenishment");
    setPageState(target);
  };

  useEffect(() => {
    const restorePage = () => {
      const attemptedUrl = window.location.href;
      if (requestDraftDirtyRef.current &&
          new URL(acceptedUrlRef.current).searchParams.get("view") === "replenishment" &&
          pageFromUrl() !== "replenishment") {
        window.history.pushState(null, "", acceptedUrlRef.current);
        setPendingLeave({ run: () => {
          window.history.replaceState(null, "", attemptedUrl);
          restorePage();
        } });
        return;
      }
      setPageState(pageFromUrl());
      const params = new URLSearchParams(window.location.search);
      setItemContext(params.get("item"));
      setItemOrigin(params.get("origin") === "audit" ? "audit" : null);
      setReceivingReportId(params.get("report"));
      setMovementReceiptRef(params.get("receiptRef") ?? "");
      setReceivingSearch(params.get("receiptSearch") ?? "");
      setRequestDocumentId(params.get("request"));
      setRequestHistory(params.get("requests") !== "sheet");
    };
    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (
      itemContext &&
      [
        "inventory-item",
        "inv-transactions",
        "stock-receiving",
        "replenishment",
        "adjustment",
        "waste-spoilage",
      ].includes(page)
    ) {
      url.searchParams.set("item", itemContext);
    } else {
      url.searchParams.delete("item");
    }
    if (
      itemContext &&
      itemOrigin === "audit" &&
      [
        "inventory-item",
        "inv-transactions",
        "adjustment",
        "waste-spoilage",
      ].includes(page)
    ) {
      url.searchParams.set("origin", "audit");
    } else {
      url.searchParams.delete("origin");
    }
    if (page === "stock-receiving" && receivingReportId) {
      url.searchParams.set("report", receivingReportId);
    } else {
      url.searchParams.delete("report");
    }
    if (page === "inv-transactions" && movementReceiptRef) url.searchParams.set("receiptRef", movementReceiptRef);
    else url.searchParams.delete("receiptRef");
    if (page === "stock-receiving" && receivingSearch) url.searchParams.set("receiptSearch", receivingSearch);
    else url.searchParams.delete("receiptSearch");
    if (page === "replenishment" && requestDocumentId) {
      url.searchParams.set("request", requestDocumentId);
    } else {
      url.searchParams.delete("request");
    }
    if (page === "replenishment") {
      url.searchParams.set("requests", requestHistory ? "history" : "sheet");
    } else {
      url.searchParams.delete("requests");
    }
    window.history.replaceState(window.history.state, "", url);
    acceptedUrlRef.current = window.location.href;
  }, [
    page,
    itemContext,
    itemOrigin,
    receivingReportId,
    movementReceiptRef,
    receivingSearch,
    requestDocumentId,
    requestHistory,
  ]);

  const handleLogout = async () => {
    await logout();

    navigate("/auth?portal=staff", {
      replace: true,
    });
  };

  const renderPage = () => {
    const navigateInventoryWorkspace = (target: InventoryWorkspacePage) => {
      setMovementReceiptRef("");
      setReceivingSearch("");
      setItemContext(null);
      setReceivingReportId(null);
      setRequestDocumentId(null);
      setPage(target);
    };
    switch (page) {
      case "dashboard":
        return <ManagerDashboard onNavigate={setPage} />;

      case "orders":
        return <OrdersPage />;

      case "menu":
        return <MenuManagementPage />;

      case "inventory":
        return (
          <InventoryPage
            onNavigate={navigateInventoryWorkspace}
            onOpenReceiptReference={(receiptNumber) => {
              setReceivingSearch(receiptNumber);
              setReceivingReportId(null);
              setPage("stock-receiving");
            }}
            onOpenReceivingReport={(reportId) => {
              setReceivingReportId(reportId);
              setItemContext(null);
              setPage("stock-receiving");
            }}
            onPrepareItem={(itemId) => {
              setItemContext(itemId);
              setPage("replenishment");
              setRequestHistory(false);
            }}
            onOpenRequest={(requestId) => {
              setItemContext(null);
              setRequestDocumentId(requestId);
              setPage("replenishment");
            }}
            onOpenItem={(itemId) => {
              setItemContext(itemId);
              setPage("inventory-item");
            }}
          />
        );

      case "inventory-item":
        return itemContext ? (
          <InventoryItemDetail
            itemId={itemContext}
            fromAudit={itemOrigin === "audit"}
            onBack={() => {
              setItemContext(null);
              setPage(itemOrigin === "audit" ? "inventory-audit" : "inventory");
            }}
            onOpenRequest={(requestId) => {
              setItemContext(null);
              setRequestDocumentId(requestId);
              setPage("replenishment");
            }}
            onOpenReceipt={(receiptNumber) => {
              setReceivingSearch(receiptNumber);
              setReceivingReportId(null);
              setItemContext(null);
              setPage("stock-receiving");
            }}
            onNavigate={(target) => {
              if (target === "inv-transactions") {
                setMovementReceiptRef("");
                setPage(target);
              } else {
                navigateInventoryWorkspace(target);
              }
            }}
            onAction={(target, itemId) => {
              setItemContext(itemId);
              setReceivingReportId(null);
              setPage(target);
            }}
          />
        ) : (
          <InventoryPage
            onNavigate={navigateInventoryWorkspace}
            onOpenReceiptReference={(receiptNumber) => {
              setReceivingSearch(receiptNumber);
              setReceivingReportId(null);
              setPage("stock-receiving");
            }}
            onOpenReceivingReport={(reportId) => {
              setReceivingReportId(reportId);
              setItemContext(null);
              setPage("stock-receiving");
            }}
            onPrepareItem={(itemId) => {
              setItemContext(itemId);
              setPage("replenishment");
              setRequestHistory(false);
            }}
            onOpenRequest={(requestId) => {
              setItemContext(null);
              setRequestDocumentId(requestId);
              setPage("replenishment");
            }}
            onOpenItem={(itemId) => {
              setItemContext(itemId);
              setPage("inventory-item");
            }}
          />
        );

      case "inventory-audit":
        return (
          <InventoryAuditPage
            onOpenItem={(itemId) => {
              setItemContext(itemId);
              setItemOrigin("audit");
              setPage("inventory-item");
            }}
          />
        );

      case "replenishment":
        return (
          <ManagerRequestsPage
            initialItemId={itemContext ?? undefined}
            initialRequestId={requestDocumentId ?? undefined}
            initialHistory={requestHistory}
            onDirtyChange={onRequestDirtyChange}
            onSelectRequest={(requestId, workspace) => {
              const url = new URL(window.location.href);
              const requestedHistory = workspace === "history";
              if (
                requestDocumentId === requestId &&
                requestHistory === requestedHistory
              )
                return;
              url.searchParams.set("view", "replenishment");
              url.searchParams.delete("item");
              url.searchParams.delete("report");
              if (requestId) url.searchParams.set("request", requestId);
              else url.searchParams.delete("request");
               url.searchParams.set("requests", requestedHistory ? "history" : "sheet");
              window.history.pushState(null, "", url);
              setItemContext(null);
              setRequestDocumentId(requestId);
              setRequestHistory(requestedHistory);
            }}
            onReceive={(reportId) => {
              leaveWithGuard(() => {
                setReceivingReportId(reportId);
                setItemContext(null);
                setPage("stock-receiving");
              });
            }}
          />
        );

      case "inv-transactions":
        return (
          <InvTransactionsPage
            initialItemId={itemContext ?? ""}
            initialReceiptReference={movementReceiptRef}
            onOpenReceipt={(reference) => {
              setReceivingSearch(reference);
              setReceivingReportId(null);
              setItemContext(null);
              setPage("stock-receiving");
            }}
            onBackToItem={
              itemContext ? () => setPage("inventory-item") : undefined
            }
          />
        );

      case "stock-receiving":
        return (
          <StockReceivingPage
            initialItemId={itemContext ?? undefined}
            initialReportId={receivingReportId ?? undefined}
            initialReceiptSearch={receivingSearch}
            onSelectReport={(reportId) => {
              const url = new URL(window.location.href);
              if (url.searchParams.get("report") !== reportId) {
                if (reportId) url.searchParams.set("report", reportId);
                else url.searchParams.delete("report");
                window.history.pushState(null, "", url);
              }
              setReceivingReportId(reportId);
            }}
            onOpenRequest={(requestId) => {
              setRequestDocumentId(requestId);
              setPage("replenishment");
            }}
            onOpenItem={(itemId) => {
              setItemContext(itemId);
              setPage("inventory-item");
            }}
            onOpenMovements={(itemId, receiptNumber) => {
              setItemContext(itemId);
              setMovementReceiptRef(receiptNumber);
              setPage("inv-transactions");
            }}
            onOpenStockOverview={() => {
              setItemContext(null);
              setPage("inventory");
            }}
            onBackToItem={
              itemContext ? () => setPage("inventory-item") : undefined
            }
          />
        );

      case "adjustment":
        return (
          <AdjustmentPage
            initialItemId={itemContext ?? undefined}
            onBackToItem={
              itemContext ? () => setPage("inventory-item") : undefined
            }
          />
        );

      case "waste-spoilage":
        return (
          <WasteSpoilagePage
            initialItemId={itemContext ?? undefined}
            onBackToItem={
              itemContext ? () => setPage("inventory-item") : undefined
            }
          />
        );

      case "riders":
        return <RidersPage />;

      case "customers":
        return <CustomersPage />;

      case "reports":
        return <ReportsPage />;
      case "shift-audit":
        return <ClosedShiftHistory manager />;

      case "settings":
        return <SettingsPage />;

      default:
        return <ManagerDashboard />;
    }
  };

  return (
    <>
    <AlertDialog open={Boolean(pendingLeave)} onOpenChange={(open) => { if (!open) setPendingLeave(null); }}>
      <AlertDialogContent className="manager-request-clear-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this request?</AlertDialogTitle>
          <AlertDialogDescription>Your unsaved quantities and request details will be lost.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction className="manager-request-clear-confirm" onClick={() => {
            const next = pendingLeave;
            setPendingLeave(null);
            requestDraftDirtyRef.current = false;
            next?.run();
          }}>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AppShell
      groups={MANAGER_NAV_GROUPS}
      notifications={managerNotifications.notifications}
      notificationError={managerNotifications.error}
      onNotificationsRead={() => managerNotifications.markRead(
        managerNotifications.notifications.map((notification) => notification.id),
      )}
      onNotificationSelect={(notificationId) => {
        const notification = managerNotifications.notifications.find(
          (entry) => entry.id === notificationId,
        );
        if (!notification) return;
        leaveWithGuard(() => {
          managerNotifications.markRead([notificationId]);
          setItemContext(null);
          setReceivingReportId(null);
          setRequestDocumentId(null);
          setPage(notification.page);
        });
      }}
      active={page === "inventory-item" ? "inventory" : page}
      activeTitle={
        page === "inventory-item" && itemContext ? "Item Stock" : undefined
      }
      onSelect={(target) => {
        if (target === page) return;
        leaveWithGuard(() => {
          setMovementReceiptRef("");
          setReceivingSearch("");
          setItemContext(null);
          setReceivingReportId(null);
          setRequestDocumentId(null);
          setPage(target);
        });
      }}
      user={{
        name: session?.name ?? "Manager",
        role: "Manager",
      }}
      onLogout={() => {
        leaveWithGuard(() => { void handleLogout(); });
      }}
    >
      <Suspense fallback={<ManagerPageLoader />}>{renderPage()}</Suspense>
    </AppShell>
    </>
  );
}
