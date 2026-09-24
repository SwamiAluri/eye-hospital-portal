# Finalize Surgery + OT Preparation Product Decision

| Field | Value |
|-------|--------|
| **Document type** | **PRODUCT OWNER DECISION RECORDING — GOVERNANCE ONLY** |
| **Decision family** | **PD-FS-01 … PD-FS-13** |
| **Date prepared** | 2026-09-22 |
| **Date decision-recording session** | 2026-09-22 |
| **Date Product Owner decisions recorded** | 2026-09-22 |
| **Program** | Hospital Portal — Finalize Surgery / OT Preparation |
| **Mode** | Formal Product Owner decision recording |
| **Product Decision Status** | **APPROVED / RECORDED — 13 DECIDED** |
| **Implementation Authorized** | **NO — NONE** |
| **UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |
| **FS-G-13** | **PENDING TECHNICAL VERIFICATION — LIVE DATABASE** |
| **Production code / API / DB / permissions / routes / state machine / ownership modified** | **NO** |

---

## 1. Document Metadata

| Item | Value |
|------|--------|
| Prepared from | `docs/audits/finalize-surgery-ot-preparation-comprehensive-audit.md` |
| Purpose | Record Product Owner decisions for PD-FS-01 … PD-FS-13; preserve preparation options for review |
| Authorizes | **Nothing** — governance recording only |
| Does not authorize | Implementation, UX redesign, API/DB/permission/state-machine/ownership change |
| Does not create | Slice 14, Phase 3J, FS-UX-01…09 as approved work |
| Does not reopen | Phase 3I, C-01 Waiting List |
| Explicit Product Owner option selections | **RECORDED 2026-09-22** — see §9.0 / §17 |
| Product Owner name | **Decision recorded — name not supplied** |

### Recording integrity rule

| Rule | Application |
|------|-------------|
| Record only explicit Product Owner selections | **YES — applied** |
| Infer from “Recommended decision (unapproved)” | **FORBIDDEN** (recommendations superseded by recorded decisions) |
| Infer from audit recommendations | **FORBIDDEN** |
| Mark DECIDED without named option | **FORBIDDEN** — options recorded from Product Owner directive |
| Product Owner personal name | **Not supplied** — “Decision recorded — name not supplied” |
| Implementation from PD approval alone | **FORBIDDEN** — separate Implementation Authorization required |

---

## 2. Governance Status

| Area | Status |
|------|--------|
| Phase 3I | **CLOSED** |
| Slice 13 | **CLOSED** |
| Slice 14 | **DOES NOT EXIST** |
| Phase 3J | **NOT CREATED** |
| C-01 | **ACCEPTED + CLOSED** |
| Finalize Audit | **COMPLETE** |
| Product Decision | **APPROVED / RECORDED — 13 DECIDED** |
| Implementation | **NONE** — decisions recorded; separate bounded Implementation Authorization required |
| UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
| CounselorId ownership on Finalize/OT Prep | **OUT OF SCOPE** |
| New Finalize worklist | **NOT AUTHORIZED** |
| My Finalize / My OT Preparation | **NOT AUTHORIZED** |
| OT Returned lifecycle redesign | **OUT OF SCOPE** (PD-FS-09 = contextual navigation link only — lifecycle unchanged) |
| Phase 2X | **BLOCKED** (unchanged portfolio baseline) |
| FS-G-13 live DB verification | **PENDING TECHNICAL VERIFICATION — LIVE DATABASE** |
| Current authorized implementation | **NONE** |
| Manual UAT of new Finalize/OT Prep behavior | **NOT EXECUTED** |
| Acceptance of new Finalize/OT Prep behavior | **NOT RECORDED** |

**Do not mark PASS or ACCEPTED merely because Product Decisions were recorded.**  
**Product Decision approval ≠ UAT ≠ implementation completion ≠ acceptance.**

Governance sequence remains:

```text
PRODUCT DECISION
  → IMPLEMENTATION AUTHORIZATION
  → IMPLEMENTATION
  → AUTOMATED TESTS
  → MANUAL UAT
  → ACCEPTANCE
```

These stages must not be collapsed.

### Decision vs authorization vs UAT vs acceptance

| Layer | Status in this document |
|-------|-------------------------|
| Product Owner decisions (PD-FS-01…13) | **APPROVED / RECORDED — 13 DECIDED** |
| Technical verification (FS-G-13) | **PENDING TECHNICAL VERIFICATION** |
| Environment access (DB inspect) | **ENVIRONMENT ACCESS REQUIRED** if live DB not inspectable from repo |
| Implementation authorization | **NONE** |
| UAT authorization / execution | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
| Deferred | All FS-UX-01…09; schema/index changes; ownership changes |

---

## 3. Authoritative Audit

| Item | Value |
|------|--------|
| Authoritative findings source | `docs/audits/finalize-surgery-ot-preparation-comprehensive-audit.md` |
| Authority | Repository findings in that audit are authoritative unless a finding is explicitly marked pending technical verification |
| Pending technical verification | **FS-G-13** live database index verification (§8.1) |
| Documentation drift | Pre-Slice-9 readiness docs, historical C-01 observations, SQL baseline drift, and cancel-ot comments are **not** SoT for current Finalize/OT Prep behavior |

---

## 4. Current Certified Behavior

The following are **locked** unless a *separate* Product Decision later explicitly changes them:

| Behavior | Status |
|----------|--------|
| Finalize Surgery is a **shared** operational surface | **PRESERVE** |
| OT Preparation is a **shared** operational surface | **PRESERVE** |
| No `CounselorId` on `ot_finalize_schedule` | **PRESERVE** |
| No My Finalize / My OT Preparation / Counsellor Dashboard | **PRESERVE** |
| No ownership mutation, Assign/Reassign, or ReQueue on Finalize | **PRESERVE** |
| `CounselorId` remains CounselingSession-owned where applicable | **PRESERVE** |
| `CreatedByUserId` is not ownership | **PRESERVE** |
| Waiting List remains shared | **PRESERVE** |
| Sessions remains active counselling ownership / reassignment surface | **PRESERVE** |
| Analytics My Work remains reporting only | **PRESERVE** |
| SurgeryDone is sealed / view-only for counsellor reopen | **PRESERVE** |
| Subsequent / second-eye surgery uses a **new** CounselingSession where certified | **PRESERVE** |
| OT Returned remains IP PatientJourney projection on Waiting List | **PRESERVE** |
| Branch authorization fail-closed | **PRESERVE** |
| Permissions `counseling_sessions.read` / `.update` for this surface | **PRESERVE** |
| British spelling `Finalised` | **PRESERVE** |

Any future decision under PD-FS-* that would alter the above must state that boundary change **explicitly** and obtain separate approval. This preparation document does **not** alter them.

---

## 5. Current State Machine

Repository-derived FSM (`OtFinalizeStatus` on `ot_finalize_schedule`):

```text
NotConfirmed
    ↓ Confirm
Confirmed
    ↓ Finalise
Finalised
    ↓ Prepare
OTPrepared
    ↓ IP SurgeryCompleted (internal sync)
SurgeryDone   ← sealed / view-only
```

Additional transitions:

```text
Any eligible active path (service Cancel; UI capability differs by state)
    ↓ Cancel
Cancelled

OTPrepared
    ↓ Reopen
Confirmed

Cancelled
    ↓ Reopen
NotConfirmed
```

| Fact | Evidence |
|------|----------|
| No backend status `"Scheduled"` | `OtFinalizeStatus` constants |
| UI/KPI “Scheduled” | Client count of loaded list rows |
| Edit on Confirmed/Finalised via UpdateDetails | Reverts to `NotConfirmed` |
| Prepare eligibility | `Finalised` only |
| Load OT List | `OTPrepared` for date only |

**State-machine change rule for this document:**  
If a proposed option would change transitions, eligibility, or terminal sealing, classify it as:

**SEPARATE STATE-MACHINE DECISION REQUIRED**

and do **not** treat it as implementation-authorized by this preparation document.

---

## 6. Current Ownership Boundary

| Surface | Ownership model |
|---------|-----------------|
| Finalize Surgery | Shared queue; branch-scoped; mutate by permission — **not** CounselorId |
| OT Preparation | Shared; mutates schedule rows to OTPrepared — **not** personal worklist |
| CounselingSession | CounselorId SoT for active counselling work |
| Waiting List | Shared operational queue |
| OT Returned | IP journey projection; Waiting List host; **not** Finalize status |

**PD-FS-13** (operational persona wording) must **not** create CounselorId, OTPreparationOwnerId, Supervisor, Assign, My OT Preparation, or My Work queues.

---

## 7. Audit Finding Summary

| ID | Summary | Primary class | PD required? |
|----|---------|---------------|--------------|
| FS-G-01 | Cancel back-sync calls missing `cancel-ot` route; cancel still succeeds | Backend / honesty | Separate from PD-FS-04 reason/UX; back-sync policy may need future decision |
| FS-G-02 | `cancel_reason` exists; Cancel API/UI do not collect/persist | Functional + PD | **PD-FS-04** (reason dimension) |
| FS-G-03 | Slot label honesty — ChecklistSummary overwritten vs Slot UI labels | Functional honesty | **PD-FS-10** |
| FS-G-04 | Confirm validation split (modal vs queue vs BE) | Functional + PD | **PD-FS-03** |
| FS-G-05 | CanReopen list vs detail mismatch | Technical consistency | No business PD (§10) |
| FS-G-06 | Reopen retains SequenceNo / PreparedAt / PreparedBy | PD | **PD-FS-06** |
| FS-G-07 | Cancel has no confirmation dialog | UX + PD | **PD-FS-04** (confirmation dimension) |
| FS-G-08 | Scheduled / Needs Attention KPI semantics | PD | **PD-FS-01** (+ Scheduled label note) |
| FS-G-09 | Avg Wait semantics | PD | **PD-FS-02** |
| FS-G-10 | Server status filter unused; FE client filter | Technical / scale UX | No business PD (§10) |
| FS-G-11 | OT Returned not on Finalize | Presentation PD | **PD-FS-09** |
| FS-G-12 | Zero active theatres → empty list | Configuration / UX | Config first; empty-copy polish later |
| FS-G-13 | Possible unique prepared-date index vs multi-patient Prepare | Tech verification + PD | **PD-FS-12** after §8.1 |
| FS-G-14 | SQL baseline / entity drift | Documentation | No business PD (§10) |
| FS-G-15 | Orphan `FinalizeSurgeryDrawer` | Hygiene | No business PD (§10) |
| FS-G-16 | No Playwright Confirm→Finalise→Prepare→SurgeryDone | Test gap | Future test requirement (§13) |
| FS-G-17 | Residual Manual UAT open | Governance gate | Existing residual UAT plan |
| FS-G-18 | Custom dialog a11y / focus trap | UX / a11y | Future FS-UX-08; not business PD |
| FS-G-19 | Insurance/payment not hard blockers | PD | **PD-FS-08** |
| FS-G-20 | SurgeryDone sync without requiring OTPrepared | Certified / PD only if restrict | Preserve unless separate FSM PD |
| FS-G-21 | Documentation drift | Governance | Prefer this audit + this PD |
| FS-G-22 | Ownership boundary verified | Certified preserve | Locked §6 |

---

## 8. Technical Verification Dependencies

| ID | Dependency | Status | Blocks |
|----|------------|--------|--------|
| TV-01 | FS-G-13 live DB index verification | **PENDING TECHNICAL VERIFICATION** | Informed answer to **PD-FS-12**; any schema change |
| TV-02 | Environment access for production/UAT DB inspection | **ENVIRONMENT ACCESS REQUIRED** if not available from repo alone | TV-01 completion |

**Count of technical verification dependencies: 2** (TV-01 substantive; TV-02 access precondition).

### 8.1 FS-G-13 Live DB Verification

**Status:** **PENDING TECHNICAL VERIFICATION**

**Repository facts (do not assume live behavior):**

- `database_migrations/schema/OT_FINALIZE_SCHEDULE_MIGRATION.sql` declares `ux_ot_finalize_prepared_date` UNIQUE on `(DATE(start_time AT TIME ZONE 'UTC'), tenant_id)` WHERE `status = 'OTPrepared' AND deleted_at IS NULL`.
- `OtFinalizeService.PrepareOtListAsync` supports preparing **multiple** Finalised schedules for the same date.
- Index name was **not** found under AuthService EF migrations by audit search; live presence is unknown from repository alone.

**Required verification (must be executed outside this governance task):**

1. Does `ux_ot_finalize_prepared_date` exist in the target database?
2. Which environment(s) contain it (dev / UAT / production)?
3. Is it unique?
4. Exact predicate / filter?
5. Exact columns?
6. Does current production/test data contain multiple `OTPrepared` rows for the same tenant/date?
7. Has `PrepareOtListAsync` successfully prepared multiple patients on the same date in that environment?
8. Is the index legacy, intentionally retained, or deployment drift?
9. Is there a migration that created or removed it?
10. What is the deployment history?

**Allowed verification result labels (record exactly one when known):**

| Result label | Meaning |
|--------------|---------|
| **FOUND AND CONFLICTING** | Index exists and conflicts with multi-patient Prepare |
| **FOUND AND INTENTIONAL** | Index exists and business intends single OTPrepared per tenant/date |
| **FOUND BUT INACTIVE / NON-CONFLICTING** | Index exists but does not conflict with observed multi-patient data/ops |
| **NOT FOUND** | Index absent in verified environment(s) |
| **UNKNOWN / ENVIRONMENT ACCESS REQUIRED** | Cannot inspect |

**This preparation document does NOT:**

- drop / alter the index
- add migrations
- change `PrepareOtListAsync`
- change uniqueness behavior
- silently assume any result label

**PD-FS-12 recorded:** Option C — defer final uniqueness intent until verification completes. Multi-patient Prepare behavior remains unchanged in this governance task.

**If schema change is later required:**

**SEPARATE DATABASE / SCHEMA CHANGE AUTHORIZATION REQUIRED.**

---

## 9. Product Decisions

### 9.0 Product Owner Decision Recording Register (2026-09-22)

**Recording session fact:** Product Owner decisions for PD-FS-01 … PD-FS-13 were formally supplied and recorded on **2026-09-22**.

**Product Owner:** Decision recorded — name not supplied.

| PD | Status | Selected Option |
|----|--------|-----------------|
| PD-FS-01 | **DECIDED** | **A** |
| PD-FS-02 | **DECIDED** | **C** |
| PD-FS-03 | **DECIDED** | **A** |
| PD-FS-04 | **DECIDED** | **A + D** |
| PD-FS-05 | **DECIDED** | **A** |
| PD-FS-06 | **DECIDED** | **A** |
| PD-FS-07 | **DECIDED** | **A** |
| PD-FS-08 | **DECIDED** | **A** |
| PD-FS-09 | **DECIDED** | **B** |
| PD-FS-10 | **DECIDED** | **B** |
| PD-FS-11 | **DECIDED** | **A** |
| PD-FS-12 | **DECIDED — DEFERRED** | **C** |
| PD-FS-13 | **DECIDED** | **C** |

| Summary | Count |
|---------|-------|
| DECIDED | **13 / 13** |
| PENDING PRODUCT OWNER DECISION | **0** |
| PD-FS-12 TECHNICAL VERIFICATION REQUIRED — LIVE DATABASE | **YES** |

**Approval for PD-FS-01…13 business selections:** **RECORDED**  
**Implementation authorization:** **NONE** (separate gate required)

Recommended options text below is retained for history only and is **superseded** by the recorded Product Owner Decision block in each subsection.

---

### PD-FS-01 — Needs Attention

**Current implementation:**  
KPI “Needs Attention” = count of loaded list rows with status `NotConfirmed` **or** `Confirmed` (`statsBar` on Finalize page). It does **not** include Finalised, OTPrepared, Cancelled, or SurgeryDone. It does **not** encode payment, insurance, theatre, or slot completeness.

**Business question:**  
What is the operational definition of “Needs Attention” beyond `NotConfirmed + Confirmed`? Should the label remain, be renamed, or map to a different predicate?

**Known implications:**  
Ops may read the KPI as “incomplete paperwork / payment / slot” when code means “not yet Finalised.” Changing the predicate without renaming can change staffing attention incorrectly.

**Option A:** Keep meaning = `NotConfirmed + Confirmed`; rename label if needed for honesty (e.g. “Awaiting Finalise”).  
**Option B:** Redefine predicate to a Product-Owner-specified set of statuses/conditions (may require FE and/or API changes later).  
**Option C:** Remove the KPI.

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**

Preserve the current predicate: `NotConfirmed + Confirmed`.

The KPI must not silently acquire additional payment, insurance, theatre, slot, or other blockers. Presentation may use a more honest operational label if required by existing UX, but the underlying predicate remains unchanged unless a separate Product Decision explicitly changes it. Do not invent additional conditions.

**Implementation impact:** NONE in this governance task (requires separate Implementation Authorization).  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION A**

**Related note:** KPI “Scheduled” remains loaded-list count (not a backend status). Label honesty may be addressed under future UX authorization without changing this predicate decision.


### PD-FS-02 — Avg Wait

**Current implementation:**  
“Avg. Wait” = mean whole days `(scheduleDate − counsellingDate)` for rows where both dates exist and difference ≥ 0; otherwise displays `0`. Client-only over loaded list.

**Business question:**  
Should Avg. Wait remain, be redefined, or be removed?

**Known implications:**  
May frequently show `0` if counsellingDate missing. Not a queue SLA. Removing reduces noise; redefining needs a clear formula.

**Option A:** Retain current formula and label.  
**Option B:** Redefine formula/population (Product Owner specifies).  
**Option C:** Remove KPI.

### Product Owner Decision (RECORDED)

**SELECTED OPTION: C**  
**Status: DECIDED — OPTION C**

Remove the current Avg Wait KPI.

Do not replace it with a newly invented formula or SLA. Do not introduce a new operational waiting-time metric without a separate Product Decision.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION C**


### PD-FS-03 — Reporting Time

**Current implementation:**

| Path | Reporting Time required? |
|------|---------------------------|
| Modal Confirm | **Yes (FE)** — validates, saves details, then Confirm |
| Queue Confirm | **No** — calls Confirm API directly |
| Backend `ConfirmAsync` | **No** — status + optional doctor/theatre start-time conflict only |

**Business question:**  
Is Reporting Time a true business prerequisite for Confirm at backend level, or is frontend-only (modal) validation intentional?

**Known implications:**  
If YES → future work must align queue Confirm + backend validation.  
If NO → modal must not imply a hard business blocker the system does not enforce.  
Changing backend requirement is a validation/API behavior change — not authorized here.

**Option A:** YES — Reporting Time is a business prerequisite (align FE + BE later).  
**Option B:** NO — Reporting Time is advisory / modal UX only (align copy and/or remove hard FE block consistency).  
**Option C:** Required only when StartTime/Theatre/Doctor already set (compound rule) — would need precise definition.

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**

Reporting Time is a true business prerequisite for Confirm.

Future implementation must align Modal Confirm, Queue Confirm, and Backend Confirm so Confirm cannot bypass the agreed Reporting Time requirement.

**IMPORTANT:** This decision authorizes the **business rule only**. It does **NOT** authorize implementation in this task. No API or validation changes are permitted here.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION A**


### PD-FS-04 — Cancel Reason / Confirmation

Cancel must **not** be collapsed into a single undifferentiated decision. Dimensions:

| Dimension | Current fact |
|-----------|--------------|
| **A. Confirmation UX** | No confirm dialog; Cancel executes immediately from modal |
| **B. Cancellation reason** | DB column `cancel_reason` exists; Cancel API/UI do **not** collect/persist on cancel |
| **C. Backend cancellation semantics** | `CancelAsync` sets `Cancelled`, unlocks; **no** explicit status guard in service; UI `CanCancel` excludes Cancelled & SurgeryDone; modal shows Cancel on NotConfirmed / Confirmed / Finalised |
| **D. Counselling back-sync** | Best-effort HTTP to missing `cancel-ot`; cancel still succeeds (FS-G-01) |
| **E. OTPrepared cancellation** | Deferred to **PD-FS-05** (UI exposure); service already allows Cancel |

**Business question:**  
For dimensions A and B (and policy intent for D): Must Cancel require a confirmation dialog and/or a reason? Separately, should counselling back-sync be required, optional, or retired as dead code?  
**Do not silently expand or restrict Cancel eligibility** (dimension C) under this PD without labelling it **SEPARATE STATE-MACHINE DECISION REQUIRED**.

**Known implications:**  
Accidental cancel risk (A). Incomplete audit trail (B). False expectation of counselling RepeatCounselling (D).

**Option A (UX/reason package):** Require confirmation dialog **and** reason before Cancel; leave eligibility unchanged; treat back-sync as separate follow-up.  
**Option B:** Confirmation dialog only; reason optional/not required.  
**Option C:** Neither confirmation nor reason; keep current UX; decide back-sync honesty separately (document as non-blocking).  
**Option D (back-sync only):** Retire / no longer claim counselling sync until a real route exists — **does not** change Cancel eligibility.

### Product Owner Decision (RECORDED)

**SELECTED: A (cancellation UX/reason) + D (counselling back-sync)**  
**Status: DECIDED — OPTION A + OPTION D**

#### Cancellation UX

Cancel requires:

- explicit confirmation
- cancellation reason

Existing Cancel eligibility must remain unchanged. Do not silently expand or restrict which states can be cancelled.

#### Counselling back-sync

Do not claim counselling cancellation synchronization until a valid supported route/service exists. The missing `cancel-ot` destination (FS-G-01) must not be silently treated as a functioning integration. Any future counselling synchronization is a separate bounded decision/implementation item.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION A + OPTION D**


### PD-FS-05 — OTPrepared Cancel

**Current implementation:**  
Backend `CanCancel` / `CancelAsync` allow Cancel when status is not Cancelled/SurgeryDone — including **OTPrepared**. Modal for OTPrepared shows **Reopen**, not Cancel. Queue primary CTA for OTPrepared is Reopen.

**Business question:**  
Should OTPrepared expose Cancel in the UI when the backend already allows cancellation?

**Known implications:**  
Exposing Cancel expands counsellor-visible destructive path on locked prepared cases. Hiding Cancel is current UX; API remains callable. Changing service eligibility would be **SEPARATE STATE-MACHINE DECISION REQUIRED**.

**Option A:** Keep UI as-is (no Cancel on OTPrepared); Reopen is the recovery path; leave backend unchanged.  
**Option B:** Expose Cancel on OTPrepared in UI (aligned with current backend).  
**Option C:** Restrict backend Cancel on OTPrepared (**SEPARATE STATE-MACHINE DECISION REQUIRED**).

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**

Keep the current UI behavior. OTPrepared must **NOT** expose Cancel in the current UI. Reopen remains the recovery path.

Do not change backend cancellation eligibility as part of this decision. Do not introduce a new FSM transition.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION A**


### PD-FS-06 — Reopen Metadata

**Current implementation:**

| Transition | Result |
|------------|--------|
| OTPrepared → Reopen | **Confirmed** + `IsLocked = false` |
| Cancelled → Reopen | **NotConfirmed** + `IsLocked = false` |

**Retained:** `SequenceNo`, `PreparedAt`, `PreparedBy`  
**Cleared:** lock only (`IsLocked`)

**Business question:**  
When reopening OTPrepared, should SequenceNo / PreparedAt / PreparedBy be cleared, retained, or treated as historical metadata?

**Known implications:**  
Retention may confuse “still prepared” vs “reopened.” Clearing loses prepare audit on the row (audit log still has Prepare/Reopen events). Changing reopen **target status** would be **SEPARATE STATE-MACHINE DECISION REQUIRED**.

**Option A:** Intentional historical metadata retention (keep current).  
**Option B:** Clear SequenceNo / PreparedAt / PreparedBy on Reopen from OTPrepared (operational residue cleanup).  
**Option C:** Retain fields but UI labels them “previous preparation (superseded)” (presentation-only).

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**

Retain `SequenceNo`, `PreparedAt`, and `PreparedBy` when reopening OTPrepared. Treat these as historical preparation metadata. Do not silently clear the data. The existing audit log remains authoritative for transition history. Do not change the Reopen target state.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION A**


### PD-FS-07 — Finalised Editing

**Current implementation:**  
Save / UpdateDetails on `Finalised` (and `Confirmed`) **reverts status to `NotConfirmed`** and unlocks. Modal labels Save as “Save (will revert)” for Confirmed/Finalised.

**Business question:**  
When editing Finalised, should Save continue reverting to NotConfirmed, or should Finalised editing use different behavior?

**Known implications:**  
Current rule forces re-Confirm → re-Finalise after edits (revalidation). Blocking edits while Finalised changes ops flexibility. Allowing edit **without** revert would change FSM meaning of Finalised — **SEPARATE STATE-MACHINE DECISION REQUIRED**.

**Option A:** Preserve revert-to-NotConfirmed (current certified behavior).  
**Option B:** Block edits while Finalised (view-only until Reopen-equivalent path — note: Finalised has no Reopen today; would need defined path).  
**Option C:** Allow field edits without status revert (**SEPARATE STATE-MACHINE DECISION REQUIRED**).

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**

Preserve the current certified behavior. Editing/saving a Finalised record continues to revert it to `NotConfirmed`. This preserves existing revalidation semantics.

Do not create a new Finalised-edit state. Do not allow edits to bypass Confirm → Finalise.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION A**


### PD-FS-08 — Insurance / Payment / Theatre Blockers

**Current implementation:**  
Confirm, Finalise, and Prepare do **NOT** enforce insurance pending, payment pending, or theatre presence as hard blockers. Confirm may conflict-check doctor/theatre **start time** only when StartTime is set. Zero theatres → empty dropdown (config), not Confirm failure.

**Business question:**  
Are insurance / payment / theatre conditions intended to be hard blockers for Confirm, Finalise, and/or Prepare?

**Known implications:**  
Inventing financial/clinical rules here is forbidden. Adding blockers is a material business-rule + validation change. Must specify which action and which exact condition.

**Option A:** Confirm none are hard blockers — preserve current code policy; improve messaging only if needed.  
**Option B:** Theatre required for Confirm and/or Finalise and/or Prepare (specify which).  
**Option C:** Payment and/or insurance required for specified actions (Product Owner must define source-of-truth fields — not invent claim rules).

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**

Insurance, payment, and theatre presence are **NOT** new hard blockers for Confirm, Finalise, or Prepare under this Product Decision. Preserve the current policy.

Do not invent insurance, payment, claim, pre-auth, or financial SoT rules. Do not introduce new clinical or financial blockers. Existing doctor/theatre start-time conflict behavior remains unchanged.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION A**


### PD-FS-09 — OT Returned Presentation

**Current implementation:**  
OT Returned lives on **Waiting List → OT Returned** (IP `PatientJourney` projection). Finalize Surgery has **no** OT Returned chrome, filter, or status.

**Certified must-not:**  
OT Returned must not become Waiting List lifecycle status, ReQueue, new ownership, or a duplicate worklist. Do not redesign OT Returned lifecycle in this decision.

**Business question:**  
Should Finalize Surgery surface OT Returned through a link/contextual entry point, or remain separate on Waiting List?

**Known implications:**  
Presentation-only options only. Any lifecycle/status merge is out of scope / rejected by governance baseline.

**Option A:** Keep completely separate (current).  
**Option B:** Add contextual link from Finalize Surgery to existing Waiting List OT Returned surface (presentation only).  
**Option C:** Another explicitly defined **presentation-only** option (Product Owner must describe; no lifecycle change).

### Product Owner Decision (RECORDED)

**SELECTED OPTION: B**  
**Status: DECIDED — OPTION B**

Add a contextual presentation/navigation link from Finalize Surgery to the existing Waiting List → OT Returned surface. **Presentation/navigation only.**

MUST remain unchanged:

- OT Returned remains an IP PatientJourney projection
- Not a Finalize status
- Not a Waiting List lifecycle state
- Does not trigger ReQueue
- Does not establish CounselorId ownership
- Does not create a duplicate worklist

The existing Waiting List OT Returned surface remains the authoritative operational destination.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION B**


### PD-FS-10 — ChecklistSummary / Slot Meaning

**Current implementation (honesty issue FS-G-03):**

| Layer | Behavior |
|-------|----------|
| `ToResponse` default | ChecklistSummary from doctor/theatre/StartTime → Missing / Pending / AllClear |
| `GetFinalizeListAsync` (when session present) | **Overwrites** ChecklistSummary using `PatientType` non-empty + `AnesthesiaConsent` → AllClear else Pending |
| Finalize grid UI | Maps to labels **“Slot clear” / “Slot pending” / “Slot missing”** |

**Business question:**  
What should ChecklistSummary / Slot clear/pending/missing represent?

Sub-questions for Product Owner (from evidence):

1. What does ChecklistSummary originally represent?
2. Is there a real slot-completeness predicate already available?
3. Is StartTime sufficient?
4. Is Theatre sufficient?
5. Is Surgeon sufficient?
6. Is ReportingTime sufficient?
7. Is AnesthesiaConsent part of slot readiness?
8. Is PatientType relevant to “slot”?
9. Does any existing UI/documentation define these terms? (Audit: UI invents Slot* labels over ChecklistSummary.)

**Known implications:**  
Ops may trust a false “slot ready” signal. Fixing without deciding meaning risks another mismatch.

**Option A:** Rename UI label to match actual underlying data (consent/patient-type readiness — not “Slot”).  
**Option B:** Restore/derive a truthful **slot-completeness** predicate (surgeon/theatre/time — Product Owner confirms fields) and label accordingly.  
**Option C:** Remove the indicator from the grid.

### Product Owner Decision (RECORDED)

**SELECTED OPTION: B**  
**Status: DECIDED — OPTION B**

Restore/derive a truthful **slot-completeness** representation. The UI concept should represent actual slot readiness rather than relabeling PatientType + AnesthesiaConsent as Slot clear / pending / missing.

**SPECIAL HANDLING:** The Product Owner selected truthful slot-completeness semantics. The **exact predicate is NOT defined** by this decision recording.

Therefore:

- no new predicate may be invented here;
- implementation must inspect existing authoritative fields/services;
- if existing data does not support a truthful slot-completeness predicate, that gap must return to Product Decision review before implementation.

Candidate dimensions from the audit (not auto-approved as the final predicate): Surgeon, Theatre, Start Time, Reporting Time.

AnesthesiaConsent and PatientType must not automatically be treated as slot readiness merely because they are currently used by response mapping.

This is a business decision about intended meaning. It does **NOT** authorize implementation of a new clinical/operational rule in this task.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION B**


### PD-FS-11 — OT Preparation List Model

**Current implementation:**  
No separate OT list entity. Prepare mutates `ot_finalize_schedule` rows Finalised → OTPrepared with `SequenceNo`, lock, PreparedAt/By. Load OT List reads OTPrepared for date. UI presents as a date-scoped prepared list.

**Business question:**  
Is OT Preparation conceptually one logical operational list per branch/date, even though persistence is row-based? Any sequencing/ownership rules beyond SequenceNo?

**Known implications:**  
Conceptual “one list” informs UX copy and empty states. Must not invent list-owner entity or My OT Preparation. Uniqueness constraints interact with **PD-FS-12** / FS-G-13.

**Option A:** Yes — one logical ops list per branch/date; persistence remains row-based; SequenceNo orders the list.  
**Option B:** No — treat as independent prepared cases only; list UI is a convenience view.  
**Option C:** One list per theatre/date (would need grouping rules — may exceed current data model).

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**

Treat OT Preparation as one logical operational list per branch/date. Persistence remains row-based. `SequenceNo` represents operational ordering within the prepared list.

Do **NOT** introduce: OTPreparationOwnerId, CounselorId, Supervisor, Assign/Reassign, My OT Preparation, My Work queue.

Do not introduce a separate OT list entity unless separately approved. The logical list concept is for operational semantics and UX clarity.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION A**


### PD-FS-12 — Prepared-Date Uniqueness

**Current implementation:**  
SQL baseline unique index `ux_ot_finalize_prepared_date` (one OTPrepared per tenant/date) **vs** multi-patient Prepare in service. Live presence **unknown** (§8.1).

**Business question:**  
If the unique index exists in a live database, is the single-OTPrepared-per-day constraint intentional?

**Known implications:**  
If intentional → Prepare multi-patient is wrong/conflict with policy (**SEPARATE STATE-MACHINE / SCHEMA DECISION**).  
If not intentional / NOT FOUND → preserve multi-patient Prepare; schema cleanup needs **SEPARATE DATABASE / SCHEMA CHANGE AUTHORIZATION**.  
Do not decide by assumption before §8.1 result.

**Option A:** Constraint intentional — only one OTPrepared row per tenant/date (would redefine Prepare model).  
**Option B:** Constraint not intentional — multi-patient Prepare is correct; index is drift/legacy if present.  
**Option C:** Defer business decision until §8.1 result is recorded as one of the five verification labels.

### Product Owner Decision (RECORDED)

**SELECTED OPTION: C**  
**Status: DECIDED — OPTION C — DEFERRED PENDING TECHNICAL VERIFICATION**

Defer the final business/schema decision until FS-G-13 live database verification is completed.

Do **NOT** assume the SQL index exists or is absent in the live environment. Do **NOT** decide that single-patient or multi-patient OTPrepared behavior is incorrect until verification is complete.

Current service behavior supporting multiple patients prepared for the same date must remain unchanged during this governance task.

**Technical verification status:** **PENDING TECHNICAL VERIFICATION — LIVE DATABASE** (`ux_ot_finalize_prepared_date`)

If/when verification identifies a conflict, a separate database/schema/state-machine Product Decision and implementation authorization are required. **No schema change is authorized.**

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION C — DEFERRED PENDING TECHNICAL VERIFICATION**


### PD-FS-13 — OT Preparation Operational Context

**Current implementation:**  
OT Preparation workspace is on Finalize Surgery, gated by `counseling_sessions.read` / `.update`. No separate OT-prep owner field.

**Business question:**  
Who is the operational owner/persona of OT Preparation day-of, **for UX wording/context only**, without changing permissions or ownership?

**Known implications:**  
Wording may say “Counsellor prepares OT list” vs “OT desk consumes prepared list.” Must **not** create CounselorId, OTPreparationOwnerId, Supervisor, Assign, My OT Preparation, or My Work queues.

**Option A:** Counsellor desk persona (wording aligns with current route/permissions).  
**Option B:** OT / theatre desk persona (wording/context only; permissions unchanged).  
**Option C:** Shared counsellor + OT collaboration wording (no ownership entity).

### Product Owner Decision (RECORDED)

**SELECTED OPTION: C**  
**Status: DECIDED — OPTION C**

Use shared counsellor + OT collaboration wording/context. Terminology/context only.

Must **NOT** create or imply: CounselorId ownership, OTPreparationOwnerId, Supervisor role, Assign, Reassign, My OT Preparation, My Work.

Finalize Surgery and OT Preparation remain shared operational surfaces. Permissions remain unchanged.

**Implementation impact:** NONE in this governance task.  
**Product Owner:** Decision recorded — name not supplied  
**Date:** 2026-09-22  
**Approval:** **DECIDED — OPTION C**


## 10. Non-Product Technical Findings

These are **not** business-policy Product Decisions. They may be addressed later only under explicit implementation authorization.

| Finding | Nature | Future handling (not authorized) |
|---------|--------|----------------------------------|
| FS-G-05 CanReopen list/detail mismatch | Implementation consistency | Align capability flags |
| FS-G-10 Server status filter unused | Scalability / UX implementation | Optional server-side status param |
| FS-G-12 Zero theatres | Configuration / empty-state copy | Configure OT masters; improve messaging |
| FS-G-14 SQL baseline drift | Documentation / schema sync evidence | Doc sync; no silent migrate |
| FS-G-15 Orphan FinalizeSurgeryDrawer | Code hygiene | Do not delete without approval |
| FS-G-16 Playwright FSM gap | Testing gap | Future test slice / acceptance requirement |
| FS-G-17 Residual Manual UAT | Governance gate | Existing residual Counsellor UAT plan |
| FS-G-18 Custom dialog a11y | Accessibility debt | Proposed FS-UX-08 |
| FS-G-01 cancel-ot destination | Backend honesty / dead outbound | Honesty preserve; implement only if PD requires sync |
| FS-G-20 SurgeryDone without OTPrepared | Current sync behavior | Preserve unless separate FSM PD |
| FS-G-21 Doc drift | Governance | Prefer this audit + this PD |
| FS-G-22 Ownership verified | Certified | Preserve |

---

## 11. Proposed Future Implementation Slices

**Product decisions are approved/recorded, but implementation requires a separate bounded Implementation Authorization.**

Do **NOT** automatically map each Product Decision to a slice. Do **NOT** automatically implement: FS-G-13 schema changes, new slot business logic invention, reporting-time backend changes, cancellation sync, new ownership, new worklists, or state-machine changes without corresponding bounded implementation authorization.


**All labelled: PROPOSED — NOT AUTHORIZED.**

Do not convert to tickets. Do not assign dates. Do not create Phase 3J. Do not create Slice 14. Do not begin FS-UX-01.

| Slice | Objective |
|-------|-----------|
| FS-UX-01 | Grid / IA honesty |
| FS-UX-02 | State-aware detail |
| FS-UX-03 | Mutation UX |
| FS-UX-04 | OT Returned link presentation |
| FS-UX-05 | OT Preparation workspace polish |
| FS-UX-06 | Prepare/state reconciliation UX |
| FS-UX-07 | Filter/pagination |
| FS-UX-08 | Accessibility/responsive |
| FS-UX-09 | E2E regression |

Implementation may proceed **only after**:

1. Product Owner decisions recorded for relevant PD-FS-*  
2. Explicit **Implementation Authorization** recorded  
3. FS-G-13 verification completed where schema-sensitive  

---

## 12. Regression Protection

Must remain unchanged by any future Finalize/OT Prep work unless a separate explicit decision authorizes otherwise:

- CounselorId / CreatedByUserId semantics  
- Assign / Reassign / ReQueue  
- Sessions Reassignment Required  
- Waiting List lifecycle  
- Follow-up Center  
- Analytics My Work  
- PatientJourney OT Returned projection semantics  
- CounselingSession lifecycle  
- SurgeryDone sealing / second-eye new session  
- Branch authorization fail-closed  
- Existing permissions model for this surface  
- Core OtFinalizeStatus transitions (unless separate FSM decision)  
- Financial / insurance / clinical SoT outside approved blockers  
- No My Finalize / My OT Preparation  

---

## 13. UAT Requirements

| Item | Status |
|------|--------|
| UAT of decisions in this document | **NOT EXECUTED** |
| This document marks PASS / ACCEPTED / CLOSED for new Finalize/OT Prep behavior | **NO — must not** |
| Residual Counsellor UAT (null-branch, row-open, etc.) | Remains under `docs/audits/counsellor-residual-acceptance-manual-uat-plan.md` |
| Future UAT after implementation | Must cover approved PD outcomes + FSM scenarios FS-01…FS-28 from audit as applicable |

Future UAT checklist themes (NOT EXECUTED): Confirm/Finalise/Prepare/Reopen/Cancel; Load OT List; zero theatre; cross-branch; SurgeryDone seal; Slot/KPI honesty after PD-FS-01/02/10.

---

## 14. Acceptance Requirements

Acceptance of any future Finalize / OT Preparation change requires **all** of:

1. Relevant PD-FS-* decisions recorded by Product Owner  
2. Explicit implementation authorization  
3. Implementation complete within authorized scope  
4. Automated tests for authorized scope  
5. Manual UAT executed and recorded  
6. Explicit acceptance record  

This document records Product Owner decisions (step 1 partially). It satisfies **none** of steps 2–6 (implementation authorization through acceptance).

**Future test / acceptance requirement (not implemented here):**  
Playwright (or equivalent) covering Confirm → Finalise → Prepare → SurgeryDone.

---

## 15. Implementation Authorization

```text
IMPLEMENTATION AUTHORIZATION: NONE
```

**Product decisions are approved/recorded, but implementation requires a separate bounded Implementation Authorization.**

| Field | Value |
|-------|--------|
| **Current implementation authorization** | **NONE** |
| Explicit Product Owner implementation grant | **NOT PROVIDED** |
| PD-FS-01…13 business decisions | **RECORDED** — do **not** treat as implementation authorization |
| FS-UX-01…09 | **PROPOSED — NOT AUTHORIZED** |
| Schema / index / Prepare uniqueness change | **NOT AUTHORIZED**; needs FS-G-13 + separate DB authorization if change needed |
| Reporting Time backend alignment (PD-FS-03) | **Business rule decided; implementation NOT authorized** |
| Cancel confirm/reason (PD-FS-04) | **Business rule decided; implementation NOT authorized** |
| Slot completeness UI (PD-FS-10) | **Meaning decided; exact predicate NOT invented; implementation NOT authorized** |
| OT Returned link (PD-FS-09) | **Presentation decision recorded; implementation NOT authorized** |
| Bounded scope authorized | **N/A — no authorization granted** |

**NO IMPLEMENTATION AUTHORIZED.**

Do not create implementation tickets. Do not modify production code. Do not begin FS-UX-01.

---

## 16. Governance Next Gate

```text
NEXT GATE:
SEPARATE BOUNDED IMPLEMENTATION AUTHORIZATION

(must explicitly define included findings, UX/API changes, exclusions, tests, UAT, acceptance)

PD-FS-12 / FS-G-13:
  remain PENDING TECHNICAL VERIFICATION — LIVE DATABASE
  (schema/FSM change requires separate decision + authorization if conflict found)
```

Do not skip to coding, Slice 14, Phase 3J, or FS-UX-01 from this document alone.

---

## 17. Product Owner Decision Section

**Product Owner decision session date:** 2026-09-22  
**Product Owner:** Decision recorded — name not supplied

| PD | Status | Selected Option | Date | Product Owner | Notes |
|----|--------|-----------------|------|---------------|-------|
| PD-FS-01 | **DECIDED** | **A** | 2026-09-22 | Decision recorded — name not supplied | Predicate NotConfirmed+Confirmed |
| PD-FS-02 | **DECIDED** | **C** | 2026-09-22 | Decision recorded — name not supplied | Remove Avg Wait KPI |
| PD-FS-03 | **DECIDED** | **A** | 2026-09-22 | Decision recorded — name not supplied | Reporting Time required for Confirm (rule only) |
| PD-FS-04 | **DECIDED** | **A + D** | 2026-09-22 | Decision recorded — name not supplied | Confirm+reason; no false cancel-ot claim |
| PD-FS-05 | **DECIDED** | **A** | 2026-09-22 | Decision recorded — name not supplied | No Cancel CTA on OTPrepared UI |
| PD-FS-06 | **DECIDED** | **A** | 2026-09-22 | Decision recorded — name not supplied | Retain prep metadata |
| PD-FS-07 | **DECIDED** | **A** | 2026-09-22 | Decision recorded — name not supplied | Finalised save → NotConfirmed |
| PD-FS-08 | **DECIDED** | **A** | 2026-09-22 | Decision recorded — name not supplied | No new insurance/payment/theatre blockers |
| PD-FS-09 | **DECIDED** | **B** | 2026-09-22 | Decision recorded — name not supplied | Contextual link to WL OT Returned only |
| PD-FS-10 | **DECIDED** | **B** | 2026-09-22 | Decision recorded — name not supplied | Truthful slot meaning; predicate not invented |
| PD-FS-11 | **DECIDED** | **A** | 2026-09-22 | Decision recorded — name not supplied | Logical list per branch/date; no ownership |
| PD-FS-12 | **DECIDED — DEFERRED** | **C** | 2026-09-22 | Decision recorded — name not supplied | Defer until FS-G-13 live DB verification |
| PD-FS-13 | **DECIDED** | **C** | 2026-09-22 | Decision recorded — name not supplied | Shared counsellor+OT wording only |

**Overall Product Decision package:** **APPROVED / RECORDED — 13 DECIDED**

**DECIDED count:** 13  
**PENDING PRODUCT OWNER DECISION count:** 0  
**TECHNICAL VERIFICATION REQUIRED:** PD-FS-12 / FS-G-13 — **PENDING LIVE DATABASE**  
**Implementation authorization:** **NONE**

---

## 18. Sign-Off

| Role | Name | Date | Result |
|------|------|------|--------|
| Prepared by | Cursor governance preparation | 2026-09-22 | Artifact created |
| Product Owner decision session | Decision recorded — name not supplied | 2026-09-22 | **13 / 13 DECIDED** (PD-FS-12 deferred pending FS-G-13) |
| Implementation authorization | — | — | **NONE** |

---

## Control Flags

```text
Product Decision Status:
APPROVED / RECORDED — 13 DECIDED

Implementation Authorized:
NO

Implementation Authorization:
NONE

Production Code Changed:
NO

API Changed:
NO

DB Changed:
NO

Permissions Changed:
NO

Routes Changed:
NO

State Machine Changed:
NO

Ownership Changed:
NO

OT Returned Lifecycle Changed:
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

FS-G-13 Verified:
NO — PENDING LIVE DB VERIFICATION

Next Gate:
SEPARATE BOUNDED IMPLEMENTATION AUTHORIZATION
```

---

*End of formal Product Owner decision recording. Product decisions are approved/recorded. Implementation authorization remains NONE. No production implementation was performed.*
