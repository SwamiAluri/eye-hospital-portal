# L-REP-03 CUT D — Implementation Readiness Audit

**Date:** 2026-10-13  
**Slice:** L-REP-03 CUT D — Report Detail Preview + Patient 360 Current LMS Official PDF  
**Mode:** AUDIT ONLY — documentation artifact only  

**This task does not implement CUT D.**  
No application source, schema, migrations, APIs, DTOs, services, UI, routes, permissions, role grants, Blob, CanonicalDocument, Pathology, Patient Portal, CUT C download, Report lifecycle, or test code were modified by this audit.

---

## 1. Executive Summary

| Field | Result |
| --- | --- |
| Product Decisions | `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED` — verified closed; not reopened |
| Architecture | Sound — MODEL A current pointer, LMS association, Auth private stream, Patient 360 preview UX all exist |
| **D-A (Report Detail Preview)** | **READY** — reuse CUT C download blob path + existing preview Dialog pattern; FE wiring only |
| **D-B (Patient 360 LMS Laboratory)** | **READY_WITH_PREREQUISITES** — needs **new** LaboratoryApi patient current-Official-PDF projection with **PD-D-BRANCH Option B** authz; FE Laboratory merge adaptation |
| **Overall** | **READY_WITH_PREREQUISITES** |
| RED blockers | **None** |
| CUT C | Frozen / unchanged |
| Implementation | **NOT STARTED** |
| **NEXT_GATE** | **`D_A_IMPLEMENTATION`** |

YELLOW items are **D-B-scoped implementation prerequisites** (new Lab-owned projection + Option B branch verification path). They do **not** block D-A. No separate Product Decision reopen is required.

---

## 2. Authoritative Product Decision Closure

| Document | Stamp / role |
| --- | --- |
| [enterprise-lms-report-preview-patient360-product-decision-closure.md](./enterprise-lms-report-preview-patient360-product-decision-closure.md) | `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED` |
| [enterprise-lms-report-preview-patient360-product-decision-package.md](./enterprise-lms-report-preview-patient360-product-decision-package.md) | Detailed recommendations (retained; not rewritten) |
| [enterprise-lms-report-preview-patient360-discovery-audit.md](./enterprise-lms-report-preview-patient360-discovery-audit.md) | Discovery evidence |

Approved decisions include PD-D-01…20 and:

```text
PD-D-BRANCH = OPTION_B_APPROVED
PD-D-PREVIEW-AUDIT = APPROVED
PD-D-CONTENT-DISPOSITION = APPROVED
PD-D-HASH-REUSE = APPROVED
```

This audit does **not** reinterpret Product Decisions.

---

## 3. Accepted Upstream Baselines

| Slice | Stamp | Audit action |
| --- | --- | --- |
| L-REP-02B | `ACCEPTED_L_REP_02B` | Frozen |
| CUT A | `ACCEPTED_L_REP_03_CUT_A` | Frozen |
| CUT B | `ACCEPTED_L_REP_03_CUT_B` | Frozen |
| CUT C | `ACCEPTED_L_REP_03_CUT_C` | Frozen — download behavior not modified |

---

## 4. Audit Scope

| In scope | Out of scope |
| --- | --- |
| Repository inspection of LMS Report Detail, Official PDF, Auth CanonicalDocument, Patient 360 Documents Laboratory | Implementation of D-A / D-B |
| PD-D compliance vs actual code | Changing CUT C |
| Branch Option B readiness | Role grants / migrations / UAT execution |
| Future test / UAT matrices | Patient Portal changes |

---

## 5. Repository Evidence

### 5.1 Report Detail

| Item | Evidence |
| --- | --- |
| Route | `apps/hospital-portal-web/src/app/dashboard/lms/reports/[id]/page.tsx` |
| Component | `ReportDetailView.tsx` |
| Branch context | Query `operatingBranchId` **required**; missing → alert, no detail load |
| Permissions | Page: `lms.view`; Download: `lms.reports.download`; Generate: `lms.reports.generate` |
| Detail load | `getLmsReport(reportId, operatingBranchId)` |
| Official PDF panel | Generate + Download; **no Preview** control |
| Download eligibility (FE) | Released + BusinessReportNumber + `currentOfficialArtifactId` + artifact `status === 'Succeeded'` |
| Download client | `downloadLmsOfficialPdf` → `GET …/official-pdf` `responseType: 'blob'` → object URL + `<a download>` |

**Implication:** Report Detail already has metadata needed for Preview eligibility and already fetches PDF bytes as Blob. Preview can reuse the same client call + Dialog/iframe pattern.

### 5.2 Official PDF

| Item | Evidence |
| --- | --- |
| Generate / job / download | `OfficialPdfFunctions.cs` — `LmsReportOfficialPdfGenerate`, `…JobGet`, `LmsReportOfficialPdfDownload` |
| Service | `OfficialPdfService.cs` |
| Download route | `GET lms/reports/{id}/official-pdf?operatingBranchId=` |
| Disposition | `Content-Disposition: attachment; filename="{BusinessReportNumber}.pdf"` |
| Content-Type | `application/pdf` (streamed) |

### 5.3 Current Artifact

| Item | Evidence |
| --- | --- |
| Pointer | `LmsReport.CurrentOfficialArtifactId` (`LmsReport.cs`) |
| Artifact | `LmsReportOfficialPdfArtifact` — `ArtifactVersion`, `Status` Succeeded/Failed, `CanonicalDocumentId`, `ReportId`, `ReportVersionId` |
| Success | Sets pointer to new artifact; increments version; retains prior |
| Ordinary failure | Job Failed; pointer unchanged; typically no Failed artifact row |
| Audit-fail after success | Reverts pointer; marks artifact Failed |
| Concurrent | One active Pending/Running job per report |

**Supports approved regeneration contract.** No contradiction found.

### 5.4 Branch Authorization

| Item | Evidence |
| --- | --- |
| Report field | `LmsReport.OperatingBranchId` |
| Platform check | `IPlatformReferenceClient.ValidateUserBranchAsync` → Auth `api/internal/lms/validate-user-branch` |
| CUT C Download pattern | (1) require client `operatingBranchId` → (2) `ValidateUserBranchAsync(tenant, user, clientBranch)` → (3) load report by tenant+id → (4) require `report.OperatingBranchId == clientBranch` → (5) eligibility → (6) audit → (7) content |
| Report list | Requires `operatingBranchId`; optional `patientId` filter **within that branch only** (`ReportService.ListAsync`) |

**PD-D-BRANCH Option B vs CUT C:**

| Aspect | CUT C today | Option B (approved) |
| --- | --- | --- |
| Authoritative branch | Enforced via equality to `report.OperatingBranchId` | Server resolves `report.OperatingBranchId` then validates user for **that** branch |
| Client branch | Required query param | Must **not** be sole authorization decision |
| Security | Wrong client branch → 403 if ≠ report branch | Same protection if Option B loads report first, then validates report’s branch |

**CUT C is not weakened by this audit.** D-A may **reuse** CUT C download (Report Detail already supplies correct branch context; server still enforces equality). D-B **must implement Option B ordering** for Patient 360 (no LMS branch selector today): load report(s) by patient+tenant → for each candidate validate user against `report.OperatingBranchId` → project only authorized current Official PDFs.

### 5.5 CanonicalDocument

| Item | Evidence |
| --- | --- |
| Entity | `AuthService/Models/Domain/CanonicalDocument.cs` |
| LMS register | `POST api/internal/canonical-documents/register-lms-official-pdf` |
| Association | `enterprise_lms` / `LmsReportOfficialPdfArtifact` / EntityId = ArtifactId |
| PatientId | Set from `LmsReport.PatientId` at registration |
| Supersession | Used by MPI general replace — **not** by LMS register path |
| Hash reuse | `ResolveOrCreateAsync` may reuse Active document; associations remain per ArtifactId |

**CUT D can reuse existing CanonicalDocument; no second copy.** Visibility must use current pointer (PD-D-HASH-REUSE).

### 5.6 Auth Content Stream

| Item | Evidence |
| --- | --- |
| Endpoint | `POST api/internal/canonical-documents/lms-official-pdf/content` |
| Auth | Internal API key + `X-Tenant-ID` match |
| Gate | Association + tenant; Active or Superseded streamable |
| Lab client | `PlatformCanonicalDocumentClient.OpenOfficialPdfContentAsync` |
| SAS / public | **Not used** |

Staff bytes today: JWT → LaboratoryApi Download → Auth internal stream → attachment response.

### 5.7 Patient 360 Laboratory

| Item | Evidence |
| --- | --- |
| Route | `/dashboard/patients/[id]?section=documents` — `patient.view` |
| Component | `Patient360Documents.tsx` — filter `laboratory` |
| Data | `loadPatient360Clinical` → `labReportsApi.getByPatient` |
| Backend | AuthService `LabReportsController.GetByPatient` — Pathology `LabReport` |
| Canonical | `LabReportCanonicalDocumentService` — `lab` / `LabReport` |
| Content | `GET /lab-reports/{id}/report/content` — `patient.view` |
| Actions | Preview / Download / Print via `Patient360DocumentPreview` when `canonicalDocumentId` present |
| Upload area | Laboratory `writable: false` |
| LMS | **No** Enterprise LMS Official PDF projection |

**Why Pathology-oriented:** Slice 4 attached Pathology LabReport files to CanonicalDocument with `lab`/`LabReport`; Documents Laboratory loads that AuthService list. LMS lives in LaboratoryApi with a different association and authz model.

**Smallest D-B boundary:** Add a **separate** LMS current-Official-PDF loader (LaboratoryApi-owned) into Documents Laboratory merge; do **not** extend `LabReportsController` / Pathology services.

### 5.8 Patient 360 All

| Item | Evidence |
| --- | --- |
| Dedupe | `shouldSkipDuplicateCanonicalOnAll` — by `canonicalDocumentId` when `filter === 'all'` |
| Merge order | General → Counselling → CCMS → notes → Pathology labs → Imaging |
| Laboratory filter | Dedup off |

**Risk:** Shared ContentHash → shared CanonicalDocumentId could collapse All-tab rows. LMS rows must use current-only projection and careful identity keys. Historical LMS associations must not be listed.

### 5.9 Preview Components

| Item | Evidence |
| --- | --- |
| Component | `Patient360DocumentPreview.tsx` |
| Pattern | Preview button → Dialog `size="4xl"` → `loadContent(): Promise<Blob>` → `URL.createObjectURL` → PDF `<iframe>` |
| Print | `runPatient360DocumentPrint` / `printPatient360DocumentFromLoader` |
| Loading / error | “Loading preview…” / unavailable copy |
| New viewer package | **Not required** |

Reusable for Report Detail Preview and Patient 360 LMS rows.

### 5.10 Permissions

| Code | Use today |
| --- | --- |
| `lms.reports.view` | Report view / list |
| `lms.reports.download` | CUT C Official PDF download |
| `lms.reports.generate` | CUT B generate |
| `patient.view` | Patient 360 + Pathology lab content |
| `patient.patient_document.*` | MPI general docs only |

**Readiness:** Existing catalogue is **sufficient** for approved PD-D-17 (prefer no new permission). Content bytes for LMS Official PDF must use `lms.reports.download` (not `patient.view`). List/projection may use `lms.reports.view` + download eligibility — exact FE gating is implementation detail under approved decisions. **No new permission required by this audit. No grants performed.**

### 5.11 Audit

| Item | Evidence |
| --- | --- |
| Action | `ReportAuditActions.DownloadOfficialPdf` = `DOWNLOAD_OFFICIAL_PDF` (`ReportEnums.cs`) |
| Allowlist | Auth `InternalAuditController` includes `DOWNLOAD_OFFICIAL_PDF` |
| Behavior | Fail-closed before content open in `DownloadAsync` |
| Payload | reportId, artifactId, artifactVersion, canonicalDocumentId, contentHash, operatingBranchId, businessReportNumber |

**PD-D-PREVIEW-AUDIT:** Preview can reuse same audit action by calling the same Download path (or shared service method). Distinct action **not** required unless later compliance says so.

### 5.12 Legacy Pathology

| Item | Evidence |
| --- | --- |
| Isolation | Distinct association constants; LMS register tests assert ≠ Pathology |
| Patient 360 path | Pathology-only today |
| LMS path | LaboratoryApi + Auth LMS internal APIs |

**CUT D can be isolated.** Do not touch Pathology controllers/services.

### 5.13 Patient Portal

| Item | Evidence |
| --- | --- |
| LMS Official PDF in patient-portal | **Not found** (prior discovery; reaffirmed by scope) |
| CUT D boundary | Staff-only |

**No Patient Portal change required.**

### 5.14 Testing Infrastructure

| Area | Location |
| --- | --- |
| Official PDF / download | `LaboratoryApi.Tests/OfficialPdfServiceTests.cs`, `OfficialPdfPostgresConcurrencyTests.cs` |
| Auth LMS register/content | `AuthService.Tests/InternalCanonicalDocumentControllerTests.cs` |
| Pathology lab canonical | `LabReportCanonicalDocumentTests.cs` |
| FE LMS reports UI | `enterprise-lms-reports-ui.test.ts` |
| Patient 360 Documents | `Patient360Documents.test.tsx`, `Patient360DocumentPreview.test.tsx`, clinical/documents tests |

**Gap:** No Preview Official PDF tests; no Patient 360 LMS Official PDF projection tests.

---

## 6. PD-D Decision Compliance Matrix

| ID | Approved requirement | Repository evidence | Status | Implementation implication |
| --- | --- | --- | --- | --- |
| PD-D-01 | Report Detail Preview | No Preview today; Download + blob client exist | **Compliant / implementable** | Wire Preview in Official PDF panel |
| PD-D-02 | Current successful only | `DownloadAsync` uses CurrentOfficialArtifactId + Succeeded | **Compliant** | Reuse Download resolution |
| PD-D-03 | Same content boundary as Download | Single download path + Auth stream | **Compliant** | Prefer call same endpoint/service |
| PD-D-04 | P360 Laboratory includes current LMS PDF | Pathology-only today | **Gap — build D-B** | New Lab projection + FE merge |
| PD-D-05 | Distinct from Pathology | Separate associations | **Compliant** | Do not reuse Pathology APIs |
| PD-D-06 | PatientId equality; not sole authz | Register uses report.PatientId | **Compliant** | Keep multi-gate authz |
| PD-D-07 | Reuse enterprise_lms association | Exists end-to-end | **Compliant** | No new association type |
| PD-D-08 | MODEL A current pointer | Pointer is SoT; supersession unused for LMS | **Compliant** | Project via CurrentOfficialArtifactId |
| PD-D-09 | Retain prior artifacts | Regeneration retains rows | **Compliant** | Do not delete history |
| PD-D-10 | Regen moves visible current | Pointer moves on success | **Compliant** | Projection re-reads pointer |
| PD-D-11 | No Blob overwrite/delete | No delete on success | **Compliant** | Preserve immutability |
| PD-D-12 | No historical P360 visibility | Listing all associations would leak | **Must enforce in D-B** | Current-only query |
| PD-D-13 | No LMS authz bypass | P360 Pathology uses `patient.view` | **Must enforce in D-B** | Use LMS permissions for LMS content |
| PD-D-14 | Patient Portal OUT | No portal LMS wiring | **Compliant** | Do not touch portal |
| PD-D-15 | No public/SAS | Private stream only | **Compliant** | Keep app-mediated bytes |
| PD-D-16 | No Pathology association reuse | Distinct constants | **Compliant** | Isolation preserved |
| PD-D-17 | Prefer existing LMS permissions | Catalogue has view/download | **Compliant** | No new permission for D-A/D-B |
| PD-D-18 | Preview staff-only | LMS Report UI staff JWT | **Compliant** | Keep behind LMS gates |
| PD-D-19 | P360 is projection | Contract + Lab SoT | **Compliant** | Lab owns query/authz |
| PD-D-20 | Single CanonicalDocument | Already registered at B1 | **Compliant** | No second copy |
| PD-D-BRANCH | **Option B** | CUT C uses client branch + equality; `ValidateUserBranchAsync` exists | **D-A reusable; D-B needs Option B path** | See §7 |
| PD-D-PREVIEW-AUDIT | Reuse DOWNLOAD_OFFICIAL_PDF | Fail-closed on Download | **Compliant** | Call Download path for Preview bytes |
| PD-D-CONTENT-DISPOSITION | Auth object-URL after authz | Attachment response; FE blob preview pattern exists | **Compliant** | Blob → object URL → iframe |
| PD-D-HASH-REUSE | Pointer not hash | Hash may reuse CanonicalDocument | **Compliant** | Never key visibility by hash |

---

## 7. Branch Authorization Readiness

```text
PD-D-BRANCH = OPTION_B_APPROVED
```

### Can the server today perform Option B steps?

| Step | Capability | Evidence |
| --- | --- | --- |
| 1. Resolve Report.OperatingBranchId | **YES** | Loaded with report from LaboratoryApi DB |
| 2. Authenticated user | **YES** | JWT claims in Functions |
| 3. Verify tenant | **YES** | Report query `TenantId == claims.TenantId` |
| 4. Verify LMS permission | **YES** | `LaboratoryAuthz` / `lms.reports.download` (content) / view (list) |
| 5. Verify user authorized for Report.OperatingBranchId | **YES** | `ValidateUserBranchAsync(tenant, user, report.OperatingBranchId)` — **callable**; not yet the Patient 360 list path |
| 6. Report eligibility | **YES** | Released + BusinessReportNumber (Download) |
| 7. Current Official PDF eligibility | **YES** | CurrentOfficialArtifactId + Succeeded + CanonicalDocumentId |

### CUT C vs Option B

- **CUT C Download:** Client supplies branch → validate user for that branch → require equality with report branch. Client branch is **not** sole decision (equality required). **Do not modify CUT C.**
- **D-A Preview:** Reusing CUT C Download from Report Detail (which already has branch query context) is **safe and readiness-ready**.
- **D-B Patient 360:** Must **not** require an LMS branch query selector as sole authz. Implementation must: load eligible reports for patient → Option B validate against each `report.OperatingBranchId` → project current Official PDF only. Existing `ListAsync(patientId)` still requires a single client branch and filters to that branch — **insufficient alone** for Option B Patient 360 discovery across the user’s authorized branches.

**YELLOW (D-B):** New LaboratoryApi patient current-Official-PDF projection API implementing Option B.

---

## 8. Preview Readiness

| Question | Answer |
| --- | --- |
| A. Reuse Report Detail data? | **YES** — eligibility fields already on detail DTO |
| B. Reuse Download authz boundary? | **YES** — same `DownloadAsync` / GET official-pdf |
| C. Same current successful artifact? | **YES** — CurrentOfficialArtifactId resolution |
| D. Authenticated content stream reusable? | **YES** — Lab → Auth internal stream |
| E. Frontend pattern? | **`Patient360DocumentPreview`** (or equivalent Dialog+blob+iframe using same props) |
| F. New backend endpoint required for D-A? | **NO** — reuse CUT C download |
| G. New permission required? | **NO** — `lms.reports.download` |

Attachment disposition does not block Preview: FE already converts response to Blob + object URL (PD-D-CONTENT-DISPOSITION).

---

## 9. Patient 360 Readiness

| Need | Status |
| --- | --- |
| Pathology Laboratory | Exists — leave unchanged |
| LMS current Official PDF list for patient | **MISSING** — new Lab-owned API required |
| Generic CanonicalDocument patient list for LMS | **NO** — MPI list is mpi/patient only |
| Content with LMS authz + Option B | **MISSING as P360 path** — reuse Download semantics with Option B resolution |
| FE Laboratory merge + discriminator | **Required adaptation** — do not redesign Documents |
| Dedup on All | Existing helper — must include LMS carefully |
| Source labels | Distinguish “Laboratory” Pathology vs LMS Official Report |

**Owner:** LaboratoryApi owns query + authorization; Auth owns bytes; Patient 360 FE projects results.

---

## 10. Regeneration / Currentness Readiness

| Scenario | Code behavior | P360 implication |
| --- | --- | --- |
| V1 current | Pointer = V1 | Show V1 |
| V2 success | Pointer → V2; V1 retained | Show V2 only |
| V2 fail | Pointer stays V1 | Show V1 |
| ContentHash collide | Same CanonicalDocument possible | Visibility still by pointer/artifact |

Patient 360 **must not** infer currentness from CanonicalDocument.Status, ContentHash, CreatedAt, or ArtifactVersion alone. **No code contradiction** with approved contract.

---

## 11. Security Readiness

| Control | Ready? |
| --- | --- |
| No arbitrary CanonicalDocumentId / ArtifactId / ReportVersionId from browser | **YES** if staff uses report-scoped Lab APIs |
| No PatientId-only authz | **YES** if LMS gates + Option B enforced on D-B |
| Tenant isolation | **YES** on Lab + Auth paths inspected |
| Eligibility + Succeeded + association | **YES** on Download path |
| LMS permission | **YES** catalogue + Download gate |
| Option B branch | **Reusable primitive**; **new D-B path required** |
| No historical P360 | **Must implement** in D-B query |
| No SAS/public | **YES** |
| No Pathology shortcut | **YES** if D-B isolated |
| Fail-closed audit | **YES** on Download; Preview via same path |

---

## 12. Future Automated Test Matrix

### D-A Preview

- Authorized user can preview current successful artifact  
- Unauthorized user denied (`lms.reports.download`)  
- Wrong tenant denied  
- Wrong operating branch denied (CUT C equality)  
- Non-Released denied  
- Missing current artifact denied  
- Failed current artifact denied  
- Old artifact cannot be previewed as current  
- Audit failure fails closed where applicable  
- Existing Download remains unaffected  

### D-B Patient 360

- Current LMS artifact appears for authorized user  
- Wrong tenant excluded  
- Unauthorized branch excluded (Option B)  
- Failed artifact excluded  
- Previous artifact not shown after regen  
- Regenerated successful artifact becomes visible  
- Failed regeneration leaves previous visible  
- Pathology documents unchanged  
- LMS and Pathology distinguishable  
- All Documents does not duplicate same CanonicalDocument  

### D-C Correctness

- V1 current → V1 visible  
- V2 successful/current → V2 visible  
- V2 failed → V1 visible  
- Prior artifact retained internally  
- ContentHash does not determine currentness  

---

## 13. Future Manual UAT Matrix

Do **not** execute now.

| ID | Scenario |
| --- | --- |
| UAT-01 | Open Released report with current successful Official PDF |
| UAT-02 | Preview current Official PDF from Report Detail |
| UAT-03 | Unauthorized branch access denied |
| UAT-04 | Patient 360 → Documents → Laboratory shows current LMS Official PDF |
| UAT-05 | Legacy Pathology documents unchanged |
| UAT-06 | Successful replacement artifact → Patient 360 shows only new current |
| UAT-07 | Failed regeneration → previous artifact remains visible |
| UAT-08 | Repeated preview/download + audit trail |
| UAT-09 | No public/SAS URL exposed |
| UAT-10 | All Documents does not duplicate LMS CanonicalDocument |

**Prerequisites for future UAT:** UAT staff with LMS view/download (and view for list); Released+numbered+Succeeded PDF fixture; operating branch membership; Patient Directory access.

---

## 14. GREEN Findings

| Finding | Evidence |
| --- | --- |
| CurrentOfficialArtifactId semantics match approved regeneration contract | `OfficialPdfService` + tests |
| LMS CanonicalDocument association exists and is reusable | Auth register + content |
| CUT C download provides authenticated PDF bytes reusable for Preview | `DownloadAsync` + FE blob client |
| Patient360DocumentPreview is suitable PDF preview UX | Dialog + iframe + blob URL |
| No new permission required for D-A | `lms.reports.download` |
| No new PDF viewer package required | Existing component |
| Pathology / Patient Portal isolation feasible | Separate paths |
| `ValidateUserBranchAsync` exists for Option B verification | `PlatformReferenceClient` |
| Tenant gating present on Lab + Auth LMS content | Report queries + Auth content |
| Product Decisions closed and consistent with architecture | Closure document |

---

## 15. YELLOW Findings

| # | Issue | Evidence | Affected decision | Exact prerequisite | Recommended resolution | Affects |
| --- | --- | --- | --- | --- | --- | --- |
| Y1 | No patient-scoped LMS current Official PDF projection API | `ListAsync` requires single client branch; no P360 LMS loader | PD-D-04, PD-D-08, PD-D-12, PD-D-19 | New LaboratoryApi endpoint/service projecting **current** Official PDFs for a patient | Design/build under D-B; Lab owns query+authz | **D-B** |
| Y2 | Patient 360 lacks Option B branch path | P360 has no LMS branch selector; CUT C requires client branch | PD-D-BRANCH Option B, PD-D-13 | For each report: resolve `OperatingBranchId`, `ValidateUserBranchAsync`, then project/content | Implement Option B in D-B APIs; do not use `patient.view` for LMS content | **D-B** |
| Y3 | Patient 360 Documents FE is Pathology-only for Laboratory | `Patient360Documents.tsx` + `labReportsApi` | PD-D-04, PD-D-05, UX | Separate LMS loader + source discriminator + All dedup | Adapt Documents Laboratory merge without redesign | **D-B** |
| Y4 | CUT C Download requires client `operatingBranchId` (not pure Option B ordering) | `OfficialPdfFunctions.Download` + `DownloadAsync` | PD-D-BRANCH | D-A: reuse CUT C unchanged (Report Detail has branch context). D-B content: Option B resolution (may wrap Download internals after loading report) | Do **not** modify CUT C contract; add D-B path | **D-B** (D-A OK) |
| Y5 | Preview audit via shared Download path may log as DOWNLOAD_OFFICIAL_PDF | Approved PD-D-PREVIEW-AUDIT | PD-D-PREVIEW-AUDIT | Accept reuse unless compliance later splits | Call Download / shared method for Preview bytes | **D-A** (accepted) |

No YELLOW item requires Product Decision reopen.

---

## 16. RED Findings

**None.**

No fundamental approved decision is unimplementable with the current architecture.

---

## 17. Implementation Boundary

```text
READINESS AUDIT (this document)
  ↓
D-A implementation (Report Detail Preview)
  ↓
D-A automated tests
  ↓
D-A manual UAT
  ↓
D-A acceptance
  ↓
D-B implementation (Patient 360 current LMS Laboratory)
  ↓
D-B automated tests
  ↓
D-B manual UAT
  ↓
D-B acceptance
```

Do **not** implement D-A and D-B as one uncontrolled change.

| Layer | D-A | D-B |
| --- | --- | --- |
| Backend | Prefer **no** new endpoint (reuse Download) | **NEW** Lab patient current-Official-PDF projection (+ content via Option B) |
| Frontend | Preview control on Official PDF panel | Laboratory merge + LMS row actions |
| Auth | Reuse internal content stream | Reuse |
| Pathology | Untouched | Untouched |
| Permissions | Existing download | Existing view/download — no grants in code |
| Schema | None | None expected |

---

## 18. D-A Readiness

| Aspect | Verdict |
| --- | --- |
| Metadata | READY |
| Authz / content | READY (reuse CUT C) |
| Preview UX | READY (`Patient360DocumentPreview` pattern) |
| Permission | READY (`lms.reports.download`) |
| Backend new API | **Not required** |
| Schema / migration | **Not required** |
| **D-A overall** | **READY** |

---

## 19. D-B Readiness

| Aspect | Verdict |
| --- | --- |
| Pathology isolation | READY (do not touch) |
| LMS association / storage | READY |
| Current pointer semantics | READY |
| Patient projection API | **MISSING** (Y1) |
| Option B branch path | **Primitive exists; path missing** (Y2) |
| FE Laboratory adaptation | **Required** (Y3) |
| New permission | **Not required** |
| Schema / migration | **Not required** (projection over existing tables) |
| **D-B overall** | **READY_WITH_PREREQUISITES** (Y1–Y3 are D-B implementation work) |

---

## 20. Final Readiness Decision

```text
OVERALL_READINESS = READY_WITH_PREREQUISITES
D_A_READINESS = READY
D_B_READINESS = READY_WITH_PREREQUISITES
RED_BLOCKERS = NONE
```

**Rationale:** Architecture and Product Decisions align. D-A can proceed immediately after this audit. D-B requires planned new LaboratoryApi projection with Option B authorization and FE adaptation — concrete prerequisites scoped to D-B implementation, not architectural blockers or Product Decision gaps.

---

## 21. Explicit Non-Implementation Statement

```text
NO IMPLEMENTATION WAS PERFORMED.
NO APPLICATION CODE WAS MODIFIED.
NO SCHEMA / MIGRATION / PERMISSION / ROLE GRANT / TEST CHANGES WERE MADE BY THIS AUDIT.
CUT C REMAINS UNCHANGED.
MANUAL UAT WAS NOT EXECUTED.
ACCEPTANCE WAS NOT CLAIMED.
```

The Decision Package and Decision Closure were **not** overwritten.

---

## 22. Final Status Stamps

```text
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED
IMPLEMENTATION_READINESS_AUDIT_COMPLETE
OVERALL_READINESS = READY_WITH_PREREQUISITES
D_A_READINESS = READY
D_B_READINESS = READY_WITH_PREREQUISITES
CUT_D_IMPLEMENTATION_NOT_STARTED
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B
ACCEPTED_L_REP_03_CUT_C
PD-D-BRANCH = OPTION_B_APPROVED
LEGACY_PATHOLOGY = UNCHANGED
PATIENT_PORTAL = OUT_OF_SCOPE
NEXT_GATE = D_A_IMPLEMENTATION
```

**Not stamped:**

- `CUT_D_IMPLEMENTATION_COMPLETE`
- `MANUAL_UAT_PASSED`
- `ACCEPTANCE_COMPLETE`
- `ACCEPTED_L_REP_03_CUT_D`
