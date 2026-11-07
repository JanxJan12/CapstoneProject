# MGR-01 — Menu administration policy and requirements

**Assessment:** 2026-10-23. **Status:** TECHNICALLY ASSESSED — AWAITING BUSINESS APPROVAL. This report records requirements and proposes a restaurant decision; it does not authorize new menu editing.

## Evidence and authority

The [historical design blueprint](../docs/design/rrj-foodhouse-blueprint.md#L1) says it was based on an approved capstone manuscript, but the manuscript or a signed restaurant decision was not available in the inspected repository. Its [Menu Management section](../docs/design/rrj-foodhouse-blueprint.md#L126) proposes Menu List, Add/Edit Menu Item, Category Management, details, search, category filtering, availability, price, description, an image placeholder, and Add/Edit/Delete. Its statement that a Manager can add, edit, delete, and change availability is **DOCUMENTED BUT UNCONFIRMED** as restaurant operating authority. The [prototype brief](../docs/design/rrj-foodhouse-app-prototype.md#L289) is a product design prompt, not evidence of field-level approval. No client interview, signed requirement, owner approval, or delegated price/image/recipe authority was found among the repository's requirement/design documents or the [Manager audit](MANAGER-MODULE-COMPREHENSIVE-AUDIT-202610.md#L85). Thus **CONFIRMED BY CLIENT: none established by this assessment**. This means authority is unknown, not that the restaurant rejected the feature.

The current [Manager route](../src/modules/manager/index.tsx#L393) mounts [MenuManagementPage](../src/modules/manager/menu/MenuManagementPage.tsx#L39). Source inspection confirms listing, name/code search, category filtering, manual availability, Fixed Meal Options for existing items, and adjustments/active state for existing Drink Choices. It does not expose ordinary product/category creation or editing, base price/description/image editing, or archiving. The [Manager audit](MANAGER-MODULE-COMPREHENSIVE-AUDIT-202610.md#L39), [recommendations](MANAGER-MODULE-UI-UX-RECOMMENDATIONS-202610.md#L17), and [roadmap](MANAGER-MODULE-IMPLEMENTATION-ROADMAP-202610.md#L46) explicitly leave owner policy open. Prior [Batch 2 synthetic browser evidence](MANAGER-MODULE-BATCH-2-IMPLEMENTATION-202610.md#L47) displayed existing rows and controls; it did not prove authenticated hosted behavior or restaurant approval.

## Authority matrix for restaurant review

| Operation | Current technical state | Requirement classification | Proposed restaurant policy; approval status |
|---|---|---|---|
| View products/categories; search/filter | Mounted Manager read, search, category chips | TECHNICALLY POSSIBLE; design DOCUMENTED BUT UNCONFIRMED | Keep for active Managers; confirm operating access. |
| Pause/enable an active product | Mounted guarded RPC; stock still controls effective availability | TECHNICALLY POSSIBLE; design DOCUMENTED BUT UNCONFIRMED | Keep for active Managers; confirm who may pause and when. |
| Configure existing drink choice price/active state | Mounted guarded RPC | TECHNICALLY POSSIBLE; owner delegation UNKNOWN | Treat price adjustment as price authority; confirm owner rule. |
| Configure Fixed Meal Options/prices and approved rice link | Mounted guarded RPC; requires actual rice item and quantity | TECHNICALLY POSSIBLE; owner delegation UNKNOWN | Separately approve meal price and recipe authority; never infer serving quantity. |
| Create ordinary product; edit name/description/category | No mounted editor or ordinary writer | Design DOCUMENTED BUT UNCONFIRMED; implementation PROPOSED | Allow selected active Managers only if owner approves exact fields; pending. |
| Change ordinary selling price | No ordinary price editor/writer; meal pricing is a distinct contract | Design DOCUMENTED BUT UNCONFIRMED; implementation PROPOSED | Require explicit owner delegation and recorded change reason; pending. |
| Create/rename/deactivate category | No mounted editor or category writer | Category Management DOCUMENTED BUT UNCONFIRMED; implementation PROPOSED | Approve exact operations and handling of products in the category; pending. |
| Hide/archive discontinued product | `is_active` exists; no mounted archive writer | Design delete action DOCUMENTED BUT UNCONFIRMED; archive PROPOSED | Prefer controlled inactive state after impact review; pending. |
| Permanently delete product/category | FK restrictions may block; no Manager writer | Design delete action DOCUMENTED BUT UNCONFIRMED; live authorization UNKNOWN | Recommend no hard delete of transacted products or populated categories; pending. |
| Update product image | `image_path` exists; Customer reads it; no Manager upload workflow | Placeholder DOCUMENTED BUT UNCONFIRMED; upload PROPOSED | Approve owner, allowed media, and publishing process; pending. |
| Change recipes, ingredient mappings, or stock consumption quantity | Separate guarded Fixed Meal contract only; no generic recipe editor | Separate authority UNKNOWN; expansion PROPOSED | Keep separately restricted; require explicit recipe approval. |
| Change real hosted records or permissions now | Assignment prohibits it | **NOT AUTHORIZED** | No action in MGR-01 assessment. |

**Confirmed permission** in the table means *technical access observed in mounted code and hosted guards*, not a client policy decision. No row grants new authority. The distinction matters especially for drink adjustments and meal prices, which existing code already exposes.

## Recommended operational policy, subject to approval

Allow authorized Managers to maintain ordinary descriptive fields and active state through a narrow, audited server operation if the owner wants self-service menu maintenance. Separate selling price and drink/meal adjustment authority from descriptive editing. Keep ingredient recipes, rice serving quantities, and stock movements under their existing controlled processes. Preserve menu item IDs and historical order lines; use `is_active` to retire items only after confirming Customer, Cashier, Reports, and historical retrieval behavior. Reject hard deletion for products referenced by orders. If the owner instead chooses technical maintenance, describe the page as availability and existing choice configuration, and document who updates master records outside the Manager UI. These are **PROPOSED** policies, not approved requirements.

## Restaurant decision sheet

Choose one operating model first: **A. Manager self-service**, for approved fields below; or **B. technical/owner-managed menu**, with the Manager page limited to its current controls. If A, record the owner/approver, effective date, and whether every Manager or only named Managers may act.

1. May authorized Managers **add products and edit names, descriptions, and categories**? Select fields individually; confirm whether changes need owner review before becoming visible.
2. Who may **change ordinary selling prices and existing drink/meal price adjustments**: any Manager, named Managers, owner only, or technical staff? Is prior approval or a recorded reason required?
3. May Managers **add, rename, or deactivate categories**? Who moves products before a category is retired?
4. For an unavailable or discontinued product, should Managers **temporarily pause** it, **archive** it, or request a separate owner/technical action? Is permanent deletion ever required?
5. Who supplies and approves **product images**, and should they be published through an approved upload workflow or by technical staff?
6. Should **recipes, ingredient mappings, and rice serving quantities** remain a separate owner-approved process? Name the approver and source of the quantity.

Record explicit yes/no answers and approver for each chosen action. This sheet is ready for restaurant confirmation; no answer is presumed. The practical next step is restaurant approval of this policy, followed by a separately authorized focused implementation batch.
