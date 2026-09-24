# Finalize Surgery + OT Preparation
# Bounded Implementation Authorization —
# Surgery-Date Discoverability & Operational Clarity

| Field | Value |
|-------|--------|
| **Document type** | **BOUNDED IMPLEMENTATION AUTHORIZATION — GOVERNANCE ONLY** |
| **Title** | Finalize Surgery + OT Preparation — Bounded Implementation Authorization — Surgery-Date Discoverability & Operational Clarity |
| **Package name** | Finalize / OT Preparation — Surgery-Date Discoverability & Operational Clarity |
| **Date** | 2026-09-23 |
| **Status** | **IMPLEMENTATION AUTHORIZED — PD-OTPREP-01 … PD-OTPREP-05 ONLY** |
| **Implementation started by this task** | **NO** |
| **Production code / API / DB / permissions / routes / FSM / ownership / UI / tests modified by this task** | **NO** — this artifact is governance only |

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/product-decisions/finalize-surgery-ot-preparation-discoverability-implementation-authorization.md` |
| Artifact disposition | **NEW** — no prior discoverability Implementation Authorization existed |
| Authorizes | Bounded frontend discoverability / operational-clarity work for **PD-OTPREP-01 … PD-OTPREP-05** only |
| Does not authorize | PD-OTPREP-06…10; Package 1 reopening; schema; FSM; ownership; API changes unless later dependency proven |
| Product Owner | Decision recorded — name not supplied |
| Next gate after this document | Bounded **implementation** (not started by this task) |

---

## 2. Product Decision references

| Artifact | Role |
|----------|------|
| `docs/product-decisions/finalize-surgery-ot-preparation-operational-model-product-decision.md` | **Primary** — PD-OTPREP-01…10 recording |
| `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` | Parent PD-FS-01…13 (locked ownership / FSM / Package 1 decisions) |
| `docs/product-decisions/finalize-surgery-ot-preparation-implementation-authorization.md` | Package 1 Implementation Authorization (**COMPLETED** — do not reopen) |

### Authorized Product Decisions (this package)

| ID | Topic | Selected option | Authorized here? |
|----|-------|-----------------|------------------|
| **PD-OTPREP-01** | Surgery-date discoverability | **A** — derive from existing loaded data | **YES** |
| **PD-OTPREP-02** | Date navigation | **A** — surgery-date catalog | **YES** |
| **PD-OTPREP-03** | Ready vs Prepared vs None | **A** — explicit distinction | **YES** |
| **PD-OTPREP-04** | Date-change / Load | **B** — explicit Load; no auto-load | **YES** |
| **PD-OTPREP-05** | Contextual wording | **A** — surgery-date wording + subtitle fix | **YES** |

### Not authorized (recorded elsewhere; excluded from this package)

| ID | Topic | Why excluded |
|----|-------|--------------|
| **PD-OTPREP-06** | Late-add / SequenceNo | Partial; SequenceNo rule PENDING |
| **PD-OTPREP-07** | Past-date policy | PENDING PRODUCT OWNER SELECTION |
| **PD-OTPREP-08** | Timezone | Defer until reproducible defect |
| **PD-OTPREP-09** | Prepared-date index | Defer; live verify; no schema |
| **PD-OTPREP-10** | Upsert vs GuardLocked | Separate FSM authorization required |

---

## 3. Audit references

| Artifact | Role |
|----------|------|
| `docs/audits/finalize-surgery-ot-preparation-operational-model-audit.md` | Authoritative operational-model / discoverability findings |
| `docs/audits/finalize-surgery-ot-preparation-comprehensive-audit.md` | Prior Finalize/OT Prep comprehensive audit (context) |

---

## 4. Current governance baseline

| Area | Status |
|------|--------|
| Phase 3I | **CLOSED** |
| Slice 13 | **CLOSED** |
| Slice 14 | **DOES NOT EXIST** |
| Phase 3J | **NOT CREATED** |
| C-01 Waiting List | **ACCEPTED + CLOSED** |
| Parent Finalize / OT Preparation Product Decision (PD-FS) | **APPROVED / RECORDED** |
| Package 1 Implementation | **COMPLETE** |
| Package 1 Manual UAT | **IN PROGRESS** |
| Package 1 Acceptance | **NOT RECORDED** |
| Operational-model audit | **COMPLETE** |
| PD-OTPREP-01…10 | **RECORDED** |
| Discoverability Implementation Authorization | **YES — THIS DOCUMENT** (was NONE) |
| Discoverability implementation | **NOT STARTED** |
| Discoverability Manual UAT | **NOT EXECUTED** |
| Discoverability Acceptance | **NOT RECORDED** |

Governance sequence:

```text
PRODUCT DECISION (PD-OTPREP)     ✓ recorded
        ↓
IMPLEMENTATION AUTHORIZATION     ✓ this document (PD-OTPREP-01…05 only)
        ↓
BOUNDED IMPLEMENTATION           ← next gate (NOT started by this task)
        ↓
AUTOMATED TESTS
        ↓
STOP
        ↓
MANUAL UAT
        ↓
ACCEPTANCE
```

Do not collapse these gates.  
Do not mark Package 1 PASS / ACCEPTED / CLOSED because this authorization exists.  
Do not mark discoverability UAT PASS or acceptance because this authorization exists.

---

## 5. Locked business model (MUST NOT CHANGE)

Authoritative OT Preparation date:

```text
ot_finalize_schedule.StartTime
        ↓
surgery calendar day
        ↓
ScheduleDate
```

**Example:** Finalised 23 Sep · Surgery 25 Sep · OT Prep **25 Sep**.

| Rule | Status |
|------|--------|
| Never use Finalisation date as Prep grouping key | **LOCKED** |
| Do not introduce `FinalisedAt` | **LOCKED** |
| Do not create Finalised-today worklist | **LOCKED** |
| Existing `PrepareOtListAsync` / `GetOtListAsync` date-scoping | **PRESERVE — unchanged** |
| Existing FSM | **PRESERVE — unchanged** |
| Shared OT Preparation surface / no ownership | **PRESERVE** |

---

## 6. Explicit authorized scope

### 6.1 PD-OTPREP-01 — Surgery-date discoverability

- Expose distinct `ScheduleDate` values from existing Finalize / OT-related **loaded** data.
- Prefer client-side derivation from data already present in the Finalize workspace.
- **Do not** create a new OT list entity.
- **Do not** create a second operational worklist.

### 6.2 PD-OTPREP-02 — Surgery-date catalog / selection

- Provide a surgery-date catalog / selectable dates derived from authoritative `ScheduleDate` data.
- Catalog is the **primary** discoverability improvement.
- Existing date picker may remain where appropriate as secondary/manual entry.
- **Do not** invent horizons (7 / 30 / 60 / 90 days).
- **Do not** build a full calendar navigator.
- **Do not** leave manual date entry as the only discovery mechanism.

### 6.3 PD-OTPREP-03 — Ready vs Prepared vs None

Distinguish using **existing** status fields only:

| Presentation | Existing signal |
|--------------|-----------------|
| Ready for OT Preparation | `Finalised` + `StartTime` / `scheduleDate` on selected surgery date |
| OT list already prepared | `OTPrepared` rows for selected surgery date (after Load or known from loaded finalize cache where applicable) |
| No eligible surgeries | No Finalised rows for selected surgery date |

- **Do not** introduce new FSM statuses.
- **Do not** introduce a new OT list entity.
- UI **must not** communicate: “No prepared list” == “No Finalised surgeries”.

### 6.4 PD-OTPREP-04 — Explicit Load OT List

- Selecting a surgery date **does not** automatically load the OT Prepared list.
- Explicit **Load OT List** remains the loading action.
- **Do not** convert to auto-load.
- **Do not** introduce hybrid auto-load.
- Date selection changes **context only**.
- Changing dates **must not** leave misleading stale OTPrepared rows without clear date context (clear and/or label stale presentation — **without** changing the explicit Load contract).

### 6.5 PD-OTPREP-05 — Surgery-date contextual wording

- OT Preparation wording must identify surgery-date context (e.g. conceptual: “OT Preparation — Surgery Date: 25 Sep”).
- Fix subtitle/context mismatch: use `otListDate` / surgery-date context, **not** unrelated Finalization `filters.date`.
- Concise copy; existing design system; no verbose explanatory paragraphs.

---

## 7. Explicit exclusions

**Not authorized by this document:**

| Exclusion | Notes |
|-----------|--------|
| PD-OTPREP-06 | Late-add / append UX; SequenceNo algorithm / auto-continuation |
| PD-OTPREP-07 | Past-date preparation policy / restriction |
| PD-OTPREP-08 | Timezone / hospital-local day normalization |
| PD-OTPREP-09 | `ux_ot_finalize_prepared_date` create/drop/alter |
| PD-OTPREP-10 | OTPrepared Upsert / GuardLocked FSM enforcement; Reopen workflow redesign |
| SequenceNo behavior changes | Preserve client-supplied semantics |
| New OT list entity / operational worklist | Forbidden |
| Ownership | CounselorId, My OT Prep, My Finalize, Assign/Reassign/ReQueue, Supervisor, OTPreparationOwnerId |
| Phase 3I / Slice 14 / Phase 3J / C-01 / Phase2X | Forbidden |
| Financial / insurance / clinical / payment rules | Forbidden |
| Permission redesign | Forbidden |
| Backend Prepare/GetOtList date semantics | Must remain unchanged |
| Package 1 scope reopen | Forbidden |

---

## 8. Data-source rule

### Preferred (authorized default)

Derive distinct `ScheduleDate` values **client-side** from existing loaded Finalize list data.

**Repository evidence (authorization-time inspection):**

| Fact | Evidence |
|------|----------|
| Finalize list returns `scheduleDate` | `OtFinalizeService.ToResponse` derives `ScheduleDate` from `StartTime`; FE maps `scheduleDate` in `counsellors-desk.api.ts` |
| Prepare eligibility already filters by `scheduleDate` | `prepare-ot-date-scope.ts` |
| Operational-model audit | Prefer catalog from existing loaded data; dedicated API only if insufficient |

### Completeness caveat (implementer must verify during implementation — not an API authorization)

| Risk | Mitigation within this authorization |
|------|--------------------------------------|
| Finalize list loaded **with** a single-date filter may omit other surgery dates from the in-memory catalog | Implementation must derive catalog from a data set that includes the intended ScheduleDate universe (e.g. unfiltered or appropriately scoped loaded finalize records already used by the page). Adjust **client fetch parameters already supported** by `GET /Counseling/ot-schedule` (existing `date` optional) if needed — **without** new endpoints. |
| If existing query surface is proven insufficient | **STOP** — document exact missing fields/query limits as a **dependency**; do **not** invent a new endpoint under this authorization. Seek a separate, minimal API/query Implementation Authorization if required. |

### This authorization task

- **Does not** modify APIs.
- **Does not** automatically create a new endpoint.
- **Preferred path:** frontend-only using existing loaded `scheduleDate` data.

---

## 9. UX / design constraints

Use the **existing** Hospital Portal design system (`shadcn` / counselling session tokens / existing Finalize–OT Prep patterns).

| Do | Do not |
|----|--------|
| Reuse buttons, badges, inputs, empty/loading states, typography, spacing, a11y patterns | New UI framework / component library / visual language |
| Task-focused, operational, concise, accessible, responsive | KPI-dashboard overdesign; decorative calendar; redundant headings |
| Catalog as primary discoverability | Second operational worklist paradigm |
| Modern healthcare-grade clarity | Verbose explanatory copy; excessive whitespace; duplicated status noise |

Desktop-first hospital workstation density applies (healthcare UX rules).

---

## 10. Acceptance criteria (future implementation)

| ID | Criterion |
|----|-----------|
| **AC-01** | Patient Finalised today with surgery tomorrow is discoverable under tomorrow’s OT Preparation date |
| **AC-02** | Patient Finalised today with surgery +2 days is discoverable under that +2 date |
| **AC-03** | Patient Finalised today with surgery next week is discoverable under that surgery date |
| **AC-04** | Finalisation date never determines OT Preparation date |
| **AC-05** | Available dates derive from authoritative `ScheduleDate` data |
| **AC-06** | No arbitrary date horizon is introduced |
| **AC-07** | Selecting a date does not automatically load the OT Prepared list |
| **AC-08** | Explicit Load OT List remains the loading action |
| **AC-09** | Ready-for-preparation cases distinguishable from already-prepared cases |
| **AC-10** | Empty state communicates absence of eligible cases, not merely absence of a prepared list |
| **AC-11** | OT Preparation wording clearly identifies the surgery date |
| **AC-12** | OT Prep subtitle uses OT preparation date context, not unrelated Finalization filter date |
| **AC-13** | Changing selected date cannot silently present rows from another surgery date without clear context |
| **AC-14** | Existing Prepare/GetOtList backend date scoping remains unchanged |
| **AC-15** | Existing FSM remains unchanged |
| **AC-16** | No CounselorId or ownership behavior introduced |
| **AC-17** | No new OT worklist/entity introduced |
| **AC-18** | Existing permissions and branch/tenant isolation remain unchanged |

---

## 11. Automated test requirements (future implementation)

Future implementation **MUST** add/update automated tests for:

1. Surgery-date catalog derivation  
2. Finalised-today / surgery-tomorrow  
3. Finalised-today / surgery +2  
4. Finalised-today / surgery next week  
5. Multiple patients on same surgery date  
6. Dates with OTPrepared rows  
7. Dates with Finalised but no OTPrepared rows  
8. Dates with neither  
9. Date selection preserving explicit Load behavior  
10. Stale prepared-list context after date change  
11. Subtitle using `otListDate` / surgery date  
12. Regression of existing `prepare-ot-date-scope` tests  
13. Regression of existing Package 1 tests  

**Do not** add tests for PD-OTPREP-06 / 07 / 08 / 09 / 10 behavior under this package.

---

## 12. Manual UAT requirements (after implementation + automated tests)

**STOP** after automated tests. Manual UAT is a separate gate.

| ID | Scenario |
|----|----------|
| A | Finalise today / surgery today |
| B | Finalise today / surgery tomorrow |
| C | Finalise today / surgery +2 |
| D | Finalise today / surgery next week |
| E | Multiple Finalised patients on different future dates |
| F | Select date with Finalised but no OTPrepared |
| G | Select date already containing OTPrepared |
| H | Select date with no eligible surgeries |
| I | Change selected date; verify stale data not misleading |
| J | Explicit Load OT List behavior |
| K | Verify surgery-date wording |
| L | Verify no ownership / My Work behavior appears |

Do not mark UAT PASS or acceptance automatically.

---

## 13. Regression invariants (LOCKED)

1. `StartTime` / `ScheduleDate` remains OT Preparation date SoT.  
2. Finalisation date is never the grouping key.  
3. No `FinalisedAt` field.  
4. Prepare remains date-scoped.  
5. Load remains date-scoped.  
6. OT Preparation remains shared.  
7. No `CounselorId` ownership.  
8. No My OT Preparation.  
9. No new OT worklist/entity.  
10. Existing FSM unchanged.  
11. Existing SequenceNo semantics unchanged.  
12. Branch/tenant authorization unchanged.  
13. Existing permissions unchanged.  
14. Package 1 behavior preserved (Reporting Time Confirm; Cancel reason/persistence; Needs Attention; Awaiting Finalise wording; Avg Wait removed; OTPrepared Reopen-only UI; Reopen metadata retention; Finalised edit → NotConfirmed; shared model; permissions; ownership boundaries).

---

## 14. Implementation boundary

### Package name

**Finalize / OT Preparation — Surgery-Date Discoverability & Operational Clarity**

### Preferred surface (candidate — confirm during implementation)

Frontend-first if possible:

| Candidate | Role |
|-----------|------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | OT Preparation workspace date state, Load, subtitle, empty/ready/prepared presentation |
| `apps/hospital-portal-web/src/lib/counsellors-desk/prepare-ot-date-scope.ts` (and/or new colocated helper) | Catalog derivation / date eligibility helpers |
| Existing Finalize list query / API mapping | Only if adjusting **existing** optional `date` query usage; no new endpoint |

Do **not** treat this file list as mandatory until implementation inspection confirms each file is required.  
Do **not** modify backend services, schema, permissions, routes, or FSM under this authorization.

### Potentially affected behaviors (in-scope)

- ScheduleDate presentation for discoverability  
- OT Preparation date selection / catalog  
- Empty / ready / prepared presentation  
- Subtitle / context copy  
- Stale-list honesty after date change (presentation/context only)

---

## 15. UAT gate

| Gate | Status |
|------|--------|
| Discoverability Manual UAT | **NOT EXECUTED** by this authorization task |
| When to run | After implementation + automated tests pass |
| Package 1 Manual UAT | Remains **IN PROGRESS** independently |

---

## 16. Acceptance gate

| Gate | Status |
|------|--------|
| Discoverability Acceptance | **NOT RECORDED** |
| Package 1 Acceptance | **NOT RECORDED** |
| Rule | Acceptance requires explicit recording after Manual UAT — never automatic |

---

## 17. Authorization statement

```text
IMPLEMENTATION AUTHORIZED:

YES — ONLY FOR PD-OTPREP-01 THROUGH PD-OTPREP-05

This does NOT authorize:
  PD-OTPREP-06
  PD-OTPREP-07
  PD-OTPREP-08
  PD-OTPREP-09
  PD-OTPREP-10

and does not authorize any other adjacent scope.
```

**This task creates the authorization. It does NOT execute the implementation.**

---

## 18. Sign-off

| Role | Action | Status |
|------|--------|--------|
| Product Owner | Scope PD-OTPREP-01…05 for bounded implementation | **AUTHORIZED via this document — name not supplied** |
| Engineering | Begin implementation only after reading this artifact | **NOT STARTED** |
| QA / UAT | Manual UAT after automated tests | **NOT EXECUTED** |
| Acceptance | Explicit acceptance recording | **NOT RECORDED** |

---

## 19. Control flags

```text
GOVERNANCE ONLY (this task): YES
IMPLEMENTATION AUTHORIZED: YES — PD-OTPREP-01…05 ONLY
IMPLEMENTATION PERFORMED BY THIS TASK: NO
API CHANGES BY THIS TASK: NONE
DB CHANGES BY THIS TASK: NONE
PERMISSION CHANGES BY THIS TASK: NONE
ROUTE CHANGES BY THIS TASK: NONE
FSM CHANGES BY THIS TASK: NONE
OWNERSHIP CHANGES BY THIS TASK: NONE
SEQUENCE NO CHANGES: NOT AUTHORIZED
PACKAGE 1 UAT: IN PROGRESS (unchanged)
PACKAGE 1 ACCEPTANCE: NOT RECORDED
DISCOVERABILITY UAT: NOT EXECUTED
DISCOVERABILITY ACCEPTANCE: NOT RECORDED
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
```

**STOP.**  
Next step is bounded implementation under this authorization — in a **separate** task. Do not collapse authorization → implementation → UAT → acceptance.

---

## Appendix A — Mapping to operational-model audit

| Audit gap | Covered by this authorization? |
|-----------|--------------------------------|
| Discoverability / catalog (G4/G5, Scenarios B–D, L) | **YES** (01, 02) |
| Empty / ready vs prepared honesty | **YES** (03) |
| Explicit Load + stale context | **YES** (04) |
| Wording / subtitle | **YES** (05) |
| Late-add F/G | **NO** (06) |
| Past-date K | **NO** (07) |
| Timezone | **NO** (08) |
| Prepared-date unique index | **NO** (09) |
| Upsert vs GuardLocked P | **NO** (10) |
