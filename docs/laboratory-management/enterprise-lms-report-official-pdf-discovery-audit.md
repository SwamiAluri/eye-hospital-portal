# L-REP-03 CUT B — Official PDF / Report Artifact  
# Product Discovery / Repository Audit

**Date:** 2026-10-12  
**Mode:** DISCOVERY / REPOSITORY AUDIT ONLY — no application code, schema, migrations, APIs, UI, routes, permissions, role grants, PDF generation, QuestPDF package addition, PDF jobs, CanonicalDocument associations for LmsReport, Blob containers, download, ReleaseAsync changes, Report Number changes, Patient Portal / Patient 360, NotificationHub, Amendments, Unrelease/Revoke, Pathology, or Product Decision Closure  

**Label for sequencing advice:** `DISCOVERY RECOMMENDATION ONLY` — nothing herein authorizes implementation.

---

## 1. Scope

### In scope

- Evidence-based audit of Official PDF / Report Artifact foundation readiness after:
  - `ACCEPTED_L_REP_02B`
  - `ACCEPTED_L_REP_03_CUT_A`
- Inventory of reusable platform capabilities and LaboratoryApi gaps
- Product Decision matrix (preserve existing stamps; surface unresolved items)
- Candidate implementation cuts (recommendation only)

### Explicitly out of this task

- Any implementation  
- Product Decision Closure  
- Implementation prompt / coding authorization  
- CUT B / CUT C start  
- Reopening certified L-REP-01 / L-REP-02A / L-REP-02B / L-REP-03 CUT A behavior  

---

## 2. Authoritative references

| Document | Role |
| --- | --- |
| [enterprise-lms-report-artifact-numbering-download-decision-closure.md](./enterprise-lms-report-artifact-numbering-download-decision-closure.md) | Product Decision Closure (`PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED`) |
| [enterprise-lms-report-artifact-numbering-download-readiness-audit.md](./enterprise-lms-report-artifact-numbering-download-readiness-audit.md) | Prior readiness audit (pre–CUT A implementation) |
| [enterprise-lms-report-number-foundation-implementation-report.md](./enterprise-lms-report-number-foundation-implementation-report.md) | CUT A implementation |
| [enterprise-lms-report-number-foundation-pre-uat-readiness.md](./enterprise-lms-report-number-foundation-pre-uat-readiness.md) | CUT A PRE-UAT |
| [enterprise-lms-report-number-foundation-acceptance-closure.md](./enterprise-lms-report-number-foundation-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_A` |
| [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | `ACCEPTED_L_REP_02B` |
| [enterprise-lms-post-release-report-lifecycle-discovery.md](./enterprise-lms-post-release-report-lifecycle-discovery.md) | Broader post-Release discovery |

```text
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
  ↓
THIS DOCUMENT — Official PDF / Report Artifact discovery
  ↓
NEXT_GATE = PRODUCT_DECISION_REVIEW
  (no Product Decision Closure created by this task)
```

---

## 3. Certified baseline (must preserve)

### Lifecycle (certified)

```text
Draft
  → Final          (L-REP-02A)
  → Released       (L-REP-02B — metadata only)
  → Business Report Number assigned explicitly (L-REP-03 CUT A)
  → [candidate] Official PDF artifact (CUT B — NOT STARTED)
  → [candidate] Staff download (CUT C — NOT STARTED)
```

### Non-negotiable semantics

| Rule | Stamp / evidence |
| --- | --- |
| Release remains metadata-only | `ACCEPTED_L_REP_02B`; `ReportService.ReleaseAsync` |
| Release does **not** assign number | CUT A + L-REP-02B |
| Release does **not** generate PDF | Decision closure §7; UI copy; service comments |
| Number is immutable; operating-branch scoped; explicit post-Release | `ACCEPTED_L_REP_03_CUT_A` |
| Official PDF, if approved later, remains a **separate** governed operation | PD-ART-05 = B |

**Evidence class:** Existing certified decision + repository evidence.

---

## 4. Discrepancy vs prior readiness audit

| Prior readiness audit claim (pre–CUT A) | Current repository (post–CUT A) |
| --- | --- |
| `BusinessReportNumber` **absent** on `LmsReport` | **Present** — `LmsReport.BusinessReportNumber` + assigned metadata |
| Assign-number API absent | **Present** — `POST …/assign-number` |
| `lms.reports.assign_number` / `ASSIGN_REPORT_NUMBER` absent | **Present** (catalogue + allowlist) |
| Number config / sequences absent | **Present** — `lms_report_number_configurations`, `lms_report_number_sequences` |
| Official PDF / jobs / LMS↔CanonicalDocument / template / signatory | Still **absent** (unchanged) |

Prior readiness audit remains useful for PDF/job/CanonicalDocument findings; its “absent number” inventory is **superseded** by CUT A acceptance.

---

## 5. Repository capability inventory (summary)

| Capability | Owner today | LMS Official PDF suitability |
| --- | --- | --- |
| `LmsReport` / `LmsReportVersion` / sources | LaboratoryApi | **SoT** — reuse |
| Business Report Number + sequences | LaboratoryApi (CUT A) | **SoT** — prerequisite for official PDF (PD-ART-11) |
| QuestPDF rendering | AuthService only | **Technology reference** — not LMS SoT |
| CanonicalDocument + Blob | AuthService | **Downstream byte store** (PD-ART-07) — not clinical SoT |
| Pathology `LabReport` ↔ CanonicalDocument | AuthService (`LabReportCanonicalDocumentService`) | **Unsafe to reuse as LMS SoT** — separate Pathology aggregate |
| CCMS `register-external` CanonicalDocument | AuthService internal API | **Pattern reference** for external pointer registration |
| Hangfire / integration outbox | IpManagementService | **Pattern reference** — not LaboratoryApi-owned |
| AuthService BackgroundServices | AuthService (billing outbox, counselling transcription, reminders) | **Not LMS Report job infrastructure** |
| Azure Service Bus | **Not found** in repository csproj/cs | Do not invent as LMS bus |
| LMS Report PDF template store | **Absent** | CONFIGURATION_PREREQUISITE |
| Laboratory signatory store | **Absent** | CONFIGURATION_PREREQUISITE |
| LMS Report artifact / job tables | **Absent** | GAP |
| `lms.reports.generate` | **Absent** | GAP (permission) |
| PDF audit actions (`REQUEST_OFFICIAL_PDF`, etc.) | **Absent** | GAP |
| Staff download wiring | Catalogue `lms.reports.download` only; **not wired** | CUT C |

---

## 6. Report domain audit

**Evidence class:** Repository evidence.

| Artifact | Path / symbol | State |
| --- | --- | --- |
| Aggregate | `LaboratoryApi/Domain/LmsReport.cs` | Draft/Final/Released; Finalize/Release metadata; CUT A number fields; `RowVersion` |
| Version | `LmsReportVersion.cs` | Immutable version row; `PatientId`, `OrderId`, `OperatingBranchId`; sources collection |
| Source snapshot | `LmsReportVersionSource.cs` | ResultVersion binding + numeric/qualitative/unit/comment + auth metadata |
| Number config/seq | `LmsReportNumber.cs` + DbSets | CUT A governed format + sequences |
| Idempotency | `LmsReportIdempotencyRecord` / `ReportIdempotencyOperations` | Includes `assign_report_number`; **no** generate op |
| Audit actions | `ReportAuditActions` | CREATE/APPEND/FINALIZE/RELEASE/ASSIGN_REPORT_NUMBER — **no** PDF actions |
| Service | `ReportService.cs` | Create/Append/Finalize/Release/AssignNumber; class contract: no CanonicalDocument/PDF/Pathology |
| Functions | `ReportFunctions.cs` | List/get/create/append/finalize/release/assign-number/eligible-sources — **no** generate/download |
| Authz | `LaboratoryAuthz.cs` | view/manage/finalize/release/download/assign_number — **no** generate constant |
| FE | `ReportDetailView.tsx`, `ReportsWorkbench.tsx` | Assign number UI; explicit “not PDF/download” copy |
| FE permissions | `lms-permissions.ts` | Same catalogue; download present; **no** generate |
| Migrations | `20261012*` Report foundation … `20261012210000_AddLmsReportNumberFoundation` | No PDF/artifact migration |

`ReleaseAsync` still only sets Status / ReleasedAtUtc / ReleasedByUserId / RowVersion + `RELEASE_REPORT` (CUT A regression confirmation remains valid).

---

## 7. ReportVersion / snapshot audit

**Evidence class:** Repository evidence.

### Structure

- **ReportVersion** is immutable after creation; regeneration = new version (domain comment).
- After Final/Released, content changes require a new ReportVersion (Draft append path); Released does not rewrite current version.
- Sources bind exact `ResultVersionId` + denormalized value fields at snapshot time (`ResultStatusAtSnapshot` = ClinicallyAuthorized for eligibility).

### Snapshot content present

| Field area | On ReportVersion / Source? |
| --- | --- |
| PatientId / OrderId / OperatingBranchId | Version header |
| Result values / unit / comment | Source |
| Authorization actor/time | Source |
| Catalogue item/version ids, OrderTestId, SpecimenId | Source (ids) |
| Business Report Number | On **Report aggregate** (not version) — correct per PD-ART-02c |
| OrderNumber | DTO join from order (not stored on version row) |
| Patient MRN / name | Available on **eligible-sources** path via OrderVersion snapshots — **not** stored on `LmsReportVersion` / `LmsReportVersionSource` |
| Test display name / internal code | Eligible-sources only — **not** on version source snapshot |
| Reference ranges | **Not** in ReportVersion source |
| Ordering provider / responsible clinician | **Not** in ReportVersion |
| Signatory | **Not** in ReportVersion |
| Specimen barcode / collection details | **Not** in ReportVersion (SpecimenId only) |

### Official PDF binding options (do not decide)

| Option | Description | Evidence note |
| --- | --- | --- |
| **A** | Render **current immutable ReportVersion** source snapshots (+ Report aggregate fields including BusinessReportNumber) | Aligns with clinical SoT immutability |
| **B** | Render Report aggregate + “live” Result joins at generation time | Risks drift from certified snapshot |
| **C** | Other (enriched snapshot schema first) | Would be a prerequisite cut if required fields are mandatory |

**Recommendation (not a decision):** Prefer **A** — official PDF is a rendering of the current immutable ReportVersion snapshot plus Report-level metadata (number, release timestamps, order number via controlled join). Any clinical fields required on PDF but missing from the snapshot are a **product/architecture gap** (see §15 / decision matrix).

---

## 8. PDF / rendering technology audit

**Evidence class:** Repository evidence.

| Renderer | Project | Sync/async | Storage | LMS suitability |
| --- | --- | --- | --- | --- |
| QuestPDF `PatientSummaryPdfService` | AuthService | Sync in HTTP | Bytes returned to caller | **YELLOW reference only** |
| QuestPDF `ImagingExportService` | AuthService | Sync generate then Blob upload (`imaging-reports`) | Azure Blob URL | **YELLOW reference** |
| AuthService `ReportService` TODO | AuthService | N/A | — | Placeholder TODO — not LMS |
| Pathology LabReport attach | AuthService | Client upload | CanonicalDocument + `patient-documents` | **Separate Pathology SoT — do not dual-write** |
| LaboratoryApi | — | — | — | **No QuestPDF package** (`LaboratoryApi.csproj`) |

QuestPDF package: `AuthService.csproj` → `QuestPDF` 2026.2.1. Community license set in Auth PDF services.

Templates/fonts/branding/signatories for LMS Reports: **not found**.

**Recommendation (not a decision):** Add rendering to **LaboratoryApi** (or a Laboratory-owned worker sharing LaboratoryApi DB). Treat Auth QuestPDF as technology reference only. Do **not** make AuthService the LMS Report clinical owner; do **not** use Pathology `LabReportCanonicalDocumentService` as SoT.

---

## 9. Async / job infrastructure audit

**Evidence class:** Repository evidence.

### LaboratoryApi today

| Pattern | Present? |
| --- | --- |
| Azure Functions HTTP | Yes |
| Azure Functions Timer drain for Report PDF | **No** |
| Hangfire | **No** |
| Service Bus | **No** (repo-wide grep: no `ServiceBusClient`) |
| Report PDF job / outbox table | **No** |
| LMS “work queues” | Staff worklist queries only — not job processors |

### Closest reusable patterns (other owners)

| Pattern | Owner | Reuse note |
| --- | --- | --- |
| Integration outbox + Hangfire + Timer backup | IpManagementService | Pattern for claim/retry/dead — **not** drop-in; ownership would be LaboratoryApi |
| Auth BackgroundServices | AuthService | Billing/counselling/reminders — wrong domain ownership |

**Implication of PD-ART-05 (async explicit generate):**

| Concern | Implication |
| --- | --- |
| API response | Accept request → return job/status (not PDF bytes) |
| Job status | Persist Pending/Running/Succeeded/Failed |
| Retries | Governed retry without mutating Report Status/Version/Number |
| Duplicates | Idempotency key + in-flight uniqueness |
| Concurrent generates | Must not create ambiguous “current official” |
| Failure | Auditable; number retained (PD-ART-02d) |
| Artifact pointer | Updated only on successful official generation |

**Recommendation (not a decision):** LaboratoryApi-owned job table + drain (Timer Function and/or Hangfire **inside LaboratoryApi** if separately approved). Do not introduce Service Bus as a new platform bus without platform authorization. Do not host LMS job SoT in AuthService.

---

## 10. CanonicalDocument audit

**Evidence class:** Repository evidence + existing certified decision (PD-ART-07).

| Item | Evidence |
| --- | --- |
| Entity | `AuthService/Models/Domain/CanonicalDocument.cs` |
| Associations | `CanonicalDocumentAssociation` |
| Domains today | `mpi`, `counselling`, `ccms`, `lab` / `LabReport` |
| PatientId | **Required** (NOT NULL) |
| ContentHash | Present; uniqueness patterns exist |
| Storage | Azure Blob; default container `patient-documents`; key `{tenantId:N}/{documentId:N}` |
| Blob service | `BlobStorageService` — private containers (`PublicAccessType.None`); upload helpers; imaging uses separate container |
| Internal register | `InternalCanonicalDocumentController.register-external` (CCMS-shaped) |
| Pathology adapter | `LabReportCanonicalDocumentService` — association `lab` / `LabReport` |
| Retention duration field | **Not** first-class on CanonicalDocument |
| Permissions | Patient document perms (`patient.patient_document.*`) — **not** LMS report download |

### Ownership model for LMS Official PDF (decision-aligned; not implemented)

| Concern | Owner |
| --- | --- |
| Clinical SoT | LaboratoryApi `LmsReport` / `LmsReportVersion` |
| Logical artifact metadata / current official pointer / job | LaboratoryApi (GAP — new) |
| Physical bytes + CanonicalDocument identity | AuthService CanonicalDocument + Blob (downstream) |
| Association | New LMS association (must **not** reuse `LabReport`) — GAP |
| Lifecycle / deletion policy | Product + config (retention) — GAP |

**STOP condition:** Unsafe if LMS Official PDF were dual-written as Pathology `LabReport` documents or if CanonicalDocument replaced Laboratory clinical SoT.  
**Not triggered** if LMS association + Laboratory pointer are introduced per prior readiness audit.

`PatientId = LmsReport.PatientId` is compatible with CanonicalDocument’s required patient field (repository constraint), but does **not** authorize Patient Portal / Patient 360 publication (PD-ART-10 / F01–F02).

---

## 11. Artifact versioning audit

**Evidence class:** Repository evidence.

| Concept | LMS Reports today | Platform elsewhere |
| --- | --- | --- |
| Artifact version table | **Absent** | — |
| Current official pointer on Report | **Absent** | — |
| Content hash on LMS artifact | **Absent** | CanonicalDocument has `ContentHash` |
| Template version on artifact | **Absent** | — |
| Supersession | **Absent** (LMS) | CanonicalDocument `SupersededByDocumentId` / status superseded |

**Recommended future design concepts (not approved requirements):** ReportId, ReportVersionId, ArtifactVersion, ArtifactType, Status, ContentHash, StorageReference/CanonicalDocumentId, TemplateVersion identity, GeneratedAtUtc, GeneratedByUserId, FailureReason, IsCurrent / CurrentArtifactId.

---

## 12. Template configuration audit

**Evidence class:** Repository evidence + existing certified decision (PD-ART-06).

| Item | Status |
| --- | --- |
| Tenant-level LMS Report PDF template store | **CONFIGURATION_PREREQUISITE_MISSING** |
| Template version identity | Missing |
| Template effective-from / activation | Missing |
| Org/tenant logos | Exist elsewhere (`Organization.LogoUrl`, tenant branding fields) — **not** LMS Report template config |
| Imaging `ReportTemplate` option | In-memory export option — not LMS governed template |

Do **not** invent default template bytes. Missing template blocks official PDF UAT/go-live.

---

## 13. Signatory audit

**Evidence class:** Repository evidence + existing certified decision (PD-ART-06b = configured laboratory signatory).

| Item | Status |
| --- | --- |
| Laboratory / report signatory config in LaboratoryApi | **None** |
| Signature image store for LMS Reports | **None** |
| User professional credentials | Exist for staff compliance (UsersController / UserCredentials) — **not** a laboratory report signatory configuration |
| Signatory hierarchy / dual-control | Out of scope historically; do not invent |

**CONFIGURATION_PREREQUISITE_MISSING** for official PDF go-live.

---

## 14. PDF content audit

**Evidence class:** Repository evidence.  
**Existing certified decision:** Official PDF **MUST** display Business Report Number (PD-ART-11).

### Available for rendering without inventing clinical content

- Report identity, tenant, operating branch  
- Status / Final / Release metadata  
- Business Report Number (+ assigned at/by)  
- Current ReportVersion number + created at/by  
- Per-source: ResultVersion binding, datatype, numeric/qualitative values, unit, comment, authorized by/at, catalogue/specimen/order-test ids  
- OrderNumber via order join (already used in DTOs)

### Gaps if Product Owner requires them on official PDF

| Content | Gap |
| --- | --- |
| Patient MRN / legal name on PDF | Not on ReportVersion snapshot (eligible-sources has OrderVersion snapshots) |
| Test display names | Not on version source snapshot |
| Reference ranges / interpretations / diagnoses | Not in snapshot — **do not invent** |
| Ordering provider / responsible clinician | Not in snapshot |
| Specimen collection details / barcode | SpecimenId only |
| Configured signatory display | Config store missing |
| Template branding blocks | Template store missing |

**Unresolved Product Owner decision:** Exact mandatory PDF content set given current snapshot limitations (enrich snapshot vs controlled joins at generation vs reduce PDF content to snapshot-only fields).

---

## 15. Storage / Blob audit

**Evidence class:** Repository evidence + PD-ART-07.

| Topic | Finding |
| --- | --- |
| Physical store target (decision) | CanonicalDocument + Blob |
| Private containers | Yes (`PublicAccessType.None` on create) |
| Deterministic object keys | CanonicalDocument helper `{tenant}/{documentId}` |
| Content hash | CanonicalDocument + identity service |
| SAS / streaming | Patient document download paths exist in Auth; LMS staff download is CUT C |
| Imaging reports container | Separate pattern (`imaging-reports`) — not LMS Official PDF |
| CUT B → CUT C | CUT B must persist Laboratory current-official pointer + CanonicalDocumentId + hash so CUT C can stream without redesign |

---

## 16. Security / permission audit

**Evidence class:** Repository evidence.

| Code | Catalogue | Wired for LMS Official PDF |
| --- | --- | --- |
| `lms.reports.view` | Yes | View |
| `lms.reports.manage` | Yes | Draft manage |
| `lms.reports.finalize` | Yes | Finalize |
| `lms.reports.release` | Yes | Release |
| `lms.reports.assign_number` | Yes | CUT A |
| `lms.reports.download` | Yes (catalogue only) | **Not wired** (CUT C) |
| `lms.reports.generate` | **Absent** | Future permission requirement |

Branch/tenant: Report operations use `ValidateUserBranchAsync` + tenant checks + RowVersion (existing pattern).

PD-ART-13: **No** production role grants in L-REP-03 — preserve.

---

## 17. Audit action audit

**Evidence class:** Repository evidence.

| Action | Exists today |
| --- | --- |
| `ASSIGN_REPORT_NUMBER` | Yes (Lab + Auth allowlist) |
| `RELEASE_REPORT` / finalize / draft actions | Yes |
| `REQUEST_OFFICIAL_PDF` | **No** |
| `OFFICIAL_PDF_GENERATED` | **No** |
| `OFFICIAL_PDF_FAILED` | **No** |
| `DOWNLOAD_OFFICIAL_PDF` | **No** (CUT C) |

**Recommendation (not a decision):** Follow fail-closed conventions: audit request acceptance, success, and failure separately; download audit remains CUT C (PD-ART-09b). Exact action strings require Product Decision / readiness confirmation before allowlist seeding.

---

## 18. Idempotency / concurrency audit

**Evidence class:** Repository evidence (Report ops) + recommendation.

Existing Report pattern: idempotency key + request hash + `expectedRowVersion` → 409; PostgreSQL-safe sequences for numbers.

**Recommended PDF semantics (not approved):**

| Scenario | Recommended behavior |
| --- | --- |
| Same idempotency key replay | Return prior acceptance/job result |
| Hash conflict | Reject |
| Already-running job | Reject or return same job id under policy |
| Already-succeeded current official (no regeneration intent) | Return existing artifact / no-op under policy |
| Retry after failure | New attempt allowed; number retained |
| Concurrent generates | Serialize current-official update; unique in-flight constraint |
| Regeneration (template/branding change) | New artifact version; prior retained; pointer update governed (PD-ART-05b / PD-ART-09) |

---

## 19. Failure / retry audit

**Existing certified decisions:**

- Number retained if PDF fails (PD-ART-02d)  
- Failed generation must not change Report Status / ReportVersion / Release  
- Failure must be auditable  

**Repository:** No PDF job failure model yet. Closest patterns: Report assign fail-closed audit revert; IP outbox Failed retry.

---

## 20. Regeneration audit

**Existing certified decision:** PD-ART-05b — new artifact version on template/branding change; prior retained; PD-ART-09 — one current official.

**Repository gap:** No LMS artifact version / current pointer. CanonicalDocument supersession exists but must not replace Laboratory current-official pointer ownership.

---

## 21. Retention audit

| Area | Finding |
| --- | --- |
| CanonicalDocument retention duration | Not first-class |
| LMS Report retention policy | Not present for PDF artifacts |
| Decision package | Duration only if enforcement required — do not invent |

**Product Owner decision required** if retention enforcement is mandatory for official artifacts; otherwise document as configuration-later.

---

## 22. Multi-tenant / multi-branch audit

| Boundary | Current / required |
| --- | --- |
| Tenant on Report / CanonicalDocument | Required |
| Operating branch on Report / number sequence | CUT A certified |
| Template scope (decision) | Tenant-level (PD-ART-06) |
| Signatory scope | Configured laboratory signatory (exact branch binding unresolved) |
| Artifact identity | Should include tenant; branch context from Report; storage keys tenant-scoped |

Do **not** weaken CUT A operating-branch number semantics.

---

## 23. Patient / PHI boundary

**Existing certified decisions:** Staff-only; no Patient Portal / Patient 360 download/publication (PD-ART-10, F01–F02).

Implications:

- CanonicalDocument `PatientId` is a storage identity constraint — **not** patient publication  
- Job payloads / logs / failure messages must avoid unnecessary PHI  
- Audit records should prefer ids over clinical payloads where platform conventions allow  

---

## 24. Download dependency audit (CUT C — not in scope)

CUT C will need from CUT B:

- Authoritative **current official** artifact pointer (LaboratoryApi)  
- CanonicalDocumentId / content hash / mime / size  
- Server-side content retrieval path  
- `lms.reports.download` wiring  
- Fail-closed `DOWNLOAD_OFFICIAL_PDF` (or equivalent) before stream  
- Eligibility: Released + artifact available (PD-ART-08)

Do **not** implement download in CUT B discovery or future CUT B unless Decision Closure packages it.

---

## 25. Product decision matrix

Legend: **A** = repository evidence · **B** = existing certified decision · **C** = discovery recommendation · **D** = unresolved Product Owner decision

| # | Topic | Status | Notes |
| --- | --- | --- | --- |
| 1 | PDF eligibility | **B** PD-ART-04 = Released only | Repo still supports Draft/Final/Released |
| 2 | Business Report Number mandatory for official PDF | **B** PD-ART-01 + PD-ART-11 | CUT A delivers number; block official complete without number |
| 3 | Exact PDF content | **D** (+ snapshot gaps **A**) | Number required (**B**); other fields TBD vs snapshot |
| 4 | Template ownership | **B** PD-ART-06 tenant-level | Store **missing** (**A**) |
| 5 | Template versioning | **B** record identity on artifact | Mechanism **D**/implementation |
| 6 | Branding ownership | **B** with template | Config missing (**A**) |
| 7 | Signatory data | **B** PD-ART-06b configured lab signatory | Store **missing** (**A**) |
| 8 | Signatory representation | **D** | Text vs image vs both |
| 9 | Generation trigger | **B** PD-ART-05 explicit staff | Not Release |
| 10 | Sync vs async | **B** asynchronous | Lab job infra missing (**A**) |
| 11 | Retry behavior | **B** PD-ART-02d retain number | Job model **C** |
| 12 | Regeneration | **B** PD-ART-05b | Pointer model missing (**A**) |
| 13 | Artifact versioning | **B** PD-ART-09 / 05b | LMS tables missing (**A**) |
| 14 | Current artifact semantics | **B** one current official | Pointer missing (**A**) |
| 15 | Storage ownership | **B** PD-ART-07 CanonicalDocument + Blob | LMS association missing (**A**) |
| 16 | CanonicalDocument integration | **B** downstream | Must not use Pathology LabReport association (**A**/C) |
| 17 | Retention enforcement | **D** | No duration invented |
| 18 | PDF failure semantics | **B** retain number; no status/version change | |
| 19 | Audit actions | **D** exact codes | Request/success/failure recommended (**C**) |
| 20 | Permission | **D** exact code | `lms.reports.generate` recommended (**C**); catalogue absent (**A**) |
| 21 | Idempotency | **C** align Report ops | Op name TBD (**D**) |
| 22 | Concurrency | **C** in-flight + pointer governance | |
| 23 | Artifact immutability | **B**/C | Bytes immutable via hash; pointer moves on regen |
| 24 | Staff-only boundary | **B** PD-ART-10 | |
| 25 | Relationship to download | **B** download after artifact | CUT C separate |

No conflict found that makes an approved PD-ART decision technically infeasible **provided** configuration prerequisites and Laboratory-owned artifact/job models are introduced. No silent redesign of approved decisions.

---

## 26. Candidate implementation cuts

**DISCOVERY RECOMMENDATION ONLY — not authorized.**

### Recommended sequence

```text
CUT A — Report Number Foundation        ✅ ACCEPTED
CUT B1 — Official PDF artifact foundation   (next candidate)
CUT B2 / CUT C — Staff download             (after B1)
```

Note: Original PD-ART-12 packaged numbering+PDF as one capability; **CUT A already delivered numbering**. Remaining Official PDF work is therefore a **bounded PDF/artifact cut**, not a reopening of numbering.

### CUT B1 — Official PDF artifact foundation

| Aspect | Proposed boundary |
| --- | --- |
| Objective | Explicit async official PDF generation for Released+numbered Reports; LMS-owned artifact versions + current official pointer; downstream CanonicalDocument + Blob |
| Dependencies | CUT A accepted; template + signatory configuration stores/values; generate permission + audit allowlist; Lab job drain |
| Schema | LMS artifact (+ job) tables; **no** Release/Number semantic changes |
| APIs | Request generate + query status/current artifact (no download stream) |
| Permissions | Add catalogue `lms.reports.generate` (or PO-approved code); **no** role grants |
| Audit | Request / generated / failed (exact codes per Decision Review) |
| Configuration | Tenant template + laboratory signatory (no invented defaults) |
| UI | Generate Official PDF + status on Report detail (no download) |
| Storage | CanonicalDocument + Blob via Auth; new LMS association (not LabReport) |
| Tests | Eligibility, number required, async job, concurrency, fail retain number, regression Release/Number |
| UAT | Generate success/failure/retry; no download required |
| Out of scope | Download, patient publish, notify, amendments, Pathology, Release changes, number rule changes |

### CUT B2 / CUT C — Staff download

| Aspect | Proposed boundary |
| --- | --- |
| Objective | Staff download of current official artifact |
| Dependencies | CUT B1 current official pointer + content retrieval |
| Permissions | Wire `lms.reports.download` |
| Audit | Fail-closed download audit |
| UI | Detail + worklist download affordances |
| Out of scope | Patient download; regenerate; numbering |

### Optional prerequisite cut (only if PO mandates snapshot-only PDF content that is currently missing)

**CUT B0 — ReportVersion snapshot enrichment** for PDF-required display fields (MRN/name/test labels/etc.) — only if Decision Review rejects generation-time controlled joins.

---

## 27. Dependency graph

```text
ACCEPTED Release (metadata)
        ↓
ACCEPTED Business Report Number (CUT A)
        ↓
[CONFIG] Tenant PDF template + laboratory signatory
        ↓
CUT B1 Official PDF job + LMS artifact + CanonicalDocument bytes
        ↓
CUT C Staff download (lms.reports.download)
```

---

## 28. Risks / blockers

| Risk / blocker | Severity | Notes |
| --- | --- | --- |
| Missing LMS PDF template configuration store/values | **Blocker for UAT/go-live** | PD-ART-06 |
| Missing laboratory signatory configuration | **Blocker for UAT/go-live** | PD-ART-06b |
| No LaboratoryApi job/drain infrastructure | **Blocker for async PD-ART-05** | Must be designed in Decision Review / readiness |
| No LMS artifact / current-official model | **Blocker** | |
| No `lms.reports.generate` / PDF audit actions | **Required before implementation** | Catalogue + allowlist |
| Snapshot content gaps vs desired PDF fields | **Product gap** | May force B0 or content reduction |
| Pathology LabReport CanonicalDocument path misuse | **High** if reused | Explicitly forbid |
| Cross-service CanonicalDocument registration contract | **Design risk** | Extend/adapt internal API carefully; keep LMS SoT in Lab |
| Retention duration unknown | Medium | Only if enforcement required |
| Auth QuestPDF license/ops coupling if wrongly placed in Auth | Medium | Prefer Laboratory-owned renderer |

No approved PD-ART decision was found to be technically impossible given these gaps; gaps are prerequisites, not decision conflicts.

---

## 29. Regression boundaries

Must not change:

| Slice | Protect |
| --- | --- |
| L-REP-01 | Draft, ReportVersion snapshots, source claims |
| L-REP-02A | Finalize, Final immutability |
| L-REP-02B | Release metadata, idempotency, concurrency, `RELEASE_REPORT`, fail-closed audit |
| L-REP-03 CUT A | Business Report Number, operating-branch sequence, immutability, assign idempotency, `ASSIGN_REPORT_NUMBER`, number UI, no auto-assign on Release |
| Legacy Pathology | Unchanged — no dual-write |

---

## 30. Recommendation

**DISCOVERY RECOMMENDATION ONLY:**

1. Proceed to **Product Decision Review** focused on CUT B1 Official PDF artifact foundation (not download).  
2. Preserve all stamped PD-ART decisions; do not reopen Release or CUT A number semantics.  
3. Treat template + signatory configuration as **hard prerequisites**.  
4. Prefer LaboratoryApi-owned renderer + job/artifact SoT; CanonicalDocument + Blob as downstream bytes; **new** LMS association (not Pathology `LabReport`).  
5. Prefer PDF render of **immutable current ReportVersion** + Report aggregate number/metadata.  
6. Sequence: **B1 → C**; optional **B0** only if content gaps force snapshot enrichment.  
7. Do **not** start implementation until Decision Review / readiness authorization for CUT B.

---

## 31. Next gate

```text
NEXT_GATE = PRODUCT_DECISION_REVIEW
```

This task does **not** create a Product Decision Closure and does **not** authorize CUT B implementation.

---

## 32. Final stamps

```text
DISCOVERY_COMPLETE
NO_IMPLEMENTATION_STARTED
L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A
CUT_B_NOT_STARTED
CUT_C_NOT_STARTED
PRODUCT_DECISION_REVIEW_REQUIRED
NEXT_GATE = PRODUCT_DECISION_REVIEW
STOP
```

**STOP.** Do not implement PDF, QuestPDF, jobs, artifacts, download, permissions, or schema in this task.
