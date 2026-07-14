import { Outlet } from "react-router";

export function Shell() {
  return (
    <div className="rrj-product flex h-screen flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
