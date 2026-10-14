# L-COL-01B — CollectionTask Implementation Audit

**Date:** 2026-10-09  
**Mode:** Pre-implementation audit (then implementation proceeds in same authorized slice)  
**PO gate:** Product Owner approved PD-COL-02/05/16/17 + AD-COL-05/06/10 for L-COL-01B  

**Post-UAT ownership/search gate (2026-10-09):** Product Owner closed PD-COL-OWN-01…05, PD-COL-SEARCH-01, PD-COL-UX-01 (deferred), Specimen/Receiving unchanged — see  
[enterprise-lms-collection-search-ownership-decision-closure.md](./enterprise-lms-collection-search-ownership-decision-closure.md)  
(`PRODUCT_DECISIONS_CLOSED_IMPLEMENTATION_READY`). Implementation of those decisions is a **follow-up task**; this audit’s shipped foundation is not re-authorized as accepted.

## Reusable infrastructure

| Asset | Reuse |
|---|---|
| LaboratoryApi + `LaboratoryDbContext` + Npgsql | Yes |
| `JwtService` + `LaboratoryAuthz.ForbidUnlessAsync` | Extend with collection codes |
| `IPlatformAuditClient` fail-closed | Yes |
| Order idempotency pattern (claim/complete/release) | New `lms_collection_idempotency` store (namespaced) |
| Order `RowVersion` concurrency token | Same on CollectionTask |
| Platform Patient validate (for display context) | Optional read via order linkage |
| LMS shell / `LmsPageShell` / shadcn | Yes |
| FE `getLaboratoryApi()` | Yes |
| AuthService permission definition seeder pattern | Definitions only |

## Required new domain objects

- `LmsCollectionTask`
- `LmsCollectionTaskOrderTest` (explicit M:N planning link)
- `LmsCollectionIdempotencyRecord`

## Migration

Additive only: `lms_collection_tasks`, `lms_collection_task_order_tests`, `lms_collection_idempotency`.  
No changes to catalogue/order/pathology tables.

## API surface (minimum)

| Method | Route | Permission |
|---|---|---|
| GET | `/api/lms/collection/tasks` | view |
| GET | `/api/lms/collection/tasks/{id}` | view |
| GET | `/api/lms/collection/orders/{orderId}/plan-context` | manage |
| POST | `/api/lms/collection/tasks` | manage |
| POST | `/api/lms/collection/tasks/{id}/transition` | manage or collect |
| POST | `/api/lms/collection/tasks/{id}/claim` | collect |
| POST | `/api/lms/collection/tasks/{id}/assign` | manage |
| POST | `/api/lms/collection/tasks/{id}/release` | collect/manage (release own claim / manage) |

No Specimen/complete-collection endpoints.

## State machine (planning lifecycle)

`Planned → Ready → InProgress → Completed`  
Any non-terminal → `Cancelled`  
Terminal: `Completed`, `Cancelled`  
Documented limitation: clinical “Collected” specimen semantics deferred (no Specimen).

## Permissions

`lms.collection.view` | `lms.collection.manage` | `lms.collection.collect` — definitions only; no role grants.

## UI

`/dashboard/lms/collection` — worklist, planning dialog, task detail. Replace `LmsCapabilityPage` placeholder.

## Non-goals

Specimen, accession, barcode, label, receiving, recollection, custody, aliquots, billing event, Pathology, auto-planning from catalogue refs, leave/reassignment (**PD-COL-OWN-04 DEFERRED**), staff picker (**PD-COL-UX-01 DEFERRED**), SignalR.

## Traceability — closed ownership/search decisions

| Decision | Status | Doc |
|---|---|---|
| PD-COL-OWN-01…05 / SEARCH-01 / UX-01 | Closed (APPROVED or DEFERRED) | `enterprise-lms-collection-search-ownership-decision-closure.md` |
| Diagnostic baseline | `PRODUCT_DECISION_REQUIRED` → superseded by closure | `enterprise-lms-collection-search-ownership-diagnostic.md` |

## Test strategy

LaboratoryApi.Tests CollectionTaskServiceTests + AuthService permission definition tests + FE structural tests + regression Order/Catalogue/Pathology/Orders UI.
