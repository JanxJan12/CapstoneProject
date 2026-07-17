# RRJ Food-House Management System

A role-based restaurant operations application for managers, cashiers, kitchen staff, customers, and riders. The frontend is built with React, TypeScript, Vite, and Tailwind CSS.

## Getting started

From PowerShell:

```powershell
npm.cmd install
npm.cmd run dev
```

Vite will print the local development URL after startup.

## Quality checks

```powershell
npm.cmd run typecheck
npm.cmd run build
```

The cashier regression scripts live in `scripts/` and exercise the shared service layer without changing application data.

## Project structure

```text
src/
  app/          Application bootstrap, routing, guards, and providers
  assets/       Runtime assets grouped by purpose
  components/   Shared UI primitives, layout, navigation, and charts
  constants/    Cross-feature constants and navigation definitions
  data/         Demo accounts, session storage, and shared mock data
  modules/      Role- and workflow-based feature modules
  styles/       Global styles, design tokens, fonts, and Tailwind entrypoints
  types/        Cross-feature TypeScript contracts
docs/           Architecture notes, design references, and project guidelines
public/         Static assets served without bundler processing
scripts/        Build helpers and deterministic workflow checks
```

See [docs/architecture.md](docs/architecture.md) for module boundaries and import conventions.

## Production build

```powershell
npm.cmd run build
```

The optimized output is generated in `dist/` and is intentionally excluded from version control.
