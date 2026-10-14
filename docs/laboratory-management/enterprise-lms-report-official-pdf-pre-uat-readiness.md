# L-REP-03 CUT B / B1 — Official PDF / Report Artifact Foundation  
# PRE-UAT Environment Readiness

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT B / B1 — Official PDF / Report Artifact Foundation  
**Mode:** Environment readiness only — no product/feature implementation beyond operational UAT setup  
**Implementation report:** [enterprise-lms-report-official-pdf-implementation-report.md](./enterprise-lms-report-official-pdf-implementation-report.md)  
**Product Decision Closure:** [enterprise-lms-report-official-pdf-decision-closure.md](./enterprise-lms-report-official-pdf-decision-closure.md)

**PRE-UAT status:** `READY_FOR_MANUAL_UAT`

**MANUAL UAT NOT EXECUTED.**  
**ACCEPTANCE CLOSURE NOT CREATED.**  
**CUT C NOT STARTED.**

---

## Scope of this document

Prepare and verify the local/UAT environment so CUT B / B1 can undergo Manual UAT.

This document does **not** claim Manual UAT passed.

The Lab Manager → `lms.reports.generate` grant below is **operational UAT test setup only**. It is **not** a production role-grant change in source seeders. Implementation remains catalogue-only for production grants.

---

## 1. Migration verification

Target UAT database (same Azure Postgres `hospitalportal` used by LaboratoryApi `local.settings.json` DefaultConnection and browser UAT):

| Check | Result |
| --- | --- |
| Migration `20261012220000_AddLmsReportOfficialPdfFoundation` in `__EFMigrationsHistory` | **Present** |
| `lms_reports.current_official_artifact_id` | **Present** |
| Table `lms_report_pdf_template_versions` | **Present** |
| Table `lms_report_pdf_signatories` | **Present** |
| Table `lms_report_official_pdf_jobs` | **Present** |
| Table `lms_report_official_pdf_artifacts` | **Present** |
| Filtered unique index one-active job | **Present** (migration applied) |

`dotnet ef database update` reported database already up to date; history row confirmed.

---

## 2. Official PDF template (UAT)

Idempotent UAT configuration row (not a production default seed):

| Field | UAT value |
| --- | --- |
| Template id | `b2222222-2222-4222-8222-222222222222` |
| Template code | `UAT_OFFICIAL_PDF_V1` |
| Version | `1` |
| Hospital / laboratory name | `India Eye Hospital Network — Downtown Hospital Laboratory` |
| Logo | PNG (`image/png`), 752 bytes, active |
| Tenant | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Effective from (UTC) | `2000-01-01 00:00:00+00` |
| Active / locked | `true` / `false` |
| Created by | `dddddddd-…` (`admin@test.com`) |

Name is composed from existing tenant (`India Eye Hospital Network`) and operating branch (`Downtown Hospital`). Logo is a governed UAT PNG asset for that hospital/lab identity (not a silent generic default in code).

---

## 3. Laboratory signatory (UAT)

| Field | UAT value |
| --- | --- |
| Signatory id | `b3333333-3333-4333-8333-333333333333` |
| Name | `Joseph Lopez` |
| Credentials text | `Laboratory Manager` |
| Source | Existing UAT user `labmgr1@hospital.com` / Lab Manager role |
| Tenant | `155fe198-…` |
| Active | `true` |

No invented pathologist identity was fabricated. No signature image.

---

## 4. Operating branch + Report Number configuration

| Check | Result |
| --- | --- |
| Operating branch | `74c014cf-9570-4824-bdf9-b369ea11a8f4` — **Downtown Hospital** |
| Report Number config | `a1111111-…` / `UAT_RPT_UTC_DAY` / prefix `UAT-RPT` — **active** |
| Tenant match | `155fe198-…` |

Unchanged from CUT A PRE-UAT readiness.

---

## 5. Permission — operational UAT grant

| Check | Result |
| --- | --- |
| Catalogue permission `lms.reports.generate` | **Present** (`Generate LMS Official PDF`, id `e696ef8e-…`) |
| Production / source seeder role grants | **None** (implementation unchanged) |
| Operational UAT grant | **Lab Manager** role (`deb7dae5-…`) → `lms.reports.generate` (`role_permission` id `b4444444-…`) |
| Authorized UAT actors | `labmgr1@hospital.com`, `labmgr2@hospital.com` (Lab Manager); also `admin@test.com` via Admin JWT `*` |
| Unauthorized control actor | `labtech1@hospital.com` (Lab Technician — **no** generate grant) |

Re-login is required after the grant so JWT permission lists refresh.

---

## 6. AuthService internal-key / CanonicalDocument

| Check | Result |
| --- | --- |
| AuthService listening | `http://localhost:5073` |
| LaboratoryApi `AuthService__BaseUrl` | `http://localhost:5073` |
| Internal key configured (Lab + Auth `InternalApi:Key`) | **Match** (value not recorded) |
| `POST /api/internal/canonical-documents/register-lms-official-pdf` wrong key | **401** |
| Same endpoint correct key + incomplete/mismatched payload | Reaches handler (**400** business validation) — connectivity confirmed |
| Association domain | `enterprise_lms` / `LmsReportOfficialPdfArtifact` (not Pathology) |

Secrets are not recorded here.

---

## 7. Timer host

| Check | Result |
| --- | --- |
| LaboratoryApi Functions host | **Running** `http://localhost:7076` |
| Health | `GET /api/lms/health` → **200** |
| Registered functions | `LmsReportOfficialPdfGenerate`, `LmsReportOfficialPdfJobGet`, `LmsOfficialPdfJobDrain` |
| Timer schedule | `*/15 * * * * *` (technical mechanic) |

Host was rebuilt/synced so Official PDF functions (absent from the prior stale `bin/output`) are loaded.

---

## 8. Suggested Manual UAT actors / fixtures

| Role | Identity | Notes |
| --- | --- | --- |
| Authorized (explicit grant) | `labmgr1@hospital.com` | Lab Manager + operational `lms.reports.generate` |
| Authorized (wildcard) | `admin@test.com` | Admin `*` |
| Unauthorized | `labtech1@hospital.com` | No generate grant |
| Branch | `74c014cf-…` Downtown Hospital | Required on generate |
| Template / signatory | `UAT_OFFICIAL_PDF_V1` / Joseph Lopez | Active |

Use Manual UAT checklist in the implementation report §16. Do **not** claim UAT passed from this readiness work.

---

## 9. Blockers

| Item | Status |
| --- | --- |
| Missing PDF migration | **Resolved** |
| Missing template / signatory rows | **Resolved** |
| Missing generate permission for UAT Lab Manager | **Resolved** (operational DB grant only) |
| Stale LaboratoryApi without Official PDF / Timer | **Resolved** (rebuild + host restart) |
| Auth internal-key connectivity | **Confirmed** |
| Remaining environment blockers for Manual UAT | **None identified** |

---

## 10. Stamps

```text
READY_FOR_MANUAL_UAT

CUT_B_IMPLEMENTATION_COMPLETE
CUT_C_NOT_STARTED

CONFIGURATION_REQUIRED_SATISFIED_FOR_UAT = YES
PRODUCTION_ROLE_GRANTS_IN_SOURCE = NONE
OPERATIONAL_UAT_ROLE_GRANT = Lab Manager → lms.reports.generate

MANUAL_UAT_NOT_EXECUTED
ACCEPTANCE_NOT_CLAIMED

NEXT_GATE = MANUAL_UAT

STOP
```
