# MGR-REQ-UX-04 — Approved design fidelity

**Date:** 2026-10-25 (Asia/Manila)  
**Result:** Local UI implementation and regression checks PASS. Authenticated hosted visual acceptance NOT TESTED.

## Implemented

- The suggestion table uses compact, aligned rows and one colored status pill per item. The repeated explanation is now behind a keyboard operable details control. Its accessible label announces expiry uncertainty and open requests covering the current shortage when both apply; opening it shows usable stock, minimum, open requests, provisional gap, and the full caveats.
- A selected item summary sits above the table. Request Details stays beside the table on desktop; its actions sit together where space allows. Tablet and phone widths retain stacked item cards and reachable guidance.
- All item names, units, stock, request quantities, expiry verification, and provisional gaps still come from the existing proposal API. Selection, manual catalog add, quantity validation beside the input, override reason, refresh, review, issue, and Receiving behavior remain unchanged. No destination or notes field, autosave, backend change, migration, hosted write, or deployment was introduced.

## Visual comparison

The approved `Screenshot 2026-10-25 035822(1).png` was available and inspected. Its composition shows six short selectable rows, single line colored statuses, a selected summary above the table, and a left table/right Request Details layout. The implementation now follows that composition without copying the illustration's sample names, units, or values. The approved illustration is 1500 px wide and shows a full manager shell; the local fixture images below are 1280×900 without that shell, so this is a composition comparison rather than a pixel match.

| View | Evidence |
| --- | --- |
| Before, four identical fixture items at 1280×900 | [03C capture](mgr-req-ux-03c-rendered-20261025/suggestions-1280.png) |
| After, same four fixture items at 1280×900 | [04 comparison capture](mgr-req-ux-04-rendered-20261025/after-four-1280.png) |
| After, six fixture items at 1280×900 | [Six row capture](mgr-req-ux-04-rendered-20261025/suggestions-1280.png) |
| After, 820 and 390 px | [820 capture](mgr-req-ux-04-rendered-20261025/suggestions-820.png), [390 capture](mgr-req-ux-04-rendered-20261025/suggestions-390.png) |
| Expanded expiry and covered gap guidance | [Guidance capture](mgr-req-ux-04-rendered-20261025/guidance-1280.png) |

At 1280×900 all six synthetic rows are visible, including a deliberately long item name. The before capture needs scrolling to reach the fourth row. The after captures show no horizontal page overflow at 1280, 820, or 390 px. The 820 and 390 px views use cards and require normal vertical scrolling.

## Verification

- **PASS:** MGR-REQ-UX-04 focused browser gate at 1280/820/390 px, six row fixture, disclosure opening/closing and Space key access, explicit selection, quantity error linked to its input, manual add, and local-only read traffic. [Machine result](mgr-req-ux-04-rendered-20261025/result.json).
- **PASS:** Requests 03B, 03, 02A, 02, and 01 browser regressions; H-23 request workflow (40 checks).
- **PASS:** Receiving UX-02, 04, and 06 browser regressions; draft authoring (65 checks); posting source checks (42 checks). The browser's synthetic post did not write hosted data.
- **PASS:** TypeScript typecheck, 11 quality checks, and production build.
- **NOT TESTED:** Authenticated hosted Manager view, live hosted catalog acceptance, actual browser 200% zoom, screen reader, physical device, real request issue, and real Receiving post. The local screenshots use synthetic fixture records; they do not prove current hosted values or an authenticated shell layout.

The existing working tree was already dirty. This task did not reset or edit unrelated work.

## Final visual fidelity implementation (2026-10-25)

The active Prepare Request source now renders **two separate desktop cards**, with a 2.24:1 work/detail grid. The Add an item controls, selected count, suggestion table columns, and six rows are compact. The count derives from selected draft lines and current proposal rows; it does not select anything automatically. One colored pill per row retains the full stock and expiry explanation in the keyboard-accessible disclosure. The actual proposal still supplies names, units, quantities, and status. The request review, issue, and Receiving paths were not replaced.

The [approved target](mgr-req-ux-04-rendered-20261025/approved-target-1502.png), [user's earlier current comparison](mgr-req-ux-04-rendered-20261025/before-user-comparison.png), and [final three-selection render](mgr-req-ux-04-rendered-20261025/selected-valid-shell-1502.png) are saved together. Both target and final render are **1502 × 856**. The final render is a local synthetic fixture in the full Manager shell.

| Measured region | Approved target (approx. px) | Final local render (px) |
| --- | ---: | ---: |
| Left card | x 307, y 230, width 794 | x 304, y 230, width 792 |
| Right card | x 1111, y 230, width 355 | x 1106, y 230, width 354 |
| Add item panel | x 324, y 347, width 760, height 107 | x 321, y 348, width 758, height 104 |
| Suggestion table | x 324, y 529, width 760 | x 321, y 526, width 758 |
| Row height | about 31 | 32 |

Visual result: the approved two-card composition, six-row density, selected state, badge treatment, and search/table placement are closely matched at the reference dimensions. It is **not a pixel-exact match**. The local fixture selects Soy Sauce, Vinegar, and Rice, while the approved image depicts other sample items and values. The reference also depicts a Destination selector and Notes field; the live request contract does not support those fields, so the Details card retains the real fixed Production Team destination instead. This leaves more open space in that card. The fixture shell branding and fonts differ slightly from the target capture. Hosted authenticated appearance remains NOT TESTED.

Verification after the final source edits: focused Requests browser PASS at 1280/820/390 with three explicit selections and 1502 capture, Requests 03B and 03 PASS, Requests 02A PASS on a sequential rerun (its concurrent run had a focus timing timeout), H-23 PASS (40 checks), Receiving UX-02 and 06 PASS at 1280/820/390 using their required local fixture server, typecheck PASS, quality PASS (11 checks), and production build PASS. The 1502 capture recorded zero browser exceptions, external requests, or network writes. No hosted writes, migration, or deployment occurred.

## Quantity-before-selection correction

The earlier render incorrectly said “Select to edit” on unchecked rows. The active Prepare Request screen now displays an editable quantity on every suggested row before selection, populated from the current proposal gap, including a true zero. Selection only controls which lines enter review and issue. A preselection edit and its override explanation survive selection changes. After a successful proposal refresh, an untouched quantity follows the new gap; a manual edit remains intact. Positive quantity, item precision, and override explanation are required only for selected lines.

The refreshed [1502 × 856 local render](mgr-req-ux-04-rendered-20261025/selected-valid-shell-1502.png) shows all six quantity inputs, including unchecked rows. Compared with the saved [1502 × 856 approved target](mgr-req-ux-04-rendered-20261025/approved-target-1502.png), the left and right cards remain at y=230, width 792/354 versus about 794/355 in the target; the table begins at y=526 versus about 529. Fixture items, units, and values differ from the approved illustration. The exact `/mnt/data/Screenshot 2026-10-25 035822(4).png` and `/mnt/data/image(20261025-055122).png` files were not present in this Windows workspace, so this comparison uses the saved approved target and the behavior specified by the user.

Focused local browser verification passed at 1280/820/390: all suggested inputs appear before selection; `0.06` retains its three-decimal unit precision and zero stays zero; keyboard quantity and checkbox operation; edit before select; deselect/reselect; changed guidance on refresh; manual edit retention; selected-line validation; and exclusion of an edited unchecked row from both review and the local mock issue payload. Six rows remain compact at the reference size, with no horizontal overflow, browser exception, external request, or network write. Requests 03B and 02A, H-23 (40 checks), and Receiving UX-02 also passed. Typecheck, 11 quality checks, and build passed. Hosted authenticated acceptance remains NOT TESTED; there were no hosted writes, migrations, or deployment.
