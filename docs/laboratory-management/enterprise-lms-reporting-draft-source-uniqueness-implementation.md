# L-REP-01 — Draft Report Source Uniqueness Implementation

**Date:** 2026-10-12  
**Product decision:** PD-REP-DRAFT-UNIQUE-01  
**Status target:** `DRAFT_REPORT_SOURCE_UNIQUENESS_CORRECTION_COMPLETE_READY_FOR_PRE_UAT`

---

## 1. Confirmed defect

Manual UAT created multiple Draft Reports from the same ClinicallyAuthorized ResultVersion (same Order, ResultVersionNumber, ResultVersionId). Idempotency did not prevent this because each create used a distinct idempotency key.

---

## 2. Uniqueness boundary

A specific ResultVersion (`ResultVersionId` within tenant) may belong to **at most one active Draft Report**.

Preserved:

- Multi-result composition → one Draft Report with N sources  
- Same-order / same-patient reporting context  
- Immutable ReportVersion snapshots  
- Append of a new ReportVersion on the **same** Draft may re-snapshot the same ResultVersion  

Not defined: Final/Released/amendment/supersession.

---

## 3. Database enforcement

New table `lms_report_draft_source_claims`:

- Unique `(tenant_id, result_version_id)`
- FK to `lms_reports` and `lms_result_versions`
- Migration `20261012180000_AddLmsReportDraftSourceClaims`
- Non-destructive backfill: `DISTINCT ON (tenant_id, result_version_id)` oldest Draft wins; duplicate UAT Drafts are not deleted

Race safety: concurrent creates compete on the unique index; loser → `409 report_source_already_in_draft`.

---

## 4. API behavior

| Operation | Behavior |
| --- | --- |
| `POST /lms/reports` | Stages claims + Report in one SaveChanges; conflict → 409 `report_source_already_in_draft`; no successful CREATE_REPORT_DRAFT audit on conflict |
| `POST .../versions` (append) | Claims new ResultVersions for the same Report; foreign claim → 409 |
| `GET .../eligible-sources` | Excludes ResultVersions that already have a draft claim |
| Idempotency | Unchanged for same key+hash replay and key hash conflict; different keys + same ResultVersion → uniqueness 409 |

Audit fail-closed revert removes claims with the Report.

---

## 5. UI behavior

`ReportsWorkbench`:

- Relies on eligible-sources exclusion (used ResultVersion not selectable)
- Reloads eligible after successful create
- On `report_source_already_in_draft`, shows honest refresh message and reloads eligibility

---

## 6. Files changed

| File | Role |
| --- | --- |
| `Domain/LmsReportDraftSourceClaim.cs` | Claim entity |
| `Data/LaboratoryDbContext.cs` | DbSet + mapping |
| `Migrations/20261012180000_AddLmsReportDraftSourceClaims.cs` | Table, unique, backfill |
| `Services/ReportService.cs` | Claim enforce, eligible exclude, revert |
| `ReportServiceTests.cs` | Uniqueness / eligible / append / audit |
| `ReportPostgresConcurrencyTests.cs` | Real PG concurrency |
| `LaboratoryDbContextShellTests.cs` | Entity count 31 |
| `ReportsWorkbench.tsx` | 409 + reload eligible |
| `enterprise-lms-reports-ui.test.ts` | FE contract |
| `enterprise-lms-l0-foundation.test.ts` | Implemented capability list sync |
| Docs | audit / implementation / pre-UAT |

---

## 7. Explicit non-changes

No Finalize/Release/PDF/publication/numbering/signatory. No ResultStatus changes. No L-AUTH/L-VER/L-TST/L-CRT/Orders/Collection/Specimen changes. No new permissions or role grants. No Pathology / CanonicalDocument SoT change. No destructive cleanup of UAT duplicate Drafts.
