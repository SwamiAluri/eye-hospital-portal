# L-REP-03 CUT D-B — Patient 360 LMS Official PDF Visibility Gap  
# Fix Report

**Date:** 2026-10-13  
**Slice:** L-REP-03 CUT D-B — Patient Directory → Patient 360 → Documents → Laboratory  
**Mode:** BOUNDED AUDIT → ROOT-CAUSE FIX → AUTOMATED TESTS → MANUAL UAT HANDOFF  

**Authoritative references (not reopened):**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-preview-da-acceptance-closure.md](./enterprise-lms-report-preview-da-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_D_A` |
| [enterprise-lms-report-preview-patient360-db-implementation-report.md](./enterprise-lms-report-preview-patient360-db-implementation-report.md) | Prior D-B implementation report |
| [enterprise-lms-report-preview-patient360-product-decision-closure.md](./enterprise-lms-report-preview-patient360-product-decision-closure.md) | Binding PD-D-* decisions |
| [enterprise-lms-report-preview-patient360-readiness-audit.md](./enterprise-lms-report-preview-patient360-readiness-audit.md) | Readiness baseline |
| [enterprise-lms-report-staff-download-acceptance-closure.md](./enterprise-lms-report-staff-download-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_C` (frozen) |

Upstream stamps preserved: `ACCEPTED_L_REP_02B`, `ACCEPTED_L_REP_03_CUT_A`, `ACCEPTED_L_REP_03_CUT_B`, `ACCEPTED_L_REP_03_CUT_C`, `ACCEPTED_L_REP_03_CUT_D_A`.

---

## 1. Observed UI gap (Product Owner evidence)

Patient Directory → Patient 360 → Documents → Laboratory showed a legacy Pathology laboratory row with **Attach Report**, while Enterprise LMS Reports showed a successful Official PDF artifact for an internally generated Released report.

The expected **LMS Official PDF** row (Type / Source / Report Number / Preview·Download·Print) was **not** discoverable in Patient 360 Documents.

---

## 2. Root cause (source + runtime evidence)

### Primary — runtime route not registered (stale LaboratoryApi host)

| Probe (pre-fix) | Result |
| --- | --- |
| `GET /api/lms/health` | **200** (host alive) |
| `GET /api/lms/reports` | **401** (route registered; auth required) |
| `GET /api/lms/patients/{guid}/current-official-pdfs` | **404** (route **missing**) |

The D-B projection function existed in source (`OfficialPdfFunctions.ListPatientCurrentOfficialPdfs`) but the running Azure Functions host on port **7076** was a **pre–D-B process**. Frontend loader therefore received **404**, mapped to `unavailable`, and merged **zero** LMS rows while Pathology (AuthService) continued to render Attach Report.

### Secondary — FE permission asymmetry vs backend / Reports UI

| Surface | Gate |
| --- | --- |
| LaboratoryApi projection | `lms.reports.view` **OR** `lms.reports.manage` |
| `ReportsWorkbench` / `ReportDetailView` | `view` **OR** `manage` |
| Patient 360 Documents (before fix) | **`view` only** |

A manage-capable actor could use Reports Official PDF while Patient 360 never called the projection API (`unauthorized` short-circuit).

### Tertiary — LMS failure honesty suppressed beside Pathology rows

When Pathology returned rows and LMS projection failed (`unavailable` / `unauthorized`), `laboratoryDocumentsCombinedEmpty` returned `null` (because pathology count &gt; 0). The Laboratory table looked like a successful Pathology-only list with no LMS failure signal — matching the “missing Official PDF” PO observation under a 404 host.

### Not the cause (verified)

| Hypothesis | Evidence |
| --- | --- |
| Backend projection logic wrong for eligible patient | Unit tests project eligible current Succeeded + CanonicalDocument; other-patient exclusion added and green |
| All-tab dedup hiding Laboratory | Dedup runs only when `filter === 'all'` |
| Pathology overwrite of LMS state | Separate `useEffect` / state; LMS merge is independent |
| JSON casing / response unwrap | `OkJsonAsync` uses camelCase; FE expects array |
| Patient/report association fabrication needed | Local DB has Released + current Succeeded + CanonicalDocument rows (see §3) |

---

## 3. Patient / report / artifact / CanonicalDocument identity (non-PHI)

Safe local DB sample (identifiers only; no names/MRN text):

| ReportId | PatientId | BRN | CurrentArtifactId | Artifact status | CanonicalDocumentId |
| --- | --- | --- | --- | --- | --- |
| `6ade1f89-…` | `3dac80b6-…` | `UAT-RPT-20261013-000002` | `50adc1bf-…` | Succeeded | `aa1ebb1a-…` |
| `c08ddff2-…` | `47dfc88c-…` | `UAT-RPT-20261013-000001` | `7e1258c9-…` | Succeeded | `5f59390d-…` |
| `a34fdfdc-…` | `47dfc88c-…` | `UAT-RPT-20261012-000001` | `d69a1d7c-…` | Succeeded | `76f84c82-…` |

Projection filters strictly on `LmsReport.PatientId == route patientId` and `CurrentOfficialArtifactId` → Succeeded artifact with CanonicalDocumentId. No name/MRN/hash matching.

**Manual UAT must open Patient 360 using the same PatientId GUID as `LmsReport.PatientId` for the chosen report.**

---

## 4. Exact files changed

| File | Change |
| --- | --- |
| `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.tsx` | `view\|\|manage` gate; LMS honesty footer beside Pathology; document name uses `{BRN}.pdf` |
| `apps/hospital-portal-web/src/lib/patients/patient-360-lms-official-pdf.ts` | `laboratoryLmsHonestyAlongsidePathology` helper |
| `apps/hospital-portal-web/src/lib/patients/patient-360-lms-official-pdf.test.ts` | Honesty + 404→unavailable tests |
| `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.test.tsx` | Coexistence + failure honesty + permission wiring |
| `microservices/laboratory-service/LaboratoryApi.Tests/OfficialPdfServiceTests.cs` | Other-patient exclusion test |

**Runtime ops (not source):** LaboratoryApi on `:7076` rebuilt/restarted so `LmsPatientCurrentOfficialPdfDocuments` is registered.

**Unchanged:** CUT C download endpoint/contract/audit; Pathology Attach Report; Patient Portal; permissions catalogue/role grants; schema/migrations; Report Number / Release / generation / CanonicalDocument registration semantics.

---

## 5. API request/response findings

| Check | Result |
| --- | --- |
| FE client | `getLaboratoryApi()` → `NEXT_PUBLIC_LABORATORY_API_URL` (`http://localhost:7076/api`) |
| Route | `GET /lms/patients/{patientId}/current-official-pdfs` |
| Pre-fix live host | **404** (function absent) |
| Post-restart live host | **401** without JWT (route present; auth required) |
| Authz | JWT + `lms.reports.view` or `lms.reports.manage`; **no** client `operatingBranchId` authorization parameter |
| Option B | Server uses `report.OperatingBranchId` + `ValidateUserBranchAsync`; 403 branch → omit row |
| Currentness | `LmsReport.CurrentOfficialArtifactId` only |
| Content bytes | Still CUT C `downloadLmsOfficialPdf` only (no Blob/SAS) |

---

## 6. Frontend merge / filter / dedup findings

| Area | Finding |
| --- | --- |
| Loader | `loadPatient360LmsOfficialPdfs(patientId)` from `usePatientRecord().patientId` |
| Laboratory merge | Pathology rows + LMS rows when `state === 'ready'` and `canReadLmsOfficialPdfs` |
| All-tab | LMS included when `filter === 'all'`; `shouldSkipDuplicateCanonicalOnAll` by CanonicalDocumentId |
| Attach Report | Unchanged for Pathology rows without `canonicalDocumentId` |
| Pre-fix failure mode | 404 → `unavailable` → no LMS rows; Pathology still visible; **no honesty** when Pathology nonempty |
| Post-fix | Same merge; honesty footer when LMS fails beside Pathology; read gate = view\|\|manage |

---

## 7. Fix implemented

1. **Restart LaboratoryApi** with current binaries so the D-B projection route is live (primary PO gap).  
2. **Align Patient 360 read gate** with backend / Reports: `useHasAnyPermission([view, manage])`.  
3. **Surface LMS projection failures** via table `footerState` when Pathology rows exist (`laboratoryLmsHonestyAlongsidePathology`).  
4. **Display name** uses approved `{BusinessReportNumber}.pdf` (`row.fileName`).  
5. **Tests** for other-patient exclusion, Attach Report + LMS coexistence, 404 honesty, and permission wiring.

No parallel API, second CanonicalDocument, or Attach Report reuse for LMS Official PDF publication.

---

## 8. Tests executed (actual results)

### Backend

```text
dotnet test "microservices/laboratory-service/LaboratoryApi.Tests/LaboratoryApi.Tests.csproj" --filter "FullyQualifiedName~OfficialPdfServiceTests"
```

**Result:** Passed — **Failed: 0, Passed: 34, Skipped: 0**

### Frontend

```text
npx vitest run src/lib/patients/patient-360-lms-official-pdf.test.ts `
  src/components/patients/record/Patient360Documents.test.tsx `
  src/lib/lms/enterprise-lms-reports-ui.test.ts `
  src/lib/lms/lms-official-pdf-preview-eligibility.test.ts `
  src/components/lms/reports/ReportOfficialPdfPreview.test.tsx
```

**Result:** 5 files · **62 passed / 0 failed**

---

## 9. Authorization and currentness verification

| Invariant | Status |
| --- | --- |
| `PD-D-BRANCH = OPTION_B_APPROVED` | Preserved (server branch validate; no client-branch list authz) |
| `PD-D-PREVIEW-AUDIT` | Preserved (content via CUT C `DOWNLOAD_OFFICIAL_PDF`) |
| `PD-D-CONTENT-DISPOSITION` | Preserved (authenticated object-URL; no SAS) |
| `PD-D-HASH-REUSE` | Preserved (pointer-only currentness) |
| Historical artifacts excluded | Covered by existing projection tests |
| Regeneration pointer behavior | Covered by existing projection tests |
| Cross-tenant / unauthorized branch | Covered by existing projection tests |
| `patient.view` does not authorize LMS content | Preserved |

---

## 10. Scope confirmation (unchanged)

| Area | Status |
| --- | --- |
| CUT C Download | **Unchanged** |
| Legacy Pathology / Attach Report | **Unchanged** |
| Manual uploads / external docs | **Unchanged** |
| Patient Portal | **Unchanged** |
| Permissions / role grants | **Unchanged** (gating reuse only) |
| Schema / migrations | **None** |

---

## 11. Remaining blockers / product decisions

| Item | Note |
| --- | --- |
| Manual UAT | **Required** — not executed in this task |
| D-B acceptance | **Not claimed** |
| Whole CUT D | **Not claimed** |
| Host restart dependency | Local UAT must keep LaboratoryApi on current build; a stale host reproduces the 404 gap |
| PatientId alignment | UAT must use Patient Directory patient GUID = `LmsReport.PatientId` |

No Product Decisions reopened.

---

## 12. Manual UAT checklist (STOP — do not mark complete)

1. Open the **same** patient GUID as the Released LMS report’s `PatientId` in Patient Directory → Documents → Laboratory.  
2. Confirm the eligible LMS Official PDF appears **automatically** (no Attach Report required for LMS).  
3. Confirm Type = **LMS Official PDF**, Source = **Enterprise LMS Laboratory**, Document name includes Business Report Number (`.pdf`).  
4. Confirm the legacy Pathology row and **Attach Report** remain unchanged.  
5. Preview LMS Official PDF; verify Report Number/content.  
6. Download and compare with Preview.  
7. Print via existing Patient 360 pattern.  
8. Switch to **All**; confirm the LMS document appears once (no CanonicalDocument duplicate).  
9. Confirm another patient’s report is not shown.  
10. Verify unauthorized-branch denial with a safe existing account.  
11. Confirm no public/SAS URL is exposed.  
12. Confirm Pathology and Patient Portal behavior unchanged.

---

## 13. Status stamps

```text
D_A_ACCEPTED_L_REP_03_CUT_D_A
D_B_IMPLEMENTATION_REQUIRES_VERIFIED_FIX
D_B_VISIBILITY_FIX_IMPLEMENTED
D_B_AUTOMATED_TESTS_PASSED
D_B_MANUAL_UAT_REQUIRED
D_B_ACCEPTANCE_NOT_CLAIMED
CUT_C_UNCHANGED
LEGACY_PATHOLOGY_UNCHANGED
PATIENT_PORTAL_UNCHANGED
PD-D-BRANCH = OPTION_B_APPROVED
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B
ACCEPTED_L_REP_03_CUT_C
NEXT_GATE = D_B_MANUAL_UAT
```

**Not stamped:** `ACCEPTED_L_REP_03_CUT_D_B`, `ACCEPTED_L_REP_03_CUT_D`, `MANUAL_UAT_PASSED`, `ACCEPTANCE_COMPLETE`.

**STOP** at `D_B_MANUAL_UAT`. Do not claim D-B acceptance from this report alone.
