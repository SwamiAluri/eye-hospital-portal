# L-COL-01B — Collection 404 Operational Runtime Fix Report

**Date:** 2026-10-09  
**Mode:** OPERATIONAL RUNTIME FIX ONLY  
**Diagnostic reference:** `enterprise-lms-collection-404-diagnostic.md`

---

## Final status

**`RUNTIME_FIXED_READY_FOR_UAT`**

---

## 1. Stale process identified

| Item | Value |
|---|---|
| Port | **7076** |
| Host PID | **41876** (`func.exe start`) |
| Worker PID | **21360** (`dotnet …\bin\output\LaboratoryApi.dll`) |
| Stale DLL | `bin\output\LaboratoryApi.dll` (LastWrite **12:24:36**, no Collection markers) |
| Admin functions (before) | **22** total; **0** Collection |
| Collection unauthenticated (before) | **404** (empty body) |

---

## 2. Process stopped

- Stopped LaboratoryApi `func` host PID **41876** only.
- Port **7076** freed.
- Other Hospital Portal listeners left running (verified): Auth **5073**, IP **5074**, Counselling **7071**, Inventory **7072**, CCMS **7075**, Frontend **3000**.

---

## 3. Build performed

1. `dotnet clean` + `dotnet build` LaboratoryApi (Debug) — Collection present in `bin\Debug\net8.0`.
2. Removed stale `bin\output` so host would not keep serving the 12:24 DLL.
3. `func start --port 7076` (project convention / START_ALL) — Core Tools rebuilt worker into **`bin\output`** and loaded it.

No application source was edited.

---

## 4. Runtime / output used

| Item | Value |
|---|---|
| Host | Azure Functions Core Tools `func start --port 7076` |
| Worker DLL | `microservices\laboratory-service\LaboratoryApi\bin\output\LaboratoryApi.dll` |
| DLL LastWrite | **2026-10-09 18:10:04** |
| DLL size | **861184** |
| Contains CollectionFunctions | **True** |
| Contains LmsCollectionTasksList | **True** |
| Worker PID (after) | **25676** |

---

## 5. LaboratoryApi port

**7076** (unchanged).  
Frontend `NEXT_PUBLIC_LABORATORY_API_URL=http://localhost:7076/api` — **not modified**.

---

## 6. Registered functions before

- Total: **22**
- Collection: **none**
- Orders (sample): `LmsOrdersList` present

---

## 7. Registered functions after

- Total: **30**
- Collection (all present):
  - `LmsCollectionTasksList`
  - `LmsCollectionTasksGet`
  - `LmsCollectionPlanContext`
  - `LmsCollectionTasksCreate`
  - `LmsCollectionTasksTransition`
  - `LmsCollectionTasksClaim`
  - `LmsCollectionTasksAssign`
  - `LmsCollectionTasksRelease`
- Host log maps: `GET api/lms/collection/tasks` → `LmsCollectionTasksList`

---

## 8. Collection unauthenticated response before

```text
GET /api/lms/collection/tasks → HTTP 404 (empty body)
```

---

## 9. Collection unauthenticated response after

```text
GET /api/lms/collection/tasks → HTTP 401
Body: {"error":"Missing or malformed Authorization header."}
```

**Not 404.** Route is registered and reaches JWT validation.

---

## 10. Authenticated Collection response

Not verified with a live Admin/UAT JWT in this session (no valid credentials exercised; login probe without inventing role grants returned 400).

**Manual UAT next step:** reload `/dashboard/lms/collection` with the existing portal session. Expect **200** empty/data (or **403** if JWT lacks `lms.collection.view` / Admin `*`) — **not 404**.

---

## 11. Migration presence status

| Check | Before fix | After |
|---|---|---|
| `lms_collection_tasks` | MISSING | **PRESENT** |
| `lms_collection_task_order_tests` | MISSING | **PRESENT** |
| `lms_collection_idempotency` | MISSING | **PRESENT** |
| `lms_collection_task_number_sequences` | MISSING | **PRESENT** |
| EF history | no Collection migration | **`20261009113149_AddLmsCollectionTaskTables`** |

**Action taken:** Applied the **already-approved** L-COL-01B migration only (`dotnet ef database update`). No new migration created. No schema design changes.

---

## 12. Exact source files changed

**NONE.**

Only operational artifacts:
- Stopped/restarted LaboratoryApi host
- Clean/rebuild + `func start` refreshed `bin\output`
- Applied existing migration `AddLmsCollectionTaskTables`
- This report document

---

## 13. Confirmation — no business/application behavior changed

- Collection APIs, state machine, FE, Orders, Catalogue, Pathology, Specimen, Receiving: **unchanged**
- Environment URLs: **unchanged**
- Business rules: **unchanged**

---

## 14. Confirmation — no permissions/roles changed

- No AuthService permission seed changes
- No role grants added or modified

---

## 15. Final status

**`RUNTIME_FIXED_READY_FOR_UAT`**

Live verification:

| Probe | Result |
|---|---|
| `GET /api/lms/health` | **200** |
| `GET /api/lms/secure-ping` (no JWT) | **401** |
| `GET /api/lms/orders` (no JWT) | **401** |
| `GET /api/lms/collection/tasks` (no JWT) | **401** (was 404) |

Full Manual UAT was **not** performed in this task. STOP.
