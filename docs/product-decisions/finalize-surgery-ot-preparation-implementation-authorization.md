# Finalize Surgery + OT Preparation
# Bounded Implementation Authorization — Package 1

| Field | Value |
|-------|--------|
| **Document type** | **BOUNDED IMPLEMENTATION AUTHORIZATION — GOVERNANCE ONLY** |
| **Title** | Finalize Surgery + OT Preparation — Bounded Implementation Authorization — Package 1 |
| **Package name** | Finalize / OT Preparation — Implementation Package 1 — Core UX Honesty + Approved Mutation UX |
| **Date** | 2026-09-22 |
| **Status** | **IMPLEMENTATION AUTHORIZED — PACKAGE 1 ONLY** |
| **Authoritative audit** | `docs/audits/finalize-surgery-ot-preparation-comprehensive-audit.md` |
| **Authoritative Product Decision** | `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` |
| **Production code / API / DB / permissions / routes / UI / tests modified by this task** | **NO** — this artifact is governance only |
| **Implementation started by this task** | **NO** |

---

## 1. Purpose

This document is the **explicit Implementation Authorization** required before coding begins for Finalize Surgery / OT Preparation Package 1.

| Fact | Status |
|------|--------|
| PD-FS-01 … PD-FS-13 | **DECIDED / RECORDED** (Product Decision artifact) |
| Prior Implementation Authorization | **NONE** |
| This document | **Authorizes Package 1 only** |
| Entire set of approved Product Decisions | **Not** automatically authorized for implementation |
| Schema / index changes | **Not authorized** |
| FS-G-13 | **Not resolved** |
| PD-FS-10 Slot predicate | **Not defined; not authorized** |
| OT Returned workflow / PD-FS-09 | **Not authorized in Package 1** |

**This authorization permits implementation of Package 1 only.**

It does **not** authorize implementation of every approved Product Decision.  
It does **not** authorize schema/index changes.  
It does **not** resolve FS-G-13.  
It does **not** define the missing PD-FS-10 Slot predicate.  
It does **not** authorize OT Returned workflow changes.

---

## 2. Governance Baseline

| Area | Status |
|------|--------|
| Phase 3I | **CLOSED** — do not reopen |
| Slice 13 | **CLOSED** — do not reopen |
| Slice 14 | **DOES NOT EXIST** — do not create |
| Phase 3J | **NOT CREATED** — do not create |
| C-01 Waiting List | **ACCEPTED + CLOSED** — do not reopen |
| Phase 2X | **BLOCKED** — unchanged |
| Finalize Audit | **COMPLETE** |
| Product Decision PD-FS-01…13 | **APPROVED / RECORDED** |
| Package 1 Implementation Authorization | **YES — THIS DOCUMENT** |
| Broader Finalize/OT Prep implementation | **NOT AUTHORIZED** beyond Package 1 |
| UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |

Governance sequence:

```text
PRODUCT DECISION          ✓ recorded
        ↓
IMPLEMENTATION AUTHORIZATION   ✓ Package 1 (this document)
        ↓
IMPLEMENTATION            ← next gate (not started by this task)
        ↓
AUTOMATED TESTS
        ↓
MANUAL UAT
        ↓
EXPLICIT ACCEPTANCE
```

Do not collapse these stages.

---

## 3. Governance Invariants (MUST PRESERVE)

Finalize / OT Preparation remains a **shared** operational surface. Ownership remains **OUT OF SCOPE**.

### 3.1 Ownership — do not change

- No `CounselorId` on `ot_finalize_schedule`
- No My Finalize / My OT Preparation / Counsellor Dashboard
- No Assign / Reassign / ReQueue on Finalize / OT Preparation
- No new ownership model or worklist
- `CounselorId` remains CounselingSession SoT where applicable
- `CreatedByUserId` is not ownership
- Opening/viewing/starting does not silently establish ownership

### 3.2 Adjacent modules — do not change

- Waiting List ownership / PD16 branch authorization
- Counselling Session ownership / Sessions Reassignment Required
- Follow-up Center ownership/lifecycle
- Analytics My Work (reporting only)
- PatientJourney OT Returned lifecycle semantics
- CounselingSession lifecycle
- SurgeryDone sealing / second-eye session behavior
- Branch authorization fail-closed
- Existing permissions unless explicitly required by Package 1 persistence (none expected)

### 3.3 State machine — do not redesign

Preserve:

```text
NotConfirmed → Confirm → Confirmed → Finalise → Finalised → Prepare → OTPrepared
  → IP SurgeryCompleted → SurgeryDone

Cancel → Cancelled
Reopen: OTPrepared → Confirmed; Cancelled → NotConfirmed
```

- No `"Scheduled"` status
- No new states
- No FSM redesign
- No undocumented business-rule assumptions
- No new insurance / payment / clinical blockers
- No financial / insurance / clinical SoT changes

### 3.4 Programs — do not create/reopen

- Phase 3I, Slice 14, Phase 3J, C-01, Phase 2X as above

---

## 4. FS-G-13 / PD-FS-12 Technical Prerequisite

| Item | Status |
|------|--------|
| PD-FS-12 | **DECIDED — OPTION C — DEFERRED PENDING TECHNICAL VERIFICATION** |
| FS-G-13 live DB verification | **PENDING TECHNICAL VERIFICATION — LIVE DATABASE** |
| SQL declaration of concern | `ux_ot_finalize_prepared_date` (possible one OTPrepared per tenant/date) |
| Schema / index modify / remove / recreate / weaken / strengthen | **NOT AUTHORIZED** by this document |
| Multi-patient Prepare service behavior during Package 1 | **PRESERVE** (do not change for uniqueness) |

If live verification later requires a schema change, that requires a **separate DB-specific authorization**. Package 1 must not include it.

---

## 5. Package 1 — Authorized Scope

### 5.1 Authorized Product Decision outcomes (implementation YES)

| PD | Decision | Implementation authorization |
|----|----------|------------------------------|
| **PD-FS-01** | Option A — Needs Attention = `NotConfirmed + Confirmed` | **YES** — truthful presentation of existing predicate only |
| **PD-FS-02** | Option C — Remove Avg. Wait KPI | **YES** |
| **PD-FS-03** | Option A — Reporting Time is Confirm prerequisite | **YES** — FE/BE alignment for Confirm |
| **PD-FS-04** | Option A + D — Cancel confirmation + reason; no false cancel-ot claim | **YES** — UX + reason persistence via existing Cancel path |

### 5.2 PD-FS-01 — Needs Attention (detail)

**Allowed**

- Improve/adjust displayed label if required to avoid misleading users about the existing predicate
- Improve presentation hierarchy
- Preserve exact underlying predicate: `NotConfirmed + Confirmed`

**Not allowed**

- Invent a new blocker model
- Add status / payment / insurance / theatre / clinical conditions
- Change backend predicate
- Change the state machine
- Invent a business definition beyond Option A

If an exact replacement label is not established in repository/design system, inspect current terminology first.

### 5.3 PD-FS-02 — Avg. Wait KPI (detail)

**Allowed**

- Remove Avg. Wait KPI from Finalize / OT Preparation UI
- Adjust KPI spacing/layout for balance
- Preserve existing design system and other KPI meanings

**Not allowed**

- Replacement wait-time formula / SLA / new KPI
- Backend aggregation changes unless only removing an already-unused UI field

### 5.4 PD-FS-03 — Reporting Time (detail)

**Required outcome:** Confirm cannot succeed when the approved Reporting Time prerequisite is not satisfied.

**Allowed**

- Inspect Confirm modal, form model, API, service validation, DTOs, persistence, existing validation patterns
- Smallest change to align frontend and backend Confirm behavior
- Preserve existing valid Confirm behavior

**Not allowed**

- Unrelated Confirm blockers
- Insurance / payment / theatre / clinical blockers
- FSM changes

**Required tests**

- Valid Reporting Time → Confirm succeeds
- Missing/invalid Reporting Time → Confirm rejected
- Existing valid Confirm scenarios remain valid
- Branch authorization remains enforced

### 5.5 PD-FS-04 — Cancel UX (detail)

**Allowed**

- Explicit confirmation UI
- Require cancellation reason
- Persist reason through existing Cancel workflow
- Expose persisted reason only where required for operational honesty
- Preserve current Cancel eligibility
- Do not falsely claim `/cancel-ot` is an operational backend sync (Option D)

**Not allowed**

- New Cancel state / cancellation workflow
- Automatic ReQueue
- Waiting List lifecycle mutation
- Ownership mutation
- Unrelated state transitions
- Claiming `/cancel-ot` works if it does not

**Field reuse:** If a suitable cancellation reason field already exists, reuse it.  
**Schema stop condition:** If persistence requires a schema change not already supported, **STOP** that portion and report **separate DB authorization required**.

---

## 6. Regression-Only Decisions (protect; do not redesign)

Approved Product Decisions that **do not** require new behavior unless inspection finds a real current defect. Protect with automated tests where appropriate.

| PD | Required protection |
|----|---------------------|
| **PD-FS-05** | OTPrepared: do **not** expose Cancel in UI; Reopen remains recovery path |
| **PD-FS-06** | Reopen from OTPrepared: retain `SequenceNo`, `PreparedAt`, `PreparedBy` |
| **PD-FS-07** | Finalised save/edit → `NotConfirmed`; preserve revalidation |
| **PD-FS-08** | Do **not** introduce new hard blockers for insurance / payment / theatre |
| **PD-FS-11** | One logical list per branch/date; row persistence; SequenceNo order; shared surface; no ownership entity |
| **PD-FS-13** | Shared counsellor + OT collaboration wording where copy changes are required — wording only, not ownership |

---

## 7. Explicitly Excluded from Package 1

| Item | Reason |
|------|--------|
| **PD-FS-09** OT Returned contextual link | Keep Package 1 focused on core mutation/UX honesty; authorize separately if needed |
| **PD-FS-10** Slot completeness | Exact authoritative predicate **not** defined; do not invent; do not change ChecklistSummary / Slot pending / readiness / patient-type / consent semantics |
| **PD-FS-12 / FS-G-13** | No DB/index modification; live verification pending |
| **FS-UX-01 … FS-UX-09** as a general program | Remain proposed themes — not automatically authorized; not Slice 14 / Phase 3J |
| Ownership / My Finalize / My OT Preparation / new worklists | Out of scope |
| Phase 3I / Slice 14 / Phase 3J / C-01 / Phase 2X | Do not reopen/create |
| FSM redesign / new blockers / financial-insurance-clinical SoT | Out of scope |

### 7.1 Out-of-scope audit findings (do not fix in Package 1)

- FS-G-01 cancel-ot destination/sync (honesty: do not claim it works — already covered by PD-FS-04 Option D; do not implement sync)
- FS-G-05 CanReopen list/detail drift
- FS-G-10 server-side status filtering
- FS-G-12 zero-theatre configuration
- FS-G-14 SQL baseline drift
- FS-G-15 orphan FinalizeSurgeryDrawer
- FS-G-18 custom dialog accessibility
- FS-G-19 insurance/payment blockers
- FS-G-20 SurgeryDone from non-OTPrepared paths
- FS-G-21 documentation drift

---

## 8. Pre-Implementation Architecture Checklist

Before coding, the implementation agent must:

1. Locate canonical Finalize Surgery route  
2. Locate canonical OT Preparation workspace  
3. Locate existing Confirm service/API  
4. Locate existing Cancel service/API  
5. Locate existing cancellation persistence model  
6. Locate existing Reporting Time fields/DTOs  
7. Locate existing design-system modal/dialog components  
8. Locate existing validation/error patterns  
9. Locate existing test coverage  
10. Reuse existing services/components/data sources wherever possible  

Do **not** create duplicate services, APIs, dialogs, or a new UI framework.

---

## 9. Automated Test Authorization

Package 1 implementation is authorized **only with** automated regression coverage.

### 9.1 Confirm / Reporting Time

- Valid Reporting Time  
- Missing Reporting Time  
- Invalid Reporting Time  
- Unauthorized branch  
- Existing valid Confirm regression  

### 9.2 Cancel

- Confirmation required  
- Reason required  
- Reason persisted  
- Cancel eligibility unchanged  
- Unauthorized branch  
- No ownership mutation  
- No Waiting List lifecycle mutation  

### 9.3 KPI / Needs Attention

- Avg. Wait no longer rendered  
- Needs Attention uses `NotConfirmed + Confirmed`  
- No new blocker conditions  

### 9.4 Regression

- OTPrepared has no Cancel CTA  
- Reopen retains SequenceNo / PreparedAt / PreparedBy  
- Finalised save → NotConfirmed  
- No new insurance/payment/theatre blockers  
- OT Preparation remains shared  
- No CounselorId introduced  
- No My Finalize / My OT Preparation  
- No core FSM change  
- Branch authorization remains fail-closed  

Extend existing tests rather than duplicating coverage where possible.

---

## 10. Playwright / E2E Authorization

Where practical, add or update Playwright/E2E for the bounded workflow.

**Minimum:**

- Confirm → Confirmed (with Reporting Time rule)  
- Cancel → Cancelled (with confirmation + reason behavior)  

Do **not** build the entire FS-01…FS-28 suite as part of Package 1 unless the existing harness makes it necessary for these bounded changes. Broader FSM suite remains a separate testing/acceptance concern.

---

## 11. UAT Gate (post-implementation)

After Package 1 implementation and automated tests: **STOP**.

Do **not** mark:

- UAT PASS  
- ACCEPTED  
- CLOSED  

Do **not** perform Manual UAT unless the user explicitly requests execution.

Implementation must produce a final report containing:

1. Files changed  
2. APIs changed  
3. DB changes  
4. Permissions changed  
5. Routes changed  
6. State-machine impact  
7. Ownership impact  
8. Tests added/changed  
9. Automated test results  
10. Playwright/E2E results  
11. Confirmation that excluded items were untouched  
12. Known limitations  
13. Manual UAT scenarios requiring execution  
14. Recommended next governance gate  

---

## 12. Acceptance Requirements

Package 1 is **NOT** accepted by implementation completion alone.

Acceptance requires:

```text
PRODUCT DECISION
  → IMPLEMENTATION AUTHORIZATION (this document — Package 1)
  → IMPLEMENTATION
  → AUTOMATED TESTS
  → MANUAL UAT
  → EXPLICIT ACCEPTANCE
```

---

## 13. Control Summary

| Control | Value |
|---------|--------|
| Package 1 authorized | **YES** |
| Scope | PD-FS-01 presentation honesty; PD-FS-02 Avg Wait removal; PD-FS-03 Reporting Time Confirm alignment; PD-FS-04 Cancel confirm + reason persistence |
| Regression protection | PD-FS-05, 06, 07, 08, 11, 13 |
| PD-FS-09 | **EXCLUDED** |
| PD-FS-10 | **EXCLUDED** — predicate not defined |
| PD-FS-12 / FS-G-13 | **EXCLUDED** — no schema change |
| FS-UX-01…09 general program | **NOT AUTHORIZED** |
| Schema/index changes | **NO** |
| Ownership / new worklist / FSM redesign | **NO** |
| Production code changed by this authorization task | **NONE** |
| Implementation started by this authorization task | **NO** |
| UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |

---

## 14. Sign-Off

| Role | Result | Date |
|------|--------|------|
| Implementation Authorization (Package 1) | **GRANTED — PACKAGE 1 ONLY** | 2026-09-22 |
| Broader Finalize/OT Prep implementation | **NOT GRANTED** | — |
| Schema / FS-G-13 | **NOT GRANTED** | — |
| Manual UAT / Acceptance | **NOT RECORDED** | — |

---

## 15. Control Flags

```text
Implementation Authorization Status:
IMPLEMENTATION AUTHORIZED — PACKAGE 1 ONLY

Package 1 Authorized:
YES

Broader Finalize / OT Prep Implementation Authorized:
NO

Schema / Index Changes Authorized:
NO

FS-G-13 Resolved:
NO — PENDING LIVE DB VERIFICATION

PD-FS-10 Predicate Defined:
NO

PD-FS-09 Authorized in Package 1:
NO

Production Code Changed By This Task:
NO

API Changed By This Task:
NO

DB Changed By This Task:
NO

Permissions Changed By This Task:
NO

Routes Changed By This Task:
NO

State Machine Changed By This Task:
NO

Ownership Changed By This Task:
NO

UAT Executed:
NO

Acceptance Recorded:
NO

Phase 3I Reopened:
NO

Slice 14 Created:
NO

Phase 3J Created:
NO

C-01 Reopened:
NO

Next Gate:
IMPLEMENTATION OF PACKAGE 1
  → AUTOMATED TESTS
  → MANUAL UAT
  → EXPLICIT ACCEPTANCE
```

---

*End of Bounded Implementation Authorization — Package 1. This task created the governance artifact only. Implementation has not started.*
