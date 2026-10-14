# L-COL-01B — AuthService Internal Audit Allowlist Fix Report

**Date:** 2026-10-09  
**Mode:** Narrow UAT-blocker fix (Auth allowlist + tests only)  
**Diagnostic:** `enterprise-lms-collection-audit-write-diagnostic.md`

---

## Final status

**`AUDIT_ALLOWLIST_FIX_COMPLETE_READY_FOR_UAT`**

L-COL-01B is **not** marked accepted. Full Manual UAT was **not** performed in this task.

---

## 1. Root cause

AuthService `InternalAuditController` allowlists covered Catalogue + Orders only.  
Collection CREATE sent `CREATE_COLLECTION_TASK` / `LmsCollectionTask` → **400 `action_not_allowed`** → LaboratoryApi fail-closed rollback → UI **503**.

---

## 2. Files changed

| File | Change |
|---|---|
| `microservices/auth-service/AuthService/Controllers/InternalAuditController.cs` | Added Collection actions + `LmsCollectionTask` |
| `microservices/auth-service/AuthService.Tests/InternalAuditControllerTests.cs` | Collection accept tests + regression assertions |
| `docs/laboratory-management/enterprise-lms-collection-audit-allowlist-fix-report.md` | This report |

**No** LaboratoryApi / Collection / FE / schema / permission changes.

---

## 3. Exact allowlist entries added

**AllowedActions:**

- `CREATE_COLLECTION_TASK`
- `TRANSITION_COLLECTION_TASK`
- `CLAIM_COLLECTION_TASK`
- `ASSIGN_COLLECTION_TASK`
- `RELEASE_COLLECTION_TASK`
- `CANCEL_COLLECTION_TASK`

**AllowedResourceTypes:**

- `LmsCollectionTask`

Allowlist remains explicit (no wildcards / prefix / contains matching).

---

## 4. Existing entries preserved

All prior Catalogue and Orders actions/resource types remain:

- Actions: `CREATE_DRAFT`, `UPDATE_DRAFT`, `SUBMIT_REVIEW`, `RETURN_TO_DRAFT`, `APPROVE`, `ACTIVATE`, `RETIRE`, `SUPERSEDE`, `CREATE_VERSION`, `SUBMIT_ORDER`, `AMEND_ORDER`, `CANCEL_ORDER`
- Resources: `LmsCatalogueVersion`, `LmsOrder`, `LmsOrderVersion`

Internal key auth, tenant header match, actor validation, and `AuditService` / `audit_log` path unchanged.

---

## 5. Tests run and exact counts

| Suite | Result |
|---|---|
| `InternalAuditControllerTests` | **16 passed**, 0 failed |
| AuthService `EnterpriseLms*` + InternalAudit filter (combined run) | **25 passed**, 0 failed |
| `CollectionServiceTests` | **16 passed**, 0 failed |
| FE Collection UI + API tests | **10 passed**, 0 failed |

---

## 6. Security tests

Covered by existing + new InternalAudit tests:

- Missing/invalid internal key → rejected  
- Tenant header required / mismatch → rejected  
- Unsupported action / resource → rejected  
- Catalogue + Orders allowlisted writes → accepted  
- All six Collection actions + `LmsCollectionTask` → accepted  

---

## 7. Runtime verification

After AuthService restart on **5073** (LaboratoryApi left on **7076**):

| Probe | Result |
|---|---|
| `POST /api/internal/audit` `CREATE_COLLECTION_TASK` + `LmsCollectionTask` | **200** `status=logged` |
| `POST /api/internal/audit` `CREATE_DRAFT` + `LmsOrder` (regression) | **200** `status=logged` |
| LaboratoryApi `GET /api/lms/collection/tasks` (no JWT) | **401** (host still alive) |

Internal API key **not** exposed in this report.

---

## 8. AuthService restart status

| Item | Value |
|---|---|
| Stopped | Prior AuthService PID on 5073 |
| Started | `dotnet run --launch-profile http` from AuthService project |
| Listen | **5073** (new process) |
| LaboratoryApi | Unchanged on **7076** |

---

## 9–13. Confirmations

| Confirmation | Status |
|---|---|
| 9. No LaboratoryApi code changed | **Yes** |
| 10. No Collection business rules changed | **Yes** |
| 11. No schema / migrations changed | **Yes** |
| 12. No permission / role changes | **Yes** |
| 13. No audit bypass / optionalization | **Yes** — fail-closed retained; only allowlist expanded explicitly |

---

## 14. Final status

**`AUDIT_ALLOWLIST_FIX_COMPLETE_READY_FOR_UAT`**

Retry Manual UAT: Create collection task on `/dashboard/lms/collection`.  
Do not treat this report as L-COL-01B acceptance.
