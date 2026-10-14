# L-COL-01E — Barcode & Labels  
# Product Owner Decision Closure

**Date:** 2026-10-11  
**Slice:** L-COL-01E (Barcode & Labels — decision closure only)  
**Mode:** DOCUMENTATION / PRODUCT OWNER APPROVAL ONLY — no application source, schema, migrations, APIs, UI, barcode generators, label templates, print endpoints, scanner UI, permissions seeding/grants, audit allowlist changes, CollectionTask, Orders, Catalogue, Pathology, Billing, Testing, Receive, or Reject implementation  
**Discovery package:** [enterprise-lms-barcode-label-discovery-audit.md](./enterprise-lms-barcode-label-discovery-audit.md)  
**Prior Receiving & Accession closure:** [enterprise-lms-receiving-accession-decision-closure.md](./enterprise-lms-receiving-accession-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01D_AUTHORIZED`)  
**Prior Specimen Foundation closure:** [enterprise-lms-specimen-receiving-decision-closure.md](./enterprise-lms-specimen-receiving-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01C_AUTHORIZED`)  
**Authoritative PRD/BRD:** `enterprise_laboratory_management_system_prd_brd.docx` (project Library / functional source of truth — repository copy absence is a **repository gap only**, not a PRD-unavailable condition)

```text
L0 · L-CAT-01B · L-ORD-01B · L-ORD-01C · L-COL-01B ACCEPTED
  → L-COL-01C Specimen Foundation + Complete Collection
  → L-COL-01D Receiving & Accession (PRE-UAT / Receive UAT boundary)
  → Discovery audit (READY_FOR_PRODUCT_OWNER_APPROVAL)
  ↓
PD-COL-BAR-* / AD-COL-BAR-* (THIS DOCUMENT)
  ← PRODUCT OWNER APPROVED (2026-10-11)
  ↓
L-COL-01E Barcode & Labels
  ← AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK
  ← NOT IMPLEMENTED BY THIS DOCUMENT
  ↓
Later: Scanning enforcement / Testing / Results (separate slices)
```

---

## 1. Document purpose

This document formally records Product Owner approval of the L-COL-01E Barcode & Labels decision set recommended in the discovery audit, closes the product/architecture decision gate, and authorizes a **separate** bounded implementation task.

**This document does not implement L-COL-01E.**

---

## 2. Product Owner approval statement

Product Owner has **approved** the recommended L-COL-01E decision set (PD-COL-BAR-01 through PD-COL-BAR-20 and AD-COL-BAR-01 through AD-COL-BAR-07) as recorded in this closure, including the exact configuration values in §7.

| Class | Meaning |
|---|---|
| **APPROVED** | Product Owner approved in this closure, or already certified upstream and reaffirmed |
| **APPROVED PRINCIPLE** | Product rule closed; concrete engineering format values remain configuration-owned |
| **DEFERRED** | Explicitly out of L-COL-01E MVP |
| **REJECTED** | Explicitly disallowed |

**Gate determination:**

# PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED

---

## 3. Source hierarchy

| Priority | Source | Role |
|---|---|---|
| 1 | This decision closure | Authoritative L-COL-01E product/architecture stamp |
| 2 | Enterprise LMS PRD/BRD v1.0 (`enterprise_laboratory_management_system_prd_brd.docx`) | Functional SoT (durable barcode, label print/reprint logging, void-cannot-reuse, minimum patient identifiers per policy) |
| 3 | [enterprise-lms-barcode-label-discovery-audit.md](./enterprise-lms-barcode-label-discovery-audit.md) | Discovery evidence + recommended decision package (superseded where this closure stamps APPROVED) |
| 4 | L-COL-01D decision / implementation / PRE-UAT / UAT correction docs | Certified Receive/Reject/accession SoT — **do not reopen** |
| 5 | L-COL-01C specimen decision + implementation/acceptance docs | Specimen birth / Collected SoT |
| 6 | L-COL-01B acceptance/decision docs | CollectionTask lifecycle SoT |
| 7 | Existing LaboratoryApi specimen domain + FE specimens UI | Implementation reality for reuse; not a license to invent barcode SoT |

Where discovery audit recommendations differ from this stamp (e.g. optional scan-to-find, optional DOB, optional void, full GUID on label), **this closure prevails**.

---

## 4. Upstream certified boundaries (immutable)

The following are already approved and **MUST remain unchanged** by L-COL-01E:

| # | Boundary | Status |
|---|---|---|
| A | Specimen GUID ≠ Accession ≠ Barcode | **APPROVED** / reaffirmed |
| B | Accession is created only after successful Receive | **APPROVED** (L-COL-01D) |
| C | Rejected specimens do not receive an accession | **APPROVED** (L-COL-01D) |
| D | Order remains Submitted | **APPROVED** |
| E | OrderTest remains Ordered | **APPROVED** |
| F | CollectionTask lifecycle remains unchanged | **APPROVED** (L-COL-01B) |
| G | Complete Collection creates the Specimen | **APPROVED** (L-COL-01C) |
| H | L-COL-01D Receive/Reject behavior remains unchanged | **APPROVED** |
| I | Receiving does not automatically create a barcode | **APPROVED** / reaffirmed |
| J | Barcode does not become the accession column | **APPROVED** / reaffirmed |
| K | Legacy Pathology is NOT the LMS specimen SoT | **APPROVED** |
| L | LaboratoryApi remains the owner of LMS specimen domain behavior | **APPROVED** |
| M | Platform `audit_log` remains the authoritative audit SoT | **APPROVED** |
| N | Tenant and branch authorization remain in force | **APPROVED** |
| O | No production role grants are to be introduced by this closure | **APPROVED** |
| P | No new organization/site/section hierarchy is to be created | **APPROVED** |
| Q | Do not reopen L-COL-01D unless a concrete defect is discovered | **APPROVED** |

No conflict with the approved PD-COL-BAR-* / AD-COL-BAR-* set was identified.

---

## 5. Product decisions — PD-COL-BAR-01 … PD-COL-BAR-20

### PD-COL-BAR-01 — Barcode identity

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Barcode is a **persistent specimen barcode value**, distinct from Specimen GUID and Accession. **One active barcode value per specimen** for MVP. Barcode values must not be silently reused. A voided barcode value must never be reused. A future replacement barcode, if ever introduced, must be explicitly governed. |
| **MVP boundary** | L-COL-01E MVP does **NOT** introduce a void-and-replace workflow |

### PD-COL-BAR-02 — GUID / Accession / Barcode separation

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Preserve three separate concepts: Specimen GUID ≠ Accession ≠ Barcode. The barcode may be rendered/encoded independently. |
| **Forbidden** | Do **not** collapse barcode into the accession field. Do **not** make accession itself the authoritative barcode value. Use a dedicated barcode value/domain representation |

### PD-COL-BAR-03 — Barcode format / scope

| Field | Content |
|---|---|
| **Status** | **APPROVED PRINCIPLE** — format remains **CONFIGURATION-OWNED** |
| **Rule** | Barcode format is a dedicated LMS configuration. Uniqueness scope is **tenant-wide**. Numbering is **not** branch-specific. No new site/section numbering hierarchy. Database uniqueness must be tenant-scoped |
| **Forbidden** | Do **not** invent a barcode prefix, date structure, sequence width, check digit, branch encoding, or barcode business format during implementation |
| **Recorded values** | `BARCODE_FORMAT = CONFIGURATION-OWNED`; `BARCODE_UNIQUENESS = TENANT-WIDE` |
| **Implementation note** | The implementation task must use the exact configuration recorded here and must **not** silently manufacture a format |

### PD-COL-BAR-04 — Symbology

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | MVP specimen barcode symbology = **CODE 128**. Use existing hospital Code 128 / JsBarcode implementation as a **rendering technique only** |
| **Forbidden reuse** | IOL GS1 semantics; implant UDI semantics; Pathology barcode semantics; patient MRN as specimen barcode identity |
| **Deferred** | QR / DataMatrix / GS1 are **not** part of L-COL-01E MVP |

### PD-COL-BAR-05 — Barcode generation timing

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Barcode is generated/persisted on the first explicit **Generate / Print Specimen Label** operation. A Collected specimen may receive a barcode. A Received specimen may receive a barcode. The label operation is a follow-on explicit action |
| **Forbidden** | Automatic generation when Specimen is created; during Complete Collection; during Receive; during Reject |

### PD-COL-BAR-06 — Rejected specimens

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | (1) If never barcoded → remains without barcode. (2) If already barcoded → retain historical barcode; do not silently generate a replacement; do not reuse for another specimen. (3) Printing a rejected specimen is **not** a new barcode operation. (4) No void-and-replace in L-COL-01E |
| **Recollection** | New CollectionTask → New Specimen → New Barcode; old barcode never reused |

### PD-COL-BAR-07 — Recollection

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Recollection creates a new Specimen. The new Specimen receives a new barcode when label generation is performed. Previous specimen barcode remains historical and **must not** be reused |
| **UX** | Broader recollection UX remains outside L-COL-01E unless already supported by certified upstream workflow |

### PD-COL-BAR-08 — Label contents

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Required** | Barcode symbol; human-readable barcode value; Patient MRN; Patient name; Order number; Collection date/time |
| **Conditional** | Accession, **when an accession exists** (Collected → no accession displayed; Received → accession displayed) |
| **Optional / only if authoritative data already exists** | Specimen type/container; Branch/site name |
| **Forbidden** | Invented clinical identifiers; diagnosis; notes; payer; address; phone; unrelated clinical information; full Specimen GUID by default; new human/business specimen identifier merely for the label |

### PD-COL-BAR-09 — PHI policy

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Allowed on physical labels** | Patient MRN; Patient name |
| **Not included (MVP)** | DOB |
| **Forbidden** | Address; phone; payer; diagnosis; clinical notes; unrelated PHI |
| **Policy** | Minimum-necessary physical label policy |

### PD-COL-BAR-10 — Label lifecycle

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Lifecycle** | Generate/persist barcode → Render label → Print label |
| **Non-mandatory** | Printing is **not** required to complete Complete Collection, Receive, or Reject |
| **Reprint** | Prints the **same** barcode; does not generate a new barcode; requires a reason; is audited |
| **Forbidden** | Silent barcode replacement; void-and-replace in MVP |

### PD-COL-BAR-11 — Printing architecture

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **MVP mechanism** | Browser isolated print window. Reuse existing Hospital Portal isolated-print technique. LMS owns specimen label HTML/layout |
| **Forbidden / deferred** | Print microservice; enterprise print server; printer queue; network printer service; ZPL service; thermal printer fleet management; thermal/ZPL; PDF download |

### PD-COL-BAR-12 — Reprint

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Same barcode; same specimen; no new barcode; mandatory reason; authenticated actor; platform audit entry. A reprint is a new operational event even though the barcode value is unchanged |
| **Permission** | `lms.specimens.label.reprint` |
| **Audit** | `REPRINT_SPECIMEN_LABEL` |

### PD-COL-BAR-13 — Lost / damaged label

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Lost/damaged label → audited reprint of the **same** barcode. Do **not** generate a new barcode |
| **Deferred** | Void + replacement barcode |
| **Forbidden** | Unaudited bedside relabel workflow |

### PD-COL-BAR-14 — Scanning scope

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Core MVP** | Barcode generation; persistence; display; label printing; label reprinting |
| **Not included** | Scan-to-receive; scan-to-verify; full SPC-02 barcode hard-stop enforcement; wristband scanner program; scanner hardware integration |
| **Deferred** | Scan-to-find is **deferred** from core L-COL-01E |
| **Forbidden** | Do not implement scanner UI in L-COL-01E |

### PD-COL-BAR-15 — Validation / uniqueness

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Barcode value unique within the tenant. Database uniqueness is authoritative. Duplicate barcode assignment must fail safely. No check digit unless future configuration explicitly introduces one |
| **Out of core MVP** | Unknown barcode behavior (scan-to-find deferred) |

### PD-COL-BAR-16 — Branch / tenant scope

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Barcode format and sequence are tenant-wide. Printing authorized within the user's existing authorized branch context. Browser printing uses the user's local workstation printer selection |
| **Forbidden** | New site master; section master; printer master; branch-specific barcode numbering hierarchy |

### PD-COL-BAR-17 — Permissions

| Field | Content |
|---|---|
| **Status** | **APPROVED** (catalog for future implementation) |
| **Codes** | `lms.specimens.barcode.view`; `lms.specimens.label.print`; `lms.specimens.label.reprint` |
| **Behavior** | `barcode.view` → view barcode value/rendering; `label.print` → first barcode generation/label printing; `label.reprint` → reprint existing barcode |
| **Forbidden** | Role grants; assignment to any role/user during this closure; silent inheritance of broad Admin grants beyond existing platform behavior |

### PD-COL-BAR-18 — Audit actions

| Field | Content |
|---|---|
| **Status** | **APPROVED** (future platform audit actions) |
| **Actions** | `CREATE_SPECIMEN_BARCODE`; `PRINT_SPECIMEN_LABEL`; `REPRINT_SPECIMEN_LABEL` |
| **Not added** | `VOID_SPECIMEN_LABEL` (void deferred from MVP) |
| **Resource** | `LmsSpecimen` |
| **SoT** | Platform `audit_log` remains sole authoritative audit source. Mutating operations must fail closed if required audit persistence cannot be completed |

### PD-COL-BAR-19 — Idempotency

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Operation-specific idempotency for barcode assignment/generation, initial label print, and label reprint. Same key + same request hash → replay existing result. Same key + different request hash → idempotency conflict. Reprint remains a distinct audited event |
| **Forbidden** | Incorrect reuse of Receive/Reject operation semantics |

### PD-COL-BAR-20 — Concurrency

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Mutations that change specimen barcode state use existing RowVersion optimistic concurrency. ExpectedRowVersion mismatch → `409 concurrency_conflict`. Do not weaken existing concurrency behavior. Pure rendering of an already persisted barcode may be non-mutating. Backend print/reprint event recording remains audited |

---

## 6. Architecture decisions — AD-COL-BAR-01 … AD-COL-BAR-07

### AD-COL-BAR-01 — System ownership

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | LaboratoryApi owns LMS specimen barcode and label domain behavior. No separate barcode service. No separate print microservice. No Pathology ownership |

### AD-COL-BAR-02 — Database shape

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Model** | Hybrid: persist the current active barcode associated with the specimen **and** retain append-only label/print operational history |
| **Allowed engineering choices** | (A) barcode field/current barcode representation + print event table; or (B) dedicated current barcode entity + print event table |
| **Selection rule** | Engineering chooses the simpler model that preserves: one active barcode per specimen; uniqueness; history; reprint audit; future void semantics without redesign |
| **Forbidden** | Using `audit_log` alone as the barcode state store; collapsing barcode into accession |

### AD-COL-BAR-03 — Identifier separation

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Specimen GUID ≠ Accession ≠ Barcode. No exceptions in implementation |

### AD-COL-BAR-04 — Printing architecture

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | `hospital-portal-web` browser isolated print. LaboratoryApi persists barcode state and audit-relevant print events. No print microservice; no enterprise printer fleet; no ZPL; no thermal adapter |

### AD-COL-BAR-05 — Audit

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Platform `audit_log` is the authoritative audit source. LaboratoryApi may use the existing internal audit mechanism. Audit allowlist additions are permitted **only** during the separate L-COL-01E implementation task. **No audit code changes in this decision-closure task** |

### AD-COL-BAR-06 — Configuration source

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Do not create a duplicate configuration platform. Barcode format/sequence remains LMS configuration-owned. Exact barcode format is intentionally **not** invented in this closure. Code 128 is approved MVP symbology. Label template may be LMS-owned code/HTML for MVP |
| **Forbidden** | CMS/template registry unless separately approved |

### AD-COL-BAR-07 — Pathology boundary

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Legacy Pathology is **not** the LMS barcode/label source of truth. Do not migrate or promote Auth LabReport barcode fields, Pathology specimen fields, or legacy laboratory barcode assumptions into LMS |

---

## 7. Exact configuration values

| Key | Value |
|---|---|
| `BARCODE_SYMBOLOGY` | `CODE128` |
| `BARCODE_SCOPE` | `TENANT` |
| `BARCODE_FORMAT` | `CONFIGURATION-OWNED` — **NO ENGINEERING-INVENTED PREFIX/DATE/WIDTH/CHECK-DIGIT** |
| `BARCODE_UNIQUENESS` | `TENANT-WIDE` |
| `LABEL_PHI` | `MRN + PATIENT_NAME` |
| `LABEL_DOB` | `NO` |
| `LABEL_ACCESSION` | `YES_WHEN_PRESENT` |
| `LABEL_ORDER_NUMBER` | `YES` |
| `LABEL_COLLECTION_DATETIME` | `YES` |
| `LABEL_SPECIMEN_TYPE` | `ONLY_IF_AUTHORITATIVE_EXISTING_DATA_AVAILABLE` |
| `LABEL_BRANCH` | `OPTIONAL / IF AUTHORITATIVE` |
| `LABEL_FULL_GUID` | `NO` |
| `PDF_LABEL` | `NO` |
| `THERMAL_PRINTING` | `NO` |
| `ZPL` | `NO` |
| `PRINTER_FLEET` | `NO` |
| `SCAN_TO_FIND` | `NO` |
| `SCAN_TO_RECEIVE` | `NO` |
| `SCAN_TO_VERIFY` | `NO` |
| `VOID_IN_MVP` | `NO` |
| `VOID_AND_REPLACE` | `NO` |
| `REPRINT` | `YES` |
| `REPRINT_SAME_BARCODE` | `YES` |
| `REPRINT_REASON` | `REQUIRED` |
| `REPRINT_AUDIT` | `REQUIRED` |
| `ROLE_GRANTS` | `NO` |

---

## 8. In-scope implementation boundary (future task only)

After this closure, a **separate** L-COL-01E implementation task may include:

1. Durable specimen barcode persistence  
2. Explicit barcode generation  
3. Barcode display  
4. Code 128 rendering  
5. Label rendering  
6. Browser isolated print  
7. Reprint same barcode  
8. Reprint reason  
9. Permission enforcement  
10. Platform audit  
11. Operation-specific idempotency  
12. RowVersion concurrency  
13. Tenant uniqueness  
14. Collected specimens  
15. Received specimens  
16. Existing Specimens worklist/detail UI  
17. Automated tests  
18. PRE-UAT verification  
19. Manual UAT  

---

## 9. Explicit out-of-scope boundary

- Scan-to-find  
- Scan-to-receive  
- Scan-to-verify  
- Barcode hard-stop matrix  
- Custody  
- Aliquots  
- Referral receiving  
- Testing / Results / Verification / Authorization / Reporting  
- Billing / Payment  
- QC / instrument integration  
- Thermal printers / ZPL / print queues / printer fleet management  
- Pathology migration  
- Order changes / OrderTest changes / CollectionTask changes  
- Receive changes / Reject changes  
- Ownership / reassignment / specimen claim/assignment  
- Void-and-replace  
- Production role grants  
- New organization/site hierarchy  

---

## 10. Security / PHI decision

| Decision | Status |
|---|---|
| Physical labels may contain MRN + patient name | **APPROVED** |
| DOB on label | **NO** (MVP) |
| Address / phone / payer / diagnosis / clinical notes / unrelated PHI | **Forbidden** |
| Full Specimen GUID on label by default | **NO** |
| Minimum-necessary physical label policy | **APPROVED** |
| Print/reprint require permission + audit | **APPROVED** |
| Tenant isolation + branch authorization for print context | **APPROVED** |

---

## 11. Permission decision

| Code | Purpose | Grants in this closure |
|---|---|---|
| `lms.specimens.barcode.view` | View barcode value/rendering | **NONE** |
| `lms.specimens.label.print` | First barcode generation / label printing | **NONE** |
| `lms.specimens.label.reprint` | Reprint existing barcode | **NONE** |

Permission catalog entries are approved for the **future implementation task** only. No role grants. No user assignments. No silent Admin expansion beyond existing platform behavior.

---

## 12. Audit decision

| Action | When | In MVP |
|---|---|---|
| `CREATE_SPECIMEN_BARCODE` | First barcode generation/persistence | **Yes** |
| `PRINT_SPECIMEN_LABEL` | Initial label print event | **Yes** |
| `REPRINT_SPECIMEN_LABEL` | Reprint (same barcode) | **Yes** |
| `VOID_SPECIMEN_LABEL` | Void | **No** — deferred |

- Resource type: `LmsSpecimen`  
- Platform `audit_log` is the sole authoritative audit SoT  
- Mutating operations fail closed if required audit persistence cannot complete  
- Allowlist additions permitted **only** in the separate implementation task  

---

## 13. Idempotency / concurrency decision

| Topic | Decision |
|---|---|
| Idempotency | Operation-specific for barcode assignment/generation, initial print, and reprint |
| Same key + same hash | Replay existing result |
| Same key + different hash | Idempotency conflict |
| Reprint | Distinct audited event even when barcode value unchanged |
| Concurrency | RowVersion / ExpectedRowVersion; mismatch → `409 concurrency_conflict` |
| Pure render | May be non-mutating for already-persisted barcode |
| Backend print/reprint recording | Remains audited |

---

## 14. UAT prerequisites (for future implementation)

| Dependency | Required? | Notes |
|---|---|---|
| Collected specimen (no accession) | **Yes** | Label-before-receive path; accession not displayed |
| Received specimen + accession | **Yes** | Accession displayed when present |
| Rejected specimen | **Optional** | Retain historical barcode / no new barcode; do not manufacture Reject data solely for UAT |
| Configured barcode format | **Yes** | Must use LMS configuration; must not invent format |
| Label field / PHI policy | **Yes** | Closed in §7 |
| Browser print environment | **Yes** | Staff workstation isolated print |
| Thermal printer | **No** | Deferred |
| Scanner hardware | **No** | Scan-to-find deferred |

Do **not** create test data as part of this decision-closure task.

---

## 15. Implementation gate

| Field | Content |
|---|---|
| **Slice** | L-COL-01E — Barcode & Labels |
| **Gate status** | `PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED` |
| **Authorization** | **AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK** |
| **This document** | Does **not** implement L-COL-01E |
| **Next step** | Separate Cursor / engineering implementation task against this closure |
| **Configuration prerequisite** | Barcode payload format/sequence remains `CONFIGURATION-OWNED` — implementation must bind to governed LMS configuration and must not invent prefix/date/width/check-digit |

---

## 16. Final decision register

| ID | Topic | Status |
|---|---|---|
| PD-COL-BAR-01 | Persistent barcode identity; one active; no silent reuse | **APPROVED** |
| PD-COL-BAR-02 | GUID ≠ Accession ≠ Barcode; dedicated barcode representation | **APPROVED** |
| PD-COL-BAR-03 | Format configuration-owned; uniqueness tenant-wide | **APPROVED PRINCIPLE** |
| PD-COL-BAR-04 | Symbology CODE 128 | **APPROVED** |
| PD-COL-BAR-05 | Generate on first Generate/Print Label; not auto on collect/receive/reject | **APPROVED** |
| PD-COL-BAR-06 | Rejected retain / no replacement; no void-and-replace | **APPROVED** |
| PD-COL-BAR-07 | Recollection → new specimen → new barcode | **APPROVED** |
| PD-COL-BAR-08 | MVP label field set | **APPROVED** |
| PD-COL-BAR-09 | PHI = MRN + name; DOB no | **APPROVED** |
| PD-COL-BAR-10 | Explicit print lifecycle; reprint same barcode | **APPROVED** |
| PD-COL-BAR-11 | Browser isolated print MVP | **APPROVED** |
| PD-COL-BAR-12 | Reprint same barcode + reason + audit | **APPROVED** |
| PD-COL-BAR-13 | Lost/damaged = audited reprint; void+replace deferred | **APPROVED** |
| PD-COL-BAR-14 | No scanner UI; scan-to-find deferred | **APPROVED** |
| PD-COL-BAR-15 | Tenant uniqueness; safe duplicate failure | **APPROVED** |
| PD-COL-BAR-16 | Tenant format/sequence; branch auth for print | **APPROVED** |
| PD-COL-BAR-17 | Permission catalog; no role grants | **APPROVED** |
| PD-COL-BAR-18 | CREATE / PRINT / REPRINT audit; no VOID | **APPROVED** |
| PD-COL-BAR-19 | Operation-specific idempotency | **APPROVED** |
| PD-COL-BAR-20 | RowVersion concurrency | **APPROVED** |
| AD-COL-BAR-01 | LaboratoryApi ownership | **APPROVED** |
| AD-COL-BAR-02 | Hybrid barcode + print history | **APPROVED** |
| AD-COL-BAR-03 | Identifier separation | **APPROVED** |
| AD-COL-BAR-04 | Browser isolated print architecture | **APPROVED** |
| AD-COL-BAR-05 | Platform audit_log SoT | **APPROVED** |
| AD-COL-BAR-06 | LMS configuration-owned format; code/HTML label MVP | **APPROVED** |
| AD-COL-BAR-07 | Pathology not LMS barcode SoT | **APPROVED** |

---

## 17. Confirmation — this task

- NO APPLICATION IMPLEMENTATION  
- NO DATABASE / MIGRATION  
- NO BARCODE COLUMN / ENTITY / GENERATOR / SEQUENCE  
- NO LABEL TEMPLATE / PRINT ENDPOINT / PRINT UI / SCANNER UI  
- NO BARCODE / LABEL API  
- NO PERMISSION SEEDING / ROLE GRANTS  
- NO AUDIT ALLOWLIST CHANGES  
- NO L-COL-01D / L-COL-01C / L-COL-01B BEHAVIOR CHANGES  
- NO PATHOLOGY / ORDERS / CATALOGUE / COLLECTION / BILLING / TESTING CHANGES  

---

## FINAL STATUS

**PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED**

**L-COL-01E = AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK**

**STOP.** Do not implement L-COL-01E in this task. Do not generate barcode schema, APIs, UI, permissions, or audit actions in this task.
