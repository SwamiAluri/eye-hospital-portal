# L-REP-02A — Finalization Audit Runtime Blocker

**Date:** 2026-10-12  
**Mode:** Investigation + operational correction (no application business-logic change)  
**Observed UAT symptom:** Confirm Finalize → `"Audit unavailable. Report finalization was not completed."` → Report remains Draft

---

## 1. Exact root cause

**Stale AuthService process** was serving `/api/internal/audit` **without** `FINALIZE_REPORT` in its loaded allowlist.

| Probe | Running AuthService (PID 12056, started ~16:14) | Source on disk |
| --- | --- | --- |
| `FINALIZE_REPORT` + `LmsReport` | **HTTP 400** `action_not_allowed` | Allowlisted in `InternalAuditController.cs` |
| `CREATE_REPORT_DRAFT` + `LmsReport` | **HTTP 200** logged | Allowlisted |

LaboratoryApi `PlatformAuditClient.WriteAsync` treats any non-success as throw → ReportService catch → **503 `audit_unavailable`** → fail-closed revert to Draft. That path is **correct**.

The defect was **runtime/configuration process state**, not Finalization business rules.

---

## 2. Classification

| Question | Answer |
| --- | --- |
| Runtime/configuration or application defect? | **Runtime / stale process** |
| Application code change required? | **No** (source already correct from L-REP-02A impl) |
| Fail-closed weakened? | **No** |
| Permissions/roles changed? | **No** |
| L-REP-02B started? | **No** |

---

## 3. Trace (verified)

```text
ReportFunctions.Finalize
  → ReportService.FinalizeAsync
  → IPlatformAuditClient.WriteAsync
  → POST http://localhost:5073/api/internal/audit
       headers: X-Internal-Key, X-Tenant-ID
       body: action=FINALIZE_REPORT, resourceType=LmsReport, …
  → InternalAuditController.Write
       → AllowedActions.Contains("FINALIZE_REPORT")  ← FAILED on stale process
  → LaboratoryApi throws CatalogueDomainException(audit_unavailable)
  → RevertFinalizeAsync → Draft retained
```

Config check:

- Lab `AuthService__BaseUrl` = `http://localhost:5073` (reachable)
- Internal key from Lab `local.settings.json` accepted by Auth (CREATE_REPORT_DRAFT succeeded)
- Tenant header + body path functional for CREATE
- AuthService listening on 5073; LaboratoryApi on 7076

---

## 4. Correction applied

**Operational only:**

1. Stop stale AuthService process  
2. Rebuild AuthService Debug  
3. Restart AuthService (`dotnet run --no-build -c Debug --launch-profile http`)  
4. Re-probe `POST /api/internal/audit` with `FINALIZE_REPORT` → expect **HTTP 200**  

No ReportService / ReportFunctions / allowlist source changes in this task (allowlist already contained `FINALIZE_REPORT` on disk).

---

## 5. Runtime verification (post-restart)

| Check | Result |
| --- | --- |
| AuthService restarted | Yes — new process listening on `:5073` (StartTime ~17:35) |
| LaboratoryApi | Left running on `:7076` (already had Finalize code) |
| `POST /api/internal/audit` `FINALIZE_REPORT` + `LmsReport` | **HTTP 200** `status=logged` |
| Application source changes in this task | **None** |

---

## 6. Automated tests

No application code changed in this correction task.

Prior L-REP-02A evidence remains valid:

- LaboratoryApi.Tests **291** (incl. finalize + PG concurrency + audit fail-closed)
- Auth allowlist tests include `FINALIZE_REPORT`
- Reports UI tests green

This task adds **runtime probe evidence** only (stale vs restarted AuthService).

---

## 7. Confirmations

| Check | Status |
| --- | --- |
| Fail-closed audit behavior preserved | Yes |
| No audit bypass / optional audit | Yes |
| No second audit store | Yes |
| No permission/role grants | Yes |
| No Release/PDF/numbering/publication | Yes |
| L-REP-02B not started | Yes |
| Draft remains Draft when audit unavailable | Yes (preserved) |

---

## 8. Post-correction probe results

**Before restart**

```text
FINALIZE_REPORT → HTTP 400 {"code":"action_not_allowed"}
CREATE_REPORT_DRAFT → HTTP 200 (proves key/tenant path OK)
AuthService PID 12056 started ~16:14 (pre–L-REP-02A allowlist load)
```

**After rebuild + restart**

```text
FINALIZE_REPORT → HTTP 200 {"status":"logged","outcome":"success","action":"FINALIZE_REPORT","resourceType":"LmsReport",…}
AuthService new process listening on 5073
```

Manual UAT may now retry Finalize on the existing Draft Report. Actor must still hold `lms.reports.finalize`.

---

## 9. Final status

```text
L_REP_02A_AUDIT_RUNTIME_BLOCKER_RESOLVED_READY_FOR_MANUAL_UAT
```

Do **not** claim `MANUAL_UAT_PASSED` or `ACCEPTED`.  
Do **not** start L-REP-02B.
