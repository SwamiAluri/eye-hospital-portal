# L-CRT-UX-01 — Authorized Results Discovery  
# Implementation Report

**Date:** 2026-10-12  
**Authorization stamp:** `PRODUCT_DECISIONS_CLOSED_L_CRT_UX_01_AUTHORIZED`  
**Decision closure:** [enterprise-lms-critical-result-authorized-results-ux-decision-closure.md](./enterprise-lms-critical-result-authorized-results-ux-decision-closure.md)  
**Parent Critical stamp:** `PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED`

**Implementation status:** `IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`

---

## 1. Original UAT blocker

Existing ClinicallyAuthorized Results could not be discovered in the UI for first-time Critical classification. Mark Critical already existed on `CriticalResultPanel` inside `ResultDraftEntry`, but no worklist supplied `orderTestId` / `specimenId` / `operatingBranchId`.

## 2. Approved UX (implemented)

```text
Results & Authorization → Authorized Results
  → ClinicallyAuthorized work items
  → Open Result
  → /dashboard/lms/testing/manual-results?...
  → ResultDraftEntry + CriticalResultPanel
  → Mark as Critical (existing; not executed in this task)
```

## 3. Routes / navigation

| Item | Value |
|---|---|
| New page | `/dashboard/lms/results/authorized` |
| Nav | Results & Authorization → **Authorized Results** (between Authorization and Critical Results) |
| Detail (unchanged) | `/dashboard/lms/testing/manual-results?orderTestId&specimenId&operatingBranchId` |
| Critical queue (unchanged) | `/dashboard/lms/results/critical` (event-backed) |

No `/dashboard/lms/results/{resultId}` route was created.

## 4. Reused components / API

| Asset | Reuse |
|---|---|
| API | `GET /lms/testing/work-queue?resultStatus=ClinicallyAuthorized` |
| Worklist UI | `TestingWorkbench` |
| Primary action | `testingWorkQueuePrimaryAction` — ClinicallyAuthorized → `open-result` |
| Result Detail | `ResultDraftEntry` |
| Mark Critical | `CriticalResultPanel` (unchanged) |

## 5. Files changed

| File | Change |
|---|---|
| `apps/.../results/authorized/page.tsx` | **Added** — Authorized Results page |
| `apps/.../results/authorized/enterprise-lms-authorized-results-ui.test.ts` | **Added** — FE contracts |
| `apps/.../lib/lms/lms-navigation.ts` | Authorized Results nav item |
| `apps/.../lib/lms/lms-capability-registry.ts` | `results-authorized` = implemented |
| `apps/.../lib/lms/testing-work-queue-actions.ts` | CA → open-result |
| `apps/.../components/lms/LmsOverviewDashboard.tsx` | Structural overview link (no KPIs) |
| `apps/.../testing/enterprise-lms-testing-ui.test.ts` | Expect CA open-result |

## 6. Honesty

Page subtitle states ClinicallyAuthorized Results are **not** Final / Released / Published / patient-visible. No KPI tiles, thresholds, or escalation UI.

## 7. Permissions

No permission catalog changes. No role grants. Critical classify remains `lms.results.critical.manage` on existing panel.

## 8. Tests

```text
npx vitest run
  src/app/dashboard/lms/results/authorized/enterprise-lms-authorized-results-ui.test.ts
  src/app/dashboard/lms/testing/enterprise-lms-testing-ui.test.ts
  src/app/dashboard/lms/results/critical/enterprise-lms-critical-ui.test.ts
→ Passed: 18 / Failed: 0
```

## 9. Out-of-scope confirmation

No CriticalResultEvent backend, ResultStatus, Result-by-id API, Testing default queue, Verification, Authorization, Collection/Specimen/Receiving/Barcode/Pathology, Reporting, Amendments, permissions/roles, or schema changes.

## 10. Next gate

PRE-UAT verification document → then Manual UAT (separate). Do **not** Mark as Critical in PRE-UAT for this UX slice alone unless continuing L-CRT-01 Manual UAT separately.
