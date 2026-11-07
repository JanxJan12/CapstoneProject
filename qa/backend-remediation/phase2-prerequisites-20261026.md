# Phase 2 prerequisite register — 2026-10-26

**Status: BLOCKED. This is a candidate inventory for owner review, not an approved historical bootstrap or an executable seed.** The 18 recipe tuples and their amounts remain only in the existing Phase 2A SQL and owner-controlled source review. No historical rows were inserted.

The unchanged Phase 2A migration `20260904000000_inventory_phase_2a_recipe_deduction.sql` has SHA-256 `f06983ed7e9ba60f48654f8df97f177ff8802a0c74297300b851b0226180a5d0`. Its 18 ordered tuple digest is `5d2551ee51d124346edc2bd884dce035f7234b9906f74b1385c9b9cbd8ba7677`. The twelve preceding migrations provide none of the 10 menu or 12 inventory UUIDs. Their SQL requires those IDs because `menu_ingredients` has foreign keys to both tables. Each menu row also needs a non-null `category_id` referencing `menu_categories`.

The identifiers, labels, units and menu category links below are **candidate values from the later October 13 export**, not independently established pre-Phase-2A facts. Source: `%LOCALAPPDATA%\RRJ-Private-Backups\Supabase-20261013-062110\data.sql`, SHA-256 `9fd18e166aaef422f5bf8b7b6178642b1d7d02e61148d984ec29a9b1ef65b114`. The export's ten menu rows and twelve inventory rows match the IDs in Phase 2A; its 18 corresponding recipes match numerically, but this is internal consistency of later material. The [historical review](../M3-2C-A-HISTORICAL-INVENTORY-REVIEW.md) gives original source line numbers and evidentiary limits.

## Required menu candidates and category references

| Menu ID | Later-export name | Category ID |
| --- | --- | --- |
| `0e0939e8-5e5a-462d-95aa-caa834531a14` | White Rice | `69ddc6b1-5967-4def-b4dd-843620523d06` |
| `28cef5f3-b549-4d6a-9e39-61b1cf6f3e11` | Sinigang na Baka | `072d2c46-21be-4461-aa60-958a88069c07` |
| `36cf63ad-47bd-40d7-8239-0922769013d4` | Kare-Kare | `0b632447-9b6d-4b15-8c75-cbe534240173` |
| `3c78b355-2613-4f5b-af4d-ac2197d957fe` | Softdrinks | `d37940ae-086f-4930-8358-f93a72329185` |
| `54cd08a0-e6fd-4d60-84f4-04fb9be8be44` | Pinakbet | `b87ae32d-5b2e-43b1-9083-d53d01027799` |
| `79dc274a-b608-4ff8-b14a-c8f9b1effb4f` | Adobong Manok | `0b632447-9b6d-4b15-8c75-cbe534240173` |
| `a23b01b5-1c32-443e-9d3e-cbff54040aed` | Fried Rice | `69ddc6b1-5967-4def-b4dd-843620523d06` |
| `bf931531-0d32-4092-ae0e-448e40d5aaca` | Crispy Beef Tadyang | `0b632447-9b6d-4b15-8c75-cbe534240173` |
| `e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c` | Buko Juice | `d37940ae-086f-4930-8358-f93a72329185` |
| `eda59cc3-eb0a-4090-80ef-1788229d619a` | Chicken Bicol Express | `0b632447-9b6d-4b15-8c75-cbe534240173` |

## Required category parent candidates

| Category ID | Later-export name |
| --- | --- |
| `0b632447-9b6d-4b15-8c75-cbe534240173` | Viands |
| `072d2c46-21be-4461-aa60-958a88069c07` | Soups |
| `b87ae32d-5b2e-43b1-9083-d53d01027799` | Vegetables |
| `69ddc6b1-5967-4def-b4dd-843620523d06` | Rice |
| `d37940ae-086f-4930-8358-f93a72329185` | Beverages |

## Required inventory candidates

| Inventory ID | Later-export name | Base unit |
| --- | --- | --- |
| `002ed07e-3cd8-4b36-b2b6-bad61e8a5579` | Coconut Milk | L |
| `07e2a344-1d50-4453-b8b9-7f3a17251e5a` | Beef | kg |
| `29c32f11-aaff-4e87-a781-4f4723924e41` | Cooking Oil | L |
| `37401723-e5ca-4664-acad-d58281c61d15` | Soy Sauce | L |
| `3a13849a-eb71-4806-8451-a0f3887746b1` | Vinegar | L |
| `4271eea5-2c8a-413d-9d56-7fe47107f272` | Mixed Vegetables | kg |
| `617cf643-6691-4710-834d-b9e9713d2bb9` | Buko Juice | bottle |
| `7f9f25fd-6d1c-4177-8516-043d06f778a4` | Softdrinks | bottle |
| `a3355239-1a21-4459-b80d-a174164872b9` | Rice | kg |
| `b22e76f0-5e37-4228-9d21-9196b5ea93cd` | Peanut Butter | kg |
| `b467aeba-d158-4c6d-b43b-1b71a60910c4` | Chicken | kg |
| `d6d69f5e-00bf-4487-a1f8-f3fa5fe63bd8` | Sinigang Mix | pack |

## Integrity and approval boundary

- A bootstrap for a **new, unlinked disposable database** needs owner-approved category parents first, then menu/inventory rows with exact approved attributes, before the original Phase 2A migration. This is an insertion-order design, not a completed bootstrap or permission to use the later export as historical truth.
- The private manifest contract now requires three separately hashed `category`, `menu`, and `inventory` files outside the repository, plus explicit category source approval. `validate-provenance.mjs` checks the required Phase 2A IDs, unique UUIDs, nonempty names/units, menu category references, one Chicken/kg identity, tuple digest and opening-stock decision. A valid result remains `REVIEW_REQUIRED` for human source and SQL review.
- The later export has no formal opening-balance rows. Its three early Rice movements reconcile within that export but do not establish an original physical count. See the [opening-stock review](../M3-2C-A-OPENING-STOCK-RECONCILIATION.md). No opening-stock option is signed.
- The applicable initial schema requires menu `code` format, nonnegative menu `price`, nonnegative inventory `quantity_on_hand` and `reorder_level`, and positive recipe `quantity_required`. The validator is a prerequisite gate, **not** a complete schema or business-value validator; an engineering reviewer must inspect approved row fields and all foreign keys before generating SQL.

**Next dependency:** the accountable owner must review the original dated records, the 27 exact identities and links, the 18 confidential mappings and units, and an opening-stock decision. Keep signed baseline material private. No clean replay or downstream SQL regression can be claimed until then.
