# Finalize Surgery + OT Preparation
# Product Owner Decision — Revised Responsibility Model
# Finalised worklist + selection Prepare (post Manual UAT)

| Field | Value |
|-------|--------|
| **Document type** | **PRODUCT OWNER DECISION RECORDING — GOVERNANCE ONLY** |
| **Decision family** | **PD-OTPREP-RESP2-01 … PD-OTPREP-RESP2-10** |
| **Date prepared** | 2026-09-23 |
| **Date Product Owner decisions recorded** | 2026-09-23 |
| **Program** | Hospital Portal — Finalize Surgery / OT Preparation |
| **Mode** | Formal Product Owner decision recording (post revised-responsibility audit) |
| **Product Decision Status** | **RECORDED — 10 DECIDED · 0 PENDING** |
| **Implementation Authorized** | **NO by this PD alone** — separate bounded IA: `finalize-surgery-ot-preparation-revised-responsibility-implementation-authorization.md` |
| **Production code / API / DB / permissions / routes / FSM / ownership / tests modified** | **NO** |

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-product-decision.md` |
| Artifact disposition | **NEW** |
| Trigger audit | `docs/audits/finalize-surgery-ot-preparation-revised-responsibility-audit.md` |
| Prior RESP family | `docs/product-decisions/finalize-surgery-ot-preparation-responsibility-product-decision.md` |
| Prior RESP IA / report | Responsibility A–J IA + implementation report (historical) |
| Authorizes | **Nothing** |
| Does not authorize | Checkboxes · Select All · Prepare semantics change · catalog removal in code · API/backend · Package B/C |
| Product Owner | **Not supplied in repository context** |

### Distinction legend

| Label | Meaning |
|-------|---------|
| **FACT** | Verified from audit / repository / prior PD |
| **PRODUCT OWNER DECISION** | Explicit selection recorded here |
| **PENDING PRODUCT OWNER DECISION** | Must be resolved before Implementation Authorization |
| **SUPERSEDED / NARROWED** | Prior RESP presentation/semantics limited by this recording |
| **IMPLEMENTATION AUTHORIZATION** | Separate gate — **RECORDED** (`finalize-surgery-ot-preparation-revised-responsibility-implementation-authorization.md`) |

### Recording integrity

| Rule | Application |
|------|-------------|
| This document records Product Owner decisions | **YES — COMPLETE 2026-09-23 (10 DECIDED)** |
| This document implements remediation | **NO** |
| This document creates Implementation Authorization | **NO** |
| Infer Acceptance / UAT PASS from this recording | **FORBIDDEN** |
| Silently convert PENDING into implementation rules | **FORBIDDEN** |

---

## 2. Governance baseline

| Area | Status |
|------|--------|
| RESP A–J Product Decision | **RECORDED** (historical) |
| RESP A–J Implementation Authorization | **RECORDED** (historical) |
| RESP A–J Implementation | **COMPLETED** (historical) |
| RESP A–J Automated tests | **REPORTED** |
| RESP A–J Manual UAT | **PAUSED** — operationally misaligned |
| RESP A–J Acceptance | **NOT RECORDED** |
| Revised responsibility audit | **COMPLETE** |
| This RESP2 Product Decision | **RECORDED — 10 DECIDED · 0 PENDING** |
| RESP2 Implementation Authorization | **YES** — `finalize-surgery-ot-preparation-revised-responsibility-implementation-authorization.md` (coding not started by IA recording) |
| Package B / Package C | **OUT OF SCOPE** |
| Phase 3I / Slice 14 / Phase 3J | **CLOSED / DOES NOT EXIST / NOT CREATED** |

Do not erase RESP A–J historical artifacts.  
Do not retroactively mark prior Acceptance PASS.

---

## 3. Trigger

Manual UAT of the A–J date-centric OT Preparation UX found:

- ScheduleDate input / date pills / Today–Tomorrow  
- preparation metrics  
- already-prepared / completion summaries  
- View OT Prepared as primary completion path  
- date-dashboard feel  

**too complex / not the intended workflow.**

Authoritative findings: revised responsibility audit (2026-09-23).

---

## 4. Current certified model (historical FACT)

```text
OT PREPARATION (RESP A–J)
  = date-selected preparation queue
  = catalog + metrics
  = Prepare ALL remaining eligible Finalised for ScheduleDate
  = no subset UI (RESP-05)
  = completion / already-prepared summary
  = View OT Prepared convenience

FINALIZATION → OT Prepared (RESP-02)
  = authoritative prepared operational review

No duplicate OTPrepared grid on OT Prep (RESP-03)
```

---

## 5. New proposed model (this decision family)

```text
OT PREPARATION
  = Finalised operational preparation queue
  = Finalization-style search/filter
  = select one / multiple / Select all visible (current page — RESP2-03 A)
  = Prepare OT → confirm
  = selected eligible Finalised → OTPrepared

SURGERY FINALIZATION → Finalised
  = authoritative Finalised journey (edit / confirm / finalise)

SURGERY FINALIZATION → OT Prepared
  = authoritative prepared review (RESP-02 PRESERVED)
```

OT Preparation must **not** become:

- a second OTPrepared worklist  
- a new operational entity  
- a new route  
- a personal ownership / My Work queue  

---

## 6. Decision register

| Decision ID | Topic | Status | Selection |
|-------------|-------|--------|-----------|
| **PD-OTPREP-RESP2-01** | OT Preparation primary presentation | **DECIDED** | Finalised worklist-oriented (not date-dashboard) |
| **PD-OTPREP-RESP2-02** | Prepare selection semantics | **DECIDED** | Explicit selection; Prepare selected only; supersedes RESP-05 |
| **PD-OTPREP-RESP2-03** | Selection scope (Select All meaning) | **DECIDED** | **A** — all visible rows on the current page |
| **PD-OTPREP-RESP2-04** | Prepare batch date constraint | **DECIDED** | **A** — one ScheduleDate per Prepare operation |
| **PD-OTPREP-RESP2-05** | Prepare confirmation | **DECIDED** | Confirmation required; must show selected count |
| **PD-OTPREP-RESP2-06** | Post-Prepare UX | **DECIDED** | Worklist-oriented; supersedes/narrows RESP-06/07 |
| **PD-OTPREP-RESP2-07** | Finalised row edit from OT Prep | **DECIDED** | May open existing FinalizeOtModal |
| **PD-OTPREP-RESP2-08** | Date-edit FSM consequence | **DECIDED** | Preserve Finalised/Confirmed → NotConfirmed |
| **PD-OTPREP-RESP2-09** | Catalog / metrics disposition | **DECIDED** | Removed from primary OT Prep presentation |
| **PD-OTPREP-RESP2-10** | SequenceNo / partial preparation | **DECIDED** | **B** — continue from highest existing OTPrepared SequenceNo for same ScheduleDate |

**Product Owner:** Not supplied in repository context  
**Decision date:** 2026-09-23  
**Pending closure date (RESP2-03/04/10):** 2026-09-23

**Implementation Authorization:** **RECORDED** separately — `finalize-surgery-ot-preparation-revised-responsibility-implementation-authorization.md`  
**Implementation:** **NOT STARTED** until the separate Implementation task executes under that IA.

---

## 7. Decision items

### PD-OTPREP-RESP2-01 — OT Preparation primary presentation

### Product Owner Decision (RECORDED)

**Status: DECIDED**  
**Date: 2026-09-23**

OT Preparation is a **Finalised worklist-oriented preparation workspace**, not a date-dashboard.

Primary presentation should reuse the existing Finalization Finalised worklist pattern.

**Preserve (via reuse of existing Finalization patterns):**

- Surgery Date (as a field / filter — not catalog navigation)  
- UHID  
- Patient Name  
- existing search  
- existing filters  
- existing pagination  
- existing authoritative Finalised data  

Do **not** create a second worklist entity or route.

**Supersedes / narrows:** RESP-01 date-selected workspace presentation; RESP-08/09 as primary OT Prep navigation/metrics presentation.

---

### PD-OTPREP-RESP2-02 — Prepare selection semantics

### Product Owner Decision (RECORDED)

**Status: DECIDED**  
**Date: 2026-09-23**

OT Preparation supports explicit preparation selection:

- individual surgery  
- multiple surgeries  
- Select All (**RESP2-03 Option A** — all visible rows on the current page)  
- deselect individual surgeries  
- Prepare OT  

Prepare acts **only** on the **selected eligible Finalised** surgeries.

No row is prepared merely because it appears in the Finalised list.

**Explicitly supersedes RESP-05:**

> Previous: prepare all remaining eligible Finalised; no subset UI.

---

### PD-OTPREP-RESP2-03 — Selection scope (Select All)

| Option | Meaning |
|--------|---------|
| **A** | All rows on the **current page** only (“Select all visible”) |
| B | All rows matching active Finalised filters in the loaded set |
| C | All matching records across pagination |
| D | All eligible Finalised across the branch |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

“Select All” means:

**ALL VISIBLE ROWS ON THE CURRENT PAGE.**

The UI must use explicit wording such as **“Select all visible”** rather than ambiguous “Select All” where appropriate.

**Rules:**

- Only rows currently visible on the current page are selected.  
- Rows on other pagination pages are **NOT** selected.  
- Rows hidden by filters are **NOT** selected.  
- Branch-wide selection is **NOT** authorized.  
- Cross-page bulk selection is **NOT** authorized.  
- No hidden-record selection behavior may be invented.  
- Selection remains limited to **eligible Finalised** rows.  

Do **not** create a new bulk-selection backend API.  
This is a **frontend worklist interaction**.

---

### PD-OTPREP-RESP2-04 — Prepare batch date constraint

**FACT (audit):** `submitPrepareOtList` requires one `Date` and validates each submitted item’s StartTime against that date.

| Option | Meaning |
|--------|---------|
| **A** | One ScheduleDate per Prepare operation; date is batch constraint, not primary navigation |
| B | Cross-date selection required → separate backend/API authorization |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: A**  
**Status: DECIDED — OPTION A**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

**ONE PREPARE OPERATION = ONE SCHEDULE DATE.**

Existing Prepare API contract remains:

```text
Date + Items[]
```

Selected surgeries in a single Prepare operation must all belong to the **same ScheduleDate**.

**UX principle:** OT Preparation remains a Finalised **WORKLIST**. It does **NOT** return to the previous date-dashboard model. ScheduleDate is a Prepare **BATCH CONSTRAINT**, not the primary OT Prep navigation model.

**Rules:**

- Surgery Date remains available as an existing worklist field/filter.  
- User may search/filter Finalised surgeries using the existing Finalization-style worklist.  
- User may select multiple Finalised rows.  
- Before Prepare is confirmed, selected rows must resolve to **one** ScheduleDate.  
- Mixed-date selection must **NOT** be silently submitted.  
- UI must clearly prevent or explain incompatible mixed-date selection.  
- Do **NOT** add cross-date Prepare.  
- Do **NOT** create multiple hidden Prepare API calls to simulate cross-date Prepare.  
- Do **NOT** modify the existing Prepare API.  

Cross-date Prepare would require a separate backend/API Product Decision and Implementation Authorization in the future.

---

### PD-OTPREP-RESP2-05 — Prepare confirmation

### Product Owner Decision (RECORDED)

**Status: DECIDED**  
**Date: 2026-09-23**

Prepare OT requires an explicit confirmation step:

```text
Select surgeries → Prepare OT → confirmation → selected become OTPrepared
```

Confirmation must clearly identify the **number of selected surgeries**.

Exact confirmation copy is an implementation/design-system concern — do not invent additional clinical/financial rules here.

---

### PD-OTPREP-RESP2-06 — Post-Prepare UX

### Product Owner Decision (RECORDED)

**Status: DECIDED**  
**Date: 2026-09-23**

Replace the previous date-dashboard completion model with a **worklist-oriented** result.

After successful Prepare:

- remain on OT Preparation  
- refresh/reconcile the Finalised worklist  
- prepared rows are no longer eligible for selection  
- show concise success feedback  
- optionally provide **View OT Prepared** as a convenience action (not the primary experience)  

Do **not** make a completion dashboard the primary OT Preparation experience.

**Supersedes / narrows:** RESP-06 completion-summary-first presentation; RESP-07 View OT Prepared as primary completion path.

---

### PD-OTPREP-RESP2-07 — Finalised row edit from OT Preparation

### Product Owner Decision (RECORDED)

**Status: DECIDED**  
**Date: 2026-09-23**

An OT Preparation user **may** open the existing **`FinalizeOtModal`** for a Finalised row (reuse existing open-row path).

Do **not** create a new OT-specific date-edit API.  
Do **not** create a second edit modal.

Reuse: existing `FinalizeOtModal` / `updateOtDetails`.

Consequence acknowledged in **RESP2-08**.

---

### PD-OTPREP-RESP2-08 — Date-edit FSM consequence

### Product Owner Decision (RECORDED)

**Status: DECIDED**  
**Date: 2026-09-23**

If Surgery Date/details are edited on a Finalised (or Confirmed) surgery:

- existing certified FSM behavior applies  
- surgery becomes **`NotConfirmed`**  
- it must be re-confirmed / re-finalised before it can be prepared  

Do **not** alter this FSM behavior unless a separate Product Decision explicitly approves a different rule.

---

### PD-OTPREP-RESP2-09 — Date catalog / metrics disposition

### Product Owner Decision (RECORDED)

**Status: DECIDED**  
**Date: 2026-09-23**

The following are **SUPERSEDED / REMOVED FROM PRIMARY OT PREPARATION PRESENTATION**:

- ScheduleDate catalog  
- date pills  
- Today / Tomorrow as primary navigation presentation  
- Dates requiring preparation metric  
- Ready for OT Preparation metric strip  
- already-prepared summary as primary OT Prep body  
- date-centric None state as primary empty model  

**Preserve** underlying ScheduleDate data and eligibility/batch constraints where required by the Prepare API and Finalization filters.

Do **not** delete underlying helpers/API solely because presentation is removed (cleanup only under a future IA if explicitly scoped).

**Supersedes / narrows:** RESP-08, RESP-09, RESP-10 (as primary OT Prep presentation); further narrows RESP-01/04 presentation.

---

### PD-OTPREP-RESP2-10 — SequenceNo / partial preparation

**FACT:** SequenceNo is assigned from the Prepare request items. Backend `GetOtList` orders OTPrepared by SequenceNo then StartTime.

| Option | Meaning (illustrative) |
|--------|------------------------|
| A | Operator always assigns sequences manually without auto-continuation |
| **B** | Continue from highest existing OTPrepared SequenceNo for the same ScheduleDate |
| C | Other redesign (forbidden without separate PD) |

### Product Owner Decision (RECORDED)

**SELECTED OPTION: B**  
**Status: DECIDED — OPTION B**  
**Date: 2026-09-23**  
**Product Owner: Not supplied in repository context**

For partial preparation of a ScheduleDate:

**SequenceNo continues from the highest existing OTPrepared SequenceNo for that same ScheduleDate.**

Example:

```text
Existing OTPrepared:
  Sequence 1 = Patient A
  Sequence 2 = Patient B

New selected Finalised:
  Patient C
  Patient D

Prepare assigns:
  Patient C = Sequence 3
  Patient D = Sequence 4
```

A later preparation operation continues from the highest existing SequenceNo for that ScheduleDate.

**Do NOT:**

- renumber existing OTPrepared rows  
- fill gaps  
- reorder existing OTPrepared rows  
- reset SequenceNo  
- redesign the SequenceNo algorithm globally  
- change historical SequenceNo values  
- introduce a new FSM state  

#### Ordering of newly selected rows before SequenceNo assignment

**FACT (repository):** Checkbox click order is **not** an existing authoritative operational sequence. The Finalization Finalised worklist preserves list/API ordering then applies client filter + pagination (`sliceWaitingListPage`). The historical Prepare modal initializes sequences from the submitted records array order (1..N), not click order.

### Product Owner Decision (ordering — RECORDED)

Newly selected surgeries must preserve the **existing authoritative worklist/request ordering**; **no new operator-click ordering rule** is introduced by this Product Decision.

Continuation numbering (Option B) applies **after** that existing order is established for the selected set (e.g. highestExisting + 1, + 2, … in worklist/request order).

If implementation later discovers that a deterministic ordering is required and not already defined: **STOP** and raise a focused Product Decision rather than guessing.

#### Relationship to PD-OTPREP-06

Historical `finalize-surgery-ot-preparation-operational-model-product-decision.md` **PD-OTPREP-06**:

- Append semantics: **OPTION A** (DECIDED)  
- SequenceNo continuation: was **PENDING**  

**PD-OTPREP-RESP2-10** **supersedes/resolves** the previously pending SequenceNo continuation aspect of **PD-OTPREP-06** for the revised **selection-based** OT Preparation workflow.

Do **not** delete or rewrite the historical PD-OTPREP-06 artifact.  
Preserve unrelated historical decisions in PD-OTPREP-06 (append semantics Option A remains).

---

## 8. Explicit supersession map

| Prior decision | Effect under RESP2 |
|----------------|--------------------|
| **RESP-01** date-selected workspace presentation | **SUPERSEDED / NARROWED** by RESP2-01/09 |
| **RESP-04** as primary date-queue presentation | **NARROWED** — day-match remains for Prepare batch constraint (RESP2-04 A); not primary UX |
| **RESP-05** all-eligible / no subset | **SUPERSEDED** by RESP2-02 |
| **RESP-06** completion-summary-first | **SUPERSEDED / NARROWED** by RESP2-06 |
| **RESP-07** View OT Prepared as primary completion | **SUPERSEDED / NARROWED** by RESP2-06 (optional convenience only) |
| **RESP-08** preparation metric strip | **SUPERSEDED** by RESP2-09 |
| **RESP-09** catalog/pills primary navigation | **SUPERSEDED** by RESP2-09 |
| **RESP-10** date-centric None | **SUPERSEDED / NARROWED** by RESP2-09 |
| **RESP-02** | **PRESERVED** |
| **RESP-03** | **PRESERVED** |

Historical RESP A–J artifacts and implementation remain a **historical record**. Acceptance not recorded.

---

## 9. Preserved certified behavior

1. Surgery Finalization → Finalised workflow  
2. Existing Finalised search/filter behavior  
3. Existing Surgery Date editing mechanism (`FinalizeOtModal` / `updateOtDetails`)  
4. Surgery Finalization → OT Prepared worklist  
5. OTPrepared search  
6. OTPrepared date filtering  
7. Reopen  
8. Print (Package B still separate for certified list print remediation)  
9. Pagination  
10. Existing Prepare API contract (`Date` + `Items[]`) unless a separate PD + IA authorizes API change  
11. FSM (including Finalised edit → NotConfirmed)  
12. Ownership (no CounselorId / Assign / Reassign / Requeue / My Work)  
13. Permissions  
14. Audit behavior  
15. No new OT entity  
16. No new route  
17. No Phase 3I reopen · no Slice 14 · no Phase 3J  
18. Package B separate  
19. Package C / PD-OTPREP-10 separate  

---

## 10. API constraints

| Constraint | Status |
|------------|--------|
| Prepare accepts `Date` + explicit `Items[]` | **FACT — preserved** |
| Backend prepares **submitted** IDs only (after validation) | **FACT** |
| Items must be Finalised and on `request.Date` | **FACT** |
| Cross-date single Prepare | **NOT AUTHORIZED** — RESP2-04 Option A (one ScheduleDate per Prepare) |
| New Prepare endpoint | **NOT authorized** by this PD |
| Frontend-only adaptation for selection (same-date) | Feasible under future IA now that RESP2-03/04/10 are DECIDED |

---

## 11. FSM constraints

```text
NotConfirmed → Confirmed → Finalised → OTPrepared → SurgeryDone
Any → Cancelled
OTPrepared → Confirmed (Reopen)
Finalised/Confirmed edit → NotConfirmed (PRESERVED — RESP2-08)
```

No new FSM states.

---

## 12. SequenceNo constraints

| Rule | Status |
|------|--------|
| Continue from highest existing OTPrepared SequenceNo for same ScheduleDate | **DECIDED — RESP2-10 Option B** |
| Preserve existing worklist/request ordering for new selected set | **DECIDED** — no click-order rule |
| No renumber / gap-fill / reset / historical rewrite | **LOCKED** |
| Global SequenceNo algorithm redesign | **NOT AUTHORIZED** |
| PD-OTPREP-06 continuation pending | **RESOLVED by RESP2-10** for selection-based OT Prep |

---

## 13. Ownership constraints

No CounselorId · Assign · Reassign · Requeue · My Work · ownership history.  
Shared operational queue remains.

---

## 14. Permission constraints

No new permissions/roles authorized.  
Existing Finalize OT mutate permission continues to gate Prepare.

---

## 15. Cross-date status

```text
PD-OTPREP-RESP2-04: DECIDED — OPTION A
ONE SCHEDULEDATE PER PREPARE OPERATION
Cross-date Prepare: NOT AUTHORIZED
Prepare API contract unchanged (Date + Items[])
Date = batch constraint; OT Prep remains Finalised worklist (not date-dashboard)
```

---

## 16. Select All status

```text
PD-OTPREP-RESP2-03: DECIDED — OPTION A
Select All = ALL VISIBLE ROWS ON THE CURRENT PAGE
Preferred label: "Select all visible"
Cross-page / branch-wide / filtered-hidden selection: NOT AUTHORIZED
No bulk-selection backend API
```

---

## 17. SequenceNo / partial prep status

```text
PD-OTPREP-RESP2-10: DECIDED — OPTION B
Continue from highest existing OTPrepared SequenceNo for same ScheduleDate
Ordering: preserve existing authoritative worklist/request ordering
Click-order: NOT introduced
PD-OTPREP-06 SequenceNo continuation (pending): RESOLVED by RESP2-10 for this workflow
```

---

## 18. Test impact (governance note only)

When a future IA authorizes implementation, expect rewrite/replacement of:

- OT preparation catalog / RESP A–J presentation tests  
- discoverability/RESP Playwright journeys for date-dashboard UX  
- Prepare “all for date / no checkbox” page contracts  

Add coverage expectations (future IA) for:

- Select all visible (current page only)  
- Mixed-date selection blocked  
- SequenceNo continuation from max existing for ScheduleDate  

Retain: package1 · finalize-ot-authorization · Finalization OT Prepared · Reopen · Cancel · Reporting Time · FSM tests unless separately authorized to change.

**Do not modify tests in this task.**

---

## 19. Required future Implementation Authorization boundary

All RESP2-01…10 are **DECIDED**. Bounded Implementation Authorization is **RECORDED**:

`finalize-surgery-ot-preparation-revised-responsibility-implementation-authorization.md`

Illustrative authorized scope (coding still **NOT STARTED** by PD/IA recording tasks):

- Finalised worklist presentation on OT Prep workspace (same page/route)  
- Selection UI + “Select all visible” (current page)  
- Same-ScheduleDate Prepare batch validation  
- SequenceNo continuation per RESP2-10 Option B  
- Prepare confirmation + worklist-oriented post-Prepare feedback  
- Optional View OT Prepared convenience  
- Removal of primary date-catalog/metrics presentation  
- Reuse FinalizeOtModal  

Out of scope unless separately authorized:

- Cross-date Prepare API  
- SequenceNo global redesign / renumbering  
- Package B / C  
- New entity/route/permissions/ownership/FSM changes  

---

## 20. Gate summary

| Gate | Status |
|------|--------|
| **REVISED AUDIT** | **COMPLETE** |
| **PRODUCT DECISION** | **COMPLETE — 10 DECIDED / 0 PENDING** |
| **IMPLEMENTATION AUTHORIZATION** | **RECORDED — RESP2 BOUNDED SCOPE ONLY** — `finalize-surgery-ot-preparation-revised-responsibility-implementation-authorization.md` |
| **IMPLEMENTATION** | **NOT STARTED** |
| **MANUAL UAT** | **PAUSED / REQUIRED** |
| **ACCEPTANCE** | **NOT RECORDED** |

```text
REVISED AUDIT: COMPLETE
PRODUCT DECISION: COMPLETE — 10 DECIDED / 0 PENDING
IMPLEMENTATION AUTHORIZATION: RECORDED — RESP2 BOUNDED SCOPE ONLY
IMPLEMENTATION: NOT STARTED
MANUAL UAT: REQUIRED
ACCEPTANCE: NOT RECORDED
```

**STOP.** Next gate is bounded **IMPLEMENTATION** under the RESP2 IA.
