# L-REP-03 B1 — Official PDF / Report Artifact Foundation  
## Product Decision Review / Decision Package

**Date:** 2026-10-12  
**Mode:** PRODUCT DECISION REVIEW — documentation only  
**Status:** `PRODUCT_OWNER_DECISION_REQUIRED`  

This package does **not** create a Product Decision Closure.  
It does **not** stamp APPROVED / `PRODUCT_DECISIONS_CLOSED_*_AUTHORIZED` for B1.  
It does **not** authorize implementation.

**RECOMMENDED** options below are engineering / discovery guidance only until Product Owner stamps choices in a separate Decision Closure.

```text
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED  (PD-ART-* carried forward)
  ↓
Official PDF discovery (DISCOVERY_COMPLETE)
  ↓
THIS DOCUMENT — Product Decision Review (B1 Official PDF / Artifact)
  ↓
NEXT_GATE = PRODUCT_DECISION_CLOSURE
  (Product Owner stamps PD-PDF-* choices outside this task)
```

---

## 1. Purpose

Obtain Product Owner decisions required to authorize a bounded **B1 — Official PDF / Report Artifact Foundation** cut after:

- metadata Release (`ACCEPTED_L_REP_02B`)
- explicit Business Report Number (`ACCEPTED_L_REP_03_CUT_A`)
- L-REP-03 artifact package decisions already stamped (`PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED`)

This review resolves **implementation-facing gaps** discovered after CUT A (content, jobs, permissions, association, configuration mechanism). It does **not** reopen certified Release or Report Number semantics.

---

## 2. Decision package status

| Field | Value |
| --- | --- |
| Mode | PRODUCT DECISION REVIEW / DECISION PACKAGE |
| Implementation | `NO_IMPLEMENTATION_STARTED` |
| L-REP-02B | Remains `ACCEPTED_L_REP_02B` — **not reopened** |
| L-REP-03 CUT A | Remains `ACCEPTED_L_REP_03_CUT_A` — **not reopened** |
| L-REP-03 PD-ART closure | Remains `PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED` — **carried forward** |
| Product Decision Closure (B1) | **Not created** by this document |
| Configuration gate | `CONFIGURATION_GATE_PENDING` |
| Next gate | `PRODUCT_DECISION_CLOSURE` |

Forbidden stamps for this task: `IMPLEMENTATION_COMPLETE`, `READY_FOR_PRE_UAT`, `MANUAL_UAT_PASSED` (for B1), `ACCEPTED_L_REP_03_CUT_B`, `PRODUCT_DECISIONS_CLOSED_*_AUTHORIZED` (new B1 closure).

---

## 3. Authoritative references

| Document | Role |
| --- | --- |
| [enterprise-lms-report-official-pdf-discovery-audit.md](./enterprise-lms-report-official-pdf-discovery-audit.md) | Official PDF discovery (`DISCOVERY_COMPLETE`) |
| [enterprise-lms-report-artifact-numbering-download-decision-closure.md](./enterprise-lms-report-artifact-numbering-download-decision-closure.md) | `PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED` (PD-ART-*) |
| [enterprise-lms-report-artifact-numbering-download-readiness-audit.md](./enterprise-lms-report-artifact-numbering-download-readiness-audit.md) | Prior readiness audit (pre–CUT A; PDF/job findings still useful) |
| [enterprise-lms-report-number-foundation-acceptance-closure.md](./enterprise-lms-report-number-foundation-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_A` |
| [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | `ACCEPTED_L_REP_02B` |
| L-REP-01 / L-REP-02A decision & acceptance docs | Draft / Finalize certified baseline |

---

## 4. Certified baseline (must not reopen)

### Lifecycle

```text
Draft → Final → Released → Business Report Number (explicit)
  → [candidate B1] Official PDF artifact
  → [candidate C] Staff download
```

### Immutable for this review

| Rule | Stamp |
| --- | --- |
| Release is metadata-only; no PDF; no number | `ACCEPTED_L_REP_02B` |
| Number explicit post-Release; immutable; operating-branch sequence | `ACCEPTED_L_REP_03_CUT_A` |
| PDF eligibility Released-only; async explicit generate; CanonicalDocument + Blob; configured lab signatory; tenant template; one current official; PDF must show number; no patient download; no role grants | PD-ART-* closure |

**No repository contradiction** was found that requires reopening PD-ART-* (discovery §25). Gaps are prerequisites and content/job mechanism choices — not invalidations of stamped decisions.

---

## 5. Existing approved decisions (carry forward)

Do **not** re-decide unless Product Owner explicitly reopens.

| ID | Decision | Approved value |
| --- | --- | --- |
| **PD-ART-01** | Business Report Number required | **Yes** |
| **PD-ART-02** | Assignment timing | Eligible when **Released** (separate op; not inside Release) |
| **PD-ART-02b** | Number immutability | **Immutable** once assigned |
| **PD-ART-02c** | Identity target | **Report aggregate** |
| **PD-ART-02d** | Number then PDF fails | **Retain** number; governed PDF retry |
| **PD-ART-02e** | Number UI visibility | Visible when **Released** (+ assigned) |
| **PD-ART-03** | Sequence scope | **Operating Branch** |
| **PD-ART-03b** | Gaps / reuse | Gaps **allowed**; reuse **forbidden** |
| **PD-ART-04** | PDF eligibility | **Released only** |
| **PD-ART-05** | Generation mode | Explicit staff action; **asynchronous** |
| **PD-ART-05b** | Regeneration | New artifact version on template/branding change; prior **retained** |
| **PD-ART-06** | Template ownership | **Tenant-level** governed configuration |
| **PD-ART-06b** | Signatory | **Configured laboratory signatory** |
| **PD-ART-07** | Physical storage | **CanonicalDocument + Blob** |
| **PD-ART-08** | Download eligibility | **Released** + available artifact |
| **PD-ART-09** | Authoritative artifact | One **current official** |
| **PD-ART-09b** | Download audit | Fail-closed |
| **PD-ART-09c** | Download UI surfaces | Detail + worklist (**CUT C**) |
| **PD-ART-10** | Patient download | **OUT OF SCOPE** |
| **PD-ART-11** | PDF displays number | **MUST** display Business Report Number |
| **PD-ART-12** | Packaging | Numbering + PDF were one package; **numbering delivered by CUT A**; remaining work is PDF/artifact |
| **PD-ART-13** | Role grants | **No** production role grants |

### Future capabilities (remain OUT)

| ID | Capability | Status |
| --- | --- | --- |
| F01 | Patient Portal publication | **OUT** |
| F02 | Patient 360 publication | **OUT** |
| F03 | Notifications | **OUT** |
| F04 | Amendments | **OUT** |
| F05 | Unrelease / Revoke | **OUT** |
| F06 | Analytics | **OUT** |
| F07 | Pathology migration / dual-write | **OUT** |

---

## 6. Repository evidence (discovery summary)

| Fact | Evidence |
| --- | --- |
| ReportVersion immutable sources hold values/units/comment/auth + ids | `LmsReportVersion` / `LmsReportVersionSource` |
| MRN/name/test display names **not** on ReportVersion snapshot | Discovery §7 / §14; eligible-sources has OrderVersion picker fields only |
| No QuestPDF in LaboratoryApi | `LaboratoryApi.csproj` |
| QuestPDF in AuthService only | PatientSummary / Imaging — reference only |
| No Lab PDF job/outbox/Hangfire/Service Bus | Discovery §9 |
| CanonicalDocument requires PatientId; Pathology uses `lab`/`LabReport` | Must **not** reuse for LMS |
| `lms.reports.generate` absent; PDF audit actions absent | Catalogue / `ReportAuditActions` |
| `lms.reports.download` catalogue-only; not wired | CUT C |
| Template + laboratory signatory stores for LMS Reports | **Missing** |

---

## 7. Product decisions required now (PD-PDF-*)

Product Owner selection cells are **blank**. Recommendations are **not** decisions.

### PD-PDF-01 — Exact PDF content model

**Most important unresolved decision.**

**Present on immutable ReportVersion + Report aggregate (evidence):** patient/order/branch ids; result values/units/comments; authorization metadata; catalogue/specimen/order-test ids; Business Report Number; Order Number via controlled join.

**Not on ReportVersion snapshot today:** patient MRN/legal name; test display names; reference ranges; interpretations/diagnoses; ordering provider; responsible clinician; specimen collection details/barcode; configured signatory.

| Option | Meaning | Immutability / drift |
| --- | --- | --- |
| **A** | Snapshot-only PDF — only fields already on ReportVersion + Report aggregate metadata | Strongest immutability; may omit human-readable identity/labels |
| **B** | Controlled generation-time joins — approved non-mutating reads from authoritative sources at generate time; ReportVersion remains clinical SoT | Risk of display drift if source labels change; must define allowed sources and freeze rules |
| **C** | Snapshot enrichment prerequisite (B0) — enrich ReportVersion before B1 | Strong immutability after enrichment; delays B1 |
| **D** | Other | Specify |

| Field | Value |
| --- | --- |
| Current approved state | PD-ART-11 requires number on PDF; other content **unresolved** |
| Recommendation | **B** for display joins that are non-clinical (MRN/name/test label from exact catalogue version / order snapshot) **or** **C** if PO demands snapshot-only human labels |
| Product Owner selection | |
| Consequence | Gates PD-PDF-02…06 and PD-PDF-23 (B0) |

---

### PD-PDF-02 — Patient identity content

Only if PD-PDF-01 allows patient identity beyond ids.

| Option | Fields |
| --- | --- |
| **A** | MRN required |
| **B** | Legal/display name required |
| **C** | Both MRN + name |
| **D** | Neither (ids only) |
| **E** | Other (list exact fields only) |

Do **not** invent DOB, age, sex, address, phone unless explicitly selected.

| Field | Value |
| --- | --- |
| Current approved state | Unresolved |
| Recommendation | **C** if staff official PDF is patient-facing print; else **D** |
| Product Owner selection | |
| Consequence | Source path: B0 enrichment vs generation-time OrderVersion snapshot |

---

### PD-PDF-03 — Test display content

| Option | Meaning |
| --- | --- |
| **A** | Internal catalogue/test identifiers only |
| **B** | Human-readable test display names |
| **C** | Both |

If **B** or **C**, source:

| Sub-option | Source |
| --- | --- |
| **S1** | Immutable ReportVersion snapshot (requires B0 if not present) |
| **S2** | Exact catalogue version lookup at generation (by CatalogueVersionId on source) |
| **S3** | Other controlled lookup |

| Field | Value |
| --- | --- |
| Current approved state | Unresolved |
| Recommendation | **C** + **S2** (exact catalogue version; no live “latest catalogue”) |
| Product Owner selection | |
| Consequence | Ties to PD-PDF-01 / PD-PDF-23 |

---

### PD-PDF-04 — Clinical reference / interpretation content

| Option | Meaning |
| --- | --- |
| **A** | Result + unit + comment only (what snapshot holds today) |
| **B** | Reference ranges if already authoritative elsewhere (must name source) |
| **C** | Interpretation / diagnosis |
| **D** | Other |

**Do not invent** ranges or interpretations. If **B**/**C** selected, Product Owner must name the authoritative LMS source and whether B0 is required.

| Field | Value |
| --- | --- |
| Current approved state | Unresolved; snapshot has **no** ranges/interpretations |
| Recommendation | **A** for B1 (smallest honest PDF) |
| Product Owner selection | |
| Consequence | **B**/**C** likely force B0 or block B1 until source exists |

---

### PD-PDF-05 — Clinician content

| Option | Show on PDF |
| --- | --- |
| **A** | Ordering Provider |
| **B** | Responsible Clinician |
| **C** | Authorized By (already on source snapshot) |
| **D** | Combination (specify) |
| **E** | None beyond Authorized By |
| **F** | None |

Do not invent provider hierarchy.

| Field | Value |
| --- | --- |
| Current approved state | Unresolved; snapshot has Authorized By only |
| Recommendation | **C** or **E** for B1 |
| Product Owner selection | |
| Consequence | **A**/**B** need authoritative source + B0 or joins |

---

### PD-PDF-06 — Specimen content

| Option | Fields (only if authoritative LMS source exists) |
| --- | --- |
| **A** | Specimen type |
| **B** | Specimen barcode |
| **C** | Collection date/time |
| **D** | Receiving date/time |
| **E** | Combination (specify) |
| **F** | SpecimenId only / none |

| Field | Value |
| --- | --- |
| Current approved state | Unresolved; ReportVersion has SpecimenId only |
| Recommendation | **F** for B1 unless PO requires barcode/collection from Specimen aggregate via controlled join |
| Product Owner selection | |
| Consequence | Non-F options require named LMS Specimen fields + join/B0 rules |

---

### PD-PDF-07 — Signatory representation

**Certified:** configured laboratory signatory (PD-ART-06b).

| Option | Representation |
| --- | --- |
| **A** | Name + professional title/credentials as text |
| **B** | Signature image + text identity |
| **C** | Text only (name) |
| **D** | Other |

Do not assume electronic/legal signature semantics. Do not create credential hierarchy.

| Field | Value |
| --- | --- |
| Current approved state | Configured lab signatory; representation unresolved; store missing |
| Recommendation | **A** (text) for B1; image later if needed |
| Product Owner selection | |
| Consequence | Drives signatory configuration schema |

---

### PD-PDF-08 — Template versioning mechanism

**Certified:** template version identity recorded on artifact; tenant-level template (PD-ART-06 / PD-ART-05b).

| Option | Mechanism |
| --- | --- |
| **A** | Tenant template record with **immutable** version identity; active version selected by governed config |
| **B** | Template GUID/version without immutability rules |
| **C** | Other governed identity |

Also decide: may a template be edited **in place**? (**Yes** / **No**)

| Field | Value |
| --- | --- |
| Current approved state | Identity must be recorded; store missing |
| Recommendation | **A** + **No** in-place edit (new version instead) |
| Product Owner selection | |
| Consequence | CONFIGURATION_REQUIRED store design |

---

### PD-PDF-09 — Branding ownership

Decide whether tenant PDF template owns:

| Field | Include? (Y/N/Other) | PO |
| --- | --- | --- |
| Logo | | |
| Hospital / lab name | | |
| Address / contact | | |
| Other (list) | | |

Do not invent branding fields beyond PO selection.

| Field | Value |
| --- | --- |
| Current approved state | Unresolved within tenant template |
| Recommendation | Logo + hospital/lab name minimum; address optional |
| Product Owner selection | |
| Consequence | Template config fields |

---

### PD-PDF-10 — Generation job model

**Certified:** explicit staff action + asynchronous (PD-ART-05).  
**Evidence:** LaboratoryApi has no job infrastructure; no Service Bus in repo.

| Option | Model |
| --- | --- |
| **A** | LaboratoryApi-owned PDF job table + Azure Functions **Timer** drain |
| **B** | LaboratoryApi-owned job table + another existing approved worker pattern inside Laboratory |
| **C** | Existing platform job service if Product Owner names an authoritative one |
| **D** | Other |

**Do not introduce Service Bus** without explicit platform decision.

Also decide (do not invent retry counts):

| Topic | Options / notes | PO selection |
| --- | --- | --- |
| Job states | Pending / Running / Succeeded / Failed (confirm or change) | |
| Retry | Allowed after Failed? (PD-ART-02d implies yes for generate) | |
| Max attempts | Specify or “no fixed max; operational policy later” | |
| Stale Running | How handled (timeout reclaim / manual / other) | |
| Duplicate requests | See PD-PDF-13 / PD-PDF-14 | |
| Current artifact pointer | Update **only** on Succeeded official generation | Confirm Y/N |

| Field | Value |
| --- | --- |
| Current approved state | Async required; infra missing |
| Recommendation | **A**; pointer update only on success |
| Product Owner selection | |
| Consequence | B1 schema + Functions design |

---

### PD-PDF-11 — Generate permission

| Option | Code |
| --- | --- |
| **A** | `lms.reports.generate` |
| **B** | Other (specify) |

**No role grants** (PD-ART-13).

| Field | Value |
| --- | --- |
| Current approved state | Catalogue absent |
| Recommendation | **A** |
| Product Owner selection | |
| Consequence | Auth catalogue seed (no grants) |

---

### PD-PDF-12 — Audit actions

Recommended codes (approve or replace):

| Recommended | Purpose |
| --- | --- |
| `REQUEST_OFFICIAL_PDF` | Accept generate request / enqueue |
| `OFFICIAL_PDF_GENERATED` | Successful official artifact |
| `OFFICIAL_PDF_FAILED` | Failed generation |

Download audit remains **CUT C** (`DOWNLOAD_OFFICIAL_PDF` or PO-approved name later).

| Field | Value |
| --- | --- |
| Current approved state | Unresolved exact strings |
| Recommendation | Approve the three recommended codes |
| Product Owner selection | |
| Consequence | Auth allowlist + Lab audit constants |

---

### PD-PDF-13 — PDF request idempotency

| Topic | Options | PO selection |
| --- | --- | --- |
| Operation name | **A** `generate_official_pdf` · **B** other | |
| Same key + same hash | Return prior acceptance / job | |
| Same key + different hash | Reject (hash conflict) | |
| Already Running | See PD-PDF-14 | |
| Already Succeeded (no regen intent) | Return current official / no-op | |
| Failed prior attempt | Allow new attempt | |
| Explicit regeneration | New job + new artifact version on success (PD-ART-05b) | |

| Field | Value |
| --- | --- |
| Current approved state | Unresolved |
| Recommendation | Op **A**; align with Report idempotency patterns |
| Product Owner selection | |
| Consequence | Idempotency table op + API contract |

---

### PD-PDF-14 — Concurrent generation

| Topic | Options | PO selection |
| --- | --- | --- |
| One active job per Report? | **A** Yes · **B** No · **C** Other | |
| Request while Running | **A** Reject · **B** Return existing job · **C** Other | |
| Explicit new version request | Allowed when no Running job? Y/N | |
| Current pointer | Must **not** change until successful generation | Confirm |

| Field | Value |
| --- | --- |
| Current approved state | PD-ART-09 one current official; concurrency unresolved |
| Recommendation | One active job; reject or return existing while Running; pointer only on success |
| Product Owner selection | |
| Consequence | Unique in-flight constraint |

---

### PD-PDF-15 — Artifact versioning semantics

**Certified:** new version on template/branding change; prior retained; one current official.

Confirm exact semantics:

| Element | Proposed | PO confirm / change |
| --- | --- | --- |
| Version number | Integer starting at 1 | |
| Artifact records | Immutable after success | |
| Content hash | Required | |
| Template version identity | Required on artifact | |
| GeneratedAtUtc / GeneratedByUserId | Required on success | |
| Failure metadata | On job/failed attempt; not current official | |

Do not invent a different lifecycle.

| Field | Value |
| --- | --- |
| Recommendation | Accept proposed table |
| Product Owner selection | |

---

### PD-PDF-16 — Current official pointer ownership

| Option | Owner |
| --- | --- |
| **A** | `LmsReport` owns current official artifact pointer (LaboratoryApi SoT) |
| **B** | Other (justify) |

CanonicalDocument alone must **not** replace the pointer.

| Field | Value |
| --- | --- |
| Current approved state | PD-ART-09; discovery recommends Laboratory pointer |
| Recommendation | **A** |
| Product Owner selection | |

---

### PD-PDF-17 — CanonicalDocument association

**Certified storage:** CanonicalDocument + Blob (PD-ART-07).  
**Must not reuse:** Pathology `lab` / `LabReport`.

| Option | Association model |
| --- | --- |
| **A** | New LMS-specific CanonicalDocument association; LaboratoryApi retains authoritative artifact pointer; staff-only; no Patient Portal / Patient 360 publication |
| **B** | Other (must still forbid Pathology LabReport reuse) |

| Field | Value |
| --- | --- |
| Recommendation | **A** (e.g. domain/entity for LmsReport or LmsReportArtifact — exact names in Closure) |
| Product Owner selection | |

---

### PD-PDF-18 — Template / signatory configuration delivery

Required stores (CONFIGURATION_REQUIRED):

- tenant-level PDF template  
- immutable template versions (subject to PD-PDF-08)  
- configured laboratory signatory  

| Option | Initial delivery |
| --- | --- |
| **A** | Admin-managed UI (future; not B1) |
| **B** | Database / governed configuration initially (no production defaults invented) |
| **C** | Other |

| Field | Value |
| --- | --- |
| Recommendation | **B** for B1 UAT; UI later |
| Product Owner selection | |

---

### PD-PDF-19 — Retention

Discovery: no first-class LMS artifact retention policy. **Do not invent a duration.**

| Option | Meaning |
| --- | --- |
| **A** | Retention enforcement required for B1 |
| **B** | Retention configuration only; enforcement later |
| **C** | No LMS-specific retention enforcement yet |
| **D** | Other |

If **A**, treat duration + purge as configuration + implementation prerequisite.

| Field | Value |
| --- | --- |
| Recommendation | **C** or **B** for B1 |
| Product Owner selection | |

---

### PD-PDF-20 — PDF failure semantics

**Carry forward PD-ART-02d** and confirm:

| Rule | Confirm Y/N |
| --- | --- |
| Report remains Released | |
| ReportVersion unchanged | |
| Business Report Number retained | |
| Failure audited | |
| Retry permitted | |
| Failed attempts retained as job/audit history | |
| Failed attempts **never** become current official | |

| Field | Value |
| --- | --- |
| Recommendation | Confirm all **Y** |
| Product Owner selection | |

---

### PD-PDF-21 — Storage metadata (LMS artifact record)

Minimum metadata (approve or edit list):

| Field | Include? |
| --- | --- |
| MIME type | |
| Byte size | |
| Content hash | |
| CanonicalDocumentId | |
| Template version identity | |
| Artifact version | |
| Generated by / at | |
| Status | |
| Failure reason (failed attempts / jobs) | |

No unnecessary PHI in job payloads, logs, or audit bodies.

| Field | Value |
| --- | --- |
| Recommendation | Include all listed fields |
| Product Owner selection | |

---

### PD-PDF-22 — B1 UI

| Topic | Options | PO selection |
| --- | --- | --- |
| Detail action when Released + numbered | **A** “Generate Official PDF” · **B** other label | |
| Show generation status | Y/N | |
| Show generated timestamp | Y/N | |
| Show current artifact metadata (no download) | Y/N | |
| Worklist PDF status column in B1 | **A** Yes · **B** No (detail only) | |
| Download in B1 | **Must be No** (CUT C) | Confirm |

| Field | Value |
| --- | --- |
| Recommendation | Detail Generate + status/timestamp/metadata; worklist **B** No for B1; no download |
| Product Owner selection | |

---

### PD-PDF-23 — B0 snapshot enrichment gate

| Option | Meaning |
| --- | --- |
| **A** | No B0; use controlled generation-time joins for missing display fields (requires PD-PDF-01 = B) |
| **B** | B0 required; enrich immutable ReportVersion before B1 |
| **C** | Snapshot-only PDF; no enrichment (PD-PDF-01 = A) |

Do **not** implement B0 in this review.

| Field | Value |
| --- | --- |
| Recommendation | Align with PD-PDF-01 (**A** here if content = joins; **B** if enrichment mandated; **C** if snapshot-only) |
| Product Owner selection | |
| Consequence | If **B**, B0 precedes B1 authorization |

---

### PD-PDF-24 — PDF generation trigger

**Carry forward PD-ART-05.** Confirm:

| Rule | Confirm Y/N |
| --- | --- |
| Explicit staff action only | |
| **Not** automatic on Release | |
| **Not** automatic on number assignment | |
| **Not** automatic on first download | |

| Field | Value |
| --- | --- |
| Recommendation | Confirm all **Y** |
| Product Owner selection | |

---

## 8. Concise Product Owner decision matrix

| ID | Decision | Current approved | Options | Recommendation | PO selection | Consequence / dependency |
| --- | --- | --- | --- | --- | --- | --- |
| PD-PDF-01 | Exact PDF content model | Number required (PD-ART-11); rest open | A snapshot-only · B generation joins · C B0 enrichment · D other | B or C | | Gates 02–06, 23 |
| PD-PDF-02 | Patient identity fields | Open | A MRN · B name · C both · D neither · E other | C or D | | Source path |
| PD-PDF-03 | Test display | Open | A ids · B names · C both + source S1/S2/S3 | C + S2 | | Catalogue version join or B0 |
| PD-PDF-04 | Ranges / interpretation | Open; not in snapshot | A values only · B ranges · C interpretation · D other | A | | B/C may block B1 |
| PD-PDF-05 | Clinician content | Authorized By on snapshot | A–F | C or E | | Provider source |
| PD-PDF-06 | Specimen content | SpecimenId only | A–F | F | | Specimen joins |
| PD-PDF-07 | Signatory representation | Configured signatory | A text+creds · B image+text · C name · D other | A | | Signatory schema |
| PD-PDF-08 | Template versioning | Identity required | A immutable versions · B GUID/version · C other; in-place Y/N | A + no in-place | | Template store |
| PD-PDF-09 | Branding fields | Open | Logo / name / address / other | Logo + name | | Template fields |
| PD-PDF-10 | Job model | Async certified | A Timer+job table · B other Lab worker · C named platform · D other | A | | B1 infra |
| PD-PDF-11 | Generate permission | Absent | A `lms.reports.generate` · B other | A | | Catalogue only |
| PD-PDF-12 | Audit action codes | Absent | Approve recommended trio or replace | Approve trio | | Allowlist |
| PD-PDF-13 | Idempotency op | Open | `generate_official_pdf` or other + semantics | `generate_official_pdf` | | API |
| PD-PDF-14 | Concurrent generation | Open | One active job; reject/return while Running | One active; return/reject | | Constraints |
| PD-PDF-15 | Artifact version fields | PD-ART-05b/09 | Confirm proposed semantics | Confirm | | Artifact schema |
| PD-PDF-16 | Current official pointer | Open ownership | A LmsReport pointer · B other | A | | SoT |
| PD-PDF-17 | Canonical association | PD-ART-07; not LabReport | A new LMS association · B other | A | | Auth contract |
| PD-PDF-18 | Config delivery | Stores missing | A future UI · B DB/governed now · C other | B | | UAT config |
| PD-PDF-19 | Retention | No policy | A enforce B1 · B config later · C none yet · D other | C or B | | Prerequisite if A |
| PD-PDF-20 | Failure semantics | PD-ART-02d | Confirm rules | Confirm all Y | | Job/audit |
| PD-PDF-21 | Artifact metadata | Open | Approve field list | Approve list | | Schema |
| PD-PDF-22 | B1 UI | Open | Generate + status; no download; worklist Y/N | Detail only; no download | | FE scope |
| PD-PDF-23 | B0 gate | Open | A no B0/joins · B B0 required · C snapshot-only | Align with 01 | | Sequencing |
| PD-PDF-24 | Trigger | PD-ART-05 | Confirm not auto on Release/number/download | Confirm all Y | | API/UI honesty |

---

## 9. Configuration gate

```text
CONFIGURATION_REQUIRED = YES
CONFIGURATION_GATE_PENDING
```

**Minimum before B1 UAT / go-live (do not invent production defaults):**

| Configuration | Required by |
| --- | --- |
| Tenant-level PDF template | PD-ART-06 |
| Template version identity | PD-ART-05b / PD-PDF-08 |
| Configured laboratory signatory | PD-ART-06b / PD-PDF-07 |
| Retention duration + enforcement | **Only if** PD-PDF-19 = A |

Delivery mechanism subject to PD-PDF-18.

---

## 10. Security / audit / PHI boundary

Confirm for B1 (carry-forward + review):

| Control | Required |
| --- | --- |
| Eligibility | Released only |
| Number | Business Report Number assigned required for official success |
| Tenant validation | Yes |
| Operating-branch authorization | Yes (`ValidateUserBranchAsync` pattern) |
| Permission | Generate permission (PD-PDF-11); **no** role grants |
| Staff-only | Yes |
| Patient publication / download | **No** (F01/F02 / PD-ART-10) |
| Private blob storage | Yes |
| Unnecessary PHI in jobs/logs/audit | **Forbidden** |
| Audit | Request / success / failure (PD-PDF-12); fail-closed where platform requires |
| Download | **Out of B1** |

---

## 11. Proposed packaging (recommendation only — not authorized)

```text
B0 — Snapshot enrichment     ONLY if PD-PDF-23 = B
B1 — Official PDF artifact foundation
C  — Staff download          after B1
```

| Cut | May include | Must not include |
| --- | --- | --- |
| **B0** | ReportVersion snapshot enrichment for PO-required fields | PDF, download, Release/Number changes |
| **B1** | Async generate, job, LMS artifact + current pointer, CanonicalDocument bytes, generate permission/audit, detail UI status | Download, patient publish, notify, Release changes, Number rule changes, Pathology dual-write |
| **C** | Staff download + fail-closed download audit + detail/worklist download | Patient download; regenerate policy changes unless separately decided |

**B1 must not** modify `ReleaseAsync` or Report Number semantics.

---

## 12. Dependencies

```text
ACCEPTED Release
    → ACCEPTED Business Report Number
        → [optional B0 if selected]
            → CONFIG: template + signatory (+ retention if enforced)
                → B1 Official PDF artifact
                    → C Staff download
```

---

## 13. Explicit out of scope (this review and B1)

- Implementation of any kind  
- Product Decision Closure (this task)  
- Download / QuestPDF install / jobs / schema / APIs / UI / permissions / grants  
- Automatic PDF on Release or number assign  
- Patient Portal / Patient 360 / notifications  
- Amendments / Unrelease / Revoke  
- Pathology LabReport dual-write  
- Service Bus introduction without platform decision  
- Invented production template/signatory/retention defaults  

---

## 14. Product Owner decision section

**Instructions:** Fill **Product Owner selection** for PD-PDF-01 … PD-PDF-24 (and branding/job sub-rows).  
Do not mark this package as Closure.

After selections are complete, a separate task creates:

`PRODUCT_DECISION_CLOSURE` for B1 Official PDF / Report Artifact Foundation.

Until then:

```text
PRODUCT_OWNER_DECISION_REQUIRED
CONFIGURATION_GATE_PENDING
CUT_B_NOT_STARTED
CUT_C_NOT_STARTED
```

---

## 15. Next gate

```text
NEXT_GATE = PRODUCT_DECISION_CLOSURE
```

---

## 16. Final stamps

```text
PRODUCT_DECISION_REVIEW_COMPLETE
NO_IMPLEMENTATION_STARTED
L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A
CUT_B_NOT_STARTED
CUT_C_NOT_STARTED
PRODUCT_OWNER_DECISION_REQUIRED
CONFIGURATION_GATE_PENDING
NEXT_GATE = PRODUCT_DECISION_CLOSURE
STOP
```

**STOP.** Do not create Product Decision Closure. Do not implement anything.
