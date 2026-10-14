# Patient 360 UX-2 Master Audit

Document type: Architecture / product / UX audit  
Phase: **P360-UX-2**  
Date: 2026-10-06  
Mode: **AUDIT ONLY — NO CODE, API, DATABASE, SEED, PERMISSION, OR UI CHANGES**

Evidence: live Patient 360 route `/dashboard/patients/[id]`, loaders under `apps/hospital-portal-web/src/lib/patients/patient-360-*`, shell in `PatientRecordPage.tsx`, MPI `PatientsController`, prior contracts (`patient-360-product-decision-contract.md`, `patient-360-information-architecture.md`, implementation report 2026-10-06).

Classification legend used throughout:

| Label | Meaning |
|---|---|
| **CERTIFIED** | Observed in current repository; already implemented |
| **APPROVED DIRECTION** | Product north star from this brief and/or PD-A–H; not implemented as the target UX |
| **PROPOSED** | Recommended by this audit; not authorized |
| **DECISION REQUIRED** | Product, security, clinical, or compliance must choose before implementation |
| **SOURCE GAP** | Authoritative patient-scoped read/write does not exist or is stubbed |
| **SECURITY GAP** | Live gate, filter, or UI exposure is weaker or wider than named permissions |
| **UX DEFECT** | Current composition fights a longitudinal workspace |
| **IMPLEMENTATION DEFECT** | Code contradicts an already-wired Patient 360 contract |

---

## 1. Executive summary

Patient 360 **is already a seven-section longitudinal read shell** (Overview, Clinical, Care, Documents, Coverage, Administration, Timeline). Manual UAT of that structure can proceed. The product problem for UX-2 is not missing tabs. It is that the page still behaves like **Directory + worklist + seven card encyclopedias + module launcher**.

**CERTIFIED current shape**

- One route, one `patient.view` page gate, one section nav (`Patient360SectionNav`).
- Identity from `GET /patients/{id}/summary`.
- Domain reads from owning APIs; empty / unauthorized / unavailable are mostly distinguished.
- Operational writes stay in owning modules (except leftover hidden record tabs that 360 does not mount).

**APPROVED DIRECTION (this phase)**

```text
ONE PATIENT → ONE FIXED CONTEXT → ONE RECORD WORKSPACE → MULTIPLE INFORMATION DOMAINS
```

Directory remains discovery. Preview remains verification. Patient 360 must stop switching patients and stop looking like seven departmental dashboards.

**Highest-severity findings**

1. **UX DEFECT:** Four patient-switching models on the chart (`PatientWorkspaceTabs`, `PatientSwitcherRail`, `PatientRecordNav` “N of M”, session `patient_hub_record_nav`).
2. **UX DEFECT:** Card-heavy, sparse, repeated identity/context, always-mounted empty shells (MPI documents, Surgery/OT, Coverage ×7, specialty ×3).
3. **SOURCE GAP:** No Edit Patient on 360; `PUT /patients/{id}` with `patient.update` exists but ignores emergency/identifiers that create supports.
4. **SECURITY GAP:** More-menu handoffs (Counselling, Queue, Billing, Export PDF) are not gated with destination permissions. Export PDF calls `patient.export` without UI permission.
5. **IMPLEMENTATION DEFECT:** Timeline prescriptions are always empty because `loadPatient360Clinical` stubs Rx while Clinical pages a separate loader.
6. **DECISION REQUIRED:** PD360-R1, R3, R5, R6, R7, R8, R9, R10 remain open. Branch, deleted, and retention behavior is inconsistent across sources.
7. **SOURCE GAP:** UAT seed `UAT360 Longitudinal` is identity-only. Multi-domain UAT needs existing live patients, not new seed APIs.

**This audit does not authorize implementation.**

---

## 2. Current-state problems

| Problem | Evidence | Class |
|---|---|---|
| Chart is a patient switcher | `PatientSwitcherRail`, `PatientWorkspaceTabs`, `PatientRecordNav` | UX DEFECT |
| Census leaked into 360 | `savePatientRecordNav` from hub page rows; label `"${index+1} of ${length}"` | UX DEFECT |
| Search on the chart | `GET /patients/suggest` in `PatientSwitcherRail` | UX DEFECT vs `03-patient-context` |
| Duplicate chrome | Workspace tabs **and** rail Recent are the same session list (max 8) | UX DEFECT |
| Card encyclopedia | Local `Block`/`section` cards on every domain; almost no tables | UX DEFECT |
| Repeated facts | Header visit/station/provider/IP/engagement repeated on Overview; DOB/phone/email/blood/emergency on Overview **and** Admin; visits on Overview, Care, Admin, Timeline | UX DEFECT |
| Empty shells | MPI documents always unavailable card; Surgery/OT always unavailable card; Coverage seven cards even when all empty | UX DEFECT |
| Module launcher feel | More + Care + Coverage duplicate Open Counselling / Billing / Scheduling | UX DEFECT |
| Queue / CCMS not patient-scoped | `/dashboard/frontdesk/queue`, `/dashboard/ccms` | UX DEFECT |
| No Edit Patient | Header/Admin read-only despite PUT | SOURCE GAP (UI) |
| Documents cannot open | Metadata lists only | AVAILABLE BUT LIMITED |
| Timeline hides Rx | Clinical stub `prescriptions: []` | IMPLEMENTATION DEFECT |
| Failures collapse to unavailable | No retry / temporary-error state | UX DEFECT |
| Counsellor density not used | Sessions desk uses `table-fixed text-xs`; 360 uses `p-3` cards | UX DEFECT |
| Stale 360 after owning-module write | Section loaders are `useEffect` + `getApi()`, not shared Query keys | DECISION REQUIRED (cache) |

---

## 3. Patient workspace concept

**APPROVED DIRECTION**

| Surface | Job | Not |
|---|---|---|
| Patient Directory | Discovery / census / worklist | Chart |
| Patient Preview | Lightweight verification | Full record |
| Patient 360 | Authorized patient-specific longitudinal record | Operational desk |

Mental model:

```text
patient.id (auth-service patient)
        ↓
fixed identity header + actions
        ↓
seven information domains (same page, section query)
        ↓
owning-module handoff only when the user must act
```

**CERTIFIED:** Seven sections already match the target IA. Do **not** add another top-level tab system.

**PROPOSED workspace rules**

1. Enter 360 from Directory/Preview/global search; do not hop patients inside 360.
2. Browser Back and global sidebar remain.
3. One identity band; sections never restate MRN/age/sex.
4. Cards only when a group has content, a warning, or a true unavailable/source-gap sentence — not as a default layout grid.
5. Dense tables / definition lists / Sheets for row detail.
6. Owning modules remain SoT. 360 never copies Counsellor, Billing, CCMS, Doctor’s Desk, Front Office, Lab, Imaging, Optical, OT, or IP worklists.

---

## 4. Header/action architecture

### 4.1 Identity (CERTIFIED source: `GET /patients/{id}/summary`)

Local function `SummaryHeader` in `PatientRecordPage.tsx` (not a shared `PatientHeader`).

| Field | In header? | Component / field | Class |
|---|---|---|---|
| `patient.id` | No (URL only) | `summary.id` | DECISION REQUIRED to display |
| Name | Yes `h1` | `firstName` `lastName` | CERTIFIED |
| MRN | Yes | `mrn` | CERTIFIED |
| DOB | No | `dateOfBirth` used for age; shown in Overview/Admin | PROPOSED to add formatted DOB |
| Age | Yes `{age}y` | `calcPatientAge` | CERTIFIED |
| Sex | Yes **raw** `gender` | not `formatPatientSex` | UX DEFECT |
| Avatar | Yes | `PatientAvatar` + `photoThumbnailUrl` | CERTIFIED |

### 4.2 Current context (same summary DTO)

| Context | Header | Overview | Class |
|---|---|---|---|
| Current visit / reason | “Visit:” `reasonForVisit` | “Reason:” | DUP / UX DEFECT |
| Station | unlabeled `contextLine` | labeled | UX DEFECT (unlabeled) |
| Provider / role | in `contextLine` | labeled | CERTIFIED data |
| IP status | `IpAdmittedBadge` | Inpatient line | DUP |
| Acuity | Badge | not duplicated | CERTIFIED |
| Engagements | joined string | list | DUP |
| `assignedVisitId` | not shown; drives Continue | Next actions | CERTIFIED |
| `scheduledAt` | not in header | Overview if present | CERTIFIED |

### 4.3 Patient switching controls (investigate for removal)

| Control | Component | File | Mechanism | Recommendation |
|---|---|---|---|---|
| Previous / next / “N of M” | `PatientRecordNav` | `PatientRecordNav.tsx` | `readPatientRecordNav` / `patient_hub_record_nav` (session, 30 min). Label from current ID array, typically **one directory page**, not full census | **APPROVED DIRECTION: remove from 360** |
| Search sidebar | `PatientSwitcherRail` | `PatientSwitcherRail.tsx` | `usePatientSuggestQuery` → `GET /patients/suggest` (`patient.view`) | **APPROVED DIRECTION: remove from 360** |
| Recent patients | Rail “Recent” + `PatientWorkspaceTabs` | `PatientWorkspace.ts` sessionStorage max 8. **Not** `GET /patients/recent-views` | Duplicate lists | **APPROVED DIRECTION: remove rail.** Tabs: **DECISION REQUIRED** |
| Workspace tab close | `PatientWorkspaceTabs` | Closing active tab navigates to another patient or Directory | This **is** in-360 patient switching | DECISION REQUIRED |
| Directory pagination | `PatientHubPagination` | Hub only | Not on 360 | CERTIFIED |

**PROPOSED:** Keep `PatientRecordShellHeader` back-to-directory. Keep global nav. Do not keep chart search.

### 4.4 Actions inventory

| Action | Component | Permission in 360 UI | API | Route | Owning module | Safe as 360 action? | Primary? | More? |
|---|---|---|---|---|---|---|---|---|
| Continue encounter | `SummaryHeader` Button/Link | **None** beyond `patient.view`. Destination `CLINICAL:EXAMINATION:VIEW` | Summary `assignedVisitId` | `/dashboard/patients/{id}/encounter/{visitId}` | Clinical / encounter | Navigation **safe** if destination authorizes | **Yes, XOR Check-in** | No |
| Check-in | `SummaryHeader` | None. Eligibility `resolvePatient360PrimaryActions` → `canDirectoryOfferCheckIn` (**360 omits `waitingMinutes`**) | Navigation only | `/dashboard/frontdesk/check-in?patientId=` | Front desk | Handoff **safe**; page **no ProtectedRoute** — SECURITY GAP | **Yes, XOR Continue** | No |
| Book appointment | `SummaryHeader` | `appointment.view` | Navigation | `/dashboard/appointments/schedule?patientId=` | Appointments | Handoff **safe** if dest authorizes; schedule page **no ProtectedRoute** | Secondary | Optional |
| Edit Patient | **Absent** | `patient.update` exists on PUT, unused | `PUT /patients/{id}` | none | MPI | **DECISION REQUIRED** | More (if approved) | Yes |
| Open Counselling | More + Care | **None** in 360. Dest `counseling_sessions.read` | Navigation | `/dashboard/counsellors-desk/waiting-list?patientId=` | Counsellor | Handoff only; **gate or hide** | No | Yes if permitted |
| Queue status | More | **None**. Sidebar `queue_management.view` | Navigation | `/dashboard/frontdesk/queue` (**no patientId**) | Front desk | **Not patient-specific** | No | **DECISION REQUIRED** remove |
| Open Billing | More + Coverage | **None**. Dest any of `bill.view` \| `opd_bill.view` \| `bill.update` \| `ip.billing.collect` \| `bill.create` | Navigation | `/dashboard/billing/opd?patientId=` | OPD billing | Handoff **safe** for OPD; **do not** open IP billing ops | No | Yes if permitted |
| Print summary | More | Extra none; API `patient.view` | Browser print | `/dashboard/patients/{id}/summary/print` | MPI | Read **safe**; print page **no ProtectedRoute** | No | Yes |
| Export PDF | More `handleExportPdf` | **None in UI**. BE `patient.export` | `GET /patients/{id}/summary/export?format=pdf` | blob | MPI | **SECURITY GAP** until UI gated | No | Yes if `patient.export` |
| Open CCMS | Coverage only | Dest CCMS codes | Navigation | `/dashboard/ccms` **not patient-scoped** | CCMS | Handoff weak | No | **DECISION REQUIRED** |
| Open Scheduling | Care | none | Navigation | same as Book appt | Appointments | Duplicate of Book | No | Prefer header Book |
| Open encounter (Overview/Care/Admin) | row link | none | — | encounter URL | Clinical | Same as Continue | Contextual | — |

**CERTIFIED:** Merge / emergency override already removed from 360 (slice-1 tests).

**PROPOSED action hierarchy** (see §20) is **not** authorized until permission gates and Queue/CCMS decisions are made.

---

## 5. Overview architecture

**CERTIFIED:** `Patient360Overview` + `buildPatient360Overview`. Data = summary + `recentVisits` only. No extra domain APIs. Diagnosis omitted by contract. Visits capped at 3.

**Current blocks:** Patient snapshot, Current care context, Clinical snapshot, Recent activity, Data quality (conditional), Next actions.

| Issue | Class |
|---|---|
| Snapshot still repeats DOB/phone/email/blood/emergency vs Admin | UX DEFECT |
| Current care repeats header reason/station/provider/IP/engagements | UX DEFECT |
| Title-only shell when all context empty | UX DEFECT |
| Clinical snapshot duplicates header allergy + draft vitals | UX DEFECT |
| Next actions duplicates Continue encounter | UX DEFECT |
| Empty visits copy “No visits were returned.” | UX DEFECT (sounds like API failure) |

**PROPOSED internal IA (no extra top-level tabs)**

1. **Alerts only if present** (already above Overview).
2. **One compact “Now” strip** — omit if identical to header; otherwise three fields max not already in header (scheduled time, programs).
3. **Clinical flags** — latest OPD vital + allergy text, one row, not a card wall.
4. **Recent activity** — 3 visits as a compact list; link Care for full journey.
5. **Next action** — omit if header already shows the same primary button.
6. Data quality — keep only when issues exist.

**DECISION REQUIRED:** Whether Overview may later load extra domains (currently forbidden). Recommend **no** until bidirectional cache exists.

---

## 6. Clinical architecture

**CERTIFIED reads** (patient-scoped): OPD vitals, IP vitals, allergies table, examinations, prescriptions (`patient360.medication.read`), coded diagnoses (`patient360.diagnosis.read`), labs, imaging orders, imaging files, optical orders, chart notes (Sheet), biometry, retinopathy, OCT.

**PROPOSED internal IA:** Keep Clinical subnav (anchors, not a second app tab). Fix anchors so they include the group heading. Add missing anchors: IP vitals, Specialty. Use **one compact table per source group**, not a two-column card grid that leaves Optical/Notes half-empty.

| Domain | SoT | Endpoint | Permission | Tenant | Branch | Deleted | Page | Mutate | 360 now | Recommended presentation |
|---|---|---|---|---|---|---|---|---|---|---|
| Summary / draft VA IOP | patient summary | lookup summary | `patient.view` | lookup | client `branchId` on engagement | — | — | no | Clinical + Overview | One line under Vitals, not a duplicate card |
| OPD vitals | `patient_vital_signs` | `GET /vitals/patient/{id}?limit=50` | `patient.view` | yes | **none** | `DeletedAt == null` | cap 50 | POST `patient.edit` | list | Compact table; READ SAFE |
| IP vitals | `vital_sign` via journey | patient-360 ip-vitals | `ip.vitals.read` | yes | allow-list; null excluded | journey deleted hidden | 20/100 | ward/OT | list | Compact table; HANDOFF to ward |
| Allergies | `patient_allergies` | `GET /patient-allergies/patient/{id}` | `patient.view` | yes | none | **no DeletedAt filter** | unbounded | CUD `patient.update` | list | Table; SECURITY GAP deleted |
| Allergy text | `patient.allergies` | summary | `patient.view` | — | — | — | — | PUT patient | header Alert + snapshot | Dual store **DECISION REQUIRED** |
| Medical history | counselling/history API | `GET /patient-medical-history/patient/{id}` | `counseling_sessions.read` | — | — | — | — | counselling update | **not loaded** | SOURCE GAP / DECISION REQUIRED |
| Diagnoses coded | `patient_diagnosis` | `/diagnoses/patients/{id}/patient-360` | `patient360.diagnosis.read` | yes | **none** | row+code deleted hidden | 20/100 | operational POST **no RequirePermission** | list | Table + provenance; PD360-R5 |
| Exam dx text | examinations | `/Examinations/patient/{id}` | `examination.view` | yes | — | — | unbounded | exam workspace | exam list | Do not merge until R5 |
| Examinations | clinical exams | same | `examination.view` | yes | — | — | unbounded | exam CUD | list | Rows + encounter handoff |
| Medications / Rx | prescriptions | `/prescriptions/patients/{id}/patient-360` | `patient360.medication.read` | yes | **none** | rx+lines deleted | 20/100 | `prescription.*` | Clinical **only** | Table; **fix timeline** |
| Labs | lab reports | `/lab-reports/patient/{id}` | `patient.view` | yes | none | **no DeletedAt** | unbounded | `patient.update` | list + optional `reportUrl` | Table; Open report only if URL |
| Imaging orders | imaging | `/Imaging/patient/{id}` | `examination.view` | yes | — | — | unbounded | imaging CUD | list | Table; handoff diagnostic |
| Imaging files | images | `/Imaging/patient/{id}/patient-360/images` | `examination.view` | yes | — | image deleted | 20/100 | `imaging.upload` | metadata | Table; no bytes in 360 |
| OCT | octimaging | patient-360 | `diagnostic.oct.read` | yes | **required; null excluded** | — | 20/100 | operational OCT | specialty card | Table under Scans |
| Optical | optical orders | `/optical-orders/patient/{id}` | `patient.view` | yes | none | **no DeletedAt** | unbounded | `patient.update` on tab | list | Table; not Optical POS |
| Chart notes | patient_notes | `/patient-notes/patient/{id}` | `patient.view` | yes | none | **no DeletedAt** | unbounded | `patient.update` | list + Sheet | Keep Sheet |
| Recommendations | counsellor session | none in 360 | — | — | — | — | — | counsellor | **absent** | SOURCE GAP |
| Medical records / clinical docs | mixed | see Documents | — | — | — | — | — | — | not in Clinical | Point to Documents |

**Do not implement mutations in Clinical.** HANDOFF ONLY except already-certified Sheet **read** of notes.

---

## 7. Care architecture

| Item | Class | Notes |
|---|---|---|
| Visits / encounters | READ SAFE | `GET /visits/by-patient/{id}` page 1 size 100, `patient.view`. Open encounter HANDOFF |
| Appointments | READ SAFE | `GET /Appointments/patient/{id}`, `appointment.view`. Book/Open Scheduling HANDOFF |
| Counselling sessions | READ SAFE (limited) | `GET /counseling/patients/{id}/patient-360/sessions`, `counseling_sessions.read`. Null branch **excluded**. No Start/Assign/ReQueue — CERTIFIED |
| Counselling notes / quotes / decisions | SOURCE GAP + PD360-R3 | Not on approved 360 DTO |
| Recordings / transcripts | SOURCE GAP + PD360-R3 + PD360-R1 | Do not copy Counsellor ops |
| AI summaries | SOURCE GAP + PD360-R10 | Do not use `clinical_summary` as AI |
| Counselling documents | READ SAFE metadata | Documents section, `session_documents.read`; **no branch filter** — SECURITY GAP |
| Follow-up | SOURCE GAP | No 360 list; HANDOFF Counselling |
| Referrals | SOURCE GAP | ReferralsTab Coming Soon |
| Communications | READ SAFE | `GET /patient-communications/patient/{id}`, `patient.view`. Not NotificationHub. Writes on legacy tab `patient.update` |
| Notifications hub | PRODUCT DECISION | Do not merge without decision |

**PROPOSED Care IA:** One section, four **anchor groups**: Visits, Appointments, Counselling (context table), Communication. Compact tables. One handoff row: Open Counselling (if permitted), Open Scheduling (if not already in header). No operational buttons.

**DECISION REQUIRED:** Stop duplicating visits/appointments in Administration (Admin keeps check-in timestamps, consents, IP history, registration).

---

## 8. Documents architecture

| Source | GET | POST/upload | Update | Delete | View/download | Permission | Owner | Branch | Tenant | 360 | Class |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MPI widgets stub | `getPatientDocuments` returns `[]` TODO | — | — | — | — | — | MPI | — | — | Honest unavailable card | SOURCE GAP |
| Legacy uploads | `GET /patient-document-uploads/patient/{id}` | UI non-functional | — | — | — | Phase4 **disabled** | Documents | — | — | unused | SOURCE GAP |
| CCMS documents | `GET /ccms/documents/by-patient/{id}` | desk upload | desk | desk | access-url **not called by 360** | `ccms.document.read` | CCMS | JWT tenant; no branch in 360 client | yes | metadata list | SAFE (limited) |
| Counselling session docs | `GET /counseling-session-documents/by-patient/{id}` | desk | verify | desk | desk | `session_documents.read` | Counsellor | **comment: no branch filter** | — | metadata | SAFE + SECURITY GAP |
| Insurance documents table | no patient-360 GET | pre-auth | — | — | — | — | CCMS/insurance | — | — | unused | SOURCE GAP + PRODUCT DECISION |
| Registration docs | none found as patient-360 | create wizard | — | — | — | — | MPI | — | — | unused | SOURCE GAP |
| Patient portal uploads | not 360 | — | — | — | — | `patient_portal.view` sidebar | Portal | — | — | unused | SOURCE GAP |
| Imaging files | Clinical GET metadata | `imaging.upload` | — | — | not 360 | `examination.view` | Imaging | tenant + deleted | yes | Clinical not Documents | AVAILABLE BUT LIMITED |
| Lab report URL | Clinical if https | — | — | — | external | `patient.view` | Lab | tenant; no DeletedAt | yes | Clinical | AVAILABLE BUT LIMITED |
| IP pre-op docs | not 360 | — | — | — | — | IP | IP | — | — | unused | SOURCE GAP; do not open IP ops |
| Consents | rows not files | — | revoke `patient.update` | — | — | `patient.view` | Admin | tenant; no deleted filter | — | Admin | HANDOFF / READ SAFE |

**PROPOSED Documents IA:** One index table with columns Date, Title, Type, Source, Status. Hide empty sources (do not mount three empty cards). MPI: one-line SOURCE GAP, not a large card. No upload until product + owning POST exist.

**DECISION REQUIRED:** View/download from 360 (call existing access-url) vs handoff only.

---

## 9. Coverage architecture

| Item | Patient-scoped read | Mutation | Permission | Branch | Tenant | Deleted | 360 source | Owner | 360 representation |
|---|---|---|---|---|---|---|---|---|---|
| Insurance profile | `GET /patient-insurance/patient/{id}` | CUD/verify `patient.update` on Insurance tab | `patient.view` | none | yes | **does not hide `deleted_at`** | `loadPatient360InsuranceProfiles` | MPI insurance | READ SAFE; deleted **PD360-R1** |
| Policy / registration insurance strings | summary columns | create | `patient.view` | — | — | — | keep separate | MPI | provenance label |
| Eligibility (CCMS) | `GET /ccms/eligibility-checks/by-patient/{id}` | CCMS desk | `ccms.eligibility.read` | tenant JWT | yes | — | loader | CCMS | compact table |
| Preauthorization (CCMS) | `GET /ccms/authorizations/by-patient/{id}` | desk | `ccms.authorization.read` | — | yes | — | loader | CCMS | compact table |
| Legacy pre-auth stores | not 360 | — | `insurance.preauth.view` cited historically | — | — | — | unused | Insurance | PRODUCT DECISION stay out |
| Claims | `GET /ccms/claims/by-patient/{id}` | desk | `ccms.claim.read` | — | yes | — | loader | CCMS | compact table |
| Insurance documents | see §8 | — | — | — | — | — | unused | — | SOURCE GAP |
| OPD bills | `GET /OpdBills?patientId=` / by-patient | cashier `bill.update` | helper: **`patient.view` + `bill.update`** | **none** | yes | `DeletedAt == null` | `loadPatient360Bills` size 50 no pager | Billing | READ SAFE if helper runs; PD360-R8 branch |
| Invoices / charges / payments | bill DTO fields | cashier | same | none | yes | — | inside bill rows | Billing | context lines, not cashier |
| IP financials | not loaded | IP billing | — | — | — | — | unused | IP billing | SOURCE GAP; **do not** open IP ops |
| Refunds | `RefundsController` GET patient `patient.view` | refund perms | — | — | — | — | unused | Billing | SOURCE GAP; no refund workflow on 360 |
| Coverage cases | `GET /ccms/coverage-cases/by-patient/{id}` | desk | `ccms.coverage_case.read` | — | yes | — | loader | CCMS | compact table |
| Settlement | by-patient | desk | `ccms.settlement.read` | — | yes | — | loader | CCMS | compact table |
| CCMS billing allocation | not 360 | `ccms.billing.read` | — | — | — | — | unused | CCMS | SOURCE GAP (not cash) |
| Orphan `patients-enhanced` account/policies/claims URLs | **no matching controllers** | — | — | — | — | — | unused | — | SOURCE GAP — do not use |

**PROPOSED Coverage IA:** Two stacks with in-section anchors (Insurance | CCMS | OPD billing). Collapse empty stacks to one sentence. Handoffs: Open Billing (gated), Open CCMS only if a **patient-scoped** CCMS route exists — currently it does not.

Phase 1H coverage audit is **stale** on “no CCMS patient-id GET” and “bill GET JWT-only”. Live code has by-patient CCMS reads and `AuthorizePatientBillReadAsync`. Treat Phase 1H as historical except deleted insurance rows and PD360-R8.

---

## 10. Administration architecture

| Item | 360 | Class |
|---|---|---|
| Registration snapshot | summary DOB, phone, email, blood, emergency, data quality | READ SAFE; **raw ISO DOB** UX DEFECT |
| Demographics / identifiers beyond MRN | Health ID not on Patient 360 summary | AVAILABLE BUT LIMITED |
| Appointments | same loader as Care | DUP — DECISION REQUIRED |
| Visits / check-in | visits include check-in time here | READ SAFE; keep **check-in** here if Care drops duplicate |
| Consents | GET `patient.view`; revoke `patient.update` on tab | READ SAFE on 360 |
| Admission / IP history | paged closed journeys `ip_management.view`; states Discharged / AdmissionCancelled; branch allow-list; `DeletedAt == null` | READ SAFE context; **not** IP census |
| Open IP | header badge only | HANDOFF display; **do not** open IP Management workflow |
| Surgery / OT | `SURGERY_UNAVAILABLE` always | SOURCE GAP. `SurgeryController.GetByPatient` **no RequirePermission**; Surgery tab uses **name not id** — SECURITY GAP. Do not wire that API into 360 |
| Portal / access | `PortalAccessTab` placeholder | SOURCE GAP |

**PROPOSED Admin IA:** Registration (with Edit Patient if approved), Identifiers, Consents, Check-in history, IP history (read-only table), Surgery honest one-line gap. No OT board.

---

## 11. Timeline architecture

**CERTIFIED:** Client aggregation in `loadPatient360Timeline`. No `PatientEvents` table. Newest-first. Source label on each row.

| Event | Source | Date field | Identity | Duplicate risk | Order | Source label | Nav |
|---|---|---|---|---|---|---|---|
| Appointment | admin appointments | `appointmentDate` | `appointment-{id}` | Same-day visit | client sort | Scheduling | usually none |
| Visit | admin visits | `createdAt` or `checkInTime` | visit id | vs Overview recent visits | client | Front desk | encounter href |
| Consent | consents | granted/revoked | consent id | — | client | Administration | none |
| Examination | clinical exams | exam date | exam id | vs coded dx | client | Examinations | none/encounter |
| Prescription | `clinical.prescriptions` | — | — | **always empty** (stub) | — | — | — **IMPLEMENTATION DEFECT** |
| Lab | labs | completed/ordered | lab id | — | client | Laboratory | report URL not timeline |
| Communication | comms | sentAt | comm id | vs notifications | client | Communication | none |
| Counselling | 360 sessions | sessionDate | session id | vs docs | client | Counselling | none |
| OPD bill | bills | billDate | bill id | vs CCMS settlement | client | Billing | none |

**Not merged (SOURCE GAP / DECISION REQUIRED):** IP vitals, imaging files, OCT/biometry/retinopathy, coverage cases/claims, insurance profile, counselling/CCMS documents, surgery, registrations as events.

**UX:** Timeline empty/unavailable is **plain text**, the best empty pattern in 360. Unauthorized is **collapsed** into `sourcesUnavailable` and **never rendered** — UX DEFECT.

**Do not create PatientEvents.** PD360-R6 still open for correction semantics. Tie-break is `id` string, not domain-defined.

---

## 12. Patient editing capability

Product requirement: permitted patient-specific editing. **Do not create a new update API.**

| Data | Existing API | Existing UI | Permission | Safe to expose in 360? | Mutation behavior |
|---|---|---|---|---|---|
| Demographics name/DOB/gender | `PUT /patients/{id}` | **Exam Medical History tab** (`patientApi.update`); **no 360/Directory Edit** | `patient.update` | **DECISION REQUIRED.** Fields **are** written | Duplicate check exclude self; **≥0.95** → 400. Tenant from JWT. Then `UpdatePatientAsync` |
| Contact phone/email | same PUT | same | `patient.update` | DECISION REQUIRED | same |
| Address (single `Address`) | same PUT | same | `patient.update` | DECISION REQUIRED | written |
| Blood group / allergy **text** | same PUT | same | `patient.update` | Allergy text ≠ `patient_allergies` table | Dual store risk |
| Emergency contact | on **Create** and DTO (`UpdatePatientRequest` **extends** `CreatePatientRequest`) | Add Patient wizard; Preview **read** | create: `patient.create` | **Not safe as 360 edit today** | Controller **does not assign** emergency fields on PUT — SOURCE GAP |
| Identifiers MRN | not on PUT | MRN generation on create | — | **No** | Do not edit MRN from 360 |
| Health ID / Aadhaar | create columns; **not** assigned on PUT | registration | `patient.create` | **No** until PUT writes them | SOURCE GAP |
| Title/middle/nationality/occupation/address lines | on Create DTO | wizard | `patient.create` | **No** via current PUT mapping | SOURCE GAP |
| Photo | `POST/DELETE /patients/{id}/photo` | photo UI | **`patient.edit`** (not `patient.update`) | DECISION REQUIRED | different permission |
| Registration as workflow | `POST /patients` | Add Patient | `patient.create` | **No** — out of 360 | PD360-R7 |
| Allergies table | POST/PUT/DELETE `/patient-allergies` | Allergies **tab** (not 360 panel) | `patient.update` | HANDOFF or later slice | EDIT SAFE in owning tab |
| Consents revoke | consents API | Consents tab | `patient.update` | HANDOFF | EDIT SAFE in tab |
| `patientsEnhancedApi.updatePatient` | defined | **no callers** | unknown | **Do not use** | SOURCE GAP / dead client |

**CERTIFIED:** 360 Administration Registration is read-only.

**PROPOSED (not authorized):** If product approves Edit Patient, use **only** the live PUT field set, `patient.update`, existing duplicate behavior, Sheet (not a new wizard), invalidate `patientLookupKeys` summary after success. Emergency/identifiers stay **out** until the existing PUT actually persists them.

---

## 13. Document upload/edit capability

See §8. **360 currently:** metadata GET for CCMS + counselling; MPI unavailable; tests forbid upload/delete verbs in 360 UI.

| Class | Meaning for UX-2 |
|---|---|
| SAFE | List CCMS + counselling metadata |
| AVAILABLE BUT LIMITED | No download; imaging/lab live in Clinical |
| SOURCE GAP | MPI stub; Phase4 uploads disabled; insurance_documents; portal; IP pre-op |
| PERMISSION GAP | View/download would need `ccms.document.read` access-url + session doc read; upload needs owning create codes |
| PRODUCT DECISION REQUIRED | Whether 360 becomes a document desk |
| SECURITY GAP | Counselling docs by-patient **no branch filter** |

**PROPOSED:** Documents remain an **index**. Upload/edit/delete stay in owning modules. Optional later: **view** via existing access-url after permission decision.

---

## 14. Bidirectional data flow

### A. Owning module → 360 (PD-G)

```text
owning module mutation
  → authoritative DB
  → 360 section remount / pagination refetch
```

**CERTIFIED possible for reads that 360 already calls**, but **not realtime**. Hub SignalR invalidates `patient-lookup` keys only (summary + recent visits). Clinical/Care/Documents/Coverage/Admin/Timeline use **`useEffect` + `getApi()`**. Counsellor / CCMS / appointments / IP Query keys **do not** invalidate 360 lists.

**Stale data risk: HIGH** if the user keeps 360 open and works in another module/tab.

### B. 360 edit → owning module

**CERTIFIED:** 360 **does not write**. If Edit Patient is approved, path would be:

```text
360 Sheet → PUT /patients/{id} (patient.update) → patient row → invalidate patient-lookup summary → other MPI screens using same keys refresh
```

Exam Medical History already writes that PUT; Directory summary would refresh on next `patient-lookup` fetch. **Optimistic updates:** none on 360. **Concurrency:** last PUT wins; duplicate 400. **Errors:** toast on export today; PUT errors would need visible validation (not designed).

| Proposed editable field | Mutation | SoT | Cache | Invalidation | Stale risk | Optimistic | Concurrency | Errors |
|---|---|---|---|---|---|---|---|---|
| Name/DOB/gender/phone/email/address/blood/allergy text | `PUT /patients/{id}` | `patient` row | `patientLookupKeys` | **must** invalidate summary; 360 lists unused | Other open 360 sections until remount | none | last-write + duplicate 400 | 400 duplicate / 401 / 404 |
| Emergency / Health ID | **none on PUT** | create-only columns | — | — | — | — | — | SOURCE GAP |
| Photo | `POST .../photo` | blob | summary `photoThumbnailUrl` | invalidate summary | until refetch | none | last photo | `patient.edit` |
| Domain clinical/coverage | **not from 360** | owning APIs | module Query keys | 360 unaware | HIGH | n/a | n/a | n/a |

**PROPOSED (not authorized):** Introduce `patient360Keys` only after product accepts remount-vs-Query. Do not add a second bus. Do not use socket.io.

---

## 15. Permissions/roles

**Do not create a Patient 360 role.** Page remains `patient.view`. Domain APIs keep owning codes. Colon-style `PATIENT:UPDATE` was **not** found on MPI patient APIs.

| User / permission | 360 visible | Domain readable | Domain editable | Handoff allowed |
|---|---|---|---|---|
| `patient.view` only (typical OPD/registration) | **Yes** (route) | Identity, OPD vitals, allergies, labs, optical, notes, visits, comms, consents, insurance profile | **No** on 360 | Continue if visit id (dest may 403); Check-in ungated in UI; Book **hidden**; Counselling/Queue/Billing/Export **shown** — SECURITY GAP |
| + `patient.update` | Yes | same | PUT exists; **360 has no UI** | — |
| + `patient.edit` | Yes | same | photo/vitals POST; not 360 | — |
| + `patient.export` | Yes | same | PDF API | UI shows Export **without** this code — SECURITY GAP |
| + `appointment.view` | Yes | appointments | no | Book shown |
| + `bill.update` (with `patient.view`) | Yes | OPD bills (helper) | no on 360 | Open Billing **should** require a billing code; currently ungated |
| + `counseling_sessions.read` | Yes | session context | no | Open Counselling should require this; currently ungated |
| + `session_documents.read` | Yes | counselling docs metadata | no | — |
| + `ccms.*.read` map | Yes | matching CCMS lists | no | Open CCMS ungated / unscoped |
| + `patient360.medication.read` / `patient360.diagnosis.read` | Yes | Rx / coded dx | no | — |
| + `ip.vitals.read` | Yes | IP vitals | no | **Do not** open IP ops |
| + `ip_management.view` | Yes | closed IP history | no | **Do not** open IP census/workbench |
| + `examination.view` / `diagnostic.oct.read` / `CLINICAL:BIOMETRY:VIEW` / `CLINICAL:SCREENING:VIEW` | Yes | respective clinical | no | diagnostic handoff |
| + `queue_management.view` | Yes | none extra | no | Queue link ungated |
| + `CLINICAL:EXAMINATION:VIEW` | Yes | encounter dest | encounter | Continue should respect this |
| IP Management operational perms | 360 must **not** launch IP workflows | IP history/vitals reads only | no | **APPROVED DIRECTION: forbidden** |
| OT operational | Surgery unavailable | no | no | **forbidden** until safe patient-id read |

**Ambiguity = PRODUCT/SECURITY DECISION:** Showing a More item the destination will reject vs hiding it. Recommend **hide** using existing `useHasPermission` codes (do not invent). Backend remains authoritative.

OPD billing **context** is available when `patient.view` **and** `bill.update` (PD360-R2, now enforced on patient bill GET). OPD users without `bill.update` should see Coverage financial as **unauthorized**, not empty.

---

## 16. Tenant/branch/security

| Source | Patient | Tenant | Branch | Deleted | Permission |
|---|---|---|---|---|---|
| Summary | id | JWT | engagement uses client `branchId` | lookup honors `deleted_at` | `patient.view` |
| Suggest (switcher) | q | JWT | branch context | — | `patient.view` |
| OPD vitals | id | yes | **missing** | filtered | `patient.view` |
| IP vitals / IP history | id | yes | **allow-list; null excluded** | journey deleted hidden | IP codes |
| Allergies / notes / labs / optical / comms | id | yes | **missing** | **missing DeletedAt** | `patient.view` |
| Rx 360 / dx 360 | id | yes | **missing** | filtered | 360 read codes |
| OCT | id | yes | **required** | — | `diagnostic.oct.read` |
| Counselling sessions 360 | id | — | **null excluded** | — | `counseling_sessions.read` |
| Counselling documents | id | — | **missing (commented)** | session+doc deleted excluded | `session_documents.read` |
| OPD bills | id | yes | **missing** | filtered | `patient.view`+`bill.update` |
| Insurance profile | id | yes | missing | **not hidden** | `patient.view` |
| CCMS by-patient | id | JWT + CcmsAuthz | not in 360 client | — | granular `ccms.*.read` |
| Consents | id | yes | missing | **no deleted filter** | `patient.view` |
| Operational diagnosis/biometry GET | id | mixed | mixed | mixed | **some GETs lack RequirePermission** — SECURITY GAP (desk, not 360 360-loaders) |
| Surgery GET by patient | name | — | — | — | **no permission** — SECURITY GAP; do not use |

**Explicit flags (do not auto-normalize)**

- Missing tenant: none of the 360 loaders identified as fully unscoped; JWT tenant is typical.
- Missing branch: bills, allergies, notes, labs, optical, comms, Rx360, dx360, counselling documents, insurance.
- Inconsistent deleted: insurance/allergies/notes/labs/optical/comms vs vitals/bills/Rx/dx.
- Cross-branch: patient-id lists without branch return **all tenant rows** the API allows.
- Nullable branch: counselling sessions/OCT/IP **exclude** null; bills/MPI lists **do not filter**.

**PD360-R8 remains DECISION REQUIRED.** Prior Patient 360 audits flagged this; still unresolved.

---

## 17. Retention/lifecycle

**Do not invent a Patient 360 retention policy.**

| Area | Existing behavior | Policy |
|---|---|---|
| Patient lookup | honors `deleted_at` | CERTIFIED |
| `DELETE /patients/{id}` | `patient.delete` — hard vs soft **unspecified in 360** | **PD360-R9 DECISION REQUIRED** |
| OPD vitals / bills / Rx360 / dx360 / IP journey | hide `DeletedAt` | source-level |
| Insurance GET | returns deleted rows; 360 can show `deletedAt` | **PD360-R1 DECISION REQUIRED** |
| Allergies/notes/labs/optical/comms/consents GETs | no deleted filter | **PD360-R1** |
| Counselling recordings | retention not defined in 360 | **PD360-R1** |
| Document blobs | CCMS/counselling desk lifecycle | source policy; not 360 |
| IP vitals hard delete | cascade with journey; contract says PD360-R9 still open | documented in IP vitals contract |

Mark **DECISION REQUIRED** wherever no authoritative retention period exists (recordings, deleted clinical/consent presentation, insurance soft-delete as current).

---

## 18. UAT data matrix

**Do not modify data. Do not create seed APIs.**

| Patient / source | Clinical | Counselling | Documents | Insurance | Billing | Appointments | Visits | Consents | Comms | IP | OT |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **UAT360 Longitudinal** (`seed-patient-360-uat.ts`) | Allergy **text only** on create | No | No | No | No | No | No | No | No | No | No |
| Other `UAT360` scripts | **None found** | | | | | | | | | | |
| Vitest fixtures | In-memory mappers only | | | | | | | | | | |
| Live hospital patients | **Unknown in repo** — inspect Directory in the target environment | Use existing patients that already have domain rows | | | | | | | | | |

**CERTIFIED seed identity:** name `UAT360 Longitudinal`; phone `+919360000001`; email `uat360.longitudinal@example.test`; DOB `1975-04-12`; emergency + blood group + penicillin **text**. Idempotent lookup; refuses `NODE_ENV=production`.

**DECISION REQUIRED:** How to certify multi-domain UX without new seed APIs — use named live UAT patients per environment, documented outside this repo if they contain PHI.

---

## 19. Existing APIs/data sources

See implementation report §12 plus this audit. Summary of **wired, patient-scoped, permissioned** sources 360 already consumes:

- Patient summary / recent visits / duplicate check / data quality / export PDF / print  
- OPD vitals, IP vitals, allergies, examinations, Rx 360, coded dx 360, labs, imaging orders/files, optical, notes, specialty (biometry, retinopathy, OCT)  
- Visits, appointments, consents, IP history  
- Counselling 360 sessions, counselling documents, communications  
- Insurance profiles, OPD bills, CCMS cases/auth/eligibility/claims/settlements/documents  

---

## 20. Missing APIs/data sources

| Gap | Class |
|---|---|
| MPI patient documents live GET | SOURCE GAP |
| Patient-document-uploads (Phase4 disabled) | SOURCE GAP |
| Emergency/identifier/Health ID **update** persistence | SOURCE GAP |
| Medical history 360 inclusion | SOURCE GAP / DECISION REQUIRED |
| Clinical recommendations list | SOURCE GAP |
| Counselling notes, quotes, decisions, recordings, transcripts, AI | SOURCE GAP + PD360-R3/R10 |
| Follow-up list | SOURCE GAP |
| Referrals | SOURCE GAP |
| Portal access | SOURCE GAP |
| Surgery/OT patient-id authorized GET | SOURCE GAP + SECURITY GAP |
| IP financials as patient ledger | SOURCE GAP (contract forbids fake ledger) |
| Refunds on 360 | SOURCE GAP (by design) |
| Insurance_documents patient index | SOURCE GAP |
| Patient-scoped CCMS workspace URL | SOURCE GAP (handoff) |
| NotificationHub as chart history | SOURCE GAP / DECISION REQUIRED |
| Shared React Query keys for 360 domain lists | SOURCE GAP (cache) |
| Timeline Rx (API exists; loader unused) | IMPLEMENTATION DEFECT not missing API |
| `patients-enhanced` account/policies/claims | SOURCE GAP — do not call |

---

## 21. Product decisions required

Count below is the **DECISION REQUIRED** register for UX-2. Approved directions and pure source gaps are listed but not counted unless a product choice is needed (wait vs omit).

| ID | Decision | Class |
|---|---|---|
| UX2-D1 | Remove `PatientSwitcherRail` + `PatientRecordNav` from 360 | APPROVED DIRECTION (this brief) |
| UX2-D2 | Fate of `PatientWorkspaceTabs` (close-tab switches patient) | **DECISION REQUIRED** |
| UX2-D3 | Header: formatted DOB, sex formatter, show UUID? | **DECISION REQUIRED** |
| UX2-D4 | Expose Edit Patient via existing PUT + `patient.update` | **DECISION REQUIRED** |
| UX2-D5 | 360 edit field allow-list vs ignored Create DTO fields (emergency, Health ID, title, address lines) | **DECISION REQUIRED** + SOURCE GAP |
| UX2-D6 | Photo in 360 (`patient.edit`) | **DECISION REQUIRED** |
| UX2-D7 | Duplicate 400 UX on demographic PUT | **DECISION REQUIRED** |
| UX2-D8 | Document view/download in 360 | **DECISION REQUIRED** |
| UX2-D9 | Document upload/edit/delete in 360 | **DECISION REQUIRED** (recommend no) |
| UX2-D10 | Fund MPI document GET vs keep unavailable | **DECISION REQUIRED** |
| UX2-D11 | Medical history on Clinical (`counseling_sessions.read`) | **DECISION REQUIRED** |
| UX2-D12 | Clinical recommendations | **DECISION REQUIRED** |
| UX2-D13 | Follow-up object | **DECISION REQUIRED** |
| UX2-D14 | Referrals | **DECISION REQUIRED** |
| UX2-D15 | Portal/access | **DECISION REQUIRED** |
| UX2-D16 | Surgery/OT: remain unavailable vs new safe API | **DECISION REQUIRED** |
| UX2-D17 | Gate More/primary with destination permissions | **DECISION REQUIRED** / SECURITY |
| UX2-D18 | Continue + `CLINICAL:EXAMINATION:VIEW` | **DECISION REQUIRED** |
| UX2-D19 | Export PDF + `patient.export` | **DECISION REQUIRED** |
| UX2-D20 | Queue status in More (not patient-scoped) | **DECISION REQUIRED** |
| UX2-D21 | Open CCMS unscoped vs hide | **DECISION REQUIRED** |
| UX2-D22 | Check-in `waitingMinutes` parity with Directory | **DECISION REQUIRED** |
| UX2-D23 | Deduplicate Care vs Admin visits/appointments | **DECISION REQUIRED** |
| UX2-D24 | Timeline source expansion | **DECISION REQUIRED** |
| UX2-D25 | Overview extra domain reads | **DECISION REQUIRED** |
| UX2-D26 | 360 React Query keys vs remount-only (PD-G) | **DECISION REQUIRED** |
| UX2-D27 | Allergy text vs `patient_allergies` | **DECISION REQUIRED** |
| UX2-D28 | Communications vs NotificationHub | **DECISION REQUIRED** |
| UX2-D29 | Amount visibility on bills/profile | **DECISION REQUIRED** |
| UX2-D30 | Print page `ProtectedRoute` | **DECISION REQUIRED** / SECURITY |
| UX2-D31 | Fate of leftover `PatientRecordTabContent` mutation tabs | **DECISION REQUIRED** |
| UX2-D32 | Multi-domain UAT without new seeds | **DECISION REQUIRED** |
| PD360-R1 | Retention / deleted-as-current | **DECISION REQUIRED** |
| PD360-R3 | Counselling content gates | **DECISION REQUIRED** |
| PD360-R5 | Diagnosis winner | **DECISION REQUIRED** |
| PD360-R6 | Timeline order / corrections | **DECISION REQUIRED** |
| PD360-R7 | Canonical Add Patient | **DECISION REQUIRED** (out of 360 UI) |
| PD360-R8 | Null-branch / cross-branch | **DECISION REQUIRED** |
| PD360-R9 | Hard vs soft patient delete | **DECISION REQUIRED** |
| PD360-R10 | AI summary | **DECISION REQUIRED** |

Counted items: UX2-D2 through UX2-D32 = 31. Prior contract still open: PD360-R1, R3, R5, R6, R7, R8, R9, R10 = 8. UX2-D1 is APPROVED DIRECTION and is not counted. **Total: 39.**

---

## 22. Recommended UX design

**APPROVED DIRECTION / PROPOSED — not authorized**

Match Counsellor **density and honesty**, not Counsellor chrome (no `.counselling-session`, no Assign/Start).

1. **Fixed patient workspace** — identity header + alerts + seven sections. No search rail, no N of M, no Recent on the chart.
2. **Header** — name, MRN, formatted age/sex/DOB, visit, station, provider, IP badge, acuity. Primary XOR action. Book if `appointment.view`. More = permitted handoffs + print/export.
3. **Overview** — residual facts only; no second header; no empty context card.
4. **Clinical** — sticky in-section anchors; compact tables; Sheets for notes; specialty as table groups not three empty tiles.
5. **Care** — four anchored groups; counselling read-only table; communication truncated + Sheet as today.
6. **Documents** — one sourced table; omit empty sources; MPI one-line gap.
7. **Coverage** — two stacks (payer / OPD money); omit empty stacks; no cashier.
8. **Administration** — registration + consents + check-in + IP history table; surgery one-line unavailable.
9. **Timeline** — keep list; show which sources failed; include Rx via existing 360 Rx loader once authorized.
10. **Empty states** — one line in the group header row: `No visits recorded` / `Not available in Patient 360` / `Not available to this sign-in` / `Could not load — retry` / `Source not connected`. Never a large empty card.

Use existing `ui/table`, `ui/sheet`, `ui/dialog`, `Button`, `Badge`, `react-hot-toast`. No new design system.

---

## 23. Recommended implementation slices

**Not authorized.** Suggested only after decisions in §21.

| Slice | Intent | Depends on |
|---|---|---|
| UX-2A | Remove switcher rail + record nav; optional tabs decision | D1–D2 |
| UX-2B | Action hierarchy + permission-gated More | D17–D21 |
| UX-2C | Overview de-duplication + compact empty | D3, D25 |
| UX-2D | Clinical tables, anchors, empty lines | — visual only after D27 |
| UX-2E | Care tables; Admin de-dupe | D23 |
| UX-2F | Documents single index + honesty | D8–D10 |
| UX-2G | Coverage stacks + empty collapse | D21, D29 |
| UX-2H | Timeline source honesty + Rx loader wiring | D24, R6 |
| UX-2I | Edit Patient Sheet on existing PUT | D4–D7 |
| UX-2J | `patient360Keys` invalidation | D26 |
| UX-2K | Tests + named UAT patients | D32 |

Do **not** combine with Directory, Preview, Add Patient, Counsellor, Billing rules, or IP/OT workflow changes.

**IMPLEMENTATION DEFECT that is still not authorized to fix in this audit:** Timeline Rx stub. Call it out for a later slice; do not silently ship.

---

## 24. Exact out-of-scope items

No change to:

- Patient Directory  
- Patient Preview  
- Add Patient / duplicate threshold / MRN generation  
- Counsellor ownership, Waiting List, counselling state machine  
- Billing rules, Insurance rules  
- OT / IP operational workflows  
- Global design system  
- Permissions catalog (no new Patient 360 role)  
- Database schema  
- New APIs / seed APIs / PatientEvents  
- Routes (keep `/dashboard/patients/[id]`, `section` query)  
- This audit’s application code  

---

## 25. Risks

| Risk | Class |
|---|---|
| Implementing density before removing switcher leaves a worklist-with-prettier-cards | UX DEFECT |
| Edit Patient without PUT field audit writes a false success for emergency/IDs | SECURITY / SAFETY |
| Wiring Surgery GET-by-name | SECURITY GAP |
| Showing deleted insurance/allergies as current | PD360-R1 |
| Cross-branch history leaking via unfiltered patient-id GETs | PD360-R8 |
| Export PDF / More handoffs leaking destinations | SECURITY GAP |
| Opening IP Management from admitted badge | ownership violation |
| Treating Phase 1H coverage audit as live | stale evidence |
| UAT on identity-only seed → false “empty hospital” | UAT risk |
| Optimistic 360 cache without Query design | stale clinical/financial |
| Copying Counsellor visual system tokens globally | design-system freeze |
| Collapsing SOURCE GAP into “No records” | clinical safety / honesty |

---

## Appendix A — Empty / unavailable states

| State | Meaning | Current typical copy | Proposed |
|---|---|---|---|
| NO RECORDS | Source succeeded, zero rows | `No … recorded/found.` inside a card | One line in group chrome |
| UNAVAILABLE | Wired but 360 cannot show (MPI docs, Surgery) | large card “not available in Patient 360” | One line + source |
| UNAUTHORIZED | 401/403 | “not available to this sign-in” | Same, no card wall |
| TEMPORARY ERROR | Network; currently mapped to unavailable | unavailable copy | Distinct + retry |
| SOURCE GAP | Never connected | mixed | “Not connected in Patient 360” |

Incorrect large cards: MPI documents, Surgery/OT, Overview empty current-care, Coverage ×7 empty, specialty ×3 empty, Clinical Blocks wrapping only a sentence, Care Groups with empty `<ul>`.

Timeline status text is the pattern to copy.

---

## Appendix B — Recommended action model (verified)

| Slot | Candidate | Repository support | Verdict |
|---|---|---|---|
| Primary | Continue encounter **XOR** Check-in | CERTIFIED helper; gate Continue with exam view **undecided**; Check-in waitingMinutes **undecided** | **PROPOSED** pending D18/D22 |
| Secondary | Book appointment | CERTIFIED `appointment.view` | **PROPOSED** keep |
| More | Edit Patient | PUT exists; UI does not; emergency not persisted | **Do not auto-approve** |
| More | Open Counselling | Handoff exists; ungated | **Only if** `counseling_sessions.read` |
| More | Queue status | Not patient-scoped | **Do not auto-approve** |
| More | Open Billing | OPD URL with patientId; ungated | **Only if** a live billing permission the dest uses |
| More | Print summary | CERTIFIED | **PROPOSED** keep |
| More | Export PDF | API `patient.export`; UI ungated | **Only if** `patient.export` |

IP/OT operational actions: **rejected** for 360.

---

**AUDIT COMPLETE**  
**PRODUCT DECISIONS REQUIRED: 39**  
**IMPLEMENTATION NOT AUTHORIZED**  
**STOP**
