# Laboratory Management — L1 Workbench Stabilization

**Date:** 2026-10-07  
**Type:** IMPLEMENTATION SLICE  
**Authorization:** Product Owner accepted Product Definition V3 and authorized **ONLY L1**  
**Status:** IMPLEMENTATION COMPLETE — MANUAL UAT REQUIRED

```text
IMPLEMENTATION COMPLETE — MANUAL UAT REQUIRED

AUDIT: PASS
405: FIXED (runtime verified)
AUTOMATED TESTS: PASS
DATABASE: UNCHANGED
CERTIFIED REGRESSION: PASS (Slice 4 tests; no Slice 4 code changes in L1)
MANUAL UAT: REQUIRED
ACCEPTANCE: NOT CLAIMED
NEXT SLICE: L2 — NOT STARTED
```

---

## 1. Executive Summary

L1 stabilizes the Laboratory Management workbench so `GET /api/lab-reports` succeeds for authorized users. The defect was a **route/method mismatch** (FE GET vs committed AuthService POST-only collection) compounded by **stale `dotnet run --no-build` binaries**.  

**Fixed by:** ensuring `[HttpGet] List` exists on `LabReportsController` for `api/lab-reports`, aligning FE `labReportsApi.list`, rebuilding AuthService, restarting without `--no-build`, and adding 405/tenant/soft-delete/filter regression tests.

No L2+ capabilities were implemented. No schema/migration. No permission redesign. Order New Test left as free-text prototype.

---

## 2. Original 405 Root Cause

| Item | Evidence |
|---|---|
| FE call | `labReportsApi.list` → `GET {NEXT_PUBLIC_API_URL}/lab-reports?...` → `http://localhost:5073/api/lab-reports` |
| Committed HEAD | Collection route registered **POST Create only**; no GET List |
| Working tree | Contained uncommitted `[HttpGet] List` |
| Stale runtime | AuthService often started as `dotnet run --no-build` → binary could diverge from source |
| 405 mechanism | ASP.NET matched controller route; verb not registered → **405 Method Not Allowed** |
| Not the cause | Authorization / permissions (those produce 401/403) |

---

## 3. Repository State Before Implementation

| Surface | Before L1 |
|---|---|
| HEAD `LabReportsController` | No collection GET |
| WT `LabReportsController` | List GET present (uncommitted) |
| FE `labReportsApi.list` | Present in WT; HEAD lacked list |
| Running AuthService | `--no-build` on :5073 |
| Observed UI | “Unable to load laboratory orders” |

---

## 4. Exact Files Changed (L1 scope)

| File | Change |
|---|---|
| `microservices/auth-service/AuthService/Controllers/LabReportsController.cs` | Ensure `[HttpGet] List` on collection with filters, tenant isolation, patient join projection |
| `apps/hospital-portal-web/src/lib/api/lab-reports.api.ts` | Ensure `list()` GET contract (`status`, `category`, `priority`, `search`, `take`) |
| `apps/hospital-portal-web/src/components/laboratory/*` | Existing L1 workbench/dialog (no redesign; consume list) |
| `apps/hospital-portal-web/src/app/dashboard/laboratory/page.tsx` | Existing L1 page shell |
| `microservices/auth-service/AuthService.Tests/LabReportWorklistTests.cs` | Added/strengthened empty, priority/take, missing-tenant, **HttpGet 405 regression** |
| `apps/hospital-portal-web/src/app/dashboard/laboratory/laboratory-l1-workbench.test.tsx` | GET-not-POST + empty payload regression |
| `docs/decisions/laboratory-management-l1-stabilization.md` | This report |

**Not modified for L1:** Slice 4 document service, migrations, seeds, permission catalogs, Order dialog clinical redesign, P360 clinical mapping (except existing consumers).

---

## 5. Exact API Contract Implemented

```http
GET /api/lab-reports?status=&category=&priority=&search=&take=
Authorization: Bearer <jwt>
X-Tenant-ID: <tenantGuid>
```

| Aspect | Behavior |
|---|---|
| Permission | `[RequirePermission("patient.view")]` + `[Authorize]` |
| Tenant | Claim `TenantId` / `tenant_id` + middleware `X-Tenant-ID`; rows filtered `lab.TenantId` and `patient.TenantId` |
| Soft-delete | EF `HasQueryFilter(DeletedAt == null)` on `LabReport` |
| Filters | Exact match status / category / priority; search on test name/code + patient MRN/name |
| Ordering | `OrderedAt ?? CreatedAt` descending |
| Take | Default 100; clamped 1–200 |
| Response | `200 OK` + JSON array of `LabReport` (incl. NotMapped `PatientDisplayName`, `MedicalRecordNumber`) |
| Empty | `200` + `[]` |

Preserved unchanged: POST create, PUT, complete, attach-report, report/content, DELETE, GET by id / by patient.

---

## 6. Runtime / Build Correction

| Step | Result |
|---|---|
| Stop stale `--no-build` AuthService PIDs | Done |
| `dotnet build` AuthService Debug | **0 errors** (DLL timestamp refreshed) |
| Restart | `dotnet run --project AuthService.csproj` → `AuthService.exe --urls http://localhost:5073` (**not** `--no-build`) |
| Unauthenticated GET | Not 405 (tenant middleware **400** without tenant header) |
| Lab Technician login + `X-Tenant-Id` + GET | **HTTP 200**, body `[]` |
| Lab Manager + filters | **HTTP 200** for status/priority/search/take queries |

---

## 7. Security / Tenant / Soft-Delete Verification

| Check | Evidence |
|---|---|
| `patient.view` on List | Attribute + unit test |
| Cross-tenant exclusion | `List_ReturnsTenantRows_WithPatientIdentity_ExcludesOtherTenantAndSoftDeleted` |
| Soft-delete exclusion | Same test + EF query filter |
| Missing tenant claim | `List_MissingTenantClaim_ReturnsUnauthorized` |
| No branch invent | Not introduced |
| No new permissions | Not introduced |

---

## 8. Frontend Impact

Minimal: existing `LaboratoryWorkbench` continues to call `labReportsApi.list` with status/priority/search/take. Loading / empty / error / Order New Test unchanged. Design system unchanged. No new KPIs/queues/catalog UI.

FE sends `Authorization` + `X-Tenant-ID` via `auth-interceptors.ts` (same pattern as other AuthService APIs).

---

## 9. Database Impact

**UNCHANGED.** No migrations, tables, seeds, or schema edits.

---

## 10. Tests Added / Changed

**Backend (`LabReportWorklistTests`):**
- `ListEndpoint_IsHttpGet_OnBareCollectionRoute` (405 regression)
- `List_EmptyTenant_ReturnsOkEmptyArray`
- `List_MissingTenantClaim_ReturnsUnauthorized`
- `List_FiltersByPriority_AndClampsTake`
- Existing tenant/soft-delete/status/search/create tests retained

**Frontend (`laboratory-l1-workbench.test.tsx`):**
- `list uses GET /lab-reports (405 regression — not POST collection)`
- `list treats empty array as successful empty worklist payload`
- Existing workbench honesty + filter contract tests retained

---

## 11. Test Results

| Suite | Result |
|---|---|
| `LabReportWorklistTests` | **Passed 16/16** |
| `LabReportCanonicalDocumentTests` (Slice 4 regression) | **Passed 18/18** |
| Vitest `laboratory-l0-honesty` + `laboratory-l1-workbench` | **Passed 28/28** |

---

## 12. Manual UAT Steps

### A. Lab Technician
1. Login as Lab Technician (UAT account).  
2. Navigate to Laboratory Management (`/dashboard/laboratory`).  
3. Confirm workbench loads; network shows `GET /api/lab-reports` → **200** (not 405).  
4. Empty state **or** real orders (no fake rows).  
5. Exercise Search, Status filter, Priority filter, Refresh.

### B. Lab Manager
1. Same workbench access and list behavior as A.

### C. Order New Test
1. Open dialog; patient search works.  
2. Create still uses existing free-text flow (`POST /api/lab-reports`).  
3. After create, worklist reloads from GET list.

### D. Regression
1. Patient 360 Laboratory clinical projection intact.  
2. Slice 4 Documents Laboratory attach/preview/download intact.

### E. Authorization
1. User without `laboratory.view` cannot open page (existing gate).  
2. User without `patient.view` sees permission-denied worklist state (existing).

---

## 13. Known Limitations

- Empty worklist is valid when no LabReports exist (no fake seed).  
- Free-text Order New Test remains (L2 catalog out of scope).  
- No verification/release/specimen/QC/observation.  
- Least-privilege still interim `patient.*` + `laboratory.view` (per V3).  
- Runtime must be rebuilt after controller changes — do **not** rely on `--no-build`.

---

## 14. Explicit Out-of-Scope Confirmation

L2–L18 capabilities (catalog, panels, specimen, observations, verification, critical, QC, amendment, FHIR, HL7, external lab, analyzer, barcode HW, counsellor bridge, historical migration) were **not** implemented. Permissions were **not** redesigned.

---

## 15. Certified Functionality Regression Confirmation

| Area | L1 action |
|---|---|
| Slice 4 attach / SHA-256 / one active / 409 / content | **Not modified**; `LabReportCanonicalDocumentTests` **PASS** |
| P360 Documents Laboratory | **Not modified** |
| P360 Clinical lab projection | **Not modified** |
| Create / complete / update / delete / attach endpoints | **Preserved** |
| Counsellor lab separation | **Preserved** |

---

## 16. Final Gate

```text
IMPLEMENTATION COMPLETE — MANUAL UAT REQUIRED

Do NOT claim Manual UAT PASS, Acceptance, or start L2
until Product Owner explicitly reports Manual UAT results.
```
