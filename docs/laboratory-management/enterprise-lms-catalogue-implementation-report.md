# L-CAT-01B Implementation Report — Enterprise LMS Catalogue Domain

**Date:** 2026-10-08  
**PRD SoT:** Enterprise Hospital Laboratory Management System | PRD/BRD v1.0 | 08 October 2026  
**Status:** Implementation complete — **STOP for Manual UAT** (Order Intake not started)

## 1. Scope

Governed laboratory catalogue: identity, versioning, effective dating, lifecycle, panels, referral tests, tenant/branch scope, audit, permissions, Configuration UI, tests, docs.

**Explicitly NOT implemented:** Order Intake, collection, specimens, testing, results, reporting, billing engines, referrals ops, QC, integrations.

## 2. Database model

See [enterprise-lms-catalogue-architecture.md](./enterprise-lms-catalogue-architecture.md).

Tables: `lms_catalogue_items`, `lms_catalogue_versions`, `lms_catalogue_panel_components`, `lms_catalogue_branch_applicability`.

## 3. Migration

`LaboratoryApi/Migrations/20261008135557_AddLmsCatalogueTables.cs`  
Additive only. Does not touch `laboratory_*`.

## 4. API endpoints

`/api/lms/catalogue` (+ draft / submit-review / return-draft / approve / activate / retire / supersede / versions). Dedicated lifecycle routes only.

## 5. State machine

See [enterprise-lms-catalogue-state-machine.md](./enterprise-lms-catalogue-state-machine.md).

## 6. Versioning strategy

Integer `VersionNumber`. Supersede creates Draft v+1 and marks prior Active as Superseded. Active/Retired/Superseded definitions immutable.

## 7. Effective-date behavior

Validated `EffectiveFrom`/`EffectiveTo`. Activate defaults From to UTC now. History retained.

## 8. Panel architecture

Panel version → ordered `PanelComponent` rows referencing component item + specific version. Self-reference and nested panels rejected.

## 9. Referral-test architecture

`REFERRAL_TEST` type forces `REFERRAL` classification. Distinct from local `TEST`. No shipment/result ops.

## 10. Branch applicability

Optional platform Branch IDs. Empty set = tenant-wide. No new hierarchy.

## 11. Permission model

`lms.catalogue.view|manage|approve` seeded; **no role grants** (PD-CAT-02). `laboratory.view` insufficient.

## 12. Audit integration

`POST /api/internal/audit` (AuthService, X-Internal-Key) → platform `audit_log`. Mutations fail closed if audit unavailable.

## 13. Concurrency handling

`RowVersion` concurrency token + optional `expectedRowVersion` on mutations → 409 on conflict.

## 14. Frontend screens

- `/dashboard/lms/configuration/test-catalogue` — list/search/create
- `/dashboard/lms/configuration/test-catalogue/[id]` — detail/lifecycle/history
- `/dashboard/lms/configuration/panels` — same workbench filtered to PANEL

## 15. Files changed (primary)

- AuthService: `InternalAuditController`, `EnterpriseLmsCataloguePermissionCatalog`, PermissionSeeder, Program seed call, tests
- LaboratoryApi: Domain entities, DbContext, migration, CatalogueService, PlatformAuditClient, CatalogueFunctions, Program DI
- FE: laboratory-service.api, CatalogueWorkbench/DetailView, pages, nav/capability updates, tests
- Docs: architecture, state machine, this report, implementation plan

## 16. AuthService changes

- Internal audit write endpoint
- Permission catalogue seed (no grants)
- Automated permission + audit controller tests

## 17. Tests added

- `CatalogueServiceTests`, `CatalogueAuthzTests` (LaboratoryApi)
- `EnterpriseLmsCataloguePermissionTests`, `InternalAuditControllerTests` (AuthService)
- FE: `enterprise-lms-catalogue.test.ts`, updated laboratory-service.api.test + L0 foundation capability expectation

## 18–19. Test / regression results

| Suite | Result |
|---|---|
| LaboratoryApi.Tests | **Passed 37 / 37** |
| AuthService.Tests filter `EnterpriseLms\|InternalAudit` | **Passed 8 / 8** (built to alt output due to running AuthService file lock) |
| FE vitest (L0 foundation + catalogue + laboratory-service.api) | **Passed 20 / 20** |
| AuthService LaboratoryCatalog (Pathology regression) | **Passed 17 / 17** |

Pathology Laboratory APIs/UI were not modified in this slice.

## 20. Documentation

- `enterprise-lms-catalogue-architecture.md`
- `enterprise-lms-catalogue-state-machine.md`
- `enterprise-lms-catalogue-implementation-report.md`
- Updated `enterprise-lms-implementation-plan.md` traceability

## 21. Traceability updates

Catalogue row marked **Implemented (pending Manual UAT)**. Order intake and downstream clinical/financial rows remain Planned / not implemented.

## 22. Decisions required

| ID | Topic |
|---|---|
| PD-CAT-02 | Which production roles receive catalogue permissions |
| Commercial | When Service Catalog refs become mandatory for activation |
| Overlap | Whether Activate may auto-supersede prior Active (currently yes) |

## 23. Risks

- Catalogue permissions not granted to any role until PD-CAT-02 → UAT relies on Admin `*`
- Audit dependency: AuthService must be reachable with matching InternalApi key
- Migration must be applied to shared `hospitalportal` before UAT mutations

## 24. Manual UAT checklist

See slice brief UAT-01 … UAT-11. Do not proceed to L-ORD-01 until acceptance.

## 25. Order Intake

**Order Intake was NOT implemented in L-CAT-01B.**
