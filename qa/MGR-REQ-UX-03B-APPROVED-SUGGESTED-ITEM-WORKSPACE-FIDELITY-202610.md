# MGR-REQ-UX-03B — Approved Suggested-Item Workspace Fidelity

**Date:** 2026-10-25 (Asia/Manila)  
**Result:** Local implementation and fixture verification **PASS**. Authenticated hosted and assistive acceptance **NOT TESTED**.

## Approved-image comparison

The re-shared `Screenshot 2026-10-25 035822.png` was inspected directly. It shows a full-width left suggested-items table, explicit row and header checkboxes, item/unit/usable stock/recorded minimum/open requests/suggested gap/request quantity/status columns, a selected-item count, manual add above the table, and compact Request Details at right. The prior MGR-REQ-UX-03 page only rendered selected rows; this change renders all eligible stock-attention items from `get_inventory_request_proposal` before selection. Every checkbox starts unchecked. Selecting a row creates only an unsaved client working line; the Manager must still review and explicitly issue.

The implementation preserves the approved composition and the nine table columns. The table uses the catalog's unit and quantity scale: the synthetic Buko Juice row is `bottles`, and its zero gap plus unverified expiry remain visible. Suggested gap continues to use the existing precision-safe calculation from recorded minimum, usable stock at the needed time, and open requests. Selected quantities are editable with the existing positive/precision validation and override reason. A manual catalog add remains available for items outside the suggestion list; the fixture now includes above-minimum All-Purpose Flour to prove that path. The supported Priority and Manila needed time remain in Request Details. The fixed Production Team destination is informational. No unsupported destination selector, notes, persistent draft, backend change, or fabricated stock value was added.

Compared with the image, the local fixture keeps the existing design system and stock-attention disclosure. Its table is horizontally scrollable within the left panel when the available width is narrow, while the page itself has no horizontal overflow. At 390 px, the same fields are presented in selectable item cards. The local fixture does not mount the full sidebar, so exact full-app spacing and pixel-level fidelity are **NOT TESTED**.

## Evidence

| View | Local synthetic capture |
| --- | --- |
| Desktop suggestions | [1280 px](mgr-req-ux-03b-rendered-20261025/suggestions-1280.png) |
| Tablet suggestions and stacked details | [820 px](mgr-req-ux-03b-rendered-20261025/suggestions-820.png) |
| Mobile suggestion cards | [390 px](mgr-req-ux-03b-rendered-20261025/suggestions-390.png) |
| Selected and manual-added desktop rows | [1280 px](mgr-req-ux-03b-rendered-20261025/selected-1280.png) |
| Selected mobile rows | [390 px](mgr-req-ux-03b-rendered-20261025/selected-390.png) |

## Verification

- **PASS:** `node scripts/verify-mgr-req-ux-03b-browser.mjs` at 1280/820/390 px: visible unselected proposal rows, checkbox counts, catalog units, zero-gap/expiry advisory, precision-safe suggestion, positive quantity and override validation, keyboard Space selection, manual above-minimum catalog add, no page overflow, no browser exception, no external request, and no network write. [Result](mgr-req-ux-03b-rendered-20261025/result.json).
- **PASS:** updated `verify-mgr-req-ux-03-browser.mjs` at 1280/820/390 px, including desktop synthetic review and issue; `verify-mgr-req-ux-01-browser.mjs`, `verify-mgr-req-ux-02-browser.mjs`, and `verify-mgr-req-ux-02a-browser.mjs`; H-23 (40 assertions); TypeScript typecheck; quality baseline (11 checks); production build.
- **NOT TESTED:** actual screen reader, native 200% browser zoom, authenticated hosted Manager session, hosted issuance/RLS, real stock accounting, external Messenger delivery, physical Receiving, and full-app pixel comparison. Local issue actions used the synthetic fixture only.

No hosted writes, schema migrations, deployment, or protected business records were changed.
