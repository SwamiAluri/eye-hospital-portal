# L-REP-03 CUT C — Staff Download of the Official PDF  
## Product Decision Review / Decision Package

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT C — Staff Download of the Official PDF  
**Mode:** PRODUCT DECISION REVIEW — documentation only  
**Status:** `PRODUCT_OWNER_DECISION_REQUIRED`

This package does **not** create a Product Decision Closure.  
It does **not** stamp APPROVED / `PRODUCT_DECISIONS_CLOSED_*` for CUT C.  
It does **not** authorize implementation readiness or CUT C implementation.

**RECOMMENDED** options below are discovery / engineering guidance only until Product Owner stamps choices in a separate Decision Closure.

```text
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B  (B1 frozen)
PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED  (PD-ART-* carried forward)
  ↓
Staff Download discovery (DISCOVERY_COMPLETE)
  ↓
THIS DOCUMENT — Product Decision Review (CUT C Staff Download)
  ↓
NEXT_GATE = PRODUCT_DECISION_CLOSURE
  (Product Owner stamps PD-DL-* choices outside this task)
```

---

## 1. Purpose

Obtain Product Owner decisions required to authorize a bounded **CUT C — Staff Download of the Official PDF** after:

- metadata Release (`ACCEPTED_L_REP_02B`)
- Business Report Number (`ACCEPTED_L_REP_03_CUT_A`)
- Official PDF Artifact Foundation (`ACCEPTED_L_REP_03_CUT_B`)
- Staff Download discovery (`DISCOVERY_COMPLETE`)

Conceptual target (subject to Product Owner approval):

```text
Authorized staff user
        ↓
Eligible Released + numbered Report
        ↓
Current Succeeded Official PDF artifact
        ↓
Secure authenticated retrieval
        ↓
Audited staff download
```

This review resolves **implementation-facing Product Decisions** for staff download. It does **not** reopen certified Release, Report Number, or B1 Official PDF semantics.

---

## 2. Decision package status

| Field | Value |
| --- | --- |
| Mode | PRODUCT DECISION REVIEW / DECISION PACKAGE |
| Implementation | `NO_IMPLEMENTATION_STARTED` |
| L-REP-02B | Remains `ACCEPTED_L_REP_02B` — **not reopened** |
| L-REP-03 CUT A | Remains `ACCEPTED_L_REP_03_CUT_A` — **not reopened** |
| L-REP-03 CUT B / B1 | Remains `ACCEPTED_L_REP_03_CUT_B` — **not reopened** |
| L-REP-03 PD-ART closure | Remains `PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED` — **carried forward** |
| Product Decision Closure (CUT C) | **Not created** by this document |
| Configuration gate | `CONFIGURATION_GATE_PENDING` → expected `CONFIGURATION_REQUIRED = NO` (§9) |
| Next gate | `PRODUCT_DECISION_CLOSURE` |

**Forbidden stamps for this task:** `PRODUCT_DECISIONS_CLOSED`, `IMPLEMENTATION_AUTHORIZED`, `IMPLEMENTATION_COMPLETE`, `MANUAL_UAT_PASSED`, `ACCEPTED_L_REP_03_CUT_C`.

---

## 3. Authoritative references

| Document | Role |
| --- | --- |
| [enterprise-lms-report-staff-download-discovery-audit.md](./enterprise-lms-report-staff-download-discovery-audit.md) | CUT C discovery (`DISCOVERY_COMPLETE`; `READY_FOR_PRODUCT_DECISION_REVIEW`) |
| [enterprise-lms-report-official-pdf-acceptance-closure.md](./enterprise-lms-report-official-pdf-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_B` |
| [enterprise-lms-report-official-pdf-decision-closure.md](./enterprise-lms-report-official-pdf-decision-closure.md) | PD-PDF-*; download OUT of B1 |
| [enterprise-lms-report-official-pdf-readiness-audit.md](./enterprise-lms-report-official-pdf-readiness-audit.md) | B1 readiness baseline |
| [enterprise-lms-report-official-pdf-implementation-report.md](./enterprise-lms-report-official-pdf-implementation-report.md) | B1 implementation |
| [enterprise-lms-report-artifact-numbering-download-decision-closure.md](./enterprise-lms-report-artifact-numbering-download-decision-closure.md) | PD-ART-08/09/09b/09c/10 download principles |
| [enterprise-lms-report-number-foundation-acceptance-closure.md](./enterprise-lms-report-number-foundation-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_A` |
| [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | `ACCEPTED_L_REP_02B` |

---

## 4. Certified baseline (must not reopen)

### Lifecycle

```text
Draft → Final → Released → Business Report Number (explicit)
  → Official PDF artifact (B1 — ACCEPTED)
  → [candidate CUT C] Staff download
```

### Frozen B1 capabilities

| Capability | State |
| --- | --- |
| Released Report + immutable ReportVersion | Certified |
| Business Report Number | Certified |
| Explicit async Official PDF generation | Certified |
| Immutable Official PDF artifact versions | Certified |
| `CurrentOfficialArtifactId` | Certified |
| `CanonicalDocumentId` + private Blob | Certified |
| Association `enterprise_lms` / `LmsReportOfficialPdfArtifact` | Certified |
| LaboratoryApi = Report/artifact SoT | Certified |
| Staff download / historical artifact API / patient publication / NotificationHub | **Absent** (expected) |

### Immutable for this review

| Rule | Stamp |
| --- | --- |
| Release is metadata-only | `ACCEPTED_L_REP_02B` |
| Number explicit post-Release; immutable; operating-branch sequence | `ACCEPTED_L_REP_03_CUT_A` |
| Official PDF generate/job/artifact/CanonicalDocument foundation | `ACCEPTED_L_REP_03_CUT_B` |
| One current official; prior retained; patient download OUT; no production role grants | PD-ART-* / PD-PDF-* |

---

## 5. Existing approved decisions (carry forward)

Do **not** re-decide unless Product Owner explicitly reopens.

| ID | Decision | Approved value | CUT C relevance |
| --- | --- | --- | --- |
| **PD-ART-08** | Download eligibility | **Released** + available artifact | Refined by PD-DL-01/02 (number + Succeeded current) — **PO must confirm** |
| **PD-ART-09** | Authoritative artifact | One **current official** | PD-DL-03 / PD-DL-15 |
| **PD-ART-09b** | Download audit | Fail-closed | PD-DL-09 / PD-DL-10 |
| **PD-ART-09c** | Download UI surfaces | Detail + worklist | PD-DL-11 |
| **PD-ART-10** | Patient download | **OUT OF SCOPE** | Preserved |
| **PD-ART-13** | Role grants | **No** production role grants | PD-DL-19 |
| **PD-PDF-19** | Retention | Deferred in B1 | PD-DL-16 |

### Future capabilities (remain OUT of CUT C)

| ID | Capability | Status |
| --- | --- | --- |
| F01 | Patient Portal publication | **OUT** |
| F02 | Patient 360 publication | **OUT** |
| F03 | Notifications | **OUT** |
| F04 | Amendments | **OUT** |
| F05 | Unrelease / Revoke | **OUT** |
| F06 | Analytics | **OUT** |
| F07 | Pathology migration / dual-write | **OUT** |
| H01 | Historical Official PDF browser / download | **OUT** unless PD-DL-15 selects otherwise |

---

## 6. Source of truth (discovery summary)

```text
LmsReport.CurrentOfficialArtifactId
        ↓
Succeeded LmsReportOfficialPdfArtifact
        ↓
CanonicalDocumentId
        ↓
AuthService CanonicalDocument
        ↓
private Azure Blob
```

| Owner | Responsibility |
| --- | --- |
| **LaboratoryApi** | Report, lifecycle, Business Report Number, Official PDF artifact, `CurrentOfficialArtifactId`, tenant authz, operating-branch authz |
| **AuthService** | CanonicalDocument identity, private Blob bytes, association `enterprise_lms` / `LmsReportOfficialPdfArtifact` |

| Fact | Evidence class |
| --- | --- |
| Historical artifacts retained but not API-exposed | Repository |
| Auth staff CanonicalDocument access = JWT + server authz + `OpenReadExactAsync` + `File(...)` | Repository |
| SAS = CCMS pattern; not Auth CanonicalDocument staff pattern | Repository |
| `lms.reports.download` catalogue-only; unwired; no grants | Repository |
| `DOWNLOAD_OFFICIAL_PDF` not allowlisted | Repository |
| Stored filename `{BusinessReportNumber}.pdf` | Repository (B1) |

**Ownership separation must be preserved.** CanonicalDocument is not LMS Report clinical SoT. Pathology is not LMS Official PDF SoT.

---

## 7. Contradiction / gap note (not a blocker)

| Item | Assessment |
| --- | --- |
| PD-ART-08 text vs PD-DL-01/02 recommendation | PD-ART-08 = Released + available artifact. Discovery + this package recommend **also requiring Business Report Number + current Succeeded artifact**. This is a **CUT C packaging refinement**, not a reopen of Release/Number/B1. Product Owner must explicitly select PD-DL-01 **B** (and PD-DL-02 **A**) or choose the narrower PD-ART-08 wording. |
| New blocker for Decision Review? | **None.** Discovery classified `READY_FOR_PRODUCT_DECISION_REVIEW`. |
| Configuration dependency for download? | **None invented.** Generate already depends on template/signatory; download depends on an existing Succeeded current artifact. |

---

## 8. Security principles (binding for CUT C design)

Regardless of option nuance, Product Owner approval of CUT C must preserve:

| Principle |
| --- |
| No arbitrary artifact ID download |
| No arbitrary CanonicalDocument ID download |
| No raw Blob URL / public URL / patient-facing URL |
| No cross-tenant access |
| No cross-branch access |
| No bypass of `lms.reports.download` |
| No generic MPI permission substitution (`patient.patient_document.download`, etc.) |
| Current artifact validation |
| Succeeded artifact validation |
| Fail-closed required audit |
| No PHI in query strings |
| No MRN / patient name in default filename |
| No historical artifact access in CUT C (unless PD-DL-15 explicitly expands) |
| No Pathology `lab` / `LabReport` association reuse |

---

## 9. Configuration gate

| Field | Value |
| --- | --- |
| Expected | `CONFIGURATION_REQUIRED = NO` |
| Rationale | CUT C retrieves an already-generated Official PDF. No new LMS template, signatory, numbering, or retention configuration is required for staff download itself. |
| Caveat | Operational UAT may still need environment-specific **permission grants** (not source seeders) — see PD-DL-19. That is ops access, not product configuration inventing values. |
| Status | `CONFIGURATION_GATE_PENDING` until Product Decision Closure records the gate |

Do **not** invent configuration.

---

## 10. Product decisions required now (PD-DL-*)

Product Owner selection cells are **blank**. Recommendations are **not** approvals.

Decision count in this package: **20** (PD-DL-01 … PD-DL-20).

---

### PD-DL-01 — Download eligibility lifecycle

| Field | Value |
| --- | --- |
| **Decision** | When may staff download the Official PDF? |
| **Current repository evidence** | B1 generate requires Released + Business Report Number; `CurrentOfficialArtifactId` set only on Succeeded; detail Official PDF panel visible only when Released + numbered |
| **Certified / carry-forward** | PD-ART-08 = Released + available artifact (narrower wording) |
| **Options** | **A.** Released + current artifact · **B.** Released + numbered + current Succeeded artifact · **C.** Other |
| **Recommended option** | **B** |
| **Rationale** | Aligns Generate and Download eligibility; uses authoritative current pointer; avoids download when report is not in the operational numbered Released state |
| **Security implications** | Reduces access windows; still requires permission + branch gates |
| **Operational implications** | Staff must assign number and generate before download |
| **UX implications** | Matches existing Official PDF panel visibility rules |
| **Implementation implications** | Eligibility checks on download API + FE enablement |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-02 — Business Report Number

| Field | Value |
| --- | --- |
| **Decision** | Is Business Report Number required for download? |
| **Current repository evidence** | B1 generate requires number; stored CanonicalDocument filename `{BusinessReportNumber}.pdf` |
| **Certified / carry-forward** | PD-ART-01 / CUT A number immutability; PD-ART-08 does not explicitly name number for download |
| **Options** | **A.** Required · **B.** Not required if artifact exists |
| **Recommended option** | **A** |
| **Rationale** | Stable business identity of the official document; consistent with generate and filename |
| **Security implications** | Avoids ambiguous document identity in audit/filename |
| **Operational implications** | Number assignment remains a prerequisite path |
| **UX implications** | Download hidden/disabled when unnumbered (with Generate panel) |
| **Implementation implications** | Reject/`report_number_required` (or equivalent) when missing |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-03 — Current vs historical artifact

| Field | Value |
| --- | --- |
| **Decision** | Which Official PDF artifact versions are downloadable in CUT C? |
| **Current repository evidence** | Historical Succeeded rows retained; no history list API; only current exposed on detail |
| **Certified / carry-forward** | PD-ART-09 = one current official |
| **Options** | **A.** Current only · **B.** Current + historical by version · **C.** Current + admin-only historical |
| **Recommended option** | **A** |
| **Rationale** | Avoids new history model/list/authz; reduces IDOR from arbitrary historical artifact IDs |
| **Security implications** | Stronger — bind strictly to `CurrentOfficialArtifactId` |
| **Operational implications** | Prior versions remain retained for future slices |
| **UX implications** | Single Download action for current official |
| **Implementation implications** | Reject non-current artifact ids |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-04 — Download permission

| Field | Value |
| --- | --- |
| **Decision** | Which permission gates staff Official PDF download? |
| **Current repository evidence** | Catalogue `lms.reports.download` seeded; LaboratoryAuthz const unused; FE unused; no role grants |
| **Certified / carry-forward** | PD-ART intent to wire `lms.reports.download`; PD-ART-13 no production grants |
| **Options** | **A.** Wire `lms.reports.download` · **B.** Create new permission · **C.** Reuse view · **D.** Reuse generate |
| **Recommended option** | **A** |
| **Rationale** | Least privilege; generate ≠ download; catalogue already exists — do not create a second code |
| **Security implications** | Prevents view-only users from downloading PHI PDF by default |
| **Operational implications** | Grants remain environment/ops concern (PD-DL-19) |
| **UX implications** | Separate unauthorized messaging from Generate |
| **Implementation implications** | Backend ForbidUnless + FE `useHasPermission` |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-05 — Tenant and branch authorization

| Field | Value |
| --- | --- |
| **Decision** | What authorization boundary applies at download time? |
| **Current repository evidence** | Report detail/generate: JWT tenant → permission → ValidateUserBranch → Report tenant load → `OperatingBranchId` match; CanonicalDocument `/content` routes do **not** enforce LMS branch |
| **Certified / carry-forward** | PD-ART §10/§12 tenant + operating branch |
| **Options** | **A.** LMS Report tenant + branch authorization · **B.** Tenant-only · **C.** Generic CanonicalDocument authorization · **D.** Other |
| **Recommended option** | **A** |
| **Rationale** | Must not rely on generic patient CanonicalDocument auth alone; preserves LMS branch isolation |
| **Security implications** | Prevents cross-branch IDOR via document id |
| **Operational implications** | Same `operatingBranchId` query/context as existing LMS Report APIs |
| **UX implications** | Consistent with worklist/detail branch context |
| **Implementation implications** | Eligibility path must include branch match + current artifact of that Report |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-06 — Download mechanism

| Field | Value |
| --- | --- |
| **Decision** | How are Official PDF bytes delivered to staff? |
| **Current repository evidence** | Auth CanonicalDocument staff pattern = JWT proxy stream; CCMS uses SAS; LMS has no download path |
| **Certified / carry-forward** | Staff-only; no public URLs (PD-ART-10 boundary) |
| **Options** | **A.** JWT authenticated proxy stream · **B.** Short-lived SAS · **C.** Existing MPI CanonicalDocument content route as-is · **D.** Hybrid one-time ticket |
| **Recommended option** | **A** |
| **Rationale** | Matches Auth PHI document pattern; no browser Blob URL; no SAS expiry/stale-link; Lab remains eligibility SoT |
| **Security implications** | Preferred; SAS increases URL leakage risk |
| **Operational implications** | Server-side stream through authenticated API |
| **UX implications** | FE blob fetch + download file |
| **Implementation implications** | New LMS download path; do not reuse MPI route as-is |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

**Preferred ownership under Option A (boundary approval — not implementation prescription):**

| Service | Responsibility |
| --- | --- |
| LaboratoryApi | Report eligibility, tenant/branch authz, permission, current-artifact validation, audit decision |
| AuthService | Private CanonicalDocument / Blob byte access |

Exact internal HTTP contract is an **implementation readiness** concern after Product Decision Closure.

---

### PD-DL-07 — Inline vs attachment

| Field | Value |
| --- | --- |
| **Decision** | Browser Content-Disposition behavior for staff Official PDF |
| **Current repository evidence** | Auth `File(..., fileName)` ≈ attachment; CCMS content uses inline |
| **Certified / carry-forward** | None specific for LMS download disposition |
| **Options** | **A.** Attachment · **B.** Inline browser PDF · **C.** Both |
| **Recommended option** | **A** |
| **Rationale** | Explicit staff document retrieval, not a patient-facing viewer |
| **Security implications** | Neutral; still JWT-gated |
| **Operational implications** | Files land in browser download folder with controlled name |
| **UX implications** | Clear “download” affordance |
| **Implementation implications** | Set disposition accordingly |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-08 — Filename

| Field | Value |
| --- | --- |
| **Decision** | Default download filename |
| **Current repository evidence** | B1 stores `{BusinessReportNumber}.pdf`; MRN not in stored LMS filename |
| **Certified / carry-forward** | Number is business identity (CUT A / PD-ART-11 for PDF body) |
| **Options** | **A.** Business Report Number · **B.** Report Number + MRN · **C.** Report Number + Patient Name · **D.** Other |
| **Recommended option** | **A** → `{BusinessReportNumber}.pdf` |
| **Rationale** | Matches B1 storage; minimizes PHI on shared workstations |
| **Security implications** | Do **not** include MRN, patient name, DOB, patient identifiers, tenant/branch identifiers in filename or URL |
| **Operational implications** | Predictable filing for staff |
| **UX implications** | Stable recognizable name |
| **Implementation implications** | Prefer stored CanonicalDocument filename / Report number |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-09 — Download audit

| Field | Value |
| --- | --- |
| **Decision** | Must staff Official PDF download be audited? |
| **Current repository evidence** | Generate audits exist; download action absent from allowlist; DocumentAccessAudit unused |
| **Certified / carry-forward** | PD-ART-09b access audit required; platform `audit_log` SoT |
| **Options** | **A.** Required dedicated audit · **B.** Best effort · **C.** No audit |
| **Recommended option** | **A** |
| **Rationale** | Official PDF is PHI-bearing staff document access |
| **Recommended action string** | `DOWNLOAD_OFFICIAL_PDF` (exact string confirmed at closure / readiness allowlist) |
| **Potential evidence** | actor, tenant, operating branch, report id, current artifact id, CanonicalDocument id, timestamp, success/failure as appropriate |
| **Security implications** | Required for accountable access |
| **Operational implications** | Allowlist + LaboratoryApi audit client |
| **UX implications** | None direct |
| **Implementation implications** | Do **not** revive DocumentAccessAudit as second LMS SoT |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-10 — Audit failure behavior

| Field | Value |
| --- | --- |
| **Decision** | If required audit cannot be written, may PDF bytes still be returned? |
| **Current repository evidence** | Release / Official PDF generate fail-closed audit patterns |
| **Certified / carry-forward** | PD-ART-09b = fail-closed |
| **Options** | **A.** Deny download · **B.** Allow download · **C.** Best effort |
| **Recommended option** | **A** |
| **Rationale** | Certified download audit principle; prevent unaudited PHI egress |
| **Security implications** | Fail-open would violate PD-ART-09b |
| **Operational implications** | Transient audit outage blocks download (honest) |
| **UX implications** | Controlled error; retry later |
| **Implementation implications** | Audit before (or atomically gated with) stream return |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-11 — Detail vs worklist

| Field | Value |
| --- | --- |
| **Decision** | Where is Download Official PDF available? |
| **Current repository evidence** | Detail has Official PDF panel (no download); worklist Actions = Open only; no artifact columns |
| **Certified / carry-forward** | PD-ART-09c = detail + worklist |
| **Options** | **A.** Detail only · **B.** Detail + worklist · **C.** Worklist only |
| **Recommended option** | **B** |
| **Rationale** | Honors PD-ART-09c; Download only when eligible; **do not** add Generate to worklist |
| **Security implications** | Eligibility projection required so actions are not shown unsafely |
| **Operational implications** | Worklist may need minimal artifact/eligibility fields (readiness) |
| **UX implications** | Faster retrieval from worklist for eligible rows |
| **Implementation implications** | Detail primary; worklist secondary gated affordance |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-12 — Missing artifact / content behavior

| Field | Value |
| --- | --- |
| **Decision** | Behavior when metadata/pointer exists but physical content cannot be served |
| **Current repository evidence** | No staff download path; platform content null/404 patterns |
| **Certified / carry-forward** | Clinical honesty; never fabricate clinical documents |
| **Options** | **A.** Honest 404 / controlled unavailable · **B.** Mask as permission error · **C.** Other |
| **Recommended option** | **A** |
| **Rationale** | Never fabricate success, empty PDF, silent fallback, Failed artifact download, or current-artifact bypass |
| **Security implications** | Masking as 403 can hide ops issues and confuse authz debugging |
| **Operational implications** | Clear signal for missing Blob/CanonicalDocument |
| **UX implications** | Honest error toast/message |
| **Implementation implications** | Exact HTTP mapping in readiness using LMS error conventions (PD-DL-20) |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-13 — Repeated downloads

| Field | Value |
| --- | --- |
| **Decision** | May the same staff user download the same Official PDF repeatedly? |
| **Current repository evidence** | No rate-limit on CanonicalDocument content endpoints |
| **Certified / carry-forward** | None requiring one-shot download |
| **Options** | **A.** Allow repeated downloads · **B.** Rate-limit · **C.** Require re-authentication each time |
| **Recommended option** | **A** |
| **Rationale** | Each access still authorized + audited; no new rate-limit policy in CUT C unless platform policy already requires it |
| **Security implications** | Bulk exfil mitigated by grants + audit, not one-shot tokens |
| **Operational implications** | Normal workstation re-download |
| **UX implications** | No artificial “already downloaded” lock |
| **Implementation implications** | Idempotent read; audit each access |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-14 — SAS expiry

| Field | Value |
| --- | --- |
| **Decision** | Signed URL expiry policy (only if SAS selected under PD-DL-06) |
| **Current repository evidence** | Auth CanonicalDocument does not mint SAS; CCMS ~1h SAS exists |
| **Certified / carry-forward** | None for LMS Official PDF SAS |
| **Options** | **A.** N/A — no SAS · **B.** SAS with explicit TTL · **C.** Other |
| **Recommended option** | **A** |
| **Rationale** | SAS not recommended (PD-DL-06 **A**). If PO selects SAS under PD-DL-06, **reopen PD-DL-14** and set explicit TTL before implementation |
| **Security implications** | Stale URL reuse if SAS chosen without tight TTL |
| **Operational implications** | N/A under recommendation |
| **UX implications** | N/A under recommendation |
| **Implementation implications** | Contingent |
| **Product Owner approval required** | **Only if SAS is selected** under PD-DL-06 |
| **Product Owner selection** | |

---

### PD-DL-15 — Historical artifact access

| Field | Value |
| --- | --- |
| **Decision** | Is historical Official PDF download in CUT C scope? |
| **Current repository evidence** | Prior versions retained; not listed; PD-ART-09 current official |
| **Certified / carry-forward** | PD-ART-09; regeneration retains prior (PD-ART-05b / PD-PDF-15) |
| **Options** | **A.** Out of CUT C · **B.** History list + download · **C.** Admin-only historical download |
| **Recommended option** | **A** |
| **Rationale** | Separate product slice if needed later; avoids IDOR/scope creep |
| **Security implications** | Lower attack surface |
| **Operational implications** | Bytes remain stored for future governed access |
| **UX implications** | No history browser in CUT C |
| **Implementation implications** | No history API in CUT C |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-16 — Retention

| Field | Value |
| --- | --- |
| **Decision** | Does CUT C introduce LMS-specific retention enforcement? |
| **Current repository evidence** | PD-PDF-19 deferred; no CanonicalDocument retention-days engine for LMS Official PDF |
| **Certified / carry-forward** | PD-PDF-19 deferred |
| **Options** | **A.** Defer · **B.** Enforce a new duration · **C.** Introduce soft-delete/download rules now |
| **Recommended option** | **A** |
| **Rationale** | Do not invent retention; if physical content missing, fail honestly (PD-DL-12) |
| **Security implications** | Neutral if deferred |
| **Operational implications** | Existing storage lifecycle continues |
| **UX implications** | Missing content → honest failure |
| **Implementation implications** | No retention engine in CUT C |
| **Product Owner approval required** | **Yes** (especially if selecting B/C) |
| **Product Owner selection** | |

---

### PD-DL-17 — Admin wildcard

| Field | Value |
| --- | --- |
| **Decision** | Does Admin/SuperAdmin `*` continue to satisfy download permission checks? |
| **Current repository evidence** | Auth JWT `*`; LaboratoryAuthz treats `*` as unrestricted; FE permission-cache same |
| **Certified / carry-forward** | Platform wildcard semantics (broader than LMS) |
| **Options** | **A.** Preserve wildcard · **B.** Exclude download from wildcard · **C.** Other |
| **Recommended option** | **A** |
| **Rationale** | Changing wildcard is a platform-wide security change, not a CUT C-local tweak |
| **Security implications** | Admins retain broad access (existing) |
| **Operational implications** | Unchanged admin behavior |
| **UX implications** | Admin sees Download if UI uses standard permission helpers |
| **Implementation implications** | No special-case for download |
| **Product Owner approval required** | **Only if changing existing platform semantics** (selecting B/C) |
| **Product Owner selection** | |

---

### PD-DL-18 — Service ownership

| Field | Value |
| --- | --- |
| **Decision** | Who owns eligibility vs physical byte access? |
| **Current repository evidence** | Lab owns Report/artifact/branch; Auth owns CanonicalDocument/Blob; internal API is register (write) only today |
| **Certified / carry-forward** | LaboratoryApi SoT; CanonicalDocument downstream (PD-ART-07 / PD-PDF-17) |
| **Options** | **A.** Auth content route + Lab eligibility · **B.** Lab download API + Auth internal byte-read contract · **C.** Hybrid ticket · **D.** Other |
| **Recommended option** | **A conceptually** — Product Decision approves the **ownership boundary**, not undocumented wire details |
| **Ownership boundary to approve** | LaboratoryApi = Report/artifact eligibility + tenant/branch authorization; AuthService = CanonicalDocument/Blob byte access; CanonicalDocument ≠ LMS Report SoT; Pathology ≠ SoT |
| **Rationale** | Preserves discovery SoT separation; exact internal contract finalized in implementation readiness |
| **Security implications** | Prevents Pathology/MPI permission confusion |
| **Operational implications** | Cross-service contract needed for byte open |
| **UX implications** | Single staff download action in portal |
| **Implementation implications** | Readiness chooses concrete Option A/B shape under approved boundary |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-19 — Production / UAT role grants

| Field | Value |
| --- | --- |
| **Decision** | Are production role grants for `lms.reports.download` added in source seeders? |
| **Current repository evidence** | No `lms.reports.*` RolePermission seed inserts; B1 used environment-only Lab Manager generate grant for UAT |
| **Certified / carry-forward** | PD-ART-13 = no production role grants |
| **Options** | **A.** No production seeder grants · **B.** Seed grants · **C.** Other |
| **Recommended option** | **A** |
| **Rationale** | Preserve established LMS pattern; environment-specific UAT access may be configured operationally after implementation authorization |
| **Security implications** | Avoid shipping broad grants in source |
| **Operational implications** | Ops/UAT grant process after authorization |
| **UX implications** | UAT actors need ops grant to exercise Download |
| **Implementation implications** | Catalogue + wiring only in code; no RolePermission seed |
| **Product Owner approval required** | **Yes** |
| **Product Owner selection** | |

---

### PD-DL-20 — Error contract

| Field | Value |
| --- | --- |
| **Decision** | Error code family for download denials / failures |
| **Current repository evidence** | LMS uses `invalid_state`, `branch_unauthorized`, `report_number_required`, etc. |
| **Certified / carry-forward** | Existing LMS Report error conventions |
| **Options** | **A.** Reuse LMS Report error family · **B.** New download-specific family · **C.** Other |
| **Recommended option** | **A** |
| **Rationale** | Avoid inventing a large new taxonomy; exact HTTP mapping is readiness-technical unless user-visible business behavior changes |
| **Security implications** | Prefer not masking content-missing as permission errors (see PD-DL-12) |
| **Operational implications** | Consistent logs/FE handling |
| **UX implications** | Familiar LMS error messaging patterns |
| **Implementation implications** | Technical / implementation-readiness confirmation |
| **Product Owner approval required** | Light — only if changing user-visible business meaning |
| **Status** | **TECHNICAL** / implementation-readiness confirmation |
| **Product Owner selection** | |

---

## 11. Recommended decision summary (not approved)

| ID | Recommended |
| --- | --- |
| PD-DL-01 | **B** — Released + numbered + current Succeeded artifact |
| PD-DL-02 | **A** — Business Report Number required |
| PD-DL-03 | **A** — Current Official PDF only |
| PD-DL-04 | **A** — Wire `lms.reports.download` |
| PD-DL-05 | **A** — LMS Report tenant + branch authorization |
| PD-DL-06 | **A** — JWT authenticated proxy stream (no SAS) |
| PD-DL-07 | **A** — Attachment |
| PD-DL-08 | **A** — `{BusinessReportNumber}.pdf` (no MRN/name in filename/URL) |
| PD-DL-09 | **A** — Required dedicated audit (`DOWNLOAD_OFFICIAL_PDF`) |
| PD-DL-10 | **A** — Fail closed (deny if audit fails) |
| PD-DL-11 | **B** — Detail + worklist (eligible only; no Generate on worklist) |
| PD-DL-12 | **A** — Honest controlled failure |
| PD-DL-13 | **A** — Allow repeated downloads (each audited) |
| PD-DL-14 | **A** — N/A (no SAS); reopen if PD-DL-06 chooses SAS |
| PD-DL-15 | **A** — Historical access out of CUT C |
| PD-DL-16 | **A** — Defer retention enforcement |
| PD-DL-17 | **A** — Preserve platform wildcard |
| PD-DL-18 | Ownership boundary: Lab eligibility/authz · Auth bytes (**A conceptually**) |
| PD-DL-19 | **A** — No production seeder grants |
| PD-DL-20 | **A** — Reuse LMS Report error family (technical confirm) |

---

## 12. Candidate CUT C implementation boundary (after Decision Closure — not authorized now)

**If** Product Owner approves the recommended set (or an equivalently closed set), candidate scope for a **future** readiness/implementation authorization may include:

1. Wire `lms.reports.download` backend authorization  
2. Add secure staff download endpoint/path  
3. Preserve LaboratoryApi Report/artifact/branch eligibility  
4. Securely retrieve CanonicalDocument/Blob bytes  
5. Add `DOWNLOAD_OFFICIAL_PDF` audit allowlist/action  
6. Fail closed on required audit failure  
7. Add Report Detail **Download Official PDF** action  
8. Add Reports Worklist Download action if PD-DL-11 = B  
9. Use Business Report Number filename  
10. Automated authorization / security / content tests  
11. Manual UAT  

### Explicitly exclude

| Excluded |
| --- |
| PDF generation / renderer changes |
| Artifact regeneration semantics changes |
| Report Release / Report Number / ReportVersion / Results |
| Patient Portal / Patient 360 / Notifications |
| Pathology association reuse / dual-write |
| Historical artifact browser (unless PD-DL-15 expands) |
| Retention implementation |
| Amendments / Unrelease / Revoke |
| SAS unless PD-DL-06/14 explicitly select SAS |
| Production role grants unless PD-DL-19 explicitly approves |

This section does **not** authorize readiness audit execution or coding.

---

## 13. Risks if recommendations rejected

| If PO selects… | Risk |
| --- | --- |
| PD-DL-06 **B** (SAS) without PD-DL-14 TTL | Stale signed URL / Blob exposure |
| PD-DL-05 **C** (generic CanonicalDocument only) | Cross-branch IDOR |
| PD-DL-04 **C/D** (reuse view/generate) | Over-broad download access |
| PD-DL-10 **B/C** (fail-open audit) | Unaudited PHI egress — conflicts with PD-ART-09b |
| PD-DL-03/15 historical in CUT C | Scope + IDOR without history API design |
| PD-DL-08 **B/C** (MRN/name in filename) | PHI on shared download folders |

---

## 14. Dependencies

```text
ACCEPTED_L_REP_02B
        ↓
ACCEPTED_L_REP_03_CUT_A
        ↓
ACCEPTED_L_REP_03_CUT_B
        ↓
Staff Download discovery (complete)
        ↓
THIS PACKAGE — Product Decision Review
        ↓
PRODUCT_DECISION_CLOSURE  ← NEXT GATE (Product Owner)
        ↓
[future] Implementation readiness audit
        ↓
[future] CUT C implementation
```

---

## 15. What Product Owner must do next

1. Review PD-DL-01 … PD-DL-20.  
2. Stamp selections in a **separate Product Decision Closure** (not this document).  
3. Explicitly confirm PD-DL-01/02 refinement vs narrower PD-ART-08 wording.  
4. Do **not** treat recommendations herein as approved.  
5. Do **not** start implementation readiness until Decision Closure authorizes that next gate.

---

## Final stamps

```text
PRODUCT_DECISION_REVIEW_COMPLETE

NO_IMPLEMENTATION_STARTED

ACCEPTED_L_REP_02B_REMAINS_ACCEPTED

ACCEPTED_L_REP_03_CUT_A

ACCEPTED_L_REP_03_CUT_B

CUT_C_NOT_STARTED

PRODUCT_OWNER_DECISION_REQUIRED

CONFIGURATION_GATE_PENDING

NEXT_GATE = PRODUCT_DECISION_CLOSURE

STOP
```

**Not stamped:** `PRODUCT_DECISIONS_CLOSED` · `IMPLEMENTATION_AUTHORIZED` · `IMPLEMENTATION_COMPLETE` · `MANUAL_UAT_PASSED` · `ACCEPTED_L_REP_03_CUT_C`

**STOP.** Do not implement CUT C. Do not create Product Decision Closure in this task. Do not start implementation readiness.
