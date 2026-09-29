# Counsellor Performance Wave 1B — Package B Loading Presentation

| Field | Value |
|-------|--------|
| **Status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Date** | 2026-09-26 |
| **Type** | Product Decision |
| **Package** | Wave 1B Package B — loading presentation only |
| **Source audit** | `docs/audits/counsellor-performance-wave1b-runtime-loading-audit.md` |
| **Product Owner selection** | **RECORDED — PD-LD-01 THROUGH PD-LD-07 APPROVED** |
| **Selection date** | 2026-09-26 |
| **Implementation authorization** | **NOT CREATED** |
| **Production code** | **NONE MODIFIED** |
| **Tests** | **NONE MODIFIED** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

The Product Owner approved PD-LD-01 through PD-LD-07 on 2026-09-26. This document records that product decision. It does not authorize implementation.

**IMPLEMENTATION IS NOT AUTHORIZED BY THIS DOCUMENT.**

---

## 1. Status

**APPROVED — PRODUCT DECISION RECORDED.** The Product Owner approved all seven decisions on 2026-09-26. Performance Wave 1 stays as implemented. Visual Standard and Visual Polish stay closed. This approval does not authorize implementation.

---

## 2. Date

2026-09-26.

---

## 3. Source audit

Primary source: `docs/audits/counsellor-performance-wave1b-runtime-loading-audit.md` (2026-09-26).

The audit is authoritative for this decision. It did not time the browser. Words are used as in that audit:

| Term | Meaning here |
|------|----------------|
| **MEASURED** | Read from source |
| **INFERRED** | A likely effect of that source |
| **UNKNOWN** | Not proven by a trace |
| **UNAVAILABLE — TOOLING LIMITATION** | No browser timing in the audit environment |

Source-proven loading defects this decision considers:

- Waiting List summary cards render numeric `0` from an empty array while the waiting-list request is pending. **MEASURED.**
- The OT Returned summary count can render `0` while the deferred OT Returned request is pending after that tab is selected. **MEASURED.**
- Finalize summary cards render `0` from `records` before the filtered Finalize request resolves. **MEASURED.**
- OT Preparation Finalised count can render `0` while the undated catalog request is pending. **MEASURED.**
- OT Preparation can show “No Finalised surgeries” after a catalog failure because there is no explicit error branch. **MEASURED.**

Already acceptable, and not a defect to rebuild:

- Worklists already use a skeleton in the relevant places.
- Sessions already announces loading with `role="status"`.
- Follow-up already uses `—` for pending KPI values.
- Analytics already hides KPI values while pending.
- Finalize modal already has an in-dialog loading shell.
- `components/ui/skeleton.tsx` already exists.

Navigation duration and row-click delay were **UNAVAILABLE — TOOLING LIMITATION**. They are not part of this decision.

No additional performance fix is inferred from this file.

---

## 4. Relationship to Performance Wave 1

Wave 1 is implemented and stays in force.

| Package | Protection |
|---------|------------|
| PERF-02 | OT Returned journeys and per-patient sessions load only when OT Returned is selected |
| PERF-03 | The undated OT catalog enables only while OT Preparation is active |
| PERF-04 Option A | Waiting List remains the full client-side queue |
| PERF-05 | Analytics aging stays one grouped aggregation with the same response semantics |

This decision does not reopen those packages. Package B, if later selected, only changes what is painted while a request is pending or failed. Successful counts, formulas, and query gates stay.

---

## 5. Product Owner decision record

| Field | Value |
|-------|--------|
| Selection date | 2026-09-26 |
| PD-LD-01 through PD-LD-07 | **SELECTED / APPROVED** |
| Product Owner statement | Approve PD-LD-01 through PD-LD-07 |

The Product Owner approved all seven decisions. Each item below is selected. Implementation still requires a separate authorization.

---

## 6. PD-LD-01 through PD-LD-07

### PD-LD-01 — Waiting List summary while the queue request is pending

**Question.** Should Waiting List summary cards avoid numeric `0` while the primary queue request is pending?

**Audit.** **MEASURED.** `tabCounts` are taken from the array, which is empty until the waiting-list query returns. The worklist itself already waits on a skeleton.

**Product Owner decision.** **SELECTED / APPROVED.** Keep the existing card structure. Show an existing loading presentation (skeleton or pulse from `components/ui/skeleton.tsx`, or the Follow-up `—` pattern). Do not show a numeric `0` as a resolved count during LOADING.

After success, show the existing certified counts. A genuine zero after a successful empty payload remains `0`.

Do not change count formulas, tab membership, filters, pagination, or the API.

**Product Owner selection.** **SELECTED / APPROVED — 2026-09-26.**

### PD-LD-02 — OT Returned summary while the deferred request is pending

**Question.** Should the OT Returned summary count avoid numeric `0` while the deferred OT Returned request is pending?

**Audit.** **MEASURED.** After the tab is selected, the count uses `otReturnedRows.length` before that load finishes. The OT Returned worklist already shows its skeleton. PERF-02 remains the load gate.

**Product Owner decision.** **SELECTED / APPROVED.** During that pending load, do not show `0` as the resolved population. Keep the existing worklist skeleton. Keep PERF-02: do not start the journey or per-patient session calls before the tab is selected.

After success, show the actual count. A genuine zero remains `0`.

**Product Owner selection.** **SELECTED / APPROVED — 2026-09-26.**

### PD-LD-03 — Finalize summary while the filtered list is pending

**Question.** Should Finalize summary cards avoid numeric `0` while the filtered Finalize request is pending?

**Audit.** **MEASURED.** Scheduled, Awaiting Finalise, and Surgery Done are derived from `records` before that list returns. The worklist already skeletons.

**Product Owner decision.** **SELECTED / APPROVED.** Keep the three cards. Show the same loading presentation as PD-LD-01 during LOADING. After success, use the existing predicates and show those exact stats. A genuine zero remains `0`.

**Product Owner selection.** **SELECTED / APPROVED — 2026-09-26.**

### PD-LD-04 — OT Preparation Finalised count while the catalog is pending

**Question.** Should the OT Preparation Finalised count avoid numeric `0` while the catalog request is pending?

**Audit.** **MEASURED.** Finalised uses the catalog-derived length while that request is in flight. The workspace list already skeletons. PERF-03 remains the enable gate.

**Product Owner decision.** **SELECTED / APPROVED.** During catalog LOADING, do not show Finalised as a resolved `0`. Keep the existing worklist skeleton. Do not request the catalog before OT Preparation is active.

After success, show the actual Finalised count. A genuine zero remains `0`. Selected count is the current selection, not the catalog population, and stays as it is.

**Product Owner selection.** **SELECTED / APPROVED — 2026-09-26.**

### PD-LD-05 — OT Preparation catalog failure

**Question.** Should a catalog failure show an error and retry state instead of the empty-state message?

**Audit.** **MEASURED.** “No Finalised surgeries” is shown when the catalog is not loading and the filtered length is 0, including after failure, because there is no error branch.

**Product Owner decision.** **SELECTED / APPROVED.** On catalog ERROR, do not show “No Finalised surgeries”. Show an error and retry using the existing Sessions or Analytics alert pattern (`role="alert"` and a retry control). Do not add a new error library or toast system.

SUCCESS EMPTY still uses the existing empty copy after a successful empty catalog.

**Product Owner selection.** **SELECTED / APPROVED — 2026-09-26.**

### PD-LD-06 — Accessible worklist loading announcement

**Question.** Should Counsellor worklist skeletons expose one accessible loading announcement while decorative skeleton geometry stays hidden?

**Audit.** **MEASURED.** Waiting List, Finalize, and Follow-up worklist pulses are `aria-hidden`. Sessions uses `role="status"` and visible loading text.

**Product Owner decision.** **SELECTED / APPROVED.** Keep the existing visual skeleton. Add one `role="status"` announcement, using the Sessions pattern, with visually hidden or equivalent existing text such as “Loading”. Do not expose each decorative bar to assistive technology.

Do not redesign focus, headings, or other accessibility outside this loading announcement.

**Product Owner selection.** **SELECTED / APPROVED — 2026-09-26.**

### PD-LD-07 — Existing primitives only

**Question.** Should the above use existing Hospital Portal loading primitives and patterns rather than a new loading component or system?

**Audit.** The audit said a new shared loading primitive is not required for the first package. `components/ui/skeleton.tsx` already provides pulse.

**Product Owner decision.** **SELECTED / APPROVED.** Use that skeleton and the existing Counsellor patterns named in section 10. Do not add a design system, loading library, animation framework, global spinner, theme, token, or chart system.

If a later implementation finds that a new shared primitive is actually required, stop. That is a separate Product / Architecture Decision. It is not part of Package B.

**Product Owner selection.** **SELECTED / APPROVED — 2026-09-26.**

---

## 7. Approved scope

The Product Owner approved this scope on 2026-09-26. It is the product scope only. It does not authorize implementation.

The only approved scope is:

| ID | During LOADING or ERROR | After success |
|----|-------------------------|---------------|
| A. Waiting List summary | No operational numeric `0`. Existing cards stay. Skeleton, pulse, or `—` | Existing certified counts. Real zero stays `0` |
| B. OT Returned summary | No resolved `0` while the deferred request is pending. Existing list skeleton stays. PERF-02 stays | Actual count. Real zero stays `0` |
| C. Finalize summary | No misleading zeros on Scheduled, Awaiting Finalise, or Surgery Done. Existing cards stay | Existing stats and predicates |
| D. OT Preparation Finalised | No resolved `0` while the catalog request is pending. Existing list skeleton stays. PERF-03 stays | Actual Finalised count. Real zero stays `0` |
| E. OT catalog failure | Error and retry. Not “No Finalised surgeries” | Empty copy only for SUCCESS EMPTY |

Count formulas, tab semantics, filters, pagination, and APIs stay unchanged.

---

## 8. Loading state contract

Two paths:

LOADING → SUCCESS WITH DATA, or LOADING → SUCCESS EMPTY.

LOADING → ERROR.

| State | Meaning | Presentation |
|-------|---------|--------------|
| **LOADING** | The request for that region has not succeeded and has not failed | Skeleton, pulse, or `—` in that region. Not a numeric operational zero. Not the empty copy |
| **SUCCESS WITH DATA** | The request succeeded and returned records | Existing values |
| **SUCCESS EMPTY** | The request succeeded and returned zero records | Existing empty copy, and numeric `0` where that count is the successful result |
| **ERROR** | The request failed | Existing alert and retry. Not “No records” and not “No Finalised surgeries” |

**LOADING is not EMPTY.**

A pending request is never a resolved operational zero. A successful empty payload may show `0`. An error is never “No records”.

---

## 9. Accessibility requirements

For the worklist skeletons in PD-LD-06:

- Keep the current visual skeleton.
- One accessible announcement per loading region, `role="status"` or the existing Sessions equivalent.
- Decorative skeleton blocks stay hidden from assistive technology so they are not read one by one.

No other accessibility redesign.

---

## 10. Existing design-system constraint

Use the current Hospital Portal language only.

Preferred primitive: `components/ui/skeleton.tsx`.

Patterns that may be copied, not replaced:

- Sessions `role="status"`
- Waiting List worklist skeleton
- Finalize worklist skeleton
- Follow-up `—` for a pending KPI
- Analytics pending pulse blocks
- Finalize modal pulse shell

Do not create a design system, loading library, animation framework, global spinner, theme, token, or chart system.

A new shared primitive is **PRODUCT / ARCHITECTURE DECISION REQUIRED** and is outside this approval.

---

## 11. Protected certified behavior

If Package B is later implemented, success-state behavior stays:

- C-01, seven-zone worklist, metrics, filters, Owner, pagination
- accepted Sessions correction
- Finalize / OT FSM, RESP2, SequenceNo, Prepare, Reopen, one-schedule-date rule
- Follow-up attribution, ReQueue, stats source
- Analytics formulas, My Work, Authorized Branch, drill-down, CSV, Print, Refresh
- permissions and ownership
- Wave 2 and Visual Polish
- PERF-02, PERF-03, PERF-04 Option A, PERF-05

Refresh must not replace populated rows or successful counts with zeros. Where previous data is already shown, keep it and keep the existing localized refresh indication. Do not clear a list only to show a loader. Do not change TanStack Query defaults in this package.

`FinalizeOtModal` mount and its existing loading shell stay. PERF-06 stays deferred. This decision does not remove or combine its lookups.

---

## 12. Explicit exclusions

Not in this decision:

- navigation performance
- Waiting List row-click performance
- Sessions performance
- Finalize row-click performance
- Finalize API consolidation or removing a Finalize lookup
- shared dashboard shell, `dashboard/layout.tsx`, TopNav, or auth initialization
- server, API, DTO, database, index, cache, or Redis work
- virtualization, broad React optimization, memoization architecture
- PERF-04 Option B, PERF-06, PERF-07
- ownership, permissions, workflow, FSM, or routes
- Analytics formula changes
- Waiting List pagination or count-formula changes
- Wave 2 or Visual Polish
- a new shared loading framework
- browser or runtime performance behavior

---

## 13. Future Implementation Authorization requirements

This document does not create an Implementation Authorization.

A separate bounded Implementation Authorization must name:

- the approved set: PD-LD-01 through PD-LD-07
- exact files
- the loading presentation for each selected surface
- tests that prove pending is not numeric `0`, success empty is still `0` or the existing empty copy, and catalog error is not the empty copy
- no query, API, DTO, or count-formula change
- rollback of the presentation only
- UAT limited to section 15

Do not implement from this product decision. The next gate is a separate bounded Implementation Authorization.

---

## 14. UAT requirements

Manual UAT is **NOT EXECUTED**.

A future UAT, after an authorization, checks only loading presentation:

- Waiting List initial load: summary is not a resolved `0` while pending, then matches the successful counts, including a true zero
- OT Returned: list still loads only after the tab is selected; the count is not a resolved `0` while that request is pending
- Finalize: summary is not a resolved `0` while the filtered list is pending; successful stats match today
- OT Preparation: Finalised is not a resolved `0` while the catalog is pending; failure shows error and retry; a successful empty catalog still shows the empty copy
- Worklist skeleton is still visual, and one loading announcement is available
- Refresh keeps rows already on screen
- Finalize Open still uses the existing modal shell

UAT does not accept navigation speed, row-click speed, API speed, or database speed.

---

## 15. Acceptance boundary

Acceptance, if later recorded, is limited to:

- loading-state presentation
- premature-zero prevention
- error versus empty
- the loading announcement in PD-LD-06
- successful-state behavior unchanged

Acceptance does **not** mean:

- navigation performance acceptance
- row-click performance acceptance
- API performance acceptance
- database performance acceptance
- broader Counsellor performance acceptance

Acceptance is **NOT RECORDED**.

---

## 16. Deferred runtime-performance work

Left outside this decision, still unmeasured (**UNAVAILABLE — TOOLING LIMITATION** in the source audit):

- shared shell and route navigation time
- Waiting List row navigation into the session route
- Finalize Open and its four lookups
- Package A browser trace
- Package C, D, and E from the Wave 1B audit

Those need their own decision if they are pursued. They are not implied by Package B.

---

## 17. Final governance state

| Item | Status |
|------|--------|
| This document | **APPROVED — PRODUCT DECISION RECORDED** |
| Product Owner selection | **RECORDED — PD-LD-01 THROUGH PD-LD-07 APPROVED** |
| Selection date | 2026-09-26 |
| PD-LD-01 through PD-LD-07 | **SELECTED / APPROVED** |
| Performance Wave 1 | **IMPLEMENTED. NOT REOPENED** |
| Implementation Authorization | **NOT CREATED** |
| Production implementation | **NOT AUTHORIZED** |
| Production code | **NONE MODIFIED** |
| Tests | **NONE MODIFIED** |
| APIs, DTOs, database | **NONE MODIFIED** |
| Permissions, ownership, workflow / FSM | **NONE MODIFIED** |
| Visual UI | **NONE MODIFIED** |
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
| Next gate | **SEPARATE BOUNDED IMPLEMENTATION AUTHORIZATION** |

**IMPLEMENTATION IS NOT AUTHORIZED BY THIS DOCUMENT.**
