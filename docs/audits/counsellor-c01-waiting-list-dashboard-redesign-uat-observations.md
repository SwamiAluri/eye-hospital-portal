# Counsellor C-01 — Waiting List Dashboard Redesign
## Manual UAT Observations & Acceptance Readiness

> **SUPERSEDED FOR ACCEPTANCE / CLOSURE STATUS (2026-09-22)**  
> This artifact retains the **historical** Manual UAT recording where Area 7 (OT Returned) was **NOT ACCEPTED / OBSERVATION** and **C-01 ACCEPTED = NO**, **C-01 CLOSED = NO**.  
> Formal final Manual UAT **PASS**, **C-01 ACCEPTED = YES**, and **C-01 CLOSED = YES** are recorded in:  
> `docs/audits/counsellor-c01-waiting-list-dashboard-redesign-acceptance-closure.md`  
> Do **not** treat this file as the current acceptance/closure source of truth.

| Field | Value |
|-------|--------|
| **Date** | 2026-09-22 |
| **Mode** | **GOVERNANCE / DOCUMENTATION ONLY** — no production code, API, DB, permission, route, ownership, UI, test, or business rule modified |
| **Artifact type** | Final Manual UAT result recording + acceptance readiness (**historical** — superseded for acceptance/closure) |
| **Acceptance / closure recorded by this artifact** | **NO** (historical). See acceptance-closure artifact for current YES. |

---

## A. C-01 Identification

| Field | Value |
|-------|--------|
| **Initiative** | **C-01 — Counsellor Waiting List Dashboard Redesign** |
| **Matrix / screen** | C-WL |
| **Route** | `/dashboard/counsellors-desk/waiting-list` |
| **Approved Product Decision** | `docs/product-decisions/counsellor-c01-waiting-list-dashboard-redesign-product-decision.md` |
| **Product Decision status** | **APPROVED** (PD-C01-01 … PD-C01-06 SELECTED / APPROVED) |
| **Implementation status** | **COMPLETE** |
| **Automated tests** | Completed during implementation — **not a substitute for Manual UAT** |
| **Manual UAT status** | **SUBSTANTIALLY COMPLETE — OT RETURNED OUTSTANDING** |
| **C-01 ACCEPTED** | **NO** |
| **C-01 CLOSED** | **NO** |

### Why C-01 is not yet accepted

Manual UAT recorded **PASS** for Areas **1–6** and **8–15** (14 of 15 areas).

Area **7 — OT Returned** is **NOT ACCEPTED / OBSERVATION** because the surface lacks an explicit **operational resolution** action. That concern is classified as a **future Product Decision**, not a C-01 coding defect.

Until Area 7 is resolved by Product Decision (and any subsequent authorized work + UAT), or Product explicitly accepts C-01 with Area 7 waived as out-of-scope observation:

- Formal C-01 acceptance is **not** recorded.  
- Formal C-01 closure is **not** recorded.  
- This artifact does **not** claim that C-01 has passed all UAT.

### Governance framing (unchanged)

- C-01 is a **standalone bounded UX package**.  
- **Phase 3I remains formally closed.**  
- **Slice 13 remains closed.**  
- **Slice 14 does not exist.**  
- **Phase 3J is not created.**  
- The OT Returned observation does **not** reopen ownership / work-allocation work.

---

## B. Final Manual UAT Checklist

| # | UAT Area | Result |
|---|----------|--------|
| 1 | Page composition | **PASS** |
| 2 | Summary / KPI hierarchy | **PASS** |
| 3 | Filters / search | **PASS** |
| 4 | Patient rows | **PASS** |
| 5 | Owner presentation | **PASS** |
| 6 | Pre-Auth presentation | **PASS** |
| 7 | OT Returned | **NOT ACCEPTED / OBSERVATION** |
| 8 | Patient detail | **PASS** |
| 9 | Pagination | **PASS** |
| 10 | URL state | **PASS** |
| 11 | Loading / empty / error | **PASS** |
| 12 | Responsive behavior | **PASS** |
| 13 | Accessibility | **PASS** |
| 14 | Add Patient referral | **PASS** |
| 15 | Ownership regression | **PASS** |

| Metric | Value |
|--------|--------|
| **PASS areas** | **14** (Areas 1–6, 8–15) |
| **NOT ACCEPTED / OBSERVATION** | **1** (Area 7 — OT Returned) |
| **FAIL** | **0** |
| **Overall Manual UAT** | **SUBSTANTIALLY COMPLETE — OT RETURNED OUTSTANDING** |

Area 7 is **not** converted to PASS.

---

## C. OT Returned — Final UAT Record

| Field | Content |
|-------|---------|
| **UAT area** | Area 7 — OT Returned |
| **Result** | **NOT ACCEPTED / OBSERVATION** |
| **Classification** | **FUTURE PRODUCT DECISION REQUIRED** |

### A. Current presentation (reviewed — visually usable)

Manual UAT confirmed the current OT Returned presentation is visually usable:

- OT Returned is **clearly separated** from the normal counselling queue.  
- **IP journey projection** labeling is clear (not presented as a Waiting List lifecycle status).  
- **Return reason** is visible.  
- **Surgery date** is visible.  
- Existing **Re-plan / Open journey** navigation works as a navigation action into existing surfaces.

### B. Operational workflow concern

The current surface does **not** provide an explicit **operational resolution** action for an OT-returned patient.

The desired future workflow has **NOT** yet been selected.

Potential examples only (**not selected**):

- ReQueue  
- Repeat Counselling  
- Return to Waiting List  
- Continue / Resume Counselling  
- another approved operational transition  

These are examples only. **Do not select one** in this artifact.

### Classification — what this is / is not

| This IS | This is NOT |
|---------|-------------|
| **FUTURE PRODUCT DECISION REQUIRED** | An implementation defect |
| An operational workflow concern beyond C-01 presentation scope | An API defect |
| Consistent with C-01 intentional OT boundary | An ownership defect |
| | A UI rendering defect |
| | A C-01 coding defect |
| | A Phase 3I defect |

### Why this is not a C-01 defect

The approved C-01 Product Decision authorized **presentation-focused** OT Returned treatment and explicitly:

- preserved OT Returned as an **IP-journey projection**  
- **prohibited** converting OT Returned into a Waiting List lifecycle status  
- **prohibited** OT workflow redesign within C-01  

C-01 intentionally did **not** authorize a new OT → Counselling lifecycle transition. The absence of a new resolution CTA is therefore **within approved C-01 scope**, while remaining **NOT ACCEPTED** for overall C-01 delivery acceptance until Product decides the authoritative next action (or explicitly waives Area 7).

**No lifecycle transition should be added under C-01.**

---

## D. C-01 Scope Protection

The Area 7 observation does **NOT** authorize:

- ReQueue  
- Repeat Counselling  
- Return to Waiting List  
- Continue / Resume Counselling  
- any new OT Returned CTA  
- Counselor assignment  
- ownership mutation  
- `CounselorId` mutation  
- lifecycle / status mutation  
- OT state transition  
- Waiting List insertion  
- automatic return to Waiting List  
- API / DB / permission changes  
- new worklists / Dashboard / My Waiting List  
- Phase 3I reopen / Slice 14 / Phase 3J  

### Certified boundaries reaffirmed

| Boundary | Status |
|----------|--------|
| Waiting List remains shared | **LOCKED** |
| PD16 remains authoritative | **LOCKED** |
| `CounselorId` remains ownership SoT | **LOCKED** |
| Open / view / start does not establish ownership | **LOCKED** |
| ReQueue remains a Follow-up responsibility | **LOCKED** |
| ReQueue clears `CounselorId` to NULL where already certified | **LOCKED** |
| Sessions remains the active-work / RR remediation host | **LOCKED** |
| OT Returned remains an IP journey projection | **LOCKED** |
| OT Returned is not converted into a Waiting List lifecycle status | **LOCKED** |
| No duplicate operational worklist | **LOCKED** |
| No Counsellor Dashboard | **LOCKED** |
| No My Waiting List | **LOCKED** |
| Phase 3I remains closed | **LOCKED** |
| Slice 14 does not exist | **AFFIRMED** |
| Phase 3J is not created | **AFFIRMED** |

---

## E. Next Product Decision Required

## Next Product Decision Required

| Field | Value |
|-------|--------|
| **Title** | **OT Returned Operational Resolution** |
| **Decision status** | **NOT YET APPROVED** |
| **Authorized for implementation now** | **NO** |
| **C-01 defect?** | **NO** |
| **Phase 3I reopen?** | **NO** |

### Decision question

> When an OT-returned patient is surfaced to the Counsellor operational workspace, what is the authoritative next operational action?

### Example candidates only (not selected)

- ReQueue  
- Repeat Counselling  
- Return to Waiting List  
- Continue / Resume Counselling  
- another approved operational transition  

**No option is selected in this artifact.**

### The Product Decision must eventually determine

1. Does the patient re-enter Waiting List?  
2. Does the patient resume an existing counselling session?  
3. Is a new counselling session created?  
4. Does `CounselorId` become NULL?  
5. Is Ownership History written?  
6. Does the current counselor retain ownership?  
7. Is reassignment required?  
8. Does the action differ by OT return reason?  
9. Which role / persona can perform the action?  
10. Where should the action live?  
11. What is the resulting lifecycle state?  
12. What downstream workflow follows the action?  

These are **decision questions only**. They are **not** answered in this task. No implementation is authorized by this recording.

---

## F. Acceptance Gate

```text
C-01 IMPLEMENTATION:                    COMPLETE

C-01 MANUAL UAT:
SUBSTANTIALLY COMPLETE — OT RETURNED OUTSTANDING

C-01 ACCEPTANCE:                        NOT YET RECORDED
C-01 CLOSURE:                           NOT YET RECORDED

C-01 ACCEPTED:                          NO
C-01 CLOSED:                            NO

NEXT GOVERNANCE GATE:
PRODUCT DECISION — OT RETURNED OPERATIONAL RESOLUTION

IMPLEMENTATION AUTHORIZED BY THIS TASK: NO
```

### Prerequisites for a future C-01 acceptance / closure artifact

1. Product Decision on **OT Returned Operational Resolution** (or explicit Product waiver that Area 7 observation does not block C-01 acceptance).  
2. If a workflow is authorized: separate implementation + tests + Manual UAT of that scope (not under closed Phase 3I / not as silent C-01 expansion).  
3. Formal C-01 acceptance / closure artifact in a **separate** governance task.  

Until then: **do not** implement the OT Returned operational resolution workflow under this gate.

---

## G. Evidence / Source Index

| Source | Role |
|--------|------|
| `docs/product-decisions/counsellor-c01-waiting-list-dashboard-redesign-product-decision.md` | Approved C-01 scope; OT presentation only; no OT workflow redesign |
| This artifact (prior revision) | Earlier IN PROGRESS UAT observation capture |
| `docs/audits/counsellor-module-final-completion-audit.md` | Phase 3I closed; module context |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-program-product-decision.md` | Phase 3I formally closed (Option A) |
| Waiting List OT presentation / `ot-returned-action` | Context: existing Re-plan / Open journey navigation vs future resolution PD |
| Product / Operational Manual UAT (2026-09-22) | Final area results recorded in §B |

---

## Control Flags

| Flag | Value |
|------|--------|
| IMPLEMENTATION PERFORMED | **NO** |
| CODE / UI / API / DB / PERMISSIONS MODIFIED | **NO** |
| OWNERSHIP / LIFECYCLE MODIFIED | **NO** |
| OT RETURNED WORKFLOW / CTA IMPLEMENTED | **NO** |
| PRODUCT DECISION SELECTED FOR OT RESOLUTION | **NO** |
| AREA 7 CONVERTED TO PASS | **NO** |
| C-01 ACCEPTANCE / CLOSURE CREATED | **NO** |
| PHASE 3I REOPENED | **NO** |
| SLICE 14 / PHASE 3J CREATED | **NO** |
| ARTIFACT UPDATED | **YES** — this file only |

---

**END — C-01 FINAL MANUAL UAT RESULT RECORDING — STOP**
