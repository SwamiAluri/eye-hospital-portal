# L-REP-03 Implementation Readiness Audit

**Date:** 2026-10-12  
**Slice:** L-REP-03 — Report Number + Official PDF Artifact + Staff Download Foundation  
**Mode:** AUDIT ONLY — documentation; no application implementation  

```text
L_REP_03_READINESS_AUDIT_COMPLETE
PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED
L_REP_02B_REMAINS_ACCEPTED
IMPLEMENTATION_NOT_STARTED
READINESS_AUDIT_COMPLETE
CONFIGURATION_REQUIRED = YES
OVERALL = READY_WITH_PREREQUISITE
NEXT_GATE = IMPLEMENTATION_AUTHORIZATION
```

---

## 1. Audit Status

| Field | Value |
| --- | --- |
| Audit mode | Read-only repository inspection + this document |
| Application code modified | **None** |
| Schema / migrations / APIs / UI / permissions modified | **None** |
| L-REP-02B Release modified | **None** |
| Baseline conflict (Release assigns number / PDF / artifact) | **None** |
| Overall readiness | **READY_WITH_PREREQUISITE** |
| Configuration gate | `CONFIGURATION_REQUIRED = YES` (preserved from Product Decision Closure) |
| Next gate | `IMPLEMENTATION_AUTHORIZATION` |

**Meaning of READY_WITH_PREREQUISITE:** Bounded L-REP-03 implementation architecture can proceed against existing LaboratoryApi Report domain, LMS sequence concurrency patterns, CanonicalDocument + Blob, and platform audit/idempotency patterns. Governed configuration stores/values (tenant PDF template, laboratory signatory, operating-branch sequence format) are **missing** and must be completed before PRE-UAT / go-live of dependent capabilities. Configuration gaps are **not** treated as product ambiguity (closure already stamped `CONFIGURATION_REQUIRED = YES`).

---

## 2. Authority

Authoritative Product Decision Closure:

[`enterprise-lms-report-artifact-numbering-download-decision-closure.md`](./enterprise-lms-report-artifact-numbering-download-decision-closure.md)

### Required closure stamps — verified present

```text
PRODUCT_OWNER_DECISIONS_APPROVED
PRODUCT_DECISION_CLOSURE_COMPLETE
PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED
IMPLEMENTATION_NOT_STARTED
CONFIGURATION_REQUIRED = YES
L_REP_02B_REMAINS_ACCEPTED
NEXT_GATE = IMPLEMENTATION_READINESS_AUDIT
```

| Check | Result |
| --- | --- |
| Closure file present | Yes |
| Stamps consistent with prompt | Yes |
| Approved PD-ART-01 … PD-ART-13 (incl. sub-rows) | Yes — 22 approved decision rows |
| F01–F07 OUT OF SCOPE | Yes |
| PD-ART-03 sequence scope | **OPERATING BRANCH** (not tenant) |
| PD-ART-02 interpretation | Separate post-Release L-REP-03 operation; **not** inside L-REP-02B Release transaction |
| This audit reinterprets decisions | **No** |

**STOP condition for missing/inconsistent closure:** Not triggered.

---

## 3. Certified Baseline

### Upstream certified slices

| Slice | Status | Evidence |
| --- | --- | --- |
| L-REP-01 Report Foundation | Certified | `LmsReport` / versions / claims; `ReportFunctions`; migrations `20261012160000_*`, `20261012180000_*` |
| L-REP-02A Finalize | Accepted | `FinalizeAsync`; migration `20261012190000_AddLmsReportFinalizationMetadata` |
| L-REP-02B Release | Accepted metadata-only | `ReleaseAsync`; migration `20261012200000_AddLmsReportReleaseMetadata` |

### Certified lifecycle (unchanged)

```text
Draft → Final → Released
```

### L-REP-02B Release — certified behavior (must remain)

| Does | Does not |
| --- | --- |
| `Status` Final → Released | Assign Report Number |
| Persist `ReleasedAtUtc` / `ReleasedByUserId` | Generate PDF |
| Keep existing current ReportVersion | Create CanonicalDocument |
| Preserve snapshots / source claims | Create download artifact |
| Leave ResultStatus / ResultVersion / CriticalResultEvent unchanged | Publish / notify / amend / unrelease / revoke |

**This audit does not change L-REP-02B.** Future L-REP-03 implementation must not convert Release into automatic PDF/number side effects.

---

## 4. Repository Evidence

Primary evidence roots:

| Area | Path |
| --- | --- |
| LaboratoryApi Report domain | `microservices/laboratory-service/LaboratoryApi/Domain/LmsReport.cs` |
| Report service | `.../Services/ReportService.cs` |
| Report HTTP API | `.../Functions/ReportFunctions.cs` |
| Report DTOs | `.../Services/ReportDtos.cs` |
| DbContext | `.../Data/LaboratoryDbContext.cs` |
| Authz constants | `.../Services/LaboratoryAuthz.cs` |
| Permission catalogue | `microservices/auth-service/AuthService/SeedData/EnterpriseLmsReportsPermissionCatalog.cs` |
| Audit allowlist | `.../Controllers/InternalAuditController.cs` |
| CanonicalDocument | `.../Models/Domain/CanonicalDocument.cs` |
| FE Reports UI | `apps/hospital-portal-web/src/components/lms/reports/` |
| FE API client | `apps/hospital-portal-web/src/lib/lms/lms-reports.api.ts` |
| Product closure | `docs/laboratory-management/enterprise-lms-report-artifact-numbering-download-decision-closure.md` |

Repository search found **no** LaboratoryApi implementation for: Report Number field/sequence, official PDF generation, LMS↔CanonicalDocument association, Report PDF template store, laboratory signatory store, `lms.reports.download` wiring, or Azure Service Bus / Hangfire / Timer job drain inside LaboratoryApi.

---

## 5. Report Domain Audit

### 5.1 Entities

| Item | Evidence |
| --- | --- |
| Aggregate | `LaboratoryApi.Domain.LmsReport` — `Domain/LmsReport.cs` |
| Table | `lms_reports` (EF fluent config `LaboratoryDbContext` ~741–770) |
| Version | `LmsReportVersion` — `Domain/LmsReportVersion.cs` → `lms_report_versions` |
| Sources | `LmsReportVersionSource` → `lms_report_version_sources` |
| Draft claims | `LmsReportDraftSourceClaim` → `lms_report_draft_source_claims` |
| Idempotency | `LmsReportIdempotencyRecord` → `lms_report_idempotency` |

**`LmsReport` properties today:** `Id`, `TenantId`, `OperatingBranchId`, `PatientId`, `OrderId`, `Status`, `CurrentVersionNumber`, `FinalizedAtUtc`, `FinalizedByUserId`, `ReleasedAtUtc`, `ReleasedByUserId`, create/update audit fields, `RowVersion`, `Versions`.

**Absent on aggregate (expected for L-REP-03):** `BusinessReportNumber`, artifact pointer, generation status, CanonicalDocument FK, template/signatory references.

Entity XML docs already state: *“Not CanonicalDocument. Not ResultStatus.”*

### 5.2 Status model

Not a C# enum — string constants in `Domain/ReportEnums.cs` class `ReportStatuses`:

- `Draft`, `Final`, `Released`

### 5.3 Service / persistence

| Item | Evidence |
| --- | --- |
| Interface / impl | `IReportService` / `ReportService` — `Services/ReportService.cs` |
| Repository | **None** — service uses `LaboratoryDbContext` directly |
| DI | `Program.cs` — `AddScoped<IReportService, ReportService>()` |
| Class contract | Comment: *“Does not mutate ResultStatus, attach CanonicalDocument, generate PDF, or bridge Pathology.”* |

### 5.4 Migrations (Report)

| Migration | Effect |
| --- | --- |
| `20261012160000_AddLmsReportFoundation` | `lms_reports`, versions, sources, idempotency |
| `20261012180000_AddLmsReportDraftSourceClaims` | draft source claims |
| `20261012190000_AddLmsReportFinalizationMetadata` | finalize columns |
| `20261012200000_AddLmsReportReleaseMetadata` | release columns |

No migration adds number / PDF / document columns.

### 5.5 APIs

`ReportFunctions` — prefix `/api/lms/reports`:

| Method | Route | Permission | Service |
| --- | --- | --- | --- |
| GET | `lms/reports/eligible-sources` | view \| manage | `ListEligibleSourcesAsync` |
| GET | `lms/reports` | view \| manage | `ListAsync` |
| POST | `lms/reports` | manage | `CreateDraftAsync` |
| GET | `lms/reports/{id}` | view \| manage | `GetAsync` |
| GET | `lms/reports/{id}/versions/{versionNumber}` | view \| manage | `GetVersionAsync` |
| POST | `lms/reports/{id}/versions` | manage | `AppendVersionAsync` |
| POST | `lms/reports/{id}/finalize` | finalize | `FinalizeAsync` |
| POST | `lms/reports/{id}/release` | release | `ReleaseAsync` |

Class comment: *“No PDF/publication.”* **No download / assign-number / generate-PDF endpoints.**

### 5.6 DTOs / FE mirror

- Backend: `Services/ReportDtos.cs` — `ReportDetailDto` / list DTOs include finalize/release metadata + `RowVersion`; **no** number/artifact fields.
- Frontend: `apps/hospital-portal-web/src/lib/lms/lms-reports.api.ts`.

### 5.7 Where L-REP-03 state should safely live (proposal — not implemented)

| Concern | Recommended home | Rationale |
| --- | --- | --- |
| Business Report Number + assignment metadata | Columns on `lms_reports` (Report aggregate) | PD-ART-02c — identifies Report, not ReportVersion |
| Operating-branch sequence counter | New LaboratoryApi sequence table keyed by tenant + **operating branch** (+ period per config) | PD-ART-03; pattern from LMS order/accession counters |
| Number format configuration | New governed config store (branch or tenant-owned policy with branch sequence identity — TBD at implementation auth; values not invented) | Closure: CONFIGURATION_REQUIRED |
| Artifact versions + current official pointer | New LaboratoryApi artifact table (or versioned rows) owned by Report, pointing to Auth CanonicalDocument Id | Clinical SoT stays Laboratory; bytes downstream |
| Generation job status | New LaboratoryApi job table (outbox-style) | PD-ART-05 async; LaboratoryApi has no queue today |
| Template / signatory config identity recorded on artifact | Columns on artifact row | PD-ART-05b / PD-ART-06 / PD-ART-06b honesty |

---

## 6. L-REP-02B Release Audit

### 6.1 Implementation

| Item | Evidence |
| --- | --- |
| Endpoint | `POST lms/reports/{id}/release` — `ReportFunctions.LmsReportRelease` |
| Permission | `LaboratoryAuthz.ReportsRelease` = `lms.reports.release` |
| Service | `ReportService.ReleaseAsync` (`ReportService.cs` ~449–556) |
| Branch auth | `_platform.ValidateUserBranchAsync` + `report.OperatingBranchId == req.OperatingBranchId` |
| Tenant | Query filter `r.TenantId == tenantId` |
| Idempotency | `ReportIdempotencyOperations.ReleaseReport` = `release_report` |
| Concurrency | `ExpectedRowVersion` + `RowVersion++` + `DbUpdateConcurrencyException` → `concurrency_conflict` |
| Audit | `ReportAuditActions.ReleaseReport` = `RELEASE_REPORT`; fail-closed revert via `RevertReleaseAsync` → `503 audit_unavailable` |

### 6.2 Mutations performed by Release

Exact fields set in `ReleaseAsync`:

- `Status = Released`
- `ReleasedAtUtc = now`
- `ReleasedByUserId = actorUserId`
- `UpdatedAtUtc` / `UpdatedByUserId`
- `RowVersion++`

### 6.3 Confirmed absent from Release

Repository inspection of `ReleaseAsync` and ReportFunctions release path found **no**:

- Report Number assignment
- PDF generation / QuestPDF invocation
- CanonicalDocument create/associate
- Blob upload
- PDF job enqueue
- Notification / Patient Portal / Patient 360 publication

**BASELINE CONFLICT:** **None.**

Tests asserting metadata-only release include `LaboratoryApi.Tests/ReportServiceTests.cs` (e.g. Final → Released without new ReportVersion; ResultStatus unchanged; claims retained).

---

## 7. Report Number Audit

### 7.1 Existing LMS Report Number

| Check | Result |
| --- | --- |
| Field on `LmsReport` | **Absent** |
| Sequence table for Report Number | **Absent** |
| Grep `ReportNumber` / `BusinessReportNumber` in LaboratoryApi `*.cs` | **No matches** |
| Assign capability in `lms.reports.*` | **Absent** |

### 7.2 Existing sequence implementations (technical reference only)

| Sequence | Domain / table | Allocator | Scope | Format | Gaps | Reuse |
| --- | --- | --- | --- | --- | --- | --- |
| Order Number | `LmsOrderNumberSequence` / `lms_order_number_sequences` | `OrderService.AllocateOrderNumberAsync` | Tenant + UTC day | Hard-coded `LAB-YYYYMMDD-NNNNNN` | Allowed | Forbidden (unique business id) |
| Collection Task | `LmsCollectionTaskNumberSequence` | `CollectionService.AllocateTaskNumberAsync` | Tenant + UTC day | `COL-…` | Allowed | Forbidden |
| Accession | `LmsAccessionNumberSequence` | `SpecimenService.AllocateAccessionAsync` | Tenant + UTC day | `ACC-…` | Explicitly allowed on revert | Forbidden |
| Specimen Barcode | `LmsBarcodeNumberSequence` + `LmsSpecimenBarcodeConfiguration` | `SpecimenBarcodeService.AllocateBarcodeValueAsync` | Tenant + UTC day (config Scope=TENANT) | Constant-locked `SPC-…` | Allowed | Forbidden |
| Visit Token (Auth) | `TokenSequence` | `VisitService.GenerateTokenAsync` | **Branch** + day | Branch prefix | Weak | Not LMS-certified concurrency |

**Common LMS concurrency pattern:** counter table + PostgreSQL `INSERT … ON CONFLICT DO UPDATE … RETURNING` (not `CREATE SEQUENCE`). InMemory uses process-local gate — not production correctness.

**No shared `NumberSequence` / `SequenceAllocator` abstraction exists.**

### 7.3 Product scope rule (must not copy)

Per PD-ART-03 and closure §8: Report Number sequence scope is **OPERATING BRANCH**.  
Order/Accession/Barcode/Collection sequences are **tenant + day**. Copying their product scope would be incorrect.

Forbidden sources for Report Number values: Order number, Accession number, Barcode number (closure §8).

### 7.4 Safest implementation pattern (recommendation)

| Requirement | Pattern |
| --- | --- |
| Concurrent assignment | New counter table with unique key including `TenantId` + `OperatingBranchId` (+ sequence period per config); PG upsert increment |
| Exactly-once per Report | Nullable unique `BusinessReportNumber` on `lms_reports`; assign only when null + Status=Released; unique `(TenantId, OperatingBranchId, BusinessReportNumber)` or equivalent |
| Immutable | Reject reassignment when already set; no UPDATE path that changes number |
| No reuse | Never decrement / recycle counter; unique constraint on assigned values |
| Gaps allowed | Do not roll back sequence on later PDF failure (aligns with accession/barcode practice + PD-ART-03b / PD-ART-02d) |
| Idempotent retry | `lms_report_idempotency` op e.g. `assign_report_number`; replay returns same number |
| Tenant / branch isolation | Existing `ValidateUserBranchAsync` + `OperatingBranchId` match + tenant filter |

### 7.5 Reusability classification

| Source | Class |
| --- | --- |
| LMS upsert concurrency pattern | **YELLOW → GREEN if adapted** to operating-branch key + new format config |
| Barcode configuration entity **shape** | **YELLOW** (effective dating / prefix/width fields) — **Scope=TENANT must not be copied** |
| TokenSequence branch key | **YELLOW** (branch in key only; locking inadequate) |
| Existing Report Number | **RED** — does not exist |
| Using Order/Accession/Barcode values as Report Numbers | **RED** — forbidden |

---

## 8. Numbering Configuration Audit

| Capability | Repository status |
| --- | --- |
| LMS Report Number format config | **Absent** → `CONFIGURATION_PREREQUISITE_MISSING` |
| Operating-branch Report sequence config | **Absent** → `CONFIGURATION_PREREQUISITE_MISSING` |
| Prefix / width / reset period for Report Number | **Absent** — values must not be invented |
| Barcode format config (reference only) | Present: `LmsSpecimenBarcodeConfiguration` — tenant-scoped, constant-locked |
| Order/Accession/Collection format config | Hard-coded in allocators — not a Report config store |

Closure §11 already stamped these as prerequisites. Current repository **confirms** absence.

---

## 9. PDF Renderer Audit

| Renderer | Project | Sync/async | Storage | LMS suitability |
| --- | --- | --- | --- | --- |
| QuestPDF `PatientSummaryPdfService` | AuthService | In-process sync build on HTTP | Bytes to HTTP | **YELLOW reference only** — not LMS SoT |
| QuestPDF `ImagingExportService` | AuthService | In-process sync | Azure Blob `imaging-reports` | **YELLOW reference** |
| Auth `ReportService` placeholder | AuthService | Returns text placeholder | N/A | Unsuitable |
| Pathology LabReport attach | AuthService | Upload client file | CanonicalDocument + Blob | Separate Pathology SoT — no dual-write |
| PdfPig extractors | CcmsApi / InventoryApi | Extract only | N/A | Unsuitable |
| Frontend jsPDF | hospital-portal-web | Client | Local | **Not** official clinical artifact |
| LaboratoryApi PDF package | — | — | — | **ABSENT** (`LaboratoryApi.csproj` has no QuestPDF) |

**Architecture requirement preserved:**

- Clinical SoT: `LmsReport` / `LmsReportVersion`
- Downstream bytes: CanonicalDocument + Blob
- Renderer must not make AuthService QuestPDF the LMS Report clinical owner

**Recommendation:** Add rendering capability to LaboratoryApi (or a Laboratory-owned worker sharing LaboratoryApi DB), using QuestPDF as technology reference from AuthService — **not** invoking Auth clinical Report placeholders or Pathology LabReport as SoT.

---

## 10. Async Infrastructure Audit

### 10.1 LaboratoryApi today

| Mechanism | Status |
| --- | --- |
| Azure Service Bus | **Not referenced** in microservice packages/source |
| Durable Functions | **Absent** |
| Hangfire / Timer triggers in LaboratoryApi | **Absent** — HTTP-only Functions |
| Report PDF job table | **Absent** |
| LMS “work queues” | Staff worklist queries (`ResultService` / `CriticalResultService`) — **not** job processors |

### 10.2 Closest reusable async patterns (other services)

| Pattern | Location | Notes |
| --- | --- | --- |
| IP Integration Outbox | `IpManagementService` — `IntegrationOutboxService` + Hangfire job + Timer backup `OutboxFunctions` | DB outbox + drain; idempotency key; retry/dead |
| Auth Billing CCMS Outbox | `BillingCcmsOutboxProcessor` (`BackgroundService`) | Poll drain |
| LMS Report idempotency | `lms_report_idempotency` | Sync HTTP claim/complete/abandon — extendable with new ops |

### 10.3 Recommended mechanism for Generate Official PDF

**Authoritative recommendation:** LaboratoryApi-owned **PDF job table + drain worker** shaped like IP outbox (Timer and/or Hangfire **inside LaboratoryApi** if approved for LMS). Do **not** introduce Azure Service Bus as a new platform bus without separate platform authorization. Do **not** host LMS job SoT in AuthService.

| Concern | Recommendation |
| --- | --- |
| Command | `POST /api/lms/reports/{id}/official-pdf` (+ Idempotency-Key, operatingBranchId, expectedRowVersion) |
| Eligibility | Status=Released + BusinessReportNumber assigned + template/signatory configured |
| Correlation | Persist `CorrelationId` on job; include in audit |
| Idempotency | New op `generate_official_pdf` on `lms_report_idempotency` |
| States | Queued → Running → Succeeded \| Failed (optional Dead) |
| Failure | Must not clear Report Number; must not change Report.Status |
| Status poll | `GET …/official-pdf` or artifact fields on Report detail |
| Concurrency | Claim job / unique in-flight constraint; current-official pointer update under RowVersion/governance |
| Audit | Dedicated request + completion/failure actions via `IPlatformAuditClient` |

---

## 11. CanonicalDocument Audit

### 11.1 Existing infrastructure (AuthService)

| Piece | Path |
| --- | --- |
| Entity | `AuthService/Models/Domain/CanonicalDocument.cs` |
| Associations | `CanonicalDocumentAssociation` + `CanonicalDocumentAssociations` constants |
| Identity | `CanonicalDocumentIdentityService` |
| Blob | `BlobStorageService` / `IBlobStorageService` — private exact-key stream; **no SAS** for downloads |
| MPI API | `PatientCanonicalDocumentsController` |
| Lab Pathology adapter | `LabReportCanonicalDocumentService` + `LabReportsController` |
| Internal register | `InternalCanonicalDocumentController` (`register-external`) |
| Integrity | SHA-256 `content_hash`; unique active (tenant, patient, hash) |
| Supersession | `superseded_by_document_id`; status `active` / `superseded` |
| Retention duration on CanonicalDocument | **Not present** as first-class retention policy field |

`CanonicalDocument.PatientId` is **required** (NOT NULL). For LMS Official PDF, set `PatientId = LmsReport.PatientId` (correct patient identity for hash uniqueness).

### 11.2 Suitability for LmsReport Official PDF

| Question | Answer |
| --- | --- |
| Can bytes/identity be reused? | **Yes** |
| Must LabReport association be reused? | **No — unsafe** (wrong SoT: Auth `LabReport`) |
| Must MPI association be created? | **No — unsafe** (Patient 360 / wrong ownership surface) |
| New LMS association required? | **Yes** |
| Does CanonicalDocument become clinical SoT? | **No** — Laboratory `LmsReport` / version / artifact pointer remains SoT |

**STOP condition “CanonicalDocument cannot safely represent LMS Report artifact”:** **Not triggered**, provided new LMS association + Laboratory pointer are introduced (not LabReport/MPI).

---

## 12. Artifact Association Audit

### 12.1 Existing association domains

| Domain | EntityType | Notes |
| --- | --- | --- |
| `mpi` | `patient` | Patient 360 General |
| `counselling` | `CounselingSessionDocument` / `patient` | Session vs patient-level |
| `ccms` | `CcmsDocument` | External container pointer |
| `lab` | `LabReport` | Pathology only |

**Missing:** Encounter / Visit / Order / `LmsReport` / `LmsReportVersion` association constants.

### 12.2 Smallest safe Report-specific association model (recommendation)

1. Add Auth constants, e.g. `LmsDomain = "lms"`, `LmsReportVersionEntityType = "LmsReportVersion"` (prefer version-scoped lineage).
2. On successful PDF persist: `ResolveOrCreateAsync` / equivalent with `PatientId = report.PatientId`, classification e.g. `LmsOfficialPdf`.
3. `EnsureAssociationAsync(documentId, "lms", "LmsReportVersion", versionId, category: "OfficialPdf", role: "primary")`.
4. **No** MPI association. **No** `LabReport` association.
5. Laboratory SoT: artifact table / pointer columns holding `CanonicalDocumentId`, content hash, template version identity, generation metadata, `IsCurrentOfficial`.

Cross-DB Guids without FK to LaboratoryApi match existing CCMS/Lab patterns.

---

## 13. Artifact Versioning Audit

| Capability | Existing? | Notes |
| --- | --- | --- |
| CanonicalDocument supersession | Yes | MPI replace pattern; Lab attach rejects second different hash |
| CanonicalDocument version number | No | |
| Template / generation metadata on CanonicalDocument | No | |
| LMS ReportVersion clinical versioning | Yes | Immutable `LmsReportVersion` rows |
| LMS Official PDF artifact versioning | **No** | Missing model |
| Current official pointer | **No** | Must be unambiguous per PD-ART-09 |

**Gap:** New Laboratory-owned artifact version model required:

- Multiple retained artifact rows per Report (or ReportVersion)
- Monotonic artifact version
- Exactly one `IsCurrentOfficial = true` (filtered unique)
- Immutable bytes via CanonicalDocument content hash
- Template version identity, generated-by, generated-at, status, failure info

CanonicalDocument supersession may optionally mirror regeneration, but **current official pointer must live in LaboratoryApi** so clinical SoT remains clear.

---

## 14. Template Configuration Audit

| Need | Status |
| --- | --- |
| Tenant-level LMS Report PDF template store | **CONFIGURATION_PREREQUISITE_MISSING** |
| Branding / header / footer / layout for LMS Reports | **Absent** as governed LMS config |
| Org/tenant logo URLs elsewhere | Exist (`Organization.LogoUrl`, tenant `CompanyLogoUrl`) but **not** LMS Report template configuration |
| Imaging `ReportTemplate` string enum | In-memory export option only — not LMS governed template |

**Smallest required foundation (not implemented):** Tenant-scoped governed template configuration with effective version identity recorded on each artifact generation. Do **not** invent default template bytes.

---

## 15. Signatory Configuration Audit

| Search | Result |
| --- | --- |
| Laboratory signatory / report signatory config in LaboratoryApi | **None** |
| Signature image store for LMS PDF | **None** |
| Infer from Ordering Provider / Responsible Clinician / Finalizer / Releaser | **Forbidden** by PD-ART-06b |

**CONFIGURATION_PREREQUISITE_MISSING** — configured laboratory signatory store must exist before official PDF go-live. No fallback invented by this audit.

---

## 16. Download Audit

### 16.1 Existing patterns

| Route | Authz | Stream | Audit-before-download | SAS |
| --- | --- | --- | --- | --- |
| `GET /api/patients/{patientId}/documents/{id}/content` | `patient.patient_document.download` | `OpenReadExactAsync` | **No** | No |
| `GET …/lab-reports/{id}/report/content` | `patient.view` + lab assoc | same | **No** | No |

### 16.2 LMS download today

- Catalogue code `lms.reports.download` exists (`EnterpriseLmsReportsPermissionCatalog`, `LaboratoryAuthz.ReportsDownload`, FE `LMS_REPORTS_PERMISSIONS.download`).
- **Not wired** to any `ReportFunctions` endpoint.
- FE tests assert no `downloadPdf` UI (`enterprise-lms-reports-ui.test.ts`).

### 16.3 Required L-REP-03 download pattern

Eligibility: `Status == Released` + current official artifact available + `lms.reports.download` + tenant + operating branch match.

**Audit:** Fail-closed — required audit write must succeed **before** artifact bytes are returned (PD-ART-09b). Reuse `IPlatformAuditClient` fail-closed style from `ReleaseAsync` (not unused `DocumentAccessAudit` table alone).

**Transport:** Backend private blob stream (no client SAS), consistent with `IBlobStorageService.OpenReadExactAsync`.

---

## 17. Reports UI Audit

| Surface | Path |
| --- | --- |
| Worklist route | `/dashboard/lms/reports` — `app/dashboard/lms/reports/page.tsx` |
| Worklist UI | `components/lms/reports/ReportsWorkbench.tsx` |
| Detail route | `/dashboard/lms/reports/[id]` — `app/dashboard/lms/reports/[id]/page.tsx` |
| Detail UI | `components/lms/reports/ReportDetailView.tsx` |
| API client | `lib/lms/lms-reports.api.ts` |
| Permissions | `lib/lms/lms-permissions.ts` |
| UI honesty tests | `lib/lms/enterprise-lms-reports-ui.test.ts` |

### Current honesty (must preserve for Release)

Detail copy states Finalize freezes content; Release is staff-only metadata; **not** PDF/download/patient-visible/notification. Release confirmation states it does **not** generate PDF.

### Future UI touchpoints (not implemented)

| Surface | Required L-REP-03 UI |
| --- | --- |
| Report detail | Show Report Number when Released + assigned; Generate Official PDF action; honest async status; Download when current official artifact available |
| Reports worklist | Download when eligible; honest status |
| Release UI | **Meaning unchanged** — must not imply number/PDF/artifact |

Use existing Hospital Portal design system / LMS Reports patterns. No new UI framework.

---

## 18. Permission Audit

### 18.1 Existing catalogue (`EnterpriseLmsReportsPermissionCatalog`)

| Code | Status |
| --- | --- |
| `lms.reports.view` | Seeded catalogue; wired for read APIs |
| `lms.reports.manage` | Seeded; wired for create/append |
| `lms.reports.finalize` | Seeded; wired for finalize |
| `lms.reports.release` | Seeded; wired for release |
| `lms.reports.download` | Seeded catalogue; **not wired** to API/UI |
| `lms.reports.publish` | **Must remain absent** |

Mirrored in: `LaboratoryAuthz`, FE `LMS_REPORTS_PERMISSIONS`, tests `EnterpriseLmsReportsPermissionTests.cs`.

### 18.2 Recommended new capability codes (catalogue only — no role grants)

Following existing `lms.reports.<action>` convention (`view` / `manage` / `finalize` / `release` / `download`):

| Capability | Recommended code | Notes |
| --- | --- | --- |
| Assign Report Number | `lms.reports.assign_number` | New catalogue definition required |
| Generate Official PDF | `lms.reports.generate` | New catalogue definition required; distinct from download |
| Download Official PDF | `lms.reports.download` | Wire existing code |

**PD-ART-13:** Production role grants = **NONE**. This audit does not seed grants. Implementation must only add catalogue definitions + wire checks; role assignment remains out-of-band / environment-governed.

---

## 19. Audit Allowlist Audit

### 19.1 Existing Report actions

| Action | Domain constant | Allowlist |
| --- | --- | --- |
| `CREATE_REPORT_DRAFT` | `ReportAuditActions` | `InternalAuditController.AllowedActions` |
| `APPEND_REPORT_VERSION` | same | yes |
| `FINALIZE_REPORT` | same | yes |
| `RELEASE_REPORT` | same | yes |

Resources: `LmsReport`, `LmsReportVersion` in `AllowedResourceTypes`.

Fail-closed mutation pattern: `IPlatformAuditClient.WriteAsync` → on failure revert + `503 audit_unavailable` (`ReleaseAsync` / `FinalizeAsync`).

### 19.2 Recommended new actions (names for future allowlist task — not modified here)

| Event | Recommended action |
| --- | --- |
| Report Number assignment | `ASSIGN_REPORT_NUMBER` |
| Official PDF generation requested | `REQUEST_OFFICIAL_PDF` |
| Official PDF generation succeeded | `OFFICIAL_PDF_GENERATED` |
| Official PDF generation failed | `OFFICIAL_PDF_FAILED` |
| Staff download of official artifact | `DOWNLOAD_OFFICIAL_PDF` |

Implementation must add these to:

1. `ReportAuditActions` (LaboratoryApi)
2. `InternalAuditController.AllowedActions` (AuthService) — fail-closed if missing
3. Possibly `AllowedResourceTypes` if a new resource type is introduced (prefer reuse `LmsReport` / add `LmsReportArtifact` only if needed)

Correlation: continue existing audit details pattern including `reportId`, `operatingBranchId`, actor, and for download/generate include artifact/document ids without logging PHI content.

**This audit does not modify the allowlist.**

---

## 20. Data Model Gap Analysis

Minimum proposed model (documentation only — **no migrations created**).

### 20.1 `lms_reports` additions

| Column | Type | Null | Constraints | Purpose |
| --- | --- | --- | --- | --- |
| `business_report_number` | `varchar` (length per config max) | YES until assigned | Unique within `(tenant_id, operating_branch_id, business_report_number)` when not null | Immutable business identity |
| `business_report_number_assigned_at_utc` | `timestamptz` | YES | — | Assignment metadata |
| `business_report_number_assigned_by_user_id` | `uuid` | YES | — | Assignment actor |
| (existing) `row_version` | `int` | NO | concurrency token | Optimistic concurrency for assign/pointer updates |

### 20.2 Operating-branch sequence table (new)

Suggested name: `lms_report_number_sequences`

| Column | Type | Null | Constraints | Purpose |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | NO | PK | Identity |
| `tenant_id` | `uuid` | NO | part of unique | Tenant isolation |
| `operating_branch_id` | `uuid` | NO | part of unique | **PD-ART-03 scope** |
| `sequence_period_key` | `varchar` / `date` | NO | part of unique | Period per config (e.g. UTC day / none) — **value policy CONFIGURATION_REQUIRED** |
| `last_value` | `int` | NO | CHECK ≥ 0 | Allocation counter |
| Unique | `(tenant_id, operating_branch_id, sequence_period_key)` | | Race-safe upsert key | |

### 20.3 Number format configuration (new — CONFIGURATION_REQUIRED)

Store TBD (new table or extension of future LMS config). Minimum fields conceptually: tenant/branch applicability, prefix, width, reset/period policy, effective-from, active flag, format code. **Values not invented.**

### 20.4 Artifact table (new)

Suggested name: `lms_report_artifacts`

| Column | Type | Null | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | NO | Artifact identity |
| `tenant_id` | `uuid` | NO | Isolation |
| `report_id` | `uuid` | NO | FK → `lms_reports` |
| `report_version_id` | `uuid` | NO | FK → `lms_report_versions` (snapshot rendered) |
| `artifact_version` | `int` | NO | Monotonic per report |
| `is_current_official` | `bool` | NO | Exactly one true per report (filtered unique) |
| `status` | `varchar` | NO | e.g. Generating / Available / Failed |
| `canonical_document_id` | `uuid` | YES | Downstream document id when Available |
| `content_hash` | `varchar` | YES | Integrity |
| `template_config_id` / `template_version_identity` | `varchar`/`uuid` | YES | PD-ART-05b honesty |
| `signatory_config_id` / identity | `varchar`/`uuid` | YES | PD-ART-06b honesty |
| `generated_by_user_id` | `uuid` | YES | Actor |
| `generated_at_utc` | `timestamptz` | YES | Timestamp |
| `failure_code` / `failure_message` | `varchar` | YES | Honest failure (no PHI) |
| Unique | `(report_id, artifact_version)` | | Version lineage |
| Filtered unique | `(report_id) WHERE is_current_official` | | PD-ART-09 |

### 20.5 PDF job table (new)

Suggested name: `lms_report_pdf_jobs`

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Job id |
| `tenant_id` / `report_id` / `operating_branch_id` | `uuid` | Scope |
| `correlation_id` | `varchar` | Correlation |
| `idempotency_key` / hash | | Align with claim |
| `status` | | Queued/Running/Succeeded/Failed/Dead |
| `attempt_count` / `next_attempt_at_utc` | | Retry |
| `artifact_id` | `uuid` nullable | Resulting artifact |
| timestamps / actor | | Auditability |

### 20.6 Template / signatory configuration tables

**CONFIGURATION_PREREQUISITE_MISSING** — exact tables TBD in implementation authorization after config design; must be tenant-level governed (template) and configured laboratory signatory (PD-ART-06 / 06b). Retention duration only if enforcement required — do not invent duration.

### 20.7 Idempotency ops (extend constants — not schema)

Add operation strings to `ReportIdempotencyOperations`:

- `assign_report_number`
- `generate_official_pdf`

Reuse table `lms_report_idempotency` unique `(TenantId, IdempotencyKey)`.

---

## 21. API Gap Analysis

Proposed shapes aligned with existing `lms/reports/{id}/…` + body `operatingBranchId` + `expectedRowVersion` + Idempotency-Key header patterns. **Contracts not finalized as production OpenAPI** — unresolved items marked.

### 21.1 Assign Report Number

| Field | Proposal |
| --- | --- |
| Method / route | `POST /api/lms/reports/{id}/assign-number` |
| Permission | `lms.reports.assign_number` |
| Tenant / branch | JWT tenant; `ValidateUserBranchAsync`; Report.OperatingBranchId match |
| Eligibility | `Status == Released` and number null |
| Idempotency | Required; op `assign_report_number` |
| RowVersion | `expectedRowVersion` required |
| Success | `200` Report detail including `businessReportNumber` |
| Failures | `400` validation; `403` branch; `404`; `409` invalid_state / concurrency / already assigned semantics; `503` audit_unavailable |
| Audit | `ASSIGN_REPORT_NUMBER` |

### 21.2 Request Official PDF generation

| Field | Proposal |
| --- | --- |
| Method / route | `POST /api/lms/reports/{id}/official-pdf` |
| Permission | `lms.reports.generate` |
| Eligibility | Released + number assigned + template/signatory configured |
| Async | Enqueue job; return `202` or `200` with job/artifact status DTO |
| Idempotency | `generate_official_pdf` |
| Failures | `409` Final/Draft; `409` number_missing; `409` template_missing / signatory_missing (config); concurrency; `503` audit |
| Audit | `REQUEST_OFFICIAL_PDF` (+ later GENERATED/FAILED from worker) |

### 21.3 Query artifact / generation status

| Field | Proposal |
| --- | --- |
| Method / route | `GET /api/lms/reports/{id}/official-pdf` and/or fields on `GET /api/lms/reports/{id}` |
| Permission | `lms.reports.view` (status) — download remains separate |
| Unresolved | Exact DTO field names — finalize at implementation authorization |

### 21.4 Download current official artifact

| Field | Proposal |
| --- | --- |
| Method / route | `GET /api/lms/reports/{id}/official-pdf/content` (or `/download`) |
| Permission | `lms.reports.download` |
| Eligibility | Released + current official Available |
| Audit | `DOWNLOAD_OFFICIAL_PDF` **before** stream; fail-closed |
| Response | `application/pdf` stream |
| Failures | `403` permission/branch; `404`/`409` missing artifact / not Released; `503` audit_unavailable |

### 21.5 Unchanged

`POST …/release` — **no** number/PDF side effects.

---

## 22. Security Analysis

| Control | Existing reusable mechanism | L-REP-03 requirement |
| --- | --- | --- |
| Tenant isolation | Report queries filter `TenantId`; JWT tenant | Preserve |
| Operating branch | `PlatformReferenceClient.ValidateUserBranchAsync` + OperatingBranchId match | Preserve on assign/generate/download |
| Staff-only | LMS Report APIs are staff JWT | No patient download APIs |
| Permissions | `LaboratoryAuthz` + catalogue | Wire download; add assign_number + generate; **no role grants** |
| Patient Portal / 360 | Not present for LMS Reports | Keep OUT OF SCOPE |
| Blob bypass | Private exact-key open; no SAS | Downloads must go through Report authz gate |
| CanonicalDocument bypass | Must not expose Official PDF via MPI patient document APIs | No MPI association |
| Download audit fail-closed | Pattern on Release mutations | Apply to download |

**STOP conditions for authz/tenant isolation:** **Not triggered** — reusable services exist.

Reusable services: `LaboratoryAuthz`, `IPlatformReferenceClient.ValidateUserBranchAsync`, `IPlatformAuditClient`, Auth CanonicalDocument identity (downstream only).

---

## 23. Idempotency / Concurrency Analysis

### Existing LMS Report pattern

- Table `lms_report_idempotency` unique `(TenantId, IdempotencyKey)`
- `ClaimIdempotencyAsync` / `CompleteIdempotencyAsync` / `TryAbandonIdempotencyAsync`
- Same key + same hash → replay; mismatch → conflict
- Report mutations use `ExpectedRowVersion` / `RowVersion`

### Apply to L-REP-03

| Concern | Pattern |
| --- | --- |
| Concurrent number assign | Upsert sequence + unique business number + RowVersion; one winner |
| Retry after success | Idempotency replay returns same number; no second allocation |
| Concurrent PDF generate | Single in-flight job claim / idempotency; current-official update transactional |
| Regeneration | New artifact version; flip current pointer under governance; retain prior |
| Download | Non-mutating clinically; still audit-gated |
| Stale RowVersion | `409 concurrency_conflict` |
| Duplicate idempotency key different body | Existing conflict semantics |

Do **not** invent a new concurrency framework if adapting these patterns.

---

## 24. Failure Semantics

| Scenario | Required behavior | Source |
| --- | --- | --- |
| A. Number assignment failure | No number persisted; sequence gap may occur (allowed); fail closed on audit | PD-ART-03b; Release-style audit |
| B. PDF queue failure | Honest error; Status unchanged; number retained | PD-ART-02d / §9 |
| C. PDF rendering failure | Job Failed; number retained; retry allowed | PD-ART-02d |
| D. Blob persistence failure | No Available artifact; number retained | Closure §9 |
| E. CanonicalDocument persistence failure | Same as D; no ambiguous current official | PD-ART-09 |
| F. Audit failure (mutations / download) | Fail closed; download must not return bytes | PD-ART-09b |
| G. Download failure | No clinical mutation; client error | — |
| H. Concurrent assignment | Exactly one number | PD-ART §14 |
| I. Concurrent generation | No ambiguous current official | PD-ART-09 |
| J. Stale RowVersion | `409 concurrency_conflict` | Existing |
| K. Duplicate idempotency key | Replay or conflict per hash | Existing |
| L. Template missing | Deny generate; **CONFIGURATION_REQUIRED** — do not invent template | PD-ART-06 |
| M. Signatory missing | Deny generate; **CONFIGURATION_REQUIRED** — do not invent signatory | PD-ART-06b |

Where closure does not define recovery UX copy, implementation may use existing LMS error code style (`invalid_state`, `audit_unavailable`, etc.) without inventing business recovery policies beyond the above.

---

## 25. Test Gap Analysis

### 25.1 Existing test anchors

| Project / file | Coverage |
| --- | --- |
| `LaboratoryApi.Tests/ReportServiceTests.cs` | Draft/Finalize/Release, idempotency, branch/tenant, audit fail-closed, concurrency |
| `LaboratoryApi.Tests/ReportPostgresConcurrencyTests.cs` | Postgres concurrent draft claims |
| `LaboratoryApi.Tests/LaboratoryDbContextShellTests.cs` | Entity presence |
| `AuthService.Tests/EnterpriseLmsReportsPermissionTests.cs` | Catalogue codes |
| `AuthService.Tests/InternalAuditControllerTests.cs` | Allowlisted report actions |
| `AuthService.Tests/CanonicalDocumentIdentityTests.cs` / `LabReportCanonicalDocumentTests.cs` / counselling / internal register | Document identity patterns |
| `apps/.../enterprise-lms-reports-ui.test.ts` | UI honesty: no PDF/download on Release |

### 25.2 Proposed L-REP-03 test matrix

**REPORT NUMBER**

- Released only; Draft/Final denied
- Operating-branch sequence; tenant isolation; branch isolation
- Immutable; gaps allowed; no reuse
- Concurrency (Postgres); idempotency; authorization; audit
- Visibility only when Released + assigned

**PDF**

- Released only; Final denied; number required
- Template missing / signatory missing denied
- Snapshot source; async job; retry; failure retains number
- Artifact version; previous retained; current official unique
- Concurrency / idempotency

**DOWNLOAD**

- Released + artifact; Final denied; missing artifact denied
- Permission / wrong branch / wrong tenant denied
- Audit failure denied (fail-closed)
- Current official selected
- Detail + worklist surfaces (FE)

**REGRESSION**

- L-REP-01 / 02A / 02B unchanged (Release still metadata-only)
- Source claims; Result lifecycle; Critical Results
- Orders / Collection / Specimen / Receiving / Barcode
- Legacy Pathology; Patient Portal; Patient 360

---

## 26. Configuration Readiness

| # | Configuration | Classification | Notes |
| --- | --- | --- | --- |
| 1 | Tenant Report PDF template | **MISSING** / `CONFIGURATION_PREREQUISITE_MISSING` | Implementation + environment config; blocks PRE-UAT/go-live of PDF |
| 2 | Laboratory signatory | **MISSING** | Same; no fallback from Finalizer/Releaser |
| 3 | Operating-branch sequence | **MISSING** (infra) | Implementation work (new sequence table); format values still config |
| 4 | Number format (prefix/width/reset) | **MISSING** | CONFIGURATION_REQUIRED; blocks PRE-UAT of numbering honesty |
| 5 | Template version identity recording | **MISSING** | Mechanism = implementation; values = config |
| 6 | Retention duration | **BLOCKED only if enforcement required without duration** | Do not invent; if enforcement not in L-REP-03 scope, defer |

| Item | Implementation vs environment | Blocks PRE-UAT? | Blocks go-live? |
| --- | --- | --- | --- |
| Template store + bytes | Both (store code + configured template) | Yes for PDF path | Yes for PDF path |
| Signatory identity | Both | Yes for PDF path | Yes for PDF path |
| Sequence table | Implementation | Numbering path needs code | Yes for numbering |
| Format values | Environment/governed config | Yes for numbering | Yes |
| Retention | Config if enforced | Only if enforcement in scope | Same |

**READY_WITH_EXISTING_INFRASTRUCTURE:** LMS counter upsert pattern; CanonicalDocument+Blob; platform audit; Report idempotency; branch validation — reusable as technical foundations, not as completed Report Number/PDF config.

---

## 27. Proposed Implementation Cuts

Validated against repository architecture (HTTP-only LaboratoryApi, Auth CanonicalDocument, no LMS PDF today).

### CUT A — Report Number foundation

| Item | Scope |
| --- | --- |
| Scope | Assign/immutable/visibility of operating-branch Business Report Number; no PDF |
| Projects | LaboratoryApi (+ Tests); AuthService catalogue + audit allowlist; FE detail/worklist display + API client |
| Schema | `business_report_number*` on `lms_reports`; `lms_report_number_sequences`; number format config store |
| APIs | `POST …/assign-number`; detail/list DTO fields |
| Permissions | Catalogue `lms.reports.assign_number` (**no role grants**) |
| Audit | `ASSIGN_REPORT_NUMBER` + allowlist |
| UI | Show number when Released+assigned; Release UI unchanged |
| Tests | Number matrix + L-REP-02B regression |
| Config prereq | Format/prefix/width/reset + branch sequence readiness |
| UAT boundary | Number assign/visibility/concurrency; Final denied; Release still no number |

### CUT B — Official PDF artifact foundation

| Item | Scope |
| --- | --- |
| Scope | Explicit async generate; CanonicalDocument+Blob; artifact versions; current official |
| Projects | LaboratoryApi (+ job drain); AuthService association constants/adapter/tests; FE generate + status |
| Schema | `lms_report_artifacts`; `lms_report_pdf_jobs`; template/signatory config stores |
| APIs | `POST/GET …/official-pdf` |
| Permissions | Catalogue `lms.reports.generate` (**no role grants**) |
| Audit | `REQUEST_OFFICIAL_PDF`, `OFFICIAL_PDF_GENERATED`, `OFFICIAL_PDF_FAILED` |
| UI | Generate action + honest async states; Release still no PDF implication |
| Tests | PDF matrix + regression |
| Config prereq | Template + signatory + number already assignable |
| Depends on | CUT A (PD-ART-11 number on PDF) |

### CUT C — Staff download

| Item | Scope |
| --- | --- |
| Scope | Detail + worklist download of current official artifact; fail-closed audit |
| Projects | LaboratoryApi download endpoint; FE detail + worklist; tests |
| Schema | None beyond CUT B artifact pointer |
| APIs | `GET …/official-pdf/content` |
| Permissions | Wire `lms.reports.download` |
| Audit | `DOWNLOAD_OFFICIAL_PDF` fail-closed |
| UI | Download when eligible |
| Tests | Download matrix |
| Depends on | CUT B artifact Available |

**Rationale for A→B→C:** Matches PD-ART-12 packaging (numbering + PDF as bounded capability) while keeping download as the third gated cut once artifact exists; preserves L-REP-02B unchanged throughout.

---

## 28. Regression Boundaries

| Area | Boundary |
| --- | --- |
| L-REP-02B | Remains Final → Released with `ReleasedAtUtc` / `ReleasedByUserId` only |
| Auto side effects on Release | **Forbidden:** number, PDF, artifact, notify, publish |
| ResultStatus / ResultVersion / CriticalResultEvent | Unchanged |
| Source claims | Unchanged by L-REP-03 |
| Legacy Pathology | Unchanged; no LabReport SoT substitution |
| Patient Portal / Patient 360 | Unchanged / no publication |
| Orders / Collection / Specimen / Receiving / Barcode | Unchanged |

---

## 29. Manual UAT Requirements

After implementation + PRE-UAT (not claimed ready now), manual UAT must show at minimum:

1. Released Report without Number  
2. Number assignment succeeds  
3. Number visibility (Released + assigned only)  
4. Operating-branch sequence behavior  
5. Final cannot receive number  
6. Release does not create number/PDF  
7. Generate Official PDF (explicit)  
8. Async generation status honesty  
9. PDF contains Report Number  
10. Configured template used  
11. Configured laboratory signatory used  
12. PDF failure retains number  
13. Retry succeeds  
14. Regeneration creates new artifact version  
15. Previous artifact retained  
16. Current official artifact unambiguous  
17. Download from Report detail  
18. Download from Reports worklist  
19. Wrong branch denied  
20. Wrong permission denied  
21. Missing artifact denied  
22. Audit failure blocks download  
23. Patient access absent  
24. No production role grants introduced  
25. Concurrent number allocation safe (no reuse)

**UAT readiness is not claimed by this audit.**

---

## 30. Risks / Blockers

### Non-blocking prerequisites (configuration / implementation)

- Missing tenant PDF template store/values  
- Missing laboratory signatory store/values  
- Missing operating-branch Report Number sequence + format config  
- LaboratoryApi has no async drain worker yet (must add in CUT B)  
- No LMS↔CanonicalDocument association yet (must add; avoid LabReport/MPI)  
- `lms.reports.download` unwired; new assign/generate codes absent  
- Audit allowlist does not yet include L-REP-03 actions  

### Hard blockers discovered

| STOP condition | Status |
| --- | --- |
| L-REP-02B auto-generates PDF | **No** |
| L-REP-02B assigns Report Number | **No** |
| Report semantics conflict with closure | **No** |
| CanonicalDocument cannot safely represent LMS artifact | **No** (with new LMS association) |
| Operating branch authorization impossible | **No** — `ValidateUserBranchAsync` exists |
| Tenant isolation impossible | **No** |
| Artifact authorization impossible | **No** — must gate via Report APIs |
| Report Number immutability impossible | **No** — enforceable with constraints |
| No safe concurrency strategy | **No** — LMS upsert pattern exists |
| Product decision contradicts closure | **No** |

**Overall hard BLOCKED:** **No.**

---

## 31. Final Readiness Classification

```text
READY_WITH_PREREQUISITE
```

**Why not READY:** Configuration stores/values and several bounded infrastructure pieces (sequence table, artifact model, job drain, LMS document association, new permissions/audit actions, UI/API wiring) are missing. Closure already requires configuration.

**Why not BLOCKED:** Certified Release baseline is clean; architecture can proceed without contradicting PD-ART decisions; CanonicalDocument + LMS association is feasible; authorization and concurrency patterns exist.

---

## 32. Next Gate

```text
NEXT_GATE = IMPLEMENTATION_AUTHORIZATION
```

Implementation must not start until an explicit separate authorization task. When authorized, prefer CUT A → CUT B → CUT C, preserve L-REP-02B, invent no template/signatory/format defaults, and grant no production roles.

---

## Final stamps

```text
PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED
L_REP_02B_REMAINS_ACCEPTED
IMPLEMENTATION_NOT_STARTED
READINESS_AUDIT_COMPLETE
L_REP_03_READINESS_AUDIT_COMPLETE

CONFIGURATION_REQUIRED = YES
OVERALL = READY_WITH_PREREQUISITE
NEXT_GATE = IMPLEMENTATION_AUTHORIZATION
```

**STOP.** Do not implement L-REP-03 in this task.
