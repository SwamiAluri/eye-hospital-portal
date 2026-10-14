# L-COL-01C — Specimen Foundation + Complete Collection — Implementation Report

**Date:** 2026-10-10  
**Slice:** L-COL-01C  
**Authorization:** [enterprise-lms-specimen-foundation-authorization-decision.md](./enterprise-lms-specimen-foundation-authorization-decision.md)  
**Product closure:** [enterprise-lms-specimen-receiving-decision-closure.md](./enterprise-lms-specimen-receiving-decision-closure.md)

---

## 1. STATUS

**IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT**

---

## 2. AUDIT SUMMARY

Pre-implementation audit confirmed:

- CollectionTask lifecycle `Planned → Ready → InProgress → Completed` does **not** create Specimen
- No prior `lms_specimens` tables/APIs
- LaboratoryApi owns LMS persistence on shared `hospitalportal` / `lms_*`
- Idempotency, concurrency, audit, tenant patterns reusable from L-COL-01B
- PO authorization binding resolved as **C / V2 / Same as Q1** before implementation resumed

---

## 3. IMPLEMENTED

### Backend (LaboratoryApi)

| Area | Files |
|---|---|
| Domain | `LmsSpecimen`, `LmsSpecimenOrderTest`, `LmsSpecimenIdempotencyRecord`, `SpecimenEnums` |
| Persistence | `LaboratoryDbContext` + migration `20261010162749_AddLmsSpecimenTables` |
| Service | `SpecimenService` / `SpecimenDtos` |
| API | `SpecimenFunctions` |
| Authz | `LaboratoryAuthz` — SpecimensView/Manage/Receive + `HasAll` / `ForbidUnlessAllAsync` |
| DI | `Program.cs` registers `ISpecimenService` |
| Additive Collection DTO | `PatientDateOfBirthSnapshot` on `CollectionTaskDetailDto` |

### AuthService

| Area | Files |
|---|---|
| Permission defs | `EnterpriseLmsSpecimenPermissionCatalog` + `SeedEnterpriseLmsSpecimenPermissionsAsync` (no role grants) |
| Audit allowlist | `CREATE_SPECIMEN`, `COMPLETE_COLLECTION`, resource `LmsSpecimen` |

### Frontend

| Area | Files |
|---|---|
| Permissions | `LMS_SPECIMENS_PERMISSIONS` |
| API | `lms-specimens.api.ts` |
| Collection UI | Complete Collection confirm (MRN/Name/DOB) on Completed tasks |
| Specimens UI | Landing + `/dashboard/lms/specimens/[id]` read-only detail |
| Capability registry | Specimens → `implemented` |

### Docs / tests

- Authorization decision + this report
- `SpecimenServiceTests`, Auth specimen permission/audit tests, FE specimen UI tests

---

## 4. DATABASE

New tables (LaboratoryApi / `hospitalportal`):

| Table | Purpose |
|---|---|
| `lms_specimens` | Specimen foundation; unique `(tenant_id, collection_task_id)`; `row_version` concurrency token; state `Collected` |
| `lms_specimen_order_tests` | M:N-capable link; unique `(specimen_id, order_test_id)` only |
| `lms_specimen_idempotency` | Specimen-operation idempotency; unique `(tenant_id, idempotency_key)` |

No accession/barcode/receiving columns. No Pathology table changes.

---

## 5. COMPLETE COLLECTION FLOW

1. Authenticate JWT; require **both** `lms.specimens.manage` **and** `lms.collection.collect`
2. Require `PatientIdentityConfirmed`
3. Load CollectionTask in tenant; optional `ExpectedCollectionTaskRowVersion` → 409 on mismatch
4. Require task status `Completed`; reject if Specimen already exists for task
5. Authorize actor for `CollectionTask.CollectionBranchId` via AuthService `POST api/internal/lms/validate-user-branch` (`IFollowupBranchAccessService` / active `user_branches` + primary `Users.BranchId`) — 403 `branch_unauthorized` if not authorized
6. Resolve Order (must be `Submitted`) + OrderVersion patient snapshots + task OrderTests (`Ordered`)
7. Create Specimen (`Collected`), collector = actor, `CollectedAt` = server UTC, `CollectionBranchId` + `LocationText` copied from CollectionTask (**no client LocationText override**)
8. Create Specimen↔OrderTest links
9. Audit fail-closed: `CREATE_SPECIMEN` then `COMPLETE_COLLECTION`
10. Complete specimen idempotency record; return Specimen detail
11. **Does not** mutate CollectionTask, Order, OrderTest, ownership, catalogue

---

## 6. AUTHORIZATION

| Operation | Gate |
|---|---|
| Complete Collection (API + UI visibility) | `lms.specimens.manage` **AND** `lms.collection.collect` |
| Complete Collection branch | Actor authorized for `CollectionTask.CollectionBranchId` (platform `ValidateUserBranchAsync`) |
| Specimen GET / by-collection-task | `lms.specimens.view` **OR** `lms.specimens.manage` |
| Definitions seeded (no grants) | `lms.specimens.view` · `manage` · `receive` |
| Not used for Complete Collection | `lms.specimens.receive` |
| Unchanged | `lms.collection.view\|manage\|collect` |

Tenant isolation via JWT + query filters. Empty `CollectionBranchId` rejected. Wrong branch → 403 `branch_unauthorized` even when both LMS permissions are present.

---

## 7. IDEMPOTENCY + CONCURRENCY

- Store: `lms_specimen_idempotency` (not Order/Collection stores)
- Same key + same hash → replay response (no second Specimen / no re-audit of mutation path)
- Same key + different hash → 409 `idempotency_conflict`
- Unique `(tenant_id, collection_task_id)` prevents duplicate Specimens
- Stale CollectionTask row version → 409 `concurrency_conflict`

---

## 8. AUDIT

| Action | Resource |
|---|---|
| `CREATE_SPECIMEN` | `LmsSpecimen` |
| `COMPLETE_COLLECTION` | `LmsSpecimen` |

Fail-closed: audit failure rolls back Specimen + links → 503 `audit_unavailable`.

---

## 9. API ENDPOINTS

| Method | Route | Auth |
|---|---|---|
| POST | `/api/lms/collection/tasks/{id}/complete-collection` | manage **AND** collect |
| GET | `/api/lms/specimens/{id}` | view **OR** manage |
| GET | `/api/lms/specimens/by-collection-task/{collectionTaskId}` | view **OR** manage |

---

## 10. TEST RESULTS (post pre-UAT verification)

| Suite | Exact command | Result |
|---|---|---|
| LaboratoryApi (full) | `dotnet test microservices/laboratory-service/LaboratoryApi.Tests/LaboratoryApi.Tests.csproj` | **Passed 132 / Failed 0** |
| AuthService LMS branch/user validate* | `dotnet test microservices/auth-service/AuthService.Tests/AuthService.Tests.csproj --filter "FullyQualifiedName~InternalLmsValidateUserBranchTests\|FullyQualifiedName~InternalLmsValidateUserPermissionTests" -o artifacts/auth-lms-test-build /p:UseAppHost=false` | **Passed 8 / Failed 0** |
| FE LMS (reconciled suite) | `npx vitest run src/app/dashboard/lms/collection/enterprise-lms-collection-ui.test.ts src/app/dashboard/lms/specimens/enterprise-lms-specimen-ui.test.ts src/app/dashboard/lms/enterprise-lms-l0-foundation.test.ts src/lib/lms/lms-collection.api.test.ts src/app/dashboard/lms/orders/enterprise-lms-orders-ui.test.ts src/lib/lms/lms-orders.api.test.ts` | **Passed 46 / Failed 0** |

\*Alternate `-o` path used when AuthService process locks default `bin`.

**FE count reconciliation:** Earlier “32” was the subset without orders UI/API tests (collection + specimens + L0 + collection.api). The reconciled LMS FE suite including orders regression is **46**. The report must not claim both counts for the same command.

---

## 11. REGRESSION

- L-COL-01B CollectionServiceTests included in LaboratoryApi suite (green)
- L-ORD / L-CAT covered by full LaboratoryApi.Tests (green)
- Collection UI tests still pass; L0 registry updated to include specimens as implemented
- Pathology `/dashboard/laboratory` untouched
- No role grants added

---

## 12. OUT OF SCOPE (confirmed not implemented)

Receiving · Accession · Barcode · Labels · Custody · Aliquots · Referral · Testing · Results · Verification · Authorization · Reporting · Billing · Role grants · Specimen Claim/Assign · Recollection UX · Pathology changes · OrderTest state changes · CollectionTask lifecycle/ownership/search changes

---

## 13. MANUAL UAT CHECKLIST (L-COL-01C)

1. Locate an eligible **Completed** CollectionTask with **no** Specimen yet  
2. Open task detail — verify MRN, Name, DOB from order context  
3. Confirm Complete Collection button visible only with **both** `lms.specimens.manage` and `lms.collection.collect` (or Admin `*`)  
4. Open Complete Collection → confirm identity checkbox → submit  
5. Verify Specimen created with state **Collected**  
6. Verify CollectionTask remains **Completed**  
7. Verify Order remains **Submitted**  
8. Verify OrderTests remain **Ordered**  
9. Verify collector = authenticated user, collected-at server UTC, branch (and optional location)  
10. Verify linked OrderTests on Specimen detail  
11. Open `/dashboard/lms/specimens/{id}` read-only detail  
12. Retry Complete Collection with same Idempotency-Key → safe replay (same Specimen)  
13. Second Complete Collection without replay key → conflict / already exists  
14. User missing either manage or collect → UI hidden / API 403  
15. Confirm UI has **no** Receive / accession / barcode / label actions  

---

## 14. NEXT STEP

**STOP for Product Owner manual UAT/acceptance.**

Do **not** implement Receiving, Testing, Results, Reporting, Billing, or any later LMS slice until UAT closes L-COL-01C.
