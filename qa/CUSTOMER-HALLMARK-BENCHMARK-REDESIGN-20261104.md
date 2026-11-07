# Customer Hallmark redesign from the three-app study

Date: 2026-11-04. Scope: presentation of the active RRJ customer module. Reference study: [GrabFood, foodpanda, McDelivery PH](CUSTOMER-GRAB-FOODPANDA-MCDELIVERY-STUDY-20261104.md).

## Design decision

Home now places the existing menu action, category choices, and available dishes ahead of a large restaurant image. Menu puts dish search immediately under its title, with category chips and clearer item actions. The restaurant photo remains a compact, real brand cue. Its content, catalog image rules, and page destinations are unchanged.

The later screens use one visual decision at a time: item detail separates product facts from choices and the Add action; Cart reads as an order sheet and labels the estimated amount; Checkout gives the amount summary its own place in the delivery step; Tracking gives persisted status, payment, and progress priority over receipt detail; History groups status and confirmed total; Profile separates account facts from the contact form. The shared customer stylesheet supplies the common spacing, surfaces, focus styles, and responsive behavior.

## Files changed in this pass

- `src/modules/customer/customerMenuPages.tsx` — Home, Menu, and item detail markup.
- `src/modules/customer/customerCartPage.tsx` — order review layout.
- `src/modules/customer/customerCheckoutPage.tsx` — delivery and payment presentation.
- `src/modules/customer/customerTrackingPage.tsx` — order state and receipt hierarchy.
- `src/modules/customer/customerHistoryPage.tsx` — order grouping.
- `src/modules/customer/customerProfilePage.tsx` — account and contact layout.
- `src/modules/customer/customer-ui.css` — shared customer presentation.

No route, component, field, handler, pricing rule, RPC, GCash safeguard, or order status was intentionally changed. The Hallmark before/after inventory retained 1/1 recorded fields and 65/65 recorded handlers.

## Verification

| Check | Result |
| --- | --- |
| Typecheck | PASS — `npm run typecheck` |
| Production build | PASS — `npm run build`, 3,059 transformed modules |
| Hallmark active screen sweep | PASS — 0 FAIL, 0 REFLEX, 14 WARN across eight files and `/customer`; five rendered screenshots. Warnings include old Tailwind palette utilities, a static tracking contrast suspicion, and navigation styling. |
| Public browser walkthrough | PASS — Home → Menu → item detail → Cart → guest Checkout at 390, 768, and 1440px; menu search, cart action, guest Track redirect, More drawer, and horizontal overflow checks. 15 screenshots, no recorded failures. Captures: `qa/customer-benchmark-redesign-20261104/`. |
| Signed-in delivery, payment proof, live tracking, history, profile | NOT TESTED — no hosted order or payment was created for visual QA. |

The local Hallmark renderer initially lacked `puppeteer-core`. It ran from an isolated temporary install with local Chrome. An interrupted attempt to install it in the project left some ignored `node_modules` files incomplete; those dependencies were restored from an isolated lockfile install, after which typecheck, browser capture, and production build passed. Project manifest and lockfile were not edited by that repair. The isolated dependency copies remain in `.codex-temp/`; automatic approval review blocked the attempted recursive cleanup.

## Content constraint

The public catalog response used in these captures did not supply dish image paths, so Menu and item detail remain photo-free. Files in `public/menu/` have similar names, but visual inspection found at least one mismatch to its named dish. They were not attached to catalog items by guesswork. A signed-in visual pass and verified catalog imagery are the remaining material needed to judge these screens fully.
