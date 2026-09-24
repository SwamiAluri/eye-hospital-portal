# Phase 3I — Slice 9 Readiness Audit

| Field | Value |
|-------|--------|
| **Audit date** | 2026-09-18 |
| **Phase type** | **READINESS / DIAGNOSIS ONLY** — no production code, API, DB, migration, permission, UI, ownership, or test changes |
| **Authoritative parent decisions** | Phase 3H **PD-FS-01**, **PD-POST-01** (WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED) |
| **Prior slices (accepted)** | Slices 1–8 implemented, tested, Manual UAT-accepted |
| **This document** | Exact CURRENT Finalize / Post-Surgery ownership behaviour; ownership-boundary gaps; Product Decision Register PD-S9-* |
| **Production behavior changed?** | **NO** |

**Legend**

| Label | Meaning |
|-------|---------|
| **FACT** | Established from repository evidence (path / method / property) |
| **INFERENCE** | Reasonable conclusion from facts; not a product rule |
| **PRODUCT DECISION** | Open PD-S9-* item — blocks implementation until approved |
| **NOT ESTABLISHED IN CURRENT CODEBASE** | Cannot be proven from this repo |
| **OUT OF SCOPE** | Slice 10+ / OT board ownership / must not change in Slice 9 |

---

## 1. Executive Summary

| Item | CURRENT status |
|------|----------------|
| Finalize Surgery inherits `CounselingSession.CounselorId`? | **NO** |
| Finalize Surgery has its own counsellor owner field? | **NO** |
| Finalize Surgery copies `CounselorId` onto OT entity? | **NO** |
| Finalize Surgery is shared operational queue? | **YES** (tenant-scoped; **not** branch-filtered today) |
| Finalize Surgery uses counselling owner ACL? | **NO** — `counseling_sessions.read` / `.update` only |
| Post-Surgery inherits pre-surgery `CounselorId`? | **NO** (no owner field to inherit into) |
| Post-Surgery has explicit counsellor assignment? | **NO** — PD-POST-01 **not implemented** |
| Post-Surgery is shared branch-authorized list? | **YES** (discharged `patient_journey`; PD16) |
| SurgeryDone clears counselling `CounselorId`? | **NO** — retains; seals Claim/Reassign/Requeue |
| SurgeryDone creates Post-Surgery work? | **NO** — Post-Surgery = discharged journeys only |
| Finalize completion creates Post-Surgery work? | **NO** |
| Silent CounselorId propagation on surgery path? | **NO** writers found |
| Misleading ownership UX? | **YES** — OT cancel toast claims “counselling session re-queued” |

### Core finding

**CURRENT** behaviour already **does not** auto-inherit counselling ownership into Finalize Surgery or Post-Surgery. Finalize Surgery is a **shared** `ot_finalize_schedule` pipeline with **no** `CounselorId`. Post-Surgery is a **shared** discharged-journey list with **no** owner and **no** assign SoT. Counselling `CounselorId` is **retained historically** through Complete / SurgeryDone; lifecycle ownership mutations are **sealed** at SurgeryDone for Claim / Reassign / Requeue, but ownership is **not terminated to NULL**.

Gaps vs working Phase 3H intent: Finalize list **lacks PD16 branch authorization** (PD-FS-01 wording); Post-Surgery **lacks explicit assignment** (PD-POST-01); OT cancel toast / missing `cancel-ot` back-sync are honesty gaps; `AssignSession` lacks SurgeryDone guard; OT soft `Version++` ≠ Slice 7 CAS.

### Final verdict

**READY FOR PRODUCT APPROVAL**

Implementation must not start until PD-S9 decisions are approved. Do **not** treat this document as READY FOR IMPLEMENTATION.

---

## 2. Scope / Non-Scope

### In scope (this audit)

- Finalize Surgery ownership boundary vs counselling
- Post-Surgery ownership boundary vs counselling
- Counselling → surgery / finalize transitions and CounselorId effects
- OT boundary only as it affects counsellor ownership (read-only)
- Queues, permissions, branch auth, history/audit, concurrency, FE ownership labels, tests
- Product Decision Register for Slice 9

### Out of scope (do not solve here)

| Item | Classification |
|------|----------------|
| Slice 10 Follow-up Center honesty / Active-Cold owner labels | **OUT OF SCOPE / FUTURE SLICE** |
| Slice 11 Analytics My Work | **OUT OF SCOPE / FUTURE SLICE** |
| Slice 12 Leave / Reassignment Required | **OUT OF SCOPE / FUTURE SLICE** |
| IP OT board / theater booking redesign | **OUT OF SCOPE** |
| New FollowUps table | **Forbidden** (PD-POST-01 / D6) |
| Changing Slice 1–8 certified behaviours | **Must preserve** |
| Implementing PD-FS-01 / PD-POST-01 | **FUTURE IMPLEMENTATION** |

---

## 3. Current Finalize Surgery Architecture

### 3.1 Canonical route / UI

| Aspect | FACT |
|--------|------|
| Route | `/dashboard/counsellors-desk/finalize-surgery` |
| Page | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` |
| Nav | `sidebar-menu-sections.tsx` — label **Finalize Surgery**, `requiredPermission: 'counseling_sessions.read'` |
| Origin constant | `COUNSELLING_SESSION_ORIGIN.Finalize` → same href |
| Live modal | `FinalizeOtModal.tsx` |
| Legacy drawer | `FinalizeSurgeryDrawer.tsx` — **no page import found** (orphan relative to this route) |

### 3.2 Backend / APIs

| Layer | Location |
|-------|----------|
| Controller | `AuthService.Controllers.CounselingController` |
| Service | `OtFinalizeService` / `IOtFinalizeService` |
| Entity | `OtFinalizeSchedule` → table `ot_finalize_schedule` |
| Audit | `OtFinalizeAuditLog` → `ot_finalize_audit_log` |

| HTTP | Action | Permission |
|------|--------|------------|
| `POST /api/Counseling/ot-schedule` | `UpsertOtSchedule` | `counseling_sessions.update` |
| `GET /api/Counseling/ot-schedule` | `GetFinalizeList` | `.read` |
| `PUT /api/Counseling/ot-schedule/{id}/slot` | `UpdateOtSlot` | `.update` |
| `POST /api/Counseling/ot-schedule/{id}/confirm` | `ConfirmOtSchedule` | `.update` |
| `POST /api/Counseling/ot-schedule/{id}/finalise` | `FinaliseOtSchedule` | `.update` |
| `POST /api/Counseling/ot-schedule/{id}/cancel` | `CancelOtSchedule` | `.update` |
| `POST /api/Counseling/ot-schedule/{id}/reopen` | `ReopenOtCase` | `.update` |
| `POST /api/Counseling/ot-schedule/prepare` | `PrepareOtList` | `.update` |
| `GET /api/Counseling/ot-list?date=` | `GetOtList` | `.read` |
| `GET /api/Counseling/ot-schedule/{id}` | `GetOtScheduleDetail` | `.read` |
| `PUT /api/Counseling/ot-schedule/{id}/details` | `UpdateOtDetails` | `.update` |

**Internal (IP → Auth):** `InternalOtSyncController`

| HTTP | Effect |
|------|--------|
| `POST /api/internal/ot-sync/surgery-done` | `MarkSurgeryDoneAsync` |
| `POST /api/internal/ot-sync/release-for-rebook` | `ReopenAsync` |

Auth: `X-Internal-Key` (not staff JWT).

### 3.3 Entity fields relevant to ownership

**FACT — `OtFinalizeSchedule` has no counsellor owner:**

- Present: `TenantId`, `BranchId?`, clinical/team fields, `Status`, `Version`, `CounsellingSessionId?`, actor audit columns
- **Absent:** `CounselorId`, `AssignedTo`, owner fields
- Evidence: `OtFinalizeSchedule.cs`; `OtFinalizeService.cs` grep — **zero** `CounselorId` references

**FACT — insert path does not set `BranchId`:**

- `UpsertFromCounsellorAsync` insert sets `TenantId`, clinical fields, `CounsellingSessionId` — **not** `BranchId` (`OtFinalizeService.cs` ~125–154)

### 3.4 Queue / worklist source

1. FE: `useFinalizeListQuery` → `counsellorsDeskApi.getFinalizeList`
2. BE: `GetFinalizeListAsync` — `OtFinalizeSchedules` where `TenantId == tenantId && DeletedAt == null`
3. Optional filters: date / UHID / name / status / `CounsellingSessionId`
4. **No** `CounselorId` filter; **no** branch filter
5. FE status tabs filter client-side

**Row creation:** counselling Done+Schedule handoff in `save-counselling-session.ts` → `upsertOtSchedule` / `editOtScheduleSlot` → then `completeSession`.

### 3.5 Status machine

Constants (`OtFinalizeStatus`):  
`NotConfirmed` → `Confirmed` → `Finalised` → `OTPrepared` (locked) → `SurgeryDone` (via IP internal sync)  
Also: any → `Cancelled`; reopen from `OTPrepared` / `Cancelled`.

### 3.6 Ownership classification (Finalize)

| Question | FACT answer |
|----------|-------------|
| 1. Inherits `CounselingSession.CounselorId`? | **No** |
| 2. Copies `CounselorId` into another entity? | **No** |
| 3. Derives ownership indirectly? | **No** for ACL; link is `CounsellingSessionId` for enrichment only |
| 4. Has no ownership? | **Yes** — no counsellor owner SoT |
| 5. Has its own owner? | **No** (surgeon `DoctorId` is clinical team, not counselling owner) |
| 6. Explicit counsellor assignment? | **No** |
| 7. Branch/shared queue semantics? | **Shared tenant queue** — branch column unused / unfiltered |

Aligns with PD-FS-01 “shared / do not inherit” on inheritance; **does not** yet meet PD-FS-01 “branch-authorized” wording.

---

## 4. Current Post-Surgery Architecture

### 4.1 Canonical route / UI

| Aspect | FACT |
|--------|------|
| Host route | `/dashboard/counsellors-desk/surgery-followup` (Follow-up Center) |
| Tab | `id: 'post-surgery'`, label **Post-Surgery** (`followup-presentation.ts`) |
| Page | `surgery-followup/page.tsx` + `usePostSurgeryFollowupsQuery` |
| Dedicated `/post-surgery` route | **NOT ESTABLISHED** |
| Legacy | `/dashboard/follow-ups` with `followUpType: 'Post-Surgery'` — **not** this Centre |

### 4.2 Backend / APIs

| Layer | Location |
|-------|----------|
| Controller | `CounselingController.GetPostSurgeryFollowups` |
| HTTP | `GET /api/Counseling/followups/post-surgery` |
| Permission | `counseling_sessions.read` |
| Service | `FollowupListService.GetPostSurgeryAsync` |
| Branch gate | `ResolveFollowupBranchesAsync` → `FollowupBranchAccessService` |
| Reminder | `POST /api/Counseling/patients/{patientId}/reminders` — `.update` |

### 4.3 Entities / population

| Entity | Role |
|--------|------|
| `PatientJourneyReadOnly` / `patient_journey` | SoT population: `IsDischarged == true`, branch in authorized set |
| `DischargeSummaryReadOnly` | Enrichment |
| `PostOpCareSchedule` / `PostOpVisit` | Pending-visit KPI |

**FACT:** `FollowupListService` does **not** join `counseling_sessions` for Post-Surgery.  
**FACT:** DTO sets `SessionId = null` always (Phase2X G13 honesty) — `GetPostSurgeryAsync` ~233–249.  
**FACT:** `patient_journey.counseling_session_id` exists on IP/auth read models but is **not projected** into Post-Surgery API.

**Absent on DTO:** `CounselorId`, `CounselorName`, `AssignedTo`, counsellor completion status.

### 4.4 Ownership classification (Post-Surgery)

| Question | FACT answer |
|----------|-------------|
| 1. Inherits `CounselingSession.CounselorId`? | **No** |
| 2. Inherits another upstream owner? | **No** |
| 3. Has its own owner? | **No** |
| 4. Has no owner? | **Yes** |
| 5. Explicit assignment? | **No** (PD-POST-01 gap) |
| 6. Shared branch queue semantics? | **Yes** — shared discharged list + PD16 branch scope |

**INFERENCE:** “No inherit” is satisfied by absence of ownership; “explicit assign” is **not** implemented.

---

## 5. Counselling → Surgery Ownership Flow

### 5.1 End-to-end (CURRENT)

```
Owned CounselingSession (CounselorId set via Assign/Claim/Create)
        │ owner ACL on Update / Complete / MarkAddOnSurgery
        ▼
Done + Schedule → UpsertOtSchedule (CounsellingSessionId link; NO CounselorId copy)
        │ completeSession → Status=Completed; CounselorId RETAINED
        ▼
OtFinalizeSchedule shared pipeline (confirm / finalise / prepare)
        │ no counselling owner ACL
        ▼
IP ClinicalState.SurgeryCompleted → MarkSurgeryDoneAsync
        │ OT Status=SurgeryDone only; CounselorId UNCHANGED
        ▼
Claim / Reassign / Requeue REJECTED (SurgeryDone seal)
        │ CounselorId still on session row (historical attribution)
        ▼
IP Discharged → Post-Surgery list (journeys; SessionId=null; no owner)
```

### 5.2 Does any transition copy ownership?

| Transition | File / method | CounselorId effect |
|------------|---------------|-------------------|
| Upsert OT | `OtFinalizeService.UpsertFromCounsellorAsync` | **None** — may update session `IolPower` only via enrichment |
| Complete | `CounselingWorkflowService.CompleteSessionAsync` | **Retained** — Status→Completed; queue→Completed |
| Add-on | `MarkAddOnSurgeryAsync` | **Retained** |
| Confirm / Finalise / Prepare / Cancel / Reopen | `OtFinalizeService.*` | **None** on CS |
| SurgeryDone | `MarkSurgeryDoneAsync` | **None** on CS |
| Discharge | `PatientJourneyService` (IP) | **None** on Auth CS |
| Post-Surgery list | `GetPostSurgeryAsync` | **Read-only**; no owner |
| OT Cancel back-sync | `BackSyncToCounsellingAsync` | HTTP to `{CounsellingService}/counselling/{id}/cancel-ot` — **no Auth ReQueue**; destination route **NOT ESTABLISHED** in this repo |
| ReQueue (Slice 8) | `ReQueueSessionAsync` | **Clears** to NULL — counselling path only; not surgery-driven |

**Production writers of `CounselingSession.CounselorId` remain:** Create / Assign / Claim / Reassign / ReQueue — **not** surgery finalize paths.

### 5.3 SurgeryDone seal (counselling lifecycle)

**FACT:** Claim / Reassign / Requeue reject when linked OT `Status == SurgeryDone`:

- `ClaimSessionForLifecycleAsync` ~1742–1756
- `ReassignSessionAsync` ~2146–2160
- `ReQueueSessionAsync` ~2496–2510

**FACT:** `AssignSessionAsync` (initial assign-if-null) has **no** SurgeryDone guard in current code.

**INFERENCE:** SurgeryDone **seals** most ownership mutations but does **not** terminate ownership to NULL; historical `CounselorId` remains on the completed session.

---

## 6. OT Boundary

| Question | FACT |
|----------|------|
| Does OT own counselling work? | **No** — OT owns `ot_finalize_schedule` pipeline |
| Does OT copy `CounselorId`? | **No** |
| Does OT create Post-Surgery work? | **No** — discharge creates Post-Surgery population |
| Does SurgeryDone propagate ownership downstream? | **No** |
| Is counsellor Finalize Surgery the same as IP OT board? | **No** — distinct domains; IP notifies Auth via internal sync |

**OUT OF SCOPE for Slice 9:** IP OT board UX, theater booking redesign, clinical post-op ward workflows, OT cancel `cancel-ot` service implementation (honesty adjacent — record as PD / future).

---

## 7. Queue / Worklist Analysis

### 7.1 Finalize Surgery

| Aspect | FACT |
|--------|------|
| Entity | `OtFinalizeSchedule` / `ot_finalize_schedule` |
| Active-row definition | Soft-deleted excluded; upsert uniqueness: one non-Cancelled / non-SurgeryDone row per patient+tenant (~65–71) |
| Branch scope | Column exists; **not set on upsert**; **not filtered on list** |
| Owner field | **None** |
| Status | OT state machine (see §3.5) |
| Lifecycle | Counselling Done+Schedule → OT pipeline → SurgeryDone / Cancelled |
| Assignment | None for counsellor; surgeon/theatre are clinical fields |
| Historical rows | Soft-delete; SurgeryDone / Cancelled retained |
| Duplicate active rows | Guarded by patient+status filter on upsert; **NOT ESTABLISHED** whether DB unique index fully enforces |
| Ownership derived or stored? | **Neither** — no counsellor ownership |

**Do not create another worklist** — existing `GET /ot-schedule` is authoritative.

### 7.2 Post-Surgery

| Aspect | FACT |
|--------|------|
| Entity | `patient_journey` (discharged) |
| Active-row definition | `IsDischarged == true && DeletedAt == null` + authorized branch |
| Branch scope | Server PD16 via `FollowupBranchAccessService` |
| Owner field | **None** |
| Status | No counsellor Post-Surgery completion enum |
| Lifecycle | Appears after discharge; aging KPI from `DischargedAt` |
| Assignment | **None** |
| Historical | Discharged journeys remain listable |
| Duplicate active | One journey row per IP journey id; list is journey-keyed |
| Ownership | **Not stored; not derived** |

**Do not create another worklist** — existing `GET /followups/post-surgery` is authoritative.

### 7.3 Waiting List / counselling (boundary only)

Shared `counselor_queue` + session `CounselorId` projection — certified Slices 1–8. SurgeryDone overlays display status; does not create Post-Surgery rows.

---

## 8. Permission Analysis

| Surface | Permission | Owner ACL? |
|---------|------------|------------|
| Finalize list / detail | `counseling_sessions.read` | No |
| Finalize mutate (confirm/finalise/…) | `counseling_sessions.update` | No |
| FE finalize mutate gate | `FINALIZE_OT_MUTATE_PERMISSION` = `.update` (`finalize-ot-authorization.ts`) | No |
| Checklist edit (adjacent) | `counsellor.outpatient_checklist.edit` | Separate |
| Post-Surgery list / stats | `counseling_sessions.read` | No |
| Reminder from Centre | `counseling_sessions.update` | No counselling-owner ACL |
| Session Assign / Reassign / ReQueue | Existing Slice 3/6/8 permissions + owner rules | Yes (session) |

**FACT:** No Post-Surgery-specific or Finalize-owner permission exists.  
**PRODUCT DECISION:** Whether a new permission is required (do not invent in implementation without approval).

**INFERENCE:** Existing `.read` / `.update` can represent **shared** Finalize / Post-Surgery visibility/mutation. Explicit Post-Surgery assign may reuse assign patterns or need a dedicated code — **open**.

---

## 9. Branch Authorization Analysis

| Surface | Server-side? | Frontend? | Assessment |
|---------|--------------|-----------|------------|
| Finalize list / mutate | **Tenant only** — no `FollowupBranchAccessService` | No branch picker | **Missing** vs PD-FS-01 “branch-authorized” |
| `OtFinalizeSchedule.BranchId` | Column unused on upsert | — | **Inconsistent / incomplete** |
| Post-Surgery | **Yes** — `ResolveAccessibleBranchesAsync` | Branch filter inside authorized set | **Present** |
| Waiting List / session lists | PD16 (certified Slice 1+) | — | Contrast for Finalize gap |
| Session ownership mutations | Branch checks on Assign/Reassign/ReQueue (Slices 3/6/8) | — | Counselling only |

Findings recorded as risks / PD items — **not changed**.

---

## 10. Ownership / History / Audit Analysis

| Trail | Finalize Surgery | Post-Surgery |
|-------|------------------|--------------|
| `counseling_session_audit_log` ownership events | **Not** emitted by OT mutations | **N/A** — no owner mutations |
| Slice 5 Ownership History | **Not** written by finalize | **Not** written |
| `OtFinalizeAuditLog` | **Yes** — actor `ChangedBy`, status transitions | **No** |
| Actor columns on OT row | `UpdatedByUserId`, `PreparedBy`, etc. | Journey discharge actors (IP) |

**FACT:** Finalize distinguishes **OT finalizer actor** (OT audit) from **counselling owner** (session `CounselorId`) only by **separate stores** — Finalize UI does **not** project counselling owner.

**PRODUCT DECISION:** Whether Slice 9 must surface “counselling owner vs finalizer” in History/UI (PD-FS-01 wording) without merging trails.

---

## 11. Concurrency Analysis

| Surface | CURRENT | vs Slice 7 |
|---------|---------|------------|
| `CounselingSession.Version` | CAS / expected Version / 409 (certified) | Baseline |
| OT upsert enrichment writing CS | Requires `SessionVersion` when enrichment updates session (~1175–1179) | Aligns for **session** writes |
| `OtFinalizeSchedule.Version` | Soft `Version++` on mutations | **Not** client expected-Version CAS; **no** 409 contract tests found |
| Post-Surgery | Read-only list; no owner mutate | N/A |

**Gap:** OT finalize mutations are **not** Slice-7-equivalent optimistic concurrency. Record as PD — do not implement in this audit.

---

## 12. Frontend / UX Ownership Semantics

| Surface | Ownership UX |
|---------|--------------|
| Finalize Surgery page | **No** Owner / Assigned / Unassigned labels |
| Finalize cancel toast | **Misleading:** ``${rec.patientName} cancelled — counselling session re-queued`` (`finalize-surgery/page.tsx` ~714) — Auth ReQueue **not** called |
| Follow-up Active / Cold | Shows `· Owner: {name\|Unassigned}` from session |
| Post-Surgery rows | **No** Owner line; Call/History/Open Session gated on `sessionId` (always null) |
| Waiting List | Owner projection from session (certified) |
| Analytics | Session `CounselorId` / CreatedBy fallback — **not** OT/Post-Surgery aggregation (**Slice 11**) |

### Critical question answers (UX / ACL)

| # | Question | FACT answer |
|---|----------|-------------|
| 11 | UI labels imply ownership where none exists? | Finalize: no owner labels. Cancel toast **implies** requeue ownership action that did not happen. Post-Surgery: no false Owner line. |
| 12 | “My Work” / owner filters aggregate downstream under counselling owner? | Finalize/Post-Surgery lists: **No**. Analytics outcomes under counselor filter are **session** attribution — **OUT OF SCOPE Slice 11**. |
| 13 | Downstream mutations permitted solely because actor is counselling owner? | Finalize / Post-Surgery: **No** — permission-only. Pre-surgery Complete/Update: **Yes** owner ACL. |
| 14 | Stale “Assigned to me” on these workflows? | **No** such filter on Finalize/Post-Surgery. |

---

## 13. Existing Test Coverage

### 13.1 Finalize / OT

| Location | Coverage |
|----------|----------|
| `AuthService.Tests/Services/OtFinalize*.cs` (repo root) | Prepare date scope, scheduling guard, update details, OPD copy |
| `AuthService.Tests/Controllers/CounselingOtAuthorizationContractTests.cs` | Permission attributes on OT endpoints |
| FE `finalize-ot-authorization.test.ts`, `prepare-ot-date-scope.test.ts`, `save-counselling-session.fs01.test.ts`, modal presentation | Authz / handoff / presentation |
| E2E responsive / layout suites | Route load screenshots — not ownership |
| Nested `microservices/.../AuthService.Tests` | **No** OtFinalizeService suite; SurgeryDone fixtures for ownership gates only |

**NONE FOUND:** MarkSurgeryDone / InternalOtSync tests; OT `Version` CAS / 409; CounselorId non-inheritance assertions on finalize path.

### 13.2 Post-Surgery

| Location | Coverage |
|----------|----------|
| `FollowupListServiceTests` | Discharged-only, branch filter, search, stats, permission |
| `Phase2XFollowupSlice1Tests` | `PostSurgery_SessionId_IsNull_WithoutAuthoritativeLink`, populations distinct |
| `Phase2YFollowupHonestyTests` | Contract honesty |
| FE `surgery-followup/page.test.tsx`, `followup-presentation.test.ts` | Shell / aging KPI |
| E2E `counsellor-followup-analytics-phase1.spec.ts` | Tab click |

**NONE FOUND:** Post-Surgery assign / owner tests (feature absent).

### 13.3 Ownership / SurgeryDone (adjacent)

- Slice 6/8: `Reassign_SurgeryDone_Rejected`, `Requeue_SurgeryDone_Rejected`
- Root: `Claim_SurgeryDone_Rejected`
- FE waiting-list lifecycle matrices for SurgeryDone → View

---

## 14. Exact Code Mutation Inventory

Mutations on the counselling → surgery boundary (ownership-relevant):

| File | Method | Endpoint | Entity | CURRENT behavior | Ownership effect |
|------|--------|----------|--------|------------------|------------------|
| `CounselingWorkflowService.cs` | `CompleteSessionAsync` | Complete session API | `CounselingSession`, `CounselorQueue` | Status→Completed; queue Completed | **CounselorId retained** |
| `CounselingWorkflowService.cs` | `MarkAddOnSurgeryAsync` | Add-on API | Session / queue | Queue→AddOnSurgery | **CounselorId retained** |
| `OtFinalizeService.cs` | `UpsertFromCounsellorAsync` | `POST .../ot-schedule` | `OtFinalizeSchedule` (+ optional CS IolPower) | Create/update OT; link `CounsellingSessionId` | **No CounselorId copy** |
| `OtFinalizeService.cs` | `ConfirmAsync` / `FinaliseAsync` / `PrepareOtListAsync` / `UpdateSlotAsync` / `UpdateDetailsAsync` / `ReopenAsync` | OT mutate endpoints | `OtFinalizeSchedule` | Status/fields + soft Version++ + OT audit | **None** on CS owner |
| `OtFinalizeService.cs` | `CancelAsync` | `POST .../cancel` | OT + HTTP back-sync | Status→Cancelled; best-effort `cancel-ot` | **Does not** clear CounselorId / call ReQueue |
| `OtFinalizeService.cs` | `MarkSurgeryDoneAsync` | Internal surgery-done | `OtFinalizeSchedule` | Status→SurgeryDone | **None** on CS |
| `CounselingWorkflowService.cs` | Claim / Reassign / ReQueue | ownership APIs | `CounselingSession` | Reject if SurgeryDone | Seal mutations; ReQueue otherwise → NULL (Slice 8) |
| `CounselingWorkflowService.cs` | `AssignSessionAsync` | Assign API | `CounselingSession` | Assign-if-null | **No** SurgeryDone guard |
| `FollowupListService.cs` | `GetPostSurgeryAsync` | `GET .../post-surgery` | Journey read | List discharged | **No** ownership mutate |
| `PatientJourneyService.cs` (IP) | SurgeryCompleted / Discharged transitions | IP clinical | Journey | Sets clinical/discharge; notifies OT done | **No** Auth CounselorId write |

---

## 15. Risks

### P0

| ID | Risk | Evidence |
|----|------|----------|
| R-S9-P0-01 | OT cancel toast claims counselling “re-queued” while Auth ReQueue / CounselorId clear **do not** run | `finalize-surgery/page.tsx` ~714; `CancelAsync` + missing `cancel-ot` |
| R-S9-P0-02 | Implementing Post-Surgery ownership by inventing a **FollowUps** table or silently stamping journey with counselling `CounselorId` | Forbidden by PD-POST-01 / D6; would break honesty |

### P1

| ID | Risk | Evidence |
|----|------|----------|
| R-S9-P1-01 | Finalize list is **tenant-wide**, not branch-authorized — contradicts PD-FS-01 wording / cross-branch leakage | `GetFinalizeListAsync` tenant-only; `BranchId` unset |
| R-S9-P1-02 | PD-POST-01 explicit assign **unimplemented** — ops cannot assign Post-Surgery responsibility | No owner field / API |
| R-S9-P1-03 | SurgeryDone **retains** `CounselorId` while sealing Claim/Reassign/Requeue — ambiguous “termination” semantics for product | Complete + MarkSurgeryDone + guards |
| R-S9-P1-04 | `AssignSession` can still assign SurgeryDone-linked sessions | Guard absent on Assign only |
| R-S9-P1-05 | Counselling owner vs OT finalizer not distinguished in Finalize UX/History | Separate audits; UI silent |
| R-S9-P1-06 | Post-Surgery `SessionId` always null blocks Open Session / Call / History from tab | G13; journey column unused |

### P2

| ID | Risk | Evidence |
|----|------|----------|
| R-S9-P2-01 | OT soft `Version++` without Slice-7 CAS | `OtFinalizeService` bumps; no expected Version on most OT endpoints |
| R-S9-P2-02 | No automated tests for MarkSurgeryDone / CounselorId non-propagation | Coverage inventory §13 |
| R-S9-P2-03 | Orphan `FinalizeSurgeryDrawer` / unused mock finalize list noise | Dead / unused paths |
| R-S9-P2-04 | Analytics CreatedBy fallback may still attribute agreed sessions post-surgery under owner — Slice 11 | `CounselingAnalyticsService` |

---

## 16. Product Decision Register

All items **Status = OPEN**. None approved. Do not implement.

### PD-S9-01 — Finalize Surgery ownership inheritance

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-01 |
| **Question** | Should Finalize Surgery inherit `CounselingSession.CounselorId` as OT/finalization owner? |
| **Current evidence** | No inheritance; no owner field; `OtFinalizeService` never reads CounselorId. Phase 3H PD-FS-01 says No. |
| **Recommended product decision** | **Confirm: No inheritance.** Preserve shared operational model. |
| **Rationale** | Matches CURRENT code and PD-FS-01; avoids silent ownership carry-forward. |
| **Affected workflows** | Finalize Surgery, Waiting List display, Analytics attribution |
| **Implementation impact** | Guardrails/tests asserting non-write; no schema owner field |
| **UAT implication** | Finalize as non-owner; any staff with `.update` may finalize |
| **Status** | **OPEN** |

### PD-S9-02 — Post-Surgery ownership inheritance

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-02 |
| **Question** | Should Post-Surgery inherit pre-surgery `CounselorId`? |
| **Current evidence** | No owner field; list is journeys; SessionId null. PD-POST-01 forbids auto-inherit. |
| **Recommended product decision** | **Confirm: No auto-inherit.** |
| **Rationale** | Matches CURRENT absence; aligns PD-POST-01. |
| **Affected workflows** | Follow-up Center Post-Surgery |
| **Implementation impact** | Must not stamp journey/session from counselling owner on discharge |
| **UAT implication** | Post-Surgery rows not auto-owned by pre-surgery counsellor |
| **Status** | **OPEN** |

### PD-S9-03 — Authoritative owner source per workflow

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-03 |
| **Question** | If neither inherits, what is the authoritative owner source for Finalize vs Post-Surgery? |
| **Current evidence** | Finalize: none. Post-Surgery: none. Counselling: `CounselingSession.CounselorId`. |
| **Recommended product decision** | Finalize: **no counsellor owner** (shared ops). Post-Surgery: **explicit Post-Surgery assignment SoT** (design D6) or remain permanently shared-unowned — product must choose. |
| **Rationale** | PD-FS-01 vs PD-POST-01 differ; code already matches Finalize; Post-Surgery incomplete. |
| **Affected workflows** | Finalize, Post-Surgery, History |
| **Implementation impact** | D6 design required if assign chosen |
| **UAT implication** | Clear “who owns what” per tab |
| **Status** | **OPEN** |

### PD-S9-04 — Shared operational queue confirmation

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-04 |
| **Question** | Are Finalize Surgery and Post-Surgery shared operational queues? |
| **Current evidence** | Yes for both (tenant OT list; branch discharged journeys). |
| **Recommended product decision** | **Confirm shared** for both; do not add owner filters to lists. |
| **Rationale** | Hybrid PD7 model; certified Waiting List pattern. |
| **Affected workflows** | Both Centre surfaces |
| **Implementation impact** | Visibility remains permission + branch (where enforced) |
| **UAT implication** | Any authorized counsellor sees same queue members |
| **Status** | **OPEN** |

### PD-S9-05 — Post-Surgery explicit assignment required?

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-05 |
| **Question** | Does Post-Surgery require explicit counsellor assignment in Slice 9? |
| **Current evidence** | Not implemented; PD-POST-01 says yes. Dependency D6 (persistence without FollowUps table) open. |
| **Recommended product decision** | Choose: (A) implement explicit assign in Slice 9 after D6 SoT approval, or (B) defer assign to later slice and keep shared-unowned for Slice 9 (honesty-only). |
| **Rationale** | Avoid inventing SoT under time pressure. |
| **Affected workflows** | Post-Surgery |
| **Implementation impact** | High if A; low if B |
| **UAT implication** | Assign button vs “no owner forever” |
| **Status** | **OPEN** |

### PD-S9-06 — Finalize explicit counsellor assignment?

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-06 |
| **Question** | Does Finalize Surgery require explicit counsellor assignment? |
| **Current evidence** | No; PD-FS-01 shared; no owner field needed per PD notes. |
| **Recommended product decision** | **No** — remain shared without counsellor assign. |
| **Rationale** | Matches code + PD-FS-01. |
| **Affected workflows** | Finalize |
| **Implementation impact** | None for assign feature |
| **UAT implication** | No Assign on Finalize rows |
| **Status** | **OPEN** |

### PD-S9-07 — SurgeryDone and counselling ownership termination

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-07 |
| **Question** | Does SurgeryDone terminate counselling ownership (`CounselorId → NULL`)? |
| **Current evidence** | **No** — retains; seals Claim/Reassign/Requeue. |
| **Recommended product decision** | Prefer: **retain historically**; treat SurgeryDone as **sealed** for ownership mutations (not NULL clear). Document Complete similarly. |
| **Rationale** | Preserves audit attribution; matches CURRENT; avoids silent clear. |
| **Affected workflows** | Waiting List, History, ReQueue, Analytics |
| **Implementation impact** | Possibly Assign SurgeryDone guard only; no mass NULL |
| **UAT implication** | SurgeryDone sessions show historical owner; no ReQueue/Claim/Reassign |
| **Status** | **OPEN** |

### PD-S9-08 — Finalize completion → Post-Surgery work?

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-08 |
| **Question** | Does Finalize Surgery completion create Post-Surgery work? |
| **Current evidence** | **No** — Post-Surgery = discharged journeys; Finalise ≠ discharge. |
| **Recommended product decision** | **Confirm: No.** Keep discharge as Post-Surgery entry. |
| **Rationale** | Matches CURRENT SoT; avoid dual creators. |
| **Affected workflows** | Finalize, Post-Surgery, IP discharge |
| **Implementation impact** | None if confirm |
| **UAT implication** | Finalised OT does not appear in Post-Surgery until discharged |
| **Status** | **OPEN** |

### PD-S9-09 — CounselorId at each boundary

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-09 |
| **Question** | What happens to `CounselingSession.CounselorId` at Complete, Finalize, SurgeryDone, Discharge, Post-Surgery? |
| **Current evidence** | Retained through Complete/Finalize/SurgeryDone/Discharge; unused by Post-Surgery API. |
| **Recommended product decision** | Codify CURRENT: retain on session; never copy to OT/Post; Post may show historical attribution only if link exists (future). |
| **Rationale** | Honesty + PD-FS-01 / PD-POST-01. |
| **Affected workflows** | All boundaries |
| **Implementation impact** | Documentation + regression tests |
| **UAT implication** | Owner column unchanged across surgery unless ReQueue/Reassign |
| **Status** | **OPEN** |

### PD-S9-10 — Historical counselling owner vs independent downstream

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-10 |
| **Question** | Is counselling owner retained historically only, while downstream ownership is independent? |
| **Current evidence** | Yes in practice for Finalize/Post (independent = no owner). |
| **Recommended product decision** | **Confirm** independent downstream; historical counselling owner on session only. |
| **Rationale** | Hybrid model. |
| **Affected workflows** | History, Finalize, Post-Surgery |
| **Implementation impact** | Optional display of historical owner on Finalize (read-only) |
| **UAT implication** | Finalizer ≠ counselling owner |
| **Status** | **OPEN** |

### PD-S9-11 — Silent API CounselorId propagation

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-11 |
| **Question** | Are any existing APIs silently propagating CounselorId into Finalize/Post-Surgery? |
| **Current evidence** | **No** writers found on those paths. |
| **Recommended product decision** | Treat non-propagation as **invariant**; add regression tests in implementation slice. |
| **Rationale** | Prevent future regressions. |
| **Affected workflows** | OT upsert, MarkSurgeryDone, discharge |
| **Implementation impact** | Tests only (unless bugs found later) |
| **UAT implication** | Spot-check CounselorId unchanged after finalize by another user |
| **Status** | **OPEN** |

### PD-S9-12 — Finalize branch authorization (PD16)

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-12 |
| **Question** | Must Finalize Surgery enforce server-side branch authorization in Slice 9? |
| **Current evidence** | Missing; BranchId unset; PD-FS-01 says branch-authorized. |
| **Recommended product decision** | Choose: (A) implement PD16 on OT list/mutate + set BranchId from session, or (B) amend PD-FS-01 to tenant-shared intentionally. |
| **Rationale** | Gap is real; product must pick. |
| **Affected workflows** | Finalize Surgery |
| **Implementation impact** | Medium if A |
| **UAT implication** | Cross-branch OT visibility |
| **Status** | **OPEN** |

### PD-S9-13 — Permissions for Finalize / Post-Surgery / assign

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-13 |
| **Question** | Can existing `counseling_sessions.read` / `.update` represent desired boundaries, or is a new permission required? |
| **Current evidence** | Shared ops use those codes today; no Post-Surgery assign permission. |
| **Recommended product decision** | Prefer **reuse** existing codes for shared ops; if Post-Surgery assign ships, decide reuse vs new code **before** inventing. |
| **Rationale** | Audit forbids inventing permissions without PD. |
| **Affected workflows** | IAM, Finalize, Post-Surgery |
| **Implementation impact** | Catalog change only if new code approved |
| **UAT implication** | Permission matrix |
| **Status** | **OPEN** |

### PD-S9-14 — History / Audit for Finalize / Post-Surgery ownership

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-14 |
| **Question** | Must Finalize/Post ownership (or actor) changes write counselling History/Audit, OT audit only, or both? |
| **Current evidence** | OT audit exists; counselling ownership trail unused by OT; Post has no owner events. |
| **Recommended product decision** | Keep OT audit for OT status; do **not** invent counselling Ownership* events for OT finalize; if Post assign ships, define events then. |
| **Rationale** | Avoid conflating domains (Slice 5 SoT). |
| **Affected workflows** | History modals, compliance |
| **Implementation impact** | Display clarity vs new events |
| **UAT implication** | Actor visibility |
| **Status** | **OPEN** |

### PD-S9-15 — Concurrency for Finalize / Post-Surgery

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-15 |
| **Question** | Should OT finalize adopt Slice 7 Version/409 CAS in Slice 9? |
| **Current evidence** | Soft Version++ only; no tests. |
| **Recommended product decision** | Prefer **defer** full OT CAS unless product prioritizes; do not weaken session Slice 7. |
| **Rationale** | Scope control; different entity. |
| **Affected workflows** | Finalize concurrent edits |
| **Implementation impact** | High if required now |
| **UAT implication** | Stale OT edit behaviour |
| **Status** | **OPEN** |

### PD-S9-16 — Queue / lifecycle honesty

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-16 |
| **Question** | Confirm authoritative queues and lifecycle entry rules for Finalize vs Post-Surgery? |
| **Current evidence** | OT schedule vs discharged journeys; Finalise ≠ Post-Surgery entry. |
| **Recommended product decision** | **Confirm CURRENT SoTs**; no new worklists. |
| **Rationale** | Audit requirement. |
| **Affected workflows** | Both |
| **Implementation impact** | Docs/tests |
| **UAT implication** | Entry conditions documented |
| **Status** | **OPEN** |

### PD-S9-17 — UI ownership labels / cancel toast

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-17 |
| **Question** | How should Finalize cancel toast and any ownership labels be corrected? |
| **Current evidence** | Toast overclaims re-queue; Finalize has no Owner column. |
| **Recommended product decision** | Fix toast to truthful OT-cancelled wording; do not add false Owner labels on Finalize; Post-Surgery Owner only if assign SoT exists. |
| **Rationale** | P0 honesty. |
| **Affected workflows** | Finalize cancel UX |
| **Implementation impact** | Small FE copy (+ optional cancel-ot honesty later) |
| **UAT implication** | Toast accuracy |
| **Status** | **OPEN** |

### PD-S9-18 — Owner filters / Assigned-to-me

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-18 |
| **Question** | Should any “My Work” / owner filter include Finalize or Post-Surgery under counselling owner? |
| **Current evidence** | Lists do not; Analytics is Slice 11. |
| **Recommended product decision** | **No** for Slice 9 lists; Analytics remains Slice 11. |
| **Rationale** | Shared queue model. |
| **Affected workflows** | Finalize, Post-Surgery, Analytics |
| **Implementation impact** | Guard against accidental filters |
| **UAT implication** | Lists stay shared |
| **Status** | **OPEN** |

### PD-S9-19 — Interaction with SurgeryDone seals

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-19 |
| **Question** | Should `AssignSession` also reject SurgeryDone (parity with Claim/Reassign/Requeue)? |
| **Current evidence** | Assign lacks guard. |
| **Recommended product decision** | **Yes — reject Assign on SurgeryDone** for parity / seal honesty. |
| **Rationale** | Closes P1 gap without clearing ownership. |
| **Affected workflows** | Assign, Waiting List |
| **Implementation impact** | Small backend + tests |
| **UAT implication** | Cannot Assign SurgeryDone sessions |
| **Status** | **OPEN** |

### PD-S9-20 — Interaction with Requeue (Slice 8)

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-20 |
| **Question** | How does Slice 9 interact with certified Requeue→NULL? |
| **Current evidence** | Requeue blocked when SurgeryDone; otherwise clears owner. OT cancel does not call Requeue. |
| **Recommended product decision** | **Preserve Slice 8**; do not route OT cancel through Requeue unless separate PD; fix toast honesty separately. |
| **Rationale** | Non-regression. |
| **Affected workflows** | Requeue, OT cancel |
| **Implementation impact** | Boundary tests |
| **UAT implication** | SurgeryDone cannot requeue |
| **Status** | **OPEN** |

### PD-S9-21 — Interaction with Follow-up Center (Slice 10 boundary)

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-21 |
| **Question** | What Post-Surgery vs Active/Cold ownership work stays in Slice 9 vs Slice 10? |
| **Current evidence** | Active/Cold show Owner; Post does not; Slice 10 scoped to Follow-up honesty. |
| **Recommended product decision** | Slice 9: Finalize + Post-Surgery boundary / assign SoT decision. Slice 10: Active/Cold label honesty / no My Follow-ups. |
| **Rationale** | Scope discipline. |
| **Affected workflows** | Follow-up Center |
| **Implementation impact** | Split PRs |
| **UAT implication** | Separate UAT scripts |
| **Status** | **OPEN** |

### PD-S9-22 — Interaction with OT / cancel-ot

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-22 |
| **Question** | Is implementing Auth-side cancel-ot / RepeatCounselling back-sync in Slice 9? |
| **Current evidence** | HTTP to missing service; Slice 8 marked adjacent/out of scope. |
| **Recommended product decision** | Prefer **OUT OF SCOPE** for Slice 9 core; optional honesty-only toast; full back-sync as separate PD/slice. |
| **Rationale** | Avoid OT/counselling service rebuild inside ownership boundary slice. |
| **Affected workflows** | OT cancel, RepeatCounselling |
| **Implementation impact** | Deferred |
| **UAT implication** | Known gap documented |
| **Status** | **OPEN** |

### PD-S9-23 — Interaction with Analytics (Slice 11)

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-23 |
| **Question** | Does Slice 9 change Analytics My Work / CreatedBy fallback? |
| **Current evidence** | Analytics filters sessions by CounselorId; not OT/Post lists. |
| **Recommended product decision** | **No** — Slice 11 only. |
| **Rationale** | Scope. |
| **Affected workflows** | Analytics |
| **Implementation impact** | None |
| **UAT implication** | None in Slice 9 |
| **Status** | **OPEN** |

### PD-S9-24 — Preserve historical counselling ownership

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-24 |
| **Question** | Must historical counselling `CounselorId` / History/Audit remain immutable when another staff finalizes surgery? |
| **Current evidence** | Finalize does not rewrite CounselorId; OT audit separate. |
| **Recommended product decision** | **Confirm preserve** — never rewrite counselling owner because finalizer ≠ owner. |
| **Rationale** | PD-FS-01. |
| **Affected workflows** | Finalize, History, compliance |
| **Implementation impact** | Invariant tests |
| **UAT implication** | Owner unchanged after third-party finalize |
| **Status** | **OPEN** |

### PD-S9-25 — Post-Surgery assignment persistence SoT (D6)

| Field | Value |
|-------|--------|
| **Decision ID** | PD-S9-25 |
| **Question** | Where does Post-Surgery assignment persist without a FollowUps table? |
| **Current evidence** | No SoT; journey has `CounselingSessionId` unused by Post API; PD forbids new FollowUps table. |
| **Recommended product decision** | Design options for product: extend journey column(s), reuse session with authoritative link, or other **existing** entity — **decide before coding**. |
| **Rationale** | Implementation readiness D6. |
| **Affected workflows** | Post-Surgery assign |
| **Implementation impact** | Blocks PD-S9-05 option A |
| **UAT implication** | Assign survives refresh |
| **Status** | **OPEN** |

---

## 17. Proposed Target Ownership Model

Conceptual only — **not implemented**:

```
Counselling (active work)
    CounselorId = operational owner (Assign / Claim / Reassign / Requeue→NULL)
        │
        ▼  surgery boundary (Complete / OT upsert)
Surgery boundary
    CounselorId RETAINED on CounselingSession (historical + sealed later)
    NO copy onto OT / Post-Surgery
        │
        ▼
Finalize Surgery  (shared operational queue)
    NO counsellor owner
    Branch-authorized (target; PD-S9-12)
    Actor = staff who confirm/finalise (OT audit)
        │
        ▼  IP SurgeryCompleted → SurgeryDone (seal counselling ownership mutations)
        │
        ▼  IP Discharged
Post-Surgery  (shared branch queue)
    NO auto-inherit
    Explicit assign IF PD-S9-05/25 approve SoT
    Else remain shared-unowned until assigned
```

| Zone | Ownership exists? |
|------|-------------------|
| Active counselling | **Yes** — `CounselorId` |
| Finalize Surgery | **No** counsellor ownership |
| Post-Surgery | **Only if** explicit assign SoT approved |
| Historical counselling after SurgeryDone | **Attribution retained**; mutations sealed |

---

## 18. Implementation Boundary

### IN SCOPE for Slice 9 (after PD approval)

- Preserve Finalize shared / no CounselorId inheritance (invariants + tests)
- Preserve Post-Surgery no auto-inherit
- Honesty fixes approved under PD-S9-17 (toast)
- Optional: Finalize PD16 branch auth (PD-S9-12)
- Optional: Post-Surgery explicit assign **only after** PD-S9-05 + PD-S9-25 SoT
- Optional: Assign SurgeryDone guard (PD-S9-19)
- Actor/owner display clarity if PD-S9-14 requires
- Regression: Slices 1–8 behaviours untouched

### OUT OF SCOPE

- Slice 10 Follow-up Active/Cold honesty / My Follow-ups
- Slice 11 Analytics My Work
- Slice 12 Leave / Reassignment Required
- New FollowUps table
- IP OT board redesign
- Full cancel-ot microservice implementation (unless separately approved)
- Changing Requeue→NULL / Version CAS / owner ACL certified rules
- New design system / permissions invented without PD

---

## 19. Readiness Verdict

**READY FOR PRODUCT APPROVAL**

Repository evidence is sufficient to answer the critical ownership questions, inventory mutations, and open a complete PD-S9 register. Remaining blockers are **product choices** (especially Post-Surgery assign SoT D6, Finalize branch auth, SurgeryDone termination semantics, cancel toast/back-sync scope) — not missing discovery.

Do **not** start implementation until PD-S9 items are approved.

---

## Appendix A — Critical questions (1–14) quick reference

| # | Answer (CURRENT / recommended) |
|---|--------------------------------|
| 1 | Should Finalize inherit CounselorId? **CURRENT No. Recommend No (PD-S9-01).** |
| 2 | Should Post-Surgery inherit? **CURRENT No. Recommend No (PD-S9-02).** |
| 3 | Authoritative owner source? Finalize **none**; Post **none today**; counselling **CounselorId** (PD-S9-03). |
| 4 | Shared queues? **Yes** both (PD-S9-04). |
| 5 | Explicit counsellor assignment required? Finalize **No**; Post **product choice** (PD-S9-05/06). |
| 6 | SurgeryDone terminate ownership? **CURRENT No (retain + seal). Recommend retain (PD-S9-07).** |
| 7 | Finalize creates Post-Surgery? **No** (PD-S9-08). |
| 8 | CounselorId at boundaries? **Retained on session; not copied** (PD-S9-09). |
| 9 | Historical only / downstream independent? **Yes** (PD-S9-10). |
| 10 | Silent propagation APIs? **None found** (PD-S9-11). |
| 11 | Misleading UI labels? **Cancel toast yes**; Finalize owner labels no (PD-S9-17). |
| 12 | My Work aggregates downstream? **Not on these lists** (PD-S9-18 / Slice 11). |
| 13 | Mutations solely via counselling owner? Finalize/Post **No** (permission-only). |
| 14 | Stale Assigned-to-me? **Not on these workflows.** |

## Appendix B — Key file index

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/save-counselling-session.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/finalize-ot-authorization.ts`
- `microservices/auth-service/AuthService/Services/OtFinalizeService.cs`
- `microservices/auth-service/AuthService/Services/FollowupListService.cs`
- `microservices/auth-service/AuthService/Services/CounselingWorkflowService.cs`
- `microservices/auth-service/AuthService/Controllers/CounselingController.cs`
- `microservices/auth-service/AuthService/Controllers/InternalOtSyncController.cs`
- `microservices/auth-service/AuthService/Models/Domain/OtFinalizeSchedule.cs`
- `microservices/ip-management-service/IpManagementService/Services/PatientJourneyService.cs`
- `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` (PD-FS-01, PD-POST-01)
