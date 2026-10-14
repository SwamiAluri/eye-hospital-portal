# Laboratory Management — L2 Clinical Catalog Audit

**Date:** 2026-10-07  
**Type:** PRE-IMPLEMENTATION AUDIT (L2)  
**Mode:** READ-ONLY findings for implementation planning  
**Status:** COMPLETE — NO BLOCKING CONFLICT WITH RATIFIED RULES

```text
AUDIT: PASS — PROCEED TO L2 IMPLEMENTATION
ARCHITECTURAL CONFLICT: NONE (additive LabReportItem under LabReport root)
SERVICE CATALOG / LABTESTCATALOG OWNERSHIP CONFLICT: NONE (hybrid preserved)
```

---

## 1. Existing catalog structures

| Structure | Owner | Live? | Laboratory clinical SoT? |
|---|---|---|---|
| `LabTestCatalog` / `lab_test_catalog` | Counsellor / PreOp | Yes (`PreOpTestManagement/lab-catalog`) | **No** — seed candidate for names only |
| Service Catalog V2 (`service_categories` → `catalog_services` → `service_variants`) | Billing / Master Data | Yes | Commercial only |
| `LaboratoryTestDefinition` / Panel / Analyte / `LabReportItem` | — | **Not in EF** | Approved V3; **to implement in L2** |
| Orphan `lab.api.ts` | — | FE only | **Do not use** |

## 2. LabReport today

Flat single-test root (`lab_reports`): `TestName`, `TestCode`, `TestCategory`, `SpecimenType`, `OrderedById`/`OrderedByName`, `VisitId`, `Notes`.  
**Missing:** `TestDefinitionId`, `PanelId`, clinical indication, item children.

## 3. MULTI-01 / Panel representation

**LabReport alone cannot represent a multi-test panel.**  
**Required additive (approved V3):** `LabReportItem` children under `LabReport` when a panel is ordered; single-test orders may use header `TestDefinitionId` + denormalized fields (optional single item).

## 4. Safe reuse

| Asset | Reuse |
|---|---|
| ServiceVariant | Optional nullable FK from LaboratoryTestDefinition — do not change SC behavior |
| LabTestCatalog | Optional seed source for names/codes — do not make SoT |
| `GET /users/doctors/search` + `useDoctorSearch` | Authoritative clinician — **need UI autosuggest** (none wired today) |
| `PatientSearchAutosuggest` | Keep |
| Visit `GET /visits/by-patient/{id}` | Optional VisitId when known — do not invent |
| SearchableMasterSelect / CounsellingProcedureCombobox | Pattern reference |
| Permissions | Keep `laboratory.view` / `patient.view` / `patient.update` |

## 5. New Laboratory-owned structures required

- `LaboratoryTestDefinition` (+ optional `ServiceVariantId`, specimen requirement options, TAT, method, category)
- `LaboratoryPanel` + `LaboratoryPanelItem` membership
- `LaboratoryAnalyte` (definition structure for later L5 — no Observation persistence)
- `LabReport` additive: `TestDefinitionId?`, `PanelId?`, `ClinicalIndication?`
- `LabReportItem` (panel/multi-item lines)

## 6. Migration

**Yes — new migration required** (additive tables + nullable columns). No bulk historical migration.

## 7. Seed / UAT data

No fake clinical seeds. Catalog admin APIs (and minimal UI if needed) so real UAT entries can be created. LabTestCatalog may optionally inform manual mapping — not auto-seeded as production truth.

## 8. Legacy LabReport compatibility

Preserve all existing columns. Historical rows without catalog FKs remain valid and readable. New orders derive code/category/specimen from catalog server-side.

## 9. ServiceVariant link

Optional `ServiceVariantId` on LaboratoryTestDefinition only. No billing/counsellor/insurance behavior change.

## 10. Ratified rule check

No change to Slice 4, P360 ops boundary, counsellor separation, LabReport root, status vocabulary, or permission invention. Proceed.
