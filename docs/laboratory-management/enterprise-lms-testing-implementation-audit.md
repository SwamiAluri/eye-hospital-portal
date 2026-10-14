# L-TST-01A — Implementation Audit (Step 0)

**Date:** 2026-10-11  
**Authorization:** `PRODUCT_DECISIONS_CLOSED_L_COL_01F_AUTHORIZED`  
**Mode:** Pre-coding audit only (this file does not implement)

## Confirmed reusable foundations

| # | Area | Location / pattern | Reuse |
|---|---|---|---|
| 1 | LaboratoryApi | `microservices/laboratory-service/LaboratoryApi` Azure Functions | Yes |
| 2 | DbContext / `lms_*` | `Data/LaboratoryDbContext.cs` | Yes — add Result tables |
| 3 | Migrations | `yyyyMMddHHmmss_AddLms…` | Yes |
| 4 | Order / OrderTest | `LmsOrder`, `LmsOrderTest`, `Ordered` only | Consume; **no status mutation** |
| 5 | Specimen / Receiving | `LmsSpecimen`, M:N links, Receive/Reject | Consume Received eligibility |
| 6 | Catalogue | `LmsCatalogueVersion.ResultDatatype`, `Classification`, panel explosion → OrderTests | Join for datatype; no catalogue mutation |
| 7 | Authz | `LaboratoryAuthz` + branch via `ValidateUserBranchAsync` | Extend codes |
| 8 | Audit | `PlatformAuditClient` + Auth `AllowedActions` | Add CREATE/UPDATE_RESULT_DRAFT + `LmsResult` |
| 9 | Idempotency | Per-domain `lms_*_idempotency` unique (tenant,key) | New `lms_result_idempotency` |
| 10 | RowVersion | int concurrency token | On `lms_results` |
| 11 | FE shell | `LmsPageShell`, SpecimenWorkbench patterns, `lib/lms/*` | Testing workbench |
| 12 | Permission seed | `EnterpriseLms*PermissionCatalog` + seeder, **no role grants** | Testing catalog |
| 13 | Tests | `LaboratoryApi.Tests` SpecimenBarcode templates | Clone |

## Gaps (to implement)

- No Result entities/APIs/UI  
- No `lms.testing.*` AuthService seed  
- FE Testing routes are `not_implemented`  
- `OrderableItemDto` does not expose ResultDatatype — join catalogue version from OrderTest  

## Schema plan (authorized)

- `lms_results` — aggregate (OrderTest + Specimen + tenant + branch); status Draft only; RowVersion  
- `lms_result_versions` — append-only draft versions (foundation; no Final/Amended)  
- `lms_result_idempotency` — CREATE/UPDATE ops  

**Unique:** `(tenant_id, order_test_id, specimen_id)` — one Draft aggregate; updates append version  

## Dependencies

All required dependencies exist. No inventing replacements.

**Proceed to implementation.**
