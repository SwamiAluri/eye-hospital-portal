# Ward Pre-Op Workspace Redesign — Phase 0 Item-by-Item Mapping

**Deliverable for:** Re-engineering Blueprint → Phase-Wise Plan → **Phase 0** (audit lock-in).
**Consumed by:** Phase 2 (catalog dedupe migration + derived-tick layer), Phases 4–11 (panel refactors).
**Status:** Signed off (Q1–Q4 resolved 2026-06-26). Ready to drive the Phase 2 migration. No code/schema changed by this document.

**Related:** [ward-preop-workspace-spec.md](./ward-preop-workspace-spec.md), [ward-journey-user-workflows.md](./ward-journey-user-workflows.md), [checklist-registry-mapping.md](./checklist-registry-mapping.md).

---

## 1. Purpose

Freeze the **single-writer decision for every existing checklist item** before any code changes, so the dedupe and derived-tick work in later phases is mechanical and auditable. Every item key currently rendered in the workspace is classified, and every duplicate fact is resolved to exactly one writer.

Ground truth sources (exact keys):
- `§1` Investigations — `WARD_INVESTIGATION_PREOP` (seed migration 142 + base set)
- `§2` Department Clearance — `pre_op_section_items` categories (seed migration 92)
- `§3` Ward Safety — `WARD_CHECKLIST` (seed migration 135)
- `§4` PAC — `pac_assessments` entity
- Auto-sync already in place — `WardChecklistAutoSyncService.cs`

---

## 2. Legend

| Disposition | Meaning |
|-------------|---------|
| **WRITER** | Canonical, editable source of this fact. Lives in exactly one step. |
| **DERIVE** | Becomes a read-only reflection auto-satisfied from a WRITER (via auto-sync / rollup). Never independently editable. |
| **DELETE** | Catalog row deactivated (`status='inactive', is_active=false`); fact captured by a WRITER elsewhere. |
| **MOVE** | Kept as a writer but relocated to a more correct step. |
| **KEEP** | Already correct; no change. |

New 8-step model (target home for every writer):
`① Investigations · ② Clinical Evaluation · ③ Anaesthesia/PAC · ④ Consent & Authorization · ⑤ Financial · ⑥ Fasting & Medication · ⑦ Bedside Safety · ⑧ Vitals & Records`

---

## 3. §1 Investigations (`WARD_INVESTIGATION_PREOP`) — 17 applicable rows

The canonical lab/imaging/result source. **Disposition: KEEP as WRITER in Step ①** unless noted. No duplicates removed here; every mirror elsewhere derives from these.

| item_key | Label | Critical | Capture mode | Default unit | Target step |
|----------|-------|:--------:|--------------|--------------|-------------|
| `blood_sugar` | Blood Sugar | – | `value` | mg/dL | ① WRITER |
| `bp_checked` | Blood Pressure | – | `derived` | mmHg | **DERIVE** from ⑧ Vitals (Q1 resolved)¹ |
| `hiv_done` | HIV | ✓ | `result-text` | – | ① WRITER |
| `blood_urea` | Blood Urea | ✓ | `value` | – | ① WRITER |
| `serum_creatinine` | Serum Creatinine | ✓ | `value` | – | ① WRITER |
| `hba1c_done` | HbA1C | ✓ | `value` | – | ① WRITER |
| `blood_group` | Blood Group | – | `select` | – | ① WRITER (new — Q2 resolved)³ |
| `ascan_done` | A-Scan | – | `value+report` | mm | ① WRITER |
| `bscan_done` | B-Scan | – | `value+report` | mm | ① WRITER |
| `physician_fitness` | Physician Fitness | – | `attestation` | – | ① WRITER |
| `duct_assessed` | Duct Assessment | – | `attestation` | – | ① WRITER |
| `consent_confirmed` | Consent Confirmed | – | – | – | **RETIRE from ① + MOVE → ④** (Q3 resolved)² |
| `hemoglobin` | Hb / Hemoglobin | ✓ | `value` | g/dL | ① WRITER |
| `ecg_done` | ECG | ✓ | `value+report` | – | ① WRITER |
| `pt_inr` | PT / INR | – | `value` | – | ① WRITER |
| `hbsag_done` | HBsAg | ✓ | `result-text` | – | ① WRITER |
| `hcv_done` | HCV | ✓ | `result-text` | – | ① WRITER |
| `xray_ga_cases` | X-Ray (GA only) | – | `report` | – | ① WRITER (conditional on GA) |

¹ **Q1 resolved:** Vitals (⑧ `bp_recorded` / `pulse_recorded`) is the single BP/HR writer; `§1 bp_checked` becomes a **DERIVE** reflection of the latest Vitals systolic/diastolic (read-only in ①). Phase 8 wires the auto-sync; Phase 4 renders `bp_checked` read-only.

² **Q3 resolved:** `consent_confirmed` is **not** a §1 investigation (mis-categorized) and is removed from the Investigations UI. **The key persists** because the counsellor→ward semantic copy writes to it (`outpatient_informed_consent → [consent_patient_signed, consent_confirmed]`, see `CounsellorChecklistService.OutpatientToWardItemKeys`). In the new model it surfaces in **④ Consent & Authorization** as a counsellor-sourced **draft signal** that pre-fills `surgery_consent_signed` (the canonical consent writer). No data path is broken; only its UI home changes.

³ **Q2 resolved:** `blood_group` is a **new §1 row** (`captureMode: select`, options from the `patient.blood_group` master list). It **auto-populates from patient demographics** (`patient.blood_group`); when demographics are null/empty the ward may enter and verify it. The old Compliance item `blood_group_confirmed` flips to **DERIVE** from this row (see §4a).

### 3.1 Capture-mode model (general rule)

Every investigation/image/scan has **one capture home in §1** with an `item_config.captureMode`; any "done / available / confirmed" item elsewhere is a **DERIVE** of that §1 result — never a second entry.

| captureMode | Meaning | Report upload |
|-------------|---------|---------------|
| `value` | Numeric/text data entry (e.g. `110`, `1.1`) | optional |
| `result-text` | Qualitative result (Reactive / Non-reactive) | optional |
| `value+report` | Value/finding **plus** report attachment | **optional** (Q-imaging resolved — value/finding completes the row) |
| `report` | Upload-driven; finding optional | report is the result |
| `select` | Pick from a master list (e.g. blood group ABO/Rh) | optional |
| `attestation` | Clinician confirms with note (no numeric value) | optional |
| `derived` | Read-only reflection of another writer (e.g. `bp_checked`←Vitals) | n/a |

**Imaging/cardiac decision:** for `ascan_done`, `bscan_done`, `ecg_done`, `xray_ga_cases` the **report upload is optional** — the value/finding completes the row (consistent with the workspace spec). Note: migration 142 currently sets `requiresReport=true` for `ascan_done`/`bscan_done`/`xray_ga_cases`; Phase 2 migration must set `requiresReport=false` to match this decision.

Critical keys (warn-only at PAC) per `InvestigationItemConfigHelper`: `serum_creatinine, blood_urea, hiv_done, hemoglobin, ecg_done, hba1c_done, hbsag_done, hcv_done`.

---

## 4. §2 Department Clearance (seed 92) — 35 rows across 6 live categories

> Note: the `Investigations` and `Vitals` clearance categories were already deactivated in migration 142 (`blood_sugar_fbs`, `blood_sugar_rbs`, `biometry_done`, `hemoglobin`, `ecg_done`, `pt_inr`, `bp_checked` clearance rows) and are excluded by `DEPARTMENT_CLEARANCE_EXCLUDED_CATEGORIES`. `Pharmacy Preparation` (6) and `OT Preparation` (6) **are seeded in migration 93 but are inactive/unapplied in the current environment** — the live `§2` shows **35** items (the 6 categories below). Q4 activates the migration-93 Pharmacy/OT sets — see §4g / §4h.

### 4a. Compliance (8) → split between ⑥ Fasting & Medication and ⑦/banner

| item_key | Label | Disposition | Target / source |
|----------|-------|-------------|-----------------|
| `last_food_time` | Last Food/Drink Time | **WRITER** | ⑥ — NPO widget (drives the other two) |
| `fasting_hours` | Fasting Duration (hours) | **DERIVE** | ⑥ — auto-computed from `last_food_time` |
| `fasting_confirmed` | Fasting Confirmed | **DERIVE** | ⑥ — auto-set when NPO widget confirmed (D5) |
| `medication_adherence` | Medication Adherence | **MOVE → ⑥** | Fasting & Medication |
| `insulin_dose_managed` | Insulin Dose Managed | **MOVE → ⑥** | Fasting & Medication |
| `anticoagulants_held` | Anticoagulants Held | **MOVE → ⑥** | Fasting & Medication |
| `allergy_communicated` | Allergies Communicated | **DERIVE** | from allergy WRITER (PAC/clinical) → banner (D6) |
| `blood_group_confirmed` | Blood Group Confirmed | **DERIVE** | from `§1 blood_group` result (Q2 resolved) |

### 4b. Evaluation (6) → ② Clinical Evaluation (KEEP writers, post-admit)

| item_key | Label | Disposition |
|----------|-------|-------------|
| `doctor_evaluation_completed` | Clinical Evaluation Completed | **KEEP** WRITER ② |
| `doctor_evaluation_signed` | Doctor Evaluation Signed Off | **KEEP** WRITER ② (signature+timestamp) |
| `risk_classification` | Risk Classification | **KEEP** WRITER ② |
| `comorbidities_reviewed` | Comorbidities Reviewed | **KEEP** WRITER ② |
| `surgical_plan_confirmed` | Surgical Plan Confirmed | **KEEP** WRITER ② |
| `patient_counselled` | Patient Counselled | **KEEP** WRITER ② |

### 4c. Anaesthesia (5) → ③ Anaesthesia/PAC (keep dept sign-off; some derive from PAC)

| item_key | Label | Disposition | Source |
|----------|-------|-------------|--------|
| `anaesthesia_type_selected` | Anaesthesia Type Selected | **DERIVE** | from PAC anaesthesia plan (D11) |
| `anaesthetist_assigned` | Anaesthetist Assigned | **KEEP** WRITER ③ |
| `fitness_assessed` | Anaesthesia Fitness Assessed | **DERIVE** | from PAC complete (D11) |
| `contraindications_reviewed` | Contraindications Reviewed | **KEEP** WRITER ③ |
| `fitness_certificate_uploaded` | Fitness Certificate Uploaded | **WRITER** ③ (doc attaches here) — see D8 |

### 4d. Consent (8) → ④ Consent & Authorization

| item_key | Label | Disposition | Notes |
|----------|-------|-------------|-------|
| `surgery_consent_signed` | Surgery Consent Signed | **KEEP** WRITER ④ (signed PDF attaches here) |
| `anaesthesia_consent_signed` | Anaesthesia Consent Signed | **WRITER** ④ | unifies with PAC "consent type" (D4) |
| `hospital_policy_consent` | Hospital Policies Acknowledged | **KEEP** WRITER ④ |
| `blood_transfusion_consent` | Blood Transfusion Consent | **KEEP** WRITER ④ |
| `identity_verified` | Identity Verified | **WRITER** ④ | `§3 patient_identity_confirmed` derives (D1) |
| `surgery_site_marked` | Surgery Site Marked | **WRITER** ④ | `§3 operation_site_marked` derives (D2) |
| `contact_lens_removed` | Contact Lens Removed | **MOVE → ⑦** | ophthalmic prep, not consent (D15) |
| `valuables_removed` | Valuables & Jewellery Removed | **MOVE → ⑦** | bedside prep |

### 4e. Financial (3 self-pay; +payer-specific) → ⑤ Financial

| item_key | Label | Disposition |
|----------|-------|-------------|
| `payment_mode_confirmed` | Payment Mode Confirmed | **KEEP** WRITER ⑤ |
| `advance_paid` | Advance Payment Received | **KEEP** WRITER ⑤ |
| `emergency_fc_confirmed` | Emergency FC Status Noted | **KEEP** WRITER ⑤ |
| `insurance_preauth_approved` | Insurance Pre-Auth Approved | **KEEP** WRITER ⑤ (CCMS G11 hard block) |
| `cghs_approval_uploaded` / `esi_referral_uploaded` / `camp_sponsorship_uploaded` | payer-specific | **KEEP** WRITER ⑤ |

### 4f. Documents (5–7) → DELETE category; attach docs to owning fact (D14)

| item_key | Label | Disposition | Owning writer |
|----------|-------|-------------|---------------|
| `consent_form_doc` | Consent Form Uploaded | **DELETE** | upload on `surgery_consent_signed` ④ |
| `lab_reports_doc` | Lab Reports Uploaded | **DELETE** | upload on §1 lab rows |
| `imaging_reports_doc` | Imaging Reports Uploaded | **DELETE** | upload on §1 `ascan_done`/`bscan_done`/`ecg_done` |
| `fitness_certificate_doc` | Fitness Certificate Uploaded | **DELETE** | upload on `fitness_certificate_uploaded` ③ (D8) |
| `identity_proof_doc` | Identity Proof Uploaded | **DELETE** | upload on `identity_verified` ④ |
| `insurance_card_doc` | Insurance Card Uploaded | **DELETE** | upload on ⑤ payer item |
| `government_card_doc` | Government Entitlement Card | **DELETE** | upload on ⑤ payer item |

### 4g. Pharmacy Preparation (6, migration 93 — ACTIVATE, non-blocking) → ② §2 dept sign-off (STD_PHARMACY)

Q4: activate as-is; dedupe overlaps into derives. **Non-blocking.**

| item_key | Label | Disposition | Notes |
|----------|-------|-------------|-------|
| `dilation_drops_administered` | Dilation Drops Administered | **DERIVE** | from Med Log dilatation dose (joins D12 with `ward_dilatation_done`) |
| `antibiotic_drops_given` | Antibiotic Eye Drops Given | **KEEP** WRITER (Pharmacy) | distinct pharmacy act |
| `anaesthetic_drops_ready` | Anaesthetic / NSAID Drops Ready | **KEEP** WRITER (Pharmacy) | |
| `iv_access_established` | IV Access Established (if required) | **KEEP** WRITER (Pharmacy) | GA / IV sedation only |
| `medication_reconciliation` | Medication Reconciliation Completed | **KEEP** WRITER (Pharmacy) | cross-ref Med Log / PAC meds |
| `drug_allergy_reconfirmed` | Drug Allergy History Reconfirmed | **DERIVE** | from allergy WRITER (PAC) — joins D6 |

### 4h. OT Preparation (6, migration 93 — ACTIVATE, BLOCKING for Send to OT) → ② §2 dept sign-off (STD_INVENTORY)

Q4: activate as-is. **Blocking** (mandatory before Send to OT).

| item_key | Label | Disposition | Notes |
|----------|-------|-------------|-------|
| `iol_power_confirmed` | IOL Power Confirmed | **KEEP** WRITER (OT) | surgeon confirmation; display `§1 ascan_done` biometry read-only alongside |
| `iol_available_in_stock` | IOL Available in Stock | **KEEP** WRITER (OT) | blocking |
| `iol_barcode_verified` | IOL Barcode Scanned & Verified | **KEEP** WRITER (OT) | blocking |
| `instrument_pack_sterilized` | Instrument Pack Sterilized | **KEEP** WRITER (OT) | blocking |
| `ot_slot_confirmed` | OT Slot Confirmed | **KEEP** WRITER (OT) | blocking |
| `surgical_supplies_ready` | Surgical Supplies Ready | **KEEP** WRITER (OT) | blocking |

---

## 5. §3 Ward Safety (`WARD_CHECKLIST`, seed 135) — 17 rows → ⑦ Bedside Safety

Most become DERIVE (auto-satisfied). Only genuine bedside acts remain WRITER. Existing auto-sync constants in `WardChecklistAutoSyncService.cs` already cover several.

| item_key | Label | Disposition | Source (auto-sync) |
|----------|-------|-------------|--------------------|
| `patient_identity_confirmed` | Patient Identity Confirmation | **DERIVE** | ④ `identity_verified` (D1) |
| `bill_payment_confirmed` | Bill Payment Confirmation | **DERIVE** | ⑤ financialState (D9) |
| `ward_check_in_time` | Patient Check-in Time Recorded | **KEEP** WRITER ⑦ | sets `ward_check_in_at` |
| `investigation_reports_available` | Investigation Reports Available | **DERIVE** | ① (existing `SyncFromInvestigationsAsync`) (D7) |
| `ward_ascan_confirmed` | A-Scan Done | **DERIVE** | ① `ascan_done` verified (existing) (D7) |
| `toric_iol_icl_marking` | Toric IOL/ICL Marking | **KEEP** WRITER ⑦ | surgeon act (non-mandatory) |
| `operation_site_marked` | Operation Site Identified/Marked | **DERIVE** | ④ `surgery_site_marked` (D2) |
| `consent_patient_signed` | Consent Signed by Patient | **DERIVE** | ④ (existing `SyncConsentSectionConfirmedAsync`) (D3) |
| `consent_witness_signed` | Consent Signed by Witness | **DERIVE** | ④ (D3) |
| `consent_surgeon_signed` | Consent Signed by Surgeon | **DERIVE** | ④ (existing) (D3) |
| `vitals_checked` | Vitals Checked | **DERIVE** | ⑧ Vitals (existing `SyncVitalsCheckedAsync`) (D10) |
| `known_allergies_documented` | Known Allergies Documented | **DERIVE** | allergy WRITER (PAC/clinical) (D6) |
| `preop_medication_given` | Pre-Operative Medication Given | **KEEP** WRITER ⑦ | suggested from Med Log (D13) |
| `preop_slit_lamp_done` | Pre-Op Slit Lamp Done | **KEEP** WRITER ⑦ | bedside clinical act |
| `pac_done_documented` | PAC Done | **DERIVE** | ③ PAC completed (existing `PacDoneKey`) (D11) |
| `ward_dilatation_done` | Dilatation Done | **KEEP** WRITER ⑦ | confirmed after Med Log dose (D12) |
| `informed_surgeon_anaesthesia_ot` | Informed Surgeon/Anaes/OT | **KEEP** WRITER ⑦ | suggested on Mark Ready (existing) |

**Net §3:** 17 → **6 nurse-action writers** (`ward_check_in_time`, `toric_iol_icl_marking`, `preop_medication_given`, `preop_slit_lamp_done`, `ward_dilatation_done`, `informed_surgeon_anaesthesia_ot`) + **11 derived**.

---

## 6. §4 PAC (`pac_assessments`) → ③ Anaesthesia/PAC

| Field group | Disposition |
|-------------|-------------|
| Investigation summary grid | **DERIVE** (read-only from ①) — already implemented (`PacInvestigationSummary`) (D7) |
| BP / HR | **DERIVE** from ⑧ Vitals; inline edit writes back to Vitals (D10) |
| ASA grade, risk class, pre-op diagnosis | **KEEP** WRITER ③ |
| Allergies | **WRITER** ③ (single allergy source; D6 banner derives) |
| Past anaesthetic history, systemic review | **KEEP** WRITER ③ |
| Airway examination (always shown) | **KEEP** WRITER ③ |
| Anaesthesia plan | **WRITER** ③ → `anaesthesia_type_selected` derives (D11) |
| Consent type (Written/Witnessed/Verbal) | **MERGE → ④** `anaesthesia_consent_signed` (D4) |
| Current medications / meds advised | **KEEP** WRITER ③ (cross-ref Med Log) |
| Complete PAC | **KEEP** → triggers `fitness_assessed` + `pac_done_documented` derive (D11) |

---

## 7. Care tabs (Vitals / Med Log / Nurse / Remark) → ⑧ Vitals & Records

| Source | Disposition |
|--------|-------------|
| Vitals (`bp_recorded`, `pulse_recorded`, `spo2_recorded`, …) | **WRITER** ⑧ — single source for BP/HR/SpO2/ASA inputs (D10) |
| Medication Log (incl. dilatation doses) | **KEEP** WRITER ⑧ — suggests `ward_dilatation_done` + `preop_medication_given` (D12/D13) |
| Nurse Records / Remark | **KEEP** WRITER ⑧ |

---

## 8. Duplicate resolution summary (D1–D16 → exact keys)

| D# | Fact | WRITER (one) | DERIVE / DELETE |
|----|------|--------------|-----------------|
| D1 | Identity | `identity_verified` (④) | DERIVE `patient_identity_confirmed` (§3) — ✅ Phase 5 (`ConsentAuthorizationPanel` writer + `DerivedTick`) |
| D2 | Site marking | `surgery_site_marked` (④) | DERIVE `operation_site_marked` (§3); `toric_iol_icl_marking` stays separate surgeon act — ✅ Phase 5 (writer captures operative eye + marked-by) |
| D3 | Surgical consent | `surgery_consent_signed` (④) + signed PDF | DERIVE `consent_patient/witness/surgeon_signed` (§3); DELETE `consent_form_doc` — ✅ Phase 5 (PDF uploads onto the fact; 3 signatures render as `DerivedTick`s) |
| D4 | Anaesthesia consent | `anaesthesia_consent_signed` (④) | MERGE PAC "consent type" into it — ✅ Phase 5 (single writer in ④; PAC consent type referenced) |
| D5 | Fasting | `last_food_time` (⑥) | DERIVE `fasting_hours`, `fasting_confirmed` — ✅ Phase 7 (`FastingMedicationPanel` NPO widget: one input auto-fills duration + ticks confirmed) |
| D6 | Allergies | PAC `allergies` (③) | DERIVE `allergy_communicated` (§2), `known_allergies_documented` (§3) — ✅ Phase 7 frontend (reusable `AllergyBanner` from PAC; `allergy_communicated` is a read-only `DerivedTick`); §3 `known_allergies_documented` lands with the ⑦ Bedside panel |
| D7 | Investigations | §1 rows | DERIVE `investigation_reports_available`, `ward_ascan_confirmed` (§3), PAC summary; DELETE `lab_reports_doc`, `imaging_reports_doc` — ✅ Phase 9 (PAC summary read-only with "Edit in Investigations" deep-link; no PAC lab grid) |
| D8 | Fitness certificate | `fitness_certificate_uploaded` (③) | DELETE `fitness_certificate_doc`; `physician_fitness` (①) is a distinct physician result |
| D9 | Financial | ⑤ financial items + financialState | DERIVE `bill_payment_confirmed` (§3); banner + readiness read same state — ✅ Phase 6 (`FinancialClearancePanel`: single-source balance summary + writers; `bill_payment_confirmed` is a read-only `DerivedTick`; CCMS pre-auth G11 callout, enforced at Admit) |
| D10 | Vitals BP/HR | Vitals (⑧) | DERIVE `vitals_checked` (§3), PAC BP/HR, **and `bp_checked` (①)** (Q1 resolved) — ✅ Phase 8 frontend (Step ⑧ single Vitals writer via `WardPreOpCareTabsPanel`; `vitals_checked` server-synced via `SyncVitalsCheckedAsync`) |
| D11 | PAC | PAC complete (③) | DERIVE `pac_done_documented` (§3), `fitness_assessed` + `anaesthesia_type_selected` (§2) — ✅ Phase 9 frontend (Complete-PAC auto-satisfy surfaced; server sync wired); warn-only on unverified critical labs preserved |
| D12 | Dilatation | Med Log dose (⑧) | `ward_dilatation_done` (§3) WRITER but auto-suggested |
| D13 | Pre-op meds | Med Log (⑧) | `preop_medication_given` (§3) WRITER but auto-suggested — ✅ Phase 10 (`BedsideSafetyPanel`: nurse-action writer with Med-Log suggestion hint; mirror rows are `DerivedTick`) |
| D14 | Required Documents | owning writers | DELETE all 7 `*_doc` rows — ✅ Phase 5 for consent (signed PDF/identity proof upload onto the consent fact; Documents category deactivated in Phase 2) |
| D15 | Contact lens | `contact_lens_removed` | MOVE Consent → ⑦ — ✅ Phase 5 (no longer rendered under Consent; surfaces in ⑦ via `uiStep=bedside` from Phase 2) |
| D16 | Phase strip vs sub-tabs | — | ✅ Phase 3 DONE — `WardPreOpStepNav` (8-step tablist) replaces phase strip + sub-tabs + care top-tabs; P0 tab + phase cards removed; §2 routed by `categoryFilter`. No item keys |
| D10b | §2 final narrowing (Deliverable 10 / §10 / §16) | `Evaluation`, `Anaesthesia`, `Pharmacy Preparation`, `OT Preparation` | ✅ Phase 11 — `DepartmentClearancePanel` renders only the 4 real dept categories (`Consent`/`Financial`/`Compliance`/`Documents` added to `DEPARTMENT_CLEARANCE_EXCLUDED_CATEGORIES`); single status vocabulary via Phase-1 `StatusChip` (`statusFromDisplayStatus`/`statusFromSectionStatus`); sections collapsed by default, auto-expand only the user's dept (+ single-category step); locked categories hide their item lists pre-admit; signature+timestamp line per approval (`sectionSignoff`) |
| D17 | Readiness rollup & role-adaptive entry (§5/§18/§20) | all steps (rollup) | ✅ Phase 13 — pure `computePreOpReadiness` + `usePreOpReadiness` derive per-step `{completed,total,blocking,status,locked,hasCount}` from clearance completions + investigation/ward checklists + PAC in **one load**; sticky `PreOpReadinessBar` shows "X of N ready · M blockers" and now hosts the next-transition `WardPreOpGateChip` (moved from footer); `WardPreOpStepNav` shows inline `X/Y` count + blocker badge + `StatusChip` per unlocked step; `defaultStepForRole` opens role's step (anaesthetist→④, billing→⑤, OT→⑦, else ①, never locked pre-admit); header context line adds payer + balance + outpatient marker |
| §16 | Status system + clinical validation | — | ✅ Phase 1 (single `StatusChip` vocabulary) + Phase 11 (collapsed §2 onto it) + Phase 12 (role walkthrough in `ward-journey-qa-matrix.md`) |
| §17 | Accessibility (WCAG 2.2 AA) | — | ✅ Phase 12 — dialog semantics (`role`/`aria-modal`/`aria-labelledby`), `useFocusTrap` (trap + restore), Escape-to-close, `aria-label`/`focus-visible` on controls, `prefers-reduced-motion` global; `DerivedTick` `aria-disabled` + `sr-only` |
| §5 | Readiness at a glance (top bar + per-step counts) | — | ✅ Phase 13 — sticky `PreOpReadinessBar` ("X of N steps ready · M blockers" + `ReadinessMeter`, gate chip hosted here) + per-step `X/Y`/blocker/`StatusChip` in `WardPreOpStepNav`, both fed by the single `usePreOpReadiness` rollup; header context line (payer/balance/outpatient) |
| §18 | Performance | — | ✅ Phase 2 (single rollup) + Phase 3 (lazy step mount) + Phase 12 (`React.memo(DerivedTick)`, no manual Refresh confirmed) + Phase 13 (one `usePreOpReadiness` load powers bar+rail, refresh-on-step-change; pure compute is backend-rollup-ready) |
| §19 | Final screen hierarchy | — | ✅ Phase 3 (8-step IA) verified in Phase 12 walkthrough; Phase 13 adds the top readiness verdict + role-adaptive entry |
| §20 | Additional recommendations | — | ◑ Phase 12/13 — Pre-op summary **Print** deep-link (`printSummary`) + **role-adaptive default step** (`defaultStepForRole`) shipped; **telemetry / audit-timeline panel / offline-queued auto-save / configurable criticality / backend `preop-readiness` endpoint** remain backend-dependent backlog in `ward-ip-journey-deployment-runbook.md` |

---

## 9. Catalog dedupe migration plan — IMPLEMENTED as migration `144_ward_preop_v2_catalog_dedupe.sql`

> ✅ **Phase 2 shipped.** All of §9.1–§9.8 below are implemented in
> `consolidated/migrations/144_ward_preop_v2_catalog_dedupe.sql` (catalog-only; the
> auto-tick wiring in `WardChecklistAutoSyncService` follows in Phase 8). Reversible —
> rows are deactivated, never hard-deleted (preserves history + audit).

**9.1 DELETE (deactivate) — Documents category (D14):**
```
status='inactive', is_active=false WHERE tenant_id IS NULL AND item_key IN (
  'consent_form_doc','lab_reports_doc','imaging_reports_doc',
  'fitness_certificate_doc','identity_proof_doc','insurance_card_doc','government_card_doc')
```

**9.2 Convert to DERIVE (mark non-editable, keep row for display/audit):**
Add `item_config.derivedFrom` pointing at the writer key; UI renders these read-only.
- `§1`: `bp_checked←vitals` (Q1) — read-only BP reflection in Investigations.
- `§3`: `patient_identity_confirmed←identity_verified`, `operation_site_marked←surgery_site_marked`, `consent_patient_signed/consent_witness_signed/consent_surgeon_signed←surgery_consent_signed`, `investigation_reports_available←§1`, `ward_ascan_confirmed←ascan_done`, `vitals_checked←vitals`, `known_allergies_documented←pac.allergies`, `bill_payment_confirmed←financialState`, `pac_done_documented←pac.complete`
- `§2 Compliance`: `fasting_hours←last_food_time`, `fasting_confirmed←last_food_time`, `allergy_communicated←pac.allergies`, `blood_group_confirmed←§1 blood_group` (Q2)
- `§2 Anaesthesia`: `anaesthesia_type_selected←pac.plan`, `fitness_assessed←pac.complete`
- `§2 Pharmacy`: `dilation_drops_administered←medlog.dilatation`, `drug_allergy_reconfirmed←pac.allergies` (Q4 overlaps)

**9.3 MOVE / RE-HOME (keep key + data, change UI step):**
- `consent_confirmed` (①): **remove from §1 Investigations UI** but **keep the catalog key and completion data** (counsellor copy target — do NOT deactivate). Set `item_config.uiStep='consent'` and `item_config.role='counsellor_draft'` so ④ renders it as a counsellor-sourced pre-fill for `surgery_consent_signed`. The existing `OutpatientToWardItemKeys` copy path is unchanged. (Q3)
- `contact_lens_removed` / `valuables_removed` (Consent) → tag `item_config.uiStep='bedside'` for ⑦ rendering (no key change).

**9.4 ADD `blood_group` to §1 (Q2):**
```
INSERT pre_op_section_items (... form_code='WARD_INVESTIGATION_PREOP',
  category='Ward Investigation', item_key='blood_group', item_label='Blood Group',
  is_mandatory=true, is_blocking=false, requires_document=false, display_order=125,
  item_config='{"captureMode":"select","valueType":"select","masterList":"patient.blood_group",
                "autoPopulateFrom":"patient.blood_group","isCritical":false}')
```
Then deactivate the duplicate by deriving: `blood_group_confirmed` (Compliance) → `item_config.derivedFrom='blood_group'`, set read-only.

**9.5 ACTIVATE Pharmacy / OT Preparation (migration 93 rows) (Q4):**
```
UPDATE pre_op_section_items SET status='active', is_active=true
  WHERE tenant_id IS NULL AND category IN ('Pharmacy Preparation','OT Preparation');
-- OT Prep blocking for Send to OT:
UPDATE pre_op_section_items SET is_blocking=true
  WHERE tenant_id IS NULL AND category='OT Preparation';
-- Pharmacy non-blocking (leave is_blocking=false).
-- Overlap derives:
--   dilation_drops_administered.item_config.derivedFrom='medlog.dilatation'
--   drug_allergy_reconfirmed.item_config.derivedFrom='pac.allergies'
```

**9.6 Imaging report optional (Q-imaging):**
```
UPDATE pre_op_section_items SET item_config = item_config || '{"requiresReport":false}'::jsonb
  WHERE form_code='WARD_INVESTIGATION_PREOP'
    AND item_key IN ('ascan_done','bscan_done','xray_ga_cases');
```

**9.7 No change:** all Evaluation, Financial, remaining Consent, and §1 writer rows.

**9.8 Backfill rule:** for any DERIVE row already completed manually, leave completed (don't un-tick); future state comes from the writer via `WardChecklistAutoSyncService`.

---

## 10. Derived-tick source map (for Phase 2 rollup + auto-sync extension)

Already implemented in `WardChecklistAutoSyncService.cs`: `investigation_reports_available`, `ward_ascan_confirmed`, `vitals_checked`, `pac_done_documented`, `consent_patient_signed`, `consent_surgeon_signed`, `informed_surgeon_anaesthesia_ot` (on Mark Ready).

**To ADD in Phase 2:** `patient_identity_confirmed`, `operation_site_marked`, `consent_witness_signed`, `bill_payment_confirmed`, `known_allergies_documented`, `bp_checked` (←Vitals, Q1), `blood_group_confirmed` (←§1 `blood_group`, Q2), `dilation_drops_administered` (←Med Log, Q4), `drug_allergy_reconfirmed` (←PAC allergies, Q4), plus `§2` derives (`fasting_hours`, `fasting_confirmed`, `allergy_communicated`, `anaesthesia_type_selected`, `fitness_assessed`).

---

## 11. Confirmed decisions
- Keep the `§2` Request → Respond → Confirm/Hold/Reject/Escalate engine for the **4 real departmental categories** (Evaluation, Anaesthesia, **Pharmacy Preparation, OT Preparation** — activated from migration 93). Consent/Financial/Compliance/Documents leave `§2`.
- **OT Preparation is blocking** for Send to OT; **Pharmacy Preparation is non-blocking** (Q4).
- `blood_group` is a `§1` writer (select, auto-populated from demographics); `blood_group_confirmed` derives (Q2).
- Imaging/cardiac report upload is **optional**; value/finding completes the row.
- Bedside Safety (⑦) kept as a WHO-style final gate; 11 of 17 rows become derived.
- Documents category fully removed; documents attach to owning facts.

## 12. Questions — sign-off status (all resolved)
- **Q1 — BP single writer:** ✅ **RESOLVED.** Vitals (⑧) is the single BP/HR writer; `§1 bp_checked` derives (read-only). See §3 note ¹, D10, §9.2, §10.
- **Q2 — Blood group:** ✅ **RESOLVED.** New `§1 blood_group` writer (`captureMode: select`, auto-populated from `patient.blood_group`; ward enters+verifies when null/empty). `blood_group_confirmed` (Compliance) derives. General capture-mode rule added (§3.1). See §3 note ³, §4a, §9.4.
- **Q3 — `consent_confirmed` (①):** ✅ **RESOLVED.** Retire from §1 UI **but keep the key + data** (counsellor copy target). Surface in ④ as a counsellor-draft pre-fill for `surgery_consent_signed`; do **not** deactivate the catalog row. See §3 note ², §8 D3, §9.3.
- **Q4 — Pharmacy/OT Preparation:** ✅ **RESOLVED.** Activate migration-93 sets (6 Pharmacy + 6 OT). OT Prep blocking, Pharmacy non-blocking. Dedupe overlaps (`dilation_drops_administered`, `drug_allergy_reconfirmed`) into derives. See §4g/§4h, §9.5.

---

## 13. Coverage check (Phase 0 outputs)
- ✅ Item-by-item mapping for all 17 §1 + 35 §2 (+12 activated Pharmacy/OT) + 17 §3 + PAC + care tabs.
- ✅ Every duplicate D1–D16 + capture-mode model resolved to one writer with exact keys.
- ✅ Catalog dedupe migration plan with concrete key lists (§9), incl. blood_group add, Pharmacy/OT activation, imaging report optional.
- ✅ Derived-tick source map vs already-implemented auto-sync (§10).
- ✅ All four sign-off questions (Q1–Q4) resolved (§12).
