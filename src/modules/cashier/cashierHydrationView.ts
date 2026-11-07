export function cashierHydrationView(isHydrating: boolean, databaseError: string) {
  if (!isHydrating) return "ready";
  return databaseError ? "failed" : "loading";
}
