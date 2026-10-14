# Laboratory Management — L2 Order Composer UX Correction

**Date:** 2026-10-08  
**Type:** L2 UAT CORRECTION (UX) + FINAL L2 UAT HARDENING / VERIFICATION  
**Status:** IMPLEMENTATION COMPLETE — AUTOMATED VERIFICATION COMPLETE — FINAL L2 UAT HARDENING COMPLETE — READY FOR MANUAL UAT  

> **Final UAT readiness audit:** [laboratory-management-l2-final-uat-readiness-audit.md](./laboratory-management-l2-final-uat-readiness-audit.md) — **READY FOR MANUAL UAT**; acceptance **not claimed**.

```text
IMPLEMENTATION COMPLETE
AUTOMATED VERIFICATION COMPLETE
FINAL L2 UAT HARDENING COMPLETE
READY FOR MANUAL UAT

L2 ACCEPTANCE NOT CLAIMED

L3 NOT STARTED
```

---

## 1. Objective

Correct the Order New Laboratory Tests composer so large multi-test orders remain usable: compact table layout, constrained dialog height, independently scrollable selected-test region, and accessible footer / clinical indication without scrolling through every selected test.

## 2. UAT problem (original)

Vertically stacked selected-test cards made the dialog grow with each add. For orders such as CBC + Lipid Profile + Blood Group & Rh Factor (and larger), indication, notes, and Create order were pushed down; the experience did not scale to 10–20+ tests.

## 3. Audit findings

| Surface | Finding |
|---|---|
| `LaboratoryOrderDialog` | Card list under Tests / Panels; dialog `max-h-[90vh] overflow-y-auto` scrolled the whole form |
| Business rules / API | Multi-item `items[]` → one `LabReport` already correct; no backend change required |
| Design patterns | Counsellor / patient dialogs use `flex` + `overflow-hidden` + bounded inner scroll regions |
| Table primitives | Existing `@/components/ui/table` head/row/cell components reused |
| Clinical indication | No authoritative controlled vocabulary; free-text remains required |

## 4. UX / product decision implemented

- Replace selected-test cards with a compact table: Test, Code, Category, Specimen, Remove.
- Dialog constrained (`max-h-[min(90vh,44rem)]`, `overflow-hidden`, flex column).
- Selected-test table body region: `max-h-[min(14rem,30vh)]` + independent `overflow-y-auto`.
- Compact count: `{n} selected`.
- Patient / clinician / priority / picker / indication / notes / footer remain outside the test-table scroll region (outer form body may scroll only on very small viewports).
- Clinical indication stays required free text with placeholder; no invented diagnosis catalog.
- Remove = remove from unsaved composition only.

## 5. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/laboratory/LaboratoryOrderDialog.tsx` | Composer layout: constrained dialog, compact table, count, denser chrome; footer/content collision fix |
| `apps/hospital-portal-web/src/app/dashboard/laboratory/laboratory-l2-order-composer-ux.test.tsx` | UX contract + payload + footer/content layout regression |
| `apps/hospital-portal-web/src/app/dashboard/laboratory/laboratory-l2-uat-correction.test.tsx` | Count + table contracts |
| `apps/hospital-portal-web/src/app/dashboard/laboratory/laboratory-l2-catalog.test.tsx` | Table contract |
| `docs/decisions/laboratory-management-l2-order-composer-ux-correction-implementation.md` | This report |

**Backend:** no code changes.

## 6. Component changes

- `DialogContent`: flex column, max height, no whole-dialog growth from test list.
- Selected items: semantic `<table>` + sticky header + existing table cell primitives.
- Footer: `shrink-0` border-top, always at bottom of dialog chrome.
- Category column collapses on very small widths; name cell shows category fallback.

## 7. Behavior preserved

- Single- and multi-test ordering via `items[]`
- Catalog load-on-open, search, exclude duplicates, panel selection
- Patient / clinician selected cards + Change
- Ordering clinician endpoint + `patient.view` least privilege (no `user.view`)
- Priority `routine` / `urgent` / `stat`
- Required clinical indication free text
- One LabReport + N LabReportItems
- Worklist / P360 / Slice 4 untouched
- CBC001 vs CBC remain distinct catalog identities

## 8. Tests added / updated

- New: `laboratory-l2-order-composer-ux.test.tsx` (constrained dialog, table, scroll region, count, footer placement, free-text indication, `items[]` payload, footer/content non-overlap contract)
- Updated: L2 UAT correction + L2 catalog contracts for table/count

## 9. Backend regression results

```text
Filter: LaboratoryCatalogTests | LabReportWorklistTests | LabReportCanonicalDocumentTests | LaboratoryClinicalCatalogBootstrapTests
Passed!  - Failed: 0, Passed: 53, Skipped: 0
```

(No backend changes for the original UX correction or this footer collision fix; suite not re-run for the layout-only follow-up.)

## 10. Frontend test results

```text
vitest run src/app/dashboard/laboratory
Test Files  7 passed (7)
Tests       69 passed (69)
```

(Prior baseline: 68. +1 layout-contract test for footer/content non-overlap.)

## 11. Manual visual validation performed

Source/layout validation against the target structure (constrained dialog + independently scrollable table + scrollable form body above opaque sticky footer). Full interactive browser UAT (1 / 3 / 5 / 10+ tests, remove, search-while-full, validation, create, short viewport Additional notes clearance) remains for Manual UAT gate.

## 12. Known limitations

- Outer form body can still scroll on very short viewports so all non-table fields remain reachable.
- Category column is hidden below `sm` breakpoint (shown under test name).
- Expandable worklist rows for multi-test orders deferred to future Order & Routing decisions.
- No controlled clinical-indication vocabulary.

## 13. Explicit out-of-scope items

Edit/cancel/reopen orders, On Hold, specimen/accession/barcode, results, verification, release, QC, LIS/HL7/FHIR, Counsellor Laboratory bridge, new permissions, worklist redesign, L3 Order & Routing.

## 14. Future Order Lifecycle work identified

Persisted order mutation ACL, expandable worklist detail, controlled indication source (product decision), specimen workflow — after L2 acceptance and product approval. Not started here.

---

## 15. Manual UAT defect — footer / content collision

### UAT defect discovered

In **Order New Laboratory Tests**, the fixed footer (Cancel / Create order) could visually overlap or obscure lower form content — notably **Clinical indication / reason** and **Additional notes** — on shorter / max-height dialog viewports.

### Root cause

1. Shared `DialogContent` defaults to CSS `grid`. Composer classes used `flex` without `!flex`, so `grid` could win in the compiled stylesheet and break the intended flex column partition (scroll body + sticky footer). Without a bounded flex height, the outer form scroll region did not reliably keep the last controls clear of the footer chrome.
2. Scroll body bottom padding (`py-3` only) was insufficient for the final Additional notes control to scroll fully above the footer edge when the dialog approached max height.

### Correction

| Change | Purpose |
|---|---|
| `DialogContent` → `!flex` + flex-col + overflow-hidden | Defeat default `grid`; match Add Patient / Counsellor dialog pattern |
| `form` → `min-h-0 flex-1 overflow-hidden` | Bound height so body scrolls and footer stays sibling chrome |
| Form body → `overflow-y-auto` + `pb-6` + `scroll-pb-6` | Outer scroll with clearance for last controls |
| `DialogFooter` → `shrink-0 bg-white relative z-10` | Opaque sticky footer that does not paint under content |
| Selected-test table | Unchanged independent `max-h-[min(14rem,30vh)] overflow-y-auto` |

Desired structure preserved:

```text
Dialog
├── scrollable content region (laboratory-order-form-body)
 │    ├── Patient … Additional notes
 └── footer (Cancel / Create order)
```

No redesign of table, picker, cards, APIs, permissions, or payload.

### Tests

- Added regression: `keeps form body scrollable above a non-overlapping sticky footer` in `laboratory-l2-order-composer-ux.test.tsx`
- Existing laboratory frontend suite preserved and expanded: **69 passed, 0 failed**

### Manual validation checklist (for re-UAT)

| # | Case | Expected |
|---|---|---|
| A | 1 selected test | Notes + indication fully viewable / editable |
| B | 3 selected tests | Same; footer clear |
| C | 10+ selected tests | Table scrolls independently; notes reachable via form scroll |
| D | Scroll selected-test table | Independent; does not hide footer |
| E | Short viewport | Outer form scrolls; last field clears footer |
| F–G | Indication + Additional notes | Fully viewable and editable |
| H | Footer | Does not cover either field |
| I | Create order | Remains accessible |

## 16. Final L2 UAT hardening / verification pass

**Date of pass:** 2026-10-08  
**Nature:** Bounded verification/hardening — not a redesign; no new laboratory business rules.

### Current implementation structure (source audit)

```text
DialogContent (!flex, max-h-[min(90vh,44rem)], overflow-hidden)
├── DialogHeader (shrink-0)
└── form (min-h-0 flex-1 overflow-hidden)
     ├── form body (overflow-y-auto, pb-6, scroll-pb-6)
     │    ├── Patient
     │    ├── Ordering clinician
     │    ├── Priority
     │    ├── Catalog picker + selected count
     │    ├── selected-test table (max-h-[min(14rem,30vh)] overflow-y-auto)
     │    ├── Clinical indication (required free text)
     │    └── Additional notes
     └── DialogFooter (shrink-0, bg-white, z-10) — Cancel / Create order
```

| Requirement | Source verdict |
|---|---|
| Bounded dialog (no indefinite growth) | Satisfied — `max-h-[min(90vh,44rem)]` + `overflow-hidden` |
| Independent selected-test scroll (10+) | Satisfied — table region `max-h-[min(14rem,30vh)] overflow-y-auto` |
| Outer form scroll when short / at max height | Satisfied — `laboratory-order-form-body` `overflow-y-auto` |
| Additional Notes reachable / clear of footer | Satisfied — inside form body; `pb-6` + `scroll-pb-6`; footer sibling |
| Footer never overlaps content | Satisfied — sibling chrome, opaque `bg-white`, `relative z-10` |
| Create order accessible | Satisfied — footer outside scroll body |
| No unnecessary nested scrolling | Satisfied — only form body + selected table (intentional) |
| Visual design / functional contracts unchanged | Satisfied — table, picker, free-text indication, `items[]` preserved |

### Whether code changes were necessary

**No implementation change was required during this verification pass.**

The prior Order Composer UX correction and footer/content collision fix already satisfy the large-order and short-viewport reachability contracts. No cosmetic or structural edits were made to `LaboratoryOrderDialog.tsx` or related components in this pass.

No additional automated tests were added: existing L2 Order Composer UX contracts already cover bounded dialog, independent table scroll, form-body scroll, footer sibling chrome, Additional Notes reachability, non-overlap, and `items[]` payload.

### Automated verification

```text
vitest run src/app/dashboard/laboratory
Test Files  7 passed (7)
Tests       69 passed (69)
```

Backend: no code changes; prior laboratory regression baseline remains **53 passed** (not re-run; no BE delta).

### Evidence classes (explicit)

| Class | Status |
|---|---|
| Automated verification | Complete — 69 frontend tests passed |
| Source / layout verification | Complete — structure audited against requirements above |
| Actual interactive browser UAT | **Not claimed by this pass** — remains the Manual UAT gate |

Latest reported manual UAT observation (3 selected tests: Anti-HCV, HCV, HBsAg) confirms the main UX correction is working for that case. Remaining manual cases (10+, short viewport, Additional Notes scroll-to-bottom clearance) are for the human UAT gate.

### Remaining manual UAT cases

| # | Case | Expected |
|---|---|---|
| A | 1 selected test | Indication + notes fully viewable / editable; footer clear |
| B | 3 selected tests | Same (partially observed in ongoing UAT) |
| C | 5 selected tests | Same |
| D | 10+ selected tests | Table scrolls independently; patient/footer/indication not displaced incorrectly |
| E | 10+ + short viewport | Outer form scrolls; Additional Notes fully above footer |
| F | Scroll selected-test table only | Does not hide footer or obscure notes |
| G | Focus / edit Additional Notes at bottom | Editable; not covered by footer |
| H | Create order | Remains accessible |

### Known limitations

- Outer form body scrolls on short / max-height viewports by design so last controls remain reachable.
- Category column collapses below `sm` (shown under test name).
- No controlled clinical-indication vocabulary (free text retained by product decision).
- Expandable worklist rows / order lifecycle mutations remain future (post–L2 acceptance) work.
- Automated tests are source-contract + API payload regressions; they are **not** interactive browser UAT.

### L2 acceptance

**L2 acceptance is not automatically claimed** by this verification pass. Acceptance remains a Manual UAT gate after the remaining cases above.

### Next gate

```text
MANUAL UAT → L2 ACCEPTANCE
```

Only after L2 acceptance should the project move to:

```text
L3 ORDER & ROUTING — AUDIT / PRODUCT DECISION
```

L3 was not started in this pass.

## 17. Final status

```text
IMPLEMENTATION COMPLETE
AUTOMATED VERIFICATION COMPLETE
FINAL L2 UAT HARDENING COMPLETE
READY FOR MANUAL UAT

L2 ACCEPTANCE NOT CLAIMED

L3 NOT STARTED
```
