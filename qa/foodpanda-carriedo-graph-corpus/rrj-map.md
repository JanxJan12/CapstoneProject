# RRJ customer module mapping from the Jollibee Carriedo page

Evidence source: [foodpanda indexed observation](foodpanda-observation.md). RRJ source inspected: `src/modules/customer/customerMenuPages.tsx`, `customerCartPage.tsx`, `customerCheckoutPage.tsx`, `customerTrackingPage.tsx`, and `customerNav.tsx`. The comparison is about presentation only; RRJ's functions and workflow stay in place.

## Relationships

Foodpanda's restaurant entry leads into Search in menu, followed by menu categories and grouped products. RRJ Home currently has a restaurant introduction, category strip, and available dishes. RRJ Menu already has name/description search and category chips. The useful transfer is to make menu search and category selection visible early; it does not require another storefront page or marketplace features.

Foodpanda's product rows put product name and price at the decision point. RRJ Menu already presents those facts. RRJ item detail holds existing rice and drink choices, quantity, price, and Add to Cart. When RRJ lacks a catalog image path, the menu should remain honest and readable without a guessed dish photo.

Foodpanda's visible restaurant rating, review count, Popular list, deals, and minimum order belong to its marketplace listing. RRJ does not have verified ratings, popularity, deal, or minimum-order data in the customer module. Do not transfer those claims or fake their appearance.

The indexed page does not show a cart or checkout, so it cannot support a redesign claim about RRJ's server quote, delivery fee, GCash payment, or order tracking. Those RRJ flows remain governed by their current source and need their own authenticated visual review.
