/** Keep one row per authoritative ledger ID; a repeated ID is a read-contract error. */
export function appendMovementPage<T extends { id: string }>(
  current: T[],
  incoming: T[],
): T[] {
  const ids = new Set(current.map((row) => row.id));
  for (const row of incoming) {
    if (ids.has(row.id)) {
      throw new Error("The server returned a repeated stock movement. Refresh and try again.");
    }
    ids.add(row.id);
  }
  return [...current, ...incoming];
}

export function claimMovementPageLoad(
  inFlight: { current: number | null },
  version: number,
): boolean {
  if (inFlight.current !== null) return false;
  inFlight.current = version;
  return true;
}

export function releaseMovementPageLoad(
  inFlight: { current: number | null },
  version: number,
): boolean {
  if (inFlight.current !== version) return false;
  inFlight.current = null;
  return true;
}
