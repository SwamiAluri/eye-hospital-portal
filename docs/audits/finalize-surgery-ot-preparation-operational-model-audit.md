# Finalize Surgery + OT Preparation
# OT Preparation Operational Model — Comprehensive Reconciliation Audit

| Field | Value |
|-------|-------|
| **Document type** | AUDIT ONLY — NO IMPLEMENTATION |
| **Date** | 2026-09-23 |
| **Trigger** | OT Preparation Package 1 Manual UAT observation |
| **Output path** | `docs/audits/finalize-surgery-ot-preparation-operational-model-audit.md` |
| **Scope** | Repository inspection (FE + BE + SQL baseline + product decisions + tests) |
| **Production changes** | NONE |

---

## 0. Governance baseline (treated as authoritative)

Unless repository evidence contradicts:

| Item | Status |
|------|--------|
| Phase 3I | CLOSED |
| Slice 13 | CLOSED |
| Slice 14 | DOES NOT EXIST |
| Phase 3J | NOT CREATED |
| C-01 Waiting List redesign | ACCEPTED + CLOSED |
| Finalize Surgery + OT Preparation Product Decision | Approved / recorded |
| Package 1 implementation | Complete |
| Package 1 Manual UAT | In progress |
| This task | Audit only — triggered by OT Prep UAT observation |

### Approved OT Preparation business model (preserved)

1. Finalize Surgery and OT Preparation remain shared operational surfaces.
2. No `CounselorId` ownership on Finalize / OT Preparation.
3. Do NOT create My Finalize.
4. Do NOT create My OT Preparation.
5. Do NOT create Assign / Reassign / ReQueue for OT Preparation.
6. Do NOT create Supervisor ownership.
7. Do NOT create an `OTPreparationOwnerId`.
8. OT Preparation is conceptually one logical operational list per branch/date (**PD-FS-11 Option A**).
9. Persistence remains row-based.
10. `SequenceNo` represents operational ordering within the prepared list.
11. OTPrepared rows are locked according to the existing FSM.
12. Load OT List is date-scoped.
13. Prepare must remain date-scoped.
14. Existing FSM must be preserved unless a separate explicit Product Decision authorizes a state-machine change.

**Critical audit premise:** Do **not** assume that “Finalised date” is the OT Preparation date. Investigate whether the authoritative grouping date is the patient’s scheduled surgery date / `StartTime`-derived date.

---

## 1. Executive verdict (core business question)

### Question

> If a patient is Finalised today but their surgery is scheduled for tomorrow, the day after tomorrow, next week, or a later scheduled date, which OT Preparation list should the patient belong to?

### Example

| Concept | Value |
|---------|-------|
| Finalisation event | 23 Sep (today) |
| Surgery schedule | 25 Sep |
| Expected OT Preparation list | **25 Sep** |
| Not | 23 Sep |

### Authoritative answer (VERIFIED FROM CODE + EXISTING PRODUCT DECISION)

**The patient belongs to the OT Preparation list for the surgery schedule date derived from `StartTime` (API `scheduleDate` / Prepare request `Date`), not from any Finalisation calendar day.**

There is **no** `FinalisedAt` (or `FinalizedAt`) column on `ot_finalize_schedule`. Finalisation only sets `Status = Finalised` and updates audit stamps (`UpdatedAt`). OT Preparation date grouping never uses Finalisation time.

| Concept | Authoritative field | Exists? |
|---------|---------------------|---------|
| **OT Preparation date / surgery date** | `StartTime` → calendar day; response `ScheduleDate` | YES |
| **Finalise date** | *(none)* — only status transition + `UpdatedAt` | NO dedicated field |
| **Prepared event time** | `PreparedAt` (UTC stamp at Prepare) | YES — event metadata, **not** list date key |
| **Prepared actor** | `PreparedBy` | YES — event metadata |

**Classification:** VERIFIED FROM CODE · VERIFIED FROM EXISTING PRODUCT DECISION (PD-FS-11 date-scoped list; Prepare/Load OT List tables in product decision §5).

---

## 2. AUTHORITATIVE OT PREPARATION DATE

### AUTHORITATIVE OT PREPARATION DATE

**Calendar date of `ot_finalize_schedule.start_time` (`OtFinalizeSchedule.StartTime`), exposed as `ScheduleDate` (`yyyy-MM-dd`) and enforced by Prepare/GetOtList against the client-selected `date`.**

### SUPPORTING EVIDENCE

| Layer | Location | Behavior |
|-------|----------|----------|
| Entity | `microservices/auth-service/AuthService/Models/Domain/OtFinalizeSchedule.cs` L79–80 | `StartTime` column `start_time` |
| Response mapping | `OtFinalizeService.ToResponse` L831–833 | `ScheduleDate = StartTime.Value.ToString("yyyy-MM-dd")` |
| Prepare | `PrepareOtListAsync` L501–532 | Requires `request.Date`; rejects rows whose `StartTime` is outside `[date, date+1)` |
| Load OT List | `GetOtListAsync` L619–638 | `Status == OTPrepared` AND `StartTime.Value.Date == targetDate` |
| Finalize list filter | `GetFinalizeListAsync` L210–214 | Optional date filter on `StartTime.Value.Date` |
| FE prepare scope | `prepare-ot-date-scope.ts` L12–24 | `status === 'Finalised' && scheduleDate === day` |
| FE API map | `counsellors-desk.api.ts` ~L129–131 | `scheduleDate` from backend / `startTime` fallback |
| Tests | `OtFinalizePrepareOtDateScopeTests.cs` | Cross-date batch rejected; selected-date prepare only |
| Product decision | `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` PD-FS-11; §5 Prepare / Load OT List | Date-scoped prepared list; no FinalisedAt model |

### FINALISE DATE

**Not a first-class field.** Closest observable stamps: `UpdatedAt` / audit log `Finalise` action at `ChangedAt`. **Must not be used as OT Preparation grouping key.**

### OT PREPARATION DATE

**Selected surgery calendar day** = Prepare `request.Date` / UI date / Load OT List `date` query param, matched to **`StartTime` date**.

### PREPARED DATE (event)

**`PreparedAt`** — UTC timestamp when the row was prepared; retained on Reopen (**PD-FS-06**). Distinct from the OT list’s surgery date.

---

## 3. Complete data-path trace

```
Counselling / surgery scheduling
        ↓  (UpsertFromCounsellor sets StartTime, ReportingTime, …)
StartTime (+ ReportingTime)
        ↓  Confirm (requires ReportingTime — PD-FS-03)
Confirmed
        ↓  Finalise (status only — no FinalisedAt)
Finalised
        ↓  eligibility = Finalised AND StartTime on selected day
Selected surgery date (UI date / Prepare.Date)
        ↓  PrepareOtListAsync
OTPrepared + IsLocked + SequenceNo + PreparedAt/By
        ↓  GetOtListAsync(date)
Load OT List (OTPrepared for StartTime date)
        ↓  Reopen (OTPrepared → Confirmed; unlock; retain SequenceNo/Prepared*)
```

### Field inventory

| Field | Entity / table | DTO | API | Service | Frontend | Authoritative for OT Prep date? |
|-------|----------------|-----|-----|---------|----------|----------------------------------|
| **StartTime** | `ot_finalize_schedule.start_time` | `OtScheduleResponse.StartTime` | upsert / update-details / slot / prepare override | Upsert, Update*, Prepare, GetOtList, GetFinalizeList | `startTime`, drives `scheduleDate` | **YES — SoT** |
| **ScheduleDate** | derived (not a column) | `ScheduleDate` | all schedule responses | `ToResponse` L831–833 | `scheduleDate` | **YES — derived day key** |
| **ReportingTime** | `reporting_time` | `ReportingTime` | confirm prerequisite | ConfirmAsync L348–350 | `reportingTime` | No (Confirm gate only) |
| **FinalisedAt** | — | — | — | — | — | **N/A — does not exist** |
| **OTPreparedAt** | — | — | — | — | — | **N/A — use PreparedAt** |
| **PreparedAt** | `prepared_at` | `PreparedAt` | prepare response | PrepareOtListAsync L587–600 | `preparedAt?` (often not rendered in OT list) | No — prepare event |
| **PreparedBy** | `prepared_by` | `PreparedBy` | prepare request optional | PrepareOtListAsync | optional payload; retained on reopen | No — actor metadata |
| **SequenceNo** | `sequence_no` | `SequenceNo` | prepare items `sequence` | Client-supplied; GetOtList OrderBy | prepare modal sequencing | Ordering only |
| **IsLocked** | `is_locked` | `IsLocked` | responses | true on Prepare; GuardLocked | lock UX | Lock gate |
| **Status / OtFinalizeStatus** | `status` | `Status` | all mutations | FSM | badges / tabs | Eligibility gate |
| **BranchId** | `branch_id` | (auth filter) | list endpoints via branch resolve | GetFinalizeList / GetOtList branch set; Prepare per-row auth | branch from session | List isolation |
| **TenantId** | `tenant_id` | — | auth context | all queries | — | Isolation |
| **Version** | `version` | `Version` | optimistic concurrency on edits | incremented on mutations | patch after mutations | Concurrency |
| **UpdatedAt** | `updated_at` | `UpdatedAt` | responses | set on Finalise etc. | display/audit only | **Not** Prep date |

**Evidence class:** VERIFIED FROM CODE.

---

## 4. Current OT Preparation UI audit

**Primary surface:** `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`  
Workspace: `data-testid="finalize-ot-preparation-workspace"` (~L1110+).  
Related: `PrepareOtListModal` (same file), `prepare-ot-date-scope.ts`, `counsellors-desk.api.ts`.  
`FinalizeOtModal.tsx` = single-case detail — not the OT Preparation worklist.

### Behaviors

| Concern | Finding | Evidence |
|---------|---------|----------|
| Default date | `otListDate` = `new Date().toISOString().slice(0, 10)` → **UTC calendar day**, not necessarily local hospital day | page.tsx L538 |
| Date picker | Native `type="date"`; **no min/max** | L1139–1145 |
| Allowed range | Year ≥ 1900 for Prepare validity only; past & future selectable | `isValidPrepareOtSurgeryDate` L3–9 |
| Dates from schedules? | **No** — not populated from available surgery dates API | Manual entry / default today |
| Future dates | Supported (manual) | No max |
| Past dates | Supported (manual) | No min |
| Today auto-selected | Yes (UTC ISO day) | L538 |
| Load OT List | Explicit click → `GET /Counseling/ot-list?date=` | L744–756; API getOtList |
| Prepare New List | Enabled when Finalised rows exist for `otListDate` in loaded finalize cache | L620–623, L1159–1170 |
| Prepared dates display | Only after Load; shows prepared rows for that date | L1185–1207 |
| Empty state | “No prepared OT list for this date” even when Finalised exist but Load not clicked / Prepare not run | L1185–1193 |
| Finalised before prep | Shown in Finalization workspace; OT Prep panel lists **only** loaded OTPrepared | Finalization queue + prepare modal |
| Prepared vs unprepared | Clear in Finalization badges; **not** side-by-side in OT Prep workspace | StatusBadge / OT list |
| Late Finalised after prep | Discoverable only if finalize list has them and Prepare New List enables — **no** dedicated late-add banner | L613–623 |

### Subtitle bug / ambiguity

OT Preparation subtitle uses `finalisedForDate` (tied to **Finalization** `filters.date`, often empty), **not** `finalisedForOtListDate` (`otListDate`) — L1126–1128 vs L608–616. Users on OT Prep with Finalised for tomorrow may still see “Load or prepare…” copy.

### UI classification

**D — mixed / ambiguous**

| Mode | Where |
|------|--------|
| **A** Date-driven from surgery schedule (`scheduleDate`) | Prepare eligibility / modal |
| **B** Arbitrary date lookup | OT Prep date picker + Load OT List |
| **C** FinalisedAt-driven | **Not used** (field absent) |

**Evidence class:** VERIFIED FROM CODE.

---

## 5. Backend / API behavior audit

### Endpoints (`CounselingController.cs`)

| Operation | Route | Service |
|-----------|-------|---------|
| Prepare | `POST /api/Counseling/ot-schedule/prepare` | `PrepareOtListAsync` |
| Load OT List | `GET /api/Counseling/ot-list?date=` | `GetOtListAsync` |
| Finalize list | `GET /api/Counseling/ot-schedule` | `GetFinalizeListAsync` |
| Finalise | `POST …/ot-schedule/{id}/finalise` | `FinaliseAsync` |
| Reopen | `POST …/ot-schedule/{id}/reopen` | `ReopenAsync` |

Permissions (existing): prepare/finalise/reopen → `counseling_sessions.update`; ot-list → `counseling_sessions.read`.

### Precise answers

| # | Question | Answer |
|---|----------|--------|
| 1 | Rows eligible for Prepare? | Submitted IDs that are **Finalised**, same tenant, not deleted, actor can access branch, **StartTime** in `[request.Date, request.Date+1)` |
| 2 | How is date selected? | Client supplies `PrepareOtListRequest.Date` / query `date` |
| 3 | DB field for date matching? | **`start_time` (`StartTime`)** |
| 4 | Is FinalisedAt involved? | **No — field does not exist** |
| 5 | Is StartTime involved? | **Yes — exclusive date SoT** |
| 6 | Can Prepare include other surgery dates? | **No** — out-of-scope fails whole batch (`ArgumentException`) |
| 7 | Prepare all Finalised when date missing? | **No** — FS-02 rejects default / year &lt; 1900 |
| 8 | Multiple patients OTPrepared same branch/date? | **Service: YES** (batch + subsequent Prepare of other Finalised). **SQL baseline unique index may forbid** if live (see §7) |
| 9 | List already exists for date? | **No “list exists” entity.** Second Prepare of **new** Finalised rows allowed at app layer (slot TimeOfDay collision only). Re-prepare of already OTPrepared rejected (“not Finalised”) |
| 10 | Add another Finalised into already prepared date? | **App layer: YES** via another Prepare batch of remaining Finalised (if slot free). UX does not clearly brand this as “append.” DB index risk if `ux_ot_finalize_prepared_date` live |

### SequenceNo

- Client-supplied per prepare item (`Sequence`).
- No server uniqueness / gap fill.
- GetOtList: `OrderBy(SequenceNo ?? int.MaxValue).ThenBy(StartTime)`.
- Reopen retains SequenceNo / PreparedAt / PreparedBy (**PD-FS-06**).

### Duplicate / concurrency

- Slot collision: same TimeOfDay vs other OTPrepared on that date → `OtPrepareConflictException`.
- No dedicated “date already prepared” guard in C#.
- `Version` incremented; Prepare does not take client version for optimistic conflict across rows.
- Transaction: single `SaveChangesAsync` after loop (L609).

**Evidence class:** VERIFIED FROM CODE (+ tests for date scope).

---

## 6. Scenario matrix (A–P) — implementation behavior

Legend for Gap / Classification columns: see §15.

| Scenario | Authoritative Date | Current Behavior | Expected Operational Model (governance) | Gap | Classification | Evidence |
|----------|-------------------|------------------|-------------------------------------------|-----|----------------|----------|
| **A** Finalise today / surgery today | StartTime day = today | Eligible for today’s Prepare; Load OT List after prepare | Belong to today’s list | None for date SoT | **A** | PrepareOtListAsync; prepare-ot-date-scope |
| **B** Finalise today / surgery tomorrow | StartTime day = tomorrow | Eligible under **tomorrow**; not under today | Belong to tomorrow | UX may default picker to today → empty / miss | **B** (discoverability) | FE filter scheduleDate; BE StartTime window |
| **C** Finalise today / surgery +2 | StartTime +2 | Same as B for that date | Belong to +2 date | Same discoverability | **B** | same |
| **D** Finalise today / surgery next week | StartTime next week | Discoverable if user selects that date (and finalize list loaded without conflicting date filter) | Belong to that surgery week date | No upcoming-dates API/UI | **B** / **H** | No date-catalog endpoint found |
| **E** Multiple patients same surgery date | Shared StartTime day | One logical list (PD-FS-11); row persistence; SequenceNo client order; multi-item Prepare | One logical branch/date list | Possible SQL unique conflict | **A** service / **D** if index live | PD-FS-11; Prepare loop; PD-FS-12 deferred |
| **F** Late finalisation after list prepared | Same surgery date | App: new Finalised can be prepared into same date if slot free; already-OTPrepared not reprocessed | Operational need likely “append” | UX/API clarity; no dedicated append UX; index risk | **E** (product clarity) + **A/C** app capability | Prepare L534–585; no late-add test |
| **G** Same-day late finalisation | Today | Same as F | Day-of append | Same as F | **E** + **H** | same |
| **H** Surgery date moved later (Finalised) | New StartTime day | UpdateDetails: allowed; **Finalised → NotConfirmed** + unlock | Must re-Confirm/Finalise; eligibility moves with StartTime | Status reset may surprise ops | **A** coded; **E** if product wants Finalised retained | UpdateDetails L1167–1173 |
| **I** Surgery date moved earlier (Finalised) | New StartTime day | Same as H | Same | Same | **A** / **E** | same |
| **J** Finalised with missing surgery date | N/A | Prepare rejects (out of scope / no scheduleDate match); GetOtList excludes null StartTime | Not on any Prep date until StartTime set | Messages exist | **A** | Prepare L523–532; GetOtList L634 |
| **K** Past surgery date | Past StartTime day | UI allows select; Load/Prepare work if data exists | Historical load likely desired; prep policy **undefined** | Past Prepare policy | **E** / **H** | No min on date input |
| **L** Multiple future surgery dates | Each StartTime day | Only via manual date picking + finalize list contents | Operators need to find dates with Finalised | No date navigator from data | **B** | No upcoming-dates API |
| **M** Already prepared date | StartTime day | Load works; Prepare again of same rows fails; new Finalised can be prepared (app) | Distinguish prepared vs ready | Empty state after date change without Load; no prepared-date catalog | **B** | GetOtList; Prepare status check |
| **N** SequenceNo | Per prepare items | Client sequences; OrderBy SequenceNo; no unique constraint | Branch/date operational order | Concurrent prepare can duplicate sequences | **A** basic / **E** if uniqueness required | Prepare L589–598; GetOtList L636–637 |
| **O** Cross-branch same date | BranchId + date | Lists fail-closed to accessible branches; Prepare per-row auth | Branch isolation preserved | — | **A** | GetOtList L622–632; EnsureActorCanAccessScheduleAsync |
| **P** Date change after OTPrepared | Locked StartTime | UpdateDetails/UpdateSlot **blocked** by GuardLocked; UpsertFromCounsellor **can overwrite StartTime and reset to NotConfirmed even when locked** | FSM does not define intentional OTPrepared reschedule | Asymmetry / undefined product rule | **F** (state-machine / PD) | GuardLocked L750–754; Upsert L105–124 vs UpdateDetails L1138 |

### Scenario detail notes

#### F / G — Late-arriving Finalised (highest priority)

**VERIFIED FROM CODE:** Application service allows preparing additional Finalised rows for a date that already has OTPrepared rows, subject only to TimeOfDay slot collision and Finalised status. There is **no** “close the list” flag.

**UNDEFINED / DECISION REQUIRED (product/ops):** Whether day-of/late add is an approved operational workflow, whether SequenceNo must continue from max existing, and whether UI should expose “Add to prepared list” vs “Prepare New List” wording.

**DATABASE:** If `ux_ot_finalize_prepared_date` exists live → second OTPrepared row fails → **FOUND AND CONFLICTING** with multi-patient / late-add. Live presence: **UNKNOWN / ENVIRONMENT ACCESS REQUIRED** (**PD-FS-12 Option C** deferred).

#### H / I — Reschedule while Finalised

UpdateDetails changes StartTime and **resets Finalised → NotConfirmed**. Eligibility for OT Prep moves with the new StartTime only after re-Confirm → re-Finalise. **Not** a silent move of a Finalised row across dates while remaining Finalised.

#### P — Reschedule while OTPrepared

- Intended UI path: GuardLocked → must Reopen first.
- Counsellor Upsert path: **no GuardLocked** — can change StartTime and force NotConfirmed + unlock even from OTPrepared.  
**STATE-MACHINE / PRODUCT DECISION REQUIRED** before treating Upsert as authorized OTPrepared date-move.

---

## 7. Database / constraint audit

### Table

`ot_finalize_schedule` — SQL baseline: `database_migrations/schema/OT_FINALIZE_SCHEDULE_MIGRATION.sql`.

### `ux_ot_finalize_prepared_date`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_ot_finalize_prepared_date
    ON ot_finalize_schedule(DATE(start_time AT TIME ZONE 'UTC'), tenant_id)
    WHERE status = 'OTPrepared' AND deleted_at IS NULL;
```

Comment in SQL: “one OTPrepared list per date per tenant” / prevent Prepare twice for same date.

| Classification question | Result |
|-------------------------|--------|
| Declared in repo SQL baseline? | **YES** |
| Present in AuthService EF model snapshot / migrations? | **NOT FOUND** |
| Live environment? | **UNKNOWN / ENVIRONMENT ACCESS REQUIRED** |
| If live + multi-patient Prepare | **FOUND AND CONFLICTING** with service + PD-FS-11 multi-patient intent |
| If absent live | **NOT FOUND** in EF; SQL baseline may be drift |
| Governance | **PD-FS-12 Option C — DEFERRED**; Package 1 must not alter schema |

### Other indexes (SQL baseline)

| Index | Role | Class |
|-------|------|-------|
| `ux_ot_finalize_patient_active` | One active row per patient (excludes Cancelled/SurgeryDone) | FOUND IN SQL; aligns with Upsert |
| `idx_ot_finalize_date` | Non-unique on `DATE(start_time AT TIME ZONE 'UTC')` | FOUND IN SQL |

### Does schema support multiple OTPrepared patients same branch/date?

| Layer | Answer |
|-------|--------|
| Service / PD-FS-11 | **Yes — intentional** |
| SQL unique prepared-date (if applied) | **No — one row per tenant/date** |
| Branch in unique key? | **No** — unique is `(UTC date, tenant_id)` only |

**Evidence class:** VERIFIED FROM DATA (SQL file) · LIVE UNKNOWN · VERIFIED FROM EXISTING PRODUCT DECISION (PD-FS-12).

---

## 8. Date / time / timezone audit

| Layer | Behavior |
|-------|----------|
| Column | `timestamp with time zone` (`start_time`) |
| C# Prepare | Half-open `[request.Date.Date, +1 day)` on stored `StartTime` values |
| C# GetOtList / GetFinalizeList | `StartTime.Value.Date == targetDate` (CLR `.Date`) |
| SQL index expression | `DATE(start_time AT TIME ZONE 'UTC')` |
| ScheduleDate string | `ToString("yyyy-MM-dd")` on StartTime value |
| FE default OT date | `toISOString().slice(0, 10)` → **UTC day** |
| PreparedAt | `DateTime.UtcNow` |
| Hospital local TZ | **Not explicitly normalized** in OtFinalizeService |

### Midnight / UTC risk

**YES — possible calendar-day shift.** Example: local 23 Sep 23:30 IST stored as UTC 23 Sep 18:00 → OK; but local near-midnight values, or FE using UTC “today” while operators think local “today”, can select the wrong list day. CLR `.Date` vs SQL `AT TIME ZONE 'UTC'` can disagree for edge timestamps.

**Evidence class:** VERIFIED FROM CODE · INFERENCE for specific IST edge cases (not executed against live DB clocks).  
**Do not change timezone behavior in this audit.**

---

## 9. Discoverability model (existing data only)

Evaluate options **without inventing a new UX pattern for cosmetics**:

| Option | Fit | Notes |
|--------|-----|-------|
| **A.** Date picker populated from available surgery dates | Best minimal alignment | Derive distinct `scheduleDate` values from Finalised (and optionally OTPrepared) rows already returned by `GET ot-schedule` |
| **B.** Upcoming surgery-date list | Similar to A | Present dates with counts (Finalised ready / already prepared) |
| **C.** Calendar navigator | Heavier | Not required if A/B sufficient |
| **D.** Existing API-driven date lookup | Already exists | Load OT List + manual date — **insufficient alone** for multi-day Finalised backlog |
| **E.** Current model already sufficient for SoT | Date SoT is correct | Discoverability is **not** sufficient |

**Smallest change that correctly exposes the existing operational model (recommendation only — not authorized):**

> Keep StartTime-based SoT; improve OT Preparation date discovery using **already-loaded finalize list `scheduleDate` values** (and/or Load results), so operators see tomorrow/+2/next week without assuming Finalised-today = Prep-today. Do **not** invent FinalisedAt grouping.

**Classification of that path if later authorized:** primarily **B** (bounded UI), possibly **C** only if a dedicated “dates with Finalised” query is required.

---

## 10. Prepared vs unprepared states

Existing authoritative distinctions (do **not** invent new statuses):

| Operational meaning | Existing signal |
|---------------------|-----------------|
| READY FOR OT PREPARATION | `Status == Finalised` + `StartTime` on selected date |
| OT LIST ALREADY PREPARED (rows) | `Status == OTPrepared` (+ `IsLocked`) for that StartTime date |
| NO ELIGIBLE SURGERIES | No Finalised with matching scheduleDate; or empty prepare modal |
| SURGERY DATE NOT VALID / NOT AVAILABLE | Missing/invalid date; missing StartTime → Prepare reject / excluded from date filters |

There is **no** separate “list header” entity status for prepared vs unprepared dates.

---

## 11. Late-arriving patients (explicit)

**Requirement under investigation:** A patient can become Finalised after the OT list for that surgery date has already been prepared.

| Dimension | Finding |
|-----------|---------|
| Current support (app) | **Yes** — another Prepare of remaining Finalised for that date |
| API capability | Same `POST …/prepare` |
| Sequence behavior | Client chooses Sequence; no auto-continue-from-max |
| Locking | New rows lock on Prepare; existing OTPrepared stay locked |
| Database support | Service yes; SQL unique may block second row |
| Duplicate protection | Status must be Finalised; TimeOfDay slot collision |
| Reopening required? | **Not** for adding a different patient; Reopen only to unlock an OTPrepared row for edit |
| Product Decision required? | **Yes for ops/UX clarity** (append semantics, SequenceNo policy, wording). Schema PD already deferred (PD-FS-12) |

---

## 12. Surgery rescheduling (explicit)

| Case | Behavior | Classification |
|------|----------|----------------|
| Finalised → StartTime changes (UpdateDetails) | Status → NotConfirmed; must re-Confirm/Finalise; Prep eligibility follows new date | VERIFIED FROM CODE |
| Finalised → StartTime via Upsert | Same reset to NotConfirmed (if not Cancelled/SurgeryDone) | VERIFIED FROM CODE |
| OTPrepared → StartTime via UpdateDetails/Slot | **Blocked** (GuardLocked) | VERIFIED FROM CODE |
| OTPrepared → StartTime via Upsert | **Allowed** + reset NotConfirmed + unlock | VERIFIED FROM CODE — **STATE-MACHINE / PRODUCT DECISION REQUIRED** |
| OTPrepared → intentional move to new date without reopen | **Undefined** as approved FSM transition | **F** |

---

## 13. UX gap analysis (evidence-based)

| Gap | Evidence |
|-----|----------|
| Wrong date **semantics** if operators assume Finalised-today = Prep-today | SoT is StartTime; UI defaults to “today” UTC — easy to misread |
| Poor date discoverability | Manual picker; no surgery-date catalog |
| Misleading empty state | Empty OT panel ≠ no Finalised for that date |
| Cannot see upcoming eligible dates | No derived date list |
| Weak prepared/unprepared date distinction | Must Load; no date-level badge |
| Unclear late-add | “Prepare New List” after a list already exists |
| Unclear date navigation | Date change does not auto-reload / clear stale list |
| Unnecessary Load interaction friction | Explicit Load; no auto-fetch on date change |
| Subtitle uses wrong date source | `finalisedForDate` vs `finalisedForOtListDate` |
| Duplicate concepts | Finalization date filter vs OT Prep date are separate controls |

**Date SoT itself is not wrong** — discoverability and honesty around it are the primary UAT-facing gaps.

---

## 14. Implementation classification (gaps only — no implementation)

| ID | Gap | Class |
|----|-----|-------|
| G1 | StartTime / scheduleDate is OT Prep date SoT | **A** |
| G2 | FinalisedAt not used (absent) | **A** |
| G3 | Prepare/Load date-scoped correctly | **A** |
| G4 | OT Prep default “today” + manual picker hides future Finalised | **B** |
| G5 | No upcoming surgery-date discoverability | **B** (prefer) / **C** if new query needed |
| G6 | Empty / subtitle honesty | **B** |
| G7 | Late-add / append UX + SequenceNo policy | **E** (+ **H** tests) |
| G8 | `ux_ot_finalize_prepared_date` live conflict | **D** + **G** (env verify) — PD-FS-12 |
| G9 | OTPrepared date change via Upsert vs GuardLocked | **F** |
| G10 | Past-date Prepare policy | **E** |
| G11 | Timezone / UTC default day vs local hospital day | **E** / **G** / possible later **C** |
| G12 | Late-add & multi-day UAT scenarios | **H** |

---

## 15. Required scenario matrix (summary table)

*(Same as §6 — retained here per task §16.)*

| Scenario | Authoritative Date | Current Behavior | Expected Operational Model | Gap | Classification | Evidence |
|----------|-------------------|------------------|----------------------------|-----|----------------|----------|
| A Finalise today / surgery today | StartTime today | Eligible today | Today’s list | — | A | OtFinalizeService; FE scope |
| B Finalise today / surgery tomorrow | StartTime tomorrow | Belongs tomorrow | Tomorrow’s list | Discoverability | B | prepare-ot-date-scope.ts |
| C Finalise today / surgery +2 | StartTime +2 | Belongs +2 | That date’s list | Discoverability | B | same |
| D Finalise today / surgery next week | StartTime next week | Belongs that week date | That date’s list | Discoverability | B/H | no date catalog |
| E Multiple patients same date | Shared StartTime day | Multi-row Prepare (service) | One logical list | Index risk | A/D | PD-FS-11/12; SQL L81–84 |
| F Late finalisation after prep | Same StartTime day | Second Prepare allowed (app) | Likely append | UX/PD/index | E/A/D | Prepare L556–585 |
| G Same-day late finalisation | Today | Same as F | Day-of append | Same | E/H | same |
| H Reschedule later (Finalised) | New StartTime | → NotConfirmed | Re-validate | Ops surprise? | A/E | UpdateDetails L1167–1173 |
| I Reschedule earlier (Finalised) | New StartTime | → NotConfirmed | Re-validate | Same | A/E | same |
| J Missing surgery date | None | Prepare blocked | Not eligible | — | A | Prepare L523–532 |
| K Past date | Past StartTime | Selectable; load/prep possible | Policy unclear | Past policy | E/H | date input no min |
| L Multiple future dates | Per StartTime | Manual per date | Need discovery | Catalog | B | UI L1139–1145 |
| M Already prepared date | StartTime day | Load OK; no re-prep same rows | Distinguish states | UX | B | GetOtList; Prepare status |
| N SequenceNo | Per items | Client order | Branch/date order | Concurrency uniqueness | A/E | L589–598, L636–637 |
| O Cross branch | BranchId + date | Isolated | Isolated | — | A | branch filters |
| P Date change after OTPrepared | Locked / Upsert asymmetry | GuardLocked vs Upsert reset | Undefined FSM | FSM/PD | F | GuardLocked; Upsert L117–124 |

---

## 16. Test coverage analysis

| Area | Coverage | Gap |
|------|----------|-----|
| Prepare date scope / missing date | Strong — `OtFinalizePrepareOtDateScopeTests.cs` | — |
| FE prepare date filter | Strong — `prepare-ot-date-scope.test.ts` | — |
| Late-add second Prepare same date | **Not found** as dedicated test | **H** |
| SequenceNo continuation after late-add | **Not found** | **H** |
| Timezone / UTC day boundary | **Not found** for IST edges | **H** |
| Live `ux_ot_finalize_prepared_date` | **Not verified in env** | **G** / **H** |
| Playwright Confirm→Finalise→Prepare multi-day | Product decision notes FS-G-16 gap | **H** |
| Upsert vs GuardLocked OTPrepared | Not classified as FSM regression test in this audit pass | **H** / **F** |

---

## 17. Recommendations (audit only — not authorization)

### 1. VERIFIED BUSINESS MODEL

OT Preparation is a **shared**, **date-scoped** operational list per **branch + surgery date**, where surgery date is the calendar day of **`StartTime`**. Finalisation may occur days/weeks earlier; that event does **not** choose the Prep list day. Persistence is row-based; `SequenceNo` orders the logical list (**PD-FS-11**).

### 2. CURRENT IMPLEMENTATION MODEL

Backend and FE prepare scoping **already implement StartTime/scheduleDate SoT**. Load OT List reads OTPrepared for that StartTime date. UI discovery defaults to an arbitrary/today date picker and does not surface upcoming Finalised surgery dates; late-add is possible via another Prepare but poorly expressed.

### 3. GAP SUMMARY

- **SoT:** Correct (surgery/`StartTime` date ≠ Finalised day).
- **UX:** Discoverability, empty-state honesty, late-add clarity, UTC “today” default.
- **Schema:** Possible unique prepared-date index conflict (deferred PD-FS-12).
- **FSM:** OTPrepared reschedule via Upsert vs locked Update paths undefined as product rule.

### 4. SAFEST MINIMAL IMPLEMENTATION PATH *(if later authorized — not by this audit)*

1. Preserve StartTime date-scoping and FSM.
2. Bounded UI: surface eligible surgery dates from existing finalize list data; fix OT Prep subtitle to use `otListDate`; clarify empty vs “Finalised ready”; optionally auto-load or clear stale list on date change.
3. Do **not** introduce FinalisedAt, ownership, My OT Prep, or new worklists.
4. Complete live verification of `ux_ot_finalize_prepared_date` before any schema change.
5. Separate PD for late-add SequenceNo / wording and for OTPrepared date-change via Upsert.

### 5. PRODUCT DECISIONS REQUIRED

- Late-add / append after prepare (ops rule + SequenceNo policy + CTA wording).
- Past-date Prepare allowed vs read-only historical Load.
- Timezone / hospital-local “surgery date” vs UTC (if UAT proves wrong-day bugs).
- Confirm PD-FS-12 after live index verification.

### 6. STATE-MACHINE DECISIONS REQUIRED

- Whether counsellor **Upsert** may unlock/reset **OTPrepared** by changing StartTime (vs GuardLocked-only paths).
- Whether any approved transition moves an OTPrepared row to a new surgery date without Reopen.

### 7. DATABASE / SCHEMA DECISIONS REQUIRED

- Only after live verification of `ux_ot_finalize_prepared_date` (**PD-FS-12**). No schema change authorized by this audit.

### 8. TEST GAPS

- Late-add second Prepare same date (happy path + slot conflict).
- Multi-day Finalised discoverability (FE).
- UTC/local day boundary.
- Upsert-on-OTPrepared StartTime change.
- Live index presence check runbook.

### 9. UAT SCENARIOS REQUIRED

Use scenarios **A–P** as Manual UAT scripts, with emphasis on:

- **B/C/D/L** — Finalise today, prepare under future surgery date.
- **F/G** — Prepare list, then late Finalise same date, Prepare again.
- **E/M/N** — Multi-patient sequence.
- **O** — Cross-branch isolation.
- **P** — Attempt date change while OTPrepared (UI Reopen vs Upsert path).
- **Timezone** — late-evening StartTime near day boundary.

### Answer to the UAT-facing question

> How should OT Preparation realistically work when Finalisation can happen days/weeks before the actual surgery date?

**Patients appear on the OT Preparation list for their scheduled surgery date (`StartTime` / `scheduleDate`), regardless of when Finalise occurred. Operators select (or must be shown) that surgery date — not “today’s Finalisations.” Prepare and Load OT List are already built that way; the primary remediation, if authorized later, is discoverability and operational clarity around that existing model — not a new FinalisedAt-based worklist.**

---

## 18. Evidence classification key (used throughout)

| Label | Meaning |
|-------|---------|
| VERIFIED FROM CODE | Observed in FE/BE source |
| VERIFIED FROM DATA | Observed in SQL/migration artifacts |
| VERIFIED FROM EXISTING PRODUCT DECISION | Recorded in `docs/product-decisions/finalize-surgery-ot-preparation-*.md` |
| INFERENCE | Reasonable but not proven in live env |
| UNDEFINED / DECISION REQUIRED | Not encoded as approved business rule |

---

## 19. Governance stop

```
AUDIT ONLY: YES
PRODUCTION CHANGES: NONE
API CHANGES: NONE
DB CHANGES: NONE
PERMISSION CHANGES: NONE
ROUTE CHANGES: NONE
FSM CHANGES: NONE
OWNERSHIP CHANGES: NONE
UAT EXECUTED BY THIS TASK: NO
ACCEPTANCE RECORDED BY THIS TASK: NO
```

**No implementation is authorized by this audit.**

Do not proceed into implementation, Slice 14, Phase 3J, new Product Decisions as implementation tickets, new ownership models, or new OT worklists from this document alone.

**STOP.**

---

## 20. Primary evidence index

| Artifact | Path |
|----------|------|
| Service | `microservices/auth-service/AuthService/Services/OtFinalizeService.cs` |
| Contracts | `microservices/auth-service/AuthService/Services/IOtFinalizeService.cs` |
| Controller | `microservices/auth-service/AuthService/Controllers/CounselingController.cs` |
| Entity | `microservices/auth-service/AuthService/Models/Domain/OtFinalizeSchedule.cs` |
| SQL baseline | `database_migrations/schema/OT_FINALIZE_SCHEDULE_MIGRATION.sql` |
| FE page | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` |
| FE date scope | `apps/hospital-portal-web/src/lib/counsellors-desk/prepare-ot-date-scope.ts` |
| FE API | `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` |
| BE tests | `AuthService.Tests/Services/OtFinalizePrepareOtDateScopeTests.cs` |
| FE tests | `apps/hospital-portal-web/src/lib/counsellors-desk/prepare-ot-date-scope.test.ts` |
| Product decision | `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` |
| Implementation auth | `docs/product-decisions/finalize-surgery-ot-preparation-implementation-authorization.md` |
| Prior audit | `docs/audits/finalize-surgery-ot-preparation-comprehensive-audit.md` |
