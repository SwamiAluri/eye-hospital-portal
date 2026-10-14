# L-COL-01E — Barcode & Labels PRE-UAT Verification

**Date:** 2026-10-11  
**Gate task:** PRE-UAT correction & evidence (concurrency + transactional integrity)  
**Manual UAT:** **NOT executed**

```text
PRE_UAT_VERIFICATION_PASSED
```

---

## 1. Code inspection findings

### Production allocator
- **Method:** `SpecimenBarcodeService.AllocateBarcodeValueAsync` (internal; production path via Assign/Print)
- **PostgreSQL branch:** `INSERT INTO lms_barcode_number_sequences … ON CONFLICT (tenant_id, sequence_date) DO UPDATE SET last_value = last_value + 1 WHERE last_value < 999999 RETURNING last_value`
- **InMemory branch only:** static `SequenceGates` semaphore — explicitly **not** used when `Database.IsNpgsql()` is true
- **Conclusion:** multi-instance LaboratoryApi correctness does **not** depend on in-memory locks

### Transaction boundary (save-then-audit-then-compensate)
Matches L-COL-01D Receive pattern:

| Operation | Persist | Required audit | On audit failure |
|---|---|---|---|
| Assign barcode | barcode row (+ specimen RowVersion) | `CREATE_SPECIMEN_BARCODE` | delete barcode; fail `503 audit_unavailable` |
| Print (no barcode) | barcode + print event | CREATE then `PRINT_SPECIMEN_LABEL` | revert print event + barcode if created this request |
| Print (has barcode) | print event only | `PRINT_SPECIMEN_LABEL` | revert print event; **barcode unchanged** |
| Reprint | print event | `REPRINT_SPECIMEN_LABEL` | revert print event; barcode unchanged |

Sequence allocation is **not** rolled back on compensation → **gaps acceptable; no reuse** (proven).

Idempotency: claim → mutate → complete; failure releases claim. Replay returns stored JSON without second allocation.

---

## 2. PostgreSQL concurrency evidence

| Item | Value |
|---|---|
| Test class | `SpecimenBarcodePostgresConcurrencyTests` |
| Test | `PostgreSQL_Concurrent_Allocation_Is_Unique_And_Sequential_Without_InMemory_Lock` |
| Provider | **Npgsql / PostgreSQL** (`UseNpgsql`; asserted `IsNpgsql()`) |
| Connection source | `LABORATORY_TEST_CONNECTION` or LaboratoryApi `local.settings.json` DefaultConnection |
| Workers | **50** concurrent |
| DbContext | **One new `LaboratoryDbContext` per worker** (no shared context) |
| Tenant/date | Ephemeral `tenant_id` + current UTC date; sequence row cleaned up after |
| Assertions | 50 unique `SPC-YYYYMMDD-NNNNNN`; sequences `1..50`; `last_value == 50`; no uncontrolled unique failures |
| Result | **PASSED** (executed; not skipped) |

Also executed: `PostgreSQL_Exhaustion_Fails_Closed_Without_Wrap` against PostgreSQL (**PASSED**).

---

## 3. Transaction / audit / idempotency / config evidence (automated)

| Scenario | Test | Result |
|---|---|---|
| A. CREATE audit failure → no barcode; retry safe | `Audit_Failure_Is_Fail_Closed_No_Barcode_Persisted` | PASS |
| Gap after CREATE audit failure → next is `…-000002` | `Audit_Failure_Gap_Does_Not_Reuse_Sequence` | PASS |
| B. First print PRINT audit failure → no barcode, no print event; retry gets `…-000002` | `Print_Audit_Failure_On_First_Print_Leaves_No_Partial_State` | PASS |
| C. Print-event failure via RowVersion conflict → barcode unchanged, no print event | `Print_Event_Persistence_Failure_Via_Concurrency_Leaves_Consistent_State` | PASS |
| D. Existing barcode + PRINT audit failure → same barcode, no second barcode | `Existing_Barcode_Print_Audit_Failure_Does_Not_Replace_Barcode` | PASS |
| E. Idempotent replay | `Assign_Idempotency_Replay_And_Hash_Conflict`, `Print_And_Reprint_Idempotency_Replay` | PASS |
| F. Idempotency conflict | same assign test (`idempotency_conflict`) | PASS |
| Config missing/inactive/malformed | `Configuration_Missing_Inactive_Malformed_Fail_Closed` | PASS |
| Ambiguous configs | `Ambiguous_Active_Configurations_Fail_Closed` | PASS |
| Future config | `Future_Configuration_Not_Effective_Until_Utc_Day` | PASS |
| Historical immutability | `Historical_Barcode_Unchanged_After_Config_Change` | PASS |
| Exhaustion 999999 | InMemory + PostgreSQL exhaustion tests | PASS |

---

## 4. Regression

Proven by barcode + receiving + specimen + collection filters:

- Complete Collection does not create barcode  
- Receive does not create barcode; accession remains `ACC-*`  
- Reject does not create barcode; retains existing SPC barcode  
- Order Submitted / OrderTest Ordered / CollectionTask unchanged  

Pathology not modified.

---

## 5. Checklist (updated)

| # | Item | Result |
|---|---|---|
| 1 | Configuration runtime-bindable | PASS |
| 2 | Format `SPC-YYYYMMDD-NNNNNN` | PASS |
| 3 | Max length 19 | PASS |
| 4 | CODE128 | PASS |
| 5 | Tenant-wide uniqueness | PASS |
| 6 | Database-authoritative allocation | PASS |
| 7 | **Real PostgreSQL 50-worker concurrency executed** | **PASS** |
| 8 | No MAX()+1 | PASS |
| 9 | No in-memory correctness dependency (Npgsql path) | PASS |
| 10 | No client barcode selection | PASS |
| 11 | No fallback identity | PASS |
| 12–14 | No auto-gen on collect/receive/reject | PASS |
| 15–18 | Reject retain / recollection / accession / GUID distinct | PASS |
| 19–23 | Print/reprint / reason / audit fail-closed / idempotency / RowVersion | PASS |
| 24–27 | Tenant/branch authz; catalog; no role grants | PASS |
| 28 | AuthService tests run (PID 31560 stopped for lock) | PASS (21) |
| 29 | LaboratoryApi barcode+regression filter | PASS (93) |
| 30 | Frontend specimen tests | PASS (12) |
| 31–33 | Migration / no Pathology / no scope leakage | PASS |

---

## 6. Test counts (this gate)

| Suite | Filter / file | Passed | Skipped |
|---|---|---|---|
| LaboratoryApi | `SpecimenBarcode*` (includes **2 PostgreSQL** tests) | **30** | 0 |
| LaboratoryApi | barcode + receiving + specimen + collection | **93** | 0 |
| AuthService | specimen permissions + InternalAudit | **21** | 0 |
| Frontend | `enterprise-lms-specimen-ui.test.ts` | **12** | 0 |

AuthService lock handling: stopped process **AuthService PID 31560**, then ran tests (not skipped).

---

## 7. Remaining risks

- Compensation is save-then-audit-then-revert (same as L-COL-01D), not a single distributed XA transaction with AuthService audit. Crash between persist and compensate could leave orphan barcode until retry/cleanup — mitigated by revert on failure paths and unique active-barcode constraint; sequence gaps remain by design.
- PostgreSQL evidence used the configured LaboratoryApi DefaultConnection (Azure). Ephemeral tenant sequence rows are deleted after the test.

---

## 8. Manual UAT readiness

Automated PRE-UAT evidence gate is **PASSED**.

**Manual UAT was NOT executed.**  
**Acceptance is NOT claimed.**  
Do not start L-COL-01F / Testing until human UAT completes.
