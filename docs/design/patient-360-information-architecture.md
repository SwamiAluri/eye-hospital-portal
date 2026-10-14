# Patient 360 — Information Architecture and UX Blueprint

Document type: Target information architecture  
Date: 2026-09-29  
Status: design record only  

Implementation authorization: **NOT CREATED**  
Application code, UI, routes, APIs, database, permissions, navigation, migrations, tests: **NOT CHANGED**

Governing contract: `docs/decisions/patient-360-product-decision-contract.md`  
Repository evidence: `docs/audits/patient-directory-master-forensic-redesign-audit.md` and the Patient 360 source-of-truth forensic audit (2026-09-29).

This blueprint describes the target experience a later slice may follow. It does not change `/dashboard/patients` or `/dashboard/patients/[id]`.

Status words:

| Word | Meaning |
|---|---|
| APPROVED | PD-A through PD-H in the contract. Not reopened. |
| Proposed | Direction already labeled “Proposed decision for implementation” in the contract. Not a certified slice rule. |
| Target | This blueprint’s information architecture. Not current UI. |
| Current | What the repository does today. |
| DEPENDENT ON OPEN DECISION | PD360-R1 through PD360-R10. This document does not answer them. |
| GREEN / YELLOW / RED / GRAY | Coverage classes from the forensic audit. Not a visual theme. |

---

## 1. Executive summary

Patient 360 is the page at `/dashboard/patients/[id]`. Discovery stays the lean grid at `/dashboard/patients` (PD-C). The record stops being a three-group encyclopedia of about thirty peer tabs (`patient-record-tabs.ts`) and becomes one patient, one identity header, seven task sections, and a timeline that only includes events the user is allowed to see.

The seven sections exist so staff can scan a hospital chart without opening Counsellor, Billing, CCMS, Doctor’s Desk, Front Office, Laboratory, Imaging, Optical, OT, or IP as if those desks had been copied into the chart.

What the page can honestly show on day one of a shell is smaller than the target. Clinical lists that already have a patient-id read can move under Clinical. Counselling detail, CCMS cases, IP vitals, IP charges, recordings, transcripts, and a real document index cannot be presented as history until their reads exist. Those sections use an explicit **not integrated** state. They never use “No history.”

Diagnosis history is not designed as a single list. OPD vitals and IP vitals are not one database. AI summary is not a section. No `patient_events` table is part of this blueprint.

---

## 2. Product north star

APPROVED.

Patient Directory is:

1. Hospital-wide patient discovery.
2. Longitudinal Patient 360 context.
3. Controlled handoff into the module that owns the next operational step.

It is not a second Counsellor Desk, Doctor’s Desk, Billing Desk, Insurance/CCMS Desk, Front Office, Laboratory, Imaging workstation, Optical POS, OT board, IP operational chart, or queue board (PD-F, PD-H).

`patient.id` on auth-service table `patient` remains the identity key. Operational modules remain the systems of record. Patient 360 reads them. It does not post a second copy in order to look complete.

---

## 3. Patient 360 mental model

```text
ONE PATIENT (patient.id)
    → ONE IDENTITY (header)
    → ONE LONGITUDINAL CONTEXT (this page)
        → many authoritative sources
        → provenance when two stores could be confused
        → handoff when the user must act
```

Three layers on every section:

| Layer | Question | Where it lives |
|---|---|---|
| Identity | Who is this person? | Header. Stable for the visit to the page. |
| Current context | What is active in this branch right now? | Header context row and the top of Overview. From the existing summary engagement snapshot, not a new scorer. |
| History | What has happened, from which source? | Section bodies and Timeline. |

Actions are not a fourth identity field. They sit in a header action cluster and inside sections only where a handoff or a still-certified write already exists.

The directory grid does not repeat this model. It keeps identity plus a short operational signal (PD-C). “Assigned to me” on that grid remains My Assigned Visits (PD-D), not counsellor ownership, and it does not reappear as a 360 navigation item.

---

## 4. Target navigation architecture

Current shell (`PATIENT_RECORD_TAB_GROUPS`) has Clinical, Admin, and Billing & pathways, plus a More menu, plus fourteen hidden keys in `HIDDEN_FROM_RECORD_SHELL`. That is a tab encyclopedia. Several hidden tabs are Coming Soon badges. The target does not reproduce that list and does not show Coming Soon.

### Primary navigation — seven items

| Item | Why it exists | What it is not |
|---|---|---|
| Overview | Answers who, what is active, and what happened recently, without opening every domain. | Not a second clinical dashboard and not CCM placeholder widgets. |
| Clinical | One chart for observations, orders, and chart notes. In-section links replace a dozen peer tabs. | Not Doctor’s Desk and not the encounter editor. |
| Care | Visits, encounters, counselling context, follow-up, and communication history. Care journey is not the clinical chart and not the counsellor desk. | No Start, Assign, or ReQueue. |
| Documents | One index with a source on every row, because the hospital does not have one document repository. | Not an upload desk and not “the” document system. |
| Coverage | Financial context and insurance context on one page, in two labeled stacks, so money and payer workflow are not one fake record. | Not cashier and not CCMS operations. |
| Administration | Appointments, check-in, consents, admissions, surgery/OT context. | Not Front Office and not the OT board. |
| Timeline | The full authorized chronology. Overview shows only a short excerpt. | Not a new `patient_events` store. |

Why seven, not nine domains as nine tabs: Communication is a labeled block inside Care until a slice proves `patient_communications` and the notification hub are the same history. Financial and Insurance are stacks inside Coverage so authorization and provenance stay visible without two top-level money tabs. Identity is the header, not a tab.

In-section navigation is a short list of anchors on desktop (a left rail inside the section, or a sticky subnav). It is not a second app tab set. Nested depth stops at: page → section → source group → row detail in a Sheet.

URL: keep `/dashboard/patients/[id]`. A `section` query (not the current `tab` keys) is the target address, mapped later. Do not reuse hidden keys such as `documents` or `counseling` as if those components were the new sections. Deep links to hidden keys today rewrite to overview (`PatientRecordPage`). The target must not send staff to a Coming Soon component.

### Why each clinical sub-block stays inside Clinical

Overview of the chart, history, vitals, allergies, diagnoses, examinations, medications, prescriptions, labs, imaging, scanning, optical, chart notes, and clinical recommendations are one clinical story. Separate top-level tabs for each made the current page feel like a table browser and hid the relationship between an examination and a lab. Sub-blocks keep that relationship. Recommendations stay labeled as counsellor-session context, not as a diagnosis list.

---

## 5. Patient identity and header architecture

Route target: `/dashboard/patients/[id]`. Component to evolve later: `PatientRecordPage` / `SummaryHeader`. This blueprint does not edit them.

The header is three bands. They do not merge.

### Identity band (persistent)

Show only fields the patient row or summary already returns:

| Field | Source today | Rule |
|---|---|---|
| Name | `patient.first_name` / `last_name` via summary | Always |
| MRN | `medical_record_number` | Always. Display only. Not editable here (Slice 7). |
| Health ID | `health_id` when present | Show the value. Do not relabel it as MRN. |
| Age and date of birth | `date_of_birth` | Age is derived for display, as preview already does (`calcPatientAge`). |
| Sex | `gender` | The stored field. Do not add a second sex model. |
| Phone | `contact_number` | `tel:` link only, same as the current header. Not a logged communication. |
| Emergency contact | summary / patient columns already loaded by `PatientSummaryService` | In the header only as a compact line or a disclosure. Not a new data capture form. |

Branch is context, not identity. A patient can have a null `branch_id`. The header shows the **selected effective branch** the page was opened under, labeled as the viewing context, not as “the patient’s branch” unless `branch_id` is present and matches.

### Current-context band

Use signals the summary engagement bundle already computes. Do not invent alert or acuity policy.

Allowed, because they exist on the lookup/summary DTO today:

- IP admitted badge when `ipAdmission` is present (`IpAdmittedBadge`).
- Active engagement labels from `PatientEngagementService` (open visit, queue, counselling, pre-auth). These are census projections, not clinical severity.
- Open visit station / assigned provider name when the bundle already returns them.
- Existing data-quality flags from `GetDataQualityAsync` (`PatientDataQualityBanner`). These are missing-demographic warnings, not clinical alerts.

Not in the header:

- A new acuity protocol. `ClinicalAcuity` exists as `AcuityScoringService` output on the directory row. The contract says not to invent acuity rules. The header does not promote that score into a clinical alarm.
- New emergency behavior. The current record toolbar can link to check-in with `emergency=1`. That link may remain as an existing handoff. This blueprint adds no emergency override, no role-name bypass, and no new alarm.
- Counsellor ownership, quote status, or claim status as if they were patient status. `patient.status` (default `Active`) is not the census and has no defined lifecycle in the directory. Show it only as the stored registration status string, labeled as registration status, or omit it until a lifecycle exists. Do not map it to Current / Discharged.

### Action band

Separate from identity.

| Action | Kind | Mutation |
|---|---|---|
| Back to Patients | Navigation to `/dashboard/patients` | None |
| Open preview-equivalent detail | Not needed on this page; the page is the record | — |
| Check-in | Existing link `buildFrontDeskCheckInHref` | None in 360 |
| Book appointment | Existing link when `appointment.view` | None until the schedule page saves |
| Counsellor | Existing link `buildCounsellorHandoffHref` | None. No `CounselorId`. |
| Continue encounter | Only when summary already has `assignedVisitId`. Existing route `.../encounter/[visitId]` | The encounter page can save. The header does not create a visit. |
| Print / PDF | Existing print route and summary export | Read. PDF still depends on `patient.export` at the API even though the button is not client-gated today. |

Do not put allergy delete, consent revoke, insurance verify, optical deliver, or note delete in the header. Those stay on their current sections until a mutation-migration slice (contract section 12). The blueprint does not remove them and does not feature them as primary 360 actions.

Favorite remains a directory-row control (`PUT /api/patients/{id}/favorite`), not a 360 header workflow.

---

## 6. Overview architecture

Overview is the landing section. It answers the following only from sources that exist, or it marks the block not integrated.

| Question | Target content | Supported now? |
|---|---|---|
| Who is this patient? | Identity band is always visible. Overview repeats MRN, Health ID, contact, and emergency contact in a short facts list so the answer survives if the header collapses on a small screen. | GREEN. Summary. |
| What happened recently? | A short timeline excerpt: the events `TimelineTab` can already merge, capped to a recent slice. Full list is the Timeline section. | YELLOW. Incomplete merge. |
| What is clinically relevant? | Latest OPD vitals if `patient_vital_signs` returned any; allergy list from `patient_allergies` as a list, not a new severity rule; a diagnoses block that shows both stores separately (section 7). | YELLOW. IP vitals not included. Diagnosis SoT open. |
| What active care is occurring? | Engagement labels and open visit from the summary bundle. | YELLOW. Snapshot, not a work queue. |
| What appointments or visits exist? | Next appointment and last visits from summary / recent visits / appointments API. | GREEN as lists. |
| What counselling activity exists? | Session count and last session date only when a counselling read is allowed and a by-patient read exists. | RED today. Block is **not integrated**, not “no counselling.” |
| What financial or insurance context is authorized? | Two lines with provenance: profile versus case versus pre-auth. Hidden entirely when the user lacks the domain permission, without saying whether a bill or a case exists. | Financial: YELLOW and the permission is open (PD360-R2). CCMS: RED. Profile: YELLOW (`patient_insurance`). |
| What documents or reports are recent? | Latest lab row and imaging order if those reads succeed. Document stores that are not wired are **not integrated**. | Lab GREEN. Imaging YELLOW. Documents RED. |
| What requires attention? | No new attention rules. The only attention-like items are existing data-quality flags and existing engagement labels. | Do not invent a worklist. |

`CcmGoalsWidget` and `CcmQualityWidget` (“API pending”) are not part of Overview. They are placeholders and would imply a clinical program the API does not serve.

Overview loads when the section is opened. It does not call every domain API on first paint (Slice 8 showed census cost is round trips; a 360 fan-out on load would repeat that pattern).

---

## 7. Clinical architecture

One Clinical section. Sub-blocks, in this order, because that is how a clinician scans a chart: problems and history, then observations, then treatments, then diagnostics, then optical and notes.

| Sub-block | Presentation | Source rule |
|---|---|---|
| Chart facts | Latest examination draft fields the summary already parses (VA / IOP), labeled as draft snapshot | `examination_drafts` via `PatientSummaryService`. Not the full exam. |
| Medical history | Examinations plus visits, which is what `MedHistoryTab` loads. Counselling `patient-medical-history` is a second API under counselling permissions. Show it only as a separate source block if that permission passes. | Do not merge the two histories into one list. |
| Vitals | One visual list, two source labels: **OPD** (`patient_vital_signs`, `GET /api/vitals/patient/{id}`) and **IP** (`vital_sign` by journey). | Do not merge tables. IP block stays **not integrated** until a by-patient read exists. |
| Allergies | Rows from `GET /api/patient-allergies/patient/{id}`. If the patient row also has allergy text, show that text as “Registration allergy text,” not as a second coded allergy. | Two representations. Provenance labels. |
| Diagnoses | Two lists until PD360-R5: “Diagnosis records” (`patient_diagnosis`, only if the diagnoses API is used) and “Examination diagnosis text” (`clinical_examinations`). | **DEPENDENT ON OPEN DECISION.** Neither list is captioned as the diagnosis history. |
| Examinations | `GET /api/examinations/patient/{id}`. Link onward to the existing examination route for that visit when one exists. | Read. Capture stays on Doctor’s Desk / examination pages. The examinations tab is hidden today (`HIDDEN_FROM_RECORD_SHELL`). |
| Medications and prescriptions | One sub-block, two headings only if the data differs. Today both `PharmacyTab` and `PrescriptionsTab` call `GET /api/prescriptions/patient/{id}`. | Do not show two identical lists. Inventory pharmacy bills are not this list. |
| Laboratory | `GET /api/lab-reports/patient/{id}` | Read. Report URL is a file pointer, also indexed under Documents with source Lab. |
| Imaging | `GET /api/Imaging/patient/{id}` orders. “Open in Imaging” goes to the existing imaging route when that route can take the order. The disabled Coming Soon button is not the target. | Viewer (`DICOMViewer` on the imaging page) stays outside 360. |
| Scanning / OCT | Only if `GET /octimaging/patient/{id}` is actually used. | RED. **Not integrated** until that client is wired. No empty “no scans.” |
| Optical | `GET /api/optical-orders/patient/{id}` | Context. Mark-delivered stays until the mutation slice. Not an optical POS. |
| Chart notes | `patient_notes` | Not counselling notes. |
| Clinical recommendations | Counsellor session sheet content (`ClinicalRecommendationsSheet`). | **Not integrated.** Not a diagnosis. |

Check-in gating of vitals, medications, labs, examinations, and prescriptions is a current client rule (`patient-record-gate.ts`) plus a role-name override that only `console.log`s. The target does not extend that override. Whether 360 keeps a check-in gate is an implementation question for the clinical slice. Default in this blueprint: show the reads the API allows; do not add a new gate; do not copy the role-name override into the new shell as if it were an audit.

---

## 8. Counselling architecture

Care section, read-only. No session create, no `CounselorId`, no reassignment (PD-H, Slice 3, contract section 6).

| Content | Where | Authorization |
|---|---|---|
| Session date, status, counsellor name, non-sensitive outcome | Care → Counselling history, and a single line on Overview | Counselling read permission. Not `patient.view` alone. **DEPENDENT ON OPEN DECISION** PD360-R3 for the exact code. |
| Notes | Care → Counselling history → row Sheet, source label “Counselling note” | Sensitive. PD360-R3. Distinct from `patient_notes`. |
| Quotes and decisions | Same Sheet, source label “Quote” or “Decision” | PD360-R3. Fields live on `counseling_sessions` and `session_price_overrides` / `patient_counselling`. |
| Documents | Documents section, group Counselling | PD360-R3. Store is `counseling_session_documents` by `session_id`. |
| Recording metadata | Care row, not a player in the list | Same authorization as the counselling recording workflow. |
| Playback / download | Sheet action | Same or stronger than that workflow. Retention **DEPENDENT ON OPEN DECISION** PD360-R1. |
| Transcript | Inside the recording Sheet | PD360-R3. Store `session_transcripts`. |
| AI summary | Not rendered | **NOT CURRENTLY AVAILABLE.** Do not use `clinical_summary`. PD360-R10. |

What is refused: waiting-list assignment, Start counselling, ReQueue, package edit, decision edit. The handoff is “View in Counsellor” to the existing waiting-list or single-session URL (`patient-handoff.ts`, `resolveCounsellorSessionHandoff`). That helper opens a session only when exactly one session matches. It does not start one.

Follow-up is a read-only line on the counselling history when the session source already marks follow-up. It does not embed the Follow-up Center.

Until a by-patient session read exists, the whole counselling block is **not integrated**.

---

## 9. Administration architecture

Administration holds events that register, schedule, consent, admit, or operate. It does not run those desks.

| Sub-block | Current source | Target behavior |
|---|---|---|
| Registration facts | `patient` row | Read-only echo of identity fields already in the header. Edit stays on the existing patient update path, not a new form in this blueprint. |
| Appointments | `GET /api/appointments/patient/{id}` | Current upcoming versus completed, using appointment `Status` already stored (`Cancelled` is excluded by some lookup filters; the list API should show status rather than hide history). |
| Scheduling | `PatientSchedulingTab` | Same list. Book is a handoff. |
| Check-in history | `visits` check-in timestamps | Visits list (`GET /api/visits/by-patient/{id}`). There is no separate check-in history API. Do not invent one. Label visit `checkedInAt` as check-in time when that column is present. |
| Consents | `patient_consents` | Active versus revoked using `revoked_at` / status on the row. Revoke stays until the mutation slice. |
| Admissions / IP history | `patient_journey` | Open journey is already on the summary. Full history is **not integrated**. `AdmissionsTab` Coming Soon is not the target UI. |
| OT / surgery | surgery requests today keyed by **name** | **Not integrated** on `patient.id`. Name search is not approved as identity. Do not surface `SurgeryTab`. |
| Pre-op documents | `pre_op_documents` by clearance | Documents group, source IP, when a later read exists. |

---

## 10. Financial architecture

Coverage section, left stack, titled **Financial**. Separate heading from Insurance.

Show, only when authorized, from authoritative bill and transaction reads:

- OPD bills for this `patient.id` (`opd_bills`), including amounts the bill API already returns (charges, payments, status). The blueprint does not define a new outstanding formula.
- A distinct IP stack from `ip_billing_transactions` by journey, labeled **IP financial transactions**, when a by-patient or by-journey read the user can call exists. Not a second ledger.

Do not design payment posting, refunds, adjustments, cashier steps, or invoice editing.

Visibility: `patient.view` plus the appropriate billing permission. The exact code is **DEPENDENT ON OPEN DECISION** PD360-R2.

If the user lacks that permission, omit the stack. Do not show “no bills,” zeroes, or a count. That would reveal financial existence.

Current conflict to preserve in the slice notes: `BillingTab` calls `GET /api/opdbills?patientId=` and that GET has no method permission beyond `[Authorize]`. The target is stricter than the code. The blueprint does not change the API.

---

## 11. Insurance architecture

Coverage section, right stack. Three groups. They are never one record and never one table.

| Group | Provenance label | Store | Visibility |
|---|---|---|---|
| Patient insurance profile | “Insurance profile” | `patient_insurance`, and any insurance columns already on `patient` if the summary shows them | Existing patient-level read (`patient.view` on `GET /api/patient-insurance/patient/{id}`). This is a profile copy, including CCMS sync. Caption it as a profile, not as the claim. |
| Coverage / case / claim | “Coverage case” | `ccms_coverage_cases`, CCMS documents | CCMS permission. **DEPENDENT ON OPEN DECISION** PD360-R4. Never loaded with a service account to bypass CCMS. |
| Pre-authorization | “Pre-authorization” | `insurance_pre_authorizations` | Owning insurance workflow’s permission. Census may already treat a non-terminal pre-auth as an engagement. That badge is not this list. |

Current / previous uses the status columns those APIs already return (`patient_insurance.status`, pre-auth terminal set in `PatientEngagementService`). Do not invent a new coverage lifecycle.

If CCMS has no by-patient read, the coverage group is **not integrated**, even when a profile row exists. The profile must not be described as “no coverage on file.”

Insurance documents appear under Documents with source CCMS or pre-authorization, same permission as the parent case or pre-auth. They do not appear for `patient.view` alone.

---

## 12. Document architecture

Documents is an index of independent stores. The page title and empty copy must not say that the hospital has one repository.

Each row, when a store is wired:

| Column | Required |
|---|---|
| Date | From that store’s timestamp |
| Type | Store-specific type field, not a new global enum |
| Title or name | As stored |
| Source | One of: Chart upload, Counselling, Lab, Imaging, Consent, Insurance profile attachment, CCMS, Pre-authorization, IP pre-op, Recording |
| Patient link | `patient.id`, or “via session / journey / case” when the row has no `patient_id` |
| Action | Preview or download only if that store’s existing download API allows the caller |

Grouping in the section: by source, not by a fake universal category. Filters are source and date. No upload drop zone. The current dashed upload area on `DocumentsTab` is not the target.

Permission follows the owning module. A counselling document is absent from the list for a user without that read, under the unauthorized pattern in section 18 (omit or a generic unavailable line, not a count).

| Integration state | Copy direction |
|---|---|
| Call succeeded, zero rows for that source | “No documents from {source}.” |
| Call failed, route missing, or controller not compiled | “{Source} is not available in Patient 360.” |
| User not allowed | Omit the source, or “Not available for your access.” Do not say whether files exist. |

`GET /patient-document-uploads/patient/{id}` fails today because the Phase 4 controller is excluded from compilation (`AuthService.csproj` `Compile Remove` of `_Phase4_Disabled`). The current tab turns that into an empty list. The target forbids that collapse.

Lab report URLs and imaging files are documents as well as clinical rows. Show them in both places with the same source label so the chart and the index do not disagree. Do not duplicate the file bytes.

Retention of files is **DEPENDENT ON OPEN DECISION** PD360-R1. No purge rule is designed here.

---

## 13. Communication architecture

A block inside Care, titled Communication. It is not a top-level module.

| Kind | Source | Target |
|---|---|---|
| Chart communications | `patient_communications` via `GET /api/patient-communications/patient/{id}` | List with type, direction, sent time, status. Read. The tab does not send today. |
| SMS / Call toolbar stubs | `QuickActionsToolbar` coming-soon modals | Not part of 360. Dead controls are omitted from the target action band. |
| Notification hub | SignalR `NotificationHub` | **Not integrated.** Do not treat hub toasts as this list until a slice proves they are persisted patient history. |

`patient_communications` and notifications stay separate headings if both are ever shown. The contract forbids equating them.

---

## 14. Timeline architecture

Timeline is a view over existing APIs. It is not a table and not an event bus.

A row has: timestamp, domain, event type, one-line summary, short context, provenance, and a handoff only when an existing route can open the owning module without creating state.

Initial population may include only what `TimelineTab` already fetches successfully: appointments, visits, examinations, prescriptions, OPD bills (if financial permission passes), consents, chart communications, lab reports.

Explicitly excluded until a read exists: counselling, CCMS, IP, OT, recordings, documents, imaging, vitals, insurance cases, surgery-by-name. `TimelineTab` already has filter labels for several of those without fetches. The target does not show those filters as if they worked. The surgery call `getByPatient` is not on `surgeryRequestsApi`. It is not part of the timeline.

Sort and correction: **DEPENDENT ON OPEN DECISION** PD360-R6. Until then, each row shows the timestamp field that API already returns (`checkedInAt`, appointment date, bill date, consent `granted_at`, and so on). The blueprint does not pick a global sort key or a correction policy.

Overview shows a short excerpt of the same rows. It is not a second timeline implementation.

Financial rows appear on the timeline only when the financial stack is authorized (PD360-R2). Otherwise they are omitted, not rendered as blank amounts.

---

## 15. Current versus historical state

Use the status and time fields the source already stores. Do not invent lifecycles.

| Domain | Current | History | Field to use | Do not invent |
|---|---|---|---|---|
| Medication / prescription | Status the prescription API returns as active or equivalent | Other statuses that API returns | Prescription status | A new “current meds” protocol |
| Insurance profile | `patient_insurance.status` active | Other stored statuses | That column | A merged “coverage is current” flag |
| Coverage case | CCMS state, when authorized and readable | Prior states only if CCMS already returns them | CCMS state | A local status copy |
| Pre-authorization | Non-terminal set already in `PatientEngagementService` | Terminal statuses already listed there (`approved`, `rejected`, `cancelled`, `closed`, `denied`) | Pre-auth status | A new auth workflow |
| Appointment | Status not completed and not cancelled, if that is how the appointments API marks open items | Completed, cancelled, as stored | `appointment` status | A new scheduling state |
| Visit | Not in `{completed, cancelled}` | Completed visits, which the Discharged census already treats with exact `"completed"` | `visits.status` | Do not redefine census (PD-B) |
| Counselling session | Non-terminal statuses already in the engagement service | Completed, cancelled, noshow | Session status | Ownership or a new session |
| Consent | Not revoked | `revoked_at` set | Consent row | Resurrecting a revoked consent as active |
| Note | Present | Deleted notes are gone unless the API still returns them | Delete is a write today | A soft-delete history that the API does not return. **DEPENDENT ON OPEN DECISION** PD360-R1 and PD360-R9 |
| Vital | Each row is an observation, not “current” versus “stopped” | The list is the history | Measurement timestamp and source label OPD or IP | Merging the two tables |

Registration `patient.status` is not “current patient” in the census sense. Census Current stays on the directory, not as a badge that means the same thing on 360.

---

## 16. Provenance model

Lightweight. A source badge on the row, plus the same word in the row’s detail Sheet. Not a banner on every section.

| Pair | Badge text | Where |
|---|---|---|
| OPD vital / IP vital | OPD · IP | Vitals list and timeline |
| Insurance profile / coverage case / pre-auth | Profile · Coverage case · Pre-authorization | Coverage stacks |
| Chart note / counselling note | Chart note · Counselling note | Notes and Care |
| Lab / imaging | Lab · Imaging | Clinical and Documents |
| Allergy table / registration text | Allergy record · Registration text | Allergies |
| Diagnosis table / examination text | Diagnosis record · Examination text | Diagnoses. Neither is “the” diagnosis. |
| Bill / IP transaction | OPD bill · IP transaction | Financial |

The detail Sheet repeats source, timestamp, and the handoff. Timeline metadata uses the same badge, not a new vocabulary.

---

## 17. Controlled handoff model

Handoffs are links. They use existing route helpers. They do not create a session, ownership row, queue item, bill, coverage case, appointment, or encounter.

| Label | Destination that already exists | Creates state? |
|---|---|---|
| Check in | `/dashboard/frontdesk/check-in?patientId=` | No |
| Book appointment | `/dashboard/appointments/schedule?patientId=` when `appointment.view` | No |
| View in Counsellor | Waiting list, or one session URL when `resolveCounsellorSessionHandoff` finds exactly one | No |
| Continue encounter | `/dashboard/patients/{id}/encounter/{visitId}` only if `assignedVisitId` is already set | Does not create the visit. The encounter page can save after arrival. |
| View appointment | Scheduling section or the appointments module | No |
| View in Imaging | Existing imaging route for an order, when the route accepts it | No. Do not enable the Coming Soon button as a fake link. |
| View in Billing | OPD billing route only as navigation, when the user may see financial context | No post, refund, or edit |
| View coverage | `/dashboard/ccms/cases/{id}` only when a case id was returned to an authorized user | No case create |
| View in OT / IP | Only when a journey or request id exists on an authorized read | No admit, no finalize |

If the destination id does not exist, the control is absent. It is not a button that creates the parent record.

Certified writes that remain on their current screens until a named slice: allergy delete, consent revoke, insurance verify, note flag/delete, optical deliver, encounter save, patient create/update, favorite, export, merge.

---

## 18. Empty, unauthorized, and not-integrated states

Three states. Different copy, different semantics. Color is not the only difference (icon or the words themselves).

| State | When | Copy pattern | Must not say |
|---|---|---|---|
| A. No data | The authorized call succeeded and returned an empty list | “No {things} recorded.” | “Not integrated” |
| B. Not authorized | The user lacks the domain permission | Omit the block, or “Not available for your access.” | Counts, “no bills,” “no recordings,” “no claim” |
| C. Not integrated | No by-patient API, call errored, controller excluded, or the client method does not exist | “{Source} is not available in Patient 360.” | “No history,” “No documents,” “No counselling” |

State C is the correct state today for counselling detail, CCMS cases, IP vitals, IP transactions, OCT, chart document uploads, surgery-by-id, notification history, and AI summary.

A failed document source is always C for that source, even if another source returned rows.

---

## 19. Desktop, tablet, and mobile

Use the current hospital portal stack: navy and emerald tokens, shadcn/Radix, Lucide, existing Sheet and Dialog. No new framework, font, or color system. Desktop-first for staff, same as other worklists. Patient portal patterns stay off this page.

**Desktop.** Persistent identity band. Primary nav as a horizontal or left section list of the seven items. Section sub-blocks as an in-page index. Tables for labs, bills, and documents with a source column. Row activation opens a right-hand Sheet (the filter Sheet pattern already used by `PatientAdvancedFilterSheet` and the counsellor detail sheets). Identity remains visible beside the Sheet.

**Tablet.** Identity band stays. Primary nav wraps or becomes a select of the seven sections. Subnav becomes the top of the section. Sheets still open from the trailing edge when width allows, otherwise full-width.

**Mobile.** Identity stacks (name, MRN, age/sex, then context). Primary nav is a compact select or scroll of section names, not thirty tabs. Tables become definition lists or cards. No horizontal table as the only way to read a bill or a lab. Actions in the header wrap into a menu that still has real accessible names.

Breakpoints follow existing `md` / `xl` usage on the directory (`PatientHubMobileCards`, preview dock). Do not invent a third responsive system.

---

## 20. Accessibility architecture

The target structure maps to existing requirements in `.cursor/rules/10-accessibility.mdc`. Implementation checks come with the slice, not with this document.

| Need | Architectural support |
|---|---|
| Keyboard | Section nav and subnav are real buttons or links in tab order. Row actions are buttons or links, not click-only table rows. |
| Focus | Radix Sheet and Dialog for row detail and any confirm that already exists. Focus returns to the invoking row. |
| Screen readers | One `h1` (patient name). Each section is an `h2`. Source groups are `h3`. Primary nav is a `nav` with an accessible name “Patient record.” |
| Tabs | If the seven items are tabs, they use a tablist pattern with the selected section exposed to the URL. Hidden Coming Soon tabs are not in the tablist. |
| Dialogs | Existing Radix primitives. No unlabeled overlay. |
| Status | Source badges include text (OPD, Profile, Chart note). Not color alone. |
| Zoom | Identity stacks before tables overflow. Cards on small widths. |
| Landmarks | `header` for identity, `nav` for sections, `main` for the section body. |
| Unauthorized omission | Removing a block does not leave an unlabeled gap. Authorized users still get headings for the blocks they can see. |

Encounter documentation remains a separate page. Its focus trap is out of scope for the 360 shell except that “Continue encounter” is a normal link.

---

## 21. Current-to-target component mapping

| Target section | Current component | Current API | Current source | Audit class |
|---|---|---|---|---|
| Page shell | `PatientRecordPage`, `PatientRecordProvider` | `GET /api/patients/{id}/summary`, recent visits | `PatientSummaryService` | YELLOW. Snapshot shell, wrong information architecture. |
| Identity header | `SummaryHeader` | summary | `patient` | GREEN for name, MRN, phone. Health ID not treated as a header peer today. |
| Overview | `PatientRecordOverview` | summary, consents widget, recent visits | summary bundle | YELLOW. CCM widgets are placeholders if used. |
| Clinical vitals | `VitalsFlowsheetTab` | `GET /api/vitals/patient/{id}` | `patient_vital_signs` | GREEN for OPD. IP RED. |
| Allergies | `AllergiesTab` | `GET /api/patient-allergies/patient/{id}` | `patient_allergies` | YELLOW. Also deletes. Registration text is a second source. |
| Diagnoses | `DiagnosesTab` (hidden) | `GET /api/examinations/patient/{id}` | examination text, not `patient_diagnosis` | RED for the diagnosis table. GRAY for which source wins (PD360-R5). |
| Examinations | `ExaminationsTab` (hidden) | `GET /api/examinations/patient/{id}` | `clinical_examinations` | YELLOW. |
| Medications | `PharmacyTab` | `GET /api/prescriptions/patient/{id}` | `prescription` | YELLOW. Same API as prescriptions. |
| Prescriptions | `PrescriptionsTab` | same | same | YELLOW. |
| Labs | `LabReportsTab` | `GET /api/lab-reports/patient/{id}` | `lab_reports` | GREEN. |
| Imaging | `ImagingTab` | `GET /api/Imaging/patient/{id}` | `imaging_orders` | YELLOW. Open-in-module control is disabled. |
| OCT | none on the record | `GET /octimaging/patient/{id}` exists as a client | oct imaging | RED. |
| Optical | `OpticalTab` | `GET /api/optical-orders/patient/{id}` | `optical_orders` | GREEN as a list. Deliver is a write. |
| Chart notes | `NotesTab` | `GET /api/patient-notes/patient/{id}` | `patient_notes` | GREEN. Writes exist. |
| Recommendations | `ClinicalRecommendationsSheet` on the counsellor session | session, not the record | counsellor session | RED on 360. |
| Medical history | `MedHistoryTab` | examinations + visits | those APIs | YELLOW. |
| Care visits | `VisitsTab` | `GET /api/visits/by-patient/{id}` | `visits` | GREEN. |
| Care encounters | `TimelineTab` as Encounters | mixed | mixed | YELLOW. |
| Counselling | `CounselingTab` (hidden) | none | Coming Soon badge | RED. |
| Communication | `CommunicationsTab` | `GET /api/patient-communications/patient/{id}` | `patient_communications` | YELLOW. Not the notification hub. |
| Documents | `DocumentsTab` (hidden) | `GET /patient-document-uploads/patient/{id}` | controller not compiled | RED. Empty list hides the failure. |
| Appointments | `PatientSchedulingTab` | `GET /api/appointments/patient/{id}` | `appointment` | GREEN. |
| Consents | `ConsentsTab` | `GET /api/patient-consents/patient/{id}` | `patient_consents` | GREEN. Revoke writes. |
| Admissions | `AdmissionsTab` (hidden) | none | Coming Soon | RED. |
| Surgery | `SurgeryTab` (hidden) | `getByPatientName` | name, and parent does not pass the name | RED. |
| Financial | `BillingTab` | `GET /api/opdbills?patientId=` | `opd_bills` | YELLOW. IP ledger RED. Permission GRAY (PD360-R2). |
| Insurance profile | `InsuranceTab` | `GET /api/patient-insurance/patient/{id}` | `patient_insurance` | YELLOW. |
| Coverage case | none | CCMS list has no patient filter | `ccms_coverage_cases` | RED. |
| Pre-authorization | census only | engagement service | `insurance_pre_authorizations` | YELLOW on the grid, RED as a 360 list. |
| Timeline | `TimelineTab` | nine calls, surgery method missing | partial | YELLOW. |
| Directory grid | `PatientHubPage` | `GET /api/patients/lookup` | lookup + engagements | Stays lean. Out of this page’s redesign except as the entry. |

---

## 22. Current-to-target API and source mapping

Reads the first 360 shell may call without a new API, when the user may already call them:

- `GET /api/patients/{id}/summary` (`patient.view`). Branch query is not `ResolveEffectiveBranchAsync` today.
- `GET /api/vitals/patient/{id}`
- `GET /api/examinations/patient/{id}`
- `GET /api/prescriptions/patient/{id}`
- `GET /api/lab-reports/patient/{id}` (`patient.view`)
- `GET /api/Imaging/patient/{id}` (`examination.view` on the controller)
- `GET /api/patient-allergies|notes|consents|communications|insurance/patient/{id}` (`patient.view`)
- `GET /api/optical-orders/patient/{id}`
- `GET /api/visits/by-patient/{id}`
- `GET /api/appointments/patient/{id}`
- `GET /api/opdbills?patientId=` (authenticated; billing permission not enforced on the method)

Reads that require a later API or a corrected client, and stay **not integrated** until then:

- Counselling sessions, notes, documents, quotes, decisions, recordings, transcripts by `patient.id`
- CCMS cases and CCMS documents by `patient.id`
- IP `vital_sign` by patient
- `ip_billing_transactions` by patient
- `patient_diagnosis` on the diagnosis block (the write API exists; the tab does not call it)
- OCT by patient on this page
- Surgery by `patient.id` (name lookup is rejected as the 360 key)
- Compiled document-upload list
- Notification history
- AI summary (no entity)

No new table is required for the shell. No `patient_events` table is proposed for implementation.

---

## 23. Target / current gap matrix

| Target domain | Target UX location | Current implementation | Source | API | Current authorization | Target visibility | Target mutation | Target handoff | Gap | Dependency | Future slice |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Identity | Header | `SummaryHeader` | `patient` | summary | `patient.view` on API; record page ungated | Everyone who can open 360 | None in header | Back to directory | Record route lacks `patient.view` | Security slice, not PD360 | Shell, then authorization |
| Demographics | Header + Overview | summary | `patient` | summary | `patient.view` | Same | Update stays existing patient PUT | None | Health ID not in header | — | Shell |
| OPD vitals | Clinical | `VitalsFlowsheetTab` | `patient_vital_signs` | `/vitals/patient/{id}` | write `patient.edit` | Clinical read | Encounter save stays | Continue encounter if visit id exists | Gate is client-side | — | Clinical |
| IP vitals | Clinical, badge IP | none | `vital_sign` | none by patient | IP service | Same clinical read when a safe API exists | None | View in IP when journey id exists | RED | By-patient or by-journey read | Missing API |
| Allergies | Clinical | `AllergiesTab` | `patient_allergies` | patient-allergies | `patient.view` / delete `patient.update` | `patient.view` | Delete remains until migration slice | None | Second text source | — | Clinical |
| Diagnoses | Clinical, two lists | `DiagnosesTab` hidden, wrong API | both stores | examinations only | — | Show both with badges | None | Open examination | RED / GRAY | PD360-R5 | Clinical, after decision |
| Examinations | Clinical | hidden tab | `clinical_examinations` | `/examinations/patient/{id}` | examination APIs | Read | Capture stays in exam module | Existing exam routes | Hidden | — | Clinical |
| Prescriptions | Clinical, one list | two tabs, one API | `prescription` | `/prescriptions/patient/{id}` | — | Read | Dispense stays in pharmacy | None from 360 | Duplicate UI | — | Clinical |
| Labs | Clinical + Documents | `LabReportsTab` | `lab_reports` | `/lab-reports/patient/{id}` | `patient.view` | Read | None | None | — | — | Clinical |
| Imaging | Clinical + Documents | `ImagingTab` | `imaging_orders` | `/Imaging/patient/{id}` | `examination.view` | That permission | None | Imaging route when real | Coming Soon button | — | Clinical |
| OCT | Clinical | none | oct client | `/octimaging/patient/{id}` | not on record | Read if API allows | None | None | RED | Wire existing client | Clinical |
| Optical | Clinical | `OpticalTab` | `optical_orders` | optical-orders | `patient.view`; deliver writes | Read | Deliver remains for now | Optical module later | Operational write on chart | Mutation slice | Clinical |
| Chart notes | Clinical | `NotesTab` | `patient_notes` | patient-notes | `patient.view` / writes `patient.update` | Read | Flag/delete remain | None | — | PD360-R1 if history of deletes | Clinical |
| Recommendations | Clinical, not integrated | counsellor sheet only | session | none on record | counselling | Read-only context | None | View in Counsellor | RED | PD360-R3 | Care |
| Visits | Care | `VisitsTab` | `visits` | `/visits/by-patient/{id}` | authorize class | Read | Check-in is a link | Front desk | — | — | Administration overlap; data is Care |
| Encounters timeline excerpt | Overview + Timeline | `TimelineTab` | mixed | mixed | mixed | Per domain | None | Per row | Incomplete | PD360-R6 | Timeline |
| Counselling | Care | Coming Soon tab | `counseling_sessions` | session child APIs, not by patient on the record | session permissions | PD360-R3 | Never ownership | `patient-handoff.ts` | RED | PD360-R3, by-patient read | Care |
| Recordings / transcripts | Care Sheet | counsellor session page | `session_recordings`, `session_transcripts` | `Counseling` recordings, `Transcription` | recording / transcription permissions | Same or stronger | None | View in Counsellor | RED | PD360-R1, PD360-R3 | Care |
| AI summary | Omitted | none | none | none | — | Hidden | None | None | NOT CURRENTLY AVAILABLE | PD360-R10 | Do not schedule |
| Quotes / decisions | Care Sheet | none on record | session columns, price overrides | counselling decision API | counselling | PD360-R3 | None | View in Counsellor | RED | PD360-R3 | Care |
| Documents | Documents | hidden tab, empty on error | many stores | mostly not by patient | per store | Per store | No upload | Owning module | RED | PD360-R1 | Documents |
| Appointments | Administration | `PatientSchedulingTab` | `appointment` | `/appointments/patient/{id}` | `appointment.view` for book | Read | None | Schedule page | — | — | Administration |
| Consents | Administration | `ConsentsTab` | `patient_consents` | patient-consents | `patient.view` / revoke `patient.update` | Read | Revoke remains | None | — | PD360-R1 | Administration |
| Admissions | Administration | Coming Soon | `patient_journey` | summary shows open only | journey APIs | Read | None | IP when id exists | RED for history | By-patient history read | Missing API |
| Surgery / OT | Administration, not integrated | `SurgeryTab` by name | surgery request | name route | — | Only with `patient.id` | None | OT/IP when id exists | RED | Reject name key | Missing API |
| OPD financial | Coverage | `BillingTab` | `opd_bills` | `/opdbills?patientId=` | `[Authorize]` only | `patient.view` + billing permission | No post/refund | Billing module, navigate only | Permission gap | PD360-R2 | Financial after R2 |
| IP financial | Coverage | none | `ip_billing_transactions` | not by patient | IP billing | Same financial permission | None | IP billing | RED | Read path + PD360-R2 | Missing API |
| Insurance profile | Coverage | `InsuranceTab` | `patient_insurance` | patient-insurance | `patient.view`; verify `patient.update` | Profile read | Verify remains | None as a claim action | Copy vs case | — | Insurance |
| CCMS | Coverage | none | `ccms_coverage_cases` | no patient filter | CCMS | PD360-R4 | None | Case route if returned | RED | PD360-R4, API | Insurance |
| Pre-auth | Coverage | census badge only | `insurance_pre_authorizations` | engagement load | engagement inside `patient.view` summary | Owning permission for the list | None | Insurance workflow | List not on record | Permission matrix | Insurance |
| Communications | Care | `CommunicationsTab` | `patient_communications` | patient-communications | `patient.view` | Read | No SMS stub | None | Not the hub | — | Care |
| Notifications | Care, not integrated | hub elsewhere | notification hub | none as patient history | — | Omit | None | None | RED | Prove a store before UI | Not in first slices |
| Directory census | Unchanged | `PatientHubPage` | lookup | `/patients/lookup` | `patient.view` | Unchanged | Favorite only | Into 360 | PD-B, PD-C, PD-D hold | PD360-R8 later | Not this blueprint’s build |
| Add Patient | Directory, not 360 | modal, `/new`, other modals | `POST /api/patients` | create | `patient.create` | One primary later | Create stays | — | Three paths | PD360-R7 | Separate create slice |
| Branch scope | Header context | selected branch | user branches | `ResolveEffectiveBranchAsync` on lookup, not on summary | user branches | No silent cross-branch history | None | — | Null branch included | PD360-R8, PD-B | Authorization validation |

---

## 24. Open decision dependencies

Do not implement past these marks.

| ID | Blocks |
|---|---|
| PD360-R1 | Recording retention copy, whether deleted notes or revoked consents remain visible, document retention |
| PD360-R2 | Whether the Financial stack renders at all, and which existing permission is checked. Do not invent a code. |
| PD360-R3 | Which counselling permission shows session metadata versus notes, quotes, decisions, documents, recordings, transcripts |
| PD360-R4 | Whether Coverage cases and CCMS documents render |
| PD360-R5 | Any single diagnosis history. Until then, two labeled lists only, and only when each API is actually called. |
| PD360-R6 | Timeline sort and corrections |
| PD360-R7 | Which Add Patient path is canonical. 360 does not include create. |
| PD360-R8 | Null-branch and cross-branch history. Census predicates stay (PD-B). |
| PD360-R9 | What 360 shows after a hard delete |
| PD360-R10 | Any AI summary block. Until a source exists, the block is omitted |

---

## 25. Recommended implementation slices

Not authorized. Order follows dependencies in the repository, not a wish to build the full chart at once.

| Slice | Scope | Depends on | Out of scope |
|---|---|---|---|
| 1. Shell | Seven-section frame, identity header, state C for every unwired block, no Coming Soon. Existing certified writes remain reachable so they are not silently removed. | None of the open clinical decisions | New APIs, nav move, census, grid |
| 2. Overview | Facts, engagement snapshot, short excerpt of the timeline sources that already work | Shell | Counselling and CCMS lines (those stay state C) |
| 3. Clinical reads | Vitals OPD, allergies with both labels, one prescription list, labs, imaging orders, examinations list, chart notes. Diagnoses as two lists only if both APIs are called without naming a winner. | Shell. PD360-R5 before any merged diagnosis UX | IP vitals, optical deliver removal |
| 4. Administration reads | Appointments, visits, consents | Shell | Admissions history, surgery-by-name |
| 5. Communication read | `patient_communications` only | Shell | Notification hub, SMS |
| 6. Authorization | `patient.view` on the record route. Summary branch check. Financial stack hidden until PD360-R2 names a permission. No service-account bypass. | PD360-R2 before showing money | New permission codes |
| 7. Financial context | OPD bill list, read-only, after R2 | Slice 6 | Payments, IP ledger until a read exists |
| 8. Insurance profile | Profile stack with provenance caption. Pre-auth list only with its own permission. CCMS stays state C. | PD360-R4 before cases | Merging stores |
| 9. Care counselling | Read-only session context after a by-patient read and PD360-R3 | New or existing read that does not set `CounselorId` | Start, assign, quotes edit |
| 10. Documents | Per-source index and honest failure copy | Per-store permission | New repository, Phase 4 revival without a decision |
| 11. Timeline | Same events as the wired sections, one component shared with Overview excerpt | PD360-R6 before a global sort | `patient_events` |
| 12. Missing APIs | Only IP vitals, IP transactions, CCMS-by-patient, counselling-by-patient, surgery-by-id, diagnosis read if still unused | Proof the table exists and the key is `patient.id` or an approved parent id | Writes |
| 13. Mutation migration | One write at a time off 360, with UAT | Separate decision per write | Visual shell work |
| 14. Navigation placement | PD-A menu move | Separate approval | Route rename |
| 15. Performance | Measure the 360 section pattern. Do not repeat Slice 8 as an index project. | A shell that loads on demand | Materialized timeline |
| 16. UAT | Directory handoffs unchanged, state C copy, no ownership writes, financial omission, two diagnosis labels | Prior slices | — |

Shell and Overview can proceed before R2–R5 because unwired and undecided domains stay in state C or in two labeled lists. Financial, CCMS, counselling detail, and a merged diagnosis view cannot.

---

## 26. Risks

- Building seven sections that call every API on load repeats the Slice 8 round-trip cost on a page that is heavier than census.
- Reusing `DiagnosesTab` as “diagnosis history” silently picks examination text (PD360-R5).
- Reusing `DocumentsTab` teaches users that an error is an empty chart.
- Reusing `SurgeryTab` joins the wrong patient.
- Showing `patient_insurance` as coverage hides CCMS.
- Showing `clinical_summary` as an AI summary invents a source.
- Putting optical deliver, consent revoke, or allergy delete in the new header makes 360 look like the operational module.
- A counsellor handoff that posts `CounselorId` breaks PD-H and Slice 3.
- Omitting financial data with the words “no bills” discloses that billing exists.
- Moving the sidebar while building the shell mixes PD-A with the chart and is out of scope.

---

## 27. Explicit non-goals

This blueprint does not authorize implementation, a prototype, a route change, a permission change, a navigation move, a census change, a new API, a new table, an event bus, a document repository, a timeline store, removal of current writes, removal of hidden tab components, Counsellor ownership changes, billing or insurance operations, a clinical source-of-truth choice, an AI summary, or a change to certified Slices 1–8.

Add Patient unification (PD-E, PD360-R7) is a directory concern. It is not a section of this page.

---

## Stop

No application behavior was changed by this document.
