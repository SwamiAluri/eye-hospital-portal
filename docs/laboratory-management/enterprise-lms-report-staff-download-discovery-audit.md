# L-REP-03 CUT C — Staff Download of the Official PDF  
# Product Discovery / Architecture Audit

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT C — Staff Download of the Official PDF  
**Mode:** DISCOVERY / REPOSITORY AUDIT ONLY — no application code, schema, migrations, APIs, DTOs, UI, routes, permissions, role grants, audit allowlist changes, Blob/SAS/download endpoints, CanonicalDocument model changes, B1 artifact model changes, Report Release, Report Number, ReportVersion, Result/Authorization, Pathology, Patient Portal, Patient 360, NotificationHub, or CUT C implementation  

**Label for sequencing advice:** `DISCOVERY RECOMMENDATION ONLY` — nothing herein authorizes implementation or Product Decision Closure.

---

## 1. Executive summary

B1 Official PDF Artifact Foundation is **accepted** and provides a complete LaboratoryApi source of truth for the **current** Official PDF: `LmsReport.CurrentOfficialArtifactId` → immutable `LmsReportOfficialPdfArtifact` (Succeeded) → `CanonicalDocumentId` → private Azure Blob via AuthService association `enterprise_lms` / `LmsReportOfficialPdfArtifact`.

**Staff download does not exist.** There is no staff content stream, SAS endpoint, download API, download UI, wired `lms.reports.download` enforcement, or download audit action. Catalogue permission `lms.reports.download` is seeded with **no role grants** and is unused by LaboratoryApi routes and frontend controls.

Upstream L-REP-03 PD-ART closure already stamped several download *principles* (Released + available artifact; current official only; detail + worklist; fail-closed audit; staff-only; wire `lms.reports.download`). Those principles are **carried-forward inputs**, not CUT C implementation authorization. CUT C still requires a dedicated **Product Decision Review** for mechanism ownership, exact eligibility against the B1 model, filename/disposition, historical access, failure semantics, and UI affordances that PD-ART left underspecified or that B1 reality now constrains.

```text
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B  (B1 frozen)
  ↓
THIS DOCUMENT — Staff Download discovery
  ↓
NEXT_GATE = PRODUCT_DECISION_REVIEW
  (no Product Decision Closure; no implementation)
```

**Readiness classification:** `READY_FOR_PRODUCT_DECISION_REVIEW`

---

## 2. Scope

### In scope

- Evidence-based audit of what CUT C (staff download of current Official PDF) would require after `ACCEPTED_L_REP_03_CUT_B`
- Inventory of reusable platform capabilities and LaboratoryApi / AuthService / FE gaps
- Product Decision Matrix (PD-DL-*) with carried-forward PD-ART / PD-PDF context
- Candidate implementation boundary (recommendation only)
- Security, retention, performance, test-readiness discovery

### Explicitly out of this task

- Any implementation  
- Product Decision Closure  
- Implementation readiness authorization  
- CUT C start  
- Reopening certified L-REP-02B / CUT A / CUT B / B1  
- Patient Portal / Patient 360 / NotificationHub / Pathology / Amendments / Unrelease / Revoke  

---

## 3. Certified baseline

| Slice | Stamp | Must remain unchanged |
| --- | --- | --- |
| L-REP-02B Report Release | `ACCEPTED_L_REP_02B` | Metadata-only Release; no PDF/download |
| L-REP-03 CUT A Report Number | `ACCEPTED_L_REP_03_CUT_A` | Explicit post-Release immutable number |
| L-REP-03 CUT B / B1 Official PDF | `ACCEPTED_L_REP_03_CUT_B` | Generate/job/artifact/CanonicalDocument foundation; **no download** |
| L-REP-03 PD-ART package | `PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED` | Download *principles* carried forward as inputs (not CUT C implementation auth) |
| CUT B PD-PDF package | `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED` | B1 decisions closed; download OUT of B1 |

### Authoritative references (this discovery)

| Document | Role |
| --- | --- |
| [enterprise-lms-report-official-pdf-acceptance-closure.md](./enterprise-lms-report-official-pdf-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_B`; next gate was `PRODUCT_DISCOVERY_REQUIRED` |
| [enterprise-lms-report-official-pdf-decision-closure.md](./enterprise-lms-report-official-pdf-decision-closure.md) | PD-PDF-*; download OUT of B1 |
| [enterprise-lms-report-official-pdf-readiness-audit.md](./enterprise-lms-report-official-pdf-readiness-audit.md) | B1 readiness |
| [enterprise-lms-report-official-pdf-implementation-report.md](./enterprise-lms-report-official-pdf-implementation-report.md) | B1 implementation |
| [enterprise-lms-report-official-pdf-pre-uat-readiness.md](./enterprise-lms-report-official-pdf-pre-uat-readiness.md) | PRE-UAT |
| [enterprise-lms-report-official-pdf-discovery-audit.md](./enterprise-lms-report-official-pdf-discovery-audit.md) | Official PDF discovery; CUT C deps listed |
| [enterprise-lms-report-official-pdf-decision-package.md](./enterprise-lms-report-official-pdf-decision-package.md) | B1 decision package baseline |
| [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | `ACCEPTED_L_REP_02B` |
| [enterprise-lms-report-number-foundation-acceptance-closure.md](./enterprise-lms-report-number-foundation-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_A` |
| [enterprise-lms-report-artifact-numbering-download-decision-closure.md](./enterprise-lms-report-artifact-numbering-download-decision-closure.md) | PD-ART-08/09/09b/09c/10 download principles |

### Certified B1 state (frozen — do not redesign)

| Capability | State |
| --- | --- |
| Released Report + immutable ReportVersion | Yes |
| Business Report Number | Yes (CUT A) |
| Explicit Official PDF generation | Yes (async LaboratoryApi job) |
| Immutable Official PDF artifact versions | Yes |
| `CurrentOfficialArtifactId` on `LmsReport` | Yes |
| PDF metadata on detail | Yes |
| LaboratoryApi as artifact/report SoT | Yes |
| CanonicalDocument + private Blob (downstream) | Yes |
| Association `enterprise_lms` / `LmsReportOfficialPdfArtifact` | Yes |
| Staff download / SAS / raw Blob endpoint | **No** |
| Patient publication / Patient Portal / Patient 360 | **No** |
| NotificationHub delivery | **No** |

---

## 4. Current Report / Artifact architecture

**Evidence class:** Repository evidence (post-B1).

### Conceptual flow (not approved as CUT C Product Decision)

```text
Released + numbered Report
        ↓
Current Official PDF artifact exists (Succeeded + CanonicalDocumentId)
        ↓
Authorized staff requests access
        ↓
Official PDF content delivered securely
        ↓
Download/access audited
```

This flow is a **discovery target**, not an approved CUT C decision.

### Current Official PDF identification

| Concern | Evidence |
| --- | --- |
| Current pointer | `LmsReport.CurrentOfficialArtifactId` (`LaboratoryApi/Domain/LmsReport.cs`) — set only after successful generation; never points at a failed artifact |
| Schema | `lms_reports.current_official_artifact_id` (nullable uuid); index only — **no FK** from pointer to artifact row |
| Artifact row | `LmsReportOfficialPdfArtifact` in `lms_report_official_pdf_artifacts` (`Domain/LmsReportOfficialPdf.cs`) |
| Association with Report | `ReportId` + `TenantId` on artifact; nav to Report |
| Regeneration | New `ArtifactVersion`; pointer moves to newest Succeeded; prior rows retained |

### Artifact metadata stored

| Field | Role |
| --- | --- |
| `Id`, `TenantId`, `ReportId`, `ReportVersionId`, `JobId` | Identity / links |
| `ArtifactVersion` | Immutable version (unique per report) |
| `Status` | `Succeeded` \| `Failed` |
| `MimeType`, `SizeBytes`, `ContentHash` | Content metadata |
| `CanonicalDocumentId` | Downstream Auth/Blob identity |
| `TemplateVersionId`, `SignatoryId` | Generation-time config snapshot |
| `GeneratedByUserId`, `GeneratedAtUtc` | Provenance |
| `FailureCode`, `FailureMessage` | Failure metadata |

DTO: `OfficialPdfArtifactMetadataDto` — metadata only; **no bytes**.

### CanonicalDocumentId sufficiency

| Question | Finding |
| --- | --- |
| Can current artifact locate physical PDF? | **Yes** — Succeeded artifact with `CanonicalDocumentId` → Auth CanonicalDocument → private `patient-documents` blob key `{tenantId:N}/{documentId:N}` |
| Historical artifacts locatable? | **In DB yes** — retained rows with their own `CanonicalDocumentId`; **not listed via API** |
| Current vs historical distinguished? | **Yes at SoT** — current = pointer on `LmsReport`; historical = other Succeeded rows for same `ReportId` not pointed at |

### API exposure today

| Surface | Exposure |
| --- | --- |
| Report detail | `CurrentOfficialArtifactId` + `CurrentOfficialArtifact` metadata only |
| Latest job | Job status may embed that job’s artifact metadata |
| Artifact history list API | **Absent** |
| Worklist DTO | **No** artifact fields |
| Download / content stream | **Absent** |

### Generate eligibility (B1 — already enforced; not download)

- `Status == Released` else `409 invalid_state`
- Non-empty `BusinessReportNumber` else `409 report_number_required`
- Template + signatory configuration required
- Permission `lms.reports.generate`

Filename at register: `{BusinessReportNumber}.pdf` (`OfficialPdfService.cs`).

---

## 5. CanonicalDocument / Blob audit

**Evidence class:** Repository evidence.

| Aspect | Finding |
| --- | --- |
| Storage | AuthService `CanonicalDocument` + `IBlobStorageService`; default container `patient-documents`; object key `{tenantId:N}/{documentId:N}` |
| Privacy | Container created with `PublicAccessType.None`; private blob |
| LMS registration | Internal `POST api/internal/canonical-documents/register-lms-official-pdf` (`InternalCanonicalDocumentController`) — `X-Internal-Key`; association `enterprise_lms` / `LmsReportOfficialPdfArtifact` / artifact Guid |
| Pathology isolation | Tests assert LMS registration does **not** use `lab` / `LabReport` |
| Soft delete / supersession | Platform association model exists; LMS retention enforcement **not** B1 |
| Clinical SoT | Remains LaboratoryApi `LmsReport` / artifact — CanonicalDocument is **downstream byte store** only |

---

## 6. Existing download / content-access patterns

### Platform staff CanonicalDocument pattern (primary reusable)

| Step | Pattern |
| --- | --- |
| Auth | JWT `[Authorize]` + domain permission |
| Resolve | Tenant from claims; load CanonicalDocument with tenant + association gates |
| Stream | `IBlobStorageService.OpenReadExactAsync` → `File(stream, contentType, fileName)` |
| SAS | **Not used** for AuthService CanonicalDocument / session-audio exact reads |

Precedents:

| Surface | Route pattern | Permission |
| --- | --- | --- |
| MPI General docs | `GET …/documents/{documentId}/content` | `patient.patient_document.download` |
| Counselling Patient 360 | `GET …/canonical/{id}/content` | `session_documents.read` |
| Pathology LabReport | `GET …/lab-reports/{id}/report/content` | `patient.view` |
| Session audio download | `POST …/recordings/download` | `counseling_sessions.update` |

Frontend: Axios `responseType: 'blob'` + `<a download={fileName}>` (e.g. Patient 360 documents, counselling panels, lab-reports API).

### SAS pattern (contrast — generally unsuitable for LMS staff Official PDF)

| Location | Behavior |
| --- | --- |
| CCMS `DocumentEngineService.GenerateReadSasUrl` | Short-lived (~1h) read SAS + optional JWT `/content` stream |
| AuthService CanonicalDocument | **No** SAS minting for staff PHI docs |

**Recommendation (not a decision):** Prefer AuthService JWT proxy stream over CCMS-style SAS for LMS Official PDF, consistent with MPI/counselling/lab CanonicalDocument access. SAS would require Product Decision justification and stronger expiry/audit design.

### LMS Official PDF content access today

| Capability | State |
| --- | --- |
| Staff content endpoint | **Absent** |
| LaboratoryApi download proxy | **Absent** |
| AuthService LMS-specific `/content` | **Absent** |
| Internal register | Exists (write path only) |

### Ownership question (Product Decision)

Who authorizes and streams bytes?

| Option | Notes |
| --- | --- |
| AuthService content endpoint gated by LMS association + Laboratory eligibility proof | Matches CanonicalDocument ownership of bytes; needs Lab eligibility (Released, current artifact) — eligibility SoT is LaboratoryApi |
| LaboratoryApi download API that fetches bytes from Auth internal/proxy | Keeps Report authz/branch patterns in Lab; needs secure internal content-read contract (today register is write-only) |
| Hybrid: Lab eligibility gate issues one-time ticket; Auth streams | New infrastructure — avoid unless Product Decision requires |

Existing CanonicalDocument `/content` controllers **do not** enforce LMS Report operating-branch match. LMS Report generate/list/detail **do** enforce tenant + `ValidateUserBranchAsync` + `report.OperatingBranchId` match. CUT C must not weaken LMS branch isolation merely to reuse MPI content routes as-is.

---

## 7. Authorization audit

### Permission catalogue vs enforcement

| Code | Catalogue | Lab Authz const | Backend gate | FE usage | Role grants |
| --- | --- | --- | --- | --- | --- |
| `lms.reports.view` | Yes | Yes | Yes (list/get/job) | Yes | **None** in seeders |
| `lms.reports.generate` | Yes | Yes | Yes (`POST …/official-pdf/generate`) | Yes (detail button) | **None** |
| `lms.reports.download` | Yes | Yes (`ReportsDownload`) | **No** — const unused | **No** — constant only | **None** |

**Evidence:**

- `AuthService/SeedData/EnterpriseLmsReportsPermissionCatalog.cs` — download description still says catalogue-only / not implemented in CUT A (stale relative to B1; still accurate that download is unimplemented)
- `PermissionSeeder` seeds Permission rows (`Scope = "branch"`); **no RolePermission** inserts for any `lms.reports.*`
- `LaboratoryAuthz.ReportsDownload` exists; zero `ForbidUnlessAsync` usages for download
- FE `lms-permissions.ts` mirrors catalogue; UI tests assert no download control / API helper

### Admin / wildcard

| Layer | Behavior |
| --- | --- |
| AuthService | Admin/SuperAdmin → JWT permissions `["*"]` |
| LaboratoryApi | `HasAny`/`HasAll` treat `*` as unrestricted |
| FE permission-cache | `permissions.includes('*')` → allow |

Admin wildcard is **not** a production role grant of `lms.reports.download`. PD-ART-13 / PD-PDF-11: **no production role grants in source seeders** — carried forward unless Product Decision changes grant policy for CUT C.

### Staff-only

| Mechanism | State |
| --- | --- |
| Staff portal `/dashboard/lms/*` + JWT `ProtectedRoute` | Yes |
| Patient Portal / Patient 360 LMS Official PDF routes | **None found** |
| Dedicated `isStaff` claim in LaboratoryApi | No — staff JWT + permission codes |
| `lms.reports.publish` | Not catalogued / not authorized |

---

## 8. Branch / tenant authorization audit

**Existing LMS Report / Official PDF pattern (must be preserved for CUT C if Product Decision confirms):**

1. JWT → `TenantId` + `UserId` + permissions  
2. `ValidateUserBranchAsync(tenantId, actorUserId, operatingBranchId)`  
3. Load report with `TenantId == tenantId`  
4. Require `report.OperatingBranchId == operatingBranchId` else **403** `branch_unauthorized`  
5. List queries filter by operating branch  

**Gap vs CanonicalDocument `/content` precedents:** MPI/counselling/lab content endpoints enforce tenant + patient/association, **not** LMS operating-branch Report match. Reusing those routes without an LMS eligibility gate would be a **branch authorization regression risk**.

---

## 9. Download eligibility discovery

Do **not** invent answers. Classification legend:

| Class | Meaning |
| --- | --- |
| **Certified** | Stamped PD-ART / PD-PDF / acceptance |
| **Platform rule** | Existing LMS Report authz/platform convention |
| **Unresolved PD** | Requires Product Decision Review (PD-DL-*) |
| **Technical** | Implementation design once Product Decisions closed |

| # | Question | Classification | Evidence / note |
| --- | --- | --- | --- |
| 1 | Download only when `Status = Released`? | **Certified** (PD-ART-08 = A) | Confirm against B1; still Product Decision Review item PD-DL-01 for CUT C packaging |
| 2 | Business Report Number required? | **Unresolved PD** | Generate requires number (B1); PD-ART-08 text is Released + available artifact only — confirm PD-DL-02 |
| 3 | `CurrentOfficialArtifactId` must exist? | **Certified intent** (PD-ART-09) + **B1 SoT** | Current official pointer is authoritative |
| 4 | Current artifact `Status = Succeeded`? | **Technical + confirm PD** | Pointer must not point at Failed; still validate before stream |
| 5 | Historical versions downloadable? | **Unresolved PD** (PD-DL-03 / PD-DL-15) | PD-ART-09 = current official only; historical retained but not exposed |
| 6 | Only `CurrentOfficialArtifactId` downloadable? | **Certified intent** (PD-ART-09 = A) | Confirm for CUT C |
| 7 | Repeated download allowed? | **Unresolved PD** (PD-DL-13) | No rate-limit precedent on CanonicalDocument content |
| 8 | Detail only? | **Certified intent** surfaces include both (PD-ART-09c = B) | Confirm UI packaging PD-DL-11 |
| 9 | Worklist also? | **Certified intent** (PD-ART-09c = B) | Worklist today has no artifact readiness fields — FE gap |
| 10 | Every staff with permission? | **Platform + PD** | Wire `lms.reports.download`; grants still none (PD-ART-13) |
| 11 | Branch authz at download? | **Platform rule** + **Certified** (PD-ART §10/§12) | Match generate/detail |
| 12 | Tenant authz at download? | **Platform rule** + **Certified** | Match generate/detail |
| 13 | Report ownership matter? | **Platform rule** | Tenant + operating branch ownership of Report |
| 14 | Laboratory/section context? | **Unresolved / not evidenced** | No section-scoped Report download model found |
| 15 | Revoked / unreleased state? | **Out of scope / unresolved** | Unrelease/Revoke not implemented; if Status leaves Released, PD-ART-08 implies deny |

---

## 10. Current vs historical artifact discovery

| Topic | Finding |
| --- | --- |
| Historical retained? | **Yes** — PD-PDF-15 / PD-ART-05b; DB rows + CanonicalDocument/Blob per success |
| Historical identifiable in UI/API? | **No** — only current (+ incidental latest-job artifact metadata) |
| Superseded concept? | Pointer moves; prior Succeeded rows remain; no soft-delete flag for “superseded official PDF” |
| Business use for old PDF download? | **Not certified** — valid audit/compliance use may exist; Product Decision required |
| CUT C default recommendation | Download **current official only**; historical access deferred unless PO approves |

---

## 11. Download mechanism comparison

Do **not** select an option unless Product Decision mandates it. Recommendations remain for Product Decision Review only.

### Option A — Authenticated application/API streaming (LaboratoryApi or AuthService)

| Dimension | Assessment |
| --- | --- |
| Precedent | Auth CanonicalDocument `/content`; Pathology LabReport content; counselling content |
| Security | JWT + permission + server-side stream; no browser Blob URL |
| Authz location | Application layer before open |
| Tenant/branch | Must be implemented for LMS (not free with MPI content) |
| Auditability | High — audit before stream (PD-ART-09b) |
| Blob URL exposure | None |
| Expiration | N/A (session/JWT) |
| Browser | FE blob fetch + download link |
| Inline vs attachment | Controlled by `File(..., fileName)` / headers |
| PHI | Avoid query-string PHI; object keys are Guids |
| New infra | Endpoint + eligibility — reuses Blob open |
| Architecture fit | Aligns with AuthService PHI document principle |

### Option B — Short-lived signed URL / SAS

| Dimension | Assessment |
| --- | --- |
| Precedent | CCMS documents — **not** Auth CanonicalDocument |
| Security | Browser-direct Blob; audit/eligibility harder after URL issued |
| Authz location | At mint time only unless ticket revalidated |
| Expiration | CCMS ~1h precedent — LMS expiry needs PD-DL-14 |
| Blob URL exposure | Yes — risk |
| Architecture fit | Conflicts with AuthService CanonicalDocument “no SAS” staff pattern unless PO explicitly chooses |

### Option C — Existing CanonicalDocument content endpoint (MPI/lab/counselling as-is)

| Dimension | Assessment |
| --- | --- |
| Precedent | Exists |
| Suitability | **Insufficient alone** — wrong permissions (`patient.patient_document.download` / `patient.view` / `session_documents.read`); no LMS Report Released/current-official/branch eligibility; must not expose LMS Official PDF as general patient document |
| New association | LMS association already exists; **new staff LMS content route** (or Lab gate) still required |

### Option D — Existing platform document-download abstraction

| Dimension | Assessment |
| --- | --- |
| Precedent | Repeated controller+service OpenContent pattern; no single LMS Official PDF abstraction |
| `DocumentAccessAudit` | Schema exists; **never written** — unsuitable as LMS SoT audit |
| Recommendation | Reuse **pattern**, not unused DocumentAccessAudit table |

### Option E — Other repository patterns

| Pattern | Fit |
| --- | --- |
| Patient summary PDF buffer + `EXPORT_PDF` audit | Generated-on-demand, not CanonicalDocument — yellow reference for audit naming only |
| Internal register base64 | Write path — not staff download |

**Discovery recommendation (not approved):** Option A using JWT proxy streaming, with LaboratoryApi as eligibility/authorization SoT for Report/artifact/branch, and AuthService as physical byte open via a new LMS-scoped content path or internal read contract — **exact ownership split is PD-DL-06 / PD-DL-18**. Prefer no SAS.

---

## 12. Filename / Content-Disposition discovery

| Topic | Evidence |
| --- | --- |
| LMS stored filename | `{BusinessReportNumber}.pdf` at CanonicalDocument registration |
| MRN in LMS stored filename | **No** (MRN may appear **inside** PDF body per PD-PDF-02) |
| Auth CanonicalDocument `/content` disposition | ASP.NET `File(..., fileName)` → typically **attachment** |
| CCMS `/content` | Explicit **inline** |
| Patient summary FE override | Sometimes prefers MRN in client download name — **not** LMS storage convention |
| Sanitize | `CanonicalDocumentFileRules.SanitizeDisplayName` (control chars, path chars, max 200) |
| Content-Type | Stored `MimeType` = `application/pdf` for LMS Official PDF |
| Max upload size (platform) | `CanonicalDocumentFileRules.MaxBytes = 20 MB` (upload rule; not a download product policy) |

**No certified CUT C filename/disposition Product Decision** beyond storage convention. → **PD-DL-07 / PD-DL-08**.

**Recommendation (not approved):** Attachment download; filename = stored `{BusinessReportNumber}.pdf`; do not put MRN in URL or default filename.

---

## 13. Audit discovery

### Existing LMS Report audit actions (allowlisted)

| Action | Slice |
| --- | --- |
| `CREATE_REPORT_DRAFT` | L-REP-01 |
| `APPEND_REPORT_VERSION` | L-REP-01 |
| `FINALIZE_REPORT` | L-REP-02A |
| `RELEASE_REPORT` | L-REP-02B |
| `ASSIGN_REPORT_NUMBER` | CUT A |
| `REQUEST_OFFICIAL_PDF` / `OFFICIAL_PDF_GENERATED` / `OFFICIAL_PDF_FAILED` | CUT B |
| `DOWNLOAD_OFFICIAL_PDF` | **Absent** from domain constants and Auth `InternalAuditController` allowlist (tests assert DoesNotContain) |

### CanonicalDocument content access audit

| System | Download audit today? |
| --- | --- |
| MPI / counselling / lab CanonicalDocument `/content` | **No** dedicated access audit (permission gate only) |
| `DocumentAccessAudit` | Unused write path |
| Patient summary export | `EXPORT_PDF` via Auth audit helper |

### Certified download audit principle

| Principle | Source |
| --- | --- |
| Access must be audited | PD-ART-09b = A |
| Fail-closed if required audit write fails | PD-ART-09b = A |
| Platform `audit_log` only | PD-REP-20 / PD-ART §13 |
| Exact action string allowlisting | Implementation work after Product Decision — recommended name `DOWNLOAD_OFFICIAL_PDF` in prior readiness docs |

### Audit payload dimensions (expected for design; exact fields = technical + PD)

Actor identity, tenant, operating branch, report id, artifact id, CanonicalDocument id, timestamp, success/failure — aligned with existing LMS Report platform audit client patterns (Release / Assign Number / Official PDF generate).

### Audit failure behavior

| Finding | Class |
| --- | --- |
| PD-ART-09b mandates deny download if audit write fails | **Certified principle** → confirm as PD-DL-10 for CUT C packaging |
| Release / generate fail-closed audit patterns in LaboratoryApi | **Platform precedent** |
| CanonicalDocument `/content` has no download audit | **Not** a counter-precedent that weakens PD-ART-09b |

---

## 14. Detail UI discovery

**Route:** `/dashboard/lms/reports/[id]` → `ReportDetailView.tsx`  
**Gate:** `ProtectedRoute` + `lms.view`; detail requires `operatingBranchId` query.

### Official PDF panel today (`data-testid="report-official-pdf-panel"`)

| Behavior | Evidence |
| --- | --- |
| Visible when | `status === 'Released'` **and** `businessReportNumber` set |
| Honesty copy | “Explicit staff generation only. Async job. No download in this slice.” |
| Metadata | Job status, failure, artifact version, MIME/size, content hash, CanonicalDocument id |
| Action | Generate Official PDF → confirm → Confirm Generate / Cancel |
| Permission | `lms.reports.generate`; unauthorized message otherwise |
| Disabled | While job Pending/Running |
| Download | **Absent** (contract tests assert no download testid / API) |

### Placement recommendation (not implementation)

| Recommendation | Rationale |
| --- | --- |
| Add **Download Official PDF** in the same Official PDF panel, visually separated from Generate | Matches Counsellor-style confirm/permission patterns already used for Generate / Assign Number |
| Show Download only when current Succeeded artifact exists (and Product Decisions for eligibility pass) | Avoid disabled clutter for Draft/Final/unnumbered/ungenerated |
| Gate with `lms.reports.download` independently of generate | Least privilege; generate ≠ download |
| Keep honesty copy: staff-only; not patient publication | Boundary preservation |

---

## 15. Worklist discovery

**Route:** `/dashboard/lms/reports` → `ReportsWorkbench.tsx`

| Concern | Current |
| --- | --- |
| Gate | `lms.reports.view \|\| lms.reports.manage` |
| Row actions | **Open** only |
| Artifact readiness columns | **None** |
| Download | **None** |
| Honesty copy | Release is metadata; not PDF download / patient-visible |

| Classification | Note |
| --- | --- |
| PD-ART-09c = B | Detail **and** worklist download surfaces — **certified intent** |
| PD-PDF-22 | B1 deliberately detail-only for generate status |
| Repository UI convention today | Worklist Open-only; download would be **new** affordance |
| Unresolved packaging | Whether worklist needs artifact projection fields / eligibility flags before Download can appear → **PD-DL-11** |

**Recommendation (not approved):** Honor PD-ART-09c with worklist Download only when eligible (Released + current official available); do not add generate from worklist in CUT C.

---

## 16. Error / edge-case discovery

Separate technical handling from Product Decision. Do not invent business behavior unless certified.

| Scenario | Technical concern | Product Decision? |
| --- | --- | --- |
| No current artifact | Deny / hide action | Align PD-DL-01/03 |
| Metadata exists, physical content missing | 404/503 honesty | PD-DL-12 |
| CanonicalDocument missing | Fail closed | PD-DL-12 |
| Blob missing | Fail closed | PD-DL-12 |
| Artifact Failed | Must not treat as downloadable | Confirm with Succeeded rule |
| Report no longer Released | Deny per PD-ART-08 | Confirm PD-DL-01 |
| Report number missing | Open vs generate rule | PD-DL-02 |
| Wrong tenant / branch | 403 | Platform rule |
| Permission removed | 403 | Platform rule |
| Unauthorized user | 403 | Platform rule |
| Expired SAS | Only if SAS chosen | PD-DL-14 |
| Concurrent / duplicate downloads | Idempotent reads OK | PD-DL-13 |
| Stale browser link | Re-auth + re-eligibility | Technical |
| Audit failure | Deny (PD-ART-09b) | Confirm PD-DL-10 |
| Blob failure | Honest error; no fake success | Technical + PD-DL-12 |
| Failed artifact with orphan CanonicalDocument after audit revert | Do not download Failed / non-current | Technical safety |

---

## 17. Patient / publication boundary

CUT C discovery target is **STAFF DOWNLOAD ONLY**.

| Surface | Introduced by this discovery? | Status |
| --- | --- | --- |
| Patient Portal download | **No** | Forbidden (PD-ART-10); future slice |
| Patient 360 patient publication | **No** | Forbidden |
| Patient-facing URLs / public URLs | **No** | Forbidden |
| Email attachments / SMS / WhatsApp | **No** | Forbidden |
| NotificationHub delivery | **No** | Forbidden |

CanonicalDocument `PatientId` (if present for storage identity) is **not** patient publication.

---

## 18. Pathology boundary

| Rule | Status |
| --- | --- |
| CUT C must use `enterprise_lms` / `LmsReportOfficialPdfArtifact` | **Required** (PD-PDF-17 / B1 acceptance) |
| Must **not** reuse `lab` / `LabReport` | **Required** |
| Dual-write / migration | **Forbidden** |
| Pathology LabReport content stream | Separate product path — **not** LMS Official PDF download |

---

## 19. Retention discovery

| Topic | Finding |
| --- | --- |
| CanonicalDocument retention-days column | **Not first-class** |
| B1 LMS retention enforcement | **None** (PD-PDF-19 deferred) |
| Soft-delete / blob retention on association removal | Platform behavior; not LMS Official PDF policy |
| Download affected by retention today? | **No LMS policy** |
| New LMS-specific retention PD for CUT C? | **Only if PO mandates enforcement now** → PD-DL-16; otherwise defer with PD-PDF-19 |

---

## 20. Performance / security discovery

### Performance / size

| Topic | Evidence |
| --- | --- |
| LMS Official PDF size characteristics | Runtime-generated; stored `SizeBytes` on artifact; no fixed product size SLA found |
| Platform max upload | 20 MB CanonicalDocument upload rule |
| Download streaming | `OpenReadExactAsync` → stream → `File(...)` (not re-buffered in Blob service) |
| LMS register path | Base64 over internal HTTP (buffered at write time) |
| Explicit download timeouts | Not found as dedicated product limits on Auth content endpoints |
| Large-file direct Blob | Not required by existing Auth staff patterns; SAS not used for CanonicalDocument |

Do not invent LMS download size limits without evidence/PO decision.

### Security review (report only — no fixes)

| Risk | Classification |
| --- | --- |
| IDOR via artifact id / CanonicalDocument id without Report eligibility | **Risk requiring implementation** — must bind tenant + Report + branch + current official |
| Cross-tenant access | Existing LMS pattern safe if reused; **risk if bypassed** via raw document id |
| Cross-branch access | **Risk requiring implementation** — MPI content does not enforce LMS branch |
| Unauthorized artifact id download | **Risk requiring implementation** — reject non-current / Failed unless PD allows historical |
| Direct Blob URL exposure | **Existing safe pattern** if proxy stream; **blocker risk** if SAS chosen without controls |
| Stale signed URL reuse | **Risk requiring Product Decision** if SAS (PD-DL-14) |
| Permission bypass | **Risk requiring implementation** — wire `lms.reports.download`; do not reuse MPI download permission |
| Admin wildcard | **Existing platform rule** — document; grants still none |
| Audit bypass | **Risk requiring implementation** — PD-ART-09b fail-closed |
| PHI in filename | Prefer Business Report Number; avoid MRN in filename/URL → **PD-DL-08** |
| PHI in query parameters | Avoid patient identifiers in download URLs → implementation constraint |

No discovery **blocker** that prevents Product Decision Review. Implementation security gates remain mandatory after decisions.

---

## 21. Test readiness

If CUT C is later authorized, candidate coverage (do **not** write tests in this task):

### Automated (candidate)

| Area | Candidate |
| --- | --- |
| Authorized staff download | 200 + PDF bytes / content-type |
| Unauthorized denied | 403 without `lms.reports.download` |
| Wrong branch / tenant | 403 |
| No artifact / Failed artifact | 409/404 per decided codes |
| Current artifact retrieval | Matches `CurrentOfficialArtifactId` |
| Historical behavior | Deny by default or per PD |
| Content-Type `application/pdf` | Assert |
| Content-Disposition / filename | Per PD-DL-07/08 |
| PDF integrity | Hash match vs artifact `ContentHash` (optional) |
| Audit emitted | `DOWNLOAD_OFFICIAL_PDF` (or PO-approved name) |
| Audit failure | Fail-closed deny |
| CanonicalDocument / Blob failure | Honest error; no success audit spoof |
| Repeated download | Allowed or limited per PD |
| Concurrent access | Safe read |
| Permission removal | Subsequent deny |
| Regression | Release / Number / Generate / Pathology association unchanged |
| FE contract | Download control gated; absent when ineligible |
| Auth association | Still `enterprise_lms` ≠ Pathology |

### Manual UAT (candidate)

| Area | Candidate |
| --- | --- |
| Detail Download happy path | Released + numbered + Succeeded artifact |
| Worklist Download (if approved) | Eligible row only |
| Generate vs Download separation | Permissions independent |
| Browser download filename | Business Report Number `.pdf` |
| Unauthorized / wrong branch actors | Deny |
| Draft / Final / unnumbered / no artifact | No/disabled download |
| Patient surfaces | Confirm absence |

---

## 22. Product Decision Matrix

Legend for **Status**:

| Tag | Meaning |
| --- | --- |
| **CARRIED_FORWARD** | Stamped PD-ART/PD-PDF principle — confirm packaging for CUT C; do not silently reopen |
| **OPEN** | Requires Product Owner decision |
| **TECHNICAL** | Implementation design after PO decisions |

All recommendations below are **not approved**.

### PD-DL-01 — Download eligibility lifecycle state

| Field | Value |
| --- | --- |
| Current evidence | PD-ART-08 = Released + available artifact; B1 generate also requires Released |
| Precedent | PD-ART-08 |
| Options | A) Released only + artifact · B) Released + numbered + artifact · C) Other |
| Recommendation | A or B — prefer **B** to align with Official PDF panel visibility and generate gate |
| Risk | Downloading when number absent creates inconsistent staff UX vs generate panel |
| PO approval required | **Yes** (confirm carried-forward + number coupling) |
| Status | **CARRIED_FORWARD** + confirm |

### PD-DL-02 — Business Report Number requirement

| Field | Value |
| --- | --- |
| Current evidence | Generate requires number; PD-ART-08 text omits number; stored filename uses number |
| Options | Required · Not required if artifact exists |
| Recommendation | **Required** (align UX + filename honesty) |
| Risk | Orphan edge cases if number cleared (not currently allowed) |
| PO approval required | **Yes** |
| Status | **OPEN** |

### PD-DL-03 — Current artifact only vs historical

| Field | Value |
| --- | --- |
| Current evidence | PD-ART-09 = one current official; historical retained; no history API |
| Options | Current only · Current + historical by version · Current + admin-only historical |
| Recommendation | **Current only** for CUT C |
| Risk | Historical without list API invites IDOR if raw artifact ids accepted |
| PO approval required | **Yes** |
| Status | **CARRIED_FORWARD** + confirm |

### PD-DL-04 — Download permission

| Field | Value |
| --- | --- |
| Current evidence | Catalogue `lms.reports.download`; unwired; no grants |
| Options | Wire catalogue code · New code · Reuse view/generate |
| Recommendation | **Wire `lms.reports.download`**; do not reuse generate/view; no production grants in seeders unless PO changes PD-ART-13 |
| Risk | Over-broad if equated to view |
| PO approval required | **Yes** (confirm wire + grant policy) |
| Status | **CARRIED_FORWARD** intent + **OPEN** grants/ops |

### PD-DL-05 — Tenant / branch authorization

| Field | Value |
| --- | --- |
| Current evidence | LMS Report pattern requires tenant + operating branch match; CanonicalDocument content does not |
| Options | Match LMS Report pattern · Tenant-only · Other |
| Recommendation | **Match LMS Report generate/detail** |
| Risk | Cross-branch IDOR if Auth content reused without branch gate |
| PO approval required | **Yes** (confirm) |
| Status | **CARRIED_FORWARD** / platform |

### PD-DL-06 — Download mechanism

| Field | Value |
| --- | --- |
| Current evidence | Auth proxy stream (no SAS) for CanonicalDocument; CCMS SAS contrast |
| Options | A Proxy stream · B SAS · C Existing MPI content as-is · D Hybrid |
| Recommendation | **A — JWT authenticated proxy stream**; Lab eligibility SoT; Auth byte open |
| Risk | SAS increases URL leakage / stale reuse; MPI-as-is weakens LMS authz |
| PO approval required | **Yes** |
| Status | **OPEN** |

### PD-DL-07 — Inline vs attachment

| Field | Value |
| --- | --- |
| Current evidence | Auth `File(..., fileName)` ≈ attachment; CCMS inline |
| Options | Attachment · Inline preview · Both |
| Recommendation | **Attachment** for Official PDF staff download |
| Risk | Inline may surprise browser PDF handlers; still staff-only |
| PO approval required | **Yes** |
| Status | **OPEN** |

### PD-DL-08 — Filename convention

| Field | Value |
| --- | --- |
| Current evidence | Stored `{BusinessReportNumber}.pdf`; MRN not in LMS stored name |
| Options | Business Report Number · Include MRN · Include patient name · Other |
| Recommendation | **`{BusinessReportNumber}.pdf`**; no MRN in filename/URL |
| Risk | MRN in filename increases PHI leakage in downloads folder / shared PCs |
| PO approval required | **Yes** |
| Status | **OPEN** |

### PD-DL-09 — Download audit requirement

| Field | Value |
| --- | --- |
| Current evidence | PD-ART-09b requires access audit; action string not allowlisted |
| Options | Audit required · Best-effort · None |
| Recommendation | **Required** dedicated action (recommended `DOWNLOAD_OFFICIAL_PDF`) |
| Risk | Unaudited PHI document access |
| PO approval required | **Yes** (confirm action name) |
| Status | **CARRIED_FORWARD** + exact string **OPEN** |

### PD-DL-10 — Audit failure behavior

| Field | Value |
| --- | --- |
| Current evidence | PD-ART-09b fail-closed; Release/generate fail-closed precedents |
| Options | Deny download · Allow download · Best-effort |
| Recommendation | **Deny download** (fail-closed) |
| Risk | Fail-open violates certified PD-ART-09b |
| PO approval required | **Yes** (confirm) |
| Status | **CARRIED_FORWARD** |

### PD-DL-11 — Report Detail vs Reports worklist

| Field | Value |
| --- | --- |
| Current evidence | PD-ART-09c = detail + worklist; UI today Open-only on worklist; no artifact columns |
| Options | Detail only · Detail + worklist · Worklist only |
| Recommendation | **Detail + worklist** per PD-ART-09c; worklist only when eligible |
| Risk | Worklist without eligibility projection causes bad UX or over-fetch |
| PO approval required | **Yes** |
| Status | **CARRIED_FORWARD** + packaging **OPEN** |

### PD-DL-12 — Artifact / CanonicalDocument / Blob failure behavior

| Field | Value |
| --- | --- |
| Current evidence | No staff download path yet; platform content returns null/404 patterns |
| Options | Honest 404/503 · Mask as permission error · Other |
| Recommendation | Honest failure; never return success without bytes; no fake PDF |
| Risk | Masking complicates ops; spoofed success is clinical/safety risk |
| PO approval required | **Yes** |
| Status | **OPEN** |

### PD-DL-13 — Repeated download behavior

| Field | Value |
| --- | --- |
| Current evidence | No rate limit on CanonicalDocument content |
| Options | Unlimited · Rate-limited · Re-auth each time |
| Recommendation | **Allow repeated downloads**; each access audited |
| Risk | Bulk exfil if permission over-granted — mitigate via grants + audit |
| PO approval required | **Yes** |
| Status | **OPEN** |

### PD-DL-14 — Signed URL expiry (if applicable)

| Field | Value |
| --- | --- |
| Current evidence | SAS not used for Auth CanonicalDocument; CCMS ~1h |
| Options | N/A if proxy · If SAS: expiry duration TBD |
| Recommendation | Prefer **N/A (no SAS)**; if SAS chosen, require short TTL + no PHI in URL |
| Risk | Stale URL reuse |
| PO approval required | **Yes** if SAS selected |
| Status | **OPEN** / contingent |

### PD-DL-15 — Historical artifact access

| Field | Value |
| --- | --- |
| Current evidence | Retained; not API-exposed; PD-ART-09 current official |
| Options | Out of CUT C · Read-only history list + download · Admin-only |
| Recommendation | **Out of CUT C** |
| Risk | Scope creep; IDOR |
| PO approval required | **Yes** |
| Status | **OPEN** (default out) |

### PD-DL-16 — Retention interaction

| Field | Value |
| --- | --- |
| Current evidence | PD-PDF-19 deferred; no CanonicalDocument retention engine |
| Options | Defer · Enforce duration now · Soft-delete blocks download |
| Recommendation | **Defer** retention enforcement; download fails closed if content physically missing |
| Risk | Invented retention policy |
| PO approval required | **Yes** if enforcement required now |
| Status | **OPEN** / likely defer |

### PD-DL-17 — Admin / wildcard behavior

| Field | Value |
| --- | --- |
| Current evidence | `*` bypasses LaboratoryAuthz and FE hasPermission |
| Options | Keep platform wildcard · Exclude download from wildcard · Other |
| Recommendation | **Keep platform wildcard**; do not special-case unless security PO requires |
| Risk | Broad admin access — accepted platform pattern today |
| PO approval required | **Yes** if changing wildcard semantics |
| Status | **OPEN** (default keep) |

### PD-DL-18 — Service ownership of content stream

| Field | Value |
| --- | --- |
| Current evidence | Lab owns eligibility/SoT; Auth owns CanonicalDocument/Blob; internal API is register-only today |
| Options | Auth LMS content endpoint + Lab eligibility · Lab download API + Auth internal read · Hybrid ticket |
| Recommendation | Prefer design that keeps **Lab eligibility + branch authz** authoritative and **Auth byte open** private; exact split in readiness after PO chooses PD-DL-06 |
| Risk | Wrong ownership recreates Pathology-style SoT confusion or weakens branch checks |
| PO approval required | **Yes** |
| Status | **OPEN** |

### PD-DL-19 — Production / UAT role grants for download

| Field | Value |
| --- | --- |
| Current evidence | No `lms.reports.*` grants in seeders; B1 used environment-only Lab Manager generate grant for UAT |
| Options | Catalogue-only until ops grant · Seed grants · Environment-only UAT grant |
| Recommendation | Preserve **no production seeder grants**; UAT grant is environment ops (not acceptance of production grants) |
| Risk | Shipping grants in source contradicts PD-ART-13 |
| PO approval required | **Yes** |
| Status | **CARRIED_FORWARD** + ops **OPEN** |

### PD-DL-20 — API error contract codes

| Field | Value |
| --- | --- |
| Current evidence | LMS uses codes like `invalid_state`, `branch_unauthorized`, `report_number_required` |
| Options | Reuse family · New download-specific codes |
| Recommendation | Reuse LMS Report error family where applicable |
| Risk | Inconsistent FE handling |
| PO approval required | Prefer confirm in readiness; PO if user-visible policy |
| Status | **TECHNICAL** / light PO |

---

## 23. Proposed CUT C implementation boundary

**DISCOVERY RECOMMENDATION ONLY — not authorized.**

### Candidate in-boundary areas (if later authorized)

| Area | Candidate |
| --- | --- |
| Authenticated download API | Staff JWT route enforcing eligibility |
| CanonicalDocument / Blob retrieval | Reuse `OpenReadExactAsync` / private container |
| Authorization | Wire `lms.reports.download` + tenant/branch/Report match |
| Audit | Allowlist + emit fail-closed download action |
| Filename / Content-Disposition | Per PD-DL-07/08 |
| Report Detail button | Download Official PDF near artifact metadata |
| Optional worklist action | Per PD-DL-11 |
| Automated + manual tests | Per §21 |
| Catalogue description update | Stale CUT A wording on download permission |

### Explicit exclusions

| Excluded |
| --- |
| PDF generation / renderer changes |
| Artifact model redesign (unless Product Decision proves a required gap — none found for current-only download) |
| Report Release / Report Number / ReportVersion semantics |
| Result / Authorization lifecycle |
| Patient Portal / Patient 360 / NotificationHub / SMS / email / WhatsApp |
| Pathology `lab` / `LabReport` reuse / dual-write |
| Retention engine implementation |
| Amendments / Unrelease / Revoke |
| Historical artifact browser (unless PD-DL-15 approves) |
| SAS / public URLs (unless PD-DL-06/14 explicitly chooses SAS) |
| Production role grants in source seeders (unless PD-DL-19 changes policy) |

---

## 24. Explicit out-of-scope items

Confirmed out of CUT C discovery implementation authority and out of recommended CUT C slice unless future PO expands:

- Patient download / publication  
- NotificationHub / messaging attachments  
- Pathology migration  
- B1 regeneration semantics changes  
- Automatic PDF on Release/Number  
- Publish permission (`lms.reports.publish`)  
- Second audit store / DocumentAccessAudit revival as LMS SoT  

---

## 25. Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| Reusing MPI/lab content endpoints without LMS eligibility/branch gates | **High** | Cross-branch / wrong-permission exposure |
| Accepting arbitrary `CanonicalDocumentId` / artifact id | **High** | IDOR |
| Choosing SAS without audit/expiry design | **High** | Stale URL / Blob exposure |
| Treating catalogue permission as “done” | **Medium** | Still unwired; no grants |
| Worklist download without eligibility projection | **Medium** | UX / accidental over-exposure of actions |
| Historical download scope creep | **Medium** | Needs list API + stronger authz |
| Orphan CanonicalDocument after Failed audit revert | **Medium** | Must key off LMS Succeeded + current pointer |
| Filename MRN leakage if FE invents names | **Medium** | Prefer stored Business Report Number |
| No discovery blocker for Product Decision Review | — | Gaps are expected CUT C prerequisites |

---

## 26. Dependencies

```text
ACCEPTED_L_REP_02B (Released metadata)
        ↓
ACCEPTED_L_REP_03_CUT_A (Business Report Number)
        ↓
ACCEPTED_L_REP_03_CUT_B (current official artifact + CanonicalDocument bytes)
        ↓
THIS DISCOVERY
        ↓
PRODUCT_DECISION_REVIEW (PD-DL-*)
        ↓
[future] Implementation readiness audit (not this task)
        ↓
[future] CUT C implementation (not authorized)
```

### Reusable capabilities (exist)

- `CurrentOfficialArtifactId` + artifact metadata + `CanonicalDocumentId`
- Auth private Blob + `OpenReadExactAsync`
- LMS association `enterprise_lms` / `LmsReportOfficialPdfArtifact`
- Catalogue code `lms.reports.download` (unwired)
- LMS tenant/branch authorization patterns on Report APIs
- Platform audit client + fail-closed patterns (Release / Official PDF generate)
- Report Detail Official PDF panel + worklist Open navigation
- FE authenticated blob download UX patterns elsewhere

### Missing capabilities (CUT C gaps)

- Staff download HTTP endpoint (Lab and/or Auth LMS path)
- Wired backend + FE `lms.reports.download`
- Download audit action + allowlist
- Auth internal **read** contract for LMS bytes (if Lab streams) **or** Auth LMS content route with Lab eligibility
- Worklist eligibility/artifact projection (if worklist download confirmed)
- FE Download controls + API client
- Exact error/disposition/filename contracts after Product Decisions

---

## 27. Readiness classification

```text
READY_FOR_PRODUCT_DECISION_REVIEW
```

| Alternative | Why not |
| --- | --- |
| `BLOCKED` | No evidence gap prevents Product Decision Review; B1 SoT is sufficient for current-official download design |
| `DISCOVERY_REQUIRES_FURTHER_AUDIT` | Repository evidence for artifact SoT, CanonicalDocument access, permissions, UI, and PD-ART carry-forward is sufficient |
| Implementation-ready | **Forbidden** for this task; not claimed |

This classification does **not** authorize implementation, readiness audit execution, or Product Decision Closure.

---

## 28. Next gate

```text
NEXT_GATE = PRODUCT_DECISION_REVIEW
```

Expected sequence after PO review:

1. Product Decision Closure for CUT C (PD-DL-* stamped) — **not this task**  
2. Separate implementation readiness audit — **not this task**  
3. CUT C implementation — **not this task**  

Do **not** start CUT C from this discovery document alone.

---

## Final stamps

```text
DISCOVERY_COMPLETE
NO_IMPLEMENTATION_STARTED
ACCEPTED_L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B
CUT_C_NOT_STARTED
PRODUCT_DECISION_REVIEW_REQUIRED
NEXT_GATE = PRODUCT_DECISION_REVIEW
STOP
```

**STOP.** Do not implement staff download, APIs, UI, permissions, audit allowlists, SAS, Blob endpoints, CanonicalDocument model changes, or Product Decision Closure in this task.
