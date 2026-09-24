# Finalize Surgery + OT Preparation
# Package C — PD-OTPREP-10
# FSM / Reopen-First Enforcement
# Implementation Authorization

| Field | Value |
|-------|--------|
| **Document type** | **IMPLEMENTATION AUTHORIZATION — GOVERNANCE ONLY** |
| **Package** | Finalize / OT Preparation — Package C (FSM / Reopen-First) |
| **Product Decision** | **PD-OTPREP-10** — Option A |
| **Status** | **IMPLEMENTATION AUTHORIZED — PACKAGE C ONLY** |
| **Date** | 2026-09-24 |
| **Audit basis** | Current repository inspection (this governance task) |
| **Implementation started by this task** | **NO** |
| **Production code / API / DB / permissions / routes / FSM / ownership / UI / tests modified by this task** | **NO** — this artifact is governance only |
| **Phase 3I** | **CLOSED** |
| **Slice 13** | **CLOSED** |
| **Slice 14** | **DOES NOT EXIST** |
| **Phase 3J** | **NOT CREATED** |
| **C-01** | **CLOSED** |
| **RESP2** | **ACCEPTED / CLOSED** |
| **Package LA** | **ACCEPTED / CLOSED** |
| **Bulk OT Slip Printing** | **UAT PASS / acceptance being recorded** (separate track — do not reopen) |
| **Package B Prepared List Print** | **Separate track** (implementation complete per Package B report; do not reopen) |
| **C-LA-04** | **DEFERRED** |
| **Package C implementation** | **NOT STARTED** |

---

## 1. Authorization statement

```text
This authorization permits implementation of PD-OTPREP-10 Option A ONLY:

  OTPrepared is locked.
  Direct schedule-date / StartTime mutation while OTPrepared
  must not be permitted.
  Reopen is the required recovery/edit path.

Certified user workflow (unchanged; do not invent a new date-edit path):

  OTPrepared
      ↓
  Reopen
      ↓
  Confirmed
      ↓
  Edit Surgery Details / ScheduleDate (existing Finalize modal)
      ↓
  Confirm / Finalise
      ↓
  OTPrepared again if subsequently prepared

PACKAGE C PD-OTPREP-10 IMPLEMENTATION AUTHORIZATION: YES
NEW API AUTHORIZATION: NO
NEW FSM STATE AUTHORIZATION: NO
NEW ENDPOINT AUTHORIZATION: NO
DTO REDESIGN AUTHORIZATION: NO (default)
DB / MIGRATION AUTHORIZATION: NO
PERMISSION CHANGE AUTHORIZATION: NO
OWNERSHIP CHANGE AUTHORIZATION: NO
RESP2 CHANGE AUTHORIZATION: NO
PACKAGE LA REOPEN: NO
PACKAGE B REOPEN: NO
BULK OT SLIP PRINTING REOPEN: NO
C-LA-04 IMPLEMENTATION: NO
PD-OTPREP-07 IMPLEMENTATION: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
C-01 REOPEN: NO
```

**Product Decision Gap check:** **NONE.**  
PD-OTPREP-10 Option A + existing `GuardLocked` mechanism cover the required rule. No additional Product Decision is required to issue this IA.

---

## A. Governance baseline

| Area | Status | Action for Package C |
|------|--------|----------------------|
| Phase 3I | **CLOSED** | Do not reopen |
| Slice 13 | **CLOSED** | Do not reopen |
| Slice 14 | **DOES NOT EXIST** | Do not create |
| Phase 3J | **NOT CREATED** | Do not create |
| C-01 | **CLOSED** | Do not reopen |
| RESP2 | **ACCEPTED / CLOSED** | Do not redesign; preserve selection-based Prepare / SequenceNo semantics |
| Package LA | **ACCEPTED / CLOSED** | Do not reopen |
| Bulk OT Slip Printing | **UAT PASS / acceptance being recorded** | Do not reopen; do not change |
| Package B Prepared List Print | **Separate track** | Do not reopen; do not change |
| C-LA-04 | **DEFERRED** | Do not implement |
| PD-OTPREP-07 | **PENDING / not this package** | Do not implement |
| PD-OTPREP-10 | **DECIDED (Option A)** | This IA authorizes enforcement only |
| Ownership redesign | **OUT OF SCOPE** | Do not redesign |

Residual governance reference:  
`docs/audits/finalize-surgery-ot-preparation-post-package-la-residual-governance-audit.md`

---

## B. Product Decision reference

**Source:** `docs/product-decisions/finalize-surgery-ot-preparation-operational-model-product-decision.md`  
**Section:** PD-OTPREP-10 — OTPrepared StartTime change via Upsert vs GuardLocked

| Field | Value |
|-------|--------|
| **Selected decision** | **OPTION A** |
| **Status** | **DECIDED (direction) — FSM GOVERNANCE** |
| **Rule** | Require Reopen before any OTPrepared schedule-date / StartTime change |
| **Rationale** | Align locked OTPrepared with certified Reopen recovery path (PD-FS-05/06 family). Upsert bypass is asymmetry, not certified “date move” UX. |
| **Prior Implementation Authorization** | **NONE** (until this artifact) |

**Do not replace this decision.**  
**Do not invent another workflow.**  
**Do not create a direct OTPrepared date-edit path.**

---

## C. Exact current-state mutation-path findings

### C.1 Authoritative persistence

| Layer | Evidence |
|-------|----------|
| Entity | `AuthService.Models.Domain.OtFinalizeSchedule` |
| Table | `ot_finalize_schedule` |
| Schedule SoT column | `start_time` (`StartTime`) |
| Lock column | `is_locked` (`IsLocked`) |
| Prepare metadata | `SequenceNo`, `PreparedAt`, `PreparedBy` |
| Service owner | `OtFinalizeService` (`microservices/auth-service/AuthService/Services/OtFinalizeService.cs`) |

### C.2 ScheduleDate derivation (SoT protection)

There is **no** persisted `schedule_date` column.

```text
ScheduleDate = StartTime.Value.ToString("yyyy-MM-dd")
```

Evidence: `OtFinalizeService.ToResponse` (~L831–833).  
List / OT list date filters use `StartTime.Value.Date == date`.

**Package C must preserve:** `StartTime → ScheduleDate`.  
**Must not introduce:** FinalisedAt / PreparedAt as date SoT, second surgery-date field, or new date calculation.

### C.3 Every `OtFinalizeSchedule.StartTime` write path (current)

| # | Method | File | Writes StartTime? | Calls `GuardLocked`? | Can mutate while OTPrepared / IsLocked? |
|---|--------|------|-------------------|----------------------|----------------------------------------|
| 1 | `UpsertFromCounsellorAsync` (update) | `OtFinalizeService.cs` ~L105 | **YES** | **NO** | **YES** — also forces `NotConfirmed` + `IsLocked=false` (~L117–124) |
| 2 | `UpsertFromCounsellorAsync` (insert) | ~L162 | YES (create) | N/A | N/A (new row) |
| 3 | `UpdateSlotAsync` | ~L318 | YES | **YES** (~L309) | **NO** |
| 4 | `UpdateDetailsAsync` | ~L1148 | YES (if provided) | **YES** (~L1138) | **NO** |
| 5 | `PrepareOtListAsync` optional `NewStartTime` | ~L550–554 | YES on **Finalised** items only | No (Finalised gate) | **No for already-OTPrepared rows** (rejected ~L535–542) |
| 6 | `ConfirmAsync` / `FinaliseAsync` / `ReopenAsync` / `CancelAsync` / `MarkSurgeryDoneAsync` | various | **NO** StartTime write | N/A | N/A for schedule-date |

### C.4 API surface (existing — no new endpoints)

| Endpoint | Controller method | Service method |
|----------|-------------------|----------------|
| `POST …/ot-schedule` | `CounselingController.UpsertOtSchedule` (~L2284+) | `UpsertFromCounsellorAsync` |
| `PUT …/ot-schedule/{id}/slot` | `UpdateOtSlot` | `UpdateSlotAsync` |
| `PUT …/ot-schedule/{id}/details` | `UpdateOtDetails` | `UpdateDetailsAsync` |
| `POST …/ot-schedule/{id}/reopen` | `ReopenOtCase` | `ReopenAsync` |
| `POST …/ot-schedule/prepare` | `PrepareOtList` | `PrepareOtListAsync` |

### C.5 Frontend callers

| Caller | Path | Backend |
|--------|------|---------|
| `FinalizeOtModal` Save / Confirm | `apps/hospital-portal-web/src/components/counsellors-desk/FinalizeOtModal.tsx` | `UpdateDetails` (UI already blocks when status OTPrepared / SurgeryDone) |
| Counselling Done + existing OT id | `save-counselling-session.ts` ~L351–356 | `editOtScheduleSlot` → `UpdateSlot` (**GuardLocked**) |
| Counselling Upsert (not Done+existing) | `save-counselling-session.ts` ~L358–376 | `upsertOtSchedule` → `UpsertFromCounsellorAsync` (**no GuardLocked**) |

### C.6 Background / job paths

No Hangfire / scheduled job found that mutates `ot_finalize_schedule.start_time`.  
Internal OT sync (`MarkSurgeryDone`, `ReleaseForRebook` → `ReopenAsync`) does **not** rewrite StartTime.

### C.7 Separate (non-authoritative) counselling tentative fields

`CounselingWorkflowService.UpdateSessionAsync` may write session `SurgeryTentativeDate` / `SurgeryTentativeTimeSlot`.  
These are **not** `ot_finalize_schedule.start_time`. Package C does **not** change that session store.

---

## D. Confirmed or disproved Upsert / GuardLocked asymmetry

### Verdict: **ASYMMETRY STILL EXISTS in the CURRENT repository**

| Path | OTPrepared / IsLocked schedule mutation |
|------|----------------------------------------|
| Finalize modal + `UpdateDetailsAsync` | **Blocked** (FE status lock + `GuardLocked`) |
| Counselling Done+existing → `UpdateSlotAsync` | **Blocked** (`GuardLocked`) |
| Counselling / API → `UpsertFromCounsellorAsync` | **Allowed** — overwrites `StartTime`, resets `Status=NotConfirmed`, sets `IsLocked=false` |

**Evidence (Upsert update path):**

1. Active-row lookup **includes** `OTPrepared` (excludes only Cancelled / SurgeryDone) — `UpsertFromCounsellorAsync` ~L73–78.  
2. **No** `GuardLocked` call in Upsert.  
3. `existing.StartTime = request.StartTime` — ~L105.  
4. Forced unlock/reset — ~L117–124.

**`GuardLocked` definition** (~L750–755):

```csharp
private static void GuardLocked(OtFinalizeSchedule entity)
{
    if (entity.IsLocked)
        throw new InvalidOperationException(
            $"Record is locked (status: {entity.Status}). Use 'Reopen OT Case' to make changes.");
}
```

**Current call sites of `GuardLocked`:** only `UpdateSlotAsync` and `UpdateDetailsAsync`.

**Existing automated coverage of this asymmetry:** **NONE found** that asserts Upsert is rejected when `IsLocked` / OTPrepared, or that asserts `"Record is locked"` for Upsert.

---

## E. Exact authoritative service / method responsible for mutation

| Concern | Authority |
|---------|-----------|
| OTPrepared lock determination | `OtFinalizeSchedule.IsLocked` set `true` on Prepare (`PrepareOtListAsync` ~L597); cleared by Reopen / Cancel / Upsert-reset / MarkSurgeryDone / Finalised-edit reset |
| FSM transition validation | Per-method guards inside `OtFinalizeService` (not a shared transition table) |
| StartTime persistence | `OtFinalizeService` methods listed in §C.3 |
| ScheduleDate derivation | `ToResponse` / detail mapping from `StartTime` |
| Mutation service owner | **`OtFinalizeService`** |
| Shared by Finalization + Counselling + OT Preparation | **YES** — same service; different entry methods |

**Package C primary enforcement target:**

```text
OtFinalizeService.UpsertFromCounsellorAsync
  — update branch when existing != null AND existing.IsLocked == true
```

Secondary (already correct — regression-protect only):

```text
OtFinalizeService.UpdateDetailsAsync  (already GuardLocked)
OtFinalizeService.UpdateSlotAsync     (already GuardLocked)
```

---

## F. Exact enforcement boundary proposed

### F.1 Authorized implementation change (minimal)

1. **Service:** In `UpsertFromCounsellorAsync`, on the **update** branch (`existing != null`), invoke existing `GuardLocked(existing)` **before** any field mutation (including `StartTime`), after access checks.  
   - Effect: locked / OTPrepared rows cannot be mutated (including schedule-date) via Upsert.  
   - Aligns Upsert with UpdateDetails / UpdateSlot.  
   - Forces certified Reopen-first path.

2. **Controller mapping dependency (required for correct HTTP semantics):**  
   `UpsertOtSchedule` currently maps generic `InvalidOperationException` into **500** (only `SessionConcurrency.IsStale` → 409).  
   `UpdateOtSlot` / `UpdateOtDetails` map `InvalidOperationException` → **Conflict (409)**.  
   Package C **must** map non-stale `InvalidOperationException` from Upsert (including `GuardLocked`) to **409 Conflict**, consistent with slot/details — **without** creating a new endpoint or DTO.

3. **Frontend:** **No new OTPrepared date-edit workflow.** Finalize modal lock UX already correct. Counselling save already surfaces OT handoff failures; optional copy polish is **not** required for enforcement and is **out of scope** unless a later UX PD authorizes it.

### F.2 What must remain unchanged

- `UpdateDetailsAsync` / `UpdateSlotAsync` GuardLocked semantics (already correct)  
- `ReopenAsync` transition and metadata preservation  
- `PrepareOtListAsync` / RESP2 selection-based Prepare  
- SequenceNo generation / persistence / ordering  
- ScheduleDate derivation from StartTime  
- Ownership / permissions / branch / tenant authorization  
- Package B print · Bulk OT Slip printing · Package LA · C-LA-04  

### F.3 Related StartTime path explicitly **out of Package C mutation enforcement**

`PrepareOtListAsync` optional `NewStartTime` rewrites StartTime on **Finalised** rows during Prepare (~L550–554).  
That is **not** an OTPrepared direct edit path. **Do not change Prepare** under this IA unless a separate Product Decision authorizes it.

---

## G. Reopen-first rule

```text
REQUIRED:

  OTPrepared + any StartTime / schedule-date mutation attempt
      → REJECT unless Reopen has already occurred
        (i.e. IsLocked == false after certified Reopen)

CERTIFIED PATH:

  OTPrepared → Reopen → Confirmed → Edit (UpdateDetails) → Confirm/Finalise → (optional) Prepare → OTPrepared

FORBIDDEN:

  Direct OTPrepared date-edit UX
  New “Reopen & Edit” mutation API
  New Reopen confirmation dialog (this IA)
  Upsert bypass of locked OTPrepared
```

`ReopenAsync` (preserve):

| Behavior | Evidence |
|----------|----------|
| `OTPrepared → Confirmed` | ~L469–471 |
| `IsLocked = false` | ~L483 |
| Does **not** clear `SequenceNo` / `PreparedAt` / `PreparedBy` | no assignment to those fields |
| Does **not** change StartTime | no StartTime write |

---

## H. ScheduleDate / StartTime source-of-truth protection

```text
PRESERVE:
  StartTime  →  ScheduleDate (derived string / date filter)

DO NOT INTRODUCE:
  FinalisedAt as surgery-date SoT
  PreparedAt as surgery-date SoT
  Second surgery-date column
  New date calculation formula
```

---

## I. FSM protection

**Authoritative FSM (do not redesign):**

```text
NotConfirmed → Confirmed → Finalised → OTPrepared → SurgeryDone

OTPrepared → Confirmed   via Reopen
Cancelled  → NotConfirmed via Reopen
```

**Do not create:**

- Rescheduled  
- DateChangePending  
- ReopenAndEdit  
- OTPreparedEditing  
- ScheduleDateChanged  
- any other new state  

**No FSM redesign is authorized.** Package C only closes the Upsert lock bypass using existing `IsLocked` / `GuardLocked`.

---

## J. SequenceNo protection

**Do not change:**

- SequenceNo generation (FE continued sequences / RESP2 helpers)  
- SequenceNo persistence on Prepare  
- ordering / uniqueness semantics  
- Reopen metadata retention  
- RESP2 selection-based Prepare  

**Documented consequence (do not “fix” in Package C):**  
If Upsert historically demoted OTPrepared → NotConfirmed without Reopen, SequenceNo / PreparedAt / PreparedBy could remain on the row while status unlocked. After Package C, that bypass is blocked; Reopen continues to **preserve** those fields. Any historical orphaned metadata cleanup is **out of scope**.

---

## K. Reopen metadata protection

Preserve certified Reopen metadata behavior:

| Field | On Reopen |
|-------|-----------|
| `SequenceNo` | **Preserved** |
| `PreparedAt` | **Preserved** |
| `PreparedBy` | **Preserved** |
| `StartTime` | **Preserved** (edit only after unlock via existing edit path) |
| `IsLocked` | Cleared to `false` |
| `Status` | `OTPrepared → Confirmed` |

Do not add a Reopen confirmation dialog.  
Do not add a new “Reopen & Edit” mutation.

---

## L. API / backend scope

| Item | Authorized? |
|------|-------------|
| New endpoint | **NO** |
| New DTO (default) | **NO** |
| Reuse `GuardLocked` inside `UpsertFromCounsellorAsync` | **YES** |
| Align `UpsertOtSchedule` `InvalidOperationException` → 409 Conflict (non-stale) | **YES** (contract consistency dependency) |
| Change UpdateDetails / UpdateSlot lock semantics | **NO** (already correct; regression tests only) |
| Change Prepare API | **NO** |
| Change Reopen API | **NO** |
| Change ownership / branch ACL helpers | **NO** |

**Backend change is required** — frontend-only locking is insufficient because Upsert remains a live API path.

---

## M. Database scope

| Item | Authorized? |
|------|-------------|
| Schema / migration | **NO** |
| New columns | **NO** |
| Index changes | **NO** |
| Use existing `is_locked` | **YES** (read/enforce only) |

---

## N. Permission / ownership scope

**Do not modify:**

- branch authorization  
- tenant authorization  
- user permissions / permission codes  
- `CounselorId`  
- ownership model  
- Assign / Reassign / Requeue  
- My Work  
- Supervisor model  

Package C is strictly **FSM / schedule mutation integrity**.

---

## O. Required automated tests

Tests **must** target the **actual** mutation service: `OtFinalizeService` (and controller mapping for Upsert 409).

### O.1 Must add (Package C)

1. **OTPrepared / IsLocked + Upsert StartTime mutation → rejected** (`GuardLocked` / locked message; StartTime unchanged; Status remains OTPrepared; IsLocked remains true).  
2. **OTPrepared + UpdateDetails StartTime → rejected** (regression; already expected).  
3. **OTPrepared + UpdateSlot StartTime → rejected** (regression; already expected).  
4. **Reopen OTPrepared → Confirmed**, `IsLocked=false`, SequenceNo / PreparedAt / PreparedBy **unchanged**.  
5. **After Reopen**, UpdateDetails StartTime edit succeeds and follows existing Confirmed→NotConfirmed behavior.  
6. **Unlocked Confirmed / Finalised** UpdateDetails / UpdateSlot behavior **unchanged**.  
7. **Prepare** Finalised → OTPrepared behavior **unchanged** (including SequenceNo persistence).  
8. **Upsert on unlocked NotConfirmed** (create/update) remains functional.  
9. **Ownership / branch denial paths unchanged** (do not accidentally convert authz failures into lock failures).  
10. **Controller:** locked Upsert returns **409 Conflict**, not 500.

### O.2 Must not break

- Existing Prepare date-scope / conflict tests  
- Existing Finalization Confirm / Finalise tests  
- Existing counselling OT handoff branching tests (`save-counselling-session.fs01.test.ts`) — Done+existing still uses slot; Upsert path remains for unlocked cases  
- Phase 3I ownership boundary tests  

Suggested home (follow existing patterns):  
`AuthService.Tests/Services/` (e.g. new `OtFinalizeOtPreparedLockGuardTests.cs` or extend scheduling guard suite) + controller contract coverage if present for Counseling OT endpoints.

---

## P. Required Playwright / workflow tests (where feasible)

Prefer focused e2e / contract coverage if environment allows:

1. OTPrepared Finalize modal: Save / date fields locked; Reopen available.  
2. After Reopen: edit surgery date/time via existing modal → save succeeds.  
3. Do **not** require a new “Change Surgery Date” CTA.  
4. Do **not** assert Package B / Bulk print regressions beyond existing suites if untouched.

If full Playwright OTPrepared Upsert injection is impractical, **backend service tests are mandatory** and sufficient for the enforcement SoT; FE e2e covers the certified Reopen path.

---

## Q. Manual UAT scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| UAT-C-01 | OTPrepared row → open Finalize modal → attempt Save / date edit | Blocked (existing UI); no schedule change |
| UAT-C-02 | OTPrepared → Reopen → Confirmed → Edit Surgery Details (date/time) → Save | Succeeds; status follows existing edit→NotConfirmed rule |
| UAT-C-03 | After edit → Confirm → Finalise → Prepare (if applicable) | Existing FSM works; can become OTPrepared again |
| UAT-C-04 | Counselling re-save that would Upsert an OTPrepared case without Reopen | Rejected (409 / OT handoff failure); StartTime unchanged |
| UAT-C-05 | Counselling / Finalization workflows on **unlocked** cases | Unchanged success path |
| UAT-C-06 | SequenceNo / PreparedAt / PreparedBy after Reopen | Unchanged by Reopen |
| UAT-C-07 | Package B print / Bulk OT Slips smoke | Unchanged (out of Package C) |
| UAT-C-08 | Ownership / Assign / Reassign / Requeue smoke | Unchanged |

---

## R. Explicit out-of-scope items

```text
- FSM redesign / new states
- New API / new route / new entity
- Direct OTPrepared date-edit UX
- Reopen confirmation dialog
- “Reopen & Edit” composite mutation
- ScheduleDate SoT change
- SequenceNo redesign / renumber / gap-fill
- Prepare behavior / RESP2 redesign
- Package B Prepared List Print changes
- Bulk OT Slip Printing changes
- Package LA reopen
- C-LA-04 cancellation presentation
- PD-OTPREP-07 past-date policy
- Ownership / permissions / CounselorId / Assign / Reassign / Requeue / My Work / Supervisor
- Phase 3I reopen · Slice 14 · Phase 3J · C-01 reopen
- Session tentative-date store redesign
- OTBookingSystem / non-ot_finalize_schedule StartTime domains
- Historical data cleanup of rows previously demoted by Upsert
```

---

## S. Governance stop

```text
THIS ARTIFACT:
  AUTHORIZES Package C implementation under the exact boundary above.
  DOES NOT implement Package C.
  DOES NOT modify production code, tests, API, DB, FSM, ownership, or permissions.

NEXT GATE:
  Separate Package C IMPLEMENTATION task under this IA only.

STOP CONDITIONS DURING IMPLEMENTATION:
  - If a rule beyond PD-OTPREP-10 Option A is discovered → STOP and escalate Product Decision Gap
  - If Prepare / SequenceNo / ownership / Package B / Bulk must change to “make it work” → STOP (out of scope)
  - If a new endpoint or FSM state seems “needed” → STOP (not authorized)
```

---

## Journey verification summary (current vs Package C)

| Journey | Current | After Package C (authorized) |
|---------|---------|------------------------------|
| **A** NotConfirmed → Confirm → Finalise → edit while unlocked | Allowed (edit may revert Confirmed/Finalised → NotConfirmed via UpdateDetails) | **Unchanged** |
| **B** OTPrepared direct schedule mutation via UpdateDetails/UpdateSlot/modal | **Blocked** | **Blocked** (regression-protect) |
| **B′** OTPrepared schedule mutation via Upsert | **Allowed (asymmetry)** | **Blocked** via `GuardLocked` |
| **C** OTPrepared → Reopen → Confirmed → edit StartTime | Certified path works | **Unchanged** |
| **D** Counselling Upsert while OTPrepared | **Possible** | **Rejected** until Reopen |

---

## Authorization matrix (final)

| Authorization | Value |
|---------------|-------|
| PACKAGE C PD-OTPREP-10 IMPLEMENTATION | **YES** |
| Mutation paths authorized to change | **`UpsertFromCounsellorAsync` lock enforcement** + **Upsert controller 409 mapping** + **tests** |
| UpdateDetails / UpdateSlot | Regression protection only |
| New API | **NO** |
| New FSM state | **NO** |
| DB / migration | **NO** |
| Permissions / ownership | **NO** |
| RESP2 / Package LA / Package B / Bulk / C-LA-04 | **NO** |
| Implementation started by this governance task | **NO** |

---

## Final governance status (this task)

```text
PRODUCT DECISION:
PD-OTPREP-10 — DECIDED (Option A)

IMPLEMENTATION AUTHORIZATION:
PREPARED / RECORDED

IMPLEMENTATION:
NOT STARTED

AUTOMATED TESTS:
NOT RUN — GOVERNANCE TASK

MANUAL UAT:
NOT EXECUTED

ACCEPTANCE:
NOT RECORDED

PACKAGE B:
SEPARATE TRACK — IMPLEMENTATION COMPLETE (per Package B report); do not reopen under Package C

PACKAGE C:
IMPLEMENTATION NOT STARTED

C-LA-04:
DEFERRED
```

**STOP.** Do not implement Package C in this governance task.
