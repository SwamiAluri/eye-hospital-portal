# L-REP-02B — Report Release Implementation

**Date:** 2026-10-12  
**Closure:** `PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED`  
**Status target:** `IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`

---

## Scope delivered

Final → Released (metadata only):

- `Report.Status = Released`
- `ReleasedAtUtc` / `ReleasedByUserId` (server UTC; authenticated actor)
- Current ReportVersion unchanged (no new version)
- Source claims retained unchanged
- ResultStatus / ResultVersion / CriticalResultEvent unchanged
- `POST /api/lms/reports/{id}/release`
- Permission `lms.reports.release` (endpoint enforcement; no role grants)
- Idempotency `release_report`
- Audit `RELEASE_REPORT` (fail-closed; AuthService allowlist)
- RowVersion concurrency (`expectedRowVersion`)
- Reports UI Release confirmation + Released metadata

**Not delivered:** PDF, document generation, CanonicalDocument association, business numbering, download, Patient Portal / Patient 360 publication, NotificationHub / SMS / email / WhatsApp, Amendments, Unrelease/Revoke, dual-control, signatory hierarchy, production role grants.

---

## Schema / migration

| Item | Detail |
| --- | --- |
| Migration | `20261012200000_AddLmsReportReleaseMetadata` |
| Columns | `lms_reports.released_at_utc`, `lms_reports.released_by_user_id` (nullable) |
| Backfill | None — existing Final reports remain Final |

---

## API

`POST /api/lms/reports/{reportId}/release`

Body: `operatingBranchId`, `idempotencyKey`, `expectedRowVersion`  
Auth: JWT + `lms.reports.release`  
Branch: `ValidateUserBranch` + Report.OperatingBranchId match  

Eligibility: `Status == Final` only. Draft → `invalid_state`. Already Released + new key → `invalid_state`.

---

## Authorization / idempotency / concurrency / audit

| Item | Behavior |
| --- | --- |
| Permission | `lms.reports.release` — no production role grants |
| Tenant | JWT tenant must own Report |
| Branch | ValidateUserBranch + Report.OperatingBranchId match |
| Idempotency | `release_report` via `lms_report_idempotency` |
| Concurrency | `expectedRowVersion`; stale → 409 `concurrency_conflict` |
| Audit | `RELEASE_REPORT` / `LmsReport` / platform `audit_log`; fail-closed revert to Final |

---

## UI

| Surface | Behavior |
| --- | --- |
| `ReportDetailView` | Release action when Status=Final + `lms.reports.release`; confirmation; Released by/at; no Release when Released |
| `ReportsWorkbench` | Lists Draft/Final/Released statuses; honesty text updated; no KPI/metrics |
| Explicitly absent | PDF, Download, Publish, Notify, Unrelease |

---

## Files changed (primary)

| Area | Files |
| --- | --- |
| Domain | `LmsReport.cs`, `ReportEnums.cs` |
| Data | `LaboratoryDbContext.cs`, migration `20261012200000_*` |
| Service/API | `ReportService.cs`, `ReportDtos.cs`, `ReportFunctions.cs`, `LaboratoryAuthz.cs` |
| Auth | `InternalAuditController.cs`, `EnterpriseLmsReportsPermissionCatalog.cs` description |
| FE | `lms-reports.api.ts`, `ReportDetailView.tsx`, `ReportsWorkbench.tsx`, `lms-capability-registry.ts` |
| Tests | `ReportServiceTests.cs`, `ReportPostgresConcurrencyTests.cs`, Auth allowlist tests, `enterprise-lms-reports-ui.test.ts` |
| Docs | implementation audit, this file, pre-UAT verification |

---

## Certified boundaries preserved

L-REP-01 Draft foundation, L-REP-02A Finalize (accepted), source-claim lifetime through Release, ResultStatus unchanged, no Pathology/CanonicalDocument/Notification side effects, no production role grants.
