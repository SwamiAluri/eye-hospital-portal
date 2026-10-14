# L-REP-03 — Report Number + Official PDF Artifact + Staff Download  
# Product Decision Closure

**Date:** 2026-10-12  
**Slice:** L-REP-03 (Report Number + Official PDF Artifact + Staff Download Foundation)  
**Mode:** PRODUCT DECISION CLOSURE — documentation / Product Owner approval only  

**This task does not implement L-REP-03.**  
No application source, schema, migrations, APIs, DTOs, services, UI, routes, PDF generation, Report numbering, downloads, CanonicalDocument association for LmsReport, permission seed/grant changes, audit allowlist changes, ResultStatus changes, L-AUTH / L-VER / L-TST / L-CRT, Collection / Specimen / Orders, Pathology, Patient Portal / Patient 360, NotificationHub, Amendments, Unrelease/Revoke, or L-REP-02B Release semantics changes are authorized **in this task**.

---

## 1. Purpose

Formally close Product Owner decisions for the first post–L-REP-02B Report capability cluster:

1. Business Report Number  
2. Official PDF / document artifact  
3. Staff download  

Authorize a **future separate** implementation readiness audit and implementation task for **L-REP-03** only, under the stamped rules herein.

Explicitly preserve certified L-REP-01, L-REP-02A, and L-REP-02B.  
**Do not** convert metadata Release into automatic PDF generation.

---

## 2. Status

```text
PRODUCT_OWNER_DECISIONS_APPROVED
PRODUCT_DECISION_CLOSURE_COMPLETE
PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED
IMPLEMENTATION_NOT_STARTED
CONFIGURATION_REQUIRED = YES
```

| Field | Value |
| --- | --- |
| Mode | PRODUCT DECISION CLOSURE |
| Closure stamp | `PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED` |
| Implementation | `IMPLEMENTATION_NOT_STARTED` |
| Configuration gate | `CONFIGURATION_REQUIRED = YES` |
| Next gate | `IMPLEMENTATION_READINESS_AUDIT` |

This stamp does **not** mean `IMPLEMENTATION_COMPLETE`, `PRE_UAT_READY`, `UAT_READY`, `UAT_PASSED`, or `ACCEPTED`.

**This document authorizes a future separate implementation readiness audit and implementation task; it does not itself authorize Cursor to modify application code in this task.**

---

## 3. Authority

Product Owner has **explicitly approved** the PD-ART decisions listed in §6, provided **outside Cursor**, against:

- [enterprise-lms-report-artifact-numbering-download-decision-package.md](./enterprise-lms-report-artifact-numbering-download-decision-package.md)  
- [enterprise-lms-post-release-report-lifecycle-discovery.md](./enterprise-lms-post-release-report-lifecycle-discovery.md)  
- Certified L-REP-01 / L-REP-02A / L-REP-02B baselines  

| Class | Meaning |
| --- | --- |
| **APPROVED** | Product Owner stamped for L-REP-03 |
| **CARRIED FORWARD** | Upstream certified principle preserved |
| **OUT_OF_SCOPE** | Explicitly outside L-REP-03 |
| **CONFIGURATION_REQUIRED** | Governed configuration must exist before go-live of the dependent capability |

Certified upstream L-REP-01, L-REP-02A, and L-REP-02B decisions are **not reopened**.

---

## 4. Upstream references

| Document | Role | Stamp |
| --- | --- | --- |
| [enterprise-lms-reporting-decision-closure.md](./enterprise-lms-reporting-decision-closure.md) | L-REP-01 principles | `PRODUCT_DECISIONS_CLOSED_L_REP_01_AUTHORIZED` |
| [enterprise-lms-report-finalize-decision-closure.md](./enterprise-lms-report-finalize-decision-closure.md) | L-REP-02A Finalize | `PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED` |
| [enterprise-lms-report-finalization-acceptance-closure.md](./enterprise-lms-report-finalization-acceptance-closure.md) | Accepted Finalize | `ACCEPTED_L_REP_02A` |
| [enterprise-lms-report-release-decision-closure.md](./enterprise-lms-report-release-decision-closure.md) | Metadata Release decisions | `PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED` |
| [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | Accepted Release | `ACCEPTED_L_REP_02B` |
| [enterprise-lms-post-release-report-lifecycle-discovery.md](./enterprise-lms-post-release-report-lifecycle-discovery.md) | Post-Release discovery | `DISCOVERY_COMPLETE` |
| [enterprise-lms-report-artifact-numbering-download-decision-package.md](./enterprise-lms-report-artifact-numbering-download-decision-package.md) | PD-ART decision package | Superseded for stamped items by **this** closure |

```text
L-REP-01 Report Foundation (certified)
  ↓
L-REP-02A Finalize (ACCEPTED_L_REP_02A)
  ↓
L-REP-02B Release metadata (ACCEPTED_L_REP_02B)  ← UNCHANGED
  ↓
Post-Release discovery + Artifact/Numbering/Download Decision Package
  ↓
PD-ART-* (THIS DOCUMENT) ← PRODUCT OWNER APPROVED (outside Cursor)
  ↓
L-REP-03 — Report Number + Official PDF Artifact + Staff Download
  ← AUTHORIZED FOR SEPARATE FUTURE IMPLEMENTATION READINESS AUDIT
  ← NOT IMPLEMENTED BY THIS DOCUMENT
```

---

## 5. Certified baseline

### Lifecycle (unchanged)

```text
Draft → Final → Released
```

### L-REP-02B Release (immutable — do not reinterpret)

Release remains **metadata only**:

| Does | Does **not** |
| --- | --- |
| `Report.Status` Final → Released | Generate PDF / document bytes |
| Persist `ReleasedAtUtc` / `ReleasedByUserId` | Assign business Report Number |
| Keep existing current ReportVersion | Create CanonicalDocument association |
| Preserve snapshots + source claims | Download / publish / notify |
| Leave ResultStatus / ResultVersion / CriticalResultEvent unchanged | Amend / Unrelease / Revoke |

**L-REP-03 must not silently convert Release into automatic PDF generation.**  
**No automatic Release → PDF side effect is authorized.**

### Four distinct concerns

| # | Concern | Owner slice |
| --- | --- | --- |
| 1 | Release (metadata) | L-REP-02B — **complete / accepted** |
| 2 | Report Number assignment | L-REP-03 — post-Release governed operation |
| 3 | PDF / artifact generation | L-REP-03 — explicit staff action |
| 4 | Staff download | L-REP-03 — after artifact available |

---

## 6. Product Owner decision matrix

All selections below are **APPROVED**.

| ID | Topic | Approved | Resulting rule |
| --- | --- | --- | --- |
| **PD-ART-01** | Business Report Number required | **A** | Business Report Number **is required** |
| **PD-ART-02** | Assignment timing | **B** | Assigned in relation to **Released** (see §7 interpretation) |
| **PD-ART-02b** | Immutability | **A** | Report Number is **immutable** once assigned |
| **PD-ART-02c** | Identity target | **A** | Identifies the **Report aggregate** (not ReportVersion) |
| **PD-ART-02d** | Number then PDF fails | **A** | **Retain** number; permit governed PDF retry |
| **PD-ART-02e** | UI visibility | **B** | Number visible only when Status = **Released** (and assigned) |
| **PD-ART-03** | Sequence scope | **B** | Scope is **OPERATING BRANCH** — not tenant |
| **PD-ART-03b** | Gaps / reuse | **A** | Gaps **allowed**; reuse **forbidden** |
| **PD-ART-04** | PDF eligibility | **A** | **Released only** |
| **PD-ART-05** | Generation mode | **B** | Explicit staff action; **asynchronous** |
| **PD-ART-05b** | Regeneration | **C** | May regenerate as **new artifact version** when template/branding changes; prior versions **retained** |
| **PD-ART-06** | Template ownership | **A** | **Tenant-level** governed configuration |
| **PD-ART-06b** | Signatory | **C** | **Configured laboratory signatory** |
| **PD-ART-07** | Storage | **A** | **CanonicalDocument + Blob** downstream store |
| **PD-ART-08** | Download eligibility | **A** | **Released** + available artifact |
| **PD-ART-09** | Authoritative artifact | **A** | One **current official** authoritative artifact |
| **PD-ART-09b** | Download audit | **A** | Audit access; **fail-closed** if required audit write fails |
| **PD-ART-09c** | Download surfaces | **B** | Report **detail** + Reports **worklist** |
| **PD-ART-10** | Patient download | **A** | Explicitly **OUT OF SCOPE** |
| **PD-ART-11** | PDF displays number | **A** | Official PDF **MUST** display business Report Number |
| **PD-ART-12** | Packaging | **C** | Numbering + PDF/artifact = **one bounded capability**; then staff download |
| **PD-ART-13** | Role grants | **A** | **No** production role grants |

### Future capabilities (OUT OF SCOPE) — confirmed

| ID | Capability | Status |
| --- | --- | --- |
| F01 | Patient Portal publication | **OUT** |
| F02 | Patient 360 publication / discovery | **OUT** |
| F03 | Notifications (incl. NotificationHub / SMS / email / WhatsApp) | **OUT** |
| F04 | Amendments | **OUT** |
| F05 | Unrelease / Revoke | **OUT** |
| F06 | Analytics | **OUT** |
| F07 | Pathology migration / dual-write | **OUT** |

**Decision count verified in this closure:** PD-ART-01 … PD-ART-13 inclusive (including 02b/02c/02d/02e/03b/05b/06b/09b/09c) = **22 approved decision rows** + **7 future OUT confirmations (F01–F07)**.

---

## 7. Approved lifecycle

```text
Draft
  → Final          (L-REP-02A — accepted; unchanged)
  → Released       (L-REP-02B — accepted; metadata only; unchanged)
       ↓
  [L-REP-03 — separate post-Release operations]
  Assign business Report Number   (governed; operating-branch sequence)
       ↓
  Explicit staff request → async official PDF generation
       ↓
  Artifact stored (CanonicalDocument + Blob); current official marked
       ↓
  Staff download (detail + worklist) with fail-closed audit
```

### Critical interpretation — PD-ART-02 vs L-REP-02B Release transaction

Product Owner stamped **PD-ART-02 = B** (“assigned at Released”).

**Closure interpretation (safest, consistent with approved packaging and L-REP-02B immutability):**

1. **L-REP-02B Release API / transaction remains unchanged** and does **not** assign a Report Number and does **not** generate PDF.  
2. Report Number assignment is a **separate governed L-REP-03 operation** that is **eligible only when `Report.Status == Released`**.  
3. “Assigned at Released” means **timing/eligibility relative to the Released state**, not “inside the existing Release mutation.”  
4. Numbering + PDF/artifact remain **one bounded L-REP-03 capability** (PD-ART-12 = C); download follows once an artifact exists.  
5. Because PD-ART-11 requires the PDF to display the Report Number, PDF generation must **not** complete as official without an assigned number. Number may be assigned immediately before or as a prerequisite step of the first official generation request — still **not** inside L-REP-02B Release.  
6. If number is assigned and PDF later fails: **retain number**; allow governed retry (PD-ART-02d = A).

**No further Product Owner decision is invented here.**  
If implementation readiness audit finds that “assign inside Release transaction” was intended instead of “eligible after Released,” it must **stop and escalate** — it must **not** silently modify L-REP-02B.

---

## 8. Report Number semantics

| Rule | Value |
| --- | --- |
| Required | Yes (PD-ART-01 = A) |
| Technical identity | Report **GUID remains** immutable technical identity (carried forward from PD-REP-02B-23) |
| Business identity | Separate business Report Number attribute on the **Report aggregate** |
| Eligibility | Only when `Status == Released` |
| Assignment mechanism | Separate governed L-REP-03 operation — **not** L-REP-02B Release |
| Immutability | Immutable once assigned (PD-ART-02b = A) |
| Scope | **Operating branch** sequence (PD-ART-03 = B) — **do not substitute tenant scope** |
| Gaps | Allowed (PD-ART-03b = A) |
| Reuse | Forbidden (PD-ART-03b = A) |
| UI visibility | Visible only when Released (and assigned) (PD-ART-02e = B) |
| Forbidden sources | Order number, Accession number, Barcode number must **not** become Report Numbers |
| Format / prefix / width / reset | **CONFIGURATION_REQUIRED** — values **not invented** by this closure |
| Concurrency | Allocation must be race-safe for the operating-branch sequence |
| PDF failure after assign | Keep number; retry PDF (PD-ART-02d = A) |
| Never Released | Number must **not** be assigned (ineligible) |

Existing LMS sequences (order / accession / barcode / collection-task) are **technical reference only** for concurrency patterns — not product format or scope policy for Report Numbers.

---

## 9. PDF artifact semantics

| Rule | Value |
| --- | --- |
| Eligibility | **Released only** (PD-ART-04 = A) |
| Trigger | **Explicit staff action** — not automatic on Release (PD-ART-05 = B) |
| Execution | **Asynchronous** (PD-ART-05 = B) |
| Content source | Immutable current **ReportVersion** snapshot + sources |
| Report Number on PDF | **Required** (PD-ART-11 = A) |
| Template | Tenant-level governed configuration (PD-ART-06 = A) |
| Signatory on PDF | Configured laboratory signatory (PD-ART-06b = C) |
| Storage | CanonicalDocument + Blob downstream (PD-ART-07 = A) |
| Clinical SoT | Remains `LmsReport` / `LmsReportVersion` — CanonicalDocument is **not** clinical SoT (PD-REP-25 / AD-REP-05) |
| Regeneration | New artifact version when template/branding changes; prior artifacts **retained** (PD-ART-05b = C) |
| Authoritative artifact | Exactly one **current official** artifact (PD-ART-09 = A) |
| Failure | Must **not** change Report.Status; must **not** clear assigned Report Number; honest failure; retry allowed |
| Pathology | Must **not** reuse LabReport attach as LMS SoT |

Effective template version / branding identity used for each artifact generation must be **recorded** with the artifact (identity mechanism is an implementation concern; values are configuration-owned).

---

## 10. Download semantics

| Rule | Value |
| --- | --- |
| Audience | **Staff only** |
| Patient download | **OUT OF SCOPE** (PD-ART-10 = A) |
| Eligibility | `Status == Released` **and** an available artifact (PD-ART-08 = A) |
| Artifact selection | Current official authoritative artifact (PD-ART-09 = A) |
| Surfaces | Report detail **and** Reports worklist (PD-ART-09c = B) |
| Authorization | Tenant + operating-branch patterns carried forward; Report.OperatingBranchId match |
| Permission capability | Wire existing catalogue intent `lms.reports.download` (see §12) |
| Audit | Access must be audited; **fail-closed** if required audit write fails (PD-ART-09b = A) |
| Publication | Download ≠ Patient Portal / Patient 360 publication |

---

## 11. Configuration gate

```text
CONFIGURATION_REQUIRED = YES
```

L-REP-03 implementation **must not invent** missing configuration values. If required configuration is absent at readiness/go-live, implementation must report `CONFIGURATION_REQUIRED` and stop that dependency path.

### Required configuration (minimum)

| Configuration | Scope / notes | Repository status |
| --- | --- | --- |
| Report PDF template (tenant-level) | PD-ART-06 = A; effective template version identity | **Not found** for LMS Reports — **prerequisite** |
| Laboratory signatory (configured) | PD-ART-06b = C; identity used on PDF | **Not found** for LMS Reports — **prerequisite** |
| Operating-branch Report Number sequence | PD-ART-03 = B | **Not found** (no Report number sequence) — **prerequisite** |
| Numbering format / prefix / width / reset period | PD-REP-13; values not invented here | **Absent** — **prerequisite** |
| Artifact ↔ template version identity recording | Required for PD-ART-05b regeneration honesty | **Prerequisite** (mechanism TBD in audit) |
| Retention duration | PD-REP-23 — only if retention enforcement is required for stored artifacts | **CONFIGURATION_REQUIRED when duration needed**; do not invent duration |

### Existing infrastructure that may be reused (reference only)

| Capability | Reuse posture |
| --- | --- |
| LMS number-sequence concurrency patterns (order/accession/barcode) | Technical pattern for race-safe allocation — **not** Report format/scope |
| CanonicalDocument + BlobStorage + identity/hash services | Downstream byte store (PD-ART-07) — **not** clinical SoT; LMS association model is new |
| QuestPDF elsewhere in AuthService | Technology reference only — AD-REP-06: do not hard-code renderer into clinical SoT |
| Catalogue comment/consent template refs on other LMS entities | Not Report PDF template configuration |

**No existing LMS Report PDF template or laboratory-signatory configuration store was found.** Treat as configuration prerequisites, not invent fallback templates/signatories.

---

## 12. Security model

| Control | Requirement |
| --- | --- |
| Tenant isolation | JWT tenant must own the Report; no cross-tenant access |
| Operating branch isolation | Actor authorized for Report.OperatingBranchId; ValidateUserBranch pattern |
| Report ownership of branch | Mutations/reads for L-REP-03 require branch match |
| Staff-only | No patient download / portal publication in L-REP-03 |
| Role grants | **None** (PD-ART-13 = A) |
| Immutable Released content | ReportVersion snapshots remain immutable; PDF does not rewrite clinical snapshots |
| Immutable Report Number | No reassignment / reuse |
| Artifact integrity | Current official pointer must be unambiguous; retained prior versions not silently deleted |
| Pathology boundary | No dual-write / bridge / LabReport SoT substitution |

### Permission capabilities (intended — catalogue codes for audit verification)

Implementation readiness audit must verify / propose catalogue codes consistent with existing `lms.reports.*` conventions in `EnterpriseLmsReportsPermissionCatalog` / `LaboratoryAuthz`.

| Capability | Existing / intended |
| --- | --- |
| View Reports | Existing: `lms.reports.view` |
| Manage Drafts | Existing: `lms.reports.manage` |
| Finalize | Existing: `lms.reports.finalize` |
| Release | Existing: `lms.reports.release` |
| Download official artifact | Existing catalogue: `lms.reports.download` — **wire in L-REP-03** |
| Assign Report Number | **Capability required** — exact code to be confirmed in readiness audit (must follow `lms.reports.*` family; no role grants) |
| Generate official PDF artifact | **Capability required** — exact code to be confirmed in readiness audit (may be distinct from download; no role grants) |

This closure does **not** seed permissions or invent final new code strings beyond documenting required capabilities.  
`lms.reports.publish` remains **not authorized**.

---

## 13. Audit model

| Principle | Requirement |
| --- | --- |
| Audit SoT | Platform `audit_log` only (PD-REP-20) |
| Fail-closed | Governed mutations and download access (per PD-ART-09b) fail closed on required audit write failure |
| Number assignment | Must emit a dedicated audit action (name finalized in readiness audit / allowlist task) |
| PDF generation | Must emit a dedicated audit action (success/failure honesty) |
| Download | Must emit access audit; deny download if audit write fails |
| Forbidden | Second independent audit store; best-effort download when audit required |

Exact action string allowlisting is **implementation work**, not performed by this closure.

---

## 14. Idempotency / concurrency requirements

| Concern | Requirement |
| --- | --- |
| Report Number allocation | Exactly-once assignment per Report aggregate; concurrent assign → one success; reuse forbidden |
| Sequence concurrency | Race-safe operating-branch sequence allocation |
| PDF generation | Operation-specific idempotency for generate requests; concurrent generates must not create ambiguous “current official” without policy |
| Regeneration | Creates new artifact version; updates current official pointer under governed rules; retains prior versions |
| Download | Non-mutating relative to Report clinical state; still audit-gated |
| Optimistic concurrency | Continue RowVersion / expectedRowVersion patterns for Report mutations that change Report aggregate fields |
| Release concurrency | L-REP-02B semantics unchanged |

---

## 15. Data ownership

| Data | Owner / SoT |
| --- | --- |
| Report clinical aggregate / versions / claims | LaboratoryApi `LmsReport` / `LmsReportVersion` / sources / claims |
| Report Status lifecycle Draft/Final/Released | LaboratoryApi Report domain |
| Business Report Number | LaboratoryApi Report aggregate attribute (L-REP-03) |
| Official PDF bytes | CanonicalDocument + Blob (downstream) associated to LMS Report/ReportVersion |
| Template / signatory configuration | Tenant-level governed configuration (store TBD — prerequisite) |
| Pathology LabReport | AuthService — **separate**; not LMS SoT |
| ResultStatus / ResultVersion / CriticalResultEvent | Unchanged by L-REP-03 |

---

## 16. API boundary

**Authorized for future L-REP-03 implementation (shapes illustrative; contracts finalized in readiness audit):**

| Concern | Boundary |
| --- | --- |
| Assign Report Number | LaboratoryApi LMS Reports API — post-Release only |
| Request official PDF generation | LaboratoryApi LMS Reports API — explicit; async job/status |
| Query artifact status / current official | LaboratoryApi LMS Reports API |
| Staff download | Authorized stream/download endpoint enforcing Released + artifact + `lms.reports.download` |
| L-REP-02B `POST …/release` | **Unchanged** — no number, no PDF |

**Not authorized:** patient download APIs; publish APIs; NotificationHub emission from Release/PDF; Pathology LabReport dual-write.

---

## 17. UI boundary

| Surface | L-REP-03 expectation |
| --- | --- |
| Report detail | Show Report Number when Released+assigned; explicit Generate Official PDF action; download when artifact ready; no auto-PDF on Release |
| Reports worklist | Download when eligible (PD-ART-09c = B); status honesty |
| Release confirmation | Remains L-REP-02B metadata honesty (no PDF/number claims) |
| Patient Portal / Patient 360 | No L-REP-03 publication UI |
| Pathology Laboratory workbench | Unchanged; not LMS Reports |

---

## 18. Storage boundary

| Store | Role |
| --- | --- |
| Laboratory DB (`lms_reports`, versions, claims, future number/sequence tables) | Clinical Report SoT + number + sequence |
| CanonicalDocument + associations | Downstream document identity for official artifacts |
| Blob storage | Bytes |
| Forbidden | CanonicalDocument becoming Report clinical SoT; replacing LmsReport with LabReport documents |

Association domain/entity keys for LMS Reports are **new** relative to Pathology `LabReport` associations and must be designed in readiness audit without colliding SoT.

---

## 19. Explicit implementation scope

### Slice name

**L-REP-03 — Report Number + Official PDF Artifact + Staff Download Foundation**

### In scope for future implementation

**A. Report Number**

- Operating-branch scoped sequence (PD-ART-03 = B)  
- Assigned only after Released via separate governed operation  
- Immutable; gaps allowed; reuse forbidden  
- Identifies Report aggregate  
- Visible only when Released  
- Concurrency-safe  
- Format/config from governed configuration (not invented)

**B. Official PDF Artifact**

- Released only  
- Explicit staff action; asynchronous  
- Tenant-level template + configured laboratory signatory  
- PDF contains Report Number  
- Stored via CanonicalDocument + Blob  
- Artifact versioning; prior versions retained on regeneration  
- Clear current official authoritative artifact  
- Does not alter Report.Status or clinical snapshots on failure  

**C. Staff Download**

- Released + artifact required  
- Staff only  
- Report detail + worklist  
- Audited; fail-closed on audit write failure  
- Uses `lms.reports.download` catalogue intent  

---

## 20. Explicit out-of-scope list

- Patient download  
- Patient Portal publication  
- Patient 360 publication / discovery  
- NotificationHub / SMS / email / WhatsApp  
- Amendments  
- Unrelease / Revoke  
- Analytics / Reporting KPIs  
- Automatic PDF on Release  
- Automatic notifications  
- Pathology migration / dual-write / bridge  
- Production role grants  
- Report content clinical redesign / interpretation  
- Result lifecycle changes  
- Report lifecycle state machine changes beyond adding number/artifact/download capabilities  
- Retroactive mutation of L-REP-02B Release semantics  
- Inventing numbering format or template/signatory defaults  

---

## 21. Regression boundaries

Future L-REP-03 work must preserve:

| Area | Boundary |
| --- | --- |
| L-REP-01 Draft foundation + source uniqueness | Unchanged |
| L-REP-02A Finalize | Remains accepted / unchanged |
| L-REP-02B Release | Remains accepted metadata-only / unchanged |
| ResultStatus / ResultVersion / CriticalResultEvent | Unchanged by number/PDF/download |
| L-TST / L-VER / L-AUTH / L-CRT | Unchanged |
| Orders / Collection / Specimen / Receiving / Barcode | Unchanged |
| Legacy Pathology | Unchanged |
| Source claims through Released | Unchanged until future Amendment policy |

---

## 22. UAT requirements

Manual UAT (after implementation + PRE-UAT) must demonstrate at minimum:

1. Released Report without number → number assign succeeds (branch-scoped).  
2. Draft/Final cannot receive number or official PDF.  
3. Release action still does **not** create PDF or number.  
4. Explicit Generate Official PDF queues/completes asynchronously.  
5. Official PDF displays business Report Number.  
6. PDF uses configured template + laboratory signatory (configured environment).  
7. PDF failure retains number; retry succeeds.  
8. Regeneration creates new artifact version; prior retained; current official clear.  
9. Staff download from detail and worklist when Released + artifact present.  
10. Download denied without permission / wrong branch / missing artifact.  
11. Download denied when required audit write fails (fail-closed).  
12. Patient download / Portal / 360 / notify / amend / unrelease absent.  
13. No production role grants introduced.  
14. Concurrent number allocation does not reuse numbers.

---

## 23. Acceptance criteria

L-REP-03 may be accepted only when:

| Criterion | Required |
| --- | --- |
| Product Decision Closure | This document stamped |
| Configuration prerequisites | Satisfied for template, signatory, numbering format/sequence |
| Implementation + PRE-UAT | Documented evidence |
| Manual UAT | Passed against §22 |
| L-REP-02B regression | Release remains metadata-only |
| Boundaries | Out-of-scope items absent |
| Security | Tenant/branch; no role grants; fail-closed audit on download |

Acceptance of L-REP-03 is **not** claimed by this closure.

---

## 24. Non-claims

This closure task:

- Did **not** modify backend, frontend, schema, migrations, APIs, UI, permissions, role grants, storage, PDF, numbering, or download behavior  
- Did **not** create CanonicalDocument associations for LmsReport  
- Did **not** change L-REP-02B Release  
- Did **not** invent numbering format, template bytes, or signatory identities  
- Does **not** authorize coding until Implementation Readiness Audit completes and a separate implementation task is authorized  
- Does **not** authorize Patient Portal / 360 / notifications / Amendments / Unrelease  

---

## 25. Next gate

```text
NEXT_GATE = IMPLEMENTATION_READINESS_AUDIT
```

The readiness audit must:

1. Confirm `PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED`  
2. Confirm `CONFIGURATION_REQUIRED = YES` and list concrete missing config stores/values  
3. Map permission capability codes to catalogue conventions  
4. Propose schema/API/UI touchpoints without coding  
5. Verify L-REP-02B Release remains untouched  
6. Confirm PD-ART-03 operating-branch numbering scope  
7. Only then may a separate implementation task be authorized  

---

## Final stamps

```text
PRODUCT_OWNER_DECISIONS_APPROVED
PRODUCT_DECISION_CLOSURE_COMPLETE
PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED
IMPLEMENTATION_NOT_STARTED
CONFIGURATION_REQUIRED = YES
L_REP_02B_REMAINS_ACCEPTED
NEXT_GATE = IMPLEMENTATION_READINESS_AUDIT
```

**STOP.** Do not implement L-REP-03 in this task.
