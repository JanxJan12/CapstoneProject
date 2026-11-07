/** Read-only check after an uncertain close response. Never retries the close RPC. */
export async function inspectShiftClosureOutcome(
  shiftId: string,
  getOpen: () => Promise<{ id: string } | null>,
  getClosed: () => Promise<{ rows: { id: string }[] }>,
): Promise<"still-open" | "saved-closed" | "unknown"> {
  const open = await getOpen();
  if (open?.id === shiftId) return "still-open";
  const closed = await getClosed();
  return closed.rows.some((row) => row.id === shiftId) ? "saved-closed" : "unknown";
}
