# Counsellor Performance — Wave 1 Product Decision

| Field | Value |
|-------|--------|
| **Status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Date** | 2026-09-26 |
| **Type** | Product Decision |
| **Source audit** | `docs/audits/counsellor-performance-deep-audit.md` (2026-09-25) |
| **Follows** | Counsellor Visual Polish, completed as a separate workstream |
| **Product Owner selection** | **RECORDED** — 2026-09-26 |
| **Selected** | PERF-01, PERF-02, PERF-03, PERF-04 Option A, PERF-05 |
| **Deferred** | PERF-06, PERF-07 |
| **Implementation authorization** | **NOT CREATED** |
| **Production implementation** | **NOT AUTHORIZED** |
| **Production code** | **NONE MODIFIED** |
| **Tests** | **NONE MODIFIED** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |
| **Visual Polish** | **COMPLETED SEPARATELY** |
| **Performance implementation** | **NOT STARTED** |

This document records the approved product direction for Counsellor Performance Wave 1. It does not authorize implementation.

The Product Owner selected the packages below on 2026-09-26. Approval of this decision is not an Implementation Authorization.

**NO IMPLEMENTATION IS AUTHORIZED BY THIS DOCUMENT.**

---

## 1. Status and governance

Counsellor Visual Polish is complete and outside this workstream. Wave 2 visual standard decisions and the Visual Polish decision stay as recorded. This file does not edit them.

Certified Counsellor decisions stay in force, including:

- C-01 Waiting List (`counsellor-c01-waiting-list-dashboard-redesign-product-decision.md`)
- accepted Sessions correction
- Finalize / OT Preparation FSM, RESP2, and SequenceNo
- Follow-up attribution and ReQueue
- Analytics formulas, My Work, and Authorized Branch
- existing APIs, permissions, and ownership
- Wave 2 visual standard and Visual Polish implementation

This decision does not reinterpret or replace those artifacts.

### Product Owner selection record — 2026-09-26

| Package | Selection |
|---------|-----------|
| PERF-01 Measurement baseline | **SELECTED** |
| PERF-02 Waiting List OT Returned lazy loading | **SELECTED** |
| PERF-03 Finalize OT catalog lazy loading | **SELECTED** |
| PERF-04 Waiting List full queue | **OPTION A SELECTED** |
| PERF-05 Analytics aging aggregation | **SELECTED** |
| PERF-06 Finalize detail dialog | **DEFERRED** |
| PERF-07 Client-side rendering | **DEFERRED** |

PERF-04 Option B is **NOT SELECTED**. The full-queue architecture may be reconsidered only in a later Product Decision, and only if PERF-01 evidence justifies it.

These selections define allowed future scope. They do not authorize production changes.

Four labels are used below. They are not interchangeable.

| Label | Meaning |
|-------|---------|
| **Audited code-level cost** | A call, query, or mount pattern the deep audit read from source |
| **Unmeasured runtime behavior** | Duration, payload size, waterfall order, or main-thread time the audit did not capture |
| **Proposed optimization** | A later change that would need its own Implementation Authorization |
| **Behavior-changing optimization** | A proposed optimization that can change certified product behavior and needs an explicit Product Owner selection before any authorization |

No milliseconds, percentages, or single root cause are stated. The audit recorded no browser request timings, navigation timings, click-to-dialog timings, network waterfalls, or main-thread profiles.

---

## 2. Source audit

Read-only audit: `docs/audits/counsellor-performance-deep-audit.md`.

| Audit field | Value |
|-------------|--------|
| Date | 2026-09-25 |
| Method | Repository inspection of the staff app and Auth Service counselling code |
| Browser profile | None |
| Server trace | None |
| Database `EXPLAIN` | None |
| Production change | None |

Surfaces named in the audit:

- `/dashboard/counsellors-desk/waiting-list`
- `/dashboard/counsellors-desk/sessions`
- `/dashboard/counsellors-desk/finalize-surgery` (Finalize Surgery and OT Preparation)
- `/dashboard/counsellors-desk/surgery-followup`
- `/dashboard/counselor/analytics`

Shared shell: dashboard layout waits for a client token before sidebar, header, and page content mount. That cost is shared with other staff routes. This decision does not modify it. A later change to shared initialization would need measured evidence and a separate decision.

---

## 3. What is measured vs unmeasured

**MEASURED** in the audit means read from source: call sites, query options, and SQL shape. **INFERRED** means a likely user-facing effect of that source. **UNKNOWN** means it needs a trace.

### Audited code-level costs

These are independent. They are not one bottleneck.

| ID | Surface | Audited code-level cost | Audit evidence grade |
|----|---------|-------------------------|----------------------|
| F1 | All five routes, via dashboard layout | Page stays on a loading skeleton until the browser has a token, then the shell and page mount | MEASURED gate. Duration **UNKNOWN** |
| F2 | Waiting List | Full active queue is loaded (`ToListAsync`, no `Skip`/`Take`). Status and owner filters run in the browser. A prior query loads every SurgeryDone OT session id for the tenant | MEASURED. Row count and bytes **UNKNOWN** |
| F3 | Waiting List | After a branch id exists, the page loads OT-return journeys and then one session list per distinct patient with an OT return reason. That does not wait for the OT Returned tab | MEASURED call pattern. Duration and overlap **UNKNOWN** |
| F4 | Finalize / OT | Every visit starts two surgery-list reads. One uses the page filters. The other uses an empty date, so the service can load every non-deleted schedule in the authorized branches | MEASURED. Duration and bytes **UNKNOWN** |
| F5 | Finalize | `FinalizeOtModal` is imported statically and rendered with the page. Open toggles visibility | MEASURED. Effect on navigation, memory, and first Open **UNKNOWN**. Whether Open also fetches detail **UNKNOWN** |
| F6 | Analytics | On load, summary, trends, aging, and the counsellor picker start together. Aging counts the pending population once, then four more counts with different date bounds on the same query shape | MEASURED. Which call is slowest **UNKNOWN** |
| F7 | Analytics | Recharts is in the Analytics route module | MEASURED import. Chunk size **UNKNOWN**. Out of Wave 1 packages |
| F8 | Waiting List and Finalize | Tab counts and visible rows are derived by filtering the full downloaded array. The worklists are not virtualized | MEASURED pattern. Severity **UNKNOWN** without row counts and render timings |
| F9 | Sessions and Follow-up | Sessions and Follow-up lists are server-paged. Follow-up inactive tabs wait until that tab has been opened. Follow-up stats still load on every visit | MEASURED. Count-query and stats-query cost **UNKNOWN** |

### Unmeasured runtime behavior

The audit explicitly left these unknown:

- browser navigation time
- first meaningful paint and how long the shared skeleton stays
- request duration and waterfall
- response bytes and row counts
- main-thread blocking and render duration
- modal open time
- mutation round-trip time
- whether the OT-return calls overlap the waiting-list GET
- whether Finalize Open calls `GET /Counseling/ot-schedule/{id}`
- whether the Sessions count query or Follow-up stats query is slow on current data
- whether the Analytics picker is on the critical path for the KPI strip

Inferred delay is not a benchmark. No optimization in this document may be declared successful without a before/after measurement where that measurement is technically available.

---

## 4. Performance model

Wave 1 separates investigation from change.

| Package | Kind | Product Owner selection |
|---------|------|--------------------------|
| PERF-01 | Measurement only | **SELECTED.** No production behavior change |
| PERF-02 | Timing of existing OT Returned calls | **SELECTED.** No new API |
| PERF-03 | Timing of the existing undated catalog read | **SELECTED.** Catalog semantics unchanged |
| PERF-04 | Full-queue contract | **OPTION A SELECTED.** Option B not selected |
| PERF-05 | Query consolidation inside the current response | **SELECTED.** JSON shape unchanged. No index or schema change |
| PERF-06 | Measurement-first dialog mount | **DEFERRED** |
| PERF-07 | Measurement-first client render | **DEFERRED** |

### Code-level performance candidates identified by the deep audit

The audit’s structural findings support investigating these before other Counsellor performance work. This list is **not** a runtime ranking. No browser timings were captured, so this document does not say which item dominates wall-clock time.

1. Waiting List unnecessary OT-return / session fan-out (F3, PERF-02)
2. Finalize duplicate / undated list read (F4, PERF-03)
3. Waiting List full-queue payload (F2, PERF-04)
4. Analytics aging aggregation (F6, PERF-05)

Shared dashboard initialization (F1) is a shared first-paint cost. It is in the PERF-01 baseline. It is not a Wave 1 code change.

Sessions and Follow-up are in the baseline because staff reported those routes as slow. The audit did not classify them as unbounded population dumps.

---

## 5. PERF-01 measurement baseline

**Status:** **SELECTED** (2026-09-26). Prerequisite for performance claims. **NOT AUTHORIZED** as an implementation package. PERF-01 itself authorizes no production behavior change. Measurement must not change production behavior unless a later authorization explicitly allows a measurement-only change.

### Purpose

Establish a repeatable browser baseline before any runtime improvement is claimed.

### Tooling

Use existing browser and developer tooling already available to the team (browser performance panel, network panel, and existing application traces). Do not introduce a new performance monitoring platform.

### What to record

Where technically possible, record:

1. route navigation time
2. time until the page shell becomes usable
3. API request count
4. API request waterfall
5. largest response payloads
6. Waiting List initial-load request duration
7. Finalize initial-load request duration
8. Sessions initial-load request duration
9. Follow-up initial-load request duration
10. Analytics initial-load request duration
11. first Open → dialog visible for Finalize
12. first interaction → modal or sheet visible where relevant
13. repeated click or action latency where observable

### Baseline record

Each observation must identify:

- route
- action
- request or requests
- timing
- payload size when the tooling shows it
- whether the cost is network, server, client render, or shared initialization

Shared initialization (token gate, sidebar, header) must be labelled as shared. It must not be attributed to one Counsellor page.

### Success rule

No optimization is successful without before/after measurement where the measurement is technically available. A lower request count, or cleaner code, is not by itself an improvement.

---

## 6. PERF-02 Waiting List OT Returned

**Status:** **SELECTED** (2026-09-26). **Implementation NOT AUTHORIZED.**

### Audited code-level cost

After branch information is known, Waiting List loads OT-return journeys and one session list per distinct patient who has an OT return reason. That work runs even when the OT Returned tab has not been opened.

### Unmeasured runtime behavior

Duration, byte size, and whether those calls overlap the main waiting-list GET are unknown.

### Product question

Can OT Returned-specific journey and session data load only when the OT Returned tab is selected, instead of during initial Waiting List loading?

### Product Owner selection

**Deferred loading is selected.** OT Returned-specific journey and session data may load only when the OT Returned tab is selected, under all of the following conditions:

- The initial Waiting List still shows the existing seven-zone worklist, metrics, filters, Owner, actions, pagination, and branch authorization without waiting for OT-return journeys or per-patient session lists.
- Selecting OT Returned must show appropriate loading, empty, and error handling.
- After that load completes, the OT Returned population, patient/session relationships, ownership presentation, counts that depend on that population, and actions match current certified behavior.
- Counts that do not depend on the deferred payload stay correct on first paint.
- No new API, DTO, permission, or ownership rule is introduced by the deferral itself.

Do not replace the existing per-patient session calls with a new API. That remains outside this package.

### What must stay

C-01, the seven-zone model, metrics, filters, Owner, actions, pagination, branch authorization, ownership presentation, and existing OT Returned population semantics.

### Classification

Presentation timing of existing calls is the selected change. The tab loads later than it does today, with its own loading, empty, and error handling. Collapsing those calls into a new endpoint is out of this package. Implementation still requires a separate Implementation Authorization.

---

## 7. PERF-03 Finalize OT catalog

**Status:** **SELECTED** (2026-09-26). **Implementation NOT AUTHORIZED.**

### Audited code-level cost

Finalize performs two surgery-list reads on every visit. One follows the page filters. The other sends no date restriction and can load all schedules in the authorized branches. Patient and session lookups for incomplete rows are batched, not one query per row.

### Unmeasured runtime behavior

Duration and payload size of each read are unknown. The audit did not prove this pair is the largest runtime cost on the route.

### Product question

Can the additional OT-related surgery catalog request wait until OT Preparation is actually active?

### Product Owner selection

**Deferring that second read until OT Preparation is active is selected**, under all of the following conditions:

- Finalize Surgery’s initial load uses the existing filtered list only.
- Switching to OT Preparation may wait on the catalog and must show loading, empty, and error states.
- Once loaded, OT Preparation keeps today’s catalog rule: the undated read is still the full authorized-branch date universe.
- Do not add a date bound, add pagination to that catalog, create a new endpoint, or change API semantics.
- Finalize Surgery behavior, Finalised population, Prepare, selection, SequenceNo, the one-schedule-date rule, Reopen, FSM, RESP2, pagination, and filters stay as certified.

The audit records that today the catalog wait happens on first paint. After this selected deferral, that wait happens when the user opens OT Preparation. Implementation still requires a separate Implementation Authorization.

---

## 8. PERF-04 Waiting List full queue

**Status:** **OPTION A SELECTED** (2026-09-26). Option B is **NOT SELECTED**. **Implementation NOT AUTHORIZED.**

This records the product choice. It is not an implementation instruction.

### Audited code-level cost

`GET /Counseling/waiting-list` returns the full active queue for the authorized branches and applied date range, with type `All`. The endpoint has no page parameters. The client filters by status and owner and slices the filtered array for display.

### Unmeasured runtime behavior

Queue size, response bytes, SQL time, and client filter time are unknown. Benefit of either option cannot be stated as a percentage.

### Option A — retain the full queue

**Selected.** Wave 1 retains the current full Waiting List queue. Do not convert Waiting List to server-side population, search, filter, or pagination in this package.

Certified search, date range, type, Owner, status tabs, counts, seven-zone ordering, actions, C-01, OT Returned, and pagination stay computed from the same full result the page uses today.

Option A does not by itself reduce the waiting-list payload. The full-queue architecture may be reconsidered in a later Product Decision only if PERF-01 evidence justifies it.

### Option B — server-side query

**NOT SELECTED** for Wave 1.

Move Waiting List population, search, filter, and pagination toward server-side querying.

Option B is behavior-changing. Before it could be selected, the following must be specified as preserved behavior, not assumed:

| Behavior | What preservation means |
|----------|-------------------------|
| Search | Same matching rules and fields as today |
| Date range | Same authorized date window sent to the API |
| Type | Same type scope, including the current `All` contract unless a later decision changes it |
| Owner | Same owner filter results |
| Status tabs | Same membership rules per tab |
| Counts | Tab and summary counts remain correct for the full matching population, including rows not on the current page |
| Seven-zone ordering | Same zone order and within-zone order |
| Actions | Same actions available for the same rows |
| C-01 | Certified waiting-list rules stay |
| OT Returned | Same population semantics, including any interaction with PERF-02 |
| Pagination | Staff still move through the same logical result set. Page size and range text must match the server contract |
| Branch authorization | Authorized-branch scope stays server-enforced |

Counts are the main product risk. If counts were taken only from the current page, C-01 metrics would change. Any Option B design must say where full-population counts come from.

Option B needs an API and possibly a database decision. It is not authorized here. No index is named. Index work needs a query plan, which this audit does not contain.

### Selection

**Option A is selected.** Option B is not selected. A future Implementation Authorization for Wave 1 must keep the full-queue contract and must not implement Option B.

---

## 9. PERF-05 Analytics aging

**Status:** **SELECTED** (2026-09-26). **Implementation NOT AUTHORIZED.** No index or schema change.

### Current behavior

Analytics starts summary, trends, follow-up aging, and the counsellor picker together.

Aging counts the same pending population five times: one count of the population, then four more counts with different date bounds on the same query shape. The audit classifies this as repeated aggregation, not a row dump.

Aging bucket definitions, formulas, population, period, and scope are certified. My Work and Authorized Branch stay as they are. Drill-down uses the existing contract.

### Unmeasured runtime behavior

Whether the five counts dominate Analytics open or Refresh is unknown. Parallel summary, trends, and picker work can still determine time to first usable view.

### Product Owner selection

One grouped or conditional aggregation may replace the repeated aging counts over that same pending population, returning the same total and the same four buckets.

### Expected behavioral equivalence

- Same pending population
- Same period and scope, including My Work and Authorized Branch
- Same bucket boundaries and counts
- Same formulas elsewhere on Analytics
- Same drill-down, CSV, Print, and Refresh behavior
- Refresh still invalidates the existing analytics queries

### API response shape

**Unchanged.** Callers must keep receiving the current aging fields. This selection does not approve a contract change.

### Test requirements (future, not written by this decision)

- Bucket boundaries match current date bounds on the same population
- Counts match the current five-count results for representative fixtures, including empty and boundary dates
- Scope and period still change the population the same way
- Response JSON shape matches the current contract

### Classification

Query consolidation inside the existing response is selected. Implementation is still not authorized. Index and schema work are excluded.

---

## 10. PERF-06 Finalize detail dialog

**Status:** **DEFERRED** (2026-09-26). Do not lazy-mount `FinalizeOtModal` in Wave 1.

### Audited code-level cost

`FinalizeOtModal` is mounted with the page. Its module and first render are paid during route load. Open is a visibility toggle unless the open path also fetches detail. The audit did not trace that detail GET.

### Unmeasured runtime behavior

Effect on route navigation, initial render, memory, and interaction readiness is unknown. First Open duration is unknown.

### Rule

PERF-01 must measure whether mounting the dialog materially affects navigation, initial render, memory, and interaction readiness.

A later decision may authorize lazy mounting only if PERF-01 measurement demonstrates a material cost and behavior can remain identical, including Finalize, Reopen, Prepare, print, selection, validation, and errors.

A lighter first page that makes the first Open wait on a new chunk is a product timing change. It is not part of Wave 1.

---

## 11. PERF-07 client-side rendering

**Status:** **DEFERRED** (2026-09-26). Do not perform client rendering refactors, virtualization, memoization architecture changes, or broad React optimization in Wave 1.

### Audited code-level cost

Waiting List and Finalize filter and map the full downloaded array when deriving counts and rows. That work can run again when parent state changes. Finalize keeps selection state on the same page as both lists. Virtualization is absent. Severity is unknown without row counts and render timings.

Analytics chart-library weight (F7) is a separate audited import. It is not a license to change charts, colors, or the chart library.

### Investigation, only after PERF-01

- large client arrays
- repeated filtering
- repeated mapping
- unnecessary rerenders
- expensive derived calculations

Do not refactor for cleanliness. Do not virtualize, change memoization architecture, or apply a broad React optimization from code inspection alone. A later decision needs PERF-01 evidence first, and any later authorization must leave certified ordering, counts, and actions unchanged.

---

## 12. Protected certified behavior

Any later authorization must preserve the following. This list does not restate or revise the decisions.

### Waiting List

C-01, seven-zone worklist, metrics, filters, Owner, actions, pagination, branch authorization, ownership presentation.

### Sessions

Accepted identity, Counselling Sessions, Reassignment Required, MRN, Eye, Decision, Open, Reassign, server paging, ownership behavior.

### Finalize / OT

FSM, SequenceNo, RESP2, Prepare, Reopen, print, filters, pagination, one-schedule-date rule.

### Follow-up

Active, Cold Leads, Post-Surgery, attribution, ReQueue, stats source, existing actions.

### Analytics

Formulas, My Work, Authorized Branch, period, funnel, mixes, trends, aging semantics, drill-down, CSV, Print, Refresh.

### Visual standard

Visual Standard and Visual Polish stay closed. This decision does not reopen spacing, color, typography, density, or interaction polish.

---

## 13. Exclusions

This decision does **not** authorize:

- new database indexes
- schema changes
- DTO redesign
- API redesign
- a new caching layer or Redis caching
- frontend framework changes
- a React architecture rewrite
- virtualization
- a new state-management architecture
- a new performance monitoring platform
- a chart library change
- design-system changes
- visual redesign
- accessibility redesign
- ownership changes
- permission changes
- workflow changes
- FSM changes
- route changes
- Analytics formula changes
- shared dashboard skeleton or shell changes
- modification of production code, tests, APIs, or database objects from this document

Database index recommendations require actual query-plan evidence. This audit has none. No index is proposed.

Unbounded waiting-list and undated OT reads remain classified by the audit as candidates that would need a database decision if a later authorization wants indexes or query rewrites. That classification is not approval.

---

## 14. Implementation authorization requirements

This Product Decision does not authorize implementation and does not create an Implementation Authorization.

The next gate is a separate bounded Implementation Authorization for the selected packages only: PERF-01, PERF-02, PERF-03, PERF-04 Option A, and PERF-05. PERF-06 and PERF-07 are deferred and must not be included.

That authorization must specify:

- exact package or packages from the selected set
- exact files
- exact behavior, including the approved timing changes for PERF-02 and PERF-03 and the full-queue retention for PERF-04 Option A
- exact tests
- exact performance measurements (PERF-01 baseline and the before/after comparison)
- rollback and safety expectations
- UAT criteria

Wave 1 authorization must not convert Waiting List to server-side population, search, filter, or pagination. It must not lazy-mount `FinalizeOtModal`. It must not virtualize, change memoization architecture, or apply a broad React optimization.

No authorization may bundle a protected-behavior change, an API redesign, a new endpoint, an index, a schema change, or a visual change into a performance package.

---

## 15. Automated test requirements

No tests are added or edited by this decision.

A future authorization that changes behavior must include tests that prove certified results stay the same:

| Package | Tests must show |
|---------|-----------------|
| PERF-02 | OT Returned is not requested before that tab is selected, and after selection the population, relationships, counts, and actions match the previous contract |
| PERF-03 | The undated catalog is not requested while Finalize is the active workspace, and OT Preparation still applies the current catalog, SequenceNo, one-schedule-date, Prepare, Reopen, and FSM rules |
| PERF-04 | Wave 1 retains the full queue. Tests must not introduce server-side population, search, filter, or pagination. If Waiting List code is touched for PERF-02, C-01 search, date range, type, Owner, tabs, full-population counts, seven-zone order, actions, pagination, and branch scope stay on the current full result |
| PERF-05 | Aging bucket counts and response shape match the current contract across scope, period, and boundary dates |
| PERF-06 | Deferred. Not in Wave 1. A later decision may authorize lazy mount only after PERF-01 shows a material cost and Open, Finalise, Reopen, Prepare, validation, and print stay equivalent |
| PERF-07 | Deferred. Not in Wave 1. A later decision may authorize a render change only after PERF-01 evidence, and counts, order, and actions must stay equivalent |

PERF-01 adds no production behavior tests.

---

## 16. Browser performance UAT requirements

Manual UAT for this decision has **not** been executed.

Future browser UAT must compare before and after on the same scenario. Improvement is not declared because code is cleaner or because a request count fell, unless the timed user-facing path improves and certified behavior still holds.

### Waiting List

Initial load, switching tabs, search, filters, pagination, OT Returned, actions.

### Sessions

Initial load, pagination, Reassignment Required filter, Open.

### Finalize

Initial load, workspace switch, filters, Open, Finalise, Reopen, OT Preparation.

### Follow-up

Initial load, tabs, search, Refresh, row actions.

### Analytics

Initial load, scope, period, refresh, charts, aging, drill-down.

Each pass records the PERF-01 fields: route, action, requests, timing, payload size when available, and cost class (network, server, client render, or shared initialization).

---

## 17. Acceptance requirements

Acceptance is **NOT RECORDED**.

A future acceptance record, after a separate Implementation Authorization, would need:

- The 2026-09-26 selection: PERF-01, PERF-02, PERF-03, PERF-04 Option A, and PERF-05, with PERF-06 and PERF-07 deferred
- PERF-01 baseline captured before the change
- before/after measurements where technically available
- browser UAT for every surface the package touches
- automated tests from section 15 passing
- confirmation that protected behavior, APIs, permissions, ownership, FSM, and visual standard were not changed except for the selected timing changes in PERF-02 and PERF-03
- no claim of a percentage gain that the measurements do not support

---

## 18. Next gate

| Item | Status |
|------|--------|
| This document | **APPROVED — PRODUCT DECISION RECORDED** |
| Product Owner selection | **RECORDED** — 2026-09-26 |
| Selected | PERF-01, PERF-02, PERF-03, PERF-04 Option A, PERF-05 |
| Deferred | PERF-06, PERF-07 |
| Production implementation | **NOT AUTHORIZED** |
| Implementation Authorization | **NOT CREATED** |
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
| Visual Polish | **COMPLETED SEPARATELY** |
| Performance implementation | **NOT STARTED** |
| Production code | **NONE MODIFIED** |
| Tests | **NONE MODIFIED** |
| APIs | **NONE MODIFIED** |
| DTOs | **NONE MODIFIED** |
| Database | **NONE MODIFIED** |
| Permissions | **NONE MODIFIED** |
| Ownership | **NONE MODIFIED** |
| Workflow / FSM | **NONE MODIFIED** |
| Visual UI | **NONE MODIFIED** |
| Next gate | **SEPARATE IMPLEMENTATION AUTHORIZATION** for the selected packages. Do not implement from this file |

**NO IMPLEMENTATION IS AUTHORIZED BY THIS DOCUMENT.**
