# L-REP-03 CUT A — Report Number Foundation  
# PRE-UAT Environment Readiness

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT A — Report Number Foundation  
**Mode:** Environment readiness only — no product/feature implementation  
**Implementation report:** [enterprise-lms-report-number-foundation-implementation-report.md](./enterprise-lms-report-number-foundation-implementation-report.md)

**PRE-UAT status:** `READY_FOR_MANUAL_UAT`

**MANUAL UAT NOT EXECUTED.**  
**ACCEPTANCE CLOSURE NOT CREATED.**  
**CUT B / CUT C NOT STARTED.**

---

## Scope of this document

Prepare and verify the local/UAT environment so CUT A can undergo Manual UAT.

This document does **not** claim Manual UAT passed.

---

## 1. AuthService test result

AuthService process locking `AuthService.dll` was stopped, then the two previously blocked test classes were executed.

**Command:**

```text
dotnet test "microservices/auth-service/AuthService.Tests/AuthService.Tests.csproj" --filter "FullyQualifiedName~EnterpriseLmsReportsPermissionTests|FullyQualifiedName~InternalAuditControllerTests"
```

| Metric | Result |
| --- | --- |
| Total | **24** |
| Passed | **24** |
| Failed | **0** |
| Skipped | **0** |
| Process/runtime blocker remaining | **None** (AuthService restarted on `:5073` after tests) |

Classes covered: `EnterpriseLmsReportsPermissionTests`, `InternalAuditControllerTests` (includes `lms.reports.assign_number` catalogue + `ASSIGN_REPORT_NUMBER` audit allowlist expectations).

No source changes were made to force a pass.

---

## 2. Migration verification

Target UAT database (same Azure Postgres `hospitalportal` used by LaboratoryApi `local.settings.json` DefaultConnection and browser UAT):

| Check | Result |
| --- | --- |
| Migration `20261012210000_AddLmsReportNumberFoundation` in `__EFMigrationsHistory` | **Present** |
| `lms_reports.business_report_number` | **Present** |
| `lms_reports.business_report_number_assigned_at_utc` | **Present** |
| `lms_reports.business_report_number_assigned_by_user_id` | **Present** |
| Table `lms_report_number_configurations` | **Present** |
| Table `lms_report_number_sequences` | **Present** |
| Unique tenant/business-report-number index | **Present** — `IX_lms_reports_tenant_id_business_report_number` UNIQUE on `(tenant_id, business_report_number)` WHERE `business_report_number IS NOT NULL` |

No duplicate/manual schema outside the migration path.

---

## 3. UAT configuration verification

CUT A seeds **no** production format defaults. A clearly identifiable UAT/test configuration row was inserted into the UAT database for the existing LMS Reports operating branch (idempotent insert; not a production default).

| Field | UAT value |
| --- | --- |
| Config id | `a1111111-1111-4111-8111-111111111111` |
| Format code | `UAT_RPT_UTC_DAY` |
| Prefix | `UAT-RPT` |
| Separator | `-` |
| Sequence width | `6` |
| Sequence period / reset | `UTC_DAY` |
| Date segment | `YYYYMMDD` |
| Date timezone | `UTC` |
| Operating branch | `74c014cf-9570-4824-bdf9-b369ea11a8f4` |
| Tenant | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Effective from (UTC) | `2000-01-01 00:00:00+00` |
| Active | `true` |
| Created by user id | `dddddddd-dddd-dddd-dddd-dddddddddddd` (`admin@test.com`) |

Secrets (DB password, JWT keys, internal API keys) are not recorded here.

---

## 4. Permission verification

| Check | Result |
| --- | --- |
| Catalogue permission `lms.reports.assign_number` | **Present** and active (`Assign LMS Report Number`) |
| Role grants added in source / production seed | **None** (CUT A catalogue-only; unchanged) |
| Authorized UAT actor | `admin@test.com` (`dddddddd-…`) — platform Admin → JWT permissions `*` (includes assign) |
| Unauthorized control actor | `labmgr1@hospital.com` — JWT does **not** include `lms.reports.assign_number` (21 other permissions) |

No production role grants were added. No unrelated roles were modified.

---

## 5. Runtime service verification

| Service | Status | UAT wiring |
| --- | --- | --- |
| AuthService | **Running** `http://localhost:5073` | Login succeeds for Admin and Lab Manager against tenant `155fe198-…` |
| LaboratoryApi | **Running** `http://localhost:7076` | `local.settings.json` DefaultConnection → Azure Postgres `hospitalportal`; `AuthService__BaseUrl` → `http://localhost:5073` |
| LMS frontend env | **Configured** | `NEXT_PUBLIC_API_URL=http://localhost:5073/api`; `NEXT_PUBLIC_LABORATORY_API_URL=http://localhost:7076/api` |
| Authentication | **Works** | Admin login returns `*` + `branchId=74c014cf-…` |
| Branch context | **Resolves** | Admin primary `BranchId` matches report operating branch; Lab GET report with `operatingBranchId` returns **200** |

Note: LaboratoryApi was restarted during readiness so `LmsReportAssignNumber` is registered (stale host previously returned 404 for assign-number).

---

## 6. API route verification

Function registered after restart:

```text
LmsReportAssignNumber: [POST] http://localhost:7076/api/lms/reports/{id:guid}/assign-number
```

Smoke against Released report `a34fdfdc-5e21-4684-a436-4d192ecc96be` (number still **null**, `row_version=3` — left unassigned for Manual UAT):

| Scenario | HTTP | Observation |
| --- | --- | --- |
| No token | **401** | Missing/malformed Authorization |
| Unauthorized user (`labmgr1@hospital.com`) | **403** | Missing permission `lms.reports.assign_number` |
| Authorized user + wrong `operatingBranchId` | **403** | Branch unauthorized (Auth validate path) |
| Authorized user + correct branch + deliberately wrong `expectedRowVersion` | **409** | `concurrency_conflict` — proves handler + authz + service entry without assigning a number |

No successful Assign Number mutation was performed for Manual UAT (business assign reserved for UI UAT).

---

## 7. Existing CUT A test baseline

Reconfirmed after environment work:

| Suite | Command / filter | Result |
| --- | --- | --- |
| `ReportNumberAssignTests` | `--filter FullyQualifiedName~ReportNumberAssignTests` | **12 passed** / 0 failed / 0 skipped |
| ReportService + shell + number regression filter | `--filter FullyQualifiedName~ReportServiceTests\|FullyQualifiedName~LaboratoryDbContextShellTests\|FullyQualifiedName~ReportNumber` | **45 passed** / 0 failed / 0 skipped |
| `enterprise-lms-reports-ui.test.ts` | `npx vitest run src/lib/lms/enterprise-lms-reports-ui.test.ts` | **11 passed** |
| PostgreSQL concurrency | `--filter FullyQualifiedName~ReportNumberPostgresConcurrencyTests` | **2/2 passed** |

---

## 8. Blockers

| Item | Status |
| --- | --- |
| AuthService.dll lock for tests | **Resolved** (process stopped for test run; Auth restarted) |
| Stale LaboratoryApi without assign-number route | **Resolved** (restarted; route mapped) |
| Missing UAT report-number configuration | **Resolved** (UAT-tagged config row active) |
| Remaining environment blockers for Manual UAT | **None identified** |

---

## 9. Manual UAT readiness status

```text
READY_FOR_MANUAL_UAT
```

Suggested Manual UAT actors / fixtures (environment only):

| Role | Identity | Notes |
| --- | --- | --- |
| Authorized | `admin@test.com` | Admin `*`; branch `74c014cf-…` |
| Unauthorized | `labmgr1@hospital.com` | Same branch; no `lms.reports.assign_number` |
| Released unnumbered report | `a34fdfdc-5e21-4684-a436-4d192ecc96be` | Still unassigned after readiness smoke |
| UAT number config | `UAT_RPT_UTC_DAY` / prefix `UAT-RPT` | Branch `74c014cf-…` |

Out of scope remains: CUT B/C, PDF/QuestPDF, download, `lms.reports.generate`, `ReleaseAsync` changes, automatic numbering, patient publication, amendments, production role grants, Pathology.

---

```text
READY_FOR_MANUAL_UAT
CUT_A_ONLY
CUT_B_NOT_STARTED
CUT_C_NOT_STARTED
MANUAL_UAT_NOT_EXECUTED
L_REP_02B_REMAINS_ACCEPTED
STOP_FOR_MANUAL_UAT
```
