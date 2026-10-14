# Enterprise LMS — Laboratory Service Integration (L-CAT-01A)

## Authentication

| Step | Mechanism |
|---|---|
| Login | AuthService issues JWT |
| Call LaboratoryApi | `Authorization: Bearer <jwt>` |
| Tenant header | `X-Tenant-ID` (must match JWT `tenant_id`) |
| Validation | LaboratoryApi `JwtService` (issuer/audience/key aligned with Auth) |

No second identity store.

## Authorization — PD-CAT-01 / PD-CAT-04

| Code | Use | Status |
|---|---|---|
| `lms.view` | LMS workspace + secure-ping | Active |
| `lms.catalogue.view` | Catalogue read | Architecture approved; seed in L-CAT-01B |
| `lms.catalogue.manage` | Draft mutations / submit / retire | Architecture approved; seed in L-CAT-01B |
| `lms.catalogue.approve` | Approve / activate | Architecture approved; role map PD-CAT-02 |
| `laboratory.view` | Pathology only | Must not gate LMS catalogue |
| `patient.view` / `patient.update` | Not LMS catalogue admin | Forbidden as LMS admin |

Role grants: **PD-CAT-02 DECISION REQUIRED** — not auto-seeded.

## Tenant / org / site

- Tenant: JWT + RLS `app.current_tenant_id` via `TenantCommandInterceptor`
- Branch/site: platform `useBranchContext` on LMS UI; catalogue scoping policy **PD-CAT-03**
- No new Laboratory→Section→Bench hierarchy invented

## Audit — AD-CAT-AUDIT (**APPROVED** pattern)

- Product SoT: AuthService `audit_log` / `AuditService`
- `StageAsync` is in-process only (AuthService DbContext) — not usable from Functions
- LaboratoryApi must call a future **AuthService internal audit write** API (`X-Internal-Key` + tenant + actor + action + object + reason)
- Do not create a Laboratory-local audit table
- Catalogue lifecycle events: first implemented in L-CAT-01B after internal endpoint exists

## Observability

- Functions worker logging + Application Insights sampling (`host.json`)
- Health: `GET /api/lms/health` (includes DB reachability flag)
- Correlation IDs: follow Functions/host defaults; align with peers in later hardening if required

## Configuration / secrets

| Key | Purpose |
|---|---|
| `Jwt__Key` / Issuer / Audience | Match Auth |
| `ConnectionStrings:DefaultConnection` | LMS DB connection |
| `AuthService__BaseUrl` | Platform HTTP |
| `AuthService__InternalApiKey` | S2S |
| `NEXT_PUBLIC_LABORATORY_API_URL` | FE base |

No new secret manager.

## Service communication

| Pattern | L-CAT-01A |
|---|---|
| Browser → LaboratoryApi | HTTPS/HTTP + JWT |
| LaboratoryApi → AuthService | HttpClient registered (unused beyond readiness for L-CAT-01B) |
| Events / outbox | Documented dependency for later slices; not implemented |

## Frontend

```ts
import { getLaboratoryApi, getLmsHealth, getLmsSecurePing }
  from '@/lib/api/laboratory-service.api';
```

Do not use `laboratory-catalog.api.ts` for Enterprise LMS.

## Deployment / local

- Local: `func start` on 7076; Azurite required; `START_ALL.ps1` updated
- CI: add `dotnet test LaboratoryApi.Tests` job when approved (not mandatory for L-CAT-01A shell)
- Production: Azure Functions peer of CCMS/IP

## Testing

- Unit: JWT, authz, empty DbContext, legacy isolation (source scan)
- Manual: health + secure-ping with Admin `*` or `lms.view` token
