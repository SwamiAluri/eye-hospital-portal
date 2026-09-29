# Counsellor Performance — Wave 1 Implementation Report

| Field | Value |
|-------|--------|
| **Date** | 2026-09-26 |
| **Authorization** | `docs/product-decisions/counsellor-performance-wave1-implementation-authorization.md` |
| **Product Decision** | `docs/product-decisions/counsellor-performance-wave1-product-decision.md` |
| **Product Decision status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Implementation Authorization** | **CREATED / BOUNDED** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

This report records the bounded implementation. It does not record acceptance.

---

## 1. Packages

| Package | Result |
|---------|--------|
| PERF-01 Measurement baseline | Recorded as **UNAVAILABLE**. No production behavior change |
| PERF-02 Waiting List OT Returned deferred loading | **IMPLEMENTED** |
| PERF-03 Finalize OT catalog deferred loading | **IMPLEMENTED** |
| PERF-04 Option A | **PROTECTED.** No architecture change |
| PERF-05 Analytics aging aggregation | **IMPLEMENTED** |
| PERF-04 Option B | **NOT IMPLEMENTED** |
| PERF-06 Finalize dialog lazy mount | **NOT IMPLEMENTED** |
| PERF-07 Client render refactor | **NOT IMPLEMENTED** |

---

## 2. PERF-01 baseline

Browser measurement tooling is not available in this implementation environment. No navigation timing, request waterfall, payload size, dialog-open timing, or interaction latency was captured.

**UNAVAILABLE — browser measurement tooling unavailable in this implementation environment.**

No milliseconds or percentage improvement is claimed. Production code was not changed in order to obtain timings. Shared token, sidebar, and header initialization was not attributed to a Counsellor route because it was not measured.

---

## 3. PERF-02 implementation

`loadOtReturned` in the Waiting List page, including its `visibilitychange` reload, runs only when `activeTab === 'OtReturned'` and `branchId` is set.

Before that tab is selected, the effect returns without calling `ipManagementApi.listJourneys` or `counselingSessionsApi.getPatientSessions`.

When the tab is selected, the existing path still runs: loading flag, `listJourneys({ branchId, clinicalState: 'ReadyForSurgery' })`, per-patient `getPatientSessions`, `filterOtReturnedOperationalRows`, empty rows, and the existing error toast.

The separate waiting-list `refetchWaitingList` visibility effect is unchanged.

No new API, DTO, membership rule, filter, pagination, or branch-scope change.

---

## 4. PERF-03 implementation

`useFinalizeListQuery` accepts an optional `enabled` argument that defaults to `true`. Query key, endpoint, and filter mapping are unchanged. No other hook in that file was changed.

The filtered Finalize query still calls `useFinalizeListQuery(debouncedFilters)` with the default enabled behavior.

The catalog query passes `enabled: activeWorkspace === 'ot-preparation'` and still uses `OT_PREP_SURGERY_DATE_CATALOG_FILTERS` (`date: ''`). The visibility refetch of the catalog uses the same workspace gate. Prepare’s existing catalog refetch stays on the OT Preparation success path.

`FinalizeOtModal` remains a static import and stays mounted. `OtFinalizeService`, catalog constants, RESP2, SequenceNo, Prepare, Reopen, the one-schedule-date rule, and FSM were not edited.

---

## 5. PERF-04 Option A protection

No Waiting List population change. `useWaitingListQuery` still loads the existing waiting-list GET. Client filtering, counts, seven-zone ordering, pagination, Owner, status tabs, actions, and C-01 behavior were not converted to server-side query.

Option B was not implemented.

---

## 6. PERF-05 implementation

`GetFollowupAgingAsync` replaces the five pending `CountAsync` calls with one `GroupBy` conditional aggregation over the same `pending` query. Predicates are the existing half-open `SessionDate` bounds.

`BuildPendingDecisionQuery`, period, scope, My Work, Authorized Branch, bucket list loads, list order, truncation, and `CounselingAnalyticsAgingDto` are unchanged.

`CounselingAnalyticsModels.cs`, `CounselingController.cs`, and the Analytics frontend callers were not modified. No index or schema change.

An empty pending set returns zero total and zero bucket counts, matching the previous `CountAsync` result on an empty query.

---

## 7. Production files changed for this implementation

| File | Change |
|------|--------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx` | OT Returned load gate |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | Catalog query enabled only for OT Preparation |
| `apps/hospital-portal-web/src/hooks/use-counsellors-desk-queries.ts` | Optional `enabled` on `useFinalizeListQuery`, default `true` |
| `microservices/auth-service/AuthService/Services/CounselingAnalyticsService.cs` | One aging count aggregation |

`waiting-list/page.tsx` and `finalize-surgery/page.tsx` already had unrelated uncommitted work before this implementation. That work was not reverted. This implementation only added the gates described above.

---

## 8. Test files changed

| File | Change |
|------|--------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/waiting-list-ot-returned-deferred-load.contract.test.ts` | **Created.** Timing contract |
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.test.ts` | PERF-03 assertions added. File already had unrelated uncommitted content, which was kept |
| `AuthService.Tests/CounselingAnalyticsServiceTests.cs` | `Aging_EmptyPopulation_AllCountsZero` added |

`Phase2ZAgingPostgresSafeTests.cs` and `Phase3ISlice11AnalyticsAttributionTests.cs` were not edited.

---

## 9. Test results

Frontend, Vitest, 2026-09-26:

**18 files, 146 tests, all passed.**

Includes the new OT Returned deferral contract, OT Returned membership/action/start, work-row, client filters, pagination, branch scope, lifecycle contracts, catalog and PERF-03 assertions, Finalize package 1, RESP2, modal footer actions, analytics drill-down, and print report.

Backend, `dotnet test` filter on `CounselingAnalyticsServiceTests`, `Phase2ZAgingPostgresSafeTests`, and `Phase3ISlice11AnalyticsAttributionTests`:

**Passed: 32. Failed: 0. Skipped: 0.**

The default Auth Service output copy was locked by a running `AuthService` process (PID 9512). Tests were run with a separate output directory so that process was not stopped. The alternate output was removed after the run. No product file was added for that reason.

No boundary discrepancy was observed. Aging total, four buckets, empty population, period, branch scope, and counsellor attribution assertions passed on the grouped query.

---

## 10. Before / after measurements

| Comparison | Browser timing | Code-level check |
|------------|----------------|------------------|
| Waiting List initial load | **UNAVAILABLE** | Contract: OT-return `listJourneys` and `getPatientSessions` are behind the OT Returned tab gate |
| OT Returned tab activation | **UNAVAILABLE** | Contract: selecting the tab is what allows the existing load path |
| Finalize initial load | **UNAVAILABLE** | Catalog `enabled` is `activeWorkspace === 'ot-preparation'` |
| Switch to OT Preparation | **UNAVAILABLE** | Same undated `OT_PREP_SURGERY_DATE_CATALOG_FILTERS` query is enabled |
| Analytics aging response | **UNAVAILABLE** | Existing aging tests passed, including empty population and bucket counts |

A lower request count is not reported as a user-facing percentage improvement. No millisecond saving is claimed.

---

## 11. Measurement limitations

No browser performance panel, network waterfall, or main-thread profile was available in this session. Payload sizes and cost class (network, server, client render, shared initialization) were not measured. Shared shell cost remains unmeasured.

---

## 12. Protected behavior

Unchanged by this implementation:

- C-01, seven-zone worklist, metrics, filters, Owner, actions, pagination, branch authorization
- accepted Sessions correction
- Finalize / OT FSM, RESP2, SequenceNo, Prepare, Reopen, one-schedule-date rule, print, Finalised population
- Follow-up attribution and ReQueue
- Analytics formulas, My Work, Authorized Branch, aging bucket boundaries, drill-down, CSV, Print, Refresh
- permissions and ownership
- Wave 2 and Visual Polish

---

## 13. API, DTO, database, permissions, ownership, FSM

| Area | This implementation |
|------|---------------------|
| APIs | **NONE MODIFIED** |
| DTOs | **NONE MODIFIED** |
| Database, indexes, schema | **NONE MODIFIED** |
| Permissions | **NONE MODIFIED** |
| Ownership | **NONE MODIFIED** |
| Workflow / FSM | **NONE MODIFIED** |
| Visual UI | **NONE MODIFIED** by this package |

---

## 14. Rollback and safety

The three code changes are separate:

- PERF-02: remove the `activeTab !== 'OtReturned'` return and drop `activeTab` from that effect’s dependency list.
- PERF-03: call the catalog query without the second argument and restore the unguarded visibility refetch. Remove the optional `enabled` parameter.
- PERF-05: restore the five `CountAsync` calls in `GetFollowupAgingAsync`.

No certified behavior was changed to make the grouped query pass. No unrelated refactor was bundled in.

---

## 15. Out of scope

Not started: PERF-04 Option B, PERF-06, PERF-07, virtualization, memoization architecture, broad React optimization, new monitoring, caching, Redis, shell, TopNav, layout, chart library, indexes, migrations.

Visual Standard remains closed. Visual Polish remains completed separately.

---

## 16. Gate

| Item | Status |
|------|--------|
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
| Next gate | Manual UAT of Waiting List, Sessions, Finalize / OT, Follow-up, and Analytics, including OT Returned loading and OT Preparation catalog timing. Do not record acceptance from this report |
