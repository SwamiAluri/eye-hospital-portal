# L-COL-01B — Collection CREATE Platform Audit Write Failure Diagnostic

**Date:** 2026-10-09  
**Mode:** DIAGNOSTIC ONLY — no code, schema, permission, UX, or audit-bypass changes  
**UAT symptom:** Create collection task → `Collection mutation aborted: platform audit write failed.`

---

## Final status

**`DIAGNOSIS_COMPLETE_FIX_REQUIRED`**

---

## 1. UAT reproduction

Live UAT (browser) already reproduced against the running host:

| Step | Result |
|---|---|
| Plan context / OrderTests / branch selection | Success |
| `POST /api/lms/collection/tasks` | Fail closed **HTTP 503** `audit_unavailable` |
| UI message | `Collection mutation aborted: platform audit write failed.` |

LaboratoryApi host log (requestId `f24e6a75-65cb-4400-8f06-6a937ee7e5fa`, function Id `f4e7c152-049b-48a7-83d8-5ee5c2eb64bc`, **2026-10-09T12:56:44Z**):

1. Validated order/tests, allocated task number  
2. `INSERT` into `lms_collection_tasks` + `lms_collection_task_order_tests`  
3. `POST http://localhost:5073/api/internal/audit` → **400**  
4. Compensating `DELETE` of task + links + idempotency claim  
5. Returned **503** to client  

Isolated AuthService reproduction (diagnostic POST with same Action/ResourceType, masked internal key) confirms **400 `action_not_allowed`**.

---

## 2. Exact failure point

```text
Hospital Portal (Create collection task)
  → LaboratoryApi CollectionFunctions.Create
  → CollectionService.CreateAsync
  → SaveChanges (task + links)           ← succeeds temporarily
  → IPlatformAuditClient.WriteAsync
  → POST AuthService /api/internal/audit
  → InternalAuditController allowlist    ← FAILS HERE (400)
  → PlatformAuditClient throws
  → CollectionService rolls back task/links/idempotency
  → HTTP 503 audit_unavailable to UI
```

**Not** JWT auth, Collection permission, Orders validation, DB connectivity, or `audit_log` persistence.  
Failure is **AuthService internal audit action allowlist rejection** before `IAuditService.LogAsync` runs.

---

## 3. LaboratoryApi audit call

| Field | Value |
|---|---|
| HTTP method | `POST` |
| Target URL | `http://localhost:5073/api/internal/audit` |
| Client | Named HttpClient `"AuthService"` (`Program.cs`) |
| AuthService base | `AuthService__BaseUrl` → `http://localhost:5073` |
| `X-Internal-Key` | Present (DefaultRequestHeaders; value **masked**) |
| `X-Tenant-ID` | Present per call (`tenantId.ToString("D")`) |
| Body contract | `tenantId`, `actorUserId`, `action`, `resourceType`, `resourceId`, optional `newValues`, … |
| Actor source | JWT `UserId` (not client-supplied actor) |
| Tenant source | JWT tenant → method arg + header + body |

---

## 4. AuthService response (live UAT)

| Field | Value |
|---|---|
| HTTP status | **400** |
| Body | `{"error":"Action is not permitted on the internal audit endpoint.","code":"action_not_allowed"}` |
| Latency | ~50 ms |

Diagnostic isolations:

| Payload | Result |
|---|---|
| `CREATE_COLLECTION_TASK` + `LmsCollectionTask` | **400** `action_not_allowed` |
| `CREATE_DRAFT` + `LmsOrder` (known-good) | **200** `logged` |
| `CREATE_COLLECTION_TASK` + `LmsOrder` | **400** `action_not_allowed` |
| `CREATE_DRAFT` + `LmsCollectionTask` | **400** `resource_type_not_allowed` |
| Missing `X-Internal-Key` | **401** Invalid or missing internal API key |

---

## 5. Audit endpoint status

| Check | Result |
|---|---|
| Endpoint registered | Yes — `InternalAuditController` `[Route("api/internal/audit")]` |
| AuthService listening | Port **5073** (PID 25884, AuthService) |
| Reachable | Yes |
| Internal key auth | Works (401 without key; Order audit 200 with key) |
| Endpoint health | Healthy for **allowlisted** catalogue/order operations |

---

## 6. ResourceType (actual)

From `CollectionAuditResourceTypes`:

```text
LmsCollectionTask
```

**Not** in `InternalAuditController.AllowedResourceTypes`  
(current: `LmsCatalogueVersion`, `LmsOrder`, `LmsOrderVersion` only).

---

## 7. Action (actual)

From `CollectionAuditActions` for CREATE:

```text
CREATE_COLLECTION_TASK
```

Also used by other Collection mutations (not yet UAT-blocked here, but same gap):

- `TRANSITION_COLLECTION_TASK`
- `CLAIM_COLLECTION_TASK`
- `ASSIGN_COLLECTION_TASK`
- `RELEASE_COLLECTION_TASK`
- `CANCEL_COLLECTION_TASK`

**None** are in `InternalAuditController.AllowedActions`  
(current: catalogue lifecycle + `SUBMIT_ORDER` / `AMEND_ORDER` / `CANCEL_ORDER` / shared `CREATE_DRAFT` / `UPDATE_DRAFT` / …).

---

## 8. Tenant propagation result

**OK.** LaboratoryApi sends matching `X-Tenant-ID` + body `tenantId`.  
Allowlist fails **before** tenant mismatch checks would matter.  
Known-good Order audit with same header pattern returns 200.

---

## 9. Actor propagation result

**OK at LaboratoryApi.** Actor is JWT `UserId` passed into `WriteAsync` as `actorUserId`.  
Not taken from FE payload. Auth never reached actor persistence for Collection CREATE.

---

## 10. Internal authentication result

**OK.** Key is configured and accepted for Order audit.  
Without key → 401. Collection failure is **not** 401/403.

---

## 11. Audit persistence result

**Not reached** for Collection CREATE.  
`IAuditService.LogAsync` / `audit_log` insert would only run after allowlist pass.  
No evidence of DB/audit_log failure for this UAT path.

---

## 12. Known-good Orders / Catalogue comparison

| Dimension | Catalogue / Orders | Collection CREATE |
|---|---|---|
| Endpoint | `POST /api/internal/audit` | Same |
| Internal key | `X-Internal-Key` | Same |
| Tenant header | `X-Tenant-ID` | Same |
| Actor | JWT → `actorUserId` | Same |
| Client | `PlatformAuditClient` | Same |
| Fail-closed | Yes (503) | Yes (503; Collection message) |
| Action examples | `CREATE_DRAFT`, `SUBMIT_ORDER`, … | `CREATE_COLLECTION_TASK` |
| ResourceType | `LmsCatalogueVersion` / `LmsOrder` / … | `LmsCollectionTask` |
| Allowlisted today? | **Yes** | **No** |

Root difference: **Collection Action/ResourceType never added to AuthService allowlists** when L-COL-01B was implemented.

---

## 13. Runtime / build findings

| Component | Finding |
|---|---|
| LaboratoryApi :7076 | Current L-COL-01B build; Collection functions registered; audit client wired |
| AuthService :5073 | Running; internal audit healthy for Orders |
| Auth allowlist source | Still L-CAT + L-ORD only — **no Collection entries** |
| Stale-host theory | **Rejected** for this symptom — Auth responds correctly; rejection is deliberate allowlist policy gap, not a dead process |

---

## 14. Transaction rollback result

Fail-closed compensation observed in logs and DB counts:

| Artifact | After failed UAT CREATE |
|---|---|
| `lms_collection_tasks` | **0** rows |
| `lms_collection_task_order_tests` | **0** rows |
| `lms_collection_idempotency` | **0** rows (claim released) |
| Log | DELETE task + links; DELETE idempotency |

**No orphan CollectionTask / links / incomplete idempotency records.**

Note: task-number sequence may advance before audit (sequence upsert occurred); that is not a committed CollectionTask orphan.

---

## 15. Root cause

AuthService `InternalAuditController` **action/resource allowlist does not include L-COL-01B Collection audit constants**.

Collection CREATE correctly calls platform audit with:

- Action = `CREATE_COLLECTION_TASK`
- ResourceType = `LmsCollectionTask`

Auth returns **400 `action_not_allowed`**.  
LaboratoryApi fail-closed path rolls back the mutation and surfaces **503** to the UI — as designed.

This is an **incomplete AuthService allowlist expansion** relative to accepted L-COL-01B Collection audit actions — **not** a Collection business-rule bug and **not** an invitation to bypass audit.

---

## 16. Minimal proposed fix

**Do not** weaken fail-closed audit.

1. Expand `InternalAuditController.AllowedActions` with the Collection actions from `CollectionAuditActions`.  
2. Expand `AllowedResourceTypes` with `LmsCollectionTask`.  
3. Extend `InternalAuditControllerTests` to assert the new allowlist entries (mirror Orders catalogue tests).  
4. Restart AuthService so the updated controller is loaded.  
5. Re-try UAT Create collection task — expect **201/200**, not audit abort.

No CollectionService fail-closed changes. No FE changes. No schema changes. No role grants.

---

## 17. Exact files that would need changing

| File | Change |
|---|---|
| `microservices/auth-service/AuthService/Controllers/InternalAuditController.cs` | Add Collection actions + `LmsCollectionTask` to allowlists |
| `microservices/auth-service/AuthService.Tests/InternalAuditControllerTests.cs` | Assert Collection allowlist (and optionally a write smoke with allowed action) |

**Not required for this root cause:** `CollectionService.cs`, FE, LaboratoryApi audit client, migrations, permissions/role seeds.

---

## 18. Confirmation — no code was changed

- No source modifications for a fix  
- No audit bypass / optionalization  
- No schema/migration/permission/role/UX changes  
- Diagnostic POSTs to AuthService used masked key material and synthetic GUIDs  
- This document is the sole write artifact of the diagnostic task  

---

## Secrets

Internal API key values are **masked** throughout. Only presence/length/prefix pattern and HTTP outcomes are recorded.
