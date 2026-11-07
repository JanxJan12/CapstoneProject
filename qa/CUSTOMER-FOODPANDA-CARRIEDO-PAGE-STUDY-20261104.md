# Jollibee Carriedo on foodpanda: customer module study

Date: 2026-11-04. Source: [foodpanda's Jollibee Carriedo listing](https://www.foodpanda.ph/restaurant/d8wg/jollibee-carriedo), indexed by the web search service. The user supplied the same URL with latitude/longitude parameters. Direct foodpanda requests returned HTTP 403, and the computer-use browser host was unavailable. This is a study of the indexed restaurant page, not a live session or a screenshot review.

## Ordering structure visible in the page

1. **Restaurant identity and service facts come first.** The listing names Jollibee Carriedo, shows delivery/minimum-order information, a rating and reviews link, More info, and an app-only deals area. These are contextual to this foodpanda listing and may change with delivery address or time.
2. **Search precedes the catalog.** The page exposes a Search in menu input before category navigation. The category list provides direct routes to product groups and shows item counts. This makes a large catalog easier to scan.
3. **Products are grouped and priced at the decision point.** Category sections show product names, prices, descriptions, and image references. Some listings say `from ₱…`, which communicates a starting price before the customer chooses a variant. The indexed text does not expose the item selector or final charge calculation.
4. **The page separates marketplace claims from the menu.** The Popular group, review count, and app-only deals rely on foodpanda data. They are not generic requirements for a restaurant storefront.

## Transfer to RRJ

| Pattern | RRJ today | Design implication |
| --- | --- | --- |
| Search visible before categories | RRJ Menu has search above category chips; Home links to Menu. | Keep search prominent on Menu. A one-tap path from Home to it matters more than adding another promotional section. |
| Categories lead to grouped food | RRJ Home and Menu use real catalog categories. | Keep the category strip readable and compact. RRJ's smaller catalog does not need foodpanda's category counts or long sidebar. |
| Name and price beside each product | RRJ Menu exposes name, description, price, and View item. | Preserve this hierarchy. When a verified catalog image path exists, use that image; do not map similarly named local files by guess. |
| Starting price distinguished from selected price | RRJ item detail calculates its selected meal/drink amount; Cart remains an estimate until the server quote. | Keep the selected amount visible by the Add action and retain explicit estimate/confirmed labels through checkout. |
| Ratings, Popular, deals, minimum order | RRJ has no verified equivalent in its customer module. | Do not add these claims or imitate their visual badges. |

## Evidence boundary

The indexed page does not show a cart, item customization modal, delivery fee at checkout, payment, tracking, or interaction states. Its crawl predates this study. RRJ's existing GCash, server quote, and order-state workflows cannot be evaluated from this reference.

Graphify outputs for the two-document evidence corpus are in `qa/foodpanda-carriedo-graph-corpus/graphify-out/`: `graph.html`, `graph.json`, and `GRAPH_REPORT.md`. The graph has 11 nodes, 17 edges, and three labeled communities. Its integrity check found no missing endpoints, dangling edges, self-loops, or collapsed edge pairs. The bridge is the menu discovery sequence from search to category to product row; the RRJ comparisons are explicitly marked as inferred where appropriate. Subagent token usage was not exposed, so Graphify's displayed zero token cost means unreported.
