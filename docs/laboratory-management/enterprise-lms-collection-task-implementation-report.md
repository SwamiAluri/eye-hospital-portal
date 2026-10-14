# L-COL-01B — Collection Planning + CollectionTask Foundation

**Slice:** L-COL-01B  
**Date:** 2026-10-09  
**Final gate status (implementation-era):** `IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT`  
**Acceptance (2026-10-09):** **L-COL-01B ACCEPTED** — see [enterprise-lms-collection-task-acceptance-closure.md](./enterprise-lms-collection-task-acceptance-closure.md) and [enterprise-lms-collection-task-final-uat-audit.md](./enterprise-lms-collection-task-final-uat-audit.md) (Product Owner waiver of live multi-actor UAT evidence).

---

## 1. Implementation status

CollectionTask planning foundation is implemented end-to-end:

- Additive LMS DB tables + EF migration
- Domain service with planning rules, state machine, claim/assign, idempotency, concurrency, audit fail-closed
- LaboratoryApi HTTP surface under `/api/lms/collection/*`
- AuthService permission **definitions only** (no role grants)
- FE workspace at `/dashboard/lms/collection` (work queue, planning dialog, task detail)
- Automated tests + regressions green

**STOP:** Specimen / Receiving / Testing not started.

---

## 2. Exact files changed / added

### Backend — LaboratoryApi

- `Domain/CollectionEnums.cs` *(new)*
- `Domain/LmsCollectionTask.cs` *(new)*
- `Domain/LmsCollectionTaskOrderTest.cs` *(new)*
- `Domain/LmsCollectionIdempotencyRecord.cs` *(new)*
- `Domain/LmsCollectionTaskNumberSequence.cs` *(new)*
- `Services/CollectionDtos.cs` *(new)*
- `Services/CollectionService.cs` *(new)*
- `Functions/CollectionFunctions.cs` *(new)*
- `Services/LaboratoryAuthz.cs` *(extended)*
- `Data/LaboratoryDbContext.cs` *(extended)*
- `Program.cs` *(DI)*
- `Migrations/20261009113149_AddLmsCollectionTaskTables.cs` *(new)*
- `Migrations/20261009113149_AddLmsCollectionTaskTables.Designer.cs` *(new)*
- `Migrations/LaboratoryDbContextModelSnapshot.cs` *(updated)*

### Backend tests

- `LaboratoryApi.Tests/CollectionServiceTests.cs` *(new)*
- `LaboratoryApi.Tests/LaboratoryDbContextShellTests.cs` *(updated entity count / table asserts)*

### AuthService

- `SeedData/EnterpriseLmsCollectionPermissionCatalog.cs` *(new)*
- `SeedData/PermissionSeeder.cs` *(SeedEnterpriseLmsCollectionPermissionsAsync)*
- `Program.cs` *(seed call)*
- `AuthService.Tests/EnterpriseLmsCollectionPermissionTests.cs` *(new)*

### Frontend

- `src/lib/lms/lms-collection.api.ts` *(new)*
- `src/lib/lms/lms-collection.api.test.ts` *(new)*
- `src/lib/lms/lms-permissions.ts` *(LMS_COLLECTION_PERMISSIONS)*
- `src/lib/lms/lms-capability-registry.ts` *(collection → implemented)*
- `src/components/lms/collection/CollectionWorkbench.tsx` *(new)*
- `src/components/lms/collection/CollectionPlanDialog.tsx` *(new)*
- `src/components/lms/collection/CollectionTaskDetailSheet.tsx` *(new)*
- `src/components/lms/collection/CollectionStatusBadge.tsx` *(new)*
- `src/app/dashboard/lms/collection/page.tsx` *(workbench)*
- `src/app/dashboard/lms/collection/enterprise-lms-collection-ui.test.ts` *(new)*
- `src/app/dashboard/lms/enterprise-lms-l0-foundation.test.ts` *(collection implemented)*

### Docs

- `docs/laboratory-management/enterprise-lms-collection-task-implementation-audit.md`
- `docs/laboratory-management/enterprise-lms-collection-task-implementation-report.md` *(this file)*

---

## 3. Database migration

**Name:** `20261009113149_AddLmsCollectionTaskTables`

**Tables (additive only):**

| Table | Purpose |
|---|---|
| `lms_collection_tasks` | CollectionTask aggregate |
| `lms_collection_task_order_tests` | Explicit task ↔ OrderTest links |
| `lms_collection_idempotency` | Tenant-scoped mutation idempotency |
| `lms_collection_task_number_sequences` | `COL-YYYYMMDD-XXXXXX` allocation |

**Not modified:** `laboratory_*`, `lms_catalogue_*`, `lms_orders_*` (except read-only joins).

---

## 4. Domain model

### `LmsCollectionTask`

Id, TenantId, TaskNumber, OrderId, CollectionBranchId, LocationText?, Status, ClaimedBy/At?, AssignedTo/At?, Notes?, CancelReason?, Created/Updated audit fields, RowVersion.

### `LmsCollectionTaskOrderTest`

Id, TenantId, CollectionTaskId, OrderId, OrderTestId, SortOrder.

**No Specimen / accession / barcode fields.**

---

## 5. API endpoints

| Method | Route | Permission |
|---|---|---|
| GET | `/api/lms/collection/tasks` | `lms.collection.view` |
| GET | `/api/lms/collection/tasks/{id}` | `lms.collection.view` |
| GET | `/api/lms/collection/orders/{orderId}/plan-context` | `lms.collection.manage` |
| POST | `/api/lms/collection/tasks` | `lms.collection.manage` |
| POST | `/api/lms/collection/tasks/{id}/transition` | manage **or** collect |
| POST | `/api/lms/collection/tasks/{id}/claim` | `lms.collection.collect` |
| POST | `/api/lms/collection/tasks/{id}/assign` | `lms.collection.manage` |
| POST | `/api/lms/collection/tasks/{id}/release` | collect **or** manage |

JWT + tenant isolation on all routes. Idempotency-Key / body key supported on mutations.

---

## 6. State machine

Planning lifecycle only:

```
Planned → Ready → InProgress → Completed
Any non-terminal → Cancelled (reason required)
```

Terminal: `Completed`, `Cancelled` (immutable).  
Invalid transitions → 400 `invalid_transition`.  
Stale RowVersion → 409 `concurrency_conflict`.

**Documented decision:** `Completed` closes the **queue task** without creating Specimen. Clinical “Collected” / Specimen birth remains a later approved slice (PD-COL-07).

Order / OrderTest statuses are **not** mutated by CollectionTask operations.

---

## 7. Permission model

Definitions seeded (PD-COL-17):

- `lms.collection.view`
- `lms.collection.manage`
- `lms.collection.collect`

**No production role grants.** Admin `*` may pass LaboratoryAuthz for controlled UAT.

---

## 8. Branch / tenant authorization

- Tenant from JWT only; all queries scoped by `TenantId`.
- `CollectionBranchId` required (non-empty authorized Branch ID — PD-COL-05).
- Optional free-text `LocationText` only (no location master).
- List supports `collectionBranchId` filter; server does not return other tenants’ tasks.
- Frontend branch filter is **not** the security boundary.

---

## 9. Ownership behavior (PD-COL-16 + PD-COL-OWN-*)

**Baseline (shipped L-COL-01B foundation):**

- Default: unclaimed / unassigned.
- Create does **not** assign creator.
- GET / open detail does **not** claim.
- Claim and Assign are explicit, audited, concurrency-checked.
- Claim conflict when another user holds claim → 409.
- Release own claim supported; leave/reassignment workflows out of scope.

**Product decision closure (2026-10-09) — not yet implemented:**

Authoritative Claim / Assign / Release / assignee-eligibility / dual-display rules are closed in  
[enterprise-lms-collection-search-ownership-decision-closure.md](./enterprise-lms-collection-search-ownership-decision-closure.md)  
(`PRODUCT_DECISIONS_CLOSED_IMPLEMENTATION_READY`).

| ID | Status | Summary |
|---|---|---|
| PD-COL-OWN-01 | APPROVED | Assigned = planned; Claimed = active operator; show both |
| PD-COL-OWN-02 | APPROVED | Interaction matrix; blocked actions → 409 ownership conflict |
| PD-COL-OWN-03 | APPROVED | Release clears claim only; claimant only |
| PD-COL-OWN-04 | DEFERRED | No force release / manager reassign in L-COL-01B |
| PD-COL-OWN-05 | APPROVED | Assignee must hold `lms.collection.collect` |
| PD-COL-SEARCH-01 | APPROVED | Case-insensitive TaskNumber search (Orders-aligned) |
| PD-COL-UX-01 | DEFERRED | Raw GUID assign OK for UAT; picker later |

Shipped Claim/Assign coexistence and case-sensitive search **do not** yet match the closed decisions. Do **not** treat L-COL-01B as accepted until those follow-up changes pass Manual UAT.

---

## 10. Idempotency (AD-COL-05)

- Separate store: `lms_collection_idempotency` (not Orders store).
- Tenant + key unique; operation + request hash compared.
- Same key + same request → replay prior detail.
- Same key + different request → 409 `idempotency_conflict`.

---

## 11. Concurrency (AD-COL-06)

- `RowVersion` concurrency token + application `ExpectedRowVersion`.
- Stale transitions/claims/assigns → 409.
- EF `DbUpdateConcurrencyException` mapped to 409.

---

## 12. Audit

Platform `IPlatformAuditClient` fail-closed:

- CREATE / TRANSITION / CANCEL / CLAIM / ASSIGN / RELEASE
- Actor from JWT only
- Audit failure → mutation rolled back → 503 `audit_unavailable`

No second audit table.

---

## 13. UI behavior

Route: `/dashboard/lms/collection`

- Work queue: search, status, branch filter, loading/empty/error/forbidden/retry
- Plan collection: Submitted orders → plan-context → explicit OrderTest multi-select → branch → create
- Task detail: identity, order/patient context, linked tests, status, claim/assign actions
- Honest note: Specimen/accession/barcode/receiving not implemented
- Pathology `/dashboard/laboratory` untouched

---

## 14. Automated test results

| Suite | Result |
|---|---|
| `LaboratoryApi.Tests` (full) | **96 passed**, 0 failed |
| `CollectionServiceTests` | **16 passed** |
| AuthService `EnterpriseLms*` (alt output build; AuthService.exe lock on default path) | **9 passed** |
| AuthService `EnterpriseLmsCollection*` | **2 passed** |
| FE collection + L0 + orders + catalogue + Pathology workbench | **62 passed** (57 LMS/Pathology batch + 5 catalogue) |

---

## 15. Regression test results

| Area | Result |
|---|---|
| LaboratoryApi full suite (Orders/Catalogue/Collection/shell) | Pass (96) |
| AuthService LMS permission definitions | Pass (9) |
| FE Orders UI + API | Pass |
| FE Catalogue | Pass |
| FE L0 foundation | Pass |
| Pathology laboratory-l1-workbench | Pass (20) |

No accepted regressions.

---

## 16. Scope-leakage check

| Forbidden item | Present? |
|---|---|
| Specimen tables / APIs / UI create | **No** |
| Accession / barcode / label / requisition | **No** |
| Receiving | **No** |
| Collection completion → Specimen | **No** |
| Auto-task from SpecimenTypeRef/ContainerRef | **No** |
| Pathology route/API/table changes | **No** |
| Orders/Catalogue schema mutation | **No** |
| Production role grants | **No** |
| Billing COLLECTION_COMPLETED | **No** |
| SignalR live queue | **No** |

**Result: PASS — no scope leakage into Specimen/Receiving/downstream.**

---

## 17. Known limitations

1. PRD FILE GAP preserved where binary unavailable.
2. JWT does not yet carry a fine-grained branch ACL list in LaboratoryApi; branch is validated as required ID + tenant filter (same pattern as Orders operating branch).
3. `Completed` is queue-terminal only — not Specimen Collected.
4. Assign UI accepts user GUID (platform validate); no dedicated collector picker — **PD-COL-UX-01 DEFERRED** (picker later); **PD-COL-OWN-05 APPROVED** requires server-side `lms.collection.collect` eligibility (not yet enforced beyond tenant+active).
5. Leave / forced reassignment / workload balancing deferred — **PD-COL-OWN-04 DEFERRED**.
6. AuthService default `bin` build may fail if AuthService process locks DLLs; tests verified via alternate output path.

---

## 18. Manual UAT checklist

1. LMS Collection navigation (`/dashboard/lms/collection`)
2. Permission denied without `lms.collection.view` (and manage/collect for actions)
3. Empty Collection queue honest empty state
4. Submitted Order appears as eligible in planning
5. Draft Order cannot be planned
6. Cancelled Order cannot be planned
7. Patient/order context shown in plan dialog
8. OrderTests displayed from plan-context
9. Explicit OrderTest selection required
10. Multiple OrderTests grouped into one task
11. Branch selection / authorization
12. Task creation succeeds; Order status unchanged
13. Task appears in queue
14. Task detail shows identity, tests, status, ownership
15. Explicit claim / assign
16. Opening task does **not** claim it
17. Valid state transition (Planned→Ready→…)
18. Invalid transition rejected
19. Stale RowVersion → 409
20. Duplicate mutation retry / idempotency replay
21. Audit verification (platform audit)
22. Tenant isolation
23. Branch isolation (filter / create branch)
24. No Specimen created
25. No Accession created
26. No Barcode created
27. No Label created
28. No Receiving created
29. No Pathology changes
30. Existing Orders/Catalogue regression

---

## 19. Recommended UAT test data

- Tenant with Admin `*` (or temporary grants of the three collection codes — **not** production role seeder)
- At least one Active catalogue Test/Panel
- One Draft order, one Submitted order (2+ OrderTests), one Cancelled order
- Two branch IDs available in branch context
- Two user IDs for claim/assign concurrency

Apply migration `AddLmsCollectionTaskTables` to LaboratoryApi DB before UAT.

---

## 20. Final gate status

**Implementation-era gate:** `IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT`  
**Post-UAT acceptance (2026-10-09):** **L-COL-01B ACCEPTED** — [acceptance closure](./enterprise-lms-collection-task-acceptance-closure.md).

Ownership/search product decisions were closed and later implemented; see  
[enterprise-lms-collection-search-ownership-decision-closure.md](./enterprise-lms-collection-search-ownership-decision-closure.md) and  
[enterprise-lms-collection-search-ownership-implementation-report.md](./enterprise-lms-collection-search-ownership-implementation-report.md).

Do **not** proceed to Specimen / Receiving / Testing until a separately authorized slice.
