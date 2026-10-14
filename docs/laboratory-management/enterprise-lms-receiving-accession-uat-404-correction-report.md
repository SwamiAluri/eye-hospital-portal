# L-COL-01D — Manual UAT Blocker: Specimen Worklist HTTP 404

**Date:** 2026-10-11  
**Status:** `UAT_BLOCKER_FIXED_READY_TO_RESUME`

---

## Root cause

**Stale LaboratoryApi Azure Functions host** (PID started **2026-10-10 22:28**) was serving an older worker that had L-COL-01C `LmsCollectionCompleteCollection` but **not** L-COL-01D specimen list/detail/receive/reject/rejection-reasons routes.

Evidence before correction:

| Probe | Result |
|---|---|
| `GET /api/lms/health` | 200 |
| `GET /api/lms/collection/tasks` | 401 (route present) |
| `GET /api/lms/orders` | 401 |
| `POST …/complete-collection` | 401 |
| `GET /api/lms/specimens` | **404** |
| `GET /api/lms/specimens/rejection-reasons` | **404** |

DLL timestamps:

| Path | LastWrite |
|---|---|
| `bin\output\LaboratoryApi.dll` | 2026-10-10 22:28 (stale, matched host) |
| `bin\Debug\net8.0\LaboratoryApi.dll` | 2026-10-11 13:37 (current L-COL-01D) |

Frontend contract was already correct — same operational class as L-COL-01C Complete Collection 404.

**Secondary environment gap (would have blocked authenticated list after route fix):** EF migration `20261011075112_AddLmsSpecimenReceivingAccession` was **not** applied to the LaboratoryApi UAT database (no `accession` columns / no `lms_accession_number_sequences`). Applied during this correction.

---

## Exact URLs

| Side | Value |
|---|---|
| FE axios base | `NEXT_PUBLIC_LABORATORY_API_URL` = `http://localhost:7076/api` |
| FE path | `GET /lms/specimens` (`lms-specimens.api.ts` → `getLaboratoryApi()`) |
| Browser request | `GET http://localhost:7076/api/lms/specimens` |
| BE route (source) | `Route = "lms/specimens"` + `host.json` `routePrefix: "api"` → `/api/lms/specimens` |
| Function | `LmsSpecimensList` in `SpecimenFunctions.cs` |

---

## Correction performed (environment only)

1. Stopped stale `func` on :7076  
2. Rebuilt LaboratoryApi Debug  
3. Restarted `func start --port 7076` with current build  
4. Applied EF migration `20261011075112_AddLmsSpecimenReceivingAccession` to configured LaboratoryApi DB  

**No application source / business-rule / permission / UI changes.**

---

## Verification after correction

| Check | Result |
|---|---|
| Unauthenticated `GET /api/lms/specimens` | **401** (route present) |
| Same for get / by-collection-task / rejection-reasons / receive / reject | **401** |
| Authenticated Admin `GET /api/lms/specimens?page=1&pageSize=25` | **200**, `totalCount=1` |
| Specimen BE tests | Passed 38 |
| Specimen + Collection FE tests | Passed 23 |

---

## Resume UAT

Reload `/dashboard/lms/specimens` (hard refresh if needed). Worklist should load without 404.

Note: SQL seed `migrations/68_lms_specimen_rejection_reasons.sql` may still need apply before Reject UAT steps if MasterValue rows are missing — separate from this list-404 blocker.
