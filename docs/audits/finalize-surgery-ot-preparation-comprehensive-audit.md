# Finalize Surgery + OT Preparation Comprehensive Audit

| Field | Value |
|-------|--------|
| **Document type** | **AUDIT ONLY — NO IMPLEMENTATION** |
| **Date** | 2026-09-22 |
| **Program** | Hospital Portal — Counsellor / Finalize Surgery / OT Preparation |
| **Mode** | Repository-level reconciliation (UI · UX · business · state machine · API · data · permissions · tests · docs) |
| **Production code / API / DB / permissions / routes / ownership / UI modified** | **NO** |
| **Product Decision created or approved** | **NO** |
| **Phase 3I reopened** | **NO** |
| **Slice 14 created** | **NO** |
| **Phase 3J created** | **NO** |
| **UX redesign implemented** | **NO** |
| **Manual UAT executed** | **NO** |
| **Acceptance recorded** | **NO** |

---

## 1. Audit Metadata

| Item | Value |
|------|--------|
| Auditor mode | Read-only discovery across `apps/hospital-portal-web` and `microservices/auth-service` (+ IP Management SurgeryDone handoff) |
| Authoritative SoT for finalize FSM | AuthService `OtFinalizeService` + table `ot_finalize_schedule` |
| Parallel non-SoT OT track | `OTBookingController` / `ot_schedules` (Quick-Book) — **must not be confused** with finalize |
| Governance sequence | AUDIT → PRODUCT DECISION → IMPLEMENTATION → TESTS → UAT → ACCEPTANCE |
| This document authorizes | **Nothing** — discovery and gap classification only |

---

## 2. Scope

**In scope**

- Finalize Surgery screen and OT Preparation workspace (same route)
- Confirm / Finalise / Cancel / Reopen / Prepare OT List / Load OT List / Surgery Done
- Status tabs, KPIs, search/filter/pagination, detail modal
- Branch authorization, theatre dropdown, permissions
- OT Returned **intersection** with Finalize (boundary verification only)
- Second-eye / Repeat Counselling / ReEvaluate vs SurgeryDone sealing
- Automated tests and documentation drift

**Out of scope (do not change; do not reopen)**

- CounselorId ownership model; Assign/Reassign/ReQueue; Sessions Reassignment Required
- Waiting List redesign (C-01 closed); Follow-up Center; Analytics My Work
- Creating My Finalize / My OT Preparation / Counsellor Dashboard
- Redesigning OT Returned lifecycle
- Backend schema redesign; new APIs; new permissions
- Phase 3I / Slice 14 / Phase 3J naming or reopen

---

## 3. Governance Baseline

| Baseline | Status | Evidence |
|----------|--------|----------|
| Phase 3I | **CLOSED** | Portfolio PD; final acceptance reconciliation audit |
| Slice 13 | **CLOSED** | Slice 13 closure artifacts |
| C-01 Waiting List redesign | **ACCEPTED + CLOSED** | C-01 acceptance-closure |
| Slice 14 | **DOES NOT EXIST** | Explicit portfolio / residual UAT statements |
| Phase 3J | **NOT CREATED** | Explicit portfolio statements |
| Current authorized implementation | **NONE** | Same |
| Finalize ownership | **Shared operational surface** — no CounselorId on `ot_finalize_schedule` | Slice 9 tests + entity |
| This effort label | **Separate Finalize Surgery / OT Preparation reconciliation audit** — not Slice 14 / Phase 3J / C-01 follow-up | This document |

---

## 4. Repository Evidence

### 4.1 Primary frontend files

| Path | Role |
|------|------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | Page shell, KPIs, status tabs, queue, Prepare modal, OT Preparation workspace |
| `…/finalize-surgery/loading.tsx` | Route loading skeleton |
| `apps/hospital-portal-web/src/components/counsellors-desk/FinalizeOtModal.tsx` | Surgery detail + state-aware actions |
| `…/FinalizeSurgeryDrawer.tsx` | **Orphan** — not imported by page |
| `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` | OT schedule/list API client |
| `apps/hospital-portal-web/src/hooks/use-counsellors-desk-queries.ts` | `useFinalizeListQuery` |
| `apps/hospital-portal-web/src/lib/counsellors-desk/finalize-ot-authorization.ts` | Permissions + row primary CTA |
| `apps/hospital-portal-web/src/lib/counsellors-desk/prepare-ot-date-scope.ts` | Prepare date eligibility |
| `apps/hospital-portal-web/src/types/counsellors-desk.ts` | `FinalizeStatus`, record/detail types |
| `apps/hospital-portal-web/src/lib/navigation/sidebar-menu-sections.tsx` | Nav: Finalize Surgery |

### 4.2 Primary backend files

| Path | Role |
|------|------|
| `microservices/auth-service/AuthService/Models/Domain/OtFinalizeSchedule.cs` | Entity + `OtFinalizeStatus` constants |
| `microservices/auth-service/AuthService/Services/OtFinalizeService.cs` | Authoritative FSM + list/detail/prepare |
| `microservices/auth-service/AuthService/Services/IOtFinalizeService.cs` | DTOs / contracts |
| `microservices/auth-service/AuthService/Controllers/CounselingController.cs` | Public OT endpoints (~L1821–2608) |
| `microservices/auth-service/AuthService/Controllers/InternalOtSyncController.cs` | SurgeryDone + release-for-rebook |
| `microservices/auth-service/AuthService/Services/FollowupBranchAccessService.cs` | Branch authorization |
| `microservices/ip-management-service/IpManagementService/Services/PatientJourneyService.cs` | SurgeryCompleted → MarkSurgeryDone |
| `database_migrations/schema/OT_FINALIZE_SCHEDULE_MIGRATION.sql` | Baseline SQL (partial vs current entity) |

### 4.3 OT Returned / second-eye evidence (adjacent)

| Path | Role |
|------|------|
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-returned-membership.ts` | OT Returned membership (Waiting List) |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx` | OT Returned tab host |
| `CounselingWorkflowService.TryGetCreateSessionReuseBlockAsync` | PD-C create reuse / second-eye |

---

## 5. Current Routes

| Route | Exists | Notes |
|-------|--------|-------|
| `/dashboard/counsellors-desk/finalize-surgery` | **YES** | Single production surface |
| Dedicated `/…/ot-preparation` | **NO** | OT Preparation is a **workspace tab** (`activeWorkspace === 'ot-preparation'`) on the same page |
| Sidebar | Yes | Label `Finalize Surgery`; `requiredPermission: 'counseling_sessions.read'` |

**FACT:** OT Preparation is not a separate App Router route.

---

## 6. Current UI Architecture

```
FinalizeSurgeryPage (ProtectedRoute: counseling_sessions.read)
├── KPI strip (client-derived from loaded list)
├── Workspace tabs: Surgery Finalization | OT Preparation
├── [Finalization workspace]
│   ├── Status tabs (client filter)
│   ├── Filters: Date / UHID / Patient name (server)
│   ├── Prepare OT List toolbar action
│   ├── Surgery Queue grid (5 cue columns)
│   └── Client pagination (10/25/50)
├── [OT Preparation workspace]
│   ├── Date + Load OT List + Prepare New List
│   └── Prepared list OR empty state
├── FinalizeOtModal (custom fixed overlay)
└── PrepareOtListModal (inline in page)
```

**Design primitives:** counselling-session kit (`CounsellingButton`, `CounsellingInput`, tokens). **Not** shadcn `Dialog` / `Sheet` / `Table` / `Tabs` on this surface.

**Ownership framing:** no CounselorId, no “My Finalize”, no assign UI on this page — **EXISTING CERTIFIED BEHAVIOR — PRESERVE**.

**OT Returned UI on this surface:** **NONE** (lives on Waiting List).

---

## 7. Current API Inventory

| Operation | HTTP | Endpoint | Caller | Authorization | Service | DB Mutation | State Change | Concurrency | Tests |
|-----------|------|----------|--------|---------------|---------|-------------|--------------|-------------|-------|
| List finalize | GET | `/api/Counseling/ot-schedule` | `useFinalizeListQuery` | `counseling_sessions.read` + branch set | `GetFinalizeListAsync` | none | — | empty if no branches | Slice 9 |
| Detail | GET | `/api/Counseling/ot-schedule/{id}` | `FinalizeOtModal` | `.read` + schedule branch | `GetByIdAsync` | may heal BranchId | — | 403 unauthorized | row-open tests |
| Upsert schedule | POST | `/api/Counseling/ot-schedule` | Session Done+Schedule | `.update` + branch | `UpsertFromCounsellorAsync` | INSERT/UPDATE | → `NotConfirmed` | SessionVersion 409 when CS written | FS-01 / session save tests |
| Edit slot | PUT | `/api/Counseling/ot-schedule/{id}/slot` | Session save path | `.update` | `UpdateSlotAsync` | UPDATE | Confirmed→NotConfirmed | GuardLocked → 409 | session save tests |
| Update details | PUT | `/api/Counseling/ot-schedule/{id}/details` | Modal Save / Confirm prep | `.update` | `UpdateDetailsAsync` | UPDATE | Confirmed/Finalised→NotConfirmed | GuardLocked → 409 | UpdateDetails tests |
| Confirm | POST | `…/{id}/confirm` | Queue / Modal | `.update` | `ConfirmAsync` | UPDATE + audit | NotConfirmed→Confirmed | conflict/wrong state → 409 | Slice 9 |
| Finalise | POST | `…/{id}/finalise` | Queue / Modal | `.update` | `FinaliseAsync` | UPDATE + audit | Confirmed→Finalised | wrong state → 409 | Slice 9 |
| Cancel | POST | `…/{id}/cancel` | Modal | `.update` | `CancelAsync` | UPDATE + audit | *→Cancelled | no OT Version CAS | cancel toast FE test |
| Reopen | POST | `…/{id}/reopen` | Queue / Modal / OT list | `.update` | `ReopenAsync` | UPDATE + audit | OTPrepared→Confirmed; Cancelled→NotConfirmed | wrong state → 409 | Slice 9 |
| Prepare list | POST | `/api/Counseling/ot-schedule/prepare` | Prepare modal | `.update` per row | `PrepareOtListAsync` | batch UPDATE | Finalised→OTPrepared + lock | date 400; slot conflict 409 | prepare date-scope tests |
| Load OT list | GET | `/api/Counseling/ot-list?date=` | OT workspace | `.read` + branches | `GetOtListAsync` | none | filter OTPrepared | — | — |
| Theaters | GET | `/api/Counseling/theaters` | Modal | `.read` + branches | inline OTTheaters | none | active only | empty array if none | — |
| Surgeons | GET | `/api/Counseling/surgeons` | Modal | `.read` | users/roles | none | — | — | — |
| Anesthetists | GET | `/api/Counseling/anesthetists` | Modal | `.read` | users/roles | none | — | — | anesthetists FE test |
| Surgery done | POST | `/api/internal/ot-sync/surgery-done` | IP Management | Internal key | `MarkSurgeryDoneAsync` | UPDATE | *→SurgeryDone (skip Cancelled) | idempotent | Slice 9 boundary |
| Release rebook | POST | `/api/internal/ot-sync/release-for-rebook` | IP cancel-today | Internal key | `ReopenAsync` | UPDATE | OTPrepared→Confirmed | — | — |

**Deprecated FE path:** `PUT /CounsellorDesk/finalize/{id}` marked deprecated in API client — not used by current page.

---

## 8. Current Data Model

### 8.1 `ot_finalize_schedule` / `OtFinalizeSchedule`

| Concern | Column / property | Notes |
|---------|-------------------|-------|
| Key | `id` (Guid) | |
| Tenant | `tenant_id` | |
| Branch | `branch_id` | From CounselingSession; list **excludes NULL** |
| Patient | `patient_id`, `uhid`, `patient_name` | Denormalized |
| Surgery | `surgery_name`, `eye` | Eye: RE\|LE\|BE |
| Financial snapshot | `patient_type`, `payment_mode`, `package_name`, `package_rate` | Not claim ledger |
| Team | `doctor_id/name`, `theatre_id/name` | |
| Timing | `start_time`, `end_time`, `reporting_time` | |
| Anaesthesia | `anesthesia_type`, `anesthetist_name`, `iol_power` | |
| Notes | `remarks`, `cancel_reason` | |
| Status | `status` | See §9 |
| OT prep | `sequence_no`, `is_locked`, `prepared_at`, `prepared_by` | |
| Session link | `counselling_session_id` | |
| Concurrency | `version` (int++) | **Not** EF `[ConcurrencyCheck]` / client CAS |
| Soft delete | `deleted_at` | |
| Ownership | **No `CounselorId`** | Certified |

### 8.2 Audit: `ot_finalize_audit_log`

Actions observed in code: Upsert, EditSlot, Confirm, Finalise, Cancel, Reopen, Prepare, UpdateDetails, MarkSurgeryDone.

### 8.3 Related tables (not owned by Finalize UI)

| Entity | Link |
|--------|------|
| `counseling_sessions` | Origin + CounselorId ownership SoT |
| `patient_journey` (IP) | `ot_finalize_schedule_id`, `ot_return_reason`, clinical SurgeryCompleted |
| `ot_theaters` | Theatre master (`IsActive`, `DeletedAt`, `BranchId`) |
| `ot_schedules` | **Legacy/parallel** booking FSM — not finalize SoT |

### 8.4 SQL baseline drift

`OT_FINALIZE_SCHEDULE_MIGRATION.sql` defines status check + indexes including:

- `ux_ot_finalize_patient_active` — one active row per patient (excludes Cancelled/SurgeryDone)
- `ux_ot_finalize_prepared_date` — **unique** `(DATE(start_time), tenant_id)` where `OTPrepared`

SQL baseline **omits** later entity columns (`reporting_time`, package, anesthesia, remarks, cancel_reason) present on C# entity. Index presence in live DBs is **INFERENCE / REQUIRES VERIFICATION** (not found in AuthService EF migrations by name). If the unique prepared-date index exists in production, it would conflict with multi-patient Prepare batches — classify under Gap Register.

---

## 9. Current State Machine

**Canonical constants** (`OtFinalizeStatus`):  
`NotConfirmed` | `Confirmed` | `Finalised` | `OTPrepared` | `Cancelled` | `SurgeryDone`

**There is no `"Scheduled"` status on this table.** KPI label “Scheduled” = count of loaded rows, not a status.

| State | Meaning from Code | Entered By | Exit Actions | Next States | Terminal? | Editable? | OT Eligible? | Surgery Done Eligible? | Evidence |
|-------|-------------------|------------|--------------|-------------|-----------|-----------|--------------|------------------------|----------|
| NotConfirmed | Default after upsert / reopen-from-cancel / edit revert | Upsert; Cancelled→Reopen; Confirm/Finalised→UpdateDetails | Confirm; Cancel; UpdateDetails | Confirmed; Cancelled | No | Yes (if not locked) | No | Yes (MarkSurgeryDone does not require OTPrepared) | `OtFinalizeService` |
| Confirmed | Slot accepted after Confirm conflict check | Confirm | Finalise; Cancel; UpdateDetails/EditSlot→NotConfirmed | Finalised; NotConfirmed; Cancelled | No | Yes | No | Yes | ConfirmAsync L339–391 |
| Finalised | Eligible for OT prepare | Finalise | Prepare; Cancel; UpdateDetails→NotConfirmed | OTPrepared; NotConfirmed; Cancelled | No | Yes until locked | **Yes** (only this) | Yes | FinaliseAsync; PrepareOtListAsync |
| OTPrepared | Locked prepared OT list row | Prepare batch | Reopen→Confirmed; Cancel (service allows); MarkSurgeryDone | Confirmed; Cancelled; SurgeryDone | No | No (`GuardLocked`) | Already prepared | Yes | Prepare; GuardLocked |
| Cancelled | Surgery cancelled | Cancel | Reopen→NotConfirmed | NotConfirmed | Soft terminal | No | No | **No** (MarkSurgeryDone skips) | CancelAsync; MarkSurgeryDoneAsync |
| SurgeryDone | Historical completed surgery | IP `ClinicalState.SurgeryCompleted` → internal sync | **None in counsellor UI** | — | **Yes (sealed for reopen)** | View only in modal | No | Already done | InternalOtSync; FE LOCKED_STATUSES |

**Happy path**

`Upsert → NotConfirmed → Confirm → Confirmed → Finalise → Finalised → Prepare → OTPrepared → (IP SurgeryCompleted) → SurgeryDone`

---

## 10. Transition Matrix

| From State | Action | To State | Role / Permission | API | Validation | DB Mutation | Side Effects | Evidence |
|------------|--------|----------|-------------------|-----|------------|-------------|--------------|----------|
| (none) | Upsert create | NotConfirmed | `counseling_sessions.update` | POST ot-schedule | Session BranchId required | INSERT + audit | Branch from session; no CounselorId | UpsertFromCounsellorAsync |
| Active (not Cancelled/SurgeryDone) | Upsert update | NotConfirmed + unlock | `.update` | POST ot-schedule | Branch access | UPDATE | Reset status | same |
| NotConfirmed | Confirm | Confirmed | `.update` | POST …/confirm | Must be NotConfirmed; doctor/theatre start conflict | Status+Version | Audit Confirm | ConfirmAsync |
| Confirmed | Finalise | Finalised | `.update` | POST …/finalise | Must be Confirmed | Status+Version | Audit Finalise | FinaliseAsync |
| Finalised | Prepare (batch) | OTPrepared + lock | `.update` | POST …/prepare | Date required; items on date; all Finalised; slot vs other OTPrepared; same-day single-eye | Status, SequenceNo, Prepared*, IsLocked | NotifyJourneyOpdCopy (fire-forget) | PrepareOtListAsync |
| OTPrepared | Reopen | Confirmed + unlock | `.update` | POST …/reopen | Must be OTPrepared or Cancelled | Status, IsLocked=false | Audit Reopen; **does not clear SequenceNo/Prepared*** | ReopenAsync L451–481 |
| Cancelled | Reopen | NotConfirmed + unlock | `.update` | POST …/reopen | Same | Status unlock | Audit | ReopenAsync |
| Confirmed | UpdateDetails / EditSlot | NotConfirmed | `.update` | PUT details/slot | Not locked | Fields + status | Journey rebook/opd copy on details | UpdateDetailsAsync L1156–1162 |
| Finalised | UpdateDetails | NotConfirmed + unlock | `.update` | PUT details | Not locked | Fields + status | Same | UpdateDetailsAsync |
| * (service) | Cancel | Cancelled + unlock | `.update` | POST …/cancel | **No status guard in service** (UI excludes SurgeryDone/Cancelled) | Status unlock | Best-effort `cancel-ot` HTTP (destination missing) | CancelAsync |
| * except Cancelled | MarkSurgeryDone | SurgeryDone + unlock | Internal key | internal surgery-done | Skip Cancelled; idempotent | Status | Does **not** clear CounselorId | MarkSurgeryDoneAsync |
| OTPrepared | Edit details/slot | **Rejected** | — | PUT | GuardLocked | — | 409 | GuardLocked L739–744 |
| SurgeryDone | Reopen / Confirm / Finalise | **NOT FOUND** | — | — | — | — | Sealed | Reopen throws; FE no CTA |
| Finalised → Reopen | — | **NOT FOUND** | — | — | Must reopen from OTPrepared only (or Cancelled) | — | — | ReopenAsync else-branch |
| Confirmed → Reopen | — | **NOT FOUND** | — | — | — | — | — | |
| Any → Scheduled | — | **NOT FOUND** | — | — | Not a status | — | — | OtFinalizeStatus |

---

## 11. Status Semantics

| UI label | Backend value | Meaning from code (not marketing) |
|----------|---------------|-----------------------------------|
| Not Confirmed | `NotConfirmed` | Awaiting Confirm; also post-edit revalidation state |
| Confirmed | `Confirmed` | Passed Confirm conflict check |
| Finalised | `Finalised` | Ready for Prepare OT List eligibility |
| OT Prepared | `OTPrepared` | Locked; appears on Load OT List |
| Cancelled | `Cancelled` | Cancelled; reopen → NotConfirmed |
| Surgery Done | `SurgeryDone` | Set by IP clinical completion sync |
| All | — | Client: no status filter |
| Scheduled (KPI) | — | **Not a status** — `records.length` |

**Spelling:** British `Finalised` throughout backend and FE — preserve.

---

## 12. Finalize Surgery Grid Audit

| Visible Field | Source | API | DB | Purpose | Operationally Required? | Duplicate? | Recommended UX Treatment | Business Rule Risk |
|---------------|--------|-----|-----|---------|-------------------------|------------|--------------------------|-------------------|
| Patient name | Record | ot-schedule list | patient_name | Identity | Yes | No | PRIMARY | Low |
| Lock icon | isLocked | list | is_locked | OTPrepared lock signal | Yes | No | PRIMARY status adjacent | Low |
| Duplicate flag | Client UHID+date | — | — | Warn same-day duplicate UHID | Useful | Client-only | SECONDARY banner | Low |
| UHID | Record | list | uhid | Identity | Yes | No | PRIMARY | Low |
| Patient type | Record | list | patient_type | Payer category snapshot | Context | Also in modal | CONTEXT | Do not invent claim rules |
| Surgeon (quiet meta) | Record | list | doctor_name | Team | Secondary | Surgery column / modal | SECONDARY | Low |
| Package (quiet) | Record | list | package_name | Package snapshot | Context | Modal | CONTEXT | Low |
| Payment (quiet) | Record | list | payment_mode | Snapshot | Context | Modal | CONTEXT | Low |
| Slot label (“Slot clear/pending/missing”) | checklistSummary | list overwrite | **Overwritten** | See Gap FS-G-03 | Misleading label | — | Relabel after PD | **High honesty risk** |
| Surgery name | Record | list | surgery_name (+ session backfill) | Procedure | Yes | Modal | PRIMARY | Low |
| Anesthesia type | Record | list | anesthesia_type | Clinical team | Secondary | Modal | SECONDARY / DETAIL | Low |
| Reporting time | Record | list | reporting_time | Ops timing | Secondary | Modal required on Confirm (FE) | SECONDARY | FE-only required |
| Status badge | status | list | status | FSM | Yes | Tabs | PRIMARY | Low |
| Schedule date | scheduleDate | derived StartTime | start_time | Day | Yes | Filters | PRIMARY | Low |
| Eyes | eyes/eye | list | eye | Laterality | Yes | Modal RO | SECONDARY | Low |
| Start time | startTime | list | start_time | Slot | Yes | Modal | SECONDARY | Low |
| Theatre | theaterName | list | theatre_name | Location | Yes | Modal | SECONDARY | Low |
| Package rate | packageRate | list | package_rate | Financial snapshot | Context | Modal | CONTEXT | FE not SoT |
| Print OT Slip | Client HTML | — | — | Print | Ops convenience | — | Secondary action | PHI in print window |
| Primary CTA | Status + mutate perm | local | — | Confirm/Finalise/Reopen/Open | Yes | Modal | PRIMARY action | Queue Confirm skips FE validate |
| Open (row click) | — | detail GET | — | Inspect/edit | Yes | — | READ path | 403 if unauthorized branch |

---

## 13. KPI Audit

Source: **client-only** `statsBar` over loaded `records` from `GET /Counseling/ot-schedule` — **no dedicated stats API**.

| KPI | Calculation | Population | Date range | Branch | Match grid? | Classification |
|-----|-------------|------------|------------|--------|-------------|----------------|
| Scheduled | `records.length` | Loaded list after server filters | Date filter if set; else all branch-authorized rows returned | Authorized branches | Equals “All” count | **B — UX** — label ≠ status; can mislead |
| Needs Attention | Count `NotConfirmed` + `Confirmed` | Same | Same | Same | Equals sum of those tabs | **E — PRODUCT DECISION** for business meaning; **FACT** code definition is those two statuses only |
| Surgery Done | Count `SurgeryDone` | Same | Same | Same | Equals tab | **A — PRESERVE** calculation; usefulness is PD |
| Avg. Wait | Mean days `(scheduleDate − counsellingDate)` where both exist and ≥ 0; else 0 | Same | Same | Same | N/A | **E — PRODUCT DECISION** — counsellingDate field presence/meaning; may be 0 often |

**Needs Attention** does **not** mean payment pending, insurance pending, or incomplete theatre — only pre-Finalise statuses.

---

## 14. Search / Filter / Pagination Audit

| Control | Client vs server | Notes |
|---------|------------------|-------|
| Date | Server (`filters.date` → API) | Debounced 300ms |
| UHID | Server | Contains match |
| Patient name | Server | Contains match |
| Status tabs | **Client only** | API `status` param **not** sent by page (backend supports it) |
| Pagination | Client `sliceWaitingListPage` | Default page size from waiting-list helper (**10**); options 10/25/50 |
| Sort | Server OrderBy StartTime; client preserves | No user sort UI |
| Reset page | On tab/filter/pageSize change | Yes |
| Surgeon / theatre / eye filters | **NOT FOUND** on Finalize UI | Backend list also lacks those filters |

---

## 15. Surgery Detail Modal Audit

**Component:** `FinalizeOtModal` — custom `role="dialog"` overlay (not Radix Dialog/Sheet).

| Field | Source | Required (FE) | Editable | Validation | DTO / DB | State dependency |
|-------|--------|---------------|----------|------------|----------|------------------|
| Surgery / Procedure | Detail | — | RO | — | surgery_name | Always RO |
| Eye | Detail | — | RO | — | eye | Always RO |
| Package | Detail | Optional | Editable if package exists | — | package_name | Locked when OTPrepared/SurgeryDone or !mutate |
| Surgeon | Detail + getSurgeons | Not BE-required | Editable when unlocked | — | doctor_* | |
| Theatre | Detail + getTheaters | Not BE-required | Editable when unlocked | Empty list if no active OTs | theatre_* | Config issue if empty |
| Surgery Date / Start / End | Detail | — | Editable when unlocked | — | start/end | Save on Confirmed/Finalised **reverts** to NotConfirmed |
| Reporting Time | Detail | **Required on Confirm (FE only)** | Editable | FE validate | reporting_time | Backend Confirm does **not** require it |
| Anaesthesia Type | Master + detail | Optional | Editable | — | anesthesia_type | |
| Anaesthetist | getAnesthetists | Conflict check | Editable | Name conflict guard | anesthetist_name | |
| IOL Power | Detail | Cataract/phaco only | Editable | — | iol_power | |
| Payment Mode / Patient Type | Detail | — | RO | — | payment_mode / patient_type | |
| Package Rate | Detail | — | Editable except NotConfirmed/Cancelled/locked | — | package_rate | |
| Remarks | Detail | Optional | Editable | — | remarks | |
| Cancellation Reason | Detail | — | RO when Cancelled | — | cancel_reason | Cancel API does not accept reason body |
| Outpatient checklist | Session-scoped component | Perm `counsellor.outpatient_checklist.edit` | Conditional | Separate APIs | — | |
| Patient demographics block | Age/gender | — | Hidden (`shouldShowPatientDetailsBlock` → false) | — | Enriched on detail | |

`formLocked = status ∈ {OTPrepared, SurgeryDone} OR !canMutateOt`.

---

## 16. Confirm Flow

| # | Question | Answer from code |
|---|----------|------------------|
| 1 | Who can Confirm? | Users with `counseling_sessions.update` + branch access to schedule |
| 2 | Required state | `NotConfirmed` |
| 3 | Mandatory fields | **FE modal:** reporting time (+ anesthetist conflict). **BE:** none beyond status; conflict check only if StartTime set |
| 4 | Validation | BE: status + doctor/theatre exact StartTime conflict among Confirmed\|Finalised\|OTPrepared |
| 5 | Status change | → `Confirmed` |
| 6 | Reserve/lock | No IsLocked |
| 7 | OT list | No |
| 8–9 | Financial / insurance | No mutation |
| 10–11 | PatientJourney / CounselingSession | No direct mutation on Confirm |
| 12 | Audit | `ot_finalize_audit_log` action Confirm |
| 13 | Concurrency | Version++; 409 on conflict/wrong state — **not** stale Version CAS |
| 14 | Grid after success | Invalidate list / onStatusChange merge |
| 15 | Failure | Toast via `finalizeMutationErrorMessage` |

**Divergence:** Queue **Confirm** calls API directly (**skips** FE reporting-time save/validate). Modal Confirm saves details then confirms.

---

## 17. Finalize Flow

| Item | Evidence |
|------|----------|
| Who | `counseling_sessions.update` + branch |
| Required state | `Confirmed` only |
| Required fields | None beyond state |
| API | POST `…/finalise` |
| Meaning of Finalised | Eligible for Prepare OT List; still editable (Save reverts to NotConfirmed); not locked |
| OT eligibility | Yes — **only** Finalised enters Prepare |
| Journey / counselling / payment / insurance | No direct change on Finalise |
| Audit | Finalise |
| Concurrency | Version++; wrong state → 409 |

---

## 18. Cancel Flow

| Item | Evidence |
|------|----------|
| Eligible states (service) | **Any** non-deleted schedule (no status guard) |
| Eligible (UI capability) | `CanCancel` = not Cancelled and not SurgeryDone; modal shows Cancel on NotConfirmed / Confirmed / Finalised |
| OTPrepared cancel | Service allows; modal **does not** show Cancel (shows Reopen). Queue has no Cancel CTA |
| Reason required | **No** — FE `cancelOtSchedule(id)` has no body; CancelAsync does not set CancelReason from request |
| Confirmation dialog | **NOT FOUND** — immediate action |
| DB | Status=Cancelled; IsLocked=false; Version++ |
| Schedule release | Soft cancel only; unique active-patient index frees patient for new active row |
| OT list | Cancelled rows excluded from GetOtList (status filter) |
| Counselling back-sync | HTTP `{CounsellingService}/counselling/{id}/cancel-ot` — **destination not found**; non-fatal; cancel still succeeds |
| PatientJourney | Not updated in CancelAsync (IP cancel-today is separate path) |
| Reopen | Cancelled → NotConfirmed via Reopen |

**Classification:** Cancel counselling side-effect claim vs implementation honesty = known gap (PD-S9-22 lineage). Cancel without reason/confirm = UX + possible PD.

---

## 19. Reopen Flow

| Item | Evidence |
|------|----------|
| UI | Primary CTA for OTPrepared / Cancelled; modal “Reopen Case”; OT list row Reopen |
| API | POST `…/reopen` |
| Transitions | OTPrepared → **Confirmed** + unlock; Cancelled → **NotConfirmed** + unlock |
| Retained | Surgery fields, SequenceNo, PreparedAt, PreparedBy (**not cleared**) |
| Cleared | IsLocked=false only |
| OT list impact | After OTPrepared→Confirmed, row **leaves** Load OT List (status ≠ OTPrepared) |
| Confirmation | **NOT FOUND** |
| Detail CanReopen vs list | List mapper: OTPrepared\|Cancelled; Detail mapper: **OTPrepared only** — FE uses local status for CTA, so Cancelled reopen still works from queue |
| Who | `counseling_sessions.update` + branch |
| Finalised reopen | **NOT FOUND** |
| SurgeryDone reopen | **NOT FOUND** (correct sealing) |

---

## 20. Surgery Done Flow

| Item | Evidence |
|------|----------|
| Source | IP `PatientJourney` clinical → `SurgeryCompleted` → `PreOpNotificationClient` / internal HTTP |
| API | POST `/api/internal/ot-sync/surgery-done` |
| Actor | Internal service key (not counsellor JWT) |
| DB | Status=SurgeryDone; IsLocked=false; audit MarkSurgeryDone |
| Skip | Cancelled records |
| CounselingSession | CounselorId **retained**; assign/claim/reassign/requeue **rejected** when OT SurgeryDone |
| Counsellor UI | Open only; form locked; no mutate CTAs |
| Second-eye | New CounselingSession allowed after SurgeryDone (PD-C); **do not reopen** old SurgeryDone |

**EXISTING CERTIFIED BEHAVIOR — PRESERVE.**

---

## 21. OT Preparation Audit

| Item | Fact |
|------|------|
| Route | Same finalize-surgery page; workspace tab |
| Persistence | **No separate OT list entity** — prepared rows **are** `ot_finalize_schedule` with Status=OTPrepared |
| Date scope | OT workspace `otListDate` (default today); Prepare from toolbar uses Finalize **date filter** |
| Branch | Via schedule BranchId ∈ actor accessible branches |
| Permissions | Read: `counseling_sessions.read`; Prepare/Reopen: `.update` |
| Empty | “No prepared OT list for this date” |
| Ordering | SequenceNo then StartTime |

---

## 22. Load OT List

| Item | Fact |
|------|------|
| Meaning | **Read-only** fetch of existing OTPrepared rows for date |
| Endpoint | GET `/Counseling/ot-list?date=` |
| Mutation | **None** |
| Filter | Status==OTPrepared AND StartTime.Date==date AND BranchId authorized |
| Not | Does not derive from Finalised; does not create list |

---

## 23. Prepare New List

| Item | Fact |
|------|------|
| Meaning | Mutating batch: selected Finalised schedules → OTPrepared + lock + sequence |
| Entity created | **No new list table** — mutates schedule rows |
| Eligibility | Finalised + StartTime on selected date (FE `selectFinalisedForPrepareDate`; BE validates) |
| Transition | **Finalised → OTPrepared** happens **here** (not elsewhere) |
| Duplication | Slot HH:mm conflict vs other OTPrepared → 409 with conflicting IDs; FE allows new start time |
| Empty Finalised | Prepare disabled / empty modal |
| Side effects | NotifyJourneyOpdCopy per row (non-blocking) |

---

## 24. OT Eligibility Matrix

| Surgery State | Eligible for OT Prep? | Why | Source | Verified? |
|---------------|----------------------|-----|--------|-----------|
| NotConfirmed | No | Must be Finalised | PrepareOtListAsync | Yes |
| Confirmed | No | Must be Finalised | same | Yes |
| Finalised | **Yes** | Explicit predicate | same + FE scope | Yes |
| OTPrepared | No | Already prepared (fails “not Finalised”) | same | Yes |
| Cancelled | No | Not Finalised | same | Yes |
| SurgeryDone | No | Not Finalised | same | Yes |
| OT Returned | N/A on this table | OT Returned is IP journey projection on Waiting List | ot-returned-membership | Yes |
| Missing theatre | **Not a BE blocker** for Prepare | Prepare does not require theatre | PrepareOtListAsync | Yes |
| Missing date/StartTime | **Blocker** | Out-of-scope / date filter | same | Yes |
| Missing surgeon / reporting / anaesthesia | **Not BE prepare blockers** | Confirm/Finalise also don’t require | Confirm/Finalise | Yes |
| Insurance/payment pending | **Not BE prepare blockers** | No claim FK check | entity | Yes |
| Slot pending (UI label) | Display only; **not** prepare predicate | ChecklistSummary overwrite | GetFinalizeListAsync | Yes |

---

## 25. Theatre / OT Configuration

| Item | Evidence |
|------|----------|
| Counsellor dropdown | GET `/Counseling/theaters` — `counseling_sessions.read`, active + non-deleted + authorized branches |
| Full CRUD | `/api/OTBooking/theaters` — `ot.theaters.*` (separate) |
| Zero theatres | Returns **empty array** (200) — not 403; not error |
| UI | Empty select — user cannot assign theatre |
| Branch with zero OT master (e.g. Banjara Hills historically) | **CONFIGURATION / DATA SETUP** — not automatic code defect |
| Preserve | Least-privilege counselling theaters endpoint (certified Slice 9 pattern) |

---

## 26. Branch Authorization

| Surface | Behavior |
|---------|----------|
| List / OT list | Fail closed: no accessible branches → empty; NULL BranchId rows excluded |
| Per-schedule mutate | `EnsureActorCanAccessScheduleAsync`; heal BranchId from session when possible |
| Unauthorized branch request | 403 UnauthorizedAccessException |
| Cross-branch | Denied |
| Create BranchId | From CounselingSession only — not client |

**EXISTING CERTIFIED BEHAVIOR — PRESERVE.**

---

## 27. OT Returned Integration

| Item | Fact |
|------|------|
| Host surface | Waiting List OT Returned tab — **not** Finalize Surgery |
| SoT | IP `PatientJourney.OtReturnReason` projection |
| Finalize intersection | Shared patient may also have `ot_finalize_schedule`; **no OT Returned UI/filter on Finalize page** |
| Must not become | Waiting List lifecycle status, ReQueue, new ownership, duplicate worklist |
| Classification of missing Finalize surfacing | Gap: integration visibility optional — **E or J**; do not invent transition |

---

## 28. OT Returned Search

| Filter | Exists on Finalize? | Exists on Waiting List OT Returned? | API | Product Decision |
|--------|---------------------|--------------------------------------|-----|------------------|
| Patient name / UHID | Finalize yes (shared list) | Via WL patterns | Finalize: ot-schedule; OT Returned: journey+session compose | Do not invent Finalize OT Returned filters |
| Procedure / OT / surgeon / return reason | Finalize: **NOT FOUND** | Partial / composed | Journey fields | Only if PD |
| Surgery date | Finalize date filter | Journey/session derived | — | — |
| Branch | Implicit auth | Implicit | — | Preserve |

---

## 29. Repeat Counselling / ReEvaluate / Second-Eye

| Concept | Code behavior |
|---------|---------------|
| SurgeryDone seal | OT status SurgeryDone blocks ownership mutations; historical CounselorId retained |
| Second-eye / subsequent | **New** CounselingSession when prior episodes SurgeryDone / none active (PD-C create reuse) |
| ReEvaluate | Create blocked → continue existing when Done+agreed and **!SurgeryDone** |
| Repeat Counselling | Waiting List derivation for Completed+!agreed (and related paths) |
| UI confusion risk | Labels across WL vs Finalize may blur Repeat / ReEvaluate / second-eye — **E if product wording unclear**; code paths exist |

**Do not reopen SurgeryDone for second eye — CERTIFIED.**

---

## 30. Error / Empty / Loading States

| Surface | Loading | Empty | Error | Unauthorized |
|---------|---------|-------|-------|--------------|
| Finalize list | WorklistSkeleton / route loading | “No records found” | Toast failed load | ProtectedRoute; empty list if no branches |
| Modal | Pulse skeleton | — | Toast detail fail | 403 toast / banner |
| Prepare | Submitting state | Empty Finalised copy | 409 conflict UI; 400 toast | Prepare disabled without mutate |
| OT list | otLoading | “No prepared OT list for this date” | Toast failed load | Same branch empty |
| Zero theatres | — | Empty dropdown | Not specialized message | — |

---

## 31. Concurrency

| Mechanism | Behavior |
|-----------|----------|
| `OtFinalizeSchedule.Version` | Incremented on mutate; **not** compared to client expected Version |
| HTTP 409 on OT | Wrong state, lock, slot conflict — mapped from InvalidOperation / OtPrepareConflict |
| CounselingSession.Version | Separate CAS on session writes / upsert OPD path |
| Double-submit | FE disables buttons while actioning; no idempotency key on Confirm/Finalise |
| Stale UI | Visibility refetch; no Version-based merge |

**PD-S9-15 lineage:** OT Version CAS redesign intentionally not done — **J / PRESERVE** unless new PD.

---

## 32. Accessibility

| Area | Finding | Classification |
|------|---------|----------------|
| Modal | `role="dialog"` `aria-modal` labelled title; Escape closes; body scroll lock | Partial A |
| Focus trap | **Custom overlay** — not Radix Dialog/Sheet; focus trap not verified as complete | **B / H** |
| Row keyboard | Enter/Space opens | Present |
| Action buttons | Text labels on primary CTAs | Present |
| Icon-only | Print / chevron — check accessible names | Gap audit |
| Destructive Cancel | No confirm; red outline only | **B** |
| Table | CSS grid cues, not `<table>` headers | **B** a11y semantics |
| Status announcements | Toast only | Limited live region |

---

## 33. Responsive UX

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Dense work grid; counselling ops canvas (layout no-pad) |
| Narrow | Modal `max-h/[85vh]` `w-[min(960px,…)]`; button wrap in footer |
| Status tabs | Pill overflow risk on small widths |
| OT Preparation | Stacked controls |
| Playwright | Responsive specs screenshot Finalize; not workflow E2E |

---

## 34. Design-System Compliance

| Used | Not used on this surface |
|------|--------------------------|
| Counselling session tokens/primitives, StatusBadge, WaitingListQueuePagination, react-hot-toast, Lucide, ProtectedRoute, useHasPermission | shadcn Dialog/Sheet/Table/Tabs, PermissionGate, IpOverlayDialog |

**Future work must reuse counselling kit / portal patterns — no new UI framework.**

Orphan: `FinalizeSurgeryDrawer.tsx` unused.

---

## 35. Business Information Density

Current row packs identity + quiet financial + slot label + procedure + schedule + rate + actions.

**PROPOSED UX — NOT IMPLEMENTED**

| Tier | Fields |
|------|--------|
| PRIMARY | Patient name, UHID, procedure, status, next valid action |
| SECONDARY | Surgeon, eye, date/time, theatre, lock |
| CONTEXT | Patient type, payment, package, package rate |
| DETAIL | Anaesthesia, reporting time, remarks, checklist, IOL |

Do not delete business fields — presentation hierarchy only after Product Decision.

---

## 36. Action Hierarchy

| State | Primary | Secondary | Destructive | Read-only |
|-------|---------|-----------|-------------|-----------|
| NotConfirmed | Confirm | Open / Save / Print | Cancel Surgery | Open without mutate |
| Confirmed | Finalise | Save (reverts) / Print | Cancel | Open |
| Finalised | Open (+ Prepare OT at toolbar) | Save (reverts) / Print | Cancel | Open |
| OTPrepared | Reopen | Print | Cancel **service-only** (no FE Cancel) | Open (locked) |
| Cancelled | Reopen | — | — | Open |
| SurgeryDone | Open | Print | — | View |

Missing actions that might be expected (reason prompt, confirm dialog, Finalised→Reopen without edit revert) = **PRODUCT DECISION REQUIRED** if business needs them — not invent in code.

---

## 37. Automated Test Coverage

| Behavior | Existing Test | Coverage | Evidence | Gap |
|----------|---------------|----------|----------|-----|
| Ownership boundary / no CounselorId | Phase3ISlice9FinalizeOwnershipBoundaryTests | Strong | AuthService.Tests | — |
| Branch contracts | Phase3ISlice9ContractTests | Strong | same | — |
| Prepare date scope | prepare-ot-date-scope.test.ts + BE prepare tests | Strong | FE + AuthService.Tests | — |
| Cancel toast honesty | finalize-cancel-toast-slice9.test.tsx | Narrow FE | finalize-surgery/ | cancel-ot destination |
| Row-open / anesthetists | finalize-surgery-row-open-auth.test.ts | FE contract | lib/ | Manual UAT still open |
| OT Returned membership | ot-returned-*.test.ts | Strong on WL | lib/ | Not Finalize |
| Confirm/Finalise FSM unit isolation | Embedded in Slice 9 | Medium | — | Dedicated matrix tests thin |
| OT Version CAS | Intentionally absent | Accepted per PD-S9-15 | — | Documented |
| Playwright Confirm→Prepare→Done | **NOT FOUND** | Weak E2E | e2e responsive only | **H — TEST/UAT GAP** |
| Zero theatre UX | **NOT FOUND** | — | — | H |
| ChecklistSummary vs Slot label | **NOT FOUND** | — | — | H |

---

## 38. End-to-End Scenario Matrix

| ID | Preconditions | Action | Expected (code) | Actual implementation | API | DB | UI | Result | Classification | Evidence |
|----|---------------|--------|-----------------|----------------------|-----|----|----|--------|----------------|----------|
| FS-01 | Session Done+Schedule | Upsert | NotConfirmed row | UpsertFromCounsellor | POST ot-schedule | INSERT/UPDATE | Appears in list | Works | A | OtFinalizeService |
| FS-02 | NotConfirmed | Confirm | Confirmed | ConfirmAsync | POST confirm | Status | CTA Confirm | Works; queue skips FE validate | B/C mild | page + service |
| FS-03 | Confirmed | Finalise | Finalised | FinaliseAsync | POST finalise | Status | CTA Finalise | Works | A | |
| FS-04 | Finalised | Prepare | OTPrepared locked | PrepareOtListAsync | POST prepare | Status+lock | Prepare modal | Works | A | |
| FS-05 | OTPrepared | Load OT List | Listed | GetOtListAsync | GET ot-list | none | OT workspace | Works | A | |
| FS-06 | IP SurgeryCompleted | Mark done | SurgeryDone | MarkSurgeryDoneAsync | internal | Status | Locked view | Works | A | |
| FS-07 | Active row | Cancel | Cancelled | CancelAsync | POST cancel | Status | Modal Cancel | Works; no reason; cancel-ot missing | C/D honesty | |
| FS-08 | OTPrepared | Reopen | Confirmed | ReopenAsync | POST reopen | Status unlock | Reopen CTA | Works; prep metadata retained | A/B | |
| FS-09 | Journey otReturnReason | View Finalize | No OT Returned chrome | — | — | — | Waiting List only | Integration gap optional | E/J | |
| FS-10 | OT Returned + existing session | WL action | Reuse session rules | ot-returned-* | WL APIs | — | WL | Certified WL path | A | |
| FS-11 | OT Returned + no session | Create counselling | addToQueue false | start-ot-returned | create session | — | WL | Certified | A | |
| FS-12 | Repeat Counselling | WL | Status derivation | waiting-list-status | — | — | WL | Not Finalize | A/J | |
| FS-13 | ReEvaluate | Create blocked | TryGetCreateSessionReuse | create session | — | — | Add patient | A | PD-C tests |
| FS-14 | Prior SurgeryDone | New session | Allowed | PD-C | create | new session + later OT | — | A | |
| FS-15 | Branch zero theaters | Open modal | Empty theatres | GET theaters [] | — | Empty select | Config | F | CounselingController |
| FS-16 | Missing StartTime | Prepare | Rejected | date scope | prepare 400 | — | Disabled/empty | A | |
| FS-17 | Missing reporting time | Queue Confirm | **Succeeds** BE | ConfirmAsync | confirm | Status | Queue CTA | FE/BE mismatch | C | |
| FS-18 | Insurance pending | Prepare/Confirm | **Not blocked** | — | — | — | — | E if desired | entity |
| FS-19 | Payment pending | Same | **Not blocked** | ChecklistSummary uses PatientType loosely | — | Slot label may show Pending | Misleading | C/E | GetFinalizeListAsync L291–294 |
| FS-20 | Cross-branch | Access | 403 / empty | branch access | — | — | Fail closed | A | |
| FS-21 | Read-only actor | Mutate | CTAs→Open; Prepare disabled | finalize-ot-authorization | — | — | Degraded | A | |
| FS-22 | Concurrent edit | Two users | Last write wins on Version++ | no CAS | — | — | Possible stale | J/E | PD-S9-15 |
| FS-23 | Duplicate prepare same slots | Prepare | 409 conflict IDs | OtPrepareConflictException | prepare | — | Time edit UI | A | |
| FS-24 | Status tab + page | Filter | Client page of filtered | — | — | Tabs | Works | A | |
| FS-25 | Date no OTPrepared | Load | Empty copy | GetOtList | — | Empty | A | |
| FS-26 | Existing prepared | Load | Sequence list | GetOtList | — | Rows + Reopen | A | |
| FS-27 | Cancel after prepare | Service yes / UI no Cancel | Cancelled if API called | CancelAsync | cancel | Status | Modal lacks Cancel on OTPrepared | E/B | CanCancel vs modal |
| FS-28 | Reopen after prepare | Confirmed | ReopenAsync | reopen | unlock | Leaves OT list | A | |

---

## 39. Gap Register

| ID | Area | Finding | Evidence | Classification | Severity | Business Risk | UX Risk | Backend Risk | Recommendation | Product Decision Required? |
|----|------|---------|----------|----------------|----------|---------------|---------|--------------|----------------|---------------------------|
| FS-G-01 | Cancel back-sync | Comment/interface claim RepeatCounselling; HTTP `cancel-ot` route missing; cancel still succeeds | OtFinalizeService BackSyncToCounsellingAsync; Slice 9 toast honesty | D (+ I) | P1 | Counselling may not reflect cancel | Toast must stay honest | Orphan outbound call | Keep honesty; PD if back-sync required | Yes if behavioural change |
| FS-G-02 | Cancel reason | CancelReason column exists; Cancel API/UI do not collect/persist reason on cancel | cancelOtSchedule; CancelAsync | C / E | P2 | Audit incomplete | Destructive without reason | Low | PD: require reason or not | Yes |
| FS-G-03 | Slot label honesty | List overwrites ChecklistSummary with PatientType+AnesthesiaConsent; FE labels “Slot clear/pending/missing” | GetFinalizeListAsync L291–294; page.tsx L348–353; ToResponse slot derivation unused for list w/ session | C | P1 | Ops may trust wrong signal | High misleading | Medium | Relabel or fix computation after PD | Yes for desired meaning |
| FS-G-04 | Confirm validation split | Modal requires reporting time; queue Confirm and BE do not | FinalizeOtModal validate; ConfirmAsync; page handleAction | C | P2 | Incomplete confirms possible | Inconsistent | Low | Align FE paths; PD if BE-required | Yes if mandatory |
| FS-G-05 | CanReopen detail vs list | Detail CanReopen OTPrepared only; list includes Cancelled | ToResponse L802 vs ToDetailResponse L861 | B / C | P3 | Low (FE uses status) | Capability flag drift | Low | Align flags | No (fix) |
| FS-G-06 | Reopen retains prep metadata | SequenceNo/PreparedAt/PreparedBy not cleared | ReopenAsync | E / B | P3 | Confusing history | Medium | Low | PD: clear or retain | Yes |
| FS-G-07 | Cancel confirmation | No confirm dialog | FinalizeOtModal runAction cancel | B | P2 | Accidental cancel | High | — | Match portal destructive patterns | Optional PD |
| FS-G-08 | KPI “Scheduled” / “Needs Attention” | Labels ≠ precise ops definitions | statsBar L624–643 | E / B | P2 | Misread capacity | Medium | — | Rename or define in PD | Yes |
| FS-G-09 | Avg. Wait | Mean counselling→schedule days; may be 0 | statsBar | E | P3 | Low | Medium | — | Keep/remove/redefine | Yes |
| FS-G-10 | Status filter server unused | Backend Status filter exists; FE client-only | GetFinalizeListAsync; page filtered | B | P3 | Large lists | Perf on big data | Low | Optional server status param | No |
| FS-G-11 | OT Returned not on Finalize | No integration chrome | finalize-surgery page | E / J | P3 | Ops context switch | Medium | — | PD whether to surface link only | Yes if change |
| FS-G-12 | Zero theatre empty | Empty 200; weak messaging | GetTheaters | F / B | P2 | Cannot assign OT | Medium | — | Config OT masters; improve empty copy | Config first |
| FS-G-13 | SQL unique prepared-date index | SQL declares one OTPrepared per tenant/date; service prepares many | OT_FINALIZE_SCHEDULE_MIGRATION.sql L81–84 | D or F | P0 if live | Prepare multi-patient could fail | High | High | Verify live DB; drop or keep intentionally | Yes if schema change |
| FS-G-14 | SQL schema drift | Baseline SQL missing later columns | migration SQL vs entity | I | P3 | Deploy confusion | — | Medium | Doc only | No |
| FS-G-15 | Orphan drawer | FinalizeSurgeryDrawer unused | no page import | I / B | P3 | Confusion | Low | — | Do not delete without approval | No |
| FS-G-16 | Playwright E2E gap | No FSM workflow E2E | e2e responsive only | H | P1 | Regressions | — | — | Future UAT + Playwright after PD | No |
| FS-G-17 | Null-branch / row-open UAT | Fixes implemented; Manual UAT open | residual UAT plan; fix reports | H | P1 | Acceptance incomplete | — | — | Execute residual UAT pack | No |
| FS-G-18 | Custom dialog a11y | Not Radix focus-trap pattern | FinalizeOtModal | B / H | P2 | a11y debt | Medium | — | Future a11y slice | No |
| FS-G-19 | Insurance/payment blockers | Not enforced on Confirm/Finalise/Prepare | service | E / J | P2 | If business expects blockers | — | — | PD only | Yes if required |
| FS-G-20 | MarkSurgeryDone from any non-Cancelled | Can mark SurgeryDone without OTPrepared | MarkSurgeryDoneAsync | E / A | P2 | Historical paths | — | — | Preserve unless PD | Only if restrict |
| FS-G-21 | Documentation phase drift | Old readiness docs pre-Slice-9 | portfolio supersedes | I | P3 | Wrong SoT if misread | — | — | Prefer closure docs | No |
| FS-G-22 | Ownership regression check | No CounselorId on finalize | entity + Slice 9 | A | — | — | — | — | Preserve | No |

---

## 40. Product Decision Questions

Only where repository evidence cannot answer desired **business** intent:

1. What is the operational definition of **Needs Attention** beyond `NotConfirmed|Confirmed`?
2. Should **Avg. Wait** remain, be redefined, or be removed?
3. Is **reporting time** mandatory before Confirm at **backend** (today FE-only on modal)?
4. Must **Cancel** require a reason and/or confirmation dialog?
5. Should **OTPrepared** expose Cancel in UI (service already allows)?
6. On Reopen from OTPrepared, should **SequenceNo / PreparedAt / PreparedBy** be cleared?
7. Should **Save on Finalised** continue to revert to NotConfirmed, or should edits be blocked / alternate path?
8. Are **insurance/payment/theatre** hard blockers for Confirm, Finalise, or Prepare?
9. Should Finalize Surgery **surface OT Returned** (link-only vs none)?
10. What should **ChecklistSummary / Slot pending** mean — slot completeness vs consent/patient type?
11. Is OT preparation **one logical list per branch/date** (UI concept) despite row-level persistence — any sequencing/ownership rules beyond SequenceNo?
12. If `ux_ot_finalize_prepared_date` exists in a live database, is single OTPrepared-per-day intentional or a defect?
13. Who is the **operational owner** of OT Preparation day-of (counsellor vs OT desk) for UX copy only — without changing permissions?

**Do not approve these in this audit.**

---

## 41. Recommended UX Direction

**PROPOSED UX — NOT IMPLEMENTED. NOT AUTHORIZED.**

A. Keep single route; two workspaces; shared queue (no My Finalize).  
B. KPI: either rename Scheduled→“In list” or shrink strip; define Needs Attention in PD.  
C. Status tabs: keep; consider server-side status for scale.  
D. Filters: keep Date/UHID/Name; avoid filter sprawl.  
E. Grid: PRIMARY/SECONDARY/CONTEXT hierarchy (§35); fix Slot label honesty.  
F. Row click = READ (modal); mutation CTAs explicit; stopPropagation retained.  
G. Prefer counselling kit; evaluate Radix Dialog for a11y without new design language.  
H. State-aware footer already mostly correct — align Cancel/Reopen/Confirm confirms.  
I–L. Confirm/Finalise/Cancel/Reopen flows: preserve BE rules; UX confirmations per PD.  
M. SurgeryDone: read-only historical presentation.  
N. OT Returned: link to Waiting List OT Returned if PD says yes — no lifecycle merge.  
O–P. OT Preparation: date → Load (read) / Prepare (mutate) → sequenced rows; theatre grouping only if data supports (today: flat SequenceNo list).  
Q–T. Truthful empty/error; responsive tab overflow; a11y focus trap.

---

## 42. Recommended Backend Direction

| Area | Classification | Notes |
|------|----------------|-------|
| OtFinalizeService FSM | **PRESERVE EXISTING API** | |
| counseling_sessions.read/update permissions | **PRESERVE** | |
| Branch fail-closed | **PRESERVE** | |
| Cancel cancel-ot | **MINOR API GAP** or **PRODUCT DECISION** | Implement only if PD requires |
| ChecklistSummary list overwrite | **BACKEND DEFECT** (honesty) or PD redefine UI label | |
| Detail vs list CanReopen | **MINOR API GAP** | Align flags |
| Reporting time BE require | **PRODUCT DECISION REQUIRED** | |
| Schema unique prepared index | **CONFIGURATION** verify / **DEFECT** if live | |
| OT Version CAS | **PRESERVE** (PD-S9-15) | |
| New ownership fields | **OUT OF SCOPE** | |

For any future change record: endpoint, reason, current, desired, business impact, migration, compatibility, authz, tests — only after Product Decision.

---

## 43. Proposed Future Implementation Slices

**PROPOSED — NOT AUTHORIZED.**

| Slice | Objective | Scope | Out of scope | APIs | DB | Rules preserved | Tests | UAT | Acceptance | Dependencies | PDs required |
|-------|-----------|-------|--------------|------|-----|-----------------|-------|-----|------------|--------------|--------------|
| FS-UX-01 | Grid/IA honesty | Density, Slot label, KPI labels | Ownership, FSM | List only | None | Shared queue | FE unit | Manual | After UAT | PD on KPI/Slot | Yes |
| FS-UX-02 | State-aware detail | Modal a11y, action clarity | New fields inventing rules | details/confirm/… | None | FSM | Component | Manual | — | PD cancel reason | Partial |
| FS-UX-03 | Mutation UX | Confirm dialogs; align queue Confirm validate | BE rule invent | Existing | None | Transitions | FE | Manual | — | PD reporting time | Yes |
| FS-UX-04 | OT Returned link presentation | Optional deep-link to WL | Lifecycle redesign | None/new none | None | OT Returned boundary | FE | Manual | — | PD surface? | Yes |
| FS-UX-05 | OT Preparation workspace polish | Empty/zero-theatre copy; list scan | New list entity | ot-list/prepare | None | Prepare predicates | FE+API | Manual | — | Config OTs | Partial |
| FS-UX-06 | Prepare/state reconciliation UX | Conflict UX; reopen messaging | Change reopen target state | prepare/reopen | None | Reopen matrix | FE | Manual | — | PD metadata clear | Yes |
| FS-UX-07 | Filter/pagination | Optional server status | New filters invent | ot-schedule | None | Branch auth | FE | Manual | — | — | No |
| FS-UX-08 | a11y/responsive | Focus trap, tabs overflow | Redesign theme | — | — | Design system | a11y | Manual | — | — | No |
| FS-UX-09 | E2E regression | Playwright Confirm→Prepare→Done | Prod data | All OT | — | Full FSM | Playwright | Manual pack | — | Prior slices | No |

---

## 44. Regression Protection

**MUST NOT CHANGE** without explicit Product Decision + authorization:

- CounselorId / CreatedByUserId semantics; Assign/Reassign; ReQueue→NULL; Sessions Reassignment Required
- Waiting List; Follow-up; Analytics My Work
- Finalize / Post-Surgery **shared** operational surfaces (no My Finalize / My OT Preparation)
- PatientJourney ownership of OT Returned projection
- CounselingSession lifecycle; SurgeryDone sealing; second-eye = new session
- Branch authorization fail-closed; counselling theaters least-privilege permission
- OtFinalizeStatus spelling and core transitions
- Existing financial/insurance/clinical SoT outside this snapshot
- SignalR / toast libraries / stack freeze

---

## 45. Documentation Drift

| Drift | Notes |
|-------|-------|
| Slice 14 / Phase 3J | Correctly marked nonexistent in current portfolio docs |
| Pre-Slice-9 readiness audits | May still describe tenant-wide Finalize / missing BranchId — **superseded** by Slice 9 implementation |
| cancel-ot / re-queue toast | Toast honesty fixed; route still missing |
| C-01 UAT observations Area 7 FAIL | Superseded by C-01 acceptance-closure PASS |
| SQL baseline vs entity | Column/index drift (§8.4, FS-G-13/14) |
| IOtFinalizeService Cancel comment | Claims RepeatCounselling; implementation outbound HTTP only |

**This audit does not modify those documents.**

---

## 46. Final Audit Classification

| Class | Count (primary) |
|-------|-----------------|
| A — EXISTING CERTIFIED / PRESERVE | Core FSM, shared queue, no CounselorId, branch auth, Prepare Finalised-only, SurgeryDone seal, OT Returned boundary |
| B — UX / PRESENTATION | KPI labels, density, a11y, cancel confirm, orphan drawer |
| C — FUNCTIONAL DEFECT | Slot label honesty; Confirm FE split; cancel reason not persisted |
| D — BACKEND / DATA | cancel-ot missing; possible unique prepared index clash |
| E — PRODUCT DECISION REQUIRED | Needs Attention; Avg Wait; blockers; OT Returned surface; reopen metadata; OTPrepared cancel UX |
| F — CONFIGURATION / DATA | Zero active theaters at branch |
| G — AUTHORIZATION / SECURITY | No new G beyond preserving fail-closed (verified OK) |
| H — TEST / UAT GAP | Playwright FSM; residual Manual UAT for null-branch/row-open |
| I — DOCUMENTATION / GOVERNANCE | SQL/comment drift; stale readiness docs |
| J — OUT OF SCOPE | OT Version CAS redesign; ownership; WL redesign |

**Does the UI represent actual business state truthfully?**  
**Partially.** Status badges and Prepare/Load paths are largely truthful. **Slot pending/clear** and **Scheduled / Needs Attention** KPI labels are **not** fully truthful relative to underlying predicates. Cancel counselling side-effect is **not** guaranteed despite historical comments.

---

## 47. Next Governance Gate

```
FINALIZE SURGERY / OT PREPARATION AUDIT
---------------------------------------

AUDIT:
COMPLETE

PRODUCTION IMPLEMENTATION:
NOT AUTHORIZED

API CHANGE:
NOT AUTHORIZED

DB CHANGE:
NOT AUTHORIZED

PERMISSION CHANGE:
NOT AUTHORIZED

STATE MACHINE CHANGE:
NOT AUTHORIZED

OWNERSHIP CHANGE:
NOT AUTHORIZED

UX REDESIGN:
NOT AUTHORIZED

MANUAL UAT:
NOT EXECUTED

ACCEPTANCE:
NOT RECORDED

PRODUCT DECISIONS:
LIST ONLY (§40) — DO NOT APPROVE THEM

NEXT GOVERNANCE GATE:
PRODUCT DECISION REVIEW OF AUDIT FINDINGS

STOP.
```

---

## Appendix A — Manual UAT Checklist (NOT EXECUTED)

| ID | Role | Branch | Preconditions | Action | Expected | Evidence |
|----|------|--------|---------------|--------|----------|----------|
| UAT-FS-01 | Counsellor update | Configured OT branch | NotConfirmed row | Confirm via queue | →Confirmed | Screenshot + network |
| UAT-FS-02 | Same | Same | Confirmed | Finalise | →Finalised | |
| UAT-FS-03 | Same | Same | Finalised on date | Prepare New List | →OTPrepared; Load lists | |
| UAT-FS-04 | Same | Same | OTPrepared | Reopen | →Confirmed; leaves OT list | |
| UAT-FS-05 | Same | Same | Active | Cancel | →Cancelled; counselling effect observed/absent | Honesty note |
| UAT-FS-06 | Same | Zero-OT branch | Open modal | Theatre dropdown | Empty truthful | |
| UAT-FS-07 | Read-only | Any | Open Finalize | Mutate CTAs | Open only / Prepare disabled | |
| UAT-FS-08 | Other branch | Unauthorized | Open row | 403 / deny | |
| UAT-FS-09 | IP clinical | Linked schedule | Surgery complete | SurgeryDone on Finalize | Locked | |
| UAT-FS-10 | Counsellor | SurgeryDone patient | Second eye | New session — not reopen | PD-C | |

**NOT EXECUTED.**

---

## Appendix B — Files Inspected (summary)

Frontend page/modal/API/auth/prepare/pagination/types/nav; Auth OtFinalize* domain/service/controllers/internal sync; FollowupBranchAccess; IP PatientJourney SurgeryCompleted path; OT Returned membership; Slice 9 + prepare + cancel toast + row-open tests; portfolio/residual UAT/final acceptance docs; `OT_FINALIZE_SCHEDULE_MIGRATION.sql`.

---

*End of audit artifact. No production implementation was performed.*
