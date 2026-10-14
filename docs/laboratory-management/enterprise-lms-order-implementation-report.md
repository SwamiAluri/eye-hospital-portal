# L-ORD-01B — Enterprise LMS Order Domain Foundation — Implementation Report

**Date:** 2026-10-09  
**Status:** `IMPLEMENTATION_ACCEPTED_FOR_UI_LATER`  
**Product decisions:** Unchanged — PD-ORD-01…19 remain as closed in L-ORD-01A-PD  

---

## 1. Scope implemented

- LaboratoryApi order domain entities + EF migration `AddLmsOrderTables`
- Orderables API (`GET /api/lms/catalogue/orderables`)
- Order APIs: create draft, update draft, get, list, submit, amend, cancel, versions
- Platform reference adapters (AuthService internal validate patient/visit/user)
- Order number `LAB-YYYYMMDD-NNNNNN` (LaboratoryApi sequence table)
- Tenant-scoped idempotency (`Idempotency-Key` / body key)
- ExpectedRowVersion concurrency (409 on stale) with atomic DB predicate
- Version-chain amendment; cancel terminal
- Panel explosion with component validation + traceability
- Platform audit allowlist expansion + fail-closed create/update/submit/amend/cancel
- Permission **definitions** only: `lms.orders.view|create|manage` (no role grants)
- Automated LaboratoryApi + AuthService tests
- Architecture / state-machine docs

## 2. Scope explicitly not implemented

Collection/tasks, specimens, testing, results, reporting, referral ops, billing charge posting, work queue, AOE, favourites/pathways, complete Orders UI, Pathology changes, fake production seed data, automatic role grants.

**Manual UI UAT deferred. Backend/API/domain acceptance completed through automated tests for this slice. Complete Orders UI UAT will occur after the Order Intake UI implementation is complete.**

## 3. Database tables

`lms_orders`, `lms_order_versions`, `lms_order_selections`, `lms_order_tests`, `lms_order_number_sequences`, `lms_order_idempotency`

## 4. API endpoints

| Method | Route | Permission |
|---|---|---|
| GET | `/api/lms/catalogue/orderables` | `lms.orders.create` |
| GET | `/api/lms/orders` | `lms.orders.view` |
| GET | `/api/lms/orders/{id}` | `lms.orders.view` |
| GET | `/api/lms/orders/{id}/versions` | `lms.orders.view` |
| POST | `/api/lms/orders` | `lms.orders.create` |
| PUT | `/api/lms/orders/{id}/draft` | `lms.orders.create` |
| POST | `/api/lms/orders/{id}/submit` | `lms.orders.create` |
| POST | `/api/lms/orders/{id}/amend` | `lms.orders.manage` |
| POST | `/api/lms/orders/{id}/cancel` | `lms.orders.manage` |

AuthService (internal):

| Method | Route |
|---|---|
| POST | `/api/internal/lms/validate-patient` |
| POST | `/api/internal/lms/validate-visit` |
| POST | `/api/internal/lms/validate-user` |

## 5–7. State machine / versions / catalogue pinning

See [enterprise-lms-order-state-machine.md](./enterprise-lms-order-state-machine.md) and [enterprise-lms-order-domain-architecture.md](./enterprise-lms-order-domain-architecture.md).

## 8. Patient / Visit / Provider validation

Via AuthService internal adapters; tenant + existence; visit patient/branch match; user active (no Doctor heuristic). Snapshots captured at submit.

## 9. Panel explosion

At submit/amend: preserve panel selection; explode components to `lms_order_tests`; validate each component Active/effective/applicable/orderable; nested/self-ref rejected.

## 10. Order number

Server-generated `LAB-YYYYMMDD-NNNNNN`; unique per tenant; client-supplied rejected.

**Concurrency (closure hardening):**

- PostgreSQL: atomic `INSERT … ON CONFLICT (tenant_id, sequence_date) DO UPDATE SET last_value = last_value + 1 RETURNING last_value`
- Unique index on `(tenant_id, sequence_date)` and `(tenant_id, order_number)`
- InMemory/tests: process-wide `SemaphoreSlim` gate + unique-violation retry

## 11. Idempotency

Tenant + key + operation + request hash; unique index on `(tenant_id, idempotency_key)`.

**Concurrency (closure hardening):** claim-first insert of the idempotency row (DB unique), then mutate, then complete response payload. Concurrent identical callers: one claims; others wait/replay. Different payload with same key → 409. Claim released on failure so retries can proceed.

## 12. Concurrency

`ExpectedRowVersion` required on mutating APIs; mismatch → 409.

**Atomic mechanism (closure hardening):** `lms_orders.row_version` is an EF concurrency token. SaveChanges emits `UPDATE … WHERE id = @id AND row_version = @original`. Concurrent mutations with the same expected version: exactly one succeeds; the other receives 409 (`DbUpdateConcurrencyException` → `concurrency_conflict`). No select-compare-update without a row-version predicate.

## 13. Audit

Actions: `CREATE_DRAFT`, `UPDATE_DRAFT`, `SUBMIT_ORDER`, `AMEND_ORDER`, `CANCEL_ORDER` on resources `LmsOrder` / `LmsOrderVersion`. Fail-closed with compensation on create/update-draft/submit/amend/cancel (including amend orphan version/selection/test cleanup).

## 14. Permissions

Definitions seeded; **no** production role grants. Admin `*` preserved.

## 15. Security / tenant

JWT tenant; never trust client TenantId; platform refs validated; Pathology `laboratory.view` / catalogue admin do not authorize orders.

## 16. Migration

`20261009044637_AddLmsOrderTables` — additive `lms_*` order tables only.

## 17. Tests executed (exact) — technical closure pass

| Suite | Command | Result |
|---|---|---|
| LaboratoryApi.Tests (full) | `dotnet test microservices/laboratory-service/LaboratoryApi.Tests/LaboratoryApi.Tests.csproj` | **Passed 80 / 80** |
| AuthService.Tests (LMS orders + InternalAudit filter) | `dotnet test …AuthService.Tests.csproj --filter "FullyQualifiedName~EnterpriseLms\|FullyQualifiedName~InternalAudit\|FullyQualifiedName~InternalLms"` | **Passed 15 / 15** |
| FE vitest LMS L0 + catalogue | `npx vitest run src/app/dashboard/lms` (cwd: `apps/hospital-portal-web`) | **Passed 19 / 19** |

Closure-added coverage includes concurrent ExpectedRowVersion cancel, concurrent order-number allocation, concurrent idempotent create, amend/update-draft audit fail-closed, tenant-scoped idempotency keys.

## 18. Regression

LMS catalogue / L0 / InternalAudit / Pathology LaboratoryCatalog tests included above — **passed**. No Pathology code modified in this closure pass.

## 19. Files changed (primary L-ORD-01B + closure)

- `microservices/laboratory-service/LaboratoryApi/**` (domain, services, functions, migration, Program, authz)
- `microservices/laboratory-service/LaboratoryApi.Tests/OrderServiceTests.cs`
- `microservices/auth-service/AuthService/Controllers/InternalLmsReferenceController.cs`
- `microservices/auth-service/AuthService/Controllers/InternalAuditController.cs`
- `microservices/auth-service/AuthService/SeedData/EnterpriseLmsOrdersPermissionCatalog.cs` + PermissionSeeder + Program seed call
- `microservices/auth-service/AuthService.Tests/EnterpriseLmsOrdersPermissionTests.cs` + InternalAudit allowlist test
- `apps/hospital-portal-web/src/lib/lms/lms-permissions.ts`
- Docs under `docs/laboratory-management/`

### Closure-pass deltas only

- `LaboratoryDbContext.cs` — `RowVersion` concurrency token
- `OrderService.cs` — atomic sequence, claim-first idempotency, audit compensate for update/amend orphans
- `OrderServiceTests.cs` — concurrent/audit closure tests
- Docs: this report + architecture (behavior documentation)

## 20. Product decisions not changed

PD-ORD-01…19 remain APPROVED / APPROVED-DEFERRED as in closure doc. No new clinical/financial/security rules invented beyond adapters.

## 21. Known limitations

- Complete Orders UI not built; capability page remains structural.
- Consent: reference/evidence only; no hard bind to a single consent stack.
- Performing site always equals operating branch.
- Apply EF migration to target DB before live API use.

## 22. Manual UI UAT status

**Deferred** — see statement in §2.

---

## Reusable integration points (Step 0 record)

| Need | Actual point |
|---|---|
| Patient/Visit/User | New AuthService `api/internal/lms/validate-*` (no prior LMS internal refs) |
| Catalogue orderables | New `ListOrderablesAsync` / `ResolveOrderableAsync` on CatalogueService |
| Audit | Existing PlatformAuditClient + expanded InternalAudit allowlist |
| Permissions | Same seed pattern as EnterpriseLmsCataloguePermissionCatalog |
| Idempotency | Billing-like tenant+key table owned by LaboratoryApi |
| Sequence | LaboratoryApi-owned daily sequence (no shared enterprise LAB sequencer found) |

## Final status

**IMPLEMENTATION_ACCEPTED_FOR_UI_LATER**

Do **not** start Collection / Specimens / Testing / Results / Reporting / Referral Ops / Billing Execution / Analytics / Work Queue / complete Orders UI without a new authorization.
