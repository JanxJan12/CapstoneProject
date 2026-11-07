# H-10 workflow UX implementation — 2026-10-15 (Manila)

## Local application changes

Changed only `src/modules/customer/index.tsx` for H-10:

1. After a customer attempts order creation, Checkout saves the entered delivery fields in tab-scoped `sessionStorage` alongside the existing request identity. The draft is restored only when its request ID still matches and `auth.getUser()` returns the same customer ID. Malformed or unavailable browser storage does not block checkout.
2. On reload with a saved request and cart, the Customer module opens Checkout. It restores the same details needed for the existing server idempotency fingerprint. A changed form/cart still takes the existing new-request path.
3. A network response error now says the order **may** already exist and directs the customer to retry with the saved details. The button reads **Retry & Check Order** in this state. Other server errors still use their existing messages.
4. The delivery retry draft is removed when a successful payment submission clears the saved request ID, or when a replayed order has already progressed beyond payment verification.

No RPC, migration, RLS, payment, accounting, inventory, Rider repository, or hosted project changes were made. The existing `place_customer_order` request ID, server-owned price and order snapshot remain authoritative. Formal Manager inventory dispatch remains external Messenger/document.

## Review boundary

The canonical checkout file was dirty before H-10. These changes were added in place without resetting or staging pre-existing work. Synthetic H-10 browser files and screenshots are under `qa/h10-browser-20261015/`; a focused harness is under `.tmp/h09-stack-20261015/`. The preserved H-09 local stack was reused without reset or cleanup.
