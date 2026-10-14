# Patient 360 — Complete UX / Information Architecture Redesign Blueprint

Document type: Product / UX / IA blueprint  
Date: 2026-10-06  
Phase: **DESIGN ONLY — NO PRODUCTION IMPLEMENTATION**  
Route: `/dashboard/patients/[id]`  
Status: **APPROVED-READY FOR MANUAL PRODUCT REVIEW** — not an implementation authorization

This document is the target experience later Patient 360 UI slices must follow. It does **not** change application code, APIs, database, permissions, routes, migrations, or workflows.

Governing contracts (not reopened):

- `docs/decisions/patient-360-product-decision-contract.md` (PD-A–H; PD360-R1–R10)
- `docs/decisions/patient-360-ux-2-1-fixed-workspace-shell-report.md` (certified fixed-patient shell)
- `docs/decisions/patient-360-ux-2-master-audit.md` (audit evidence)
- `docs/design/patient-360-information-architecture.md` (earlier IA; this document supersedes **presentation** rules, not PD-A–H)

Classification used throughout:

| Label | Meaning |
|---|---|
| **CERTIFIED** | Observed in the current repository; preserve |
| **TARGET** | This blueprint’s UX; not implemented |
| **GREEN** | Safe existing patient-scoped source |
| **YELLOW** | Partially available / limited metadata / destination gap |
| **RED** | Unsafe or unsupported — do not wire |
| **SOURCE GAP** | No authoritative patient-scoped read/write for 360 |
| **DECISION REQUIRED** | Product/security/clinical must choose before a later slice |
| **FUTURE IMPLEMENTATION DECISION** | Capability exists elsewhere; 360 must not invent it now |

---

## A. Executive summary

Patient 360 is already **one patient, one fixed context, seven information domains**. The certified shell (UX-2.1) is the correct architecture and must not be redesigned.

The remaining product problem is **presentation and action hierarchy**, not missing tabs:

1. Important patient-context actions (Billing, Print, Export, scheduling) sit in a generic **More** menu, while **Open Counselling** is treated like a primary module launcher.
2. The seven sections still read as **backend-derived card encyclopedias** (one card per API) rather than user-facing workspaces.
3. **Book appt** points at a doctor schedule page that **does not read `patientId`**.
4. There is **no counselling appointment type** in Appointments. Counselling “schedule” is session create on the counsellor desk.
5. **View Billing** is a safe patient-scoped handoff. **Generate New Bill** is **not** a safe Patient 360 action today.
6. Timeline **never shows prescriptions** because the shared clinical loader stubs Rx while Clinical uses a separate medication loader.

**North star (unchanged):**

```text
ONE PATIENT
  → ONE FIXED PATIENT CONTEXT
  → ONE LONGITUDINAL RECORD WORKSPACE
  → MULTIPLE INFORMATION DOMAINS
  → HANDOFF INTO OWNING MODULES WHEN THE USER MUST ACT
```

Patient Directory remains discovery/census. Patient 360 remains longitudinal context. Operational ownership stays with the owning module.

This blueprint defines:

- A **direct action bar** (no junk-drawer More for primary work)
- Seven **workspace** layouts (tables, definition lists, Sheets, provenance)
- An **action/handoff matrix** (VIEW / HANDOFF / MUTATION)
- A **domain/source/permission matrix** with GREEN / YELLOW / RED
- Independent, UAT-able implementation phases **after** product approval

**This phase implements nothing.**

---

## B. Current-state problems

### B.1 Certified shell (do not reopen)

| Item | Status |
|---|---|
| Route `/dashboard/patients/[id]`, gate `patient.view` | CERTIFIED |
| Identity from `GET /patients/{id}/summary` | CERTIFIED |
| No `PatientSwitcherRail` / `PatientRecordNav` / “N of M” / `PatientWorkspaceTabs` on 360 | CERTIFIED (UX-2.1) |
| Seven-section nav `Patient360SectionNav` | CERTIFIED |
| Continue XOR Check-in via `resolvePatient360PrimaryActions` | CERTIFIED |
| Book appt UI gated `appointment.view` | CERTIFIED (destination is wrong — see E) |
| Export PDF UI gated `patient.export` | CERTIFIED (UX-2.1) |
| Queue unscoped handoff removed | CERTIFIED |
| Unscoped Open CCMS removed | CERTIFIED |
| No Edit Patient | CERTIFIED |
| Counselling Start / Assign / ReQueue absent | CERTIFIED |
| Print summary URL | CERTIFIED |

Repository contradiction against the fixed-patient shell: **none found.** Do not redesign the shell architecture.

### B.2 UX defects this redesign addresses

| Problem | Evidence | Effect |
|---|---|---|
| Generic **More** hides Billing, Print, Export, Open Counselling | `SummaryHeader` in `PatientRecordPage.tsx` | Staff cannot see patient-context work |
| Open Counselling is a Counsellor **desk/queue** launcher | `/dashboard/counsellors-desk/waiting-list?patientId=` does not filter; 0 or many sessions → full waiting list | 360 feels like Counsellor ops |
| Book appt destination ignores patient | `/dashboard/appointments/schedule?patientId=` → `DoctorSchedulePage` has no `useSearchParams` | Scheduling from 360 is broken |
| Seven sections = card grids | Local `Block` / `Patient360Group` almost everywhere; almost no `<table>` | Encyclopedia, not chart |
| Header facts repeated on Overview and Admin | Visit/station/provider/IP/engagements; DOB/phone/email/blood/emergency | Cognitive noise |
| Empty sources always mount large cards | MPI documents, Surgery/OT, Coverage ×7 | Fake completeness |
| Care/Coverage duplicate header launchers | Open Counselling, Open Scheduling, Open Billing | Module launcher feel |
| Visits/appointments duplicated in Care **and** Admin | Same loaders | Same list twice |
| Documents cannot open files | CCMS + counselling metadata only | Index without retrieval |
| Timeline Rx always empty | `loadPatient360Clinical` stubs `prescriptions: []` | Silent incompleteness |
| Timeline unauthorized collapsed | Sources dropped into `sourcesUnavailable`, never rendered | Looks like “no history” |
| Domain permissions often not gated on 360 chrome | Billing/Counselling CTAs ungated; dest still authorizes | Extra clicks then deny |

### B.3 What this redesign does **not** treat as a problem

- Missing patient switcher
- Missing Edit Patient
- Missing cashier / CCMS / OT / IP operational boards
- Missing new APIs, permissions, or event store

---

## C. Product north star

Patient 360 is the **authorized longitudinal chart** for one `patient.id`.

| Surface | Job | Not |
|---|---|---|
| Patient Directory `/dashboard/patients` | Discovery, census, filters, create, export | Chart |
| Patient Preview | Lightweight verification after create/lookup | Full record |
| Patient 360 `/dashboard/patients/[id]` | Read patient-scoped domains; hand off to act | Operational desk |
| Owning modules | Mutations, queues, worklists, boards | Identity SoT |

Do **not** turn Patient 360 into: Counsellor worklist, Billing workbench, CCMS workbench, Doctor’s Desk, Front Office worklist, Laboratory workstation, Imaging workstation, Optical POS, OT board, IP operational board, or Follow-up operational worklist.

Design system: existing Hospital Portal only (shadcn/ui, Radix, Tailwind 3, Lucide, `react-hot-toast`). No new visual language.

---

## D. Patient 360 mental model

```text
patient.id  (auth-service patient — canonical identity)
     │
     ▼
Fixed identity header  (who) + current context  (now)
     │
     ▼
Direct action bar  (what I can do from this patient, without leaving identity)
     │
     ▼
Alerts  (only when meaningful)
     │
     ▼
Seven workspaces  (same page, ?section=)
     Overview | Clinical | Care | Documents | Coverage | Administration | Timeline
     │
     ▼
VIEW in place  →  Sheet for long text  →  HANDOFF to owning module
NEVER silent operational MUTATION from chrome alone
```

### D.1 User questions (section jobs)

| Section | User question | Success look |
|---|---|---|
| **Overview** | What do I need to know **right now**? | Sparse orientation; no encyclopedia |
| **Clinical** | What is **clinically relevant**? | Grouped clinical facts, tables, provenance |
| **Care** | What care **happened**, is **scheduled**, and is **next**? | Journey, not four module dashboards |
| **Documents** | What **documents** are available? | One index, source labeled |
| **Coverage** | How is care **covered** and what **financial/insurance** context exists? | Insurance + CCMS + OPD bills as context |
| **Administration** | What **administrative activity** surrounds this patient? | Registration, consents, check-in, IP history |
| **Timeline** | What happened **over time**? | Dated events from existing sources only |

### D.2 Presentation rules (all sections)

Prefer: dense readable tables (`ui/table`), definition lists, grouped sections with `h2`/`h3`, compact summaries, source labels where two stores could be confused, Sheets for long content, dialogs only for existing booking/confirm patterns.

Avoid: giant card grids, decorative cards, repeated identity, repeated status badges, one card per API, one tab per table, duplicate worklists, generic More hiding important actions, stacking desktop cards on mobile.

**Mount a group only when** it has rows, a true empty recorded-absence, unauthorized, or an explicit SOURCE GAP sentence. Do not mount seven empty Coverage cards.

### D.3 Three honesty states (every domain)

| State | When | Copy pattern |
|---|---|---|
| Empty | Authorized GET succeeded, zero rows | “No {domain} recorded.” |
| Unauthorized | 401/403 | “{Domain} is not available to this sign-in.” |
| Unavailable / SOURCE GAP | Stub, missing API, non-patient-scoped, or load failure | “{Domain} is not available in Patient 360.” Never “No history.” |

Loading remains distinct. Transient load failure should be retryable in a later slice (do not collapse into SOURCE GAP copy).

---

## E. Header / action redesign

### E.1 Identity band — CERTIFIED, preserve

Local `SummaryHeader` in `PatientRecordPage.tsx`. Source: `GET /patients/{id}/summary`.

| Show | Field |
|---|---|
| Avatar | `PatientAvatar` + `photoThumbnailUrl` |
| Name | `h1` first + last |
| Line | MRN · age (`calcPatientAge`) · sex (`formatPatientSex`) |
| Context | Visit reason; station · provider · role; IP badge; acuity; engagements |

Do **not** add patient.id to the visible header in this redesign (URL remains canonical). Do **not** add Edit Patient. Do **not** restore switcher chrome.

Alerts stay **below** identity, **above** section nav: duplicate hint, data quality, registration allergy — only when meaningful.

### E.2 Target action bar (no generic More)

**TARGET** compact patient-context bar, right of identity on desktop, wrapping on tablet/mobile.

```text
[ Continue encounter | Check-in ]   ← XOR, primary
[ Schedule ▾ ]                      ← labeled schedule control, not “More”
[ Billing ]
[ Print ]
[ Export PDF ]                      ← only if patient.export
```

If only one schedule destination is permitted, **Schedule** collapses to a single labeled button (e.g. “Book appointment”).

**Do not** use a generic More menu as the primary hiding place for Billing, Schedule, Print, or Export. A labeled **Schedule** split control is an action, not a junk drawer.

On the narrowest screens, Print and Export may move into a labeled **“Summary”** overflow (`Print` / `Export PDF` only). Continue/Check-in, Schedule, and Billing stay visible.

### E.3 Continue / Check-in — CERTIFIED

Preserve `resolvePatient360PrimaryActions`:

- Continue when `assignedVisitId` is set → HANDOFF `/dashboard/patients/{id}/encounter/{visitId}` (dest: `CLINICAL:EXAMINATION:VIEW`)
- Check-in when Continue is false **and** `scheduledAt` (via `canDirectoryOfferCheckIn`) → HANDOFF `/dashboard/frontdesk/check-in?patientId=`
- Never both

Patient 360 does not create the visit. Type: **HANDOFF**.

**DECISION REQUIRED (not this UI slice):** Check-in page currently has no `ProtectedRoute`. Do not invent a permission. Do not change Front Desk in a 360 UX slice.

### E.4 Scheduling — repository findings

#### General appointment

| Item | Finding |
|---|---|
| Current 360 | Header **Book appt** (`appointment.view`) → `/dashboard/appointments/schedule?patientId=` |
| Dest | Doctor schedule. **Does not read `patientId`.** No `ProtectedRoute`. |
| Working create | `UnifiedAppointmentBooking` with `resumePatientId` |
| Directory | `PatientDirectoryAppointmentDialog` — **Dialog**, patient pre-selected |
| Book pages | `/dashboard/appointments/book`, `/dashboard/patients/book`, `/dashboard/frontdesk/book` read **`createdPatientId`**, not `patientId` |
| Create API | `POST /api/appointments` — **`appointment.create`** |
| List API | `GET /api/appointments/patient/{id}` — **`appointment.view`** (Care already uses this) |
| Types | Master `appointment.type` / `appointment.consultation_type` (OPD / FIRST_VISIT defaults). **Not counselling** |

**Classification:** Destination of current Book appt = **SOURCE GAP** (wrong page). Create capability **exists** in Appointments + Directory. Do **not** invent a new booking API or workflow.

**TARGET for Patient 360 “Schedule → General appointment”:**

- **Preferred:** reuse `PatientDirectoryAppointmentDialog` / `UnifiedAppointmentBooking` with `resumePatientId={patient.id}` (same as Directory). Mutation occurs inside the **owning booking component**, not a new 360 API.
- **Alternative HANDOFF:** `/dashboard/appointments/book?createdPatientId={id}` (existing query the book page already understands). Label remains patient-context scheduling; query key is an existing alias, not a new contract. **Do not** keep pointing at `/dashboard/appointments/schedule`.
- **Visibility:** keep **`appointment.view`** to match Directory (do not invent `appointment.create` as a new 360-only UI code). Backend create still requires `appointment.create`; failed submit stays the booking component’s problem.
- Type: **HANDOFF** (dialog or page) that may result in a mutation **inside Appointments**, not a 360-owned mutation.

#### Counselling appointment

| Item | Finding |
|---|---|
| Distinct appointment type | **None** |
| Current 360 “Open Counselling” | Waiting list `?patientId=` — **does not** open Schedule Counselling; 0/many sessions → full queue |
| Existing schedule seed | Waiting list `?createdPatientId=` loads MPI patient and **opens `AddPatientModal`** (Schedule Counselling) |
| Create API | `POST /api/Counseling/sessions` — **`counseling_sessions.create`** |
| Desk gate | Waiting list `ProtectedRoute` **`counseling_sessions.read`** |
| 360 session read | `GET /counseling/patients/{id}/patient-360/sessions` — **`counseling_sessions.read`** |

**Classification:** There is **no** counselling **appointment** in the scheduling module. There **is** an existing **counsellor-desk session schedule** seeded by `createdPatientId`. Inventing a counselling slot on `UnifiedAppointmentBooking` is **forbidden**.

**TARGET:**

| Action | Status |
|---|---|
| Schedule → **Counselling appointment** | **YELLOW.** Propose as a **HANDOFF** to `/dashboard/counsellors-desk/waiting-list?createdPatientId={id}` **only if** product accepts that this opens **session create** (AddPatientModal), not a calendar appointment. Gate visibility with **`counseling_sessions.create`** (existing code — do not invent). Dest page still requires read. |
| If product rejects session-create as “scheduling” | **Do not** show this dest. Care keeps read-only session table. |
| Open Counselling (queue/view) | **Not a primary header action.** Secondary Care handoff only, gated **`counseling_sessions.read`**, dest `?patientId=` (view unique session or desk). |

Do **not** implement a new counselling appointment API.

### E.5 Billing — repository findings

| Capability | Evidence | Classification |
|---|---|---|
| **View Billing** | Coverage lists `GET /api/opdbills?patientId=` (`AuthorizePatientBillReadAsync`: **`patient.view` + `bill.update`**). Handoff `/dashboard/billing/opd?patientId=` (desk any of `bill.view` \| `opd_bill.view` \| `bill.update` \| `ip.billing.collect` \| `bill.create`). Loads latest bill; **does not** open create. | **GREEN** HANDOFF — view existing OPD bills |
| **Generate / Create New Bill** | 360 has **no** create CTA. Create lives at `/dashboard/billing/opd/create?patientId=&patientName=` (+ optional `appointmentId`) via `OpdBillForm`, `POST /api/opdbills` **`bill.create`**. Create **page has no ProtectedRoute**. Desk Generate Bill typically **appointment-selected**. After save → check-in. | **FUTURE IMPLEMENTATION DECISION.** Do **not** add Generate New Bill in this redesign’s implementation slices. |

**TARGET:** Header **Billing** = View Billing handoff to `/dashboard/billing/opd?patientId=`. Gate with existing **`BILLING_DESK_VIEW_PERMISSIONS`** (same union as the dest). Do not invent a permission. Do not open IP billing (`/dashboard/ip-management/billing`). Do not collect payment on 360.

### E.6 Print / Export — CERTIFIED destinations

| Action | Dest | Gate | Type |
|---|---|---|---|
| Print Summary | `/dashboard/patients/{id}/summary/print` | Page already `patient.view`; promote out of More | VIEW |
| Export PDF | `GET /patients/{id}/summary/export?format=pdf` | **`patient.export`** (already UI-gated) | VIEW / export |

### E.7 Removed or demoted

| Action | Disposition |
|---|---|
| More (generic) | Remove as primary pattern |
| Open Counselling in header | Demote to Care secondary |
| Queue | Stay **out** (UX-2.1) |
| Open CCMS unscoped | Stay **out** |
| Edit Patient | Stay **out** |
| Generate New Bill | Not in action bar until FUTURE decision |
| Open Scheduling in Care | Remove duplicate once header Schedule works |

---

## F. Overview redesign

**Job:** Immediate orientation. **Do not** load extra domain APIs (CERTIFIED Overview contract: summary + recent visits only).

### F.1 Information hierarchy (TARGET)

```text
1. (Alerts already in shell — do not repeat)
2. Now — only facts NOT already in the header
3. Clinical flags — latest OPD vitals + registration allergy text (summary only)
4. Recent activity — compact visit table (3 rows) + “Full journey in Care”
5. Data quality — only if issues exist
6. Next step — only if it is NOT the same control as the header primary
```

### F.2 What to stop repeating

| Fact | Lives in | Overview |
|---|---|---|
| Name, MRN, age, sex, avatar | Header | Never |
| Visit reason, station, provider, IP, acuity, engagements | Header | Never, unless header omitted it |
| `scheduledAt` | Not in header today | **Now** strip if present |
| Programs / care pathways | Header engagements may cover | Show in Now only if not in header engagements |
| Phone, email, DOB, blood, emergency | Admin Registration | **Not** Overview (orientation ≠ MPI dump) |
| Continue encounter | Header primary | Omit Next step duplicate |

### F.3 Patterns

- **Now:** one definition-list row, not a card wall. If nothing beyond header: omit the block entirely (do not show a title-only shell).
- **Clinical flags:** one compact `dl` (BP/pulse/temp/VA/IOP if present; allergy text if present). Empty: one sentence, not a card. `diagnosisIncluded: false` remains — do **not** add coded diagnoses without extra APIs.
- **Recent activity:** table columns Date · Visit · Station/reason · Status. Link “Open encounter” when `encounterHref` exists. Empty: “No visits recorded.” (replace “No visits were returned.”)
- **Data quality:** list issues; omit if none.
- **Unauthorized/unavailable:** Overview uses `patient.view` summary; page-level failure already covers missing identity.

### F.4 Empty / unauthorized / unavailable

| State | Behavior |
|---|---|
| New patient, no visit/context | Identity + empty Now omitted + empty recent + no next step |
| Summary 403 | Existing page deny — not an Overview card |
| Recent visits fail | One unavailable sentence in Recent activity; do not invent visits |

---

## G. Clinical redesign

**Job:** Clinically understandable workspace. Read-only. No clinical mutations. No Doctor’s Desk / exam / lab / imaging / optical worklists.

### G.1 Internal IA (anchors, not extra app tabs)

Keep in-section subnav. **TARGET order:**

1. Summary (draft VA/IOP from summary — one line, not a duplicate card)
2. Vitals (OPD + IP as two tables, labeled)
3. Allergies (coded table + registration text as provenance note)
4. Medications & prescriptions
5. Diagnoses (coded; exam-text stays on examination rows until PD360-R5)
6. Examinations
7. Laboratory
8. Imaging & scans (orders, files, OCT)
9. Optical
10. Notes
11. Specialty diagnostics (biometry, retinopathy)

Include **IP vitals** and **Specialty** in the subnav (currently missing from anchors).

**Not shown (SOURCE GAP):** Eye history as a dedicated registry; standalone clinical recommendations; `/patient-medical-history` (forbidden as a 360 path in clinical tests); EHR `patient-medications` operational list (360 uses `patient360.medication.read`).

### G.2 Domain rules

| Domain | Source | Permission | Safe | UI | Detail | Handoff |
|---|---|---|---|---|---|---|
| Draft VA/IOP | summary `latestVitals` | `patient.view` | GREEN | One `dl` under Vitals | — | — |
| OPD vitals | `GET /vitals/patient/{id}` | `patient.view` | GREEN | Compact table | — | — |
| IP vitals | patient-360 IP vitals | `ip.vitals.read` | GREEN | Compact table + pager | — | Display only; no ward board |
| Allergies coded | `GET /patient-allergies/patient/{id}` | `patient.view` | GREEN (deleted-row display: PD360-R1) | Table | — | — |
| Allergy text | summary | `patient.view` | YELLOW dual store | Provenance line | — | — |
| Examinations | `GET /examinations/patient/{id}` | `examination.view` | GREEN | Table | — | Encounter when visit id exists |
| Medications / Rx | `GET /prescriptions/patients/{id}/patient-360` | `patient360.medication.read` | GREEN | Nested table + pager | Line detail inline | — |
| Coded diagnoses | `GET /diagnoses/patients/{id}/patient-360` | `patient360.diagnosis.read` | GREEN; PD360-R5 open | Table + provenance | — | — |
| Laboratory | `GET /lab-reports/patient/{id}` | `patient.view` | GREEN | Table | Open `reportUrl` if https | External VIEW |
| Imaging orders | `GET /Imaging/patient/{id}` | `examination.view` | GREEN | Table | — | No viewer |
| Imaging files | patient-360 images | `examination.view` | YELLOW metadata | Table + pager | — | No bytes |
| OCT | patient-360 OCT | `diagnostic.oct.read` | GREEN metadata | Table under Scans | — | No images |
| Biometry | patient-360 biometry | `CLINICAL:BIOMETRY:VIEW` | GREEN | Table | — | — |
| Retinopathy | patient-360 screening | `CLINICAL:SCREENING:VIEW` | GREEN | Table | Referral-required is a **field**, not Referrals module | — |
| Optical orders | `GET /optical-orders/patient/{id}` | `patient.view` | GREEN | Table | — | Not Optical POS |
| Chart notes | `GET /patient-notes/patient/{id}` | `patient.view` | GREEN | Table | **Sheet** (CERTIFIED) | — |

Hide empty tables behind one-line empty copy. Do not leave a two-column card grid with half-empty Optical/Notes.

### G.3 Responsive

Desktop: one full-width table per group (not two-column sparse cards). Tablet/mobile: priority columns + horizontal scroll; remaining fields in row-expand or Sheet.

---

## H. Care redesign

**Job:** Care journey — happened / scheduled / next. Counselling is **context-only**.

### H.1 Groups (TARGET)

1. **Now / next** — next appointment or continuable visit (text + existing handoff). Omit if header already shows the same Continue/Check-in/Schedule.
2. **Visits & encounters** — table from `GET /visits/by-patient/{id}` (`patient.view`). Open encounter HANDOFF.
3. **Appointments** — table from `GET /appointments/patient/{id}` (`appointment.view`). No second “Open Scheduling” once header Schedule works.
4. **Counselling sessions** — existing 360 session DTO (`counseling_sessions.read`). Columns from **approved fields only**. Secondary **Open Counselling** if `counseling_sessions.read`.
5. **Communication** — `GET /patient-communications/patient/{id}` (`patient.view`). Sheet if preview truncated (CERTIFIED).

### H.2 Forbidden on Care

Start counselling, Assign counsellor, Reassign, ReQueue, ownership mutation, waiting-list chrome, recordings, transcripts, AI summaries, quotes, decisions, counsellor notes — **unless** an approved patient-scoped field already exists (it does not). PD360-R3 / R10 remain open.

Follow-up as an object: **SOURCE GAP** — one-line “Follow-up is not available in Patient 360.” Never “No follow-up history.”

Referrals module: **SOURCE GAP** (Referrals tab Coming Soon). Retinopathy “referral required” stays Clinical.

### H.3 Pattern

One journey page, four tables, no launcher row of module links. Dense `text-sm` tables consistent with counsellor desk density, not `p-3` cards.

---

## I. Documents redesign

**Job:** Unified **index**, not a document repository.

### I.1 Index columns (TARGET)

Date · Title/type · Source · Status · Action

One table. Filter chips: All | Clinical | Counselling | Coverage | Other — **client filter of already-loaded rows**, not a new search API.

### I.2 Sources

| Source | Patient-scoped read | Permission | Bytes? | 360 | Action |
|---|---|---|---|---|---|
| CCMS documents | `GET /ccms/documents/by-patient/{id}` | `ccms.document.read` | Not called by 360 | GREEN metadata | Index row; VIEW/download **DECISION REQUIRED** (existing access-url — do not invent) |
| Counselling session docs | `GET /counseling-session-documents/by-patient/{id}` | `session_documents.read` | Not opened | GREEN metadata; branch filter **SECURITY GAP** (do not “fix” in a UX slice) | Index row |
| Lab reports | Clinical lab GET | `patient.view` | `reportUrl` if https | YELLOW — include in index via **existing** clinical loader, no new API | Open report if URL |
| Imaging files | Clinical images GET | `examination.view` | No | YELLOW metadata — include in index | No viewer |
| Chart notes | Clinical notes | `patient.view` | Text | Optional index pointer to Clinical Notes Sheet | Sheet |
| Consents | Admin consents GET | `patient.view` | Not files | YELLOW — consent **records**, not PDFs | Admin / Timeline |
| MPI / widgets `getPatientDocuments` | Stub `[]` TODO | — | — | **RED / SOURCE GAP** | One-line unavailable. Never “No documents.” |
| Legacy uploads | Phase4 disabled | — | — | RED | Do not wire |
| Insurance document table | No 360 GET | — | — | SOURCE GAP | — |
| Portal uploads | Not 360 | — | — | SOURCE GAP | — |
| IP pre-op docs | Not 360 | — | — | SOURCE GAP; do not open IP ops | — |

Do **not** create a new document store, upload UI, or duplicate bytes.

Empty authorized sources: omit from the table; if **all** integrated sources empty and MPI still a gap, show empty recorded copy **plus** one MPI SOURCE GAP sentence.

---

## J. Coverage redesign

**Job:** Insurance and financial **context**. Not cashier. Not CCMS desk. Not IP finance.

### J.1 Stacks (TARGET)

In-section anchors: **Insurance** · **Authorizations & claims** · **OPD billing**

| Domain | Source | Permission | Safe | UI | Handoff |
|---|---|---|---|---|---|
| Insurance profile | `GET /patient-insurance/patient/{id}` | `patient.view` | GREEN; deleted rows PD360-R1 | Table | None |
| Coverage cases | CCMS by-patient | `ccms.coverage_case.read` | GREEN | Table + pager | **No** unscoped `/dashboard/ccms` |
| Eligibility | CCMS by-patient | `ccms.eligibility.read` | GREEN | Table | None |
| Authorizations | CCMS by-patient | `ccms.authorization.read` | GREEN | Table | None |
| Claims | CCMS by-patient | `ccms.claim.read` | GREEN | Table | None |
| Settlements | CCMS by-patient | `ccms.settlement.read` | GREEN | Table | None |
| OPD bills | `GET /opdbills?patientId=` | `patient.view` **and** `bill.update` | GREEN context | Table (add pager if over 50 — existing cap) | Header/section **Billing** view |
| IP financials | Not loaded | — | **RED** | Do not show | Do not open IP billing |
| Refunds list | Unused 360 | — | SOURCE GAP | Do not add refund workflow | — |
| Generate bill | See E.5 | `bill.create` | FUTURE | Not on 360 | — |

Collapse empty stacks to one sentence per stack. Do not mount seven empty cards.

Patient-scoped CCMS **case page** does not exist — no fake “Open case” that lands on the CCMS home workbench.

---

## K. Administration redesign

**Job:** Administrative history around the patient. Not Front Office, OT, or IP boards.

### K.1 Domain traffic lights

| Domain | Class | Source | 360 UI |
|---|---|---|---|
| Registration snapshot | **GREEN** | summary DOB, phone, email, blood, emergency, data quality | Definition list; format DOB (not raw ISO) |
| Identifiers beyond MRN | **YELLOW** | Health ID not on 360 summary | Omit or one limited line — do not invent |
| Visits / check-in timestamps | **GREEN** | visits GET; `checkInTime` | **Keep here** as check-in history table (Care keeps clinical/operational visit list — **DECISION** in K.2) |
| Appointments | **GREEN** | same as Care | **Do not duplicate** — one line “Appointments are listed in Care” + header Schedule |
| Consents | **GREEN** | `GET /patient-consents/patient/{id}` `patient.view` | Table; no revoke on 360 |
| IP / admission history | **GREEN** | patient-360 inpatient-history `ip_management.view` | Read-only table; closed episodes; no admit/transfer/discharge actions |
| Live IP census | Header badge only | summary `ipAdmission` | Do not open IP Management |
| Surgery / OT | **RED** | `SURGERY_UNAVAILABLE`; `SurgeryController.GetByPatient` is **not** a safe 360 source (no RequirePermission; other UI uses name search) | One-line SOURCE GAP. Never “No surgery history.” |
| Referrals | **RED / SOURCE GAP** | unused | SOURCE GAP sentence |
| Follow-up administration | **RED / SOURCE GAP** | none | SOURCE GAP sentence |
| Portal / access | **RED / SOURCE GAP** | not on summary | SOURCE GAP sentence |
| Edit Patient | Out of shell | PUT exists but incomplete (emergency/identifiers not assigned) | **Do not add** |

### K.2 Care vs Admin split (TARGET)

| Content | Care | Admin |
|---|---|---|
| Visit as encounter / care event | Yes | No full duplicate |
| Check-in / check-out timestamps | Optional column | **Yes** — administrative history |
| Appointments | Yes | Pointer only |
| Consents, registration, IP history | No | Yes |

Do **not** invent history from name/mobile searches or OT/surgery-request lists.

---

## L. Timeline redesign

**Job:** Longitudinal history from **existing** loaders. **No** `patient_events` table. **No** second event store.

### L.1 Target row model

| Column | Meaning |
|---|---|
| Date / time | Authoritative source timestamp |
| Event | Human label |
| Domain / source | Provenance |
| Context | Short facts (status, type, eye, amount — already on DTO) |
| Action | Authorized VIEW / HANDOFF only |

Newest-first. Tie-break remains source id until PD360-R6.

### L.2 Event catalog

| Event | Populates today? | Source | Permission | Timestamp | Detail / handoff | Gap |
|---|---|---|---|---|---|---|
| Appointment | Yes | appointments GET | `appointment.view` | `appointmentDate` | — | — |
| Visit | Yes | visits GET | `patient.view` | `createdAt` / `checkInTime` | Encounter href | — |
| Consent | Yes | consents | `patient.view` | granted/revoked | — | — |
| Examination | Yes | exams | `examination.view` | exam date | — | — |
| **Prescription** | **No** | Clinical stub `prescriptions: []` | `patient360.medication.read` | Rx date on medication API | — | **IMPLEMENTATION DEFECT** — TARGET: reuse Clinical medication loader. Do **not** claim Rx complete until that slice ships |
| Laboratory | Yes | labs | `patient.view` | completed/ordered | Report URL not currently on timeline | Optional Open report |
| Communication | Yes | comms | `patient.view` | sent/created | — | — |
| Counselling | Yes | 360 sessions | `counseling_sessions.read` | sessionDate | — | No artifacts |
| OPD bill | Yes | bills | `patient.view` + `bill.update` | billDate | — | Not cashier |
| IP vitals | No | IP vitals loader | `ip.vitals.read` | vital time | — | **DECISION REQUIRED** to add (existing loader; not a new API) |
| Imaging / OCT / notes / diagnoses / documents / claims | No | various | various | — | — | **DECISION REQUIRED** per domain; do not dump every table as an event in Phase H |
| Surgery | No | — | — | — | — | SOURCE GAP |
| Insurance profile change | No | — | — | — | — | SOURCE GAP (no event stream) |

### L.3 Honesty

- Empty: “No dated events were returned from available sources.”
- All sources failed: unavailable copy.
- **TARGET:** list unauthorized/unavailable **sources** as a compact legend (do not silently drop). Example: “Prescriptions not included — not available to this sign-in.” vs “Prescriptions not included — source not wired.”
- Never fabricate chronology.

Filters (client-only on loaded events): All · Care · Clinical · Coverage · Documents — optional later; not a new query.

---

## M. Action / handoff matrix

| Action | Visible when | Permission (360 UI) | Destination | Type | Mutation? | Existing source | Notes |
|---|---|---|---|---|---|---|---|
| Continue encounter | `assignedVisitId` | `patient.view` (page); dest `CLINICAL:EXAMINATION:VIEW` | `/dashboard/patients/{id}/encounter/{visitId}` | HANDOFF | No on 360 | summary | XOR Check-in. CERTIFIED |
| Check-in | XOR Continue and `canDirectoryOfferCheckIn` | page `patient.view`; dest ungated today | `/dashboard/frontdesk/check-in?patientId=` | HANDOFF | No on 360 | summary `scheduledAt` | Dest ProtectedRoute = DECISION REQUIRED (Front Desk) |
| Schedule → General appointment | `appointment.view` | `appointment.view` (match Directory); create API `appointment.create` | Dialog: `UnifiedAppointmentBooking` `resumePatientId` **or** `/dashboard/appointments/book?createdPatientId=` | HANDOFF | Yes **in Appointments**, not 360-owned | Directory dialog + book pages | **Do not** use `/appointments/schedule`. TARGET |
| Schedule → Counselling appointment | Product accepts session-create as schedule **and** `counseling_sessions.create` | `counseling_sessions.create` | `/dashboard/counsellors-desk/waiting-list?createdPatientId=` | HANDOFF | Yes **in Counsellor AddPatientModal** | Existing `createdPatientId` seed | **YELLOW / DECISION REQUIRED.** Not a calendar appointment. Do not invent API |
| Billing (view) | Any `BILLING_DESK_VIEW_PERMISSIONS` | Same union as dest | `/dashboard/billing/opd?patientId=` | HANDOFF | No | Coverage bills + OPD desk | TARGET promote from More. Gate on 360. No IP billing |
| Generate New Bill | **Not shown** | `bill.create` exists | `/dashboard/billing/opd/create?patientId=&patientName=` | — | Would be MUTATION | OpdBillForm | **FUTURE IMPLEMENTATION DECISION.** Ungated page; often appointment-linked |
| Print Summary | Always on 360 | `patient.view` | `/dashboard/patients/{id}/summary/print` | VIEW | No | print page | TARGET promote from More |
| Export PDF | `patient.export` | `patient.export` | GET summary export blob | VIEW | No | `patientLookupApi.exportSummaryPdf` | CERTIFIED gate |
| Open Counselling (view/desk) | Care only; `counseling_sessions.read` | `counseling_sessions.read` | waiting-list `?patientId=` (unique session may deep-link) | HANDOFF | No | `buildCounsellorHandoffHref` | **Not primary.** Not booking |
| Open encounter (row) | Visit has visit id | dest exam view | encounter URL | HANDOFF | No | visits | Contextual |
| Open lab report | `reportUrl` https | `patient.view` | external URL | VIEW | No | lab reports | Clinical / Documents |
| Book appt (current) | `appointment.view` | `appointment.view` | `/appointments/schedule?patientId=` | HANDOFF (broken) | No | header today | **Replace** in Phase A |
| Queue | Never | — | — | — | — | removed UX-2.1 | Stay out |
| Edit Patient | Never | `patient.update` unused on 360 | — | — | — | PUT incomplete | Stay out |
| Open CCMS home | Never | — | `/dashboard/ccms` | — | — | removed UX-2.1 | Stay out |

**Type definitions**

- **VIEW** — stay in 360 or open read-only print/PDF/report.
- **HANDOFF** — navigate or open owning-module UI with patient context.
- **MUTATION** — 360 chrome must not POST operational state merely because a button is visible. Mutations happen only inside owning components/routes already responsible for them.

---

## N. Complete domain / source / permission matrix

| Section | Domain | User question | Existing source / API | Permission | Safe? | UI pattern | Detail | Handoff | Mutation | Source gap |
|---|---|---|---|---|---|---|---|---|---|---|
| Overview | Now | What is active besides header? | summary `scheduledAt`, programs | `patient.view` | GREEN | `dl` or omit | — | — | No | — |
| Overview | Clinical flags | Any immediate clinical signal? | summary vitals + allergy text | `patient.view` | GREEN | compact `dl` | — | — | No | No coded dx (contract) |
| Overview | Recent activity | What happened lately? | `GET /patients/{id}/visits/recent` | `patient.view` | GREEN | 3-row table | — | Care / encounter | No | Not full history |
| Overview | Data quality | Is MPI incomplete? | `summary.dataQuality` | `patient.view` | GREEN | list if any | — | Admin | No | — |
| Overview | Next step | What should I do? | `assignedVisitId` | — | GREEN | omit if header shows it | — | Continue | No | — |
| Clinical | Draft measures | Latest exam draft? | summary latestVitals | `patient.view` | GREEN | `dl` | — | — | No | Not full exam |
| Clinical | OPD vitals | Recent OPD vitals? | `/vitals/patient/{id}` | `patient.view` | GREEN | table | — | — | No | cap 50 |
| Clinical | IP vitals | Inpatient vitals? | journeys patient-360 ip-vitals | `ip.vitals.read` | GREEN | table + pager | — | none (no ward) | No | — |
| Clinical | Allergies | Known allergies? | `/patient-allergies/patient/{id}` + summary text | `patient.view` | GREEN / YELLOW dual | table + provenance | — | — | No | PD360-R1 deleted |
| Clinical | Examinations | What was examined? | `/examinations/patient/{id}` | `examination.view` | GREEN | table | — | encounter if id | No | Eye history absent |
| Clinical | Medications / Rx | What was prescribed? | `/prescriptions/patients/{id}/patient-360` | `patient360.medication.read` | GREEN | table + pager | inline lines | — | No | Timeline stub |
| Clinical | Diagnoses | Coded problems? | `/diagnoses/patients/{id}/patient-360` | `patient360.diagnosis.read` | GREEN | table | — | — | No | PD360-R5 vs exam text |
| Clinical | Laboratory | Lab results? | `/lab-reports/patient/{id}` | `patient.view` | GREEN | table | Open URL | external | No | No DeletedAt |
| Clinical | Imaging orders | Imaging ordered? | `/Imaging/patient/{id}` | `examination.view` | GREEN | table | — | — | No | No workstation |
| Clinical | Imaging files | Images on file? | `/Imaging/patient/{id}/patient-360/images` | `examination.view` | YELLOW | table | — | — | No | No bytes |
| Clinical | OCT | OCT studies? | octimaging patient-360 | `diagnostic.oct.read` | GREEN | table | — | — | No | Metadata |
| Clinical | Biometry | Biometry? | biometry patient-360 | `CLINICAL:BIOMETRY:VIEW` | GREEN | table | — | — | No | — |
| Clinical | Retinopathy | Screening? | retinopathy patient-360 | `CLINICAL:SCREENING:VIEW` | GREEN | table | — | — | No | Not referrals module |
| Clinical | Optical | Optical orders? | `/optical-orders/patient/{id}` | `patient.view` | GREEN | table | — | not POS | No | — |
| Clinical | Chart notes | Notes? | `/patient-notes/patient/{id}` | `patient.view` | GREEN | table | Sheet | — | No | — |
| Clinical | Eye history | Longitudinal eye hx? | — | — | RED | — | — | — | No | SOURCE GAP |
| Clinical | Recommendations | Clinical recs? | — | — | RED | — | — | — | No | SOURCE GAP |
| Clinical | Medical history API | Full hx registry? | `/patient-medical-history` | — | RED | — | — | — | No | Do not call |
| Care | Visits | What encounters? | `/visits/by-patient/{id}` | `patient.view` | GREEN | table | — | encounter | No | page 1 size 100 |
| Care | Appointments | What is booked? | `/appointments/patient/{id}` | `appointment.view` | GREEN | table | — | Schedule (header) | No | — |
| Care | Counselling sessions | What counselling context? | `/counseling/patients/{id}/patient-360/sessions` | `counseling_sessions.read` | GREEN limited | table | — | Open Counselling secondary | No | No notes/quotes/media |
| Care | Communication | What was sent? | `/patient-communications/patient/{id}` | `patient.view` | GREEN | table | Sheet if truncated | — | No | Not NotificationHub |
| Care | Follow-up object | What is next clinically? | — | — | RED | SOURCE GAP line | — | — | No | SOURCE GAP |
| Care | Recordings / AI | Session artifacts? | — | PD360-R3/R10 | RED | omit | — | — | No | Do not fabricate |
| Documents | Unified index | What documents exist? | compose existing GETs | per source | mixed | one table | — | per row | No | MPI stub |
| Documents | CCMS docs | Payer documents? | `/ccms/documents/by-patient/{id}` | `ccms.document.read` | GREEN meta | index rows | download DECISION | — | No | No bytes now |
| Documents | Counselling docs | Session files? | `/counseling-session-documents/by-patient/{id}` | `session_documents.read` | YELLOW | index rows | — | — | No | Branch filter gap |
| Documents | Lab / imaging | Diagnostic files? | reuse Clinical loaders | as Clinical | YELLOW | index rows | report URL | — | No | Imaging no bytes |
| Documents | MPI uploads | Registration docs? | widgets stub | — | RED | SOURCE GAP line | — | — | No | Stub `[]` |
| Coverage | Insurance profile | How insured? | `/patient-insurance/patient/{id}` | `patient.view` | GREEN | table | — | — | No | PD360-R1 deleted |
| Coverage | Coverage cases | What case? | CCMS by-patient | `ccms.coverage_case.read` | GREEN | table | — | no CCMS home | No | No case route |
| Coverage | Eligibility | Eligible? | CCMS by-patient | `ccms.eligibility.read` | GREEN | table | — | — | No | — |
| Coverage | Authorizations | Auths? | CCMS by-patient | `ccms.authorization.read` | GREEN | table | — | — | No | — |
| Coverage | Claims | Claims? | CCMS by-patient | `ccms.claim.read` | GREEN | table | — | — | No | — |
| Coverage | Settlements | Settled? | CCMS by-patient | `ccms.settlement.read` | GREEN | table | — | — | No | — |
| Coverage | OPD bills | What bills? | `/opdbills?patientId=` | `patient.view` + `bill.update` | GREEN | table | — | Billing view | No | PD360-R8 branch |
| Coverage | IP financials | IP ledger? | — | — | RED | omit | — | — | No | Unsafe |
| Coverage | Generate bill | Create bill? | OpdBill create | `bill.create` | FUTURE | omit | — | — | — | See E.5 |
| Admin | Registration | Who is registered? | summary | `patient.view` | GREEN | `dl` | — | — | No | No Edit |
| Admin | Appointments | Admin copy of books? | same as Care | `appointment.view` | GREEN | **pointer only** | — | Care | No | Avoid dup |
| Admin | Check-in history | When checked in? | visits `checkInTime` | `patient.view` | GREEN | table | — | encounter | No | Not a separate API |
| Admin | Consents | Consents? | `/patient-consents/patient/{id}` | `patient.view` | GREEN | table | — | — | No revoke | — |
| Admin | IP history | Past admissions? | patient-360 inpatient-history | `ip_management.view` | GREEN | table + pager | — | none | No | Not census |
| Admin | Surgery / OT | Surgeries? | none safe | — | RED | SOURCE GAP line | — | none | No | Do not use name-search API |
| Admin | Referrals | Referrals? | unused | — | RED | SOURCE GAP line | — | — | No | Coming Soon tab |
| Admin | Follow-up admin | Follow-up admin hx? | — | — | RED | SOURCE GAP line | — | — | No | — |
| Admin | Portal access | Portal enabled? | — | — | RED | SOURCE GAP line | — | — | No | — |
| Timeline | Mixed events | What happened when? | client merge of existing loaders | union of sources | YELLOW until Rx fix | table | encounter / report | per event | No | Rx stub; no PatientEvents |
| Timeline | Prescriptions | Rx over time? | should use medication API | `patient360.medication.read` | RED today | include after fix | — | — | No | Loader stub |
| Shell | Identity | Who is this? | `GET /patients/{id}/summary` | `patient.view` | GREEN | header | — | Directory back | No | — |
| Shell | Duplicate hint | Possible duplicate? | POST `/patients/check-duplicates` | existing | GREEN | alert | — | — | No | — |

---

## O. Responsive behavior

Desktop-first hospital workstation. Do not shrink cards into a mobile marketing stack.

| Surface | Desktop (≥1024) | Tablet (768–1023) | Mobile (<768) |
|---|---|---|---|
| Patient header | Identity left; context one/two lines | Identity wraps; context below | Identity first; context collapsed to 2 lines max |
| Action bar | Direct buttons in one row | Wrap; Schedule may be split control | Primary XOR full width; Schedule + Billing visible; Print/Export in labeled Summary overflow **only** |
| Section nav | Horizontal tablist, `aria-current` | Same, scroll | Horizontal scroll; do not convert to select unless later a11y DECISION |
| Tables | Full columns | Priority columns + `overflow-x-auto` | Priority 2–3 columns; rest in Sheet or expand row |
| Clinical lists | One table per group, full width | Same | Stack groups; keep tables, don’t card-ify |
| Coverage | Three stacks | Stacks vertical | Stacks vertical; hide empty |
| Documents | One index table | Horizontal scroll | Date · Title · Source; action in row menu **per document** (not page More) |
| Timeline | Five columns | Hide Context | Date · Event · Source; Sheet for context |
| Detail | Sheet right | Sheet | Sheet full width |
| Filters | Inline chips | Wrap chips | Wrap; no extra drawer unless needed |

Preserve `max-w-[1600px]`. No page-level `overflow-x-hidden` that clips tables. Header stacks; nav remains a tablist.

---

## P. Empty / unavailable / unauthorized states

Apply in every domain (see D.3). Additional rules:

| Situation | Copy / behavior |
|---|---|
| Recorded absence | “No {domain} recorded.” |
| Not integrated | “{Domain} is not available in Patient 360.” |
| Permission | “{Domain} is not available to this sign-in.” |
| MPI documents | Always the unavailable sentence until an owning GET exists |
| Surgery / OT | Always the unavailable sentence; never empty history |
| Timeline Rx before fix | Legend: “Prescriptions are not included in Timeline.” Do not list fake Rx |
| Overview with nothing extra | Show identity + empty recent; omit empty Now/Next |
| Coverage all empty | One sentence per stack, not seven cards |
| Load failure | Unavailable + retry in later slice; do not invent data |
| Page without `patient.view` | Existing `ProtectedRoute` — no 360 chrome |

Do not use decorative empty illustrations.

---

## Q. Provenance / source-of-truth rules

1. Frontend is never SoT for clinical, financial, coverage, or identity writes.
2. Each row names its **owning domain** when two stores could collide (allergy **table** vs registration **text**; MPI insurance vs CCMS case; optical **order** vs optical POS; Rx vs meds list).
3. Do not merge OPD vitals and IP vitals into one table without labels.
4. Do not merge coded diagnosis and examination diagnosis text until PD360-R5.
5. Do not present counsellor `clinical_summary` as AI (PD360-R10).
6. Deleted/revoked rows follow PD360-R1 — until decided, do not invent retention UX.
7. Timeline events keep `id` namespaced per source (`appointment-{id}`) to avoid collisions.
8. Handoffs pass `patient.id` (or existing `createdPatientId` alias). Never search by name/mobile to “find” history.
9. Failed integrations must not look like empty success.
10. Print/PDF remain summary exports, not a substitute for the chart.

---

## R. Open product decisions

Do **not** block the presentation redesign on these, except where a later slice would mutate or expose unsafe data.

| ID | Topic | Options | Blocks |
|---|---|---|---|
| **PD-S1** | Schedule → Counselling dest | (a) Handoff `createdPatientId` session create; (b) omit counselling from Schedule | Phase A counselling item |
| **PD-S2** | General appointment UX | (a) Directory dialog in 360; (b) navigate to `/appointments/book?createdPatientId=` | Phase A general schedule |
| **PD-B1** | Generate New Bill on 360 | Keep FUTURE vs later gated handoff with `bill.create` + appointment rule | Not Phase A–H |
| **PD-D1** | Document view/download | Index-only vs call existing CCMS access-url | Documents slice enhancement |
| **PD-T1** | Timeline extras | Add IP vitals / imaging / claims as events? | After Phase H core |
| **PD-A1** | Edit Patient on 360 | Stay out vs Sheet using live PUT field set only | Out of this redesign |
| **PD-C1** | Check-in / print / schedule dest `ProtectedRoute` | Fix in owning modules | Security, not 360 copy |
| PD360-R1 | Deleted/retention presentation | Contract | Allergy, insurance, consents |
| PD360-R3 | Counselling artifact permissions | Contract | Care/Documents depth |
| PD360-R5 | Diagnosis SoT | Contract | Clinical diagnoses |
| PD360-R6 | Timeline corrections | Contract | Timeline sort |
| PD360-R8 | Null-branch bills | Contract | Coverage bills |
| PD360-R10 | AI summary | Contract | Stay omitted |

PD360-R2 (bills: `patient.view` + `bill.update`) and PD360-R4 (granular CCMS) are **APPROVED** in the product contract — Coverage reads already follow them. Do not reopen.

---

## S. Implementation sequencing recommendation

**Do not implement in this phase.** After blueprint approval, slices must stay independently UAT-able. Do **not** fold backend/source-gap work (MPI documents API, OT history, follow-up object, counselling artifacts, Generate Bill, Edit Patient) into a UI slice.

Recommended order (dependency + risk):

| Phase | Slice | Why this order | UAT focus | Not in slice |
|---|---|---|---|---|
| **A** | Header / action system | Unblocks every section’s duplicate CTAs; fixes broken Book dest | XOR Continue/Check-in; Schedule general; Billing visible; Print; Export gated; no More junk drawer; no Queue/CCMS/Edit | Generate Bill; counselling schedule unless PD-S1 = (a) |
| **B** | Overview | Depends on header facts so we can stop repeating them | Now/flags/recent/data quality; no extra APIs | Clinical lists |
| **C** | Clinical | Independent of Care; tables + subnav including IP vitals & specialty | Each GREEN domain; 3-states; Sheets for notes | Eye history, recommendations, mutations |
| **D** | Care | After A so launcher links can die | Journey tables; no Start/Assign; secondary Open Counselling gated | Follow-up object, recordings |
| **E** | Documents | Can reuse Clinical loaders after C | One index; MPI gap copy; no upload | New document API; download unless PD-D1 |
| **F** | Coverage | After A Billing CTA | Stacks collapse; no cashier/CCMS/IP finance | Generate Bill; Open CCMS home |
| **G** | Administration | After D to drop appointment duplicate | Registration `dl`; check-in; consents; IP history; OT gap | Edit Patient; surgery API |
| **H** | Timeline | Last aggregator; **must consume Clinical medication loader** (no new API) | Chronology; Rx present when Clinical has Rx; source legend for unauth/unavailable | PatientEvents table; dump-all-domains |

Phase A may include **only** the destination/permission chrome changes described in E. It must not restyle seven sections.

If PD-S1 is deferred, Phase A ships Schedule as **General appointment only**.

---

## T. Explicit non-goals

- Production UI implementation of this blueprint
- New APIs, DTOs, permissions, routes, or migrations
- New `patient_events` / document repository / upload system
- Patient Directory, census, filters, lookup, export, create, duplicate detection, MRN safety, Preview boundary
- Counsellor ownership, waiting-list operations, Start/Assign/ReQueue
- Billing/cashier/refund business rules; insurance rules; CCMS authorization redesign
- IP/OT operational actions or unsafe IP financials
- Restoring patient switching on 360
- Edit Patient
- Generate New Bill as if it were certified
- Mock/demo clinical or financial rows
- New UI framework, toast library, or design tokens
- Merging seven sections into fewer tabs, or adding an eighth top-level section
- Using Nx generators / second architecture

---

## U. Scope guard

**In scope for later approved slices:** presentation of already-wired patient-scoped reads; action-bar composition using existing routes/components/permissions; client Timeline Rx fix via existing medication GET; hiding empty cards; tables/Sheets within `components/patients` + existing `ui/*`.

**Out of scope forever unless a new product authorization names it:** Directory behavior; Counsellor mutations; financial mutations; CCMS workbench; OT/IP boards; inventing patient-scoped reads; changing state machines; PHI in URLs/logs; replacing SignalR; stack upgrades.

**Files this design phase may change:** this blueprint only.

**Files later slices may change (after approval, not now):** `PatientRecordPage.tsx`, `Patient360*.tsx`, `patient-360-*.ts` loaders/tests under `apps/hospital-portal-web`. Owning-module pages only if a named slice is explicitly authorized to fix a dest (`ProtectedRoute` on check-in/print/schedule) — default is **360 chrome only**.

---

## Appendix: Target textual wireframe

```text
PATIENT 360  /dashboard/patients/{id}
================================================
[ Back to Patients ]

  (avatar)  FIRST LAST
            MRN · {age}y · {sex}     [IP] [acuity]
            Visit: {reason}
            {station} · {provider} · {role}
            Engagements: {label · status}

  [Continue encounter | Check-in]  [Schedule ▾]  [Billing]  [Print]  [Export PDF]

  Schedule ▾
    · General appointment     → UnifiedAppointmentBooking | /appointments/book?createdPatientId=
    · Counselling appointment → waiting-list?createdPatientId=   (only if PD-S1)

  Alerts (conditional): duplicate | data quality | allergy
------------------------------------------------
  Overview | Clinical | Care | Documents | Coverage | Administration | Timeline
================================================

OVERVIEW  — What do I need to know right now?
  Now            (only non-header facts; omit if none)
  Clinical flags (summary vitals + allergy text)
  Recent activity table (3 visits) → Care
  Data quality   (if issues)
  (no duplicate Continue)

CLINICAL  — What is clinically relevant?
  Subnav anchors → tables per GREEN domain
  Notes → Sheet
  Lab URL → VIEW
  No worklists, no mutations

CARE  — Happened / scheduled / next
  Visits table · Appointments table
  Counselling context table · Communication table
  Secondary: Open Counselling (read)
  No Assign / Start / ReQueue

DOCUMENTS  — What documents are available?
  One index table (CCMS, counselling, lab/imaging metadata)
  MPI: “not available in Patient 360”
  No upload

COVERAGE  — How is care covered?
  Insurance table
  CCMS eligibility / auth / claims / settlement / cases
  OPD bills table → Billing handoff
  No cashier, no IP finance, no CCMS home

ADMINISTRATION  — Administrative activity
  Registration dl
  Check-in history · Consents · IP history
  Appointments: pointer to Care
  Surgery / referrals / follow-up / portal: SOURCE GAP lines
  No Edit Patient, no OT board

TIMELINE  — What happened over time?
  Date · Event · Source · Context · Action
  Existing sources only
  Prescriptions: include only after Clinical medication loader is used
  Legend for sources not included
================================================
```

---

## Document control

| Field | Value |
|---|---|
| Implementation | **NOT AUTHORIZED** |
| Automated tests this phase | **Not required** |
| Next step | Manual product review of this blueprint |
| After approval | Phase A slice only, separately authorized |

STOP.
