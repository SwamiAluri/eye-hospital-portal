# L-REP-03 CUT C — Official PDF Staff Download  
# Implementation Report

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT C — Official PDF Staff Download  
**Mode:** IMPLEMENTATION COMPLETE (automated tests) — Manual UAT not performed  

**References**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-staff-download-decision-closure.md](./enterprise-lms-report-staff-download-decision-closure.md) | Binding PD-DL-* (`PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C`) |
| [enterprise-lms-report-staff-download-readiness-audit.md](./enterprise-lms-report-staff-download-readiness-audit.md) | Implementation structure / sequence (`READY_WITH_PREREQUISITES`) |
| [enterprise-lms-report-official-pdf-acceptance-closure.md](./enterprise-lms-report-official-pdf-acceptance-closure.md) | Accepted CUT B baseline |

```text
CUT_C_IMPLEMENTATION_COMPLETE

MANUAL_UAT_NOT_STARTED

ACCEPTANCE_NOT_CLAIMED

NEXT_GATE = MANUAL_UAT
```

---

## 1. Scope implemented

Implemented the approved CUT C boundary (C-A through C-G automated/prep only):

- Wire existing catalogue permission `lms.reports.download` (description corrected for CUT C; no role grants)
- Domain audit action `DOWNLOAD_OFFICIAL_PDF` + AuthService platform audit allowlist
- AuthService internal LMS Official PDF content stream (association-gated; private Blob; no SAS)
- LaboratoryApi staff download endpoint (JWT + permission + branch + eligibility + audit-before-stream)
- Report Detail Download UX on existing Official PDF panel
- Reports Worklist Download UX with server-projected `officialPdfDownloadEligible`
- Automated tests (LaboratoryApi, AuthService, frontend UI contracts)
- UAT environment preparation notes (no Manual UAT executed)

**Does not change:** Release, Report Number, Official PDF generation/jobs/templates/signatories, Result lifecycle, Technical Verification, Clinical Authorization, Critical Result, Draft/Final, ReportVersion immutability, source claims, catalogue binding, tenant/branch auth model, design system, Pathology, Patient 360, Patient Portal, CanonicalDocument ownership model, Blob privacy model.

---

## 2. Product decisions followed

| Decision theme | Implementation |
| --- | --- |
| Eligibility | Released + Business Report Number + current Succeeded artifact + CanonicalDocument association + `lms.reports.download` + operating branch + audit success |
| Current Official PDF only | `LmsReport.CurrentOfficialArtifactId` is authoritative; historical artifacts not downloadable |
| No client artifact/document/blob authority | Browser supplies only `reportId` (+ `operatingBranchId` query convention) |
| JWT application proxy | `GET /api/lms/reports/{id}/official-pdf` streams attachment through LaboratoryApi |
| Auth owns bytes | `POST /api/internal/canonical-documents/lms-official-pdf/content` with `X-Internal-Key` + `X-Tenant-ID` |
| Filename / MIME | `{BusinessReportNumber}.pdf` / `application/pdf` |
| Fail-closed audit | `DOWNLOAD_OFFICIAL_PDF` written before content open; audit failure → 503, no bytes |
| Repeated downloads | Allowed; each produces a new audit event |
| No patient / notify / history / retention / amend / unrelease | Not implemented |

---

## 3. Files / components changed (CUT C primary)

### LaboratoryApi

| Area | Path |
| --- | --- |
| Authz | `Services/LaboratoryAuthz.cs` (`ReportsDownload`) |
| Domain audit | `Domain/ReportEnums.cs` (`DOWNLOAD_OFFICIAL_PDF`) |
| Download service | `Services/OfficialPdfService.cs` (`DownloadAsync`) |
| DTOs | `Services/OfficialPdfDtos.cs`, `Services/ReportDtos.cs` (`OfficialPdfDownloadEligible`) |
| List projection | `Services/ReportService.cs` |
| Auth client stream | `Services/PlatformCanonicalDocumentClient.cs` (`OpenOfficialPdfContentAsync`, `ResponseHeadersRead`) |
| HTTP function | `Functions/OfficialPdfFunctions.cs` (`LmsReportOfficialPdfDownload`) |
| Tests | `LaboratoryApi.Tests/OfficialPdfServiceTests.cs` |

### AuthService

| Area | Path |
| --- | --- |
| Internal stream | `Controllers/InternalCanonicalDocumentController.cs` (`lms-official-pdf/content`) |
| Audit allowlist | `Controllers/InternalAuditController.cs` |
| Permission catalogue text | `SeedData/EnterpriseLmsReportsPermissionCatalog.cs` |
| Tests | `AuthService.Tests/InternalCanonicalDocumentControllerTests.cs`, `InternalAuditControllerTests.cs`, `EnterpriseLmsReportsPermissionTests.cs` |

### Frontend

| Area | Path |
| --- | --- |
| Permissions | `apps/hospital-portal-web/src/lib/lms/lms-permissions.ts` |
| Capability copy | `apps/hospital-portal-web/src/lib/lms/lms-capability-registry.ts` |
| API client | `apps/hospital-portal-web/src/lib/lms/lms-reports.api.ts` (`downloadLmsOfficialPdf`) |
| Report detail | `apps/hospital-portal-web/src/components/lms/reports/ReportDetailView.tsx` |
| Worklist | `apps/hospital-portal-web/src/components/lms/reports/ReportsWorkbench.tsx` |
| UI contracts | `apps/hospital-portal-web/src/lib/lms/enterprise-lms-reports-ui.test.ts` |

### Docs

| Path |
| --- |
| `docs/laboratory-management/enterprise-lms-report-staff-download-implementation-report.md` (this file) |

Prior CUT C governance docs (discovery / decision package / closure / readiness) remain authoritative and were not reopened.

---

## 4. API changes

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/lms/reports/{reportId}/official-pdf?operatingBranchId=` | Staff JWT + `lms.reports.download` | Attachment stream; no artifact/document IDs |

Response headers:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="{BusinessReportNumber}.pdf"`
- `Content-Length` when available from Auth stream

Denial uses existing LMS error family (`invalid_state`, `report_number_required`, `branch_unauthorized`, `not_found`, `audit_unavailable`, `platform_unavailable`).

---

## 5. AuthService internal stream changes

| Method | Route | Auth |
| --- | --- | --- |
| POST | `/api/internal/canonical-documents/lms-official-pdf/content` | `X-Internal-Key` + `X-Tenant-ID` |

Request body (server-to-server):

```json
{ "tenantId": "...", "artifactId": "...", "canonicalDocumentId": "..." }
```

`canonicalDocumentId` is optional cross-check; association remains authoritative:

- `SourceType` / domain = `enterprise_lms`
- `EntityType` = `LmsReportOfficialPdfArtifact`
- `EntityId` = artifactId
- Same tenant; document not deleted; Active or Superseded
- Expected private patient-documents container
- Stream via `IBlobStorageService.OpenReadExactAsync`

No SAS, public URL, or storage key is returned.

---

## 6. Permission wiring

| Layer | Behavior |
| --- | --- |
| Catalogue | Existing `lms.reports.download` — description updated for CUT C Official PDF staff download |
| LaboratoryApi | `LaboratoryAuthz.ReportsDownload` enforced on download function |
| Frontend | `LMS_REPORTS_PERMISSIONS.download` gates Detail/Worklist Download affordances |

**No production RolePermission grants. No new roles. No security model replacement.**

UAT actors still require controlled out-of-band grant of `lms.reports.download` (and generate/view as needed for setup).

---

## 7. Audit allowlist / action changes

| Action | When |
| --- | --- |
| `DOWNLOAD_OFFICIAL_PDF` | Every successful eligibility path immediately before Auth content open |

Details include operational identifiers only (`reportId`, `artifactId`, `artifactVersion`, `canonicalDocumentId`, `contentHash`, `operatingBranchId`, `businessReportNumber`). No MRN / patient name / DOB.

Allowlisted in `InternalAuditController.AllowedActions`. Fail-closed: audit exception → `503` / `audit_unavailable`; Blob not opened.

---

## 8. Database / migration changes

**None for CUT C.**

No new business schema. Relies on accepted CUT B Official PDF artifact foundation and existing CanonicalDocument / association tables.

---

## 9. Frontend changes

### Report Detail (`/dashboard/lms/reports/[id]`)

- Download Official PDF on existing Official PDF panel
- Visible when permission + eligibility (Released, numbered, current Succeeded artifact with CanonicalDocument)
- Invokes `downloadLmsOfficialPdf`; saves `{BusinessReportNumber}.pdf`
- Controlled failures surfaced honestly
- Generate remains the separate CUT B action

### Reports Worklist (`/dashboard/lms/reports`)

- Server field `officialPdfDownloadEligible`
- Download action on eligible rows only (Report ID)
- No Generate, no historical selection, no PDF preview, no patient publication

No new routes, design system, or PDF viewer.

---

## 10. Security / IDOR protections

- Tenant isolation via JWT tenant + Auth header/body tenant match
- Operating branch via `ValidateUserBranchAsync` + Report.OperatingBranchId match
- Permission gate before service logic
- Server resolves current artifact; client cannot supply artifactId / canonicalDocumentId / blob key
- Artifact must belong to same Report + tenant and be Succeeded with CanonicalDocumentId
- Auth association gate rejects Pathology / wrong SourceType / EntityType / EntityId / tenant / deleted docs
- Audit failure blocks bytes

---

## 11. Streaming behavior

1. LaboratoryApi → Auth uses `HttpCompletionOption.ResponseHeadersRead`
2. Auth streams Blob via `OpenReadExactAsync`
3. LaboratoryApi forwards stream to browser response body
4. No intentional full `byte[]` buffering of PDF content in the download path

---

## 12. Automated tests executed

| Suite | Filter / path | Result |
| --- | --- | --- |
| LaboratoryApi Official PDF (CUT B + CUT C) | `FullyQualifiedName~OfficialPdfServiceTests` | **Passed 22** (0 failed) |
| LaboratoryApi Reports regression | `ReportServiceTests\|OfficialPdf\|ReportNumber` | **Passed 64** (0 failed) |
| AuthService permission + audit + LMS CanonicalDocument | `EnterpriseLmsReportsPermissionTests\|InternalAuditControllerTests\|InternalCanonicalDocumentControllerTests` | **Passed 33** (0 failed) |
| Frontend Reports UI contracts | `src/lib/lms/enterprise-lms-reports-ui.test.ts` | **Passed 12** (0 failed) |

### LaboratoryApi download coverage (representative)

- Eligible download succeeds + audits + Content-Type/filename/stream
- Wrong branch denied
- Draft / Final-not-Released / unnumbered denied
- No current artifact denied
- Failed current artifact denied
- Audit failure prevents content open
- Auth/platform unavailable → controlled 503
- Repeated downloads each audit
- Current pointer authoritative (historical not selected)
- Worklist `officialPdfDownloadEligible` projection

### AuthService content coverage (representative)

- Valid internal auth + enterprise_lms association streams
- Invalid internal key denied
- Tenant mismatch / canonicalDocumentId mismatch denied
- Pathology / wrong association denied
- Missing association denied
- No SAS/public URL returned

### Frontend coverage

- Download permission wiring + Detail/Worklist affordances
- Worklist never shows Generate for CUT C
- Download API uses blob response
- Legacy Pathology `downloadPdf` identifier not reintroduced as standalone API

---

## 13. Test counts

| Area | Passed | Failed | Skipped |
| --- | --- | --- | --- |
| OfficialPdfServiceTests | 22 | 0 | 0 |
| Report/OfficialPdf/ReportNumber filter | 64 | 0 | 0 |
| Auth CUT C filter (permissions/audit/canonical) | 33 | 0 | 0 |
| enterprise-lms-reports-ui.test.ts | 12 | 0 | 0 |

---

## 14. Existing failures / environment notes

- Local `AuthService.exe` file lock (running AuthService process) intermittently blocked AuthService rebuilds; resolved by stopping the process before test rebuild. Not a product defect.
- No CUT C schema migration required; no unrelated failing suites were modified to force green.

---

## 15. Environment / UAT preparation

Before Manual UAT:

1. LaboratoryApi + AuthService running with shared internal key configuration
2. Confirm CUT B Official PDF migration already applied (no new CUT C migration)
3. Tenant has Official PDF template + signatory configuration (CUT B prerequisite)
4. Report Number configuration valid for operating branch
5. Controlled grant of `lms.reports.download` (and generate/view as needed) to UAT staff — **not** seeded by this slice
6. Health checks: LaboratoryApi reports routes + Auth internal CanonicalDocument content route reachable server-to-server
7. Do **not** add production RolePermission grants as part of UAT prep scripts unless separately authorized

---

## 16. Explicit out-of-scope confirmation

This implementation does **not** claim or deliver:

- Manual UAT passed / Acceptance complete / Production ready
- Report Release / Number / Official PDF generation changes
- Patient Portal or Patient 360 download/publication
- NotificationHub integration
- Historical artifact browsing/download
- Amendments / Supersession / Unrelease / Revoke
- Retention enforcement
- SAS or public Blob URLs
- Pathology migration or dual-write
- Production role grants / new roles / new security model
- Design system or navigation redesign

---

## 17. Manual UAT checklist

1. Authorized staff user can open an eligible Released report.
2. Business Report Number is present.
3. Current Official PDF artifact is Succeeded.
4. Download action appears.
5. Download succeeds.
6. Filename is `{BusinessReportNumber}.pdf`.
7. MIME type is `application/pdf`.
8. PDF opens correctly.
9. PDF content matches the current official artifact.
10. `DOWNLOAD_OFFICIAL_PDF` audit entry exists.
11. Repeated download succeeds.
12. Repeated download creates another audit entry.
13. Unnumbered report cannot download.
14. Non-Released report cannot download.
15. Failed/no current artifact cannot download.
16. Unauthorized branch cannot download.
17. User without `lms.reports.download` cannot download.
18. Reports Worklist shows Download only for eligible reports.
19. Reports Worklist does not show Generate.
20. Historical artifact is not downloadable.
21. Patient Portal / Patient 360 remain unchanged.
22. Legacy Pathology remains unchanged.

---

## 18. Final implementation status

```text
CUT_C_IMPLEMENTATION_COMPLETE

MANUAL_UAT_NOT_STARTED

ACCEPTANCE_NOT_CLAIMED

PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C
L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B

NEXT_GATE = MANUAL_UAT

STOP
```
