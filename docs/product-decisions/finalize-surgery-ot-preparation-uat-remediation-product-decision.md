# Finalize Surgery + OT Preparation
# Product Owner Decision — UAT Findings & Operational UX Remediation

| Field | Value |
|-------|--------|
| **Document type** | **PRODUCT OWNER DECISION RECORDING — GOVERNANCE ONLY** |
| **Decision family** | **PD-OTPREP-UAT-01 … PD-OTPREP-UAT-15** |
| **Date prepared** | 2026-09-23 |
| **Date decision-recording session** | 2026-09-23 |
| **Program** | Hospital Portal — Finalize Surgery / OT Preparation |
| **Mode** | Formal Product Owner decision recording (post-UAT observations) |
| **Product Decision Status** | **RECORDED — 15 DECIDED** |
| **Implementation Authorized** | **PARTIAL** — Package A UX remediation authorized separately; Package B/C and this PD document alone do **not** authorize coding |
| **Production code / API / DB / permissions / routes / FSM / ownership modified** | **NO** |

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/product-decisions/finalize-surgery-ot-preparation-uat-remediation-product-decision.md` |
| Artifact disposition | **NEW** |
| Trigger audit | `docs/audits/finalize-surgery-ot-preparation-uat-findings-operational-ux-reconciliation-audit.md` |
| Authorizes | **Nothing** — governance recording only |
| Does not authorize | Remediation coding, Print fix, auto-load implementation, grid redesign, FSM/ownership/schema changes |
| Product Owner name | **Decision recorded — name not supplied** |

### Distinction legend (used throughout)

| Label | Meaning |
|-------|---------|
| **FACT** | Verified from audit / repository / prior PD |
| **PRODUCT OWNER DECISION** | Explicit selection recorded in this document |
| **RECOMMENDATION** | Non-binding direction (not used as authorization) |
| **IMPLEMENTATION AUTHORIZATION** | Separate gate — **NONE** in this task |

### Recording integrity

| Rule | Application |
|------|-------------|
| This document records Product Owner decisions | **YES** |
| This document implements remediation | **NO** |
| This document creates Implementation Authorization | **NO** |
| Infer acceptance / UAT PASS from this recording | **FORBIDDEN** |

---

## 2. Governance baseline (preserved)

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
| PD-OTPREP-01…05 | **IMPLEMENTED** |
| PD-OTPREP-01…05 automated tests | **PASSED** |
| PD-OTPREP-01…05 Manual UAT | **READY WITH OBSERVATIONS / NOT ACCEPTED** |
| PD-OTPREP-01…05 Acceptance | **NOT RECORDED** |
| This UAT remediation Product Decision | **RECORDED** |
| Remediation Implementation Authorization | **Package A YES** — `finalize-surgery-ot-preparation-uat-remediation-package-a-implementation-authorization.md` (implementation not started); Package B/C **NO** |

Do not reopen Phase 3I · do not create Slice 14 / Phase 3J · do not reopen C-01 · do not reopen Package 1.

---

## 3. Authoritative sources

| Artifact | Role |
|----------|------|
| `docs/audits/finalize-surgery-ot-preparation-uat-findings-operational-ux-reconciliation-audit.md` | UAT findings reconciliation |
| `docs/product-decisions/finalize-surgery-ot-preparation-operational-model-product-decision.md` | PD-OTPREP-01…10 (incl. prior PD-OTPREP-04) |
| `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` | Parent PD-FS |
| `docs/product-decisions/finalize-surgery-ot-preparation-discoverability-implementation-authorization.md` | Discoverability Package (01…05) auth |
| `docs/product-decisions/finalize-surgery-ot-preparation-implementation-authorization.md` | Package 1 auth |
| Operational-model / comprehensive audits | Prior SoT evidence |

---

## 4. Core decision principle (LOCKED)

**PRODUCT OWNER DECISION / FACT alignment:**

OT Preparation remains driven by:

```text
StartTime → ScheduleDate → Surgery Date
```

**Never:** FinalisedAt · Finalisation date · PreparedAt (as grouping key).

Do not introduce another date source.  
Do not invent future surgery dates.  
Do not create a new OT operational worklist/entity.

---

## 5. Supersession notice — PD-OTPREP-04

| Item | Value |
|------|--------|
| **Prior decision** | PD-OTPREP-04 **Option B** — explicit Load mandatory after date selection |
| **Prior status** | DECIDED (operational-model Product Decision) |
| **New decision** | **PD-OTPREP-UAT-03** — date selection **auto-loads existing OTPrepared rows** (READ/LOAD only) |
| **Effect** | PD-OTPREP-04 Option B is **SUPERSEDED** for Load interaction by PD-OTPREP-UAT-03 |
| **Unchanged** | StartTime SoT; Prepare New List remains explicit mutation; no auto-Prepare |

**FACT:** Discoverability implementation still follows old explicit-Load behavior until a separate Implementation Authorization remediates it.

---

## 6. Decision register

| Decision ID | Decision | Status | Implementation Authorized? |
|-------------|----------|--------|----------------------------|
| **PD-OTPREP-UAT-01** | Actual-date relative labels only | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-02** | Surgery-date catalog refinement | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-03** | Auto-load prepared OT list on date selection (READ only) | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-04** | Ready / Prepared / None retained | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-05** | Prepared OT operational grid (existing fields) | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-06** | Reopen-first reschedule path; no direct OTPrepared date edit | **DECIDED** | **NO** — separate PD-10 auth for enforcement track |
| **PD-OTPREP-UAT-07** | Reopen behavior preserved | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-08** | Dedicated OT Preparation Print | **DECIDED** | **NO** — separate Print implementation auth |
| **PD-OTPREP-UAT-09** | Professional concise copy | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-10** | Bounded visual/layout refinement | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-11** | Ownership unchanged | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-12** | SequenceNo unchanged | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-13** | Timezone unchanged | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-14** | DB/index unchanged | **DECIDED** | **NO** |
| **PD-OTPREP-UAT-15** | FSM unchanged | **DECIDED** | **NO** |

---

## 7. Product Decisions (detail)

### PD-OTPREP-UAT-01 — Surgery date presentation

**PRODUCT OWNER DECISION:** Use relative labels for **ACTUAL** surgery dates only.

Examples: `Today` · `Tomorrow` · `Wed, 08 Apr` · `Mon, 13 Apr`.

| Rule | |
|------|--|
| Label decorates actual ScheduleDate | **YES** |
| Generates a date / empty slot | **NO** |
| Rolling 7/14/30-day horizon inventing days | **NO** |
| Calendar range control | **NO** |

Approved pattern: actual ScheduleDate + relative human-readable label when applicable (e.g. `Today · 1 ready`).

---

### PD-OTPREP-UAT-02 — Date catalog structure

**PRODUCT OWNER DECISION:** Retain surgery-date catalog as primary navigation.

Must: actual ScheduleDates · chronological order · ready/prepared counts · support future dates present in data · existing portal components · responsive.

Must not: full calendar · arbitrary horizon · second worklist · date-range work queue.

Relative labels (UAT-01) are presentation only. Many dates → existing horizontal scroll/navigation patterns — no new design system.

---

### PD-OTPREP-UAT-03 — Load OT List behavior (**AUTO-LOAD**)

**PRODUCT OWNER DECISION:** Change from explicit-Load-only (**prior PD-OTPREP-04 Option B**) to:

**Date selection auto-loads existing prepared OT data.**

When operator selects an actual surgery date:

1. Selected date becomes OT Preparation context.  
2. Existing **OTPrepared** rows for that date are **automatically loaded** (existing GetOtList / equivalent READ).  
3. Prepared list shown immediately when rows exist.  
4. If no OTPrepared but eligible Finalised exist → **Ready** state.  
5. If neither → **None** state.

#### CRITICAL — AUTO-LOAD = READ/LOAD ONLY

Selecting a date **MUST NEVER**:

- prepare a list  
- create OTPrepared rows  
- assign SequenceNo  
- change FSM state  
- mutate surgery data  
- mutate ownership  
- create an operational work item  

**Prepare New List** remains an **explicit** operator action.

**FACT:** Implementation today still requires explicit Load — remediation needs separate Implementation Authorization (Package A).

---

### PD-OTPREP-UAT-04 — Prepared vs Ready vs None

**PRODUCT OWNER DECISION:** Retain three operational states using existing statuses only:

| State | Meaning |
|-------|---------|
| **READY** | Finalised exist for ScheduleDate; not yet prepared / list not showing prepared |
| **PREPARED** | OTPrepared rows exist for ScheduleDate |
| **NONE** | No eligible Finalised for ScheduleDate |

Must not equate “No prepared list” with ready Finalised cases. Concise operational terminology. No new FSM status values.

---

### PD-OTPREP-UAT-05 — Prepared OT List operational grid

**PRODUCT OWNER DECISION:** Upgrade from passive joined-line rows to a professional operational grid using **existing** authoritative fields; reuse Finalization / Hospital Portal table patterns.

Minimum fields to evaluate/use if already available:

SequenceNo · Patient Name · UHID · Procedure · Eye · Surgery Time / StartTime · Surgeon · Theatre · Status · Action  

PreparedAt / PreparedBy optional if already mapped — no new data contracts.

Must not invent clinical/operational/ownership fields or a preparation entity. Grid remains presentation of existing OTPrepared data.

Requirements: aligned columns · predictable row height · hierarchy · readable time/theatre/sequence · clear prepared status · aligned actions · responsive · keyboard accessible · existing visual language · **not** a second worklist.

---

### PD-OTPREP-UAT-06 — Reopen / surgery date change

**PRODUCT OWNER DECISION:** **Do not** permit direct surgery-date modification while OTPrepared.

Certified path:

```text
OTPrepared → Reopen → Confirmed → Finalize Surgery edit → Confirm / Finalise again
```

Do not add: Change Surgery Date · Edit Surgery Date · direct OTPrepared mutation/reschedule.

Do not change GuardLocked · Upsert · FSM in this decision family.

**PD-OTPREP-10** remains a **separate** implementation-authorization track (Upsert/GuardLocked enforcement). Future UX may improve discoverability of Reopen → Finalize edit **without** a new mutation path.

---

### PD-OTPREP-UAT-07 — Reopen UX

**PRODUCT OWNER DECISION:** Keep current Reopen behavior:

- immediate  
- no confirmation dialog required  
- OTPrepared → Confirmed  
- preserve SequenceNo · PreparedAt · PreparedBy  

Do not add confirmation merely for symmetry with Cancel. Copy may be refined (UAT-09) without changing the transition.

---

### PD-OTPREP-UAT-08 — Print (**DEDICATED PRINT**)

**PRODUCT OWNER DECISION:** OT Preparation requires **dedicated functional Print remediation**.

**FACT:** Current toolbar uses `window.print()` on the SPA — **not** a sufficient certified OT Preparation print workflow.

Remediation direction:

- Print prepared OT list for the **selected surgery date** via a **dedicated print representation**  
- Suitable for hospital operational use  
- Must **not** print app chrome / sidebar / unrelated dashboard / unrelated Finalize tabs  
- Use existing authoritative prepared-list data  
- Reuse existing Hospital Portal / Finalization print patterns where suitable  
- No new backend source merely for Print if prepared-list data suffices  

**Implementation Authorization for Print = NONE in this document** — requires **separate** Package B authorization before coding.

---

### PD-OTPREP-UAT-09 — Content / copy

**PRODUCT OWNER DECISION:** Remove unnecessary instructional / AI-like wording. Use concise hospital operational language.

Preferred: Ready for OT preparation · Prepared · No eligible surgeries · Load OT List · Prepare New List · Reopen · Surgery Date · Prepared OT List  

Avoid: “Use Load OT List to view…” · “Use Prepare New List when ready…” · “Your selected surgery date…” · conversational / AI-assistant explanations · redundant instructional paragraphs  

Preserve certified terms such as **Finalised** where the application already uses them.

---

### PD-OTPREP-UAT-10 — Visual / layout quality

**PRODUCT OWNER DECISION:** Authorize **bounded** UX refinement of OT Preparation presentation (still requires separate Implementation Authorization to code).

Goals: reduce whitespace · improve hierarchy · date navigation clarity · control alignment · prepared-list columns · operational scanning · responsive · preserve design system · accessibility · healthcare-grade density  

Do not introduce: new theme · new visual language · new component library · decorative dashboard · unnecessary KPI expansion · excessive cards · AI-generated explanatory copy  

---

### PD-OTPREP-UAT-11 — Ownership / work allocation

**PRODUCT OWNER DECISION:** No ownership changes.

Preserve: no CounselorId · no OTPreparationOwnerId · no My OT Preparation · no My Finalize · no Assign/Reassign/ReQueue · no Supervisor · no new ownership entity  

---

### PD-OTPREP-UAT-12 — SequenceNo

**PRODUCT OWNER DECISION:** No SequenceNo rule change. Preserve current behavior.

Do not implement: auto-continuation · append algorithm · renumbering · gap filling · concurrency redesign  

**PD-OTPREP-06** remains separately governed.

---

### PD-OTPREP-UAT-13 — Timezone

**PRODUCT OWNER DECISION:** No timezone redesign. Preserve ScheduleDate semantics.

Do not alter: UTC storage · StartTime · ScheduleDate calculation · date normalization  

**PD-OTPREP-08** remains separately governed.

---

### PD-OTPREP-UAT-14 — Database / index

**PRODUCT OWNER DECISION:** No database changes.

Do not create/drop/alter indexes · constraints · schema  

**PD-OTPREP-09** remains separately governed.

---

### PD-OTPREP-UAT-15 — FSM / OTPrepared mutation

**PRODUCT OWNER DECISION:** No FSM changes in this decision family.

Preserve:

```text
NotConfirmed → Confirmed → Finalised → OTPrepared → SurgeryDone
(+ existing Cancel / Reopen)
```

**PD-OTPREP-10** remains a separate implementation-authorization track.

---

## 8. Explicit out of scope (not authorized by this recording)

SequenceNo / late-add / append · past-date policy · timezone redesign · DB/index · OTPrepared direct date mutation · GuardLocked/Upsert changes · new FSM · ownership · new worklist/entity · Phase 3I · Slice 14 · Phase 3J · C-01 · Phase2X · new permissions · financial/insurance/clinical workflow changes  

---

## 9. Implementation authorization boundary

**IMPLEMENTATION AUTHORIZATION:** Package A UX remediation is authorized separately in `finalize-surgery-ot-preparation-uat-remediation-package-a-implementation-authorization.md`. **This Product Decision document alone does not authorize coding.** Package B / C remain unauthorized.

### Future packages

| Package | Scope | Status |
|---------|-------|--------|
| **A — OT Preparation UX** | Relative labels · catalog refinement · **auto-load READ** · Ready/Prepared/None · operational grid · copy · density/responsive | **IMPLEMENTATION AUTHORIZED** — see Package A Implementation Authorization (**implementation not started**) |
| **B — OT Preparation Print** | Dedicated prepared-list print | **NOT AUTHORIZED** |
| **C — PD-OTPREP-10** | OTPrepared reschedule enforcement · GuardLocked/Upsert alignment · related UX | **NOT AUTHORIZED** |

---

## 10. Package 1 protection

Package 1 remains **IMPLEMENTED** · Manual UAT **IN PROGRESS** · Acceptance **NOT RECORDED**.

Do not reopen or alter: Reporting Time Confirm · Cancel confirmation/reason · Needs Attention · Awaiting Finalise · Avg Wait removal · OTPrepared Reopen-only UI · Reopen metadata retention · Finalised edit → NotConfirmed · ownership boundaries  

---

## 11. Discoverability / UAT / acceptance status

| Item | Status |
|------|--------|
| PD-OTPREP-01…05 implementation | **COMPLETE** (unchanged by this recording) |
| Discoverability Manual UAT | **IN PROGRESS / NOT ACCEPTED** |
| Discoverability Acceptance | **NOT RECORDED** |
| Remediation UAT PASS | **NOT CLAIMED** |
| Remediation accepted / closed | **NOT CLAIMED** |

---

## 12. Control flags

```text
PRODUCT DECISION: RECORDED
IMPLEMENTATION BY THIS TASK: NONE
IMPLEMENTATION AUTHORIZATION: PACKAGE A ONLY (separate artifact) · PACKAGE B/C: NO
PRODUCTION CHANGES: NONE
API CHANGES: NONE
DB CHANGES: NONE
PERMISSION CHANGES: NONE
ROUTE CHANGES: NONE
FSM CHANGES: NONE
OWNERSHIP CHANGES: NONE
PACKAGE 1: UNCHANGED
DISCOVERABILITY UAT: NOT ACCEPTED
ACCEPTANCE: NOT RECORDED
MANUAL UAT EXECUTED BY THIS TASK: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
```

---

## 13. Sign-off

| Role | Action | Status |
|------|--------|--------|
| Product Owner | PD-OTPREP-UAT-01…15 recorded | **RECORDED 2026-09-23 — name not supplied** |
| Engineering | Await separate Implementation Authorization | **NOT STARTED** |
| QA / UAT | Continue Manual UAT; remediation not accepted | **IN PROGRESS** |
| Acceptance | Explicit recording later | **NOT RECORDED** |

---

## 14. Next gate

```text
PRODUCT DECISION (this artifact) ✓
        ↓
PACKAGE A IMPLEMENTATION AUTHORIZATION ✓
  (`finalize-surgery-ot-preparation-uat-remediation-package-a-implementation-authorization.md`)
        ↓
PACKAGE A IMPLEMENTATION (separate task)
        ↓
AUTOMATED TESTS
        ↓
MANUAL UAT
        ↓
ACCEPTANCE
```

Package B / C still require separate Implementation Authorization.

**STOP.** Do not implement auto-load, Print, grid, relative labels, Reopen/reschedule, or FSM changes from the Product Decision recording alone — use Package A Implementation Authorization for A-scope only.

---

**Final state**

```
PRODUCT DECISION: RECORDED
IMPLEMENTATION: NONE BY THIS TASK
IMPLEMENTATION AUTHORIZATION: PACKAGE A YES (separate artifact) · B/C NO
MANUAL UAT: NOT EXECUTED BY THIS TASK
ACCEPTANCE: NOT RECORDED

NEXT GATE:
BOUNDED PACKAGE A IMPLEMENTATION (under Package A Implementation Authorization)
```
