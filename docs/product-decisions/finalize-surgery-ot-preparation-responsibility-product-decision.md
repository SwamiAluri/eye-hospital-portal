# Finalize Surgery + OT Preparation
# Product Owner Decision — Responsibility Remediation
# Standalone OT Preparation vs Surgery Finalization → OT Prepared

| Field | Value |
|-------|--------|
| **Document type** | **PRODUCT OWNER DECISION RECORDING — GOVERNANCE ONLY** |
| **Decision family** | **PD-OTPREP-RESP-01 … PD-OTPREP-RESP-10** |
| **Date prepared** | 2026-09-23 |
| **Date Product Owner decisions recorded** | 2026-09-23 |
| **Program** | Hospital Portal — Finalize Surgery / OT Preparation |
| **Mode** | Formal Product Owner decision recording (post responsibility-remediation audit) |
| **Product Decision Status** | **RECORDED — 10 DECIDED** |
| **Implementation Authorized** | **NO** — this document alone authorizes **nothing** |
| **Production code / API / DB / permissions / routes / FSM / ownership modified** | **NO** |

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/product-decisions/finalize-surgery-ot-preparation-responsibility-product-decision.md` |
| Artifact disposition | **UPDATED** — Product Owner selections recorded 2026-09-23 (prior draft held DECISION REQUIRED) |
| Trigger audit | `docs/audits/finalize-surgery-ot-preparation-responsibility-audit.md` |
| Authorizes | **Nothing** |
| Does not authorize | Responsibility UX coding, removal of OTPrepared grid, new APIs, Package B/C, FSM/ownership/SequenceNo changes |
| Product Owner | **Not supplied in repository context** (consistent with prior Finalize/OT Prep PD recordings: “Decision recorded — name not supplied”) |

### Distinction legend

| Label | Meaning |
|-------|---------|
| **FACT** | Verified from audit / repository / prior PD |
| **PRODUCT OWNER DECISION** | Explicit selection recorded in this document |
| **SUPERSEDED / NARROWED** | Prior presentation scope limited by this recording |
| **IMPLEMENTATION AUTHORIZATION** | Separate gate — **NONE created by this task** |

### Recording integrity

| Rule | Application |
|------|-------------|
| This document records Product Owner decisions | **YES — RECORDED 2026-09-23** |
| This document implements remediation | **NO** |
| This document creates Implementation Authorization | **NO** |
| Infer acceptance / UAT PASS / Package A acceptance from this recording | **FORBIDDEN** |

---

## 2. Decision summary

**PRODUCT OWNER DECISION (RECORDED 2026-09-23):**

OT Preparation is now conceptually defined as the **preparation workspace** for Finalised surgeries for a selected ScheduleDate.

Surgery Finalization → OT Prepared becomes the **authoritative operational review surface** for already-prepared surgeries.

The standalone OT Preparation workspace will **no longer render a duplicate full OTPrepared operational grid** after a future authorized implementation.

Prepare New List continues to prepare **all remaining eligible Finalised** surgeries for the selected ScheduleDate.

Actual ScheduleDate catalog remains unchanged.

FSM, SequenceNo, ownership, permissions, and backend lifecycle remain unchanged.

---

## 3. Governance baseline (preserved)

| Area | Status |
|------|--------|
| Phase 3I | **CLOSED** — do not reopen |
| Slice 14 | **DOES NOT EXIST** — do not create |
| Phase 3J | **NOT CREATED** — do not create |
| Package 1 | **IMPLEMENTED** (Acceptance not recorded by this work) |
| PD-OTPREP-01…05 | **IMPLEMENTED** (discoverability) |
| PD-OTPREP-UAT-01…15 | **RECORDED** |
| Package A | **Historical implementation + test record** — presentation scopes for standalone OT Prep prepared grid **superseded/narrowed** by this PD (see §8); **Package A Acceptance NOT recorded by this task** |
| Package B Print | **OUT OF SCOPE — NOT AUTHORIZED** |
| Package C PD-OTPREP-10 | **OUT OF SCOPE — NOT AUTHORIZED** |
| This RESP Product Decision | **RECORDED — 10 DECIDED** |
| RESP Implementation Authorization | **YES** — `finalize-surgery-ot-preparation-responsibility-implementation-authorization.md` (separate artifact; coding not started by PD or IA recording tasks) |

---

## 4. Authoritative sources

| Artifact | Role |
|----------|------|
| `docs/audits/finalize-surgery-ot-preparation-responsibility-audit.md` | AUDIT-01…10 evidence |
| `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` | **PD-FS-11** (presentation portion superseded/narrowed — see §8) |
| `docs/product-decisions/finalize-surgery-ot-preparation-uat-remediation-product-decision.md` | **PD-OTPREP-UAT-03/05** presentation scopes superseded/narrowed — see §8 |
| `docs/product-decisions/finalize-surgery-ot-preparation-uat-remediation-package-a-implementation-authorization.md` | Package A prepared-grid ACs superseded/narrowed — see §8–§9 |
| `docs/product-decisions/finalize-surgery-ot-preparation-operational-model-product-decision.md` | PD-OTPREP-01…10 (unchanged except where presentation reconciliation applies) |
| FE/BE implementation cited in audit | Implementation FACT for RESP-05 certification |

---

## 5. Prior certified baseline (historical FACT)

**FACT — certified before this RESP recording:**

```text
OT Preparation = date-scoped prepared OT list surface
  - Auto-loads OTPrepared (PD-OTPREP-UAT-03 / Package A)
  - Shows Prepared OT List grid (PD-OTPREP-UAT-05 / Package A)
  - Ready / Prepared / None (PD-OTPREP-UAT-04)
  - Logical list model (PD-FS-11 Option A)
```

**FACT — also existed:**

```text
Surgery Finalization → OT Prepared tab
  = status-filtered share of finalize queue
  + Reopen + Print (OT slip) + UHID/name/date search
  ≠ previously certified as sole authoritative prepared worklist
```

**PRODUCT OWNER DECISION:** The responsibility redesign below is a **product change**. Affected **presentation/responsibility** scopes for standalone OT Preparation are **explicitly superseded/narrowed** in §8. Backend lifecycle and Finalization capabilities remain certified.

---

## 6. Decision register

| Decision ID | Topic | Selected | Status | Implementation Authorized? |
|-------------|-------|----------|--------|----------------------------|
| **PD-OTPREP-RESP-01** | Operational responsibility of standalone OT Preparation | **B** | **DECIDED** | **NO** |
| **PD-OTPREP-RESP-02** | Authoritative prepared worklist | **B** | **DECIDED** | **NO** |
| **PD-OTPREP-RESP-03** | Remove duplicate OTPrepared grid from OT Preparation | **B** | **DECIDED** | **NO** |
| **PD-OTPREP-RESP-04** | Ready for OT Preparation predicate | **A** | **DECIDED** | **NO** |
| **PD-OTPREP-RESP-05** | Prepare New List semantics | **A** | **DECIDED** | **NO** |
| **PD-OTPREP-RESP-06** | State after successful preparation | **B** | **DECIDED** | **NO** |
| **PD-OTPREP-RESP-07** | View OT Prepared navigation | **B** | **DECIDED** | **NO** |
| **PD-OTPREP-RESP-08** | Top-level OT Preparation metrics | **B** | **DECIDED** | **NO** |
| **PD-OTPREP-RESP-09** | Actual ScheduleDate catalog | **A** | **DECIDED** | **NO** |
| **PD-OTPREP-RESP-10** | No eligible surgery state | **A** | **DECIDED** | **NO** |

**Product Owner:** Not supplied in repository context  
**Decision date:** 2026-09-23

---

## 7. Decision items (RECORDED)

### PD-OTPREP-RESP-01 — Operational responsibility of standalone OT Preparation

| Option | Meaning |
|--------|---------|
| A | OT Preparation remains date-scoped prepared list + prepare workspace |
| **B** | OT Preparation becomes **preparation-only** workspace |
| C | Other |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: B**  
**Status: DECIDED — OPTION B**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

OT Preparation is primarily used to identify and prepare Finalised surgeries for OT for a selected ScheduleDate.

It is **no longer** treated as the primary operational prepared-list review surface.

Must not introduce a new FSM state. “Ready” remains a presentation condition only.

---

### PD-OTPREP-RESP-02 — Authoritative prepared worklist

| Option | Meaning |
|--------|---------|
| A | OT Preparation Prepared OT List remains authoritative prepared surface |
| **B** | Surgery Finalization → OT Prepared becomes authoritative prepared operational worklist |
| C | Dual surfaces with distinct jobs |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: B**  
**Status: DECIDED — OPTION B**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

Once a surgery is OTPrepared, the primary operational review, search, filtering, Reopen, and Print experience is the existing **Surgery Finalization → OT Prepared** surface.

Reuse the existing route and existing worklist. **Do not** create a new prepared-worklist entity or route.

**Preserve (non-negotiable):**

- OT Prepared filter  
- UHID search  
- Patient Name search  
- Date filtering  
- Reopen  
- Print  
- Pagination  
- Existing status behavior  

---

### PD-OTPREP-RESP-03 — Remove duplicate OTPrepared grid from standalone OT Preparation

| Option | Meaning |
|--------|---------|
| A | Retain Prepared OT List grid on OT Preparation |
| **B** | Remove duplicate OTPrepared operational grid from standalone OT Preparation |
| C | Read-only summary only |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: B**  
**Status: DECIDED — OPTION B**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

After successful preparation, OT Preparation must **not** render a second full operational Prepared OT List.

Instead it will use the approved completion state defined by **RESP-06**.

This decision **explicitly supersedes/narrows** (presentation only — see §8):

- PD-OTPREP-UAT-05 presentation scope  
- Package A prepared-grid presentation scope  
- Package A ACs that require the full Prepared OT grid on standalone OT Preparation  

**THIS IS A PRODUCT DECISION ONLY — no code is changed by this recording.**

---

### PD-OTPREP-RESP-04 — Ready for OT Preparation

| Option | Meaning |
|--------|---------|
| **A** | Adopt existing certified presentation predicate |
| B | Different predicate (forbidden without certified source) |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

Ready means:

```text
status === 'Finalised'
AND scheduleDate / StartTime calendar day === selected ScheduleDate
```

Presentation logic only. **Not** a new FSM state.

Do **not** add payment, insurance, theatre, ownership, slot-completeness, or clinical blockers unless another existing certified Product Decision explicitly establishes them.

---

### PD-OTPREP-RESP-05 — Prepare New List semantics

| Option | Meaning |
|--------|---------|
| **A** | Prepare **all** remaining eligible Finalised for selected ScheduleDate; no subset UI |
| B | Operator selected subset |
| C | Other certified model |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

Prepare New List prepares **ALL remaining eligible Finalised** surgeries for the selected ScheduleDate.

There is **no** operator subset-selection workflow.

Do **not** add checkboxes, row selection, deselect controls, or partial preparation workflow unless a future Product Decision explicitly authorizes such a change.

**Rationale (FACT):** Existing implementation already scopes Finalised to selected ScheduleDate, submits all eligible Finalised rows, and backend validates/transitions submitted eligible records to OTPrepared. This decision **formally certifies** that existing behavior rather than introducing a new selection model.

**IMPORTANT:** **PD-OTPREP-06** SequenceNo continuation / late-add remains separately governed and is **NOT** closed by this decision.

---

### PD-OTPREP-RESP-06 — OT Preparation state after successful preparation

| Option | Meaning |
|--------|---------|
| A | Reload GetOtList; show full Prepared OT List |
| **B** | Completion summary only (no full OTPrepared operational table on OT Prep) |
| C | Auto-navigate to Finalization → OT Prepared |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: B**  
**Status: DECIDED — OPTION B**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

Show a completion summary rather than rendering the full OTPrepared operational table on OT Preparation.

Conceptual presentation:

```text
OT list prepared
N surgeries prepared
```

Exact final wording may be refined during a future authorized implementation; must remain concise and operational.

Do not invent a new lifecycle status. Do not claim the user is “done with surgery.” Backend state remains **OTPrepared**.

---

### PD-OTPREP-RESP-07 — View OT Prepared navigation

| Option | Meaning |
|--------|---------|
| A | Not required |
| **B** | Provide View OT Prepared path to existing Finalization → OT Prepared worklist |
| C | Deep-link / filter params only |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: B**  
**Status: DECIDED — OPTION B**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

Provide a **View OT Prepared** path to the existing Surgery Finalization → OT Prepared operational worklist.

Requirements:

- Reuse existing route  
- Reuse existing worklist  
- Do not create a new prepared-worklist page  
- Do not duplicate OTPrepared data  
- Prefer existing navigation/query/filter mechanisms  

**No automatic navigation** is authorized unless separately stated. The user retains control of navigation.

---

### PD-OTPREP-RESP-08 — Top-level OT Preparation metrics

| Option | Meaning |
|--------|---------|
| A | Retain Surgery Dates / Ready / Prepared metric strip |
| **B** | Replace with preparation-oriented metrics |
| C | Minimal / no metric strip |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: B**  
**Status: DECIDED — OPTION B**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

Replace the existing Surgery Dates / Ready / Prepared metric strip with **preparation-oriented** metrics based only on existing authoritative data and predicates.

Metrics must communicate preparation work, not duplicate the prepared operational worklist.

Candidate conceptual metrics (not exact field definitions):

- Finalised / Ready for OT Preparation  
- Dates requiring preparation  

**IMPORTANT:** Do **not** invent exact metric definitions if implementation evidence does not establish them. A future Implementation Authorization must define bounded metric fields using existing data only.

**No backend metric API** is authorized by this Product Decision. If existing data cannot safely support a proposed metric, omit it rather than inventing a business rule.

---

### PD-OTPREP-RESP-09 — Surgery date catalog

| Option | Meaning |
|--------|---------|
| **A** | Retain existing certified actual ScheduleDate catalog |
| B | Change catalog rules |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

Retain the existing certified actual ScheduleDate catalog:

- Only actual ScheduleDate values  
- Derived from existing authoritative surgery data  
- Relative labels may decorate real dates  
- Today only when Today is an actual surgery date  
- Tomorrow only when Tomorrow is an actual surgery date  
- Otherwise weekday + date  

**NEVER generate:** Next 2 days · This week · Next week · 7/30/90-day horizons.

**StartTime → ScheduleDate** remains authoritative.

---

### PD-OTPREP-RESP-10 — No eligible surgery state

| Option | Meaning |
|--------|---------|
| **A** | Retain existing None presentation family |
| B | Wording-only refinement |
| C | Different empty semantics |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

If the selected actual ScheduleDate has no eligible Finalised surgeries, show the existing concise no-eligible-surgeries / None presentation family.

Do not create a new FSM state. Do not introduce a new lifecycle status.

---

## 8. Explicit supersession / reconciliation (presentation only)

Because **RESP-01 / 02 / 03 / 06 / 07** change the responsibility model, the following previously certified **presentation** scopes are **superseded/narrowed** for the **standalone OT Preparation workspace**:

| Prior scope | Effect of this Product Decision |
|-------------|----------------------------------|
| **PD-FS-11** presentation portion defining OT Preparation as the date-scoped **prepared-list presentation** surface | **SUPERSEDED / NARROWED** — OT Prep is preparation workspace; prepared operational review lives on Finalization → OT Prepared |
| **PD-OTPREP-UAT-03** requirement that date selection auto-loads **and renders** the existing OTPrepared grid in standalone OT Preparation | **SUPERSEDED / NARROWED** for standalone OT Prep presentation of the full prepared grid |
| **PD-OTPREP-UAT-05** requirement for the full Prepared OT List operational grid on standalone OT Preparation | **SUPERSEDED / NARROWED** |
| **Package A** prepared-grid presentation acceptance criteria requiring standalone OT Prep to render the complete OTPrepared operational grid | **SUPERSEDED / NARROWED** — future IA must list exact ACs revised |

### What this supersession does **NOT** change

This supersession applies **ONLY** to presentation/responsibility of the standalone OT Preparation workspace.

It does **NOT** supersede:

- OTPrepared backend state  
- Prepare mutation  
- SequenceNo  
- PreparedAt / PreparedBy  
- Audit behavior  
- FSM  
- Reopen behavior  
- Finalization operational capabilities  
- Ownership model  
- Permissions  
- APIs (unless a future IA explicitly changes them)  

---

## 9. Package A reconciliation

Package A was previously implemented under a different Product Decision scope.

This Product Decision does **NOT** erase the historical Package A implementation or test record.

| Item | Status |
|------|--------|
| Package A historical implementation | **RETAINED as historical record** |
| Package A historical tests | **RETAINED as historical record** |
| Standalone OT Prep prepared-grid presentation ACs | **Superseded/narrowed** by RESP-03 / §8 — future IA must define exact AC revisions |
| Package A Acceptance | **NOT recorded by this task** |
| Prior Manual UAT | **NOT retroactively marked PASS** |

A future Implementation Authorization must define exactly which Package A code/acceptance criteria are being revised.

---

## 10. What remains certified (non-negotiable)

### FSM (unchanged)

```text
NotConfirmed → Confirmed → Finalised → OTPrepared → SurgeryDone
Any state → Cancelled
OTPrepared → Confirmed through Reopen
```

### Preserve

| Area | Rule |
|------|------|
| SequenceNo | Generation, ordering, persistence, uniqueness, reassignment, numbering after Reopen — unchanged |
| PreparedAt / PreparedBy | Unchanged |
| OTPrepared persistence | Unchanged |
| Prepare audit | Unchanged |
| Reopen | Unchanged; remains on Finalization → OT Prepared |
| Finalization OT Prepared | Filter, search, Print, pagination, status — protect |
| API contracts | Prefer existing; unchanged by this PD |
| Permissions | Unchanged |
| Ownership | No CounselorId / Assign / Reassign / Requeue / My Work / Phase 3I reopen |
| Program | No Slice 14 / Phase 3J |

---

## 11. Package B / Package C

| Package | Status |
|---------|--------|
| **Package B Print** | **NOT AUTHORIZED** by this decision |
| **Package C / PD-OTPREP-10** | **NOT AUTHORIZED** by this decision |

Do not modify (via this PD): print implementation, print CSS, `window.print()`, GuardLocked, OTPrepared date editing, direct StartTime modification while OTPrepared, Reopen semantics.

---

## 12. Case matrix (DECIDED model — not yet authorized for coding)

| Case | Condition | UX after future authorized implementation |
|------|-----------|-------------------------------------------|
| A | Eligible Finalised exist; no remaining prepare work for date | Ready for OT Preparation queue (RESP-04) |
| B | Prepare succeeds | Completion summary (RESP-06) + View OT Prepared available (RESP-07) |
| C | No eligible Finalised | None / no-eligible state (RESP-10) |
| D | OTPrepared exist; no remaining eligible Finalised | Already-prepared / completion-style state; **no** duplicate OTPrepared grid; View OT Prepared (RESP-07) |

---

## 13. Future bounded implementation scope (NOT AUTHORIZED)

A future Implementation Authorization **may** authorize only:

| ID | Scope item |
|----|------------|
| A | OT Preparation preparation-focused presentation |
| B | Finalised eligible surgery presentation |
| C | Updated preparation-oriented metrics using existing data only |
| D | Removal of duplicate OTPrepared grid from standalone OT Prep |
| E | Completion summary after Prepare |
| F | View OT Prepared navigation to existing Finalization surface |
| G | Actual ScheduleDate catalog retained |
| H | Existing Prepare mutation retained (all remaining eligible Finalised) |
| I | Existing FSM / SequenceNo / ownership retained |
| J | Existing Surgery Finalization OT Prepared worklist protected |

**Nothing beyond these items.**

### Explicitly out of scope for future RESP implementation

Package B Print · Package C PD-OTPREP-10 · new API · new DB schema/indexes · new FSM state · ownership / CounselorId / Assign / Reassign / Requeue / My Work · SequenceNo redesign · late-add policy (PD-OTPREP-06) · timezone redesign · past-date policy · new OT entity · new prepared worklist · subset selection / checkboxes · arbitrary date horizons · unrelated Finalize Surgery changes · Waiting List · Phase 3I · Slice 14 · Phase 3J

---

## 14. Implementation Authorization gate

```text
PRODUCT DECISION: RECORDED.
IMPLEMENTATION AUTHORIZATION: RECORDED — see
  finalize-surgery-ot-preparation-responsibility-implementation-authorization.md
IMPLEMENTATION: NOT STARTED BY PRODUCT DECISION OR IA RECORDING TASKS.
```

| Prerequisite | Met? |
|--------------|------|
| Product Decision resolves RESP-01…10 | **YES — RECORDED** |
| Bounded Implementation Authorization exists | **YES** — responsibility IA artifact |
| Package A conflict explicitly reconciled in PD | **YES — §8–§9** |
| RESP-05 Prepare selection semantics DECIDED | **YES — A** |

Until the **separate Implementation task** executes under that IA:

- Do **not** modify production code from this Product Decision document alone.  
- Do **not** invent checkboxes or selection workflows.  
- Follow the bounded IA for coding scope A–J only.

---

## 15. Gate summary

| Gate | Status |
|------|--------|
| **AUDIT** | **COMPLETE** — `finalize-surgery-ot-preparation-responsibility-audit.md` |
| **PRODUCT DECISION** | **RECORDED — 10 DECIDED** |
| **RESPONSIBILITY DECISIONS** | RESP-01 **B** · RESP-02 **B** · RESP-03 **B** · RESP-04 **A** · RESP-05 **A** · RESP-06 **B** · RESP-07 **B** · RESP-08 **B** · RESP-09 **A** · RESP-10 **A** |
| **SUPERSESSION / RECONCILIATION** | **RECORDED** (§8–§9) |
| **IMPLEMENTATION AUTHORIZATION** | **RECORDED** — `finalize-surgery-ot-preparation-responsibility-implementation-authorization.md` |
| **IMPLEMENTATION** | **NOT STARTED** |
| **AUTOMATED TESTS** | **NOT RUN FOR NEW MODEL** |
| **MANUAL UAT** | **NOT EXECUTED** |
| **ACCEPTANCE** | **NOT RECORDED** |

**Next gate:** Separate bounded **IMPLEMENTATION** under the responsibility IA.

**STOP.**
