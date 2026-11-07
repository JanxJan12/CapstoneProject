# Graph Report - kitchen  (2026-11-04)

## Corpus Check
- 3 files · ~2,878 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 47 nodes · 85 edges · 7 communities (5 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9748bdef`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- kdsTerminalService.ts
- index.tsx
- KitchenQueue.tsx
- KitchenApp
- KitchenQueue
- kitchenRpcError
- KdsTerminalError

## God Nodes (most connected - your core abstractions)
1. `KitchenApp()` - 8 edges
2. `KitchenQueue()` - 8 edges
3. `loadKdsSession()` - 6 edges
4. `KdsTerminalError` - 5 edges
5. `kitchenRpcError()` - 5 edges
6. `KitchenTicket()` - 4 edges
7. `verifyKdsTerminal()` - 4 edges
8. `fetchKdsQueue()` - 4 edges
9. `advanceKdsOrder()` - 4 edges
10. `clearKdsSession()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `KitchenApp()` --calls--> `KitchenQueue()`  [EXTRACTED]
  src/modules/kitchen/index.tsx → src/modules/kitchen/queue/KitchenQueue.tsx
- `KitchenApp()` --calls--> `verifyKdsTerminal()`  [EXTRACTED]
  src/modules/kitchen/index.tsx → src/modules/kitchen/services/kdsTerminalService.ts
- `KitchenQueue()` --calls--> `advanceKdsOrder()`  [EXTRACTED]
  src/modules/kitchen/queue/KitchenQueue.tsx → src/modules/kitchen/services/kdsTerminalService.ts
- `KitchenQueue()` --calls--> `fetchKdsQueue()`  [EXTRACTED]
  src/modules/kitchen/queue/KitchenQueue.tsx → src/modules/kitchen/services/kdsTerminalService.ts
- `KitchenQueue()` --calls--> `loadKdsSession()`  [EXTRACTED]
  src/modules/kitchen/queue/KitchenQueue.tsx → src/modules/kitchen/services/kdsTerminalService.ts

## Import Cycles
- None detected.

## Communities (7 total, 2 thin omitted)

### Community 0 - "kdsTerminalService.ts"
Cohesion: 0.18
Nodes (8): AdvanceKdsOrderResult, AdvanceKdsOrderRpcResult, KdsOrderStatus, KdsQueueItem, KdsQueueRpcItem, KdsQueueRpcRow, KdsTerminalCredential, VerifyKdsTerminalResult

### Community 2 - "KitchenQueue.tsx"
Cohesion: 0.20
Nodes (3): COLUMNS, KdsFulfillmentType, KdsQueueTicket

### Community 3 - "KitchenApp"
Cohesion: 0.40
Nodes (6): KitchenApp(), KitchenTerminalActivation(), KitchenTerminalLoading(), clearKdsSession(), loadKdsSession(), saveKdsSession()

### Community 4 - "KitchenQueue"
Cohesion: 0.67
Nodes (4): formatFulfillmentType(), formatKitchenStatus(), KitchenQueue(), KitchenTicket()

### Community 5 - "kitchenRpcError"
Cohesion: 0.50
Nodes (4): advanceKdsOrder(), fetchKdsQueue(), kitchenRpcError(), verifyKdsTerminal()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `KdsTerminalError` connect `KdsTerminalError` to `kdsTerminalService.ts`, `index.tsx`, `KitchenQueue.tsx`, `kitchenRpcError`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `KitchenQueue()` connect `KitchenQueue` to `index.tsx`, `KitchenQueue.tsx`, `KitchenApp`, `kitchenRpcError`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `KitchenApp()` connect `KitchenApp` to `index.tsx`, `KitchenQueue`, `kitchenRpcError`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._