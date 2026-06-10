# IP Checklist Registry Mapping (S6–S8)

Maps spec `item_key` values to database columns and API fields for OT safety and ward checklists.

## OT Surgical Safety (Form 1 OT)

| Spec / UI field | DB table.column | API (SurgicalSafetyChecklistDto) |
|-----------------|-----------------|-----------------------------------|
| `before_anaesthesia.identity` | `ot_surgical_safety.identity_confirmed` | `beforeAnaesthesia.identityConfirmed` |
| `before_anaesthesia.eye_re` | `ot_surgical_safety.eye_re` | `beforeAnaesthesia.eyeRe` |
| `before_anaesthesia.eye_le` | `ot_surgical_safety.eye_le` | `beforeAnaesthesia.eyeLe` |
| `before_anaesthesia.topical_antibiotics` | `ot_surgical_safety.topical_antibiotics_used` | `beforeAnaesthesia.topicalAntibioticsUsed` |
| `before_anaesthesia.ascan_verified` | `ot_surgical_safety.ascan_verified` | `beforeAnaesthesia.ascanVerified` |
| `before_anaesthesia.consent_form` | `ot_surgical_safety.consent_form_checked` | `beforeAnaesthesia.consentFormChecked` |
| `before_anaesthesia.fitness` | `ot_surgical_safety.fitness_confirmed` | `beforeAnaesthesia.fitnessConfirmed` |
| `before_anaesthesia.allergy` | `ot_surgical_safety.allergy_known` + `allergy_details` | `beforeAnaesthesia.allergyKnown` / `allergyDetails` |
| `who.patient_identity` | `ot_surgical_safety.who_patient_identity` | `whoTimeout.patientIdentity` |
| `who.correct_eye` | `ot_surgical_safety.who_correct_eye` | `whoTimeout.correctEye` |
| `who.correct_procedure` | `ot_surgical_safety.who_correct_procedure` | `whoTimeout.correctProcedure` |
| `who.consent` | `ot_surgical_safety.who_consent_confirmed` | `whoTimeout.consentConfirmed` |
| `after_surgery.procedure_name` | `ot_surgical_safety.after_procedure_recorded` | `afterSurgery.procedureNameRecorded` |
| `after_surgery.postop_meds` | `ot_surgical_safety.after_postop_medication` | `afterSurgery.postopMedicationInstructed` |
| `after_surgery.postop_position` | `ot_surgical_safety.after_postop_position` | `afterSurgery.postopPositionInstructed` |
| WHO supervisor override | `patient_journeys.who_supervisor_override_at` + `who_supervisor_override_by` | Journey detail + `ApplyWhoSupervisorOverride` |

## Ward investigation (P1 — `WARD_INVESTIGATION_PREOP`)

| item_key | Source | Webhook / keyword |
|----------|--------|-------------------|
| `blood_sugar` | LIS | fbs, rbs, glucose, blood sugar |
| `hiv_done` | LIS | hiv, hiv serology |
| `blood_urea` | LIS | urea, bun |
| `serum_creatinine` | LIS | creatinine |
| `hba1c_done` | LIS | hba1c, a1c |
| `ascan_done` | Imaging | a-scan, biometry, axial length |
| `bscan_done` | Imaging | b-scan, ultrasound |
| `xray_ga_cases` | Imaging | x-ray, chest (GA filter) |
| `bp_checked` | Ward manual | — |
| `physician_fitness` | Ward manual | Doctors Desk `physician_cardiac_fitness` hint |
| `duct_assessed` | Ward manual | — |
| `dilatation_done` | Ward manual | — |
| `consent_confirmed` | Ward manual | Maps outpatient `outpatient_informed_consent` on copy |

Webhook endpoints: `POST /ip-management/integrations/lis-result`, `POST /ip-management/integrations/imaging-result`.

Auth (production): `X-Api-Key` or `X-Signature` (HMAC-SHA256 body) + `X-Tenant-ID`. Env: `INTEGRATION_WEBHOOK_API_KEY`, `INTEGRATION_WEBHOOK_HMAC_SECRET`. Dev: JWT bearer allowed when env vars unset.

## Outpatient consent (tripartite alias)

| Spec tripartite | Outpatient `item_key` | Ward alias |
|-----------------|----------------------|------------|
| Patient signed | `outpatient_informed_consent` | `consent_confirmed` (ward investigation) |
| Witness signed | *(optional future)* `consent_witness_signed` | — |
| Surgeon signed | *(optional future)* `consent_surgeon_signed` | — |

## `checklist_phase_status` keys (journey detail chips)

| JSON key | Set by |
|----------|--------|
| `ward_investigation_complete` | WardInvestigationChecklistService |
| `ward_checklist_complete` | WardChecklistService |
| `pac_completed` | PacAssessmentService |
| `med_log_complete` | MedicationLogService |
| `before_anaesthesia_complete` | SurgicalSafetyService |
| `who_timeout_complete` | SurgicalSafetyService |
| `after_surgery_complete` | SurgicalSafetyService |
| `ward_postop_complete` | WardPostOpChecklistService |
| `anaesthesia_discharge_cleared` | AnaesthesiaMonitoringService |

## Counsellor → Ward semantic copy

See `CounsellorChecklistService.OutpatientToWardItemKeys` for outpatient `item_key` → ward/investigation keys.

## Permissions (RBAC)

| Permission | Purpose |
|------------|---------|
| `ward.checklist.edit` | Ward Form 2, pre-op clearance, admit transitions |
| `ot.safety.sign` | Accept in OT, start surgery, OT safety sections |
| `ot.safety.override` | WHO timeout supervisor override |
| `counsellor.outpatient_checklist.edit` | P0 outpatient checklist |
| `ip_management.view` | IP dashboard read-only |

## Legacy (deprecated)

`pre_admission_checklist_*` tables and `PreAdmissionChecklistController` are read-only. Writes return HTTP 410. Use `GET/POST /api/ip-management/counsellor/sessions/{sessionId}/outpatient-checklist`.
