# Ward & IP Journey — Final Complete Implementation Plan (Merged)

**Version:** 2.0  
**Status:** Master plan — deployment, training, QA, and implementation roadmap  
**Scope:** Ward dashboard, Ward Pre-Operative Workspace, OT handoff, post-op/discharge, counselling/scheduling guards, additive backend transitions  
**Constraint:** Existing **forward** clinical state machine unchanged; only **additive** reverse edges for cancel today

**Primary route:** `/dashboard/ip-management/ward`  
**Backend service:** `microservices/ip-management-service` (Azure Functions + PostgreSQL)  
**Baseline spec:** [ward-preop-workspace-spec.md](./ward-preop-workspace-spec.md)

**Related docs:** [ward-ip-journey-deployment-runbook.md](./ward-ip-journey-deployment-runbook.md), [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md), [counselling-ui-component-registry.md](./counselling-ui-component-registry.md), [patient-ui-component-registry.md](./patient-ui-component-registry.md)

---

## Part I — Executive Summary

The ward module delivers a unified **Ward Pre-Op Workspace** for `Expected → Admitted → ReadyForSurgery`, with investigation value/verify, department clearance, ward safety, and PAC. Post-op and discharge modals cover later stages. OT owns `SentToOT` through `SurgeryCompleted`.

This document merges:

- Codebase audit and **Gap Analysis (G1–G11)**
- **State-by-state user workflows** (Stages 0–9 + cancel cross-cutting)
- **Signed-off workflow decisions** from product sessions
- **Technical recommendations** and **phased execution roadmap** (Phases 0–4)
- **Deployment QA checklist** (WF-01…WF-10)

**Core principles:** One primary UI surface per action; warn-only gates (permanent); forward clinical transitions untouched; OT owns SentToOT queue.

---

## Part II — Locked Requirements (R1–R12)

| # | Requirement |
|---|-------------|
| R1 | Forward flow unchanged: `Expected → Admitted → ReadyForSurgery → SentToOT → InOT → SurgeryCompleted → PostOp → ReadyForDischarge → Discharged` |
| R2 | Transition gates **warn-only** (permanent), except existing **CCMS insurance pre-auth hard block** on admit unless override (G11) |
| R3 | `SentToOT` tracking is **OT staff only** — no ward SentToOT tab |
| R4 | §2 **Evaluation + Anaesthesia** locked until `Admitted`; other §2 categories editable pre-admit, all non-blocking |
| R5 | §2 **computed display status** on top of existing `PreOpSectionClearance.Status` |
| R6 | **Cancel today:** flag + release OT + auto-release bed + revert `Expected`; counselling rebooks |
| R7 | Cancel from `Admitted` / `ReadyForSurgery` / `SentToOT` only if `otState ∈ {NotSent, SentToOT}`; if OT Accepted → OT returns patient first |
| R8 | Block same-day second **single-eye** journey; allow one **BE/both-eyes** journey |
| R9 | Sequential single-eye = two journeys on different dates |
| R10 | Day-care = same ward UI as IPD |
| R11 | Merged MR: strikethrough, block ward mutations, canonical UHID link |
| R12 | **No duplicate UI flows** (see Part III §3.4) |

---

## Part III — Gap Analysis Results

The project plan (`ward-preop-workspace-spec.md` + signed-off decisions) now covers architecture, granular workflows, and deployment. **G1–G11 are closed** as of Phases 1–4 (see §3.2). Codebase audit summary:

### 3.1 What the plan covers well

| Area | Coverage in plan | Verified in code |
|------|------------------|------------------|
| Clinical state machine (forward path) | Yes | `StateTransitionValidator.cs` |
| Ward Pre-Op Workspace shell (Expected → ReadyForSurgery) | Yes | `WardPreOpWorkspaceModal.tsx`, `WardChecklistStepper.tsx` |
| §1 Investigations (value + verify + optional upload) | Yes | `InvestigationResultRow.tsx`, `WardInvestigationChecklistService.cs` |
| §2 Department Clearance (multi-dept workflow) | Yes | `DepartmentClearancePanel.tsx`, `PreOpClearanceService.cs` |
| §3 Ward Safety (Form 2) | Yes | `WardChecklist.tsx` |
| §4 PAC (post-admit edit) | Yes | `PacAssessmentForm.tsx` |
| Warn-only gates | Yes | `ChecklistGateService.cs`, `transition-gates.ts` |
| OT ownership after Send to OT | Implied | `operation-theatre/page.tsx` |
| Post-op + discharge modals | Yes | `WardPostOpWorkspaceModal`, `WardDischargeSummaryModal` in `ward/page.tsx` |

### 3.2 Critical gaps — plan vs codebase vs signed-off decisions

| Gap ID | Signed-off decision | In project plan? | In codebase? | Status | Phase |
|--------|---------------------|------------------|--------------|--------|-------|
| **G1** | Cancel today's surgery → revert Expected, release OT, auto-release bed | Yes | `POST .../cancel-today-surgery`, ward cancel modal, rebook sync | **Done** | Phase 2 ✓ |
| **G2** | Lock Evaluation + Anaesthesia §2 until Admitted | Yes | `DepartmentClearancePanel` `forceReadOnly` at Expected | **Done** | Phase 1 ✓ |
| **G3** | §2 computed display status (Pending / Partial / Complete, etc.) | Yes | `section-display-status.ts`, `DepartmentClearancePanel` badges | **Done** | Phase 1 ✓ |
| **G4** | Gate banner P0–P4 alignment | Yes | `ChecklistGateService` + progress strip labels aligned | **Done** | Phase 1 ✓ |
| **G5** | Merged MR: strikethrough + block ward mutations | Yes | `JourneyMutationGuardService`, `MergedMrGuardBanner`, canonical link | **Done** | Phase 2 ✓ |
| **G6** | Same-day single-eye duplicate journey block | Yes | `OtFinalizeService`, `JourneySchedulingGuardService`, E2E `ip-ward-scheduling-guard.spec.ts` | **Done** | Phase 2 ✓ |
| **G7** | Single-surface UI (no duplicate gates / →OT) | Yes | Gates in executing modal only; inline `→OT` removed; journey pre-op read-only | **Done** | Phase 1–4 ✓ |
| **G8** | Hide care tabs until Admitted | Yes | `WardPreOpCareTabsPanel` hidden at Expected | **Done** | Phase 1 ✓ |
| **G9** | Upstream counselling → Expected journey creation | Yes | `OnboardExpectedJourneys`, counselling session; runbook Stage 0 | **Done** | Phase 0 ✓ |
| **G10** | SurgeryCompleted → PostOp handoff | Yes | OT page **Move to Post-Op Ward**; runbook + training | **Done** | Phase 3 ✓ |
| **G11** | CCMS insurance pre-auth hard block on admit | Yes (doc) | `CcmsAdmissionClient.ValidateAdmissionAsync` unless override | **Done** (documented) | Phase 0 ✓ |

### 3.3 Duplicate UI/UX flows (resolved)

| Duplicate | Was | Resolution | Phase | Status |
|-----------|-----|------------|-------|--------|
| Checklist gate warnings | Workspace footer, AdmitModal, SendToOTModal | Gates **only** in modal that executes transition | Phase 1 | **Done** |
| Send to OT | Workspace footer + row `→OT` | Footer only; inline `→OT` removed | Phase 2 | **Done** |
| Pre-op editing | Ward workspace + Journey Modal `PreOpTab` | Workspace edits; Journey read-only `JourneyPreOpSummary` | Phase 3 | **Done** |
| Post-op editing | PostOpWardModal Form 4 + legacy Nurse/Surgeon tabs | `WardPostOpWorkspaceModal` unified shell | Phase 3 | **Done** |

### 3.4 Single-surface ownership contract

| User action | **Only** surface | Must not duplicate in |
|-------------|------------------|------------------------|
| Pre-op edit (§0–§4, vitals, med log) | Ward Pre-Op Workspace | Journey Modal PreOpTab (editable) |
| Admit patient | AdmitModal | Workspace full gate banner |
| Mark Ready for Surgery | Workspace footer | — |
| Send to OT | Workspace footer → SendToOTModal | Row `→OT` |
| Cancel today's surgery | Ward cancel modal | Counselling reschedule form |
| Postpone / rebook (future date) | Counselling session | Ward |
| OT accept / start / end | OT page | Ward dashboard |
| Post-op checklist | PostOp Ward Modal | — |
| Discharge | Discharge Summary Modal | — |
| Emergency FC | Ward row action | Workspace |
| Quick snapshot | Case Sheet | — |
| Patient merge | `/dashboard/patients/merge` | Ward on superseded MR |
| Read-only full chart | Journey Modal | — |

**Allowed redundancy:** Phase progress strip + section header counts (same screen).

---

## Part IV — Architecture

### 4.1 Stage ownership

```
Counselling     →  Journey creation, P0, schedule, postpone/rebook, scheduling guard (G6)
Ward dashboard  →  Expected | Admitted | ReadyForSurgery | PostOp | ReadyForDischarge
Ward workspace  →  Pre-op clinical work (Expected–ReadyForSurgery)
OT page         →  SentToOT | InOT | SurgeryCompleted (+ move to PostOp)  [G10]
Journey Modal   →  Read-only timeline all stages
```

### 4.2 Clinical state machine (forward — unchanged)

```
Expected → Admitted → ReadyForSurgery → SentToOT → InOT → SurgeryCompleted → PostOp → ReadyForDischarge → Discharged
                              ↑_______________|  (OT return: SentToOT/InOT → ReadyForSurgery)
```

Backend validator: `microservices/ip-management-service/.../StateTransitionValidator.cs`

### 4.3 Additive transitions only (G1 / cancel today)

| From | To | Guard |
|------|-----|-------|
| `Expected` | `Expected` | Cancel clears annotations (optional pre-admit no-show) |
| `Admitted` | `Expected` | Cancel today |
| `ReadyForSurgery` | `Expected` | Cancel today |
| `SentToOT` | `Expected` | Cancel today + `otState ∈ {NotSent, SentToOT}` |

### 4.4 Parallel dimensions

- **Clinical state:** primary ward/OT workflow
- **OT state:** `NotSent → SentToOT → Accepted → InProgress → Completed`
- **Financial state:** independent billing workflow
- **Post-op state:** `NotStarted → InProgress → Completed`

Tracked on ward list and Journey Modal.

### 4.5 Journey annotations (new — not clinical states)

| Field | Purpose |
|-------|---------|
| `surgeryCancelledAt` | Timestamp of ward cancel |
| `surgeryCancelReason` | Required reason text |
| `pendingRebook` | Boolean — counselling must rebook |
| `cancelledFromState` | Audit: state before cancel |
| `isSuperseded` / `canonicalUhid` | Merge guard (or derive from patient merge service) |

### 4.6 §2 display status model (G3)

Built on existing `PreOpSectionClearance.Status` — **do not replace** backend model.

#### Category availability

| Category | Expected | Admitted+ |
|----------|----------|-----------|
| Compliance, Consent, Financial, Documents, Pharmacy Preparation, OT Preparation | Editable | Editable |
| Evaluation, Anaesthesia | **Locked** (view only) | Editable |

#### Display status enum

| Display status | Condition | Blocks admission? |
|----------------|-----------|-------------------|
| `Locked` | Expected + Evaluation/Anaesthesia | No |
| `NotStarted` | NotRequested + 0 mandatory items | No |
| `PartiallyComplete` | Some mandatory items done | No |
| `AwaitingDepartment` | Requested / NeedsInfo | No |
| `ReadyToConfirm` | RespondedClear | No |
| `ConcernsRaised` | RespondedConcerns | No |
| `OnHold` | OnHold | No |
| `Rejected` | Rejected | No |
| `Escalated` | Escalated | No |
| `Complete` | WardConfirmed or all mandatory items done | No |

**Implemented:** `apps/hospital-portal-web/src/lib/ip-management/section-display-status.ts` — `deriveSectionDisplayStatus()`

---

## Part V — State-by-State User Workflows

**Legend**

- **UI:** Primary screen/modal
- **API:** Backend hook (`ip-management-service` unless noted)
- **Roles:** Typical actor (RBAC codes in parentheses)

---

### Stage 0 — Journey creation (pre-`Expected`, counselling-owned) [G9]

| | |
|--|--|
| **UI** | Counselling session (`/dashboard/counsellors-desk/...`) |
| **API** | Counselling service creates session; IP `POST /ip-management/journeys/onboard-expected` seeds clearance + copies P0 |
| **Trigger** | Surgery scheduled / package confirmed |

#### Data entry

- Patient, procedure, eye (OD/OS/BE), surgery date/time, payment mode, package amount
- P0 outpatient checklist (counsellor)
- Optional §1 investigation draft values (counsellor → `draft` status)

#### Files

- Counselling documents (consent quotes, etc.) — outside ward module

#### Monitoring

- Counsellor waiting list; journey appears on ward dashboard as **`Expected`**

#### Validation

- **Done (G6):** Block second single-eye journey same patient + same surgery date (`OtFinalizeService`, `JourneySchedulingGuardService`)
- Bilateral same-day: one BE/BOTH_EYES journey allowed

---

### Stage 1 — `Expected`

| | |
|--|--|
| **UI** | Ward dashboard → row click → **Ward Pre-Op Workspace**; **AdmitModal** for admission |
| **API** | `GET /ip-management/journeys`, workspace checklist APIs, `POST .../admit` |
| **Roles** | Ward nurse, front desk (`ward.checklist.edit`, `ward.investigation.enter/verify`) |

#### Data entry

| Area | Detail |
|------|--------|
| **§0 P0** | Read-only; view counsellor progress; link to session if permitted |
| **§1 Investigations** | `resultValue`*, `resultUnit`, `referenceRange`, external-hospital flag, `externalReportNote`; Save → `PUT .../ward-investigation-checklist/completions/{itemId}/result`; Verify → `POST .../verify` |
| **§2 Clearance** | Evaluation + Anaesthesia **locked** at Expected (G2); Compliance, Consent, Financial, Documents, Pharmacy Prep, OT Prep editable. Item checkbox/bypass; section Request → Respond → Confirm; Hold/Reject/Needs Info/Escalate. Display status badges (G3). APIs: `initPreOpClearance`, `getPreOpClearance`, `PreOpClearanceService` section actions |
| **§3 Ward Safety** | ~17 items via `saveWardChecklistCompletion`; auto-sync hints from §1, vitals, PAC, consent |
| **§4 PAC** | View-only; banner: admit to continue; `PacInvestigationSummary` read-only labs |
| **Care tabs** | **Hidden** until Admitted (G8) |
| **AdmitModal** | Required: `admissionType` (DayCare/IPD/Emergency). Optional: `primarySurgeonId`, `wardId`, `bedNumber`, `admittedAt`, `primaryNurseId`, attendant name/phone/relationship. Overrides: `overrideStateCheck`, `bypassFinancialClearance`, `overrideReason`* |
| **Row actions** | Case Sheet (read-only); Emergency FC → `POST .../emergency-fc` with reason* |

#### Files

| Location | Required? | Format | Storage |
|----------|-------------|--------|---------|
| §1 investigation row | Optional | Any file → base64 | `POST .../document` → `pre_op_documents` |
| §2 clearance items | Per item config | File → base64 | `uploadPreOpDocument` |
| Doc types | Auto-mapped | LabReport, ImagingReport, ConsentForm, etc. | `documentId` on completion |

#### Monitoring

- Ward dashboard: stat card + status pill **Expected**
- P0 chip (`WardExpectedP0Chip`) when P0 incomplete
- Workspace header: P0–P4 phase progress strip (`ChecklistPhaseSummary`) — click navigates to §
- Table: surgery date/time, OT state (`NotSent`), empty ward/bed/admitted
- Footer CTA: **Admit Patient**

#### Validation

- **Gate (warn-only):** P0, P1 investigations, P2 ward checklist counts — `ChecklistGateService` on Expected→Admitted
- **Hard block (G11):** CCMS insurance pre-auth unless `bypassFinancialClearance` or `overrideStateCheck`
- User acknowledges warnings → `admitPatient(..., acknowledgeWarnings: true)`
- Investigation: value required; counsellor drafts need ward verify before PAC (warn at PAC complete)
- **Done (G1):** Cancel today's surgery from workspace (Admitted / ReadyForSurgery / SentToOT when not OT Accepted)

---

### Stage 2 — `Admitted`

| | |
|--|--|
| **UI** | Same **Ward Pre-Op Workspace** |
| **API** | Checklist APIs + vitals/nurse/med log; `POST .../clinical-transition` `{ newState: 'ReadyForSurgery' }` |
| **Roles** | Ward nurse; anaesthetist (`anaesthesia.pac.edit`); doctors (§2 Evaluation) |

#### Data entry

- **§2:** Evaluation + Anaesthesia **unlock (G2)**
- **§4 PAC (editable):** assessed at, BP, HR, ASA grade (1–5), pre-op diagnosis, allergies, anaesthetic history, systemic review (CVS, respiratory, renal, hepatic/GI, diabetes, CNS, others), airway examination*, anaesthesia plan*, consent type*, peri-op explained checkbox, current medications, investigations advised (free text). Complete PAC → `PacAssessmentService`; warns if critical labs unverified
- **Vitals tab:** BP systolic/diastolic, pulse, temperature, SpO2, RR, weight, height, notes — saved on Mark Ready via `addVital`
- **Medication Log:** add drug, dose count, scheduled/administered times; meta: anaesthesia type, xylocaine sensitivity (Local), surgery notes; dilatation → Form 2 `ward_dilatation_done` sync
- **Nurse Records:** shift type, nursing notes, medications given, I/O notes, pain score, alertness
- **Remark tab:** free-text passed as `reason` on Mark Ready transition

#### Files

- Same as Expected; PAC uses §1 read-only summary (no duplicate lab grid)

#### Monitoring

- Dashboard tab **Admitted**; phase strip includes P4 PAC (0/1); editable care tabs

#### Validation

- **Gate (warn-only):** PAC incomplete → `ChecklistGateService` Admitted→ReadyForSurgery
- Frontend confirm if PAC incomplete (`WardUpdationModal.handleSaveAndMarkReady`)
- Med log before PAC allowed (by design)
- Permissions: `canEditWardChecklist`, `canEditPac`, investigation enter/verify

#### Footer CTA

**Save & Mark Ready for Surgery** — flushes pending vitals/nurse records, optional ward assignment update, then clinical transition

---

### Stage 3 — `ReadyForSurgery`

| | |
|--|--|
| **UI** | Ward Pre-Op Workspace + **SendToOTModal** |
| **API** | `transitionClinical` `{ newState: 'SentToOT' }` → `otState: SentToOT`, `sentToOtAt` |
| **Roles** | Ward nurse |

#### Data entry

- §1–§3, med log, vitals still editable until Send to OT
- Send to OT: confirmation only (no extra fields)

#### Files

- Late investigation uploads still allowed

#### Monitoring

- Dashboard **Ready for Surgery** tab
- OT state `NotSent` until Send, then `SentToOT`
- Badge **Returned from OT** if `otReturnReason` set
- Send to OT via workspace footer only (**G7** — inline `→OT` removed)

#### Validation

- **Gate (warn-only):** Med log empty or doses not administered
- Acknowledge via `transitionClinicalWithGates`
- **Done (G1):** Cancel today's surgery from workspace (Admitted / ReadyForSurgery / SentToOT when not OT Accepted)

---

### Stage 4 — `SentToOT`

| | |
|--|--|
| **UI** | **OT page** (`/dashboard/ip-management/operation-theatre`) primary; Ward → **Journey Modal** read-only |
| **API** | `POST .../accept`; return via `clinical-transition → ReadyForSurgery` |
| **Roles** | OT nurse, anaesthetist, surgeon |

#### Data entry (OT page)

- OT Details form: anaesthetist, theatre room, anaesthesia type, IOL power/barcode, assistants, scrub nurses → `PUT .../ot`
- Surgical safety checklists (Before Anaesthesia, WHO timeout, After Surgery)
- Intra-op notes (procedure, findings, complications, blood loss, IV fluids)

#### Files

- IOL barcode → `POST .../verify-iol-barcode`
- Intra-op documentation in OT module

#### Monitoring

- OT dashboard: Awaiting Acceptance (`SentToOT`), Accepted, In OT
- Ward dashboard: patient only under **All** (by design — OT owns queue)
- `otState`: `SentToOT` → `Accepted` on accept

#### Validation

- **Accept (warn-only):** Before Anaesthesia incomplete — `acceptInOtWithGates`
- **Return to ward:** `SentToOT` or `InOT` → `ReadyForSurgery` (OT role); resets `otState` to `NotSent`, sets `otReturnReason`
- **Done (G1):** Ward cancel only if `otState ∈ {NotSent, SentToOT}` — not after Accepted

---

### Stage 5 — `InOT`

| | |
|--|--|
| **UI** | OT page — Surgery Detail Modal |
| **API** | `POST .../start-surgery` → `clinicalState: InOT`, `otState: InProgress`, billing lock |
| **Roles** | Surgeon, anaesthetist, OT nurse |

#### Data entry

- Continue intra-op notes, anaesthesia monitoring
- End surgery → `transitionClinical { newState: 'SurgeryCompleted' }`

#### Files

- Intra-op note save/sign APIs on journey

#### Monitoring

- Ward dashboard **In OT** tab; OT page amber highlight; `surgeryStartedAt` set

#### Validation

- **Start (warn-only):** WHO timeout incomplete — `startSurgeryWithGates`; supervisor override available
- Can return to `ReadyForSurgery` before surgery ends

---

### Stage 6 — `SurgeryCompleted` [G10]

| | |
|--|--|
| **UI** | OT page primary; Ward/Journey Modal read-only |
| **API** | End surgery transition; OT After Surgery checklist |
| **Roles** | OT staff → ward handoff |

#### Data entry

- Complete OT After Surgery checklist
- Post-op instructions (OT modal card)
- **Move to Post-Op Ward** → `transitionClinical { newState: 'PostOp' }` — **trigger on OT page, not ward**

#### Files

- Post-op instruction templates on OT page

#### Monitoring

- Ward dashboard **Surgery Done** tab (green row)

#### Validation

- **Gate (warn-only):** OT After Surgery incomplete when moving to PostOp
- CCMS surgery-completed notification fired automatically

---

### Stage 7 — `PostOp`

| | |
|--|--|
| **UI** | Ward dashboard row click → **WardPostOpWorkspaceModal** |
| **API** | `getWardPostOpChecklist`, `saveWardPostOpCompletion`, nurse/surgeon checklist APIs |
| **Roles** | Ward nurse, surgeon |

#### Data entry

- **Form 4 Checklist:** post-op items (toggle); IOL barcode verify
- **Done (Phase 3):** Unified `WardPostOpWorkspaceModal`; legacy Nurse/Surgeon parallel tabs removed

#### Files

- Document links via checklist items where configured

#### Monitoring

- Dashboard **Post-Op** tab; Form 4 completion counts in modal

#### Validation

- **Gate (warn-only):** Mandatory post-op items for IPD; optional warn for day-care
- Acknowledge on Mark Ready for Discharge

#### Footer CTA

**Mark Ready for Discharge** → `ReadyForDischarge`

---

### Stage 8 — `ReadyForDischarge`

| | |
|--|--|
| **UI** | **WardDischargeSummaryModal** |
| **API** | `getDischargeSummary`, `saveDischargeSummary`, `finalizeDischargeSummary`, `applyDischargeOverride`, `transitionClinical → Discharged` |
| **Roles** | Doctor (summary), nurse (issue confirmation), anaesthetist (Form 5 clearance) |

#### Data entry

- Diagnosis codes, procedures performed, hospital course
- Condition at discharge (Good/Stable/Fair/Guarded)
- Discharge instructions, medications on discharge, follow-up plan
- Finalize summary (locks editing); discharge patient after finalize

#### Files

- Discharge summary is structured text (no file upload in current modal)
- Nurse confirms `discharge_summary_issued` checklist item separately from finalize

#### Monitoring

- Dashboard **Ready for D/C** tab
- Anaesthesia discharge clearance status in modal
- Gate warnings before discharge

#### Validation

- Finalize required before discharge button enabled
- **Gate (warn-only, overridable):** Anaesthesia Form 5 clearance missing; nurse summary not confirmed
- `applyDischargeOverride` with reason

---

### Stage 9 — `Discharged`

| | |
|--|--|
| **UI** | Journey Modal (read-only); ward list if **Show Discharged** toggle on |
| **API** | Journey locked — `isLocked`, `isDischarged`, `dischargedAt` |
| **Roles** | Read-only all roles |

#### Data entry

- None (archived)

#### Files

- Historical documents via Journey Modal / patient hub

#### Monitoring

- Hidden by default on ward list; audit log for full lifecycle

#### Validation

- All mutations blocked on locked journey

---

### Cross-cutting — Cancel today's surgery (G1)

| | |
|--|--|
| **UI** | Ward row action / workspace footer → single cancel modal |
| **API** | **Implemented** `POST /ip-management/journeys/{id}/cancel-today-surgery` |
| **Allowed from** | `Expected`, `Admitted`, `ReadyForSurgery`, `SentToOT` (only if `otState` not Accepted) |
| **Effects** | → `Expected`; release OT slot; auto-release bed; set cancel annotations; notify counselling |
| **Not allowed from** | `InOT+`, or `SentToOT` when OT Accepted |

#### Cancel side effects (single transaction)

1. Set journey annotations (`surgeryCancelledAt`, `surgeryCancelReason`, `pendingRebook`, `cancelledFromState`)
2. `clinicalState → Expected`
3. Release OT slot via linked schedule / OT booking cancel API
4. `otState → NotSent`; clear `sentToOtAt`
5. If was admitted: clear `wardId`, `bedNumber`, `admittedAt`
6. Audit log `CancelTodaySurgery`; notify counselling
7. **Retain** §1/§2/§3 pre-op completion data

#### UI after cancel

- Clinical state: **CancelledSurgery** — the row moves to the dedicated **Cancelled** lane (no secondary "rebook" badge on the row)
- Cancellation detail (date · from-stage · reason) is shown in the patient drawer's **Cancellation** audit block
- Exit is an explicit **Rebook → Expected** action (row overflow menu / drawer); rebook clears `pendingRebook`

---

## Part VI — Technical Recommendations

### 6.1 Document layer

| Deliverable | Purpose |
|-------------|---------|
| This document (`ward-journey-user-workflows.md`) | Deployment/training/QA — operational companion to spec |
| Update `ward-preop-workspace-spec.md` | Add R1–R12, cancel spec, §2 model, G1–G11 mapping (Phase 0.2) |
| Stage-ownership diagram in runbook | Counselling / Ward / OT / Journey |

### 6.2 Backend — additive only

| Component | Purpose | Gap |
|-----------|---------|-----|
| `CancelTodaySurgeryAsync` | Validator edge + OT release + bed clear + annotations | G1 |
| `deriveSectionDisplayStatus()` (+ BE `sectionDisplayStatus` on section DTO) | §2 UI rollup + list chip | G3, R4 |
| `ChecklistGateService` label fix | P0–P4 alignment | G4 |
| Counselling/journey scheduling guard | Same-day single-eye block | G6 |
| Journey DTO extensions | cancel annotations, merge fields | G1, G5 |

### 6.3 Frontend — single-surface enforcement

| Change | Files | Gap |
|--------|-------|-----|
| Gates only in transition modals | `WardPreOpWorkspaceModal.tsx`, `ward/page.tsx` AdmitModal, SendToOTModal | G7 |
| Remove inline `→OT` | `ward/page.tsx` `InlineRowActions` | G7 |
| Lock Evaluation/Anaesthesia §2 at Expected | `DepartmentClearancePanel.tsx` | G2 |
| Hide care tabs until Admitted | `WardPreOpWorkspaceModal.tsx` | G8 |
| Cancel today modal | `ward/page.tsx` + `ip-management.api.ts` | G1 |
| Merged MR block | `ward/page.tsx`, workspace, AdmitModal | G5 |
| §2 display badges + row chip | `section-display-status.ts`, clearance panel | G3 |
| Journey read-only summaries | `JourneyModal.tsx` | G7 |
| Post-op unified shell | `PostOpWardModal` / new shell | G7 |
| OT→PostOp ward notification | `PatientJourneyService.cs` | G10 |

### 6.4 Testing strategy per state

| State | E2E anchor |
|-------|------------|
| Expected → Admitted | `e2e/ip-ward-preop-workspace.spec.ts` flow 1 |
| Admitted → Ready | flow 2 |
| Ready → SentToOT | flow 3 |
| OT accept/start/end | OT page spec (extend) |
| PostOp → Discharge | `e2e/ip-checklist-closure.spec.ts` |
| Cancel today | **New** `e2e/ip-ward-cancel-today.spec.ts` (after G1) |
| §2 lock + hidden tabs | Extend ward preop spec |
| Merge + scheduling guard | New specs Phase 2 |

---

## Part VII — Implementation Phases (0–4)

### Phase 0 — Documentation & alignment (Week 1) ✓

| ID | Deliverable | Owner | Gaps addressed | Status |
|----|-------------|-------|----------------|--------|
| 0.1 | Publish this document | BA / Architect | G9, G10 | **Done** |
| 0.2 | Update `ward-preop-workspace-spec.md` with R1–R12 + G1–G11 | Product | All | **Done** |
| 0.3 | Stage-ownership diagram in deployment runbook | DevOps | G10 | **Done** — [ward-ip-journey-deployment-runbook.md](./ward-ip-journey-deployment-runbook.md) |
| 0.4 | QA matrix WF-01…WF-10 | QA | All | **Done** — [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md) |

**Acceptance:** Training and deployment docs reference every clinical state; G11 documented as CCMS exception.

---

### Phase 1 — P0 correctness (Weeks 2–3)

| ID | Task | State impact | Files | Gaps |
|----|------|--------------|-------|------|
| 1.1 | Fix gate P-label/count mismatch | Expected, Admitted, Ready | `ChecklistGateService.cs` | G4 |
| 1.2 | Lock Evaluation + Anaesthesia §2 at Expected | Expected | `DepartmentClearancePanel.tsx` | G2 |
| 1.3 | `SectionDisplayStatus` rollup + §2 badges + row chip | Expected–Ready | `section-display-status.ts`, clearance panel, `ward-preop-progress.ts` | G3 |
| 1.4 | Gate banners **only** in transition modals; compact chip in workspace | Expected, Ready | `WardPreOpWorkspaceModal.tsx`, AdmitModal, SendToOTModal | G7 |
| 1.5 | Hide care tabs until Admitted | Expected | `WardPreOpWorkspaceModal.tsx` | G8 |
| 1.6 | Fix § symbol in stepper if showing `$` | Expected–Ready | `WardChecklistStepper.tsx` | — |

**Acceptance:** Admission gate counts match progress strip; Evaluation/Anaesthesia locked at Expected; no full gate banner in workspace footer.

---

### Phase 2 — P1 workflow completion (Weeks 4–5)

| ID | Task | State impact | Files | Gaps |
|----|------|--------------|-------|------|
| 2.1 | DB migration: cancel + annotation columns | — | `consolidated/migrations/` | G1 |
| 2.2 | Additive validator edges | Cancel paths | `StateTransitionValidator.cs` | G1 |
| 2.3 | `CancelTodaySurgeryAsync` + endpoint | → Expected | `PatientJourneyService.cs`, `JourneyFunctions.cs` | G1 |
| 2.4 | OT slot release on cancel | Cancel | OT booking client | G1 |
| 2.5 | Cancel modal + API client + badge | Ward | `ward/page.tsx`, `ip-management.api.ts` | G1 |
| 2.6 | Block cancel when OT Accepted | SentToOT | FE + BE | G1, R7 |
| 2.7 | Merged MR strikethrough + mutation block | All ward | `ward/page.tsx`, workspace, AdmitModal | G5 |
| 2.8 | Same-day single-eye scheduling guard | Pre-Expected | Counselling + journey create | G6 |
| 2.9 | Remove inline `→OT`; single readiness chip | Ready | `ward/page.tsx` | G7 |

**Acceptance:** Full cancel E2E; merge blocks admit; scheduling guard blocks duplicate OD/OS same day.

---

### Phase 3 — P2 continuity (Weeks 6–7)

| ID | Task | State impact | Gaps |
|----|------|--------------|------|
| 3.1 | Journey Modal read-only pre-op/post-op summaries + deep links | All | G7 |
| 3.2 | Post-Op Workspace shell; deprecate legacy parallel tabs | PostOp | G7 |
| 3.3 | OT → PostOp notification to ward | SurgeryCompleted → PostOp | G10 |
| 3.4 | Clear `pendingRebook` on counselling reschedule | Expected after rebook | G1 |
| 3.5 | Extend E2E: cancel, merge, scheduling, post-op | QA | All |

---

### Phase 4 — Hardening & deployment (Week 8) ✓

| ID | Task |
|----|------|
| 4.1 | RBAC audit all actions |
| 4.2 | Full E2E green |
| 4.3 | Legacy modal cleanup (`PreOpChecklistModal`, standalone `WardUpdationModal`) | **Done** — `wardUpdation` modal alias removed; care tabs via `WardPreOpCareTabsPanel` |
| 4.4 | Feature flag `isWardWorkspaceV2Enabled` default on / remove | **N/A** — unified workspace is always on |
| 4.5 | Staff training per role (ward, OT, counsellor, anaesthetist) |
| 4.6 | Production go-live using deployment checklist below |

---

### Phase 5 — Program closure (post go-live)

| ID | Task | Status |
|----|------|--------|
| 5.1 | `StateTransitionValidator` unit tests (forward path + cancel-today) | Done |
| 5.2 | E2E closure spec (merge badge, rebook badge, journey read-only, post-op shell, G6 scheduling guard) | Done |
| 5.3 | Docs sync — gap table G1–G11 marked closed; QA matrix API inventory | Done |
| 5.4 | Staging UAT sign-off WF-01…WF-10 per [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md) | **Manual** |
| 5.5 | Production deploy + runbook checklist | **Manual** — see [ward-ip-journey-deployment-runbook.md](./ward-ip-journey-deployment-runbook.md) §8 |

**Automated verification:** `npm run test:e2e:ward-journey` · `dotnet test` on `IpManagementService.Tests`

---

## Part VIII — Deployment checklist (per environment)

| Stage | User can… | API health | Training doc | Phase required |
|-------|-----------|------------|--------------|----------------|
| **Expected** | Enter labs, partial clearance, admit with warnings | Admit + §1 APIs | WF-01 | 1+ |
| **Admitted** | PAC, vitals, med log, mark ready | PAC + vitals APIs | WF-02 | 1+ |
| **ReadyForSurgery** | Send to OT | `clinical-transition` | WF-03 | 1+ |
| **SentToOT** | OT accept (OT staff) | `accept-in-OT` | WF-04 | Existing |
| **InOT** | Start/end surgery (OT staff) | `start-surgery` | WF-05 | Existing |
| **SurgeryCompleted** | Move to post-op (**OT staff**, G10) | `clinical-transition PostOp` | WF-06 | Existing + 3.3 |
| **PostOp** | Form 4, mark ready D/C | post-op checklist APIs | WF-07 | 3.2 |
| **ReadyForDischarge** | Finalize + discharge | discharge summary APIs | WF-08 | Existing |
| **Discharged** | View only | locked journey | WF-09 | Existing |
| **Cancel today** | Revert to Expected | `cancel-today-surgery` | WF-10 | 2 |

---

## Part IX — Gap-to-phase traceability matrix

| Gap | Description | Phase | Task ID |
|-----|-------------|-------|---------|
| G1 | Cancel today | 2 | 2.1–2.6 |
| G2 | §2 Evaluation/Anaesthesia lock | 1 | 1.2 |
| G3 | §2 display status | 1 | 1.3 |
| G4 | Gate P-label alignment | 1 | 1.1 |
| G5 | Merged MR guard | 2 | 2.7 |
| G6 | Scheduling guard | 2 | 2.8 |
| G7 | De-duplicate UI | 1, 2, 3 | 1.4, 2.9, 3.1–3.2 |
| G8 | Hide care tabs | 1 | 1.5 |
| G9 | Counselling → Expected docs | 0 | 0.1 |
| G10 | PostOp handoff clarity | 0, 3 | 0.1, 3.3 |
| G11 | CCMS hard block documented | 0 | 0.2 |

---

## Part X — API inventory

| Method | Route | Phase | Purpose |
|--------|-------|-------|---------|
| POST | `/ip-management/journeys/{id}/cancel-today-surgery` | 2 | Cancel today (**Done**) |
| POST | `/ip-management/internal/journey-sync/apply-rebook` | 3 | Counselling rebook clears `pendingRebook` (**Done**) |
| POST | `/ip-management/journeys/{id}/admit` | — | Admit patient |
| POST | `/ip-management/journeys/{id}/clinical-transition` | — | State transitions |
| POST | `/ip-management/journeys/{id}/accept` | — | OT accept |
| POST | `/ip-management/journeys/{id}/start-surgery` | — | OT start |
| POST | `/ip-management/journeys/onboard-expected` | — | Seed clearance + P0 |
| GET/PUT | `/ip-management/journeys/{id}/ward-investigation-checklist/...` | — | §1 |
| GET/POST | `/ip-management/journeys/{id}/pre-op-clearance/...` | 1 | §2 (**Done**) |
| GET | `/ip-management/journeys/{id}/transition-gates` | 1 | Gate warnings — labels aligned (**Done**) |

---

## Part XI — Definition of done (program level)

1. All **R1–R12** verified in staging.
2. All **G1–G11** closed or documented (G11 = doc only).
3. **Part V** workflows match implemented UI/API behavior.
4. **Part III §3.3** duplicate flows eliminated per contract.
5. Forward `StateTransitionValidator` tests unchanged.
6. E2E WF-01…WF-10 pass.
7. This document published and linked from `ward-preop-workspace-spec.md`.

---

## Part XII — Suggested execution order

| Week | Tasks |
|------|-------|
| **1** | 0.2, 0.3, 0.4; 1.1, 1.4, 1.5; 2.9 (remove →OT) |
| **2** | 1.2, 1.3, 1.6; start 2.1, 2.2, 2.8 (scheduling guard parallel) |
| **3–5** | Complete Phase 2 (cancel today full stack) |
| **6–7** | Phase 3 (journey summaries, post-op shell, G10 notification) |
| **8** | Phase 4 hardening + go-live |
| **9+** | Phase 5 closure — automated tests + UAT sign-off |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-25 | Phase R3 — §3.2 G1–G11 marked Done; Part X API inventory; Part V stale “planned” labels removed |
| 2026-06-25 | Phase 5 — program closure tests, E2E `ip-ward-program-closure.spec.ts`, docs sync |
| 2026-06-24 | Phase 0.1 — initial merged master plan (gap analysis, state workflows, phases 0–4, deployment checklist) |
| 2026-06-24 | Phase 0.2–0.4 — spec updated (R1–R12, G1–G11); deployment runbook; QA matrix WF-01…WF-10 |
