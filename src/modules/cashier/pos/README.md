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
  swipe removal, and accessible actions.
- `ModifierModal` supports required/optional and single/multi-select groups with
  price adjustments.
- `PaymentPanel` owns payment presentation and composes the touch keypad.

## Business and state boundaries

- `useWalkInPOSController` coordinates the draft workflow and exposes stable
  actions to the page.
- `posOperations` contains pure filtering, totals, inventory, tender, cart, and
  duplication rules.
- `posPersistence` contains defensive browser-storage access for drafts,
  favorites, and recent searches.
- `VirtualizedProductGrid` renders only visible rows and keeps product lookups
  indexed for catalogs with 1,000 or more items.

The default fast path is: search or category → Quick Add → tender suggestion →
Place Order. Products with required modifiers receive a safe default, while
opening the modifier modal remains available for customized orders.
