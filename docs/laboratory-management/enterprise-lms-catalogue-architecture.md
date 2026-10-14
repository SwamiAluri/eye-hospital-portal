# Enterprise LMS Catalogue Architecture (L-CAT-01B)

**PRD SoT:** Enterprise Hospital Laboratory Management System | PRD/BRD v1.0 | 08 October 2026  
**Service:** LaboratoryApi (`microservices/laboratory-service/LaboratoryApi`)  
**UI:** `/dashboard/lms/configuration/test-catalogue` (+ Panels filter view)

## Boundary

| Surface | Owner |
|---|---|
| Enterprise LMS catalogue | LaboratoryApi → `lms_catalogue_*` |
| Legacy Pathology catalogue | AuthService → `laboratory_*` (unchanged) |

No write-through sync. No data migration. No redirect from `/dashboard/laboratory`.

## Domain model

```text
LmsCatalogueItem (stable identity)
    └── LmsCatalogueVersion (versioned definition + lifecycle)
            ├── LmsCataloguePanelComponent (PANEL only)
            └── LmsCatalogueBranchApplicability (optional)
```

### Tables

| Table | Purpose |
|---|---|
| `lms_catalogue_items` | Stable identity (`TEST` / `PANEL` / `REFERRAL_TEST`) |
| `lms_catalogue_versions` | Versioned definition + lifecycle actors/timestamps |
| `lms_catalogue_panel_components` | Ordered component refs (item + version) |
| `lms_catalogue_branch_applicability` | Optional platform Branch IDs |

### Types

- `TEST` — local orderable test (`LOCAL` classification)
- `PANEL` — ordered container of component tests/referral tests
- `REFERRAL_TEST` — first-class referral catalogue object (`REFERRAL` classification forced)

### Disciplines

PRD codes supported as string codes (e.g. `CLINICAL_CHEMISTRY`). No automatic activation of all disciplines. No clinical seed data.

## Versioning

- Deterministic integer `VersionNumber` (1, 2, 3…)
- Active / Retired / Superseded versions are definition-immutable
- Changes to Active require `Supersede` → new Draft version
- Unique `(CatalogueItemId, VersionNumber)`

## Effective dating

- `EffectiveFrom` / `EffectiveTo` on each version
- `EffectiveTo` must be ≥ `EffectiveFrom` when both set
- Activate defaults `EffectiveFrom` to UTC now if unset
- Historical versions remain retrievable via version history

## Branch applicability

- `TenantId` mandatory
- Zero branch rows ⇒ **tenant-wide**
- Rows store existing platform Branch IDs only — no new org hierarchy

## Commercial reference

- `ServiceCatalogRef` (and related refs) are nullable string references
- Billing remains financial SoT — no LMS pricing engine

## Clinical configuration

Reference intervals, critical values, TAT, delta-check, autoverification are **nullable refs / not configured**. UI must not present them as live values.

## API (LaboratoryApi)

| Method | Route | Permission |
|---|---|---|
| GET | `/api/lms/catalogue` | `lms.catalogue.view` |
| GET | `/api/lms/catalogue/{id}` | `lms.catalogue.view` |
| GET | `/api/lms/catalogue/{id}/versions` | `lms.catalogue.view` |
| POST | `/api/lms/catalogue` | `lms.catalogue.manage` |
| PUT | `/api/lms/catalogue/{id}/draft` | `lms.catalogue.manage` |
| POST | `/api/lms/catalogue/{id}/submit-review` | `lms.catalogue.manage` |
| POST | `/api/lms/catalogue/{id}/return-draft` | manage or approve |
| POST | `/api/lms/catalogue/{id}/approve` | `lms.catalogue.approve` |
| POST | `/api/lms/catalogue/{id}/activate` | `lms.catalogue.approve` |
| POST | `/api/lms/catalogue/{id}/retire` | `lms.catalogue.manage` |
| POST | `/api/lms/catalogue/{id}/supersede` | `lms.catalogue.manage` |

No arbitrary status PATCH.

## Permissions

Seeded in AuthService permission catalogue (no role grants — PD-CAT-02):

- `lms.catalogue.view`
- `lms.catalogue.manage`
- `lms.catalogue.approve`

`laboratory.view` does **not** authorize catalogue operations. Admin `*` may be used for UAT.

## Audit

```text
LaboratoryApi mutation (JWT actor/tenant)
  → POST AuthService /api/internal/audit
       (X-Internal-Key + X-Tenant-ID matching body TenantId)
       Action/ResourceType allowlisted for LmsCatalogueVersion
    → IAuditService.LogAsync → audit_log (server timestamp)
```

Mutations fail-closed: if audit write fails, LaboratoryApi compensates/reverts the mutation and returns 503. LaboratoryApi does not own `audit_log`.

## Concurrency

`LmsCatalogueVersion.RowVersion` is an optimistic concurrency token incremented on every mutation. Lifecycle/update requests may supply `expectedRowVersion`; mismatch → 409 `concurrency_conflict`.

## Migration

EF migration: `20261008135557_AddLmsCatalogueTables`  
Deploy via controlled migration process (no automatic production `Database.Migrate()` introduced).
