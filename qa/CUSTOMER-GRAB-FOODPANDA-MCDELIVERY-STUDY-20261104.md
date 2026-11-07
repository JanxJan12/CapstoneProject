# Customer app study: GrabFood, foodpanda, McDelivery PH

Date: 2026-11-04. Scope: design research for RRJ's Food-Haus `/customer` module. No customer code, catalog data, payments, or hosted state was changed.

## What was inspected

- **GrabFood:** [Philippine product and ordering description](https://www.grab.com/ph/food/) and [Philippine Help Centre](https://help.grab.com/passenger/en-ph/categories/115002258448-GrabFood). The current [Philippine App Store listing](https://apps.apple.com/ph/app/grab-food-delivery-taxi-ride/id647268330) was checked; its available phone screenshots emphasize transport, so they do not establish the current Food screen layout.
- **foodpanda:** [Philippine site](https://www.foodpanda.ph/), [Philippine App Store publisher screenshots](https://apps.apple.com/ph/app/foodpanda-food-groceries/id758103884), and [Philippine support terms](https://www.foodpanda.ph/contents/terms-and-conditions.htm). Local screenshot copies: `.codex-temp/hallmark-reference/foodpanda-1.jpg` through `foodpanda-4.jpg`. The useful food screen uses Singapore currency, so its *layout* is evidence, but its offers, categories, and service availability are not Philippine evidence.
- **McDelivery:** [Philippine App Store publisher screenshots](https://apps.apple.com/ph/app/mcdelivery-ph/id908862359) and [McDelivery PH web entry](https://socials.mcdelivery.com.ph/). Local screenshot copies: `.codex-temp/hallmark-reference/mcdelivery-1.jpg` through `mcdelivery-4.jpg`.
- **RRJ:** current `customerMenuPages.tsx`, `customerCartPage.tsx`, `customerCheckoutPage.tsx`, `customerTrackingPage.tsx`, `customerNav.tsx`, `design.md`, and the [previous redesign report](CUSTOMER-HALLMARK-FULL-REDESIGN-20261104.md). Existing public captures are in `qa/customer-copy-trim-20261104/`.

These are official descriptions and publisher-selected promotional screens, not an authenticated live walkthrough of any competitor. Their exact cart, payment, error, and accessibility behavior is **unverified**. A large user base also does not prove that every UI choice works well.

## What each app teaches us

| App | Observed pattern | Why it works for the ordering task | Transfer to RRJ | Boundary |
| --- | --- | --- | --- | --- |
| GrabFood | The official PH flow allows restaurant or dish search, item selection, order review, checkout, and payment. Its PH Help Centre exposes a dedicated **Check your order status** path. | Discovery begins with the food a person wants; status remains reachable after purchase. | Keep dish search easy to reach and keep order status in the main navigation. Show the real item and delivery charges before commitment. | Its marketplace, reward system, driver map, and other delivery modes are outside RRJ's single-restaurant workflow. We did not visually inspect a current GrabFood order screen. |
| foodpanda | A publisher food screenshot places address and search high, then category entry and a labeled bottom navigation. Philippine support directs customers to **Help Centre → Get Help with My Orders**. | First actions are easy to find; active and past orders have a predictable destination. | Give search and real menu categories prominence; retain an explicit Orders destination and route to existing help when needed. | The inspected food screen shows non-PH currency. Promotion tiles, restaurant filters, order-again content, and ETAs require capabilities or data RRJ may not have. |
| McDelivery PH | A publisher home screen puts delivery location and search before the menu; a labeled bottom bar separates Home, Menu, Orders, Coupons, More. Its tracking image emphasizes the current milestone, with order facts and payment beneath it. | This is a closer **single-brand** comparison: the restaurant is known, so the path should get to products and order status quickly. | Make the RRJ menu the main destination. Keep current persisted status dominant, with order number and payment state close by. | Do not import coupons, pickup, location confirmation, rider art, or estimated arrival without RRJ data and routes. The tracking image does not prove live update behavior. |

The takeaway is a **task hierarchy**, not a visual clone: find food → understand the item and price → complete the existing checkout → see the current order state. The three products differ in brand, catalog size, logistics, and promotional systems. RRJ should keep its own warm palette, type system, restaurant identity, real dishes, and GCash process.

## RRJ screen-by-screen fit

| RRJ screen | Current state found in source | Reference lesson | Design decision |
| --- | --- | --- | --- |
| Home | Restaurant banner, Explore menu and Track order actions, category strip, four available dishes. | McDelivery and foodpanda make food discovery immediately visible. | Keep Home short and food-led. Evaluate whether the banner and the separate Menu page add an extra decision on phones; make the first useful dish or category visible without scrolling. Avoid another text-heavy introduction. |
| Menu | Search by dish name/description, category chips, available-first list, item name, description, price, and action. | GrabFood and foodpanda support direct search and category scanning. | **Already aligned.** Focus on actual image coverage and scan speed rather than adding marketplace filters or promo rails. Use the existing category data. |
| Item detail | Existing item choices, quantity, price, and Add to Cart. | Each benchmark keeps selection tied to the item being bought. | Keep choices and quantity on the same focused surface. Show only verified dish media and current catalog facts. We have no competitor detail screenshot strong enough to justify a precise layout copy. |
| Cart | Editable items and estimated item subtotal; delivery fee is explicitly deferred to checkout. | The key decision is whether the buyer understands what will be charged. | Keep the estimate label and make the checkout handoff obvious. Do not imply the cart subtotal is the final payable amount. |
| Checkout | Existing Sign In → Delivery → Payment stages, server quote, order creation, and GCash proof. | Commitment needs a clear amount and a clear next action. | **Visual review required:** signed-in delivery, quote, and payment states were not captured in the previous redesign. Assess spacing, summary position, errors, and button labels using the existing flow; preserve the server-authoritative quote and payment safeguards. |
| Tracking | Persisted order state, next step, payment status, timeline, refresh/reconnect behavior. | McDelivery's screenshot gives the current stage first, then supporting facts. | **Conceptually aligned.** Judge hierarchy against a real order state before changing it. Never draw an invented ETA, rider location, or status milestone. |
| Navigation | Phone bottom bar: Menu, Cart, Track, Orders, More. | foodpanda and McDelivery use labeled persistent destinations. | **Already aligned.** Keep labels and distinguish active state. No need to add a separate Home tab just because McDelivery has one. |

## Most useful next design pass

1. **Settle Home versus Menu on a phone.** Use the existing public captures to compare two compositions with the same real content: (A) compact Home leading immediately to categories and dishes; (B) Menu as the first ordering surface with a small restaurant identifier. Pick the one that gets a new customer to an item with fewer decisions while keeping Track and Orders reachable. This is the highest-value unresolved UI question.
2. **Audit verified catalog images.** Count which currently orderable dishes have working `/menu/…` image paths. A trustworthy food image can improve scanning; an invented or broken image will hurt it. This is a content dependency, not a reason to fabricate photos.
3. **Capture authenticated checkout and tracking before redesigning them.** Compare the actual delivery, quote, GCash, payment-error, and persisted-status screens at phone width. The previous public walkthrough stopped at guest checkout, so no evidence yet supports a more detailed competitor-inspired treatment of those states.

## Guardrails for implementation

Keep existing routes, fields, handlers, catalog availability, pricing, server quote, GCash submission and retry behavior, order status history, and access rules. Do not add ratings, popularity, promotions, delivery estimates, driver maps, new fulfillment modes, or invented dish images. This study proposes UI decisions only; any future implementation should compare the same real content and preserve the current functional path.
