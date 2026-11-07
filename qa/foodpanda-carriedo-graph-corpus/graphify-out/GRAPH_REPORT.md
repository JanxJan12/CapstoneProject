# Graph Report - foodpanda-carriedo-graph-corpus  (2026-11-04)

## Corpus Check
- Corpus is ~536 words - fits in a single context window. You may not need a graph.

## Summary
- 11 nodes · 17 edges · 3 communities (1 shown, 2 thin omitted)
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Menu discovery and product choice
- Source and evidence limits
- Marketplace listing claims

## God Nodes (most connected - your core abstractions)
1. `Foodpanda indexed page observation` - 5 edges
2. `RRJ customer module presentation mapping` - 5 edges
3. `Search in menu` - 4 edges
4. `Grouped product rows with names and prices` - 4 edges
5. `Jollibee Carriedo restaurant entry` - 3 edges
6. `RRJ Menu search, categories, and product facts` - 3 edges
7. `Menu categories` - 2 edges
8. `Indexed page evidence limit` - 2 edges
9. `RRJ item detail choices, quantity, price, and Add to Cart` - 2 edges
10. `Ratings, popularity, deals, and minimum order lack RRJ evidence` - 2 edges

## Surprising Connections (you probably didn't know these)
- `RRJ Menu search, categories, and product facts` --semantically_similar_to--> `Search in menu`  [INFERRED] [semantically similar]
  rrj-map.md → foodpanda-observation.md
- `RRJ Menu search, categories, and product facts` --semantically_similar_to--> `Grouped product rows with names and prices`  [INFERRED] [semantically similar]
  rrj-map.md → foodpanda-observation.md
- `RRJ item detail choices, quantity, price, and Add to Cart` --semantically_similar_to--> `Grouped product rows with names and prices`  [INFERRED] [semantically similar]
  rrj-map.md → foodpanda-observation.md
- `RRJ customer module presentation mapping` --cites--> `Foodpanda indexed page observation`  [EXTRACTED]
  rrj-map.md → foodpanda-observation.md
- `Ratings, popularity, deals, and minimum order lack RRJ evidence` --references--> `Jollibee Carriedo restaurant entry`  [EXTRACTED]
  rrj-map.md → foodpanda-observation.md

## Hyperedges (group relationships)
- **Foodpanda menu discovery sequence** — foodpanda_observation_menu_search, foodpanda_observation_menu_categories, foodpanda_observation_product_rows [EXTRACTED 1.00]

## Communities (3 total, 2 thin omitted)

### Community 0 - "Menu discovery and product choice"
Cohesion: 0.50
Nodes (5): Menu categories, Search in menu, Grouped product rows with names and prices, RRJ Menu search, categories, and product facts, RRJ item detail choices, quantity, price, and Add to Cart

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RRJ customer module presentation mapping` connect `Source and evidence limits` to `Menu discovery and product choice`, `Marketplace listing claims`?**
  _High betweenness centrality (0.306) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Grouped product rows with names and prices` (e.g. with `RRJ Menu search, categories, and product facts` and `RRJ item detail choices, quantity, price, and Add to Cart`) actually correct?**
  _`Grouped product rows with names and prices` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Why does `Foodpanda indexed page observation` connect `Source and evidence limits` to `Menu discovery and product choice`, `Marketplace listing claims`?**
  _High betweenness centrality (0.303) - this node is a cross-community bridge._
- **Why does `Grouped product rows with names and prices` connect `Menu discovery and product choice` to `Source and evidence limits`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
Token note: The collaboration tool did not expose subagent token usage; 0 above means unreported, not free.
