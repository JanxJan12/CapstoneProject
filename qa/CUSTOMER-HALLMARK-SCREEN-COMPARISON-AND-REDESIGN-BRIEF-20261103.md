# Customer ordering screen comparison and redesign brief

Date: 2026-11-03  
Scope: RRJ Food-Haus customer UI and UX. Existing routes, handlers, catalog data, prices, validation, sign-in, GCash proof, order creation, retries, and tracking contracts remain intact.

## Evidence and limits

- Public iPhone App Store screenshots inspected: [foodpanda](https://apps.apple.com/ph/app/foodpanda-food-groceries/id758103884), [McDelivery PH](https://apps.apple.com/ph/app/mcdelivery-ph/id908862359), and [Uber Eats](https://apps.apple.com/ph/app/uber-eats-food-groceries/id1058959277). The images are publisher-selected promotional material, not a live usability test or proof of the current checkout flow.
- RRJ local captures at 390×844 and 1440×900: [Home mobile](customer-hallmark-evidence-20261103/rrj-home-mobile.png), [Menu mobile](customer-hallmark-evidence-20261103/rrj-menu-mobile.png), [item detail mobile](customer-hallmark-evidence-20261103/rrj-detail-mobile.png), [cart mobile](customer-hallmark-evidence-20261103/rrj-cart-mobile.png), [guest checkout mobile](customer-hallmark-evidence-20261103/rrj-checkout-mobile.png), plus matching desktop files in the [evidence directory](customer-hallmark-evidence-20261103/). The captures used the current local app and a real read-only catalog. Adding one item to the local cart did not create a hosted order.
- Tracking, payment proof, order history, profile, authenticated checkout, and quote-confirmed checkout were inspected in source only. Their live visual states are **NOT TESTED** here. No hosted business data was changed.
- Popularity established the reference shortlist, not design quality. The February 2025 [Maybank/Momentum Works report](https://mkefactsettd.maybank-ke.com/PDFS/436431.pdf) gives Grab 61% and foodpanda 39% of Philippine platform food-delivery GMV in 2024. Current app-store ranks and global download counts use different metrics and must not be combined into one ranking.

## What the visible screens show

| Moment | Reference observation | RRJ observation | Design response |
| --- | --- | --- | --- |
| Enter ordering | The foodpanda and Uber Eats store images place search and quick navigation near the top. McDelivery's image identifies the delivery destination before showing food. | Home opens with a restaurant introduction, category chips, and four dishes; Menu repeats category navigation and adds search. The mobile header shows logo, cart, and a menu button, so the primary Menu destination is one tap inside the drawer. | Give Menu the clearest route into ordering. Keep Home for restaurant identity and a short path to the menu; avoid presenting it as a second full menu. Keep all current destinations reachable. |
| Find a dish | The foodpanda and Uber Eats images use food imagery and short labels to aid scanning. | RRJ shows large, equally weighted cards. In the captured Menu, unavailable dishes appear first and use almost as much visual space as available dishes. Some descriptions are missing. | Use a simpler, denser dish row or compact card. Give availability a readable but quiet treatment. Do not fabricate descriptions, popularity, ratings, or pictures. Any change to catalog ordering needs separate review because it changes what customers see first. |
| Choose an item | Public store images do not show a reliable comparable item-detail state. | RRJ's mobile detail screen has a large name, price, quantity control, and Add to Cart action, but much of the screen is blank when no verified image or choices exist. | Make the item, real choices, price, and action one coherent composition. If no image exists, use text hierarchy rather than an artificial plate or unrelated photo. Keep actual choice and quantity rules. |
| Review the cart | Uber Eats' published receipt image makes the total prominent and uses a restrained list for items and options. | RRJ's cart uses an emoji dish thumbnail, a separate estimate card, a long explanation, and a bottom checkout bar. The transient add-to-cart toast overlaps the bottom bar in the capture. | Remove emoji thumbnails. Put item edits and the estimated subtotal in one clear reading order. Keep the fee and final-total uncertainty explicit. Check transient toast and fixed action overlap on small screens. |
| Checkout and payment | Public reference images do not verify the live checkout forms. [Uber Eats' help](https://help.uber.com/en-GB/ubereats/restaurants/article/%CF%80%CF%8E%CF%82-%CE%BD%CE%B1-%CF%80%CE%B1%CF%81%CE%B1%CE%B3%CE%B3%CE%B5%CE%AF%CE%BB%CE%B5%CF%84%CE%B5-%CE%BC%CE%AD%CF%83%CF%89-uber-eats?nodeId=509d1b2f-087c-4dac-9e94-6ab248e87491) confirms an order-review step before placement. | RRJ guest checkout shows a three-step progress bar, a sign-in card, and a separate summary card. Estimate and final-price caveats repeat in the heading, summary, and helper copy. | Show one current task and one concise price explanation at a time. Keep sign-in, quote, order creation, GCash proof, and same-order retry states. Preserve the distinction between estimated, quoted, and server-confirmed amounts. |
| Follow the order | McDelivery's published tracking image highlights the current milestone and places order facts beneath it. [foodpanda](https://www.foodpanda.ph/contents/apps) and [DoorDash](https://help.doordash.com/en-us/consumers/article/customer-where-is-my-order) describe visible order status. | RRJ tracking source has order status, payment status, next action, order items, charges, and a timeline. Signed-in rendering was not captured. | Lead with the server-backed current status and the required next action; use the existing timeline and details below. Never display an ETA, map position, or stage that RRJ cannot verify. |

## RRJ visual diagnosis

1. **Type has too many voices.** `src/styles/fonts.css` loads Fraunces and Manrope. Customer page titles use Fraunces while controls and data often use extra-bold or black Manrope. The serif is effective for a restaurant introduction but makes routine transaction screens feel promotional.
2. **Every region receives similar emphasis.** Rounded cards, pills, tinted surfaces, icons, and soft shadows recur across menu, cart, and checkout. This makes the primary action harder to distinguish from supporting information.
3. **Catalog imagery is inconsistent across the journey.** Home and Menu avoid misleading pictures when catalog paths are absent, but the cart still renders a category emoji on a gradient (`customerCartPage.tsx`). Verified dish photos would help; mismatched local files must not be assigned to live dishes.
4. **The customer journey has two entry points that look alike.** Home and Menu both present categories and dishes. Home should identify RRJ and move customers toward ordering; Menu should be the working surface for search, filtering, and selection.
5. **Price truth is present but verbose.** The cart and checkout correctly distinguish estimates from server amounts. The redesign should reduce repeated explanations while keeping those distinctions prominent at the point of commitment.

## Design direction for a prototype

**Character:** Warm and recognizably RRJ, with the clarity of a task-focused ordering app. Use the existing logo and orange as the brand signal; use status colors only for actual availability, payment, and order states.

**Typography:** Prototype a single practical sans-serif system for transactional screens, with normal, semibold, and bold weights. Keep the restaurant display face only if a side-by-side comparison shows that it helps the brand introduction. Prices and order numbers need tabular numerals and clear hierarchy, not decorative type.

**Surfaces:** One calm canvas, one primary action style, consistent spacing, and restrained borders. Use cards only where an item or task genuinely needs a boundary. Reduce nested cards, badges, gradients, and drop shadows. Use real product photography only when a catalog item has a verified matching asset.

**Navigation:** Make Menu, Cart, Orders/Tracking, and Account discoverable on a phone without requiring customers to decode an icon-only drawer. Preserve all current destinations and handlers. Prototype the exact mobile navigation arrangement before changing the shared shell.

**Screen order:**

1. Menu: search, categories, available dish information, and a clear path to item details.
2. Item detail: name, description, available choices, quantity, price, and Add to Cart.
3. Cart: item edits, estimated subtotal, fee uncertainty, and Continue to checkout.
4. Checkout: sign-in, delivery details, quote review, order creation, and GCash submission as distinct current tasks.
5. Tracking: current order and payment status, the next action, then timeline and receipt details.
6. Apply the same type, spacing, and navigation system to Home, History, and Profile.

## Implementation boundary and acceptance

- First make a visual prototype of Menu → item detail → Cart → guest checkout and a source-backed Tracking state. Review it against the reference screenshots before applying it to the live customer components.
- Keep all existing routes, props, ids, form fields, handlers, validation, server quotes, payment proof behavior, retry safeguards, and real statuses. Do not add guest checkout, promotional offers, ratings, reordering, maps, or estimated arrival times as part of this visual redesign.
- Verify 390×844, 768×1024, and 1440×900; keyboard focus and reduced motion; loading, empty, error, unavailable, and full states. Report authenticated checkout, payment, and tracking as **NOT TESTED** until they have genuine signed-in acceptance evidence. Do not create hosted orders simply to make screenshots.

## Decision to take into the prototype

The strongest starting point is a single-sans, menu-centered customer interface with RRJ's logo and orange retained. The benchmark supports its information hierarchy; RRJ's actual workflow and server truth determine the content. The prototype should settle the typeface, mobile navigation, item density, and checkout emphasis together before implementation.
