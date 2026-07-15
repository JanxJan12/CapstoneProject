# Walk-in POS architecture

The Walk-in POS keeps the existing RRJ Food-House visual system while treating
speed-critical behavior as a separate layer from presentation.

## Reusable UI

- `ProductCard` renders menu identity, operational status, inventory signals,
  modifier availability, favorites, and the quick-add path.
- `SearchBar` owns accessible search input behavior, recent/popular searches,
  and keyboard result navigation.
- `CategorySidebar` renders memoized category and quick-view counts.
- `OrderItem` owns line-level quantity, modifiers, notes, duplicate, reorder,
  visible removal, and accessible actions.
- `ModifierDrawer` supports required/optional and single/multi-select groups
  without covering the menu.
- `MealRecommendations` derives non-blocking, one-tap meal completion options.
- `CartPanel`, `OrderSummaryPanel`, `PaymentPanel`, and `ReceiptPanel` are the
  four independent states of the fixed right-side workstation.
- `ReceiptContent` keeps printed receipt details consistent between the POS
  receipt panel and transaction-history receipt dialogs.

## Business and state boundaries

- `useWalkInPOSController` coordinates the draft and controls the typed
  `RightPanelState` finite state machine without changing routes.
- `posOperations` contains pure filtering, totals, inventory, tender, cart, and
  duplication rules.
- `posPersistence` contains defensive browser-storage access for drafts,
  favorites, and recent searches.
- `VirtualizedProductGrid` renders only visible rows and keeps product lookups
  indexed for catalogs with 1,000 or more items.

The default fast path is: search or category → Quick Add → continue browsing →
Order Summary → Payment → Receipt. Products receive a safe default
configuration on the fast path, while explicit customization uses the compact
right-side drawer without unmounting the menu.
