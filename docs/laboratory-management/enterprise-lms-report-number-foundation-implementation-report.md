# L-REP-03 CUT A — Report Number Foundation Implementation Report

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT A — Report Number Foundation  
**Mode:** Implementation complete; Manual UAT required  

## Authorization reference

- Product Decision Closure: `docs/laboratory-management/enterprise-lms-report-artifact-numbering-download-decision-closure.md`  
  (`PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED`)
- Readiness Audit: `docs/laboratory-management/enterprise-lms-report-artifact-numbering-download-readiness-audit.md`
- This task: **IMPLEMENTATION_AUTHORIZED** for CUT A only

## Scope implemented

Explicit post-Release **Assign Report Number** for Enterprise LMS Reports:

- Immutable `BusinessReportNumber` on Report aggregate
- Operating-branch scoped PostgreSQL-safe sequence allocation
- Governed format configuration infrastructure (no production defaults seeded)
- API, permissions catalogue (no role grants), audit allowlist, UI

## Explicitly NOT implemented

- CUT B: PDF / QuestPDF / jobs / CanonicalDocument / artifact / `lms.reports.generate`
- CUT C: download endpoint / download UI / `DOWNLOAD_OFFICIAL_PDF`
- Automatic number assignment inside `ReleaseAsync`
- Patient Portal / Patient 360 / notifications / amendments / Unrelease
- Production role grants
- Hard-coded production prefix/width/reset values

## Files changed (primary)

### LaboratoryApi

- `Domain/LmsReport.cs` — number metadata fields
- `Domain/LmsReportNumber.cs` — configuration + sequence + format helpers
- `Domain/ReportEnums.cs` — `assign_report_number` / `ASSIGN_REPORT_NUMBER`
- `Data/LaboratoryDbContext.cs` — mappings + DbSets
- `Migrations/20261012210000_AddLmsReportNumberFoundation.cs`
- `Services/ReportService.cs` — `AssignNumberAsync` (+ helpers); Release unchanged
- `Services/ReportDtos.cs` — assign request + DTO fields
- `Services/LaboratoryAuthz.cs` — `lms.reports.assign_number`
- `Functions/ReportFunctions.cs` — `POST lms/reports/{id}/assign-number`

### AuthService

- `SeedData/EnterpriseLmsReportsPermissionCatalog.cs` — catalogue-only `lms.reports.assign_number` (no role grants)
- `Controllers/InternalAuditController.cs` — allowlist `ASSIGN_REPORT_NUMBER`

### Frontend

- `lib/lms/lms-permissions.ts`
- `lib/lms/lms-reports.api.ts`
- `components/lms/reports/ReportDetailView.tsx`
- `components/lms/reports/ReportsWorkbench.tsx`
- `lib/lms/enterprise-lms-reports-ui.test.ts`

### Tests

- `LaboratoryApi.Tests/ReportNumberAssignTests.cs`
- `LaboratoryApi.Tests/ReportNumberPostgresConcurrencyTests.cs`
- `LaboratoryApi.Tests/LaboratoryDbContextShellTests.cs`
- `AuthService.Tests/EnterpriseLmsReportsPermissionTests.cs`
- `AuthService.Tests/InternalAuditControllerTests.cs`

## Schema / migration

Migration: `20261012210000_AddLmsReportNumberFoundation`

| Change | Detail |
| --- | --- |
| `lms_reports.business_report_number` | nullable `varchar(64)` |
| `lms_reports.business_report_number_assigned_at_utc` | nullable timestamptz |
| `lms_reports.business_report_number_assigned_by_user_id` | nullable uuid |
| Unique index | `(tenant_id, business_report_number)` WHERE not null |
| `lms_report_number_configurations` | operating-branch governed format config |
| `lms_report_number_sequences` | unique `(tenant_id, operating_branch_id, sequence_period_key)` |

No PDF/job/CanonicalDocument schema.

## API added

`POST /api/lms/reports/{id}/assign-number`

- Permission: `lms.reports.assign_number`
- Requires Released + null number + branch auth + RowVersion + Idempotency-Key
- Idempotency op: `assign_report_number`
- Audit: `ASSIGN_REPORT_NUMBER` (fail-closed)

`POST …/release` behavior unchanged (no number assignment).

## Permissions

| Code | Status |
| --- | --- |
| `lms.reports.assign_number` | Added to catalogue; **no role grants** |
| Existing report permissions | Unchanged |
| `lms.reports.generate` | Not added (CUT B) |

## Audit

| Action | Status |
| --- | --- |
| `ASSIGN_REPORT_NUMBER` | LaboratoryApi constant + AuthService allowlist |
| Fail-closed | Reverts assignment fields + RowVersion on audit failure |

## UI

- Report detail: show number when Released; Assign Report Number action when Released + unassigned + permission
- Worklist: Report Number column (Released + assigned only)
- Release copy remains metadata-only (no PDF/number auto-claim)

## Automated test results

| Suite | Result |
| --- | --- |
| `ReportNumberAssignTests` | **12 passed** |
| `ReportServiceTests` + shell + number filter | **45 passed** (includes Report Number + L-REP-01/02A/02B regression set in filter) |
| `enterprise-lms-reports-ui.test.ts` | **11 passed** |
| AuthService permission/audit tests | Source updated (`lms.reports.assign_number`, `ASSIGN_REPORT_NUMBER`). Rebuild/run blocked here by live `AuthService` process locking `AuthService.dll` — restart AuthService then re-run those two test classes |

## PostgreSQL concurrency evidence

**Passed (2/2)** against real Npgsql (not InMemory):

- `PostgreSQL_Concurrent_Assign_Distinct_Reports_Produces_Unique_Numbers` — 6 concurrent assigns on distinct Released reports → 6 distinct numbers
- `PostgreSQL_Concurrent_Assign_Same_Report_Succeeds_Exactly_Once` — 6 concurrent assigns on one report → exactly one success; others `concurrency_conflict` / `invalid_state` / `idempotency_conflict`

Mechanism: `INSERT … ON CONFLICT DO UPDATE … RETURNING` on `lms_report_number_sequences` + tenant unique index on `business_report_number`.

## Configuration prerequisites (still required for UAT/go-live)

No production defaults are seeded. Before Manual UAT of assignment in a real branch:

1. Insert active `lms_report_number_configurations` row for the operating branch (prefix, width, period, date segment, effective-from)
2. Grant `lms.reports.assign_number` to authorized staff via governed role administration (not seeded by this slice)
3. Ensure LaboratoryApi migrations applied

## Manual UAT checklist

1. Open Draft → no Assign Report Number action  
2. Open Final → no Assign Report Number action  
3. Open Released without number → Assign Report Number visible (with permission)  
4. Assign number → confirmation + success  
5. Number visible on detail  
6. Refresh → number persists  
7. Re-open → number unchanged  
8. Assign action absent after assignment  
9. Status remains Released  
10. Release metadata unchanged  
11. No PDF generation occurred  
12. No download action introduced  
13. Worklist shows number for Released+assigned  
14. Unauthorized user cannot assign  
15. Other operating branch denied  
16. Branch sequence behaves per configured test/prod config  
17. Retry/idempotency safe where practical  
18. Legacy Pathology unchanged  

## Known limitations

- Number format values are environment-configured; missing config → `503 report_number_configuration_missing`
- CUT B/C not started
- AuthService test rebuild may require stopping the local AuthService process if the EXE is locked

## Regression confirmation

- `ReleaseAsync` still only sets Status/ReleasedAtUtc/ReleasedByUserId/RowVersion + `RELEASE_REPORT`
- Finalize / Draft / source claims / snapshots unchanged by design
- No CanonicalDocument / PDF / download code paths added

---

```text
IMPLEMENTATION_COMPLETE
MANUAL_UAT_REQUIRED
CUT_A_ONLY
CUT_B_NOT_STARTED
CUT_C_NOT_STARTED
L_REP_02B_REMAINS_ACCEPTED
STOP_FOR_MANUAL_UAT
```
