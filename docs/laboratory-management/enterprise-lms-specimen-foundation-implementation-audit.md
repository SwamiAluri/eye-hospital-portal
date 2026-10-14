# L-COL-01C — Specimen Foundation + Complete Collection — Implementation Audit

**Date:** 2026-10-10  
**Mode:** AUDIT ONLY — no application source, schema, migration, API, UI, permission seed, or role-grant changes performed  
**Authoritative product source:** [enterprise-lms-specimen-receiving-decision-closure.md](./enterprise-lms-specimen-receiving-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01C_AUTHORIZED`)  
**Outcome (audit-time):** **BLOCKED — DECISION_REQUIRED** (Complete Collection permission binding)  
**Outcome (post-PO):** **RESOLVED** — authorization approved; implementation resumed → see [enterprise-lms-specimen-foundation-implementation-report.md](./enterprise-lms-specimen-foundation-implementation-report.md)

---

## 1. Gate determination

| Check | Result |
|---|---|
| Product decisions closed / L-COL-01C authorized | **Yes** (decision closure) |
| Repository matches documented CollectionTask invariant | **Yes** |
| Specimen domain present | **No** (expected) |
| Complete Collection permission binding unambiguous | **No** → **DECISION_REQUIRED** |
| Safe to implement without inventing authz rule | **No** |

Per task absolute stop conditions: **STOP WITHOUT IMPLEMENTING**.

---

## 2. Audit findings (actual repository)

### A. LaboratoryApi

- Location: `microservices/laboratory-service/LaboratoryApi`
- DI: JWT, TenantContext, PlatformAuditClient, PlatformReferenceClient, Catalogue/Order/Collection services, LaboratoryDbContext (Npgsql + TenantCommandInterceptor)
- Functions: Health, Catalogue, Order, Collection — **no Specimen functions**

### B. LaboratoryDbContext

- Owns `lms_*` only; no legacy `laboratory_*`
- DbSets: catalogue (4), order (6), collection (4)
- **No** `LmsSpecimen` / `lms_specimens` / specimen link tables

### C. Migrations

1. `20261008135557_AddLmsCatalogueTables`
2. `20261009044637_AddLmsOrderTables`
3. `20261009113149_AddLmsCollectionTaskTables`

### D. Order entities

- `LmsOrder.Status`: Draft | Submitted | Cancelled
- `LmsOrderTest.Status`: Ordered (only status in current slice)
- Patient/visit context on order versions (L-ORD-01B) — authoritative for Complete Collection

### E–F. CollectionTask entities + lifecycle

- Tables: `lms_collection_tasks`, `lms_collection_task_order_tests`, `lms_collection_idempotency`, `lms_collection_task_number_sequences`
- Lifecycle: `Planned → Ready → InProgress → Completed` (+ Cancelled from non-terminal)
- Terminal: Completed, Cancelled
- **Confirmed:** Transition to `Completed` does **not** create Specimen (no specimen code path)
- Historical Completed tasks without Specimen are valid

### G. Ownership / Claim / Assign / Release

| Action | API permission |
|---|---|
| List/Get | `lms.collection.view` |
| Plan/Create/Assign | `lms.collection.manage` |
| Transition | manage **or** collect |
| Claim | `lms.collection.collect` |
| Release | collect **or** manage |

Assignee eligibility: platform user must hold `lms.collection.collect` (PD-COL-OWN-05). Unchanged and must remain so.

### H. Audit

- Platform `audit_log` via `PlatformAuditClient` → AuthService internal audit
- Fail-closed: mutation rolled back on audit failure → 503 `audit_unavailable`
- Collection allowlist actions exist; **no** `CREATE_SPECIMEN` / `COMPLETE_COLLECTION` yet

### I. Idempotency

- Store: `lms_collection_idempotency` — unique `(TenantId, IdempotencyKey)`
- Pattern: claim → hash → replay same op+hash; conflict on same key/different hash; in-progress handling
- Orders use separate `lms_order_idempotency`
- Closure requires **Specimen-specific** store (do not reuse Order/Collection stores)

### J. Optimistic concurrency

- `RowVersion` concurrency token on CollectionTask
- `ExpectedRowVersion` on mutations; 409 `concurrency_conflict`

### K. Tenant / branch

- Tenant: JWT + query scoping + TenantCommandInterceptor
- Branch: `CollectionBranchId` required non-empty Guid on create; list filter by branch
- **No** JWT branch-claim enforcement helper in CollectionService today (same pattern as L-COL-01B report)
- Reusable for L-COL-01C: persist collection BranchId from task; tenant isolation; do not invent new org hierarchy

### L. Permissions

| Code | Status |
|---|---|
| `lms.collection.view\|manage\|collect` | Seeded definitions; **no role grants**; certified |
| `lms.specimens.view\|manage\|receive` | **Not** in LaboratoryAuthz; **not** AuthService-seeded; FE has `specimensView` as planned constant only |

### M–N. Frontend LMS / Collection UI

- Collection: `/dashboard/lms/collection` — workbench implemented (L-COL-01B)
- Specimens: `/dashboard/lms/specimens` — `LmsCapabilityPage` placeholder (`not_implemented`)
- Capability registry: Collection = implemented; Specimens = not_implemented
- API client: `lms-collection.api.ts` only (no specimens API)

### O. Pathology

- Separate: `/dashboard/laboratory` + `laboratory.view`
- Not LMS Specimen SoT — must not be modified for this slice

---

## 3. Reconciliation with product closure

| Closure claim | Code reality | Conflict? |
|---|---|---|
| CollectionTask Completed ≠ Specimen created | Holds | None |
| LaboratoryApi owns Specimen persistence | No Specimen yet; ownership model ready | None |
| Shared DB `hospitalportal`, `lms_*` | Matches | None |
| OrderTest remains Ordered after collection task ops | Holds | None |
| Specimen permissions definitions approved | Not seeded yet (expected for L-COL-01C) | None |
| Complete Collection permission binding | **Not specified** | **BLOCKER** |

Older workshop proposal (`enterprise-lms-collection-specimen-decision-closure.md`) listed candidate capabilities as **PROPOSED** and is superseded where it conflicts. It must not be used to invent a binding.

---

## 4. What can be reused without invention (once authz decided)

- CollectionService mutation/idempotency/audit/concurrency patterns (mirrored for Specimen store)
- LaboratoryAuthz `ForbidUnlessAsync` + HasAny
- AuthService permission catalog seeder pattern (definitions only, no role grants)
- Platform audit allowlist extension pattern
- LMS FE shell / Collection detail sheet patterns for additive Complete Collection + Specimen detail
- Order patient snapshot for MRN / Name / DOB confirmation UI

---

## 5. Explicit non-conflicts

- No need to change CollectionTask lifecycle
- No need to change Order/OrderTest state machines
- No Pathology changes required
- No new microservice/database required
- M:N Specimen↔OrderTest via link table is schema-feasible and does not conflict with CollectionTaskOrderTest

---

## 6. Stop reason

See [enterprise-lms-specimen-foundation-decision-required.md](./enterprise-lms-specimen-foundation-decision-required.md).

**No L-COL-01C implementation was started.**
