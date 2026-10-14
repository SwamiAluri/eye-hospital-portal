# L-REP-02A — Report Finalization Implementation

**Date:** 2026-10-12  
**Closure:** `PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED`  
**Status target:** `IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`

---

## Scope delivered

Draft → Final (metadata only):

- `Report.Status = Final`
- `FinalizedAtUtc` / `FinalizedByUserId` (server UTC)
- Current ReportVersion unchanged (no new version)
- Append blocked after Final
- Source claims retained
- `POST /api/lms/reports/{id}/finalize`
- Permission `lms.reports.finalize`
- Idempotency `finalize_report`
- Audit `FINALIZE_REPORT` (fail-closed)
- RowVersion concurrency
- Reports UI Finalize confirmation + Final metadata

**Not delivered:** Release, PDF, numbering, download, publication, NotificationHub, Amendments, role grants.

---

## Schema / migration

| Item | Detail |
| --- | --- |
| Migration | `20261012190000_AddLmsReportFinalizationMetadata` |
| Columns | `lms_reports.finalized_at_utc`, `lms_reports.finalized_by_user_id` (nullable) |
| FinalizedVersionNumber | **Not added** — `CurrentVersionNumber` + Status=Final is unambiguous |

---

## API

`POST /api/lms/reports/{reportId}/finalize`

Body: `operatingBranchId`, `idempotencyKey`, `expectedRowVersion`  
Auth: JWT + `lms.reports.finalize`  
Branch: `ValidateUserBranch` + Report.OperatingBranchId match  

---

## Files changed (primary)

| Area | Files |
| --- | --- |
| Domain | `LmsReport.cs`, `ReportEnums.cs` |
| Data | `LaboratoryDbContext.cs`, migration `20261012190000_*` |
| Service/API | `ReportService.cs`, `ReportDtos.cs`, `ReportFunctions.cs`, `LaboratoryAuthz.cs` |
| Auth | `InternalAuditController.cs` allowlist, `EnterpriseLmsReportsPermissionCatalog.cs` descriptions |
| FE | `lms-reports.api.ts`, `ReportDetailView.tsx`, `ReportsWorkbench.tsx` |
| Tests | `ReportServiceTests.cs`, `ReportPostgresConcurrencyTests.cs`, Auth allowlist test, `enterprise-lms-reports-ui.test.ts` |
| Docs | implementation audit, this file, pre-UAT verification |

---

## Permissions / audit

| Item | Behavior |
| --- | --- |
| `lms.reports.finalize` | Enforced on Finalize endpoint; **no role grants** |
| `FINALIZE_REPORT` | Allowlisted; fail-closed revert to Draft |
| `RELEASE_REPORT` | Still absent |

---

## Known limitations

- Release not implemented (L-REP-02B)
- No PDF/download/numbering
- Finalize requires actor JWT to include `lms.reports.finalize` (ops assignment outside this slice)
- Workbench lists Draft and Final (no status filter)

---

## Certified boundaries preserved

L-REP-01 Draft foundation, source claims uniqueness, ResultStatus unchanged, no Pathology/CanonicalDocument/Notification side effects.
