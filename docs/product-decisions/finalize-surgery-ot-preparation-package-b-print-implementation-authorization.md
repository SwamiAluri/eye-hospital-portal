# Finalize Surgery + OT Preparation
# Package B — Dedicated OT Preparation Print
# Implementation Authorization

| Field | Value |
|-------|--------|
| **Document type** | **IMPLEMENTATION AUTHORIZATION — GOVERNANCE ONLY** |
| **Package** | Finalize / OT Preparation — Package B Print |
| **Product Decision** | **PD-OTPREP-UAT-08** |
| **Status** | **IMPLEMENTATION AUTHORIZED — PACKAGE B ONLY** |
| **Date** | 2026-09-24 |
| **Implementation started by this task** | **NO** |
| **Production code / API / DB / permissions / routes / FSM / ownership / UI / tests modified by this task** | **NO** — this artifact is governance only |
| **RESP2** | **ACCEPTED / CLOSED** |
| **Package LA** | **ACCEPTED / CLOSED** |
| **Package C** | **NOT STARTED** |
| **C-LA-04** | **DEFERRED** |

---

## 1. Authorization statement

```text
This authorization permits implementation of the dedicated OT Preparation
Print remediation defined by PD-OTPREP-UAT-08 ONLY.

It does NOT authorize Package C / PD-OTPREP-10.
It does NOT authorize FSM, ownership, API redesign, DB/schema, or workflow redesign.
It does NOT authorize RESP2 redesign or Package LA reopen.
It does NOT authorize C-LA-04 cancellation presentation changes.
It does NOT authorize restoration of the superseded Package A / discoverability
date-dashboard or standalone OT Prep prepared-grid presentation.

PACKAGE B PRINT IMPLEMENTATION AUTHORIZATION: YES
PACKAGE C PD-OTPREP-10 AUTHORIZATION: NO
NEW API AUTHORIZATION: NO (default)
BACKEND CHANGE AUTHORIZATION: NO
DB / MIGRATION AUTHORIZATION: NO
PERMISSION CHANGE AUTHORIZATION: NO
FSM CHANGE AUTHORIZATION: NO
OWNERSHIP CHANGE AUTHORIZATION: NO
RESP2 CHANGE AUTHORIZATION: NO
PACKAGE LA REOPEN: NO
C-LA-04 IMPLEMENTATION: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
C-01 REOPEN: NO
```

---

## 2. Governing Product Decision

### PD-OTPREP-UAT-08 — Dedicated OT Preparation Print

**Source:** `docs/product-decisions/finalize-surgery-ot-preparation-uat-remediation-product-decision.md`

**Status:** **DECIDED**

The OT Preparation workspace requires a functional print representation for the prepared OT list.

The existing OT Preparation toolbar `window.print()` behavior (SPA page print) is **not** considered a sufficient certified operational print workflow.

**Authorized direction:**

- print the prepared OT list for the selected surgery date
- use a dedicated print representation
- make the output suitable for hospital operational use
- exclude application chrome
- exclude sidebar/navigation
- exclude unrelated dashboard content
- exclude unrelated Finalization tabs
- use existing authoritative prepared-list data
- reuse existing Hospital Portal / Finalization print patterns where suitable
- do not introduce a new backend data source if the existing prepared-list data is sufficient

---

## 3. Governance baseline

| Area | Status |
|------|--------|
| RESP2 Product Decision / Implementation / Manual UAT / Acceptance | **ACCEPTED / CLOSED** |
| Package LA | **ACCEPTED / CLOSED** |
| PD-OTPREP-UAT-08 | **DECIDED** |
| This Package B IA | **AUTHORIZED — PACKAGE B ONLY** |
| Package B Implementation | **NOT STARTED** |
| Package C / PD-OTPREP-10 | **NOT STARTED — NOT AUTHORIZED** |
| C-LA-04 | **DEFERRED** |
| Residual audit | `docs/audits/finalize-surgery-ot-preparation-post-package-la-residual-governance-audit.md` |

### RESP2 protection (must preserve)

```text
OT PREPARATION
  = Finalised worklist
  = explicit selection
  = same ScheduleDate batch constraint
  = selected-only Prepare
  = continued SequenceNo
  = Finalization OT Prepared remains authoritative prepared worklist
```

Do not redesign RESP2. Do not restore a duplicate OTPrepared operational grid on OT Prep as the primary presentation.

**Print vs worklist boundary (FACT for implementers):** Print may load/use existing authoritative OTPrepared data for the selected surgery date (e.g. existing `getOtList` / Finalization OT Prepared data paths). That does **not** authorize reintroducing a standalone OT Prep prepared-grid / date-dashboard UX.

---

## 4. Exact authorized scope

### B-01 — Dedicated print representation

Replace the current SPA-level `window.print()` behavior (where still present or previously used for OT Prep) with a dedicated OT Preparation print representation.

The printed document must represent the **prepared OT list** rather than the application page itself.

Inspect current Finalization OT slip print (`printOtSlip` on finalize-surgery page) and any remaining OT Prep print entry points before coding.

### B-02 — Selected surgery date

The print representation must correspond to the selected surgery date used by the existing OT Preparation / certified surgery-date source.

Do not introduce:

- a new date source
- a new date catalog
- invented future dates
- a new scheduling horizon
- a new date-selection workflow

The existing certified surgery-date source remains authoritative.

### B-03 — Authoritative prepared data

Use the existing authoritative OTPrepared data already available to the application.

Do not create:

- a new prepared-list entity
- a duplicate OT worklist
- a new database table
- a new backend source solely for printing
- a second OTPrepared representation

If existing data is sufficient, implementation must remain **frontend / presentation** focused.

### B-04 — Operational print content

The print representation may include only existing authoritative operational fields already available to the prepared OT list.

Candidate fields may include, **only where already available**:

- SequenceNo
- Patient Name
- UHID
- Procedure
- Eye
- Surgery Time / StartTime
- Surgeon
- Theatre
- Status
- other existing prepared-list operational fields

Do not invent clinical, financial, operational, or ownership fields.

If a required print field is unavailable from existing authoritative data:

```text
STOP

DATA SOURCE INSUFFICIENT — NEW API AUTHORIZATION REQUIRED
```

Do not invent a backend change. Report the exact gap and the Product Decision / authorization boundary required.

### B-05 — Print layout

The printed output must be:

- clean
- readable
- operationally scannable
- suitable for physical hospital use
- responsive to standard print paper dimensions
- accessible where applicable
- consistent with the existing Hospital Portal design language

Do not introduce a new visual language, UI framework, or design system.

### B-06 — Exclude application chrome

The print output must **NOT** contain:

- application sidebar
- navigation
- dashboard shell
- unrelated tabs
- unrelated page controls
- selection controls
- screen-only buttons
- modal overlays
- application chrome

### B-07 — Reuse existing patterns

Inspect existing Hospital Portal / Finalization printing implementations first (including Finalization OT slip print).

Reuse existing print utilities, components, styles, data mappings, and patterns where technically appropriate.

Do not create duplicate printing infrastructure if an existing certified pattern can be reused.

---

## 5. Explicitly out of scope

### Workflow / FSM

- no FSM changes
- no state-transition changes
- no OTPrepared lifecycle changes
- no Reopen changes
- no Confirm / Finalise changes
- no Cancel changes

### Data / API

- no new backend endpoint solely for Print
- no API contract redesign
- no new DTO unless an existing implementation pattern requires a strictly presentation-only mapping
- no database/schema changes
- no migration
- no index changes

### Ownership

- no CounselorId
- no OTPreparationOwnerId
- no Assign / Reassign / Requeue
- no My OT Preparation / My Finalize
- no Supervisor model
- no ownership entity

### SequenceNo

- no SequenceNo generation changes
- no renumbering / gap filling / reset
- no concurrency redesign

### RESP2

Do not modify the accepted RESP2 model.

Do not redesign the OT Preparation responsibility model.

### Package C

Do not implement PD-OTPREP-10.  
No GuardLocked / Upsert enforcement changes.  
No direct OTPrepared ScheduleDate editing.

### Package LA

Do not reopen or modify Package LA.

### C-LA-04

Do not implement cancellation presentation changes.

### Historical Package A / Discoverability

Do not restore or redesign the superseded standalone prepared-grid / date-dashboard presentation.

---

## 6. Implementation constraints

Before coding:

1. Inspect the current OT Preparation Print implementation (including historical removal of OT Prep toolbar Print under RESP A–J).
2. Inspect existing Finalization OT slip / list print patterns.
3. Identify the authoritative OTPrepared data already used by the application (`getOtList` / Finalization OT Prepared, etc.).
4. Determine whether the existing data is sufficient.
5. Reuse existing infrastructure where possible.
6. Capture a working-tree baseline so Package B diffs are attributable (do not revert unrelated pre-existing changes).

If existing data is insufficient for the authorized print representation:

```text
STOP

DATA SOURCE INSUFFICIENT — NEW API AUTHORIZATION REQUIRED
```

---

## 7. UI / design system

Use the existing Hospital Portal design system and counselling / Finalization print patterns.

Do not introduce:

- a new UI framework
- a new theme
- a new visual language
- decorative chrome in the print document

Keep the print document healthcare-grade, compact, and operationally clear.

---

## 8. Test requirements

Add/update focused tests for:

1. Dedicated print representation opens / renders prepared OT list content (not SPA chrome)
2. Print is scoped to the selected surgery date
3. Existing authoritative prepared fields appear when present
4. Missing/empty prepared list has a truthful empty/print-unavailable state
5. Application chrome / selection controls are absent from print document
6. Existing Finalization OT slip print remains functional (no regression)
7. RESP2 selection / Prepare / same-date behaviour unchanged
8. No new API client calls beyond existing prepared-list READ paths (unless STOP rule triggered)

Playwright: verify print trigger and print-document content where feasible; do not require physical printer hardware.

Do not weaken existing RESP2 / Package LA / Finalization print tests.

---

## 9. Automated validation

After implementation, run and report:

- Vitest for touched print / OT Prep helpers and contracts
- Relevant Counsellors Desk / Finalize regression suites
- Playwright Chromium finalize / OT Prep journeys (including print journey if added)
- TypeScript / ESLint on touched files

Backend tests: only if backend code is changed (default: **none**).

---

## 10. Diff safety

Confirm `git diff` contains **no** unauthorized changes to:

- backend / microservices
- APIs
- DB / migrations
- permissions
- FSM
- ownership
- RESP2 worklist/selection/Prepare logic (except a Print entry point / print document if required)
- Package LA
- Package C

If unauthorized changes appear: **STOP and revert them**.

---

## 11. Implementation report (required after coding)

Create:

`docs/product-decisions/finalize-surgery-ot-preparation-package-b-print-implementation-report.md`

Must include:

1. IA reference  
2. Product Decision reference (PD-OTPREP-UAT-08)  
3. Implementation status  
4. Files changed  
5. Print representation approach  
6. Data source used (existing prepared-list path)  
7. Fields printed  
8. Chrome exclusion verification  
9. RESP2 regression protection  
10. Package LA / Package C / C-LA-04 non-touch verification  
11. API/backend/DB/permission/FSM/ownership — explicitly **NONE** if none  
12. Automated tests + exact results  
13. Playwright results  
14. Limitations / environment issues  
15. Manual UAT status (**REQUIRED — NOT EXECUTED** by implementer)  
16. Acceptance status (**NOT RECORDED**)

Truthful results only.

---

## 12. Mandatory governance stop (for the implementation task)

After implementation + automated tests + implementation report:

**STOP.**

Do not perform Manual UAT.  
Do not record Acceptance.  
Do not start Package C.  
Do not reopen RESP2 / Package LA.  
Do not implement C-LA-04.

Final report must state:

```text
IMPLEMENTATION: COMPLETE / BLOCKED / PARTIAL — truthful status
AUTOMATED TESTS: actual result
MANUAL UAT: REQUIRED — NOT EXECUTED
ACCEPTANCE: NOT RECORDED
PACKAGE C: NOT STARTED
C-LA-04: DEFERRED
```

---

## Governance status (this task)

| Gate | Status |
|------|--------|
| **PRODUCT DECISION (PD-OTPREP-UAT-08)** | **DECIDED** |
| **IMPLEMENTATION AUTHORIZATION** | **IMPLEMENTATION AUTHORIZED — PACKAGE B ONLY** |
| **IMPLEMENTATION** | **NOT STARTED** |
| **AUTOMATED TESTS** | **NOT RUN FOR THIS GOVERNANCE TASK** |
| **MANUAL UAT** | **NOT EXECUTED** |
| **ACCEPTANCE** | **NOT RECORDED** |
| **RESP2** | **ACCEPTED / CLOSED** |
| **PACKAGE LA** | **ACCEPTED / CLOSED** |
| **PACKAGE C** | **NOT STARTED** |
| **C-LA-04** | **DEFERRED** |

---

**STOP.** Implementation Authorization recorded. No production code, tests, APIs, backend, DB, permissions, FSM, ownership, RESP2, Package LA, Package C, or C-LA-04 were modified by this task.

**Next gate:** Separate **Package B IMPLEMENTATION** task under this authorization only.
