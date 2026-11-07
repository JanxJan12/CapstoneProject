# Walk-in POS architecture

The Walk-in POS is a single cashier workstation. Menu entry remains the primary
workspace; payment and receipt tools appear only when the transaction
requires them.

## Workstation UI

- `OrderTypeGate` requires Dine-in or Take-out before exposing the ordering
  workspace. The active type can be changed later without losing order items.
- `POSOrderHeader` owns live shift status, product search, visible order-type
  controls, held orders, and the guarded new/hold/cancel actions.
- `MenuGrid` combines category navigation, operational idle tools,
  recommendations, and the virtualized product grid.
- `ProductCard` prioritizes code, name, price, stock state, direct add, and
  focused rice or drink choices in a dense cashier tile.
- `TransactionBar` keeps item count, running total, last-item correction,
  mobile Current Order access, and F3 payment available without reserving a side column.
- `POSOrderSidebar` reuses `POSCart` for order editing on desktop and in a
  compact order sheet on smaller screens.
- `ChoiceDrawer`, `PaymentPanel`, and `ReceiptPanel` reuse that drawer surface
  without navigating away from the menu workspace.
- `ReceiptContent` keeps printed receipt details consistent between the POS and
  transaction history.

## Business and state boundaries

- `useWalkInPOSController` coordinates the order-type gate, header search,
  persisted draft, and the explicit
  `IDLE → ORDERING → PAYMENT → RECEIPT` transaction path.
- `posOperations` contains pure search, transition, totals, inventory, tender,
  order-line, and duplication rules.
- `cashierService` and the shared cashier store remain the authoritative order,
  payment, transaction, held-order, and inventory boundary.
- `posPersistence` defensively stores active drafts and recent searches.
- `VirtualizedProductGrid` renders only visible rows and keeps product lookups
  indexed for large catalogs.

The default fast path is order type → code/name/category → Quick Add → continue
entry → F3 cash payment → receipt. Current Order is the primary order editor.
Dine-in and take-out orders use the automatic walk-in identity without
requesting a customer or table. Ordinary products add directly; rice and drink
choices stay in the same workspace. New sales do not accept order-level notes,
discounts, or table numbers. Item instructions remain available.
