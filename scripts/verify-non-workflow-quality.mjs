import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function read(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

const [
  app,
  routes,
  routeError,
  authProvider,
  authPortal,
  customerLogin,
  appShell,
  cashier,
  manager,
] = await Promise.all([
  read("src/app/App.tsx"),
  read("src/app/routes.tsx"),
  read("src/app/RouteErrorPage.tsx"),
  read("src/app/providers/AuthProvider.tsx"),
  read("src/modules/auth/index.tsx"),
  read("src/modules/auth/pages/CustomerLoginPage.tsx"),
  read("src/components/layout/AppShell.tsx"),
  read("src/modules/cashier/index.tsx"),
  read("src/modules/manager/index.tsx"),
]);

assert.doesNotMatch(
  app,
  /CashierProvider/,
  "CashierProvider must not return to the global application entry.",
);
assert.match(
  cashier,
  /<CashierProvider>[\s\S]*<CashierModule \/>/,
  "CashierApp must retain its route-scoped provider.",
);
assert.match(
  routes,
  /errorElement:\s*<RouteErrorPage \/>/,
  "The root route must retain its recovery screen.",
);
assert.match(
  routeError,
  /await logout\(\);[\s\S]*navigate\("\/auth", \{ replace: true \}\)/,
  "The route recovery screen must provide a real sign-out escape path.",
);
assert.match(
  authProvider,
  /requestId === authRequestRef\.current/,
  "Auth hydration must continue to reject stale async results.",
);
assert.match(
  authProvider,
  /retrySession:\s*\(\) => Promise<void>/,
  "Auth failures must remain retryable through the provider contract.",
);
assert.match(
  authPortal,
  /role="alert"[\s\S]*void retrySession\(\)/,
  "The authentication portal must keep a visible retry action.",
);
assert.doesNotMatch(
  customerLogin,
  /window\.alert/,
  "Customer sign-in errors must not use blocking browser alerts.",
);
assert.match(
  appShell,
  /href="#app-shell-main-content"/,
  "The shared shell must retain its skip link.",
);
assert.match(
  appShell,
  /event\.key !== "Tab"/,
  "The navigation drawer must retain keyboard focus containment.",
);
assert.match(
  manager,
  /lazy\(\(\) =>[\s\S]*<Suspense fallback={<ManagerPageLoader \/>}>/,
  "Manager workspaces must remain lazy-loaded behind a shared fallback.",
);

console.log("Verified non-workflow quality baseline: 11 checks.");
