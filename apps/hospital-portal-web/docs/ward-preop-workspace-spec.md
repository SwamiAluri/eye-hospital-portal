# Ward Pre-Operative Workspace — Implementation Spec

Single source of truth for the **Ward Pre-Operative Workspace**: unified IP ward pre-op flow from **Expected** through **Ready for Surgery**, replacing the split `PreOpChecklistModal` (Expected) and `WardUpdationModal` (Admitted) experience.

**Related docs:** [ward-journey-user-workflows.md](./ward-journey-user-workflows.md) (merged implementation plan, gap analysis, state-by-state workflows, deployment checklist), [ward-ip-journey-deployment-runbook.md](./ward-ip-journey-deployment-runbook.md), [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md), [counselling-ui-component-registry.md](./counselling-ui-component-registry.md) (counsellor optional investigation entry), [patient-ui-component-registry.md](./patient-ui-component-registry.md) (IP ward component registry), [master-data-integration-matrix.md](./master-data-integration-matrix.md).

**Workspace v2 redesign:** [ward-preop-redesign-phase0-mapping.md](./ward-preop-redesign-phase0-mapping.md) — item-by-item single-writer mapping, capture-mode model, and the catalog dedupe migration plan (Q1–Q4 signed off 2026-06-26). The v2 redesign collapses §0–§4 into an 8-step single-source-of-truth model; this spec remains authoritative for the current shell until the v2 phases land.

**Route:** `/dashboard/ip-management/ward`

**Backend service:** `microservices/ip-management-service` (Azure Functions + PostgreSQL)

---

## 1. Vision

| Before | After |
|--------|-------|
| Expected → `PreOpChecklistModal` (Investigation · Ward · **PAC** · Clearance) | One **Ward Pre-Op Workspace** with state-aware sections |
| Admitted → `WardUpdationModal` (General · Vitals · Med Log · Nurse · PAC) | Same workspace; checklist + PAC + vitals in one clinical sequence |
| PAC editable before admission | PAC locked until **Admitted**; investigations editable from **Expected** |
| Investigation = checkbox only | **Value required**, upload optional, verification workflow |
| Duplicate lab entry in PAC + Form 1 | Single canonical **Investigations & Results** section |

All ophthalmic pre-op work (day-care and IPD) follows one modal shell with the same top-level tab order.

---

## 2. Locked product decisions

| Topic | Decision |
|-------|----------|
| Investigation timing | Values enterable from **Expected** (front desk, ward, OT prep) |
| Investigation value | **Always required** to complete a row |
| Investigation upload | **Optional** (internal lab and external hospital) |
| Investigation verification | Nurse / Jr. doctor / counsellor may verify; counsellor entry = **draft until ward verifies** |
| Unverified critical labs at PAC complete | **Warn only** (does not block) |
| PAC investigations grid | **Removed** — read-only summary from Section 1 |
| PAC airway examination | **Always shown** (topical/LASIK included — medico-legal) |
| PAC edit window | **Admitted** and **ReadyForSurgery**; view-only when **Expected** |
| Pre-Op Clearance | Merged into Ward Checklist as **§2 Department Clearance**; keep Confirm/Hold/Reject per dept |
| Dept Confirm | Allowed when **no mandatory blockers** remain (non-mandatory items may be open) |
| Dilatation | **Ward Checklist (Form 2)** + **Medication Log** timed dose; not Form 1 |
| Admission UI | Standalone **`AdmitModal`** only (retire admit embedded in old Pre-Op Clearance tab) |
| Admission gates | **Warn-only** for P0, P1, financial clearance |
| Med log before PAC | **Allowed** (e.g. topical drops early) |
| ReadyForSurgery | Checklist + med log **still editable** until Send to OT |
| Day-care vs IPD | **Same tab order** |
| Legacy modals | **Removed Phase 4** — use `WardPreOpWorkspaceModal` only |
| Build order | **Investigations (DB/BE/FE) first**, then unified shell, then remaining sections |

### Journey-wide locked requirements (R1–R12)

Authoritative operational rules — full detail in [ward-journey-user-workflows.md](./ward-journey-user-workflows.md).

| # | Requirement |
|---|-------------|
| R1 | Forward clinical flow unchanged: `Expected → … → Discharged` (see §3) |
| R2 | Transition gates **warn-only** (permanent), except **CCMS insurance pre-auth hard block** on admit unless override (G11) |
| R3 | `SentToOT` tracking is **OT staff only** — no ward SentToOT tab |
| R4 | §2 **Evaluation + Anaesthesia** locked until `Admitted`; other §2 categories editable pre-admit, all non-blocking |
| R5 | §2 **computed display status** (`SectionDisplayStatus`) on top of `PreOpSectionClearance.Status` |
| R6 | **Cancel today:** flag + release OT + auto-release bed + revert `Expected`; counselling rebooks |
| R7 | Cancel from `Admitted` / `ReadyForSurgery` / `SentToOT` only if `otState ∈ {NotSent, SentToOT}` |
| R8 | Block same-day second **single-eye** journey; allow one **BE/both-eyes** journey |
| R9 | Sequential single-eye = two journeys on different dates |
| R10 | Day-care = same ward UI as IPD |
| R11 | Merged MR: strikethrough, block ward mutations, canonical UHID link |
| R12 | **No duplicate UI flows** — one primary surface per action (see workflows doc §3.4) |

---

## 3. Clinical state machine

```
Expected → Admitted → ReadyForSurgery → SentToOT → InOT → SurgeryCompleted → PostOp → ReadyForDischarge → Discharged
                              ↑_______________|  (OT return: SentToOT/InOT → ReadyForSurgery)
```

**Additive reverse edges only** (cancel today — does not alter forward paths above):

| From | To | Guard |
|------|-----|-------|
| `Admitted` | `Expected` | Cancel today |
| `ReadyForSurgery` | `Expected` | Cancel today |
| `SentToOT` | `Expected` | Cancel today + `otState ∈ {NotSent, SentToOT}` |

Stage ownership: see [ward-ip-journey-deployment-runbook.md](./ward-ip-journey-deployment-runbook.md).

| State | Workspace footer CTA | PAC | Investigations §1 |
|-------|---------------------|-----|---------------------|
| **Expected** | Admit Patient (`AdmitModal`) | View-only | Edit values / upload |
| **Admitted** | Save & Mark Ready for Surgery | Edit | Edit + verify |
| **ReadyForSurgery** | Send to OT | View / amend per policy | Edit + verify |
| **SentToOT+** | Journey modal / OT flows | Read-only | Read-only |

Backend validator: `StateTransitionValidator.cs` (unchanged transitions).

Gate service: `ChecklistGateService.cs` — all checklist gates remain **warn** unless tenant config added later.

**Exception (G11):** CCMS insurance pre-auth may **hard block** admission via `CcmsAdmissionClient.ValidateAdmissionAsync` unless `bypassFinancialClearance` or `overrideStateCheck` on `AdmitModal`.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Ward Management (/dashboard/ip-management/ward)                        │
│  Row click (Expected | Admitted | ReadyForSurgery)                      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  WardPreOpWorkspaceModal                                                │
│  Header: patient · MR · state · phase progress (P0–P4)                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Tabs: Ward Checklist | Vitals | Medication Log | Nurse | Remark  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  Ward Checklist tab — sub-sections:                                     │
│    §0 P0 Outpatient (read-only)                                         │
│    §1 Investigations & Results                                          │
│    §2 Department Clearance (ex–Pre-Op Clearance)                        │
│    §3 Ward Safety (Form 2)                                              │
│    §4 PAC (Form 3)                                                      │
│  Footer: state-aware CTA                                                │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Admit (Expected only)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AdmitModal (standalone — unchanged entry point)                        │
└─────────────────────────────────────────────────────────────────────────┘

Legacy wrappers (transition):
  PreOpChecklistModal  → WardPreOpWorkspaceModal(initialSection=investigation)
  WardUpdationModal    → WardPreOpWorkspaceModal(initialTab=vitals)
```

### Backend form codes (existing)

| Form | `form_code` | Purpose |
|------|-------------|---------|
| P0 | `OUTPATIENT_SAFETY` | Counsellor outpatient checklist |
| P1 | `WARD_INVESTIGATION_PREOP` | Investigations & Results (§1) |
| Clearance | (no single code — multi-category) | Department Clearance (§2) |
| P2 | `WARD_CHECKLIST` | Ward Safety (§3) |
| P3 | PAC entity | `pac_assessments` table (§4) |
| P4 | Medication log | `pre_op_medication_logs` (top tab) |

---

## 5. Modal UX — top-level tabs

Same order for **DayCare** and **IPD**:

| Tab | Component source | Editable states |
|-----|------------------|-----------------|
| **Ward Checklist** | §0–§4 stepper | Expected, Admitted, ReadyForSurgery |
| **Vitals** | Extract from `WardUpdationModal` | Admitted, ReadyForSurgery (**hidden until Admitted** — G8, Phase 1) |
| **Medication Log** | `PreOpMedicationLog` | Admitted, ReadyForSurgery (**hidden until Admitted** — G8) |
| **Nurse Records** | Extract from `WardUpdationModal` | Admitted, ReadyForSurgery (**hidden until Admitted** — G8) |
| **Remark** | Extract from `WardUpdationModal` | Admitted, ReadyForSurgery (**hidden until Admitted** — G8) |

### Phase progress strip (header)

| Chip | Source |
|------|--------|
| P0 Outpatient | `CounsellorOutpatientChecklist` / session |
| P1 Investigations | Form 1 completions |
| P2 Dept Clearance | Pre-op clearance section statuses |
| P3 Ward Safety | Form 2 completions |
| P4 PAC | `pac_assessments.assessment_status` |

---

## 6. Ward Checklist sub-sections

### §0 — P0 Outpatient (read-only)

- Component: `WardExpectedP0Banner` + counsellor progress hook
- No duplicate data entry; link to counselling session when permitted
- Admission warn if P0 incomplete (non-blocking)

### §1 — Investigations & Results

**Canonical source** for all lab/imaging values. Replaces top-level Investigation tab and PAC investigation grid.

#### Per-row fields (UI + API)

| Field | Required | Notes |
|-------|----------|-------|
| `resultValue` | **Yes** | Numeric or text (e.g. `110`, `1.1`, `Non-reactive`) |
| `resultUnit` | No | e.g. `mg/dL`, `g/dL`, `mmHg` — from item config |
| `referenceRange` | No | Display / auto-flag |
| `resultFlag` | No | `Normal` \| `High` \| `Low` \| `Critical` |
| `resultSource` | No | `internal_lab` \| `external_hospital` \| `counsellor` \| `manual_ward` \| `integration` |
| `entryStatus` | System | `draft` \| `entered` \| `verified` |
| `enteredByUserId` / `enteredAt` | System | Audit |
| `verifiedAt` / `verifiedBy` | On verify | Nurse / Jr. doc / counsellor |
| `documentId` | No | Link to `pre_op_documents` |
| `externalReportNote` | No | When upload omitted |
| `isCompleted` | Derived | True when value present (and policy satisfied) |

#### Verification rules

- **Enter:** roles with `ward.investigation.enter` or `ward.checklist.edit`
- **Verify:** roles with `ward.investigation.verify` or `ward.checklist.edit`
- Counsellor-entered values copy as **`draft`**; ward must verify before PAC (warn if critical + unverified at PAC complete)

#### Critical investigation keys (warn at PAC complete if unverified)

`serum_creatinine`, `blood_urea`, `hiv_done`, `hemoglobin` (when added), `ecg_done`, `hba1c_done` — configurable via `pre_op_section_items.item_config`.

#### Catalog deduplication (migration 142)

Deactivate duplicate clearance keys; single row per test in Form 1. Remove Form 1 `dilatation_done`.

#### Workspace v2 additions (signed off 2026-06-26 — Phase 2 migration)

- **Capture-mode model:** each §1 row carries `item_config.captureMode` ∈ {`value`, `result-text`, `value+report`, `report`, `select`, `attestation`, `derived`}. Any "done/available/confirmed" mirror elsewhere **derives** from the §1 row (never re-entered). Full list in [phase 0 mapping §3.1](./ward-preop-redesign-phase0-mapping.md).
- **`blood_group` (new §1 row, Q2):** `captureMode: select`, options from `patient.blood_group` master list, **auto-populated from patient demographics**; ward enters + verifies when null/empty. The Compliance item `blood_group_confirmed` becomes **derived** from it. §1 applicable count 16 → **17**.
- **`bp_checked` (Q1):** becomes **derived** read-only from the latest Vitals BP/HR (Vitals is the single BP writer).
- **`consent_confirmed` (Q3):** removed from §1 UI but **key + data retained** (counsellor copy target); surfaces in §2/④ Consent as a counsellor-draft pre-fill for `surgery_consent_signed`. Do **not** deactivate the catalog row.
- **Imaging report optional:** set `requiresReport=false` for `ascan_done`, `bscan_done`, `xray_ga_cases` — value/finding completes the row.

#### Existing FE/BE (to extend)

- FE: `WardInvestigationChecklist.tsx` → `InvestigationsResultsPanel`
- BE: `WardInvestigationChecklistService.cs`, `WardInvestigationChecklistFunctions.cs`
- Integration: `ChecklistIntegrationService.cs` (LIS/imaging webhooks set value, not auto-verify)

### §2 — Department Clearance

Embed **`DepartmentClearancePanel`** (extracted from `PreOpTab.tsx`).

**Pre-admit availability (R4):** Compliance, Consent, Financial, Documents, Pharmacy Preparation, OT Preparation are editable at **Expected**. **Evaluation** and **Anaesthesia** are **locked until Admitted** (Phase 1 — G2).

**Display status (R5 / G3):** UI computes `SectionDisplayStatus` (Locked, NotStarted, PartiallyComplete, AwaitingDepartment, ReadyToConfirm, ConcernsRaised, OnHold, Rejected, Escalated, Complete) from `PreOpSectionClearance.Status` + item completions — see [ward-journey-user-workflows.md](./ward-journey-user-workflows.md) §4.6.

| Category | Owner dept | Expected | Admitted+ | Section actions |
|----------|------------|----------|-----------|-----------------|
| Compliance | Nursing | Editable | Editable | Confirm / Hold / Reject / Needs info / Escalate |
| Consent | Admin / Counsellor | Editable | Editable | + document upload |
| Evaluation | Doctor | **Locked** | Editable | Jr/Sr ophthalmologist sign-off |
| Financial | Billing | Editable | Editable | Warn-only at admit |
| Anaesthesia (clearance items) | Anaesthesia | **Locked** | Editable | Not full PAC form; `anaesthesia_type_selected`/`fitness_assessed` derive from PAC |
| Pharmacy Preparation | Pharmacy | Editable | Editable | **Activated (migration 93), non-blocking;** `dilation_drops_administered` + `drug_allergy_reconfirmed` derive |
| OT Preparation | OT / Inventory | Editable | Editable | **Activated (migration 93), BLOCKING for Send to OT** (IOL power/stock/barcode, sterilization, slot, supplies) |
| Documents | Various | Editable | Editable | Link to §1 uploads where same file |

**Confirm rule:** mandatory **blocking** items in section must be satisfied; non-mandatory may remain open.

**Removed from §2:** duplicate Lab Tests / Diagnostic Imaging rows (handled in §1).

**Workspace v2 (Q4):** Pharmacy Preparation (6) + OT Preparation (6) are activated from migration 93. **OT Preparation is blocking** for Send to OT; **Pharmacy Preparation is non-blocking**. `blood_group_confirmed` (Compliance) derives from §1 `blood_group`. In the v2 8-step model, Consent/Financial/Compliance/Documents leave §2; the 4 true departmental categories (Evaluation, Anaesthesia, Pharmacy, OT) keep the Request/Respond/Confirm engine. See [phase 0 mapping §4](./ward-preop-redesign-phase0-mapping.md).

**Removed:** embedded Admit form — use `AdmitModal` only.

### §3 — Ward Safety (Form 2)

Existing `WardChecklist.tsx` — 17 items (`WARD_CHECKLIST`).

**Editable** for Expected, Admitted, ReadyForSurgery (fix current `readOnly = state !== Expected` bug).

#### Auto-sync targets

| Event | Form 2 item |
|-------|-------------|
| All applicable §1 rows complete/verified per policy | `investigation_reports_available` |
| A-Scan verified in §1 | `ward_ascan_confirmed` |
| Vitals recorded (tab) | `vitals_checked` |
| PAC completed | `pac_done_documented` (existing backend sync) |
| Dilatation dose in Med Log | suggest `ward_dilatation_done` |
| §2 consent complete | `consent_*` items |
| Mark Ready | optional `informed_surgeon_anaesthesia_ot` |

### §4 — PAC (Form 3)

Component: `PacAssessmentForm.tsx` (trimmed) + `PacInvestigationSummary` (new).

#### Shown (anaesthetist clinical assessment)

- Assessed at, BP, HR, ASA grade, pre-op diagnosis
- Allergies, past anaesthetic history
- Systemic review (CVS, respiratory, renal, hepatic/GI, diabetes, CNS, others)
- **Airway examination (always visible)**
- Anaesthesia plan, consent type, peri-op instructions explained
- Current medications (+ add), pre-op consultations, medications advised, investigations advised (free-text orders only)
- Completed by (designation)
- **Complete PAC Assessment** button

#### Removed

- Investigations input grid (Hb, FBS, creatinine, HIV, ECG, etc.)

#### Added

- Read-only **Investigation summary** from §1 with unverified critical flags
- Pre-fill BP/HR from latest Vitals tab entry
- Lock editing when `clinicalState === Expected`
- Warn-only dialog on complete if critical labs unverified

Backend: `PacAssessmentService.cs` — stop persisting `investigations` JSON on new saves; `GetInvestigationSummaryAsync` for panel.

---

## 7. Dilatation workflow

| Layer | Responsibility |
|-------|----------------|
| **Medication Log** | Timed dose: drug, eye (OD/OS/OU), scheduled/administered time, nurse |
| **Ward Checklist** | `ward_dilatation_done` — clinical confirmation |
| **Not in §1** | No Form 1 dilatation row |

Administering dilatation in Med Log prompts/auto-suggests ticking `ward_dilatation_done`.

---

## 8. Permissions

| Code | Purpose | Typical roles |
|------|---------|-------------|
| `ward.checklist.edit` | Form 2, general ward checklist | Nurse, OT nurse, Admin |
| `ward.investigation.enter` | Enter §1 values | Nurse, Front desk, Doctor, Counsellor |
| `ward.investigation.verify` | Verify §1 rows | Nurse, Doctor, Counsellor |
| `anaesthesia.pac.edit` | §4 PAC form | Anaesthetist, Doctor |
| `counsellor.outpatient_checklist.edit` | P0 + optional counselling values | Counsellor |
| `ip_management.view` | Open workspace | Ward, clinical staff |

Fallback: if explicit investigation permission missing, honor `ward.checklist.edit`.

---

## 9. API contract (frozen for Phase 1–2)

### Extended `WardInvestigationItemDto`

```typescript
interface WardInvestigationItemDto {
  itemId: string;
  itemKey: string;
  itemLabel: string;
  description: string | null;
  displayOrder: number;
  appliesToJourney: boolean;

  // Result
  resultValue: string | null;
  resultUnit: string | null;
  referenceRange: string | null;
  resultFlag: 'Normal' | 'High' | 'Low' | 'Critical' | null;
  resultSource: 'internal_lab' | 'external_hospital' | 'counsellor' | 'manual_ward' | 'integration' | null;
  entryStatus: 'draft' | 'entered' | 'verified';

  // Audit
  enteredByUserId: string | null;
  enteredByName: string | null;
  enteredAt: string | null;
  verifiedByUserId: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;

  // Document
  documentId: string | null;
  documentFileName: string | null;
  documentPreviewUrl: string | null;
  externalReportNote: string | null;

  // Legacy / derived
  isCompleted: boolean;
  isBypassed: boolean;
  notes: string | null;
  completedAt: string | null;
  source: string | null;
  isCritical: boolean;
  counsellorDraft: boolean;
}
```

### New endpoints

| Method | Path | Body |
|--------|------|------|
| `GET` | `/ip-management/journeys/{id}/ward-investigation-checklist` | — (extended DTO) |
| `PUT` | `/ip-management/journeys/{id}/ward-investigation-checklist/completions/{itemId}/result` | `SaveWardInvestigationResultRequest` |
| `POST` | `/ip-management/journeys/{id}/ward-investigation-checklist/completions/{itemId}/verify` | — |
| `POST` | `/ip-management/journeys/{id}/ward-investigation-checklist/completions/{itemId}/document` | `UploadInvestigationDocumentRequest` |
| `GET` | `/ip-management/journeys/{id}/ward-investigation-checklist/completions/{itemId}/document` | — (preview metadata) |
| `GET` | `/ip-management/journeys/{id}/pac-assessment/investigation-summary` | — (for PAC panel) |

### `SaveWardInvestigationResultRequest`

```typescript
{
  resultValue: string;           // required
  resultUnit?: string;
  referenceRange?: string;
  resultFlag?: string;
  resultSource?: string;
  externalReportNote?: string;
  notes?: string;
}
```

Legacy `POST .../completions/{itemId}` (checkbox-only) remains during transition; maps to `isCompleted` when value set.

---

## 10. Database changes (Phase 1 — migration 142)

### `pre_op_completions` new columns

| Column | Type |
|--------|------|
| `result_value` | `VARCHAR(200)` |
| `result_unit` | `VARCHAR(50)` |
| `reference_range` | `VARCHAR(100)` |
| `result_flag` | `VARCHAR(20)` |
| `result_source` | `VARCHAR(30)` |
| `entry_status` | `VARCHAR(20)` DEFAULT `'draft'` |
| `entered_by_user_id` | `UUID` |
| `entered_at` | `TIMESTAMPTZ` |
| `verified_by_user_id` | `UUID` |
| `verified_at` | `TIMESTAMPTZ` |
| `external_report_note` | `TEXT` |

Backfill: `result_value ← value` where legacy `value` column populated.

Ensure `document_id` on `pre_op_completions` (EF model already has `DocumentId`).

### `counsellor_checklist_completions` new columns

| Column | Type |
|--------|------|
| `result_value` | `VARCHAR(200)` |
| `result_unit` | `VARCHAR(50)` |
| `entry_status` | `VARCHAR(20)` DEFAULT `'draft'` |

### `pre_op_section_items`

- Deactivate duplicate keys (see §1 deduplication)
- Optional `item_config JSONB`: `{ valueType, defaultUnit, requiresReport, isCritical }`

### Permissions migration (142 or 143)

- `ward.investigation.enter`
- `ward.investigation.verify`

---

## 11. Component registry

See [patient-ui-component-registry.md](./patient-ui-component-registry.md#ip-ward-pre-op-workspace) for paths and test IDs.

| Component | Status | Purpose |
|-----------|--------|---------|
| `WardPreOpWorkspaceModal` | **Done** | Unified shell |
| `WardChecklistStepper` | **Done** | §0–§4 sub-nav inside Ward Checklist tab |
| `InvestigationsResultsPanel` | **Done** | §1 UI |
| `InvestigationResultRow` | **Done** | Single test row |
| `InvestigationDocumentPreview` | **Done** | Report preview |
| `DepartmentClearancePanel` | **Done** | §2 clearance |
| `PacInvestigationSummary` | **Done** | Read-only labs panel in §4 (`PacAssessmentForm.tsx`) |
| `WardP2DeptClearanceChip` | **Done** | P2 §2 rollup on ward list row (R4.1) |
| `PreOpChecklistModal` | **Removed** (Phase 4) | → `WardPreOpWorkspaceModal` |
| `WardUpdationModal` (standalone) | **Removed** (Phase 4) | → `WardPreOpWorkspaceModal` / `WardPreOpCareTabsPanel` |

### Existing components (reuse)

| Component | Path |
|-----------|------|
| `AdmitModal` | `ward/page.tsx` (extract optional) |
| `WardChecklist` | `components/ip-management/WardChecklist.tsx` |
| `PacAssessmentForm` | `components/ip-management/PacAssessmentForm.tsx` |
| `PreOpMedicationLog` | `components/ip-management/PreOpMedicationLog.tsx` |
| `PreOpTab` | `components/ip-management/PreOpTab.tsx` (source for §2 extraction) |
| `ChecklistPhaseSummary` | `components/ip-management/ChecklistPhaseSummary.tsx` |
| `WardExpectedP0Banner` | `components/ip-management/WardExpectedP0Banner.tsx` |

---

## 12. Gap list vs current codebase (G1–G11)

Supersedes the original build-phase gap list below. Implementation phases: [ward-journey-user-workflows.md](./ward-journey-user-workflows.md) Part VII.

| Gap ID | Signed-off decision | In codebase? | Phase fix |
|--------|---------------------|--------------|-----------|
| **G1** | Cancel today's surgery → revert Expected, release OT, auto-release bed | **Done** | Phase 2 ✓ |
| **G2** | Lock Evaluation + Anaesthesia §2 until Admitted | **Done** | Phase 1 ✓ |
| **G3** | §2 computed display status | **Done** | Phase 1 ✓ |
| **G4** | Gate banner P0–P4 alignment | **Done** | Phase 1 ✓ |
| **G5** | Merged MR: strikethrough + block ward mutations | **Done** | Phase 2 ✓ |
| **G6** | Same-day single-eye duplicate journey block | **Done** | Phase 2 ✓ |
| **G7** | Single-surface UI (no duplicate gates / →OT) | **Done** | Phase 1–4 ✓ |
| **G8** | Hide care tabs until Admitted | **Done** | Phase 1 ✓ |
| **G9** | Counselling → Expected journey (deployment docs) | **Done** | Phase 0 ✓ |
| **G10** | SurgeryCompleted → PostOp handoff on OT page | **Done** | Phase 3 ✓ |
| **G11** | CCMS insurance pre-auth hard block on admit | **Done** | Documented ✓ |

### Duplicate UI flows to eliminate (G7)

| Duplicate | Recommendation |
|-----------|----------------|
| Gate warnings in workspace + AdmitModal + SendToOT | Gates only in transition modals |
| Send to OT footer + row `→OT` | Footer only |
| Editable PreOpTab in Journey Modal | Read-only summary + deep link |
| Form 4 + legacy Nurse/Surgeon post-op tabs | Form 4 primary |

### Original build-phase gaps (historical — largely resolved)

| ID | Gap | Status |
|----|-----|--------|
| (legacy) | PAC editable in Expected | Fixed — PAC locked at Expected |
| (legacy) | Investigation checkbox-only UI | Fixed — value + verify |
| (legacy) | Two separate modals | Fixed — unified workspace |
| (legacy) | E2E smoke tests | Done — `ip-ward-preop-workspace.spec.ts` |

---

## 13. Implementation phases (summary)

**Master roadmap:** [ward-journey-user-workflows.md](./ward-journey-user-workflows.md) Part VII (Phases 0–4).

| Phase | Focus | Key deliverables |
|-------|-------|------------------|
| **0** | Documentation | Workflows doc, spec update, runbook, QA matrix | **In progress** |
| **1** | P0 correctness | G2, G3, G4, G7, G8 — §2 lock, display status, gate alignment, de-dupe UI |
| **2** | P1 workflow | G1, G5, G6 — cancel today, merge guard, scheduling guard |
| **3** | P2 continuity | G7, G10 — journey summaries, post-op shell, OT→ward notification |
| **4** | Hardening | E2E, RBAC audit, legacy cleanup, go-live |

### Historical build phases (pre-unified workspace — complete)

| Phase | Focus | Status |
|-------|-------|--------|
| DB migration 142 | Investigation result columns | Done |
| BE/FE §1 investigations | Value + verify + upload | Done |
| FE shell | `WardPreOpWorkspaceModal` | Done |
| FE §2 | `DepartmentClearancePanel` | Done |
| §4 PAC trim | Investigation summary panel | Done |
| E2E Phase 10 | `ip-ward-preop-workspace.spec.ts` | Done |

**QA per environment:** [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md) (WF-01…WF-10).

---

## 14. E2E scenarios

| # | Flow | Roles |
|---|------|-------|
| 1 | Expected: enter investigation value pre-admit → verify → admit | Nurse |
| 2 | Admitted: vitals → PAC (summary shows labs) → med log dilatation → mark ready | Nurse, Anaesthetist |
| 3 | ReadyForSurgery: pending med dose → send to OT | Nurse |
| 4 | Wrapper: `PreOpChecklistModal` import opens workspace | Regression |
| 5 | Dept Confirm with open non-mandatory items | Billing |
| 6 | PAC complete with unverified critical creatinine → warn confirm | Anaesthetist |

**Spec file:** `e2e/ip-ward-preop-workspace.spec.ts` (Phase 10)

**Existing:** `e2e/ip-checklist-rbac.spec.ts`, `e2e/ip-checklist-closure.spec.ts`

---

## 15. Role quick reference

| Role | Primary workspace areas |
|------|-------------------------|
| **Ward staff / Front desk** | Admit modal, §1 entry, §3 check-in |
| **Ward nurse** | §1 verify, §3, Vitals, Med Log, Nurse Records |
| **Jr. ophthalmologist** | §2 Evaluation, §3 site marking / slit lamp |
| **Sr. ophthalmologist** | §2 Evaluation sign-off, §3 toric marking |
| **Anaesthetist** | §4 PAC (post-admit), §2 Anaesthesia clearance confirm |
| **Billing** | §2 Financial confirm |
| **Lab / Imaging** | §1 via integration webhooks; §2 confirm |
| **Counsellor** | P0; optional §1 draft values at counselling (Phase 9) |

---

## 16. Changelog

| Date | Change |
|------|--------|
| 2026-06-30 | **Phase 15.2 — Admit/rail/readiness declutter.** **(1) No step numbers.** `WardPreOpStepNav` rail rows drop the numeric badge; the step icon now sits inside the colored active/done circle (the `displayNumber` prop is removed). **(2) Override/Bypass off the Admit form.** `AdmitPanel` no longer renders the Override clinical-state / Bypass financial-clearance controls (or their reason field) — that capability lives on the Financial step (`FinancialClearancePanel` pre-auth override + Emergency FC), so the admit payload no longer sends `overrideStateCheck`/`bypassFinancialClearance`/`overrideReason` (still `acknowledgeWarnings: true`). **(3) Leaner readiness verdict.** `PreOpReadinessBar` shows only "X of N steps ready" — the "· M blockers" and "N unlock after admission" suffixes are removed (rail per-step blocker dots remain); the now-unused `clinicalState` prop was dropped. |
| 2026-06-30 | **Phase 15.1 — Admit promoted to its own rail step.** The inline `AdmitPanel` moved out of the Pre-OT Prep step body into a **dedicated "Admit Patient" step on the left rail, directly below Pre-OT Prep**. New `PreOpStepKey 'admit'` with an `expectedOnly` flag (inverse of `hideUntilAdmitted`) so it shows **only while `Expected`** and disappears once admitted; `isStepHidden` updated accordingly. `WardPreOpWorkspaceModal.renderStepBody` renders `AdmitPanel` for `step.admitStep` (and the inline block under `bedside`/`wardSafety` is removed). Readiness adds an explicit `case 'admit'` with `hasCount:false`, so the rail shows it as a 6th un-counted row and the top verdict stays "1 of 5 steps ready". Sequential numbering is automatic (rail uses visible-position `index + 1`). Tests/helpers (`admitViaModal`, G7 spec) now navigate `stepTab('admit')` instead of `stepTab('bedside')`. |
| 2026-06-30 | **Phase 15 — Admit consolidated inline + master-driven dropdowns + warning de-dup.** **(1) No separate AdmitModal.** The standalone `AdmitModal` (and its dead sibling `PreOpAdmitPanel`) are removed; a new `preop/AdmitPanel.tsx` renders **always-expanded at the end of the Pre-OT Prep step**, gated on `clinicalState === 'Expected' && !isMergedReadOnly`. The footer **"Admit Patient"** button and the `onRequestAdmit` prop / `'admit'` modal branch in `ward/page.tsx` are gone; admission is reached by opening Pre-OT Prep, and the submit CTA lives inside the panel. On success it calls `onJourneyUpdated` and jumps to the now-unlocked Vitals/Records step. **(2) Stripped chrome.** Removed from the admit area: the duplicate patient header/status badge, the `WardExpectedP0Banner`, the `WardPreOpGateBanner` warning list, and the `window.confirm()` "Admit anyway?" step. Submit sends `acknowledgeWarnings: true` in one call (gates remain warn-only server-side and are already surfaced by the workspace top bar). Override/Bypass controls are kept (reason still required when checked) but the "(Use with caution)" caption is removed. **(3) Master-driven dropdowns.** Attendant **Relationship** now sources from `useMasterValues('patient.relationship')`. **Admission Type stays the fixed journey enum `DayCare/IPD/Emergency`** — deliberately *not* `ward.admission_type` master, whose codes (`ELECTIVE/EMERGENCY/DAY_CARE/REFERRAL`) are a different taxonomy that would violate the `patient_journey.admission_type` CHECK constraint and break admission. Surgeon/Nurse/Ward/Bed continue to load from their existing DB-backed sources. **(4) Tests.** `admitViaModal` and the G7 spec now drive the inline panel via the Pre-OT Prep step (`stepTab('bedside')` → `admitModal`/`admitSubmit`); no dialog handling. |
| 2026-06-29 | **Phase 14.2 — single loader per step + count shown in one place.** **(1) One spinner.** Steps that stack two self-fetching panels (Pre-OT Prep = `BedsideSafetyPanel` + OT-Preparation `DepartmentClearancePanel`; Fasting = `FastingMedicationPanel` + Pharmacy `DepartmentClearancePanel`) previously showed **two** "Loading…" spinners. Added a `quietLoading` prop to `DepartmentClearancePanel` — when set, the nested instance renders `null` while loading instead of its big centered "Loading Pre-Op Checklist…" block, so the step shows the single primary spinner and the secondary section just pops in. Wired to the OT-Prep (bedside) and Pharmacy (fasting) instances only. **(2) Count in one place (rail only).** The per-step completion count was rendered **twice** — on the step rail chip *and* again in each panel header. Removed the in-panel header count/`ReadinessMeter` from every step panel (`BedsideSafetyPanel`, `FastingMedicationPanel`, `FinancialClearancePanel`, `ConsentAuthorizationPanel`, `InvestigationsResultsPanel`, `ClinicalEvaluationPanel`) — headers now carry only the title (and non-count status like Clinical Evaluation's "Locked until admission" chip; Investigations keeps its "Verify all" action). The canonical count now lives solely on the rail chip + the top `PreOpReadinessBar` verdict. Dropped the now-dead `doneCount`/`done`/`total`/`isResultEntered`/meter locals and unused `ReadinessMeter` imports. |
| 2026-06-29 | **Phase 14.1 — navigation no longer refreshes the shell + sequential numbering + rail polish.** **(1) Refresh only the right pane on step click.** Removed `refreshKey: activeStep` from `usePreOpReadiness` so clicking a rail step no longer re-fires the 4 rollup fetches or churns the readiness bar/rail — only the right-hand panel (re)loads its own data. To keep counts fresh when data *actually* changes, every editable step panel now accepts an `onChanged` callback wired to `reloadReadiness()`: `InvestigationsResultsPanel`, `PacAssessmentForm`, `ClinicalEvaluationPanel`, `ConsentAuthorizationPanel`, `FinancialClearancePanel`, `FastingMedicationPanel`, `BedsideSafetyPanel`, and `DepartmentClearancePanel` (the latter fires only on a post-load mutation via a `hasLoadedRef` guard, never on its initial mount). **(2) Sequential step numbers.** The rail badge now shows the step's **visible position** (`index + 1`) instead of the absolute `step.index`, so a hidden step (e.g. pre-admit Evaluation/Anaesthesia/Records) no longer leaves gaps like 1, 4, 5 — Expected now reads 1…5 contiguously. **(3) Label overlap fix.** The step label is now `min-w-0 flex-1 truncate` and the count token `shrink-0 lg:ml-auto`, so long labels truncate cleanly instead of overlapping the count chip in the narrow `lg:w-60` rail. |
| 2026-06-29 | **Phase 14 — two-pane workspace layout (no horizontal scroll) + status de-dup.** Replaced the top horizontal scrolling step tab strip with a **vertical step rail** (`WardPreOpStepNav` is now an `aria-orientation="vertical"` tablist with Up/Down roving focus; full-width rows). The modal body is now a **two-pane layout**: the readiness bar stays full-width on top, a left `aside` holds the vertical rail (`lg:w-60`, own scroll), and the active step panel fills the right (own scroll); below `lg` the rail stacks above the content (still no right-scroll). Modal widened `max-w-4xl → max-w-5xl` for the second column. **De-dup**: each rail row now shows **one** status token — a colored count chip (grey = in progress, green = complete) with a small red **blocker dot** — removing the redundant `StatusChip` "In progress"/"Not started" text that previously sat beside the same count + a separate blocker number badge. Test IDs (`stepNav`/`stepTab`/`stepTabCount`) unchanged. (Container-agnostic so it lifts directly into the recommended full-page `journey/[id]` route as a follow-up.) |
| 2026-06-29 | Step ⑧ **Vitals & Records hidden pre-admit.** Added `hideUntilAdmitted: true` to the `records` step (it was already `admissionGated`), so the Expected rail no longer shows a dead-end locked "Vitals, medication log and nurse records open once the patient is admitted" tab — the step now reappears at Admitted, matching Evaluation ②/Anaesthesia ③. The "N unlock after admission" hint (counts `admissionGated` steps) stays at 3 and now summarises all three hidden steps; "0 of 5 steps ready" is unchanged (Records has `hasCount:false`); existing deep-link/active-step fallbacks already route a pre-admit `records` target to Investigations. |
| 2026-06-29 | Step ⑦ **Option B — Bedside Safety → "Pre-OT Nursing Preparation"** (de-duplication). Research showed 11 of 17 bedside rows were pure mirrors of their source steps (Investigations/Consent/PAC/Vitals/Financial) **and** of the OT `SurgicalSafetyChecklist` "Before Anaesthesia" fields (`IdentityConfirmed/EyeRe-Le/AscanVerified/AllergyKnown/ConsentFormChecked/FitnessConfirmed`) — triple duplication, with the admission gate even warning **P1 *and* P3** for the same facts. **FE (`BedsideSafetyPanel`)**: removed the entire *Sign-in* + *Readiness* derived-mirror groups (and the `DerivedTick`/`onNavigateStep` plumbing); the step now renders **only the true nurse bedside acts** (check-in, pre-op meds, dilatation, slit-lamp, toric/ICL marking, informed-OT, contact-lens, valuables), still locked until admission with attribution. Heading → "Pre-OT Nursing Preparation"; step rail label → "Pre-OT Prep" / "Prep". New shared `lib/ip-management/bedside-items.ts` is the single source for the nurse-act key set, consumed by both the panel and the readiness rollup. **Count**: `computePreOpReadiness` `case 'bedside'` now counts the nurse-act subset (ward keys + re-homed completions, surgery-type filtered) + OT Preparation — no longer the full 17-item ward total. **Gate (BE `ChecklistGateService`)**: the **P3 Ward Safety warning at Expected→Admitted is removed** — those acts are post-admission and the mirror facts are already covered by the P1/P2/PAC warnings (nurse prep is verified by the Send-to-OT med-log gate + OT Surgical Safety Checklist). The mirror catalog rows are intentionally **left active** (still consumed by `FinancialClearancePanel` + ward-integration hints); they are simply no longer surfaced or counted on the bedside step. Removed now-unused test IDs `bedsideSignInGroup`/`bedsideReadinessGroup`; e2e updated to assert the mirrors are absent (`derivedTick('patient_identity_confirmed')` count 0) while nurse rows remain. |
| 2026-06-29 | Step ⑦ Bedside Safety redesign (declutter + Expected gating + governance). **FE (`BedsideSafetyPanel`)**: renamed the panel heading **"Bedside Safety (WHO sign-in)" → "Ward Pre-Op Safety"** (reserves "WHO" for the OT `SurgicalSafetyChecklist`, removing the split-brain). Stripped clutter — deleted the "Most rows are auto-verified…" info paragraph, the decorative `ShieldCheck`/`Info`/`ClipboardCheck`/`Sparkles` icons, the per-derived-row prose "pending" hints (the `↗` deep-link already routes there), and the "(auto-verified)/(auto-tracked)" group-header suffixes (each row already carries the "Auto-tracked" tag) → group headers are now just *Sign-in* / *Readiness* / *Bedside preparation*. **De-duped**: removed the two summary cards ("Billing status" duplicated the `bill_payment_confirmed` row; "Check-in / OT informed" duplicated the `ward_check_in_time` + `informed_surgeon_anaesthesia_ot` nurse rows). The header `ReadinessMeter` is now fed by the **canonical `usePreOpReadiness` rollup** (`stepReadiness` prop) so the panel and step rail show one number. **Expected gating (compliance)**: nurse bedside acts are **locked until admission** (`clinicalState` prop → `bedsideActsLocked`) — previously editable pre-admit; a "Bedside preparation unlocks once the patient is admitted" notice renders in Expected. **Attribution** (role · timestamp) shown on completed nurse rows from existing `completedAt`/`completedByRole`. **Surgery-type scoping**: the panel hides rows where `appliesToJourney === false`. The OT Preparation `DepartmentClearancePanel` on this step now renders with `hideSummary flat` (hides the "Department clearance: X/X items" banner, the "Lab and imaging results…" helper, and the "Clinical Evaluation and Anaesthesia… unlock after admission" notice). **BE**: `WardChecklistItemDto` gains `AppliesToJourney`; `WardChecklistService` computes it via `ItemAppliesToJourney` (matches `surgery_type_filter` tokens against `patient_journey.procedure_name`, mirroring `WardInvestigationChecklistService`) and **excludes out-of-scope rows from the readiness total/completed**. Migration **147** sets `surgery_type_filter = 'Cataract,Phaco,SICS,IOL,ICL,Lens,Refractive Lens'` on `toric_iol_icl_marking` so toric/ICL marking no longer shows (or counts) on LASIK cases. New test ID `bedsideActsLocked`. |
| 2026-06-29 | Step ⑥ Fasting & Medication declutter (follow-up). Removed the allergy banner entirely from the step (`AllergyBanner` deleted — it had no other consumer; the `onNavigatePac` prop + `allergyBanner` test ID dropped). Removed the "Last-intake time looks implausible (over 24h)" paragraph (the "Verify intake time" status chip is kept as the stale signal). The Pharmacy Preparation `DepartmentClearancePanel` on this step now renders with `hideSummary flat` — hiding the "Department clearance: X/X items" banner + status chip, the "Lab and imaging results are captured in §1…" helper, and the "Clinical Evaluation and Anaesthesia Clearance unlock after admission…" notice (mirrors `ClinicalEvaluationPanel`). |
| 2026-06-29 | Step ⑥ Fasting & Medication redesign (clutter-strip + safety + compliance). **FE (`FastingMedicationPanel`)**: removed static item descriptions, the header info paragraph, and decorative per-row icons (checkbox + label + status only); the "Fasting confirmed" status now renders **once** in the NPO card (duplicate Auto-tracked tick removed; the redundant `allergy_communicated` tick removed — Auto-tracked now only carries cross-step `blood_group_confirmed`). New **stale/breach** state: an implausible last-intake time (> 24h) shows a "Verify intake time" chip and never reads green. **Intake-type selector** (clear 2h / light 6h / solid 8h) drives ASA-tiered thresholds. The header readiness meter is fed by the **canonical `usePreOpReadiness` rollup** (`stepReadiness` prop) so the panel and step rail show one number. Per-action **error banner + optimistic revert** on save failure; **attribution** (role · timestamp) shown on the NPO card and medication rows. **Medication rows are conditional** on PAC (insulin/OHA shown for diabetics, anticoagulants for blood-thinner meds; always shown if already recorded, mandatory, or PAC not yet loaded). **BE (`PreOpClearanceService`)**: NPO time persists into **typed columns** (`result_value`/`result_unit`/`entry_status`/`entered_*`) instead of free-text `notes`; the server now **derives `fasting_hours` + `fasting_confirmed`** authoritatively on every `last_food_time` save (≥ threshold and ≤ 24h), replacing the old client-side cascade. `PreOpCompletionDto`/`SavePreOpCompletionRequest` extended with `resultValue`/`resultUnit`/`entryStatus`/`enteredAt`/`completedByRole`; save endpoint captures `PrimaryRole`. New test IDs (`fastingIntakeType`, `fastingError`) + e2e helper `setNpoIntakeType`. |
| 2026-06-26 | Workspace v2 Phase 13 — Readiness rollup & role-adaptive entry (closes blueprint §5/§18/§20). **Single rollup** `lib/ip-management/preop-readiness.ts` (`computePreOpReadiness`, pure) + `hooks/use-preop-readiness.ts` derive per-step `{completed, total, blocking, status, locked, hasCount}` from the canonical sources (PreOp clearance completions, ward investigation checklist, ward safety checklist, PAC) in **one load** — replacing the legacy 5-card phase strip's parallel fetches; designed to be swapped for a backend `preop-readiness` endpoint later without UI changes. **Sticky readiness bar** `components/ip-management/preop/PreOpReadinessBar.tsx` renders the top "X of N steps ready · M blockers" verdict + `ReadinessMeter`; the next-transition `WardPreOpGateChip` **moves from the footer to this top bar** (single "can we operate?" verdict). **Per-step rail counts**: `WardPreOpStepNav` now takes `readiness` (was `stepStatuses`) and shows an inline `X/Y` count chip, a red blocker badge, and the unified `StatusChip` per unlocked step (locked steps keep the lock glyph). **Role-adaptive default step** `defaultStepForRole` (preop-steps) opens the workspace on the logged-in role's step — anaesthetist → ④ PAC, billing → ⑤ Financial, OT → ⑦ Bedside, else ① Investigations — applied once after the user's department resolves and only when there is no explicit deep-link; never opens an admission-locked step pre-admit. **Header context line** adds payer (`paymentMode`/`financialState`), outstanding balance, and an "Outpatient summary ✓" marker (when a counselling session exists). The bar refreshes on step change so cross-step saves roll up. New test IDs (`readinessBar`/`readinessSummary`/`stepTabCount`) + Phase-13 spec test (bar verdict + investigations count chip). |
| 2026-06-26 | Workspace v2 Phase 12 — Accessibility, performance, hardening & rollout (final). **A11y (WCAG 2.2 AA)**: `WardPreOpWorkspaceModal` is now a proper `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (title `useId`); focus is trapped and restored via the shared `useFocusTrap` hook; **Escape closes**; the close control has `aria-label="Close workspace"` with a ≥32px hit area + `focus-visible` ring; global `@media (prefers-reduced-motion: reduce)` added to `globals.css` (near-instant transitions/animations). `DerivedTick` already carries `aria-disabled` + `sr-only` status text. **Performance**: lazy step mounting confirmed (only the active step renders; no manual Refresh button); `DerivedTick` wrapped in `React.memo`; reads remain a single rollup on open with optimistic refetch. **Additional rec built**: a **Print pre-op summary** deep-link (`printSummary` test ID) opens `patients/[id]/summary/print` in a new tab. **Legacy cleanup**: `ChecklistPhaseSummary` / `WardChecklistStepper` were evaluated for removal but are **retained** — they still power the read-only Journey surface (`JourneyPreOpSummary` and the `WardChecklistSection` type), so deleting them would break the Journey modal. New test ID (`printSummary`) + Phase-12 a11y/focus spec test (dialog role, aria-modal, print href, Escape closes). Deferred backlog (telemetry, audit-timeline panel, offline/queued auto-save, configurable criticality via `item_config`) documented in `ward-ip-journey-deployment-runbook.md` as backend-dependent follow-ups. |
| 2026-06-26 | Workspace v2 Phase 11 — §2 Department Clearance final narrowing. The clearance engine now renders **only the 4 real departmental sign-offs** — Clinical Evaluation, Anaesthesia, Pharmacy Preparation, OT Preparation — by adding `Consent`/`Financial`/`Compliance`/`Documents` to `DEPARTMENT_CLEARANCE_EXCLUDED_CATEGORIES` (those are owned by Phases 5–7 panels) and exporting the canonical `DEPARTMENT_CLEARANCE_REAL_CATEGORIES`; this also drops them from `computeDeptClearanceProgress`. **Single status vocabulary**: the header `sectionDisplayStatus` chip and the per-section dept-action pill both render the Phase-1 `StatusChip` (`statusFromDisplayStatus` / `statusFromSectionStatus`) — the legacy `SECTION_DISPLAY_STATUS_*` / `SECTION_STATUS_*` label+color maps are no longer used in the panel (Locked keeps the "Locked until admission" label override so G2 holds). **Collapsed by default**: sections start collapsed and auto-expand only the logged-in user's department (merged with the single-category step default so the only visible section is never collapsed). **Locked item lists hidden**: an admission-locked category (Evaluation/Anaesthesia pre-admit) shows only a "Locked until admission — clearance items appear after admission" notice instead of its checklist. **Signature + timestamp** line per approval: `responded`/`confirmed` timestamps (and external responder name) render under each section header via `sectionSignoff(<cat>)`. New test ID (`sectionSignoff`) + Phase-11 spec test (locked list hidden + unified chip). |
| 2026-06-26 | Workspace v2 Phase 10 — Step ⑦ Bedside Safety (WHO-style, derived). New `components/ip-management/preop/BedsideSafetyPanel.tsx` replaces `WardChecklist` at step ⑦. §3 **mirror rows are now read-only `DerivedTick`s** grouped WHO-style — *Sign-in* (identity, site, 3× consent, allergies) and *Clinical & financial readiness* (reports, A-scan, vitals, PAC, billing) — each with a deep-link to its single writer (Consent/Investigations/PAC/Vitals/Financial) and auto-updating from the backend sync. Only **true nurse bedside acts stay editable** (`ward_check_in_time`, `preop_medication_given`, `ward_dilatation_done`, `preop_slit_lamp_done`, `toric_iol_icl_marking`, `informed_surgeon_anaesthesia_ot`) plus the re-homed-from-Consent `contact_lens_removed` / `valuables_removed` (loaded from pre-op completions), with Med-Log suggestion hints preserved. The **inverted editability bug is fixed**: derived rows can no longer be manually toggled (eliminating duplicate data entry); nurse rows honor `readOnly`. Billing/check-in summary + `ReadinessMeter` retained; root keeps `sectionWardSafety` test ID. New test IDs (`bedsidePanel`/`bedsideSignInGroup`/`bedsideReadinessGroup`/`bedsideNurseGroup`/`bedsideNurseToggle`) + Phase-10 spec test. |
| 2026-06-26 | Workspace v2 Phase 9 — Step ③ Anaesthesia / PAC redesign. `PacInvestigationSummary` gains an **"Edit in Investigations"** deep-link (`onEditInInvestigations`) — labs stay read-only here and are edited only in §1 (D7). `PacAssessmentForm` adds a **read-only Vitals reference** from the single Step ⑧ source (latest BP/HR/SpO₂/Temp) with an inline **"Record vitals"** that writes back via `addPreOpVital` and then syncs the PAC snapshot (D10), plus an **"Open Vitals"** deep-link; airway exam stays always-shown; ASA/plan/consent-type/notes/"Fit for anaesthesia" remain PAC-owned. A note states that **Complete PAC auto-confirms §2 Anaesthesia + the §3 "PAC done" tick** (server sync already wired); warn-only on unverified critical labs is preserved. Modal passes the two deep-link callbacks (→ Investigations / → Records). New test IDs (`pacInvestigationEditLink`/`pacVitalsReference`/`pacVitalsRecordToggle`/`pacVitalsRecordSave`/`pacVitalsOpenLink`/`pacAutoSatisfyNote`) + Phase-9 spec test. |
| 2026-06-26 | Workspace v2 Phase 8 — Step ② Clinical Evaluation + Step ⑧ Vitals & Records. New `components/ip-management/preop/ClinicalEvaluationPanel.tsx` routes step ②: a **doctor sign-off summary** surfaces the signature + timestamp (`doctor_evaluation_signed.completedAt` → "Electronically signed · <ts>") and risk classification, plus a `ReadinessMeter` over the 6 Evaluation writers (`doctor_evaluation_completed`, `doctor_evaluation_signed`, `risk_classification`, `comorbidities_reviewed`, `surgical_plan_confirmed`, `patient_counselled`). Because Evaluation stays a **real departmental category**, the `DepartmentClearancePanel` (Request/Respond/Confirm/Hold/Reject + admission lock + `sectionDisplayStatus('Evaluation')`) is rendered beneath the summary — the §2 engine and G2 lock are preserved. Step ⑧ **Vitals & Records** was already folded into one care step (Vitals/Med Log/Nurse/Remark sub-tabs via `WardPreOpCareTabsPanel`) in Phase 3 and remains the single Vitals writer that PAC + §3 reference (server `SyncVitalsCheckedAsync` already wired). New test IDs (`clinicalEvalPanel`/`clinicalEvalSignoff`) + Phase-8 spec test. |
| 2026-06-26 | Workspace v2 Phase 7 — Step ⑥ Fasting & Medication plan. New `components/ip-management/preop/FastingMedicationPanel.tsx` owns the §2 `Compliance` category (`Compliance` dropped from the step; `Pharmacy Preparation` stays a real departmental category rendered alongside). **NPO widget**: one `last_food_time` datetime input auto-computes the fasting **duration** and, on blur, drives `fasting_hours` + `fasting_confirmed` (confirmed when ≥ 6 h; flags &lt; 6 h as critical) — "one input → three" (D5). Medication writers `anticoagulants_held` / `insulin_dose_managed` / `medication_adherence` are toggles. New reusable presentational `preop/AllergyBanner.tsx` surfaces the single PAC allergy fact (Known allergies / NKDA / not-yet-documented) with a PAC deep-link; `allergy_communicated`, `fasting_confirmed`, `blood_group_confirmed` render as read-only `DerivedTick`s. New test IDs (`fastingPanel`/`fastingNpoInput`/`fastingDuration`/`fastingConfirmedChip`/`fastingToggle`/`fastingItem`/`fastingDerivedGroup`/`allergyBanner`); e2e helper `enterNpoTime` + Phase-7 spec test. |
| 2026-06-26 | Workspace v2 Phase 6 — Step ⑤ Financial Clearance single source. New `components/ip-management/preop/FinancialClearancePanel.tsx` replaces the generic `DepartmentClearancePanel` for the `Financial` category (`clearanceCategories` dropped from the financial step; modal routes step ⑤ to the new panel). A read-only **single-source summary** (payment mode · package · paid · **outstanding balance**, from `journey.financialState`/`balanceDue`/`packageAmount`/`totalPaid`/`isEmergencyFc`) is shown once; the bedside `bill_payment_confirmed` tick renders as a read-only `DerivedTick` reading the same balance. Writers (`payment_mode_confirmed`, `advance_paid`, `insurance_preauth_approved`, `emergency_fc_confirmed`, payer-specific `*_uploaded`) persist via existing `savePreOpCompletion`/`uploadPreOpDocument`. The **CCMS pre-auth hard block (G11)** is surfaced as a dedicated callout (approved → green; not approved → red "blocked until approved, enforced at Admit"); enforcement stays backend/admit-only. New test IDs (`financialPanel`/`financialSummary`/`financialBalance`/`financialPreauthCallout`/`financialItem`/`financialToggle`/`financialUpload`/`financialDerivedGroup`); e2e helper `confirmFinancialItem` + Phase-6 spec test. |
| 2026-06-26 | Workspace v2 Phase 5 — Step ④ Consent & Authorization merge. New `components/ip-management/preop/ConsentAuthorizationPanel.tsx` is the **single medico-legal consent writer**, replacing the generic `DepartmentClearancePanel` for the `Consent` category (`clearanceCategories` dropped from the consent step; modal routes step ④ to the new panel). One panel captures **identity verified**, **surgery site marked** (operative eye + marked-by), **surgical consent signed** (signed PDF upload+preview on the fact — no separate Documents tab), **anaesthesia consent** (unifies PAC consent type), **hospital-policy** and **blood-transfusion** consent — each via existing `savePreOpCompletion` / `uploadPreOpDocument`. The §3 bedside ticks (`patient_identity_confirmed`, `operation_site_marked`, `consent_patient/witness/surgeon_signed`) render as read-only `DerivedTick`s auto-satisfied from these writers; counsellor-recorded consent shows as a pre-fill hint. Contact-lens/valuables prep no longer surface under Consent (re-homed to ⑦ in Phase 2 catalog). New test IDs (`consentPanel`/`consentItem`/`consentToggle`/`consentUpload`/`consentDerivedGroup`); e2e helper `confirmConsentItem` + Phase-5 spec test. |
| 2026-06-26 | Workspace v2 Phase 4 — Step ① Investigations module redesign. Rows now **collapse by default** (Name · Result+Unit · flag · StatusChip · ⋯) and expand to edit; **auto-save on blur** via shared `DataField` (per-row Save button removed); one per-row `ActionMenu` (Verify / Upload / External / View doc). New frontend `investigation-catalog.ts` adds clinical **grouping** (Haematology/Biochemistry/Serology/Imaging/Cardiac/Ophthalmic) with sticky headers, **capture modes** (numeric/select/value+report/derived), auto-populated **unit + reference range**, and **H/L/N flag → chip**. `bp_checked` renders read-only (reflects Vitals); `blood_group` + serology render as selects; re-homed `consent_confirmed` hidden. Header gains `ReadinessMeter` + **bulk "Verify all entered"**; static helper paragraph → info tooltip. e2e helper updated (expand → DataField blur; Verify via ActionMenu). |
| 2026-06-26 | Workspace v2 Phase 3 — information architecture & navigation. New 8-step model `lib/ip-management/preop-steps.ts` + `WardPreOpStepNav` (accessible tablist) **replace** the phase strip (`ChecklistPhaseSummary`), the nested "Ward Checklist" sub-tabs (`WardChecklistStepper`), and the care top-tabs. **P0 Outpatient tab removed**; **Pre-Op Phase Progress cards removed**. §2 re-sliced by category across steps ②–⑦ via new `DepartmentClearancePanel` `categoryFilter` prop (additive). Legacy deep-links mapped via `legacyToStep`. e2e helper/spec updated (`navigateStep`, `openCareRecords`, step-nav test IDs). Panel internals unchanged (Phases 4–9) |
| 2026-06-26 | Workspace v2 Phase 2 — catalog dedupe migration `144_ward_preop_v2_catalog_dedupe.sql`: add `blood_group` §1 writer; tag §1 rows with `item_config.captureMode` (imaging report optional); flag `bp_checked` + §2/§3 duplicates as DERIVE (`item_config.derivedFrom`+`nonEditable`); re-home `consent_confirmed` (`uiStep=consent`, key/data kept) and bedside prep (`uiStep=bedside`); deactivate Documents category; activate Pharmacy (non-blocking) + OT Preparation (blocking). Catalog-only — auto-tick wiring is Phase 8 |
| 2026-06-26 | Workspace v2 Phase 1 — design system + shared primitives (additive, not yet wired): unified status vocabulary `lib/ip-management/preop-status.ts` (`PreOpStatus` + tokens + mappers from `entryStatus` / section-status / display-status / progress); primitives `components/ip-management/preop/primitives/*` — `StatusChip`, `ActionMenu`, `DataField`, `DerivedTick`, `ReadinessMeter`, `ChecklistRow`; v2 test IDs `WARD_PREOP_V2_TEST_IDS`. A11y baked in (icon+text+color, ≥44px disclosure targets, label association, keyboard menu) |
| 2026-06-26 | Workspace v2 Phase 0 — item-by-item single-writer mapping signed off (Q1–Q4): `blood_group` new §1 select row (auto-populate); `bp_checked` derived from Vitals; `consent_confirmed` retired from §1 (key retained); imaging report optional; Pharmacy/OT Prep activated (OT blocking). See [ward-preop-redesign-phase0-mapping.md](./ward-preop-redesign-phase0-mapping.md) |
| 2026-06-25 | Phase R4 — P2 row chip (`WardP2DeptClearanceChip`); `sectionDisplayStatus` on clearance section DTO |
| 2026-06-25 | Phase R3 — `PacInvestigationSummary` marked Done; component registry title updated |
| 2026-06-18 | Phase 0 — initial spec from ward/OT workflow analysis |
| 2026-06-18 | Phase 10 — `e2e/ip-ward-preop-workspace.spec.ts` smoke + gated full flows |
| 2026-06-18 | Phase 11 — deprecation notices on legacy modal components |
| 2026-06-24 | Phase 0.2 — R1–R12, G1–G11 gap list, cancel edges, §2 lock/display status, links to workflows/runbook/QA matrix |
