# Enterprise LMS — Post L-REP-02B Report Lifecycle Discovery

**Date:** 2026-10-12  
**Mode:** DISCOVERY / AUDIT ONLY — no application code, schema, migrations, APIs, UI, routes, permissions, role grants, state machines, ResultStatus, PDF, numbering, download, publication, NotificationHub, Amendments, Unrelease/Revoke, Pathology, CanonicalDocument association for LmsReport, Orders/Collection/Specimen/Receiving/Barcode, Testing, Verification, Clinical Authorization, or Critical Results changes  

**Authoritative upstream stamps:**

| Stamp | Source |
| --- | --- |
| `ACCEPTED_L_REP_02B` | [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) |
| `MANUAL_UAT_PASSED` | Same |
| `ACCEPTANCE_COMPLETE` | Same |
| `NEXT_GATE = PRODUCT_DISCOVERY_REQUIRED` | Same (this document satisfies that gate’s discovery deliverable) |
| `PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED` | [enterprise-lms-report-release-decision-closure.md](./enterprise-lms-report-release-decision-closure.md) |
| `ACCEPTED_L_REP_02A` | Report Finalize acceptance |
| L-REP-01 foundation | Reporting decision closure / implementation |

```text
ACCEPTED_L_REP_02B (metadata Release)
  ↓
THIS DOCUMENT — post-Release Report lifecycle discovery
  ↓
NEXT_GATE = PRODUCT_DECISION_REVIEW
  (no Product Decision Closure created by this task)
```

**Label for all sequencing advice in this document:** `DISCOVERY RECOMMENDATION ONLY` — nothing herein is approved for implementation.

---

## 1. Discovery scope

### In scope

- Evidence-based inventory of post–L-REP-02B Report lifecycle candidate capabilities  
- Enterprise LMS Report domain state after accepted Release  
- Legacy Pathology / AuthService LabReport / CanonicalDocument / Patient 360 / Patient Portal / notification / numbering / PDF surfaces that exist elsewhere  
- Dependency graph and unresolved product decisions  
- Candidate slice boundaries and recommended sequencing (discovery recommendation only)

### Explicitly out of this task

- Any implementation (backend, frontend, schema, API, UI, permissions, grants, audit allowlist)  
- Product Decision Closure  
- Implementation prompt / coding authorization  
- Migration or dual-write of Pathology LabReport into LMS  
- Reopening certified L-REP-01 / L-REP-02A / L-REP-02B behavior  

### Candidate areas audited

| ID | Candidate |
| --- | --- |
| A | PDF / Report Document Generation |
| B | Report Numbering |
| C | Report Download |
| D | Patient Portal / Patient 360 Publication |
| E | Notification / Delivery |
| F | Report Amendments |
| G | Unrelease / Revoke |

Candidates are **not** assumed to be separate slices; §10–§11 propose coherent boundaries from repository evidence.

---

## 2. Current certified Report lifecycle

### Certified states

```text
Draft → Final → Released
```

| Transition | Slice | Certified meaning |
| --- | --- | --- |
| → Draft | L-REP-01 | Create Draft Report + immutable ReportVersion snapshots from ClinicallyAuthorized ResultVersions; source claims |
| Draft → Final | L-REP-02A (`ACCEPTED_L_REP_02A`) | Metadata Finalize: `FinalizedAtUtc` / `FinalizedByUserId`; freeze current ReportVersion; no PDF/number/publish |
| Final → Released | L-REP-02B (`ACCEPTED_L_REP_02B`) | Metadata Release only |

### Certified L-REP-02B Release behavior (must remain unchanged)

1. `Report.Status` Final → Released  
2. Records `ReleasedAtUtc` (server UTC) and `ReleasedByUserId` (authenticated actor)  
3. Keeps existing `ReportVersion` / `CurrentVersionNumber` — **no new ReportVersion**  
4. Preserves immutable snapshots and source claims  
5. Does **not** change `ResultStatus`, `ResultVersion`, or `CriticalResultEvent`  
6. Does **not** generate PDF, create CanonicalDocument, assign business Report number  
7. Does **not** download, publish to patients, notify, amend, or unrelease/revoke  
8. Permission `lms.reports.release`; idempotency `release_report`; audit `RELEASE_REPORT` fail-closed  
9. Released remains staff-only (not patient-visible)  

**Evidence:** acceptance closure §3–§4; `LmsReport.cs`; `ReportStatuses` in `ReportEnums.cs`; `ReportService.ReleaseAsync`; `POST …/release` in `ReportFunctions.cs`; FE `ReportDetailView.tsx`.

---

## 3. Repository capability inventory

### 3.1 Enterprise LMS Report domain (LaboratoryApi SoT)

| Artifact | Path / symbol | Post–L-REP-02B state |
| --- | --- | --- |
| Aggregate | `LaboratoryApi/Domain/LmsReport.cs` → `lms_reports` | Status Draft/Final/Released; Finalized*; Released*; PatientId; OrderId; OperatingBranchId; CurrentVersionNumber; RowVersion |
| Version | `LmsReportVersion.cs` → `lms_report_versions` | Immutable versions; regeneration = new version |
| Version source | `LmsReportVersionSource.cs` → `lms_report_version_sources` | Exact ResultVersion binding + value snapshot |
| Source claims | `LmsReportDraftSourceClaim.cs` → `lms_report_draft_source_claims` | One ResultVersion ≤ one active Draft Report per tenant; retained through Final and Release |
| Idempotency | `LmsReportIdempotencyRecord.cs` → `lms_report_idempotency` | Ops: `create_report_draft`, `append_report_version`, `finalize_report`, `release_report` |
| Status constants | `ReportStatuses` | `Draft`, `Final`, `Released` |
| Audit actions | `ReportAuditActions` | `CREATE_REPORT_DRAFT`, `APPEND_REPORT_VERSION`, `FINALIZE_REPORT`, `RELEASE_REPORT` |
| Service | `ReportService.cs` | CreateDraft, AppendVersion (Draft-only), Finalize, Release, Get, GetVersion, List, ListEligibleSources; private RevertFinalize/RevertRelease (audit fail-closed only) |
| API | `ReportFunctions.cs` | GET eligible-sources, GET/POST reports, GET report, GET version, POST versions, POST finalize, POST release — **no PDF/download/publish/amend/unrelease** |
| Migrations | `20261012160000_*` … `20261012200000_AddLmsReportReleaseMetadata` | Foundation + claims + Finalized* + Released* |
| FE API | `lms-reports.api.ts` | create/list/get/finalize/release; getVersion; **no appendVersion client**; no download |
| FE UI | `ReportsWorkbench.tsx`, `ReportDetailView.tsx` | Draft create; Finalize; Release; honesty: no PDF/Download/Publish/Notify/Unrelease |
| Capability registry | `lms-capability-registry.ts` | Reports = implemented (metadata); Amendments = `not_implemented` |

### 3.2 Permissions (catalogue)

| Code | Seeded | Endpoint wired | Role grants |
| --- | --- | --- | --- |
| `lms.reports.view` | Yes | Yes | None by design (PD-REP-21) |
| `lms.reports.manage` | Yes | Yes (create/append API) | None |
| `lms.reports.finalize` | Yes | Yes | None |
| `lms.reports.release` | Yes | Yes | None |
| `lms.reports.download` | Yes (catalogue only) | **No** — `LaboratoryAuthz.ReportsDownload` documents “Download not implemented” | None |
| `lms.reports.publish` | **Not seeded** (forbidden in first reporting catalogue) | No | N/A |

**Evidence:** `EnterpriseLmsReportsPermissionCatalog.cs`, `LaboratoryAuthz.cs`, FE `lms-permissions.ts`, UI tests asserting no `lms.reports.publish`.

### 3.3 Cross-platform surfaces (not LMS Report SoT)

| Surface | Location | Lab/report relevance |
| --- | --- | --- |
| AuthService `LabReport` | `LabReportsController.cs`, Pathology FE `/dashboard/laboratory` | Legacy order/complete/attach lifecycle; orthogonal statuses |
| CanonicalDocument + Blob | `LabReportCanonicalDocumentService`, `BlobStorageService`, `CanonicalDocumentIdentityService` | Staff attach + stream for **Pathology LabReport** files |
| Patient 360 Documents | `Patient360Documents.tsx`, `LabReportsTab.tsx` | Staff visibility/download of **legacy** LabReport attachments |
| Patient Portal results | `app/patient/results/page.tsx` | **Mock data only** — no LMS / LabReport API |
| QuestPDF | AuthService `PatientSummaryPdfService`, `ImagingExportService`; clinical `ReportService` TODO | **Not** LaboratoryApi; **not** wired to LmsReport |
| Number sequences | `LmsOrderNumberSequence`, `LmsAccessionNumberSequence`, `LmsBarcodeNumberSequence`, `LmsCollectionTaskNumberSequence` | Exist for other LMS domains — **no Report number sequence** |
| Critical notification intent | `PlatformNotificationClient`, `CriticalResultEvent.NotificationIntent*` | L-CRT pattern: lab emits intent, platform delivers — **not** Report Release |
| NotificationHub | AuthService hub | Platform realtime; **no** LmsReport Release events found |
| LMS Amendments nav | `/dashboard/lms/results/amendments` | Capability registry: `not_implemented` |

---

## 4. Candidate capability audit

### A. PDF / Report Document Generation

| Dimension | Finding |
| --- | --- |
| Enterprise LMS | **Absent** — ReportService/ReportFunctions explicitly exclude PDF; LaboratoryApi has no QuestPDF/Puppeteer/iText references |
| Legacy Pathology | **Partial — upload, not generation** — staff attach an existing file to LabReport via CanonicalDocument |
| AuthService other modules | QuestPDF exists for Patient Summary and Imaging export; clinical examination ReportService has TODO for PDF/DOCX |
| CanonicalDocument | Downstream byte store pattern approved architecturally (PD-REP-25) but **not associated with LmsReport** |
| Permissions / audit | No LMS PDF-generate permission or audit action |
| Configuration | Templates/branding stamped `CONFIGURATION_REQUIRED` when PDF in scope (PD-REP-14) |
| Product decision needed? | **Yes** — generation timing, eligibility, template ownership, signatory on artifact, regeneration, immutability |
| Conflict risk | Reusing Pathology attach-as-generation would invent wrong SoT; hard-coding templates forbidden without config |

### B. Report Numbering

| Dimension | Finding |
| --- | --- |
| Enterprise LMS Reports | **Absent** — identity is Report GUID; Release explicitly does not assign business number (PD-REP-02B-08/23) |
| Other LMS domains | Order / accession / barcode / collection-task sequences exist — **must not silently become Report numbers** |
| Legacy LabReport | GUID identity; optional `ReportUrl` string — not a governed Report number |
| Permissions / audit | None for Report numbering |
| Configuration | PD-REP-13: numbering is configuration-owned; inventing format/scope forbidden |
| Product decision needed? | **Yes** — when assigned (Final vs Release vs PDF), branch/tenant scope, gaps/reuse, amendment interaction |
| Conflict risk | Using Order/Accession number as Report number is explicitly forbidden by L-REP-02B closure |

### C. Report Download

| Dimension | Finding |
| --- | --- |
| Enterprise LMS | **Catalogue permission only** (`lms.reports.download`); no API, no UI, no artifact |
| Legacy Pathology | **Exists** — `GET /lab-reports/{id}/report/content` + FE `downloadLabReportContent`; requires `patient.view` |
| CanonicalDocument / Blob | Streams attached file bytes for LabReport association |
| Patient portal | Mock Download UI only — not backend-backed |
| Product decision needed? | **Yes** — staff vs patient, eligibility (Final vs Released), artifact prerequisite, audit action, permission semantics |
| Dependency | Technically requires a generated or attached artifact; LMS has neither |

### D. Patient Portal / Patient 360 Publication

| Dimension | Finding |
| --- | --- |
| Enterprise LMS | **Absent** — `lms.reports.publish` not seeded; Released ≠ patient-visible (PD-REP-08, PD-REP-02B-12) |
| Patient 360 (staff) | **Exists for legacy LabReport documents** — not LMS Report SoT (PD-REP-24) |
| Patient Portal | **Mock / conceptual** — `/patient/results` hardcoded |
| Product decision needed? | **Yes** — Portal vs 360, visibility timing, withdrawal, patient identity linkage, document ownership |
| Conflict risk | Treating Release as publication violates certified principles |

### E. Notification / Delivery

| Dimension | Finding |
| --- | --- |
| Enterprise LMS Reports | **Absent** — Release emits no notification intent (PD-REP-02B-11/21) |
| Platform | NotificationHub + AuthService internal notify APIs exist |
| LMS Critical Results | Notification **intent** pattern exists (`PlatformNotificationClient`) — Report Release does not use it |
| SMS / WhatsApp / Email | Exist in other domains (e.g. counselling); not lab-report delivery |
| Product decision needed? | **Yes** — trigger (Release vs PDF vs publish), channel, consent, retries, delivery state, ownership vs NotificationHub |
| Architecture principle already stamped | Release ≠ Notification Delivery (PD-REP-19); future: Released → Intent → Orchestration |

### F. Report Amendments

| Dimension | Finding |
| --- | --- |
| Enterprise LMS post-Final/Released | **Absent** as product capability |
| Draft versioning | **Exists** — `AppendVersionAsync` / `POST …/versions` only while `Status == Draft`; FE client for append **not** present |
| Result domain | ResultVersion supersession exists; not a released-report amendment workflow |
| Orders | Order amend exists — different domain |
| CanonicalDocument | Document supersession fields exist — document domain, not LmsReport amend |
| Capability registry | Amendments = `not_implemented` |
| Product decision needed? | **Yes** — whether Released can be amended; new ReportVersion vs superseding Report; claim lifetime; numbering/PDF/patient visibility consequences |
| Certified constraint | Final/Released content immutable in place (PD-REP-06/17, PD-REP-02B-22); claims remain until governed Amendment policy |

### G. Unrelease / Revoke

| Dimension | Finding |
| --- | --- |
| Enterprise LMS product API/UI | **Absent** — forward-only Release (PD-REP-02B-07); FE asserts no Unrelease |
| Internal compensation | `RevertReleaseAsync` / `RevertFinalizeAsync` exist **only** for audit fail-closed rollback — not staff workflows |
| Permissions / audit | No `lms.reports.unrelease` / revoke audit actions |
| Product decision needed? | **Yes** — whether permitted at all; authority; audit; patient/document/notification consequences |
| Risk | Exposing RevertRelease as product Unrelease would conflate compensation with clinical policy |

---

## 5. Legacy versus Enterprise LMS boundary

| Concern | Enterprise LMS (LaboratoryApi) | Legacy Pathology (AuthService LabReport) | Shared platform |
| --- | --- | --- | --- |
| Clinical/report SoT | `LmsReport` / `LmsReportVersion` | `LabReport` / items / complete | — |
| Lifecycle | Draft → Final → Released | ordered → … → completed / cancelled / on_hold | — |
| Document bytes | **None today** | Attach file → CanonicalDocument + Blob | CanonicalDocument, BlobStorage |
| Staff Patient 360 | **No LMS publish** | Lab filter + attach + download | Patient documents APIs |
| Patient Portal | Not integrated | Not integrated (mock UI) | — |
| PDF generation | None | None (upload only) | QuestPDF elsewhere |
| Numbering | No Report sequence | No business Report number | LMS sequences for other entities |
| Coexistence rule | **No dual-write / bridge / migration / replacement** (PD-REP-26; L-REP-02B preserved) | Remains separate | — |

**Discovery rule:** Existing Pathology/CanonicalDocument/QuestPDF capabilities are **reference inventory only**. They must not be auto-migrated, redirected, or dual-written into LMS without a separate Product Decision Closure.

---

## 6. Dependency graph

```text
ClinicallyAuthorized ResultVersion(s)
        ↓ (L-REP-01)
   Draft Report + ReportVersion snapshots + source claims
        ↓ (L-REP-02A)
   Final Report (same ReportVersion frozen)
        ↓ (L-REP-02B ACCEPTED)
   Released Report (metadata; same ReportVersion)
        ↓  [future — not authorized]
   ┌────┴────┬────────────┬──────────────┬─────────────┐
   │         │            │              │             │
  (B)       (A)          (C)            (E)           (D)
 Numbering  PDF/Doc     Download     Notify/Deliver  Publish
   │         │            │              │             │
   └────┬────┘            │              │             │
        │                 │              │             │
        └──── artifact ───┘              │             │
              (bytes)                    │             │
                    └────── may feed ────┴─────────────┘
                                      (F) Amendments / (G) Unrelease
                                      (cross-cut all of the above)
```

### Per-candidate prerequisites (evidence-based)

| Candidate | Prerequisite state | Prerequisite entity | ReportVersion | Result | Permissions | Audit | Config | Storage | Patient linkage | Security / tenant-branch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A PDF** | Unresolved: Final and/or Released | Current frozen `LmsReportVersion` + sources | Authoritative content snapshot | Must remain unchanged by PDF | Likely new or extend download/manage — **undecided** | New action needed — **absent** | Templates/branding **CONFIGURATION_REQUIRED** (PD-REP-14) | Likely CanonicalDocument/Blob (PD-REP-25 architecture) | PatientId already on Report | Tenant + operating branch (existing pattern) |
| **B Numbering** | Unresolved: Final vs Release vs PDF time | `LmsReport` (+ future number attribute) | Not content | Unchanged | Undecided | Undecided | **CONFIGURATION_REQUIRED** (PD-REP-13) | Sequence table (pattern exists elsewhere) | N/A | Scope (tenant/branch) **undecided** |
| **C Download** | Artifact must exist (gen or attach policy) | Document/bytes + Report association | Version binding if versioned artifacts | Unchanged | Catalogue `lms.reports.download` exists; wiring absent | Download audit **absent** for LMS | Retention if stored (PD-REP-23) | Blob/CanonicalDocument or alternate | PatientId for authorization context | Staff vs patient boundary **undecided** |
| **D Publication** | Likely Released + (often) document; **policy undecided** | LMS Report as SoT; Patient 360/Portal as consumers | Immutable released content | Unchanged | `lms.reports.publish` **not seeded** | Absent | Visibility/consent policy | Document discovery | Authoritative patient identity | Patient security ≠ staff; Portal separate |
| **E Notify** | Trigger state **undecided** (Release alone stamped as insufficient for auto-delivery) | Intent record vs hub message | Optional reference | Unchanged | Undecided | Delivery honesty (see L-CRT pattern) | Channel/consent | Platform notification services | Patient/clinician recipients | NotificationHub ownership already platform |
| **F Amendments** | Released (and/or Final) immutable today | New ReportVersion and/or superseding Report; claim policy | New version semantics **required by principle** | May need Result amend first — **undecided** | Undecided | New actions | Supersession policy | May regenerate PDF/number | Patient visibility of corrections | Same tenant/branch |
| **G Unrelease** | Released | `LmsReport` status reverse or revoke flag | Content may remain; visibility may change | Must not silently mutate | Undecided | Mandatory if permitted | Authority | Downstream docs/notifies | Withdrawal from patient surfaces | High clinical/privacy risk |

**Technical convenience must not set product policy.** Example: PDF could technically render a Final ReportVersion before Release, but whether that is allowed remains a Product Decision.

---

## 7. Existing permissions / audit / configuration

### Permissions

| Code | Status |
| --- | --- |
| `lms.reports.view` / `manage` / `finalize` / `release` | Implemented for certified lifecycle |
| `lms.reports.download` | Catalogue reserved; unused |
| `lms.reports.publish` | Explicitly not seeded |
| Unrelease / amend / generate-pdf codes | **Not found** |

### Audit (platform `audit_log`, fail-closed for mutations)

| Action | Resource | Status |
| --- | --- | --- |
| `CREATE_REPORT_DRAFT` | `LmsReport` | Implemented |
| `APPEND_REPORT_VERSION` | `LmsReportVersion` | Implemented |
| `FINALIZE_REPORT` | `LmsReport` | Implemented |
| `RELEASE_REPORT` | `LmsReport` | Implemented (L-REP-02B) |
| PDF / download / publish / notify / amend / unrelease | — | **Not found** for LMS Reports |

### Configuration

| Topic | Established stance |
| --- | --- |
| L-REP-02B Release authority | Permission + tenant + operating branch; `CONFIGURATION_REQUIRED = NO` for metadata Release |
| Business Report numbering | Configuration-owned when implemented (PD-REP-13) |
| Templates / branding | Configuration-owned when PDF in scope (PD-REP-14) |
| Signatory hierarchy beyond permission | Not required for metadata Release; may reopen for document/signatory slices |
| Retention duration | Principle only; duration `CONFIGURATION_REQUIRED` (PD-REP-23) |
| Dual-control Finalizer ≠ Releaser | Not required (PD-REP-02B-06) |

---

## 8. Product decisions already established

(Repository / closure evidence — not reopened by this discovery.)

| Decision | Stamp / rule |
| --- | --- |
| Lifecycle Draft → Final → Released separate from ResultStatus | PD-REP-05 |
| LaboratoryApi owns LMS Reports; Pathology LabReport is not LMS SoT | PD-REP-01 / PD-REP-26 / AD-REP-02 |
| Released ≠ patient-visible automatically | PD-REP-08; PD-REP-02B-12 |
| Release ≠ notification delivery | PD-REP-07 / PD-REP-19; PD-REP-02B-11 / 21 |
| CanonicalDocument may store bytes downstream; must not become clinical SoT | PD-REP-25 / AD-REP-05 |
| PDF is a separate capability; do not hard-code renderer into clinical SoT | PD-REP-12 / AD-REP-06 |
| Report numbering configuration-owned; Order/Accession ≠ Report number | PD-REP-13; PD-REP-02B-08 / 23 |
| Amendments out of L-REP-01; Final/Released not edited in place | PD-REP-17; PD-REP-02B-14 / 22 |
| Source claims remain through Final and Release until Amendment policy | L-REP-02A PD-REP-02-11; PD-REP-02B-13 |
| L-REP-02B = metadata-only Release; forward-only | PD-REP-02B-01 … 24; `ACCEPTED_L_REP_02B` |
| No production role grants for report permissions in these slices | PD-REP-21; PD-REP-02B-20 |
| Patient 360 may later discover documents; must not own Report lifecycle | PD-REP-24 |
| Audit = platform audit_log, fail-closed | PD-REP-20; PD-REP-02B-18 |

---

## 9. Product decisions still unresolved

Do **not** treat the following as answered unless a future Product Decision Closure stamps them. Repository evidence does **not** establish these rules for LMS Reports.

### A. PDF / document generation

- When generation occurs (on Final, on Release, on demand, async job)  
- Eligibility of Draft / Final / Released  
- Deterministic rendering from ReportVersion snapshots  
- Template ownership and effective version  
- Signatory block / name on PDF vs Release actor  
- Dependency on business Report number before/after PDF  
- Retention and regeneration policy  
- Immutable artifact vs regenerable from same ReportVersion  
- Association model to CanonicalDocument (entity type keys for LmsReport vs LabReport)  
- Ownership of generation service (LaboratoryApi vs AuthService)  

### B. Report numbering

- Assignment timing (Final vs Release vs PDF)  
- Branch vs tenant sequence scope; reset/gaps/reuse  
- Format/prefix/width (explicitly configuration — values absent)  
- Interaction with Amendments / superseding reports  
- Display vs searchable identity  

### C. Download

- Staff-only vs patient-visible download surfaces  
- Eligibility status and permission model (`lms.reports.download` semantics)  
- Whether download requires prior PDF generation vs upload  
- Audit action and fail-closed expectations  
- Versioned artifact selection when multiple documents exist  

### D. Patient Portal / Patient 360 publication

- Portal vs 360 vs both; timing relative to Release/PDF  
- Withdrawal / retraction after publish  
- Patient identity and encounter linkage rules  
- Document ownership and classification  
- Whether `lms.reports.publish` should be seeded and what it means  
- Interaction with legacy LabReport Patient 360 documents (coexistence UI)  

### E. Notification / delivery

- Trigger event(s)  
- Channels (in-app / SMS / email / WhatsApp)  
- Consent and recipient selection  
- Intent vs delivery state machine; retries  
- Reuse of L-CRT `PlatformNotificationClient` pattern vs separate Report intent  
- NotificationHub ownership and staff vs patient recipients  

### F. Amendments

- Whether Released (and/or Final) can be amended  
- New ReportVersion on same Report vs new Report aggregate  
- Claim release / supersession rules  
- Numbering and PDF supersession  
- Patient-visible correction semantics  
- Required Result-domain amendment first  

### G. Unrelease / Revoke

- Whether permitted at all  
- Authority and dual-control  
- Audit and irreversible clinical trail  
- Effects on published documents, downloads, notifications  
- Distinction from Amendment  

---

## 10. Candidate slice boundaries

**DISCOVERY RECOMMENDATION ONLY — not approved.**

### Slice candidate P1 — Staff PDF / Document Artifact (generation + storage association)

| Field | Content |
| --- | --- |
| Rationale | Download, Patient 360 discovery, and many notification payloads depend on bytes; LMS currently has snapshots but no artifact |
| Prerequisites | Certified Released and/or Final ReportVersion (policy TBD); template/config decisions |
| Affected domains | LaboratoryApi Reports; likely AuthService CanonicalDocument/Blob; staff Reports UI |
| Reuse | CanonicalDocument + BlobStorage patterns; QuestPDF patterns **as reference only** (not Pathology LabReport SoT) |
| New capabilities | Generation service; LmsReport↔document association; audit; possibly config for templates |
| Unresolved PDs | §9.A (all) |
| Risks | Wrong SoT if LabReport attach is reused; template hard-coding; regenerating mutable “official” PDFs |
| Explicit out of scope | Patient publication; SMS/email; Amendments; Unrelease; Pathology migration; role grants |

### Slice candidate P2 — Business Report Numbering

| Field | Content |
| --- | --- |
| Rationale | Often required on official PDF; stamped as separate from GUID identity |
| Prerequisites | Configuration values for sequence/format/scope |
| Affected domains | LaboratoryApi sequences + Report attribute |
| Reuse | Existing LMS sequence concurrency patterns (order/accession/barcode) — **pattern only** |
| New capabilities | Report number sequence + assignment rules |
| Unresolved PDs | §9.B |
| Risks | Using Order/Accession as Report number; gap/reuse clinical confusion |
| Explicit out of scope | PDF layout; patient publish; changing Release metadata semantics |

### Slice candidate P3 — Staff Download

| Field | Content |
| --- | --- |
| Rationale | Catalogue permission already reserved; staff workbench needs artifact access |
| Prerequisites | Artifact from P1 (or alternate attach policy — unlikely for LMS) |
| Affected domains | LaboratoryApi download endpoint; FE ReportDetailView; audit |
| Reuse | Stream patterns from LabReport `report/content` **as reference**; wire `lms.reports.download` |
| New capabilities | Authorized LMS download API + UI + audit |
| Unresolved PDs | §9.C |
| Risks | Downloading without audit; leaking across branch/tenant |
| Explicit out of scope | Patient Portal download; publication; NotificationHub |

### Slice candidate P4 — Patient 360 staff document discovery (LMS)

| Field | Content |
| --- | --- |
| Rationale | PD-REP-24 allows Patient 360 to discover released documents without owning lifecycle; staff already have Pathology lab documents |
| Prerequisites | Artifact association (P1); publication-lite vs full patient visibility policy |
| Affected domains | Patient 360 Documents; LMS Report read models |
| Reuse | Patient360Documents patterns — extend carefully without merging Pathology SoT |
| New capabilities | LMS document discovery filter; permissions |
| Unresolved PDs | §9.D (staff 360 vs patient portal) |
| Risks | Mixing LabReport and LmsReport rows without clear labeling |
| Explicit out of scope | Patient Portal consumer publication; auto-notify |

### Slice candidate P5 — Patient Portal publication

| Field | Content |
| --- | --- |
| Rationale | Portal `/results` is mock; patient-visible path is a distinct privacy boundary |
| Prerequisites | Release + artifact + explicit publish decision; possibly numbering |
| Affected domains | Patient Portal; security; possibly CanonicalDocument visibility |
| Reuse | None for LMS today |
| New capabilities | Publish permission/API; visibility flags; withdrawal |
| Unresolved PDs | §9.D |
| Risks | Equating Release with publish (forbidden by stamped principles) |
| Explicit out of scope | Changing L-REP-02B Release semantics |

### Slice candidate P6 — Report notification / delivery

| Field | Content |
| --- | --- |
| Rationale | PD-REP-19 future architecture; L-CRT intent pattern is a reusable shape |
| Prerequisites | Trigger policy; often artifact + patient visibility decisions |
| Affected domains | LaboratoryApi intent; AuthService notification delivery; NotificationHub |
| Reuse | `PlatformNotificationClient` / critical intent honesty pattern; platform NotificationHub |
| New capabilities | Report notification intent + orchestration hooks |
| Unresolved PDs | §9.E |
| Risks | Delivery appearing successful when Release-only metadata exists; consent gaps |
| Explicit out of scope | Making NotificationHub the Report SoT |

### Slice candidate P7 — Report Amendments (post-Release correction)

| Field | Content |
| --- | --- |
| Rationale | Immutability + claim lifetime explicitly defer to Amendment policy |
| Prerequisites | Closed policy for new ReportVersion / supersession / claims / downstream artifacts |
| Affected domains | Reports; possibly Results; PDF/number/publish/notify |
| Reuse | Draft `AppendVersion` mechanics as **inspiration only** (today Draft-only) |
| New capabilities | Amend workflow, audit, UI (`results/amendments` stub) |
| Unresolved PDs | §9.F |
| Risks | In-place edit; silent claim drop enabling duplicate Drafts |
| Explicit out of scope | Unrelease-as-edit; ResultStatus abuse |

### Slice candidate P8 — Unrelease / Revoke

| Field | Content |
| --- | --- |
| Rationale | Forward-only today; clinical need may arise but policy is absent |
| Prerequisites | Full reverse/withdraw policy across documents, portal, notifications |
| Affected domains | Reports + all downstream |
| Reuse | **Do not** productize `RevertReleaseAsync` without new policy |
| New capabilities | Revoke state/API/audit/UI |
| Unresolved PDs | §9.G |
| Risks | Compensating transaction mistaken for clinical revoke; patient still sees old PDF |
| Explicit out of scope | Bundling into PDF or numbering slices |

---

## 11. Recommended sequencing

**DISCOVERY RECOMMENDATION ONLY — not approved.**

Suggested technically coherent order (may be packaged differently after Product Decision Review):

1. **Product Decision Review** for the next bounded slice (mandatory gate)  
2. **P2 Numbering** and/or **P1 PDF** — decide coupling:  
   - If official PDF must show a business number → Numbering before or with PDF  
   - If PDF can show GUID/Order/Accession as reference fields only → PDF may proceed with explicit non-Report-number labeling  
3. **P3 Staff Download** — after an artifact exists  
4. **P4 Patient 360 staff discovery** — after artifact + association; still not patient Portal  
5. **P5 Patient Portal publication** — separate privacy gate  
6. **P6 Notification/delivery** — after trigger/visibility policy; may partially parallel P5 if staff-only notify  
7. **P7 Amendments** — after immutability/downstream artifact policy; unlocks claim supersession  
8. **P8 Unrelease/Revoke** — last or never; highest policy risk; do not combine with P1–P3  

**Do not assume A–G are seven mandatory separate projects.** Evidence suggests:

- Download is not coherent without an artifact strategy  
- Publication is not coherent if equated with Release  
- Amendments/Unrelease cross-cut numbering, PDF, publish, and notify  

---

## 12. Risks and architectural concerns

| Risk | Severity | Notes |
| --- | --- | --- |
| Scope creep into Pathology LabReport dual-write | High | Explicit RED in prior discoveries; preserved by L-REP-02B |
| Treating Released as patient-visible | High | Violates PD-REP-08 / PD-REP-02B-12 |
| Inventing Report number format/scope | High | PD-REP-13 CONFIGURATION_REQUIRED |
| Inventing PDF templates/branding | High | PD-REP-14 |
| Using Order/Accession as Report number | High | Forbidden by L-REP-02B |
| Productizing audit fail-closed Revert as Unrelease | High | Wrong semantic |
| Silent claim release without Amendment policy | Clinical integrity | Claims stamped to remain |
| Mixing LabReport and LmsReport in Patient 360 without labeling | Medium | Staff confusion / wrong download |
| Notification without delivery honesty | Medium | L-CRT pattern should inform design |
| QuestPDF in AuthService becoming accidental LMS SoT | Medium | AD-REP-06: PDF capability separate from clinical SoT |
| FE gap: AppendVersion API without client | Low (pre-Final) | Exists for Draft foundation; not post-Release amend |

---

## 13. Explicit non-findings

This discovery **did not find** in Enterprise LMS Reports:

- PDF/document generation pipeline  
- Business Report number field or sequence  
- Download endpoint or UI  
- Patient Portal or Patient 360 publication of LmsReport  
- Report Release notification intent  
- Post-Final / post-Released Amendment workflow  
- Staff Unrelease / Revoke API, permission, or UI  
- `lms.reports.publish` catalogue entry  
- LaboratoryApi QuestPDF (or other PDF) package references  

This discovery **did find** (outside LMS Report SoT):

- Pathology LabReport attach/download via CanonicalDocument  
- QuestPDF for Patient Summary and Imaging  
- LMS number sequences for non-report entities  
- Critical Result notification intent infrastructure  
- Platform NotificationHub  
- Draft-only ReportVersion append  
- Catalogue-only `lms.reports.download`  

---

## 14. Explicit out-of-scope items

Remain out of scope until separately authorized by Product Decision Closure + implementation task:

- PDF / document generation for LmsReport  
- CanonicalDocument association for LmsReport  
- Business Report numbering  
- Staff or patient download of LMS Reports  
- Patient Portal publication  
- Patient 360 LMS publication  
- NotificationHub / SMS / email / WhatsApp for Report Release  
- Amendments / corrected reports / supersession workflows  
- Unrelease / Revoke product workflows  
- Dual-control / signatory hierarchy configuration (beyond stamped metadata Release)  
- Production role grants for `lms.reports.*`  
- Pathology LabReport migration, bridge, dual-write, or replacement  
- Changes to L-TST / L-VER / L-AUTH / L-CRT / Orders / Collection / Specimen / Receiving / Barcode  
- Analytics / KPI dashboards for Reporting (PD-REP-30)  

---

## 15. Regression / certification boundaries

Discovery (and any future work) must preserve:

| Area | Boundary |
| --- | --- |
| L-REP-01 Draft foundation | Unchanged |
| L-REP-01 source uniqueness / claims | Unchanged; claims remain through Released |
| L-REP-02A Finalize | Remains `ACCEPTED_L_REP_02A` |
| L-REP-02B Release | Remains `ACCEPTED_L_REP_02B` — metadata only |
| ResultStatus / ResultVersion | Never mutated by Report operations |
| CriticalResultEvent | Unchanged by Report Release |
| L-TST / L-VER / L-AUTH / L-CRT | Unchanged |
| Orders / Collection / Specimen / Receiving / Barcode | Unchanged |
| Legacy Pathology | Unchanged; separate SoT |

This discovery task **did not modify** any of the above.

---

## 16. Recommended next Product Decision gate

```text
NEXT_GATE = PRODUCT_DECISION_REVIEW
```

**Recommended Product Owner focus (discovery recommendation only):**

1. Choose the **next bounded slice** among P1–P8 (or a justified packaging, e.g. Numbering+PDF).  
2. Close unresolved decisions in §9 for that slice only.  
3. Produce a **separate** Product Decision Closure (not this document).  
4. Only then authorize implementation audit + coding.  

Highest-leverage decision cluster for the immediate next gate:

- Artifact strategy (PDF generation vs other)  
- Numbering timing relative to artifact  
- Staff download eligibility  
- Explicit confirmation that patient publication and notification remain later  

Do **not** start implementation from this discovery document alone.

---

## Final stamps

```text
DISCOVERY_COMPLETE

NO_IMPLEMENTATION_STARTED

NO_PRODUCT_DECISION_CLOSURE_CREATED

L_REP_02B_REMAINS_ACCEPTED

NEXT_GATE = PRODUCT_DECISION_REVIEW
```

**STOP.**
