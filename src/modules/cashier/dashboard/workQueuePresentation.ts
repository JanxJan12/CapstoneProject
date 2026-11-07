import type { CashierActionQueueItem } from "../types";
import type { CashierQueueView } from "../types";
import { manilaDate } from "../utils/exportUtils";

/** Older orders stay unresolved and actionable; this only changes placement. */
export function partitionCashierWorkQueue(
  items: CashierActionQueueItem[],
  now: number,
) {
  const today = manilaDate(new Date(now));
  const current: CashierActionQueueItem[] = [];
  const older: CashierActionQueueItem[] = [];

  for (const item of items) {
    if (isOlderCashierOrder(item.createdAt, now, today)) {
      older.push(item);
    } else {
      current.push(item);
    }
  }

  return { current, older, all: [...current, ...older] };
}

export function isOlderCashierOrder(createdAt: string, now: number, today = manilaDate(new Date(now))) {
  const created = new Date(createdAt);
  return !Number.isFinite(created.getTime()) || manilaDate(created) < today;
}

export function selectCashierQueueView(
  queue: ReturnType<typeof partitionCashierWorkQueue>,
  view: CashierQueueView,
  filter?: "payments" | "ready" | "delayed",
) {
  let items = view === "older_backlog" ? queue.older : view === "all_active" ? queue.all : queue.current;
  if (view === "action_required") {
    items = items.filter((item) => item.nextAction !== "view_details");
  } else if (view === "ready_for_handoff") {
    items = items.filter((item) => item.nextAction === "release_order");
  }
  if (filter === "payments") return queue.all.filter((item) => item.nextAction === "verify_payment");
  if (filter === "ready") return queue.current.filter((item) => item.nextAction === "release_order");
  if (filter === "delayed") return queue.current.filter((item) => item.isDelayed);
  return items;
}
