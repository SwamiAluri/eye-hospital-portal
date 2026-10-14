# Phase 3I — IP Vitals Patient 360 Product Decision Contract

Recorded 2026-09-30. Source: Phase 3I forensic audit of `vital_sign`, `docs/design/patient-360-information-architecture.md` section 7, `docs/decisions/patient-360-product-decision-contract.md`, Phase 3H `PatientJourneyHistoryService`, and permission seed `139_s5_ip_checklist_permissions.sql`.

This file records decisions only. No application implementation is performed.

Closure of the seven open items is recorded on 2026-09-30 in the same file. Already approved boundaries are unchanged.

---

## Decision register

### PD360-R-IPV-1 — Patient 360 inclusion

| | |
|---|---|
| Decision | **D. Historical IP vital list** under Clinical, titled IP Vitals. Not a latest-only card and not a latest card plus history. |
| Status | **APPROVED** |
| Rationale | Information architecture section 15 treats each vital row as an observation and says the list is the history. Section 7 places that history under Clinical with an IP label, separate from OPD. The overview “clinically relevant” strip is latest OPD only and does not include IP vitals. The target handoff is “View in IP,” and the target mutation is none. A latest summary would copy the ward monitoring surface onto the chart. A second summary above a list would do the same. Staying unavailable would leave the designed Clinical block permanently missing after a safe read exists. The “not integrated” copy is the current gap, not the product end state. |
| Approved | A paginated historical list of IP vital observations on an opened patient chart. |
| Excluded | A. Remaining unavailable. B as an unspecified block. C. Latest summary only. E. Latest summary plus history. Turning Clinical into an IP work queue. |
| Implementation consequence | Placement follows PD360-R-IPV-2. Depth, fields, context, and states are the later decisions in this closure. The screen stays on the current unavailable copy until a separately authorized implementation slice. |

### PD360-R-IPV-2 — Clinical placement

| | |
|---|---|
| Decision | If inclusion is later approved, the block is under Clinical, headed **IP Vitals**, and is not merged with OPD vitals, examinations, labs, imaging, or specialty diagnostics. |
| Status | **APPROVED** as a placement constraint only. It does not approve inclusion (PD360-R-IPV-1). |
| Rationale | Clinical is the existing Patient 360 section for observations. The information architecture already forbids merging the two vital tables and already uses the words IP vitals. `Patient360Clinical` already shows “IP vitals are not available in Patient 360.” |
| Approved | Heading **IP Vitals** under Clinical, kept visually and in data separate from the OPD vitals block. |
| Excluded | A combined unlabeled vital stream. Placement on Overview, Administration, or Inpatient History. UI changes in this contract. |
| Implementation consequence | No screen change now. A later UI slice, if inclusion is approved, uses that heading and does not relabel OPD rows as IP. |

### PD360-R-IPV-3 — Branch visibility

| | |
|---|---|
| Decision | **Option 1.** A future read may include a vital only when `vital_sign.journey_id` → `patient_journey.branch_id` is in the branch set from the existing `FollowupBranchAccessService`. **Option 2 is rejected.** No IP-specific branch service was found that authorizes vitals. **Option 3 is not selected** because that existing service is the Patient 360 branch mechanism already used for inpatient history. The Phase 3H closed-state filter is **not** part of this branch rule. |
| Status | **APPROVED** for the branch predicate only. |
| Rationale | `vital_sign` has no `branch_id`. `patient_journey.branch_id` is the parent branch. Phase 3H already resolves the caller’s authorized branches with `FollowupBranchAccessService`. Copying only the closed-journey filter would hide vitals on an open admission. This decision does not copy that filter. |
| Approved | Multiple authorized branches: every branch the service returns. An unauthorized branch: no rows from that branch. An empty authorized set: no vitals (authorized empty, not an error). `patient.branch_id` is not the visibility key when it differs from `patient_journey.branch_id`. |
| Excluded | A new branch service. Filtering on the patient directory branch. Applying `Discharged` and `AdmissionCancelled` inside this branch decision. |
| Implementation consequence | Open, discharged, `AdmissionCancelled`, and `CancelledSurgery` are not accepted or rejected here. That is PD360-R-IPV-11. No branch code is changed now. |

### PD360-R-IPV-4 — Read authorization

| | |
|---|---|
| Decision | **Option C.** No existing permission is semantically appropriate. A new read permission is required. This contract does not create it. |
| Status | **APPROVED** |
| Rationale | Focused catalog audit. `ip_management.view` (`139_s5_ip_checklist_permissions.sql`) is module `ip_management`, action `view`, resource `ip_journey`, description “View IP journey dashboard and read-only checklist status.” It is the Phase 3H history gate. Seed `156` grants it to cashier, billing clerk, finance, TPA executive, IP coordinator, OT coordinator, and surgeon so the census screen loads, and does not put it on the nurse or doctor bundles (those receive `ip.view` only). `ip.view` is “View the inpatient census and patient journeys,” resource `patient_journey`, and is granted to cashier, billing clerk, finance, TPA, counsellor, nurse, and doctor. Neither description mentions vital measurements. Reusing either code would expose temperature, blood pressure, pulse, respiration, saturation, weight, and height to billing and coverage roles, or would treat a census code as a clinical observation code. `ward.checklist.edit` is action `edit` on `ward_checklist` (“Toggle ward pre-operative checklist items”) and is the pre-op vital POST gate. It is not a read permission. `patient.view` gates OPD `patient_vital_signs` (`VitalsController.GetHistory`). It does not name `vital_sign`. `CLINICAL:EXAMINATION:VIEW`, `CLINICAL:BIOMETRY:VIEW`, and `CLINICAL:SCREENING:VIEW` are specialty clinical reads, not this table. No seed contains `ip.vitals.read`. `ip.vitals.override` appears only as future wording in an IP FRD, not in the permission catalog. |
| Approved | Proposed future code `ip.vitals.read`. Catalog shape, matching existing IP seeds: module `ip_management`, action `read`, resource `vital_sign`, scope `branch`. Semantic scope: a patient-scoped, tenant-scoped, branch-authorized, read-only Patient 360 list of the fields approved in PD360-R-IPV-5, from `vital_sign` through `patient_journey`, under the branch, context, lifecycle, soft-delete, and page rules in this contract. |
| Excluded | Creating the permission here. Assigning it to any role here. Treating `ip_management.view`, `ip.view`, `patient.view`, or `ward.checklist.edit` as the gate. Writes, corrections, checklist edits, pre-op clearance, `nurse_record`, journey transitions, billing, OPD vitals, notes, and recorder identity. |
| Implementation consequence | Permission creation and role assignment are a separate security implementation slice. Patient 360 IP vitals must not ship before that slice exists and is authorized. |

### PD360-R-IPV-5 — Field allow-list

| | |
|---|---|
| Decision | The stored numeric observations and the measurement time are visible. Blood pressure is one measurement shown from the two source columns, systolic then diastolic. Units shown only where the table comment states them. |
| Status | **APPROVED** |
| Rationale | Information architecture section 15 says a vital row is an observation identified by measurement time and source label. The columns below are those observations in `migrations/33_vital_sign_nurse_record.sql`. Hiding them would leave the approved historical list with no clinical content. They are numeric measures, not free text. No unit column exists. Comments state temperature Celsius, weight kg, height cm, and oxygen saturation as percentage. Blood pressure, pulse, and respiratory rate have no unit comment, so no unit word is invented. |
| Approved | Display of `recorded_at`, `context` (as the Ward versus PreOp label from PD360-R-IPV-8), `temperature` (Celsius), `blood_pressure_systolic` and `blood_pressure_diastolic` together as blood pressure, `pulse_rate` labelled **Pulse rate**, `respiratory_rate`, `oxygen_saturation` (percent), `weight` (kg), `height` (cm). |
| Excluded | BMI. Renaming `pulse_rate` to heart rate. `notes`. `recorded_by_user_id`. `status` as a clinical result. `created_at` as observation time. A stored unit field. mmHg or any other unit not named in the source comments. |
| Implementation consequence | A later read may return only this allow-list. It must not add derived BMI or a renamed pulse field. |

Field marks:

| Field | Mark |
|---|---|
| `recorded_at` | **APPROVED** as the displayed measurement time |
| `context` | **APPROVED** as the Ward or PreOp label only |
| `temperature` | **APPROVED** (Celsius) |
| `blood_pressure_systolic` | **APPROVED**, shown with diastolic as one blood pressure measurement |
| `blood_pressure_diastolic` | **APPROVED**, shown with systolic as one blood pressure measurement |
| `pulse_rate` | **APPROVED**, label Pulse rate |
| `respiratory_rate` | **APPROVED**, no invented unit |
| `oxygen_saturation` | **APPROVED** (percent) |
| `weight` | **APPROVED** (kg) |
| `height` | **APPROVED** (cm) |
| `notes` | **EXCLUDED** (PD360-R-IPV-6) |
| `recorded_by_user_id` | **EXCLUDED** (PD360-R-IPV-7) |
| `status` | **EXCLUDED** |
| `created_at` | **EXCLUDED** as observation time |

### PD360-R-IPV-6 — Notes

| | |
|---|---|
| Decision | **Excluded.** |
| Status | **APPROVED** |
| Rationale | `notes` is unbounded free text. No Patient 360 rule requires showing IP vital notes. No summary or extraction is authorized. |
| Approved | The future read does not select or return `notes`. |
| Excluded | Full display, metadata-only display, summarization, and AI extraction. |
| Implementation consequence | A later reversal needs its own decision. This contract does not show notes. |

### PD360-R-IPV-7 — Recorder identity

| | |
|---|---|
| Decision | **Nothing.** |
| Status | **APPROVED** |
| Rationale | `recorded_by_user_id` is a staff key. Display name or role needs a staff directory lookup. This contract forbids adding that dependency. A raw user id is not a chart label. |
| Approved | The future read does not return the user id, a display name, or a role. |
| Excluded | Raw user id on screen. Staff name. Staff role. |
| Implementation consequence | No user join is part of a later vitals read authorized by this file. |

### PD360-R-IPV-8 — Context / PreOp

| | |
|---|---|
| Decision | **B. Ward plus PreOp**, as two labelled kinds of the same source. Included values are only `context IS NULL` and `context = 'PreOp'`. |
| Status | **APPROVED** |
| Rationale | Ward writes store null. Pre-op writes store the exact string `PreOp` (`PreOpClearanceService`, column comment in `91_pre_op_clearance_tables.sql`). Those PreOp rows are vital measurements on the same journey, recorded during pre-admission clearance. Omitting them would drop measurements that remain on the journey after admission. They stay distinguishable: null is labelled **Ward**; `PreOp` is labelled **PreOp**. The column comment also names `PostOp` and `Routine`. No current writer sets those values, so they are not inferred into this list. |
| Approved | Null context, displayed as Ward. Exact `PreOp`, displayed as PreOp. |
| Excluded | Ward only. PreOp only. Any other context string, including `PostOp` and `Routine`, until a writer and a later decision exist. Silent merge into one unlabeled stream. The pre-op clearance endpoint, consents, and documents. |
| Implementation consequence | The future query predicate is `context IS NULL OR context = 'PreOp'`. A PreOp row must show that label. |

### PD360-R-IPV-9 — Nurse record boundary

| | |
|---|---|
| Decision | `nurse_record` stays out. |
| Status | **OUT OF SCOPE** |
| Rationale | Pain score, alertness, and intake/output text are not columns on `vital_sign`. This request says not to include that table unless explicitly approved. It is not approved. |
| Approved | None from `nurse_record`. |
| Excluded | Pain score, alertness, intake/output, and any merge of nurse rows into the vital history. |
| Implementation consequence | A nurse-observation slice needs its own audit and decision. |

### PD360-R-IPV-10 — Historical depth

| | |
|---|---|
| Decision | **C. Paginated historical list.** The PD360-R-IPV-15 page proposal is confirmed. |
| Status | **APPROVED** |
| Rationale | PD360-R-IPV-1 selects history, not a latest card. Returning every row for a long admission would be an unbounded read. OPD history clamps to 50 on `patient_vital_signs` (`VitalsController`). That cap is a different table and is not adopted. Patient 360 already pages specialty and inpatient-history reads at default 20 and maximum 100 (`Patient360DiagnosticPaging`), by page number, and Phase 3H breaks ties with id descending. |
| Approved | Page number and page size. Default 20. Maximum 100, capped rather than rejected, matching the existing pager. Order `recorded_at DESC`, then `id DESC`. |
| Excluded | Latest row only. A fixed latest N with no further pages. Latest summary plus history. The OPD limit of 50. A cursor. An unpaged response. |
| Implementation consequence | The read is bounded. PD360-R-IPV-15’s conditional page specification is now the list rule. |

### PD360-R-IPV-11 — Journey lifecycle

| | |
|---|---|
| Decision | Vitals contribute only from journeys that have entered the inpatient episode, including a parked cancelled surgery and a completed discharge. Pre-admission states do not. |
| Status | **APPROVED** |
| Rationale | `ClinicalState` comments define the graph. `AdmissionCancelled` is valid only from `Expected` and is “before irreversible clinical activity.” `Expected` is not yet an admission. Showing those rows would put pre-admission clearance onto the chart and would not match a longitudinal inpatient observation list. `CancelledSurgery` parks a surgical case that has left `Expected`; the only exit is rebook to `Expected`. Measurements already stored on that journey stay clinical facts. The forward states from `Admitted` through `Discharged` are the open episode and the completed episode. Patient 360 is opened for one patient and has no IP actions, so including open states does not create a ward queue. This is not the Phase 3H pair. `Discharged` is included because the episode is history. `AdmissionCancelled` is excluded for the reason in its own comment, not because Phase 3H was copied. |
| Approved | `Admitted`. `ReadyForSurgery` (still the admitted episode). `SentToOT`. `InOT`. `SurgeryCompleted`. `PostOp`. `ReadyForDischarge`. `Discharged` (completed episode). `CancelledSurgery` (parked surgical case; observations already recorded remain). |
| Excluded | `Expected`. `AdmissionCancelled`. Any state string outside `ClinicalState`. Journey actions (admit, ready, OT, discharge, rebook) on this list. |
| Implementation consequence | Future filter is `clinical_state` in the approved set. A PreOp row on an `Expected` journey stays outside Patient 360 until that same journey enters an approved state. The pre-op clearance screen remains the place those rows are seen before admission. |

### PD360-R-IPV-12 — Soft delete

| | |
|---|---|
| Decision | **A. Hide child vitals when the parent journey is soft-deleted.** The vital row rule stays `vital_sign.deleted_at IS NULL`. |
| Status | **APPROVED** |
| Rationale | The vital has no `patient_id` of its own. Visibility is the parent journey. Phase 3H already hides a journey with `deleted_at` set, and this Patient 360 pattern does not offer a deleted-history UI, retention, archive, or purge. Showing an active vital under a soft-deleted journey would publish an episode the chart otherwise treats as gone. Hard delete remains PD360-R-IPV-13: the cascade removes the child; no tombstone. |
| Approved | Both `vital_sign.deleted_at IS NULL` and `patient_journey.deleted_at IS NULL`. |
| Excluded | Option B (show the child because the vital row is not deleted). A deleted-journey vitals view. Retention, archive, and purge. |
| Implementation consequence | The future join requires both null deleted timestamps. No new lifecycle model. |

### PD360-R-IPV-13 — Hard delete

| | |
|---|---|
| Decision | Patient 360 reflects the source. Hard delete of `patient_journey` cascades and removes `vital_sign`. No tombstone is created. |
| Status | **APPROVED** for this boundary. **PD360-R9 remains open** and is not resolved. |
| Rationale | `journey_id` references `patient_journey(id) ON DELETE CASCADE`. The broader hard-delete-versus-`deleted_at` question for the patient row stays PD360-R9. |
| Approved | Absence after cascade is the correct Patient 360 result. |
| Excluded | Tombstones, retained copies, and a second history table. |
| Implementation consequence | Do not store a replacement row when the journey is hard-deleted. |

### PD360-R-IPV-14 — Timestamp

| | |
|---|---|
| Decision | `recorded_at` is the measurement time. |
| Status | **APPROVED** |
| Rationale | Create stores the request time or, if omitted, insert time in `recorded_at`. `created_at` is entry time. `updated_at` changes on correction and is not the observation time. Updates do not change `recorded_at`. `patient_journey.admitted_at` is admission, not the measurement. |
| Approved | `recorded_at` as the only observation timestamp. |
| Excluded | `created_at`, `updated_at`, and `admitted_at` as the time the vital was observed. |
| Implementation consequence | A later DTO may expose `recorded_at`. It must not label entry or correction time as the observation. |

### PD360-R-IPV-15 — Pagination and order

| | |
|---|---|
| Decision | If a historical list is later approved, use the existing Patient 360 page convention and a stable vital order. |
| Status | **APPROVED** as a conditional specification. It does not approve a list (PD360-R-IPV-10). |
| Rationale | `Patient360DiagnosticPaging` is already page number, default 20, maximum 100 (values above 100 are capped, not rejected). Phase 3H breaks ties with id descending. The vitals source already sorts by `recorded_at` descending but does not break ties. |
| Approved | Page number and page size. Default 20. Maximum 100. Order `recorded_at DESC`, then `id DESC`. |
| Excluded | A cursor that Patient 360 does not already use for this pattern. An unpaged dump. |
| Implementation consequence | Confirmed by PD360-R-IPV-10 as the list rule. Still not implemented. The permission in PD360-R-IPV-4 does not exist yet. |

### PD360-R-IPV-16 — Failure semantics

| | |
|---|---|
| Decision | Reuse Clinical Patient 360 states. |
| Status | **APPROVED** |
| Rationale | `patient-360-clinical.ts` already separates ready data, an explicit empty sentence, unauthorized (HTTP 401/403), and unavailable (any other failure). The IP journey GET returns 200 and an empty list for both “no ward rows” and “unknown journey,” and some IP screens collapse errors into an empty list. Patient 360 must not copy that collapse. |
| Approved | Authorized + data. Authorized + empty, worded as no IP vitals recorded only for that state. Unauthorized stays unauthorized. Unavailable/error stays unavailable. |
| Excluded | Mapping HTTP 500 or a network failure to “No IP vitals recorded.” Mapping unauthorized to an empty history. |
| Implementation consequence | No UI copy change now. A later read must preserve the four states. |

### PD360-R-IPV-17 — Source boundary

| | |
|---|---|
| Decision | The only approved source pair is `vital_sign` joined through `patient_journey`. |
| Status | **APPROVED** |
| Rationale | IP Management owns `vital_sign`. Identity is `journey_id` → `patient_journey.patient_id`. The information architecture already treats `patient_vital_signs` as the OPD source. |
| Approved | That join, when a later slice is separately authorized. |
| Excluded | `patient_vital_signs`, `nurse_record`, the pre-op clearance payload, consents, documents, diagnosis, surgery, OT, and billing. |
| Implementation consequence | Those domains stay on their own decisions. |

### PD360-R-IPV-18 — Security boundary

| | |
|---|---|
| Decision | A future Patient 360 read, if one is separately authorized, must be patient-scoped, tenant-scoped, server-authorized, branch-authorized, read-only, and paginated. It must not be `GET /api/ip-management/journeys/{id}/vitals`. |
| Status | **APPROVED** |
| Rationale | The existing GET is authenticated by JWT, filtered by vital tenant and vital `deleted_at`, and lacks permission, patient, branch, journey lifecycle, and pagination. This contract does not change that endpoint. |
| Approved | The boundary above. |
| Excluded | Reuse of the journey-id GET. Changes to that route. Service accounts and internal keys. |
| Implementation consequence | The endpoint stays as it is. This file does not add a replacement. |

---

## Consistency

1. Branch visibility uses `patient_journey.branch_id` for every approved state, open and discharged. The closed-only Phase 3H filter is not applied.
2. The list is measurements on one opened chart. It has no admit, OT, discharge, or rebook actions, so Clinical is not an IP work queue.
3. `PreOp` is a required label. Null context is labelled Ward. Other context strings are omitted.
4. Depth is one page, default 20, maximum 100, ordered by `recorded_at` then `id`.
5. No existing permission covers the approved fields. The proposed `ip.vitals.read` is the only intended gate, and it does not exist yet.
6. Without that permission the read is unauthorized. Unauthorized is not an empty list.
7. A soft-deleted journey fails `patient_journey.deleted_at IS NULL`, so its child vitals are not returned.
8. OPD remains `patient_vital_signs`. IP remains `vital_sign`.
9. `nurse_record` is not selected.
10. The future operation is read-only. The journey vitals GET is not modified and is not reused.

## Implementation readiness

Product rules for a later slice, if and only if `ip.vitals.read` has been created in a separate security slice:

- Source: `vital_sign` joined to `patient_journey` on `journey_id`.
- Patient: `patient_journey.patient_id` equals the requested patient.
- Tenant: JWT tenant matches `patient_journey.tenant_id`, and the vital tenant boundary stays enforced.
- Branch: `patient_journey.branch_id` is in the set from `FollowupBranchAccessService`. Empty set returns authorized empty. `patient.branch_id` is not the filter.
- Permission: `ip.vitals.read` only, once it exists. Not `ip_management.view`, `ip.view`, `patient.view`, or `ward.checklist.edit`.
- Fields: `recorded_at`, `context`, `temperature` (Celsius), blood pressure as systolic then diastolic, `pulse_rate` labelled Pulse rate, `respiratory_rate`, `oxygen_saturation` (percent), `weight` (kg), `height` (cm).
- Context: `context IS NULL OR context = 'PreOp'`, labelled Ward or PreOp.
- States: `Admitted`, `ReadyForSurgery`, `SentToOT`, `InOT`, `SurgeryCompleted`, `PostOp`, `ReadyForDischarge`, `Discharged`, `CancelledSurgery`.
- Deletion: `vital_sign.deleted_at IS NULL` and `patient_journey.deleted_at IS NULL`.
- Depth: paginated history. Page number. Default 20. Maximum 100. `recorded_at DESC`, `id DESC`.
- UI: Clinical, heading IP Vitals, separate from OPD vitals.
- Semantics: authorized with data, authorized empty, unauthorized, unavailable.

## Security role assignment (closed)

Recorded 2026-09-30 from the IP vitals security-role audit. This section does not insert `ip.vitals.read` or any `role_permission` row.

`ip.view`, `ip_management.view`, `ward.checklist.edit`, `anaesthesia.monitoring.edit`, and `ip.postop.manage` are not substitutes for `ip.vitals.read`. The wide checklist insert in migrations 140 and 140b is not copied. The `*` claim is not role evidence.

Proposed permission, not yet created:

| | |
|---|---|
| Code | `ip.vitals.read` |
| Module | `ip_management` |
| Action | `read` |
| Resource | `vital_sign` |
| Scope | `branch` |
| Description | Read-only Patient 360 IP vitals: `vital_sign` through `patient_journey` for the approved fields, Ward and PreOp contexts, and approved journey states, limited to the caller’s authorized branches. Does not authorize notes, recorder identity, nurse records, pre-op clearance, OPD vitals, billing, journey actions, or any mutation. |

| Role | Decision |
|---|---|
| NURSE | APPROVE |
| OT NURSE | APPROVE |
| OTNURSE | APPROVE |
| ADMIN | APPROVE |
| CASHIER | DO NOT APPROVE |
| BILLING CLERK | DO NOT APPROVE |
| FINANCE | DO NOT APPROVE |
| TPA EXECUTIVE | DO NOT APPROVE |
| COUNSELLOR | DO NOT APPROVE |
| FRONT DESK | DO NOT APPROVE |
| DOCTOR | DO NOT APPROVE |
| ANAESTHETIST | DO NOT APPROVE |
| SURGEON | DO NOT APPROVE |
| IP COORDINATOR | DO NOT APPROVE |
| OT COORDINATOR | DO NOT APPROVE |
| WARD CLERK | DO NOT APPROVE |

No role remains DECISION REQUIRED. A later security slice may create the permission and assign only the four approved names. That slice is not this record. Patient 360 IP vitals stay blocked until that permission exists and a further slice is authorized.

PHASE 3I IP VITALS IMPLEMENTATION AUTHORIZATION: NOT GRANTED
