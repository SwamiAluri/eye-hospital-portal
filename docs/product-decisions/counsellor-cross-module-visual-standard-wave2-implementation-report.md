# Counsellor Visual Standard — Wave 2 Implementation Report

| Field | Value |
|-------|--------|
| **Date** | 2026-09-25 |
| **Authorization** | `docs/product-decisions/counsellor-cross-module-visual-standard-wave2-implementation-authorization.md` |
| **Product Decision** | `docs/product-decisions/counsellor-cross-module-visual-standard-wave2-product-decision.md` |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

This report is not acceptance.

---

## 1. Authorization reference

Wave 2, decisions VS2-01 through VS2-08 only.

## 2. Implementation date

2026-09-25

## 3. Production files changed

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx`
- `apps/hospital-portal-web/src/components/counselor/CounselorAnalyticsTab.tsx`
- `apps/hospital-portal-web/src/components/TopNav.tsx`

## 4. Test files changed

- `apps/hospital-portal-web/src/lib/counsellors-desk/counsellor-visual-standard.contract.test.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.test.ts`

## 5. VS2-01

The content heading **Surgery Finalization** is removed. While the finalization workspace is active, the staff title is **Finalize Surgery**. The workspace button still reads **Surgery Finalization**.

## 6. VS2-02

While OT Preparation is active, the page dispatches the title **OT Preparation**. `TopNav` applies that title only when the pathname is `/dashboard/counsellors-desk/finalize-surgery`. `resolveStaffPageTitle` is unchanged and still returns **Finalize Surgery** for that route. The sidebar label is unchanged. No title context, store, or title API was added.

## 7. VS2-03

**Prepare Finalised surgeries for OT.** is removed and was not replaced.

## 8. VS2-04

Scheduled, Awaiting Finalise, and Surgery Done render as three cards. The values still come from the loaded record count, `countNeedsAttention`, and status `SurgeryDone`.

## 9. VS2-05

Finalised and Selected render as two cards. Selected is still `otPrepSelectedCount`.

## 10. VS2-06

Follow-up stats render as cards. Active, Cold Leads, and Post-Surgery still use the labels and values from `GET /Counseling/followups/stats`.

## 11. VS2-07

`border-l-counselling-border` is removed from Active and Post-Surgery rows. Cold rows still use `border-l-4 border-l-red-400`. Row separation, patient text, status, and actions are unchanged.

## 12. VS2-08

Session Types, Surgery Type volume bars, and daily trend marks take a color from a fixed list of six colors already in the product. The color is a hash of the category key (session type, surgery type, or trend date), so order does not change it. Decision Funnel colors were not edited. Surgery conversion threshold colors were not edited.

## 13. Protected behavior

APIs, DTOs, database, permissions, ownership, FSM, SequenceNo, RESP2, ReQueue, Follow-up attribution, Analytics formulas, scope, My Work, Authorized Branch, drill-down, export, print, aging, and routes were not changed.

## 14. Waiting List

This implementation did not edit the Waiting List page or `WaitingListSummaryWidget`.

## 15. Sessions

This implementation did not edit the Sessions page.

## 16. Automated test results

From `apps/hospital-portal-web`:

**118 passed / 0 failed / 0 skipped** (17 files).

Includes the Wave 2 contract, Finalize and OT catalogs, Follow-up page tests, Analytics scope and drill-down tests, staff-title resolver tests, and Waiting List and Sessions regression contracts.

## 17. Limitations

Until the Finalize page effect runs, the staff title uses the route label **Finalize Surgery**. That matches the default workspace. The OT title appears after the page reports the active workspace. `resolveStaffPageTitle` itself does not switch with the workspace.

## 18. Deferred items

Analytics toolbar order, Sessions content title, Finalize column-cue accessibility, Analytics loading semantics, Finalize toast versus an in-page error, Follow-up column-cue typography, and the Cold-row red edge remain deferred.

## 19. Manual UAT

**NOT EXECUTED**

## 20. Acceptance

**NOT RECORDED**
