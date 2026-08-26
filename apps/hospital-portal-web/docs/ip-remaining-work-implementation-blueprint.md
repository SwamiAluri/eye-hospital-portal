# Remaining IPD Work — Architecture, Gap, Screen, FE/BE/DB/Integration Blueprint

**Date:** 25 Aug 2026  
**Status:** Implementation blueprint. No application code changed by this document.  
**Supersedes remaining-work sections of** `ip-frd-codebase-crosscheck-2026-08-25.md` **for anything still open.**  
**Ownership SoT:** `ip-billing-ward-cross-module-sot.md` (unchanged).

---

## 0. Locked decisions (do not reopen)

| # | Decision | Rule |
|---|---|---|
| D-A | Dilation / vitals | **Warn only** on `Admitted → ReadyForSurgery`. Four existing hard blocks stay `block`. |
| D-B | IOL power | **Exact match after 2-decimal parse** (`\|scanned − planned\| > 0.00` is mismatch). Catalog `power_increment` (0.50 D) is the picker step, **not** a tolerance. |
| D-C | IOL planned empty | **Warn**, do not block implant record. |
| D-D | IOL eye mismatch | Unchanged: **hard block**, no override. |
| D-E | IOL power/model mismatch | **Block** unless `ip.implant.mismatch.override` + reason ≥ 10 chars. |
| D-F | Follow-up lock | Authoritative store is Auth table **`appointment`**. Map via `post_op_instructions.followup_appointment_id`. **No new booking table.** |
| D-G | Follow-up gate | **Block** `ReadyForDischarge → Discharged` if no active appointment. Override = existing `ip.discharge.override`. |
| D-H | Clinical state machine | **KEEP** Expected → Discharged. No `Pre-Op Pending` / `Ready for OT` states. |
| D-I | Domain ownership | IP clinical · Billing ledger · CCMS coverage · Auth beds · Inventory stock · Auth `NotificationHub` · existing outboxes. |
| D-J | Screens | **No new pages** except optional print-only wristband. All work extends S-01–S-18, counsellor desk, CCMS, appointments. |

---

## 1. Remaining inventory (only open work)

Items already COMPLETE are omitted (packages, estimate, CCMS FSM, approval cap, drop log, site/laterality, OT scheduler, operative notes, ledger capture, slots, implant registry, charge-items, census split pane, collect drawer, RBAC SQL 156, fail-closed FE).

### 1.1 P0 — patient safety / RBAC integrity

| ID | FRD / gap | Status | Change | Screen |
|---|---|---|---|---|
| A1 | FR-5.2 GS1-128/DataMatrix | MISSING | EXTEND parser | S-07 |
| A2 | FR-5.3 IOL power/model | PARTIAL | EXTEND exact 0.00 D | S-07 |
| A3 | FR-4.1 Dilation timer | MISSING | EXTEND warn + countdown | S-05 |
| A4 | FR-3.3 Vitals gate | PARTIAL | EXTEND warn | S-05 |
| A5 | FR-3.2 Safety token | MISSING | CREATE token + print | S-01 / S-04 admit |
| E1 | PermissionSeeder ≠ SQL 156 | PARTIAL | MODIFY seeder | — |

### 1.2 P1 — complete production workflow

| ID | FRD / gap | Status | Change | Screen |
|---|---|---|---|---|
| A6 | FR-3.1 Visual bed map | MISSING | CREATE UI on ward | S-04 |
| B1 | FR-6.2 Tapering matrix | MISSING | CREATE table + panel | S-08 |
| B2 | FR-6.3 Follow-up lock | MISSING | EXTEND map to `appointment` | S-09 |
| C1 | FR-2.1 Pre-auth doc gate | PARTIAL | EXTEND server | CCMS submit |
| C2 | Ops pre-auth queue | INCORRECT | MODIFY filter | `/ccms/operations/preauth` |
| D1 | Package/charge mapping ops | PARTIAL | OPERATE existing S-14 | S-14 |
| FE-KPI | Census dues fallback | PARTIAL | MODIFY | S-01 |
| FR-1.1 | OPD → journey copy | PARTIAL | EXTEND onboard | Counsellor + journey |

### 1.3 P2 — operational hygiene

| ID | Gap | Status | Change |
|---|---|---|---|
| C3 | Claim-query FSM bypass | PARTIAL | MODIFY FireAsync |
| FR-1.3 | Insurer/corporate tariffs | PARTIAL | DEFER unless contracts require |
| FR-5.4 | Consignment inventory | MISSING | DEFER Inventory |
| E2 | Deprecated IP `addBilling` API | PARTIAL | 410 for browser |
| E3 | Intra-op note unaudited | PARTIAL | EXTEND audit |
| E4 | Dual IOL flags vs registry | PARTIAL | Document SoT; stop new writes to flags |

### 1.4 P3 — later

| ID | Gap | Status |
|---|---|---|
| F2 | HL7 ADT | MISSING |
| F3 | DICOM/PACS network (FR-2.2) | MISSING |

---

## 2. Target architecture (remaining edges only)

Ownership unchanged. New/changed arrows:

```
Pre-op med log.administered_at ──compute──► dilation warn (ChecklistGateService)
vital_sign + ip_vital_threshold ──compare──► vitals warn (same gate)
patient_journey.iol_power ──exact 2dp──► ImplantUsageService.RecordAsync
GS1 barcode ──parse──► RecordImplantRequest (GTIN/serial/lot/expiry)
journey_safety_token ──print──► wristband (IP)
post_op_instructions.followup_appointment_id ──FK logical──► appointment.id (Auth)
S-09 ──JWT──► POST /api/Appointments (appointment.create)
ReadyForDischarge→Discharged ──block──► no active Follow-up appointment
SubmitPreAuth ──require──► ccms_document_requirements
CCMS ops queue ──filter──► authorization lifecycle / process_status
```

**Still forbidden:** IP writing money; Inventory setting price; third outbox; new bed FSM; insurance FSM in IP.

---

## 3. Capability blueprints

Each item: gap → target → screen → FE → BE → DB → integration → RBAC → tests.

---

### A1 — GS1-128 / DataMatrix parse (FR-5.2)

**Gap.** `PatientJourneyService.VerifyIolBarcodeAsync` accepts any alphanumeric ≥5. `udi_barcode` is a free string. No AI `(01)(21)(10)(17)` parse.

**Target.** Scan fills GTIN, serial, lot, expiry. Catalog resolve uses GTIN/`product_code` first, then raw string.

**Screen (S-07 `ImplantScanPanel`).** After scan: show parsed fields. Invalid GS1 → user message “This barcode could not be read. Enter serial manually.” No service names.

**FE.** `parseGs1Barcode(raw)` in `lib/ip-management/gs1-barcode.ts`. `handleResolve` sends raw; displays parsed. Manual override of serial remains.

**BE.** New `Gs1BarcodeParser` in IP. `VerifyIolBarcodeAsync` + `ImplantUsageService.ResolveBarcodeAsync` call it. Extend `VerifyIolBarcodeResponse` with `Gtin`, `Serial`, `Lot`, `Expiry`, `Symbology`. `RecordImplantRequest` already has `SerialNumber`, `BatchNumber`, `UdiBarcode` — persist parsed values; keep raw in `UdiBarcode`.

**DB.** None. Columns exist on `journey_implant_usage`.

**Integration.** None (clinical write still emits `ImplantUsed` after Record).

**RBAC.** Existing implant record perms.

**Tests.** Unit: GS1 fixtures (01+21, 01+21+10+17, DataMatrix concatenated, invalid). `VerifyIolBarcode` still accepts non-GS1 serial ≥5 as **manual** path with `symbology: "raw"`.

---

### A2 — IOL power/model exact compare (FR-5.3)

**Gap.** Eye blocked. Power/model not compared. Planned: `patient_journey.iol_power` (string). Scanned: `RecordImplantRequest.Power` (decimal?).

**Target.** After `RequireMatchingEye`:

```
planned = ParseDiopter(journey.IolPower)   // strip + / D / spaces; round 2dp
scanned = Round2(req.Power)
if planned is null && status == Implanted → warn in response, allow save
if planned is not null && scanned is null && Implanted → 400 "Power is required"
if |scanned - planned| > 0.00 → 409 unless AcknowledgeMismatch && override perm
model: if journey has planned catalog/model and req differs → same 409 path
```

Add to `RecordImplantRequest`: `bool AcknowledgeMismatch`, `string? MismatchReason`.

**Screen (S-07).** If power differs, `ReasonConfirmDialog` (S-17). Copy: “This lens is {scanned} D. The planned power is {planned} D.” Confirm disabled until reason ≥ 10 chars.

**FE.** Compare locally for UX; **server is authority**. Hide override CTA unless `ip.implant.mismatch.override` in JWT (fail closed).

**BE.** `ImplantUsageService.RecordAsync`. `JourneyCommandAuthContext` / `IpChecklistAuth` for override. Audit `ImplantMismatchOverridden`.

**DB.** None for compare. Permission seed (171).

**Integration.** `ImplantUsed` only after successful record (including overridden). Payload may include `mismatchOverridden: true`.

**RBAC.** `ip.implant.mismatch.override` — SURGEON, OT coordinator, ADMIN. Not NURSE.

**Tests.** `21` vs `21.00` OK; `21.00` vs `21.50` 409; override 200 + audit; empty planned 200 + warning; eye still 400 without override.

---

### A3 — Dilation timer (FR-4.1)

**Gap.** Dilatation meds only prompt checklist `ward_dilatation_done`. No countdown.

**Target.** Derived: first `pre_op_medication_log` row where `isDilatationMedicine(name)` and `administered_at` not null. `readyAt = administered_at + 25 minutes` (constant `DilationReadyMinutes = 25`, overridable later via threshold table). If `utcnow < readyAt` → gate **warn** `dilation_not_ready`. If no drop recorded → warn `dilation_not_recorded` (not block).

**Screen (S-05 footer).** Chip: “Dilation 04:12 remaining” / “Dilation ready” / “No dilating drop recorded”. Soft-warning list already exists (`MarkReadySoftWarningList`). Map codes in `navigateStepForGateCode` → `records`.

**FE.** Prefer server `GET transition-gates` + readiness extras. Optional local countdown from `dilationStartedAt` for animation only.

**BE.** Extend `PreOpReadinessDto` **or** (preferred, smaller) put times on `ChecklistGateWarningDto` message + add fields on a thin `GET .../pre-op/readiness` sidecar:

```
PreOpReadinessDto + DilationSlice(StartedAt, ReadyAt, RemainingSeconds, Status)
```

Add warn in `AddMarkReadyHardBlocksAsync` **or** a sibling `AddMarkReadySoftWarningsAsync` so hard-block method stays hard-only. **Do not** put dilation inside `AddMarkReadyHardBlocksAsync` as `block`.

**DB.** None. Reuse `pre_op_medication_log.administered_at`.

**Integration.** None.

**RBAC.** Existing `ip.ot.mark_ready`. Acknowledge via existing `acknowledgeWarnings`.

**Tests.** Engine: 10 min ago → remaining; 30 min ago → ready; no row → not_recorded warn; Mark Ready still succeeds with acknowledge.

---

### A4 — Vitals threshold warn (FR-3.3)

**Gap.** `VitalSignService` records and may auto-tick `vitals_checked`. No numeric gate.

**Target.** Latest `vital_sign` where `Context == null`. Compare to `ip_vital_threshold` (one row per tenant). Out of range or missing → **warn** (`vitals_out_of_range` / `vitals_not_recorded`). Default thresholds: sys 180, dia 110, pulse 40–140, SpO2 92, temp 38.5 C. `severity` column exists for future block; **seed `warn`**.

**Screen (S-05 vitals step + footer).** Show out-of-range values with the word “high/low”, not colour alone. Soft warning list.

**FE.** `navigateStepForGateCode` → `bedside` (or vitals tab key if distinct).

**BE.** `ChecklistGateService` load threshold (cache per request). No override permission required because severity is warn (acknowledgeWarnings). Do **not** add `ip.vitals.override` unless we later flip to block.

**DB.** Migration `169_ip_vital_threshold.sql` (see §7).

**Integration.** None.

**Tests.** BP 200/120 → warn, Mark Ready allowed with ack; normal vitals → no warn.

---

### A5 — Patient safety token (FR-3.2)

**Gap.** No IP wristband/barcode generation.

**Target.** One active token per journey. Printed at admit (and reprint). Encodes tenant-safe `token_code` + UHID + laterality. Not a second patient ID.

**Screen.** Admit success on S-04 / S-05 admit step: “Print wristband” button. Census rail secondary action. Print layout: name, UHID, DOB, **RIGHT/LEFT**, token barcode, date. No new dashboard route; `window.print` stylesheet or `/dashboard/ip-management/journey/[id]/wristband` print page if print CSS on modal is insufficient — **prefer print CSS in modal** to avoid a page.

**FE.** `POST` then open print view. Permission fail-closed `ip.safety_token.print`.

**BE.** `JourneySafetyTokenService`. `POST /ip-management/journeys/{id}/safety-token` idempotent (return existing active). `POST .../safety-token/reprint` sets `printed_at`. Generate `token_code` = `WB-{yyMMdd}-{seq:D5}` per tenant/day.

**DB.** `168_journey_safety_token.sql`. Optional `patient_journey.safety_token_id` for denormalized read.

**Integration.** Audit `SafetyTokenIssued`. No outbox required.

**RBAC.** `ip.safety_token.print` — NURSE, WARD CLERK, IP COORDINATOR, ADMIN (grandfather via 156-style bundles).

**Tests.** Second POST returns same id; unique active index; reprint audited.

---

### A6 — Visual bed map (FR-3.1)

**Gap.** Occupancy FSM + `WardBedDto` exist. No floor-plan UI.

**Target.** Occupancy strip on **existing** ward page. Cells = beds of selected ward, labelled number + status word + UHID if occupied. Types `Recliner` / `DayCareChair` shown as “Chair”. Click occupied → existing drawer; empty → admit/assign existing flow.

**Screen (S-04).** Zone above table. Loading/empty/permission: hide if no `ip.view`. Status never colour-only.

**FE.** New `WardBedMap.tsx`. Data: existing `ipManagementApi.getBedAvailability(wardId)`. Invalidate with `use-ward-board-query` SignalR.

**BE.** None if DTO already has `bedStatus`, `bedType`, occupant. If occupant UHID missing, **EXTEND** beds list DTO (`occupantJourneyId`, `occupantUhid`, `occupantName`) — check `InternalIpBedController` / ward beds function before adding columns.

**DB.** None (`bed_inventory.ward_id` already 165/167).

**Integration.** Existing bed lifecycle.

**Tests.** e2e: occupied cell shows UHID; available cell not clickable as patient.

---

### B1 — Eyedrop tapering matrix (FR-6.2)

**Gap.** Free-text `post_op_instructions.medications`.

**Target.** Structured steps; free-text remains optional notes. Print concatenates steps into discharge sheet.

**Screen (S-08).** Table: drug, eye, step no, frequency, days, Add. History of saved steps. Empty: “No taper recorded.”

**FE.** `PostOpTaperPanel.tsx` inside `WardPostOpWorkspaceModal`.

**BE.** `GET/PUT /ip-management/journeys/{id}/post-op/taper`. Replace-all PUT in one transaction. Perm `ip.postop.manage`.

**DB.** `170_post_op_taper_step.sql`.

**Integration.** None (clinical only). Optional later: copy into printed instructions string.

**Tests.** PUT 3 steps; GET round-trip; unauthorized 403.

---

### B2 — Follow-up lock (FR-6.3) — locked mapping

**Gap.** `followup_date` is a note. Four stores exist; only `appointment` is a booked slot.

**Target.**

```
S-09 book/select
  → POST /api/Appointments  (appointment.create)
      AppointmentType = "Follow-up"   // match ExaminationService
      DurationMinutes = 30
      PatientId = journey.PatientId
      DoctorId  = followup doctor
  → PUT IP post-op instructions { followupAppointmentId }
  → post_op_instructions.followup_appointment_id = appointment.id
  → project followup_date / followup_doctor_id from that row
```

Discharge `ReadyForDischarge → Discharged`: **block** `followup_appointment_missing` unless Auth appointment exists, `deleted_at` null, `status` not in (`Cancelled`, `Deleted`), `appointment_date::date >= surgery/admission date`. Override: `ip.discharge.override`.

Do **not** write `follow_up_appointments` for the lock. Optional P2: after book, upsert tracker with new `appointment_id` column — out of P1.

**Screen (S-09 + FollowUpHandoverPanel).** Date input becomes read-only once booked. Actions: “Book follow-up” / “Link existing”. Conflict from Auth → user message “That time is not available.” List patient’s upcoming appointments via `GET /api/Appointments/patient/{patientId}`.

**FE.** `appointments.ts` `createAppointment`. IP `savePostOpInstructions` sends `followupAppointmentId`. Hide book if no `appointment.create`; hide link if no `appointment.view`. Fail closed. Discharge CTA disabled while gate block and no override perm.

**BE.**  
- IP: column + `PostOpWorkflowService` save.  
- `ChecklistGateService.AddDischargeWarningsAsync`: call Auth internal **or** read appointment if IP has DbSet. **Prefer** Auth internal `GET /api/internal/ip-appointments/{id}/status` to avoid IP taking a dependency on Auth EF `appointment` mapping drift (`[Table("appointments")]` vs `ToTable("appointment")`).  
- Auth: small internal endpoint keyed by `X-Internal-Key`, tenant-scoped, returns `{ exists, status, appointmentDate, cancelled }`.

**DB.**

```sql
ALTER TABLE post_op_instructions
  ADD COLUMN IF NOT EXISTS followup_appointment_id uuid;
CREATE INDEX IF NOT EXISTS ix_post_op_instr_followup_appt
  ON post_op_instructions (followup_appointment_id)
  WHERE followup_appointment_id IS NOT NULL;
```

No FK to `appointment` if different schema ownership in same DB is messy; logical FK + IP validation is enough. If same Postgres and `appointment` confirmed, add FK.

**Integration.** No outbox. Realtime: existing hub optional; refetch discharge clearance is enough.

**RBAC.** `appointment.create` / `appointment.view` on Auth; `ip.discharge` / `ip.discharge.override` on IP. Ward nurse bundles must include `appointment.create` **or** IP coordinator books. **Gap to seed:** attach `appointment.create` to NURSE / IP COORDINATOR if missing (**REQUIRES CODEBASE VERIFICATION** of appointment role bundles).

**Tests.** Discharge 409 without appointment; 200 after book; cancelled appointment still blocks; override with reason succeeds; createAppointment conflict 409 surfaced.

---

### C1 — Pre-auth document auto-checklist (FR-2.1)

**Gap.** FE `ccms-document-slots.ts` hardcoded. `ccms_document_requirements` unused on submit.

**Target.** `SubmitPreAuth` loads required docs for case stage; 400 if missing. FE checklist sourced from `GET /ccms/master/document-requirements`.

**Screen.** Existing `DocumentChecklist.tsx` / `CaseDocumentsWorkspace`.

**FE.** Replace hardcoded slots with API. Fail closed if requirements empty? **No** — empty master means no extra docs required.

**BE.** `PreAuthorizationService.SubmitPreAuth` / `GeneratePreAuth`.

**DB.** None.

**Integration.** None.

**Tests.** Submit without required doc 400; with docs 200.

---

### C2 — Ops pre-auth queue (INCORRECT)

**Gap.** `OperationsFunctions.GetPreAuthQueue` filters `a.Status` in `PREAUTH_SENT|WAITING_APPROVAL|...` but entity `Status = "active"`. Workflow state lives on `ccms_coverage_cases.current_state`.

**Target.** Filter `ProcessStatus` and/or join case `CurrentState` in pendingStates. Align with working `GET /ccms/authorizations/queue`.

**Screen.** `/dashboard/ccms/operations/preauth` — no UX change if API returns rows.

**FE.** None if contract preserved.

**BE.** Fix query in `OperationsFunctions.cs` L41–48. Prefer: `pendingStates.Contains(case.CurrentState)` join, keep `a.DeletedAt == null`.

**DB.** None.

**Tests.** Auth with Status=active, case WAITING_APPROVAL appears.

---

### C3 — Claim-query FSM (P2)

**Gap.** `CLAIM_QUERY_RAISED` written onto case, not in `108` seed, bypasses `WorkflowEngine`.

**Target.** Insert states + transitions; `ClaimPacketGeneratorService` calls `FireAsync`.

**Screen.** Existing claims UI.

**BE/DB.** Migration 172 + service change.

**Defer** behind C1/C2.

---

### FR-1.1 — OPD sync into IP (PARTIAL)

**Gap.** `outpatient-integration.ts` is a **hint** engine for counsellor checklist. Journey `procedureName` / `eyeOperated` / `iol_power` filled at OT finalize / counselling, not a guaranteed field copy of diagnosis/biometry.

**Target.** On counselling finalize / journey onboard, copy: procedure, laterality, IOL power from session + latest biometry for that eye. Idempotent overwrite only if journey field null **or** explicit “refresh from OPD” action.

**Screen.** Counsellor finalize + pre-op evaluation prefill (already reads `loadJourneyIolPower`). Add “Refresh from OPD” on evaluation if mismatch.

**FE.** Button on `ClinicalEvaluationIolSection` if biometry ≠ journey.

**BE.** `OtFinalizeService` / journey create path — extend existing copy in `OtFinalizeService` (~L921 session.IolPower). Add diagnosis/eye if missing.

**DB.** None (columns exist).

**Tests.** Finalize with session IOL populates journey; second finalize does not blank.

---

### FR-1.3 — Insurer tariffs (PARTIAL, P2)

**Gap.** `variant_prices` + `branch_pricing_overrides` + government schemes. No payer-specific price book.

**Target.** Do **not** build unless a named TPA contract requires it. Coverage already applies copay/deductible/approved cap on billed catalog prices.

**Action.** DEFER. Document as product decision.

---

### FR-5.4 — Consignment (MISSING, P2)

**Gap.** Supplier `type: 'consignment'` enum only.

**Target.** Inventory-owned issue/return against consignment stock; IP implant path already calls `IInventoryImplantClient`. Extend inventory, not IP.

**Action.** DEFER after A2 (implant clinical path stable).

---

### D1 — Charge mapping ops

**Gap.** Explosion/charge fail closed on unmapped items. Operational, not missing code.

**Target.** Run S-14 until exception queue is empty for live packages. No new screen.

---

### FE-KPI — Census outstanding

**Gap.** `page.tsx` falls back to `j.balanceDue` if ledger dashboard fails.

**Target.** Show error on KPI tile (“Dues unavailable”) — never sum journey projection.

**FE only.** S-01.

---

### E1 — PermissionSeeder parity (P0)

**Gap.** `AuthService/SeedData/PermissionSeeder.cs` does not include IP/billing codes from SQL 156. Fresh seeder-only DBs miss `ip.admit` etc.

**Target.** Append the 156 codes (and A5/A2 codes) to the seeder list with `NOT EXISTS` by Code+TenantId. Do not remove SQL 156 (idempotent both ways).

**Tests.** Seeder unit: after seed, `ip.ot.mark_ready` exists.

---

### E2 — Freeze browser `addBilling`

**Target.** `JourneyFunctions` billing POST returns 410 for non-internal callers; keep UAT seeder on internal key if needed.

---

### E3 — Intra-op audit

**Target.** `IntraOpNoteService` save/sign → `JourneyClinicalAudit` (`IntraOpNoteSaved` / `IntraOpNoteSigned`).

---

### F2 / F3 — HL7 / PACS (P3)

**Target.** Outbox consumers only (`JourneyAdmitted`, bed transfer, `PatientClinicallyDischarged`). No second write path in IP. DICOM: later C-FIND attach to `ccms_documents`. Not in go-live path.

---

## 4. Screen delta inventory

| Screen | Action | Deltas |
|---|---|---|
| S-01 Census | MODIFY | KPI error state; optional Print wristband on rail |
| S-02 Rail | KEEP | Wristband secondary; dilation/vitals appear via transition-gates |
| S-03 Collect | KEEP | — |
| S-04 Ward | EXTEND | `WardBedMap`; Print wristband on admit |
| S-05 Pre-op | EXTEND | Dilation chip; vitals warn in footer (`MarkReadySoftWarningList`) |
| S-06 OT | KEEP | Implant panel already hosted |
| S-07 Implant | EXTEND | GS1 fields; power mismatch dialog |
| S-08 Post-op | EXTEND | Taper table |
| S-09 Discharge | EXTEND | Book/link `appointment`; lock discharge |
| S-10 Journey | MODIFY | Show token code; follow-up appointment link |
| S-11–S-16 | KEEP | C2 is CCMS ops page |
| S-17 Reason | REUSE | Unmark, mismatch override, discharge override |
| S-18 Coverage | KEEP | — |
| Counsellor desk | EXTEND | FR-1.1 copy/refresh |
| CCMS documents / preauth | EXTEND | Requirements-driven checklist; queue fix |
| `/dashboard/appointments` | REUSE | Created follow-ups appear here automatically |

**Loading / empty / error / permission / conflict** — inherit existing workspace and S-17 patterns. Mismatch and appointment conflict use S-17 / Auth 409 copy.

---

## 5. API catalog (new or changed)

| Method | Route | Change | Perm | Idempotency |
|---|---|---|---|---|
| POST | `/ip-management/journeys/{id}/verify-iol-barcode` | Parse GS1 | implant/OT | n/a |
| POST | `/ip-management/journeys/{id}/implants` | Power/model gate + AcknowledgeMismatch | implant record; override separate | existing usage key |
| GET | `/ip-management/journeys/{id}/pre-op/readiness` | + dilation slice | `ip.view` | — |
| GET | `/ip-management/journeys/{id}/transition-gates?newState=` | + dilation/vitals warns; + follow-up block on discharge | `ip.view` | — |
| POST | `/ip-management/journeys/{id}/safety-token` | CREATE | `ip.safety_token.print` | unique active |
| GET | `/ip-management/journeys/{id}/safety-token` | READ | print or view | — |
| GET/PUT | `/ip-management/journeys/{id}/post-op/taper` | CREATE | `ip.postop.manage` | PUT replace |
| PUT | `/ip-management/journeys/{id}/post-op/instructions` | + followupAppointmentId | postop | — |
| POST | `/api/Appointments` | **REUSE** | `appointment.create` | Auth |
| GET | `/api/Appointments/patient/{patientId}` | **REUSE** | `appointment.view` | — |
| GET | `/api/internal/ip-appointments/{appointmentId}` | CREATE Auth | internal key | — |
| POST | `/ccms/authorizations/{id}/submit` | Doc requirements | existing | — |
| GET | `/ccms/operations/preauth-queue` | Fix filter | existing | — |

Errors: 400 validation, 409 conflict (mismatch, appointment slot, discharge gate), 403 fail-closed, 410 addBilling. User-facing messages only.

---

## 6. Backend classes

| Work | Reuse | Create |
|---|---|---|
| A1 | `VerifyIolBarcodeAsync`, `ResolveBarcodeAsync` | `Gs1BarcodeParser` |
| A2 | `ImplantUsageService.RecordAsync`, `RequireMatchingEye` | `IolPowerParser` (static) |
| A3/A4 | `ChecklistGateService`, `MedicationLogService`, `VitalSignService`, `PreOpReadinessService` | dilation helper; threshold loader |
| A5 | `JourneyClinicalAudit` | `JourneySafetyTokenService` |
| A6 | ward beds API | FE only (maybe DTO fields) |
| B1 | `PostOpWorkflowService` | `PostOpTaperService` |
| B2 | `PostOpWorkflowService`, `AppointmentsController`, `ExaminationService` pattern | `InternalIpAppointmentController` (Auth) |
| C1 | `PreAuthorizationService`, master requirements | — |
| C2 | `OperationsFunctions` | — |
| E1 | `PermissionSeeder` | extra entries |

Transaction: clinical implant + outbox already one SaveChanges. Appointment create is Auth transaction; IP then stores FK (compensate: if IP save fails, appointment still valid — acceptable; retry link). Discharge gate is read-only check.

---

## 7. Database migrations

Existing 156–167: do not re-apply as new work.

```sql
-- 168_journey_safety_token.sql  (A5)
BEGIN;
CREATE TABLE IF NOT EXISTS journey_safety_token (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    journey_id uuid NOT NULL REFERENCES patient_journey(id),
    token_code varchar(32) NOT NULL,
    barcode_value varchar(64) NOT NULL,
    laterality varchar(8),
    printed_at timestamptz,
    printed_by uuid,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_safety_token_active
  ON journey_safety_token (tenant_id, journey_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_safety_token_code
  ON journey_safety_token (tenant_id, token_code);
COMMIT;
```

```sql
-- 169_ip_vital_threshold.sql  (A4)
BEGIN;
CREATE TABLE IF NOT EXISTS ip_vital_threshold (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL UNIQUE,
    systolic_max int NOT NULL DEFAULT 180,
    diastolic_max int NOT NULL DEFAULT 110,
    pulse_min int NOT NULL DEFAULT 40,
    pulse_max int NOT NULL DEFAULT 140,
    spo2_min numeric(5,2) NOT NULL DEFAULT 92,
    temp_max_c numeric(4,1) NOT NULL DEFAULT 38.5,
    severity varchar(16) NOT NULL DEFAULT 'warn'
      CHECK (severity IN ('warn', 'block')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
```

```sql
-- 170_post_op_taper_step.sql  (B1)
BEGIN;
CREATE TABLE IF NOT EXISTS post_op_taper_step (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    journey_id uuid NOT NULL REFERENCES patient_journey(id),
    drug_name varchar(160) NOT NULL,
    eye varchar(8) NOT NULL,
    step_no int NOT NULL,
    frequency_label varchar(80) NOT NULL,
    days int NOT NULL CHECK (days > 0),
    instructions text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NOT NULL,
    deleted_at timestamptz,
    UNIQUE (journey_id, drug_name, eye, step_no)
);
CREATE INDEX IF NOT EXISTS ix_post_op_taper_journey
  ON post_op_taper_step (tenant_id, journey_id) WHERE deleted_at IS NULL;
COMMIT;
```

```sql
-- 171_frd_safety_permissions.sql  (A2, A5)
-- Columns must match 156: id, TenantId, Code, Name, Module, Action, ResourceType, Scope, Description, ...
BEGIN;
INSERT INTO permissions (
    id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
    "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
    "CreatedAt", "UpdatedAt")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000'::uuid,
       v.code, v.name, 'ip_management', v.action, 'patient_journey', 'branch',
       v.descr, true, false, false, true, NOW(), NOW()
FROM (VALUES
    ('ip.implant.mismatch.override', 'Override IOL mismatch', 'override',
     'Record an implant when power or model differs from the planned lens'),
    ('ip.safety_token.print', 'Print safety token', 'update',
     'Print or reprint the inpatient wristband')
) AS v(code, name, action, descr)
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p WHERE p."Code" = v.code
);
-- Role attach: copy 156 NURSE/SURGEON/ADMIN pattern. REQUIRES verification of app_role_permissions table name.
COMMIT;
```

```sql
-- 173_postop_followup_appointment.sql  (B2)
BEGIN;
ALTER TABLE post_op_instructions
  ADD COLUMN IF NOT EXISTS followup_appointment_id uuid;
CREATE INDEX IF NOT EXISTS ix_post_op_instr_followup_appt
  ON post_op_instructions (followup_appointment_id)
  WHERE followup_appointment_id IS NOT NULL;
COMMENT ON COLUMN post_op_instructions.followup_appointment_id IS
  'Logical FK to appointment.id (Auth calendar SoT). Not follow_up_appointments.';
COMMIT;
```

C3 (`172` claim-query states) is P2 — specify from `108_ccms_workflow_seed.sql` row layout before writing.

Rollback: DROP TABLE / DROP COLUMN as in comments. Tokens and tapers have no production data yet.

---

## 8. Events / realtime

No new outbox event types required for A1–B2.

| Action | Event | Notes |
|---|---|---|
| Implant recorded (incl. override) | existing `ImplantUsed` | Add mismatch flag in payload optional |
| Mark Ready | existing `JourneyReadyForOt` | Warns do not emit extra events |
| Appointment booked | none from IP | Auth appointment create; IP stores FK |
| Wristband | audit only | |
| Discharge blocked | none | 409 on transition |

UI: existing SignalR invalidation + 45s poll. S-07 refetch implants after record. S-09 refetch discharge gates after book.

---

## 9. RBAC additions

| Code | Roles | FE | API |
|---|---|---|---|
| `ip.implant.mismatch.override` | SURGEON, OT COORDINATOR, ADMIN | hide dialog confirm | server |
| `ip.safety_token.print` | NURSE, WARD CLERK, IP COORDINATOR, ADMIN | hide print | server |
| `appointment.create` | verify nurse/coordinator bundles | hide Book | Auth |
| existing `ip.discharge.override` | ADMIN / privileged | S-17 | discharge gate |

Frontend fail-closed (`permissions-fail-open.ts`). Seed SQL 171 **and** `PermissionSeeder.cs` (E1).

---

## 10. Phased implementation

### Phase A — Safety (P0) — can ship without B/C

A1 GS1 → A2 power (A2 may land first; GS1 only improves scan fill).  
A3 dilation, A4 vitals, A5 token, E1 seeder in parallel.

**Accept:** cannot implant 21.50 vs planned 21.00 without override; dilation/vitals warn visible; wristband prints; seeder has `ip.admit`.

### Phase B — Discharge completeness (P1)

B1 taper (parallel) · B2 follow-up lock (Auth internal + IP column + S-09).

**Accept:** discharge 409 without appointment; book creates row in `appointment` visible on `/dashboard/appointments`.

### Phase C — CCMS hygiene (P1)

C2 queue (small, first) · C1 doc gate · C3 later.

### Phase D — Ops

FE-KPI · FR-1.1 copy · S-14 mapping · E2/E3.

### Phase F — P3

HL7 / PACS / consignment / insurer tariffs.

---

## 11. Task graph

```
E1 seeder ────────────────────────────── parallel
C2 queue  ────────────────────────────── parallel
FE-KPI    ────────────────────────────── parallel
A1 GS1 → A2 power/model
A3 dilation ── parallel with A4 vitals (both ChecklistGateService — sequential in one PR preferred)
A5 token ── parallel
A6 bed map ── parallel FE
B1 taper ── parallel
B2 follow-up: Auth internal GET → IP column → S-09 → discharge gate
C1 after C2
FR-1.1 ── parallel
C3, E2, E3, FR-5.4, F2/F3 ── after A–B
```

**Suggested first PR:** A2 + IolPowerParser + tests (no migration).  
**Second:** A3+A4 in one ChecklistGate PR + 169.  
**Third:** B2 (highest workflow completeness after safety).

---

## 12. Testing matrix (remaining)

| Area | Unit | Integration | E2E |
|---|---|---|---|
| GS1 | parser fixtures | verify-iol-barcode | scan fills serial |
| IOL 0.00 D | RecordAsync | 409/override | S-07 dialog |
| Dilation/vitals | gate codes warn | Mark Ready ack | footer chip |
| Wristband | unique active | POST twice | print |
| Bed map | — | DTO occupant | click cell |
| Taper | CRUD | PUT/GET | S-08 |
| Follow-up | gate block | Auth create + IP FK | S-09 → appointments list |
| Pre-auth docs | submit 400 | — | checklist |
| Queue | filter | Status=active appears | ops page |
| Seeder | codes present | — | — |

Negatives: wrong power, cancelled appointment, missing appointment.create, empty JWT, concurrent implant serial (existing).

---

## 13. What this blueprint explicitly will not do

- New clinical states  
- New `OpdBill` owner in IP  
- New insurance FSM  
- New booking table  
- 0.50 D IOL tolerance  
- Hard-block dilation/vitals  
- Duplicate census/OT/billing pages  
- Third outbox  
- HL7/PACS in the go-live slice  

---

## 14. Confirmation already received

- IOL compare exact after 2-decimal parse (0.00 D) — **Yes**  
- Follow-up lock → `appointment` via `post_op_instructions.followup_appointment_id` — **Yes**  
- Dilation/vitals warn — **Yes**

Next coding step when requested: **PR1 = A2 IOL exact power/model guard** (no migration, highest never-event value).
