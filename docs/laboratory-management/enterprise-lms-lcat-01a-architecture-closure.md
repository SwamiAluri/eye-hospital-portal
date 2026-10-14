# L-CAT-01A Architecture Closure

**Date:** 2026-10-08  
**Status:** CLOSURE DOCUMENTED — awaiting explicit product/architecture acceptance before L-CAT-01B  
**Service:** `LaboratoryApi` (:7076, `/api/lms/*`)

```text
NO CATALOGUE TABLES
NO CATALOGUE APIs
NO CATALOGUE UI
L-CAT-01B NOT STARTED
```

---

## Closure summary

| ID | Topic | Classification | Decision |
|---|---|---|---|
| **AD-CAT-DB** | Database ownership | **APPROVED** | Shared PostgreSQL `hospitalportal`; LaboratoryApi owns future `lms_*` tables via EF migrations |
| **AD-CAT-AUDIT** | Audit ownership | **APPROVED** (integration pattern) | Platform `audit_log` via AuthService; Functions use internal write API (to be added before/with first L-CAT-01B mutation) |
| **PD-CAT-01** | Minimum catalogue permissions | **APPROVED** (architecture default) | `lms.catalogue.view` + `lms.catalogue.manage` |
| **PD-CAT-02** | Role mapping | **DECISION REQUIRED** | No automatic role grants; capability exists without inventing Lab Director etc. |
| **PD-CAT-03** | Catalogue scope | **APPROVED** (architecture default) | Tenant-required; optional multi-site applicability via platform Branch IDs; no new hierarchy |
| **PD-CAT-04** | Approve/activate authority | **APPROVED** (capability) | Separate `lms.catalogue.approve` for Approve/Activate; role holders unresolved (PD-CAT-02) |
| **CI** | LaboratoryApi in CI | **APPROVED** | Job `laboratory-build-test` in `.github/workflows/ci-cd.yml` |

---

## AD-CAT-DB — APPROVED

### Evidence

CCMS, IP, Inventory, Counselling, Notification all use `Database=hospitalportal` with service-owned tables/prefixes — not database-per-service.

### Options considered

| Option | Verdict |
|---|---|
| A. Shared PG `hospitalportal`, Laboratory-owned `lms_*` tables | **Selected** — matches repo |
| B. Dedicated `hospitalportal_lms` database | Deferred — higher ops cost; revisit if isolation/compliance demands |
| C. PostgreSQL schema-only isolation (`lms` schema) | Compatible enhancement later; not required for L-CAT-01B |

### Approved strategy

| Topic | Value |
|---|---|
| Owner | LaboratoryApi / `LaboratoryDbContext` |
| Database | `hospitalportal` (shared platform PG) |
| Table naming | `lms_*` (owned exclusively by LaboratoryApi) |
| Connection | `ConnectionStrings:DefaultConnection` |
| Migrations | EF under `LaboratoryApi/Migrations/` (CCMS-like) — **none in L-CAT-01A** |
| Local | Align connection with peer Functions services for UAT; shell tests use InMemory where applicable |
| Tests | InMemory for unit; live PG only for future schema-drift style tests |
| Pathology | `laboratory_*` remains AuthService-only; no FK write-through |

---

## AD-CAT-AUDIT — APPROVED (pattern)

### Evidence

- Platform SoT: AuthService `IAuditService` / `audit_log` with `StageAsync` / `LogAsync`
- Fields: TenantId, UserId, Action, ResourceType, ResourceId, Description/details, OldValues/NewValues, Reason (model), IpAddress, UserAgent, SessionId, Timestamp, hash chain
- `StageAsync` requires AuthService `AppDbContext` — **not** callable in-process from Azure Functions
- No Internal Audit write controller exists today (unlike Internal IP/CCMS callbacks)

### Approved integration boundary

```text
LaboratoryApi (mutation)
    → HTTP POST AuthService internal audit endpoint (X-Internal-Key + X-Tenant-ID)
        → AuditService.LogAsync / Stage+Save
            → audit_log
```

| Concern | Mapping |
|---|---|
| actor | JWT userId |
| tenant | JWT / X-Tenant-ID |
| object | ResourceType + ResourceId (e.g. `LmsCatalogueVersion`) |
| action | lifecycle verb (CREATE_DRAFT, SUBMIT_REVIEW, APPROVE, ACTIVATE, …) |
| reason | details / Reason field |
| timestamp | CreatedAt / Timestamp UTC |
| outcome | Status / description |
| correlation | SessionId / optional details JSON |

**L-CAT-01B prerequisite:** implement AuthService internal audit write endpoint **or** first catalogue mutation slice must include it. Do **not** create a Laboratory-local audit table.

---

## PD-CAT-01 — APPROVED (architecture default)

| Code | Purpose |
|---|---|
| `lms.catalogue.view` | List/search/detail |
| `lms.catalogue.manage` | Draft create/update, submit for review, retire/supersede drafts |

Not introduced as separate codes for L-CAT-01B: create, edit, review, activate, retire (covered by manage + approve).

| Surface | Consumption |
|---|---|
| Defined | AuthService permission catalog (seed in L-CAT-01B); FE `LMS_CATALOGUE_PERMISSIONS`; BE `LaboratoryAuthz` |
| LaboratoryApi | JWT claim check via `LaboratoryAuthz` |
| Frontend | `ProtectedRoute` / nav `requiredPermission` + `hasPermission` |
| Enforcement | Server-side mandatory; UI hide is not security |

Workspace gate `lms.view` remains for LMS shell navigation.

---

## PD-CAT-02 — DECISION REQUIRED

Existing roles **Lab Technician** / **Lab Manager** are linked to Pathology `laboratory.view` only.

Enterprise LMS must **not** auto-grant catalogue permissions to those roles or invent Lab Director / Quality Manager / Medical Director mappings.

| Until PO decides | Behavior |
|---|---|
| Admin wildcard `*` | Sees/manages if claims include `*` |
| Explicit grants | None seeded |
| Product | Assign `lms.catalogue.*` to approved roles |

---

## PD-CAT-03 — APPROVED (architecture default)

### Platform context (reuse)

| Concept | Platform representation |
|---|---|
| Tenant | JWT `tenant_id` + RLS |
| Organization | AuthService Organization / user.OrganizationId |
| Site / Branch | AuthService Branch; FE `useBranchContext` |
| Location | Not a separate LMS hierarchy |
| Laboratory / Section / Discipline | **Catalogue attributes** (future), not new org tree |

### Catalogue scope model for L-CAT-01B

1. **TenantId required** on every catalogue identity/version.
2. **Multi-site applicability** as optional Branch ID list / applicability rows referencing platform Branch — not a duplicate site master.
3. Default if unspecified: **tenant-wide** visibility within LMS (least surprising for first slice).
4. Exclusive single-site-only policy: product can tighten later without schema rewrite if applicability table exists.

Do not invent Laboratory→Section→Bench as platform infrastructure.

---

## PD-CAT-04 — APPROVED (capability)

| Transition | Required capability |
|---|---|
| Draft → Review (submit) | `lms.catalogue.manage` |
| Review → Approved | `lms.catalogue.approve` |
| Approved → Active | `lms.catalogue.approve` |
| Active → Retired/Superseded | `lms.catalogue.manage` or approve (finalize in L-CAT-01B state machine) |

Do **not** allow Draft → Active in one step.

Role holders for `lms.catalogue.approve` remain **PD-CAT-02**.

---

## Authentication / authorization review

| Check | Result |
|---|---|
| Centralized identity | Pass — Auth issues JWT |
| No second identity | Pass |
| Tenant authoritative | Pass — JWT + header match + RLS |
| Server-side authz | Pass — `LaboratoryAuthz` on secure endpoints |
| RLS ≠ authorization | Pass — RLS tenant filter only |
| `laboratory.view` not LMS catalogue gate | Pass — constants + tests reject |
| Pathology permissions untouched | Pass |
| Safe correction | Missing permission now returns **403 Forbidden** (was 401) |

---

## CI — APPROVED

Job: `laboratory-build-test`  
Path: `.github/workflows/ci-cd.yml`  
Actions: restore/build LaboratoryApi; `dotnet test LaboratoryApi.Tests`  
Gated into `deploy-backend` / final workflow needs alongside CCMS.

No production Azure Functions deploy job for Laboratory yet (**DEFERRED** — follow CCMS deploy pattern when ready).

---

## Local development

| Item | Value |
|---|---|
| Port | 7076 (no conflict with 5073–5074, 7071–7075, 3000) |
| START_ALL | Starts LaboratoryApi |
| Env | `NEXT_PUBLIC_LABORATORY_API_URL=http://localhost:7076/api` |
| JWT | Align `Jwt__Key` with AuthService |
| DB | Align `DefaultConnection` with peer Functions for live health checks |

---

## Prerequisites for L-CAT-01B

1. Explicit acceptance of this closure (especially PD-CAT-02 role policy or waiver that Admin-only UAT is enough for first catalogue slice).
2. AuthService internal audit write endpoint (AD-CAT-AUDIT) available before first lifecycle mutation.
3. Seed permission definitions for `lms.catalogue.view|manage|approve` **without** role grants unless PD-CAT-02 resolved.
4. Then: catalogue tables + lifecycle + LMS Configuration UI only.
