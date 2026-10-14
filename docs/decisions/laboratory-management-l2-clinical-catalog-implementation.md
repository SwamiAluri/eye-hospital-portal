# Laboratory Management — L2 Clinical Catalog Core

**Date:** 2026-10-07  
**Type:** IMPLEMENTATION SLICE  
**Authorization:** Product Owner authorized **L2 Clinical Catalog Core** after L1 Manual UAT  
**Status:** IMPLEMENTATION COMPLETE — MANUAL UAT REQUIRED

```text
IMPLEMENTATION COMPLETE — UAT DEFECT PASS APPLIED — MANUAL UAT RE-CHECK REQUIRED

AUDIT: PASS (see laboratory-management-l2-clinical-catalog-audit.md)
UAT DEFECTS: see laboratory-management-l2-clinical-catalog-uat-defects.md
AUTOMATED TESTS: PASS
DATABASE: MIGRATION APPLIED (20261007194500_AddLaboratoryClinicalCatalog.sql)
CERTIFIED REGRESSION: PASS (Slice 4 LabReportCanonicalDocumentTests; L1 worklist; P360 clinical map)
MANUAL UAT: REQUIRED (re-check after defect fixes)
ACCEPTANCE: NOT CLAIMED
NEXT SLICE: L3 — NOT STARTED
```

### UAT defect pass (2026-10-07)

| Finding | Root cause | Fix |
|---|---|---|
| Catalog dropdown UX | Dialog/Popover z-50 collision | `z-[100]`, collisionPadding, modal=false |
| CBC empty search | CASE D — 0 LaboratoryTestDefinition rows; CBC only in LabTestCatalog | Honest empty state + Add catalog test path (no fake seed) |
| Clinician Access Denied | `/users/doctors/search` requires `user.view` | `GET /laboratory/catalog/ordering-clinicians` with `patient.view` |

---

## 1. Audit findings

Pre-implementation audit: `docs/decisions/laboratory-management-l2-clinical-catalog-audit.md`.

| Finding | Outcome |
|---|---|
| No Laboratory clinical catalog entities existed | Implemented Laboratory-owned definitions |
| `LabTestCatalog` is Counsellor/Pre-Op | Not made Laboratory SoT |
| ServiceVariant is commercial | Optional nullable FK only |
| LabReport alone cannot represent panels (MULTI-01) | Additive `LabReportItem` under LabReport root |
| Doctor search API existed; no order UI | `DoctorSearchAutosuggest` added |
| Free-text order fields were L1 temporary | Replaced for new catalog orders |

No ratified business-rule conflict. No revival of `lab_order` / `lab_order_item` / `lab.api.ts`.

---

## 2. Product / architecture alignment

| Decision | L2 behavior |
|---|---|
| CAT-01 Hybrid catalog | LaboratoryTestDefinition clinical SoT; optional ServiceVariant link |
| CAT-02 Panels + analytes | Panels/membership + analyte definitions (no Observation engine) |
| CLI-01 Ordering clinician | Required authoritative doctor via `/users/doctors/search` |
| IND-01 Clinical indication | Required structured field (free vocabulary; no fake diagnosis catalog) |
| MULTI-01 Multi-item | One LabReport root + LabReportItem lines for panel/test members |
| SPEC-01 Specimen entity | Deferred — catalog specimen requirements only |
| OBS-01 / WF-01 / VER-01 / ORG-01 / EXT-01 | Deferred |

LabReport remains the authoritative operational root.

---

## 3. Catalog model implemented

| Entity | Table | Purpose |
|---|---|---|
| `LaboratoryTestDefinition` | `laboratory_test_definitions` | Clinical test SoT |
| `LaboratoryTestSpecimenOption` | `laboratory_test_specimen_options` | Valid specimen types per test |
| `LaboratoryPanel` | `laboratory_panels` | Panel definition |
| `LaboratoryPanelItem` | `laboratory_panel_items` | Panel membership |
| `LaboratoryAnalyte` | `laboratory_analytes` | Expected analytes (L5 prep only) |
| `LabReportItem` | `lab_report_items` | Order line items under LabReport |

**LabReport additive (nullable):** `TestDefinitionId`, `PanelId`, `ClinicalIndication`.

Denormalized display fields (`TestName`, `TestCode`, `TestCategory`, `SpecimenType`, `OrderedByName`) remain and are server-populated from catalog + doctor.

---

## 4. API changes

### Catalog

| Method | Route | Permission |
|---|---|---|
| GET | `/api/laboratory/catalog/tests` | `patient.view` |
| GET | `/api/laboratory/catalog/tests/{id}` | `patient.view` |
| POST | `/api/laboratory/catalog/tests` | `patient.update` |
| GET | `/api/laboratory/catalog/panels` | `patient.view` |
| GET | `/api/laboratory/catalog/panels/{id}` | `patient.view` |
| POST | `/api/laboratory/catalog/panels` | `patient.update` |

Search supports `search`, `activeOnly`, `take`. Tenant + soft-delete filters apply.

### Order

| Method | Route | Permission |
|---|---|---|
| POST | `/api/lab-reports/catalog-order` | `patient.update` |

Request binds: `patientId`, exactly one of `testDefinitionId`/`panelId`, `specimenType` (when multiple valid), `orderedById`, `clinicalIndication`, optional `notes`/`priority`/`visitId`.

Server derives name/code/category/specimen. DTO has **no** client override fields for catalog metadata.

Legacy `POST /api/lab-reports` remains for compatibility; catalog FKs are cleared on that path.

L1 `GET /api/lab-reports` worklist unchanged.

---

## 5. Database / migration

**Files:**

- `microservices/auth-service/AuthService/Data/Migrations/20261007194500_AddLaboratoryClinicalCatalog.cs`
- `microservices/auth-service/AuthService/Data/Migrations/20261007194500_AddLaboratoryClinicalCatalog.sql`

**Apply before Manual UAT** (project convention: SQL scripts; `Database.Migrate()` disabled):

```bash
psql "<connection>" -f "microservices/auth-service/AuthService/Data/Migrations/20261007194500_AddLaboratoryClinicalCatalog.sql"
```

Additive only. No bulk historical migration. No fake clinical seeds.

---

## 6. Frontend changes

| Surface | Change |
|---|---|
| `LaboratoryOrderDialog` | Catalog picker + doctor autosuggest + indication + notes; `createFromCatalog` |
| `LaboratoryCatalogPicker` | Active test/panel search; Test vs Panel distinction |
| `DoctorSearchAutosuggest` | Authoritative clinician selection |
| `LaboratoryCatalogAdminDialog` | Minimal “Add catalog test” for real UAT definitions |
| `LaboratoryWorkbench` | Admin entry + worklist shows `testCode` |
| `laboratory-catalog.api.ts` | Catalog client |
| `lab-reports.api.ts` | `createFromCatalog` |

No free-text Test Name / Test Code / Ordering Clinician for new catalog orders. Specimen options come from selected catalog item only.

---

## 7. Permission behavior

Unchanged interim model:

- Route gate: `laboratory.view`
- List/catalog read: `patient.view`
- Create order / create catalog: `patient.update`

No new permission codes. Tenant isolation enforced on catalog and order APIs.

---

## 8. Legacy compatibility

| Case | Behavior |
|---|---|
| Historical LabReports without catalog FKs | Remain listable/readable |
| Legacy `POST /lab-reports` | Still creates free-text rows; clears catalog FKs |
| New catalog orders | Populate denormalized fields + nullable FKs + items |
| Slice 4 documents | Unchanged association/content contracts |
| P360 Laboratory projection | Continues via existing LabReport reads |

---

## 9. Tests executed and exact results

### Backend (`AuthService.Tests`)

```text
Filter: LaboratoryCatalogTests | LabReportWorklistTests | LabReportCanonicalDocumentTests
Passed!  - Failed: 0, Passed: 44, Skipped: 0, Total: 44
```

Coverage includes: catalog search active/tenant/soft-delete, panel membership, analytes, specimen validation, clinician validation, inactive/invalid catalog rejection, catalog-order create, panel multi-item, legacy compatibility, free-text override impossibility (`LaboratoryCatalogOrderRequest` has no TestName/TestCode/TestCategory), L1 worklist, Slice 4 canonical documents.

### Frontend (Vitest)

```text
laboratory-l2-catalog.test.tsx — 9 passed
laboratory-l1-workbench.test.tsx — 20 passed
laboratory-l0-honesty.test.ts + patient-360-clinical.test.ts — run as regression
```

---

## 10. Known limitations

- Clinical indication is a required structured text field, not a controlled medical vocabulary (none authoritative in-repo).
- Catalog admin UI is minimal (create test only); panel create is API-first.
- No Visit picker in Order dialog UI yet (API accepts `visitId` when known).
- ServiceVariant link is optional on create-test API; no billing side effects.
- AuthService must be rebuilt/restarted (not `--no-build`) after deploy; SQL migration must be applied for UAT.

---

## 11. Explicitly deferred (L3+)

Specimen collection/accession/barcode/receive-reject · Observation/result entry · verification/release · QC/critical · amendments · status history engine · external lab · HL7/FHIR/LIS · Counsellor→LabReport bridge · new permission catalog · P360 redesign · bulk historical catalog migration · fake seeds.

---

## 12. Manual UAT checklist

1. Lab Technician login  
2. Laboratory Management loads  
3. (If empty catalog) Add catalog test via “Add catalog test” with real name/code/specimen  
4. Search catalog test  
5. Select test  
6. Verify Test Code is derived (not typed)  
7. Verify Category is derived  
8. Verify valid specimen options only  
9. Verify invalid specimen cannot be selected  
10. Search/select ordering clinician (authoritative doctor)  
11. Enter clinical indication / reason  
12. Enter additional notes (optional)  
13. Create order  
14. Verify worklist row (name/code/category/clinician)  
15. Verify Patient 360 Laboratory projection still shows the LabReport  
16. Verify Slice 4 document attach/preview/download/print unchanged  
17. Lab Manager regression (same workbench)  
18. Tenant/security: other-tenant patient/catalog must fail  

**Optional panel path:** create panel via API with ≥2 active tests; order panel; confirm one LabReport with multiple items and worklist shows panel name.

---

## 13. Acceptance status

```text
L2 implementation complete
→ automated tests pass
→ manual UAT required
→ acceptance NOT claimed
→ L3 NOT started
```
