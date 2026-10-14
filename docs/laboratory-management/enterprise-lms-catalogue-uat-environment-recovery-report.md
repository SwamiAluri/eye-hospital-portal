# L-CAT-01B — UAT Environment Recovery Report

**Date:** 2026-10-08  
**Mode:** Environment / configuration / rebuild / restart only  
**Catalogue feature changes:** None  
**Order Intake / L-ORD-01:** Not started  
**UAT mutations:** Not performed  

## Final status

**BLOCKED_AUTHORIZATION**

Infrastructure recovery succeeded (LaboratoryApi, Azure DB target, AuthService rebuild, internal audit, permission **definitions**). Manual UAT cannot resume with the **currently signed-in browser account** because it lacks `lms.view` / `lms.catalogue.*` and does not receive Admin `*`. PD-CAT-02 remains deferred — no role grants were added.

---

## 1. LaboratoryApi startup result

| Check | Result |
|---|---|
| Start mechanism | Dedicated `func start` in `LaboratoryApi` (same as `START_ALL.ps1` Lab step) |
| Process | Running (`func` on port 7076) |
| Port | **7076 listening** |
| Startup exception | None observed |

---

## 2. Port 7076 health result

`GET http://localhost:7076/api/lms/health` → **HTTP 200**

Safe body (captured):

```json
{
  "status": "ok",
  "service": "LaboratoryApi",
  "domain": "Enterprise LMS",
  "slice": "L-CAT-01B",
  "catalogueImplemented": true,
  "database": { "reachable": true },
  "utc": "2026-10-08T15:17:46.3776759Z"
}
```

---

## 3. Database target verification

| Item | Before | After |
|---|---|---|
| LaboratoryApi `DefaultConnection` host | `localhost` | `hospitalportal-db-server.postgres.database.azure.com` |
| Database name | `hospitalportal` | `hospitalportal` |
| Matches AuthService shared DB | No | **Yes** |
| JWT key aligned to AuthService | Placeholder mismatch risk | **Aligned** (value not printed) |
| Internal API key Lab ↔ Auth | MATCH (unchanged) | MATCH |

Changed file (config only):  
`microservices/laboratory-service/LaboratoryApi/local.settings.json`

No new database, schema, migration, or table changes. AuthService DB configuration was not modified.

Health payload reports `database.reachable: true` against the Azure target.

---

## 4. Azure LMS table verification

Read-only against Azure `hospitalportal` (same target Lab API now uses):

| Table | Exists |
|---|---|
| `lms_catalogue_items` | Yes |
| `lms_catalogue_versions` | Yes |
| `lms_catalogue_panel_components` | Yes |
| `lms_catalogue_branch_applicability` | Yes |

No rows inserted.

---

## 5. AuthService rebuild / restart result

| Item | Result |
|---|---|
| Stale process on `:5073` | Stopped (PID 17040) |
| Rebuild | `dotnet build -c Debug` → **0 errors** |
| Binary timestamp | `AuthService.exe` ≈ **2026-10-08 20:45:17 +05:30** |
| Restart | `dotnet run -c Debug --no-build --launch-profile http` → `:5073` |
| Serving process | `...\AuthService\bin\Debug\net8.0\AuthService.exe` (PID 27792) |
| DLL contains `InternalAuditController` | **Yes** |
| DLL contains LMS catalogue permission seeder | **Yes** |
| Stale Auth on `:5000` | Left running; **not used** for verification |

---

## 6. Internal audit 401 verification

`POST http://localhost:5073/api/internal/audit` with a valid body and **no** / **wrong** `X-Internal-Key`:

| Probe | HTTP | Body (safe) |
|---|---|---|
| No key | **401** | `{"error":"Invalid or missing internal API key."}` |
| Wrong key | **401** | `{"error":"Invalid or missing internal API key."}` |

**Not 404.** Swagger includes `/api/internal/audit`.

---

## 7. Authenticated audit verification

Using LaboratoryApi configured internal key (value not printed) + `X-Tenant-ID`:

`POST /api/internal/audit` → **HTTP 200**

Safe body:

```json
{
  "status": "logged",
  "outcome": "success",
  "tenantId": "155fe198-6ae5-4a01-9254-ead5b427247e",
  "action": "CREATE_DRAFT",
  "resourceType": "LmsCatalogueVersion",
  "resourceId": "00000000-0000-0000-0000-000000000003"
}
```

Fail-closed behaviour was not weakened. Allowlists were not changed.

---

## 8. Permission catalogue verification

After AuthService restart/seed (definitions only — **no role grants**):

| Permission code | Present in Azure `permissions` |
|---|---|
| `lms.catalogue.view` | **Yes** (count 1) |
| `lms.catalogue.manage` | **Yes** (count 1) |
| `lms.catalogue.approve` | **Yes** (count 1) |
| `lms.view` | **Yes** (count 1) |

PD-CAT-02 remains deferred. No grants to Lab Technician, Lab Manager, or other roles.

Admin unrestricted access remains the existing role-based `*` path in `PermissionService` (Admin / SuperAdmin normalized names) — not a row in `permissions`.

---

## 9. Actual UAT user capability verification

**Actual browser session at recovery time** (not assumed from prior diagnostic alone):

| Field | Value |
|---|---|
| Email | `labtech1@hospital.com` |
| Display name | Deepa Chopra |
| User id | `25636fb1-032d-4365-b064-a02e2a2d8ac7` |
| Tenant | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Roles | `Lab Technician` |
| Admin `*` effective | **No** |
| `lms.view` | **No** |
| `lms.catalogue.view` | **No** |
| `lms.catalogue.manage` | **No** |
| `lms.catalogue.approve` | **No** |
| `laboratory.view` (Pathology) | Yes |

Frontend outcome for LMS catalogue route: `/dashboard/unauthorized` (ProtectedRoute requires `lms.view`).

Authenticated Lab API probes with this user's JWT (token not printed):

| Call | HTTP | Safe body |
|---|---|---|
| `GET /api/lms/catalogue` | **403** | `Missing permission. Required one of: lms.catalogue.view` |
| `GET /api/lms/secure-ping` | **403** | `Missing permission. Required one of: lms.view` |

**Important:** These 403s prove traffic **reaches LaboratoryApi** (environment recovery for Lab/Auth/JWT path works). Failure is authorization for this account.

Known Admin `*` path account in DB (not used / not auto-logged-in): `admin@test.com` with role `Admin` / `ADMIN`.

No permission grants were made.

---

## 10. Frontend API target verification

| Item | Value |
|---|---|
| Frontend process | Running on `:3000` |
| Restart required? | **No** (env already correct) |
| `NEXT_PUBLIC_LABORATORY_API_URL` | `http://localhost:7076/api` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5073/api` |

---

## 11. Pathology regression smoke check

| Check | Result |
|---|---|
| `GET /dashboard/laboratory` (same browser session) | **HTTP 200** |
| Pathology catalogue APIs / schema | Not modified |

---

## 12. Exact remaining blockers

1. **BLOCKED_AUTHORIZATION (active):** Current Manual UAT browser user `labtech1@hospital.com` lacks `lms.view` and `lms.catalogue.*`, and is not an Admin/`*` role. PD-CAT-02 forbids silent role grants in this recovery.
2. **Operational note:** A second AuthService remains on `:5000` (`artifacts\lab-l2-manual-uat-auth`). Frontend targets `:5073` (rebuilt). Do not use `:5000` for LMS UAT.
3. **UAT account choice:** Resume requires either:
   - signing in as an Admin/`*` account (e.g. platform Admin role such as `admin@test.com`), **or**
   - an explicit PD-CAT-02 decision to grant catalogue permissions to selected roles/users.

No catalogue business-logic defect evidenced. No draft create attempted.

---

## 13. Final status

**BLOCKED_AUTHORIZATION**

### Recovered (ready)

- LaboratoryApi on `:7076` with health 200 and Azure DB reachable  
- AuthService on `:5073` rebuilt with internal audit + LMS permission seeding  
- Internal audit 401 without key; 200 with configured key  
- Azure LMS tables present  
- Permission definitions `lms.catalogue.view|manage|approve` present  
- Frontend Lab API URL correct  
- Pathology page still reachable  

### Not ready for Manual UAT resume

- Actual signed-in UAT account cannot pass LMS route/API authorization  

### STOP

Do **not** auto-start UAT-02.  
Do **not** create a catalogue draft.  
Do **not** start L-ORD-01.  

Manual UAT resumes only after this report is reviewed, an authorized UAT account is used (or PD-CAT-02 grants are explicitly decided), and the UAT gate is reopened.
