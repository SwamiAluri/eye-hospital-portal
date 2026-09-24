# Finalize Surgery + OT Preparation
# Bounded Implementation Authorization —
# Revised Responsibility Model (PD-OTPREP-RESP2-01…10)

| Field | Value |
|-------|--------|
| **Document type** | **IMPLEMENTATION AUTHORIZATION — GOVERNANCE ONLY** |
| **Title** | Finalize Surgery + OT Preparation — RESP2 Revised Responsibility Implementation Authorization |
| **Package name** | Finalize / OT Preparation — RESP2 Revised Responsibility |
| **Date** | 2026-09-23 |
| **Status** | **IMPLEMENTATION AUTHORIZED — RESP2 BOUNDED SCOPE ONLY** |
| **Implementation started by this task** | **NO** |
| **Production code / API / DB / permissions / routes / FSM / ownership / UI / tests modified by this task** | **NO** — this artifact is governance only |

---

## Authorization statement

```text
This authorization permits implementation of the RESP2 revised OT Preparation
responsibility model ONLY, under PD-OTPREP-RESP2-01…10 (10 DECIDED / 0 PENDING).

It does NOT authorize Package B (Print).
It does NOT authorize Package C (PD-OTPREP-10).
It does NOT authorize new API / backend / DB / permission / FSM / ownership changes.
It does NOT authorize cross-date Prepare, SequenceNo redesign, or new routes/entities.

RESP2 REVISED RESPONSIBILITY IMPLEMENTATION AUTHORIZATION: YES
PACKAGE B PRINT AUTHORIZATION: NO
PACKAGE C PD-OTPREP-10 AUTHORIZATION: NO
NEW API AUTHORIZATION: NO
BACKEND CHANGE AUTHORIZATION: NO
DB CHANGE AUTHORIZATION: NO
PERMISSION CHANGE AUTHORIZATION: NO
FSM CHANGE AUTHORIZATION: NO
OWNERSHIP CHANGE AUTHORIZATION: NO
SEQUENCENO GLOBAL REDESIGN AUTHORIZATION: NO
CROSS-DATE PREPARE AUTHORIZATION: NO
CROSS-PAGE SELECT ALL AUTHORIZATION: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
C-01 REOPEN: NO
```

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-implementation-authorization.md` |
| Artifact disposition | **NEW** |
| Authorizes | Bounded **frontend** OT Preparation worklist + selection Prepare per RESP2 |
| Does not authorize | Backend/API/DB · cross-date Prepare · Package B/C · ownership · FSM redesign · SequenceNo renumber |
| Product Owner | Not supplied in repository context |
| Product Decision | `docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-product-decision.md` — **RECORDED — 10 DECIDED / 0 PENDING** |
| Trigger audit | `docs/audits/finalize-surgery-ot-preparation-revised-responsibility-audit.md` |
| Historical A–J | RESP Product Decision + IA + implementation report — **historical**; presentation superseded/narrowed |
| Next gate | Separate **IMPLEMENTATION** task (not started by this governance task) |

---

## 2. Product Decision register (authorized)

| ID | Selection | Authorized here? |
|----|-----------|------------------|
| **PD-OTPREP-RESP2-01** | Finalised worklist-oriented OT Prep (not date-dashboard) | **YES** |
| **PD-OTPREP-RESP2-02** | Explicit selection; Prepare selected only | **YES** |
| **PD-OTPREP-RESP2-03** | **A** — Select all visible = current page only | **YES** |
| **PD-OTPREP-RESP2-04** | **A** — one ScheduleDate per Prepare | **YES** |
| **PD-OTPREP-RESP2-05** | Prepare confirmation with selected count | **YES** |
| **PD-OTPREP-RESP2-06** | Worklist-oriented post-Prepare UX | **YES** |
| **PD-OTPREP-RESP2-07** | Reuse FinalizeOtModal from OT Prep | **YES** |
| **PD-OTPREP-RESP2-08** | Finalised/Confirmed edit → NotConfirmed preserved | **YES** (preserve) |
| **PD-OTPREP-RESP2-09** | Remove primary date-dashboard presentation | **YES** |
| **PD-OTPREP-RESP2-10** | **B** — SequenceNo continue from max OTPrepared for same ScheduleDate | **YES** (FE-supplied sequences under existing Prepare contract) |

Preserved prior RESP: **RESP-02**, **RESP-03** (authoritative Finalization OT Prepared; no duplicate prepared grid on OT Prep).

---

## 3. Governance baseline

| Area | Status |
|------|--------|
| RESP A–J PD / IA / implementation | **Historical** — Manual UAT paused; Acceptance **NOT RECORDED** |
| Revised audit | **COMPLETE** |
| RESP2 Product Decision | **COMPLETE — 10 DECIDED / 0 PENDING** |
| This Implementation Authorization | **YES — THIS DOCUMENT** |
| RESP2 Implementation | **NOT STARTED** |
| Automated tests (RESP2) | **NOT RUN** (at authorization recording) |
| Manual UAT | **REQUIRED — FUTURE** |
| Acceptance | **NOT RECORDED** |
| Package B / C | **NOT AUTHORIZED** |

Governance sequence:

```text
REVISED AUDIT            ✓
PRODUCT DECISION (RESP2) ✓
IMPLEMENTATION AUTHORIZATION ✓ (this document)
IMPLEMENTATION           ← next task (NOT started here)
AUTOMATED TESTS + PLAYWRIGHT
STOP
MANUAL UAT
ACCEPTANCE
```

Creating this IA does **not** implement anything.

---

## 4. Implementation objective

```text
OT PREPARATION
  = Finalised operational preparation worklist
  = Finalization-style search/filter/pagination
  = explicit selection of eligible Finalised
  = Prepare OT → confirmation
  = selected → OTPrepared

FINALIZATION → Finalised  = authoritative Finalised journey
FINALIZATION → OT Prepared = authoritative prepared review (RESP-02)
```

Do **not** create: second OTPrepared worklist · new entity · new route · My Work / ownership queue.

---

## 5. Exact authorized scope (A–Z)

| ID | Scope | Authorized |
|----|-------|------------|
| **A** | Replace OT Prep date-dashboard with Finalised worklist presentation | **YES** |
| **B** | Reuse Finalization Finalised worklist pattern/data | **YES** |
| **C** | Preserve Finalised fields/search/filter/pagination patterns | **YES** |
| **D** | Explicit row selection (individual / multiple / select all visible / deselect) | **YES** |
| **E** | Select All = current page visible eligible Finalised only | **YES** |
| **F** | Prepare OT acts only on selected eligible Finalised | **YES** |
| **G** | Explicit confirmation showing selected count | **YES** |
| **H** | Same-ScheduleDate constraint; block mixed-date submit | **YES** |
| **I** | Preserve Prepare API `Date + Items[]` | **YES** |
| **J** | Reuse existing Prepare mutation path | **YES** |
| **K** | Partial preparation (selected only) | **YES** |
| **L** | SequenceNo continue from highest OTPrepared for same ScheduleDate | **YES** |
| **M** | Preserve worklist/request ordering; no click-order sequencing | **YES** |
| **N** | Do not renumber existing OTPrepared | **YES** (preserve) |
| **O** | Do not fill SequenceNo gaps | **YES** (preserve) |
| **P** | Do not reset historical SequenceNo | **YES** (preserve) |
| **Q** | Post-Prepare: remain on OT Prep; refresh; success feedback; optional View OT Prepared | **YES** |
| **R** | View OT Prepared → existing Finalization OT Prepared (same route) | **YES** |
| **S** | Reuse FinalizeOtModal / updateOtDetails; no second modal/API | **YES** |
| **T** | Preserve Finalised/Confirmed edit → NotConfirmed | **YES** (preserve) |
| **U** | Remove primary date-dashboard presentation (catalog/pills/metrics/etc.) | **YES** |
| **V** | Preserve underlying ScheduleDate where required | **YES** |
| **W** | Preserve Finalization → Finalised | **YES** |
| **X** | Preserve Finalization → OT Prepared | **YES** |
| **Y** | Preserve OTPrepared search/date/Reopen/Print/pagination/status | **YES** |
| **Z** | Preserve FSM/permissions/ownership/audit/API/no new entity/route | **YES** |

**NOTHING BEYOND A–Z IS AUTHORIZED.**

---

## 6. Critical same-date behavior (RESP2-04 A)

```text
ONE PREPARE OPERATION = ONE SCHEDULEDATE
API: Date + Items[]  (unchanged)
```

- Detect selected rows with different ScheduleDates.  
- Do **not** submit mixed-date selections.  
- Do **not** silently split into multiple Prepare requests.  
- Do **not** modify the API.  
- UX must clearly require same surgery date before Prepare proceeds.  
- ScheduleDate = batch constraint; OT Prep remains Finalised **worklist**, not date-dashboard.

---

## 7. Select all semantics (RESP2-03 A)

```text
"Select all visible" =
  ALL ELIGIBLE FINALISED ROWS VISIBLE ON THE CURRENT PAGE
```

Does **not** mean: all filtered across pagination · all loaded · branch-wide · DB-wide.

- Respect current filters (hidden rows not selected).  
- Changing filters/page must reconcile selection safely.  
- No cross-page selection.  
- No bulk-selection backend API.

---

## 8. Selection eligibility

Only **eligible Finalised** surgeries may be selected for Prepare OT.

Do **not** invent blockers (insurance, payment, clinical, theatre, ownership, extra status rules).  
Use existing authoritative Finalised status/data.

---

## 9. SequenceNo implementation boundary (RESP2-10 B)

Authorized rule for ScheduleDate `D`:

```text
highestExistingSequence = max SequenceNo among OTPrepared for D
  (treat null/absent as 0 for continuation math)

Selected set in existing worklist/request order receives:
  highestExistingSequence + 1, + 2, …
```

**FACT (repository):** `PrepareOtListAsync` assigns `SequenceNo` from submitted `Items[].Sequence`. Continuation can be satisfied by **frontend-computed sequences** in the existing request if existing OTPrepared SequenceNo values for `D` are available from existing loaded finalize/OT list data.

**Pre-implementation inspection (mandatory):**

1. Confirm FE can read existing OTPrepared `SequenceNo` for the batch ScheduleDate from existing data sources (finalize list / catalog / `getOtList` READ — no new endpoint).  
2. Confirm FE can submit continued sequences via existing `submitPrepareOtList`.  
3. If the existing backend/data path **cannot** safely support this rule:

```text
IMPLEMENTATION BLOCKED — AUTHORIZED PRODUCT RULE REQUIRES BACKEND CHANGE.
```

Do **not** invent a frontend workaround that falsely claims the rule.  
Do **not** modify backend under this IA.

**Forbidden:** renumber · gap-fill · reset · rewrite history · click-order · global SequenceNo redesign.

---

## 10. Backend / API boundary

| Item | Authorized? |
|------|-------------|
| New endpoint | **NO** |
| API contract change | **NO** |
| Backend service/DB change | **NO** |
| Existing Prepare `Date + Items[]` | **YES — reuse** |
| Existing Finalization list data source | **YES — reuse** |
| FE selection / same-date validation / confirmation / refresh | **YES** |
| FE SequenceNo continuation values in Items | **YES** if data available without new API |

If Class C/D backend need discovered: **STOP** — do not modify API/backend.

---

## 11. Finalization protection

Surgery Finalization is **not** being redesigned.

Preserve Finalised: search · filters · pagination · editing · confirm/finalise.  
Preserve OT Prepared: search · date · Reopen · Print · pagination · status.

OT Prep may reuse Finalization components/patterns but must not break or duplicate authoritative operational worklists.

---

## 12. Historical A–J reconciliation

RESP A–J implementation remains a **historical record**. Acceptance **NOT** retroactively PASS.

| Superseded/narrowed (presentation) | Protected |
|------------------------------------|-----------|
| Date-dashboard primary UX | Finalization → OT Prepared (RESP-02) |
| Catalog primary navigation / metrics | Prepare API contract |
| No-subset preparation (RESP-05) | FSM · SequenceNo historical values |
| Completion-summary-first (RESP-06/07) | Ownership · permissions · audit · Finalization |

Update/reconcile tests under implementation; do not silently delete historical test intent without explanation.

---

## 13. Out of scope — absolute

Cross-date Prepare · new Prepare API · API/DB/migrations/indexes · new permissions/roles · CounselorId · Assign/Reassign/Requeue · My Work · ownership history · new FSM states · FSM redesign · global SequenceNo redesign · renumber/gap-fill/historical rewrite · new OT entity · new route · second OTPrepared worklist · branch-wide/cross-page Select All · hidden-record bulk selection · checkbox click-order sequencing · Package B · Package C / PD-OTPREP-10 · Phase 3I · Slice 14 · Phase 3J · Waiting List · C-01 · unrelated Finalize/Counsellor redesign.

---

## 14. Test authorization (future implementation task)

### Unit / component

1. Finalised worklist rendering  
2. Finalization filters/search reused correctly  
3. Individual selection  
4. Multiple selection  
5. Select all visible (current page)  
6. Deselect individual  
7. Selection reconciles on pagination/filter change  
8. Only eligible Finalised selectable  
9. Mixed-date selection blocked  
10. Single-date selection accepted  
11. Selected count  
12. Prepare confirmation  
13. Selected IDs submitted only  
14. No unselected Finalised submitted  
15. Partial preparation  
16. SequenceNo continuation from highest for same date  
17. Worklist/request ordering preserved  
18. No click-order sequencing  
19. Post-Prepare worklist refresh  
20. Prepared rows no longer selectable  
21. FinalizeOtModal reuse  
22. Finalised edit → NotConfirmed preserved  
23. View OT Prepared convenience  
24. No duplicate OTPrepared grid in OT Prep  
25. No primary date-dashboard presentation  

### Regression

finalize-ot-authorization · finalize-surgery-package1 · prepare-ot-date-scope (where applicable) · Finalization OT Prepared · Reopen · Cancel · Reporting Time · FSM · relevant existing OT Prep tests.

Do not weaken certified tests to force green.

### Playwright journeys

A–P as specified in the product prompt (worklist · search · filter · selection · mixed-date block · Prepare confirm · partial remain Finalised · View OT Prepared · modal/FSM · Finalization OT Prepared protections).

Use safe UAT data. Do not perform destructive live Prepare in unsafe environments.

---

## 15. Accessibility / responsive

Use existing Hospital Portal design system. Verify desktop · supported tablet/mobile · keyboard · focus · semantic checkbox labels · table headers · selected-row state · disabled Prepare · confirmation a11y · no overflow · readable selected count · concise operational copy.

No new component library / visual language.

---

## 16. Implementation safety check (future coding task)

Inspect git diff before completion claims:

- no unauthorized backend/API/DB/permission/FSM/ownership changes  
- no global SequenceNo redesign  
- no new route/entity  
- no duplicate operational worklist  

If unauthorized change present: **STOP**, revert, report.

---

## 17. Required implementation report (after coding — separate task)

Create:  
`docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-implementation-report.md`

Must include items 1–34 from the product prompt (authorization · scope A–Z · files · selection · same-date · SequenceNo · tests · Package B/C · Manual UAT REQUIRED · Acceptance NOT RECORDED). Truthful statuses only.

---

## 18. Manual UAT / Acceptance gates

After implementation + automated tests: **STOP**.

| Gate | Status |
|------|--------|
| Manual UAT | **REQUIRED — NOT EXECUTED** by authorization or (until separate UAT) implementation tasks |
| Acceptance | **NOT RECORDED** |

Do not mark UAT PASS or Acceptance because this IA exists.

---

## 19. Sign-off

| Role | Action | Status |
|------|--------|--------|
| Product Owner | RESP2-01…10 recorded; authorize bounded FE implementation via this IA | **AUTHORIZED via this document — name not supplied in repository context** |
| Engineering | Begin RESP2 only after reading this IA + RESP2 PD + revised audit | **NOT STARTED** |
| QA / UAT | After implementation + tests | **NOT EXECUTED** |
| Acceptance | Explicit recording later | **NOT RECORDED** |

---

## 20. Control flags (summary)

```text
RESP2 REVISED RESPONSIBILITY IMPLEMENTATION AUTHORIZATION: YES
RESP2 IMPLEMENTATION BY THIS TASK: NOT STARTED
PACKAGE B PRINT AUTHORIZATION: NO
PACKAGE C PD-OTPREP-10 AUTHORIZATION: NO
NEW API AUTHORIZATION: NO
BACKEND CHANGE AUTHORIZATION: NO
DB CHANGE AUTHORIZATION: NO
CROSS-DATE PREPARE AUTHORIZATION: NO
CROSS-PAGE SELECT ALL AUTHORIZATION: NO
SEQUENCENO GLOBAL REDESIGN AUTHORIZATION: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
```

---

## 21. Gate summary

| Gate | Status |
|------|--------|
| **PRODUCT DECISION** | **RECORDED — RESP2 01–10** |
| **IMPLEMENTATION AUTHORIZATION** | **RECORDED — RESP2 BOUNDED SCOPE ONLY** |
| **IMPLEMENTATION** | **NOT STARTED AT AUTHORIZATION RECORDING** |
| **AUTOMATED TESTS** | **NOT RUN AT AUTHORIZATION RECORDING** |
| **MANUAL UAT** | **REQUIRED** |
| **ACCEPTANCE** | **NOT RECORDED** |

**Next gate:** Separate bounded **IMPLEMENTATION** under this authorization.

**STOP.**
