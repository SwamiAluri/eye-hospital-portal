# L-COL-01E — Barcode & Labels Implementation Report

**Date:** 2026-10-11  
**Slice:** L-COL-01E (Specimen Barcode & Labels)  
**CONFIG-BAR-01:** Closed via Product Owner-approved values in the fresh implementation authorization (format `SPC-YYYYMMDD-NNNNNN`, PostgreSQL tenant/UTC-day allocator, CODE128 symbology, tenant-wide uniqueness).

```text
IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT
PRE_UAT_VERIFICATION_PASSED  (2026-10-11 evidence gate)
L-COL-01E_ACCEPTED            (2026-10-11 Manual UAT acceptance)
```

Manual UAT **PASSED**; slice **ACCEPTED**. Evidence: [enterprise-lms-barcode-label-uat-acceptance.md](./enterprise-lms-barcode-label-uat-acceptance.md).  
L-COL-01F and Testing were **not** started by the acceptance task.

### PRE-UAT evidence correction (2026-10-11)

- Added **real PostgreSQL** concurrency test: `SpecimenBarcodePostgresConcurrencyTests` — **50** concurrent workers, separate `LaboratoryDbContext` each, Npgsql `AllocateBarcodeValueAsync` path (no InMemory semaphore).
- Added transactional integrity tests: CREATE/PRINT audit fail-closed, existing-barcode print failure, print-event concurrency failure, sequence gap non-reuse, ambiguous configuration fail-closed.
- Production Npgsql allocator documented as multi-instance authoritative; InMemory `SequenceGates` remains test-only.

---

## 1. Configuration binding

| Field | Bound value |
|---|---|
| Source | LMS-owned table `lms_specimen_barcode_configurations` (LaboratoryApi) |
| Format | `SPC-YYYYMMDD-NNNNNN` |
| Prefix / separator | `SPC` / `-` |
| Date | `YYYYMMDD` server **UTC** |
| Sequence | 6-digit zero-padded; period = UTC day; max `999999` |
| Check digit | `NONE` |
| Symbology | `CODE128` (rendering) |
| Scope / uniqueness | `TENANT` / `TENANT_WIDE` → `UNIQUE(tenant_id, barcode_value)` |
| Activation | Config row effective when `effective_from_utc <=` start of current UTC day; next-day activation for future rows |
| Historical | Issued barcodes immutable; config change does not rewrite values |

Runtime resolution fails closed if missing / inactive / malformed / ambiguous (`barcode_configuration_*` codes). No GUID/MRN/accession/order fallback.

**UAT seed (per tenant):** insert one approved active row with `effective_from_utc` in the past (e.g. Unix epoch). Helper: `SpecimenBarcodeService.CreateApprovedConfiguration(tenantId, actorId)`.

---

## 2. Approved format

Exact payload: `SPC-YYYYMMDD-NNNNNN` (19 chars). Example: `SPC-20261011-000001`. Distinct from Specimen GUID, Accession (`ACC-…`), MRN, Order number, CollectionTask number.

---

## 3. Allocation architecture

- Table: `lms_barcode_number_sequences` keyed by `(tenant_id, sequence_date)`
- PostgreSQL: `INSERT … ON CONFLICT DO UPDATE … WHERE last_value < 999999 RETURNING last_value`
- Exhaustion → `409 barcode_sequence_exhausted` (no wrap / width change)
- Gaps allowed; allocated values never reused
- InMemory tests may use a static gate — **not** production correctness authority

---

## 4. Schema

| Table | Purpose |
|---|---|
| `lms_specimen_barcode_configurations` | Tenant barcode config artifact |
| `lms_barcode_number_sequences` | UTC-day counters (`last_value` ≤ 999999) |
| `lms_specimen_barcodes` | Active barcode per specimen; `UNIQUE(tenant_id, barcode_value)`; unique active `(tenant_id, specimen_id)` |
| `lms_specimen_label_print_events` | Append-only print/reprint history |

Migration: `20261011122821_AddLmsSpecimenBarcodeLabels` (does **not** alter accession / receive / reject columns on `lms_specimens`).

---

## 5. APIs

| Method | Route | Permission |
|---|---|---|
| GET | `/api/lms/specimens/{id}/barcode` | `lms.specimens.barcode.view` |
| POST | `/api/lms/specimens/{id}/barcode` | `lms.specimens.label.print` |
| POST | `/api/lms/specimens/{id}/label/print` | `lms.specimens.label.print` |
| POST | `/api/lms/specimens/{id}/label/reprint` | `lms.specimens.label.reprint` |

Client cannot supply `BarcodeValue`. Print without barcode allocates once; print with barcode reuses; reprint never allocates. Reprint body requires `reason`.

Specimen detail/list now expose optional `barcodeValue` / `barcodeId` for display (read model only).

---

## 6. Authorization

Catalog-only (AuthService `EnterpriseLmsSpecimenPermissionCatalog`):

- `lms.specimens.barcode.view`
- `lms.specimens.label.print`
- `lms.specimens.label.reprint`

**No role grants.** Branch authorization via `ValidateUserBranchAsync` on `operatingBranchId`. Tenant isolation preserved.

---

## 7. Audit

Platform `audit_log` allowlist (`InternalAuditController`):

- `CREATE_SPECIMEN_BARCODE`
- `PRINT_SPECIMEN_LABEL`
- `REPRINT_SPECIMEN_LABEL`

Fail-closed: barcode/print mutations revert if audit write fails (`503 audit_unavailable`). No VOID action.

---

## 8. Idempotency

Operations on `lms_specimen_idempotency`: `assign_barcode`, `print_label`, `reprint_label`. Same key + hash → replay; same key + different hash → `409 idempotency_conflict`.

---

## 9. Concurrency

DB-authoritative allocation + unique constraints + specimen `RowVersion` → `409 concurrency_conflict`. Concurrent allocation covered by automated test.

---

## 10. Frontend

Existing `/dashboard/lms/specimens` workbench detail:

- Collected without barcode → **Generate / Print Label**
- With barcode → display + Print + Reprint (reason dialog)
- Received → Accession + Barcode + Print/Reprint
- Rejected with barcode → retain + Print/Reprint; without barcode → no auto-generate
- Isolated browser print (`specimen-label-print.ts`) + JsBarcode CODE128
- No scanner / thermal / ZPL / format admin UI

---

## 11. Tests

| Suite | Result |
|---|---|
| LaboratoryApi `SpecimenBarcode*` (incl. **2 PostgreSQL** concurrency/exhaustion) | **30 passed** |
| LaboratoryApi barcode + receiving + specimen + collection regression | **93 passed** |
| AuthService specimen permissions + internal audit filter | **21 passed** (AuthService PID 31560 stopped for lock; not skipped) |
| FE `enterprise-lms-specimen-ui.test.ts` | **12 passed** |

---

## 12. Regression

Complete Collection / Receive / Reject do **not** auto-generate barcodes. Accession remains `ACC-…`. Order stays Submitted; OrderTest Ordered; CollectionTask lifecycle unchanged. Pathology untouched.

---

## 13. Migration

Apply `AddLmsSpecimenBarcodeLabels` to LaboratoryApi PostgreSQL. Seed tenant barcode configuration before UAT generate/print.

---

## 14. Manual UAT checklist

PRE-UAT: [enterprise-lms-barcode-label-pre-uat-verification.md](./enterprise-lms-barcode-label-pre-uat-verification.md).  
Corrections: [enterprise-lms-barcode-label-uat-correction.md](./enterprise-lms-barcode-label-uat-correction.md).  
**Acceptance (PASSED):** [enterprise-lms-barcode-label-uat-acceptance.md](./enterprise-lms-barcode-label-uat-acceptance.md).

---

## 15. Known limitations

- No admin UI for barcode configuration (table + seed helper only)
- No VOID / replacement lifecycle
- Label specimen type / branch omitted unless already on payload (optional fields null)
- Reprint reason is free-text (no new master domain)
- AuthService local process was stopped for test build; restart locally if needed for runtime

---

## 16. Out of scope (confirmed)

Scanning, custody, aliquots, referral, Testing/Results, thermal/ZPL/fleet, Pathology migration, role grants, CollectionTask ownership changes, Receive/Reject behavior changes.
