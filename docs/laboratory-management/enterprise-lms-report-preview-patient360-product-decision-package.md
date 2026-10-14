# L-REP-03 CUT D — Official PDF Preview + Patient 360 Laboratory Integration  
## Product Decision Review / Decision Package

**Date:** 2026-10-13  
**Slice (proposed):** L-REP-03 CUT D — Official PDF Preview + Patient 360 Laboratory Integration  
**Mode:** PRODUCT DECISION REVIEW — documentation only  
**Status:** `PRODUCT_DECISION_REVIEW_COMPLETE` · `PRODUCT_OWNER_APPROVAL_REQUIRED`

This package does **not** create a Product Decision Closure.  
It does **not** stamp APPROVED / `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED`.  
It does **not** authorize implementation readiness or CUT D implementation.  
It does **not** modify application code, schema, APIs, UI, permissions, role grants, Blob, CanonicalDocument, Pathology, Patient Portal, CUT C download, or NotificationHub.

**RECOMMENDED** options below are discovery / engineering guidance only until Product Owner stamps choices in a **separate** Decision Closure.

```text
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B
ACCEPTED_L_REP_03_CUT_C  (frozen — not reopened)
  ↓
CUT D discovery (DISCOVERY_COMPLETE)
  ↓
THIS DOCUMENT — Product Decision Review (CUT D)
  ↓
NEXT_GATE = PRODUCT_OWNER_APPROVAL
  (Product Owner stamps PD-D-* / PD-D-BRANCH / PD-D-PREVIEW-AUDIT / …)
  ↓
Separate Decision Closure (future) → then Implementation Readiness (future)
```

---

## 1. Title

L-REP-03 CUT D — Official PDF Preview + Patient 360 Laboratory Integration  
Product Decision Review / Decision Package

---

## 2. Date

2026-10-13

---

## 3. Purpose

Obtain Product Owner decisions required to authorize a **future** bounded CUT D after:

- metadata Release (`ACCEPTED_L_REP_02B`)
- Business Report Number (`ACCEPTED_L_REP_03_CUT_A`)
- Official PDF Artifact Foundation (`ACCEPTED_L_REP_03_CUT_B`)
- Official PDF Staff Download (`ACCEPTED_L_REP_03_CUT_C`)
- CUT D discovery (`DISCOVERY_COMPLETE` — [enterprise-lms-report-preview-patient360-discovery-audit.md](./enterprise-lms-report-preview-patient360-discovery-audit.md))

Conceptual target (**subject to Product Owner approval**):

```text
Staff Report Detail
  → Preview current Official PDF (reuse existing preview UX + CUT C resolution)

Staff Patient Directory → Patient 360 → Documents → Laboratory
  → discover current LMS Official PDF (MODEL A / CurrentOfficialArtifactId)
  → Preview / Download / Print via LMS-authorized content path
  → Pathology LabReport rows remain separate and unchanged
```

This review resolves **implementation-facing Product Decisions** for Preview + staff Patient 360 LMS projection. It does **not** reopen certified Release, Report Number, Official PDF generation, or CUT C download semantics.

---

## 4. Product Discovery baseline

| Field | Value |
| --- | --- |
| Discovery document | [enterprise-lms-report-preview-patient360-discovery-audit.md](./enterprise-lms-report-preview-patient360-discovery-audit.md) |
| Discovery stamps | `DISCOVERY_COMPLETE` · `NO_IMPLEMENTATION_STARTED` · `PRODUCT_DECISION_REVIEW_REQUIRED` |
| Primary findings | Report Detail has Download only (no Preview); Patient 360 Laboratory is Pathology-only; LMS association `enterprise_lms` / `LmsReportOfficialPdfArtifact` already exists; visibility SoT = `CurrentOfficialArtifactId` (MODEL A); `patient.view` must not bypass LMS authz |

Discovery next gate was `PRODUCT_DECISION_REVIEW`. **This document completes that gate** and advances the formal next gate to **`PRODUCT_OWNER_APPROVAL`**.

---

## 5. Accepted upstream baselines

| Slice | Stamp | Document | This package |
| --- | --- | --- | --- |
| L-REP-02B Report Release | `ACCEPTED_L_REP_02B` | [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | **Remains accepted — not reopened** |
| L-REP-03 CUT A Report Number | `ACCEPTED_L_REP_03_CUT_A` | [enterprise-lms-report-number-foundation-acceptance-closure.md](./enterprise-lms-report-number-foundation-acceptance-closure.md) | **Remains accepted — not reopened** |
| L-REP-03 CUT B Official PDF | `ACCEPTED_L_REP_03_CUT_B` | [enterprise-lms-report-official-pdf-acceptance-closure.md](./enterprise-lms-report-official-pdf-acceptance-closure.md) | **Remains accepted — not reopened** |
| L-REP-03 CUT C Staff Download | `ACCEPTED_L_REP_03_CUT_C` | [enterprise-lms-report-staff-download-acceptance-closure.md](./enterprise-lms-report-staff-download-acceptance-closure.md) | **Remains accepted — not reopened** |

Also inspected for decision conventions / boundaries:

| Document | Role |
| --- | --- |
| [enterprise-lms-report-official-pdf-decision-closure.md](./enterprise-lms-report-official-pdf-decision-closure.md) | PD-PDF-*; Patient Portal / Patient 360 publication OUT of B1 |
| [enterprise-lms-report-staff-download-decision-closure.md](./enterprise-lms-report-staff-download-decision-closure.md) | PD-DL-*; current-only download; Patient 360 OUT of CUT C |
| [enterprise-lms-report-official-pdf-decision-package.md](./enterprise-lms-report-official-pdf-decision-package.md) | B1 package baseline |
| [enterprise-lms-report-staff-download-decision-package.md](./enterprise-lms-report-staff-download-decision-package.md) | CUT C package convention |
| [patient-360-product-decision-contract.md](../decisions/patient-360-product-decision-contract.md) | Staff Patient 360 longitudinal discovery surface |
| [slice-4-laboratory-document-implementation.md](../decisions/slice-4-laboratory-document-implementation.md) | Pathology P360 Laboratory attach/Preview/Download (acceptance not claimed) |
| [slice-4-laboratory-uat-blocker-addendum.md](../decisions/slice-4-laboratory-uat-blocker-addendum.md) | Pathology Documents vs Clinical UX notes |

### CUT C freeze (explicit)

| Rule | Status |
| --- | --- |
| CUT C download route / eligibility / attachment disposition | **Unchanged** |
| `lms.reports.download` + operating-branch gate | **Unchanged** |
| Fail-closed `DOWNLOAD_OFFICIAL_PDF` for Download | **Unchanged** |
| UAT-06 / UAT-08 limitations | **Acknowledged — not defects** |
| Historical artifact download | **Remains OUT** |

---

## 6. Architectural invariants

These are **non-negotiable** for any Product Owner-approved CUT D packaging. Recommendations below must not violate them.

| # | Invariant |
| --- | --- |
| A | LaboratoryApi remains the authoritative LMS SoT |
| B | `LmsReport.CurrentOfficialArtifactId` remains the authoritative pointer for the currently visible Official PDF |
| C | `LmsReportOfficialPdfArtifact` remains immutable artifact history |
| D | CanonicalDocument remains AuthService private byte/document identity/storage |
| E | Existing `enterprise_lms` / `LmsReportOfficialPdfArtifact` association remains valid |
| F | Patient 360 is a staff discovery/projection surface — **not** LMS clinical/operational SoT |
| G | Legacy Pathology `LabReport` remains completely separate |
| H | Do **not** reuse `lab`/`LabReport`, `LabReportsController`, `LabReportCanonicalDocumentService`, or Pathology permissions as LMS authz |
| I | No second stored PDF copy |
| J | No SAS / public Blob / direct Blob / public document URL |
| K | No Patient Portal publication |
| L | No historical Official PDF browser in Patient 360 |
| M | No amendments / unrelease / revoke / retention enforcement / NotificationHub / email / SMS / WhatsApp |
| N | No silent role grants |
| O | Preserve all accepted CUT C behavior |

### Source-of-truth chain (binding)

```text
LmsReport.CurrentOfficialArtifactId
        ↓
Succeeded LmsReportOfficialPdfArtifact
        ↓
CanonicalDocumentId
        ↓
AuthService CanonicalDocument (enterprise_lms / LmsReportOfficialPdfArtifact / EntityId = ArtifactId)
        ↓
private Azure Blob (patient-documents)
```

---

## 7. Product Decision matrix PD-D-01…20

**Convention for every decision**

| Field | Meaning |
| --- | --- |
| **RECOMMENDATION** | Engineering / discovery guidance — **not** approval |
| **PRODUCT OWNER DECISION** | Blank until stamped in a future Decision Closure |
| **Status** | `PENDING_PRODUCT_OWNER_APPROVAL` for all rows in this package |

No repository/project evidence of Product Owner approval for PD-D-* was found. **None are marked APPROVED.**

---

### PD-D-01 — Report Detail Preview

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-01** |
| Question | Should LMS Report Detail expose Preview for the current Official PDF? |
| Repository evidence | `ReportDetailView.tsx` has Generate + Download only; `downloadLmsOfficialPdf` blob client exists; `Patient360DocumentPreview` Dialog + PDF iframe pattern exists |
| **RECOMMENDATION** | **YES** — Preview near Download; reuse existing design-system preview pattern |
| Alternatives considered | (A) Download only (status quo) · (B) New PDF viewer package (rejected unless approved) · (C) Navigate to raw URL (rejected — security) |
| Architectural / security implications | Preview must not mutate lifecycle; must use authenticated content resolution; no new viewer framework |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-02 — Current successful Official PDF only (Preview)

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-02** |
| Question | Should Preview expose only the current successful Official PDF? |
| Repository evidence | CUT C resolves only `CurrentOfficialArtifactId` + Succeeded; no historical selector; PD-DL-03/15 current-only |
| **RECOMMENDATION** | **YES** — no historical artifact selector |
| Alternatives considered | (A) Current only · (B) Historical browser (OUT — conflicts with L / PD-D-12) |
| Architectural / security implications | Prevents IDOR via historical ArtifactId selection |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-03 — Same resolution as Download

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-03** |
| Question | Should Preview use exactly the same current-artifact resolution as Download? |
| Repository evidence | `OfficialPdfService.DownloadAsync` chain: Report → Released → BusinessReportNumber → CurrentOfficialArtifactId → Succeeded → CanonicalDocument → Auth stream; browser supplies reportId + operatingBranchId only |
| **RECOMMENDATION** | **YES** — identical authoritative resolution; no browser ArtifactId / CanonicalDocumentId |
| Alternatives considered | (A) Shared resolution · (B) Separate Preview resolution path (risk of divergence / weaker gates) |
| Architectural / security implications | Keeps Preview and Download semantically aligned with CUT C |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-04 — Patient 360 Laboratory includes LMS Official PDFs

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-04** |
| Question | Should Patient Directory → Patient 360 → Documents → Laboratory include Enterprise LMS Official PDFs? |
| Repository evidence | P360 Laboratory is Pathology-only today (`labReportsApi.getByPatient`); CUT C acceptance excluded Patient 360; discovery recommends staff discovery projection |
| **RECOMMENDATION** | **YES** — as **staff** Patient 360 discovery projection only — **not** Patient Portal publication |
| Alternatives considered | (A) Include staff P360 Laboratory · (B) Keep LMS Official PDFs LMS-module-only · (C) Put LMS under General MPI docs (rejected — wrong association model) |
| Architectural / security implications | Requires **new** Lab-owned patient projection of **current** artifacts; D-B must wait for authz/branch closure |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-05 — Distinct from Pathology LabReport

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-05** |
| Question | Should LMS Official PDFs remain distinct from legacy Pathology LabReport documents? |
| Repository evidence | Distinct associations (`enterprise_lms` vs `lab`/`LabReport`); accepted PD-PDF / CUT B/C forbid Pathology reuse |
| **RECOMMENDATION** | **YES** — do not merge ownership, lifecycle, associations, or SoT |
| Alternatives considered | (A) Separate · (B) Merge under LabReport (rejected) |
| Architectural / security implications | Prevents dual clinical sources and Pathology mutation risk |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-06 — CanonicalDocument.PatientId = LmsReport.PatientId

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-06** |
| Question | Should CanonicalDocument.PatientId equal LmsReport.PatientId? |
| Repository evidence | CUT B `register-lms-official-pdf` already passes `report.PatientId`; invariant for patient binding |
| **RECOMMENDATION** | **YES** — remain invariant (already implemented; do not weaken) |
| Alternatives considered | (A) Keep equality · (B) Different patient binding (would break patient scoping) |
| Architectural / security implications | Necessary but **not sufficient** for P360 discovery/authz |
| Product Owner approval required? | **YES** (confirm remains rule) |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-07 — Reuse existing LMS CanonicalDocument association

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-07** |
| Question | Should Patient 360 reuse the existing LMS CanonicalDocument association? |
| Repository evidence | `enterprise_lms` / `LmsReportOfficialPdfArtifact` / EntityId = ArtifactId already registered and content-gated |
| **RECOMMENDATION** | **YES — reuse existing** — do **not** introduce another LMS association type |
| Alternatives considered | (A) Reuse existing · (B) New entityType · (C) MPI association for LMS (rejected — wrong listing semantics) |
| Architectural / security implications | Visibility still filtered by current pointer; listing all associations would leak history |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-08 — CurrentOfficialArtifactId visibility (MODEL A)

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-08** |
| Question | Should Patient 360 show only the artifact referenced by `LmsReport.CurrentOfficialArtifactId`? |
| Repository evidence | Regeneration retains prior artifacts/docs; LMS registration does not supersede CanonicalDocuments; CUT C uses pointer |
| **RECOMMENDATION** | **YES — MODEL A** — current pointer is visibility SoT; do **not** use CanonicalDocument supersession as LMS currentness |
| Alternatives considered | (A) MODEL A pointer · (B) MODEL B supersession (unsafe / not implemented for LMS) · (C) List all associations (historical leak) |
| Architectural / security implications | Correct regeneration UX; prevents multi-current Laboratory rows |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-09 — Retain prior successful artifacts

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-09** |
| Question | Should prior successfully generated artifacts remain retained internally? |
| Repository evidence | ArtifactVersion increments; prior Succeeded rows retained; CanonicalDocuments/associations retained |
| **RECOMMENDATION** | **YES** |
| Alternatives considered | (A) Retain · (B) Delete prior (rejected — immutability / audit) |
| Architectural / security implications | History retained; visibility still current-only |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-10 — Regeneration moves visible Patient 360 document

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-10** |
| Question | Should successful regeneration replace the visible Patient 360 document by moving `CurrentOfficialArtifactId`? |
| Repository evidence | Success path sets pointer to new artifact; desired UX V1→V2 |
| **RECOMMENDATION** | **YES** — P360 shows V2 only; V1 retained internally |
| Alternatives considered | (A) Pointer move · (B) Show both as current (rejected) · (C) Soft-delete V1 Blob (rejected — PD-D-11) |
| Architectural / security implications | Projection must re-read current pointer; no dual current rows |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-11 — No physical Blob overwrite/delete on regeneration

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-11** |
| Question | Should regeneration physically overwrite/delete the previous Blob? |
| Repository evidence | Generation creates new registration; no delete/overwrite of prior Blob on success |
| **RECOMMENDATION** | **NO** — immutable Official PDF artifacts; no destructive storage behavior |
| Alternatives considered | (A) Retain Blobs · (B) Overwrite/delete prior (rejected) |
| Architectural / security implications | Preserves forensic/audit history |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-12 — No historical visibility in Patient 360

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-12** |
| Question | Should historical LMS Official PDF artifacts be visible/selectable in Patient 360? |
| Repository evidence | Listing all `enterprise_lms` associations would multiply Laboratory rows after regen |
| **RECOMMENDATION** | **NO** — current LMS Official PDF only |
| Alternatives considered | (A) Current only · (B) Historical browser (OUT of CUT D) |
| Architectural / security implications | Aligns with CUT C historical prohibition |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-13 — No LMS authorization bypass via Patient 360

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-13** |
| Question | Should Patient 360 LMS Preview/Download/Print bypass LMS authorization? |
| Repository evidence | Pathology uses `patient.view`; LMS download uses `lms.reports.download` + branch; bypass would weaken CUT C |
| **RECOMMENDATION** | **NO** — enforce LMS authorization; preferred content permission reuse: `lms.reports.download` + tenant/operating-branch model |
| Alternatives considered | (A) Enforce LMS authz · (B) `patient.view` only (rejected — bypass) · (C) `patient.patient_document.download` (rejected — MPI path) |
| Architectural / security implications | Critical; binds PD-D-17 and PD-D-BRANCH |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-14 — Patient Portal out of scope

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-14** |
| Question | Should Patient Portal / patient self-service publication be included? |
| Repository evidence | CUT B/C explicitly OUT; no patient-portal LMS Official PDF wiring; Patient 360 is staff surface |
| **RECOMMENDATION** | **NO** — explicitly out of scope; Patient 360 remains staff-only |
| Alternatives considered | (A) Exclude · (B) Include portal (separate future Product Decision) |
| Architectural / security implications | Prevents accidental patient publication |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-15 — No external/public/SAS URLs

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-15** |
| Question | Should external/public/SAS document URLs be introduced? |
| Repository evidence | Accepted LMS slices forbid SAS/public; Auth uses authenticated / internal stream |
| **RECOMMENDATION** | **NO** — authenticated application-mediated content streaming only |
| Alternatives considered | (A) App-mediated stream · (B) SAS/public (rejected) |
| Architectural / security implications | Binding with PD-D-CONTENT-DISPOSITION |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-16 — No Pathology association reuse

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-16** |
| Question | Should LMS Official PDFs reuse legacy Pathology `lab`/`LabReport` associations? |
| Repository evidence | Distinct constants; Auth tests assert LMS ≠ Pathology; Slice 4 owns Pathology path |
| **RECOMMENDATION** | **NO** |
| Alternatives considered | (A) Separate · (B) Reuse Pathology association (rejected) |
| Architectural / security implications | Ownership/lifecycle/permission confusion if reused |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-17 — Prefer no new permission

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-17** |
| Question | Should a new permission be introduced for Patient 360 LMS documents? |
| Repository evidence | Catalogue already has `lms.reports.download` / `lms.reports.view`; no role grants authorized by review |
| **RECOMMENDATION** | **PREFER NO** — reuse `lms.reports.download` for content; evaluate `lms.reports.view` (+ download eligibility) for list/projection. Invent a new permission **only** if PO explicitly rejects reuse and a separate security decision requires it. **No role grants** authorized by this review. |
| Alternatives considered | (A) Reuse LMS permissions · (B) New permission · (C) `patient.view` for LMS content (rejected by PD-D-13) |
| Architectural / security implications | Staff who see Pathology labs may not see LMS Official PDFs unless granted LMS permissions — intentional if PO selects (A) |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-18 — Report Detail Preview staff-only

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-18** |
| Question | Should Report Detail Preview be staff-only? |
| Repository evidence | LMS Report UI is staff JWT Hospital Portal workflow |
| **RECOMMENDATION** | **YES** |
| Alternatives considered | (A) Staff-only · (B) Patient-facing (OUT — PD-D-14) |
| Architectural / security implications | Aligns with CUT C staff download boundary |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-19 — Patient 360 remains discovery surface

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-19** |
| Question | Should Patient 360 Laboratory remain a discovery/projection surface rather than the clinical/operational SoT? |
| Repository evidence | Patient 360 product contract; LaboratoryApi owns LMS Report/artifact |
| **RECOMMENDATION** | **YES** — LaboratoryApi remains LMS SoT |
| Alternatives considered | (A) Discovery projection · (B) Make P360 SoT (rejected) |
| Architectural / security implications | Mutations remain LMS-module owned |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-20 — Reuse existing CanonicalDocument PDF (no second copy)

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-20** |
| Question | Should Patient 360 reuse the existing CanonicalDocument PDF rather than create a second stored PDF copy? |
| Repository evidence | Bytes already registered at CUT B; second copy would dual-store |
| **RECOMMENDATION** | **YES** — reuse existing document; **no** second storage copy |
| Alternatives considered | (A) Reuse · (B) Duplicate Blob (rejected) |
| Architectural / security implications | Preserves single physical storage; Auth remains byte owner |
| Product Owner approval required? | **YES** |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

## 8. Additional blocking decisions

These are **blocking** for D-B (and partly for D-A Preview audit). Status for each: **PENDING_PRODUCT_OWNER_APPROVAL**.

---

### PD-D-BRANCH — Operating-branch authorization in Patient 360

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-BRANCH** |
| Question | How should operating-branch authorization work when a user opens Patient Directory → Patient 360 → Documents → Laboratory for an LMS Official PDF? |
| Repository evidence | CUT C requires `operatingBranchId` matching report branch; Patient 360 has **no** LMS branch selector; Pathology lab path has **no** LMS branch model |
| Options | **A** — Require current LMS operating-branch context and enforce the same branch authorization as CUT C · **B** — Resolve the report’s `OperatingBranchId` server-side and still enforce that the staff user is authorized for that branch · **C** — Only if repository evidence supports another existing LMS branch pattern (do not invent) |
| Security consequence A | Strongest parity with CUT C; may require surfacing/branch context in P360 or denying when context missing |
| Security consequence B | Avoids UI branch selector; still fail-closed if user lacks that branch; must not silently ignore branch |
| Security consequence C | Only if proven; otherwise rejected |
| **RECOMMENDATION** | Do **not** weaken CUT C branch authorization. Prefer a model that still enforces user authorization for the report’s operating branch (evidence-backed **A** or **B**). Exact UX packaging is a PO choice. |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

**D-B must not be implemented until PD-D-BRANCH is closed.**

---

### PD-D-PREVIEW-AUDIT — Preview audit action

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-PREVIEW-AUDIT** |
| Question | Should Preview use the same `DOWNLOAD_OFFICIAL_PDF` audit event as Download, or a distinct Preview audit action? |
| Repository evidence | CUT C fail-closed `DOWNLOAD_OFFICIAL_PDF` before bytes; Preview would access the same protected stream |
| Options | **A** — Preview uses `DOWNLOAD_OFFICIAL_PDF` (same protected access) · **B** — Distinct `PREVIEW_OFFICIAL_PDF` (or equivalent) audit action |
| **RECOMMENDATION** | Prefer **A** (reuse existing protected access/audit model) unless compliance/audit semantics require distinguishing Preview from Download (**B**) |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-CONTENT-DISPOSITION — Preview via blob/object-URL pattern

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-CONTENT-DISPOSITION** |
| Question | Should Preview use the existing authenticated blob/object-URL preview pattern without exposing an inline/public URL? |
| Repository evidence | CUT C returns `Content-Disposition: attachment`; Patient 360 Preview uses authenticated fetch → `URL.createObjectURL` → iframe (ephemeral, not a public URL) |
| **RECOMMENDATION** | **YES** — blob/object-URL pattern; **no** public URL, SAS, or raw Blob URL |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

### PD-D-HASH-REUSE — Visibility when ContentHash collides

| Field | Content |
| --- | --- |
| Decision ID | **PD-D-HASH-REUSE** |
| Question | If two artifacts resolve to the same CanonicalDocument because content hash is identical, what determines Patient 360 visibility? |
| Repository evidence | `ResolveOrCreateAsync` reuses Active CanonicalDocument by tenant+patient+hash; associations remain per ArtifactId; current pointer selects current artifact |
| **RECOMMENDATION** | Artifact/report **current-pointer lineage** determines visibility — **never** ContentHash alone |
| PRODUCT OWNER DECISION | _Pending_ |
| Status | **PENDING_PRODUCT_OWNER_APPROVAL** |

---

## 9. Security decision summary

Any Product Owner-approved CUT D packaging **must** preserve:

| # | Control | Status in package |
| --- | --- | --- |
| 1 | No arbitrary CanonicalDocumentId from the browser | Required |
| 2 | No arbitrary ArtifactId from the browser | Required |
| 3 | No arbitrary ReportVersionId from the browser | Required |
| 4 | No direct Blob access | Required |
| 5 | No SAS URL | Required |
| 6 | No public URL | Required |
| 7 | No PatientId-only authorization | Required |
| 8 | Tenant isolation | Required |
| 9 | LMS report eligibility (Released + numbered + current Succeeded) | Required |
| 10 | Current artifact validation | Required |
| 11 | Succeeded artifact validation | Required |
| 12 | CanonicalDocument association validation (`enterprise_lms` / `LmsReportOfficialPdfArtifact`) | Required |
| 13 | Existing LMS permission enforcement | Required (exact codes via PD-D-17) |
| 14 | Existing operating-branch authorization | Required (exact model via PD-D-BRANCH) |
| 15 | No historical artifact selection | Required |
| 16 | No `patient.view`-only bypass for LMS Official PDF content | Required |

### Evidence gaps (do not guess)

| Gap | Impact |
| --- | --- |
| No Patient 360 LMS branch UX exists today | PD-D-BRANCH must be stamped before D-B coding |
| Preview audit action not defined in catalogue today | PD-D-PREVIEW-AUDIT must be stamped before D-A coding if audit allowlist change is needed |
| Production RolePermission grants for `lms.reports.download` are environment/ops concerns — **not** authorized by this package | Aligns with PD-ART-13 / CUT C PD-DL-19 |
| Slice 4 Pathology P360 Laboratory Manual UAT acceptance still not claimed | Does not block LMS decisions, but Pathology regression protection remains mandatory |

---

## 10. Branch authorization decision

See **PD-D-BRANCH** (§8).

**Binding recommendation (not approval):** Do not weaken CUT C branch authorization for Patient 360 LMS Official PDF content.

**PRODUCT OWNER DECISION:** _Pending_  
**Status:** `PENDING_PRODUCT_OWNER_APPROVAL`

---

## 11. Preview audit decision

See **PD-D-PREVIEW-AUDIT** (§8).

**Binding recommendation (not approval):** Prefer reusing the existing fail-closed protected-access audit model unless PO requires a distinct Preview action.

**PRODUCT OWNER DECISION:** _Pending_  
**Status:** `PENDING_PRODUCT_OWNER_APPROVAL`

---

## 12. Patient 360 UX decision

**RECOMMENDATION (not approved):** Preserve the existing Hospital Portal design system. Do **not** redesign Documents.

| Surface | Recommended behavior |
| --- | --- |
| Documents → Laboratory | May contain existing Pathology Laboratory documents **and** current LMS Official PDF rows |
| Distinguishability | Source/type labels must keep LMS Official PDF distinct from Pathology Lab report |
| Preview / Download / Print | Reuse `Patient360DocumentPreview` + existing print helpers |
| New PDF viewer package | **Forbidden** unless separate PO approval |
| Pathology UX | Unchanged unless a minimal safe adaptation is required to add LMS rows |
| Laboratory filter | Show Pathology + current LMS Official PDF (when authorized) |
| All filter | Participate in canonical identity/dedupe carefully; current-only LMS; avoid dual-current |
| Row identity | Distinct from Pathology `lab-{id}`; do not key LMS currentness by ContentHash alone |
| Loading / unavailable / failure | Existing Patient 360 patterns; LMS permission denial must not masquerade as Pathology empty |

**PRODUCT OWNER DECISION:** _Pending confirmation of PD-D-04 + UX packaging_  
**Status:** `PENDING_PRODUCT_OWNER_APPROVAL`

---

## 13. Regeneration semantics

**Recommended invariant (not approved until stamped via PD-D-08…12):**

| Phase | `CurrentOfficialArtifactId` | Patient 360 Laboratory |
| --- | --- | --- |
| Initial success | V1 | Shows V1 only |
| Successful regeneration | V2 | Shows V2 only; V1 retained internally |
| Failed regeneration | Remains V1 | Continues showing V1 |
| Failed artifact | Never becomes current | Never visible as current |

Do **not** use `CanonicalDocument.Status` as the primary LMS currentness decision.

---

## 14. Legacy Pathology boundary

```text
LEGACY PATHOLOGY = UNCHANGED
```

Do **not**:

- dual-write LMS PDFs to `LabReport`
- create `lab` / `LabReport` associations for LMS
- alter `LabReportsController`
- alter `LabReportCanonicalDocumentService`
- alter Pathology lifecycle or permissions
- migrate existing Pathology documents
- redirect Pathology routes

Existing Pathology automated tests must remain protected in any future implementation.

---

## 15. Patient Portal boundary

```text
PATIENT PORTAL = OUT OF SCOPE
```

Out of CUT D:

- patient self-service
- patient download
- patient publication
- NotificationHub / email / SMS / WhatsApp
- public links

Future patient-facing publication requires a **separate** Product Decision and implementation slice.

Staff Patient 360 discovery (if PD-D-04 approved) is **not** Patient Portal publication.

---

## 16. Proposed implementation packaging

**Do not implement now.** Future packaging only:

| Sub-slice | Scope | Gate |
| --- | --- | --- |
| **D-A** | Report Detail Official PDF Preview | PD-D-01…03, 18; PD-D-PREVIEW-AUDIT; PD-D-CONTENT-DISPOSITION |
| **D-B** | Patient 360 Laboratory current LMS Official PDF projection | PD-D-04…13, 17, 19–20; **PD-D-BRANCH**; PD-D-HASH-REUSE |
| **D-C** | Current-artifact / regeneration projection correctness | PD-D-08…12 |
| **D-D** | Automated security / integration / UI tests | After D-A / D-B |
| **D-E** | Manual UAT | After implementation |

**Hard rule:** **D-B must NOT be implemented** until authorization (PD-D-13/17) and branch (PD-D-BRANCH) decisions are explicitly closed in a Product Decision Closure.

Recommended sequencing after closure: **D-A first**, then **D-B**.

---

## 17. Out-of-scope

| Item | Status |
| --- | --- |
| Patient Portal / patient publication | OUT |
| NotificationHub / email / SMS / WhatsApp | OUT |
| SAS / public / raw Blob URLs | OUT |
| Historical Official PDF browser | OUT |
| Amendments / Unrelease / Revoke | OUT |
| Retention enforcement | OUT |
| Pathology dual-write / association reuse | OUT |
| New PDF viewer package / design system | OUT |
| Changing CUT C download contract | OUT |
| Production RolePermission seed grants | OUT |
| Implementation / migrations / API coding in this task | OUT |

---

## 18. Implementation readiness prerequisites

Before any CUT D coding:

1. Product Owner stamps PD-D-01…20 and blocking decisions (BRANCH, PREVIEW-AUDIT, CONTENT-DISPOSITION, HASH-REUSE).  
2. Separate **Product Decision Closure** document with `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED` (or D-A-only closure if product packages Preview first).  
3. Explicit confirmation CUT C remains accepted and unchanged.  
4. Implementation readiness audit (future separate task).  
5. Agreement on MODEL A and Pathology/Portal boundaries.  
6. No silent role grants; UAT grants remain environment ops if needed.

**This package does not authorize readiness audit coding or implementation.**

---

## 19. Manual UAT implications

Candidate scenarios remain those in discovery (UAT-D-01…24) — **not executed** by this review.

Manual UAT implications if recommendations are later approved:

- Preview content must match Download for current artifact  
- Regen must flip P360 visible document without showing dual current rows  
- Failed regen must leave prior current visible  
- Unauthorized / cross-tenant / cross-branch denials  
- Pathology Laboratory rows unchanged  
- Patient Portal unchanged  
- No public/SAS URL exposure  

`MANUAL_UAT_NOT_STARTED` for CUT D.

---

## 20. Product Owner approval section

### How to approve (future Decision Closure)

Product Owner should create a **separate** Decision Closure that explicitly stamps each:

- PD-D-01 … PD-D-20  
- PD-D-BRANCH  
- PD-D-PREVIEW-AUDIT  
- PD-D-CONTENT-DISPOSITION  
- PD-D-HASH-REUSE  

Using the repository convention established by CUT B / CUT C Decision Closures (`PRODUCT_OWNER_DECISIONS_APPROVED` + per-decision **APPROVED** option).

### Approval record (this package)

| Item | Value |
| --- | --- |
| Explicit Product Owner approval found in repository for PD-D-*? | **NO** |
| Approvals fabricated by this document? | **NO** |
| `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED` | **NOT YET** |
| `CUT_D_IMPLEMENTATION_AUTHORIZED` | **NO** |

---

## 21. Decision status summary

| ID | Recommendation (not approved) | Status |
| --- | --- | --- |
| PD-D-01 | YES — Report Detail Preview | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-02 | YES — current successful only | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-03 | YES — same resolution as Download | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-04 | YES — staff P360 Laboratory projection | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-05 | YES — distinct from Pathology | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-06 | YES — PatientId equality invariant | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-07 | YES — reuse enterprise_lms association | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-08 | YES — MODEL A current pointer | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-09 | YES — retain prior artifacts | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-10 | YES — regen moves visible current | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-11 | NO — do not delete/overwrite Blob | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-12 | NO — no historical P360 visibility | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-13 | NO — no LMS authz bypass | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-14 | NO — Patient Portal OUT | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-15 | NO — no public/SAS URLs | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-16 | NO — no Pathology association reuse | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-17 | PREFER NO new permission (reuse LMS) | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-18 | YES — Preview staff-only | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-19 | YES — P360 remains discovery surface | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-20 | YES — reuse CanonicalDocument (no 2nd copy) | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-BRANCH | Do not weaken CUT C branch authz (A/B packaging TBD) | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-PREVIEW-AUDIT | Prefer reuse DOWNLOAD_OFFICIAL_PDF unless distinct required | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-CONTENT-DISPOSITION | YES — blob/object-URL preview pattern | PENDING_PRODUCT_OWNER_APPROVAL |
| PD-D-HASH-REUSE | Current-pointer lineage — never hash alone | PENDING_PRODUCT_OWNER_APPROVAL |

### Unresolved Product Owner decisions (all of the above)

Especially blocking for implementation sequencing:

1. **PD-D-BRANCH** (blocks D-B)  
2. **PD-D-13 / PD-D-17** permission model (blocks D-B content)  
3. **PD-D-PREVIEW-AUDIT** (blocks D-A if allowlist/action choice needed)  
4. **PD-D-04** (whether D-B is in product scope at all)

---

## 22. Final recommendation

1. Product Owner should review and stamp PD-D-01…20 plus the four blocking decisions.  
2. Prefer MODEL A, LMS authz preservation, Pathology/Portal boundaries, and reuse of existing preview + CUT C content resolution.  
3. After stamps, create a **separate** Product Decision Closure before any readiness audit or coding.  
4. Package D-A before D-B; do not start D-B without branch + permission closure.  
5. Do **not** reopen CUT C.

```text
PRODUCT_DECISION_REVIEW_COMPLETE
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED = NOT YET
CUT_D_IMPLEMENTATION_AUTHORIZED = NO
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
NEXT_GATE = PRODUCT_OWNER_APPROVAL
```

---

## Preserved accepted slices

```text
ACCEPTED_L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_C_REMAINS_ACCEPTED
```

CUT C is **not** reopened. No CUT C behavior is modified by this package.

---

## Final status stamps

```text
DISCOVERY_COMPLETE
PRODUCT_DECISION_REVIEW_COMPLETE
NO_IMPLEMENTATION_STARTED
ACCEPTED_L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_C_REMAINS_ACCEPTED
CUT_D_IMPLEMENTATION_NOT_STARTED
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
PRODUCT_OWNER_APPROVAL_REQUIRED
NEXT_GATE = PRODUCT_OWNER_APPROVAL
```

**Intentionally not stamped**

- `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED`
- `CUT_D_IMPLEMENTATION_COMPLETE`
- `MANUAL_UAT_PASSED`
- `ACCEPTED_L_REP_03_CUT_D`
