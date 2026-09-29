# Counsellor Performance Wave 1B — Package B Implementation Report

Document type: Implementation report  
Status: IMPLEMENTED — AUTOMATED TESTS COMPLETE  
Date: 2026-09-26

Manual UAT: NOT EXECUTED  
Acceptance: NOT RECORDED

This is a loading-presentation implementation. It does not claim a measured millisecond or percentage performance improvement. It does not claim that navigation or row-click speed was fixed.

---

## 1. Authorization reference

`docs/product-decisions/counsellor-performance-wave1b-loading-presentation-implementation-authorization.md`

Status of that document: IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED.

## 2. Product Decision reference

`docs/product-decisions/counsellor-performance-wave1b-loading-presentation-product-decision.md`

Approved decisions implemented: PD-LD-01 through PD-LD-07 (selection date 2026-09-26).

## 3. PD-LD-01 through PD-LD-07 implementation status

| Decision | Status |
|---|---|
| PD-LD-01 Waiting List summary | Implemented |
| PD-LD-02 OT Returned summary | Implemented |
| PD-LD-03 Finalize summary | Implemented |
| PD-LD-04 OT Preparation Finalised count | Implemented |
| PD-LD-05 OT catalog error/retry | Implemented |
| PD-LD-06 Accessible worklist loading announcement | Implemented |
| PD-LD-07 Existing loading primitives only | Implemented |

## 4. Exact production files changed

- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx`

No other production file was modified for this package.

## 5. Exact test files changed

- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.test.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/waiting-list-ot-returned-deferred-load.contract.test.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.test.ts`
- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.test.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.test.tsx`

The Follow-up test was changed only to recognize the new `role="status"` loading announcement. Existing assertions in these files were not removed or weakened.

## 6. Loading-state changes

Presentation only. Existing queries, pending flags, and count formulas are reused.

- PD-LD-01: While the primary waiting-list query is in its existing initial loading state (`isLoading`), summary cards and status tabs show the established pending mark `—` instead of a numeric 0. After a successful response, existing `tabCounts` values render, including a genuine 0.
- PD-LD-02: While the OT Returned tab is selected and that deferred load has not yet settled (`otReturnedReady` is still false), the OT Returned count shows `—`. After the existing load finishes, the count is `otReturnedRows.length`, including 0. A later refresh keeps the last settled count. The request still starts only after the OT Returned tab is selected.
- PD-LD-03: While the filtered Finalize query is in its existing initial loading state, Scheduled, Awaiting Finalise, and Surgery Done show `—`. After success, the existing `statsBar` predicates and values render, including 0.
- PD-LD-04: While the OT catalog request is pending and has no rows, Finalised shows `—`. Selected stays the current selection count. After success, Finalised is `otPrepFiltered.length`, including 0. The catalog remains enabled only while OT Preparation is active.
- Refresh that already has a successful waiting-list or Finalize result keeps the previous counts. Populated rows are not cleared just to force a numeric loader.

## 7. Error-state change

PD-LD-05: When the OT Preparation catalog request fails and there are no catalog rows, the list shows an existing alert pattern (`role="alert"`, test id `finalize-ot-prep-catalog-error`) with Retry calling `catalogQuery.refetch()`. That branch does not render `No Finalised surgeries`. Finalised also stays on `—` for that error-without-rows case.

A successful empty catalog still renders `No Finalised surgeries`.

## 8. Accessibility loading announcement changes

Each in-scope loading region now has exactly one `role="status"` announcement with the text `Loading`. Decorative pulse geometry stays `aria-hidden`.

- Waiting List worklist skeleton in `WaitingListQueueWidget.tsx`
- Finalize local `WorklistSkeleton`, which OT Preparation also uses
- Follow-up worklist pulse in `surgery-followup/page.tsx`

Sessions was not rewritten.

## 9. Confirmation skeleton.tsx was not modified

`apps/hospital-portal-web/src/components/ui/skeleton.tsx` was not modified. Git status for that path is clean. Pending numbers use the existing Follow-up `—` mark. Worklist skeletons keep their existing pulse geometry.

## 10. Test commands and results

All commands were run from `apps/hospital-portal-web` with Vitest 3.2.6.

**Authorized files (after the final presentation edit)**

```
npx vitest run src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.test.tsx src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.test.tsx src/app/dashboard/counsellors-desk/waiting-list/waiting-list-ot-returned-deferred-load.contract.test.ts src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.test.ts src/app/dashboard/counsellors-desk/surgery-followup/page.test.tsx
```

Result: 5 files, 57 passed, 0 failed, 0 skipped.

**Related page-source regressions (after the final presentation edit)**

```
npx vitest run src/lib/counsellors-desk/counsellor-visual-standard.contract.test.ts src/app/dashboard/counsellors-desk/waiting-list/waiting-list-lifecycle-claim.contract.test.ts src/app/dashboard/counsellors-desk/waiting-list/waiting-list-lifecycle-status-sync.contract.test.ts src/app/dashboard/counsellors-desk/waiting-list/waiting-list-pending-readonly.contract.test.ts
```

Result: 4 files, 26 passed, 0 failed, 0 skipped.

**Finalize surgery tests (unchanged by the later waiting-list-only edit)**

```
npx vitest run src/app/dashboard/counsellors-desk/finalize-surgery src/components/counsellors-desk/finalize-ot-modal-presentation.test.ts
```

Result: 6 files, 40 passed, 0 failed, 0 skipped.

These three commands overlap no test file. Combined executed result: 15 files, 123 passed, 0 failed, 0 skipped.

## 11. Confirmation certified success-state behavior remains unchanged

Successful non-empty counts still use the existing formulas. A successful empty result still shows numeric 0 on a numeric card, and the existing `No Finalised surgeries` copy on a successful empty OT catalog. C-01, Sessions correction, Phase 3I closure, Follow-up attribution, Follow-up ReQueue, and Analytics formulas were not edited.

## 12. Confirmation PERF-02 remains intact

OT Returned journeys and per-patient session calls still run only after the OT Returned tab is selected and `branchId` is known. The existing membership filter, branch scope, pagination, actions, and visibility split from the waiting-list refetch remain. The deferred-load contract tests passed.

## 13. Confirmation PERF-03 remains intact

The undated OT catalog query stays disabled while the Finalize workspace is active and enabled only when OT Preparation is active. Catalog filters, omitted-date behavior, and the existing query hook signature were not changed. The PERF-03 catalog contract tests passed.

## 14. Confirmation PERF-04 Option A remains intact

The waiting list remains a full-queue client-filtered list. Pagination, filters, and Owner behavior were not changed. PERF-04 Option B was not implemented.

## 15. Confirmation PERF-05 remains intact

No Analytics service, DTO, or formula file was edited. The Follow-up aging aggregation was not changed.

## 16. Confirmation no API/DTO/database changes

No API, DTO, controller, service, database, index, migration, or Redis change was made.

## 17. Confirmation no permission/ownership/FSM changes

Permissions, ownership, routes, Finalize FSM, OT Preparation FSM, RESP2, SequenceNo, Prepare, Reopen, cancellation, and the one-schedule-date rule were not changed. `FinalizeOtModal` remains statically mounted. Its loading shell and lookups were not changed. TanStack Query defaults and query keys were not changed.

## 18. Limitations

- Manual UAT was not executed. No browser timing was measured.
- This package does not change navigation, row-click, Sessions, or Finalize Open request cost.
- OT Returned still uses its existing toast when that deferred request fails. A new error panel for that request is outside this package.
- Before the OT Returned tab is selected, that tab’s count remains the existing unloaded length, which is 0, because the deferred request has not started.
- Worklist skeletons still use the existing local pulse geometry. `components/ui/skeleton.tsx` was not imported, because swapping it in would change that geometry, and the Follow-up pending mark already covers the numeric cards.

## 19. Rollback details

Revert the presentation edits in the five production files and five test files listed above. Those files also contain earlier uncommitted work (Wave 1 gates and visual polish). Reverting the whole files would remove that earlier work. Rollback of Package B alone is the pending-value, catalog error, and `role="status"` presentation hunks.

No migration, API, or query-key rollback is required.

## 20. Manual UAT

Manual UAT: NOT EXECUTED

## 21. Acceptance

Acceptance: NOT RECORDED

The next gate is Manual UAT.
