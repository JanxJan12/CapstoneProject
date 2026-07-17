# Walk-in POS architecture

The Walk-in POS is a single cashier workstation. Menu entry remains the primary
workspace; review, payment, and receipt tools appear only when the transaction
requires them.

## Workstation UI

- `OrderTypeGate` requires Dine-in or Take-out before exposing the ordering
  workspace. The active type can be changed later without losing order items.
- `POSOrderHeader` owns live shift status, product search, the active order-type
  indicator, held orders, and the guarded new/hold/cancel actions.
- `MenuGrid` combines category navigation, operational idle tools,
  recommendations, and the virtualized product grid.
- `ProductCard` prioritizes code, name, price, stock state, Quick Add, and the
  modifier path in a dense cashier-friendly tile.
- `TransactionBar` keeps item count, running total, last-item correction,
  optional review, and F3 payment available without reserving a side column.
- `OrderReviewDrawer` composes `POSCart`, discounts, kitchen notes, and totals
  in an on-demand right drawer.
- `ModifierDrawer`, `PaymentPanel`, and `ReceiptPanel` reuse that drawer surface
  without navigating away from the menu workspace.
- `ReceiptContent` keeps printed receipt details consistent between the POS and
  transaction history.

## Business and state boundaries

- `useWalkInPOSController` coordinates the order-type gate, header search,
  persisted draft, and the explicit
  `IDLE → ORDERING → ORDER_REVIEW → PAYMENT → RECEIPT` transaction state machine.
- `posOperations` contains pure search, transition, totals, inventory, tender,
  order-line, and duplication rules.
- `cashierService` and the shared cashier store remain the authoritative order,
  payment, transaction, held-order, and inventory boundary.
- `posPersistence` defensively stores active drafts and recent searches.
- `VirtualizedProductGrid` renders only visible rows and keeps product lookups
  indexed for large catalogs.

The default fast path is order type → code/name/category → Quick Add → continue
entry → F3 payment → receipt. Review is optional for a valid order, but the
controller opens it when required discount information is missing. Dine-in and
take-out orders use the automatic walk-in identity without requesting a
customer or table. Simple products use safe defaults; explicit customization
and later modifier edits stay in the same workspace.
