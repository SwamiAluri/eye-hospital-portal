# Patient 360 Product Decision Contract

Document type: Product Decision Contract  
Date: 2026-09-29  
Phase 1I decision record: 2026-09-30  
Status of this file: decision record only  

Application code changed by this file: **NO**  
Database, APIs, routes, permissions, UI, migrations, tests: **NO**  
Manual UAT: **NOT EXECUTED**  
Acceptance of an implementation slice: **NOT RECORDED**  
Insurance Profile implementation: **NOT STARTED**

This contract records product and security direction. It does not change application behavior. Phase 1I records decisions that later Coverage slices may follow. It does not start those slices.

Evidence base (authoritative for repository facts, not for new business rules):

- Patient Directory Slices 1–8 (stabilization and measurement)
- `docs/audits/patient-directory-master-forensic-redesign-audit.md`
- Patient 360 source-of-truth and cross-module integration forensic audit (session record, 2026-09-29; not a separate file)
- `docs/audits/patient-360-coverage-financial-insurance-audit.md` (Phase 1H, read-only)
- `docs/design/patient-360-information-architecture.md`
- Existing permission attributes on billing, patient insurance, and CCMS, and seeded codes in `consolidated/migrations/127_ccms_permissions.sql`
- `.cursor/rules/09-coverage-claims-ux.mdc` and `.cursor/rules/10-accessibility.mdc`

Status labels used below:

| Label | Meaning |
|---|---|
| **APPROVED** | Recorded as already approved (section 2, PD-A–PD-H) or approved in Phase 1I (section 21). Not reopened here. |
| **APPROVED FOR PATIENT 360 IMPLEMENTATION** | A Phase 1I rule a later slice may implement. This file does not implement it. |
| **Proposed decision for implementation** | The original decision request marked the rule RECOMMENDED and no alternative was supplied. It is the proposed direction of this contract. It is **not** a previously certified business rule from Slices 1–8. Where Phase 1I supersedes a proposed rule, section 21 says so. |
| **DECISION REQUIRED** | The repository and the decision record do not settle the rule. A later Product, Security, Clinical, or Compliance approval is still required. |
| **Future architectural note** | A possible later design. It is not approved and not in scope. |
| **Out of scope** | Explicitly excluded from the decision and from the next slices until a separate decision exists. |

---

## 1. Product north star

**APPROVED** as the product direction for the redesign program.

The Patient Directory is the hospital-wide patient discovery surface and the longitudinal Patient 360 context surface.

It is intended to show an accurate, consolidated view of information and history produced across the hospital, in these groups:

- Clinical: overview, vitals, medical history, allergies, diagnoses, examinations, medications, prescriptions, laboratory, imaging, scanning / OCT where a real source exists, optical, clinical recommendations, clinical notes, medical records, clinical documents
- Counselling: sessions, counsellor notes, counselling documents, quotes, decisions, conversation recordings, transcriptions, AI summaries only where an authoritative source actually exists
- Administration: registration, encounters, visits, scheduling, appointments, check-in history, consents, relevant administrative history
- Financial: billing, invoices, charges, payments, financial transactions
- Insurance: insurance details, insurance history, pre-authorizations, claims, insurance documents
- Communication: communications, messages, notifications, relevant communication history
- IP / OT / follow-up: admissions, IP history, IP clinical data, IP financial data, surgery / OT history, follow-up history, relevant referrals

Patient 360 is a **longitudinal context surface**.

It is not a replacement for Counsellor, Billing, Insurance / CCMS, Doctor’s Desk, Front Office, Laboratory, Imaging, Optical, OT, IP, or Communications. Operational work remains in the owning module. Patient 360 is intended to reflect authoritative changes made by those modules when the user is allowed to see that information.

**Current repository fact, not the target.** The record route today cannot show that complete history. Counselling artifacts, CCMS cases, IP financials, IP vitals, recordings, transcripts, and a unified document list are not loaded by Patient Record. That gap is why this contract exists. It is not evidence that the target is already built.

---

## 2. Approved decisions A–H

These are **APPROVED**. This contract does not reopen them. None of them have been implemented by this document. Navigation, census SQL, the grid, the Assigned-to-me predicate, create routes, and the record shell stay as they are until a later authorized slice.

### PD-A — Navigation

Patient Directory is a shared hospital-wide Patients destination. It is not conceptually owned by Doctor’s Desk.

Current code still places the sidebar item under Doctor’s Desk (`sidebar-menu-sections.tsx`, permission `patient.view`). PD-A does not authorize a menu move in this contract.

### PD-B — Census

Existing census predicates remain unchanged initially.

All, Current, New, Discharged, and High priority keep the predicates implemented in `PatientLookupService.ApplyTabFilterAsync` and `PatientEngagementService.GetCurrentPatientIdsAsync`. Labels may mislead. Renaming or redefining them is out of scope until a later decision.

### PD-C — Grid

The discovery grid stays lean: patient identity and concise operational signal(s). Full history belongs in Patient 360, not in the grid.

### PD-D — Assigned to me

“Assigned to me” means **My Assigned Visits**.

It is open `Visit.AssignedTo` for the current user. It is not Counsellor ownership and must not be presented as Counsellor ownership.

### PD-E — Create

There will be one canonical Add Patient experience.

See section 13 for the proposed path. This approval does not remove or redirect any current create route.

### PD-F — Patient Record

The Patient Record becomes the Patient 360 longitudinal context surface.

Operational workflows remain in their owning modules.

### PD-G — Reflection of authoritative updates

Patient Directory must reflect authoritative updates from other hospital modules where the user is authorized to see that information.

Current fact: reflection is request-time on the APIs a tab actually calls. Queue SignalR on the directory page invalidates `patient-lookup` keys only. Record tabs do not subscribe. PD-G does not authorize a new event bus.

### PD-H — No competing workflows

Patient Directory must not create competing ownership, queue, billing, insurance, counselling, clinical, or OT workflows.

This matches the certified Slice 3 handoff rule already in `patient-handoff.ts`: check-in and counsellor navigation do not create a visit, a counselling session, or a `CounselorId`.

---

## 3. Patient 360 definition

**Proposed decision for implementation**, consistent with approved PD-F and PD-H.

Patient 360 is the longitudinal read/context surface at `/dashboard/patients/[id]` (`PatientRecordPage`), reached from discovery at `/dashboard/patients` (`PatientHubPage`).

It shows patient context the user is authorized to see, with provenance when more than one store could be confused, and with a handoff into the owning module for operational work.

It does not become a second Counsellor desk, cashier, CCMS desk, examination workspace, queue board, optical POS, OT board, or IP chart.

Empty or failed integration must not be labeled as “no history.” If a domain is not wired, the surface must be able to say that it is not available from Patient 360. Copy and UI for that distinction are not authorized here.

---

## 4. Source-of-truth principle

**Proposed decision for implementation.**

```text
authoritative module
        ↓
existing authoritative data / service / API
        ↓
Patient 360 read / context surface
```

- `patient.id` (UUID on auth-service table `patient`) remains the canonical patient identity unless a later approved decision explicitly changes that.
- MRN (`medical_record_number`) and Health ID (`health_id`) remain identifiers on that row. MRN is not the primary key. The tenant MRN index is not unique (Slice 7).
- Patient 360 must not create a duplicate operational database, a second engagement store, or a `patient_events` table in order to look complete.
- A new read API is justified only when authoritative data already exists and cannot be read by patient id. That justification is not an authorization to build the API in this phase.
- Existing copies stay until a later decision. They are not a pattern to extend. Known copies: `patient_insurance` (including CCMS sync into that table) versus `ccms_coverage_cases`; allergy text on `patient` versus `patient_allergies`; examination diagnosis text versus `patient_diagnosis`; OPD `patient_vital_signs` versus IP `vital_sign`.

---

## 5. Visibility and security decisions

### 5.1 Financial data

**APPROVED FOR PATIENT 360 IMPLEMENTATION** (Phase 1I, PD360-R2). This supersedes the earlier proposed wording that left the billing code unnamed. History is in section 21.

Patient 360 financial context requires both existing permissions:

- `patient.view`
- `bill.update`

`patient.view` alone does not grant Patient 360 financial details.

`bill.update` is a Patient 360 visibility gate only. It does not authorize payment, refund, adjustment, bill mutation, cashier workflow, or using Patient 360 as the billing desk. Patient 360 financial context stays read-only.

`bill.create` is not the visibility gate. `bill.admin` is not the visibility gate. Do not invent `bill.read` or `bill.view`.

**Future architectural note.** A dedicated `bill.read` permission would separate viewing from cashier update. Creating that permission is **out of scope** and needs a separate security decision.

**Repository fact, not changed by this record.** `GET /api/opdbills?patientId=` is class `[Authorize]` without a method `RequirePermission`. `BillingTab` already calls that GET. The live API is wider than this approved Patient 360 gate. Patient 360 must not show bill rows until a later security slice aligns that GET with `bill.update` and preserves existing Billing behavior. `ip_billing_transactions` stay keyed by journey and are not an independent patient ledger.

### 5.2 Cross-branch history

**Proposed decision for implementation.**

Patient 360 is governed by effective branch authorization. The same `patient.id` does not by itself allow the user to see another branch’s protected history. Visibility follows the existing authorized-branch model.

Do not change branch semantics in this phase.

**Repository tension, not a change.** Directory lookup includes patients with `BranchId == null` in every selected branch. Summary `branchId` is not passed through `ResolveEffectiveBranchAsync`. IP journeys and counselling sessions also match null branch. Those are current semantics (PD-B says census predicates stay). The proposed rule requires later implementation validation. It does not rewrite `BuildBasePatientQuery` now.

### 5.3 Deleted, revoked, and historical rows

**Proposed decision for implementation.**

Patient 360 distinguishes active current data from historical audit data.

- Do not silently resurrect deleted records.
- Do not present revoked or removed data as currently active.
- Where the owning module already keeps an authoritative history, Patient 360 may show that history under the same authorization as the owning module.
- Do not invent retention behavior.

**DECISION REQUIRED FROM PRODUCT / SECURITY / COMPLIANCE:** retention and deletion policy where the repository has not defined it. Evidence that policy is incomplete: notes can be deleted, consents can be revoked, `patient.deleted_at` exists, and `DeletePatientAsync` hard-deletes the patient row. Those behaviors are not one policy.

### 5.4 Recordings — playback and download

**Proposed decision for implementation.**

Patient 360 may show recording metadata only to users authorized for the counselling recording workflow. Playback and download require the same or stronger authorization as that workflow.

**DECISION REQUIRED FROM PRODUCT / SECURITY / COMPLIANCE:** retention period. It is not established in the repository. Do not create one in this contract.

---

## 6. Counsellor boundary

**Proposed decision for implementation.**

Patient 360 may expose counselling history as **read-only context**. The certified Counsellor ownership model is unchanged.

| Content | Proposed visibility |
|---|---|
| Session date, status, counsellor, relevant non-sensitive outcome | Counselling read permission. Not `patient.view` alone |
| Detailed notes, recordings, transcripts, counselling documents, quote details, decision details | Counselling-specific permissions for that content |

Hard prohibitions, aligned with PD-H and Slice 3:

- Patient 360 never sets `CounselorId`.
- Patient 360 never starts counselling.
- Patient 360 never reassigns counselling ownership.

**Current fact.** The record does not load sessions, `counseling_session_notes`, `counseling_session_documents`, `session_price_overrides`, decision columns, `session_recordings`, or `session_transcripts`. Child rows are keyed by `session_id`. The parent session has `patient_id`. Closing that gap is a later integration slice, not this contract.

---

## 7. Billing boundary

**APPROVED FOR PATIENT 360 IMPLEMENTATION** for the source and the read-only boundary (Phase 1I). Branch visibility of bills remains **DECISION REQUIRED** under PD360-R8. This section does not resolve it.

- Billing operations stay in Billing. IP billing stays on the journey and billing owner (`.cursor/rules/04-ip-management-ux.mdc`, `.cursor/rules/09-coverage-claims-ux.mdc`).
- After the OPD bill GET is aligned with section 5.1, Patient 360 may show that existing patient-id bill list as read-only context. Do not calculate a new balance from bill rows or from insurance profile amounts.
- OPD `opd_bills.patient_id` is that source (`GET /api/opdbills?patientId=` via `opdBillsApi.getByPatient`). It is not the IP transaction ledger.
- `ip_billing_transactions` stays keyed by `PatientJourneyId`. Do not present them as an independent patient financial ledger.
- Do not use orphan client URLs in `billing.api.ts` (`/patients/{id}/account`, `/patients/{id}/insurance-policies`, `/claims/*`) as sources. The Phase 1H audit found no matching controllers.
- CCMS billing allocation (`ccms.billing.read`, case-scoped) is payer allocation, not cash billing.
- Do not expose refunds as a separate Patient 360 financial workflow. No patient-id refund read was found.
- Patient 360 must not post payments, refunds, or adjustments, and must not show those controls because the viewer has `bill.update`.

---

## 8. Insurance boundary

**APPROVED FOR PATIENT 360 IMPLEMENTATION** for the profile source, the CCMS permission map, and the pre-authorization deferral (Phase 1I). The three stores stay separate.

| Layer | Authoritative store | Patient 360 rule |
|---|---|---|
| Patient insurance profile | `patient_insurance` | Read-only from `GET /api/patient-insurance/patient/{patientId}` with `patient.view`. Caption it as a profile, not a claim and not a patient balance |
| Registration insurance text | Columns on `patient`, subset already on the summary | Keep labeled as registration data. Do not merge with `patient_insurance` into one history |
| Coverage / case / claim / CCMS documents / eligibility / settlement / CCMS billing allocation | CCMS entities, not the profile table | Only with the existing granular permission named in section 21. Never via `patient.view` alone. Do not call the live GETs until those GETs enforce the matching `ccms.*.read` code |
| Pre-authorization | `insurance_pre_authorizations`, `insurance_preauth_requests`, and CCMS authorization | **Out of Patient 360** until a dedicated patient-id read and an explicit permission decision exist. Do not merge the three stores. Do not use the census engagement query or a session GET as the history |

Do not merge these into one insurance table.

Patient 360 must not call insurance profile verify, create, update, or delete. Those stay on Existing record tools (`InsuranceTab`, `patient.update` on verify).

Policy money fields returned by the profile GET may be shown as policy values only: copay, deductible, deductible met, out-of-pocket maximum, out-of-pocket maximum met. They are not account balance, billing balance, amount due, cash balance, outstanding bill, or payment status. Do not derive a new patient balance from them. Billing remains the financial ledger (section 7).

**Current fact, unchanged.** CCMS list has no patient-id filter. `ListAsync` filters state, payer type, and search, including `PatientName` text. There is a by-session lookup. Showing CCMS through a privileged service identity or `X-Internal-Key` is forbidden. Name search is not a patient-id relationship.

**Out of scope until a later slice:** a generic Pre-authorization or Authorization history block on Patient 360.

---

## 9. Clinical boundary

### 9.1 What 360 may reflect

**Proposed decision for implementation**, without choosing a winner where the audit found two stores.

Clinical context on Patient 360 is read from the owning clinical workflow. Doctor’s Desk, optometry examination, laboratory, and imaging keep operational capture. Patient 360 does not become the exam workspace.

Known owning stores from the forensic audit:

| Concern | Store | Record today |
|---|---|---|
| OPD vitals | `patient_vital_signs` via `VitalsController` | Vitals tab reads. Encounter page can write |
| IP vitals | `vital_sign` by `journey_id`, no `patient_id` | Not on the flowsheet |
| Examinations | `clinical_examinations` | API exists. Examinations tab is hidden from the shell |
| Prescriptions | `prescription` / `prescription_medication` | Medications and Prescriptions tabs both GET this API |
| Pharmacy stock / pharmacy bills | inventory `inv_pharmacy_bills` | Not the Medications tab |
| Labs | `lab_reports` | Lab tab |
| Imaging orders | `imaging_orders` | Imaging tab lists orders. Viewer is not this tab |
| OCT | oct-imaging patient API | Record does not call it |
| Chart notes | `patient_notes` | Notes tab, including writes |
| Clinical recommendations | counsellor session sheet | Not on the record |
| Diagnoses | `patient_diagnosis` **and** diagnosis text on examinations | Diagnoses tab reads examinations, not `patient_diagnosis` |

### 9.2 Diagnoses

**CLINICAL PRODUCT DECISION REQUIRED.**

Patient 360 must not silently choose between `patient_diagnosis` and examination diagnosis text. Do not delete either source. Do not merge them. Do not present either as the definitive diagnosis history until a clinical product owner approves one rule.

### 9.3 Vitals

**Proposed decision for implementation.**

Target presentation is one vital history that keeps source context, for example an OPD row and an IP row. Do not merge or overwrite `patient_vital_signs` and `vital_sign`. Each row remains owned by the workflow that wrote it.

This target does not authorize a unified vitals API in this phase.

---

## 10. Document boundary

**Proposed decision for implementation.**

There is no single patient document repository in the current system. Patient 360 must not pretend there is one, and must not create one under this contract.

Independent stores identified in the forensic audit include: `patient_document_uploads` (entity only; Phase 4 controller excluded from compilation), `counseling_session_documents`, `session_recordings` (container `session-audio`), `ccms_documents`, `insurance_documents`, lab report URLs, imaging files, consent URL columns, IP `pre_op_documents`, and patient photo blobs.

Documents on Patient 360, when a later slice adds them, are read-only lists from those owning stores, under that store’s authorization. Upload, replace, and delete stay in the owning workflow. The current Documents tab calls `GET /patient-document-uploads/patient/{id}` and treats failure as an empty list. That empty list is not proof of no documents.

---

## 11. Timeline principles

**Proposed decision for implementation.**

Patient 360 should ultimately provide a longitudinal timeline built from authoritative domain data, not from fabricated events and not from a new `patient_events` table.

Each item, when implemented, identifies date/time, domain/source, event type, relevant context, and a handoff to the owning module when that handoff already exists.

**DECISION REQUIRED** later, from the timestamps those sources actually have: sort order, ties, and how corrections replace or append. Do not invent that semantics here.

**Current fact.** `TimelineTab` is the visible Encounters tab. It merges, at request time, appointments, visits, examinations, prescriptions, OPD bills, consents, communications, and lab reports. Surgery is called with a client method that does not exist. Imaging, vitals, insurance, counselling, CCMS, IP, OT, recordings, and documents are not in that merge. Filter labels for several of those types exist without fetches.

---

## 12. Operational mutation principles

**Proposed decision for implementation.**

Patient 360 is primarily a read/context surface (PD-F, PD-H).

Operational mutations should move to the owning module only through a later bounded decision and UAT for that mutation. Do not remove a write as part of a visual redesign.

Writes that exist today and are **not** removed by this contract:

| Write | Where |
|---|---|
| Allergy delete | Allergies tab → `patient-allergies` |
| Consent revoke | Consents tab |
| Insurance verify | Insurance tab → `patient_insurance`, not a CCMS case transition |
| Notes flag and delete | Notes tab |
| Optical mark delivered | Optical tab |
| Encounter documentation and vitals save | `EncounterPage`, not the directory grid |
| Create patient, update demographics, favorite, export, merge | existing patient APIs, behind their current permissions |

Favorite is personal directory state (`patient_favorites`), not a clinical workflow. Handoffs (check-in, book, counsellor link) remain navigation.

---

## 13. Add Patient decision

**APPROVED** (PD-E): one canonical Add Patient experience.

**Proposed decision for implementation:** the primary action is the Patient Directory Add Patient control. The implementation path that is safest to preserve stays in place until a replacement is verified. Do not remove duplicate routes in this phase.

**Current paths, none removed:**

- Hub `PatientFormModal` (the live Add Patient button, `patient.create`)
- `/dashboard/patients/new` (`NewPatientPage`, no page-level permission gate found)
- Additional `NewPatientModal` components under `components/patients` and `components/modals`

Which of these becomes the single internal implementation is **DECISION REQUIRED** in the later slice that actually unifies create. This contract only forbids adding a fourth create workflow and forbids deleting the existing ones now.

---

## 14. AI summary decision

**Proposed decision for implementation.**

Patient 360 must not fabricate AI summaries.

An AI summary may be shown only after a later approval that supplies an authoritative source, provenance, generation timestamp, authorization, and an identifiable source recording or session.

Until that source exists: **AI Summary = NOT CURRENTLY AVAILABLE.**

**Repository evidence.** No recording-specific AI summary entity was found. `counseling_sessions.clinical_summary` is a different jsonb snapshot. Counsellor conversation UI coverage does not treat an “AI Summary” section as present. Do not create an AI summary model under this contract.

---

## 15. Target Patient 360 domain model

This is the **target** information architecture. It is not a claim about current tabs.

**Patient identity.** Demographics, contact, emergency contact, MRN, Health ID, branch context.

**Clinical.** Overview, medical history, vitals (OPD and IP, source kept), allergies, diagnoses (after the clinical decision), examinations, medications, prescriptions, labs, imaging, scanning where a source exists, optical, clinical notes, clinical recommendations.

**Care and counselling.** Visits, encounters, counselling sessions, counsellor context, follow-up, relevant counselling history. Context only. No ownership writes.

**Documents.** Medical, counselling, lab, imaging, insurance, consent, and other authoritative patient documents, each from its owning store.

**Administration.** Appointments, scheduling, check-in history, consents, admissions, IP history, OT/surgery history.

**Coverage.** One top-level section only. Inside it, two stacks: Financial and Insurance. Financial is not an eighth nav item. Insurance is not an eighth nav item. Claims and pre-authorization are not top-level items (Phase 1I). Pre-authorization stays out of the section until section 8’s deferral is lifted. Financial content waits on the `bill.update` alignment in section 5.1. Insurance profile is the first stack that the sequence in section 21 allows. CCMS case, claim, eligibility, document, settlement, and CCMS billing groups stay not integrated until their server reads enforce the named `ccms.*.read` codes and a patient-id query exists.

**Financial.** Inside Coverage. Billing context from the existing OPD patient-id read after section 5.1 alignment. IP financial context only through the journey ledger, not a copied ledger. No new balance.

**Insurance.** Inside Coverage. Patient insurance profile from `patient_insurance`. Coverage, claims, and insurance documents stay separate layers (section 8) and are not shown early. Pre-authorization is not a Patient 360 block yet.

**Communication.** Communications, messages, notifications, relevant communication history. The current `patient_communications` list is not the notification hub history. Do not equate them until a slice proves they are the same store.

**Timeline.** Chronological history with source, event, timestamp, context, and an authorized handoff. No `patient_events` table in this phase.

---

## 16. Explicit non-goals

This contract does **not** authorize:

- Frontend redesign
- New Patient 360 APIs
- New database tables, including `patient_events` or an AI summary table
- An event bus or a second realtime transport
- A new central document repository
- Timeline implementation
- Permission changes
- Navigation changes (including PD-A’s menu move)
- Removal of tabs
- Removal of operational actions listed in section 12
- Counsellor, Billing, Insurance, clinical, OT, or IP workflow changes
- Census predicate changes (PD-B)
- Performance optimization or index work
- Tests, migrations, or route redirects

Certified Slice 1–8 behavior stays in force until a slice explicitly reopens it: lookup filter contract, export branch scope, navigation-only handoffs, preview without a clinical chart, hidden placeholder tabs, MRN stability on update.

---

## 17. Decision register

Phase 1I answers PD360-R2 and PD360-R4 only, with the gates in section 21. Every other row stays **DECISION REQUIRED**. This file does not implement either approved row.

| ID | Topic | Status |
|---|---|---|
| PD360-R1 | Retention period for recordings and for deleted/revoked clinical or consent rows | **DECISION REQUIRED.** Not resolved by Phase 1I |
| PD360-R2 | Patient 360 financial visibility permission | **APPROVED FOR PATIENT 360 IMPLEMENTATION.** Both `patient.view` and existing `bill.update`. Detail in section 21. The live bill GET is not yet aligned |
| PD360-R3 | Which existing counselling permission codes gate basic session context versus notes, quotes, decisions, documents, recordings, and transcripts | **DECISION REQUIRED.** Not resolved by Phase 1I |
| PD360-R4 | Which existing CCMS permissions gate Patient 360 coverage reads | **APPROVED** as the granular map in section 21. Patient 360 must not call the current GETs until server enforcement matches those codes |
| PD360-R5 | Authoritative diagnosis history: `patient_diagnosis`, examination text, or a defined combination with provenance | **DECISION REQUIRED.** Not resolved by Phase 1I |
| PD360-R6 | Timeline ordering and correction semantics, using real source timestamps | **DECISION REQUIRED.** Not resolved by Phase 1I |
| PD360-R7 | Which current Add Patient implementation becomes canonical | **DECISION REQUIRED.** Not resolved by Phase 1I |
| PD360-R8 | Whether null-branch rows remain visible in every selected branch once census changes are allowed | **DECISION REQUIRED.** Phase 1I does not decide bill branch scope. PD-B still forbids changing the census predicate |
| PD360-R9 | Whether hard delete of `patient` remains, versus `deleted_at` only | **DECISION REQUIRED.** Not resolved by Phase 1I |
| PD360-R10 | AI summary source, if any, including provenance | **DECISION REQUIRED.** Absent until a source exists |

Also still open, and not decided by the coverage audit or by Phase 1I:

- Whether `GetByPatient` on `patient_insurance` should hide `deleted_at` rows. The audit recorded that it does not. Soft-delete presentation stays with section 5.3 and PD360-R1.
- Tenant assignment on the CCMS sync insert (`TenantId = patientId` in `SyncPatientInsuranceFromCcmsAsync`). Documented defect. Not a Patient 360 read rule and not fixed here.
- CCMS get-by-id not filtering tenant. A later CCMS security slice must not leak across tenants. Phase 1I does not authorize that code change.

---

## 18. Traceability to the forensic audits

| Contract section | Audit evidence |
|---|---|
| North star vs current gap | Patient 360 audit sections 1, 14, 15. Record does not load counselling, CCMS, IP ledger, recordings, or a real document list |
| PD-A vs code | Master audit section 16. Sidebar group is Doctor’s Desk. Permission is `patient.view`. Role landing does not open the directory |
| PD-B | `ApplyTabFilterAsync`, `GetCurrentPatientIdsAsync`. Master audit section 9 |
| PD-D | `ApplyAssignedToMeFilter`: open visit `AssignedTo ==` user. Not `CounselorId` |
| PD-G limits | `usePatientHubRealtime` invalidates `patientLookupKeys.all` on the hub page only. Record tabs use local fetch |
| Financial permission | Phase 1H audit: `OpdBillsController` GET by patient has no method `RequirePermission`. No `bill.read` / `bill.view` attribute was found. `bill.create`, `bill.update`, and `bill.admin` exist on mutations. Phase 1I selects `bill.update` as the Patient 360 gate only |
| Insurance layers | Phase 1H audit sections 2, 4, 5, 6, and 10. `patient_insurance` GET by patient id. CCMS list has no patient filter. Three pre-auth stores. Seeded `ccms.*.read` codes in `consolidated/migrations/127_ccms_permissions.sql` are not consistently enforced on the GETs |
| Counselling children | `counseling_session_notes`, `counseling_session_documents`, `session_recordings`, `session_transcripts` keyed by session. No Patient Record import |
| AI summary absent | No recording AI-summary entity. `clinical_summary` is a different field |
| Diagnoses split | `DiagnosesController` writes `patient_diagnosis`. Diagnoses tab calls `examinationApi.getByPatient` |
| Two vital tables | `patient_vital_signs` versus `vital_sign` by journey |
| Documents | Hybrid stores. `DocumentSharingController` under `_Phase4_Disabled`, excluded in `AuthService.csproj` |
| Timeline | `TimelineTab` / Encounters. No `patient_events` table |
| Mutations to keep | Allergy delete, consent revoke, insurance verify, notes writes, optical deliver, encounter save |
| Create paths | `PatientFormModal`, `/dashboard/patients/new`, other `NewPatientModal` components |
| Identity | Fluent `ToTable("patient")`. Class attribute `patients` does not win. MRN not unique |
| Slice 8 | Census cost is round trips, not a reason to add a materialized timeline in this contract |

---

## 19. Contradictions and conflicts with the proposed direction

These are recorded so implementation does not “match the contract” by ignoring live code.

1. **PD-A versus the menu.** The approved concept is a shared Patients destination. The sidebar parent is still Doctor’s Desk. No move is authorized here.
2. **Approved Patient 360 financial gate versus the bill API.** Section 5.1 now requires `patient.view` and `bill.update` on Patient 360. The bill GET is still available to any authenticated caller of that route. Existing Billing (`BillingTab`) is unchanged. Patient 360 must not call that GET for display until a later slice aligns the server check and preserves Billing behavior.
3. **`patient.view` already reads several non-financial domains** that a stricter “domain permission” model might later restrict: chart notes, allergies, `patient_insurance`, consents, communications, lab rows, optical orders. This contract applies the stricter rule to **financial** data and to **CCMS / sensitive counselling** content. It does not automatically strip those other `patient.view` reads.
4. **Cross-branch proposal versus PD-B.** The proposed rule says another branch’s protected history is not automatic. Current lookup and several engagement queries include null branch, and summary does not re-resolve branch. Census predicates must not change under PD-B. The security rule is validation work for a later slice.
5. **Insurance copy versus “do not duplicate.”** CCMS sync already writes `patient_insurance`. The contract says do not add further copies and do not treat the copy as the claim file. It does not order a delete of the existing sync.
6. **Read-only 360 versus live writes.** The proposed primary mode is context. The record still deletes allergies, revokes consents, verifies insurance, flags or deletes notes, and marks optical orders delivered. Those writes stay until a per-mutation slice. Optical deliver is the clearest operational write sitting inside the chart.
7. **Diagnoses tab versus `patient_diagnosis`.** The tab does not read the diagnosis table. The contract refuses to declare a winner without a clinical decision. Implementing a “diagnosis history” by extending the current tab would silently pick examinations.
8. **Surgery and some timeline calls use the wrong key.** Surgery list is by patient name. The shell does not pass the name. Timeline calls a GUID method that is not on the client. A 360 “surgery history” cannot be honest until it uses `patient.id` or an explicit approved key. Name match is not approved as identity.
9. **Documents empty state.** A failed document call becomes an empty list. That conflicts with principle 11 (do not present “not integrated” as “no history”). A later slice must fix the presentation. This contract does not change the component.
10. **Two table names for the patient row.** Runtime mapping is `patient`. Some SQL and the counselling projection say `patients`. Identity remains `patient.id`. This contract does not rename tables.
11. **AI summary and clinical_summary.** Using `clinical_summary` as an “AI summary” would violate section 14. They are different snapshots.
12. **Hard delete versus soft delete.** Lookup honors `deleted_at`. Delete can remove the row. Historical 360 after delete is undefined until PD360-R9.

---

## 20. Design principles (proposed, with the approved items)

These restate the request so later slices can be checked against one list. Items that only restate PD-A–PD-H are approved. The rest are **proposed decisions for implementation**.

1. Complete context, not duplicate workflows. (PD-F, PD-H)
2. The owning module remains the system of record.
3. `patient.id` remains the canonical patient identity.
4. Patient 360 consumes existing sources where a safe read already exists.
5. A new read API is justified only when authoritative data exists and cannot be read by patient.
6. No new duplicate operational database.
7. No silent permission escalation, including no service-account read of CCMS or recordings on behalf of `patient.view`.
8. No accidental Counsellor ownership.
9. No accidental Billing, Insurance, or clinical workflow duplication.
10. Current state and history stay visually and semantically distinct.
11. Unavailable integration is not displayed as “no history.”
12. Where two stores can be confused, show provenance (profile versus case, OPD vital versus IP vital, chart note versus session note).
13. Every implementation slice preserves certified Slice 1–8 behavior unless that slice’s authorization says otherwise.
14. Every implementation slice requires automated tests. This contract creates none.
15. Manual UAT remains mandatory before any slice is accepted.

---

## 21. Decision history — Phase 1I Coverage, financial, and insurance

Recorded 2026-09-30. Source of the approval: this Phase 1I decision request. Evidence of the repository facts: `docs/audits/patient-360-coverage-financial-insurance-audit.md`, this contract as it stood on 2026-09-29, and the permission attributes and seeds cited below. No permission row was inserted. No controller attribute was changed.

### PD360-R2 — Financial visibility

| | |
|---|---|
| Original | **DECISION REQUIRED.** Section 5.1 required `patient.view` and “the appropriate” billing permission, and forbade inventing a code. |
| Current | **APPROVED FOR PATIENT 360 IMPLEMENTATION.** Patient 360 financial context requires `patient.view` and existing `bill.update`. |
| Reason | The audit found `bill.create` on create paths, `bill.update` on payment and bill updates, and `bill.admin` on billing rules. It found no `bill.read` or `bill.view`. `bill.create` is creation-specific. `bill.admin` is broader than viewing. `bill.update` is the narrowest existing code that marks an operational billing user. |
| Consequence | A later billing-alignment slice must confirm how `bill.update` is represented and enforce it on the OPD bill GET Patient 360 will use, without changing cashier behavior. Until that alignment, Patient 360 financial context stays not integrated. `bill.update` never adds payment, refund, adjustment, or cashier controls to Patient 360. |
| Future architectural note | A dedicated `bill.read` would be cleaner. Creating it is **out of scope**. |
| Permissions not invented | `bill.read`, `bill.view`. |

### Insurance profile money fields

| | |
|---|---|
| Original | **DECISION REQUIRED** in the Phase 1H audit (section 17): copay, deductible, and out-of-pocket amounts sit on a `patient.view` profile read, and section 5.1 had not said whether they count as financial detail. |
| Current | **APPROVED FOR PATIENT 360 IMPLEMENTATION.** The read-only profile may show copay, deductible, deductible met, out-of-pocket maximum, and out-of-pocket maximum met from `GET /api/patient-insurance/patient/{patientId}`. |
| Reason | Those columns already exist on `PatientInsurance` and the client type. They describe the policy, not the cashier ledger. |
| Consequence | Label them as insurance policy / coverage profile values. Do not label them as balance, amount due, outstanding, or payment status. Do not sum them into a patient financial balance. |
| Out of scope | Changing which fields the API returns. |

### PD360-R4 — CCMS authorization

| | |
|---|---|
| Original | **DECISION REQUIRED.** Which existing CCMS permission gates cases, claims, and CCMS documents. Section 8 forbade `patient.view` alone and forbade a service-account bypass. |
| Current | **APPROVED** granular map. Do not create `ccms.read`. |

| Concern | Existing permission |
|---|---|
| Coverage case | `ccms.coverage_case.read` |
| Authorization | `ccms.authorization.read` |
| Eligibility | `ccms.eligibility.read` |
| Claims | `ccms.claim.read` |
| CCMS documents | `ccms.document.read` |
| CCMS billing allocation | `ccms.billing.read` |
| Settlement | `ccms.settlement.read` |

| | |
|---|---|
| Reason | Those codes are already seeded in `consolidated/migrations/127_ccms_permissions.sql`. The audit showed a generic read code does not exist and must not be invented. |
| Security constraint | The same audit showed list, get-by-id, claims GET, and document GET authenticate a JWT and do not consistently call the CCMS permission check. **Patient 360 must not consume those endpoints until a security slice enforces the matching `ccms.*.read` code on each GET Patient 360 will call.** |
| Consequence of that slice, when separately authorized | Name each GET, bind the existing code, use the existing CCMS authorization mechanism, leave unrelated endpoints and CCMS workflow behavior unchanged, add authorization tests, then stop for manual UAT. |
| Still forbidden | `patient.view` as a substitute, service-account credentials, `X-Internal-Key` / internal API key as a Patient 360 mechanism, opening Patient Record as sufficient authority, patient-name search, guessing a case id. |
| Permissions not invented | `ccms.read`. |

`ccms.billing.read` does not make CCMS allocation the cash ledger. Cash remains `opd_bills` under section 7 and rule 09.

### Pre-authorization

| | |
|---|---|
| Original | Section 8 left pre-authorization on `insurance_pre_authorizations`, and noted the census engagement signal is not the Insurance tab source of truth. The audit found two more stores and no patient-id list. |
| Current | **APPROVED: out of Patient 360 for now.** No generic Pre-auth, Pre-authorization, or Authorization history block. |
| Reason | There is no patient-id read with one permission across `insurance_pre_authorizations`, `insurance_preauth_requests`, and CCMS authorization. |
| Consequence | Do not merge those stores. Do not use `PatientEngagementService` pre-auth rows as history. Do not use session or schedule GETs as a patient-id substitute. Do not match by name. A later decision must add a patient-id read and name the permission before any block exists. |

### Insurance profile source

| | |
|---|---|
| Original | Section 8 proposed `patient_insurance` as basic context under existing patient-level authorization, and treated CCMS sync as a copy rather than the claim file. |
| Current | **APPROVED.** `patient_insurance` is the Patient 360 Insurance Profile source. Read `GET /api/patient-insurance/patient/{patientId}` with `patient.view`. Read-only. |
| Reason | That GET is patient-id scoped and already requires `patient.view` (`PatientInsuranceController.GetByPatient`). |
| Consequence | No verify, create, update, or delete from Patient 360. Verification stays on Existing record tools. Summary registration strings (`InsuranceProvider`, `InsurancePolicyNumber` from `PatientSummaryService`) stay captioned as registration data. Do not merge them with profile rows into one history. |
| Not approved | Treating the profile as coverage, eligibility, or billing balance. |

### Financial source

| | |
|---|---|
| Original | Section 7 proposed the OPD patient-id bill list as context and forbade a second IP ledger and payment posts. |
| Current | **APPROVED** as the future Patient 360 financial source only after the GET matches PD360-R2. |
| Consequence | No second ledger, no new balance, no IP transaction ledger, no orphan billing client URLs, no CCMS allocation as cash, no refund workflow on Patient 360. Read-only. |

### Current and historical wording

| | |
|---|---|
| Original | Section 5.3 proposed not presenting removed rows as current, and not inventing retention. PD360-R1 and PD360-R6 stayed open. |
| Current | **APPROVED** presentation rule for Coverage. Preserve the source status string. Do not invent “covered”, “approved”, “denied”, “paid”, “current coverage”, or “financially cleared” unless that source already stores it. |
| Still open | PD360-R1 retention. PD360-R6 timeline order. |
| Forbidden conversions | Profile `status` as eligibility. CCMS `CurrentState` as claim adjudication. Claim packet `Status` (default `active` on `StandardEntity`) as paid, approved, or denied. Deductible amounts as patient balance. |

### Coverage information architecture

| | |
|---|---|
| Original | Section 15 listed Financial and Insurance as separate target groups. The information architecture already puts both inside one Coverage section. |
| Current | **APPROVED.** Exactly one top-level section, Coverage, with Financial and Insurance stacks. |
| Consequence | Do not add Financial, Insurance, Claims, or Pre-auth as further top-level navigation items. Section catalog keys stay as they are until an implementation slice that is explicitly allowed to touch navigation. This decision record does not change navigation. |
| Accessibility | A later Coverage UI follows `.cursor/rules/10-accessibility.mdc`: real headings, text status, table headers, keyboard access. Not implemented here. |

### Implementation sequence after this record

These are the only next Coverage slices, in order. This file does not start them. Each implementation slice still needs its own tests and manual UAT. UAT is not claimed here.

1. **Insurance Profile Read.** `patient.id`. `patient.view`. Read-only. Profile caption. Approved policy money fields as policy values. No verify, edit, create, or delete. Then manual UAT.
2. **Billing authorization alignment.** Confirm how `bill.update` is represented. Align the OPD bill GET server-side. Preserve existing Billing behavior. Add backend authorization tests. Then manual UAT. No Patient 360 financial UI in this step.
3. **Patient 360 Financial Read.** Only after that alignment. Read-only. No new balance. No bill mutation. Then manual UAT.
4. **CCMS read authorization alignment.** Existing granular codes only. Server-side enforcement on the GETs that Patient 360 will need. No service account. No internal key. No workflow changes. Tests, then manual UAT. No Patient 360 CCMS UI in this step.
5. **Patient-id CCMS read.** Only after a trustworthy patient-id query exists and step 4 is in place. No name search. No case guessing. No cross-tenant leak. Separate slices for case, authorization, claims, and documents.
6. **Pre-authorization.** Remains blocked.

### Permissions referenced and not created

Referenced existing codes: `patient.view`, `patient.update` (profile writes, not used by Patient 360), `bill.update`, `bill.create` (rejected as the gate), `bill.admin` (rejected as the gate), `ccms.coverage_case.read`, `ccms.authorization.read`, `ccms.eligibility.read`, `ccms.claim.read`, `ccms.document.read`, `ccms.billing.read`, `ccms.settlement.read`, `insurance.preauth.view` (existing list permission, not a Patient 360 block), `counseling_sessions.read` (session pre-auth GET, not a Patient 360 block).

Deliberately not invented: `bill.read`, `bill.view`, `ccms.read`.

---

## Stop

This file records decisions only. No application implementation is performed. Do not start the Insurance Profile slice from this update alone. The next slice starts only when a later implementation request authorizes it.

