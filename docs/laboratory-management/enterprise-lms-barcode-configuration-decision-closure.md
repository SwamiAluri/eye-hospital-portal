# CONFIG-BAR-01 — LMS Specimen Barcode Configuration Decision Closure

**Date:** 2026-10-11  
**Slice:** L-COL-01E / CONFIG-BAR-01 (barcode format + allocation configuration only)  
**Mode:** DOCUMENTATION / PRODUCT OWNER CONFIGURATION GATE ONLY — **no** application source, schema, migrations, APIs, UI, permissions, audit allowlist, role grants, barcode libraries, L-COL-01D changes, Testing, Results, Custody, Aliquots, Referral, Billing, QC, or Instruments  
**Authoritative product closure:** [enterprise-lms-barcode-label-decision-closure.md](./enterprise-lms-barcode-label-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED`)  
**Discovery audit:** [enterprise-lms-barcode-label-discovery-audit.md](./enterprise-lms-barcode-label-discovery-audit.md)  
**Implementation gate (missing config):** [enterprise-lms-barcode-configuration-blocked.md](./enterprise-lms-barcode-configuration-blocked.md) (`CONFIGURATION_BLOCKED`)  
**Authoritative PRD/BRD:** `enterprise_laboratory_management_system_prd_brd.docx` (Library / functional SoT — repository copy absence is a repository gap only)

```text
PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED
  → Implementation attempt: CONFIGURATION_BLOCKED (CONFIG-BAR-01 missing)
  ↓
THIS DOCUMENT — CONFIG-BAR-01 audit + PO decision register
  → Re-audit: no bindable governed barcode format/allocator found
  ↓
FINAL GATE (this task): CONFIGURATION_BLOCKED
  → NO application implementation authorized
  → STOP until Product Owner / platform supplies missing values
```

---

## Status

> **Superseded for implementation (2026-10-11):** Product Owner approved CONFIG-BAR-01 values in the L-COL-01E fresh implementation authorization (`SPC-YYYYMMDD-NNNNNN`, PostgreSQL tenant/UTC-day allocator, CODE128, tenant-wide uniqueness, next-UTC-day activation). Runtime binding is implemented via LMS-owned `lms_specimen_barcode_configurations` — see [enterprise-lms-barcode-label-implementation.md](./enterprise-lms-barcode-label-implementation.md).
>
> Historical gate text below is retained for audit trail.

# CONFIGURATION_BLOCKED *(historical — closed by PO-approved implementation authorization)*

LMS specimen barcode **format** and **allocation** were **not** authoritatively defined in a bindable runtime configuration source at the time of this documentation gate.

Symbology, uniqueness scope, generation timing, label PHI, print/reprint, permissions, audit action names, and related L-COL-01E product rules remain as previously approved — **not reopened**. Those approvals do **not** supply a barcode payload format or allocator.

**This document does not implement L-COL-01E.**  
**This document does not invent barcode format values.**

---

## 1. Decision

| Question | Answer |
|---|---|
| Are LMS barcode format and allocation now authoritatively defined? | **No** |
| Can LaboratoryApi bind without inventing semantics? | **No** |
| Gate status | **CONFIGURATION_BLOCKED** |
| Fresh L-COL-01E implementation authorized by this document? | **No** |

---

## 2. Certified barcode decisions (not reopened)

These remain **APPROVED** from the L-COL-01E Product Decision Closure. This CONFIG-BAR-01 task does not change them.

| Topic | Approved value |
|---|---|
| Identity | Specimen GUID ≠ Accession ≠ Barcode |
| Forbidden silent identities | Specimen GUID, Accession, Order number, CollectionTask number, Patient MRN |
| Symbology | `CODE128` (**rendering only** — not payload format) |
| Scope | `TENANT` |
| Uniqueness | `TENANT-WIDE` |
| Generation timing | Only via Generate / Print Label — not auto on Complete Collection / Receive / Reject |
| Rejected | Retain existing barcode if present; no replacement; no auto-generate if absent |
| Recollection | New specimen → new barcode; never reuse |
| Label PHI | MRN + Patient name; Order number; Collection date/time; Accession when present; no DOB / address / phone / payer / diagnosis / notes / full GUID |
| Printing | Browser isolated print; reprint same barcode + reason + audit; no thermal/ZPL/fleet/scanner/void/replacement/scan-to-find |
| Permissions (catalog names) | `lms.specimens.barcode.view` / `label.print` / `label.reprint` — **no role grants** |
| Audit actions (future) | `CREATE_SPECIMEN_BARCODE` / `PRINT_SPECIMEN_LABEL` / `REPRINT_SPECIMEN_LABEL` — no VOID |
| Idempotency ops | `assign_barcode` / `print_label` / `reprint_label` |
| Concurrency | Database/concurrency authoritative; in-memory semaphore not correctness |
| Ownership | LaboratoryApi + shared PostgreSQL `lms_*`; platform `audit_log` |

### Format vs symbology (critical)

```text
CODE128  =  symbology / rendering decision   (APPROVED)
≠
barcode payload format / allocation          (STILL MISSING)
```

A CODE128 renderer elsewhere in Hospital Portal (e.g. patient MRN cards) does **not** establish LMS specimen barcode identity.

---

## 3. Existing configuration source audit

### 3.1 Searched areas

| Area | Result for LMS specimen barcode format/allocator |
|---|---|
| LaboratoryApi Domain / Services / Migrations / Tests | **No** barcode format, sequence, prefix, or allocator config |
| LaboratoryApi `appsettings*.json` | **No** barcode keys |
| AuthService MasterValue / entity_type_registry seeds | **No** barcode format entity type; `lms.specimen_rejection_reason` is reject reasons only |
| AuthService / microservice `appsettings*.json` barcode keys | **No** |
| FE system-settings / tenant configuration APIs | **No** specimen barcode identifier configuration |
| LMS numbering tables | Order / CollectionTask / Accession sequences only — **not** barcode SoT |
| Docs / prior CONFIG-BAR-01 blocked report | Confirms missing bindable source — **reaffirmed** |

### 3.2 Exact source found

**None.**

No authoritative governed runtime configuration source exists that provides LMS specimen barcode payload format + allocation for LaboratoryApi binding.

### 3.3 Candidates examined — not authoritative

| Candidate | Why it exists | Why not CONFIG-BAR-01 SoT |
|---|---|---|
| Accession `ACC-YYYYMMDD-NNNNNN` + `lms_accession_number_sequences` | L-COL-01D accession | Separate identity; copying is forbidden |
| Order `LAB-*` + `lms_order_number_sequences` | Order numbering | Wrong identity |
| CollectionTask `COL-*` + `lms_collection_task_number_sequences` | Collection task numbering | Wrong identity |
| Specimen GUID | Specimen PK | Forbidden as silent barcode identity |
| Patient MRN + CODE128 rendering | Patient card UX | Wrong identity; symbology ≠ payload |
| Inventory scanner / IOL GS1 / implant UDI | Other domains | Forbidden semantics |
| Journey / safety token barcode | Wristband / wrong-eye safety | Wrong SoT |
| Pathology LabReport / laboratory UI | Legacy Pathology | Not LMS barcode SoT |
| MasterValue `lms.specimen_rejection_reason` | Rejection reasons | Wrong domain |
| Catalogue / specimen type masters | Clinical/catalogue values | Not barcode identity |
| Engineer-invented `BAR-` / `SPC-` / GUID / random / date formats | Would unblock coding | **Explicitly forbidden** |

---

## 4. Configuration values

| Field | Value |
|---|---|
| Configuration source | **MISSING** |
| Configuration keys | **MISSING** |
| Barcode format / template | **MISSING** (remains `CONFIGURATION-OWNED`) |
| Prefix | **MISSING** — not invented; not assumed “none” |
| Date segment | **MISSING** — not invented; not assumed “none” |
| Sequence segment / width | **MISSING** |
| Separator | **MISSING** |
| Check digit | **MISSING** — not invented; not assumed “none” |
| Allowed characters / max length | **MISSING** |
| Allocation mechanism | **MISSING** |
| Sequence period / reset | **MISSING** (if sequential) |
| Random/UUID rule | **MISSING** (if non-sequential) |
| Uniqueness | Product-approved **TENANT-WIDE**; **DB enforcement not yet implementable** without format/allocator |
| Effective / activation behavior | **MISSING** |
| Historical immutability / no reuse | Product-approved **principle**; runtime bind pending |

---

## 5. Product Owner decisions closed (principles only)

These CONFIG-BAR-01-adjacent principles are already closed by the L-COL-01E Product Decision Closure and are **reaffirmed**, not newly invented:

| Decision | Status |
|---|---|
| Symbology = CODE128 | **APPROVED** (symbology only) |
| Scope = TENANT | **APPROVED** |
| Uniqueness = TENANT-WIDE | **APPROVED** |
| Barcode distinct from GUID / Accession / MRN / Order / CollectionTask | **APPROVED** |
| Format must not be invented by engineering | **APPROVED** |
| Values immutable once issued; never reused | **APPROVED** (principle) |
| No scanner / thermal / ZPL / void / replacement / Pathology barcode migration | **APPROVED** (non-goals) |
| No new configuration platform invented by this closure | **APPROVED** constraint |

---

## 6. Decisions still required (bounded PO table)

| Decision | Current state | Required Product Owner decision |
|---|---|---|
| Runtime source | **Missing** | Select governed source LaboratoryApi may bind (existing tenant/LMS/MasterValue/config mechanism — **or** explicitly authorize a new LMS config artifact). Do not invent a second platform casually. |
| Configuration key(s) / entity fields | **Missing** | Name exact keys/entity fields |
| Format / payload template | **Missing** | Define exact format (prefix, date, sequence, separators, width, check digit, charset, max length) — including explicit **none** where intentional |
| Allocation | **Missing** | Define allocator (DB sequence / tenant counter / governed allocator / other **already-approved** mechanism). Do not let engineering choose. |
| Sequence period / reset | **Missing** (if sequential) | Define period and reset behavior, or explicitly N/A |
| Prefix | **Missing** | Define value **or** explicitly **none** |
| Date segment | **Missing** | Define value **or** explicitly **none** |
| Width | **Missing** | Define numeric width / padding rules if sequential |
| Check digit | **Missing** | Define algorithm **or** explicitly **none** |
| Effective / activation behavior | **Missing** | Define effective date, active/inactive, and behavior when config changes |
| Historical immutability | Principle approved | Confirm persistence rule: issued values remain immutable; config change must not rewrite historical barcodes |
| Tenant uniqueness | **Approved** TENANT-WIDE | Reaffirm DB unique `(tenant_id, barcode_value)` at implementation time |
| Symbology | **Approved** CODE128 | No further PO action required for symbology |

**Architectural note (evaluation only — not selected):** Platform MasterValue can hold selectable master codes, but it does **not** today hold barcode format/sequence policy, and using it for sequential allocation would still require a separate atomic allocator. LMS number-sequence **tables** exist as a **pattern** for Order/Collection/Accession — **reuse of pattern is not approval of barcode format**. Selecting either approach remains **DECISION_REQUIRED**.

---

## 7. Configuration source / keys / format / allocation (closure fields)

| Closure field | Content |
|---|---|
| **Configuration source** | **Not established** |
| **Configuration keys** | **Not established** |
| **Barcode format** | **Not established** |
| **Allocation** | **Not established** |
| **Scope** | **TENANT-WIDE** (product-approved; not a substitute for format) |
| **Uniqueness** | **TENANT-WIDE** and must be **DB-enforced** when implemented — enforcement deferred until format/allocator exist |
| **Effective behavior** | **Not established** |
| **Historical behavior** | Issued barcode values are **immutable**; **no reuse** (product principle — reaffirmed) |

---

## 8. Non-goals (confirmed)

| Non-goal | Confirmed |
|---|---|
| Accession remains separate | **Yes** |
| Specimen GUID remains separate | **Yes** |
| MRN remains separate | **Yes** |
| Order number remains separate | **Yes** |
| CollectionTask number remains separate | **Yes** |
| No scanner workflow | **Yes** |
| No thermal / ZPL | **Yes** |
| No void | **Yes** |
| No replacement barcode | **Yes** |
| No Pathology barcode migration | **Yes** |
| No inventing `BAR-` / `SPC-` / `LAB-` / GUID / MRN / accession barcodes | **Yes** |
| No seeding fake UAT/default production-like format | **Yes** |
| No configuration tables / migrations / APIs in this task | **Yes** |

---

## 9. LaboratoryApi binding (future only — not implemented)

When CONFIG-BAR-01 is closed with concrete source + values, LaboratoryApi must:

1. Read the certified configuration source by the approved keys.  
2. Allocate the next barcode using the certified allocator (database-authoritative).  
3. Persist a durable barcode value distinct from GUID and accession.  
4. Enforce tenant-wide uniqueness in the database.  
5. Fail closed if configuration is missing/inactive or allocation cannot complete.  
6. Never accept client-supplied barcode identity/format.

**Not implemented in this task.**

---

## 10. Application / database / API / permission / audit confirmation

| Area | Changed by this task? |
|---|---|
| LaboratoryApi source | **No** |
| AuthService source | **No** |
| Frontend source | **No** |
| Database schema / migrations | **No** |
| Permissions / role grants | **No** |
| Audit allowlists | **No** |
| L-COL-01B / 01C / 01D behavior | **No** |
| Documentation (this closure) | **Yes** |

---

## 11. Regression confirmation

Unchanged (no code touched):

- L-COL-01B CollectionTask  
- L-COL-01C Complete Collection  
- L-COL-01D Receive / Reject / accession allocation  
- Order / OrderTest  
- Catalogue  
- Pathology  

---

## 12. L-COL-01E implementation readiness

| Item | Ready? |
|---|---|
| Product decisions PD-COL-BAR-* / AD-COL-BAR-* | Yes (prior closure) |
| Symbology / PHI / print / reprint / permissions names / audit names | Yes (prior closure) |
| CONFIG-BAR-01 format + allocation + runtime source | **No — blocked** |
| Fresh L-COL-01E implementation task | **Not authorized** until CONFIG-BAR-01 closed with bindable values |

---

## 13. Unblock criteria

All of the following must be Product Owner / platform certified before a fresh L-COL-01E implementation task may proceed:

1. Exact runtime configuration source  
2. Exact configuration keys / entity fields  
3. Exact barcode payload format (including explicit none for unused segments)  
4. Exact allocation mechanism (atomic / multi-instance safe)  
5. Exact effective / activation / config-change behavior  
6. Affirmation that historical issued values remain immutable and are never reused  

Then: **PRODUCT_DECISION_CLOSED_CONFIG_BINDING_READY** may be recorded in a successor stamp, and a **separate** L-COL-01E implementation task may be issued.

---

## 14. Next gate

```text
CONFIGURATION_BLOCKED
  → Wait for Product Owner / platform CONFIG-BAR-01 values
  → Do NOT implement L-COL-01E
  → Do NOT invent format
  → Do NOT start Testing / Results / Custody / Aliquots / Referral / Billing
```

---

## FINAL STATUS

**CONFIGURATION_BLOCKED**

**STOP.** Do not implement barcode generation. Do not create migrations, APIs, UI, permissions, audit actions, or role grants in this task.
