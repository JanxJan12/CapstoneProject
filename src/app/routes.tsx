import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Shell }        from "./Shell";
import { RequireAuth }  from "./RequireAuth";

const AuthApp = lazy(() => import("../modules/auth").then((module) => ({ default: module.AuthApp })));
const ManagerApp = lazy(() => import("../modules/manager").then((module) => ({ default: module.ManagerApp })));
const CashierApp = lazy(() => import("../modules/cashier").then((module) => ({ default: module.CashierApp })));
const KitchenApp = lazy(() => import("../modules/kitchen").then((module) => ({ default: module.KitchenApp })));
const CustomerApp = lazy(() => import("../modules/customer").then((module) => ({ default: module.CustomerApp })));
const RiderApp = lazy(() => import("../modules/rider").then((module) => ({ default: module.RiderApp })));
const SystemStates = lazy(() => import("../modules/states").then((module) => ({ default: module.SystemStates })));

function RouteLoader() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-5 h-12 w-12">
          <div className="absolute inset-0 rounded-full border-[3px] border-primary/15" />
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary" />
          <span className="absolute inset-0 flex items-center justify-center font-['Fraunces'] text-xs font-bold text-primary">R</span>
        </div>
        <p className="text-xs font-extrabold text-foreground">Preparing your RRJ experience</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Fresh from the halal kitchen…</p>
      </div>
    </div>
  );
}

function RouteBoundary({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoader />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Shell,
    children: [
      { index: true, element: <Navigate to="/auth" replace /> },

      // Public — login screens (notices come in via ?notice= query param)
      { path: "auth", element: <RouteBoundary><AuthApp /></RouteBoundary> },

      // Protected — each route checks session role
      {
        path: "manager",
        element: (
          <RequireAuth role="manager">
            <RouteBoundary><ManagerApp /></RouteBoundary>
          </RequireAuth>
        ),
      },
      {
        path: "cashier",
        element: (
          <RequireAuth role="cashier">
            <RouteBoundary><CashierApp /></RouteBoundary>
          </RequireAuth>
        ),
      },
      {
        path: "kitchen",
        element: (
          <RequireAuth role="kitchen">
            <RouteBoundary><KitchenApp /></RouteBoundary>
          </RequireAuth>
        ),
      },
      {
        path: "customer",
        element: (
          <RequireAuth role="customer">
            <RouteBoundary><CustomerApp /></RouteBoundary>
          </RequireAuth>
        ),
      },
      {
        path: "rider",
        element: (
          <RequireAuth role="rider">
            <RouteBoundary><RiderApp /></RouteBoundary>
          </RequireAuth>
        ),
      },

      // Dev/prototype only
      { path: "states", element: <RouteBoundary><SystemStates /></RouteBoundary> },

      { path: "*", element: <Navigate to="/auth" replace /> },
    ],
  },
]);
