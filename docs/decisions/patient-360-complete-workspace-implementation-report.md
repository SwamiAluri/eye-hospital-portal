# Patient 360 — Complete table-first workspace + UAT data foundation

Date: 2026-10-06  
Status: **IMPLEMENTATION COMPLETE — AUTOMATED UNIT TESTS COMPLETE — MANUAL UAT REQUIRED — STOP**  
Acceptance: **not claimed**

Route: `/dashboard/patients/[id]`  
Blueprint: `docs/decisions/patient-360-complete-ux-redesign-blueprint.md`  
Phase A (header): `docs/decisions/patient-360-phase-a-header-action-report.md` — **UAT PASS / ACCEPTED**  
Phase B (Overview): `docs/decisions/patient-360-phase-b-overview-report.md` — automated complete; still requires Overview-specific manual UAT if not already done

This slice is the **complete presentation redesign** of the existing Patient 360 contract plus a **best-effort longitudinal UAT seed on existing write APIs**. It does not authorize Counsellor, Billing, Insurance, OT/IP, Directory, create, MRN, or permission catalog changes.

---

## 1. Repository audit

Inspected (not rewritten):

- Shell: `PatientRecordClient`, `Patient360SectionNav`, `PATIENT_360_SECTIONS` (seven keys), Phase A header/actions
- Loaders: clinical, IP vitals, imaging files, specialty/OCT, administration, inpatient history, communications, counselling sessions/documents, CCMS coverage/auth/claims/settlements/cases, OPD bills, insurance profile, timeline aggregator, prescriptions
- Honesty: empty vs 401/403 vs unavailable vs MPI/surgery “not available in Patient 360”
- Seed: `scripts/seed-patient-360-uat.ts` + `patient-360-uat-seed.ts`
- PUT: `PUT /patients/{id}` + `patient.update` (Exam Medical History already writes a **subset**; emergency/IDs not assigned on PUT — prior master audit)

No second architecture, no `PatientWorkspaceTabs` / patient switcher, no `patient_events` table, no document repository, no schema migration.

---

## 2. Current UX defects identified (pre-redesign)

| Defect | Fix in this slice |
|---|---|
| Clinical hash subnav + full-page card grid duplicated the same domains | One Clinical workspace; subnav is in-page anchors only |
| IP vitals / specialty lived outside the Clinical index | Vitals includes OPD + IP; Specialty diagnostics is one indexed section |
| Every loader wrapped in a bordered card; empty = card wall | `Patient360Section` + `Patient360RecordTable`; empty is one status line |
| Documents = MPI + CCMS + counselling **cards** | One index table + All \| Clinical \| Counselling \| Insurance \| Laboratory \| Imaging filters |
| Coverage looked like CCMS object cards | Tables; empty CCMS objects not rendered as large cards |
| Administration duplicated Care appointments | Registration dl; check-in from visits; pointer to Care for appointments |
| Timeline was narrative / leftover duplicate markup | Chronological table; prescriptions from existing loader |
| Overview flags as definition list only | Measure \| Latest \| Recorded table |
| Identity-only UAT patient | Seed now POSTs additional existing domain endpoints when they succeed |

---

## 3. New information architecture

```
ONE PATIENT (patient.id)
  → Phase A header (frozen)
  → ONE section nav: Overview | Clinical | Care | Documents | Coverage | Administration | Timeline
      Overview     compact Now + flags table + 3 recent visits
      Clinical     anchor index → stacked tables (one presentation per domain)
      Care         visits / appointments / counselling context / communication
      Documents    one workspace + source filters
      Coverage     insurance / CCMS tables / OPD bills (handoff only)
      Administration  registration + check-in + consents + IP + source gaps
      Timeline     chronological aggregation of existing loaders
```

SCAN → UNDERSTAND → COMPARE → OPEN DETAIL (Sheet / existing handoff) → HAND OFF.

---

## 4. UI changes

- Shared primitives: `Patient360RecordTable.tsx` (`Patient360Section`, `Patient360RecordTable`, `Patient360Status`, `patient360LinkClass`)
- Clinical: tables for vitals (OPD + IP), allergies, exams, medications, diagnoses, labs, imaging orders/files, optical, notes, specialty; chart-note Sheet preserved
- Clinical index labels: Summary, Vitals, Allergies, Examinations, Medications, Diagnoses, Laboratory, Scans (heading remains **Imaging** so the domain heading is unique), Optical, Notes, Specialty
- Care: visit/appointment tables; emergency-override **View details** Sheet; counselling table; no Assign/Start/Requeue
- Documents: filter buttons (`aria-pressed`); one table; MPI compact gap line
- Coverage: de-carded; insurance / authorizations / claims / settlement / bills as tables
- Administration: registration definition list; check-in history; consents; IP; Surgery/OT compact gap; appointments pointer to Care
- Timeline: Date \| Event \| Source \| Context \| Action
- Overview: flags table; Now omitted when empty; no header/action duplication

Phase A actions unchanged: Continue XOR Check-in, Schedule, Billing, Print, Export PDF. **No Edit Patient, Queue, IP Billing, OT, ownership, Counsellor assign.**

---

## 5. Component changes

| File | Change |
|---|---|
| `Patient360RecordTable.tsx` | **Added** — table/section/status primitives (existing `ui/table`) |
| `Patient360Clinical.tsx` | Table-first workspace; IP under Vitals; specialty in index |
| `Patient360Care.tsx` / counselling sessions | Tables + override Sheet |
| `Patient360Documents.tsx` | Single index + filters |
| `Patient360Coverage.tsx` | Removed card chrome |
| `Patient360Administration.tsx` | Registration dl; check-in vs Care pointer |
| `Patient360Timeline.tsx` | Chronological table (duplicate caption markup removed) |
| `Patient360Overview.tsx` | Clinical flags table |
| `patient-360-timeline.ts` | Also `loadPatient360Prescriptions` (no new event store) |
| `scripts/seed-patient-360-uat.ts` | Domain POSTs + seed-gap report |

---

## 6. Data sources reused

Existing Patient 360 loaders only. No second store.

---

## 7. APIs reused

None added. Seed (dev only) may POST:

- `/vitals/patient/{id}`
- `/patient-allergies`
- `/patient-notes`
- `/patient-consents`
- `/patient-communications`
- `/patient-insurance`
- `/appointments` when `E2E_TEST_DOCTOR_ID` is set
- Identity via existing `POST /patients` + lookup

---

## 8. Permissions preserved

Page: `patient.view`. Domain reads keep owning-source permissions (`patient360.medication.read`, `patient360.diagnosis.read`, counselling read, CCMS, billing, `appointment.view`, `patient.export`, etc.). UI still must not imply a destination is allowed merely because a route exists. **No catalog change.**

---

## 9. Database changes

**None.** No `patient_events`, no AI summary table, no document repository, no duplicate domain tables.

---

## 10. Seed data created

Deterministic identity (unchanged constants):

| Field | Value |
|---|---|
| Name | UAT360 Longitudinal |
| Phone | +919360000001 |
| Email | uat360.longitudinal@example.test |
| DOB | 1975-04-12 |

Idempotency: lookup by name; skip create if present; skip domain POST if payload already contains `UAT360 Longitudinal development fixture`. Refuses `NODE_ENV=production`. Find-or-create then `seedDomains`.

**This seed was not executed against a live API in this session.**

Command (non-production):

```
cd apps/hospital-portal-web
npx tsx scripts/seed-patient-360-uat.ts
```

---

## 11. Seed records created (intended; live HTTP not run here)

| Domain | Classification |
|---|---|
| Identity / registration / emergency on create | IMPLEMENTED (create path) |
| OPD vitals | IMPLEMENTED (POST if API accepts) else SEED GAP |
| Structured allergy | IMPLEMENTED (POST) else SEED GAP |
| Chart note | IMPLEMENTED (POST) else SEED GAP |
| Consent | IMPLEMENTED (POST) else SEED GAP |
| Communication | IMPLEMENTED (POST) else SEED GAP |
| Insurance profile | IMPLEMENTED (POST) else SEED GAP |
| Appointment / visit / bill | SEED GAP unless `E2E_TEST_DOCTOR_ID` set and POST succeeds |
| Examinations, prescriptions, diagnoses, lab results, imaging, optical | SEED GAP (no safe seed POST used; do not invent rows) |
| Counselling session/documents | SEED GAP (session workflow not invented) |
| CCMS coverage / auth / claims / settlement | SEED GAP (needs coverage-case workflow IDs) |
| Imaging files | SEED GAP (order then upload) |
| IP history | SEED GAP (IP onboard journey) |
| MPI documents | SOURCE GAP (no patient-scoped MPI document API) |

Every intended row is marked with the UAT fixture note. No duplicate seed tables.

---

## 12. Tests added/updated

- Clinical: no duplicate grid; tables; uniqueness of Imaging heading vs Scans index; IP “Pulse rate” (sr-only when present); medications genericName/durationDays
- Documents: filters allowed; upload/delete still forbidden; counselling empty copy on All; session id in name
- Care / counselling: no ownership mutations
- Admin: headings; Care pointer; check-in vs appointments
- Timeline: table; prescriptions from loader
- Overview: flags table; sparse layout
- Seed: `seedDomains` present
- Directory / Preview / handoff tests included in the focused run

---

## 13. Test command results

```
cd apps/hospital-portal-web
npx vitest run src/lib/patients/patient-360- src/lib/patients/patient-handoff.test.ts src/components/patients/lookup/PatientDirectoryAppointmentDialog.test.tsx src/components/patients/record/Patient360 --reporter=dot
```

- **Test files:** 38 passed  
- **Tests:** **176 passed / 0 failed**  
- **Duration:** ~12.6s  
- **Playwright / e2e:** **not executed** (live auth, branch, hub fixtures required)

---

## 14. Build / type / lint results

- IDE diagnostics on Patient 360 files touched in this slice: **no linter errors**
- `npx tsc --noEmit` in `apps/hospital-portal-web`: **fails** on pre-existing `WaitingListFilterToolbar.tsx` parse errors (Counsellor waiting list). **Not modified** (out of scope)
- `next build` / `next lint`: **not run** (full app typecheck already blocked by that unrelated file)

Do not treat Counsellor toolbar errors as Patient 360 regressions.

---

## 15. Source gaps

| Item | Classification |
|---|---|
| MPI / patient document library | SOURCE GAP |
| Surgery / OT history in 360 | SOURCE GAP (existing unavailable contract) |
| Follow-up as a Care object | SOURCE GAP |
| Portal / access status | SOURCE GAP |
| Medical history registry `/patient-medical-history` | SOURCE GAP (Clinical tests forbid this path) |
| Standalone clinical recommendations list | SOURCE GAP |
| Lab **result values / reference ranges** when DTO is metadata-only | SOURCE GAP (do not fabricate results) |
| Imaging report body when files/orders lack report text | SOURCE GAP |
| Counselling recordings / transcripts / AI / quotes / decisions | SOURCE GAP |
| Visit **provider** on Overview recent activity | SOURCE GAP (recent-visit DTO has no provider) |
| Communication from unrelated notification stores | OUT OF SCOPE (not equated) |

Honesty copy for wired-but-failed and never-connected domains still uses certified phrases (`… are not available in Patient 360`) because existing tests lock that wording. Empty remains `No … recorded.` Unauthorized remains `not available to this sign-in`. Spec STATE 2 (“Not connected”) vs STATE 3 (“Not available”) is **not fully split in user-visible copy** — DECISION REQUIRED if product wants the exact two sentences without changing locked tests.

---

## 16. Write / edit gaps

**Edit Patient was not implemented.**

| Field | Create | Update API | Actually persisted on PUT | Permission | UI safe on 360? |
|---|---|---|---|---|---|
| First / last name | Yes | PUT `/patients/{id}` | Yes (Exam Medical History already) | `patient.update` | DECISION REQUIRED — not in this slice |
| DOB / gender | Yes | same | Yes | `patient.update` | DECISION REQUIRED |
| Phone / email | Yes | same | Yes | `patient.update` | DECISION REQUIRED |
| Address (single `Address`) | Yes | same | Yes | `patient.update` | DECISION REQUIRED |
| Blood group | Yes | same | Yes | `patient.update` | DECISION REQUIRED |
| Allergy **text** on patient row | Yes | same | Yes | `patient.update` | WRITE GAP vs structured `patient_allergies` (dual store) |
| Emergency contact | Yes | DTO extends create | **No — controller does not assign** | create vs update | WRITE GAP — false success if UI saved it |
| Title / middle / nationality / occupation / address lines | Create DTO | — | Not on PUT mapping | `patient.create` | WRITE GAP |
| Health ID / Aadhaar | Create columns | — | Not assigned on PUT | `patient.create` | WRITE GAP |
| MRN | Generated | Not on PUT | — | — | OUT OF SCOPE |
| Branch / tenant | Create / JWT | JWT tenant | — | — | OUT OF SCOPE to mutate from 360 |

---

## 17. Document gaps

| Contract | Classification |
|---|---|
| CCMS documents list + existing view/download where owning module supports | IMPLEMENTED (read index) |
| Counselling documents metadata | IMPLEMENTED (read index) |
| MPI patient-scoped GET | SOURCE GAP |
| Unified hospital document repository | OUT OF SCOPE |
| Upload / storage / retention / audit for 360 | SOURCE GAP — **upload not implemented**; no invented API |

---

## 18. Decisions still required

| ID | Decision |
|---|---|
| Copy | Split “Not connected” vs “Not available” vs locked test strings |
| Edit Patient | Whether to expose PUT subset in a later slice after product accepts the field matrix |
| Allergy dual store | Registration text vs `patient_allergies` |
| Duplicate 400 UX if demographics PUT ever lands on 360 | |
| Continue encounter exam-view gate / Check-in waitingMinutes | Prior Phase A product items |
| Whether Overview may fetch extra domains for richer “Now” | Currently summary + recent visits only |

---

## 19. Out-of-scope items (unchanged)

Counsellor ownership, Waiting List, counselling state machine, Billing rules, Insurance rules, OT workflow, IP workflow, Directory census, Patient creation rules, duplicate thresholds, MRN rules, branch/tenant authorization, clinical mutation rules, Generate New Bill, cashier, IP financial ops, AI summaries, Timeline event storage, new design system.

---

## 20. Regression verification

Automated (focused vitest): Patient 360 sections + clinical/care/docs/coverage/admin/timeline/overview + `patient-handoff` + Directory appointment dialog — **176/176 pass**.

Not re-run: Playwright patient-hub, create-patient, counsellor e2e, billing/insurance/OT/IP e2e.

Manual UAT must still confirm Directory, Preview, Create Patient, duplicate detection, MRN, Counsellor ownership, Billing, Insurance, OT/IP after visual 360 changes.

---

## 21. UAT Correction Pass (2026-10-06)

Visual UAT showed tables in the DOM that still *read* as API dumps: bordered groups, `Source:` on every empty block, paragraph Field lists, long override/exam text in rows, and empty domains occupying large cards. This pass does **not** start a new Patient 360 product phase. Phase A header is unchanged. Loaders, permissions, routes, and Counsellor/Billing/Insurance/OT/IP rules are unchanged.

### Screenshot-driven defects

| Area | Defect | After |
|---|---|---|
| Clinical | Vertical list / “Chart facts”; specialty card wall; long exams inline | One workspace; Summary table; OPD/IP vitals tables only when rows exist; specialty as Biometry/OCT/Retinopathy **tables**; exam/note Sheets |
| Care | Explanatory prose; override reason in the row | Visits / Appointments / Counselling tables; **Emergency override · View details** Sheet |
| Documents | MPI / CCMS / Counselling as separate paragraphs | One filter + one table; MPI source-gap as a compact status line |
| Coverage | Field: value paragraphs; `Source: CCMS *` as visible labels | Insurance / Authorizations / Claims / OPD billing / Eligibility / Settlement **column tables**; provenance `sr-only` |
| Administration | Vertical identity dump; appointments duplicated | Registration definition list; check-in / consents / IP tables; appointments point to Care |
| Timeline | Long override text in Context | Truncated context; **View details** Sheet |
| Empty | Large bordered empty cards | Section heading + one status sentence |
| Source text | Visible backend terminology on every subsection | `sr-only` (tests still assert the strings) |

### Clinical

- Summary: Clinical item \| Current value \| Recorded (not “Chart facts”).
- Vitals: Date \| BP \| Pulse \| SpO₂ \| Temperature \| Weight \| Source; IP table only when IP rows exist.
- Allergies: Allergen \| Reaction \| Status \| Recorded; registration allergy text is a row, not NKDA inference.
- Examinations / Notes / imaging files: truncated summary + existing Sheet.
- Medications include Duration when the prescription loader supplies it.
- Diagnoses, Laboratory (metadata-honest), Optical remain single tables.
- Specialty diagnostics: tables, not a card wall.

### Care / Documents / Coverage / Administration / Timeline

- Care: Type cell is not a duplicated title; no Assign / Start / Requeue.
- Documents: All \| Clinical \| Counselling \| Insurance \| Laboratory \| Imaging; loading counselling documents is shown when that loader is still null.
- Coverage: policy/copay/deductible/OOP, PA numbers, TPA, claimed amount, query status, settlement type/case, bill net/balance are **table cells** (Radix Sheets do not appear in SSR HTML). **Open Billing** remains; no Generate New Bill.
- Administration: Field/Value registration; check-in; consents; IP Location column (DTO has no Ward); Surgery/OT compact source-gap.
- Timeline: `Front desk` (not `Source: Front desk`); truncated context.

### Seed execution (local non-production API)

Command: `npx tsx scripts/seed-patient-360-uat.ts` against `localhost:5073`.  
Patient: **UAT360 Longitudinal** (`patientId` `457797f7-5a55-4c4b-907b-08b5091d5904`).

| Domain | Result |
|---|---|
| Vitals | created (HTTP 200) |
| Allergies | created (HTTP 201) |
| Notes | created (HTTP 201) |
| Consents | seed-gap (HTTP 500) |
| Communications | seed-gap (HTTP 500) |
| Insurance profile write | seed-gap (HTTP 500) |
| Appointments / visits / bills | seed-gap (`E2E_TEST_DOCTOR_ID` not set) |
| CCMS / imaging files / IP history | seed-gap (workflow prerequisites) |
| MPI documents | source-gap (no patient-scoped MPI API) |

No fabricated clinical rows. No new endpoints.

### Tests / typecheck

- Focused vitest: **177/177 pass** (Patient 360 + `patient-handoff` + Directory appointment dialog). Assertions include table headers/cells, not only component existence.
- `npx tsc --noEmit`: still fails only on pre-existing `WaitingListFilterToolbar.tsx` (invalid characters / unterminated strings). **Out of scope — not modified.**
- Playwright / live browser UAT: not executed in this pass.

### Remaining limitations

- Coverage Cases and Eligibility remain (authoritative loaders); they are compact tables, not extra product tabs.
- OPD billing Encounter column is `—` until the bill DTO exposes visit/encounter.
- IP history uses Location, not Ward.
- Consents/communications/insurance/appointments were not persisted by this seed run.
- Visual acceptance still requires **manual** desktop / tablet / mobile UAT on the seeded patient.

---

## 22. Structural Table Rendering Correction (2026-10-06)

### Root cause

`Patient360RecordTable` returned `null` when `rows.length === 0`. Every domain then rendered honesty copy through `Patient360Status` (or a `<p role="status">`) **instead of** a table. Empty Clinical/Care/Documents/Coverage/Administration therefore looked like:

Section heading → status sentence → next heading.

That is a rendering-contract defect, not a missing CSS class.

Duplicate “Clinical / Care / …” titles came from an extra visible `<h2>` in each panel **in addition to** `Patient360SectionNav` tabs.

### Table rendering contract (now)

`Patient360RecordTable` always renders:

- column headers
- data rows when present
- otherwise one `colSpan` status row (`emptyState`)
- optional `footerState` row when another source is unauthorized/unavailable while rows exist (Documents)

Honesty copy (`empty` / `unauthorized` / `unavailable` / `loading`) lives **inside** that row via `patient360Honesty()`.

Duplicate section `<h2>` titles were removed. Clinical in-page anchors (`aria-label="Section contents"`) remain subordinate; they are not a second tablist.

### Empty-state behavior

Empty/unavailable/unauthorized domains keep the same table chrome. Status text is a compact table row, not a standalone paragraph.

### Automated tests

Focused vitest: **177/177 pass** (includes `Patient360RecordTable` empty-header contract).

Browser screenshots in this session: **not captured** (no authenticated desktop pass executed here). Manual UAT remains required.

### Seed / source gaps

Unchanged from §21. Seeded vitals/allergies/notes still come from existing write APIs. MPI / Surgery / OT remain source-gap rows inside tables.

---

# Final Structural UAT Cleanup

Bounded presentation cleanup after the structural table-first pass. No new Patient 360 phase. No API, DTO, permission, ownership, Clinical, Care, Documents, Coverage, or Overview redesign.

## Administration duplicate warning removal

The global Patient 360 shell already shows data-quality issues (`PatientDataQualityBanner`). Administration Registration no longer renders `summary.dataQuality.issues` as standalone warning paragraphs.

Registration remains a Field / Value table (date of birth, gender, blood group, phone, email, emergency contact when present). Phone / emergency values may appear as registration fields; they are not repeated as warning copy.

## Administration appointment placeholder removal

The Administration “Appointments” subsection (`Appointments are listed in Care.`) was removed. Appointments remain exclusively under Care → Appointments. Check-in history, Consents, Inpatient history, and Surgery / OT tables are unchanged.

## Timeline date presentation

`formatPatient360Date` now omits a `00:00` / midnight component on date-only values and uses a fixed `dd MMM yyyy` presentation (`05 Feb 2026`). Meaningful clock times are kept (`02 Sep 2026 09:00`). Stored values, APIs, sort order, and event semantics are unchanged.

## Tests

Focused vitest: **181/181 pass**.

Added/updated:

- Administration: data-quality strings are not repeated; no Appointments placeholder; Check-in / Consents / Inpatient remain
- Timeline: midnight omitted; `09:00` retained; supplied event order unchanged
- `formatPatient360Date` unit coverage
- Existing RecordTable empty/unavailable/unauthorized, Clinical, Care, Documents, Coverage, Overview tests remain in the same suite

## Browser UAT result

Inspected UAT360 Longitudinal on `localhost:3000` `/dashboard/patients/[id]` (all seven sections).

Observed:

- One primary Patient 360 navigation; Clinical subordinate anchors only (no second Clinical heading)
- Administration Registration is Field/Value only; no duplicate data-quality warning list; global allergy banner unchanged
- Administration has no Appointments placeholder; Check-in history, Consents, Inpatient history, Surgery / OT remain as tables with empty/unavailable rows inside the table
- Care still owns the Appointments table
- Timeline empty-state is a table row (`No dated events were returned from available sources.`); this seed currently has no dated events, so live `00:00` formatting was verified by unit tests (`05 Feb 2026`, keep `09:00`)
- Registration DOB presents as `12 Apr 1975` (no midnight)
- No page-level horizontal overflow on Timeline
- Empty domains keep table headers

This pass does **not** claim overall Patient 360 acceptance.

## Screenshots

Captured during browser inspection: Overview, Clinical, Care, Documents, Coverage, Administration, Timeline (automation session screenshots).

---

# Manual UAT matrix

Search **UAT360 Longitudinal** after running the seed against a **non-production** API. Use a user with `patient.view` plus domain permissions as needed.

| # | Area | Pass criteria | Result |
|---|---|---|---|
| 1 | Fixed patient | No patient switcher / N-of-M rail | PENDING |
| 2 | Seven sections | Only Overview…Timeline | PENDING |
| 3 | Phase A header | Identity, MRN, age, sex, acuity, DQ banner, Continue XOR Check-in, Schedule, Billing, Print, Export PDF | PENDING |
| 4 | Overview | Sparse; flags table; ≤3 recent visits; no duplicate identity/actions | PENDING |
| 5 | Clinical nav | Anchors only; each domain once; no nested page tabs | PENDING |
| 6 | Clinical tables | Scan/compare; Sheets for long notes/exams | PENDING |
| 7 | Honesty | Empty ≠ unauthorized ≠ unavailable; MPI/Surgery not “No records” | PENDING |
| 8 | Care | Visits, appointments, counselling context; override in Sheet; **no** Assign/Start/Requeue | PENDING |
| 9 | Documents | One table + filters; not three source cards | PENDING |
| 10 | Coverage | Patient-facing tables; not a CCMS console; View Billing only | PENDING |
| 11 | Administration | Registration without header clone; check-in ≠ Care appointments; OT gap compact | PENDING |
| 12 | Timeline | Chronological table; sourced; no invented events | PENDING |
| 13 | Responsive | Desktop tables; tablet/mobile horizontal **table** scroll; **no page** overflow | PENDING |
| 14 | Seed | Identity + any domains the live POSTs actually created; remaining gaps visible as empty/unavailable | PENDING |
| 15 | Edit / upload | No Edit Patient; no document upload | PENDING |
| 16 | Permissions | Hidden actions stay hidden; 401/403 copy | PENDING |
| 17 | Cross-module | Handoffs land in owning modules | PENDING |
| 18 | Regression | Directory, Preview, Create, duplicates, MRN, Counsellor, Billing, Insurance, OT/IP | PENDING |

---

**FINAL STATUS**

PATIENT 360 FINAL STRUCTURAL UAT CLEANUP COMPLETE  
AUTOMATED UNIT TESTS COMPLETE (181/181 focused)  
BROWSER INSPECTED ON UAT360 LONGITUDINAL (seven sections)  
MANUAL UAT / EXPLICIT ACCEPTANCE REMAIN THE GATE  
ACCEPTANCE NOT CLAIMED  
STOP

Do not start another Patient 360 slice until explicit acceptance.
