# Counsellor Visual Standard — Implementation Report

| Field | Value |
|-------|--------|
| **Date** | 2026-09-25 |
| **Production implementation** | Reconciled to the approved Product Decision and Cut 1 authorization |
| **Automated tests** | **COMPLETE** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

This report is not acceptance.

---

## 1. Scope

Governance reconciliation of the visual implementation against the approved Product Decision and the original Cut 1 Implementation Authorization. This pass restored deferred items. It did not choose a new heading treatment, equalize spacing, or start Cut 3.

Waiting List and Sessions were not edited.

## 2. Files changed

Production files restored to the last committed source:

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`
- `apps/hospital-portal-web/src/components/counselor/CounselorAnalyticsTab.tsx`

Production file still different from the last commit, for earlier approved work only:

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx` — no in-content module heading (page-shell decision) and existing column-header exposure (CGX-1). Cue typography and shell gaps were put back.

Test file updated:

- `apps/hospital-portal-web/src/lib/counsellors-desk/counsellor-visual-standard.contract.test.ts`

## 3. Finalize Surgery changes

The content heading **Surgery Finalization** / **OT Preparation** is restored on `staff-page-title`, including `finalize-surgery-page-title` and the OT purpose line under that heading. Shell spacing is `gap-0.5` below 1600px and `gap-2.5` at 1600px and above. Toolbar labels are the previous treatment. Column cues are `aria-hidden` and hidden below `md`.

## 4. OT Preparation changes

The same restored heading, purpose line, shell gap, toolbar labels, and column-cue visibility apply in the OT Preparation workspace. No second status-tab set was added.

## 5. Follow-up Center changes

Shell spacing is again `gap-0.5` below 1600px and `gap-2.5` at 1600px and above. Column cues use the previous 10px uppercase treatment. The existing `role="columnheader"` exposure and `followup-column-cues` marker stay. The page does not add a content heading **Follow-up Center**.

## 6. Analytics changes

Report stack spacing is again `gap-0.5` below 1600px and `gap-2.5` at 1600px and above. The toolbar stays above the KPI strip. The loading skeleton was not modified.

## 7. Protected business behavior

FSM, Reopen, SequenceNo, Prepare, one-schedule-date rule, print handlers, Follow-up attribution, ReQueue, Analytics formulas, My Work, APIs, DTOs, database, permissions, ownership, and routes were not changed.

## 8. Accessibility changes

Finalize and OT column cues are `aria-hidden` again. Follow-up cues keep the certified column-header exposure and the previous 10px uppercase type. Analytics loading `aria-hidden` was not changed.

## 9. Responsive changes

Compact shell spacing below 1600px is restored on Finalize, OT Preparation, Follow-up, and Analytics. Finalize and OT column cues are hidden below `md` again.

## 10. Automated test results

From `apps/hospital-portal-web`, after reconciliation:

**85 passed / 0 failed / 0 skipped** (14 files).

## 11. Waiting List regression result

Waiting List source was not edited. Layout and shared-queue tests passed.

## 12. Sessions regression result

Sessions source was not edited. Composition and CGX-1 contract tests passed.

## 13. Known deferred items

These remain deferred. This reconciliation did not decide them.

- Finalize workspace heading treatment. The previous heading is restored, not redesigned.
- Analytics toolbar-before-KPI order.
- Finalize toast versus an in-page error.
- Finalize and OT column-cue presentation.
- Follow-up column-cue typography.
- Analytics loading `aria-hidden`.
- Sessions partition metrics.

## 14. Manual UAT status

**NOT EXECUTED**

## 15. Acceptance status

**NOT RECORDED**

---

## Scope Reconciliation

### 1. Retained

- Follow-up has no in-content module heading. That matches the already approved page-shell decision and the existing Follow-up page test. It was not introduced by the deferred visual edits, and it was not removed in this reconciliation.
- Follow-up column cues keep `role="columnheader"` and `followup-column-cues`. That exposure is the certified CGX-1 treatment. The 10px uppercase type is restored on top of it.
- Summary metrics, tabs, toolbars, buttons, and the existing loading, empty, and error mechanisms were not changed.
- Analytics toolbar order, formulas, scope, period, export, and print were not changed.
- Waiting List and Sessions were not changed.

No other production change from the visual pass remains on Finalize or Analytics. Those two files match the last committed source.

### 2. Reverted

- Finalize content heading removal, including the screen-reader-only replacement.
- OT purpose line moved out of the heading into the workspace body.
- Finalize and OT toolbar label restyle from the compact uppercase treatment to `text-xs` at every width. It was in the same unauthorized Finalize edit and was put back with that file.
- Equalized `gap-2.5` at all widths on Finalize, Follow-up, and Analytics.
- Finalize and OT column cues made visible below `md`, given `role="columnheader"`, and styled with `cgx1WorklistHeaderClass`.
- Follow-up column-cue typography changed to `cgx1WorklistHeaderClass`.

### 3. Why they were reverted

The Product Decision defers the Finalize workspace heading, Follow-up cue typography, and Finalize column-cue accessibility. Cut 1 recorded the existing `gap-0.5` / `gap-2.5` split as already aligned and forbade equalizing it. Cut 1 also placed Finalize column cues and Follow-up 10px cues outside that authorization. Those edits were assumptions during implementation. They are not a new product decision.

### 4. Final production files changed

Relative to the last commit, the only remaining production diff is `surgery-followup/page.tsx`, and only for the earlier page-shell heading removal and the certified column-header exposure. Finalize Surgery and Analytics have no remaining diff from this visual pass.

### 5. Final automated test result

**85 passed / 0 failed / 0 skipped** (14 files).

Manual UAT: **NOT EXECUTED**

Acceptance: **NOT RECORDED**
