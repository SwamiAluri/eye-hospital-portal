# Finalize Surgery + OT Preparation
# Revised Responsibility Model Audit
# Manual UAT-driven workflow vs certified RESP A–J implementation

| Field | Value |
|-------|--------|
| **Document type** | **AUDIT ONLY — NO IMPLEMENTATION** |
| **Audit ID** | OTPREP-REVISED-RESP-AUDIT-2026-09-23 |
| **Date prepared** | 2026-09-23 |
| **Program** | Hospital Portal — Finalize Surgery / OT Preparation |
| **Mode** | Post–Manual UAT revised-intent audit |
| **Production code / API / DB / permissions / routes / FSM / ownership modified** | **NO** |
| **Product Decision created by this audit** | **NO** — identifies required decisions only |
| **Implementation Authorized** | **NO** — new model not authorized |

---

## 1. Audit purpose

Manual UAT review of the **Responsibility Remediation A–J** implementation found the OT Preparation UX operationally too complex and misaligned with the intended workflow.

Observed UAT friction (current UI):

- ScheduleDate input  
- Multiple date pills / catalog  
- Today / Tomorrow relative presentation  
- Preparation metrics  
- “OT list already prepared” / completion summary  
- View OT Prepared as primary post-prepare path  
- Date-centric preparation workspace  

**New UAT-driven product intent (PROPOSED — not approved):**

```text
Surgery Finalization (Finalised remains authoritative there)
        ↓
OT Preparation = Finalised worklist (Finalization-style search/filter)
        ↓
User selects one / several / all eligible surgeries
        ↓
Prepare OT → confirm
        ↓
Selected → OTPrepared
        ↓
Surgery Finalization → OT Prepared (authoritative prepared review)
```

This audit compares:

1. Certified RESP Product Decision + IA + implemented A–J behavior  
2. Existing Finalization Finalised / Prepare / date-edit capabilities  
3. New desired worklist + selection workflow  

**STOP:** Do not implement. Do not silently amend A–J code to satisfy the new intent.

---

## 2. Current certified baseline

### 2.1 Governance chain (RESP)

| Artifact | Status |
|----------|--------|
| `docs/audits/finalize-surgery-ot-preparation-responsibility-audit.md` | COMPLETE |
| `docs/product-decisions/finalize-surgery-ot-preparation-responsibility-product-decision.md` | **RECORDED — 10 DECIDED** |
| `docs/product-decisions/finalize-surgery-ot-preparation-responsibility-implementation-authorization.md` | **AUTHORIZED A–J** |
| `docs/product-decisions/finalize-surgery-ot-preparation-responsibility-implementation-report.md` | Implementation reported COMPLETE |

### 2.2 Recorded RESP selections (binding until superseded)

| ID | Selection | Essence |
|----|-----------|---------|
| RESP-01 | **B** | OT Prep = preparation-only for **selected ScheduleDate** |
| RESP-02 | **B** | Finalization → OT Prepared = authoritative prepared worklist |
| RESP-03 | **B** | No duplicate OTPrepared grid on OT Prep |
| RESP-04 | **A** | Ready = Finalised + ScheduleDate day match |
| RESP-05 | **A** | Prepare **ALL** remaining eligible Finalised for date; **no subset UI** |
| RESP-06 | **B** | Completion summary after Prepare (no prepared grid) |
| RESP-07 | **B** | View OT Prepared → Finalization OT Prepared |
| RESP-08 | **B** | Preparation-oriented metrics |
| RESP-09 | **A** | Actual ScheduleDate catalog retained |
| RESP-10 | **A** | None / no-eligible family |

### 2.3 Explicit RESP-05 prohibition (critical)

Certified:

> Prepare New List prepares **ALL remaining eligible Finalised** for the selected ScheduleDate.  
> **No** checkboxes · row selection · deselect · partial preparation.

The new UAT intent requires the **opposite** selection model. That is a **Product Decision conflict**, not an implementation bug.

---

## 3. Current implementation behavior (FACT)

Primary surface:  
`apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`

Helpers:  
`ot-preparation-surgery-date-catalog.ts` · `prepare-ot-date-scope.ts`

| Behavior | Current A–J implementation |
|----------|----------------------------|
| OT Prep purpose | Date-scoped “Prepare Finalised surgeries for OT” |
| Date UX | Date input + actual ScheduleDate catalog pills + Today/Tomorrow labels |
| Metrics | Ready for OT Preparation · Dates requiring preparation |
| Main body | Finalised-for-selected-date ready grid **or** completion / already-prepared summary |
| Prepare | List-level Prepare New List → modal maps **all** eligible for date → `submitPrepareOtList` |
| Selection UI | **None** (explicitly forbidden by RESP-05 / IA) |
| Post-Prepare | Completion summary + View OT Prepared |
| Already prepared | Summary + View OT Prepared; no prepared grid |
| getOtList on OT Prep | **Not used** (removed under RESP-03) |
| Finalization worklist | Unchanged status tabs + date/UHID/name filters + WorkRow + pagination |

---

## 4. New desired workflow (PROPOSED — not approved)

```text
OT Preparation
  [Finalization-style search/filter]
  Finalised surgery worklist
  Selection | Surgery Date | UHID | Patient | Procedure | Eye |
  Surgery Time | Surgeon | Theatre | existing fields
  [Prepare OT]
  → confirm
  → selected become OTPrepared
  → review on Finalization → OT Prepared
```

Explicit product intent additions vs RESP A–J:

| Intent | vs RESP |
|--------|---------|
| Finalization-style Finalised worklist, not date dashboard | Conflicts RESP-01 date-centric wording · RESP-08/09 presentation |
| Search/filter Finalised across worklist | Conflicts date-only queue presentation |
| Select one / several / all / deselect | **Conflicts RESP-05** |
| Edit surgery date when required | Not covered by RESP; Finalization edit rules apply |
| No date pills / Today-Tomorrow as primary UX | Conflicts RESP-09 presentation mandate |
| Completion / View OT Prepared as primary OT Prep UX | May be narrowed; RESP-06/07 currently require them |

---

## 5. Finalization worklist reuse findings

### Answers to audit questions

| # | Question | Finding |
|---|----------|---------|
| 1 | What renders Finalised worklist? | **Same page** — not a separate package. Status tab `Finalised` filters `records`; rows rendered by inline `WorkRow` in `finalize-surgery/page.tsx` |
| 2 | API / read model? | `useFinalizeListQuery` → `counsellorsDeskApi.getFinalizeList` / Counseling OT schedule list. Multi-status; FE filters by `activeTab` |
| 3 | Filters? | Status pill tabs (`All`, `NotConfirmed`, `Confirmed`, `Finalised`, `OTPrepared`, …) + toolbar date / UHID / name |
| 4 | Search fields? | UHID · Patient Name (toolbar) |
| 5 | Surgery Date / UHID / Name? | `filters.date` · `filters.uhid` · `filters.name` (debounced) passed to list query; status is client tab filter on loaded set |
| 6 | Pagination? | Client-side `WaitingListQueuePagination` on filtered rows |
| 7 | Row actions? | Primary CTA by status (`resolveFinalizeQueuePrimaryAction`); Print OT slip; open details |
| 8 | Open / edit? | `openRow` → `FinalizeOtModal` |
| 9 | Surgery Date update? | Inside `FinalizeOtModal` via surgery date control + `updateOtDetails` (see §7) |
| 10 | Reusable pieces? | Same list query · same filters · same `WorkRow` / modal · same Prepare mutation API · **no** standalone Finalised worklist component to import |
| 11 | Same data source without duplicate worklist? | **YES** — OT Prep can bind the same finalize list filtered to `Finalised` (presentation-only). Must not invent a second entity/route |
| 12 | Can Finalised worklist component be reused safely? | **No extractable shared component today** — logic is page-local. Reuse = compose same page patterns / extract presentation later |
| 13 | Smallest extraction if needed? | Optional future extraction of filter toolbar + `WorkRow` list; **not required** to prove feasibility. Prefer in-page composition under OT Prep workspace without new route |

**FACT:** Finalization → Finalised and OT Preparation would share one SoT (ot finalize schedule rows) if OT Prep shows Finalised filter of the same list. That aligns with “no new worklist entity” if presentation is a view, not a second queue SoT.

---

## 6. Existing data-source findings

| Source | Role |
|--------|------|
| Finalize list (`getFinalizeList`) | Authoritative multi-status queue including Finalised + OTPrepared |
| Catalog query (unfiltered date) | Used by A–J for ScheduleDate catalog / metrics |
| `getOtList` | OTPrepared-by-date READ; unused by OT Prep after RESP-03; still available for other consumers |
| `submitPrepareOtList` | Mutation Finalised → OTPrepared for submitted items |
| `updateOtDetails` | Edit details including StartTime/schedule date |

No new endpoint is **required** merely to *list* Finalised rows for OT Prep.

---

## 7. Surgery-date editing findings

| Question | Finding |
|----------|---------|
| Supported for Finalised? | **YES** via `FinalizeOtModal` when not locked |
| UI | Open row → modal → Surgery Date field (`finalize-ot-surgery-date`) when editable |
| API | `counsellorsDeskApi.updateOtDetails` → backend UpdateDetails |
| Validation | FE modal `validate()`; BE field updates + business guards |
| FSM on edit of Finalised / Confirmed | **Documented + implemented:** edit resets status to **`NotConfirmed`**, unlocks (`OtFinalizeService` UpdateDetails ~L1167–1173; `IOtFinalizeService` comment) |
| Changing date from Finalization | Same UpdateDetails path; StartTime change can notify rebook |
| Reuse from OT Prep? | **Technically** by opening the same `FinalizeOtModal` on a Finalised row — **no new date-edit API** |
| New authorization needed? | **YES for product scope** if OT Prep is to advertise date editing as part of the Prepare workflow. Mechanism exists; RESP A–J did **not** authorize surfacing edit as an OT Prep job. Also: after date edit, case is **no longer Finalised** until re-Confirm/Finalise — critical UX/FSM consequence |

**PRODUCT DECISION REQUIRED:** Whether OT Prep may open Finalization edit modal; whether operators understand Finalised → NotConfirmed on date change; whether Prepare is blocked until re-Finalised (already true — Prepare requires Finalised).

---

## 8. Prepare selection / API findings

### 8.1 Contract (FACT)

```text
PrepareOtListRequest {
  Date: DateTime   // surgery date required (FS-02)
  Items: [{ ScheduleId, Sequence, NewStartTime? }]
  PreparedBy?
}
```

FE: `PrepareOtListPayload { date, items: PrepareOtListItem[] }`

### 8.2 Answers

| # | Question | Finding |
|---|----------|---------|
| 1 | What does submit accept? | Date + explicit `Items` list |
| 2 | Explicit surgery IDs? | **YES** — `ScheduleId` per item |
| 3 | Does BE prepare all eligible regardless of IDs? | **NO** — prepares **submitted** IDs only (after validation) |
| 4 | Validates every submitted? | **YES** — must exist, Finalised, StartTime in `[Date, Date+1)` |
| 5 | Partial selections technically supported? | **YES at API** — subset of IDs can be submitted |
| 6 | One invalid selected? | Request fails (exception) for not-Finalised / out-of-date-scope / conflicts |
| 7 | Transactional? | Single `SaveChangesAsync` after in-memory mutations — all-or-nothing for the batch once validation passes |
| 8 | Already OTPrepared items? | Rejected if submitted (not Finalised); existing OTPrepared on same date used for **slot conflict** check vs batch |
| 9 | SequenceNo? | From request `Sequence` map; assigned on Prepare |
| 10 | Audit? | `AddAuditAsync(..., "Prepare", ...)` per entity |
| 11 | FSM? | Finalised → OTPrepared; `IsLocked = true` |
| 12 | Multiple selected? | Batch loop over submitted entities |
| 13 | Concurrency/version? | Entity `Version++` on prepare; no optimistic concurrency check on the prepare batch equivalent to session Version gates |
| 14 | Existing UI selection? | **NO** OT Prep / Finalize UI for multi-select prepare. Modal submits **all** `finalisedRecords` for prepare date. No checkboxes in Finalize Surgery OT flow |

### 8.3 Classification for new selection UX

| Aspect | Class |
|--------|-------|
| Submit selected IDs only | **A / B** — existing API supports; FE adaptation |
| Confirm dialog before Prepare | **B** — FE presentation |
| Select All / checkboxes | **B** — FE only, but **E** — blocked by RESP-05 until PD supersedes |
| Cross-date multi-select in one Prepare | **C/D/E** — request still requires **one** `Date`; all items must fall on that date. Cross-date selection **not** supported by current contract without API redesign |

**CRITICAL:** Desired “select any Finalised across dates” **cannot** be one Prepare call today. Options requiring PD:

1. Restrict selection to a single surgery date (filter or validation)  
2. Change API to multi-date prepare (**not authorized**)  
3. Multiple Prepare calls (**product/FSM risk — PD required**)

---

## 9. FSM findings

Unchanged certified FSM:

```text
NotConfirmed → Confirmed → Finalised → OTPrepared → SurgeryDone
Any → Cancelled
OTPrepared → Confirmed (Reopen)
```

Prepare: Finalised → OTPrepared.  
Date/details edit on Finalised: → NotConfirmed.

No new FSM states required for selection UX.  
Do not invent ReadyForPreparation / PreparationComplete.

---

## 10. SequenceNo findings

Assigned at Prepare from request sequences.  
RESP / PD-OTPREP-06 late-add / continuation remains separately governed.  
Selection UX must not redesign SequenceNo.  
Modal today assigns 1..N for submitted set — subset selection would still supply sequences for that subset only (**PD** may need to clarify numbering vs existing prepared list — related to PD-OTPREP-06).

---

## 11. Audit (event) findings

Prepare writes “Prepare” audit per row.  
UpdateDetails writes “UpdateDetails” with status transition snapshot.  
No ownership/CounselorId mutation in Prepare path (preserved).

---

## 12. Ownership findings

Proposed worklist+selection model does **not** inherently require:

- CounselorId  
- Assign / Reassign / Requeue  
- My Work  

Consistent with locked non-owned OT Prep model **if** PD confirms shared queue selection (not personal inbox).

---

## 13. Permission findings

Prepare / mutate already gated by existing Finalize OT mutate permission (`FINALIZE_OT_MUTATE_PERMISSION` / `counseling_sessions.update` family).  
No evidence new permission codes are required for FE selection of the same Prepare API.  
Do not invent roles.

---

## 14. Product Decision conflicts

### 14.1 Matrix vs RESP-04…10 and related

| Decision | Status vs new intent | Notes |
|----------|----------------------|-------|
| **RESP-01** | **Narrow / supersede required** | Still “preparation-only” OK; **date-selected ScheduleDate workspace** wording conflicts with Finalization-style Finalised worklist |
| **RESP-02** | **PRESERVE** | Finalization → OT Prepared remains authoritative prepared review — aligns |
| **RESP-03** | **PRESERVE** | No duplicate prepared grid on OT Prep — aligns |
| **RESP-04** | **Narrow / revisit** | Day-match Ready predicate remains valid for eligibility; may no longer be the primary “selected date queue” UX |
| **RESP-05** | **SUPERSEDE REQUIRED** | All-eligible / no subset UI **conflicts** with select one/several/all |
| **RESP-06** | **Revisit** | Completion summary may remain or be replaced by stay-on-worklist + toast; PD must choose |
| **RESP-07** | **Revisit / optional** | View OT Prepared may remain convenience; not required as primary if operators use Finalization tab |
| **RESP-08** | **SUPERSEDE / remove presentation** | Metrics strip conflicts with “not a date-dashboard” |
| **RESP-09** | **SUPERSEDE / remove presentation** | Catalog pills / Today-Tomorrow as primary OT Prep navigation conflicting |
| **RESP-10** | **Narrow** | None state becomes “no Finalised matching filters” rather than date-catalog None |

### 14.2 Prior Package A / UAT scopes

Already superseded/narrowed by RESP for prepared-grid.  
New intent further moves away from date-catalog discoverability presentation.  
Do not erase historical Package A / RESP A–J records; record new PD supersession explicitly.

---

## 15. Date-centric feature classification (remove? — audit only)

| Feature | Classification |
|---------|----------------|
| ScheduleDate catalog / date pills | **B** presentation-only under RESP-09 · **D** depends on RESP-09 · **E** needs PD to remove |
| Today / Tomorrow labels | **B** · **D** RESP-09 · **E** to remove as primary UX |
| Dates requiring preparation metric | **B** · **D** RESP-08 · **E** to remove |
| Ready for OT Preparation metric | **B** · **D** RESP-08 · **E** to remove or redefine |
| Already-prepared OT Prep summary | **B** · **D** RESP-06 Case D · **E** to remove/replace |
| Completion summary | **B** · **D** RESP-06 · **E** |
| View OT Prepared primary path | **B** · **D** RESP-07 · **E** (may keep as optional) |
| Selected-date preparation queue | **D** RESP-01/04 · **E** to replace with Finalised worklist |
| Date-centric empty states | **D** RESP-10 · **E** |
| Prepare all-for-date semantics | **C** certified RESP-05 · **E** to change to selected |
| Finalization Finalised/OTPrepared | **A/C** must remain |
| FSM / SequenceNo / Prepare API shape | **A/C** must remain unless separate PD |
| Actual StartTime → ScheduleDate SoT | **A/C** must remain |

**Do not remove any of the above without a new Product Decision + IA.**

---

## 16. API / backend gap analysis

| Desired capability | Class |
|--------------------|-------|
| Show Finalised worklist with Finalization filters | **B** — FE reuse of finalize list |
| Search UHID / name / date | **B** — existing filters |
| Open row → edit via FinalizeOtModal | **B** — reuse; **E** for OT Prep product scope |
| Prepare selected IDs (same surgery date) | **A/B** API · **E** RESP-05 |
| Select All visible | **B** · **E** |
| Confirm dialog | **B** · **E** (confirm semantics) |
| Prepare selected across **multiple** ScheduleDates in one action | **D/E** — current API requires single `Date` |
| New selection entity / permissions / FSM | **Not required** if PD stays shared-queue |

If implementation appears to need Class C/D: **STOP** — not authorized by this audit.

---

## 17. Test impact (identify only — do not modify)

| Test area | Impact if new PD approved |
|-----------|---------------------------|
| `ot-preparation-surgery-date-catalog.test.ts` | Many RESP date-dashboard / no-checkbox page contracts become obsolete or rewritten |
| `prepare-ot-date-scope.test.ts` | Retain eligibility helper; may still scope by date for Prepare payload |
| Finalization / package1 / auth / FSM | **Retain** — should not change |
| `e2e/finalize-surgery-ot-discoverability.spec.ts` | RESP journeys (catalog, metrics, completion, no prepared grid) need replacement journeys |
| Prepare mutation unit | Update expectations from “all for date” to “selected IDs” **after** PD |
| Package A historical prepared-grid tests | Already superseded by RESP; further obsolescence of date-catalog assertions |

Obsolete **only after** new Product Decision + IA — not now.

---

## 18. Proposed responsibility model (PROPOSED — NOT APPROVED)

```text
OT PREPARATION (proposed)
  = Finalised operational preparation queue
  = Finalization-style filters + multi-select + Prepare OT
  ≠ date dashboard
  ≠ prepared operational worklist

SURGERY FINALIZATION → Finalised
  = authoritative Finalised journey / edit / confirm-finalise path

SURGERY FINALIZATION → OT Prepared
  = authoritative prepared review (RESP-02 preserved)
```

This section is **PROPOSED** only. It does **not** authorize coding.

---

## 19. Exact Product Decisions required

Before any implementation of the new UAT intent, Product Owner must record decisions covering at least:

| Proposed ID (suggested) | Topic |
|-------------------------|-------|
| **PD-OTPREP-RESP2-01** | OT Prep presentation: Finalised worklist vs date-centric catalog (supersede/narrow RESP-01/08/09) |
| **PD-OTPREP-RESP2-02** | Prepare selection semantics: selected subset vs all-eligible (explicitly **supersede RESP-05**) |
| **PD-OTPREP-RESP2-03** | Select All / visible-only / filter-scoped selection rules |
| **PD-OTPREP-RESP2-04** | Same-date constraint for a Prepare batch (given API single `Date`) |
| **PD-OTPREP-RESP2-05** | Confirm dialog requirements |
| **PD-OTPREP-RESP2-06** | Post-Prepare UX (stay on worklist vs completion summary vs RESP-06/07) |
| **PD-OTPREP-RESP2-07** | Whether OT Prep may open FinalizeOtModal for date/details edit |
| **PD-OTPREP-RESP2-08** | Acknowledgement of Finalised → NotConfirmed on edit |
| **PD-OTPREP-RESP2-09** | Metrics / catalog / Today-Tomorrow disposition (remove vs retain) |
| **PD-OTPREP-RESP2-10** | SequenceNo assignment for partial prepare vs existing prepared rows (coordinate PD-OTPREP-06) |

Names are suggestions; Product Owner may use another decision family.  
**Do not implement until decisions are recorded and a new IA is issued.**

---

## 20. Exact items that remain unchanged (unless future PD says otherwise)

- FSM  
- SequenceNo generation rules (pending only PD-OTPREP-06 late-add)  
- Ownership / CounselorId / Assign / My Work  
- Permissions model  
- Prepare API contract shape (Date + Items)  
- Finalization → Finalised workflow  
- Finalization → OT Prepared operational capabilities  
- No new route / no new OT entity  
- Package B Print · Package C PD-OTPREP-10  

---

## 21. Implementation authorization impact

| Item | Status |
|------|--------|
| RESP A–J IA | Remains historical authorization for **prior** model |
| New worklist + selection UX | **NOT AUTHORIZED** by RESP A–J IA |
| Silent modification of A–J to add checkboxes | **FORBIDDEN** |
| Required next gate | New Product Decision recording → new bounded Implementation Authorization |

```text
IMPLEMENTATION AUTHORIZATION FOR NEW MODEL: NOT CREATED / NOT AUTHORIZED
```

---

## 22. UAT disposition

| Item | Status |
|------|--------|
| Manual UAT of A–J date-centric UX | **PAUSED** — found operationally misaligned |
| A–J Acceptance | **NOT RECORDED** |
| New model UAT | **Blocked** pending Product Decision + IA + implementation |

---

## 23. Conflict summary (existing RESP vs new request)

| Theme | Certified RESP | New UAT intent | Conflict? |
|-------|----------------|----------------|-----------|
| Primary OT Prep UX | Date-selected preparation queue + catalog | Finalization-style Finalised worklist | **YES** |
| Prepare semantics | All eligible for date; no subset | Selected one/several/all | **YES — RESP-05** |
| Metrics / pills / Today-Tomorrow | Authorized presentation | Remove date-dashboard feel | **YES — RESP-08/09** |
| Post-Prepare | Completion + View OT Prepared | Worklist-centric (implied) | **Partial — RESP-06/07** |
| Prepared review | Finalization OT Prepared | Same | **NO** |
| No prepared grid on OT Prep | RESP-03 | Same | **NO** |
| API prepare-by-IDs | Supported | Needed | **NO gap** (same-date) |
| Cross-date single Prepare | Not supported | Possibly implied by worklist | **YES if intended** |
| Date edit | Via Finalization modal; resets to NotConfirmed | Desired when required | **PD + UX risk** |
| Ownership | None | None | **NO** |

---

## 24. Gate summary

| Gate | Status |
|------|--------|
| **AUDIT** | **COMPLETE** |
| **Implementation** | **NOT STARTED** (this task) |
| **Product Decision (new model)** | **REQUIRED** |
| **Implementation Authorization (new model)** | **NOT AUTHORIZED** |
| **Manual UAT** | **PAUSED** pending Product Decision |
| **Acceptance** | **NOT RECORDED** |

**STOP.**
