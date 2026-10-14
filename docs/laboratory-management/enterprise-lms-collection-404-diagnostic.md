# L-COL-01B UAT Blocker — Collection Queue 404 Diagnostic

**Date:** 2026-10-09  
**Mode:** DIAGNOSTIC ONLY — no code, schema, permission, UX, or process changes performed  
**Page:** `/dashboard/lms/collection`  
**Symptom:** Work queue shows `Request failed with status code 404`

---

## Final status

**`DIAGNOSIS_COMPLETE_FIX_REQUIRED`**

---

## 1. Exact frontend request URL

Resolved from:

- `CollectionWorkbench` → `listLmsCollectionTasks(...)`
- `lms-collection.api.ts` → `GET '/lms/collection/tasks'`
- `getLaboratoryApi()` base URL from `NEXT_PUBLIC_LABORATORY_API_URL`

**Full URL:**

```text
GET http://localhost:7076/api/lms/collection/tasks
```

(Optional query params when filters set: `search`, `status`, `collectionBranchId`, `page`, `pageSize` — default load may omit filters or send `page=1&pageSize=25`.)

---

## 2. Exact HTTP method

`GET`

---

## 3. Actual response status / body

Probed against the **running** LaboratoryApi on port **7076** (no Authorization header):

| Probe | Status | Body |
|---|---|---|
| `GET /api/lms/health` | **200** | JSON health payload (`slice":"L-CAT-01B"`, DB reachable) |
| `GET /api/lms/secure-ping` | **401** | `{"error":"Missing or malformed Authorization header."}` |
| `GET /api/lms/orders` | **401** | `{"error":"Missing or malformed Authorization header."}` |
| `GET /api/lms/collection/tasks` | **404** | **empty body** |
| Alternate paths (`/task`, `/tasks/`, `/collection`, `/collection/work`, `/api/collection/tasks`) | **404** | (not found) |

**Interpretation of auth vs 404:**

- Registered LMS routes return **401** with JSON when JWT is missing → host + JWT pipeline are alive.
- Collection list returns **404 with empty body** → Azure Functions host did **not** match a function route. This is **not** 403 permission denied and **not** an empty-queue 200.

Frontend axios surfaces this as: `Request failed with status code 404` (matches UAT).

---

## 4. Expected API route

From accepted L-COL-01B implementation:

```text
GET /api/lms/collection/tasks
```

Source registration (`CollectionFunctions.cs`):

```csharp
[Function("LmsCollectionTasksList")]
[HttpTrigger(..., "get", Route = "lms/collection/tasks")]
```

`host.json` `routePrefix` = `api` → full path `/api/lms/collection/tasks`.

---

## 5. Actual LaboratoryApi route (running process)

**Collection routes are not registered on the running host.**

Evidence from `GET http://localhost:7076/admin/functions`:

- Total functions registered: **22**
- `LmsOrdersList` (and other Orders functions): **present**
- `LmsCollectionTasksList` / any `*Collection*`: **absent**

---

## 6. LaboratoryApi running port

| Item | Value |
|---|---|
| Listen | `0.0.0.0:7076` (PID **41876**, `func.exe start`) |
| Worker | PID **21360** — `dotnet ...\LaboratoryApi\bin\output\LaboratoryApi.dll` |
| START_ALL.ps1 | Starts Laboratory API via `func start` in `LaboratoryApi` → `http://localhost:7076` |

---

## 7. Frontend configured API base URL

From `apps/hospital-portal-web/.env.local`:

```text
NEXT_PUBLIC_LABORATORY_API_URL=http://localhost:7076/api
```

Client default fallback (same): `http://localhost:7076/api`  
(`laboratory-service.api.ts`)

**Frontend → expected URL alignment: CORRECT.**  
No FE path typo (`tasks` vs `task`); no wrong service port in env.

---

## 8. Whether the running process contains CollectionFunctions

| Artifact | LastWriteTime | Contains `CollectionFunctions` / `LmsCollectionTasksList` / `lms/collection/tasks` |
|---|---|---|
| Source `Functions/CollectionFunctions.cs` | 2026-10-09 **17:01:10** | Yes (source) |
| `bin\Debug\net8.0\LaboratoryApi.dll` | 2026-10-09 **17:05:46** | **Yes** |
| **Running** `bin\output\LaboratoryApi.dll` | 2026-10-09 **12:24:36** | **No** |

ASCII scan of running DLL:

- `LmsOrdersList` → True  
- `CollectionFunctions` → False  
- `LmsCollectionTasksList` → False  
- `lms/collection/tasks` → False  

Health payload still reports `slice: "L-CAT-01B"` (older build messaging), consistent with a pre–L-COL-01B worker.

---

## 9. Root cause

**Stale LaboratoryApi process / stale `bin\output` deployment.**

The UAT frontend correctly calls `GET http://localhost:7076/api/lms/collection/tasks`, but the Azure Functions host currently serving port 7076 loads an **older** `bin\output\LaboratoryApi.dll` that:

1. Was built **before** L-COL-01B Collection APIs were compiled into the worker, and  
2. Does **not** register any Collection HTTP functions,

so the host returns a raw **404** (empty body).  

The newer Debug build **does** contain CollectionFunctions, but **`func start` is not running that build** — it is still attached to the stale `bin\output` DLL.

This is **not**:

- a frontend route typo  
- a permission (`403`) failure  
- an authentication (`401`) failure for Collection (route never reached auth)  
- an empty work-queue success response  
- a missing migration (would typically yield 500 after route hit)  
- a wrong NEXT_PUBLIC base URL

---

## 10. Evidence supporting root cause

1. **URL parity:** FE path `/lms/collection/tasks` + base `…/api` = expected `/api/lms/collection/tasks`.
2. **Live 404 vs live 401:** Collection → 404 empty; Orders/secure-ping → 401 JSON → route missing, not authz.
3. **Admin registry:** 0 Collection functions; Orders functions present.
4. **DLL timestamps:** `bin\output` (running) = 12:24; Debug (has Collection) = 17:05; source CollectionFunctions = 17:01.
5. **String presence:** Collection markers only in Debug DLL, not in running output DLL.
6. **START_ALL.ps1:** `func start` in LaboratoryApi directory → worker path `bin\output\LaboratoryApi.dll` (confirmed on PID 21360).
7. **Health slice string still L-CAT-01B** on running host.

---

## 11. Minimal proposed fix

**Operational restart / rebuild of LaboratoryApi only — no application code changes required for this 404.**

Proposed steps (for a follow-up fix session; **not executed here**):

1. Stop the current LaboratoryApi `func` host on port 7076.  
2. Rebuild LaboratoryApi so `bin\output` (or whatever `func start` loads) includes the current worker containing `CollectionFunctions`.  
   - Typical: `dotnet build` then `func start` from `microservices/laboratory-service/LaboratoryApi`.  
3. Confirm `GET http://localhost:7076/admin/functions` lists `LmsCollectionTasksList`.  
4. Confirm unauthenticated `GET /api/lms/collection/tasks` returns **401** (not 404).  
5. Re-run UAT with a JWT that includes `lms.collection.view` (or Admin `*`) — expect **200** empty page or data, not 404.  
6. If migration `AddLmsCollectionTaskTables` has not been applied to the UAT DB, address that separately **after** the route is live (would present as 500, not 404).

**No FE, permission seed, Orders, Catalogue, or Pathology changes needed for this specific 404.**

---

## 12. Files that would need changing

**For this root cause: none (code).**

Operational only:

- Restart / rebuild of LaboratoryApi so `bin\output\LaboratoryApi.dll` matches current L-COL-01B build.

Optional later (out of this diagnostic): if health still says `L-CAT-01B` after restart from a build that still hardcodes that slice string, a tiny HealthFunctions message update could clarify slice — **not required to clear the 404**.

---

## 13. Explicit confirmation — no code was changed

- No source files were modified for a fix.  
- No database/schema/migrations changed.  
- No permissions changed.  
- No Orders / Catalogue / Pathology / Specimen / Receiving / UX changes.  
- No processes were killed or restarted.  
- Only read/probe actions were performed (file inspection, `netstat`, HTTP GETs, admin function list, DLL string scan).

This document is the sole write artifact of the diagnostic task.

---

## Comparison matrix

| Layer | Value | Match? |
|---|---|---|
| Frontend expected | `GET http://localhost:7076/api/lms/collection/tasks` | — |
| Frontend generated | Same (base + `/lms/collection/tasks`) | Yes |
| Source LaboratoryApi route | `Route = "lms/collection/tasks"` + prefix `api` | Yes |
| Running LaboratoryApi route | **Not registered** | **No** |
| Running process DLL | Stale `bin\output` (12:24, no Collection) | Root cause |

---

## Auth note (separate)

Authentication for LMS is functioning on registered routes (401 without Bearer). Collection never reaches JWT/permission checks because the function is absent from the running host. After restart, verify separately that UAT identity has `lms.collection.view` (definitions-only seed; Admin `*` may be used for controlled UAT).
