# Slice 4 — Targeted UAT Blocker Addendum

Date: 2026-10-07  
Parent: [slice-4-laboratory-document-implementation.md](./slice-4-laboratory-document-implementation.md)  
Scope: Targeted verification/fix of existing Slice 4 UI integration only  
Status: **UI INTEGRATION + CLINICAL/DOCUMENTS UX SEPARATION CORRECTED — MANUAL UAT STILL REQUIRED**

```text
AUTOMATED TESTS: PASS
MANUAL UAT: REQUIRED
ACCEPTANCE: NOT CLAIMED
NEXT SLICE: NOT STARTED
```

---

## 1. Root cause

### Primary (UI integration) — fixed

`LabReportsTab` (Attach Report) was implemented and unit-tested as a component, but **never mounted in the live Patient Record shell**.

Evidence:

| Fact | Evidence |
|---|---|
| Component exists | `apps/hospital-portal-web/src/components/patients/tabs/LabReportsTab.tsx` |
| Only consumer before fix | `PatientRecordTabContent.tsx` → `case 'lab_results'` |
| Live Patient Record route | `PatientRecordPage.tsx` renders Patient 360 sections only |
| Explicitly unmounted | `patient-360-slice-1.test.ts` asserts `PatientRecordPage` does **not** contain `PatientRecordTabContent` |
| Legacy deep-link | `?tab=lab_results` was **not** mapped in `patient-360-legacy-tab.ts` |

The live staff UI the UAT operator opened is Patient 360 (`Overview / Clinical / Care / Documents / …`). There is no separate classic “Lab Results” tab in that shell. Attach Report was therefore unreachable (dead UI path), while `/dashboard/laboratory` remained the unrelated mock page (out of scope).

### Secondary (Documents → Laboratory message) — explained, not fabricated around

Message:

> Laboratory reports are not available in Patient 360.

Rendered by:

- `Patient360Documents.tsx` → `patient360Honesty(clinical.labs, …)`
- Copy from `clinicalUnavailableMessage('labs')` in `patient-360-clinical.ts`

Condition: `clinical.labs.state === 'unavailable'`.

Data path:

1. `Patient360DocumentsPanel` / `Patient360ClinicalPanel` call `loadPatient360Clinical(patientId)`
2. Labs branch: `labReportsApi.getByPatient(patientId)` → `GET /api/lab-reports/patient/{patientId}`
3. `readMapped` → on thrown non-401/403 or non-list payload → `state: 'unavailable'`

Backend endpoint (unchanged Slice 4 contract):

- `LabReportsController.GetByPatient` — `[RequirePermission("patient.view")]`, tenant filter, returns `Ok(reports)` array with canonical metadata populated

Live DB audit (connected AuthService database):

| Check | Result |
|---|---|
| `public.lab_reports` | **MISSING** (`to_regclass` null) |
| EF model / migration defining table | Present (`[Table("lab_reports")]`, migration `20260218163249_AddExaminationDraftsAndClinicalExaminationFields`) |
| `lab_order` / `lab_order_item` row counts | 0 / 0 |
| Patients with real `LabReport` rows | **None** (table absent) |

So Documents → Laboratory shows “not available” because the list API fails against a missing table (not because Slice 4 intentionally disabled the Laboratory source, and not because of a feature flag). No fake `LabReport` rows were created.

Canonical document tables (`canonical_documents`, `canonical_document_associations`) exist; the LabReport clinical table does not.

---

## 2. Exact files / components / routes

### Before (broken mount)

- Route: `/dashboard/patients/[id]` → `PatientRecordPage`
- Shell: `Patient360SectionNav` + section panels
- Orphan: `PatientRecordTabContent` → `LabReportsTab` (unreachable)

### After (minimal correction)

- Route: `/dashboard/patients/[id]?section=clinical` (or Clinical tab)
- Section: Patient 360 → **Clinical** → **Laboratory** (`id="p360-clinical-lab"`)
- Mount: `<LabReportsTab patientId={summary.id} />` inside `Patient360Clinical.tsx`
- Legacy: `?tab=lab_results` → `section=clinical` via `patient-360-legacy-tab.ts`
- Documents Laboratory: unchanged consumer of `GET /api/lab-reports/patient/{patientId}` + canonical actions
- `/dashboard/laboratory`: **not modified**

---

## 3. Why automated tests did not catch this

| Suite | What it checked | Gap |
|---|---|---|
| `LabReportsTab.test.tsx` (original) | Static string presence of Attach Report / API paths inside `LabReportsTab.tsx` and absence from mock laboratory page | Never asserted import/render from `PatientRecordPage` / Patient 360 Clinical |
| Backend `LabReportCanonicalDocumentTests` | Controller/service contracts with in-memory DB | No live UI mount; in-memory has `LabReports` |
| `Patient360Documents.test.tsx` | Render with injected `clinical.labs` fixtures | Does not hit live API or mount Attach Report |
| `patient-360-slice-1.test.ts` | Asserted Patient 360 **replaced** `PatientRecordTabContent` | Confirmed the orphaning without requiring a new Lab Results mount |

---

## 4. Minimal correction made

1. Mount existing `LabReportsTab` in Patient 360 Clinical → Laboratory (`Patient360Clinical.tsx`).
2. Map legacy `lab_results` → `clinical` (`patient-360-legacy-tab.ts`).
3. Add mount/integration assertions to `LabReportsTab.test.tsx`; update Clinical presentation expectations for live tab loading copy.
4. **No** new Laboratory workflow, permissions, APIs, ReportUrl/clinical status changes, or `/dashboard/laboratory` edits.
5. **No** fake `LabReport` seed rows; **no** production schema apply in this change set (missing `lab_reports` table remains an environment/UAT data prerequisite — see §8).

---

## 5. Tests run

```text
cd apps/hospital-portal-web
npx vitest run \
  src/components/patients/tabs/LabReportsTab.test.tsx \
  src/lib/patients/patient-360-legacy-tab.test.ts \
  src/components/patients/record/Patient360Clinical.test.tsx \
  src/components/patients/record/Patient360Documents.test.tsx \
  src/lib/patients/patient-360-clinical.test.ts \
  src/lib/patients/patient-360-document-areas.test.ts
```

---

## 6. Test results

| Suite | Result |
|---|---|
| Focused vitest (6 files, 41 tests) | **PASS** — Failed: 0 |
| `LabReportCanonicalDocumentTests` (no backend code changes; regression) | **PASS** — Failed: 0, Passed: 18 |

---

## 7. `/dashboard/laboratory` confirmation

No edits under `apps/hospital-portal-web/src/app/dashboard/laboratory`. Mock Laboratory Management page remains out of scope.

---

## 8. Slice 4 business rules preserved

Unchanged:

- `POST /api/lab-reports/{id}/attach-report` + `patient.update`
- `GET /api/lab-reports/{id}/report/content` + `patient.view`
- Association `domain=lab`, `entityType=LabReport`
- Canonical identity TenantId + PatientId + SHA-256
- One active attachment; same bytes idempotent; different bytes → 409
- `ReportUrl` / clinical Status / results / CompletedAt / VerifiedByName untouched by attach
- Generic Patient 360 Upload → Laboratory remains `writable: false`

---

## 9. Manual UAT navigation path (after Clinical vs Documents UX correction)

**Documents (attach + file actions):**

1. Patient Directory → open a real patient (`/dashboard/patients/{id}`)
2. Patient 360 → **Documents** → **Laboratory**
3. Existing LabReport without canonical attachment → **Attach Report** → upload PDF
4. Same row → Preview / Download / Print (via `GET /api/lab-reports/{id}/report/content`)

**Clinical (read-only results):**

1. Patient Directory → open patient → **Clinical** → **Laboratory**
2. Verify clinical fields (test, result, range, status, date) — no Attach Report

Legacy deep link: `/dashboard/patients/{id}?tab=lab_results` resolves to Clinical (clinical table only).

---

## 10. Slice 4 UX correction — Clinical vs Documents separation

**Why Attach Report was removed from Clinical**

Clinical → Laboratory is a clinical results/context surface. Mounting `LabReportsTab` (document attach) there mixed document mutation into the clinical read workspace.

**Why Documents → Laboratory is the document action surface**

Documents indexes existing LabReports from `GET /api/lab-reports/patient/{patientId}` and already owned Preview / Download / Print / Open report. Attach Report belongs with those document actions, gated by `patient.update`, for LabReports with no active canonical attachment.

**Backend unchanged**

- `POST /api/lab-reports/{id}/attach-report` (`patient.update`)
- `GET /api/lab-reports/{id}/report/content` (`patient.view`)
- Association `lab` / `LabReport`; canonical identity; one attachment; idempotent / 409
- ReportUrl and clinical Status/results untouched by attach
- Generic Upload → Laboratory remains `writable: false`
- `/dashboard/laboratory` untouched

**Empty copy**

- Clinical → Laboratory: `No lab results recorded.`
- Documents → Laboratory: `No laboratory documents available.`

### Environment prerequisite for successful Manual UAT (not claimed done)

1. Table `public.lab_reports` — **created 2026-10-07** via drift repair of migration `20260218163249_AddExaminationDraftsAndClinicalExaminationFields` (EF history already recorded the migration, but `lab_reports` / `optical_orders` / `patient_communications` were absent; repaired with `CREATE TABLE IF NOT EXISTS` matching that migration DDL). Row count after repair: **0**.
2. At least one real `LabReport` row for a UAT patient is still required (none seeded; do not invent rows solely for UAT).

---

```text
AUTOMATED TESTS: PASS
MANUAL UAT: REQUIRED
ACCEPTANCE: NOT CLAIMED
NEXT SLICE: NOT STARTED
STOP.
```
