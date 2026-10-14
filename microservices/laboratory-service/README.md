# Laboratory Service (Enterprise LMS)

**Slice:** L-CAT-01A — Architecture foundation  
**Host:** Azure Functions (.NET 8 isolated) — `LaboratoryApi`  
**Local port:** `7076`  
**API prefix:** `http://localhost:7076/api/lms/...`

## Boundary

- Owns future Enterprise LMS laboratory domain (catalogue, orders, specimens, testing, results, reporting, referrals, quality).
- Does **not** own Pathology Laboratory (`/dashboard/laboratory` → AuthService `laboratory_*`).
- AuthService remains identity/JWT/permission catalog SoT.

## L-CAT-01A endpoints

| Method | Route | Auth |
|---|---|---|
| GET | `/api/lms/health` | Anonymous |
| GET | `/api/lms/secure-ping` | JWT + `lms.view` |

No catalogue APIs or tables in this slice.

## Local run

```powershell
# Azurite required (same as other Functions services)
npx azurite --location .\azurite-data --silent

cd microservices\laboratory-service\LaboratoryApi
# Align Jwt__Key and DefaultConnection with AuthService / other Functions services
func start
```

Or use updated `START_ALL.ps1` (includes Laboratory on 7076).

## Frontend

```
NEXT_PUBLIC_LABORATORY_API_URL=http://localhost:7076/api
```

Client module: `apps/hospital-portal-web/src/lib/api/laboratory-service.api.ts`

## Tests

```powershell
dotnet test microservices\laboratory-service\LaboratoryApi.Tests\LaboratoryApi.Tests.csproj
```

## Next slice

**L-CAT-01B** — Enterprise catalogue domain (tables, lifecycle, APIs, LMS configuration UI).
