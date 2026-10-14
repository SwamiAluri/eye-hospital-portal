# L-REP-03 CUT B / B1 — Official PDF / Report Artifact Foundation  
# Implementation Readiness Audit

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT B / B1 — Official PDF / Report Artifact Foundation  
**Mode:** IMPLEMENTATION READINESS AUDIT ONLY — documentation  

**This task does not implement CUT B / B1.**  
No application source, schema, migrations, APIs, DTOs, services, workers/jobs, PDF renderer, QuestPDF package references, UI, routes, permissions, role grants, audit allowlists, configuration records, Blob containers, or CanonicalDocument associations were created or modified by this audit.

**Do not begin CUT C.**

---

## 1. Title

L-REP-03 CUT B / B1 — Official PDF / Report Artifact Foundation — Implementation Readiness Audit

## 2. Date

2026-10-12

## 3. Audit mode

```text
AUDIT / READINESS ONLY
IMPLEMENTATION_NOT_STARTED
CUT_B_IMPLEMENTATION_NOT_STARTED
CUT_C_NOT_STARTED
```

Deliverable permitted: this document only.

## 4. Scope

### In scope

- Determine whether the repository is **READY**, **READY_WITH_PREREQUISITES**, or **BLOCKED** for future B1 implementation
- Verify repository fit against certified PD-PDF-01 … PD-PDF-24 (Product Decision Closure)
- Inventory reusable LaboratoryApi / platform capabilities and remaining gaps
- Identify configuration prerequisites (no invention of defaults)
- Propose a bounded future implementation sequence (recommendation only)

### Explicitly out of scope

- Any implementation of CUT B / B1 / CUT C
- Reopening or reinterpretation of Product Owner decisions
- B0 ReportVersion snapshot enrichment
- Staff download, patient publication, notifications, Pathology dual-write
- Creation of configuration rows, permission seeds/grants, audit allowlist entries, QuestPDF install, Timer functions, artifact tables, or UI

---

## 5. Authoritative source chain

| Document | Role | Stamp / status |
| --- | --- | --- |
| [enterprise-lms-report-official-pdf-decision-closure.md](./enterprise-lms-report-official-pdf-decision-closure.md) | Binding B1 Product Decision Closure | `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED` |
| [enterprise-lms-report-official-pdf-discovery-audit.md](./enterprise-lms-report-official-pdf-discovery-audit.md) | Official PDF discovery | `DISCOVERY_COMPLETE` |
| [enterprise-lms-report-official-pdf-decision-package.md](./enterprise-lms-report-official-pdf-decision-package.md) | B1 decision package (superseded for stamped PD-PDF-* by closure) | Review complete |
| [enterprise-lms-report-artifact-numbering-download-decision-closure.md](./enterprise-lms-report-artifact-numbering-download-decision-closure.md) | PD-ART-* carried forward | `PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED` |
| [enterprise-lms-report-number-foundation-acceptance-closure.md](./enterprise-lms-report-number-foundation-acceptance-closure.md) | Accepted CUT A | `ACCEPTED_L_REP_03_CUT_A` |
| [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | Accepted Release | `ACCEPTED_L_REP_02B` |
| [enterprise-lms-report-release-decision-closure.md](./enterprise-lms-report-release-decision-closure.md) | Metadata Release decisions | `PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED` |

```text
L-REP-01 Report Foundation (certified)
  ↓
L-REP-02A Finalize (ACCEPTED)
  ↓
L-REP-02B Release metadata (ACCEPTED_L_REP_02B)  ← UNCHANGED
  ↓
L-REP-03 PD-ART closure
  ↓
L-REP-03 CUT A Report Number (ACCEPTED_L_REP_03_CUT_A)  ← UNCHANGED
  ↓
Official PDF discovery (DISCOVERY_COMPLETE)
  ↓
PD-PDF-* Product Decision Closure (AUTHORIZED)
  ↓
THIS DOCUMENT — Implementation Readiness Audit
  ↓
NEXT_GATE = IMPLEMENTATION_AUTHORIZATION
  ← CUT B implementation NOT started by this audit
  ← CUT C NOT started
```

Product Owner decisions in the closure are **binding**. This audit does not reopen them.

---

## 6. Current certified baseline

| Item | Status |
| --- | --- |
| L-REP-02B Release | `ACCEPTED_L_REP_02B` / `L_REP_02B_REMAINS_ACCEPTED` — metadata only; no PDF |
| L-REP-03 CUT A Report Number | `ACCEPTED_L_REP_03_CUT_A` — immutable; explicit post-Release; operating-branch sequence |
| CUT B Product Decisions | `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED` |
| CUT B implementation | `NOT STARTED` (confirmed in repository — no generate/PDF/artifact/job code) |
| CUT C Staff Download | `NOT STARTED` |
| Configuration gate | `CONFIGURATION_REQUIRED = YES` |
| Prior Official PDF discovery | `DISCOVERY_COMPLETE` |

Lifecycle preserved:

```text
Draft → Final → Released → Assign Business Report Number
  → [B1 future] Explicit staff Generate Official PDF (async)
  → [CUT C later] Staff download — NOT AUTHORIZED HERE
```

---

## 7. Repository evidence

### 7.1 LaboratoryApi Report domain (present)

| Artifact | Path / symbol | Evidence |
| --- | --- | --- |
| Aggregate | `LaboratoryApi/Domain/LmsReport.cs` | TenantId, OperatingBranchId, PatientId, OrderId, Status, CurrentVersionNumber, Finalized*/Released*, BusinessReportNumber*, RowVersion |
| Version | `LaboratoryApi/Domain/LmsReportVersion.cs` | Immutable version; PatientId, OrderId, OperatingBranchId; Sources |
| Source snapshot | `LaboratoryApi/Domain/LmsReportVersionSource.cs` | ResultId/ResultVersionId, CatalogueItemId/CatalogueVersionId, SpecimenId, values/unit/comment, AuthorizedByUserId/AuthorizedAtUtc |
| Status enums | `LaboratoryApi/Domain/ReportEnums.cs` | Draft / Final / Released; idempotency ops through `assign_report_number`; audit actions through `ASSIGN_REPORT_NUMBER` |
| Number config/seq | `LaboratoryApi/Domain/LmsReportNumber.cs` | Governed fail-closed config pattern (reusable pattern for PDF config) |
| Idempotency record | `LaboratoryApi/Domain/LmsReportIdempotencyRecord.cs` | Tenant + key + operation + RequestHash + ResponseJson |
| Service | `LaboratoryApi/Services/ReportService.cs` | Create/Append/Finalize/Release/AssignNumber; branch validation; RowVersion; ClaimIdempotencyAsync (replay / 409 hash conflict) |
| Functions | `LaboratoryApi/Functions/ReportFunctions.cs` | HTTP only through assign-number — **no** generate |
| Authz constants | `LaboratoryApi/Services/LaboratoryAuthz.cs` | view/manage/finalize/release/download/assign_number — **no** generate |
| Migrations | `20261012*` through `AddLmsReportNumberFoundation` | No PDF/artifact/job/template/signatory migration |

### 7.2 Confirmed absences (expected B1 work — not reopened product questions)

| Capability | State |
| --- | --- |
| QuestPDF / PDF renderer in LaboratoryApi | **Absent** (`LaboratoryApi.csproj` has no QuestPDF; Timer extension also absent) |
| LMS Official PDF job table / Timer drain | **Absent** |
| LMS artifact version table / current-official pointer on `LmsReport` | **Absent** |
| LMS PDF template / signatory configuration stores | **Absent** |
| `lms.reports.generate` catalogue / FE / BE constant | **Absent** |
| PDF audit actions (`REQUEST_OFFICIAL_PDF`, etc.) | **Absent** from `ReportAuditActions` and `InternalAuditController.AllowedActions` |
| LMS-specific CanonicalDocument association | **Absent** (`lab`/`LabReport` exists for Pathology only — must not reuse) |
| Staff download wiring | Catalogue `lms.reports.download` exists; UI/API **not** wired for Official PDF download (CUT C) |
| Service Bus | **Not found** for this slice (aligns with PD-PDF-10) |

### 7.3 Frontend evidence

| Artifact | Path | Evidence |
| --- | --- | --- |
| Report detail route | `apps/hospital-portal-web/src/app/dashboard/lms/reports/[id]/page.tsx` | Renders `ReportDetailView` |
| Detail UI | `apps/hospital-portal-web/src/components/lms/reports/ReportDetailView.tsx` | Finalize / Release / Assign Number; explicit “Not PDF, download…” copy |
| Permissions | `apps/hospital-portal-web/src/lib/lms/lms-permissions.ts` | No `generate` |
| UI contract tests | `enterprise-lms-reports-ui.test.ts` | Asserts API/detail do **not** contain `official-pdf` |

### 7.4 Platform evidence (downstream / reference)

| Capability | Owner | LMS Official PDF note |
| --- | --- | --- |
| QuestPDF | AuthService (`PatientSummaryPdfService`, `ImagingExportService`) | Technology reference only — not LMS clinical SoT |
| CanonicalDocument + Blob | AuthService | Downstream byte store (PD-PDF-17 / PD-ART-07) |
| Pathology LabReport ↔ CanonicalDocument | `LabReportCanonicalDocumentService` (`lab` / `LabReport`) | **Forbidden** reuse for Enterprise LMS |
| `register-external` | `InternalCanonicalDocumentController` | Pattern reference for external pointer registration (CCMS-shaped) |
| Azure Timer drain | IpManagement / Inventory / Notification | Pattern reference — LaboratoryApi has **no** Timer today |
| Platform patient/user refs | `PlatformReferenceClient` | Controlled lookup for patient MRN/name and user DisplayName |

---

## 8. Architecture readiness

| Concern | Approved owner (PD-PDF / PD-ART) | Repository fit |
| --- | --- | --- |
| Clinical / Report SoT | LaboratoryApi `LmsReport` / `LmsReportVersion` | **Fit** — existing aggregate |
| Current official artifact pointer | `LmsReport` (PD-PDF-16) | **Gap** — field/pointer not present; design clear |
| Artifact versions / jobs | LaboratoryApi | **Gap** — tables/services absent; ownership clear |
| PDF renderer | LaboratoryApi-owned (PD-PDF-10) | **Gap** — package/service absent; Auth QuestPDF must not become LMS SoT |
| Physical bytes | CanonicalDocument + private Blob | **Fit as downstream** — existing Auth services |
| Association | New LMS-specific (PD-PDF-17) | **Gap** — constants/association absent; Pathology path must not be reused |
| Async model | Lab job table + Azure Timer; no Service Bus | **Fit** — Timer patterns exist elsewhere; Lab must add owned drain |
| Auto-generate on Release/Number/Final/Auth | Forbidden (PD-PDF-24) | **Fit** — current Release/AssignNumber do not generate PDF |

**Verdict:** Architecture readiness is **READY for implementation design** under closed PD-PDF decisions. Missing tables/packages/services are B1 deliverables, not architecture blockers.

---

## 9. Report-domain readiness

| Topic | Readiness | Evidence |
| --- | --- | --- |
| `LmsReport` | Ready to extend (pointer only; do not change Release/Number semantics) | `LmsReport.cs` |
| `LmsReportVersion` | Ready as immutable clinical snapshot SoT | Domain comment + append-only versioning |
| `ReportStatus` | Released-only eligibility enforceable | `ReportStatuses.Released` |
| Release | Metadata-only; must remain unchanged | `ReportService.ReleaseAsync` |
| Business Report Number | Immutable post-assign; required for PDF eligibility | CUT A + `AssignNumberAsync` |
| RowVersion | Present; concurrency pattern reusable | Integer `RowVersion` + 409 `concurrency_conflict` |
| Tenant / operating branch | Present on Report and Version; validated via platform | `ValidateUserBranchAsync` |
| Source ResultVersion / CatalogueVersion | Bound on sources | `LmsReportVersionSource` |
| Patient identity refs | PatientId on Report/Version | Controlled lookup for MRN/name (see §12) |
| AuthorizedBy | On source snapshot | `AuthorizedByUserId` / `AuthorizedAtUtc` |
| Audit integration | Present for Report ops; PDF actions missing | `ReportAuditActions` + fail-closed allowlist |
| Idempotency | Pattern ready; `generate_official_pdf` missing | `ClaimIdempotencyAsync` |

**Verdict:** Report-domain readiness = **READY** as foundation. B1 must not mutate Release / Number / ReportVersion clinical content (PD-PDF-20 / PD-PDF-23).

---

## 10. ReportVersion / content readiness

| Content | Classification | Source |
| --- | --- | --- |
| Result value (numeric/qualitative) | **AVAILABLE DIRECTLY** | `LmsReportVersionSource.NumericValue` / `QualitativeValue` |
| Unit | **AVAILABLE DIRECTLY** | `Unit` |
| Comment | **AVAILABLE DIRECTLY** | `Comment` |
| Result / ResultVersion identity | **AVAILABLE DIRECTLY** | `ResultId`, `ResultVersionId`, `ResultVersionNumber` |
| CatalogueVersionId | **AVAILABLE DIRECTLY** | `CatalogueVersionId` |
| CatalogueItemId / OrderTestId | **AVAILABLE DIRECTLY** | Source ids |
| AuthorizedByUserId / AuthorizedAtUtc | **AVAILABLE DIRECTLY** | Source |
| SpecimenId | **AVAILABLE DIRECTLY** | Source (PD-PDF-06: SpecimenId only / none) |
| Report / Version / PatientId / OrderId / Branch | **AVAILABLE DIRECTLY** | Version header + Report aggregate |
| Business Report Number | **AVAILABLE DIRECTLY** (Report aggregate) | `LmsReport.BusinessReportNumber` — not on version row (correct) |
| Human-readable test name | **AVAILABLE THROUGH APPROVED CONTROLLED LOOKUP** | Exact `LmsCatalogueVersion` by `CatalogueVersionId` (PD-PDF-03) |
| Test identity/reference (internal code) | **AVAILABLE THROUGH APPROVED CONTROLLED LOOKUP** | `LmsCatalogueVersion.InternalOrderCode` (+ item ids on source) |
| Patient MRN + name | **AVAILABLE THROUGH APPROVED CONTROLLED LOOKUP** | OrderVersion snapshots and/or `PlatformPatientRef` (PD-PDF-02) — see §12 |
| Authorized By display name | **AVAILABLE THROUGH APPROVED CONTROLLED LOOKUP** | `PlatformUserRef.DisplayName` via `ValidateUserAsync` |
| Configured laboratory signatory | **NOT AVAILABLE** (config store missing) | CONFIGURATION foundation required (PD-PDF-07/18) |
| Hospital/lab name + logo | **NOT AVAILABLE** as LMS PDF template config | CONFIGURATION foundation required (PD-PDF-09/18) |
| Reference ranges / interpretation / diagnosis | **NOT AVAILABLE** — and **must not be invented** | Aligns with PD-PDF-04 |
| DOB / extra demographics | **NOT APPROVED** for PDF | Must not emit even if OrderVersion/platform has DOB |
| Specimen type/barcode/collection times | **NOT AVAILABLE** on ReportVersion — out of B1 surface | PD-PDF-06 |

**B0 gate (PD-PDF-23):** Approved controlled joins can satisfy PO-approved display fields without ReportVersion enrichment. **B0 not required** based on current repository evidence.

**Stop condition preserved:** If a future implementation discovers a mandatory field that cannot be safely obtained via approved controlled joins, **STOP** and raise a new Product Decision — do not silently mutate ReportVersion.

---

## 11. Catalogue lookup readiness

| Check | Result | Evidence |
| --- | --- | --- |
| CatalogueVersion identity | Present | `LmsCatalogueVersion.Id` |
| Catalogue item / test identity | Present | `CatalogueItemId`, `InternalOrderCode` |
| Human-readable name | Present | `DisplayName` (max 256) |
| Version immutability | Present | Domain: immutable once Active/Retired/Superseded |
| Tenant isolation | Present | `TenantId` on version; Lab queries filter tenant |
| Source binding | Present | `LmsReportVersionSource.CatalogueVersionId` |
| “Current catalogue” lookup | **Incorrect** for Official PDF | Would violate PD-PDF-03; must key by exact source `CatalogueVersionId` |

**Verdict:** Catalogue lookup readiness = **READY** for approved controlled join.

---

## 12. Patient identity readiness

| Need | Safest existing sources | Notes |
| --- | --- | --- |
| MRN | `LmsOrderVersion.PatientMrnSnapshot` for Report’s OrderId (already used on eligible-sources DTO path); and/or `IPlatformReferenceClient.ValidatePatientAsync` → `PlatformPatientRef.Mrn` | Do **not** create new patient storage |
| Patient name | `LmsOrderVersion.PatientNameSnapshot`; and/or `PlatformPatientRef.DisplayName` | Display name only |
| Tenant / authz | Tenant on Report + existing platform patient validation patterns | Reuse; no parallel identity model |
| DOB | Present on OrderVersion/platform but **forbidden** on PDF unless separately approved | Must not include |

**Preferred generation-time approach (within PD-PDF-01/02, not inventing new SoT):**  
Use order-version patient snapshots associated with the Report’s `OrderId` as the primary LMS-local controlled lookup; platform validate-patient remains available for consistency checks. Neither path authorizes Patient Portal / Patient 360 publication.

**Verdict:** Patient identity readiness = **READY** via approved controlled lookup. Not on ReportVersion snapshot rows — by design under PD-PDF-01/23.

---

## 13. Authorized-By readiness

| Field | Classification | Evidence |
| --- | --- | --- |
| `AuthorizedByUserId` | **AVAILABLE DIRECTLY** | `LmsReportVersionSource` |
| Authorized timestamp | **AVAILABLE DIRECTLY** | `AuthorizedAtUtc` |
| Human-readable user name | **AVAILABLE THROUGH APPROVED CONTROLLED LOOKUP** | `PlatformUserRef.DisplayName` via `ValidateUserAsync` |
| New identity model | **Not required** | Existing platform user reference client |

Configured laboratory signatory (PD-PDF-07) is **separate** from Authorized By and requires configuration foundation (§14).

**Verdict:** Authorized-By readiness = **READY** for PD-PDF-05.

---

## 14. Template / signatory configuration readiness

| Capability | Classification | Evidence |
| --- | --- | --- |
| Tenant-level LMS PDF template store | **NEW B1 FOUNDATION REQUIRED** | Not present in LaboratoryApi |
| Immutable template versions once used | **NEW B1 FOUNDATION REQUIRED** | PD-PDF-08; no LMS template version entity |
| Laboratory signatory config (name + title/credentials text) | **NEW B1 FOUNDATION REQUIRED** | No LMS signatory store |
| Hospital/lab name + logo references in LMS PDF template | **NEW B1 FOUNDATION REQUIRED** | Org `LogoUrl` / branding elsewhere ≠ LMS Official PDF template SoT |
| Governed DB configuration pattern | **REUSABLE EXISTING CAPABILITY (pattern)** | `LmsReportNumberConfiguration` fail-closed, no production defaults seeded |
| Consent template version ref on orders | **PARTIAL / unrelated** | Order consent refs — not Official PDF templates |
| IP PreOp consent signatory | **Not reusable as LMS PDF signatory** | Wrong domain |

**CONFIGURATION_REQUIRED = YES** (binding).

### Minimum configuration before Manual UAT / production use

1. Tenant-level PDF template (governed record)  
2. Immutable template version identity  
3. Configured laboratory signatory (name + professional title/credentials text)  
4. Operating tenant/branch context already required by Report / Number architecture  

Do **not** invent hospital name, logo bytes, signatory name/credentials, template layout, or retention.

**Verdict:** Template/signatory readiness = **PARTIAL** (pattern reusable; stores **MISSING** / **BLOCKING for UAT** until configured). Implementation may create the configuration foundation; UAT cannot pass without real governed rows.

---

## 15. PDF technology readiness

| Technology | Location | Classification for B1 |
| --- | --- | --- |
| QuestPDF 2026.2.1 | AuthService only | **AuthService-only technology reference** |
| LaboratoryApi PDF package | Absent | **NEW B1 FOUNDATION REQUIRED** (LaboratoryApi-owned renderer per PD-PDF-10) |
| Pathology LabReport attach/upload | AuthService Pathology path | **Must not reuse as LMS SoT** |
| Imaging export Blob path | AuthService | Unrelated module reference |
| Fonts / LMS logo handling | No LMS Official PDF assets | Configuration + renderer concern |

**Safest path consistent with PD-PDF-10 and discovery:**  
Add QuestPDF (or equivalent approved PDF library) **inside LaboratoryApi** (or a Laboratory-owned worker sharing LaboratoryApi DB). Treat AuthService QuestPDF as a technology reference only. Do **not** move LMS Report clinical ownership to AuthService. Do **not** dual-write Pathology `LabReport` documents.

**Verdict:** PDF technology readiness = **READY_WITH_PREREQUISITES** (package/renderer work is B1 implementation; ownership boundary is clear).

---

## 16. Job / Timer readiness

| Item | State | Note |
| --- | --- | --- |
| LaboratoryApi Timer functions | **Absent** | `LaboratoryApi.csproj` has HTTP worker extensions only |
| LaboratoryApi job table for Official PDF | **Absent** | Required by PD-PDF-10 |
| Service Bus | **Absent / forbidden for this slice** | Aligns with PD-PDF-10 |
| Reusable Timer patterns elsewhere | Present | e.g. IpManagement outbox Timer; Inventory Timers; Notification cleanup |
| Hangfire in LaboratoryApi | Absent | Not required by PD-PDF-10; do not invent Service Bus |

### Required target architecture (approved)

```text
LaboratoryApi-owned job table
  +
Azure Timer drain
```

### Job semantics required by closure (values not invented)

| Semantic | Approved |
| --- | --- |
| States | Pending → Running → Succeeded / Failed (implied by PD-PDF-10/14/15/21) |
| One active generation per Report | Required (PD-PDF-14) |
| Running request | Return/reference existing active job |
| Current pointer | Updates only on success |
| Failed | Never becomes current; prior successful remains current |
| Retry | Allowed per governed job/idempotency semantics |
| Max attempts / stale-Running TTL | **Not specified by Product Decision Closure** — do **not** invent product values; choose bounded technical defaults in B1 design notes or raise a narrow ops decision if fail-closed policy requires PO input |

**Verdict:** Job/Timer readiness = **READY for implementation** (pattern exists platform-wide; LaboratoryApi-owned instance must be built). Not a product blocker.

---

## 17. Artifact model readiness

| Concern | Approved rule | Repository state |
| --- | --- | --- |
| Immutable artifact versions from 1 | PD-PDF-15 | **GAP** — table absent |
| Metadata set | MIME, size, content hash, CanonicalDocumentId, template version, artifact version, generated by/at, status, failure metadata | **GAP** — LMS artifact model absent; CanonicalDocument already has hash/mime/size |
| Current official pointer on `LmsReport` | PD-PDF-16 | **GAP** |
| Report remains Released; Number/Version unchanged | PD-PDF-20 | Enforceable with current domain if B1 does not touch those fields |
| Retention enforcement | PD-PDF-19 — none in B1 | No LMS retention engine required |

**Verdict:** Artifact model readiness = **NEW B1 FOUNDATION REQUIRED** (design authorized; persistence absent).

---

## 18. CanonicalDocument / Blob readiness

| Check | Result |
| --- | --- |
| CanonicalDocument ownership | AuthService entity + associations |
| PatientId required | Yes — compatible with `LmsReport.PatientId` (storage constraint ≠ patient publication) |
| Private Blob | `BlobStorageService` creates containers with `PublicAccessType.None` |
| Content metadata | MimeType, SizeBytes, ContentHash present |
| Pathology association | `lab` / `LabReport` — **must NOT be reused** (PD-PDF-17) |
| Existing domains | `mpi`, `counselling`, `ccms`, `lab` |
| LMS association | **Absent** — smallest B1 need: new LMS-specific domain/entity-type association constants + registration path associating CanonicalDocument to LMS Report/artifact identity |
| Deletion/update | Soft-delete / supersede fields exist on CanonicalDocument; LMS current pointer remains LaboratoryApi SoT |
| CCMS `register-external` | Pattern for associating without always copying bytes — adapt carefully; keep LMS SoT in LaboratoryApi |

**Smallest LMS-specific association (design concept only — not implemented):**  
New association constants distinct from Pathology `lab`/`LabReport` (exact string names are an implementation choice within PD-PDF-17 Option A; do not invent clinical meaning). LaboratoryApi stores CanonicalDocumentId on LMS artifact metadata and owns current-official pointer.

**Verdict:** CanonicalDocument/Blob readiness = **PARTIAL** — storage platform ready; LMS association + Lab pointer **MISSING** (B1 work, not architecture conflict).

---

## 19. Permission readiness

| Item | State |
| --- | --- |
| Approved permission | `lms.reports.generate` (PD-PDF-11) |
| Catalogue seed | **Absent** (`EnterpriseLmsReportsPermissionCatalog` has view/manage/finalize/release/download/assign_number only) |
| LaboratoryAuthz constant | **Absent** |
| FE `lms-permissions.ts` | **Absent** generate |
| Code references / generate API | **Absent** |
| Production role grants | **None authorized** by closure — must remain separate controlled operation |
| Tenant validation | Reusable (JWT tenant + Report.TenantId) |
| Operating branch validation | Reusable (`ValidateUserBranchAsync` + Report.OperatingBranchId) |
| Permission middleware | Reusable (`LaboratoryAuthz.ForbidUnlessAsync`) |

**Verdict:** Permission readiness = **GAP for catalogue/wiring** (allowed B1 work) + **READY** for authz reuse patterns. Role grants remain **out of B1 authorization**.

---

## 20. Audit readiness

| Item | State |
| --- | --- |
| Platform audit integration | Present — Report ops already call internal audit |
| Fail-closed allowlist | `InternalAuditController.AllowedActions` — PDF actions **not** listed |
| Recommended actions | `REQUEST_OFFICIAL_PDF`, `OFFICIAL_PDF_GENERATED`, `OFFICIAL_PDF_FAILED` (PD-PDF-12; exact strings subject to project conventions) |
| Tenant/user/branch context | Existing Report audit detail strings include tenant actor + operatingBranchId patterns |
| Download audit | CUT C — out of B1 |

**Verdict:** Audit readiness = **PARTIAL** — integration pattern ready; allowlist + LaboratoryApi action constants **MISSING** (B1 work). Fail-closed behavior means generate cannot claim success audit until allowlist entries exist.

---

## 21. Idempotency / concurrency readiness

| Required semantic | Existing reusable mechanism | Fit |
| --- | --- | --- |
| Operation `generate_official_pdf` | Extend `ReportIdempotencyOperations` | Ready pattern |
| Same key + same hash → replay | `ClaimIdempotencyAsync` returns `ResponseJson` | Fit |
| Same key + different hash → 409 | `idempotency_conflict` | Fit |
| One active job per Report | **New** unique/partial constraint / transactional claim on job table | Required B1 design |
| Concurrent requests cannot create two active generations | DB uniqueness + transaction (CUT A number concurrency tests are a model) | Ready pattern class |
| Current pointer only after success | Application rule in job completion transaction | Enforceable |
| RowVersion / PostgreSQL concurrency | Existing Report RowVersion + Postgres concurrency tests | Reuse for Report mutations if pointer stored on Report |

**Verdict:** Idempotency/concurrency readiness = **READY** (patterns) with **NEW** active-job uniqueness for PDF generation.

---

## 22. UI readiness

| Item | State |
| --- | --- |
| Report detail route | Present — `/dashboard/lms/reports/[id]` |
| Detail component | `ReportDetailView.tsx` — permission-aware actions, loading/error, confirm flows |
| Status/metadata patterns | Present for Final/Release/Number |
| Toast / error parsing | `parseLmsReportsApiError` pattern |
| Async job status UI | **Absent** for Official PDF (no existing LMS Report job poller) — B1 must add bounded status rendering |
| Approved B1 UI surface | Generate Official PDF + status + timestamp + artifact metadata |
| Download | Explicitly **out** of B1; current UI copy forbids PDF/download |
| Worklist PDF status | Out unless separately approved (PD-PDF-22) |
| Design system | Preserve Hospital Portal staff patterns (existing LMS Reports UI) |

**Verdict:** UI readiness = **READY to extend Report detail only**. No download. Worklist PDF status not authorized.

---

## 23. Automated test readiness

### Existing suites to extend (future B1)

| Suite | Path | Relevance |
| --- | --- | --- |
| Report service unit | `LaboratoryApi.Tests/ReportServiceTests.cs` | Eligibility, permissions patterns, audit fail-closed, immutability |
| Report number assign | `ReportNumberAssignTests.cs` | Number invariants; Released-only patterns |
| Report Postgres concurrency | `ReportPostgresConcurrencyTests.cs` / `ReportNumberPostgresConcurrencyTests.cs` | Concurrency / uniqueness models |
| Permission catalogue | `AuthService.Tests/EnterpriseLmsReportsPermissionTests.cs` | Catalogue presence (no grants) |
| Internal audit allowlist | `AuthService.Tests/InternalAuditControllerTests.cs` | PDF action allowlist |
| CanonicalDocument / LabReport | `LabReportCanonicalDocumentTests.cs` | Negative: LMS must not use Pathology association |
| Internal CanonicalDocument register | `InternalCanonicalDocumentControllerTests.cs` | Association registration patterns |
| FE UI contract | `enterprise-lms-reports-ui.test.ts` | Generate visibility / no download / permission codes |

### Required future coverage (planning only — not executed here)

DOMAIN / API · STORAGE · JOB · PDF CONTENT · UI — as specified in the audit brief (Released-only, number-required, tenant/branch/permission, idempotency replay/conflict, one-active-job, artifact versioning, pointer-on-success-only, Release/Number/Version unchanged, audit trio, CanonicalDocument association ≠ Pathology, Timer state machine, content assertions without ranges/interpretation, detail UI without download).

**Verdict:** Test harness readiness = **READY** to extend. This audit did **not** run implementation tests as proof of implementation.

---

## 24. Configuration prerequisites

| # | Prerequisite | Status | Blocking? |
| --- | --- | --- | --- |
| 1 | Tenant-level PDF template | **MISSING** | **BLOCKING for UAT/production use** |
| 2 | Immutable template version | **MISSING** | **BLOCKING for UAT/production use** |
| 3 | Configured laboratory signatory | **MISSING** | **BLOCKING for UAT/production use** |
| 4 | Operating tenant/branch context | **AVAILABLE** (existing Report/Number architecture) | Not blocking |

```text
CONFIGURATION_REQUIRED = YES
```

Configuration foundation tables/services are B1 implementation scope. Populating governed configuration rows with real hospital/lab/signatory/template values is a **UAT/go-live prerequisite** — not inventable defaults.

---

## 25. Risks / blockers / decisions

### Blockers preventing safe implementation start

**None identified** that contradict closed PD-PDF decisions or make B1 architecturally unsafe to authorize.

Product open questions from discovery (content model, job model, association, permission code, etc.) are **closed** by `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED`.

### Prerequisites (not implementation blockers)

| Prerequisite | Class |
| --- | --- |
| Governed template + template version + signatory records before UAT | CONFIGURATION PREREQUISITE |
| Catalogue permission `lms.reports.generate` without production role grants | IMPLEMENTATION + GOVERNANCE |
| Audit allowlist entries for request/success/failure | IMPLEMENTATION |
| LaboratoryApi QuestPDF + Timer package/wiring | IMPLEMENTATION |
| LMS artifact/job schema + LMS CanonicalDocument association | IMPLEMENTATION |

### Residual risks (manage in B1; do not invent product)

| Risk | Mitigation |
| --- | --- |
| Misuse of Pathology `lab`/`LabReport` association | Explicit forbid; tests asserting distinct LMS association |
| AuthService becomes clinical SoT | Keep pointer/jobs/renderer ownership in LaboratoryApi |
| Using “current” catalogue instead of exact CatalogueVersionId | Code + tests keyed by source CatalogueVersionId |
| Emitting DOB / ranges / interpretation | Content contract tests; PD-PDF-04/02 |
| Auto-generate on Release/Number | Keep separate API; regression tests on ReleaseAsync/AssignNumberAsync |
| Job max-attempts / stale Running not PO-specified | Technical design within B1; escalate only if product policy required |
| Exact LMS association string constants not named by PO | Implementation choice within PD-PDF-17 Option A (new LMS-specific) |

### Decisions needed from Product Owner now?

**None for B1 scope** — PD-PDF-01…24 are closed. Do not reopen.

---

## 26. Proposed implementation sequence

Recommendation only — **do not implement in this task**. Actual scope remains the single approved L-REP-03 CUT B / B1 boundary.

| Step | Focus |
| --- | --- |
| **B1-A** | Configuration foundation (template versions + laboratory signatory stores; fail-closed when missing) |
| **B1-B** | Artifact + job domain foundation (versions, current pointer on `LmsReport`, job states, uniqueness) |
| **B1-C** | LaboratoryApi-owned PDF rendering (QuestPDF or approved equivalent; approved content only) |
| **B1-D** | CanonicalDocument + private Blob persistence + **new** LMS association (not Pathology) |
| **B1-E** | Generate API + `generate_official_pdf` idempotency + one-active-job concurrency + Timer drain |
| **B1-F** | Audit request / success / failure (allowlist + LaboratoryApi actions) |
| **B1-G** | Report detail UI (Generate, status, timestamp, artifact metadata; **no** download) |
| **B1-H** | Automated tests (domain/API/storage/job/content/UI) |
| **B1-I** | Manual UAT against approved boundary + real configuration |

Parallelization note: B1-A/B can start early; C depends on A content contracts; D/E depend on B/C; F wires into E; G depends on E DTOs; H throughout; I after configuration populated.

---

## 27. Regression boundaries

B1 must **not** change:

| Area | Boundary |
| --- | --- |
| L-REP-01 | Draft / snapshots / source claims |
| L-REP-02A | Finalize semantics |
| L-REP-02B | Release remains metadata-only (`L_REP_02B_REMAINS_ACCEPTED`) |
| L-REP-03 CUT A | Number assignment / immutability / sequences (`ACCEPTED_L_REP_03_CUT_A`) |
| L-TST / L-VER / L-AUTH / L-CRT | Result lifecycle unchanged |
| Pathology | No migration / dual-write / LabReport association reuse |
| Patient Portal / Patient 360 | No publication / patient download |
| NotificationHub | No PDF notifications |
| CUT C | No staff download |
| ReportVersion clinical snapshot | No B0 enrichment / mutation for PDF |
| Production role grants | Not authorized by B1 closure |

---

## 28. Future UAT gate

After implementation authorization and implementation (not this audit), Manual UAT must support verification of:

1. Draft / Final cannot generate  
2. Released without number cannot complete generation  
3. Released + numbered + authorized actor can generate  
4. Async Pending → Running → Succeeded/Failed  
5. Success exposes artifact metadata  
6. Business Report Number unchanged  
7. Release unchanged  
8. ReportVersion unchanged  
9. Failure leaves previous successful artifact current  
10. Retry works  
11. Idempotency works (replay / hash conflict)  
12. Concurrent Running returns existing job  
13. No download  
14. No patient publication  
15. No notification  
16. No Pathology dual-write  
17. Unauthorized actor denied  
18. Wrong branch denied  

This audit does **not** perform UAT.

---

## 29. Overall readiness classification

### Classification

```text
OVERALL_READINESS = READY_WITH_PREREQUISITES
```

### Why not READY

Governed configuration (`CONFIGURATION_REQUIRED = YES`) is mandatory before UAT/production use: tenant PDF template, immutable template version, and laboratory signatory must exist as real governed records. Permission catalogue/audit allowlist/QuestPDF/Timer/artifact/job/LMS association are also absent — but those are authorized B1 implementation deliverables, not unresolved product architecture.

### Why not BLOCKED

- Product decisions PD-PDF-01…24 are closed and stamped  
- Clinical SoT, Release, and Number foundations are accepted and present  
- Approved content fields are available directly or via approved controlled joins without B0  
- Ownership boundaries (LaboratoryApi clinical/artifact/job vs Auth CanonicalDocument/Blob) are clear  
- No repository contradiction requires reopening Product Owner decisions  
- Pathology association reuse is avoidable by introducing a new LMS association  

### PD-PDF checklist (repository fit)

| Decision | Fit summary |
| --- | --- |
| PD-PDF-01 Controlled joins | Fit — snapshot + approved lookups |
| PD-PDF-02 MRN + name | Fit via controlled lookup |
| PD-PDF-03 Exact CatalogueVersion name | Fit |
| PD-PDF-04 Result/unit/comment only | Fit — ranges absent (correct) |
| PD-PDF-05 Authorized By | Fit |
| PD-PDF-06 SpecimenId only/none | Fit |
| PD-PDF-07 Configured signatory | Config foundation required |
| PD-PDF-08 Immutable template versions | Config foundation required |
| PD-PDF-09 Name + logo | Config foundation required |
| PD-PDF-10 Lab job + Timer; no Service Bus | Fit; Lab Timer/job absent (B1) |
| PD-PDF-11 `lms.reports.generate` | Catalogue absent (B1); no grants |
| PD-PDF-12 Audit trio | Allowlist absent (B1) |
| PD-PDF-13 Idempotency | Pattern ready |
| PD-PDF-14 One active job | Design required (B1) |
| PD-PDF-15 Artifact versions from 1 | Design required (B1) |
| PD-PDF-16 Pointer on LmsReport | Design required (B1) |
| PD-PDF-17 New LMS association | Design required; Pathology forbidden |
| PD-PDF-18 DB/governed config | Pattern ready; stores missing |
| PD-PDF-19 No LMS retention in B1 | Fit |
| PD-PDF-20 Release/Number/Version invariants | Enforceable |
| PD-PDF-21 Artifact metadata | Design required (B1) |
| PD-PDF-22 Detail UI only; no download | UI ready to extend |
| PD-PDF-23 No B0 | Confirmed feasible |
| PD-PDF-24 Explicit staff action only | Fit with current Release/Number |

---

## 30. Final stamps

```text
DISCOVERY_COMPLETE
IMPLEMENTATION_READINESS_AUDIT_COMPLETE

PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED

L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A

CUT_B_IMPLEMENTATION_NOT_STARTED
CUT_C_NOT_STARTED

CONFIGURATION_REQUIRED = YES

OVERALL_READINESS = READY_WITH_PREREQUISITES

NEXT_GATE = IMPLEMENTATION_AUTHORIZATION

STOP
```

**STOP.** Do not implement CUT B / B1 or CUT C in this task. The only deliverable is this readiness audit document.
