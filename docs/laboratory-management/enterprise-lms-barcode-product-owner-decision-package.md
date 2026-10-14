# CONFIG-BAR-01 — LMS Specimen Barcode  
# Product Owner Decision Package

**Date:** 2026-10-11  
**Slice:** L-COL-01E / CONFIG-BAR-01  
**Mode:** DOCUMENTATION ONLY — Product Owner decision preparation  
**Not:** implementation specification, schema design, or format invention  

**Authoritative prior status:**

| Document | Status |
|---|---|
| [enterprise-lms-barcode-label-decision-closure.md](./enterprise-lms-barcode-label-decision-closure.md) | `PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED` |
| [enterprise-lms-barcode-configuration-blocked.md](./enterprise-lms-barcode-configuration-blocked.md) | `CONFIGURATION_BLOCKED` |
| [enterprise-lms-barcode-configuration-decision-closure.md](./enterprise-lms-barcode-configuration-decision-closure.md) | `CONFIGURATION_BLOCKED` |

```text
L-COL-01E product decisions CLOSED
  → CONFIG-BAR-01 format/allocator MISSING
  → CONFIGURATION_BLOCKED
  ↓
THIS PACKAGE — make remaining PO decisions explicit and approvable
  → NO implementation
  → NO invented format
  → STOP until Product Owner stamps §10
```

---

## 1. Purpose

Make the **remaining** CONFIG-BAR-01 Product Owner / platform decisions explicit and easy to approve.

This package does **not**:

- select a format  
- select an allocator  
- select a configuration source  
- create configuration tables, APIs, UI, migrations, or MasterValue extensions  
- authorize L-COL-01E implementation  

---

## 2. Authoritative status (do not reopen)

Already established:

| Topic | Approved |
|---|---|
| Identity | Specimen GUID ≠ Accession ≠ Barcode |
| Symbology | CODE128 (rendering only — **not** payload format) |
| Scope | TENANT |
| Uniqueness | TENANT-WIDE |
| Generation | Only via explicit Generate / Print Label lifecycle |
| Auto-generate on Complete Collection / Receive / Reject | **Forbidden** |
| Rejected specimen | Retains existing barcode if present; no auto-generate if absent |
| Recollection | New specimen → new barcode |
| Issued values | Immutable; never reused |
| Print | Browser-isolated print |
| Reprint | Same barcode; reason required; audited |
| Scanner / thermal / ZPL / void / replacement / Pathology barcode migration | **Out of scope** |
| Role grants | **None** |
| Domain owner | LaboratoryApi |
| Concurrency authority | PostgreSQL / database (not in-memory) |
| Audit SoT | Platform `audit_log` |

---

## 3. Current blocker

Still **undefined** (Product Owner / platform only):

1. Runtime configuration source  
2. Configuration keys / entity fields  
3. Exact barcode payload format  
4. Allocation mechanism  
5. Sequence period / reset (if sequential)  
6. Effective / activation behavior  
7. Configuration-change behavior  
8. Historical binding behavior (mechanics beyond the approved immutability principle)

Engineering must **not** choose these silently.

---

## 4. Decision table

| Decision | Current State | Product Owner Decision |
|---|---|---|
| Configuration source | Missing | Select approved runtime source |
| Configuration keys | Missing | Define exact keys/entity fields |
| Barcode format | Missing | Define exact payload |
| Prefix | Missing | Define value or explicitly **NONE** |
| Date segment | Missing | Define value or explicitly **NONE** |
| Sequence | Missing | Define value/allocation |
| Width | Missing | Define if sequential |
| Separator | Missing | Define if applicable |
| Check digit | Missing | Define algorithm or **NONE** |
| Charset | Missing | Define allowed characters |
| Max length | Missing | Define |
| Allocation | Missing | Define atomic allocator |
| Sequence period | Missing | Define or **N/A** |
| Reset | Missing | Define or **N/A** |
| Effective date | Missing | Define |
| Configuration changes | Missing | Define behavior |
| Historical values | Principle approved | Immutable / never reused |
| Scope | Approved | TENANT |
| Uniqueness | Approved | TENANT-WIDE |
| Symbology | Approved | CODE128 |

---

## 5. Product Owner options (categories only — not selected)

Do **not** treat the following as approved choices. They are decision categories for Product Owner selection.

### A. Payload format (categories)

- Structured human-readable identifier  
- Opaque sequential identifier  
- Opaque random identifier  
- Another governed institutional identifier  

**Product Owner must specify the actual format.**  
No concrete prefix or number pattern is proposed or approved by this package.

### B. Allocation (categories)

- PostgreSQL sequence  
- Tenant-scoped atomic counter  
- Existing governed identifier allocator  
- Another approved allocator  

**Product Owner must select.**  
Whichever is chosen must be safe across **multiple LaboratoryApi instances**.

### C. Configuration source (categories)

- Existing tenant configuration infrastructure  
- Existing LMS configuration infrastructure  
- Existing governed platform configuration  
- Explicitly approved **new** LMS configuration artifact  

**Do not create** a new artifact in this task. Creation requires a separate Product Owner / Architecture authorization.

---

## 6. Required product safety constraints

Regardless of eventual format, these remain mandatory:

- Barcode ≠ GUID  
- Barcode ≠ accession  
- Barcode ≠ MRN  
- Barcode ≠ order number  
- Barcode ≠ CollectionTask number  
- Tenant-wide uniqueness  
- Database-enforced uniqueness  
- No client-selected barcode identity  
- No barcode reuse  
- No silent regeneration  
- No automatic generation during collection / receiving / rejection  
- Existing barcode remains stable  
- Reprint does not change barcode  
- Recollection receives a new barcode  
- Configuration changes must not rewrite historical barcodes  

---

## 7. Historical configuration binding

**Product Owner question:**

When barcode configuration changes in the future, should existing issued barcode values remain exactly as issued under the historical configuration?

**Approved product principle:**

```text
YES — issued values are IMMUTABLE and NEVER REUSED.
```

Configuration versioning is **not** designed or implemented in this task. Future implementation must preserve issued values when config changes.

---

## 8. Multi-instance requirement (future implementation constraint)

The eventual allocator must be correct when multiple LaboratoryApi instances allocate barcodes concurrently.

Therefore (future constraint, not implemented here):

- In-memory locks **cannot** be correctness authority  
- `MAX()+1` allocation is **prohibited**  
- Application-process-local counters are **prohibited**  
- Database atomic allocation is required unless another already governed allocator is **explicitly** approved  

---

## 9. Explicit non-creation

This task does **not** create:

- Barcode configuration tables  
- MasterValue extensions  
- Configuration APIs  
- Sequence tables  
- Configuration UI  
- Migrations  
- LaboratoryApi / AuthService / frontend changes  
- Permissions / audit allowlist / role grants  

---

## 10. CONFIG-BAR-01 PRODUCT OWNER APPROVAL

```text
------------------------------------------------------------
CONFIG-BAR-01 PRODUCT OWNER APPROVAL

Configuration source:
[TO BE APPROVED]

Configuration keys:
[TO BE APPROVED]

Barcode format:
[TO BE APPROVED]

Allocation mechanism:
[TO BE APPROVED]

Sequence period:
[TO BE APPROVED / N/A]

Reset behavior:
[TO BE APPROVED / N/A]

Effective/activation behavior:
[TO BE APPROVED]

Historical barcode behavior:
IMMUTABLE / NEVER REUSED

Scope:
TENANT

Uniqueness:
TENANT-WIDE

Symbology:
CODE128

Product Owner decision:
[APPROVED / NOT APPROVED]
------------------------------------------------------------
```

Do **not** populate missing values with engineering assumptions.

---

## 11. Final status

Creating this decision package does **not** close CONFIG-BAR-01.

# CONFIGURATION_BLOCKED

No Product Owner-approved format, allocator, or configuration source values were supplied in this task.

**Next gate:** Product Owner completes §10 → successor stamp may record `PRODUCT_DECISION_CLOSED_CONFIG_BINDING_READY` → then a **fresh** L-COL-01E implementation task may be issued.

**STOP.** Do not implement L-COL-01E. Do not invent barcode format values.
