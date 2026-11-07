# Hallmark study: Jollibee Carriedo on foodpanda

Date: 2026-11-04. Reference: [foodpanda restaurant listing](https://www.foodpanda.ph/restaurant/d8wg/jollibee-carriedo). The supplied URL adds location parameters. Evidence now includes nine user-provided desktop screenshots (`Screenshot 2026-11-04 070242.png` through `070321.png`) and the previously indexed page text. Direct site access returned HTTP 403; the screenshots provide the visual evidence below. Mobile layout and behavior beyond the captured states remain unverified.

Representative captures: [restaurant header](<C:/Users/Janmari/Pictures/Screenshots/Screenshot 2026-11-04 070242.png>), [featured products and empty cart](<C:/Users/Janmari/Pictures/Screenshots/Screenshot 2026-11-04 070248.png>), [dense menu cards](<C:/Users/Janmari/Pictures/Screenshots/Screenshot 2026-11-04 070309.png>), and [scrolled category state](<C:/Users/Janmari/Pictures/Screenshots/Screenshot 2026-11-04 070321.png>).

## The useful design idea

The page puts the customer's ordering decision in a short sequence: identify the restaurant, search or pick a category, then compare dishes beside a persistent cart. In the screenshots, the menu takes the wide left column and the cart keeps the narrower right column. The food photography and product names carry the screen. The offer area is visually separate and sits above the menu.

| Observed on the reference | Design reason | RRJ translation |
| --- | --- | --- |
| Restaurant name and service facts precede the menu. | The customer knows where they are and whether ordering is plausible. | Keep RRJ identity and actual availability concise above the catalog. Do not add an unsupported delivery promise. |
| Menu search appears before category navigation. | A customer who knows the dish can skip browsing. | Keep Search dishes prominent on the Menu screen and make Menu reachable directly from Home. |
| Named categories divide a large menu. | Customers can narrow the choice without reading every row. | Keep RRJ's real categories; a compact strip suits its smaller catalog better than a long marketplace list. |
| Product rows expose name, price, description, and an image reference. | The comparison happens at the food item, where a choice is made. | Let dish name and price dominate each RRJ row. Use only verified catalog images; avoid a decorative placeholder competing with actual food. |
| Some menu amounts are labelled as starting prices. | Variants can change the final amount. | Show RRJ's selected amount beside Add to cart; continue distinguishing cart estimate from server-confirmed checkout total. |

## What the screenshots reveal

1. **Fixed ordering context.** The top bar keeps the brand, delivery address, account, language, favorites, and basket visible. Further down, the menu search and category strip remain at the top of the viewport while the dishes change beneath them. The active category has a dark underline; the screenshots show it on Popular, Breakfast, Super Meals, and Chickenjoy at different positions. This keeps menu orientation visible during a long scroll.
2. **Two product treatments.** Popular uses large, photograph-led vertical cards in four columns. Later categories switch to denser horizontal cards in two columns: name, starting price, and a short description on the left; food image and a circular plus action on the right. This gives the initial featured set more visual weight without making every item equally large.
3. **Persistent cart.** A tall cart panel remains beside the menu in every scrolled capture. Its mode choice is at the top and its total, summary link, and disabled checkout action sit at the bottom. The empty illustration and message make the state clear, though the large unused space is costly when the cart is empty.
4. **Restrained colour.** Most surfaces are white with fine grey outlines, dark text, and food photos. Pink is concentrated in the brand, a highlighted product background, and small accents. The stronger visual contrast comes from the food images and typographic weight.
5. **Clarity limits.** Several long dish names and descriptions end with ellipses, especially in the horizontal cards. The price is readable but often quieter than the title. The oversized restaurant header and deal section put the first full menu row below the initial fold. These are tradeoffs visible in the captures, not patterns RRJ needs to copy.

## Hallmark read for the RRJ customer module

**One idea per screen:** Home should get the customer into the food; Menu should help them find and compare dishes; Item detail should resolve options and amount; Cart and Checkout should resolve the purchase; Tracking should show the persisted order state. The foodpanda reference supports the Menu portion directly. It gives no evidence about the other screens' rendered designs.

**Hierarchy to test in a redesign:** a concise RRJ identity → search and categories → food-first rows with name and price → item action → visible cart status. RRJ already has a search field, category controls, and priced product rows in `customerMenuPages.tsx`, so the opportunity is a clearer hierarchy rather than another feature. The reference's two product treatments suggest giving a small number of real dishes visual emphasis while keeping the rest dense and easy to scan; RRJ should only do this if verified catalog images support it.

**Adapt the cart to RRJ's scale:** the right panel is effective at keeping the order in view on a wide screen, but the foodpanda empty state uses a lot of space. If RRJ uses a desktop cart summary, keep the empty state compact and let the food retain priority. A phone layout cannot be inferred from these desktop screenshots.

**Avoid marketplace-specific decoration:** the reference includes popularity, ratings, reviews, discounts, and a minimum order. These depend on foodpanda's own data and context. RRJ has no verified equivalent to import. Avoid invented counts, review badges, offers, delivery fees, or delivery estimates.

## Evidence boundary and next design move

The screenshots show the restaurant header, deals, pinned menu navigation, several product sections, highlighted card colour, and an empty desktop cart. They do not show an item selector, filled cart, checkout, payment, tracking, mobile layout, keyboard focus, or motion. The captures cannot prove how the search, category navigation, add control, or checkout behaves after interaction. Listing facts and prices may vary by branch, address, and time.

For RRJ, the next bounded design move is a Menu composition study at phone and desktop widths: keep search and categories easy to reach, give food and price immediate prominence, and make cart status visible without a large empty panel. Compare dish scan time and price/action clarity against the current screen. Keep existing routes, handlers, catalog data, pricing, and order workflows intact.
