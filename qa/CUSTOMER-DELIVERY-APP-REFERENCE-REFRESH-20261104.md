# Customer delivery app reference shortlist

Date: 2026-11-04. Purpose: choose credible UI references for RRJ Food-Haus, a single-restaurant customer ordering app. This is research only; no customer code or hosted data was changed.

## Popularity and comparability

Momentum Works' 2026 reporting on the 2025 Southeast Asian market identifies Grab as the dominant platform across the six countries it tracks and foodpanda as the second-largest platform in the Philippines. Its free summary does not provide a current Philippines-only percentage. A 2024 Philippines estimate of Grab 61% / foodpanda 39% appears in the earlier [RRJ comparison](CUSTOMER-HALLMARK-SCREEN-COMPARISON-AND-REDESIGN-BRIEF-20261103.md); do not present that split as a 2026 figure. Source: [Momentum Works, March 2026](https://thelowdown.momentum.asia/why-deliveroos-exit-from-singapore-isnt-quite-a-surprise/), [2025 regional report summary](https://thelowdown.momentum.asia/new-report-southeast-asia-food-delivery-gmv-grew-18-to-hit-us22-7b-in-2025/).

| Reference | Why it belongs | RRJ screen to study | Evidence |
| --- | --- | --- | --- |
| GrabFood | Philippine platform leader; closest local delivery convention | Discovery, menu search, order summary and status | [GrabFood PH](https://www.grab.com/ph/food/), [Grab app](https://apps.apple.com/ph/app/grab-food-delivery-taxi-ride/id647268330) |
| foodpanda | Second Philippine platform; strong local recognition | Search, category entry, order history and tracking access | [foodpanda PH](https://www.foodpanda.ph/), [publisher screenshots](https://apps.apple.com/ph/app/foodpanda-food-groceries/id758103884) |
| McDelivery PH | Single-brand delivery closer to RRJ's structure than a marketplace | Menu entry, labeled phone navigation, current order status | [publisher screenshots](https://apps.apple.com/ph/app/mcdelivery-ph/id908862359), [McDelivery PH](https://socials.mcdelivery.com.ph/) |
| Jollibee | Philippine single-brand ordering | Item choices, checkout steps and order progress | [publisher app listing](https://apps.apple.com/ph/app/jollibee-food-delivery-app/id6498993119) |
| Uber Eats | Large international reference; not a leading Philippine marketplace | Search placement, category scanning, persistent cart/orders destinations | [publisher screenshots](https://apps.apple.com/ph/app/uber-eats-food-groceries/id1058959277), [official flow](https://about.ubereats.com/) |
| DoorDash | Large international reference; its market scale is documented, but it is not a Philippine service benchmark | Order-status clarity and help access | [2025 results](https://ir.doordash.com/news/news-details/2026/DoorDash-Releases-Fourth-Quarter-and-Full-Year-2025-Financial-Results/default.aspx), [order status help](https://help.doordash.com/en-us/consumers/article/customer-where-is-my-order) |

## Patterns actually supported by the inspected material

- Publisher screenshots of foodpanda, McDelivery and Uber Eats place search or a direct route to the menu high on the first screen and use labeled phone navigation. The local copies are in `.codex-temp/hallmark-reference/` and were inspected again for this refresh.
- McDelivery's published tracking image makes the current milestone visually dominant and puts order facts below it. Its estimated arrival and delivery illustration are product-specific claims, not patterns RRJ can copy without data.
- GrabFood's official ordering page describes the path from restaurant or dish search to menu selection, checkout and payment. Its multi-restaurant discovery, rewards, and delivery modes do not belong in RRJ's single-restaurant scope.
- Jollibee's app listing describes customization, checkout, and progress, but the listing is not evidence of the current live state quality. It is a closer structural comparison than a marketplace feed.
- The inspected store images are selected by publishers for promotion. They do not prove current authenticated checkout, payment, tracking, speed, accessibility, or conversion performance. Popularity does not prove a better UX.

## RRJ decision

Use **GrabFood and foodpanda** for familiar Philippine search and navigation conventions; **McDelivery PH and Jollibee** for single-restaurant flow; **Uber Eats and DoorDash** only for specific clarity patterns. Preserve RRJ's actual catalog, prices, choices, server-confirmed totals, GCash proof, and persisted order states. Do not introduce unverified offers, ratings, delivery estimates, maps, recommendations, or photos.
