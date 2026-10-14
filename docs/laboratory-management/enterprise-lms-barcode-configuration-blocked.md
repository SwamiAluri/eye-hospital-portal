# L-COL-01E — Barcode & Labels  
# Implementation Gate Report — CONFIGURATION_BLOCKED

**Date:** 2026-10-11  
**Slice:** L-COL-01E — Barcode & Labels  
**Mode:** IMPLEMENTATION TASK — **STOPPED AT HARD CONFIGURATION GATE**  
**Authoritative product closure:** [enterprise-lms-barcode-label-decision-closure.md](./enterprise-lms-barcode-label-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED`)  
**Discovery audit:** [enterprise-lms-barcode-label-discovery-audit.md](./enterprise-lms-barcode-label-discovery-audit.md)  
**CONFIG-BAR-01 decision closure:** [enterprise-lms-barcode-configuration-decision-closure.md](./enterprise-lms-barcode-configuration-decision-closure.md) (`CONFIGURATION_BLOCKED` — reaffirmed; no bindable format/allocator)  
**Authoritative PRD/BRD:** `enterprise_laboratory_management_system_prd_brd.docx` (Library / functional SoT — repository copy absence is a repository gap only)

```text
PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED
  → PHASE 1: repository / runtime configuration audit (COMPLETE)
  → Governed LMS barcode format / sequence source: MISSING
  ↓
CONFIGURATION_BLOCKED
  → NO barcode generation
  → NO schema / API / UI / permission-grant / audit-allowlist implementation
  → STOP (do not invent format, prefix, width, check digit, or sequence)
```

---

## FINAL STATUS

# CONFIGURATION_BLOCKED

L-COL-01E barcode generation and dependent application implementation are **not** started.

Required unblock: Product Owner / platform must supply and certify a governed runtime barcode format/sequence configuration that LaboratoryApi can bind to without inventing values. After that, a fresh authorized implementation task may proceed against the decision closure.

---

## 1. Configuration source audit

### 1.1 Approved product constraints (not inventable)

| Key | Approved value |
|---|---|
| `BARCODE_SYMBOLOGY` | `CODE128` |
| `BARCODE_SCOPE` | `TENANT` |
| `BARCODE_UNIQUENESS` | `TENANT-WIDE` |
| `BARCODE_FORMAT` | `CONFIGURATION-OWNED` — **no engineering-invented prefix/date/width/check-digit** |

From PD-COL-BAR-03 / AD-COL-BAR-06 / decision closure §7 / §15:

- Format is a dedicated LMS configuration.  
- Implementation must use the exact configuration recorded at bind time.  
- Engineering must **not** invent prefix, date structure, sequence width, check digit, branch encoding, or business format.  
- Do **not** copy accession format `ACC-YYYYMMDD-NNNNNN`.  
- Do **not** silently use Specimen GUID, Accession, or MRN as barcode identity.

### 1.2 LaboratoryApi / LMS schema search

| Candidate | Result | Authoritative for barcode? |
|---|---|---|
| `LmsSpecimen` barcode property / column | **Absent** — entity comment + tests assert no `Barcode` property | No |
| `lms_specimen_barcodes` / label tables | **Absent** | No |
| `lms_*barcode*` migrations | **Absent** | No |
| LaboratoryApi `appsettings*.json` barcode keys | **Absent** | No |
| Dedicated LMS barcode format/sequence entity | **Absent** | No |
| `lms_accession_number_sequences` + hard-coded `ACC-YYYYMMDD-NNNNNN` | Exists for **accession only** (L-COL-01D) | **No** — must not be copied as barcode identity |
| `lms_order_number_sequences` (`LAB-*`) | Order numbering only | **No** |
| `lms_collection_task_number_sequences` (`COL-*`) | CollectionTask numbering only | **No** |

Evidence paths:

- `LaboratoryApi/Domain/LmsSpecimen.cs` — “No barcode, label, custody, or aliquot fields”  
- `LaboratoryApi.Tests/SpecimenServiceTests.cs` — asserts `GetProperty("Barcode")` is null  
- Accession allocation in `SpecimenService.AllocateAccessionAsync` — accession SoT only  

### 1.3 Platform MasterValue / entity registry search

| Candidate | Result | Authoritative for barcode? |
|---|---|---|
| MasterValue entity type `lms.specimen_rejection_reason` | Exists (L-COL-01D rejection reasons) | **No** — wrong domain |
| MasterValue / registry for barcode format, prefix, width, sequence policy | **Absent** | No |
| `lab.specimen_type` / other `lab_*` masters | Specimen-type catalogue values | **No** — not barcode identity |
| AuthService permission catalog specimen codes | `view` / `manage` / `receive` only today | Not a format source |

### 1.4 Frontend / print pattern search

| Candidate | Result | Authoritative for barcode payload? |
|---|---|---|
| Patient RegistrationCard CODE128 / JsBarcode | Rendering technique only | **No** — payload is MRN |
| Isolated print helpers | Print UX pattern | **No** |
| Inventory `BarcodeScanner` | Scanner UX | **Out of scope** + wrong SoT |
| IOL GS1 / implant UDI | Manufacturing identity | **RED — forbidden** |
| Journey safety wristband token barcode | Wrong-eye safety token | **RED — forbidden** |
| Pathology `/dashboard/laboratory` / `LabReport` | Legacy Pathology | **Not LMS barcode SoT** |

### 1.5 Documentation / decision search

| Source | Finding |
|---|---|
| Decision closure | Format intentionally **not** invented; remains `CONFIGURATION-OWNED` |
| Discovery audit | Encoding option E1 requires PO-supplied format/sequence — still open at config value level |
| Receiving configuration closure | Closed rejection + accession governance; barcode deferred to L-COL-01E and **not** supplied there |
| L-COL-01D accession format | Approved for accession only (`ACC-YYYYMMDD-NNNNNN`) — **explicitly forbidden** as barcode identity |

---

## 2. Existing configuration candidates (and why not authoritative)

| Candidate | Why it exists | Why it is NOT LMS specimen barcode SoT |
|---|---|---|
| Accession `ACC-YYYYMMDD-NNNNNN` + `lms_accession_number_sequences` | L-COL-01D Receive accession | PD-COL-BAR-02/03 forbid collapsing barcode into accession; task forbids copying accession format |
| Order `LAB-*` sequence | Order numbers | Wrong identity; not approved barcode format |
| CollectionTask `COL-*` sequence | Collection task numbers | Wrong identity; not approved barcode format |
| Specimen GUID | Immutable PK | Closure / task forbid silent GUID-as-barcode |
| Patient MRN CODE128 | Patient card rendering | Wrong-patient risk; MRN ≠ specimen barcode |
| GS1 / UDI / journey token | Other clinical/ops domains | Forbidden semantics reuse |
| Pathology LabReport fields | Legacy Pathology | Not LMS SoT (AD-COL-BAR-07) |
| MasterValue rejection reasons | Receive Reject catalogue | Unrelated to barcode format |
| Engineer-invented `BAR-` / `SPC-` / `LAB-` / date / GUID barcode | Would unblock coding | **Explicitly forbidden** by decision closure and this gate |

---

## 3. Exact dependency preventing safe barcode generation

**Missing dependency (CONFIG-BAR-01):**

A Product Owner–certified, runtime-bindable **LMS specimen barcode format and sequence configuration**, including at minimum:

1. **Format template** (prefix / date / width / check digit / other segments — as PO defines, including “none” where intentional)  
2. **Uniqueness scope binding** (approved as tenant-wide; must be reflected in the config artifact)  
3. **Sequence / allocation mechanism** (or explicit certified rule that values come from a named governed allocator)  
4. **Activation / effective behavior** (how LaboratoryApi reads and binds the config without hard-coding invented literals)  
5. **Runtime source of truth location** (e.g. LMS config table, certified MasterValue/entity policy, or other platform config already approved for this purpose — **not** a second invented configuration platform)

Without CONFIG-BAR-01, server-authoritative barcode assignment cannot satisfy PD-COL-BAR-03 / AD-COL-BAR-06.

---

## 4. What remains implementation-ready (after config unblock)

The following product/architecture decisions are already closed and do **not** need re-decision. They remain ready for a future implementation task **once CONFIG-BAR-01 exists**:

| Area | Ready? | Notes |
|---|---|---|
| Identity separation GUID ≠ Accession ≠ Barcode | Yes | Immutable upstream |
| Symbology CODE128 (rendering only) | Yes | Technique approved; payload still config-owned |
| Generation timing (first Generate/Print Label) | Yes | Not auto on collect/receive/reject |
| Rejected / recollection barcode rules | Yes | Retain / new specimen / never reuse |
| Label field set + PHI (MRN+name; no DOB) | Yes | Closed in decision closure §7 |
| Browser isolated print | Yes | Pattern reuse |
| Reprint same barcode + reason + audit | Yes | Permission/audit names approved |
| No scanner / void / thermal / ZPL | Yes | Out of scope |
| Permission catalog names | Yes | Catalog-only; no role grants |
| Audit action names | Yes | Allowlist only in future impl task |
| Idempotency op names | Yes | `assign_barcode` / `print_label` / `reprint_label` |
| Hybrid DB shape (current barcode + print events) | Yes | Design approved; schema not created |
| L-COL-01D Receive/Reject regression expectations | Yes | Must remain unchanged |

**Not ready until CONFIG-BAR-01:** barcode value generation, sequence tables tied to an invented format, APIs that assign barcodes, FE generate/print that depends on assignment, migrations that imply a format.

---

## 5. Exact Product Owner configuration needed

Product Owner / platform must certify and make bindable:

| Item | Required content |
|---|---|
| Configuration source name | Exact runtime SoT (table/API/key/entity type) |
| Configuration key(s) | Exact keys LaboratoryApi will read |
| Scope | Tenant-wide (reaffirm) |
| Format | Concrete format definition **or** certified template parameters |
| Sequence mechanism | How next value is allocated atomically (if sequential) |
| Uniqueness | Tenant-wide DB uniqueness binding |
| Effective date / activation | How config becomes active for tenants |
| Non-goals | Explicit confirmation that accession / GUID / MRN are **not** the barcode identity unless the certified format says so |

**Forbidden unblock patterns:**

- Engineering invents `BAR-…`, `SPC-…`, date width, check digit  
- Copy accession `ACC-YYYYMMDD-NNNNNN` as barcode  
- Silent GUID or MRN barcode  
- Fake/default production seed “for UAT” without PO certification  
- Creating a second configuration platform without separate approval  

---

## 6. What was intentionally not implemented

Per hard stop on configuration gate:

- No database migration / `lms_specimen_barcodes` / print-event tables  
- No barcode generators / sequences  
- No barcode or label APIs  
- No print / reprint UI  
- No scanner UI  
- No AuthService permission catalog additions  
- No audit allowlist additions  
- No role grants  
- No FE specimen API/UI changes  
- No Complete Collection / Receive / Reject / Order / OrderTest / CollectionTask / Pathology / Billing changes  

Certified L-COL-01B / L-COL-01C / L-COL-01D / Orders / Catalogue / Pathology behavior left unchanged (no application source changes in this task).

---

## 7. Application-code change confirmation

| Area | Changed? |
|---|---|
| LaboratoryApi application source | **No** |
| AuthService permission/audit seed | **No** |
| hospital-portal-web specimen UI/API | **No** |
| Migrations | **No** |
| Documentation (this blocked report) | **Yes** |

---

## 8. Manual UAT / PRE-UAT

| Gate | Status |
|---|---|
| Automated tests for L-COL-01E | **Not run** — no implementation |
| PRE-UAT verification | **Not applicable** — configuration blocked before implementation |
| Manual UAT | **NOT EXECUTED** |

Do not create `enterprise-lms-barcode-label-implementation.md` as a completed implementation document while this gate is blocked.

---

## 9. Next gate

1. Product Owner / platform supplies **CONFIG-BAR-01** (governed barcode format/sequence runtime SoT).  
2. Re-run a fresh authorized L-COL-01E implementation task against:
   - [enterprise-lms-barcode-label-decision-closure.md](./enterprise-lms-barcode-label-decision-closure.md)  
   - this configuration-blocked report (dependency satisfied)  
3. Then proceed: schema → API → auth/audit → FE → tests → PRE-UAT → stop for manual UAT.

---

## STOP

**CONFIGURATION_BLOCKED**

Do not invent a barcode format.  
Do not seed `BAR-` / `SPC-` / `LAB-` / GUID / accession barcodes.  
Do not claim `IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`.  
Do not begin Testing, Results, custody, aliquots, or Billing.
