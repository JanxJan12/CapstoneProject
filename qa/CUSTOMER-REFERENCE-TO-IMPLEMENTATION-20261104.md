# Customer redesign: reference decisions

Date: 2026-11-04. Basis: public publisher screenshots from [foodpanda](https://apps.apple.com/ph/app/foodpanda-food-groceries/id758103884), [McDelivery PH](https://apps.apple.com/ph/app/mcdelivery-ph/id908862359), and [Uber Eats](https://apps.apple.com/ph/app/uber-eats-food-groceries/id1058959277), compared with [RRJ captures](customer-hallmark-evidence-20261103/) and the [local prototype](customer-ordering-prototype-20261104/). The publisher images are curated examples, not proof of current live flows.

| Screen | Visible reference pattern | RRJ gap | Decision for RRJ |
| --- | --- | --- | --- |
| Navigation | McDelivery and Uber Eats show persistent, labeled phone destinations. | RRJ's phone destinations sit behind a drawer; the cart alone is prominent. | Put Menu, Cart, Track, and Orders in a labeled phone bar; keep Home through the logo and account actions in More. Keep the existing drawer for account and sign-out. |
| Menu entry | foodpanda and Uber Eats place search before content; McDelivery makes search and food visible without several intro cards. | RRJ spends the first phone viewport on a large title, filter card, and unavailable dishes. | Put search and compact category controls directly on the page. Make dish names, availability, and prices scannable. Keep catalog ordering unchanged in live code; the available-first grouping in the static prototype remains a proposal. |
| Food imagery | All three reference images use specific food photography where it matches the item or restaurant. | RRJ's live catalog capture does not prove matching image paths for the pictured dishes. | Keep real, verified item images where the catalog supplies them. Use text hierarchy when it does not. The existing restaurant photo may identify the venue, never a dish. |
| Item choice | The references do not provide a reliable item-choice state. | RRJ's detail is a rounded card with excess blank space when no image exists. | Recompose title, description, choice controls, quantity, and price without adding choices or altering their rules. |
| Cart and checkout | Uber Eats' receipt emphasizes the total and reduces item-list decoration. | RRJ repeats estimate caveats and gives the emoji cart thumbnail more space than item detail. | Remove the decorative emoji, preserve the estimate versus server-confirmed distinction, and make the next action clear. |
| Tracking | McDelivery emphasizes the current milestone before the remaining timeline. | RRJ has the right server-backed facts but distributes attention across multiple equal cards. | Lead with the real status and next action, followed by payment, items, charges, and timeline. Do not copy the reference's ETA, map, or delivery illustration. |

## Scope of implementation

These are layout, typography, navigation, and presentation decisions. Existing routes, handlers, data fetching, product availability, choices, pricing, quote, order creation, payment proof, retries, and tracking authority stay in place. Public screenshots guide hierarchy; RRJ's current catalog and server data remain the source of truth.
