# L-COL-01D — Receiving & Accession Foundation  
# Implementation Gate Report — CONFIGURATION_BLOCKED

**Date:** 2026-10-11  
**Slice:** L-COL-01D — Receiving & Accession Foundation  
**Mode:** IMPLEMENTATION TASK — **STOPPED AT CONFIGURATION GATE**  
**Authoritative product closure:** [enterprise-lms-receiving-accession-decision-closure.md](./enterprise-lms-receiving-accession-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01D_AUTHORIZED`)  
**Discovery audit:** [enterprise-lms-receiving-accession-discovery-audit.md](./enterprise-lms-receiving-accession-discovery-audit.md)

```text
PRODUCT_DECISIONS_CLOSED_L_COL_01D_AUTHORIZED
  → PHASE 1 repository audit (COMPLETE)
  → PHASE 2 configuration dependency verification (COMPLETE)
  → BOTH governed sources MISSING
  ↓
CONFIGURATION_BLOCKED
  → NO application / schema / API / UI / permission-grant implementation
  → STOP (do not invent masters, codes, or accession formats)
```

---

## FINAL STATUS

# CONFIGURATION_BLOCKED

L-COL-01D implementation is **not** started. No Receive, Reject, accession, worklist mutation, migration, or role grant was applied.

Required unblock: Product Owner / platform must supply and certify governed runtime sources for **both** dependencies below. After that, a fresh authorized implementation task may proceed.

---

## 1. Phase 1 — Internal implementation plan (audit reconciliation)

### 1.1 Current L-COL-01C schema

| Table | Role |
|---|---|
| `lms_specimens` | Specimen SoT (Collected only) |
| `lms_specimen_order_tests` | Specimen ↔ OrderTest links |
| `lms_specimen_idempotency` | Specimen-operation idempotency |

Migration: `microservices/laboratory-service/LaboratoryApi/Migrations/20261010162749_AddLmsSpecimenTables.cs`

### 1.2 Current `LmsSpecimen` model / state

| Item | Finding |
|---|---|
| Entity | `LaboratoryApi/Domain/LmsSpecimen.cs` |
| Status | **`Collected` only** (`SpecimenStatuses`) |
| Identity | Immutable Specimen GUID |
| Absent | Accession, barcode, receive/reject fields, receiving actor/time/branch |

### 1.3 Specimen ↔ OrderTest relation

| Item | Finding |
|---|---|
| Entity | `LmsSpecimenOrderTest` → `lms_specimen_order_tests` |
| Unique | `(specimen_id, order_test_id)` |
| FK to order tests | Logical only (no DB FK to `lms_order_tests`) |

### 1.4 Specimen idempotency

| Item | Finding |
|---|---|
| Table | `lms_specimen_idempotency` |
| Unique | `(tenant_id, idempotency_key)` |
| Operation today | `"complete_collection"` |
| Fingerprint | SHA-256 of request JSON |
| Pattern | Claim → mutate → Complete / Release on failure |

### 1.5 RowVersion / concurrency

| Item | Finding |
|---|---|
| Column | `lms_specimens.row_version` (`int`, EF concurrency token) |
| Create | `RowVersion = 1` on Complete Collection |
| L-COL-01C mutations | No specimen update path yet; Complete Collection concurrency uses CollectionTask `ExpectedCollectionTaskRowVersion` |

### 1.6 LaboratoryApi authorization patterns

| Concern | Pattern |
|---|---|
| Auth | JWT via `JwtService.ValidateAndExtract`; tenant via `TenantContext` + RLS |
| Permissions | `LaboratoryAuthz.ForbidUnlessAsync` / `ForbidUnlessAllAsync` |
| Branch | `PlatformReferenceClient.ValidateUserBranchAsync` → AuthService `validate-user-branch` |
| Specimens read | `lms.specimens.view` OR `lms.specimens.manage` |
| Complete Collection | `lms.specimens.manage` AND `lms.collection.collect` |
| Receive permission | `lms.specimens.receive` **defined/seeded, unused** |

### 1.7 Audit implementation

| Item | Finding |
|---|---|
| SoT | Platform `audit_log` via `IPlatformAuditClient` → AuthService `api/internal/audit` |
| Fail-closed | Audit failure → rollback mutation (`audit_unavailable` 503) |
| Specimen actions today | `CREATE_SPECIMEN`, `COMPLETE_COLLECTION` |
| L-COL-01D required (when unblocked) | `RECEIVE_SPECIMEN`, `REJECT_SPECIMEN` (allowlist only; no parallel LMS audit) |

### 1.8 Current LMS specimen UI

| Surface | State |
|---|---|
| `/dashboard/lms/specimens` | Informational landing (not receiving worklist) |
| `/dashboard/lms/specimens/[id]` | Read-only detail |
| API client | `getLmsSpecimen`, `getLmsSpecimenByCollectionTask`, `completeLmsCollection` |
| List/search API | **None** |

### 1.9 Certified upstream (must remain unchanged)

```text
CollectionTask: Planned → Ready → InProgress → Completed
Complete Collection → Specimen Collected (no accession)
Order remains Submitted; OrderTest remains Ordered
No CollectionTask / Order / OrderTest mutation from Receiving
```

### 1.10 Planned L-COL-01D binding (blocked — not implemented)

When configuration is available, implementation must bind to those sources and reuse:

- Extend `LmsSpecimen` for Received/Rejected + accession + receive/reject audit fields  
- `POST .../specimens/{id}/receive` and `.../reject` with `lms.specimens.receive`  
- Specimen worklist on `/dashboard/lms/specimens`  
- Operation-specific idempotency + specimen `RowVersion` 409  
- Platform audit fail-closed  

**None of the above was implemented in this task.**

---

## 2. Phase 2 — Configuration dependency verification

### A. Governed rejection-reason source

| Check | Result |
|---|---|
| LMS rejection-reason table/entity in LaboratoryApi | **MISSING** |
| Seeded MasterValue entity type for LMS specimen rejection | **MISSING** |
| MasterValue seeds under `lab_diagnostics` | Only `lab.specimen_type`, `lab.imaging_modality`, `lab.ep_type` — **not** rejection reasons |
| Catalogue `RejectionCriteria` | Free-text guidance on `lms_catalogue_versions` — **explicitly not SoT** (PD-COL-REC-05) |
| Other domains (CCMS/IP/legacy `lab.api.ts` reject) | Wrong SoT / free-text — **not reusable** |

**Verdict A: CONFIGURATION_BLOCKED (MISSING)**

Searched:

- `LaboratoryApi` Domain / Services / Migrations / Tests  
- AuthService `MasterValueService`, `MasterDataLookupService`, entity registry seeds  
- `docs/laboratory-management` discovery + decision closure  
- Keyword search for accession / rejection reason across repo  

What is missing:

- A governed, selectable catalogue of rejection **reason codes** bound to LMS Reject  
- Runtime API/source LaboratoryApi can validate against without inventing codes  

Why guessing would violate the approved decision:

- PD-COL-REC-05 forbids inventing a hard-coded clinical/operational rejection catalogue  
- Decision closure: resolve by binding to governed sources, **not** inventing masters  
- Creating MasterValue rows with engineer-chosen codes would invent the catalogue  

### B. Governed accession sequence / format / scope

| Check | Result |
|---|---|
| Accession column on `lms_specimens` | **MISSING** |
| `LmsAccession*` entity / sequence table | **MISSING** |
| Accession format/prefix/period/scope configuration | **MISSING** |
| `LmsOrderNumberSequence` (`LAB-yyyyMMdd-D6`) | Real **order** numbering only |
| `LmsCollectionTaskNumberSequence` (`COL-yyyyMMdd-D6`) | Real **collection task** numbering only |
| PO closure on order/task sequences | **Reuse pattern only — not approved accession format** (PD-COL-REC-12) |

**Verdict B: CONFIGURATION_BLOCKED (MISSING)**

What is missing:

- Governed accession format (prefix, date component, width, check digit, reset policy)  
- Uniqueness scope binding (tenant / site / branch / day / section as configured)  
- Atomic sequence allocation source for that format  

Why guessing would violate the approved decision:

- PD-COL-REC-11/12 and AD-COL-REC-04 forbid inventing accession format/scope  
- Copying `LAB-*` / `COL-*` or inventing `ACC-*` would invent the accession identity  

---

## 3. What was intentionally not implemented

Per hard stop on configuration gate:

- No migration / schema extension  
- No Receive / Reject APIs or UI  
- No accession generation  
- No rejection-reason master creation  
- No barcode / labels / custody / aliquots / testing / billing  
- No Pathology changes  
- No production role grants  
- No L-COL-01E preparation  

Certified L-COL-01B / L-COL-01C / Orders / Catalogue / Pathology behavior left unchanged (no code changes in this task).

---

## 4. Unblock criteria (for a future implementation task)

Both must be true before L-COL-01D implementation may proceed:

1. **Rejection reasons:** Product Owner / platform certifies a governed runtime source (e.g. seeded MasterValue entity type, or LMS config table with approved codes) that LaboratoryApi can validate on Reject **without inventing codes**.  
2. **Accession:** Product Owner / platform certifies accession format + uniqueness scope + sequence mechanism (or an existing governed config artifact) that LaboratoryApi can allocate atomically **without inventing format**.

Then re-run the authorized L-COL-01D implementation task against this closure + the certified bindings.

---

## 5. Manual UAT

Not prepared as executable UAT for this slice because Receive/Reject/accession were not implemented.

When unblocked and implemented, use the numbered checklist from the implementation task prompt (§42).

---

## STOP

**CONFIGURATION_BLOCKED**

Do not start L-COL-01E.  
Do not invent rejection codes or accession formats.  
Do not claim `IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT`.
