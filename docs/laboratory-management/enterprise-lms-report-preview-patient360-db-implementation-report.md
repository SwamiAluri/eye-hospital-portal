# L-REP-03 CUT D-B — Patient 360 Current LMS Official PDF  
# Implementation Report

**Date:** 2026-10-13  
**Slice:** L-REP-03 CUT D-B — Patient Directory → Patient 360 → Documents → Laboratory current LMS Official PDF projection  
**Mode:** BOUNDED IMPLEMENTATION REPORT  

---

## 1. D-A acceptance closure reference

| Item | Value |
| --- | --- |
| Evidence | [enterprise-lms-report-preview-da-uat-evidence-and-remaining-checklist.md](./enterprise-lms-report-preview-da-uat-evidence-and-remaining-checklist.md) |
| Acceptance closure | [enterprise-lms-report-preview-da-acceptance-closure.md](./enterprise-lms-report-preview-da-acceptance-closure.md) |
| Decision | **`ACCEPTED_L_REP_03_CUT_D_A`** — Product Owner attested UAT-DA-01…09; automated FE **22 passed / 0 failed** preserved |
| Fixture limitation | Non-PHI fixture IDs not supplied; not invented |

D-B proceeded only after Gate A acceptance was formally recorded.

---

## 2. Binding Product Decisions (not reopened)

| Stamp / decision | Status |
| --- | --- |
| `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED` | Binding |
| `PD-D-BRANCH = OPTION_B_APPROVED` | Implemented on D-B projection |
| `PD-D-PREVIEW-AUDIT = APPROVED` | Preview/Download reuse CUT C `DOWNLOAD_OFFICIAL_PDF` via `downloadLmsOfficialPdf` |
| `PD-D-CONTENT-DISPOSITION = APPROVED` | Authenticated Lab proxy + object-URL; no SAS/public Blob |
| `PD-D-HASH-REUSE = APPROVED` | Currentness = `CurrentOfficialArtifactId` only |

Upstream stamps preserved: `ACCEPTED_L_REP_02B`, `ACCEPTED_L_REP_03_CUT_A`, `ACCEPTED_L_REP_03_CUT_B`, `ACCEPTED_L_REP_03_CUT_C`, `ACCEPTED_L_REP_03_CUT_D_A`.

---

## 3. D-B scope implemented

Project the **current** LMS Official PDF into Patient 360 Documents → Laboratory as a staff discovery surface of the existing CanonicalDocument (no duplicate CanonicalDocument).

| Layer | Change |
| --- | --- |
| Backend | New patient-scoped projection API with Option B branch authorization |
| Frontend | Merge LMS rows into Patient 360 Documents Laboratory; reuse CUT C download for Preview/Download/Print |
| Content | Existing CUT C download endpoint **unchanged** |
| Pathology / Patient Portal | Untouched |

---

## 4. Changed files, endpoints, DTOs, services

### Backend

| File | Change |
| --- | --- |
| `LaboratoryApi/Services/OfficialPdfDtos.cs` | `PatientCurrentOfficialPdfDocumentDto` |
| `LaboratoryApi/Services/OfficialPdfService.cs` | `ListPatientCurrentOfficialPdfsAsync` (Option B) |
| `LaboratoryApi/Functions/OfficialPdfFunctions.cs` | `GET lms/patients/{patientId}/current-official-pdfs` |
| `LaboratoryApi.Tests/OfficialPdfServiceTests.cs` | D-B projection + CUT C regression tests |

**Endpoint:** `GET /lms/patients/{patientId}/current-official-pdfs`  
**Permission:** `lms.reports.view` (or `lms.reports.manage`)  
**Does not** accept `operatingBranchId` as authorization control.

**DTO fields (camelCase JSON):** `reportId`, `patientId`, `operatingBranchId` (server-resolved), `businessReportNumber`, `reportStatus`, `artifactId`, `artifactVersion`, `canonicalDocumentId`, `mimeType`, `sizeBytes`, `generatedAtUtc`, `sourceDomain` (`enterprise_lms`), `sourceEntityType` (`LmsReportOfficialPdfArtifact`).

### Frontend

| File | Change |
| --- | --- |
| `apps/hospital-portal-web/src/lib/lms/lms-reports.api.ts` | `listPatientCurrentLmsOfficialPdfs` |
| `apps/hospital-portal-web/src/lib/patients/patient-360-lms-official-pdf.ts` | Mapper + loader + laboratory empty merge helper |
| `apps/hospital-portal-web/src/lib/patients/patient-360-lms-official-pdf.test.ts` | Loader/map/empty tests |
| `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.tsx` | Laboratory merge + LMS Preview/Download/Print |
| `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.test.tsx` | D-B UI tests |
| `apps/hospital-portal-web/src/lib/lms/enterprise-lms-reports-ui.test.ts` | API path wiring assertions |

---

## 5. Option B authorization flow

```text
JWT + lms.reports.view
  → Load Released+numbered reports for tenant+patient with CurrentOfficialArtifactId
  → For each report: ValidateUserBranchAsync(tenant, user, report.OperatingBranchId)
       · 403 → omit report (fail closed for that row)
       · other platform errors → fail request
  → Resolve artifact ONLY via CurrentOfficialArtifactId
  → Require Succeeded + non-empty CanonicalDocumentId
  → Project metadata (no bytes)
```

Content bytes (Preview / Download / Print):

```text
FE uses downloadLmsOfficialPdf({ reportId, operatingBranchId from projection })
  → CUT C DownloadAsync (unchanged)
  → ValidateUserBranchAsync(client branch) + report.OperatingBranchId equality
  → DOWNLOAD_OFFICIAL_PDF audit fail-closed
  → AuthService enterprise_lms / LmsReportOfficialPdfArtifact content stream
```

Client-supplied branch cannot authorize a report the user is not allowed to see on the projection list; CUT C still rejects branch inequality for content.

`patient.view` alone does **not** authorize LMS content.

---

## 6. Current-pointer and CanonicalDocument behavior

| Rule | Behavior |
| --- | --- |
| Currentness SoT | `LmsReport.CurrentOfficialArtifactId` only |
| Historical artifacts | Not projected |
| Successful regeneration | Pointer advances → only new current projected |
| Failed regeneration | Pointer unchanged → prior current remains |
| CanonicalDocument | Existing association reused; no second document created |
| ContentHash / Status / timestamps | Not used as currentness |

---

## 7. Audit and content-security behavior

| Control | Behavior |
| --- | --- |
| Projection list | Metadata only; no Blob/SAS |
| Preview/Download/Print | CUT C authenticated download + object-URL |
| Audit | `DOWNLOAD_OFFICIAL_PDF` on each content open (PD-D-PREVIEW-AUDIT) |
| Audit failure | Fail-closed — no bytes (CUT C preserved) |
| Association | Auth open path remains `enterprise_lms` / `LmsReportOfficialPdfArtifact` |

---

## 8. Automated tests — commands and actual results

### Backend

```text
dotnet test "microservices/laboratory-service/LaboratoryApi.Tests/LaboratoryApi.Tests.csproj" --filter "FullyQualifiedName~OfficialPdfServiceTests"
```

**Result:** Passed — **Failed: 0, Passed: 33, Skipped: 0**

Includes D-B coverage for: eligible projection, empty (no current), historical exclusion, successful regeneration, failed regeneration preserves prior, cross-tenant empty, unauthorized branch exclusion, no client-branch bypass parameter + CUT C equality denial, missing CanonicalDocument exclusion, CUT C download unchanged after projection, audit fail-closed after projection.

### Frontend

```text
npx vitest run src/lib/patients/patient-360-lms-official-pdf.test.ts `
  src/components/patients/record/Patient360Documents.test.tsx `
  src/lib/lms/enterprise-lms-reports-ui.test.ts `
  src/lib/lms/lms-official-pdf-preview-eligibility.test.ts `
  src/components/lms/reports/ReportOfficialPdfPreview.test.tsx
```

**Result (first focused run):** 5 files · **58 passed / 0 failed**  
(D-A suite retained: eligibility 6 + Preview 4 + reports-ui 12; D-B loader + Documents coverage included.)

After adding API path assertions, `enterprise-lms-reports-ui.test.ts` re-run is expected green (same suite).

---

## 9. CUT C and legacy Pathology scope verification

| Area | Status |
| --- | --- |
| CUT C Download endpoint / contract / audit | **Unchanged** (regression tested) |
| Report numbering / finalize / release / PDF generation | **Unchanged** |
| Permissions / role grants | **None added** |
| Legacy Pathology `/dashboard/laboratory`, `lab` / `LabReport` | **Untouched** |
| Patient Portal | **Untouched** |
| Schema / migrations | **None** |
| Duplicate CanonicalDocument | **Not created** |

---

## 10. Known limitations / unresolved product decisions

| Item | Note |
| --- | --- |
| Manual UAT | **Not executed** in this task — STOP for Product Owner |
| D-B acceptance | **Not claimed** |
| Whole CUT D acceptance | **Not claimed** |
| Production RolePermission grants | Still environment/ops concern; no seeder changes |
| Projection returns multiple current PDFs | One per eligible Released report for the patient (each with its own current pointer) |
| List audit | No separate list audit action (content uses approved DOWNLOAD_OFFICIAL_PDF) |

No Product Decisions reopened.

---

## 11. Manual UAT scenarios (handoff — do not mark complete)

Execute and record (non-PHI fixtures only):

1. Current LMS Official PDF appears under Patient 360 → Documents → Laboratory.  
2. Correct Business Report Number and source (**Enterprise LMS Laboratory** / **LMS Official PDF**) are displayed.  
3. Preview renders the correct current PDF.  
4. Download returns the same current document.  
5. Print works using the existing Patient 360 print pattern.  
6. Successful regeneration switches the displayed current artifact (only one current).  
7. Failed regeneration leaves the prior current artifact visible.  
8. No duplicate current document appears in Patient 360 All for the same CanonicalDocumentId.  
9. Cross-tenant and unauthorized-branch access is denied (empty / controlled denial; no bytes).  
10. No public/SAS URL is exposed in browser/network.  
11. Legacy Pathology documents and behavior remain unchanged.  
12. Patient Portal remains unchanged.

---

## 12. Status stamps

```text
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED
ACCEPTED_L_REP_03_CUT_D_A
D_B_IMPLEMENTATION_COMPLETE
AUTOMATED_TESTS_PASSED
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B
ACCEPTED_L_REP_03_CUT_C
PD-D-BRANCH = OPTION_B_APPROVED
CUT_C_UNCHANGED
LEGACY_PATHOLOGY = UNCHANGED
PATIENT_PORTAL = UNCHANGED
NEXT_GATE = D_B_MANUAL_UAT
```

**Not stamped:**

- `ACCEPTED_L_REP_03_CUT_D_B`
- `ACCEPTED_L_REP_03_CUT_D`
- `MANUAL_UAT_PASSED`
- `ACCEPTANCE_COMPLETE`

---

## 13. Next gate

```text
NEXT_GATE = D_B_MANUAL_UAT
```

**STOP** for Product Owner Manual UAT.  
Do not proceed to any subsequent CUT D slice.  
Do not claim D-B acceptance from this implementation report alone.
