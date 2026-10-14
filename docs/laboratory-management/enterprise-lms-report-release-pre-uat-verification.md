# L-REP-02B — Report Release PRE-UAT Verification

**Date:** 2026-10-12  
**Final status:** `IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`

---

## 1. Automated / runtime evidence

| Check | Result |
| --- | --- |
| Product Decision Closure | `PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED` |
| Implementation audit | [enterprise-lms-report-release-implementation-audit.md](./enterprise-lms-report-release-implementation-audit.md) |
| Migration `20261012200000_AddLmsReportReleaseMetadata` | **Applied** — `released_at_utc`, `released_by_user_id` present on `lms_reports` |
| Existing L-REP-02A data | Draft=3, Final=1, Released=0 — **no automatic Release** |
| `ReportServiceTests` (incl. Release) | Pass (included in suite) |
| PostgreSQL concurrent Release | Pass — `PostgreSQL_Concurrent_Release_Same_Final_Succeeds_Exactly_Once` (exactly one success) |
| Full `LaboratoryApi.Tests` | **298 passed** |
| Auth allowlist + reports permission tests | **24 passed** (`InternalAuditControllerTests` + `EnterpriseLmsReportsPermissionTests` filter) |
| Reports UI tests | **10 passed** |
| LMS FE regression (`src/app/dashboard/lms` + `src/lib/lms`) | **93 passed** |
| AuthService rebuilt/restarted | Yes — fresh process on `:5073` after allowlist change |
| LaboratoryApi rebuilt/restarted | Yes — `func start` reloaded; `LmsReportRelease` mapped to `POST …/release` on `:7076` |
| LaboratoryApi Release route registered | Confirmed in host function map |
| Runtime audit probe `RELEASE_REPORT` + `LmsReport` | **HTTP 200** `{"status":"logged","outcome":"success",...}` (post-restart; not stale-process) |
| Permission catalogue `lms.reports.release` | Present; seed creates codes **without role grants** |
| No PDF / numbering / download / publication / NotificationHub | Confirmed by scope + FE assertions |
| Source claims remain after Release | Unit-tested |
| ResultStatus unchanged on Release | Unit-tested |
| Audit failure fail-closed (remains Final) | Unit-tested |

### Schema verification (PostgreSQL)

```text
finalized_at_utc     | timestamp with time zone | YES
finalized_by_user_id | uuid                     | YES
released_at_utc      | timestamp with time zone | YES
released_by_user_id  | uuid                     | YES
status               | character varying        | NO
```

### Concurrent Release evidence

`PostgreSQL_Concurrent_Release_Same_Final_Succeeds_Exactly_Once` — 6 workers, same Final Report + same expected RowVersion, distinct idempotency keys → **exactly one** `Released` success; losers receive `concurrency_conflict` / `invalid_state` / `idempotency_conflict`.

### Runtime audit probe (post AuthService restart)

```text
POST http://localhost:5073/api/internal/audit
  action=RELEASE_REPORT
  resourceType=LmsReport
→ HTTP 200 status=logged outcome=success
```

---

## 2. Manual UAT checklist

Use an actor that already holds `lms.reports.view` / `manage` / `finalize` / `release` as available in the UAT environment. Do **not** add production role grants for this checklist.

1. Open Reports.  
2. Locate an existing Final Report.  
3. Open it.  
4. Confirm Status = Final.  
5. Confirm current version.  
6. Confirm Release Report action.  
7. Click Release.  
8. Confirm explicit confirmation dialog.  
9. Confirm Release.  
10. Verify Status = Released.  
11. Verify ReleasedAt.  
12. Verify ReleasedBy.  
13. Verify Version number unchanged.  
14. Verify snapshot unchanged.  
15. Verify Result remains ClinicallyAuthorized.  
16. Return to Reports.  
17. Verify worklist shows Released.  
18. Reopen Released Report.  
19. Verify Release action unavailable.  
20. Verify no Unrelease/Revoke.  
21. Verify no PDF.  
22. Verify no Download.  
23. Verify no Publish.  
24. Verify no Notify.  
25. Verify source ResultVersion is still unavailable for a new Draft.  
26. Verify no notification was emitted.  
27. Verify no patient publication.  
28. Refresh and confirm Released persists.  

If a second actor is available:

29. Verify actor without `lms.reports.release` cannot execute Release.  

If a concurrency test is manually practical:

30. Verify stale RowVersion returns honest conflict.  

---

## 3. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| PDF / CanonicalDocument / numbering / download | Not implemented |
| Patient Portal / Patient 360 publication | Not implemented |
| NotificationHub / SMS / email / WhatsApp | Not implemented |
| Amendments / Unrelease / Revoke | Not implemented |
| ResultStatus / L-AUTH / L-VER / L-TST / L-CRT | Unchanged |
| Pathology | Unchanged |
| Role grants | None added |
| L-REP-01 Draft + uniqueness | Preserved |
| L-REP-02A Finalize | Preserved / accepted |

---

## 4. Status

```text
IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
```

Do **not** claim `MANUAL_UAT_PASSED` or `ACCEPTED`.  
Do **not** start PDF, numbering, download, publication, notification/delivery, Amendments, or Unrelease/Revoke.

**Next gate:** Manual UAT (human-executed).
