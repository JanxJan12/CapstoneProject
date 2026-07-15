# Cashier reusable components

The Cashier Module consumes these components through the `components` barrel.
They contain presentation and interaction behavior only; order, payment,
transaction, and shift rules remain in services and domain hooks.

| Component            | Purpose                                             | Key accessibility behavior                                  |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `MetricCard`         | Navigable operational metric                        | Native button semantics and descriptive accessible name     |
| `PageHeader`         | Consistent page title, description, and actions     | Semantic heading hierarchy                                  |
| `StatusBadge`        | Typed order, payment, shift, and transaction state  | Text label remains available without relying on color       |
| `ActionCard`         | Primary or secondary workbench action               | Native button, disabled state, and focus ring               |
| `SummaryCard`        | Read-only financial or operational summary          | Semantic article and visible labels                         |
| `Drawer`             | Right-side record detail surface                    | Radix focus trapping, Escape handling, and dialog semantics |
| `ConfirmationDialog` | Destructive or consequential confirmation           | Focus-managed alert dialog with explicit cancel action      |
| `Toast`              | Central notification facade                         | Uses the module-wide live notification region               |
| `SearchToolbar`      | Search, quick filters, and advanced filter controls | Named landmark grouping                                     |
| `DataTable`          | Typed record table with optional expanded rows      | Caption-equivalent accessible label and scoped headers      |
| `EmptyState`         | No-data and no-result feedback                      | Descriptive text with optional recovery action              |
| `LoadingSkeleton`    | Non-blocking loading placeholder                    | Optional status label for assistive technology              |

## Usage rules

- Import from `../components`, not individual implementation files.
- Keep business decisions out of component props; pass already-derived labels,
  values, disabled states, and callbacks.
- Supply stable row keys to `DataTable` and stable callbacks to interactive
  cards when rendering large collections.
- Use `StatusBadge` only with the typed Cashier status unions.
- Use `Toast` instead of importing the underlying notification package.
