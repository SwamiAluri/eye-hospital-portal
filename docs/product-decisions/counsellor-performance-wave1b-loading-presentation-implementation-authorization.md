# Counsellor Performance Wave 1B — Package B Implementation Authorization

| Field | Value |
|-------|--------|
| **Status** | **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED** |
| **Date** | 2026-09-26 |
| **Source Product Decision** | `docs/product-decisions/counsellor-performance-wave1b-loading-presentation-product-decision.md` |
| **Product Decision status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Product Owner selection** | **PD-LD-01 through PD-LD-07 APPROVED** (2026-09-26) |
| **Production implementation** | **NOT STARTED** |
| **Production code** | **NONE MODIFIED** |
| **Tests** | **NONE MODIFIED** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

This document authorizes a future implementation of loading presentation only. It does not perform that implementation.

**IMPLEMENTATION IS NOT YET EXECUTED.**

---

## 1. Purpose

Authorize only the presentation corrections in PD-LD-01 through PD-LD-07.

The UI must distinguish:

| State | Meaning |
|-------|---------|
| **LOADING** | The request for that region has not succeeded and has not failed |
| **SUCCESS WITH DATA** | The request succeeded and returned records |
| **SUCCESS EMPTY** | The request succeeded and returned zero records |
| **ERROR** | The request failed |

LOADING must not look like a resolved operational zero. SUCCESS EMPTY keeps today’s genuine zero and empty copy. ERROR must not look like SUCCESS EMPTY.

This is not a performance implementation. No millisecond or percentage claim is authorized.

---

## 2. Authorized changes

### PD-LD-01 — Waiting List summary

While the primary waiting-list request is pending, summary cards must not show resolved numeric `0`. Keep the existing card structure. Use `components/ui/skeleton.tsx` or the existing Follow-up `—` pattern.

After success, existing count formulas and values stay, including a genuine `0`.

Do not change count formulas, tab membership, C-01, filters, Owner, pagination, API, DTO, branch authorization, or worklist membership.

### PD-LD-02 — OT Returned summary

While OT Returned is selected and the existing PERF-02 request is pending, do not show `otReturnedRows.length` as a resolved `0`. Keep the existing OT Returned worklist skeleton. The journey and per-patient session calls still start only after that tab is selected.

After success, show the actual count, including a genuine `0`. Membership, actions, and start-counselling stay.

Do not change the journey request, per-patient session lookups, membership filter, branch scope, pagination, actions, session creation, ownership, or C-01.

### PD-LD-03 — Finalize summary

While the filtered Finalize request is pending, do not show Scheduled, Awaiting Finalise, or Surgery Done as resolved numeric `0`. Keep the three cards.

After success, existing predicates and values stay, including genuine zeros.

Do not change FSM, RESP2, SequenceNo, Prepare, Reopen, cancellation, filters, pagination, API, DTO, service behavior, permissions, or ownership.

### PD-LD-04 — OT Preparation Finalised

While the undated catalog request is pending, do not show Finalised as a resolved `0`. Keep the existing OT Preparation worklist skeleton. The catalog stays enabled only while OT Preparation is active (PERF-03).

After success, show the actual Finalised count, including a genuine `0`. Selected stays the current selection count.

Do not change catalog filters, the omitted date, SequenceNo, the one-schedule-date rule, Prepare, Reopen, FSM, RESP2, pagination, API, DTO, or database behavior.

### PD-LD-05 — OT catalog error

On catalog failure, do not render “No Finalised surgeries”. Use the existing Sessions or Analytics alert pattern: `role="alert"` and a retry that calls the existing catalog refetch.

SUCCESS EMPTY still uses “No Finalised surgeries”.

Do not add an error framework, toast system, retry abstraction, API change, query change, or service change.

### PD-LD-06 — Accessible worklist loading

Keep the existing visual skeleton. Add one `role="status"` announcement per in-scope loading region, following Sessions. Decorative skeleton bars stay `aria-hidden`.

In-scope skeletons are the ones that currently hide the whole loader:

- `WaitingListQueueWidget` worklist skeleton
- Finalize Surgery local `WorklistSkeleton`
- OT Preparation use of that same skeleton
- Follow-up worklist pulse in `surgery-followup/page.tsx`

Sessions already announces loading. Do not rewrite it.

Do not expose each bar, redesign headings, focus, grid semantics, or accessibility outside this announcement.

### PD-LD-07 — Existing primitives only

Use existing primitives. Prefer `components/ui/skeleton.tsx` by import. Allowed patterns: Sessions `role="status"`, Waiting List and Finalize worklist skeletons, Follow-up `—`, Analytics pulse blocks, Finalize modal pulse shell.

Do not create a loading framework, shared loading component, animation library, global spinner, theme, token, chart system, or design system.

If a new shared primitive is required, stop:

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

---

## 3. Files a future implementation may modify

Inspected, not modified. A file not listed here is a stop.

`components/ui/skeleton.tsx` is **read-only**. Use it. Do not edit it. It is shared outside Counsellor.

### Production

| File | Allowed change |
|------|----------------|
| `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx` | Pending presentation for summary values already passed in. No new count formula |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx` | Pass existing pending flags into the summary only. Do not move the PERF-02 gate or the waiting-list query |
| `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx` | One `role="status"` announcement around the existing skeleton. Skeleton geometry stays `aria-hidden` |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | Pending presentation on the three Finalize cards and the Finalised card. Catalog `isError` branch with existing alert and `catalogQuery.refetch`. One status announcement on the local worklist skeleton. Do not change `enabled` on the catalog query |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx` | PD-LD-06 announcement only, on the existing list pulse. Do not change stats, tabs, or queries |

### Tests

Only these files, and only to prove section 4. Do not weaken existing assertions.

| File | Allowed change |
|------|----------------|
| `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.test.tsx` | Pending is not numeric `0`. A supplied genuine `0` still renders `0` |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/waiting-list-ot-returned-deferred-load.contract.test.ts` | May add a source assertion that the OT Returned count is gated on `otReturnedLoading`. Must still prove PERF-02 |
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.test.ts` | May add source assertions for pending Finalised presentation, catalog error versus empty copy, and that PERF-03 `enabled` stays. Must not drop SequenceNo, Prepare, Reopen, or RESP2 assertions |
| `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.test.tsx` | One status announcement. Skeleton bars stay `aria-hidden` |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.test.tsx` | Only if it asserts the current skeleton markup and must recognize `role="status"` |

No other test file. No production file outside the table. If either is required, stop with the message in section 7.

---

## 4. Tests the future implementation must satisfy

Existing certified tests must still pass. Do not rewrite them to force a pass.

| Decision | Tests must show |
|----------|-----------------|
| PD-LD-01 | Pending Waiting List summary is not a resolved numeric `0`. A successful empty payload may show `0`. Count behavior after success is unchanged |
| PD-LD-02 | OT Returned calls still start only after the tab is selected. Pending count is not a resolved `0`. Successful empty is a genuine `0`. PERF-02 stays |
| PD-LD-03 | Pending Finalize summary is not resolved numeric zeros. Success still uses the existing three predicates. Genuine zero stays `0` |
| PD-LD-04 | Catalog stays disabled on Finalize and enables on OT Preparation. Pending Finalised is not a resolved `0`. Successful empty catalog keeps genuine zero and empty copy |
| PD-LD-05 | Catalog error renders the error state and not “No Finalised surgeries”. Successful empty still renders that empty copy |
| PD-LD-06 | Each in-scope loading region has one `role="status"`. Decorative skeleton geometry stays hidden |
| PD-LD-07 | No new loading module, library, token, or animation framework is added |

---

## 5. Protected behavior

Leave unchanged on success:

- C-01, accepted Sessions correction, Phase 3I closure, Phase 3I ownership
- Finalize and OT FSM, RESP2, SequenceNo, Prepare, Reopen, one-schedule-date rule
- Follow-up attribution, ReQueue, stats source
- Analytics formulas, My Work, Authorized Branch
- permissions, ownership, routes, APIs, DTOs, database behavior
- Wave 2, Visual Polish
- PERF-02, PERF-03, PERF-04 Option A, PERF-05

Refresh must not replace populated rows or successful counts with zeros. Where the current query already keeps previous data, keep it and keep the existing refresh indicator. Do not change TanStack Query defaults. Do not change query keys.

`FinalizeOtModal` stays mounted. Do not change its loading shell or its lookups.

---

## 6. Out of scope

Not authorized:

- navigation speed, route transitions, row-click speed, Sessions performance, Finalize Open lookups, API consolidation, request parallelism, database, server, browser, or main-thread optimization
- PERF-04 Option B, PERF-06, PERF-07, virtualization, broad memoization
- `dashboard/layout.tsx`, TopNav, auth initialization, shared shell
- a new loading framework or global loading system
- APIs, DTOs, controllers, services, database, indexes, migrations, Redis, query architecture
- ownership, permissions, workflow, FSM, routes, state transitions, count formulas, Analytics formulas, Waiting List pagination or filters, C-01
- design system, theme, tokens, animation system, chart redesign, Visual Polish, Wave 2, accessibility redesign

---

## 7. Stop conditions

Stop, with no product decision inside the implementation, if the work needs any item in section 6, or any file outside section 3, including:

- a new endpoint, DTO, backend service, database, index, or schema change
- shell, TopNav, or auth initialization
- a new loading abstraction
- query-key or TanStack Query configuration redesign
- a count formula or API response change
- ownership, permission, workflow, FSM, or route change
- lazy-mounting `FinalizeOtModal`
- editing `components/ui/skeleton.tsx`

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

---

## 8. Rollback

Each presentation change must be reversible on its own: summary pending display, catalog error branch, and the status announcement.

Rollback restores the previous pending, success, and error/empty paint. It must not remove PERF-02 or PERF-03 gates. If a certified success-state regression appears, stop and report it. Do not change product behavior to hide it.

---

## 9. Manual UAT

Mandatory after implementation and automated tests. The implementation task must not record UAT as passed.

Cover Waiting List (initial load, summary loading, populated success, empty success, OT Returned loading and empty success, search, filters, Owner, pagination, actions), Sessions (initial load, pagination, Reassignment Required, Open, accepted correction), Finalize (initial load, summary loading, success, empty success, filters, Open, Finalise, Reopen, Cancel), OT Preparation (activation, catalog loading, Finalised pending, populated success, empty success, failure, retry, selection, Prepare, SequenceNo, one-schedule-date rule, Reopen), Follow-up (initial load, tabs, search, Refresh, existing loading presentation, actions), and Analytics (initial load, existing pending presentation, scope, period, Refresh, charts, aging, drill-down).

UAT does not accept navigation, row-click, API, or database speed.

---

## 10. Future implementation report

After implementation, create `docs/product-decisions/counsellor-performance-wave1b-loading-presentation-implementation-report.md` with:

- this authorization and the Product Decision
- PD-LD-01 through PD-LD-07
- exact files and loading-state changes
- tests and results
- success-state behavior unchanged
- PERF-02, PERF-03, PERF-04 Option A, and PERF-05 intact
- no API, DTO, database, permission, ownership, or FSM change
- limitations and rollback
- Manual UAT: **NOT EXECUTED**
- Acceptance: **NOT RECORDED**

Do not claim a timed performance improvement. Do not claim navigation or row-click speed was fixed.

Do not create that report in this task.

---

## 11. Governance

This authorization is not implementation, not test completion, not UAT, and not acceptance.

Sequence: implementation, then automated tests, then Manual UAT, then acceptance.

Do not record acceptance in the implementation task. Do not continue into runtime Packages A, C, D, or E from this package.

---

## 12. State at creation of this authorization

| Item | Status |
|------|--------|
| Implementation Authorization | **CREATED / BOUNDED** |
| PD-LD-01 through PD-LD-07 | **AUTHORIZED FOR IMPLEMENTATION** |
| Production implementation | **NOT YET EXECUTED** |
| Automated tests | **NOT YET EXECUTED** for this package |
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
| Production code | **NONE MODIFIED** |
| Tests | **NONE MODIFIED** |
| Next gate | **IMPLEMENTATION → AUTOMATED TESTS → MANUAL UAT → ACCEPTANCE** |

**IMPLEMENTATION IS NOT YET EXECUTED.**
