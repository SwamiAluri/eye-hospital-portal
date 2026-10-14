# Patient 360 Phase C — Clinical Workspace

Date: 2026-10-06  
Status: **PHASE C — CLINICAL IMPLEMENTATION COMPLETE — AUTOMATED TESTS COMPLETE — MANUAL UAT REQUIRED — STOP**  
Acceptance: **not claimed**

Route: `/dashboard/patients/[id]?section=clinical`  
Blueprint: `docs/decisions/patient-360-complete-ux-redesign-blueprint.md` (section G)  
Prior accepted slices: Phase A header, Phase B Overview, table-first structural UAT cleanup  
This slice: **Clinical only**

---

## 1. Scope

Patient 360 Clinical is a **read/context** workspace:

ONE PATIENT → ONE FIXED CONTEXT → ONE RECORD WORKSPACE → Clinical information domain.

Authorized domains:

Summary · Vitals · Allergies · Examinations · Medications · Diagnoses · Laboratory · Imaging & scans · Optical · Notes · Specialty diagnostics

**Not started:** Care, Documents, Coverage, Administration, Timeline, Timeline prescription fixes, `patient_events`, clinical mutations, new APIs, Directory/Preview, billing/insurance/CCMS, waiting list, OT/IP workflows, permission catalog, schema.

Phase A header/actions and Overview were not reopened except as regression coverage (tests remain green).

---

## 2. Repository audit

Inspected before coding:

| Item | Location |
|---|---|
| Blueprint Clinical IA | `docs/decisions/patient-360-complete-ux-redesign-blueprint.md` §G |
| Table-first workspace report | `docs/decisions/patient-360-complete-workspace-implementation-report.md` |
| Clinical panel | `Patient360Clinical.tsx` |
| Table primitive | `Patient360RecordTable.tsx` (`Patient360Section`, honesty, Sheets) |
| In-page anchors | `Patient360Group.tsx` → `Patient360Subnav` (`aria-label="Section contents"`) |
| Primary nav | `Patient360SectionNav.tsx` (seven-section tablist) |
| Loaders | `patient-360-clinical.ts`, `patient-360-ip-vitals.ts`, `patient-360-imaging-files.ts`, `patient-360-specialty-diagnostics.ts` |
| Owning API clients | vitals GET, `patientAllergiesApi`, `examinationApi`, prescriptions patient-360, diagnoses patient-360, `labReportsApi`, `imagingApi`, imaging files patient-360, `opticalOrdersApi`, `patientNotesApi`, biometry/retinopathy/OCT patient-360 |
| Existing Sheets | `Patient360DetailSheet` (canonical `ui/sheet`) |
| Tests | `Patient360Clinical.test.tsx`, `patient-360-clinical.test.ts`, IP/imaging/specialty/overview/handoff/directory appointment |

**Audit conclusion:** table-first Clinical already existed from the accepted structural pass. Phase C gaps were **DTO honesty and nested IA**, not a second Clinical product.

---

## 3. Current Clinical architecture (after Phase C)

```
Patient360SectionNav (ONE primary tablist: Overview…Timeline)
  Patient360ClinicalPanel (tabpanel, min-w-0 overflow-x-hidden)
    Patient360Subnav (subordinate hash anchors only — not a tablist)
    Summary / Vitals / Allergies / Examinations / Medications / Diagnoses /
    Laboratory / Imaging & scans / Optical / Notes
    Specialty diagnostics (same stack; id=p360-clinical-specialty)
```

- No duplicate Clinical `<h2>` in the panel (label lives on the primary tab).
- Specialty is no longer a sibling heading after the loader; it is the last Clinical section.
- `Patient360RecordTable` keeps headers when empty/unauthorized/unavailable/loading.
- Long exam findings and chart notes use existing `Patient360DetailSheet`.

---

## 4. Clinical source / API matrix

| Domain | Current source | Presentation | Empty / unauthorized / unavailable | Detail / handoff | Phase C change |
|---|---|---|---|---|---|
| Summary | `summary.latestVitals` (VA/IOP) | Finding / Right eye / Left eye / Recorded | Compact empty row: “No examination draft measures…” | — | **Preserved** labels (not Field/Value/Chart facts). No header identity duplication |
| OPD vitals | `GET /vitals/patient/{id}?limit=50` | Date BP Pulse SpO2 Temperature Weight Source | Honesty inside OPD table | — | Column **Temperature** (was Temp). No invented measures |
| IP vitals | `GET /patient-journeys/patients/{id}/patient-360/ip-vitals` | Same columns; Source = Ward/PreOp | Honesty inside IP table; empty still compact table (not a card) | Pager when ready | **Preserved**. Extra DTO fields (RR, height) mapped in loader but **not added as columns** |
| Allergies | `GET /patient-allergies/patient/{id}` | Allergen Reaction Status Recorded | Structured empty ≠ NKDA | — | Map `reaction` + `createdAt`/`onsetDate`. Registration text is a **source line**, not a fake allergen row |
| Examinations | `GET /Examinations/patient/{id}` | Date Examination Eye Key finding Provider | Honesty in table | Sheet when finding/title long | Map `examinationType` / `findings` / `examinedByName` / optional laterality. Do **not** map `diagnosis` |
| Medications | `GET /prescriptions/patients/{id}/patient-360` | Medication Dose Frequency Route Duration Status | Honesty in table | Pager; no Rx workflow | **Preserved** including `durationDays` / generic name. Timeline **not** changed |
| Diagnoses | `GET /diagnoses/patients/{id}/patient-360` | Diagnosis Code Status Recorded Source | Honesty in table | Pager | **Preserved** coded rows only |
| Laboratory | `GET /lab-reports/patient/{id}` | Date Test Result Reference Status Action | Honesty in table | Open `reportUrl` if http(s) | Map `resultValue`+unit and `referenceRange` when present. Do **not** map `interpretation` as a flag |
| Imaging orders | `GET /Imaging/patient/{id}` | Date Study Eye/Body Status Report Action | Honesty in table | Sheet for long laterality/detail | **Preserved**. Report body not on DTO → `—` (not fabricated) |
| Imaging files | `GET /Imaging/patient/{id}/patient-360/images` | Date Study Eye/Body Status Action | Distinct files empty/unauth/unavailable | Sheet for file metadata | **Preserved**. No bytes / no upload |
| Optical | `GET /optical-orders/patient/{id}` | Date Type Eye Prescription/Order Status | Honesty in table | — | Map OD/OS sphere (etc.) when present; do not invent |
| Notes | `GET /patient-notes/patient/{id}` | Date Type Author Summary Action | Honesty in table | Sheet for `content` | Map `noteType` + `authorName`. Truncated summary in row |
| Biometry | `GET /biometry/patients/{id}/patient-360` | Compact table | Honesty in table | Sheet for measures | Nested under Clinical Specialty; outer duplicate h3 removed |
| Retinopathy | `GET /retinopathyscreening/patients/{id}/patient-360` | Compact table | Honesty in table | — | **Preserved** tables (not cards) |
| OCT | `GET /octimaging/patients/{id}/patient-360` | Compact table | Honesty in table | — | **Preserved** under Specialty (not a second Imaging OCT wall) |
| Eye history registry | — | — | — | — | **SOURCE GAP** — not rendered |
| Clinical recommendations | — | — | — | — | **SOURCE GAP** — not rendered |
| `/patient-medical-history` | forbidden in Clinical tests | — | — | — | **Not called** |
| EHR `patient-medications` list | not the 360 path | — | — | — | 360 continues to use `patient360.medication.read` |

---

## 5. Permission matrix

Frontend Clinical loaders **do not** consult a second permission catalog. Authorization remains **backend-authoritative**. HTTP 401/403 → `unauthorized` copy; other failures → `unavailable`; empty ready list → empty copy. UI does not show rows for denied domains.

| Domain | Contract permission (existing; catalog unchanged) |
|---|---|
| Summary / OPD vitals / allergies / lab / optical / notes | `patient.view` |
| Examinations / imaging orders / imaging files | `examination.view` |
| IP vitals | `ip.vitals.read` |
| Medications | `patient360.medication.read` |
| Diagnoses | `patient360.diagnosis.read` |
| OCT | `diagnostic.oct.read` |
| Biometry | `CLINICAL:BIOMETRY:VIEW` |
| Retinopathy | `CLINICAL:SCREENING:VIEW` |

No permission codes were added, renamed, or weakened.

---

## 6. UX changes

- Specialty diagnostics lives in the Clinical domain stack (one heading, one `#p360-clinical-specialty` id).
- Clinical panel clips page-level horizontal overflow (`min-w-0 overflow-x-hidden`); tables still scroll inside `ui/table`’s `overflow-auto` wrapper (`min-w-[40rem]`).
- Vitals column **Temperature**.
- Allergies: structured DTO fields only; registration allergy text labeled as registration/source information.
- Examinations: scan columns filled from examination DTO; long findings in Sheet, not a payload dump in the row.
- Laboratory: Result/Reference only when the lab DTO supplies values; interpretation not shown as an abnormal flag.
- Optical: Eye + compact Rx from actual OD/OS fields.
- Notes: Type + Author from DTO; body in existing Sheet.
- No Clinical mutation controls (Add / Edit / Prescribe / Record / Upload).

---

## 7. Empty / unavailable / unauthorized behavior

All listed domains keep **the same table header** and **one compact `role="status"` row** via `Patient360RecordTable`.

Copy remains domain-specific (examples):

- Empty: `No OPD vitals recorded.` / `No coded diagnoses recorded.` — never converted from SOURCE GAP.
- Unauthorized: `… are not available to this sign-in.`
- Unavailable: `… are not available in Patient 360.`
- Allergies empty **does not** say NKDA.

---

## 8. Detail Sheet usage

Reused `Patient360DetailSheet` (`ui/sheet`):

- Examinations (finding/title length)
- Chart notes (`content`)
- Imaging order long detail; imaging file metadata
- Biometry measures

No second modal architecture.

---

## 9. Responsive behavior

- Desktop: dense full-width tables, no Clinical card grid.
- Tablet/mobile: horizontal scroll stays on the table wrapper; panel `overflow-x-hidden` prevents page-level overflow.
- Phase A shell / primary nav unchanged.
- Automated coverage is markup/class assertions, not live viewport UAT.

---

## 10. Files changed

| File | Role |
|---|---|
| `apps/hospital-portal-web/src/components/patients/record/Patient360Clinical.tsx` | Clinical IA, tables, Sheets, specialty slot, overflow |
| `apps/hospital-portal-web/src/components/patients/record/Patient360SpecialtyDiagnostics.tsx` | Remove duplicate Specialty h3; keep per-source tables |
| `apps/hospital-portal-web/src/lib/patients/patient-360-clinical.ts` | Honest DTO mapping (allergy, exam, lab, optical, notes) |
| `apps/hospital-portal-web/src/components/patients/record/Patient360Clinical.test.tsx` | Phase C presentation contract |
| `apps/hospital-portal-web/src/lib/patients/patient-360-clinical.test.ts` | Mapper + boundary tests |
| `apps/hospital-portal-web/src/components/patients/record/Patient360SpecialtyDiagnostics.test.tsx` | Heading owned by Clinical section |
| `apps/hospital-portal-web/src/components/patients/record/Patient360ImagingFiles.test.tsx` | Lab row type includes `reference` |
| `docs/decisions/patient-360-phase-c-clinical-report.md` | This report |

---

## 11. Tests

Focused Patient 360 suite (PowerShell file list: `patient-360*.test.ts`, `Patient360*.test.tsx`, `patient-handoff.test.ts`, `PatientDirectoryAppointmentDialog.test.tsx`):

**39 files, 182 tests, all passed.**

Includes Clinical, Overview, Care, Documents, Coverage, Administration, specialty, IP vitals, imaging files, timeline unit file, Phase A/B, handoff, Directory appointment dialog.

Playwright / live UAT: **not run**.

---

## 12. Typecheck / build status

`npx tsc --noEmit` in `apps/hospital-portal-web`: **fails** only on pre-existing `WaitingListFilterToolbar.tsx` parse errors (invalid characters / unterminated strings). **Not modified** (out of scope).

After filtering that file, no remaining TypeScript diagnostics were reported from this run.

Next.js full `build` was not run.

---

## 13. Source gaps

| Gap | Treatment |
|---|---|
| Dedicated eye-history registry | Not shown |
| Standalone clinical recommendations | Not shown |
| `/patient-medical-history` | Forbidden; not called |
| Imaging report **bodies** and image **bytes** | Metadata/orders/files only; report cell `—` when absent |
| Examination laterality | Shown only if payload has `laterality`/`eye`; otherwise `—` |
| Lab interpretation / abnormal flags | Not displayed (would look invented if treated as derived flags) |
| IP respiratory rate / height in the Clinical vitals table | Present on IP DTO/mapper; omitted from columns per “do not add columns merely because they might be useful” |

---

## 14. Out-of-scope confirmation

Did **not** implement: Care, Documents, Coverage, Administration, Timeline, Timeline Rx, Edit Patient, clinical writes, document repository, Generate New Bill, billing/insurance/CCMS, counsellor ownership, waiting list, OT/IP, Directory, Preview, new design system, new permission catalog, new tables, fabricated clinical rows.

Did **not** claim Phase C acceptance.

---

## 15. Manual UAT checklist

Use a real sign-in and a patient with mixed clinical data (and a second patient with empty/denied domains).

1. [ ] One primary Patient 360 nav; Clinical selected shows one tabpanel.
2. [ ] Clinical in-page anchors move within Clinical; they are not a second tab system.
3. [ ] No duplicate “Clinical” page heading.
4. [ ] Each Clinical domain heading appears once.
5. [ ] Empty domains keep table headers + one status row (not a paragraph-only empty region).
6. [ ] Unauthorized domains show sign-in copy inside the table, not “No records”.
7. [ ] Unavailable / source-gap copy is honest (especially imaging files vs orders).
8. [ ] Summary shows draft VA/IOP only; no name/MRN/DOB/gender/acuity/header actions.
9. [ ] OPD vitals table; values match API; no invented measures.
10. [ ] IP vitals separate source; empty IP is compact, not a dominant empty card.
11. [ ] Allergies: structured rows; no NKDA inference; registration text labeled as registration text.
12. [ ] Examinations scan-friendly; Sheet for long findings; no diagnosis invented from exam text.
13. [ ] Medications include duration when DTO has `durationDays`; no prescribe/edit.
14. [ ] Diagnoses coded table only.
15. [ ] Laboratory Result/Reference only when supplied; no fake ranges/flags.
16. [ ] Imaging orders vs files distinguished; no fabricated report body; no upload/delete.
17. [ ] Optical table uses actual order fields.
18. [ ] Notes truncated; Sheet for body; no note editor.
19. [ ] Specialty = Biometry / Retinopathy / OCT tables, not a card wall.
20. [ ] Desktop density acceptable; tablet/mobile: no page-level horizontal overflow; table scrolls internally.
21. [ ] No Clinical Add/Edit/Delete/Prescribe/Record/Upload controls.
22. [ ] Phase A actions and Overview still behave as accepted.

---

## 16. Final STOP gate

Browser/Playwright against a live Patient 360 Clinical patient was **not** executed in this slice.

**PHASE C — CLINICAL IMPLEMENTATION COMPLETE — AUTOMATED TESTS COMPLETE — MANUAL UAT REQUIRED — STOP**

No Phase D (Documents) or later Patient 360 phase is authorized until manual UAT and **explicit acceptance** of Phase C.
