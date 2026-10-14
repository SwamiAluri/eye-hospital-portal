# L-COL-01F — Testing  
# Product Owner Decision Closure

**Date:** 2026-10-11  
**Slice:** L-COL-01F (Testing — decision closure only)  
**Mode:** DOCUMENTATION / PRODUCT OWNER APPROVAL ONLY — no application source, schema, migrations, APIs, UI, permissions seeding/grants, audit allowlist changes, CollectionTask, Orders, Catalogue, Pathology, Billing, Specimen, Receiving, Barcode, or Testing implementation  
**Discovery package:** [enterprise-lms-testing-discovery-audit.md](./enterprise-lms-testing-discovery-audit.md)  
**Upstream acceptance:** L-COL-01B ACCEPTED · L-COL-01C ACCEPTED · L-COL-01D ACCEPTED · **L-COL-01E_ACCEPTED** (Manual UAT PASSED)  
**Authoritative PRD/BRD:** `enterprise_laboratory_management_system_prd_brd.docx` (project Library / functional SoT — repository copy absence is a **repository gap only**, not a PRD-unavailable condition)

```text
L0 · L-CAT-01B · L-ORD-01B · L-ORD-01C · L-COL-01B ACCEPTED
  → L-COL-01C Specimen Foundation ACCEPTED
  → L-COL-01D Receiving & Accession ACCEPTED
  → L-COL-01E Barcode & Label Lifecycle ACCEPTED (L-COL-01E_ACCEPTED)
  → Discovery audit (READY_FOR_PRODUCT_OWNER_APPROVAL)
  ↓
PD-TST-* / AD-TST-* (THIS DOCUMENT)
  ← PRODUCT OWNER APPROVED (2026-10-11)
  ↓
L-TST-01A — Testing Work Queue + Manual Result Draft
  ← AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK
  ← NOT IMPLEMENTED BY THIS DOCUMENT
  ↓
Later (unauthorized here): L-VER-01 · L-AUTH-01 · L-CRT-01 · Reporting · Instrument · Runs/QC
```

---

## 1. Document purpose

This document formally records Product Owner approval of the L-COL-01F Testing decision set, closes the product/architecture decision gate for the **first bounded Testing slice only**, and authorizes a **separate** implementation task for:

**L-TST-01A — Testing Work Queue + Manual Result Draft**

**This document does not implement L-TST-01A.**

---

## 2. Product Owner approval statement

Product Owner has **approved** PD-TST-01 through PD-TST-20 and AD-TST-01 through AD-TST-06 as recorded below. Decisions are **not broadened** beyond this stamp.

| Class | Meaning |
|---|---|
| **APPROVED** | Product Owner approved for L-TST-01A / L-COL-01F first-slice closure, or reaffirmed upstream |
| **APPROVED PRINCIPLE** | Rule closed; exact engineering allowlist wiring remains in the implementation task |
| **DEFERRED** | Explicitly later than L-TST-01A |
| **OUT_OF_SCOPE** | Not part of L-TST-01A |
| **CONFIGURATION_REQUIRED** | Later configuration dependency — **does not block** Draft-only L-TST-01A; must not be faked as live |

**Gate determination:**

# PRODUCT_DECISIONS_CLOSED_L_COL_01F_AUTHORIZED

---

## 3. Source hierarchy

| Priority | Source | Role |
|---|---|---|
| 1 | This decision closure | Authoritative L-COL-01F / L-TST-01A product/architecture stamp |
| 2 | Enterprise LMS PRD/BRD v1.0 | Functional SoT |
| 3 | [enterprise-lms-testing-discovery-audit.md](./enterprise-lms-testing-discovery-audit.md) | Discovery evidence (superseded where this stamp differs) |
| 4 | L-COL-01B … 01E acceptance / decision closures | Certified upstream SoT — **do not reopen** |
| 5 | Order / Catalogue / Pathology boundary docs | Adjacent certified constraints |
| 6 | LaboratoryApi + LMS FE | Runtime evidence for reuse; not a license to invent Testing SoT |

Where discovery recommendations differ from this stamp, **this closure prevails**.

---

## 4. Upstream certified boundaries (immutable)

| # | Boundary | Status |
|---|---|---|
| A | CollectionTask lifecycle unchanged; Completed is terminal for the task | **APPROVED** |
| B | Specimen born Collected via Complete Collection; Receive/Reject are explicit | **APPROVED** |
| C | Specimen GUID ≠ Accession ≠ Barcode | **APPROVED** |
| D | Accession only after successful Receive; Rejected has no accession | **APPROVED** |
| E | Order remains Submitted / Cancelled per order lifecycle | **APPROVED** |
| F | OrderTest remains **Ordered** through collect / receive / reject / barcode **and** through L-TST-01A | **APPROVED** |
| G | Specimen ↔ OrderTest M:N-capable link must not be redesigned | **APPROVED** |
| H | Pathology `/dashboard/laboratory` and `LabReport` are **not** LMS Testing SoT | **APPROVED** |
| I | LaboratoryApi owns LMS clinical laboratory domain behavior | **APPROVED** |
| J | Platform `audit_log` is sole authoritative audit SoT | **APPROVED** |
| K | Clinical/testing state must not be overwritten by financial state | **APPROVED** |
| L | No production role grants from this closure | **APPROVED** |
| M | No new organization/site/section hierarchy | **APPROVED** |
| N | Do not reopen L-COL-01C/01D/01E unless a concrete defect is found | **APPROVED** |

---

## 5. Product decisions — PD-TST-01 … PD-TST-20

### PD-TST-01 — Work-item grain

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Operational Testing work item = **OrderTest**. Execution context = one specific eligible **Received** Specimen linked through the existing M:N specimen ↔ OrderTest relationship |
| **Forbidden** | Redesigning M:N; Specimen as sole Testing work item; Order as Testing work item; Report as Testing work item |
| **Deferred** | Analytical Run |

### PD-TST-02 — Testing eligibility

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | An OrderTest is eligible for the L-TST-01A Testing work queue only when **all** of the following hold: (1) Order status = `Submitted`; (2) OrderTest status = `Ordered`; (3) at least one linked Specimen has status = `Received`; (4) the linked Specimen belongs to the same tenant and authorized operating branch context; (5) the orderable is a local LMS TEST/PANEL component eligible for local examination |
| **Not eligible** | Rejected specimens; Collected-but-not-Received specimens |
| **Barcode** | Presence is **OPTIONAL**. Barcode is **never** a clinical Testing prerequisite |
| **Forbidden** | Inventing automatic OrderTest state transitions |

### PD-TST-03 — OrderTest vs Result status

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Keep OrderTest status = `Ordered` during L-TST-01A. Do **not** expand or mutate the existing OrderTest state machine. Testing/examination/result state belongs to the new LMS Result/Test execution domain |
| **Forbidden** | Mirrored OrderTest status transitions |
| **Later** | Future Reporting may define upward summary/mapping separately |

### PD-TST-04 — First Testing slice

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Slice** | **L-TST-01A** = Testing Work Queue + Manual Result Draft |
| **IN** | Testing eligibility read model; Testing work queue/workbench; OrderTest + Received Specimen context; Manual Result Draft creation; Manual Result Draft editing; Result persistence; Result version foundation required for drafts; audit; idempotency; optimistic concurrency; permission **catalog** definitions |
| **OUT** | Technical Verification; Clinical Authorization; Final release; Reporting; Critical-result workflow; Amendments after Final; Instrument integration; Analyzer interfaces; Runs; QC; Calibration; Referral inbound results; Billing; Pathology migration; Patient portal result release |

### PD-TST-05 — Result status MVP

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | L-TST-01A supports only **Result Draft** |
| **Do not implement** | Technical Verified; Authorization Pending; Final; Preliminary; Amended; Corrected; Invalidated |
| **UI** | Do not expose non-Draft statuses in L-TST-01A UI; do not create fake future transitions |
| **Safety** | A draft is **NOT** a released clinical result |

### PD-TST-06 — Manual vs instrument

| Field | Content |
|---|---|
| **Status** | **APPROVED** (manual MVP) / instrument **DEFERRED** |
| **Rule** | Manual structured result entry is the MVP |
| **Deferred** | Instrument/analyzer ingestion; import/mapping/interface exception handling |
| **Forbidden** | Analyzer integration in L-TST-01A |

### PD-TST-07 — MVP result datatypes

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Supported** | (1) Numeric value; (2) Qualitative value; (3) Free-text comment — where the active catalogue definition supports the corresponding datatype |
| **Forbidden** | Inventing analyte/code masters; new clinical terminology master in this slice; hard-coded clinical interpretation |
| **Panels** | Multi-component panel results may be represented per component where the active catalogue version defines those components |
| **Honesty** | If the active catalogue version does not define a usable result datatype for an orderable, UI/API must fail honestly rather than inventing one |

### PD-TST-08 — Units / intervals / flags

| Field | Content |
|---|---|
| **Status** | **APPROVED** (persist entered fields) / clinical evaluation **CONFIGURATION_REQUIRED** for later |
| **May persist** | Entered value; entered unit where applicable; entered comment |
| **Forbidden in L-TST-01A** | Automatic abnormal flag calculation; automatic critical flag calculation; hard-coded reference intervals; hard-coded critical thresholds; clinical interpretation without governed configuration |
| **Later** | Reference intervals, units governance, abnormal rules, and critical thresholds remain configuration dependencies for later slices |
| **UI honesty** | Must **not** falsely present intervals/flags/criticals as configured |

### PD-TST-09 — Technical verification

| Field | Content |
|---|---|
| **Status** | **OUT_OF_SCOPE** / **DEFERRED** to **L-VER-01** |
| **Forbidden in L-TST-01A** | Verification APIs, permissions, status transitions, or UI |

### PD-TST-10 — Clinical authorization

| Field | Content |
|---|---|
| **Status** | **OUT_OF_SCOPE** / **DEFERRED** to **L-AUTH-01** |
| **Forbidden** | Inferring authorization authority from the Hospital Portal Admin role |

### PD-TST-11 — Same person verify/authorize

| Field | Content |
|---|---|
| **Status** | **DEFERRED** |
| **Rule** | Deferred to the Verification/Authorization product decision. No implementation in L-TST-01A |

### PD-TST-12 — Rejected specimen

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | A Rejected Specimen is not eligible for Testing |
| **L-TST-01A MUST NOT automatically** | Change OrderTest to Not Performed; cancel OrderTest; create a recollection task; create a replacement specimen; modify CollectionTask; modify Receiving |
| **Note** | Those outcomes require a separately governed lifecycle decision |

### PD-TST-13 — Critical results

| Field | Content |
|---|---|
| **Status** | **DEFERRED** to **L-CRT-01** |
| **Forbidden** | Inventing critical thresholds or escalation matrices |

### PD-TST-14 — TAT

| Field | Content |
|---|---|
| **Status** | **APPROVED** (domain timestamps only) |
| **Rule** | L-TST-01A captures result draft creation/update timestamps as domain timestamps |
| **Do not implement** | TAT KPI engine; breach escalation; TAT dashboards; invented expected-TAT values |
| **Later** | Expected TAT configuration remains a later **CONFIGURATION_REQUIRED** dependency |

### PD-TST-15 — Permissions

| Field | Content |
|---|---|
| **Status** | **APPROVED** (catalog for L-TST-01A only) |
| **Codes** | `lms.testing.view`; `lms.testing.manage`; `lms.testing.result` |
| **Behavior** | Catalog definitions only |
| **Forbidden** | Role grants; production role mappings; seeding grants in this closure |
| **Deferred** | Verification/authorization permissions |

### PD-TST-16 — UI

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Surfaces** | (1) Testing Work Queue / Workbench; (2) Manual Result Draft entry/detail |
| **Rule** | Work queue must be operationally useful and honest |
| **Forbidden** | Fake KPIs; fake counts; fake clinical results; fabricated patient rows; Runs UI; Instrument UI; Verification UI; Authorization UI; Critical UI; Amendment UI; Reporting UI |

### PD-TST-17 — Two-person check / attachments

| Field | Content |
|---|---|
| **Status** | **DEFERRED** |
| **Rule** | Two-person checking and worksheet/image evidence are deferred. Do not implement in L-TST-01A |

### PD-TST-18 — Referral / external results

| Field | Content |
|---|---|
| **Status** | **OUT_OF_SCOPE** / **DEFERRED** |
| **Rule** | Referral/external result ingestion is out of scope. Defer to the future referral/inbound-result slice |

### PD-TST-19 — Billing

| Field | Content |
|---|---|
| **Status** | **OUT_OF_SCOPE** / **APPROVED** (separation principle) |
| **Rule** | Testing creates no charges in L-TST-01A. No payment state. No insurance state. No claims behavior. Clinical Testing/Result state must never be overwritten by financial state. Existing collection charging principles remain untouched |

### PD-TST-20 — Audit

| Field | Content |
|---|---|
| **Status** | **APPROVED PRINCIPLE** |
| **SoT** | Platform `audit_log` is the sole authoritative audit source |
| **Rule** | Audit must be fail-closed for Testing mutations |
| **Candidate L-TST-01A actions** | `CREATE_RESULT_DRAFT`; `UPDATE_RESULT_DRAFT` |
| **Forbidden in L-TST-01A** | Verification / authorization / critical / report audit actions |
| **Note** | Exact allowlist implementation belongs to the **separate** implementation task |

---

## 6. Architecture decisions — AD-TST-01 … AD-TST-06

### AD-TST-01 — Service ownership

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | LaboratoryApi owns LMS Testing/Result domain behavior |
| **Forbidden** | Creating a Testing microservice |

### AD-TST-02 — Result aggregate

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Create a new LMS Result domain aggregate linked to OrderTest, specific Specimen, tenant, and operating branch/context. Result components/versioning must be designed so released clinical records can never be overwritten in place |
| **L-TST-01A** | Only Draft behavior is required |
| **Forbidden** | Using Pathology `LabReport` / `LabReportItem` as LMS Result SoT |

### AD-TST-03 — OrderTest coupling

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | L-TST-01A does **not** mutate OrderTest status. OrderTest remains `Ordered`. Result/examination state belongs to the new LMS Testing/Result domain |

### AD-TST-04 — Pathology isolation

| Field | Content |
|---|---|
| **Status** | **APPROVED** (reconfirmed) |
| **Forbidden** | Reuse LabReport as LMS Result; reuse `laboratory_*` tables as LMS Testing SoT; mount LMS Testing into `/dashboard/laboratory`; migrate Pathology; redirect existing Pathology workflows |

### AD-TST-05 — Outbox

| Field | Content |
|---|---|
| **Status** | **APPROVED** (no outbox for L-TST-01A) / further consumers **DEFERRED** |
| **Rule** | No event/outbox dependency is required for L-TST-01A. Defer unless a later approved consumer requires it |

### AD-TST-06 — Idempotency / concurrency

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Reuse established LMS patterns: operation-specific idempotency; RowVersion optimistic concurrency; `409` concurrency conflict; server-authoritative mutation; audit + mutation transaction integrity |
| **Note** | Exact operation keys may be finalized during implementation design, but **MUST** remain bounded to L-TST-01A |

---

## 7. Configuration decisions

The following are **NOT** required to block the basic Draft-only slice:

| Dependency | Status for L-TST-01A |
|---|---|
| Reference interval masters | **CONFIGURATION_REQUIRED** (later; does not block Draft) |
| Critical thresholds | **CONFIGURATION_REQUIRED** (later; does not block Draft) |
| Critical escalation chains | **CONFIGURATION_REQUIRED** (later; does not block Draft) |
| TAT expectations | **CONFIGURATION_REQUIRED** (later; does not block Draft) |
| Signatory matrix | **CONFIGURATION_REQUIRED** (later; does not block Draft) |
| Autoverification | **CONFIGURATION_REQUIRED** / **DEFERRED** |
| Two-person-check configuration | **CONFIGURATION_REQUIRED** / **DEFERRED** |
| Units governance / coded dictionaries (beyond entered unit/value) | **CONFIGURATION_REQUIRED** (later; does not block Draft persistence of entered fields) |

**Reason:** L-TST-01A does not calculate clinical flags, release results, authorize results, or perform critical-result communication.

**Hard rule:** Implementation MUST NOT falsely present these values as configured. If the active catalogue version does not define a usable result datatype for an orderable, the UI/API must fail honestly rather than inventing one.

---

## 8. Authorized first bounded Testing slice

| Field | Content |
|---|---|
| **Slice ID** | L-TST-01A |
| **Name** | Testing Work Queue + Manual Result Draft |
| **Status** | **APPROVED** / **AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK** |
| **Prerequisites** | L-COL-01C/01D/01E accepted; Submitted Order; Ordered OrderTest; Received Specimen link; local catalogue eligibility |
| **UAT implication** | Honest empty/error; no fake clinical rows; draft is not a released clinical result |

---

## 9. Explicit out-of-scope boundary (L-TST-01A)

- Technical Verification (L-VER-01)  
- Clinical Authorization (L-AUTH-01)  
- Final release / Reporting / patient portal result release  
- Critical-result workflow (L-CRT-01)  
- Amendments after Final  
- Instrument / analyzer integration  
- Runs / QC / Calibration  
- Referral inbound results  
- Billing / payment / insurance / claims  
- Pathology migration  
- OrderTest / Specimen / CollectionTask / Receiving / Barcode lifecycle changes  
- Production role grants  
- Fake KPIs / fabricated clinical rows  
- Automatic abnormal/critical flag calculation  
- Hard-coded reference intervals or thresholds  

---

## 10. Decision register (closed for L-TST-01A)

| ID | Topic | Status |
|---|---|---|
| PD-TST-01 | Work-item grain = OrderTest + Received Specimen context | **APPROVED** |
| PD-TST-02 | Eligibility rules | **APPROVED** |
| PD-TST-03 | OrderTest stays Ordered; Result domain owns state | **APPROVED** |
| PD-TST-04 | L-TST-01A = Work Queue + Manual Result Draft | **APPROVED** |
| PD-TST-05 | Result status = Draft only | **APPROVED** |
| PD-TST-06 | Manual MVP; instrument deferred | **APPROVED** / **DEFERRED** |
| PD-TST-07 | Numeric / qualitative / free-text comment | **APPROVED** |
| PD-TST-08 | Persist value/unit/comment; no auto flags | **APPROVED** (+ later **CONFIGURATION_REQUIRED**) |
| PD-TST-09 | Technical verification | **OUT_OF_SCOPE** / **DEFERRED** (L-VER-01) |
| PD-TST-10 | Clinical authorization | **OUT_OF_SCOPE** / **DEFERRED** (L-AUTH-01) |
| PD-TST-11 | Same-person verify/authorize | **DEFERRED** |
| PD-TST-12 | Rejected specimen not eligible; no auto lifecycle side effects | **APPROVED** |
| PD-TST-13 | Critical results | **DEFERRED** (L-CRT-01) |
| PD-TST-14 | Draft timestamps only; no TAT engine | **APPROVED** (+ later **CONFIGURATION_REQUIRED**) |
| PD-TST-15 | Permission catalog `view` / `manage` / `result` | **APPROVED** (no grants) |
| PD-TST-16 | Work Queue + Manual Result Draft UI only | **APPROVED** |
| PD-TST-17 | Two-person check / attachments | **DEFERRED** |
| PD-TST-18 | Referral/external results | **OUT_OF_SCOPE** / **DEFERRED** |
| PD-TST-19 | Billing | **OUT_OF_SCOPE** |
| PD-TST-20 | Audit principle + CREATE/UPDATE_RESULT_DRAFT candidates | **APPROVED PRINCIPLE** |
| AD-TST-01 | LaboratoryApi ownership | **APPROVED** |
| AD-TST-02 | New LMS Result aggregate | **APPROVED** |
| AD-TST-03 | OrderTest non-mutation | **APPROVED** |
| AD-TST-04 | Pathology isolation | **APPROVED** |
| AD-TST-05 | No outbox for L-TST-01A | **APPROVED** |
| AD-TST-06 | Idempotency / concurrency patterns | **APPROVED** |

Upstream boundaries A–N in §4 remain **APPROVED**.  
No first-slice decision remains marked `PRODUCT_DECISION_REQUIRED`.

---

## 11. IMPLEMENTATION AUTHORIZATION

# PRODUCT_DECISIONS_CLOSED_L_COL_01F_AUTHORIZED

| Field | Content |
|---|---|
| **Authorized implementation** | **L-TST-01A — Testing Work Queue + Manual Result Draft** |
| **Authorization** | **AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK** |
| **This document** | Does **not** implement L-TST-01A |
| **All other Testing capabilities** | Remain **unauthorized** |

**Explicitly not authorized by this stamp:**

- Verification (L-VER-01)  
- Authorization (L-AUTH-01)  
- Reporting  
- Critical Results (L-CRT-01)  
- Amendments  
- Instrument Integration  
- Runs  
- QC  
- Referral Results  
- Billing  
- Pathology migration  
- Upstream lifecycle changes (OrderTest / Specimen / CollectionTask / Receiving / Barcode)  

**Next step:** Separate Cursor / engineering implementation task against this closure only.

---

## 12. Confirmation — this task

- NO APPLICATION IMPLEMENTATION  
- NO DATABASE / MIGRATION  
- NO TESTING / RESULT ENTITY / API / UI  
- NO PERMISSION SEEDING / ROLE GRANTS  
- NO AUDIT ALLOWLIST CHANGES  
- NO ORDER / ORDERTEST / SPECIMEN / COLLECTION / RECEIVING / BARCODE LIFECYCLE CHANGES  
- NO PATHOLOGY / CATALOGUE / BILLING CHANGES  

---

## FINAL STATUS

**PRODUCT_DECISIONS_CLOSED_L_COL_01F_AUTHORIZED**

**Authorized implementation:** L-TST-01A — Testing Work Queue + Manual Result Draft  

**All other Testing capabilities remain unauthorized.**

**STOP.** Do not implement L-TST-01A in this task. Do not create Testing schema, APIs, UI, permissions, or audit actions in this task.
