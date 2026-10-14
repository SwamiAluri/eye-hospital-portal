# L-REP-03 CUT C — Staff Download of the Official PDF  
# Implementation Readiness Audit

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT C — Staff Download of the Official PDF  
**Mode:** IMPLEMENTATION READINESS AUDIT ONLY — documentation  

**This task does not implement CUT C.**  
No application source, schema, migrations, APIs, DTOs, services, UI, routes, permission seed/grant changes, RolePermission seeders, audit allowlist entries, Blob/SAS/download endpoints, CanonicalDocument model changes, Report / ReportVersion / Report Number / Release / Result / Authorization / CriticalResultEvent / Pathology / Patient Portal / Patient 360 / NotificationHub / retention / historical artifact APIs, or B1 Official PDF generation were created or modified by this audit.

---

## 1. Title

L-REP-03 CUT C — Staff Download of the Official PDF — Implementation Readiness Audit

## 2. Date

2026-10-12

## 3. Audit mode

```text
AUDIT / READINESS ONLY
IMPLEMENTATION_NOT_STARTED
CUT_C_IMPLEMENTATION_NOT_STARTED
```

Deliverable permitted: this document only.

## 4. Scope

### In scope

- Determine whether the repository is **READY**, **READY_WITH_PREREQUISITES**, or **BLOCKED** for future CUT C implementation
- Verify repository fit against certified PD-DL-01 … PD-DL-20 (Product Decision Closure)
- Inventory reusable LaboratoryApi / AuthService / FE capabilities and remaining gaps
- Design the Lab→Auth byte-retrieval contract as an implementation readiness design (not implementation)
- Propose a bounded future implementation sequence (recommendation only)

### Explicitly out of scope

- Any implementation of CUT C
- Reopening or reinterpretation of Product Owner decisions
- B1 generation / artifact model changes
- Patient publication, notifications, Pathology dual-write, retention, historical download
- Creation of APIs, allowlists, permissions grants, UI, or migrations

---

## 5. Authoritative source chain

| Document | Role | Stamp / status |
| --- | --- | --- |
| [enterprise-lms-report-staff-download-decision-closure.md](./enterprise-lms-report-staff-download-decision-closure.md) | Binding CUT C Product Decision Closure | `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C` |
| [enterprise-lms-report-staff-download-decision-package.md](./enterprise-lms-report-staff-download-decision-package.md) | Decision Review package | Superseded for stamped PD-DL-* by closure |
| [enterprise-lms-report-staff-download-discovery-audit.md](./enterprise-lms-report-staff-download-discovery-audit.md) | Staff Download discovery | `DISCOVERY_COMPLETE` |
| [enterprise-lms-report-official-pdf-acceptance-closure.md](./enterprise-lms-report-official-pdf-acceptance-closure.md) | Accepted B1 | `ACCEPTED_L_REP_03_CUT_B` |
| [enterprise-lms-report-official-pdf-decision-closure.md](./enterprise-lms-report-official-pdf-decision-closure.md) | B1 PD-PDF-* | `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED` |
| [enterprise-lms-report-official-pdf-readiness-audit.md](./enterprise-lms-report-official-pdf-readiness-audit.md) | B1 readiness pattern reference | Complete |
| [enterprise-lms-report-artifact-numbering-download-decision-closure.md](./enterprise-lms-report-artifact-numbering-download-decision-closure.md) | PD-ART-* carried forward | `PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED` |
| [enterprise-lms-report-number-foundation-acceptance-closure.md](./enterprise-lms-report-number-foundation-acceptance-closure.md) | Accepted CUT A | `ACCEPTED_L_REP_03_CUT_A` |
| [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | Accepted Release | `ACCEPTED_L_REP_02B` |

```text
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C  (PD-DL-01…20 binding)
  ↓
THIS DOCUMENT — Implementation Readiness Audit
  ↓
NEXT_GATE = IMPLEMENTATION_AUTHORIZATION
  ← CUT C implementation NOT started by this audit
```

Product Owner decisions in the closure are **binding**. This audit does not reopen them.

---

## 6. Current certified baseline

| Item | Status |
| --- | --- |
| L-REP-02B Release | `ACCEPTED_L_REP_02B` — metadata only; no PDF/download |
| L-REP-03 CUT A Report Number | `ACCEPTED_L_REP_03_CUT_A` — immutable; explicit post-Release |
| L-REP-03 CUT B / B1 Official PDF | `ACCEPTED_L_REP_03_CUT_B` — generate/job/artifact/CanonicalDocument present |
| CUT C Product Decisions | `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C` |
| CUT C implementation | `NOT STARTED` (confirmed in repository) |
| Configuration gate | `CONFIGURATION_REQUIRED = NO` |
| PD-ART-08 | Remains accepted (Released + available artifact); CUT C refines download eligibility (PD-DL-01/02) — **not reopened** |

Lifecycle preserved:

```text
Draft → Final → Released → Assign Business Report Number
  → Explicit Generate Official PDF (B1)
  → [CUT C future] Staff download of current Official PDF
```

---

## 7. Repository evidence (summary)

| Area | State | Class |
| --- | --- | --- |
| `CurrentOfficialArtifactId` + Succeeded artifact + `CanonicalDocumentId` | Present (B1) | **Existing** |
| Detail DTO artifact metadata | Present | **Existing** |
| Generate / job APIs | Present | **Existing** |
| Auth register LMS Official PDF | Present (write-only) | **Existing** |
| Auth internal LMS content stream | **Absent** | **Missing** |
| Lab CanonicalDocument client content read | **Absent** (register-only) | **Missing** |
| Staff download route under `lms/reports/...` | **Absent** | **Missing** |
| `lms.reports.download` catalogue + Lab/FE constants | Present; unwired | **Reusable / incomplete** |
| `DOWNLOAD_OFFICIAL_PDF` action + allowlist | **Absent** | **Missing** |
| Detail Official PDF panel | Present (no download) | **Reusable** |
| Worklist artifact/download eligibility fields | **Absent** | **Missing** |
| FE blob download pattern (MPI/lab) | Present elsewhere | **Reusable pattern** |
| SAS for Auth CanonicalDocument | Intentionally absent | **Existing safe pattern** |

No repository contradiction requires reopening PD-DL-01 … PD-DL-20.

---

## 8. B1 artifact readiness

### 8.1 `LmsReport` (existing)

**Path:** `LaboratoryApi/Domain/LmsReport.cs` · table `lms_reports`

| Field | Evidence |
| --- | --- |
| `TenantId` | Present |
| `OperatingBranchId` | Present |
| `Status` | Present (`Draft` / `Final` / `Released`) |
| `BusinessReportNumber` | Present (nullable; assigned post-Release) |
| `CurrentOfficialArtifactId` | Present (`Guid?`; set only after successful generation; never points at Failed) |
| `RowVersion` | Present (concurrency token) |

### 8.2 `LmsReportOfficialPdfArtifact` (existing)

**Path:** `LaboratoryApi/Domain/LmsReportOfficialPdf.cs` · table `lms_report_official_pdf_artifacts`

| Field | Role |
| --- | --- |
| `Id` | Artifact ID |
| `TenantId`, `ReportId`, `ReportVersionId`, `JobId` | Ownership / links |
| `ArtifactVersion` | Immutable version |
| `Status` | `Succeeded` \| `Failed` |
| `MimeType`, `SizeBytes`, `ContentHash` | Content metadata |
| `CanonicalDocumentId` | Downstream Auth identity |
| `TemplateVersionId`, `SignatoryId` | Generation config snapshot |
| `GeneratedByUserId`, `GeneratedAtUtc` | Provenance |
| `FailureCode`, `FailureMessage` | Failure metadata |

### 8.3 Current artifact resolution (existing — do not infer)

```text
Report detail load (ReportService.ToDetailAsync)
  → if CurrentOfficialArtifactId set
  → LoadArtifactMetadataAsync(artifactId)
  → OfficialPdfArtifactMetadataDto (includes CanonicalDocumentId, Status, …)
```

Physical path after Lab eligibility:

```text
CurrentOfficialArtifactId
  → LmsReportOfficialPdfArtifact (Succeeded + CanonicalDocumentId)
  → Auth CanonicalDocument (enterprise_lms / LmsReportOfficialPdfArtifact association)
  → private Blob patient-documents / {tenantId:N}/{documentId:N}
```

| Capability | Class |
| --- | --- |
| Resolve current Succeeded artifact metadata in LaboratoryApi | **Existing** |
| Stream bytes to staff | **Missing** |

---

## 9. CanonicalDocument / Blob readiness

### 9.1 Storage (existing)

| Aspect | Evidence |
| --- | --- |
| Entity | AuthService `CanonicalDocument` |
| Association | `enterprise_lms` / `LmsReportOfficialPdfArtifact` (`CanonicalDocument.cs`) |
| Container | `patient-documents` (private) |
| Object key | `{tenantId:N}/{documentId:N}` |
| Open | `IBlobStorageService.OpenReadExactAsync` — **does not mint SAS** |
| Register | `POST api/internal/canonical-documents/register-lms-official-pdf` |

### 9.2 Existing staff content streams (not reusable as LMS authz path)

| Path | Permission | Association gate | LMS fit |
| --- | --- | --- | --- |
| MPI `…/documents/{id}/content` | `patient.patient_document.download` | `mpi` / `patient` | **Unsuitable** |
| Pathology `…/lab-reports/{id}/report/content` | `patient.view` | `lab` / `LabReport` | **Forbidden** |
| Counselling canonical content | `session_documents.read` | counselling associations | **Unsuitable** |

### 9.3 Internal CanonicalDocument API today

| Endpoint | Purpose | Content stream? |
| --- | --- | --- |
| `register-lms-official-pdf` | Write bytes + LMS association | No |
| `lookup-by-entities` | EntityId → CanonicalDocumentId | No |
| `register-external` / `remove-association` | CCMS | No |

**Missing capability:** AuthService internal (or equivalent) association-gated stream for `enterprise_lms` / `LmsReportOfficialPdfArtifact`.

---

## 10. Lab → Auth byte retrieval contract (critical)

### 10.1 Binding Product Decision (not reopened)

| Decision | Approved |
| --- | --- |
| PD-DL-06 | JWT-authenticated **proxy streaming**; **no SAS** |
| PD-DL-18 | Lab = eligibility/authz/audit decision; Auth = CanonicalDocument/Blob bytes |
| Closure | Exact internal HTTP contract = readiness design |

### 10.2 Existing Lab → Auth patterns (reusable)

| Client | Auth | Streaming? |
| --- | --- | --- |
| `PlatformCanonicalDocumentClient` | Named client `AuthService`: `X-Internal-Key` + per-call `X-Tenant-ID` | No — register JSON/Base64 only |
| `PlatformAuditClient` | Same | N/A |
| `PlatformReferenceClient` | Same | N/A |

**No JWT forwarding** on LaboratoryApi → AuthService internal clients.  
**No** `HttpCompletionOption.ResponseHeadersRead` streaming usage in Lab Auth clients today.

### 10.3 Answers to readiness questions

| # | Question | Answer |
| --- | --- | --- |
| 1 | Suitable existing Auth byte-stream API for LMS? | **No** — only MPI/lab/counselling JWT staff routes with wrong gates |
| 2 | Reuse without weakening authz? | **No** without new LMS association gate |
| 3 | Smallest new Auth capability? | Internal content stream gated on `enterprise_lms` / `LmsReportOfficialPdfArtifact` + tenant; stream via `OpenReadExactAsync` |
| 4 | How Lab authenticates? | Existing `X-Internal-Key` + `X-Tenant-ID` (same as register/audit) |
| 5 | Tenant identity preserved? | `X-Tenant-ID` must match document tenant (prefer Audit-strict pattern) |
| 6 | CanonicalDocument ownership verified? | Auth resolves via LMS association for **ArtifactId** (EntityId), not client-supplied arbitrary document alone |
| 7 | Arbitrary document-ID access prevented? | Staff never supplies CanonicalDocumentId/ArtifactId; Lab passes only ids from `CurrentOfficialArtifactId` resolution; Auth re-checks LMS association |
| 8 | Must Auth know LMS Report? | **No** — Auth proves LMS artifact association + tenant; Lab proves Report eligibility |
| 9 | How Lab constrains before call? | Full PD-DL-01…05 eligibility on Report, then call Auth with ArtifactId (+ optional CanonicalDocumentId cross-check) |
| 10 | Response/error semantics? | Stream success with mime/filename; Auth 404/403/503 mapped to honest Lab controlled errors (PD-DL-12/20) |

### 10.4 Recommended contract design (implementation readiness — not implemented)

**Staff-facing entry (LaboratoryApi):**

```text
GET /api/lms/reports/{reportId}/official-pdf
  ?operatingBranchId={guid}
```

JWT staff auth · `lms.reports.download` · Report id is **sole** client-supplied resource identifier.

**Internal AuthService (candidate):**

```text
POST api/internal/canonical-documents/lms-official-pdf/content
Headers:
  X-Internal-Key: …
  X-Tenant-ID: {tenantId}
Body (JSON):
  tenantId
  artifactId          // LmsReportOfficialPdfArtifact.Id (= association EntityId)
  // optional: canonicalDocumentId for Lab/Auth cross-check equality
```

| Auth step | Behavior |
| --- | --- |
| Validate internal key + tenant header | Fail closed |
| Find association `enterprise_lms` / `LmsReportOfficialPdfArtifact` / `EntityId == artifactId` | Else deny |
| Load CanonicalDocument for tenant; not deleted; Active\|Superseded; container `patient-documents` | Else deny |
| If `canonicalDocumentId` supplied, require equality | Else deny |
| `OpenReadExactAsync` → stream | No SAS |

**LaboratoryApi client extension (candidate):**

- Extend `IPlatformCanonicalDocumentClient` with content-open method using `HttpCompletionOption.ResponseHeadersRead` (or equivalent) to avoid full buffer when possible
- Map Auth failures to LMS error family

| Class | Note |
| --- | --- |
| **Missing capability** | Entire internal content stream + Lab client method |
| **Implementation work** | Within PD-DL-06/18 — **not** a new Product Decision |
| **Unresolved product decision** | **None** for this contract |

---

## 11. Download API readiness

### 11.1 Candidate staff endpoint (repository-compatible)

| Aspect | Candidate |
| --- | --- |
| Method | `GET` |
| Route | `lms/reports/{id:guid}/official-pdf` → hosted as `/api/lms/reports/{id}/official-pdf` |
| Convention fit | Matches `OfficialPdfFunctions` prefix (`…/official-pdf/generate`, `…/official-pdf/jobs/{jobId}`) |
| Query | `operatingBranchId` (required; same as other LMS Report APIs) |
| AuthN | Staff JWT (existing Function JWT middleware) |
| AuthZ | `LaboratoryAuthz.ReportsDownload` (`lms.reports.download`) |

### 11.2 Server-side eligibility sequence (binding PD-DL-01…05)

1. Authenticate JWT → `TenantId`, `UserId`, permissions  
2. `ForbidUnless` `lms.reports.download`  
3. `ValidateUserBranchAsync(tenant, user, operatingBranchId)`  
4. Load Report: `TenantId` match  
5. Require `Report.OperatingBranchId == operatingBranchId` else `branch_unauthorized`  
6. Require `Status == Released` else `invalid_state`  
7. Require non-empty `BusinessReportNumber` else `report_number_required`  
8. Require `CurrentOfficialArtifactId` else controlled unavailable / `invalid_state`  
9. Load artifact by id + tenant + `ReportId` match  
10. Require `Status == Succeeded` and `CanonicalDocumentId` present  
11. Write audit `DOWNLOAD_OFFICIAL_PDF` (**fail closed**)  
12. Retrieve bytes via Auth internal LMS content contract  
13. Return stream: `Content-Type: application/pdf`; `Content-Disposition: attachment; filename="{BusinessReportNumber}.pdf"`

### 11.3 Must NOT accept from client

| Forbidden input | Why |
| --- | --- |
| Arbitrary artifact ID | IDOR / historical bypass |
| Arbitrary CanonicalDocument ID | IDOR |
| Blob path | Direct storage bypass |
| SAS URL | PD-DL-06/14 forbid SAS |

### 11.4 Classification

| Item | Class |
| --- | --- |
| Route convention | **Reusable** pattern |
| Download Function/service | **Missing** — implementation work |
| Error family | **Reusable** (`invalid_state`, `branch_unauthorized`, `report_number_required`, …) |

---

## 12. Permission readiness

| Layer | Evidence | Class |
| --- | --- | --- |
| Catalogue | `EnterpriseLmsReportsPermissionCatalog.ReportsDownload` = `lms.reports.download` | **Existing** (stale description: “CUT A”) |
| Seed | Permission row seeded; **no RolePermission grants** | **Existing** / PD-DL-19 |
| Lab constant | `LaboratoryAuthz.ReportsDownload` | **Existing** |
| Lab enforcement | **Zero** `ForbidUnless` usages | **Missing** wiring |
| FE constant | `LMS_REPORTS_PERMISSIONS.download` | **Existing** |
| FE usage | Not used in Detail/Workbench | **Missing** wiring |
| Admin `*` | Platform wildcard preserved (PD-DL-17) | **Existing** |

| Implementation requirement | Update catalogue description from stale CUT A text; wire Lab + FE; **no** production RolePermission seeders |

---

## 13. Audit readiness

### 13.1 Binding decisions

| Decision | Approved |
| --- | --- |
| PD-DL-09 | Required `DOWNLOAD_OFFICIAL_PDF` via platform `audit_log` |
| PD-DL-10 | Fail closed — no PDF bytes if audit write fails |

### 13.2 Current state

| Item | State |
| --- | --- |
| `ReportAuditActions.DOWNLOAD_OFFICIAL_PDF` | **Absent** |
| Auth `InternalAuditController.AllowedActions` | Generate trio present; **download absent** (tests assert DoesNotContain) |
| `IPlatformAuditClient.WriteAsync` | **Existing** — tenant, actor, action, resourceType, resourceId, details, … |
| Fail-closed precedents | Release / request generate / generated success compensate on audit failure |

### 13.3 Recommended ordering for **download** (read path)

Download has **no LaboratoryApi durable mutation**. Safer than mutate-then-compensate:

```text
Authorize + resolve eligibility (no bytes yet)
  → Write DOWNLOAD_OFFICIAL_PDF (required)
  → On audit failure: stop; return 503 audit_unavailable (or existing family); do NOT open Blob
  → On audit success: open Auth stream → return File/stream to client
```

| Alternative | Assessment |
| --- | --- |
| Open bytes then audit then stream | Risk of partial exposure / harder fail-closed if stream already started |
| Audit after full buffer | Forces buffering; weaker fail-closed if client disconnect mid-transfer after audit |

**Recommendation:** Audit **before** Auth byte open / staff response body. Aligns with PD-DL-10 without inventing a second audit store.

### 13.4 Suggested `details` (ids only — no unnecessary PHI)

Reuse Official PDF generate style:

```text
reportId=…; artifactId=…; artifactVersion=…; canonicalDocumentId=…; contentHash=…; operatingBranchId=…; businessReportNumber=…
```

MRN / patient name **not** required in audit details (ids suffice). Business Report Number is business identity already used on generate audits.

| Class | Note |
| --- | --- |
| Allowlist + domain constant | **Missing** — implementation work |
| Client pattern | **Reusable** |
| Unresolved PD | **None** |

---

## 14. Report Detail readiness

| Item | Evidence |
| --- | --- |
| Route | `/dashboard/lms/reports/[id]` → `ReportDetailView.tsx` |
| Official PDF panel | Present when Released + numbered |
| Artifact metadata | Version, MIME/size, hash, CanonicalDocument id |
| Generate pattern | Permission-aware confirm button |
| Download | Explicitly absent; copy “No download in this slice”; tests forbid download testid |
| Eligibility fields on detail | `status`, `businessReportNumber`, `currentOfficialArtifactId`, `currentOfficialArtifact.status` — **sufficient** |

**Components to modify (future implementation):**

- `apps/hospital-portal-web/src/components/lms/reports/ReportDetailView.tsx`
- `apps/hospital-portal-web/src/lib/lms/lms-reports.api.ts` (download client `responseType: 'blob'`)
- `apps/hospital-portal-web/src/lib/lms/enterprise-lms-reports-ui.test.ts` (update absence asserts)

**UX (binding):** Download Official PDF; eligible-only; attachment; no viewer; no new design system/nav; honest failure.

| Class | **Reusable** panel + permission patterns; **Missing** download action/API |

---

## 15. Worklist readiness

| Item | Evidence |
| --- | --- |
| Route | `/dashboard/lms/reports` → `ReportsWorkbench.tsx` |
| Actions today | **Open** only |
| List DTO | `ReportListItemDto`: Status, BusinessReportNumber, … — **no** `CurrentOfficialArtifactId` / artifact status |
| Generate on worklist | Absent (must remain absent — PD-DL-11) |

### Smallest safe projection (recommendation)

| Approach | Assessment |
| --- | --- |
| FE derive from Status + Number only | **Unsafe** — would show Download before artifact exists (server still denies, but poor UX / misleading) |
| Add `CurrentOfficialArtifactId` (nullable) + optional `CurrentOfficialArtifactStatus` or boolean `OfficialPdfDownloadEligible` | **Preferred smallest** |
| Dedicated computed `DownloadEligible` boolean | Cleanest FE; must be computed **server-side** from PD-DL-01 rules |

**Recommendation:** Server-side boolean `officialPdfDownloadEligible` (or equivalent) on list items, computed from Released + number + current Succeeded artifact. FE only gates visibility; **server remains authoritative** on download API.

| Class | List projection **Missing** — implementation work; **not** a new Product Decision |

---

## 16. Filename / HTTP contract

| Aspect | Approved / evidence |
| --- | --- |
| Disposition | Attachment (PD-DL-07) |
| Filename | `{BusinessReportNumber}.pdf` (PD-DL-08); matches B1 register filename |
| MIME | `application/pdf` (artifact `MimeType`) |
| PHI in filename/URL | Forbidden |
| Platform helper | ASP.NET `File(stream, contentType, fileName)` used by MPI/lab content controllers — **reusable pattern**; no separate LMS helper required |
| Streaming | Auth `OpenReadExactAsync`; Lab should prefer response-headers-read when proxying |
| Buffering | Avoid full Lab-side buffer when possible; FE axios `blob` will buffer client-side (existing pattern) |
| Size | Platform upload max 20 MB (CanonicalDocument); Official PDFs typically smaller; no new size product rule |

---

## 17. Security / IDOR analysis

| # | Attack / case | Expected | Enforcement location | Repo today | Requirement |
| --- | --- | --- | --- | --- | --- |
| 1 | Change `reportId` | Deny unless eligible under caller tenant/branch/permission | Lab download API | Pattern exists on other Report APIs | Implement on download |
| 2 | Supply `artifactId` | **Rejected** — not accepted | Lab API contract | N/A | Do not add query/body artifact id |
| 3 | Guess `CanonicalDocumentId` | **Rejected** — not accepted on staff API; Auth LMS gate if internal misuse | Lab + Auth association | Internal stream missing | Auth association gate |
| 4 | Change branch | `branch_unauthorized` | Lab ValidateUserBranch + Report match | Pattern exists | Implement |
| 5 | Change tenant | Deny / empty | JWT tenant + Report load | Pattern exists | Implement |
| 6 | Missing `lms.reports.download` | 403 | Lab ForbidUnless | Const unwired | Wire |
| 7 | Draft | Deny | Status check | Generate denies Draft | Implement |
| 8 | Final | Deny | Status check | Generate denies Final | Implement |
| 9 | Released unnumbered | Deny | Number check | Generate denies | Implement |
| 10 | No `CurrentOfficialArtifactId` | Deny / unavailable | Pointer check | Detail knows null | Implement |
| 11 | Failed current (should not happen) | Deny | Artifact Status == Succeeded | Pointer must not point Failed | Defense in depth |
| 12 | Artifact other Report | Deny | Artifact.ReportId == Report.Id | Load by id+tenant+report | Implement |
| 13 | CanonicalDocument wrong assoc | Deny | Auth LMS association | Missing stream | Implement Auth gate |
| 14 | Audit fails | No bytes | Audit-before-stream | Pattern for writes | Implement for download |
| 15–16 | Historical artifact | Deny | Current pointer only; no history API | Historical retained, not exposed | Keep out of scope |
| 17 | Pathology LabReport doc | Deny | LMS association only | Separate Pathology path | Do not reuse |
| 18 | Direct Blob | Deny | Private container; no SAS | Existing | Preserve |

No new business rules invented beyond PD-DL-*.

---

## 18. Configuration / environment prerequisites

### Product configuration

```text
CONFIGURATION_REQUIRED = NO
```

CUT C introduces no template, signatory, Report Number, generation, or retention configuration.

### Operational environment prerequisites (not product configuration)

| Prerequisite | Purpose |
| --- | --- |
| AuthService + LaboratoryApi running | Cross-service download |
| Internal API key configured (`AuthService__InternalApiKey` / Auth `InternalApi:Key`) | Lab→Auth |
| Azure PostgreSQL (Lab + Auth) | Report/artifact + CanonicalDocument |
| Private Blob `patient-documents` | Bytes |
| Released + numbered Report | Eligibility |
| Current Succeeded Official PDF + CanonicalDocument/Blob | Content |
| UAT user with `lms.reports.download` (environment grant) **or** Admin `*` | Exercise Download |
| No production RolePermission seeder | PD-DL-19 |

---

## 19. Automated test readiness

Do **not** write tests in this audit. Required before Manual UAT:

### A. Eligibility

- Released + numbered + current Succeeded → allowed  
- Draft / Final → denied  
- Released + no number → denied  
- Released + no current artifact → denied  
- Released + Failed artifact → denied  

### B. Authorization

- Missing permission → denied  
- Wrong tenant / wrong branch / unauthorized branch → denied  
- Admin wildcard follows existing semantics  

### C. IDOR

- Staff API rejects artifact/CanonicalDocument ids  
- Historical unavailable  
- Pathology association cannot open via LMS path  
- Auth internal rejects non-LMS associations  

### D. Audit

- `DOWNLOAD_OFFICIAL_PDF` emitted  
- Audit failure prevents byte return  
- Details avoid unnecessary PHI  

### E. Storage

- Success stream  
- Missing CanonicalDocument / Blob / storage failure → controlled error  

### F. HTTP contract

- Attachment; `application/pdf`; `{BusinessReportNumber}.pdf`; no PHI filename  

### G. Worklist

- Eligible projection exposes Download; ineligible does not; server authoritative  

### H. Regression

- Release / Number / B1 generate / ReportVersion / Result / Authorization / CriticalResultEvent / Pathology unchanged  

### I. Frontend

- Permission + eligibility aware; success download; controlled failure; **no** Worklist Generate  

Suggested suites: `LaboratoryApi.Tests` (download service), `AuthService.Tests` (internal LMS content + allowlist), `enterprise-lms-reports-ui.test.ts`.

---

## 20. Manual UAT readiness (future checklist)

Do **not** claim UAT passed.

1. Login as authorized staff  
2. Open eligible Released + numbered report  
3. Confirm current Official PDF Succeeded  
4. Confirm Download visible  
5. Download PDF  
6. Confirm attachment filename `{BusinessReportNumber}.pdf`  
7. Open downloaded PDF  
8. Confirm correct bytes  
9. Confirm audit record  
10. Repeat download  
11. Confirm second audit  
12. Ineligible unnumbered  
13. Non-Released  
14. Failed/no artifact (if safely available)  
15. Unauthorized branch  
16. Missing download permission  
17. Worklist Download eligible row  
18. Worklist has **no** Generate  
19. No historical download  
20. No patient-facing surface  
21. Pathology unchanged  
22. Release / Number / B1 unchanged  

---

## 21. Implementation sequence (future — not authorized now)

| Step | Name | Scope |
| --- | --- | --- |
| **CUT C-A** | Permission + audit foundation | Domain `DOWNLOAD_OFFICIAL_PDF`; Auth allowlist; catalogue description refresh; Lab/FE wire readiness (no RolePermission seed) |
| **CUT C-B** | Auth internal LMS content stream | Association-gated `OpenReadExactAsync`; X-Internal-Key + X-Tenant-ID; no SAS; tests |
| **CUT C-C** | Lab client + staff download endpoint | Eligibility PD-DL-01…05; audit-before-stream; proxy attachment response; IDOR tests |
| **CUT C-D** | Report Detail download UX | Button; blob client; eligibility/permission; update UI tests |
| **CUT C-E** | Worklist projection + Download | Server-side eligibility flag; Download action; no Generate |
| **CUT C-F** | Automated security/integration/UI tests | §19 matrix |
| **CUT C-G** | Environment UAT preparation | Ops grant `lms.reports.download` or Admin actor; fixture Report + Succeeded artifact |
| **CUT C-H** | Manual UAT | §20 checklist |

Dependencies: C-B before C-C; C-A can parallel C-B; C-D/E after C-C; C-F throughout; C-G/H after implementation authorization + coding.

---

## 22. Risks / blockers

| Finding | Classification |
| --- | --- |
| Auth LMS content stream absent | **READY_WITH_PREREQUISITE** — designable from existing Internal + `OpenReadExactAsync` patterns under PD-DL-06/18 |
| Lab CanonicalDocument client register-only | **READY_WITH_PREREQUISITE** — extend client; streaming headers-read recommended |
| Download route / service absent | Implementation work |
| `DOWNLOAD_OFFICIAL_PDF` allowlist absent | Implementation work |
| `lms.reports.download` unwired | Implementation work |
| Worklist missing eligibility projection | Implementation work |
| Catalogue description stale | Implementation hygiene |
| Large-file buffering if Lab buffers full response | Implementation risk — mitigate with stream proxy |
| Cross-service auth key misconfig | Operational prerequisite |
| Product Decision contradiction | **None found** |
| Need new Product Decision | **None found** |

### Why not READY

Critical Lab→Auth byte-stream capability and allowlist/wiring/worklist projection are **absent**. They are closed under Product Decisions but are concrete prerequisites/design deliverables before coding can be considered fully unblocked in one shot.

### Why not BLOCKED

- PD-DL-01…20 closed and implementable against B1 SoT  
- No certified rule must be changed  
- Pathology/MPI reuse avoidable  
- Ownership boundary clear  
- CONFIGURATION_REQUIRED = NO  

---

## 23. Regression boundaries

CUT C must **not** change:

| Area | Boundary |
| --- | --- |
| L-REP-02B | Release remains metadata-only |
| CUT A | Report Number immutable; sequence unchanged |
| CUT B | Official PDF generation; artifact generation; `CurrentOfficialArtifactId` semantics unchanged |
| ReportVersion | Unchanged |
| Result / Authorization / CriticalResultEvent | Unchanged |
| Pathology | Unchanged — no `lab`/`LabReport` reuse |
| Patient Portal / Patient 360 | No publication/download |
| NotificationHub | No delivery |
| Retention | No new enforcement |
| Historical artifacts | Remain unexposed |

---

## 24. Overall readiness classification

```text
OVERALL_READINESS = READY_WITH_PREREQUISITES
```

### PD-DL checklist (repository fit)

| Decision | Fit |
| --- | --- |
| PD-DL-01 Released+numbered+Succeeded current | Fit — fields exist; enforce on new API |
| PD-DL-02 Number required | Fit |
| PD-DL-03 Current only | Fit — pointer exists; history API absent (correct) |
| PD-DL-04 Wire `lms.reports.download` | Catalogue/constants exist; wiring missing |
| PD-DL-05 Tenant+branch | Pattern exists on Report/Official PDF |
| PD-DL-06 JWT proxy; no SAS | Staff JWT on Lab; Auth stream via internal key; SAS absent (correct) |
| PD-DL-07 Attachment | `File(..., fileName)` precedent |
| PD-DL-08 `{BusinessReportNumber}.pdf` | Matches B1 stored name |
| PD-DL-09 `DOWNLOAD_OFFICIAL_PDF` | Allowlist/constant missing (implement) |
| PD-DL-10 Fail closed | Pattern exists; apply audit-before-stream |
| PD-DL-11 Detail+worklist | Detail ready; worklist projection missing |
| PD-DL-12 Honest failure | Implement with LMS errors |
| PD-DL-13 Repeated downloads | Fit |
| PD-DL-14 No SAS | Fit |
| PD-DL-15 Historical out | Fit |
| PD-DL-16 Retention defer | Fit |
| PD-DL-17 Wildcard preserve | Fit |
| PD-DL-18 Ownership boundary | Fit; internal contract designed herein |
| PD-DL-19 No production grants | Fit |
| PD-DL-20 LMS error family | Fit |

---

## 25. Next gate

```text
NEXT_GATE = IMPLEMENTATION_AUTHORIZATION
```

This audit does **not** authorize coding. A separate implementation authorization step is required before CUT C application changes.

---

## 26. Final stamps

```text
DISCOVERY_COMPLETE

IMPLEMENTATION_READINESS_AUDIT_COMPLETE

PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C_AUTHORIZED

L-REP_02B_REMAINS_ACCEPTED

ACCEPTED_L_REP_03_CUT_A

ACCEPTED_L_REP_03_CUT_B

CUT_C_IMPLEMENTATION_NOT_STARTED

CONFIGURATION_REQUIRED = NO

OVERALL_READINESS = READY_WITH_PREREQUISITES

NEXT_GATE = IMPLEMENTATION_AUTHORIZATION

STOP
```

**Not stamped:** `IMPLEMENTATION_COMPLETE` · `UAT_READY` · `MANUAL_UAT_PASSED` · `ACCEPTANCE_COMPLETE` · `ACCEPTED_L_REP_03_CUT_C`

**STOP.** Do not implement CUT C. Do not create a Cursor implementation prompt in this task. The only deliverable is this readiness audit document.
