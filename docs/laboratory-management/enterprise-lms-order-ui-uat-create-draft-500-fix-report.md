# L-ORD-01C UAT BLOCKER — HTTP 500 After Selecting Orderable — Fix Report

**Date:** 2026-10-09  
**Status:** `TECHNICAL_FIX_COMPLETE — RESUME_MANUAL_UAT`  
**L-ORD-01C acceptance:** Not granted

---

## 1. Exact failing HTTP request

| Field | Value |
|---|---|
| Method | `POST` |
| URL | `http://localhost:7076/api/lms/orders` |
| When | Persist path (Save draft / Save & submit), not local Add |

**Phase 2 — Add behavior:** Selecting an orderable is **A. purely local composer state** (`OrderablesPicker.add` → `setForm.selections`). No HTTP on Add alone. The composer error banner under SELECTED is `serverError` from `runMutation` → `createLmsOrderDraft` → `POST /api/lms/orders`.

## 2. Exact request body (reproduced)

```json
{
  "patientId": "457797f7-5a55-4c4b-907b-08b5091d5904",
  "visitId": null,
  "orderingProviderUserId": "d06ec1ba-81c4-4a6a-bc30-d99132f0c3a0",
  "responsibleClinicianUserId": "50eabb00-6c72-4e2e-883f-7e2cf6610285",
  "operatingBranchId": "74c014cf-9570-4824-bdf9-b369ea11a8f4",
  "orderSource": "Clinician",
  "priority": "Routine",
  "clinicalIndication": "UAT L-ORD-01C create draft after FK fix",
  "notes": "smoke",
  "selections": [
    { "catalogueItemId": "5a078cb7-8778-4cff-b39f-8a7e737c37f9", "sortOrder": 0 }
  ],
  "idempotencyKey": "<uuid>"
}
```

## 3. Exact response / error

**Before fix:** HTTP **500**, empty body (unhandled `DbUpdateException`).

PostgreSQL (confirmed via equivalent insert):

```text
ERROR: insert or update on table "lms_orders" violates foreign key constraint
"FK_lms_orders_lms_order_versions_current_version_id"
DETAIL: Key (current_version_id)=(...) is not present in table "lms_order_versions".
```

**After fix:** HTTP **201** with draft `LAB-20261009-000004`, selection pinned to catalogue version `d0c22738-…`, worklist **200** with the order.

## 4. Root cause

**C. L-ORD-01B backend domain/persist defect**

`OrderService.CreateDraftAsync` set `order.CurrentVersionId = versionId` before either row existed, then inserted both in one `SaveChanges`. Circular FKs:

- `lms_orders.current_version_id` → `lms_order_versions.id`
- `lms_order_versions.order_id` → `lms_orders.id`

InMemory tests do not enforce FKs, so L-ORD-01B automation passed while UAT PostgreSQL failed.

Not: catalogue pinning, tenant, patient/visit validation, idempotency, or audit (audit path returns 503 when it fails).

## 5. Evidence

- Catalogue item `5a078cb7-…` / Active version `d0c22738-…` valid for Downtown  
- Direct `POST /api/lms/orders` → 500 before fix  
- Manual SQL: insert order with `current_version_id` set → FK violation; null then version then update → OK  
- Amend path already inserts version on existing order (not affected)

## 6. Fix

Two-phase create persist in `OrderService.CreateDraftAsync`:

1. Insert order with `CurrentVersionId = null` + version (+ selections)  
2. Set `CurrentVersionId` and `SaveChanges` again  

Audit fail-closed rollback clears `CurrentVersionId` before deleting the version.

## 7. Files changed

| File | Change |
|---|---|
| `microservices/laboratory-service/LaboratoryApi/Services/OrderService.cs` | Two-phase create + audit rollback FK-safe |
| `microservices/laboratory-service/LaboratoryApi.Tests/OrderServiceTests.cs` | Assert `CurrentVersionId` set after create |

## 8. Database changes

None (schema already correct). One successful UAT smoke draft may remain: `LAB-20261009-000004` (acceptable UAT residue).

## 9. Tests / results

| Suite | Result |
|---|---|
| LaboratoryApi Order + Catalogue (+ Pathology filter) | **53 passed** |
| AuthService LMS catalogue/orders permissions | **4 passed** |
| FE L-ORD-01C vitest | **27 passed** (no FE code change) |
| Live `POST /api/lms/orders` | **201** |
| Live `GET /api/lms/orders` | **200** with draft |

## 10. Confirmations

- Pathology unchanged  
- Collection/Specimen untouched  
- L-ORD-01B semantics preserved (state machine, pinning, idempotency, audit fail-closed)  
- No business-rule inventiveness; FE unchanged  
- Add remains local state  

## 11. Next Manual UAT step

1. Ensure LaboratoryApi on `:7076` is the restarted host (post-fix build).  
2. `/dashboard/lms/orders` → New Order → select **UAT Orderable CBC** → **Save draft**.  
3. Expect success toast and worklist row; no 500.  
4. Continue Submit → Amend → Cancel → concurrency / boundary checks.  

Do **not** mark L-ORD-01C accepted automatically.

**STOP** — return to Manual UAT. Do not proceed to Collection.
