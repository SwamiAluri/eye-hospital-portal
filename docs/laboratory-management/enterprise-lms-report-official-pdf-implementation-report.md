# L-REP-03 CUT B / B1 — Official PDF / Report Artifact Foundation  
# Implementation Report

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT B / B1 — Official PDF / Report Artifact Foundation  
**Mode:** IMPLEMENTATION COMPLETE (automated tests) — Manual UAT not performed  

**References**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-official-pdf-decision-closure.md](./enterprise-lms-report-official-pdf-decision-closure.md) | Binding PD-PDF-* (`PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED`) |
| [enterprise-lms-report-official-pdf-readiness-audit.md](./enterprise-lms-report-official-pdf-readiness-audit.md) | Implementation planning baseline (`READY_WITH_PREREQUISITES`) |

```text
CUT_B_IMPLEMENTATION_COMPLETE
UAT_PASSED = NO
ACCEPTED = NO
ACCEPTANCE_COMPLETE = NO
CUT_C_NOT_STARTED
CONFIGURATION_REQUIRED = YES
NEXT_GATE = MANUAL_UAT
```

---

## 1. Scope

Implemented the approved B1 boundary:

- Governed PDF template + laboratory signatory configuration foundation  
- LaboratoryApi-owned Official PDF jobs + Azure Timer drain (no Service Bus)  
- LaboratoryApi-owned QuestPDF renderer  
- Immutable artifact versions + `LmsReport.CurrentOfficialArtifactId` pointer  
- LMS-specific CanonicalDocument association (`enterprise_lms` / `LmsReportOfficialPdfArtifact`)  
- Generate API + idempotency `generate_official_pdf` + one-active-job concurrency  
- Audit request / success / failure (fail-closed allowlist)  
- Catalogue permission `lms.reports.generate` (no role grants)  
- Report detail UI: Generate + status + metadata (no download)  
- Automated tests  

**Not implemented (explicitly out of scope):** staff download, patient publication/download, notifications, Amendments/Unrelease/Revoke, Release/Number/Result lifecycle changes, Pathology dual-write, Service Bus, production role grants, retention enforcement, B0 ReportVersion enrichment, automatic generate on Release/Number/Final/Authorize.

---

## 2. Files changed (primary)

### LaboratoryApi

| Area | Path |
| --- | --- |
| Domain | `Domain/LmsReportOfficialPdf.cs`, `Domain/LmsReport.cs` (pointer), `Domain/ReportEnums.cs` |
| DbContext | `Data/LaboratoryDbContext.cs` |
| Migration | `Migrations/20261012220000_AddLmsReportOfficialPdfFoundation.cs` |
| Services | `Services/OfficialPdfService.cs`, `OfficialPdfRenderer.cs`, `OfficialPdfDtos.cs`, `PlatformCanonicalDocumentClient.cs`, `ReportService.cs` (detail enrichment), `ReportDtos.cs`, `LaboratoryAuthz.cs` |
| Functions | `Functions/OfficialPdfFunctions.cs`, `Functions/OfficialPdfTimerFunction.cs` |
| Host | `Program.cs`, `LaboratoryApi.csproj` (QuestPDF 2026.2.1, Timer 4.3.0) |
| Tests | `LaboratoryApi.Tests/OfficialPdfServiceTests.cs`, `OfficialPdfPostgresConcurrencyTests.cs`, `LaboratoryDbContextShellTests.cs` |

### AuthService

| Area | Path |
| --- | --- |
| Association constants | `Models/Domain/CanonicalDocument.cs` (`enterprise_lms` / `LmsReportOfficialPdfArtifact`) |
| Internal API | `Controllers/InternalCanonicalDocumentController.cs` (`register-lms-official-pdf`) |
| Audit allowlist | `Controllers/InternalAuditController.cs` |
| Permission catalogue | `SeedData/EnterpriseLmsReportsPermissionCatalog.cs` |
| Tests | `EnterpriseLmsReportsPermissionTests.cs`, `InternalAuditControllerTests.cs`, `InternalCanonicalDocumentControllerTests.cs` |

### Frontend

| Area | Path |
| --- | --- |
| Permissions | `apps/hospital-portal-web/src/lib/lms/lms-permissions.ts` |
| API client | `apps/hospital-portal-web/src/lib/lms/lms-reports.api.ts` |
| Report detail | `apps/hospital-portal-web/src/components/lms/reports/ReportDetailView.tsx` |
| UI contract tests | `apps/hospital-portal-web/src/lib/lms/enterprise-lms-reports-ui.test.ts` |

---

## 3. Migrations

| Migration | Purpose |
| --- | --- |
| `20261012220000_AddLmsReportOfficialPdfFoundation` | Template versions, signatories, jobs, artifacts, `current_official_artifact_id`, filtered unique index `IX_lms_report_official_pdf_jobs_one_active` |

No production configuration rows are seeded.

---

## 4. APIs

| Method | Route | Permission |
| --- | --- | --- |
| POST | `/api/lms/reports/{id}/official-pdf/generate` | `lms.reports.generate` |
| GET | `/api/lms/reports/{id}/official-pdf/jobs/{jobId}?operatingBranchId=` | view/manage/generate |
| Timer | `LmsOfficialPdfJobDrain` (`*/15 * * * * *`) | N/A (internal) |

Internal Auth:

| Method | Route |
| --- | --- |
| POST | `/api/internal/canonical-documents/register-lms-official-pdf` |

Generate is asynchronous: accepts request → Pending job → Timer drain → Running → Succeeded/Failed.  
No download / SAS / raw byte endpoints.

---

## 5. Permissions

| Code | Change |
| --- | --- |
| `lms.reports.generate` | Added to catalogue + `LaboratoryAuthz` + FE constants |

**No production role grants** were added.

---

## 6. Audit actions

| Action | When |
| --- | --- |
| `REQUEST_OFFICIAL_PDF` | Generate accepted (fail-closed) |
| `OFFICIAL_PDF_GENERATED` | Successful generation (fail-closed; success audit failure reverts current pointer) |
| `OFFICIAL_PDF_FAILED` | Failed generation / stale Running |

Allowlisted in `InternalAuditController.AllowedActions`. Download audit not added (CUT C).

---

## 7. Configuration model

| Entity | Table | Notes |
| --- | --- | --- |
| `LmsReportPdfTemplateVersion` | `lms_report_pdf_template_versions` | Tenant + template code + version; hospital/lab name; logo bytes; `IsLocked` after first successful use |
| `LmsReportPdfSignatory` | `lms_report_pdf_signatories` | Tenant; name; credentials text; active/effective |

Missing configuration → `409` with `pdf_template_configuration_missing` / `pdf_signatory_configuration_missing`.  
No invented hospital/lab/signatory defaults.

---

## 8. Job model

| Field / rule | Value |
| --- | --- |
| Statuses | Pending → Running → Succeeded / Failed |
| Ownership | LaboratoryApi table + Azure Timer drain |
| Concurrency | Filtered unique index: one Pending/Running per (tenant, report) |
| Technical stale Running TTL | 15 minutes → Failed (`stale_running`) — implementation mechanic, not a product decision |
| Max attempts constant | 3 (documented; drain currently processes Pending once per request path) |

---

## 9. Artifact model

| Rule | Implementation |
| --- | --- |
| Versions start at 1 | Yes |
| Immutable historical versions | Yes |
| Current pointer on `LmsReport` | `CurrentOfficialArtifactId` |
| Pointer updates | Only on Succeeded |
| Failed never current | Yes |
| Metadata | MIME, size, hash, CanonicalDocumentId, template version, artifact version, generated by/at, status, failure metadata |

---

## 10. PDF renderer

- LaboratoryApi-owned QuestPDF (`OfficialPdfRenderer`)  
- AuthService QuestPDF used as technology reference only  
- Content: hospital/lab name + logo, Business Report Number, MRN, patient name, exact CatalogueVersion test identity/name, result/unit/comment, SpecimenId, Authorized By, configured signatory  
- No DOB, ranges, interpretation, diagnosis, barcode, collection/receiving times  

---

## 11. CanonicalDocument / Blob

- Private Blob via Auth `ResolveOrCreateAsync`  
- Association: `enterprise_lms` / `LmsReportOfficialPdfArtifact`  
- **Never** Pathology `lab` / `LabReport`  
- LaboratoryApi remains artifact SoT; CanonicalDocument is downstream storage  

---

## 12. UI changes

Report detail (`/dashboard/lms/reports/[id]`):

- Generate Official PDF (permission + Released + number)  
- Generation status / timestamps  
- Artifact metadata  
- Bounded polling while Pending/Running (3s, max ~40 ticks)  
- **No** download button  
- **No** worklist PDF status  

---

## 13. Automated tests — results

| Suite | Result |
| --- | --- |
| LaboratoryApi OfficialPdf + Report regression filter | **Passed 56** (0 failed) |
| AuthService permission / audit / LMS CanonicalDocument filter | **Passed** (catalogue, allowlist, `RegisterLmsOfficialPdf_UsesEnterpriseLmsAssociation_NotPathologyLabReport`) |
| Frontend `enterprise-lms-reports-ui.test.ts` | **Passed 12** (0 failed) |

Coverage includes: missing config, Draft/Final denied, Released without number denied, wrong branch, generate→drain success, invariants, idempotency replay/conflict, one active job, failed preserves previous current, version increment, exact CatalogueVersion (not decoy current), PDF content via PdfPig, association ≠ Pathology, PG one-active uniqueness (requires `LABORATORY_TEST_CONNECTION`).

---

## 14. Known limitations

1. Governed configuration rows must be inserted for UAT/go-live (no seeded production values).  
2. Logo is stored as governed `bytea` on template version (no separate branding CMS).  
3. Timer schedule (`*/15 * * * * *`) and stale Running TTL (15 min) are technical mechanics.  
4. Success-audit failure after storage registration reverts the current pointer and marks job Failed (fail-closed); orphan CanonicalDocument bytes may remain (platform pattern — no distributed transaction).  
5. Staff download remains CUT C.  

---

## 15. UAT prerequisites

Before Manual UAT:

1. Apply LaboratoryApi migration `20261012220000_AddLmsReportOfficialPdfFoundation`  
2. Insert tenant Official PDF template version (name + logo bytes + mime + active)  
3. Insert tenant laboratory signatory (name + credentials text + active)  
4. Ensure operating branch context and Report Number config remain valid  
5. Grant `lms.reports.generate` to UAT actors via controlled role assignment (not part of this implementation)  
6. AuthService internal key + LaboratoryApi → AuthService connectivity for CanonicalDocument registration  
7. Timer function host running so Pending jobs drain  

---

## 16. Manual UAT checklist

1. Draft cannot generate  
2. Final cannot generate  
3. Released without number cannot generate  
4. Released + numbered + permission can generate  
5. Generate creates Pending/Running job  
6. Running transitions correctly  
7. Success produces artifact metadata  
8. PDF includes approved fields  
9. PDF includes Business Report Number  
10. PDF does not include unapproved clinical content  
11. Report remains Released  
12. Business Report Number unchanged  
13. ReportVersion unchanged  
14. Failure preserves previous current artifact  
15. Retry works  
16. Same idempotency request replays  
17. Concurrent request returns existing job  
18. Unauthorized actor denied  
19. Wrong branch denied  
20. No download exists  
21. No patient publication exists  
22. No notification exists  
23. Pathology remains untouched  

---

## 17. Explicit out-of-scope confirmation

This implementation does **not** claim or deliver:

- Manual UAT passed / Acceptance complete / Production ready  
- Staff download / Patient download / Patient publication  
- NotificationHub integration  
- Retention enforcement  
- Production role grants  
- Pathology migration or dual-write  
- CUT C  

---

## 18. Final stamps

```text
CUT_B_IMPLEMENTATION_COMPLETE

PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED
L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A

CUT_C_NOT_STARTED

CONFIGURATION_REQUIRED = YES

NEXT_GATE = MANUAL_UAT

STOP
```
