# Enterprise LMS — Laboratory Service Architecture (L-CAT-01A)

**Status:** Architecture Defined — shell implemented  
**Service:** `microservices/laboratory-service/LaboratoryApi`  
**Port:** 7076  
**API root:** `/api/lms`

## Architecture diagram

```text
                    ┌─────────────────────────────┐
                    │   Hospital Portal Web       │
                    │   /dashboard/lms/*  (LMS)   │
                    │   /dashboard/laboratory     │
                    │         (Pathology)         │
                    └─────────────┬───────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
 ┌─────────────────┐   ┌────────────────────┐   ┌──────────────────────┐
 │   AuthService   │   │ Laboratory Service │   │ Other services       │
 │   :5073         │   │ LaboratoryApi:7076 │   │ CCMS / IP / …        │
 │                 │   │                    │   │                      │
 │ Identity / JWT  │◄──┤ JWT validate       │   │                      │
 │ Permissions     │   │ (shared secret)    │   │                      │
 │ Platform audit  │   │ TenantContext+RLS  │   │                      │
 │ Pathology lab_* │   │ LMS DB ownership   │   │                      │
 └────────┬────────┘   └─────────┬──────────┘   └──────────────────────┘
          │                      │
          ▼                      ▼
 ┌─────────────────┐   ┌────────────────────┐
 │ laboratory_*    │   │ Future lms_*       │
 │ (Pathology SoT) │   │ (Enterprise LMS)   │
 │ NO sync bridge  │   │ Catalogue → …      │
 └─────────────────┘   └────────────────────┘
```

### Future Laboratory Service domains (not implemented)

```text
LaboratoryApi
  ├── Catalogue          ← L-CAT-01B
  ├── Orders
  ├── Collection
  ├── Specimens
  ├── Testing
  ├── Results / Verification / Authorization
  ├── Reporting
  ├── Referrals
  ├── Quality
  └── Operations / Analytics hooks
```

## Confirmed decisions

| ID | Decision |
|---|---|
| AD-CAT-01 | Dedicated Laboratory Service (Option B) |
| AD-CAT-02 | Dedicated LMS persistence; no legacy write-through |

## Service location

```
microservices/laboratory-service/
  LaboratoryApi/                 # Azure Functions host
  LaboratoryApi.Tests/
  README.md
```

Solution: `Hospital Portal.sln` includes both projects.

## Database ownership — AD-CAT-DB (**APPROVED**)

| Topic | Decision |
|---|---|
| Owner | LaboratoryApi (`LaboratoryDbContext`) |
| Database | Shared PostgreSQL `hospitalportal` (same as CCMS/IP/Inventory) |
| Tables | None yet; future `lms_*` owned exclusively by LaboratoryApi |
| Connection | `ConnectionStrings:DefaultConnection` |
| Migrations | EF under `LaboratoryApi/Migrations/` starting L-CAT-01B |
| Dedicated DB | Deferred (optional later) |

Full closure: [enterprise-lms-lcat-01a-architecture-closure.md](./enterprise-lms-lcat-01a-architecture-closure.md)

## API boundary

| Route | Purpose |
|---|---|
| `GET /api/lms/health` | Anonymous health |
| `GET /api/lms/secure-ping` | JWT + `lms.view` |
| `GET /api/lms/catalogue/...` | Reserved for L-CAT-01B — **not implemented** |

## Authentication / authorization

- JWT: issuer `EyeHospitalAuth`, audience `EyeHospitalAPI`, key from `Jwt__Key` (must match Auth)
- Tenant: JWT `tenant_id` + `X-Tenant-ID` match (IP-style)
- Permission for shell: `lms.view` only
- Missing permission → **403 Forbidden**
- Forbidden for LMS admin: `laboratory.view`, `patient.view`, `patient.update` as catalogue gates
- Catalogue capabilities (L-CAT-01B): `lms.catalogue.view|manage|approve` (PD-CAT-01/04)

## Audit / observability / config

See `enterprise-lms-service-integration.md` and AD-CAT-AUDIT in the closure doc.

## L-CAT-01A Architecture Closure

See [enterprise-lms-lcat-01a-architecture-closure.md](./enterprise-lms-lcat-01a-architecture-closure.md) for AD-CAT-DB, AD-CAT-AUDIT, PD-CAT-01..04, and CI.

## Stop

No catalogue tables, CRUD, or Order Intake until L-CAT-01B is explicitly approved after this closure.
