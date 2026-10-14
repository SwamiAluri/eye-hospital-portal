# L-COL-01D — Receiving Configuration & Product Decision Closure

**Date:** 2026-10-11  
**Slice:** L-COL-01D (Receiving & Accession — **configuration governance only**)  
**Mode:** DOCUMENTATION / PRODUCT OWNER DECISION ONLY — **no** application source, schema, migrations, APIs, UI, permissions seeding/grants, Receive/Reject/accession implementation, barcode, labels, billing, testing, or Pathology changes  
**Prior product closure:** [enterprise-lms-receiving-accession-decision-closure.md](./enterprise-lms-receiving-accession-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01D_AUTHORIZED`)  
**Discovery audit:** [enterprise-lms-receiving-accession-discovery-audit.md](./enterprise-lms-receiving-accession-discovery-audit.md)  
**Implementation gate (authoritative for missing config):** [enterprise-lms-receiving-accession-implementation-config-blocked.md](./enterprise-lms-receiving-accession-implementation-config-blocked.md) (`CONFIGURATION_BLOCKED`)  
**Authoritative PRD/BRD:** `enterprise_laboratory_management_system_prd_brd.docx` (project Library / functional SoT — repository copy absence is a **repository gap only**, not a PRD-unavailable condition; PD-COL-REC-24)

```text
PRODUCT_DECISIONS_CLOSED_L_COL_01D_AUTHORIZED
  → Implementation gate: CONFIGURATION_BLOCKED
       (CONFIG-A rejection reasons missing;
        CONFIG-B accession format/sequence/scope missing)
  ↓
THIS DOCUMENT — PD-COL-REC-CONFIG-*
  → Closes what CAN be closed without inventing values
  → Leaves value-specific items CONFIGURATION_VALUE_PENDING / DECISION_REQUIRED
  ↓
FINAL GATE (this task): CONFIGURATION_BLOCKED
  → NO application implementation authorized
  → STOP until Product Owner / platform supplies missing values
```

---

## 1. Purpose

Close the two configuration dependencies that currently block L-COL-01D implementation:

| ID | Dependency |
|---|---|
| **CONFIG-A** | Governed Specimen Rejection Reasons |
| **CONFIG-B** | Governed Specimen Accession |

This document distinguishes:

1. Already-approved L-COL-01D **business rules** (not reopened)  
2. Newly required **configuration decisions**  
3. Configuration **values** that must be Product Owner–approved (not invented)  
4. Runtime **source of truth** requirements  
5. Implementation **constraints** for a future task  
6. **Unresolved** decisions and pending values  

**This document does not implement L-COL-01D.**

---

## 2. Current CONFIGURATION_BLOCKED state

The implementation-gate audit remains authoritative and is **not** overridden:

| Dependency | Gate finding |
|---|---|
| **CONFIG-A** | No LMS rejection-reason master; no suitable MasterValue entity type/codes; catalogue `RejectionCriteria` ≠ runtime SoT; legacy/other-domain reject values not reusable |
| **CONFIG-B** | No LMS accession field/entity; no governed format/sequence/scope; `LAB-*` = Order numbering only; `COL-*` = CollectionTask numbering only — **not** approved accession formats |

Until both dependencies are fully closed with approved values **and** a bindable runtime SoT, L-COL-01D remains:

# CONFIGURATION_BLOCKED

---

## 3. Authoritative sources

| Source | Role |
|---|---|
| `enterprise_laboratory_management_system_prd_brd.docx` (Library) | Functional SoT — Receiving accept/reject with reason + actor/timestamp; specimen lifecycle includes Collected / Received / Rejected |
| Receiving discovery audit | Repository evidence of missing config |
| Receiving decision closure (PD-COL-REC-*) | Approved L-COL-01D product rules; CONFIGURATION_REQUIRED for masters |
| Implementation config-blocked report | Confirms CONFIG-A and CONFIG-B still missing at runtime |
| L-COL-01B / L-COL-01C docs + code | Certified CollectionTask + Specimen Collected SoT |
| L-ORD-01B/C / L-CAT-01B docs | Order/OrderTest/Catalogue boundaries (unchanged) |
| Platform `MasterValue` / `entity_type_registry` | Existing enterprise master-data infrastructure (candidate for CONFIG-A evaluation only) |
| `LmsOrderNumberSequence` / `LmsCollectionTaskNumberSequence` | Existing LMS numbering **pattern** only — not accession SoT |

---

## 4. Existing audit findings (preserved)

### 4.1 Certified L-COL-01D boundary (NOT reopened)

```text
CollectionTask Completed
    +
explicit Complete Collection
    =
Specimen Collected
    (NO accession)

Specimen Collected
    +
explicit Receive
    =
Specimen Received (+ accession)

Specimen Collected
    +
explicit Reject
    =
Specimen Rejected (governed reason; NO accession)
```

| Constraint | Status |
|---|---|
| Receive / Reject are explicit mutations | **APPROVED** (PD-COL-REC-01 / 04) — not reopened |
| No automatic Receive | **APPROVED** — not reopened |
| No reversal in L-COL-01D | **APPROVED** (PD-COL-REC-20) — not reopened |
| Order remains Submitted; OrderTest remains Ordered | **APPROVED** — not reopened |
| No CollectionTask / Catalogue / Order / OrderTest mutation from Receiving | **APPROVED** — not reopened |
| Accession only after successful Receive | **APPROVED** (PD-COL-REC-10) — not reopened |
| Rejected specimens get no accession | **APPROVED** — not reopened |
| Barcode / labels = L-COL-01E | **APPROVED** / deferred — not reopened |
| Custody / aliquots / referral receiving / Testing / Results / Reporting / Billing deferred | **APPROVED** / deferred — not reopened |
| Pathology separate SoT | **APPROVED** — not reopened |
| No production role grants from decision tasks | **APPROVED** — not reopened |

### 4.2 Runtime gaps (still true)

| Gap | Evidence |
|---|---|
| No rejection-reason runtime catalogue for LMS Reject | Implementation gate §2.A |
| No accession format/sequence/scope configuration | Implementation gate §2.B |
| LaboratoryApi has no MasterValue lookup client today | `PlatformReferenceClient` validates patient/visit/user/branch only |
| No `lms.specimens.receive` usage yet | Permission defined; unused |

---

## 5. PD-COL-REC-CONFIG-01 — Governed Specimen Rejection Reason Source

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-01 |
| **Title** | Governed Specimen Rejection Reason Source |
| **Status** | **DECISION_REQUIRED** (source selection) + **CONFIGURATION_VALUE_PENDING** (codes / entity binding) |
| **Problem** | Reject requires a mandatory governed reason (PD-COL-REC-05). No bindable runtime SoT exists. |

### 5.1 Architectural options supported by the repository

Only options that exist in architecture are evaluated. No new platform is invented.

| Option | Supported by architecture? | Evaluation |
|---|---|---|
| **A. Platform MasterValue** (`master.master_value` + `master.entity_type_registry`) | **Yes** — AuthService MasterValue module exists; tenant-scoped Code/Label/Description/IsActive/SortOrder/Disabled*; lab group already seeds specimen **types**, not reject reasons | **Candidate** for selectable, governed, active/inactive master data. **Not yet bound:** no LMS specimen-rejection `EntityType`, no approved codes, no LaboratoryApi validation adapter |
| **B. LMS-owned governed configuration table(s) in LaboratoryApi** | **Partial** — LMS owns `lms_*` transactional tables and number sequences; **no** existing LMS rejection-reason master pattern | Would create a **new** LMS configuration master. Prior closure forbids inventing masters unless explicitly permitted. **Not selected** without explicit Product Owner authorization of a new LMS config domain |
| **C. Another already-existing enterprise configuration source** | **No suitable source found** — catalogue `RejectionCriteria` is free-text guidance; CCMS/IP/legacy lab reject paths are wrong SoT | **Rejected as SoT** |

### 5.2 Product Owner decision required (source)

| Decision | Status | Approved value |
|---|---|---|
| Authoritative runtime source for Reject validation | **DECISION_REQUIRED** | — |
| Preferred candidate (evaluation only, **not** approved by this document) | Evaluation note | Option **A (MasterValue)** is the only existing enterprise master-data mechanism that can satisfy selectable + active/inactive + tenant persistence **without inventing a new configuration platform**. Selection remains **DECISION_REQUIRED** until Product Owner stamps it. |
| Option B (new LMS master) | **DECISION_REQUIRED** if PO rejects A | Requires explicit PO authorization to create LMS-owned reason configuration (still **must not** invent codes) |
| Option C | **REJECTED** as SoT for this dependency | Not a governed LMS rejection-reason source |

**Implementation constraint (when source is chosen):** LaboratoryApi must validate Reject against that source server-side. Free-text alone must not be the sole rejection reason. Catalogue `RejectionCriteria` remains guidance only.

### 5.3 Required rejection-reason data (minimum fields)

| Field | Required? | Status | Notes |
|---|---|---|---|
| Code | **Yes** | **APPROVED** (requirement) | Stable identifier used on Reject and stored for audit/history |
| Display label | **Yes** | **APPROVED** (requirement) | Operator-facing label |
| Description | Optional | **APPROVED** (optional) | If present on chosen source; do not invent clinical attributes |
| Active / inactive | **Yes** | **APPROVED** (requirement) | Only active reasons selectable for new Rejects |
| Sort / display order | Optional | **APPROVED** (optional) | If source supports it (MasterValue has `SortOrder`) |
| Effective date | Optional | **DECISION_REQUIRED** | MasterValue has Created/Disabled timestamps but no first-class effective-from/to; do not invent unless PO requires |
| Scope key (branch/section) | See §5.5 | **DECISION_REQUIRED** | |
| Historical validity | See §5.4 | **DECISION_REQUIRED** / partial reaffirm | |

Do **not** invent additional clinical attributes (severity, specimen-type coupling, etc.) unless Product Owner supplies them later.

### 5.4 PD-COL-REC-CONFIG-01A — Reason code governance

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-01A |
| **Status** | **DECISION_REQUIRED** |

Product Owner must explicitly decide (values not invented here):

| Question | Status |
|---|---|
| Who owns the codes (clinical/ops/LMS config owner)? | **DECISION_REQUIRED** |
| Are codes immutable after activation? | **DECISION_REQUIRED** |
| May labels change after activation? | **DECISION_REQUIRED** |
| How do historical Rejected specimens retain original meaning? | **DECISION_REQUIRED** (see also §5.6) |
| Do inactive reasons remain valid for historical records? | **DECISION_REQUIRED** |
| Can a reason be retired? | **DECISION_REQUIRED** |
| Do new reasons require approval workflow? | **DECISION_REQUIRED** |

**Non-negotiable constraint (already APPROVED at product level):** Engineering must not invent hard-coded clinical/operational rejection catalogues (PD-COL-REC-05).

### 5.5 PD-COL-REC-CONFIG-01B — Reason scope

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-01B |
| **Status** | **DECISION_REQUIRED** |

| Scope option | Fit to Hospital Portal model |
|---|---|
| Enterprise-wide (cross-tenant) | Platform system permissions exist; MasterValue rows are **tenant-scoped** today |
| Tenant-wide | **Supported** by MasterValue `TenantId` and LMS tenant isolation |
| Site / branch scoped | Receiving ops are branch-authorized, but **no** existing branch-scoped rejection-reason master; do **not** invent site hierarchy |
| Section scoped | **No** LMS section hierarchy for reasons exists — do not invent |

**Finding:** Narrower-than-tenant scope is **not** supported by an existing rejection-reason configuration model. Until Product Owner decides otherwise, inventing branch/section reason catalogues is forbidden.

**Status:** **DECISION_REQUIRED** (recommended evaluation: tenant-wide if MasterValue selected — **not stamped APPROVED** here).

### 5.6 PD-COL-REC-CONFIG-01C — Historical behavior

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-01C |
| **Status** | **APPROVED** (principle) + **DECISION_REQUIRED** (persistence mechanics) |

| Rule | Status |
|---|---|
| Historical Rejected specimens must remain interpretable after reason retire/rename | **APPROVED** (principle — this closure) |
| Future Reject must use an active governed reason | **APPROVED** (requirement — PD-COL-REC-05) |
| Exact persistence (store code only vs code+label snapshot on specimen) | **DECISION_REQUIRED** |
| Inactive reason usable for new Reject | Expected **no**; final stamp **DECISION_REQUIRED** |

### 5.7 MVP reason set

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-01D (MVP reason set) |
| **Status** | **CONFIGURATION_VALUE_PENDING** |

| Question | Decision |
|---|---|
| Are actual codes/labels supplied in this closure? | **No** |
| May engineering invent example codes (e.g. DAMAGED, MISLABELLED)? | **Forbidden** |
| Who must supply the controlled list? | Product Owner and/or designated clinical/operational owner |
| Gate impact | Keeps L-COL-01D **CONFIGURATION_BLOCKED** |

```text
CONFIGURATION_VALUE_PENDING
  — approved controlled rejection reason codes + labels not provided
```

---

## 6. PD-COL-REC-CONFIG-02 — Governed LMS Specimen Accession

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-02 |
| **Title** | Governed LMS Specimen Accession |
| **Status** | **DECISION_REQUIRED** (runtime source / binding) + **CONFIGURATION_VALUE_PENDING** (format / sequence / scope values) |

### 6.1 Runtime source evaluation

| Option | Supported? | Evaluation |
|---|---|---|
| Existing accession config artifact | **No** | Gate confirms missing |
| Copy `LAB-*` Order sequence format | **Forbidden** | Wrong domain; PD-COL-REC-12 pattern-only |
| Copy `COL-*` CollectionTask sequence format | **Forbidden** | Wrong domain; PD-COL-REC-12 pattern-only |
| LMS-owned accession sequence table + format config (pattern reuse from order/task sequences) | **Pattern exists**; artifact **does not** | Acceptable **implementation pattern** only after PO approves format/scope/period; does **not** authorize inventing `ACC-*` or any format |
| Platform MasterValue as accession **generator** | **Not suitable** | MasterValue is a code/label master, not an atomic sequence allocator |

**Decision status:** Accession **configuration values** and **exact storage binding** remain **CONFIGURATION_VALUE_PENDING** / **DECISION_REQUIRED**. Sequence **allocation pattern** may later reuse LMS upsert/`RETURNING` concurrency techniques used by Order/CollectionTask **without** copying their formats.

### 6.2 PD-COL-REC-CONFIG-02A — Accession format

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-02A |
| **Status** | **CONFIGURATION_VALUE_PENDING** |

Product Owner must explicitly define (none supplied in this task):

| Element | Status |
|---|---|
| Prefix | **CONFIGURATION_VALUE_PENDING** |
| Numeric/alphanumeric structure | **CONFIGURATION_VALUE_PENDING** |
| Date component (if any) | **CONFIGURATION_VALUE_PENDING** |
| Sequence width | **CONFIGURATION_VALUE_PENDING** |
| Check digit (if any) | **CONFIGURATION_VALUE_PENDING** |
| Separator conventions | **CONFIGURATION_VALUE_PENDING** |
| Case sensitivity | **CONFIGURATION_VALUE_PENDING** |
| Maximum length | **CONFIGURATION_VALUE_PENDING** |

**Forbidden:** Engineering invention of any of the above.

### 6.3 PD-COL-REC-CONFIG-02B — Uniqueness scope

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-02B |
| **Status** | **DECISION_REQUIRED** / **CONFIGURATION_VALUE_PENDING** |

Prior closure (PD-COL-REC-11): uniqueness within the **configured tenant/site scope** is an approved **principle**; exact scope binding remains configuration-required.

| Scope candidate | Notes |
|---|---|
| Tenant | Compatible with existing LMS tenant isolation |
| Site | No separate LMS “site” hierarchy beyond branch — do not invent |
| Branch | Receiving is branch-authorized; **do not assume** accession uniqueness = branch solely because of that |
| Section | No existing section numbering scope — do not invent |

**Approved by this document:** Database-level uniqueness **must** enforce whatever scope Product Owner selects.  
**Not approved:** Any specific scope value.

### 6.4 PD-COL-REC-CONFIG-02C — Sequence mechanism

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-02C |
| **Status** | **APPROVED** (safety principles) + **CONFIGURATION_VALUE_PENDING** / **DECISION_REQUIRED** (exact mechanism parameters) |

| Rule | Status |
|---|---|
| Allocation must be atomic and concurrency-safe | **APPROVED** |
| `SELECT MAX(accession) + 1` (or equivalent) **forbidden** | **APPROVED** |
| Allocation strategy details (table shape, key columns) | **DECISION_REQUIRED** after format/scope approved |
| Sequence increment | **CONFIGURATION_VALUE_PENDING** (expected +1 unless PO states otherwise) |
| Gap policy | **DECISION_REQUIRED** |

**Pattern note (not format approval):** Future implementation may reuse the LMS PostgreSQL upsert + `RETURNING last_value` technique used by `LmsOrderNumberSequence` / `LmsCollectionTaskNumberSequence` **only after** format/period/scope are approved.

### 6.5 PD-COL-REC-CONFIG-02D — Reset / period

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-02D |
| **Status** | **CONFIGURATION_VALUE_PENDING** |

| Element | Status |
|---|---|
| Numbering period (day / month / year / never reset / other) | **CONFIGURATION_VALUE_PENDING** |
| Reset behavior | **CONFIGURATION_VALUE_PENDING** |
| Concurrency behavior across period boundaries | **DECISION_REQUIRED** once period is chosen |

### 6.6 PD-COL-REC-CONFIG-02E — Immutability

| Field | Content |
|---|---|
| **ID** | PD-COL-REC-CONFIG-02E |
| **Status** | **APPROVED** |

| Rule | Status |
|---|---|
| Once successfully issued, accession **cannot be changed** | **APPROVED** (reaffirms PD-COL-REC-12) |
| Issued accession **cannot be reused** | **APPROVED** |
| Correction / reissue | **DEFERRED** — separately governed future workflow; **not** in L-COL-01D |

### 6.7 Receiving relationship (reaffirmation)

| Rule | Status |
|---|---|
| Specimen created at Complete Collection → status Collected | **APPROVED** (L-COL-01C) |
| Explicit Receive → allocate accession → status Received | **APPROVED** (PD-COL-REC-01 / 10) |
| No accession at Complete Collection | **APPROVED** |
| No accession for Rejected | **APPROVED** |

---

## 7. Runtime source decisions (summary)

| Config | Source of truth | Owner | Storage | Runtime read/validate | Modify authorization | Audit | Activate/deactivate | Historical | Effective dating |
|---|---|---|---|---|---|---|---|---|---|
| **CONFIG-A Rejection reasons** | **DECISION_REQUIRED** (candidate: MasterValue) | **DECISION_REQUIRED** | Pending source selection; MasterValue → `master.master_value` | Pending; LaboratoryApi must server-validate | **DECISION_REQUIRED** (no role grants in this task; document future permission if needed) | Required for create/update/activate/deactivate/retire — **APPROVED** as requirement; not implemented here | **APPROVED** requirement | Interpretable history **APPROVED** principle | **DECISION_REQUIRED** |
| **CONFIG-B Accession** | **CONFIGURATION_VALUE_PENDING** / **DECISION_REQUIRED** (no artifact yet; LMS sequence pattern candidate after values approved) | **DECISION_REQUIRED** | Pending (must be LMS-owned persistence under LaboratoryApi once approved) | Pending; allocation only inside successful Receive transaction | **DECISION_REQUIRED** | Config changes auditable; issued accessions immutable | N/A for issued values; config versioning **DECISION_REQUIRED** | Issued accessions remain valid forever | Format change must not corrupt uniqueness — **APPROVED** principle |

**Do not design a new enterprise configuration platform.** Prefer MasterValue for code lists if PO selects it; prefer LMS sequence tables for accession allocation **after** format/scope approval.

---

## 8. Administration / governance

| Topic | Decision |
|---|---|
| Who may create/change rejection reasons | **DECISION_REQUIRED** |
| Who may change accession configuration | **DECISION_REQUIRED** |
| Production role grants in this task | **Forbidden** / **not performed** |
| If existing permissions insufficient | Document future permission code(s) as a **decision only** — **DECISION_REQUIRED** to name them; **do not seed grants** |

---

## 9. Audit requirements (configuration)

Minimum audit requirements for future configuration administration (**requirements only — not implemented**):

| Action | Required |
|---|---|
| Create | **Yes** |
| Update | **Yes** |
| Activate | **Yes** |
| Deactivate | **Yes** |
| Retire | **Yes** |

| Domain | Historical rule |
|---|---|
| Rejection reasons | Historical specimen Reject records must remain interpretable after retire/rename |
| Accession configuration | Already-issued accessions remain valid and immutable; future generation must not break uniqueness |

Specimen operational audits `RECEIVE_SPECIMEN` / `REJECT_SPECIMEN` remain as approved in PD-COL-REC-17 (future implementation task; allowlist only).

---

## 10. Configuration change safety

| Scenario | Rule | Status |
|---|---|---|
| Rejection reason retired/renamed after specimens exist | Old records remain historically interpretable | **APPROVED** (principle) |
| Accession format/config changes after specimens exist | Already-issued accessions unchanged | **APPROVED** |
| Future accession generation after config change | Must not corrupt uniqueness or sequencing | **APPROVED** (principle); migration/backfill **not** designed here |
| Backfill accessions for existing Collected specimens | **Forbidden** as silent behavior | **APPROVED** (aligns with prior gate) |

---

## 11. Decision register

| ID | Decision | Status | Approved Value | Runtime SoT |
|----|----------|--------|----------------|-------------|
| PD-COL-REC-CONFIG-01 | Rejection reason source | **DECISION_REQUIRED** | — (candidate evaluated: MasterValue; not stamped) | **None bound** |
| PD-COL-REC-CONFIG-01A | Reason code governance | **DECISION_REQUIRED** | — | Pending |
| PD-COL-REC-CONFIG-01B | Reason scope | **DECISION_REQUIRED** | — (tenant-wide supported; narrower scope unsupported without invention) | Pending |
| PD-COL-REC-CONFIG-01C | Historical behavior | **APPROVED** (interpretability principle) + **DECISION_REQUIRED** (snapshot mechanics) | Historical records remain interpretable | Pending persistence choice |
| PD-COL-REC-CONFIG-01D | MVP reason set (codes/labels) | **CONFIGURATION_VALUE_PENDING** | — | **None** |
| PD-COL-REC-CONFIG-02 | Accession source / binding | **DECISION_REQUIRED** / **CONFIGURATION_VALUE_PENDING** | — (must not copy LAB/COL formats) | **None** |
| PD-COL-REC-CONFIG-02A | Accession format | **CONFIGURATION_VALUE_PENDING** | — | **None** |
| PD-COL-REC-CONFIG-02B | Uniqueness scope | **DECISION_REQUIRED** / **CONFIGURATION_VALUE_PENDING** | Principle: configured tenant/site scope (PD-COL-REC-11); exact binding pending | **None** |
| PD-COL-REC-CONFIG-02C | Sequence mechanism | **APPROVED** (atomic; no MAX+1) + **DECISION_REQUIRED** (exact params) | Atomic concurrency-safe allocation; MAX+1 forbidden | Pending LMS sequence artifact |
| PD-COL-REC-CONFIG-02D | Reset/period | **CONFIGURATION_VALUE_PENDING** | — | **None** |
| PD-COL-REC-CONFIG-02E | Immutability | **APPROVED** | Issued accession immutable; no reuse; correction deferred | Future specimen accession field |

**Already-approved L-COL-01D business rules (PD-COL-REC-01…24) are not reopened and are not duplicated as new CONFIG approvals beyond reaffirmation where required.**

---

## 12. Implementation unblock criteria

L-COL-01D implementation may resume **only** when **all** of the following are true:

| # | Criterion | Current |
|---|---|---|
| A | Governed rejection-reason runtime source selected and exists | **Missing** |
| B | Approved rejection reason codes/labels available | **Missing** (`CONFIGURATION_VALUE_PENDING`) |
| C | LaboratoryApi can validate the selected reason source (binding defined) | **Missing** |
| D | Governed accession configuration exists | **Missing** |
| E | Accession format explicitly approved | **Missing** |
| F | Accession uniqueness scope explicitly approved | **Missing** |
| G | Atomic sequence allocation explicitly approved (with period/params) | **Partial** (safety principles only) |
| H | Runtime LaboratoryApi access to accession configuration defined | **Missing** |
| I | Historical immutability behavior approved | **Met** for accession (02E); rejection snapshot mechanics still **DECISION_REQUIRED** |

If **any** criterion is missing:

```text
L-COL-01D = CONFIGURATION_BLOCKED
```

---

## 13. Explicit non-implementation statement

This task performed **no** application implementation.

**NOT done:**

- Receive / Reject / accession / specimen state changes  
- Database schema / migrations  
- MasterValue seeds / entity type registration  
- Rejection codes / accession sequences / prefixes  
- APIs / UI / worklist changes  
- Permissions / role grants  
- Barcode / labels / billing / testing  
- Pathology / Orders / Catalogue / CollectionTask behavior changes  
- `LmsSpecimen` modifications  

---

## 14. Missing items — owner / approval required

| Missing item | Required owner | Required approval |
|---|---|---|
| Select CONFIG-A runtime source (MasterValue vs authorized LMS master) | Product Owner (+ platform if MasterValue entity registration) | Explicit stamp on PD-COL-REC-CONFIG-01 |
| Rejection reason codes + labels (MVP set) | Product Owner / clinical-operational owner | Controlled list — **CONFIGURATION_VALUE_PENDING** |
| Code governance rules (01A) | Product Owner | Explicit answers to §5.4 questions |
| Reason scope (01B) | Product Owner | Tenant vs other supported scope |
| Rejection historical persistence mechanics (01C) | Product Owner | Code-only vs code+label snapshot |
| Accession format elements (02A) | Product Owner | Prefix, structure, date, width, check digit, separators, case, max length |
| Uniqueness scope binding (02B) | Product Owner | Exact scope for DB uniqueness |
| Sequence period/reset/increment/gap (02C/02D) | Product Owner | Explicit parameters |
| Accession config storage binding + LabApi read path (02 + H) | Product Owner + architecture owner | Documented SoT before implementation |
| Config admin permission codes (if new) | Product Owner | Decision-only; **no grants** |

---

## 15. Final status

# SUPERSEDED BY AUTHORIZED IMPLEMENTATION VALUES (2026-10-11)

This closure document originally ended in **CONFIGURATION_BLOCKED**.  
A subsequent Product Owner implementation authorization supplied the missing CONFIG-A / CONFIG-B values and authorized L-COL-01D implementation.

**See:** [enterprise-lms-receiving-accession-implementation.md](./enterprise-lms-receiving-accession-implementation.md)  
**Implementation status:** `IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT`

Historical DECISION_REQUIRED / CONFIGURATION_VALUE_PENDING rows above remain for audit trail; they are superseded by the approved values in the implementation task (MasterValue `lms.specimen_rejection_reason` + accession `ACC-YYYYMMDD-NNNNNN`).
