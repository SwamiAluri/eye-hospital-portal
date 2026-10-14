# L-COL-01B TARGETED UAT — Assign HTTP 500 Diagnostic

**Date:** 2026-10-09  
**Mode:** DIAGNOSTIC ONLY — no code, schema, permission, role, UI, Orders/Catalogue/Pathology/Specimen/Receiving, or error-handling changes  
**Subject task:** `COL-20261009-000004` (`7137212b-eb7a-49a6-9740-8a2d7f700012`)  
**UAT symptom:** Assign with `ram` / `reddy` → `Request failed with status code 500`

---

## FINAL STATUS

**`ASSIGN_VALID_GUID_WORKS_INVALID_INPUT_HANDLING_REQUIRED`**

---

## 1. Reproduction

| Item | Value |
|---|---|
| Task | `COL-20261009-000004` |
| Task id | `7137212b-eb7a-49a6-9740-8a2d7f700012` |
| Pre-failure state | Status `Planned`; `AssignedToUserId` null; `ClaimedByUserId` = `dddddddd-dddd-dddd-dddd-dddddddddddd` (UAT actor / `admin@test.com`) |
| UI | Collection detail — “Assign to user ID” / placeholder “User GUID” |
| Operator inputs that failed | `ram`, `reddy` (non-GUID strings) |

**Evidence sources (no secrets):**

- Manual UAT browser POSTs captured in LaboratoryApi `func` host log (`155906` / PID `33068` on `:7076`) at **2026-10-09T15:07:53Z** (`ram`) and **15:08:36Z** (`reddy`).
- Controlled re-POST with the same malformed payload after JWT login (diagnostic session) reproduced **HTTP 500**.

---

## 2. Invalid-input request

| Field | Value |
|---|---|
| HTTP method | `POST` |
| URL | `http://localhost:7076/api/lms/collection/tasks/7137212b-eb7a-49a6-9740-8a2d7f700012/assign` |
| Auth | Bearer JWT (staff) — value **masked** |
| Content-Type | `application/json` |
| Payload (controlled re-POST) | `{"expectedRowVersion":6,"assignToUserId":"ram","idempotencyKey":"<uuid>"}` |
| FE mapping | `assignLmsCollectionTask(id, rowVersion, assignUserId.trim(), …)` → `{ expectedRowVersion, assignToUserId, idempotencyKey }` |

UAT browser requests used the same route and `assignToUserId` path; BytePositionInLine **46** vs **48** matches `"ram"` vs `"reddy"` length in the JSON value.

---

## 3. Invalid-input response

| Field | Value |
|---|---|
| HTTP status | **500** |
| Response body | Empty / no domain `{ error, code }` JSON (Azure Functions unhandled failure surface) |
| UI message | `Request failed with status code 500` |
| AuthService involved? | **No** — failure occurs before `CollectionService.AssignAsync` / platform validate-user |
| LaboratoryApi log root | `System.Text.Json.JsonException` ← `System.FormatException`: “The JSON value is not in a supported Guid format.” |
| Path | `$.assignToUserId` |
| Function | `LmsCollectionTasksAssign` **Failed** |

**Exact failure site:**

```text
CollectionFunctions.Assign
  → req.ReadJsonAsync<AssignCollectionTaskRequest>()   ← throws JsonException
  → (outside ExecuteAsync try/catch)
  → unhandled → HTTP 500
```

`AssignCollectionTaskRequest.AssignToUserId` is typed as `Guid`. `HttpRequestDataExtensions.ReadJsonAsync` deserializes with `System.Text.Json` and does **not** catch format errors. Domain validation (`AssignToUserId == Guid.Empty`, platform eligibility) never runs for malformed strings.

Isolated deserializer proof (same options as LaboratoryApi):

| Payload `assignToUserId` | Result |
|---|---|
| `"ram"` | `JsonException` — not a supported Guid format |
| `"reddy"` | `JsonException` — not a supported Guid format |
| valid Guid string | Deserializes OK |

---

## 4. Valid-GUID test (existing user only)

**Existing platform user used (not invented, not created):**

| Field | Value |
|---|---|
| User id | `dddddddd-dddd-dddd-dddd-dddddddddddd` |
| Email | `admin@test.com` |
| Tenant | `155fe198-6ae5-4a01-9254-ead5b427247e` (same as task) |
| Status | `active` |
| Soft-deleted | No (`DeletedAt` null) |
| `lms.collection.collect` | **Yes** (Auth `validate-user` with `requiredPermission=lms.collection.collect` → **200**; permissions catalog also contains `lms.collection.collect` / `lms.collection.manage`) |

**Controlled assign** (claimer → self, allowed under PD-COL-OWN-02 while claim is held):

| Field | Value |
|---|---|
| HTTP status | **200** |
| Result | `assignedToUserId` set to admin Guid; `assignedAt` set; `claimedByUserId` unchanged; `rowVersion` 6 → 7 |
| LaboratoryApi | `LmsCollectionTasksAssign` **Succeeded** (~885 ms) |
| Platform call | `POST http://localhost:5073/api/internal/lms/validate-user` observed in Lab host log immediately before UPDATE |

No further ownership mutations performed after this single controlled success.

---

## 5. Validate-user request (LaboratoryApi → AuthService)

From source `PlatformReferenceClient.ValidateUserWithPermissionAsync` (approved L-COL-01B implementation):

| Field | Value |
|---|---|
| Target URL | `{AuthService__BaseUrl}/api/internal/lms/validate-user` → `http://localhost:5073/api/internal/lms/validate-user` |
| HTTP method | `POST` |
| Headers | `X-Tenant-ID` = tenant Guid (`D` format); `X-Internal-Key` via named HttpClient `"AuthService"` (**masked**) |
| Body (intended) | `{ "userId": "<guid>", "requiredPermission": "lms.collection.collect" }` |
| Actor context | Not sent on validate-user; actor remains JWT user on LaboratoryApi Assign |

**Live successful assign** definitely issued `POST …/validate-user` to Auth on `:5073`. Body was not logged by the host (no secret/PHI dump). Given **runtime build gap** (§7–8), the process loaded from `bin\output` does **not** contain method `ValidateUserWithPermissionAsync`; the live call is consistent with the older `ValidateUserAsync` body shape `{ userId }` (eligibility without `requiredPermission`). Source/`bin\Debug` already contain the permission-aware method.

---

## 6. Validate-user response / AuthService RequiredPermission behavior

AuthService `InternalLmsReferenceController.ValidateUser` + optional `RequiredPermission` — **live** results against tenant `155fe198-…` (internal key **masked**):

| Case | Input | HTTP | Body (summary) |
|---|---|---|---|
| **A. Malformed User ID** | `userId: "ram"` (+ optional collect) | **400** | ASP.NET model validation: JSON could not convert `$.userId` to `Guid` |
| Empty Guid | `00000000-…-0000` | **400** | `user_required` |
| **B. Valid active same-tenant + collect** | admin Guid + `requiredPermission=lms.collection.collect` | **200** | `userId`, `displayName`, `userStatus=active` |
| B′ without RequiredPermission | admin Guid only | **200** | Same (existence/active path) |
| **C. Valid active same-tenant without collect** | e.g. `employee1@hospital.com` Guid + collect | **400** | `user_lacks_permission` — “User is not authorized for the required Collection capability.” |
| **D. Inactive / non-active** | existing `pending_activation` user + collect | **400** | `user_inactive` |
| **E. Cross-tenant** | No other-tenant active user found in local DB sample | **SKIP** (not safely testable here) |
| Unknown Guid same tenant header | random Guid + collect | **404** | `user_not_found` |

**Conclusion:** AuthService correctly rejects malformed Guids with **400** (never 500). Permission path is live and returns the new codes. LaboratoryApi’s UAT **500** is **not** an AuthService exception.

---

## 7. AuthService runtime / build status

| Check | Result |
|---|---|
| Listen | `:5073` — `AuthService.exe` PID **34448** |
| Process start | 2026-10-09 **20:25:55** |
| DLL | `AuthService\bin\Debug\net8.0\AuthService.dll` LastWrite **20:25:54** |
| Source `InternalLmsReferenceController` | LastWrite **20:13:37** (earlier than DLL — process is newer than source) |
| `RequiredPermission` / `user_lacks_permission` / collect messaging | Present in running DLL (UTF-16 literals verified) |
| Stale? | **No** for RequiredPermission path |

---

## 8. LaboratoryApi runtime / build status

| Check | Result |
|---|---|
| Listen | `:7076` — `func.exe start --port 7076` PID **33068** |
| CWD | `LaboratoryApi` |
| Process start | 2026-10-09 **18:11:43** |
| Loaded artifact (convention) | `bin\output\LaboratoryApi.dll` LastWrite **18:10:04** |
| `bin\Debug\net8.0\LaboratoryApi.dll` | LastWrite **20:17:22** (newer; **not** what this `func` host loaded) |
| `ValidateUserWithPermissionAsync` in **output** | **Absent** |
| `ValidateUserWithPermissionAsync` in **Debug bin** | **Present** |
| Collection Assign route registered | Yes — `LmsCollectionTasksAssign` |
| Analogy | Same class of stale `bin\output` vs newer build issue seen in earlier LaboratoryApi 404 diagnostics |

**Do not restart / rebuild** performed in this diagnostic (per instructions). Invalid-input **500** reproduces on the current host regardless of the permission-method gap, because JsonException happens at deserialize.

---

## 9. Exact root exception

```text
System.Text.Json.JsonException:
  The JSON value could not be converted to LaboratoryApi.Services.AssignCollectionTaskRequest.
  Path: $.assignToUserId | LineNumber: 0 | BytePositionInLine: 46|48
  ---> System.FormatException: The JSON value is not in a supported Guid format.
       at System.Text.Json.Utf8JsonReader.GetGuid()
       at System.Text.Json.Serialization.Converters.GuidConverter.Read(...)
```

**Classification:** malformed GUID parsing at LaboratoryApi request deserialization — **unhandled** because `ReadJsonAsync` sits **outside** `ExecuteAsync`’s `CollectionDomainException` / `OrderDomainException` handlers.

**Not:** AuthService exception, permission-service exception, HTTP client deserialization of Auth response, missing runtime dependency, invalid configuration, or database error (for the `ram`/`reddy` failures).

---

## 10. State-integrity result

After failed assign (`ram`) with `rowVersion=6`:

| Field | Before failed assign | After failed assign |
|---|---|---|
| `AssignedToUserId` | null | **null (unchanged)** |
| `AssignedAt` | null | **null (unchanged)** |
| `ClaimedByUserId` | `dddddddd-…` | **unchanged** |
| `ClaimedAt` | `2026-10-09T15:08:20.782107Z` | **unchanged** |
| `RowVersion` | 6 | **6 (unchanged)** |
| `Status` | Planned | Planned |

No partial assignment from invalid input. (Later controlled **valid** Guid assign intentionally set Assigned — see §4.)

---

## 11. Audit result

`audit_log` for resource id = task (newest first):

| Action | When (UTC) |
|---|---|
| `ASSIGN_COLLECTION_TASK` | **2026-10-09 15:24:52** — matches **successful** valid-Guid assign only |
| `CLAIM_COLLECTION_TASK` | 15:08:20 |
| prior CLAIM/RELEASE/CREATE | earlier |

**No** `ASSIGN_COLLECTION_TASK` rows corresponding to the failed `ram`/`reddy`/malformed attempts. Failed assign that changes no state does **not** create a successful mutation audit.

---

## 12. Root cause

1. **Primary (UAT 500):** FE sends free-text `assignToUserId` (`ram` / `reddy`). LaboratoryApi binds it to `Guid`. `System.Text.Json` throws `JsonException`/`FormatException` inside `ReadJsonAsync` **before** domain handling. Unhandled → HTTP **500** with empty body.
2. **Secondary (runtime drift, not the 500):** Running LaboratoryApi `bin\output` predates `ValidateUserWithPermissionAsync`; AuthService on `:5073` already has `RequiredPermission`. Valid Guid assign still works via platform validate-user + Assign rules on the current host; full PD-COL-OWN-05 wire-through needs a refreshed Lab host loading the newer DLL (out of scope for this diagnostic / no restart).

---

## 13. Minimal proposed fix (NOT implemented)

1. **LaboratoryApi:** Catch `JsonException` (and/or validate Guid before deserialize) on Assign body read; return **400** with a stable code (e.g. `assignee_invalid` / `malformed_user_id`) and message — never 500. Prefer fixing at `CollectionFunctions.Assign` and/or hardening `ReadJsonAsync` used by Assign so malformed Guids cannot escape as unhandled exceptions.
2. **Optional FE (non-blocking):** Client-side Guid format check before POST so operators are not invited to type names into a Guid field (PD-COL-UX-01 picker remains deferred).
3. **Ops (separate from invalid-input fix):** Refresh LaboratoryApi `func` host so `bin\output` matches the Debug build that includes `ValidateUserWithPermissionAsync` (same pattern as prior Lab stale-output fixes). Do **not** change Auth, permissions, or roles for the 500.

---

## 14. Exact files that would change

| File | Change |
|---|---|
| `microservices/laboratory-service/LaboratoryApi/Functions/CollectionFunctions.cs` | Handle deserialize failure on Assign → 400 |
| `microservices/laboratory-service/LaboratoryApi/Services/HttpRequestDataExtensions.cs` | Optional shared safe-read helper (if reused) |
| `apps/hospital-portal-web/src/components/lms/collection/CollectionTaskDetailSheet.tsx` | Optional Guid format validation / clearer error (UX only) |
| Tests under `LaboratoryApi.Tests` / FE collection tests | Assert malformed assignee → 400, not 500 |

**Would not change for this fix:** `CollectionService` eligibility logic (already correct once Guid parses), AuthService `RequiredPermission` path (already correct), DB, permissions/roles, Orders/Catalogue/Pathology/Specimen/Receiving.

---

## 15. Confirmation — no code was changed

This diagnostic session:

- Did **not** modify CollectionService, PlatformReferenceClient, AuthService, Collection UI, database, permissions, roles, or sibling LMS domains.
- Did **not** change error handling.
- Did **not** rebuild or restart services for remediation.
- Did perform read-only inspection, one controlled invalid assign re-POST, Auth internal validate-user probes, DB reads, and **one** controlled valid-Guid assign (required by §2).
- Only new artifact: this document.

---

## FINAL STATUS (repeat)

**`ASSIGN_VALID_GUID_WORKS_INVALID_INPUT_HANDLING_REQUIRED`**

STOP — fix not implemented.
