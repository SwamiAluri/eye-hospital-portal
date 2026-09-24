# Finalize Surgery + OT Preparation
# Bounded Implementation Authorization —
# Package A — OT Preparation UX / Operational Clarity Remediation

| Field | Value |
|-------|--------|
| **Document type** | **BOUNDED IMPLEMENTATION AUTHORIZATION — GOVERNANCE ONLY** |
| **Title** | Finalize Surgery + OT Preparation — Package A Implementation Authorization — UAT UX / Operational Clarity Remediation |
| **Package name** | Finalize / OT Preparation — Package A — OT Preparation UX / Operational Clarity Remediation |
| **Date** | 2026-09-23 |
| **Status** | **IMPLEMENTATION AUTHORIZED — PACKAGE A ONLY** |
| **Implementation started by this task** | **NO** |
| **Production code / API / DB / permissions / routes / FSM / ownership / UI / tests modified by this task** | **NO** — this artifact is governance only |

---

## Authorization statement

```text
This authorization permits implementation of Package A only.

It does NOT authorize Package B (Print).
It does NOT authorize Package C (PD-OTPREP-10).

PACKAGE A IMPLEMENTATION AUTHORIZATION: YES
PACKAGE B PRINT AUTHORIZATION: NO
PACKAGE C PD-OTPREP-10 AUTHORIZATION: NO
NEW API AUTHORIZATION: NO
DB CHANGE AUTHORIZATION: NO
PERMISSION CHANGE AUTHORIZATION: NO
FSM CHANGE AUTHORIZATION: NO
OWNERSHIP CHANGE AUTHORIZATION: NO
SEQUENCENO CHANGE AUTHORIZATION: NO
PAST-DATE POLICY AUTHORIZATION: NO
TIMEZONE CHANGE AUTHORIZATION: NO
PACKAGE 1 REOPEN: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
C-01 REOPEN: NO
```

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/product-decisions/finalize-surgery-ot-preparation-uat-remediation-package-a-implementation-authorization.md` |
| Artifact disposition | **NEW** |
| Authorizes | Tightly bounded frontend UX remediation for **PD-OTPREP-UAT-01, 02, 03, 04, 05, 09, 10** only |
| Does not authorize | Package B Print · Package C PD-10 · new API · DB · FSM · ownership · SequenceNo · past-date · timezone |
| Product Owner | Decision recorded — name not supplied |
| Next gate | Separate **Package A IMPLEMENTATION** task (not started by this governance task) |

---

## 2. Product Decision references

| Artifact | Role |
|----------|------|
| `docs/product-decisions/finalize-surgery-ot-preparation-uat-remediation-product-decision.md` | **Primary** — PD-OTPREP-UAT-01…15 |
| `docs/product-decisions/finalize-surgery-ot-preparation-operational-model-product-decision.md` | PD-OTPREP-01…10; **PD-OTPREP-04 superseded** by UAT-03 |
| `docs/product-decisions/finalize-surgery-ot-preparation-discoverability-implementation-authorization.md` | Prior discoverability Package (01…05) — **implemented**; do not reopen as Package A |
| `docs/product-decisions/finalize-surgery-ot-preparation-implementation-authorization.md` | Package 1 — **do not reopen** |
| `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` | Parent PD-FS |

### Authorized Product Decisions (Package A)

| ID | Topic | Authorized here? |
|----|-------|------------------|
| **PD-OTPREP-UAT-01** | Actual-date relative labels | **YES** (A1) |
| **PD-OTPREP-UAT-02** | Surgery-date catalog refinement | **YES** (A2) |
| **PD-OTPREP-UAT-03** | Auto-load existing OTPrepared (READ only) | **YES** (A3) |
| **PD-OTPREP-UAT-04** | Ready / Prepared / None | **YES** (A4) |
| **PD-OTPREP-UAT-05** | Prepared OT operational grid | **YES** (A5) |
| **PD-OTPREP-UAT-09** | Professional concise copy | **YES** (A6) |
| **PD-OTPREP-UAT-10** | Bounded visual/layout refinement | **YES** (A7) |

### Explicitly not authorized (Package A)

| ID / topic | Why |
|------------|-----|
| **PD-OTPREP-UAT-08** / Package B | Dedicated Print — separate auth |
| **PD-OTPREP-UAT-06/07/10 path for FSM** / Package C | Reschedule/PD-10 — separate auth |
| **PD-OTPREP-UAT-11…15** preserve-only | Ownership / SequenceNo / TZ / DB / FSM — no change work |
| **PD-OTPREP-06…10** | Separately governed |

---

## 3. Audit references

| Artifact | Role |
|----------|------|
| `docs/audits/finalize-surgery-ot-preparation-uat-findings-operational-ux-reconciliation-audit.md` | UAT findings driving Package A |
| `docs/audits/finalize-surgery-ot-preparation-operational-model-audit.md` | Date SoT / Load model |
| `docs/audits/finalize-surgery-ot-preparation-comprehensive-audit.md` | Prior Finalize/OT context |

---

## 4. Current governance baseline

| Area | Status |
|------|--------|
| Phase 3I | **CLOSED** |
| Slice 13 | **CLOSED** |
| Slice 14 | **DOES NOT EXIST** |
| Phase 3J | **NOT CREATED** |
| C-01 | **ACCEPTED + CLOSED** |
| Package 1 | **IMPLEMENTED** |
| Package 1 Manual UAT | **IN PROGRESS** |
| Package 1 Acceptance | **NOT RECORDED** |
| PD-OTPREP-01…10 | **RECORDED** |
| PD-OTPREP-UAT-01…15 | **RECORDED** |
| Original Discoverability Package | **IMPLEMENTED** |
| Discoverability UAT | **NOT ACCEPTED** |
| Discoverability Acceptance | **NOT RECORDED** |
| Package A Implementation Authorization | **YES — THIS DOCUMENT** |
| Package A Implementation | **NOT STARTED** |
| Package B / C Authorization | **NO** |

Governance sequence:

```text
PRODUCT DECISION (UAT remediation)     ✓
        ↓
PACKAGE A IMPLEMENTATION AUTHORIZATION ✓ (this document)
        ↓
PACKAGE A IMPLEMENTATION               ← next task (NOT started here)
        ↓
AUTOMATED TESTS + PLAYWRIGHT
        ↓
STOP
        ↓
MANUAL UAT
        ↓
ACCEPTANCE
```

Do not collapse gates.  
Do not mark UAT PASS or Acceptance because this authorization exists.

---

## 5. Locked business model

```text
StartTime → ScheduleDate → Surgery Date
```

Never FinalisedAt / Finalisation date / PreparedAt as grouping key.  
No invented future dates.  
No new OT worklist/entity.  
OT Preparation remains shared, non-owned.

---

## 6. Exact authorized scope (Package A)

### A1 — PD-OTPREP-UAT-01 Actual-date relative labels

Relative labels **only** for actual ScheduleDate values already in authoritative data (e.g. Today · Tomorrow · Wed, 08 Apr).

- Chronological order retained  
- No generated dates / empty slots / 7–90 day horizons / calendar ranges / new date source  
- SoT unchanged  

### A2 — PD-OTPREP-UAT-02 Surgery-date catalog refinement

Refine existing catalog: actual ScheduleDates · chronological · ready/prepared counts where supported · responsive · existing components · horizontal scroll if many dates.

Prefer loaded Finalize `scheduleDate` data (prior discoverability pattern).  
If insufficient: **STOP** — report `DATA SOURCE INSUFFICIENT — NEW API AUTHORIZATION REQUIRED`.  
**No new endpoint** under this authorization.

### A3 — PD-OTPREP-UAT-03 Auto-load existing OT list (**critical**)

**Supersedes** prior PD-OTPREP-04 Option B (explicit-Load-only).

On selecting an actual surgery date:

1. Update selected OT Preparation date  
2. Automatically execute existing **READ/GET** (`GetOtList` / equivalent) for that date  
3. Show OTPrepared rows immediately if present  
4. Else Ready if Finalised exist  
5. Else None  

**AUTO-LOAD = READ ONLY.** Must never Prepare · create OTPrepared · assign SequenceNo · mutate StartTime/surgery/patient · change FSM · change ownership · create work items · mutate DB.

**Prepare New List** remains explicit. Do not merge Load and Prepare.

### Stale data rule

Displayed OTPrepared rows must always match the currently selected surgery date. Clear prior rows / show loading / then new state. No backend semantics change.

### A4 — PD-OTPREP-UAT-04 Ready / Prepared / None

Existing statuses only. Honest messaging. No new FSM/DB statuses. Concise operational copy.

### A5 — PD-OTPREP-UAT-05 Prepared OT operational grid

Professional grid using existing Finalization / portal table patterns and **existing** fields only:

SequenceNo · Patient Name · UHID · Procedure · Eye · Surgery Time/StartTime · Surgeon · Theatre · Status · Action  

PreparedAt/By only if already mapped. No new DTOs/fields/entity/worklist. Reopen remains the only prepared-row mutation action. No Change/Edit Surgery Date · Reschedule · Delete · Requeue · Assign/Reassign.

Certified path after Reopen unchanged (Confirmed → Finalize edit → Confirm/Finalise). PD-OTPREP-10 separate.

### A6 — PD-OTPREP-UAT-09 Professional concise copy

Preferred: Surgery Date · Ready for OT Preparation · Prepared · No eligible surgeries · Prepared OT List · Prepare New List · Reopen  

Avoid instructional/AI-like wording. Preserve Finalised / OTPrepared / SurgeryDone where established.

### A7 — PD-OTPREP-UAT-10 Bounded visual/layout refinement

Reduce whitespace · hierarchy · catalog readability · control/grid alignment · workstation density · responsive · a11y · existing design system.

No new theme / visual language / component library / decorative dashboard / excessive cards / AI copy.

---

## 7. Exact exclusions

| Exclusion | Status |
|-----------|--------|
| Package B Print (`window.print`, print layout/CSS/service) | **NOT AUTHORIZED** |
| Package C PD-OTPREP-10 / GuardLocked / Upsert / OTPrepared date mutation | **NOT AUTHORIZED** |
| New API / DTO / mutation / controller | **NOT AUTHORIZED** |
| DB / indexes / migrations / status values | **NOT AUTHORIZED** |
| FSM / Prepare transition changes | **NOT AUTHORIZED** |
| Ownership / My Work / Assign | **NOT AUTHORIZED** |
| SequenceNo algorithms | **NOT AUTHORIZED** |
| Past-date policy / timezone redesign | **NOT AUTHORIZED** |
| Package 1 reopen | **NOT AUTHORIZED** |
| Phase 3I / Slice 14 / Phase 3J / C-01 | **NOT AUTHORIZED** |

---

## 8. API boundary

- No new API authorized.  
- Existing GET/read may be called automatically for A3.  
- Existing contracts unchanged.  
- Catalog: prefer existing loaded Finalize scheduleDate; if insufficient → STOP + report; do not invent endpoint.

---

## 9. Database boundary

**NO DATABASE CHANGES.** PD-OTPREP-09 remains deferred.

---

## 10. FSM boundary

**NO FSM CHANGES.** Preserve NotConfirmed → Confirmed → Finalised → OTPrepared → SurgeryDone and existing Cancel/Reopen. Auto-load is read-only. PD-OTPREP-10 separate.

---

## 11. Ownership boundary

**NO OWNERSHIP CHANGES.** Shared operational surface preserved.

---

## 12. SequenceNo boundary

**NO SequenceNo behavior change.** Display-only in Package A. PD-OTPREP-06 separate.

---

## 13. Package 1 protection

Preserve Reporting Time Confirm · Cancel confirmation/reason · Needs Attention · Awaiting Finalise · Avg Wait removal · OTPrepared Reopen-only UI · Reopen metadata retention · Finalised edit → NotConfirmed · ownership boundaries. **Do not reopen Package 1.**

---

## 14. Automated test requirements

### Unit / component (minimum)

1. Relative labels: Today / Tomorrow / future weekday-date  
2. Catalog: actual dates only · chronological · no invented dates  
3. Auto-load: selecting date triggers existing READ · correct date param · **no Prepare** mutation  
4. Stale: previous date rows not shown for new date  
5. Ready / Prepared / None — all three  
6. Prepared grid: required existing fields · action alignment · empty/loading  
7. Copy: no prohibited instructional text  
8. Responsive / accessibility regression  

### Backend

Do not modify backend behavior. Existing backend tests must continue to pass.

---

## 15. Playwright requirements

| Journey | Expectation |
|---------|-------------|
| **A** | Select future surgery date → automatic READ → prepared list when OTPrepared exist |
| **B** | Finalised only → Ready · Prepare New List remains explicit |
| **C** | No eligible → None |
| **D** | Switch A→B · A rows not under B |
| **E** | Grid shows patient · procedure · eye · time · theatre · sequence · status · Reopen |
| **F** | Reopen existing behavior intact |

Do **not** implement/test: direct OTPrepared date editing · Print · Package C behavior.

---

## 16. Acceptance criteria (Package A)

| ID | Criterion |
|----|-----------|
| **AC-A01** | Only actual ScheduleDate values represented |
| **AC-A02** | Relative labels decorate actual dates only |
| **AC-A03** | No arbitrary future date horizon generated |
| **AC-A04** | Date catalog chronological |
| **AC-A05** | Selecting date auto-loads existing OTPrepared via existing READ path |
| **AC-A06** | Auto-load never invokes Prepare |
| **AC-A07** | Auto-load never changes FSM |
| **AC-A08** | Auto-load never mutates ownership |
| **AC-A09** | Prepared rows always correspond to selected surgery date |
| **AC-A10** | Ready / Prepared / None honest |
| **AC-A11** | Prepared grid uses existing authoritative fields |
| **AC-A12** | No new operational/entity/worklist model |
| **AC-A13** | Grid follows existing Hospital Portal table patterns |
| **AC-A14** | Reopen remains only prepared-row mutation action |
| **AC-A15** | Direct OTPrepared surgery-date editing unavailable |
| **AC-A16** | Professional concise operational copy |
| **AC-A17** | Accessibility and responsive standards preserved |
| **AC-A18** | No Print changes |
| **AC-A19** | No SequenceNo changes |
| **AC-A20** | No FSM / GuardLocked / Upsert changes |

---

## 17. Manual UAT gate

After implementation + automated tests: **STOP**.

Do not mark UAT PASS or Acceptance automatically.

Manual UAT minimum: today · tomorrow · +2/future · multiple future dates · prepared auto-load · Ready · None · date-switch/stale · grid alignment · Reopen · responsive · a11y · concise copy · no accidental Prepare.

UAT record: tester · environment · date/time · scenario · expected · actual · PASS/FAIL/BLOCKED · evidence.

No acceptance without explicit UAT sign-off.

---

## 18. Acceptance gate

| Gate | Status |
|------|--------|
| Package A Acceptance | **NOT RECORDED** |
| Discoverability Acceptance | **NOT RECORDED** |
| Package 1 Acceptance | **NOT RECORDED** |

---

## 19. Required engineering implementation report (after Package A coding)

Must contain:

1. Scope implemented  
2. Files changed  
3. Components changed  
4. API usage  
5. No API contract changes  
6. No DB changes  
7. No permission changes  
8. No FSM changes  
9. No ownership changes  
10. No SequenceNo changes  
11. Print untouched  
12. PD-OTPREP-10 untouched  
13. Automated tests  
14. Playwright tests  
15. Skipped tests + reason  
16. Known limitations  
17. Manual UAT status  
18. Acceptance status  
19. Explicit **STOP**

---

## 20. Sign-off

| Role | Action | Status |
|------|--------|--------|
| Product Owner | Authorize Package A only | **AUTHORIZED via this document — name not supplied** |
| Engineering | Begin Package A only after reading this artifact | **NOT STARTED** |
| QA / UAT | After implementation + tests | **NOT EXECUTED** |
| Acceptance | Explicit recording later | **NOT RECORDED** |

---

## 21. Control flags (summary)

```text
PACKAGE A IMPLEMENTATION AUTHORIZATION: YES
PACKAGE A IMPLEMENTATION BY THIS TASK: NOT STARTED
PACKAGE B PRINT AUTHORIZATION: NO
PACKAGE C PD-OTPREP-10 AUTHORIZATION: NO
NEW API AUTHORIZATION: NO
DB CHANGE AUTHORIZATION: NO
PERMISSION CHANGE AUTHORIZATION: NO
FSM CHANGE AUTHORIZATION: NO
OWNERSHIP CHANGE AUTHORIZATION: NO
SEQUENCENO CHANGE AUTHORIZATION: NO
PAST-DATE POLICY AUTHORIZATION: NO
TIMEZONE CHANGE AUTHORIZATION: NO
PACKAGE 1 REOPEN: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
C-01 REOPEN: NO
MANUAL UAT BY THIS TASK: NO
ACCEPTANCE: NOT RECORDED
```

---

## 22. Governance stop

This task is complete when this authorization artifact is recorded.

**DO NOT** implement Package A in this task.  
**DO NOT** modify production UI, Load behavior, labels, grid, Print, Reopen, SequenceNo, FSM, APIs, or DB.

```text
PRODUCT DECISION: RECORDED
PACKAGE A IMPLEMENTATION AUTHORIZATION: YES
PACKAGE A IMPLEMENTATION: NOT STARTED BY THIS TASK
PACKAGE B PRINT: NOT AUTHORIZED
PACKAGE C PD-OTPREP-10: NOT AUTHORIZED
MANUAL UAT: NOT EXECUTED BY THIS TASK
ACCEPTANCE: NOT RECORDED

NEXT GATE:
SEPARATE BOUNDED PACKAGE A IMPLEMENTATION TASK

STOP.
```
