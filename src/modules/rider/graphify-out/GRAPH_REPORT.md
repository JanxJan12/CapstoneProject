# Graph Report - rider  (2026-11-04)

## Corpus Check
- 10 files · ~10,771 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 85 nodes · 166 edges · 14 communities (8 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9748bdef`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supabaseRiderService.ts
- index.tsx
- c_users_janmari_downloads_capstone_project_src_components_common_badge_statusbadge
- HomeTab
- fetchActiveRiderDelivery
- DeliveryDetailScreen
- UploadProofScreen
- DeliveryRequestsTab
- RiderHome.tsx
- RiderApp
- DeliveryRequests.tsx
- RiderProfile.tsx
- RiderRetryButton

## God Nodes (most connected - your core abstractions)
1. `RiderApp()` - 11 edges
2. `HomeTab()` - 9 edges
3. `RiderRetryButton()` - 8 edges
4. `DeliveryRequestsTab()` - 8 edges
5. `fetchActiveRiderDelivery()` - 8 edges
6. `UploadProofScreen()` - 7 edges
7. `DeliveryDetailScreen()` - 6 edges
8. `fetchRiderOffers()` - 6 edges
9. `ProfileTab()` - 5 edges
10. `fetchRiderProfile()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `HomeTab()` --calls--> `fetchActiveRiderDelivery()`  [EXTRACTED]
  src/modules/rider/index.tsx → src/modules/rider/services/supabaseRiderService.ts
- `HomeTab()` --calls--> `fetchRiderOffers()`  [EXTRACTED]
  src/modules/rider/index.tsx → src/modules/rider/services/supabaseRiderService.ts
- `HomeTab()` --calls--> `subscribeToRiderAssignmentChanges()`  [EXTRACTED]
  src/modules/rider/index.tsx → src/modules/rider/services/supabaseRiderService.ts
- `DeliveryRequestsTab()` --calls--> `acceptRiderOffer()`  [EXTRACTED]
  src/modules/rider/index.tsx → src/modules/rider/services/supabaseRiderService.ts
- `DeliveryRequestsTab()` --calls--> `fetchRiderOffers()`  [EXTRACTED]
  src/modules/rider/index.tsx → src/modules/rider/services/supabaseRiderService.ts

## Import Cycles
- None detected.

## Communities (14 total, 6 thin omitted)

### Community 0 - "supabaseRiderService.ts"
Cohesion: 0.11
Nodes (16): acceptRiderOffer(), AcceptRiderOfferResult, AdvanceRiderDeliveryResult, AssignmentRow, CompleteRiderDeliveryResult, OrderItemRow, OrderRow, RejectRiderOfferResult (+8 more)

### Community 1 - "index.tsx"
Cohesion: 0.20
Nodes (7): BottomTab, PendingOfferAcceptance, RiderScreen, RiderDashboardStats, RiderDeliveryHistoryItem, RiderProfile, RiderProfileStats

### Community 4 - "HomeTab"
Cohesion: 0.40
Nodes (6): HomeTab(), ProfileTab(), fetchRiderDashboardStats(), fetchRiderProfile(), fetchRiderProfileStats(), setRiderAvailability()

### Community 5 - "fetchActiveRiderDelivery"
Cohesion: 0.40
Nodes (6): NavAssistScreen(), fetchActiveRiderDelivery(), fetchRiderDeliveryHistory(), fetchRiderOffers(), modifierNames(), toNumber()

### Community 6 - "DeliveryDetailScreen"
Cohesion: 0.40
Nodes (4): DeliveryDetailScreen(), advanceRiderDelivery(), fetchRiderCompletionSnapshot(), RiderAdvanceRejectedError

### Community 7 - "UploadProofScreen"
Cohesion: 0.40
Nodes (4): UploadProofScreen(), completeRiderDelivery(), RiderCompletionRejectedError, uploadRiderDeliveryProof()

### Community 8 - "DeliveryRequestsTab"
Cohesion: 0.50
Nodes (4): DeliveryRequestsTab(), fetchRiderAssignmentSnapshot(), rejectRiderOffer(), subscribeToRiderAssignmentChanges()

### Community 10 - "RiderApp"
Cohesion: 0.67
Nodes (3): BottomNav(), PhoneShell(), RiderApp()

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RiderAdvanceRejectedError` connect `DeliveryDetailScreen` to `supabaseRiderService.ts`, `index.tsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `supabaseRiderService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Why does `RiderCompletionRejectedError` connect `UploadProofScreen` to `supabaseRiderService.ts`, `index.tsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `RiderOfferRejectedError` connect `supabaseRiderService.ts` to `index.tsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._