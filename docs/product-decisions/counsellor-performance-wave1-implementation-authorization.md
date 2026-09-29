# Counsellor Performance — Wave 1 Implementation Authorization

| Field | Value |
|-------|--------|
| **Status** | **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED** |
| **Date** | 2026-09-26 |
| **Source Product Decision** | `docs/product-decisions/counsellor-performance-wave1-product-decision.md` |
| **Product Decision status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Product Owner selection** | 2026-09-26 |
| **Source audit** | `docs/audits/counsellor-performance-deep-audit.md` |
| **Production implementation** | **NOT STARTED** |
| **Production code** | **NONE MODIFIED** |
| **Tests** | **NONE MODIFIED** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |
| **Implementation report** | **NOT CREATED** |
| **Visual Standard** | **CLOSED** |
| **Visual Polish** | **COMPLETED** |

This document authorizes a future implementation. It does not perform that implementation.

Creating this file does not modify production code, tests, APIs, DTOs, database objects, permissions, ownership, workflow, or visual UI.

**NO PRODUCTION CHANGE IS MADE BY THIS AUTHORIZATION.**

---

## 1. Authorized packages

| Package | Authorization |
|---------|----------------|
| PERF-01 Measurement baseline | **AUTHORIZED** as measurement only. No production behavior change |
| PERF-02 Waiting List OT Returned deferred loading | **AUTHORIZED** as timing of existing calls |
| PERF-03 Finalize OT catalog deferred loading | **AUTHORIZED** as timing of the existing catalog request |
| PERF-04 Option A — retain full Waiting List queue | **AUTHORIZED** as a protection constraint. No architecture change |
| PERF-05 Analytics aging aggregation | **AUTHORIZED** as query consolidation inside the current response |

## 2. Explicitly not authorized

| Package | Status |
|---------|--------|
| PERF-04 Option B — server-side Waiting List population, search, filter, or pagination | **NOT AUTHORIZED** |
| PERF-06 — lazy-mount `FinalizeOtModal` | **DEFERRED** |
| PERF-07 — client render refactor, virtualization, memoization architecture, broad React optimization | **DEFERRED** |

Do not reinterpret these selections.

---

## 3. File inspection (not modified)

Inspected on 2026-09-26. Paths below are the current implementation. File names were not assumed.

### PERF-02 — current load

`apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`

After `branchId` exists, an effect calls `loadOtReturned` immediately and again on `visibilitychange`. That function calls:

- `ipManagementApi.listJourneys({ branchId, clinicalState: 'ReadyForSurgery' })` in `src/lib/api/ip-management.api.ts`
- `counselingSessionsApi.getPatientSessions(patientId)` once per distinct patient, in `src/lib/api/counseling-sessions.api.ts`

Rows are produced with `filterOtReturnedOperationalRows` from `src/lib/counsellors-desk/ot-returned-membership.ts`.

The OT Returned tab is already a status on this page. The load does not wait for that tab.

### PERF-03 — current catalog request

`apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`

`activeWorkspace` is `'finalization'` or `'ot-preparation'`.

Two queries start on every visit:

- `useFinalizeListQuery(debouncedFilters)` — filtered Finalize list
- `useFinalizeListQuery({ ...OT_PREP_SURGERY_DATE_CATALOG_FILTERS })` — undated catalog

The hook is `useFinalizeListQuery` in `apps/hospital-portal-web/src/hooks/use-counsellors-desk-queries.ts`. It has no `enabled` flag. Both calls therefore run whenever the page is mounted.

`OT_PREP_SURGERY_DATE_CATALOG_FILTERS` in `src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.ts` omits the date. `GetFinalizeListAsync` in `microservices/auth-service/AuthService/Services/OtFinalizeService.cs` applies no date predicate when the date is omitted. That service must stay unchanged.

`FinalizeOtModal` is a static import and is rendered with the page. PERF-06 forbids changing that mount.

### PERF-05 — current aging counts

`GetFollowupAgingAsync` in `microservices/auth-service/AuthService/Services/CounselingAnalyticsService.cs`

The method builds one pending query, then runs five `CountAsync` calls: `totalPending`, then `c03`, `c47`, `c814`, and `c15`, using the existing half-open `SessionDate` bounds. It then loads bucket session lists. The response type is `CounselingAnalyticsAgingDto` in `microservices/auth-service/AuthService/Models/Counselor/CounselingAnalyticsModels.cs`.

The endpoint is `GET analytics/followup-aging` on `CounselingController`. The client reads it through `useCounselorFollowupAging` in `src/hooks/use-counselor-analytics.ts`, consumed by `CounselorAnalyticsTab.tsx` and `FollowupAgingTable.tsx`.

---

## 4. Files a future implementation may modify

Only the files in this section. A required edit anywhere else is a stop. Use:

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

### PERF-01

No production file. No test file. Record observations in the future implementation report. If a measurement cannot be taken with existing browser or developer tooling, record **UNAVAILABLE**. Do not invent a number. Do not change production code to obtain a measurement.

### PERF-02 production

| File | Allowed change |
|------|----------------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx` | Gate `loadOtReturned`, including the visibility reload, so it runs only when the OT Returned tab is selected. Keep the existing journey call, per-patient session calls, membership filter, empty path, and error toast |

### PERF-02 tests

| File | Allowed change |
|------|----------------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/waiting-list-ot-returned-deferred-load.contract.test.ts` | **May be created.** Prove the timing rules in section 8. Do not weaken C-01 or membership tests |

Do not modify `ot-returned-membership.ts`, `ot-returned-action.ts`, `start-ot-returned-counselling.ts`, `ip-management.api.ts`, `counseling-sessions.api.ts`, client filters, pagination, or waiting-list API clients. Those existing tests stay unchanged and must still pass:

- `ot-returned-membership.test.ts`
- `ot-returned-action.test.ts`
- `start-ot-returned-counselling.test.ts`
- `WaitingListWorkRow.ot-returned.test.tsx`
- `waiting-list-client-filters.test.ts`
- `waiting-list-pagination.test.ts`
- `waiting-list-branch-scope.test.ts`
- waiting-list lifecycle contract tests under `waiting-list/`

### PERF-03 production

| File | Allowed change |
|------|----------------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | Request the existing catalog only while `activeWorkspace === 'ot-preparation'`. Keep the filtered Finalize query enabled on the Finalize workspace. Do not refetch the catalog while Finalize is active. Keep `FinalizeOtModal` statically mounted |
| `apps/hospital-portal-web/src/hooks/use-counsellors-desk-queries.ts` | Only an optional `enabled` argument on `useFinalizeListQuery`, default `true`. No other hook, key, endpoint, or filter mapping in that file |

The default `true` keeps the filtered Finalize list request unchanged. The page passes `enabled: activeWorkspace === 'ot-preparation'` only for the catalog call.

### PERF-03 tests

| File | Allowed change |
|------|----------------|
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.test.ts` | Add assertions that the page does not enable the undated catalog while Finalize is active, and does enable the existing `OT_PREP_SURGERY_DATE_CATALOG_FILTERS` query when OT Preparation is active. Do not change catalog math, date bounds, SequenceNo, Prepare, or RESP2 expectations already in this file |

Do not modify `ot-preparation-surgery-date-catalog.ts`, `OtFinalizeService.cs`, `FinalizeOtModal.tsx`, or the RESP2 module. Existing Finalize/OT tests must still pass, including `finalize-ot-prep-resp2.test.tsx` and `finalize-package1.test.tsx`. Those files are not an edit target unless a source assertion makes the authorized `enabled` flag fail for a reason other than lazy-mounting the modal. Lazy-mounting the modal is forbidden. If the existing “page contains `FinalizeOtModal`” contract cannot be kept, stop.

### PERF-04

No file. Do not edit Waiting List population, search, date range, type, Owner, status tabs, counts, seven-zone ordering, actions, pagination, or branch scope. The full queue from the existing waiting-list GET remains the source for client-side logic.

### PERF-05 production

| File | Allowed change |
|------|----------------|
| `microservices/auth-service/AuthService/Services/CounselingAnalyticsService.cs` | Inside `GetFollowupAgingAsync` only: replace the five pending `CountAsync` calls with one grouped or conditional aggregation over the same `pending` query. Keep `BuildPendingDecisionQuery`, the existing `SessionDate` bounds, bucket list loads, truncation, and the returned `CounselingAnalyticsAgingDto` |

### PERF-05 tests

These tests must pass with the same assertions. Add an assertion in the first file only if it is required to prove the five counts were replaced without changing results:

| File | Allowed change |
|------|----------------|
| `AuthService.Tests/CounselingAnalyticsServiceTests.cs` | Aging total, four buckets, scope, and response fields stay equivalent |
| `AuthService.Tests/Phase2ZAgingPostgresSafeTests.cs` | Boundary and population behavior stay equivalent. Prefer no edit |
| `AuthService.Tests/Phase3ISlice11AnalyticsAttributionTests.cs` | My Work / counsellor attribution stays equivalent. Prefer no edit |

Do not modify:

- `CounselingAnalyticsModels.cs`
- `CounselingController.cs`
- `use-counselor-analytics.ts`
- `CounselorAnalyticsTab.tsx`
- `FollowupAgingTable.tsx`
- `analytics-drilldown.ts`
- `AnalyticsPrintReport.tsx`

If the frontend must change to keep charts, CSV, Print, drill-down, or Refresh working, stop. The response shape is unchanged, so those callers stay as they are.

### Implementation report (after implementation, not in this task)

The future implementation creates `docs/product-decisions/counsellor-performance-wave1-implementation-report.md`. Do not create it in this task.

---

## 5. PERF-01 — measurement baseline

Mandatory before any performance improvement claim.

Use existing browser and developer tooling already available to the team. Do not introduce a monitoring platform.

Capture, where technically available:

- route navigation time
- time until the page shell becomes usable
- API request count
- request waterfall
- largest response payloads
- Waiting List initial-load request duration
- Finalize initial-load request duration
- Sessions initial-load request duration
- Follow-up initial-load request duration
- Analytics initial-load request duration
- Finalize first Open → dialog visible
- first interaction → modal or sheet visible where relevant
- repeated click or action latency where observable

Every observation records:

- route
- action
- request or requests
- timing
- payload size when the tooling shows it
- cost class: network, server, client render, or shared initialization

Token, sidebar, and header initialization is **shared**. Do not attribute it to one Counsellor route.

If tooling cannot capture an item, record **UNAVAILABLE**. Do not invent milliseconds or a percentage.

Capture this baseline before claiming improvement for PERF-02, PERF-03, or PERF-05. Compare the same scenario before and after. A lower request count is not, by itself, a user-facing improvement. State the cost class the measurement actually supports.

---

## 6. PERF-02 — authorized behavior

OT Returned journey and per-patient session loading runs only when the OT Returned tab is selected.

Before that tab is selected, do not call `listJourneys` for OT return or `getPatientSessions` for that fan-out. The initial Waiting List stays usable with the existing seven-zone worklist, metrics, filters, Owner, actions, pagination, branch authorization, ownership presentation, and the existing non-OT-return populations.

When OT Returned is selected:

- show the existing loading state (`otReturnedLoading`)
- load with the existing `listJourneys` and per-patient `getPatientSessions` calls
- show the existing empty state when the filtered rows are empty
- keep the existing error toast path
- reproduce the current OT Returned population through `filterOtReturnedOperationalRows`
- keep patient/session relationships, ownership presentation, dependent counts, and existing actions

Do not replace the per-patient session calls with a new endpoint. Do not add an API or a DTO. Do not change permissions, ownership, C-01, search, date, type, Owner, status semantics, or seven-zone ordering.

The optimization is when the existing calls run.

The visibility reload of `loadOtReturned` follows the same gate. The separate waiting-list refetch on visibility stays.

---

## 7. PERF-03 — authorized behavior

The additional OT catalog request runs only when OT Preparation is the active workspace.

While Finalize Surgery is active:

- keep the existing filtered `useFinalizeListQuery(debouncedFilters)` request
- do not request `OT_PREP_SURGERY_DATE_CATALOG_FILTERS`

When OT Preparation becomes active:

- request that same catalog filter
- show the loading state the page already uses for `catalogQuery`
- keep existing empty and error behavior
- keep existing catalog semantics

The undated catalog remains the full authorized-branch date universe. Do not add a date restriction, pagination, endpoint, API semantic change, DTO change, database query change, or index.

Preserve Finalize Surgery, OT Preparation, the Finalised population, selection, Prepare, SequenceNo, the one-schedule-date rule, Reopen, FSM, RESP2, pagination, filters, and print.

The only authorized behavior change is when the existing catalog request occurs.

`FinalizeOtModal` stays mounted with the page.

---

## 8. PERF-04 Option A — protection

Keep the current full Waiting List queue. The existing `GET /Counseling/waiting-list` result remains the population that client filters, counts, seven-zone ordering, and pagination read.

Do not implement server-side Waiting List population, search, filter, or pagination.

Do not change C-01, search, date range, type, Owner, status tabs, full-population counts, seven-zone ordering, actions, pagination, branch scope, or OT Returned semantics.

PERF-04 Option B is **NOT AUTHORIZED**.

The full-queue architecture may be reconsidered only in a later Product Decision, and only if PERF-01 evidence justifies it. That reconsideration is not this authorization.

---

## 9. PERF-05 — authorized behavior

Replace the five pending `CountAsync` executions with one grouped or conditional aggregation over the same pending population.

The existing API response shape stays unchanged. Callers keep the same aging fields, including `TotalPending`, `Counts` (`bucket_0_3`, `bucket_4_7`, `bucket_8_14`, `bucket_15_plus`), and `Buckets`.

Preserve exactly:

- the same pending population from `BuildPendingDecisionQuery`
- the same period and date window
- the same scope
- My Work and Authorized Branch
- the same total
- the same four bucket boundaries (half-open `SessionDate` bounds already in the method)
- the same formulas elsewhere
- drill-down, CSV, Print, and Refresh

Do not change the API contract, DTOs, endpoints, indexes, schema, formulas, scope, or period behavior.

Bucket session list queries are not part of the five-count consolidation. Do not drop, reorder, or re-bound those lists. Truncation behavior stays.

No index work is authorized.

---

## 10. Stop conditions

Stop immediately, with no workaround, if the implementation would require any of the following:

- `dashboard/layout.tsx`
- `TopNav`
- shared shell or shared dashboard skeleton
- a new API endpoint
- API contract redesign
- DTO redesign, including `CounselingAnalyticsAgingDto`
- `OtFinalizeService.cs` or `GetFinalizeListAsync` changes
- a new database index or schema migration
- a new caching layer or Redis
- permission or ownership changes
- workflow or FSM changes
- route changes
- Waiting List server-side pagination or filtering
- PERF-04 Option B
- `FinalizeOtModal` lazy mounting
- virtualization
- React architecture changes
- memoization architecture changes
- visual changes
- accessibility redesign
- chart library changes
- Analytics formula changes
- edits to `ip-management.api.ts` or `counseling-sessions.api.ts`
- edits to `ot-returned-membership.ts` or catalog date-filter constants
- any file not listed in section 4

Stop message, exactly:

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

---

## 11. Automated tests the future implementation must satisfy

Add or update only the tests named in section 4. They must prove the following. Do not add broad performance tests outside these packages.

### PERF-02

1. OT Returned-specific data is not requested before OT Returned is selected.
2. Selecting OT Returned triggers the existing journey and per-patient session loading.
3. The OT Returned population stays equivalent.
4. Patient/session relationships stay equivalent.
5. Ownership presentation stays equivalent.
6. Dependent counts stay equivalent.
7. Existing OT Returned actions stay equivalent.
8. Seven-zone Waiting List behavior stays unchanged.
9. C-01 behavior stays unchanged.

### PERF-03

1. The undated OT catalog is not requested while Finalize Surgery is active.
2. OT Preparation requests the existing catalog when that workspace is activated.
3. Catalog semantics stay unchanged, including the omitted date.
4. SequenceNo stays unchanged.
5. The one-schedule-date rule stays unchanged.
6. Prepare stays unchanged.
7. Reopen stays unchanged.
8. FSM stays unchanged.
9. RESP2 stays unchanged.

### PERF-04

1. The full Waiting List queue remains the source population.
2. No server-side Waiting List pagination or filter architecture is added.
3. C-01 stays unchanged.
4. Full-population counts stay unchanged.
5. Seven-zone ordering stays unchanged.
6. Owner behavior stays unchanged.

These are protections. Do not add a new server-paging test suite. Existing waiting-list contract tests must still pass.

### PERF-05

1. Aging total matches existing behavior.
2. Each of the four buckets matches existing behavior.
3. Boundary dates match existing behavior.
4. An empty population matches existing behavior.
5. My Work scope matches existing behavior.
6. Authorized Branch scope matches existing behavior.
7. Period changes match existing behavior.
8. The API response shape stays unchanged.
9. Existing Analytics formulas stay unchanged.

---

## 12. Rollback and safety

Each of PERF-02, PERF-03, and PERF-05 must be independently reversible. Do not bundle unrelated refactors.

If a certified behavior regression appears:

- stop
- do not change product behavior to work around it
- document the regression
- restore the prior behavior
- report the scope issue

PERF-01 has no production rollback. PERF-04 has no code change to roll back.

---

## 13. Manual UAT (after implementation)

Manual UAT is mandatory after implementation and automated tests. Do not record UAT as PASS during implementation. This authorization does not execute UAT.

### Waiting List

Initial load, tabs, search, filters, Owner, pagination, OT Returned, OT Returned loading, OT Returned empty and error behavior, existing actions.

### Sessions

Initial load, pagination, Reassignment Required, Open.

### Finalize / OT

Finalize initial load, workspace switch, filters, Open, Finalise, Reopen, OT Preparation, Prepare, selection, SequenceNo behavior.

### Follow-up

Initial load, tabs, search, Refresh, row actions.

### Analytics

Initial load, scope, period, Refresh, aging, charts, drill-down.

Where tooling can capture it, retain before/after timing with the PERF-01 fields. Do not mark acceptance from this UAT inside the implementation task. Record Manual UAT as **NOT EXECUTED** and Acceptance as **NOT RECORDED** in the implementation report until a separate acceptance step.

---

## 14. Future implementation report

After implementation, create `docs/product-decisions/counsellor-performance-wave1-implementation-report.md` with:

- authorization reference (this file)
- exact packages implemented
- exact production files changed
- exact test files changed
- PERF-01 baseline
- before/after measurements, or **UNAVAILABLE**
- PERF-02 implementation summary
- PERF-03 implementation summary
- PERF-04 Option A protection confirmation
- PERF-05 implementation summary
- protected behavior confirmation
- confirmation that APIs, DTOs, database, permissions, ownership, and FSM were not changed
- test results
- measurement limitations
- rollback and safety confirmation
- Manual UAT: **NOT EXECUTED**
- Acceptance: **NOT RECORDED**

Do not mark the implementation as accepted.

---

## 15. Protected behavior

Do not reopen or revise:

- C-01 Waiting List
- accepted Sessions correction
- Finalize / OT FSM, RESP2, SequenceNo
- Follow-up attribution and ReQueue
- Analytics formulas, My Work, Authorized Branch
- existing permissions and ownership
- Wave 2 visual standard
- Visual Polish

---

## 16. Governance at creation of this authorization

| Item | Status |
|------|--------|
| Product Decision | **APPROVED — PRODUCT DECISION RECORDED** |
| Implementation Authorization | **CREATED / BOUNDED** |
| Selected | PERF-01, PERF-02, PERF-03, PERF-04 Option A, PERF-05 |
| PERF-06 | **DEFERRED** |
| PERF-07 | **DEFERRED** |
| Production implementation | **NOT STARTED** |
| Production code | **NONE MODIFIED** |
| Tests | **NONE MODIFIED** |
| APIs | **NONE MODIFIED** |
| DTOs | **NONE MODIFIED** |
| Database | **NONE MODIFIED** |
| Permissions | **NONE MODIFIED** |
| Ownership | **NONE MODIFIED** |
| Workflow / FSM | **NONE MODIFIED** |
| Visual UI | **NONE MODIFIED** |
| Visual Standard | **CLOSED** |
| Visual Polish | **COMPLETED** |
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
| Implementation report | **NOT CREATED** |
| Next gate | Implement only the files in section 4, then write the implementation report. Do not implement from any other document alone |

**NO PRODUCTION CHANGE IS MADE BY THIS AUTHORIZATION.**
