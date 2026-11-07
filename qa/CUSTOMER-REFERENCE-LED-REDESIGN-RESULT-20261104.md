# RRJ customer reference-led redesign result

Date: 2026-11-04. Decisions and public sources: [reference comparison](CUSTOMER-REFERENCE-TO-IMPLEMENTATION-20261104.md). This is a presentation-only change to the active customer components.

## Implemented

- **Navigation:** Labeled Menu, Cart, Track, Orders, and More phone destinations, with a cart count. Home remains available through the logo and More drawer. The drawer still contains account and sign-out actions; desktop destinations remain available.
- **Menu and Home listings:** Compact, text-led dish rows replace large equal-weight cards. Real images still render only when a catalog image path is present and valid. Names, descriptions, prices, availability, search, filtering, selection, and current catalog order remain data-driven.
- **Item detail:** Removed the enclosing decorative card and simplified category/availability presentation. Quantity, rice and drink choices, availability checks, price updates, and Add to Cart behavior remain attached to their existing handlers.
- **Cart and checkout:** Removed emoji category thumbnails from cart lines, simplified checkout progress, and used a warmer order-summary surface. Estimated and server-confirmed amounts still follow their existing code paths. The add-to-cart toast now appears above phone content instead of covering the checkout action.
- **Tracking, history, profile:** Tracking source presents the real current status and next action before order number, payment, items, charges, and timeline. History and profile use the same type hierarchy without redundant small-cap labels.

## Local evidence

- **PASS:** `npm run typecheck` and `npm run build`.
- **PASS:** Hallmark lint of the new customer stylesheet: 0 FAIL, 0 REFLEX, 0 WARN.
- **PASS:** [Capture script](customer-redesign-evidence-20261104/capture.cjs) produced 15 Home/Menu/detail/Cart/guest-checkout screenshots at 390×844, 768×1024, and 1440×900 with no page errors or horizontal overflow. [Phone Menu](customer-redesign-evidence-20261104/menu-phone.png), [phone Cart](customer-redesign-evidence-20261104/cart-phone.png), [phone checkout](customer-redesign-evidence-20261104/checkout-phone.png), and [desktop Menu](customer-redesign-evidence-20261104/menu-desktop.png) are the main visual review points.
- **PASS:** Local Menu search, item selection, Add to Cart, Cart, guest checkout navigation, and More drawer. [Guest Track](customer-redesign-evidence-20261104/tracking-guest-phone.png) correctly requests customer sign-in. The [transient add toast](customer-redesign-evidence-20261104/added-toast-phone.png) was checked separately.
- **NOT TESTED:** Signed-in checkout, quote confirmation, GCash submission, live order tracking, order history, profile editing, and authenticated tablet rendering. No hosted order or payment was created for these screenshots.

## Deliberate limits

The reference screenshots are curated publisher images, so this implementation adopts their visible hierarchy rather than claiming their live behavior. RRJ still shows the catalog's existing order, which places unavailable items first in the captured dataset. The local `public/menu` files were not assigned to catalog items without verified item-image mappings. No offers, ratings, ETA, map, or reordering feature was added.
