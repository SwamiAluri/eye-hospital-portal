# Counsellor Cross-Module Grid UX
# Package CGX-1 — Counsellor Grid Presentation Consistency + Sessions
# Implementation Authorization

| Field | Value |
|-------|--------|
| **Document type** | **IMPLEMENTATION AUTHORIZATION — GOVERNANCE ONLY** |
| **Package** | **CGX-1 — Counsellor Grid Presentation Consistency + Sessions** |
| **Product Decision** | `docs/product-decisions/counsellor-cross-module-grid-and-filter-ux-product-decision.md` |
| **Source audit** | `docs/audits/counsellor-cross-module-grid-and-filter-ux-audit.md` |
| **Decisions** | **PD-CGX-01 through PD-CGX-06 — APPROVED / CLOSED** |
| **PD-CGX-05** | **OPTION A** |
| **Status** | **IMPLEMENTATION AUTHORIZED — PACKAGE CGX-1 ONLY** |
| **Date** | 2026-09-25 |
| **Implementation started by this task** | **NO** |
| **Implementation report created by this task** | **NO** |
| **Manual UAT executed by this task** | **NO** |
| **Acceptance recorded** | **NO** |
| **Production code / API / DTO / DB / permissions / routes / ownership / workflow / FSM / UI / tests modified by this task** | **NO** |

The Product Decision file still states that an Implementation Authorization was not created at the time that decision was recorded. **This artifact is that later authorization.** This task does not amend the Product Decision file.

---

## 1. Authorization statement

```text
This authorization permits implementation of Package CGX-1 ONLY:
presentation consistency on the Sessions list, plus the bounded
exceptions named in this document.

It does NOT authorize Waiting List changes.
It does NOT authorize C-01 reopen.
It does NOT authorize Finalize / OT Preparation changes.
It does NOT authorize Follow-up behavior, column, or data-source changes.
It does NOT authorize Analytics formula, scope, or drill-down changes.
It does NOT authorize API, DTO, database, permission, ownership,
route, workflow, or FSM changes.
It does NOT authorize a new grid framework.
It does NOT authorize a new operational worklist.
It does NOT record acceptance.

PACKAGE CGX-1 IMPLEMENTATION AUTHORIZATION: YES
WAITING LIST IMPLEMENTATION: NO
FINALIZE / OT PREPARATION IMPLEMENTATION: NO
FOLLOW-UP BEHAVIOR CHANGE: NO
FOLLOW-UP A11Y CUE EXPOSURE: CONDITIONAL — stop if not presentation-only
ANALYTICS FORMULA / SCOPE CHANGE: NO
ANALYTICS HEADER TYPOGRAPHY ONLY: YES
NEW API AUTHORIZATION: NO
DTO CHANGE AUTHORIZATION: NO
DB / MIGRATION AUTHORIZATION: NO
PERMISSION CHANGE AUTHORIZATION: NO
OWNERSHIP CHANGE AUTHORIZATION: NO
FSM CHANGE AUTHORIZATION: NO
ROUTE CHANGE AUTHORIZATION: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
C-01 REOPEN: NO
PACKAGE LA REOPEN: NO
PACKAGE B PRINT REOPEN: NO
PACKAGE C REOPEN: NO
C-LA-04 IMPLEMENTATION: NO
ACCEPTANCE RECORDED: NO
```

---

## 2. Governing Product Decision

**Source:** `docs/product-decisions/counsellor-cross-module-grid-and-filter-ux-product-decision.md`

**Status:** **APPROVED — PRODUCT DECISION RECORDED.** Implementation was not authorized by that file. This package is the first bounded authorization under it.

| Decision | What this package may use |
|----------|---------------------------|
| **PD-CGX-01** | Interaction convention only. One interaction model, five information architectures. No shared grid component. No identical column sets |
| **PD-CGX-02** | Waiting List seven-zone layout stays. **No Waiting List implementation** |
| **PD-CGX-03** | Sessions may show `PatientMrn` labeled **MRN**, and `SurgeryTentativeEye` under Surgery when populated |
| **PD-CGX-04** | No resize, drag-reorder, per-column filters, alphabetical column filters, or Columns menu |
| **PD-CGX-05 Option A** | Waiting List KPI and tab counts stay on the fetched population after branch, date, and type. **No count-logic change** |
| **PD-CGX-06** | Owner, historical counsellor, and My Work stay distinct. No new personal worklists |

Design principle: **one interaction model + five information architectures.** Not one universal Counsellor grid.

---

## 3. Exact authorized scope

### 3.1 Sessions list — required

**Route:** `/dashboard/counsellors-desk/sessions`

**Page:** `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx`

**DTO (read only, do not change):** `CounselingSessionDto` on `GET /Counseling/sessions`

**Fields already on the list payload:** `PatientMrn`, `SurgeryTentativeEye`

#### A. Patient secondary identity

Current: patient name only.

Authorized change: render `PatientMrn` as secondary identity when it is present.

Exact label: **MRN**

Conceptual presentation:

```text
Patient Name
MRN: 123456
```

Rules:

- The visible label is exactly **MRN**.
- Do not call this UHID.
- Do not derive HealthId.
- Do not call the session-details endpoint to obtain HealthId.
- Do not change the API contract.
- When `PatientMrn` is absent or blank, do not show an empty MRN line and do not invent a value.

#### B. Surgery / eye

The existing Surgery column stays the procedure column. Do not add an Eye column.

When `SurgeryTentativeEye` is populated, show it as secondary text under the procedure:

```text
Procedure
Eye: <SurgeryTentativeEye>
```

When `SurgeryTentativeEye` is empty, omit the eye line.

#### C. Sessions presentation consistency

On this page only, the implementer may apply the common presentation items below, without changing list data, filters, pagination, or actions:

1. A visible page title matching the navigation context (**Counselling Sessions**).
2. Header typography: readable title case. Do **not** keep the 10px forced-uppercase treatment as the standard for this table.
3. Decision remains text in the status pill. Color is not the only status signal.
4. Empty, loading, and error copy may be aligned in structure (one primary line, one recovery hint) while keeping Sessions nouns and the existing Retry / empty recovery behavior.
5. Result range and total stay on the **existing** server pagination contract: page size **20**, URL `page`, numbered pages. Wording may be aligned. Page size, server paging, and URL behavior must not change.
6. Do **not** add a Clear or Refresh control. Sessions does not have one today. This package does not introduce filter controls.

#### D. Sessions behavior that must stay

| Behavior | Requirement |
|----------|-------------|
| Decision column | Stays Pending / Agreed / Declined / —. Do not add `Status` or `CurrentStage` beside it |
| Open | Stays the primary action |
| Reassign | Stays contextual, permission-gated, and only when Reassignment Required applies |
| Page size | Stays **20** |
| Pagination | Unchanged server contract and URL `page` behavior |
| Reassignment Required | Unchanged filter semantics |
| Ownership | Unchanged. Open does not claim. No permanent Owner column |

### 3.2 Analytics — header typography only

**Route:** `/dashboard/counselor/analytics`

Authorized only: align existing aging-table header typography to the same readable title-case treatment as Sessions. Do not use 10px forced uppercase as the standard.

Not authorized on Analytics: a new page title, KPI changes, period changes, counselor-scope changes, drill-down changes, export/print changes, new columns, row selection, or any change to formulas.

### 3.3 Follow-up Center — conditional accessibility only

**Route:** `/dashboard/counsellors-desk/surgery-followup`

**Candidate only:** the visual column cues that are currently `aria-hidden`.

Before any change, the implementer must verify that those cues are genuinely only the accessible names for columns whose row values are already rendered, and that exposing the cue text does not change actions, data, row templates, historical-counsellor meaning, or ReQueue.

If exposing the cues would change behavior, data, endpoints, row templates, or the meaning of historical counsellor attribution:

**STOP that item.**

Record in the implementation report:

**DATA / BEHAVIORAL CHANGE REQUIRED — OUTSIDE CGX-1**

Do not implement that item. Do not expand this package to cover it.

If verification shows the change is only exposing existing cue text to assistive technology, that exposure is authorized. Nothing else on Follow-up is authorized. No new columns. No `#` prefix change. No page-title change. No filter change.

### 3.4 What “common presentation” does not reach

Sections 4–6 below are hard locks. Do not edit those surfaces to apply titles, headers, empty states, range wording, or Clear/Refresh alignment.

Clear / Refresh alignment is authorized only on a control that already exists **and** sits on a surface this package may edit. Sessions has no such control. Do not add one. Do not restyle Waiting List, Finalize, or Follow-up Clear/Refresh.

---

## 4. Waiting List — hard lock

Waiting List is **not** an implementation target.

Preserve the accepted C-01 seven-zone layout exactly:

Patient · Visit · Procedure / Eye · Owner · Payment / Coverage · Status · Action

Do not:

- Split UHID, age, or gender into their own columns
- Add a Doctor column or an Eye column
- Add phone, DOB, or blood group
- Change KPI counts or tab counts (PD-CGX-05 Option A)
- Change pagination, URL state, or Pre-Auth membership
- Change ownership

Any Waiting List production change found necessary during CGX-1 is **OUT OF SCOPE**. Stop that item. Do not edit Waiting List files to make Sessions look similar.

---

## 5. Finalize / OT Preparation — hard lock

No implementation.

Preserve Patient, Surgery, Status, Schedule, Action, the FSM, `FinalizeOtModal`, the OT Preparation workspace, SequenceNo semantics, Package LA, Package B Print, Package C, and RESP2.

Do not create another OT list. Do not edit Finalize production files under this package.

---

## 6. Follow-up — hard lock except section 3.3

Preserve Active, Cold, and Post-Surgery; three data sources; one visual grid; historical counsellor attribution (not ACL); ReQueue; existing actions; no My Follow-ups; no current-owner inference; no invented Post-Surgery counsellor; no SLA or priority chrome.

No new columns. No API or DTO work.

---

## 7. Analytics — hard lock except section 3.2

Analytics remains reporting.

Preserve PD13–PD15 formulas, My Work as reporting scope, Authorized Branch, peer counselor scope, existing drill-downs, and the existing KPI population.

No queue behavior. No Owner column. No selection. No Assign or Reassign. No new patient grid.

---

## 8. Exact exclusions

Not authorized:

- Column resize, drag reorder, per-column filters, alphabetical column filtering, a Columns menu, column-visibility persistence
- Header sorting
- A new search builder
- Sessions patient-name search
- HealthId, age, or gender on the Sessions list
- Doctor as a default column
- Session Type, `CurrentStage`, Status beside Decision, session start time as a default field
- Waiting List redesign or Waiting List server pagination
- Follow-up eye, age, gender, current owner, or Post-Surgery counsellor
- Analytics aging UHID
- API, DTO, database, permission, ownership, route, or FSM changes
- A new grid framework or `CounsellorDataGrid`
- A new operational worklist: My Waiting List, My Sessions, My Follow-ups, My Finalize, My OT Preparation, or a My Work queue
- Package LA, Package B Print, or Package C reopen
- C-LA-04
- Phase 3I reopen, Slice 14, or Phase 3J

---

## 9. Protected certified behavior

| Area | Protection |
|------|------------|
| Phase 3I | Closed. Slice 14 does not exist. Phase 3J does not exist |
| C-01 | Accepted and closed. Seven-zone Waiting List unchanged |
| Ownership | Shared Waiting List. Opening or viewing does not claim. `CounselorId` semantics unchanged. Follow-up historical counsellor is not ACL. Analytics My Work is not a queue |
| Finalize | Shared. RESP2, FSM, and SequenceNo unchanged. No second OT list |
| Packages | LA closed. B Print closed. C closed |
| C-LA-04 | Deferred |
| Counts | PD-CGX-05 Option A unchanged. Search and Owner do not change Waiting List KPI or tab populations |

---

## 10. Implementation safety

The later implementation must:

- Reuse existing components, DTOs, and APIs
- Avoid a new grid abstraction
- Avoid redesigning certified surfaces
- Avoid changing behavior while applying visual refinements
- Map `patientMrn` / `PatientMrn` and `surgeryTentativeEye` / `SurgeryTentativeEye` from the list payload the page already receives
- Not add a second fetch for identity or eye

If an apparently visual change needs an API, DTO, database, permission, ownership, workflow, state-machine, or new business rule:

**STOP that item.**

Do not invent the rule. Classify it:

**PRODUCT DECISION / NEW IMPLEMENTATION AUTHORIZATION REQUIRED**

Do not expand Package CGX-1 to absorb it.

Follow-up cue exposure has its own stop line in section 3.3: **DATA / BEHAVIORAL CHANGE REQUIRED — OUTSIDE CGX-1**.

---

## 11. Required testing plan

The implementer must add or update unit/component tests for the presentation that changes, then run those tests and report exact results. This authorization task does not run them.

### Sessions

- MRN renders when `PatientMrn` exists
- MRN does not appear when absent
- The label is exactly **MRN**
- `PatientMrn` is not displayed or transformed as UHID
- Eye renders when `SurgeryTentativeEye` exists
- Eye is omitted when empty
- There is no separate Eye column
- Decision values are unchanged
- Open remains the primary action
- Reassign remains contextual to Reassignment Required and permission

### Regression

- Waiting List unchanged (no production diff on Waiting List files)
- C-01 behavior unchanged
- Sessions pagination unchanged (page size 20, URL page)
- Reassignment Required behavior unchanged
- Finalize unchanged (no production diff)
- Follow-up behavior unchanged, except the conditional cue exposure if section 3.3 verification passed
- Analytics formulas unchanged

### Accessibility

- Keyboard navigation
- Visible focus
- Accessible names on new or restyled controls
- Textual status
- No drag-only interactions

If Follow-up cues are changed, tests must show the cues are exposed and that row actions and row content are unchanged.

---

## 12. Required implementation report

After implementation, the implementer must write:

`docs/product-decisions/counsellor-cross-module-grid-cgx1-implementation-report.md`

This authorization does **not** create that report.

The report must contain:

1. Scope executed
2. Files changed
3. Files intentionally untouched
4. API/DTO impact (expected: none)
5. Business-rule impact (expected: none)
6. Ownership impact (expected: none)
7. Accessibility impact
8. Automated tests
9. Test results (exact)
10. Known limitations
11. Manual UAT required
12. An explicit statement that acceptance has **not** been recorded

If Follow-up cue work was stopped, the report must include **DATA / BEHAVIORAL CHANGE REQUIRED — OUTSIDE CGX-1**.

---

## 13. Manual UAT gate

After implementation and automated tests: **STOP.**

Manual UAT is required. Automated tests passing do not accept this package.

Acceptance requires all of:

1. Implementation within this authorization
2. Automated tests pass, with results in the implementation report
3. Manual UAT pass
4. Explicit acceptance recorded in a later governance artifact

**Acceptance is not recorded by this authorization.**

Suggested Manual UAT checks, for the later UAT pass, not executed now:

- Sessions shows name and **MRN:** plus the record number when the list row has `PatientMrn`
- Blank MRN shows no identifier line and is not labeled UHID
- Surgery shows procedure, and eye only when present, in the same column
- Decision, Open, and contextual Reassign still behave as before
- Page size and paging still match the existing Sessions contract
- Waiting List, Finalize, Follow-up actions, and Analytics numbers are unchanged on screen

---

## 14. Acceptance gate

| Gate | Status in this artifact |
|------|-------------------------|
| Product Decision PD-CGX-01–06 | **APPROVED** |
| Implementation Authorization CGX-1 | **AUTHORIZED** by this file |
| Implementation | **NOT STARTED** |
| Automated tests | **NOT RUN** |
| Implementation report | **NOT CREATED** |
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |

Do not mark CGX-1 accepted from this file.

---

## 15. Stop conditions

Stop the specific item, do not widen CGX-1, and record **PRODUCT DECISION / NEW IMPLEMENTATION AUTHORIZATION REQUIRED** if the work needs:

- A business rule
- An API or DTO change
- A database change
- A permission change
- An ownership interpretation or `CounselorId` change
- A workflow or state-machine change
- A Waiting List or C-01 change
- A Finalize, RESP2, SequenceNo, or package LA / B / C change
- A Follow-up data-source, ReQueue, or attribution change
- An Analytics formula, My Work, or drill-down change
- A new grid framework or a new operational worklist

Stop Follow-up cue work with **DATA / BEHAVIORAL CHANGE REQUIRED — OUTSIDE CGX-1** when section 3.3 verification fails.

---

## 16. Final governance check

| Check | Result |
|-------|--------|
| No Waiting List redesign | **PASS** — Waiting List files are out of scope |
| No C-01 reopening | **PASS** |
| No KPI count changes | **PASS** — PD-CGX-05 Option A locked |
| No resize | **PASS** |
| No reorder | **PASS** |
| No per-column filters | **PASS** |
| No Columns menu | **PASS** |
| No API changes | **PASS** |
| No DTO changes | **PASS** |
| No ownership changes | **PASS** |
| No workflow changes | **PASS** |
| No FSM changes | **PASS** |
| No new grid framework | **PASS** |
| No new operational worklist | **PASS** |
| Sessions MRN is explicitly MRN | **PASS** |
| Sessions eye is secondary under Surgery | **PASS** |
| Existing Sessions pagination remains | **PASS** |
| Existing Reassignment Required behavior remains | **PASS** |
| Manual UAT gate exists | **PASS** — section 13 |
| Acceptance is not recorded | **PASS** |

---

## 17. Next gate

Implementation of Package CGX-1, then the implementation report, then **STOP for Manual UAT**.

This authorization does not perform that implementation.

**STOP.**
