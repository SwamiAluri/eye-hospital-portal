# L-CAT-01B — UAT Failure Diagnostic Report

**Date:** 2026-10-08  
**Mode:** Diagnostic only — no code, schema, permission, lifecycle, UI, mock, or audit changes made  
**Slice:** Enterprise LMS Catalogue (Manual UAT)  
**Order Intake / L-ORD-01:** Not started  

## Final diagnosis

**MULTIPLE_ROOT_CAUSES**

| Layer | Classification | Affects observed UAT? |
|---|---|---|
| LaboratoryApi not running on `:7076` | `BLOCKED_ENVIRONMENT` | **Yes — primary cause of both GET and POST symptoms** |
| LaboratoryApi DB target `localhost:5432` vs platform Azure `hospitalportal` | `BLOCKED_CONFIGURATION` | Masked today; would block next once Lab API starts with current `local.settings.json` |
| Running AuthService binary lacks `POST /api/internal/audit` (stale build) | `BLOCKED_INTERNAL_AUDIT` | Masked today; would fail-close CREATE after Lab API + DB work |
| `lms.catalogue.*` (and all `lms.*`) absent from Azure `permissions` catalog | `BLOCKED_AUTHORIZATION` (latent catalog gap) | Not the HTTP failure for list/create today (requests never reached Lab API). Will matter for non-`*` users after service is up |

**Not diagnosed as application defect in catalogue business logic** for the observed failures: request traffic never reached `CatalogueFunctions` / `CatalogueService`.

---

## 1. Reproduction

### A. Catalogue list / load

| Field | Value |
|---|---|
| UI route | `GET /dashboard/lms/configuration/test-catalogue` (renders shell) |
| Client call | `listLmsCatalogue()` → axios `GET {NEXT_PUBLIC_LABORATORY_API_URL}/lms/catalogue` |
| Configured base URL | `http://localhost:7076/api` (`.env.local` + code default) |
| Exact URL | `GET http://localhost:7076/api/lms/catalogue?page=1&pageSize=25` |
| HTTP status | **No HTTP response** |
| Transport error | `Unable to connect to the remote server` / `No connection could be made because the target machine actively refused it 127.0.0.1:7076` (also observed as client timeout when probe hung) |
| Response body | **N/A** (TCP connect failure) |
| Correlation / request ID | **N/A** (request never accepted) |
| UI text | `Failed to load catalogue.` (frontend fallback when axios has no `response.data.error`) |

### B. Create catalogue draft

| Field | Value |
|---|---|
| UI action | Create Catalogue Draft → Save draft |
| Client call | `createLmsCatalogueDraft()` → axios `POST {base}/lms/catalogue` |
| Exact URL | `POST http://localhost:7076/api/lms/catalogue` |
| Payload (UAT values) | `catalogueType=TEST`, `internalOrderCode=567`, `displayName=Test`, discipline Molecular Diagnostics, `changeReason=fdfdss` |
| HTTP status | **No HTTP response** |
| Transport error | Same connection refusal to `127.0.0.1:7076` |
| Response body | **N/A** |
| Correlation / request ID | **N/A** |
| UI text | `Failed to create draft.` (frontend fallback) |

Local port check at diagnosis time:

- `:7076` → **NOT LISTENING**
- Running Azure Functions hosts observed: Counselling, Inventory, Notification, CCMS, IP — **no `LaboratoryApi` worker process**
- Frontend `:3000` → up  
- AuthService `:5073` (and a second Auth process on `:5000`) → up  

---

## 2. GET request exact failure

### Trace (intended path)

```
CatalogueWorkbench.load()
  → laboratory-service.api.ts listLmsCatalogue()
  → GET http://localhost:7076/api/lms/catalogue
  → CatalogueFunctions.List (JWT + lms.catalogue.view)
  → CatalogueService.ListAsync
  → LaboratoryDbContext / lms_catalogue_*
```

### Failing layer

**Transport / process availability — before JWT, authz, tenant, DbContext, or SQL.**

| Check | Result |
|---|---|
| 401 | No — no HTTP exchange |
| 403 | No — no HTTP exchange |
| 404 | No — Lab API not bound |
| 500 | No |
| Connection failure | **Yes — connection refused on 7076** |
| Migration / table missing | Not reached for this request |
| Tenant assertion | Not reached |
| Permission failure | Not reached at API |
| Service unavailable | Process not running |
| Base URL mis-point | Frontend URL is correct for intended Lab API; **service absent on that URL** |

Exact exception (client): connection refused to `127.0.0.1:7076`.

---

## 3. POST request exact failure

### Trace (intended path)

```
CreateDraftDialog Save
  → createLmsCatalogueDraft()
  → POST http://localhost:7076/api/lms/catalogue
  → CatalogueFunctions.Create (JWT + lms.catalogue.manage)
  → CatalogueService.CreateDraftAsync
  → DB insert
  → PlatformAuditClient → AuthService POST /api/internal/audit
  → audit_log (fail-closed on audit failure)
```

### Failing layer (observed UAT)

**Same as GET: LaboratoryApi not listening on `:7076`.** Mutation never entered JWT/authz/tenant/DB/audit.

### Masked next failures (would appear after Lab API is started)

Documented for UAT planning — **not** the HTTP status of the current Save-draft click:

1. **DB configuration** — `LaboratoryApi/local.settings.json` points at `Host=localhost;Port=5432;Database=hospitalportal`. Local `:5432` is **not** listening. Platform AuthService uses Azure `hospitalportal-db-server.postgres.database.azure.com` / DB `hospitalportal`.
2. **Internal audit** — running AuthService swagger/runtime **does not expose** `POST /api/internal/audit`. Catalogue mutations fail-closed with HTTP **503** / code `audit_unavailable` when audit write fails (`PlatformAuditClient`).
3. **Permissions catalog** — Azure `permissions` has **zero** `lms.*` / `lms.catalogue.*` rows (see §7). Non-wildcard users would get **403** once Lab API is reachable.

---

## 4. LaboratoryApi status

| Item | Status |
|---|---|
| Process running | **No** |
| Configured local port (`Host:LocalHttpPort`) | **7076** |
| Actual listen port | **None** |
| Included in `START_ALL.ps1` | Yes (step starts `func start` in `LaboratoryApi`) |
| Observed in current runtime | **Not started / not running** |
| Health probe `GET http://localhost:7076/api/lms/health` | Connection failure |

---

## 5. Frontend base URL status

| Item | Value |
|---|---|
| `NEXT_PUBLIC_LABORATORY_API_URL` | `http://localhost:7076/api` (`.env.local`) |
| Code fallback | `http://localhost:7076/api` |
| Auth FE URL | `NEXT_PUBLIC_API_URL=http://localhost:5073/api` |
| Mismatch vs Lab API intent | **None** — FE correctly targets Lab API; Lab API is down |
| Wrong-service collision | Other func ports (`7071`–`7075`) return unrelated 404 for `/api/lms/health`; FE is not accidentally calling them |

---

## 6. Database / migration status

### Shared platform DB (AuthService SoT — Azure)

| Check | Result |
|---|---|
| Host | `hospitalportal-db-server.postgres.database.azure.com` |
| Database | `hospitalportal` |
| Connectivity from diagnostic probe | **Yes** |
| `lms_catalogue_items` | **Exists** (row count 0) |
| `lms_catalogue_versions` | **Exists** (row count 0) |
| `lms_catalogue_panel_components` | **Exists** (row count 0) |
| `lms_catalogue_branch_applicability` | **Exists** (row count 0) |
| `__EFMigrationsHistory` entry `20261008135557_AddLmsCatalogueTables` | **Present / applied** |

### LaboratoryApi configured DB (`local.settings.json`)

| Check | Result |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database name | `hospitalportal` |
| Local `:5432` listening | **No** |
| Local postgres observed | `:5433` only (credentials not pursued; not the Lab API target) |
| Same DB as AuthService / applied migration? | **No — Lab API settings do not point at Azure shared DB** |

**Migration conclusion:** Migration **is applied** on the Azure shared `hospitalportal` database. It is **not** the cause of the current connection-refused UAT symptoms. It **would** become relevant only after Lab API runs against the wrong/unreachable local host.

---

## 7. Permission status

### Catalog (Azure `permissions` table)

| Code | Present |
|---|---|
| `lms.catalogue.view` | **No** |
| `lms.catalogue.manage` | **No** |
| `lms.catalogue.approve` | **No** |
| Any `lms.*` | **No** (count 0) |
| `laboratory.view` (Pathology) | Yes (legacy; **not** LMS catalogue authority) |

Running AuthService DLL timestamps:

- `AuthService.dll` last write ≈ **2026-10-08 16:07**
- `InternalAuditController.cs` / LMS catalogue permission catalog source ≈ **19:19–19:57** (newer than DLL)
- DLL string scan: **no** `InternalAuditController`, **no** `lms.catalogue.view`, **no** `SeedEnterpriseLmsCataloguePermissionsAsync`

So the **running** AuthService build predates L-CAT-01B audit endpoint + permission seeder.

### Browser session sampled during diagnosis (not necessarily the UAT operator)

| Field | Safe value |
|---|---|
| Email | `labtech1@hospital.com` |
| User id | `25636fb1-032d-4365-b064-a02e2a2d8ac7` |
| Tenant id | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Roles | `Lab Technician` |
| Admin `*` effective | **No** |
| `lms.view` | **No** |
| `lms.catalogue.view` | **No** |
| `lms.catalogue.manage` | **No** |
| `lms.catalogue.approve` | **No** |
| `laboratory.view` | **Yes** |
| FE outcome for catalogue route | Redirected to `/dashboard/unauthorized` (ProtectedRoute `lms.view`) |

### Is the GET failure authorization-related?

**No for the observed UAT HTTP failure.** List never reached LaboratoryApi authz. Authorization/catalog gaps are a **separate latent blocker** for non-`*` users once the API is up.

Note: PD-CAT-02 still defers role grants; pre-UAT gate expected capability codes to be **seeded** (not necessarily role-granted). Seeding is missing in the live AuthService/DB pair above.

---

## 8. AuthService status

| Item | Status |
|---|---|
| Process on `:5073` | **Running** (`AuthService.exe` from `bin\Debug\net8.0`) |
| Also observed | Second Auth process on `:5000` from `artifacts\lab-l2-manual-uat-auth\` |
| Swagger | Reachable |
| `POST /api/internal/audit` in running swagger | **Absent** |
| Probe `POST /api/internal/audit` (wrong key / no key) | **HTTP 404** (route missing — not 401) |
| Expected if route were live | 401 for bad/missing `X-Internal-Key` |

---

## 9. Internal audit status

| Check | Result |
|---|---|
| Endpoint reachable from this host | **No** (404 — controller not in running binary) |
| LaboratoryApi → AuthService base URL config | `http://localhost:5073` (**CONFIGURED**) |
| `X-Internal-Key` in LaboratoryApi settings | **CONFIGURED** |
| AuthService `InternalApi:Key` | **CONFIGURED** |
| Key equality Lab ↔ Auth (value not printed) | **MATCH** |
| `X-Tenant-ID` generation in client | Implemented in source (`PlatformAuditClient`); **not exercised** (Lab API down) |
| Action allowlist includes `CREATE_DRAFT` | Yes in **source** |
| Resource allowlist includes `LmsCatalogueVersion` | Yes in **source** |
| AuthService response for live audit call | **Cannot obtain success path** — route missing at runtime |
| Fail-closed behavior | Source returns 503 `audit_unavailable` / compensates mutation — **not reached** in current UAT |

If CREATE were attempted against a live Lab API with this AuthService build, expect audit layer failure (**404 upstream → Lab maps to 503 audit_unavailable**), not a successful draft.

---

## 10. Root cause

### Correlation of the two observed UAT failures

| Question | Answer |
|---|---|
| Same root cause? | **Yes for the observed symptoms** — both fail because LaboratoryApi is not listening on `localhost:7076`. |
| Different root causes? | Not for the current HTTP/transport failures. |
| One masking another? | **Yes.** Lab API downtime **masks** independent blockers: wrong Lab DB host, stale AuthService without internal audit + LMS permission seeder, empty `lms.*` permission catalog. |

### Primary root cause (observed)

**LaboratoryApi is not running**, while the frontend correctly calls `http://localhost:7076/api/...`. Axios connection errors surface as generic UI strings `Failed to load catalogue.` / `Failed to create draft.`

### Secondary (masked) root causes

1. **Configuration:** Lab API `DefaultConnection` → local Postgres that is not the shared Azure `hospitalportal` where migration/tables exist.  
2. **Internal audit runtime:** AuthService process/binary predates `InternalAuditController`.  
3. **Authorization catalog:** `lms.catalogue.*` not present in Azure `permissions` under the running AuthService generation.

---

## 11. Evidence

1. `netstat`: `:7076` not listening; Lab API worker absent from `dotnet` command lines.  
2. Direct probes: `GET/POST http://localhost:7076/api/lms/catalogue` → connection refused / no HTTP status/body.  
3. FE config: `NEXT_PUBLIC_LABORATORY_API_URL=http://localhost:7076/api`.  
4. Azure DB read-only: all four `lms_catalogue_*` tables exist; migration `20261008135557_AddLmsCatalogueTables` applied; table row counts 0.  
5. Lab `local.settings.json` DB host `localhost:5432` ≠ AuthService Azure host; local `:5432` down.  
6. Running AuthService swagger/internal route list: no `/api/internal/audit`; POST returns 404.  
7. DLL vs source timestamps + string scan: running DLL lacks Internal Audit + LMS catalogue permission seeder.  
8. Azure `permissions`: no `lms.*` rows; sample browser user `labtech1@hospital.com` has `laboratory.view` only among lab-related codes, no Admin `*`.  
9. Frontend error strings match connection-failure fallbacks in `CatalogueWorkbench` (no API error payload).

Secrets policy: JWT keys, internal API key values, DB passwords, and tokens were **not** printed. Secret presence reported only as CONFIGURED / NOT CONFIGURED / MATCH / MISMATCH SUSPECTED.

---

## 12. Whether code change is actually required

**No application code change is required to explain or clear the observed UAT failures.**

Required actions are **runtime / configuration / rebuild-restart**, not catalogue domain logic, schema, lifecycle rules, UI behavior, mocks, or audit-policy weakening:

- Replace: start LaboratoryApi on 7076  
- Align: LaboratoryApi connection string to the shared Azure `hospitalportal` (same DB where migration is applied)  
- Rebuild + restart AuthService so `InternalAuditController` and LMS permission seeding are loaded  
- Confirm `lms.catalogue.*` rows exist in `permissions` after restart/seed  
- Role grants remain under **PD-CAT-02** (do not silently grant in this diagnostic task)

Catalogue source/API implementation was not exercised end-to-end against a live Lab API in this UAT window; residual application defects are **not ruled out**, but they are **not evidenced** by the current failures.

---

## 13. Recommended next action

1. **Stop Manual UAT** until the environment is healthy (do not continue catalogue UAT; do not start L-ORD-01).  
2. Start LaboratoryApi (`func start` on **7076**, e.g. via `START_ALL.ps1` Lab step or dedicated window).  
3. Point LaboratoryApi `DefaultConnection` at the **same** Azure `hospitalportal` used by AuthService (no schema change — connection target only).  
4. Rebuild and restart AuthService from current source so:
   - `POST /api/internal/audit` appears in swagger and returns 401 (not 404) without a valid key  
   - LMS catalogue permission seeding runs  
5. Re-verify read-only:
   - `GET http://localhost:7076/api/lms/health` → 200  
   - `GET /api/lms/catalogue` with a JWT that has `lms.catalogue.view` or Admin `*`  
   - Confirm `lms.catalogue.view|manage|approve` rows exist  
6. Only then resume Manual UAT (list → create draft → audit_log check).  
7. If CREATE then fails with **503 `audit_unavailable`**, treat as `BLOCKED_INTERNAL_AUDIT` and diagnose AuthService audit response — still without weakening fail-closed audit.  
8. If CREATE then fails with **403**, treat as `BLOCKED_AUTHORIZATION` / PD-CAT-02 grant decision — do not invent grants in a silent fix.

---

## STOP

Diagnostic complete.  
No fixes applied.  
Manual UAT not continued.  
L-ORD-01 not started.
