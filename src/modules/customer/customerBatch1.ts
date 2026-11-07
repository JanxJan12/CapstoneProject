export type CustomerErrorContext =
  | "menu" | "options" | "availability" | "tracking" | "history"
  | "profile" | "profile-save" | "auth" | "order" | "payment";

const fallback: Record<CustomerErrorContext, string> = {
  menu: "We couldn't load the menu. Please try again.",
  options: "We couldn't refresh this item's choices. Please try again.",
  availability: "We couldn't check current availability. Please try again.",
  tracking: "We couldn't load this order. Please try again.",
  history: "We couldn't load your orders. Please try again.",
  profile: "We couldn't load your profile. Please try again.",
  "profile-save": "We couldn't save your contact number. Please try again.",
  auth: "We couldn't verify your account. Please sign in again.",
  order: "We couldn't confirm whether your order was placed. Check your orders before trying again.",
  payment: "We couldn't confirm the payment submission. Check this order before trying again.",
};

/** Never return untrusted backend text to a Customer-facing surface. */
export function customerErrorMessage(error: unknown, context: CustomerErrorContext): string {
  const detail = error && typeof error === "object" ? error as { code?: unknown; status?: unknown; message?: unknown } : null;
  const code = typeof detail?.code === "string" ? detail.code : "";
  const status = typeof detail?.status === "number" ? detail.status : null;
  const message = typeof detail?.message === "string" ? detail.message : "";
  // A lost response cannot establish whether either state-changing request committed.
  if (context === "order" || context === "payment") return fallback[context];
  if (/failed to fetch|networkerror|network request failed|connection (?:lost|refused)|offline/i.test(message)) {
    return "Your connection appears to be interrupted. Check it and try again.";
  }
  if (/^(401|403|42501)$/.test(code) || status === 401 || status === 403 ||
      /permission denied|not authorized|forbidden|jwt expired|invalid jwt/i.test(message)) {
    return status === 401 || /jwt expired|invalid jwt|session expired/.test(message.toLowerCase()) || code === "401"
      ? "Your session has expired. Please sign in again to continue."
      : "You don't have access to this information. Sign in with the right account and try again.";
  }
  if (code.startsWith("22") || /invalid input|validation|check constraint/i.test(message)) {
    return "Some information needs your attention. Please review it and try again.";
  }
  if (/unavailable|out of stock|insufficient stock/i.test(message)) {
    return "This item is currently unavailable. Please choose another item.";
  }
  return fallback[context];
}

export interface CurrentProduct<T extends { id: string; available: boolean }> {
  item: T;
  removed: boolean;
}

/** Resolve by stable ID on every render so a refreshed catalog cannot leave an open detail stale. */
export function currentCustomerProduct<T extends { id: string; available: boolean }>(
  opened: T,
  catalog: T[],
): CurrentProduct<T> {
  const current = catalog.find((item) => item.id === opened.id);
  return current ? { item: current, removed: false }
    : { item: { ...opened, available: false }, removed: true };
}

export function retainCustomerDrinkSelections<T extends { id: string }>(
  selectedIds: string[],
  options: T[],
): { selected: string[]; invalidated: boolean } {
  const validIds = new Set(options.map((option) => option.id));
  const selected = selectedIds.filter((id) => validIds.has(id));
  return { selected, invalidated: selected.length !== selectedIds.length };
}

export function customerProductPricesChanged(
  previous: { price: number; withoutRicePrice?: number },
  current: { price: number; withoutRicePrice?: number },
): boolean {
  return previous.price !== current.price || previous.withoutRicePrice !== current.withoutRicePrice;
}

export function canAddCurrentCustomerProduct(
  displayed: { id: string; price: number; withoutRicePrice?: number },
  current: { id: string; price: number; withoutRicePrice?: number; available: boolean;
    withRiceAvailable?: boolean; withoutRiceAvailable?: boolean } | undefined,
  mealOption?: "with_rice" | "without_rice",
): boolean {
  return Boolean(current && current.id === displayed.id && current.available &&
    !customerProductPricesChanged(displayed, current) &&
    (mealOption !== "without_rice" || (current.withoutRicePrice !== undefined && current.withoutRiceAvailable !== false)) &&
    (mealOption !== "with_rice" || current.withRiceAvailable !== false));
}

export function isCurrentCustomerMenuResponse(
  startingRevision: number,
  currentRevision: number,
): boolean {
  return startingRevision === currentRevision;
}
