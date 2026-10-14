# L-COL-01B — Assign Invalid-GUID HTTP 500 Fix Report

**Date:** 2026-10-09  
**Diagnostic referenced:** [enterprise-lms-collection-assign-500-diagnostic.md](./enterprise-lms-collection-assign-500-diagnostic.md)  
**Prior status:** `ASSIGN_VALID_GUID_WORKS_INVALID_INPUT_HANDLING_REQUIRED`

---

## FINAL STATUS

**Implementation-era gate:** `IMPLEMENTATION_COMPLETE_READY_FOR_TARGETED_UAT`  
**Acceptance (2026-10-09):** **L-COL-01B ACCEPTED** — see [enterprise-lms-collection-task-acceptance-closure.md](./enterprise-lms-collection-task-acceptance-closure.md) and [enterprise-lms-collection-task-final-uat-audit.md](./enterprise-lms-collection-task-final-uat-audit.md).

---

## 1. Root cause

`CollectionFunctions.Assign` called `ReadJsonAsync<AssignCollectionTaskRequest>()` **outside** `ExecuteAsync`.  
`AssignToUserId` is a `Guid`. Values such as `"ram"` / `"reddy"` threw `System.Text.Json.JsonException` / `FormatException` during deserialization → unhandled Azure Functions failure → **HTTP 500** with empty body.

Valid Guids already succeeded through Assign → validate-user → Claim/Assign matrix → audit.

---

## 2. Exact fix

Narrow Assign-boundary parse helper `CollectionAssignJson`:

- Deserializes with the same `HttpRequestDataExtensions.JsonOpts` as other LMS endpoints.
- On `JsonException` → throws `CollectionDomainException` with:
  - message: `Assignee user ID must be a valid GUID.`
  - code: `assignee_invalid`
  - status: **400**
- `Assign` runs this parse **inside** `ExecuteAsync`, so the existing domain exception mapping returns the standard LMS `{ error, code }` JSON (no stack trace).

`ReadJsonAsync` was **not** changed globally. Other LMS endpoints are unchanged.

Minimal FE: client GUID shape check before POST (toast only). Server-side 400 remains mandatory. No staff picker.

---

## 3. Files changed

| File | Change |
|---|---|
| `microservices/laboratory-service/LaboratoryApi/Services/CollectionAssignJson.cs` | **New** — Assign body parse → `assignee_invalid` |
| `microservices/laboratory-service/LaboratoryApi/Functions/CollectionFunctions.cs` | Assign uses `CollectionAssignJson.ReadAsync` inside `ExecuteAsync` |
| `microservices/laboratory-service/LaboratoryApi.Tests/CollectionAssignInvalidGuidTests.cs` | **New** — ram/reddy/empty/valid parse tests |
| `microservices/laboratory-service/LaboratoryApi.Tests/CollectionServiceTests.cs` | Empty Guid → `assignee_required`, no mutation/audit |
| `apps/hospital-portal-web/src/components/lms/collection/CollectionTaskDetailSheet.tsx` | Minimal client GUID check |
| `apps/hospital-portal-web/src/app/dashboard/lms/collection/enterprise-lms-collection-ui.test.ts` | Assert GUID check present; no picker |
| `docs/laboratory-management/enterprise-lms-collection-assign-invalid-guid-fix-report.md` | This report |

**Not changed:** CollectionService ownership rules, AuthService, permissions/roles, schema, Claim/Release/Search, Orders/Catalogue/Pathology/Specimen/Receiving, Claim/Assign matrix.

---

## 4. Tests

| Suite | Result |
|---|---|
| `LaboratoryApi.Tests` filter `~Collection` | **33 passed** |
| Full `LaboratoryApi.Tests` | **113 passed** |
| FE `enterprise-lms-collection-ui.test.ts` | **11 passed** |
| Auth `EnterpriseLms\|InternalLms\|InternalAudit` (isolated `-o` output; running AuthService locks default bin) | **31 passed** |

Coverage includes:

1. `"ram"` / `"reddy"` / `""` / `"not-a-guid"` → `CollectionDomainException` **400** `assignee_invalid`
2. Empty Guid string deserializes; domain `Assign` → **400** `assignee_required` with **no** Assigned/Claimed/`RowVersion` change and **no** `ASSIGN_COLLECTION_TASK` audit
3. Valid Guid parse intact; existing Assign/Claim conflict tests still pass
4. FE asserts GUID check without introducing a staff picker

---

## 5. Malformed input response

Expected from Assign after this fix:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"error":"Assignee user ID must be a valid GUID.","code":"assignee_invalid"}
```

(Matches existing `BadRequestAsync(message, code)` contract.)

---

## 6. State integrity

Malformed Guid fails at parse **before** `CollectionService.AssignAsync`:

- no `AssignedToUserId` / `AssignedAt` change  
- no `ClaimedByUserId` / `ClaimedAt` change  
- no `RowVersion` increment  
- no mutation audit  

Empty Guid (`Guid.Empty`) still rejected by existing domain `assignee_required` without mutation/audit (tested).

---

## 7. Audit integrity

Failed malformed / empty-assignee Assign does not write `ASSIGN_COLLECTION_TASK`.  
Successful valid-Guid Assign unchanged.

---

## 8. Valid GUID regression

Existing path preserved (no CollectionService / Auth / permission changes in this fix):

LaboratoryApi Assign → platform validate-user → tenant/active/collect eligibility → Claim/Assign matrix → concurrency → audit → assignment.

---

## 9. Confirmation — no Auth / permission / schema / domain changes

- AuthService: **unchanged**
- Permissions / roles: **unchanged**
- Database / migrations: **unchanged**
- CollectionService Claim/Assign matrix: **unchanged**
- Search / Specimen / Receiving / Orders / Catalogue / Pathology: **unchanged**

---

## 10. Runtime refresh requirement (operational — separate from this code fix)

Live `:7076` may still load stale `bin\output\LaboratoryApi.dll` (predating `ValidateUserWithPermissionAsync` and this Assign parse fix). Application behavior change alone does not refresh the running host.

**Exact steps (same class of refresh as prior LaboratoryApi 404 fix):**

1. Stop the LaboratoryApi Azure Functions host on port **7076** (`func.exe` for this project).  
2. From `microservices/laboratory-service/LaboratoryApi`:  
   `dotnet build -c Debug`  
   (ensures `bin\Debug\net8.0` is current; `func start` rebuilds/copies into `bin\output` on start).  
3. Start: `func start --port 7076` (or project `START_ALL` Laboratory path).  
4. Confirm:  
   - `GET http://localhost:7076/admin/functions` lists `LmsCollectionTasksAssign`  
   - Running `bin\output\LaboratoryApi.dll` contains `ValidateUserWithPermissionAsync` **and** `assignee_invalid`  
5. Leave AuthService on **5073** as-is (no Auth restart required for this fix).

Do **not** treat runtime refresh as part of the application-code change; it is required for Manual UAT against the live process.

---

## 11. Manual UAT checklist

On refreshed LaboratoryApi `:7076`:

1. Open Collection task detail (e.g. `COL-20261009-000004` or equivalent Planned task).  
2. Assign `ram` → expect **400** `assignee_invalid` (UI toast from FE check and/or API error — **not** HTTP 500).  
3. Assign `reddy` → same.  
4. Confirm Assigned/Claimed/`RowVersion` unchanged after failures.  
5. Assign a real eligible collector Guid (same tenant, active, `lms.collection.collect`) → success path still works under Claim/Assign rules.  
6. Confirm no `ASSIGN_COLLECTION_TASK` audit for failed attempts; audit present for successful assign.  
7. Smoke Claim / Release / Search — unchanged.

---

## FINAL STATUS (repeat)

**Implementation-era gate:** `IMPLEMENTATION_COMPLETE_READY_FOR_TARGETED_UAT`  
**Post-UAT acceptance (2026-10-09):** **L-COL-01B ACCEPTED** — [acceptance closure](./enterprise-lms-collection-task-acceptance-closure.md).

**STOP.** Do not start Specimen or Receiving.
