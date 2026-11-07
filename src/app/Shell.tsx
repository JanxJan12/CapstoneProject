import { Outlet } from "react-router";

export function Shell() {
  return (
    <div className="rrj-product flex h-screen flex-col overflow-hidden">
      {import.meta.env.VITE_DEMO_MODE === "true" && (
        <div role="status" className="bg-amber-300 px-3 py-1 text-center text-xs font-bold text-amber-950">
          DEFENSE DEMO · Synthetic sample data · No real payments or restaurant stock
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
