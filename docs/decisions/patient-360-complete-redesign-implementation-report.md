# Patient 360 Complete Redesign — Implementation Report

Date: 2026-10-06  
Status: **IMPLEMENTATION COMPLETE — AUTOMATED UNIT TESTS COMPLETE — MANUAL UAT REQUIRED — STOP**  
Acceptance: **not claimed**

## 1. UX/IA changes

Patient 360 remains a single seven-section longitudinal record:

Overview · Clinical · Care · Documents · Coverage · Administration · Timeline

There is still one primary navigation (`Patient360SectionNav`) with `aria-current="page"`. Care now composes visits, appointments, counselling (read-only), and communication. Timeline is wired from existing Patient 360 loaders rather than `TimelineTab` or a new event store.

Counsellor workflow chrome was not copied. Handoffs are navigation only.

## 2. Header changes

The identity header is a compact context band:

- Avatar, name, MRN · age · sex
- Current visit/reason, station, provider, IP badge, acuity, engagements
- Primary action: Continue encounter / Check-in using existing `resolvePatient360PrimaryActions`
- Book appt when `appointment.view`
- Secondary actions in **More** (Open Counselling, Queue, Open Billing, Print, Export PDF)

Alerts sit in one strip under the header: possible duplicate, data quality, registration allergy. Print/PDF were removed from a second chrome row.

## 3. Overview

Blocks: Patient snapshot (non-header facts), Current care context, Clinical snapshot, Recent activity (visit excerpt only), Data quality when issues exist, Next actions (Open encounter when certified).

Does not load extra domain APIs. Does not repeat the full visit list.

## 4. Clinical

Existing certified reads unchanged. Added in-section subnavigation (anchors, not extra Patient 360 tabs). Groups remain: Chart facts, Vitals (OPD + IP), Allergies, Examinations, Medications & prescriptions, Coded diagnosis, Laboratory, Imaging + files, Optical, Chart notes, plus specialty diagnostics/OCT already wired.

Read-oriented. Sheets for chart-note detail preserved.

## 5. Care

`Patient360CarePanel` now owns Care:

- Visits & encounters (existing visit read)
- Appointments (existing appointment read)
- Counselling sessions (existing patient-360 session read; no Start/Assign/ReQueue)
- Communication (existing communication read)
- Handoffs: Open Counselling, Open Scheduling

Conversation recordings, transcripts, AI summaries, quotes, and decisions are **not** shown (no approved Patient 360 source).

## 6. Documents

Unified index of existing sources:

| Source | Status |
|---|---|
| CCMS Documents | SAFE — existing loader |
| Counselling Documents | SAFE — existing loader |
| MPI documents | NO AUTHORITATIVE PATIENT-SCOPED READ — honest unavailable copy |

No new document store. No upload workflow.

## 7. Coverage

Existing insurance profile, OPD bills, coverage cases, eligibility, authorizations, claims, settlements. Source labels preserved. Optional handoffs: Open Billing, Open CCMS. Not a cashier or CCMS workbench.

## 8. Administration

Registration snapshot from summary (DOB, phone, email, blood group, emergency, data-quality issues) plus existing appointments, visits/check-in, consents, inpatient history. Surgery/OT remains honest unavailable (`SURGERY_UNAVAILABLE`). Portal/access status: no Patient 360 source.

## 9. Timeline

Client aggregation of existing Patient 360 reads (appointments, visits, consents, examinations, prescriptions, labs, communications, counselling, OPD bills). Sorted newest-first. Source labeled. Optional encounter href. Empty/unavailable honesty. **No PatientEvents table.** Legacy `TimelineTab` is unused.

## 10. Responsive behavior

Existing `sm` / `md` / `lg` utilities. Bounded `max-w-[1600px]` workstation width. Header stacks on small screens; actions wrap; section nav remains horizontal-scroll. No new breakpoint map. No page-level `overflow-x-hidden`.

## 11. Accessibility

Preserved tablist, `aria-selected`, added `aria-current`. Semantic h1/h2/h3. Alert strip `aria-label="Patient alerts"`. Focus rings on subnav anchors and handoff links. Sheets/dialogs unchanged.

## 12. Data sources used

| Domain | Existing Source | Patient-scoped API | Permission | Available in 360 | UI Section | Status |
|---|---|---|---|---|---|---|
| Identity | Patient summary | lookup summary | `patient.view` | Yes | Header / Overview / Admin | SAFE |
| MRN / demographics / phone / emergency / blood group | Patient summary | lookup summary | `patient.view` | Yes | Header / Overview / Admin | SAFE |
| Duplicate hint | check-duplicates | POST `/patients/check-duplicates` | existing | Yes | Alert strip | SAFE |
| Data quality | summary.dataQuality | lookup summary | `patient.view` | Yes | Alert / Overview / Admin | SAFE |
| Current encounter / station / provider / IP / acuity | summary | lookup summary | `patient.view` | Yes | Header / Overview | SAFE |
| OPD vitals | clinical loader | `/vitals/patient/` | existing | Yes | Clinical / Overview snapshot | SAFE |
| IP vitals | IP vitals loader | patient-360 IP vitals | existing IP read | Yes | Clinical | SAFE |
| Allergies | patientAllergiesApi | getByPatient | existing | Yes | Clinical | SAFE |
| Examinations | examinationApi | getByPatient | existing | Yes | Clinical / Timeline | SAFE |
| Prescriptions / medications | patient-360 medication | `/prescriptions/patients/` | `patient360.medication.read` | Yes | Clinical / Timeline | SAFE |
| Coded diagnosis | patient-360 diagnosis | `/diagnoses/patients/` | `patient360.diagnosis.read` | Yes | Clinical | SAFE |
| Labs | labReportsApi | getByPatient | existing | Yes | Clinical / Timeline | SAFE |
| Imaging orders | imagingApi | getPatientOrders | existing | Yes | Clinical | SAFE |
| Imaging files | imaging files loader | patient-360 images | existing | Yes | Clinical | SAFE |
| Optical | opticalOrdersApi | getByPatient | existing | Yes | Clinical | SAFE |
| Chart notes | patientNotesApi | getByPatient | existing | Yes | Clinical | SAFE |
| Specialty / OCT | specialty diagnostics + OCT | patient-360 OCT | existing | Yes | Clinical | SAFE |
| Visits | visitsApi | getByPatient | existing | Yes | Care / Admin / Timeline | SAFE |
| Appointments | appointmentsApi | getByPatient | existing | Yes | Care / Admin / Timeline | SAFE |
| Consents | patientConsentsApi | getByPatient | existing | Yes | Admin / Timeline | SAFE |
| IP history | inpatient history loader | patient-360 IP history | existing | Yes | Administration | SAFE |
| Counselling sessions | counseling patient-360 sessions | `/counseling/patients/{id}/patient-360/sessions` | existing | Yes | Care / Timeline | SAFE — limited fields |
| Counselling documents | counselling documents loader | existing | existing | Yes | Documents | SAFE — metadata |
| Communication | patientCommunicationsApi | getByPatient | existing | Yes | Care / Timeline | SAFE |
| Insurance profile | insurance profile loader | existing | existing | Yes | Coverage | SAFE |
| OPD bills | financial loader | existing | existing | Yes | Coverage / Timeline | SAFE |
| Coverage cases / eligibility / authorizations / claims / settlements | CCMS loaders | existing | existing source perms | Yes | Coverage | SAFE |
| CCMS documents | getDocumentsByPatient | existing | existing | Yes | Documents | SAFE |

## 13. Data sources unavailable

| Domain | Reason | Classification |
|---|---|---|
| MPI / patient document uploads | `widgets.api.getPatientDocuments` returns `[]` with TODO; no certified 360 read | SCOPE STOP — PATIENT-SCOPED DATA SOURCE REQUIRED |
| Medical history registry / `/patient-medical-history` | Not a certified Patient 360 read; clinical tests forbid this path | SCOPE STOP |
| Clinical recommendations (standalone) | No patient-360 recommendation list; specialty follow-up months stay in specialty panel | DATA-SOURCE GAP |
| Surgery / OT history | Explicit existing unavailable contract | UNAVAILABLE |
| Follow-up as a care object | No patient-scoped 360 follow-up list | DATA-SOURCE GAP |
| Counselling recordings / transcripts / AI summaries / quotes / decisions / notes | Not on approved session DTO | DATA-SOURCE GAP / product |
| Portal / access status | Not on summary | DATA-SOURCE GAP |
| Identifiers beyond MRN (Health ID) | Not on PatientSummary used by 360 | AVAILABLE BUT LIMITED |
| Branch-wide retention / purge | Out of scope | NOT IMPLEMENTED |
| Fake chronology | Forbidden | N/A |

MPI documents: existing API is a stub (`return []`). A later authorized read would need owning-module GET with permission, not this UI slice.

## 14. Development/UAT seed

- **Identifier:** name `UAT360 Longitudinal`; phone `+919360000001`; email `uat360.longitudinal@example.test`; DOB `1975-04-12`
- **Mechanism:** `apps/hospital-portal-web/scripts/seed-patient-360-uat.ts` + constants in `patient-360-uat-seed.ts`
- **Idempotency:** lookup by name; skip create if present; refuse `NODE_ENV=production`
- **Records seeded by domain:** identity/demographics/emergency/allergy **text on create payload only** via existing `POST /patients`
- **SEED BLOCKED — SOURCE/SCHEMA/OWNERSHIP GAP:** vitals, allergy records, examinations, diagnoses, prescriptions, labs, imaging, OCT, optical, notes, visits, appointments, counselling sessions/documents, communications, CCMS/insurance/bills, consents, IP, OT — no new tables and no speculative seed APIs under this authorization
- Does not alter other patients unless they already match this identity

Run (non-production API): `npx tsx scripts/seed-patient-360-uat.ts` from `apps/hospital-portal-web`.

## 15. APIs changed

None.

## 16. DTOs changed

None.

## 17. Database changes

None.

## 18. Permissions changed

None. Page remains `patient.view`. Domain reads keep owning-source permissions.

## 19. Tests

Commands:

```
cd apps/hospital-portal-web
npx vitest run src/lib/patients/patient-360- src/components/patients/record/Patient360 --reporter=dot
```

- **Passed:** 33 files, **142** tests
- **Failed:** 0
- **Skipped:** 0
- **Playwright / browser:** not executed in this session (requires live auth, branch, and hub fixtures). Manual UAT required.

New/updated tests: timeline aggregation/presentation, Care journeys, UAT seed identity, section wiring, overview headings, counselling/care composition, shell `aria-current`.

## 20. Scope verification

- Directory untouched
- Preview untouched
- Add Patient untouched
- Duplicate threshold untouched
- MRN logic untouched
- Counsellor workflow / ownership untouched
- Billing rules untouched
- Insurance rules untouched
- OT/IP workflows untouched
- No PatientEvents store
- No global retention / branch filter
- No new design system

## 21. Known gaps

| Gap | Type |
|---|---|
| Overview recent activity is visits-only (summary + recent visits contract) | product / API — extra domain reads were previously forbidden on Overview |
| MPI document index honest unavailable | API gap |
| Medical history not in Clinical | API / ownership gap |
| Surgery/OT history | data-source gap (existing contract) |
| Follow-up object | data-source gap |
| Counselling artifacts beyond session context | data-source / product |
| Portal access | data-source gap |
| Comprehensive multi-domain UAT seed | seed blocked without new seed APIs |
| Manual UAT / Playwright against a live patient | **required next step** |
| Live browser verification of this slice | not run (no guaranteed logged-in Patient 360 session in this agent) |

---

# Manual UAT matrix

Use `/dashboard/patients/{id}` with `patient.view` and a patient that has authorized domain data. After seed, search **UAT360 Longitudinal**.

| # | Area | Pass criteria | Result |
|---|---|---|---|
| 1 | Patient identity | Name, MRN, age, sex, avatar | PENDING |
| 2 | Header | Compact context: visit, station, provider, IP, acuity, engagements | PENDING |
| 3 | Alerts | Duplicate / data quality / allergy only when meaningful | PENDING |
| 4 | Primary actions | Continue encounter XOR Check-in; Book appt if permitted; More handoffs | PENDING |
| 5 | Overview | Snapshot, context, clinical, recent visits, next action; no duplicate visit wall | PENDING |
| 6 | Clinical | All wired source groups; subnav; empty/unauth/unavailable distinct | PENDING |
| 7 | Care | Visits, appointments, counselling read-only, communication; no Assign/Start/ReQueue | PENDING |
| 8 | Documents | CCMS + counselling source labels; MPI unavailable honest | PENDING |
| 9 | Coverage | Insurance + CCMS + bills; source labels; no cashier | PENDING |
| 10 | Administration | Registration + consents + check-in + IP; OT unavailable | PENDING |
| 11 | Timeline | Chronological, sourced, no fake events | PENDING |
| 12 | Cross-module navigation | Handoffs land in owning modules | PENDING |
| 13 | Permissions | Domain data hidden/unavailable per source; page needs `patient.view` | PENDING |
| 14 | Desktop | Workstation density, two-column clinical | PENDING |
| 15 | Tablet | Header/nav usable | PENDING |
| 16 | Mobile | Identity first, alerts, primary action, horizontal nav, stacked cards | PENDING |
| 17 | Empty states | Recorded absence copy, not “no history” encyclopedia | PENDING |
| 18 | Loading states | Skeletons / “Loading …” | PENDING |
| 19 | Error states | Load failure on summary; domain unavailable | PENDING |
| 20 | UAT seed completeness | Identity appears; other domains only if separately present | PENDING |

---

**FINAL STATUS**

PATIENT 360 COMPLETE REDESIGN IMPLEMENTATION COMPLETE  
AUTOMATED TESTS COMPLETE  
MANUAL UAT REQUIRED  
STOP
