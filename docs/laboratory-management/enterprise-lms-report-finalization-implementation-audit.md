# L-REP-02A — Report Finalization Implementation Audit

**Date:** 2026-10-12  
**Mode:** AUDIT BEFORE IMPLEMENTATION  
**Closure:** `PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED`  
**Scope:** Draft → Final metadata only (no Release/PDF/numbering)

---

## Certified L-REP-01 baseline

| Item | Status |
| --- | --- |
| `LmsReport` / `LmsReportVersion` / `LmsReportVersionSource` | Present |
| `LmsReportDraftSourceClaim` + unique `(tenant_id, result_version_id)` | Present |
| Draft create / list / get / append / eligible-sources | Present |
| Idempotency `create_report_draft` / `append_report_version` | Present |
| RowVersion concurrency token | Present |
| Platform audit CREATE/APPEND fail-closed | Present |
| Tenant + `ValidateUserBranch` | Present |
| `lms.reports.view` / `manage` / `finalize` / `release` / `download` catalogue | Present (no role grants) |
| Finalize mutation / Final metadata columns | **Absent** |
| Release / PDF / numbering | **Absent** (correct) |

**Verdict:** L-REP-01 remains certified. Proceed with minimal extension.

---

## A–P findings

| ID | Topic | Finding |
| --- | --- | --- |
| A | `LmsReport` schema | Status, CurrentVersionNumber, Created/Updated, RowVersion; **no** FinalizedAt/By |
| B | `LmsReportVersion` | Immutable sources; Append adds new version while Draft |
| C | CurrentVersionNumber | Points at latest version; Finalize freezes **this** number (PD-REP-02-02) |
| D | ReportStatuses | Draft, Final, Released constants; only Draft transitioned |
| E | AppendVersion | Rejects non-Draft (`invalid_state`) — already correct post-Final |
| F | Source claims | Persist; eligible-sources excludes claims; **keep after Final** |
| G | Idempotency | `lms_report_idempotency` + hash claim/complete/abandon |
| H | RowVersion | Concurrency token; Append uses ExpectedRowVersion |
| I | Tenant/branch | Report.TenantId + OperatingBranchId + ValidateUserBranch |
| J | Permissions | JWT `ForbidUnlessAsync`; Finalize constant unused |
| K | Audit | `IPlatformAuditClient.WriteAsync` fail-closed |
| L | Allowlist | AuthService `InternalAuditController` — CREATE/APPEND only; need `FINALIZE_REPORT` |
| M | UI | Workbench + Detail; honesty “Not Final…”; no Finalize action |
| N | Final/Released constants | Conceptual only |
| O | Existing finalization fields | **None** |
| P | Regression | Do not touch Result/Order/Specimen/Critical/Pathology |

---

## Schema decision

**Add nullable** `FinalizedAtUtc`, `FinalizedByUserId` on `lms_reports`.

**Do not add** `FinalizedVersionNumber`: `CurrentVersionNumber` + `Status=Final` unambiguously binds the frozen version (PD-REP-02-02). No new ReportVersion on Finalize.

---

## Minimal implementation plan

1. Migration for finalization columns  
2. `FinalizeAsync` on ReportService + DTO/API  
3. Idempotency op `finalize_report`; audit `FINALIZE_REPORT`  
4. Allowlist + Auth test  
5. FE finalize API + Detail confirmation UI  
6. Unit + PostgreSQL concurrency + FE tests  
7. PRE-UAT docs  

**Gate:** No CONFIGURATION_REQUIRED / PRODUCT_DECISION_REQUIRED blockers for L-REP-02A.
