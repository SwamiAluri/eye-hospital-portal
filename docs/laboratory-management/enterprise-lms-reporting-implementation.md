# L-REP-01 — Report Foundation  
# Implementation Record

**Date:** 2026-10-12  
**Authorization:** `PRODUCT_DECISIONS_CLOSED_L_REP_01_AUTHORIZED`  
**Closure:** [enterprise-lms-reporting-decision-closure.md](./enterprise-lms-reporting-decision-closure.md)  
**Audit:** [enterprise-lms-reporting-implementation-audit.md](./enterprise-lms-reporting-implementation-audit.md)  
**Configuration gate:** `CONFIGURATION_GATE_PASSED_DRAFT_FOUNDATION`

---

## 1. Summary

Implemented Enterprise LMS **Draft Report Foundation** in LaboratoryApi:

- `LmsReport` / `LmsReportVersion` / `LmsReportVersionSource`
- Exact ResultVersion binding + immutable structured snapshots
- Draft create / list / detail / append-version
- Eligible ClinicallyAuthorized sources API
- Platform audit fail-closed
- Report idempotency + RowVersion concurrency
- Permission catalogue seed (no role grants)
- LMS Reports UI worklist + detail + explicit create

**Not implemented:** Finalize, Release, PDF, CanonicalDocument attach, patient publication, Amendments, Pathology bridge, ResultStatus changes, production role grants.

---

## 2. Schema

| Table | Purpose |
|---|---|
| `lms_reports` | Report aggregate (Draft status, tenant, branch, patient, order, RowVersion) |
| `lms_report_versions` | Immutable version rows |
| `lms_report_version_sources` | Exact ResultId + ResultVersionId + ResultVersionNumber + snapshot fields |
| `lms_report_idempotency` | create_report_draft / append_report_version |

**Migration:** `20261012160000_AddLmsReportFoundation`

---

## 3. APIs (`/api/lms/reports`)

| Method | Route | Permission |
|---|---|---|
| GET | `/lms/reports/eligible-sources` | view/manage |
| GET | `/lms/reports` | view/manage |
| POST | `/lms/reports` | manage |
| GET | `/lms/reports/{id}` | view/manage |
| GET | `/lms/reports/{id}/versions/{versionNumber}` | view/manage |
| POST | `/lms/reports/{id}/versions` | manage (append Draft version; RowVersion) |

---

## 4. Permissions (catalogue only)

Seeded: `lms.reports.view|manage|finalize|release|download`  
**No role grants.** Finalize/Release/Download are catalogue-only (not implemented).  
**No** `lms.reports.publish`.

---

## 5. Audit

Actions: `CREATE_REPORT_DRAFT`, `APPEND_REPORT_VERSION`  
Resources: `LmsReport`, `LmsReportVersion`  
Fail-closed on audit failure (503 `audit_unavailable` + revert).

---

## 6. UI

| Route | Behavior |
|---|---|
| `/dashboard/lms/reports` | Draft worklist + explicit create from eligible sources |
| `/dashboard/lms/reports/[id]?operatingBranchId=` | Version history + snapshot preview |

Capability `reports` → `implemented` (foundation copy; not release-capable).

---

## 7. Exclusions confirmed

No Finalize/Release APIs · no PDF · no CanonicalDocument attach · no patient publication · no ResultStatus Final/Released/Published · no L-AUTH/L-VER/L-TST/L-CRT mutation · no Pathology dual-write · no role grants · no auto-create on authorize.
