# L-ORD-01C UAT DEFECT — Orders Worklist HTTP 500 — Fix Report

**Date:** 2026-10-09  
**Status:** `TECHNICAL_FIX_COMPLETE — RESUME_MANUAL_UAT`  
**L-ORD-01C acceptance:** Not granted (Manual UAT must resume)

---

## Root cause classification

**A. UAT database migration not applied**

The running LaboratoryApi correctly targeted shared PostgreSQL `hospitalportal`, but the certified L-ORD-01B migration `20261009044637_AddLmsOrderTables` had never been applied. Catalogue tables existed; all six `lms_order*` tables did not.

---

## Evidence

### Phase 1 — Live reproduce

| Check | Result |
|---|---|
| LaboratoryApi | Listening on `:7076` (`func.exe`, LmsOrdersList registered) |
| Connection | `local.settings.json` → Azure PG `hospitalportal` |
| Auth | Minted Admin JWT (`permission: *`, tenant `155fe198-…`) accepted past authz |
| `GET /api/lms/orders?page=1&pageSize=25` | **HTTP 500** (empty body) |
| Unauthenticated | HTTP 401 (not 500) |

`OrderFunctions.ExecuteAsync` only catches `OrderDomainException` / `CatalogueDomainException`. Unhandled EF/Npgsql failures surface as Azure Functions HTTP 500.

### Phase 2 — Database

Before fix, `hospitalportal` had:

- `lms_catalogue_*` (4 tables)
- **No** `lms_order*` relations

Direct SQL:

```text
ERROR:  relation "lms_orders" does not exist
```

`__EFMigrationsHistory` included `20261008135557_AddLmsCatalogueTables` but **not** `20261009044637_AddLmsOrderTables`.

### Exception signature (confirmed)

| Field | Value |
|---|---|
| Exception type | `Npgsql.PostgresException` (via EF Core) |
| SQLSTATE | `42P01` |
| Message | `relation "lms_orders" does not exist` |
| Failing SQL | `SELECT COUNT(*) FROM lms_orders WHERE tenant_id = …` (list `CountAsync`) |
| Failing path | `OrderFunctions.List` → `OrderService.ListAsync` → `_db.Orders` |
| Not | Authorization (401/403); FE bug; Pathology |

Func host console stack was not recoverable from the detached `func.exe` process; the missing-relation error is confirmed against the same DB/connection the API uses.

---

## Fix applied

Applied the **existing** repository migration only (no new migration, no schema redesign, no FE/Pathology changes):

```bash
dotnet ef database update --connection "<UAT hospitalportal DefaultConnection>"
```

Project: `microservices/laboratory-service/LaboratoryApi`  
Migration applied: `20261009044637_AddLmsOrderTables`  
ProductVersion recorded: `8.0.11`

### Post-fix verification

All six tables present:

- `lms_orders`
- `lms_order_versions`
- `lms_order_selections`
- `lms_order_tests`
- `lms_order_number_sequences`
- `lms_order_idempotency`

Migration history now includes `20261009044637_AddLmsOrderTables`.

---

## Live regression (post-fix)

| Case | Result |
|---|---|
| Admin JWT list (empty) | **200** `{"items":[],"page":1,"pageSize":25,"totalCount":0}` |
| `status=Draft` / `pageSize=10` | **200** empty page |
| Seeded draft row + search | **200** with that order |
| Branch filter (matching) | **200** with row |
| Branch filter (other) | **200** empty |
| Other tenant JWT | **200** empty (tenant isolation) |
| No auth | **401** |

Seeded smoke row was deleted after verification.

---

## Automated tests

| Suite | Result |
|---|---|
| `LaboratoryApi.Tests` `OrderServiceTests` | **27 passed** |
| `LaboratoryApi.Tests` Order + Pathology-related filter | **28 passed** |
| `AuthService.Tests` `EnterpriseLmsOrdersPermissionTests` | **2 passed** |
| FE vitest: `enterprise-lms-orders-ui`, `lms-orders.api`, `enterprise-lms-l0-foundation` | **27 passed** |

No tests were weakened or changed.

---

## Files changed

**None in source control.** Ops/schema only: existing migration applied to UAT `hospitalportal`.

Confirmations:

- No Pathology code changed
- No Collection/Specimen functionality introduced
- No Orders frontend changes
- No new LMS product functionality
- No new EF migration created

---

## Manual UAT handoff

Resume Manual UAT for L-ORD-01C Orders UI against LaboratoryApi `:7076`.  
Expected worklist load: HTTP 200 (empty until real drafts are created via UI).

Do **not** treat this report as L-ORD-01C acceptance.
