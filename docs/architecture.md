# Project architecture

The codebase uses a feature-first structure. Business workflows stay close to the role or module that owns them, while genuinely reusable code lives in shared top-level folders.

## Directory responsibilities

- `src/app/` composes the application. It owns the router, route guards, top-level providers, and the root shell; it should not contain reusable UI components.
- `src/modules/` contains product features grouped by user role or operational workflow. A module may own its pages, components, hooks, services, constants, schemas, and types.
- `src/components/` contains code shared by multiple modules. `ui/` holds low-level primitives, `common/` holds product-level controls, and `layout/` and `navigation/` hold application chrome.
- `src/assets/` contains assets imported by application code. Brand files use stable, descriptive names under `assets/brand/`.
- `src/data/`, `src/constants/`, and `src/types/` contain cross-feature data and contracts. Module-specific equivalents should remain inside their owning module.
- `docs/` contains design source material and engineering documentation that is not bundled into the application.
- `scripts/` contains build automation and deterministic workflow verification.

## Import conventions

- Use the `@/` alias for imports that cross a feature boundary, such as `@/components/ui/dialog` or `@/data/session`.
- Use relative imports for files within the same feature directory.
- Import directly from the narrowest stable module. Avoid reaching into `src/app/` for reusable presentation code.
- Keep business mutations in the owning service or shared store rather than in page-local mock state.

## Feature boundaries

The cashier module is the most fully separated workflow and is the reference for new operational modules:

```text
modules/cashier/
  components/     Cashier-specific reusable presentation
  dashboard/      Shift overview and live operational widgets
  hooks/          Shared store, persistence, actions, and metrics
  orders/         Order list and order-management workflows
  payments/       Online payment review workflows
  pos/            Walk-in point-of-sale workflow
  services/       Authoritative state transitions and validation
  shifts/         Shift lifecycle and settlement
  transactions/   Transaction history and audit views
```

New features should follow the same ownership rule: keep code local until more than one module genuinely needs it, then promote it into an appropriate shared folder.
