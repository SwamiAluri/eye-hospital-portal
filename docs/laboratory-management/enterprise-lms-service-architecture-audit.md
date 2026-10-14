# Enterprise LMS — Laboratory Service Architecture Audit (L-CAT-01A)

**Date:** 2026-10-08  
**Approved decisions:** AD-CAT-01 Option B (dedicated Laboratory Service); AD-CAT-02 dedicated LMS persistence  
**Mode:** Architecture foundation (no catalogue domain)

---

## 1. Monorepo structure

| Area | Convention |
|---|---|
| Frontend | `apps/hospital-portal-web` (Next.js 14) |
| Backend services | `microservices/<kebab-name>/` |
| Solution | `Hospital Portal.sln` (partial membership) |
| Shared SQL | `consolidated/migrations/` (inventory/IP) |
| Docs | `docs/`, `docs/laboratory-management/` |

## 2. Existing backend services

| Folder | Host project | Runtime | Local port |
|---|---|---|---|
| `auth-service` | `AuthService` | ASP.NET Core | 5073 |
| `counselling-service` | `CounsellingApi` | Azure Functions | 7071 |
| `inventory-service` | `InventoryApi` | Azure Functions | 7072 |
| `notification-service` | `NotificationService` | Azure Functions | 7073 |
| `ip-management-service` | `IpManagementService` | Azure Functions | 5074 |
| `ccms-service` | `CcmsApi` | Azure Functions | 7075 |
| **`laboratory-service` (new)** | **`LaboratoryApi`** | **Azure Functions** | **7076** |

## 3. Naming / project organization

- Folder: `microservices/<domain>-service/`
- Host: `*Api` (CCMS, Inventory, Counselling) or `*Service` (IP, Notification)
- Tests: sibling `{Host}.Tests`
- Laboratory follows **LaboratoryApi** (aligned with CcmsApi / InventoryApi)

## 4. Auth / authorization patterns

| Concern | AuthService | Satellite Functions (CCMS/IP) |
|---|---|---|
| JWT | JwtBearer middleware | Copied `JwtService` (shared secret) |
| Permissions | `[RequirePermission]` + DB fallback | JWT claim checks (`*Authz`) |
| Tenant | Claims | JWT `tenant_id` + `X-Tenant-ID` + RLS interceptor |
| Internal S2S | Internal API key | `X-Internal-Key` + AuthService HTTP clients |

**No shared auth NuGet** today — Laboratory copies the CCMS/IP pattern.

## 5. Database conventions

- Most services use PostgreSQL `hospitalportal` with **service-owned tables**
- CCMS: EF migrations under service
- IP/Inventory: SQL under `consolidated/migrations/`
- Auth: EF + additive SQL under `Data/Migrations/`

**L-CAT-01A recommendation:** Laboratory owns future `lms_*` tables via EF migrations under `LaboratoryApi/Migrations/` (CCMS-like). Physical DB may remain shared PG initially (**AD-CAT-DB** open for dedicated DB).

## 6. Frontend API clients

| Env var | Default | Client |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5073/api` | `getApi()` — Auth |
| `NEXT_PUBLIC_CCMS_API_URL` | `http://localhost:7075/api` | `getCcmsApi()` |
| `NEXT_PUBLIC_IP_MANAGEMENT_API_URL` | `http://localhost:5074/api` | IP module |
| **`NEXT_PUBLIC_LABORATORY_API_URL`** | **`http://localhost:7076/api`** | **`getLaboratoryApi()`** |

Pathology catalogue remains on Auth via `laboratory-catalog.api.ts`.

## 7. Audit

Platform audit SoT: AuthService `AuditService` / `audit_log`.  
Laboratory Service must **not** create a parallel audit product. Integration for L-CAT-01B: AuthService audit API or shared `audit_log` write via internal contract (**AD-CAT-AUDIT**).

## 8. Observability / CI / deploy

- Functions: Application Insights sampling in `host.json`; console logging
- Health: domain-specific (Laboratory: `/api/lms/health`)
- CI: primarily Auth + CCMS + FE — Laboratory not yet in CI (document as follow-up)
- Docker/K8s: no uniform Dockerfiles for Functions in-repo; deploy pattern follows Azure Functions peers

## 9. Local development

`START_ALL.ps1` now starts LaboratoryApi on **7076** after Azurite. Align `Jwt__Key` with AuthService.

## 10. Legacy Pathology

Unchanged: `/dashboard/laboratory`, AuthService `laboratory_*`, `laboratory.view`, catalogue APIs.

## 11. L-CAT-01A Architecture Closure

See [enterprise-lms-lcat-01a-architecture-closure.md](./enterprise-lms-lcat-01a-architecture-closure.md).

| ID | Classification |
|---|---|
| AD-CAT-DB | APPROVED — shared `hospitalportal`, Laboratory owns `lms_*` |
| AD-CAT-AUDIT | APPROVED — platform `audit_log` via Auth internal API |
| PD-CAT-01 | APPROVED — `lms.catalogue.view` + `lms.catalogue.manage` |
| PD-CAT-02 | DECISION REQUIRED — no automatic role grants |
| PD-CAT-03 | APPROVED — tenant + optional Branch applicability |
| PD-CAT-04 | APPROVED — `lms.catalogue.approve` capability |
| CI | APPROVED — `laboratory-build-test` job |
