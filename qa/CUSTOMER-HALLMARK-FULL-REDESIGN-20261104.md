# Customer Hallmark full redesign — 2026-11-04

## Scope and design decision

Active `/customer` app screens: Home, Menu, Item detail, Cart, Checkout, Tracking, History, Profile. The RRJ logo, restaurant photo, catalog, menu image paths, route and handler wiring, cart and checkout fields, server quote and confirmed amounts, GCash flow, and persisted order states were retained. No files or destinations were removed.

Home now has a shorter restaurant introduction and a flat category strip. Menu lists orderable dishes first while retaining every dish and the category/search filters. Cart and checkout use a common surface and clearer amount hierarchy. Tracking reserves the leading dark panel for the persisted order status. History uses rows; profile retains its account and contact form. The customer palette and type scale are in `tokens.css`, with scoped base rules and the app stylesheet. No catalog photo was assigned to a dish without a verified image path.

## Verification

| Check | Result |
| --- | --- |
| Hallmark before render | 32 FAIL, 1 REFLEX across the broad customer folder; includes disconnected prototype and older pages |
| Hallmark after render, active screen files | 0 FAIL, 0 REFLEX, 14 WARN; 5 render captures, kept fields 1/1, handlers 65/65, headings 7/7, figures 1/1 in the compared subset |
| Typecheck | PASS |
| Production build | PASS after all edits |
| Browser walkthrough | PASS at 390, 768, and 1440: Home → Menu → item detail → Cart → guest Checkout; phone search, More drawer, guest Track auth redirect; 15 screenshots, zero recorded page errors/overflow |
| Authenticated checkout, payment upload, live tracking, history, profile | NOT TESTED; no hosted order or payment was created for visual verification |

The 14 Hallmark warnings are mainly legacy Tailwind palette classes in active components. The rendered Tracking panel was not available without an authenticated order, so its contrast warning remains unverified by a live tracking capture. The kept comparison used the broad before record and active after file list, so the linter could compare the matched subset only.

Before/after: `.hallmark/compare.html`. Current screen captures: `qa/customer-hallmark-full-20261104/`.

## In-thread finish review

The previous home gave the restaurant photo more room; the revised home makes the first orderable dishes visible in the phone viewport. Menu is easier to scan with available dishes first. Checkout still needs a signed-in visual review of the delivery and payment stages, and Tracking needs a real order state before its hierarchy can be judged fully. No content or workflow claims were added.
