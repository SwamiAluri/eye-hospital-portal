# L-REP-03 CUT D — Official PDF Preview + Patient 360 Laboratory Integration  
# Product Discovery / Architecture Audit

**Date:** 2026-10-13  
**Slice (proposed, not authorized):** L-REP-03 CUT D — Official PDF Preview + Patient 360 Laboratory Integration  
**Mode:** DISCOVERY / AUDIT ONLY — documentation artifact only  

**This task does not implement CUT D.**  
No application source, schema, migrations, APIs, DTOs, services, UI, routes, permissions, role grants, audit allowlists, Blob, CanonicalDocument model, Report lifecycle, Report Number, Release, Official PDF generation, CUT C download behavior, Pathology, Patient Portal, NotificationHub, or Product Decision Closure changes are authorized or performed by this document.

---

## 1. Executive Summary

CUT D is **not yet implementation-authorized**. Repository evidence shows that:

1. **Staff Official PDF Preview on Report Detail does not exist today.** CUT C delivers authenticated **Download** of the current Official PDF only (`Content-Disposition: attachment`). No Preview control exists in `ReportDetailView.tsx`.
2. **Patient 360 Documents → Laboratory today is legacy Pathology only.** It loads AuthService `LabReports` via `labReportsApi.getByPatient` and projects `domain=lab` / `entityType=LabReport` canonical attachments. It does **not** discover Enterprise LMS Official PDFs.
3. **LMS Official PDF storage association already exists** (CUT B): AuthService `enterprise_lms` / `LmsReportOfficialPdfArtifact` with `EntityId = ArtifactId`, `CanonicalDocument.PatientId = LmsReport.PatientId`, private Blob in `patient-documents`. CUT C streams bytes via internal Auth association gate + LaboratoryApi JWT proxy.
4. **`CanonicalDocument.PatientId` alone is not enough** for Patient 360 Laboratory discovery. General patient document listing is restricted to `mpi` / `patient` associations. Laboratory listing is Pathology `LabReport`-driven. LMS must be **projected** into Patient 360 by a deliberate staff discovery path.
5. **Current-visible Official PDF must be derived from `LmsReport.CurrentOfficialArtifactId` (MODEL A), not CanonicalDocument supersession (MODEL B).** Regeneration retains prior artifacts and prior CanonicalDocuments/associations; the LMS current pointer is the SoT for “visible current.” Supersession is not applied on LMS registration.
6. **Authorization is a Product Decision gate.** Pathology Laboratory content uses `patient.view`. LMS download uses `lms.reports.download` + operating-branch authorization. Patient 360 must not become a bypass around LMS tenant/branch/permission/eligibility gates.
7. **Reuse is feasible** for Preview UX (`Patient360DocumentPreview` Dialog + blob object URL + PDF iframe) and for bytes (`downloadLmsOfficialPdf` / CUT C current-artifact resolution). A **new Patient 360 Laboratory projection** for LMS is required; do not reuse Pathology `lab`/`LabReport`.

**Next gate:** `PRODUCT_DECISION_REVIEW` — not implementation.

---

## 2. Discovery Scope

| In scope | Out of scope |
| --- | --- |
| Read-only audit of accepted L-REP-02B / CUT A / CUT B / CUT C baselines | Application / schema / migration / permission / route changes |
| Patient 360 Documents → Laboratory / All flows | Patient Portal / patient publication / NotificationHub |
| CanonicalDocument + association + content paths | Changing CUT C download semantics |
| LMS Official PDF artifact / regeneration / current pointer | Pathology dual-write or LabReport association reuse |
| Preview / Download / Print reuse candidates | New PDF viewer package / design system / storage architecture |
| Product Decision matrix (recommendations only) | Product Decision Closure or implementation authorization |

---

## 3. Authoritative Upstream Baseline

| Slice | Stamp | Document |
| --- | --- | --- |
| L-REP-02B Report Release | `ACCEPTED_L_REP_02B` | `enterprise-lms-report-release-acceptance-closure.md` |
| L-REP-03 CUT A Report Number | `ACCEPTED_L_REP_03_CUT_A` | `enterprise-lms-report-number-foundation-acceptance-closure.md` |
| L-REP-03 CUT B Official PDF foundation | `ACCEPTED_L_REP_03_CUT_B` | `enterprise-lms-report-official-pdf-acceptance-closure.md` |
| L-REP-03 CUT C Staff Download | `ACCEPTED_L_REP_03_CUT_C` | `enterprise-lms-report-staff-download-acceptance-closure.md` |

CUT C acceptance explicitly stamps:

```text
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C
CUT_C_IMPLEMENTATION_COMPLETE
MANUAL_UAT_PASSED
ACCEPTANCE_COMPLETE
ACCEPTED_L_REP_03_CUT_C
UAT_LIMITATIONS_ACKNOWLEDGED
UAT-06_NOT_EXECUTABLE_SAFELY
UAT-08_NOT_EXECUTABLE_SAFELY
NEXT_GATE = PRODUCT_DISCOVERY_REQUIRED
```

**This discovery does not reopen CUT C.** UAT-06 / UAT-08 limitations remain acknowledged, not defects. CUT C download behavior is unchanged by this document.

Patient 360 direction (staff longitudinal discovery surface, not operational SoT): `docs/decisions/patient-360-product-decision-contract.md`.

Pathology Patient 360 Laboratory attach/Preview/Download/Print baseline (separate from LMS; acceptance not claimed for Slice 4 Manual UAT):

- `docs/decisions/slice-4-laboratory-document-implementation.md` (`ACCEPTANCE: NOT CLAIMED`)
- `docs/decisions/slice-4-laboratory-uat-blocker-addendum.md`

Generic Patient 360 upload area map marks Laboratory **non-writable** (`patient-360-document-areas.ts`: `laboratory` → `writable: false`). LMS Official PDF discovery must not be implemented as generic MPI upload into Laboratory.

---

## 4. Current LMS Report Lifecycle

Proven from LaboratoryApi domain / services:

| Stage | Owner | Behavior (unchanged) |
| --- | --- | --- |
| Draft → Final | LaboratoryApi `LmsReport` | L-REP-02A Finalize |
| Final → Released | LaboratoryApi | L-REP-02B metadata Release (`ReleasedAtUtc` / `ReleasedByUserId`) — no PDF |
| Assign Business Report Number | LaboratoryApi | L-REP-03 CUT A — post-Release, immutable, operating-branch sequence |
| Generate Official PDF | LaboratoryApi | CUT B — explicit staff action; async job; not automatic on Release/Number |
| Download Official PDF | LaboratoryApi + Auth | CUT C — current Succeeded artifact only; JWT + `lms.reports.download` |

`LmsReport` key fields (`LaboratoryApi/Domain/LmsReport.cs`):

- `TenantId`, `OperatingBranchId`, `PatientId`, `OrderId`
- `Status`, `CurrentVersionNumber`
- `BusinessReportNumber` (+ assignment audit fields)
- `CurrentOfficialArtifactId` — **LaboratoryApi SoT for current Official PDF**

---

## 5. Current Official PDF Artifact Architecture

### 5.1 Entities (CUT B)

| Entity | Table / type | Role |
| --- | --- | --- |
| `LmsReportOfficialPdfArtifact` | `lms_report_official_pdf_artifacts` | Immutable artifact version; `ArtifactVersion`, `Status` Succeeded/Failed, `CanonicalDocumentId`, `ReportId`, `ReportVersionId`, `ContentHash` |
| `LmsReportOfficialPdfJob` | jobs | Pending → Running → Succeeded/Failed; one active Pending/Running per Report |
| Template / Signatory | tenant config | Governed; template locked after first successful use |

### 5.2 Registration (AuthService)

`POST api/internal/canonical-documents/register-lms-official-pdf`:

- Sets `CanonicalDocument.PatientId = req.PatientId` (LaboratoryApi passes `report.PatientId`)
- Classification `LmsOfficialPdf`
- Association: `domain = enterprise_lms`, `entityType = LmsReportOfficialPdfArtifact`, `entityId = ArtifactId`
- **Never** `lab` / `LabReport`
- Private Blob container `patient-documents` (no SAS)

### 5.3 Current pointer / failure

From `OfficialPdfService.ExecuteGenerationAsync` / `MarkJobFailedAsync`:

| Event | `CurrentOfficialArtifactId` | Prior artifacts |
| --- | --- | --- |
| First PDF succeeds | Set to new artifact | N/A |
| Second PDF succeeds | Moves to new artifact | Prior Succeeded artifacts retained |
| Generation fails (ordinary) | Unchanged (prior current kept) | Job → Failed; ordinary failures typically **do not** insert a Failed artifact row |
| Success-audit unavailable after save | Reverts pointer to previous; marks new artifact Failed (`audit_unavailable`) | Prior current restored; this path can leave a Failed artifact row that is never current |
| Concurrent generation | Blocked by one active Pending/Running job (+ DB filtered unique index) | Existing active job returned |

**Answer to discovery question — how Patient 360 should determine current LMS Official PDF:**  
Derive visibility from **`LmsReport.CurrentOfficialArtifactId`** (and require Succeeded + `CanonicalDocumentId`). Do **not** invent a second SoT. Do **not** rely on CanonicalDocument supersession (not used by LMS registration).

---

## 6. CUT C Accepted Download Architecture

| Element | Evidence |
| --- | --- |
| Route | `GET /api/lms/reports/{reportId}/official-pdf?operatingBranchId=` |
| Function | `OfficialPdfFunctions.LmsReportOfficialPdfDownload` |
| Authz | JWT + `lms.reports.download` + operating branch match |
| Resolution | Report → Released + Business Report Number → `CurrentOfficialArtifactId` → Succeeded + `CanonicalDocumentId` |
| Bytes | Auth internal `POST …/lms-official-pdf/content` (association-gated) |
| Disposition | `attachment; filename="{BusinessReportNumber}.pdf"` |
| Client IDs | Staff supplies **reportId + operatingBranchId only** — not ArtifactId / CanonicalDocumentId |
| FE | `downloadLmsOfficialPdf` (`responseType: 'blob'`) + Report Detail / Worklist Download |
| Audit | Fail-closed `DOWNLOAD_OFFICIAL_PDF` before bytes |

CUT C acceptance excludes Patient 360 / Patient Portal publication.

---

## 7. Patient 360 Documents Architecture

### 7.1 Staff surface

- Route gated on `patient.view` (Patient 360 slice tests).
- Documents tab: `Patient360Documents.tsx` / `Patient360DocumentsView`.
- Source filter includes `laboratory` among CCMS, Insurance, General, Counselling, Imaging, Chart notes, etc.

### 7.2 Laboratory source today

| Layer | Implementation |
| --- | --- |
| FE load | `loadPatient360Clinical` → `labReportsApi.getByPatient(patientId)` |
| BE | AuthService `LabReportsController.GetByPatient` — `[RequirePermission("patient.view")]` |
| Canonical populate | `LabReportCanonicalDocumentService.PopulateCanonicalAsync` — `lab` / `LabReport` / active docs only |
| Content | `GET /lab-reports/{id}/report/content` — `patient.view` + association-gated Blob open |
| FE actions | Preview / Download / Print via `Patient360DocumentPreview` + `downloadLabReportContent` |

### 7.3 General documents (contrast)

`PatientCanonicalDocumentsController` lists/opens only documents with association:

- `domain = mpi`
- `entityType = patient`
- `entityId = patientId`

LMS Official PDFs are **not** listed here even when `CanonicalDocument.PatientId` matches.

### 7.4 Patient 360 All deduplication

`shouldSkipDuplicateCanonicalOnAll` / `patient360CanonicalIdentityKey` dedupe by **CanonicalDocumentId** across sources on the All filter. Laboratory rows use `canonical-${canonicalDocumentId}` when present. Dedup is **off** on the Laboratory filter itself.

All-tab merge order (first writer wins for a shared CanonicalDocumentId): General → Counselling → CCMS → Chart notes → **Pathology labs** → Imaging. If LMS is inserted into this merge, its position relative to Pathology must be chosen so shared-hash collapse cannot hide the wrong clinical source — prefer current-only LMS rows with distinct identity keys when CanonicalDocumentIds differ.

**Implication for LMS:** If LMS and Pathology somehow shared the same `CanonicalDocumentId` (identical content-hash reuse under same tenant+patient), All-tab could collapse them. Regeneration with **different** PDF bytes creates distinct CanonicalDocuments — All would show one Pathology row + one LMS current row if both projected. Historical LMS artifacts must not be projected, or All would multiply.

**Route evidence (staff):** `/dashboard/patients/[id]?section=documents` → `Patient360DocumentsPanel` / `Patient360DocumentsView`, gated by `patient.view`.

---

## 8. Existing Laboratory Document Architecture

| Concern | Pathology LabReport (current Patient 360) | Enterprise LMS Official PDF (CUT B/C) |
| --- | --- | --- |
| Clinical/ops SoT | AuthService `LabReport` | LaboratoryApi `LmsReport` + artifact |
| Association | `lab` / `LabReport` / EntityId = LabReportId | `enterprise_lms` / `LmsReportOfficialPdfArtifact` / EntityId = ArtifactId |
| Patient 360 feed | Yes | **No** |
| Preview/Download/Print | Yes (patient.view) | Download only via LMS Report UI (`lms.reports.download`) |
| Attach UX | “Attach Report” when no canonical | N/A (generated Official PDF) |
| Ownership confusion if reused | Would dual-own LMS under Pathology | Forbidden by accepted PD-PDF / CUT B/C |

---

## 9. CanonicalDocument Architecture

| Field / concept | Behavior |
| --- | --- |
| `PatientId` | Required; set from owning domain at register |
| `TenantId` | Required; gated on all opens |
| `ContentHash` | SHA-256; `ResolveOrCreateAsync` reuses active doc for same tenant+patient+hash |
| `Status` | `active` / `superseded` |
| `SupersededByDocumentId` | Used by **general** upload replace path — **not** by LMS Official PDF registration |
| Associations | Multi-domain links; LMS uses artifact-scoped association |
| Storage | Private Azure Blob `patient-documents`; authenticated open only |
| Permissions (general docs) | `patient.patient_document.*` |
| LMS content open (internal) | Internal API key + tenant + association; Active **or** Superseded allowed for open |

**Prove:** PatientId equality is necessary for correct patient binding but **insufficient** for Patient 360 Laboratory discovery. Listing paths are association-scoped (`mpi/patient` or Pathology `lab/LabReport`). LMS needs an explicit projection that starts from LaboratoryApi current pointer (or an Auth query that still validates LMS currentness via LaboratoryApi — preferred ownership remains LaboratoryApi).

---

## 10. Existing Patient 360 Preview / Download / Print UX

| Aspect | Implementation |
| --- | --- |
| Component | `Patient360DocumentPreview.tsx` |
| Pattern | Button “Preview” → Radix `Dialog` (`size="4xl"`) → authenticated `loadContent(): Promise<Blob>` → `URL.createObjectURL` |
| PDF | `<iframe src={objectUrl}>` height `min(60vh,36rem)` |
| Image | Zoom/pan viewport |
| Loading / error | “Loading preview…” / “Preview is not available…” |
| Download | Footer primary + row-level Download (source-specific loader) |
| Print | `runPatient360DocumentPrint` → `printPatient360DocumentFromLoader` (blob loader) |
| Design system | Existing shadcn Dialog/Button; `patient360LinkClass` |

**Report Detail today:** Official PDF panel shows Generate + Download only. Copy states staff download when eligible; “Not patient publication.” **No Preview.**

Target UX (proposed, not approved): add **Preview** beside **Download** using the same blob fetch as Download, rendered with the existing Dialog/iframe pattern — not a new viewer package.

---

## 11. LMS-to-Patient Document Integration Gap

| Gap | Evidence |
| --- | --- |
| No FE LMS source in Patient 360 | No `enterprise_lms` / `lms/reports` usage under `src/lib/patients` or Patient360 Documents |
| No BE patient projection of current LMS Official PDF | Pathology `GetByPatient` only; no LMS patient document list API found |
| Association exists but is artifact-scoped | Historical artifacts each have associations — listing all by patient would leak history |
| Permission model mismatch | `patient.view` vs `lms.reports.download` + branch |
| CUT C excluded Patient 360 | Acceptance / decision closure |

---

## 12. Association Model Audit

| Question | Answer |
| --- | --- |
| Does `enterprise_lms` exist? | **Yes** (`CanonicalDocumentAssociations.EnterpriseLmsDomain`) |
| Does `LmsReportOfficialPdfArtifact` entity type exist? | **Yes** |
| EntityId | **ArtifactId** (not ReportId / ReportVersionId) |
| Pathology reuse? | **No** — explicitly separated in register + tests |
| New association type required? | **No new type** — reuse existing LMS association. Projection must still filter to **current** artifact only |
| Safest lineage keys | **Visibility:** `CurrentOfficialArtifactId` → Artifact. **Storage association:** ArtifactId. **Staff resource id for content proxy:** ReportId (CUT C pattern). ReportVersionId is snapshot lineage, not Patient 360 current key |

---

## 13. PatientId / Tenant / Branch Audit

| Dimension | LMS Official PDF | Patient 360 Pathology Lab |
| --- | --- | --- |
| PatientId | `LmsReport.PatientId` → CanonicalDocument.PatientId | `LabReport.PatientId` |
| Tenant | Report + Artifact + CanonicalDocument + Auth open | LabReport + CanonicalDocument |
| Operating branch | Required on generate/download JWT context | Not LMS branch model |
| Risk if Patient 360 uses PatientId-only content open | **IDOR / branch bypass** if LMS gates skipped | Existing Pathology path already patient+tenant gated under `patient.view` |

**PD required:** Whether Patient 360 LMS content must enforce `operatingBranchId` the same way as CUT C, and how branch context is obtained in Patient Directory / Patient 360 (no LMS branch selector exists there today).

---

## 14. Current Artifact / Regeneration Audit

Desired UX validated against code:

| Scenario | Code behavior | Desired Patient 360 behavior |
| --- | --- | --- |
| Initial success V1 | `CurrentOfficialArtifactId = V1` | Show V1 only |
| Regen success V2 | Pointer → V2; V1 row retained | Show V2 only |
| Regen fail | Pointer unchanged | Keep showing V1 |
| Failed artifact | Never set as current | Never visible as current |

**MODEL A (recommended):** Patient 360 projects only the artifact referenced by `CurrentOfficialArtifactId` via LaboratoryApi (or Lab-orchestrated projection).  
**MODEL B (not safe as primary):** CanonicalDocument supersession — LMS registration does **not** supersede prior docs; prior associations remain; hash reuse can keep prior docs Active. Relying on supersession would either show history or require new write-side semantics (out of discovery authorization).

---

## 15. Historical Artifact Visibility Audit

| Surface | Historical artifacts |
| --- | --- |
| CUT C download | Forbidden (no artifactId client parameter) |
| Patient 360 (proposed) | Must not expose historical as selectable current documents |
| Internal retention | Artifacts + CanonicalDocuments + associations retained |
| Blob overwrite/delete | **Not** performed on regeneration |

If Patient 360 listed all `enterprise_lms` associations for a patient, regeneration would create **multiple Laboratory rows** — unsafe. Current-pointer projection is mandatory.

---

## 16. Permission / Authorization Audit

| Surface | Permission today |
| --- | --- |
| Patient 360 route / Pathology lab list+content | `patient.view` |
| Pathology attach | `patient.update` |
| General patient documents | `patient.patient_document.read/download/...` |
| LMS Report view | `lms.reports.view` (and related) |
| LMS Official PDF download | `lms.reports.download` |
| LMS Official PDF generate | `lms.reports.generate` |

**Conflict (PRODUCT_DECISION_REQUIRED):**

- Reusing only `patient.view` for LMS Official PDF in Patient 360 would **bypass** CUT C’s `lms.reports.download` and branch gate for users who can open Patient 360 but lack LMS download.
- Requiring `lms.reports.download` (+ branch) preserves LMS governance but may hide documents from staff who see Pathology labs today.

Discovery recommendation: **Do not bypass LMS authorization** (PD-D-13). Prefer reusing **`lms.reports.download`** for LMS Preview/Download/Print content bytes; list eligibility may additionally require `lms.reports.view` — **PO confirmation required**. Do **not** invent a new permission unless PO rejects reuse.

---

## 17. Security / IDOR Audit

| Reject / constrain | Rationale |
| --- | --- |
| Arbitrary CanonicalDocumentId from Patient 360 UI | Must resolve through LMS current artifact + association |
| Arbitrary ArtifactId / ReportVersionId | Historical IDOR; CUT C already forbids |
| Direct Blob / SAS / public URL | Forbidden by accepted LMS decisions; no evidence of approved public pattern |
| PatientId match alone | Insufficient without tenant + LMS report eligibility + current pointer + staff LMS authz |
| Cross-tenant | Must fail closed (existing Auth/Lab patterns) |
| Cross-branch | CUT C returns 403; Patient 360 must not weaken this |

Preview and Download should share the **same** authoritative current-artifact resolution as CUT C (report-scoped proxy recommended for Report Detail; Patient 360 needs an equivalent Lab-owned resolution — **new capability** for list/projection, reuse content open).

---

## 18. Legacy Pathology Boundary

| Item | Status |
| --- | --- |
| `LabReportCanonicalDocumentService` | Pathology only (`lab`/`LabReport`) |
| `LabReportsController` | Pathology only |
| Patient 360 Laboratory today | Pathology only |
| LMS association | Distinct `enterprise_lms` |
| Dual-write / migration | Forbidden |

**Reusing `lab`/`LabReport` for LMS would cause:** ownership confusion, incorrect clinical SoT, Pathology mutation risk, wrong permissions (`patient.view` vs LMS), wrong lifecycle, incorrect discovery lineage.

**Stamp for future work:** `LEGACY PATHOLOGY = UNCHANGED`.

---

## 19. Patient Portal / Patient Publication Boundary

| Boundary | Evidence |
| --- | --- |
| CUT B / CUT C | Patient Portal / Patient 360 publication explicitly out of scope |
| Patient Portal code search | No LMS Official PDF / `enterprise_lms` integration found under patient-portal paths |
| Patient 360 contract | Staff Patient Directory / Patient 360 longitudinal **staff** context surface |

Proposed CUT D investigates **staff Patient 360 discovery only**.  
No email / SMS / WhatsApp / NotificationHub / public URL expansion.

If Product later reclassifies Patient 360 as patient-facing publication, **STOP** for a separate Product Decision — repository evidence today treats Patient 360 as staff portal under `patient.view`, distinct from Patient Portal self-service.

---

## 20. Frontend Reuse Candidates

| Path | Name | Does | Reuse | Adaptation | Security | Consumer impact |
| --- | --- | --- | --- | --- | --- | --- |
| `…/Patient360DocumentPreview.tsx` | `Patient360DocumentPreview` | Dialog + blob preview + Print/Download footer | **REUSE** | Wire LMS `loadContent` | Depends on loader authz | Shared; keep props-driven |
| `…/patient-360-document-print.ts` | print helpers | Blob print | **REUSE** | Same | Same | Low |
| `…/Patient360Documents.tsx` | Documents Laboratory rows | Pathology lab actions | **ADAPT** | Add LMS rows **without** changing Pathology path | Dedup + permissions | Must not break Pathology tests |
| `…/patient-360-clinical.ts` | `loadPatient360Clinical` | Loads Pathology labs | **DO NOT REUSE as LMS SoT** | Separate LMS loader | — | Keep Pathology intact |
| `…/lms-reports.api.ts` | `downloadLmsOfficialPdf` | CUT C blob download | **REUSE** for Preview/Download bytes | Preview uses same blob + object URL | Keeps LMS gates | Report Detail + possibly P360 |
| `…/ReportDetailView.tsx` | Official PDF panel | Generate + Download | **ADAPT** | Add Preview control | Eligibility = download eligibility | LMS Report Detail only |
| New PDF viewer package | — | — | **DO NOT REUSE / DO NOT ADD** | — | — | Forbidden unless approved |

---

## 21. Backend Reuse Candidates

| Candidate | Classification | Why |
| --- | --- | --- |
| CUT C `DownloadAsync` / official-pdf GET | **REUSE** for Report Detail Preview bytes | Same current-artifact resolution + audit model (Preview may need disposition/audit Product Decision — see PD matrix) |
| Auth `lms-official-pdf/content` | **REUSE** | Association-gated private stream |
| Auth `register-lms-official-pdf` | **REUSE** (no change) | Already correct association |
| `LabReportCanonicalDocumentService` | **DO NOT REUSE** | Pathology ownership |
| `PatientCanonicalDocumentsController` content/list | **DO NOT REUSE** for LMS Laboratory | mpi/patient general docs only; would bypass LMS SoT |
| Pathology `LabReportsController` | **DO NOT REUSE** for LMS | Wrong entity |
| LaboratoryApi patient current-Official-PDF projection API | **NEW CAPABILITY REQUIRED** | No patient-scoped LMS document list exists |
| Auth patient query of all `enterprise_lms` associations | **DO NOT REUSE as sole projection** | Would expose historical artifacts |

---

## 22. Storage / Blob Reuse

| Rule | Status |
| --- | --- |
| Second stored PDF copy for Patient 360 | **NO** — project existing CanonicalDocument bytes |
| SAS / public / raw Blob URL | **NO** |
| Container | Existing `patient-documents` |
| Overwrite prior Blob on regen | **NO** — immutable artifact history |

---

## 23. Proposed CUT D Architecture

```text
LaboratoryApi (SoT)
  LmsReport.CurrentOfficialArtifactId
    → LmsReportOfficialPdfArtifact (Succeeded)
      → CanonicalDocumentId
        → Auth private Blob (enterprise_lms association)

Staff Report Detail Preview
  → same eligibility + resolution as CUT C Download
  → blob fetch → existing Dialog/iframe preview (no new viewer)

Staff Patient 360 Documents → Laboratory
  → NEW Lab-owned projection of CURRENT Official PDFs for patient
  → distinct row type from Pathology LabReport
  → Preview/Download/Print loaders call LMS-authorized content path
  → regeneration changes current pointer → projection shows newest only
```

**MODEL A** is the architecture recommendation.

---

## 24. Product Decision Matrix

| ID | Decision | Repository Evidence | Recommendation | Requires PO Confirmation? |
| --- | --- | --- | --- | --- |
| PD-D-01 | Should Report Detail expose Preview Official PDF? | No Preview today; Download + blob client exist; Patient360 preview pattern exists | **YES** | **YES** |
| PD-D-02 | Preview current successful Official PDF only? | CUT C current-pointer only; historical forbidden | **YES** | **YES** |
| PD-D-03 | Preview and Download same current-artifact resolution? | Single `DownloadAsync` path; no artifactId param | **YES** | **YES** |
| PD-D-04 | Patient 360 Documents → Laboratory include Enterprise LMS Official PDFs? | Gap: Pathology only today; CUT C excluded P360 | **YES** (staff discovery) | **YES** |
| PD-D-05 | LMS Official PDF separate from legacy LabReport docs? | Distinct association constants + tests | **YES** | **YES** (confirm boundary) |
| PD-D-06 | CanonicalDocument.PatientId = LmsReport.PatientId? | Register path already passes `report.PatientId` | **YES** (already implemented) | **YES** (confirm remains rule) |
| PD-D-07 | Patient 360 use LMS-specific CanonicalDocument association? | `enterprise_lms` / `LmsReportOfficialPdfArtifact` already exists | **YES — reuse existing** (not Pathology; not a new entityType) | **YES** |
| PD-D-08 | Patient 360 show only CurrentOfficialArtifactId? | Regeneration retains history; supersession unused | **YES** (MODEL A) | **YES** |
| PD-D-09 | Previous artifact versions retained internally? | Artifacts/docs/associations retained | **YES** | **YES** |
| PD-D-10 | Regen replaces visible P360 doc via current pointer move? | Pointer move already implemented | **YES** | **YES** |
| PD-D-11 | Regen physically overwrite/delete previous Blob? | No delete path in generation success | **NO** | **YES** |
| PD-D-12 | Historical artifacts visible from Patient 360? | Would duplicate Laboratory rows | **NO** | **YES** |
| PD-D-13 | Patient 360 Preview/Download/Print bypass LMS authorization? | CUT C uses `lms.reports.download` + branch | **NO** | **YES** |
| PD-D-14 | Patient Portal publication included? | Explicitly out of CUT B/C; no portal LMS code | **NO** | **YES** |
| PD-D-15 | External/public URLs introduced? | Forbidden pattern in accepted LMS slices | **NO** | **YES** |
| PD-D-16 | Reuse legacy Pathology LabReport association? | Would conflate SoT | **NO** | **YES** |
| PD-D-17 | Introduce a new permission? | Catalogue already has `lms.reports.download`; P360 Pathology uses `patient.view` | **Prefer NO** — reuse LMS download (and view for list) unless PO chooses a different staff model | **YES** (conflict) |
| PD-D-18 | Report Detail Preview staff-only? | LMS Report UI is staff JWT | **YES** | **YES** |
| PD-D-19 | Patient 360 Laboratory remains discovery surface, not clinical SoT? | Patient 360 contract + LMS SoT in LaboratoryApi | **YES** | **YES** |
| PD-D-20 | Create second stored PDF copy? | CanonicalDocument already stores bytes | **NO** | **YES** |

### Additional PRODUCT_DECISION_REQUIRED items (not in PD-D-* list but blocking)

| Topic | Why |
| --- | --- |
| Operating branch in Patient 360 | No LMS branch context on Patient Directory today; CUT C requires branch |
| Preview audit | CUT C audits every download fail-closed; does Preview require same `DOWNLOAD_OFFICIAL_PDF` or a distinct audit action? |
| Content-Disposition | Download is `attachment`; Preview should use blob/object URL (existing pattern) — confirm no inline public URL |
| Identical content-hash regen | Same CanonicalDocument may back multiple artifact associations — projection must key visibility by artifact/current pointer, not hash alone |

**No Product Decision Closure is created by this document.**

---

## 25. Risks

| Risk | Severity | Mitigation direction |
| --- | --- | --- |
| Patient 360 becomes LMS auth bypass | High | Enforce LMS permissions + branch + eligibility |
| Historical artifacts listed | High | MODEL A current pointer only |
| Pathology behavior regression | High | Separate projection; do not touch LabReport services |
| All-tab duplicate / collapse via shared CanonicalDocumentId | Medium | Identity key + current-only LMS rows; tests |
| Content-hash reuse surprises | Medium | Association EntityId = ArtifactId; visibility via CurrentOfficialArtifactId |
| Preview without audit | Medium | PO decide audit parity with Download |
| Scope creep into Patient Portal | High | Explicit out of scope |

---

## 26. Implementation Boundary Recommendation

Evidence supports a **multi-slice** packaging rather than one monolithic cut:

| Sub-slice | Scope | Depends on |
| --- | --- | --- |
| **D-A** | Report Detail Official PDF Preview (reuse CUT C blob + existing preview Dialog pattern) | PD-D-01…03, 18; Preview audit decision |
| **D-B** | Patient 360 Laboratory projection of **current** LMS Official PDF (list + Preview/Download/Print) | PD-D-04…10, 12–13, 17; branch decision; **new Lab projection API** |
| **D-C** | Current-artifact / regeneration projection correctness (tests + invariants; mostly B1 already) | PD-D-08…12 |
| **D-D** | Automated security / integration / UI tests | D-A / D-B |
| **D-E** | Manual UAT | D-A / D-B after implementation |

**Recommendation:** Authorize **D-A** only after Product Decision Closure for Preview; authorize **D-B** only after separate closure of Patient 360 authorization/branch decisions. Do not implement D-B under Pathology permissions alone.

Single combined “CUT D” label may remain for product naming, but engineering should not ship D-B without the authorization decisions closed.

---

## 27. Out of Scope

- Patient Portal / patient self-service download / publication  
- NotificationHub / email / SMS / WhatsApp  
- Public / SAS / raw Blob URLs  
- Historical artifact browser  
- Amendments / Unrelease / Revoke / retention enforcement  
- Pathology dual-write or association reuse  
- New PDF viewer framework / design system  
- Changing Release / Report Number / Official PDF generation / CUT C download contract  
- Production RolePermission seed grants  
- Product Decision Closure in this task  

---

## 28. Required Implementation Readiness Prerequisites

Before any CUT D coding:

1. Product Decision Review + Closure for PD-D-01…20 (and branch/audit extras).  
2. Explicit stamp that CUT C remains accepted and unchanged.  
3. Agreement on MODEL A current-pointer projection.  
4. Agreement that Pathology remains unchanged.  
5. Agreement on permission model (no silent role grants).  
6. Implementation readiness audit (separate task) after closure.  
7. UAT environment with Released+numbered+Succeeded Official PDF fixture (CUT C baseline).  

---

## 29. Automated Test Readiness

Existing relevant coverage (not re-run as acceptance for CUT D; discovery inspection only):

| Area | Suite / files | Notes |
| --- | --- | --- |
| Official PDF generate/download | `LaboratoryApi.Tests/OfficialPdfServiceTests.cs` | Current pointer, failure retention, download gates |
| Auth LMS register/content | `AuthService.Tests/InternalCanonicalDocumentControllerTests.cs` | enterprise_lms vs lab |
| Pathology lab canonical | `LabReportCanonicalDocumentTests.cs` | Must remain green / unchanged |
| FE LMS reports UI | `enterprise-lms-reports-ui.test.ts` | Download wiring; no Preview today |
| Patient 360 Documents | `Patient360Documents.test.tsx`, clinical/documents tests | Pathology Laboratory + All dedup |

**Gap:** No tests for LMS rows in Patient 360; no Report Detail Preview tests.  
**Do not claim CUT D tests passed** — not implemented.

---

## 30. Manual UAT Candidate Scenarios

Proposed only — **not executed**:

| ID | Scenario |
| --- | --- |
| UAT-D-01 | Open eligible Released numbered report |
| UAT-D-02 | Official PDF panel shows Preview |
| UAT-D-03 | Preview opens current official PDF |
| UAT-D-04 | Preview content matches Download content |
| UAT-D-05 | Preview does not mutate Report lifecycle |
| UAT-D-06 | Patient Directory → Patient 360 → Documents → Laboratory shows current LMS Official PDF |
| UAT-D-07 | Patient 360 Preview works |
| UAT-D-08 | Patient 360 Download works |
| UAT-D-09 | Patient 360 Print works |
| UAT-D-10 | Report Number shown correctly |
| UAT-D-11 | Regenerate successfully |
| UAT-D-12 | Patient 360 shows newest successful artifact |
| UAT-D-13 | Previous artifact not shown as second current document |
| UAT-D-14 | Failed regeneration leaves previous current visible |
| UAT-D-15 | Historical artifact cannot be selected directly |
| UAT-D-16 | Unauthorized user cannot Preview |
| UAT-D-17 | Unauthorized user cannot Download |
| UAT-D-18 | Cross-tenant patient cannot retrieve document |
| UAT-D-19 | Cross-branch LMS authorization preserved |
| UAT-D-20 | Legacy Pathology Laboratory documents unchanged |
| UAT-D-21 | Patient Portal unchanged |
| UAT-D-22 | No public/SAS Blob URL exposed |
| UAT-D-23 | Patient 360 All does not duplicate the same current LMS document |
| UAT-D-24 | Existing non-LMS Laboratory documents unchanged |

---

## 31. Acceptance Boundary

This discovery document:

- **Does** establish evidence for Product Decision Review  
- **Does not** accept CUT D  
- **Does not** authorize implementation  
- **Does not** close Product Decisions  
- **Does not** reopen or modify accepted CUT C / B / A / L-REP-02B  

Future acceptance of CUT D (or D-A/D-B) requires separate decision closure, implementation, tests, and Manual UAT.

---

## 32. Final Recommendation

1. Proceed to **PRODUCT_DECISION_REVIEW** with the PD-D matrix above.  
2. Prefer **MODEL A**: Patient 360 visibility from `LmsReport.CurrentOfficialArtifactId`.  
3. Prefer **reuse**: CUT C content resolution + `Patient360DocumentPreview` UX; existing `enterprise_lms` association.  
4. Prefer **split implementation** after closure: D-A (Report Detail Preview) then D-B (Patient 360 projection) with authorization decisions locked.  
5. Keep **LEGACY PATHOLOGY = UNCHANGED** and **Patient Portal = out of scope**.  
6. Do **not** start implementation until Product Decision Closure exists for CUT D (or for D-A alone if product packages Preview first).

---

## Files Inspected (primary evidence)

### Documentation
- `docs/laboratory-management/enterprise-lms-report-release-acceptance-closure.md`
- `docs/laboratory-management/enterprise-lms-report-number-foundation-acceptance-closure.md`
- `docs/laboratory-management/enterprise-lms-report-official-pdf-acceptance-closure.md`
- `docs/laboratory-management/enterprise-lms-report-official-pdf-decision-closure.md`
- `docs/laboratory-management/enterprise-lms-report-staff-download-acceptance-closure.md`
- `docs/laboratory-management/enterprise-lms-report-staff-download-decision-closure.md`
- `docs/laboratory-management/enterprise-lms-report-staff-download-implementation-report.md`
- `docs/laboratory-management/enterprise-lms-report-staff-download-readiness-audit.md`
- `docs/decisions/patient-360-product-decision-contract.md`
- `docs/decisions/slice-4-laboratory-document-implementation.md`
- `docs/decisions/slice-4-laboratory-uat-blocker-addendum.md`

Parallel discovery corroboration (no code changes by those agents): [Audit LMS Official PDF](2546de4f-82be-40ac-b75e-0bf4918071d1), [Audit Patient 360 Lab docs](07ad42bb-f7d3-4844-8e61-1bf6b3b9e89c), [Audit CanonicalDocument core](54f2194c-3db0-4ec9-80a7-d869a2b085c0).

### LMS / Auth / FE code
- `LaboratoryApi/Domain/LmsReport.cs`
- `LaboratoryApi/Domain/LmsReportOfficialPdf.cs`
- `LaboratoryApi/Services/OfficialPdfService.cs`
- `LaboratoryApi/Functions/OfficialPdfFunctions.cs`
- `LaboratoryApi/Services/PlatformCanonicalDocumentClient.cs`
- `AuthService/Models/Domain/CanonicalDocument.cs`
- `AuthService/Controllers/InternalCanonicalDocumentController.cs`
- `AuthService/Services/CanonicalDocumentIdentityService.cs`
- `AuthService/Services/CanonicalDocumentService.cs`
- `AuthService/Services/LabReportCanonicalDocumentService.cs`
- `AuthService/Controllers/LabReportsController.cs`
- `AuthService/Controllers/PatientCanonicalDocumentsController.cs`
- `apps/hospital-portal-web/src/components/lms/reports/ReportDetailView.tsx`
- `apps/hospital-portal-web/src/lib/lms/lms-reports.api.ts`
- `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.tsx`
- `apps/hospital-portal-web/src/components/patients/record/Patient360DocumentPreview.tsx`
- `apps/hospital-portal-web/src/lib/patients/patient-360-clinical.ts`
- `apps/hospital-portal-web/src/lib/patients/patient-360-document-identity.ts`
- `apps/hospital-portal-web/src/lib/api/lab-reports.api.ts`
- Related tests: `OfficialPdfServiceTests.cs`, `InternalCanonicalDocumentControllerTests.cs`, `Patient360Documents.test.tsx`, `enterprise-lms-reports-ui.test.ts`

---

## Final Status Stamps

```text
DISCOVERY_COMPLETE
NO_IMPLEMENTATION_STARTED
ACCEPTED_L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_C_REMAINS_ACCEPTED
CUT_D_IMPLEMENTATION_NOT_STARTED
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
PRODUCT_DECISION_REVIEW_REQUIRED
NEXT_GATE = PRODUCT_DECISION_REVIEW
```

**Not stamped (intentionally):**

- `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED`
- `CUT_D_IMPLEMENTATION_COMPLETE`
- `MANUAL_UAT_PASSED`
- `ACCEPTED_L_REP_03_CUT_D`
