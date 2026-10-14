# L-REP-02B — Report Release  
# Implementation Audit (pre-coding)

**Date:** 2026-10-12  
**Mode:** IMPLEMENTATION AUDIT — precedes coding  
**Product Decision Closure:** [enterprise-lms-report-release-decision-closure.md](./enterprise-lms-report-release-decision-closure.md)  
**Required stamp:** `PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED`  
**Authorized boundary:** Final → Released metadata only  

---

## 1. Gate checks

| Check | Result |
| --- | --- |
| Product Decision Closure stamp present | **YES** — `PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED` |
| `CONFIGURATION_REQUIRED` | **NO** (closure) |
| Product decision conflict vs repository | **NONE found** |
| Proceed to implement metadata Release | **YES** |

---

## 2. Confirmation matrix (A–H)

| ID | Requirement | Finding |
| --- | --- | --- |
| **A** | L-REP-02A remains accepted and unchanged | **PASS** — `ACCEPTED_L_REP_02A`; Finalize endpoint/service/UI present; this audit does not alter Finalize semantics |
| **B** | `Report.Status` supports Final and Released constants | **PASS** — `ReportStatuses.Draft`, `Final`, `Released` in `ReportEnums.cs`; Released never set |
| **C** | `ReleasedAtUtc` / `ReleasedByUserId` | **ABSENT** on entity, DbContext, schema (to be added) |
| **D** | Finalize pattern reusable | **PASS** — `FinalizeAsync` provides eligibility, RowVersion, `finalize_report` idempotency, fail-closed `FINALIZE_REPORT` audit + `RevertFinalizeAsync`, branch validation |
| **E** | `lms.reports.release` in permission catalogue | **PASS** — AuthService `EnterpriseLmsReportsPermissionCatalog.ReportsRelease`; LaboratoryApi `LaboratoryAuthz.ReportsRelease`; FE `LMS_REPORTS_PERMISSIONS.release` |
| **F** | `RELEASE_REPORT` allowlist | **ABSENT** — InternalAuditController has `FINALIZE_REPORT` only; tests assert `RELEASE_REPORT` not allowlisted |
| **G** | No Release endpoint before implementation | **PASS** — no `/release`, no `ReleaseAsync` on ReportService |
| **H** | No PDF/numbering/download/publication introduction | **PASS** — none present for LmsReport; out of scope remains binding |

---

## 3. Current repository map

| Area | Path / symbol | State |
| --- | --- | --- |
| Entity | `LaboratoryApi/Domain/LmsReport.cs` | Finalized* present; Released* absent |
| Status | `LaboratoryApi/Domain/ReportEnums.cs` | Released constant conceptual only |
| Idempotency ops | `ReportIdempotencyOperations` | `finalize_report` present; `release_report` absent |
| Audit actions | `ReportAuditActions` | `FINALIZE_REPORT` present; `RELEASE_REPORT` absent |
| Service | `ReportService.FinalizeAsync` | Certified pattern |
| API | `ReportFunctions` `POST lms/reports/{id}/finalize` | Present; no `/release` |
| DTOs | `FinalizeReportRequest`, detail/list DTOs | Finalized* fields; no Released* |
| Migration latest (reports) | `20261012190000_AddLmsReportFinalizationMetadata` | Next: `AddLmsReportReleaseMetadata` |
| FE API | `lms-reports.api.ts` `finalizeLmsReport` | No `releaseLmsReport` |
| FE UI | `ReportDetailView.tsx` | Finalize panel; honesty “Release not implemented” |
| FE workbench | `ReportsWorkbench.tsx` | Draft/Final listing; no Release action |
| Auth allowlist | `InternalAuditController` | Needs `RELEASE_REPORT` in implementation |
| Postgres concurrency | `ReportPostgresConcurrencyTests` | Concurrent Finalize exists; Release TBD |
| Unit tests | `ReportServiceTests` | Finalize coverage; Release TBD |

---

## 4. Reuse plan

Mirror Finalize:

1. Schema columns `released_at_utc` / `released_by_user_id`  
2. `ReleaseAsync` + `RevertReleaseAsync` (revert to Final + clear Released*)  
3. Idempotency operation `release_report` via existing `lms_report_idempotency`  
4. Audit `RELEASE_REPORT` / `LmsReport` fail-closed  
5. `POST …/release` + `lms.reports.release`  
6. UI Release confirmation panel for Final only  
7. Tests + PostgreSQL concurrent Release  

---

## 5. Explicit non-findings

- No signatory / release-authority SoT required (Option A)  
- No dual-control config required  
- No business number / PDF / CanonicalDocument / publication dependency for metadata Release  
- Collection `ReleaseAsync` is unrelated (collection task claim release)  

---

## 6. Audit stamp

```text
IMPLEMENTATION_AUDIT_COMPLETE_READY_TO_CODE
PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED
CONFIGURATION_REQUIRED = NO
PRODUCT_DECISION_CONFLICT = NO
```
