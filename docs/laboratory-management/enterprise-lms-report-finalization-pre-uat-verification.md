# L-REP-02A — Report Finalization PRE-UAT Verification

**Date:** 2026-10-12  
**Final status:** `IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`

---

## 1. Automated evidence

| Check | Result |
| --- | --- |
| Build LaboratoryApi | Pass |
| Migration `20261012190000_AddLmsReportFinalizationMetadata` | Applied (`finalized_at_utc`, `finalized_by_user_id` present) |
| `ReportServiceTests` + Finalize cases | Pass (included in suite) |
| PostgreSQL concurrent Finalize | Pass (`PostgreSQL_Concurrent_Finalize_Same_Draft_Succeeds_Exactly_Once`) |
| Full `LaboratoryApi.Tests` | **291 passed** |
| Auth allowlist + reports permission tests | **3 passed** (alt output path; AuthService file lock on default bin) |
| Reports UI tests | **9 passed** |
| LMS FE regression (`src/app/dashboard/lms` + `src/lib/lms`) | **92 passed** |
| LaboratoryApi :7076 health after restart | Healthy |
| No Release / PDF / numbering / NotificationHub | Confirmed by scope + FE assertions |
| Source claims remain after Final | Unit-tested |
| ResultStatus unchanged on Finalize | Unit-tested |
| Audit failure fail-closed | Unit-tested |

---

## 2. Manual UAT checklist

Use an actor that already holds `lms.reports.view` / `manage` / `finalize` as available in the UAT environment. Do **not** add production role grants for this checklist.

1. Open `/dashboard/lms/reports`.  
2. Confirm a Draft Report exists (or create one from eligible ClinicallyAuthorized sources).  
3. Open the Draft.  
4. Confirm **Finalize Report** appears when the actor has `lms.reports.finalize`.  
5. Note current ReportVersion number.  
6. Click Finalize.  
7. Verify confirmation: freezes version; blocks further edits/append; does **not** Release; not patient-visible.  
8. Confirm Finalize.  
9. Verify Status = **Final**.  
10. Verify finalized actor (user id).  
11. Verify finalized timestamp.  
12. Verify ReportVersion number unchanged.  
13. Verify snapshot values unchanged.  
14. Return to Reports.  
15. Verify row shows **Final**.  
16. Open Final report.  
17. Verify Finalize action is no longer available.  
18. Verify append/edit unavailable (API reject if probed).  
19. Verify **no** Release button.  
20. Verify **no** PDF/download button.  
21. Refresh browser.  
22. Verify Final persists.  
23. Verify source Result still ClinicallyAuthorized (unchanged).  
24. Verify that ResultVersion remains unavailable as a new Draft source.  
25. If a no-finalize actor exists: confirm Finalize is not executable (403 / no action).  
26. Optional: concurrent/stale RowVersion → honest conflict + refresh.  
27. Confirm no patient publication.  
28. Confirm no notification emitted.

---

## 3. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| L-REP-02B Release | Not implemented |
| PDF / CanonicalDocument / numbering / download | Not implemented |
| ResultStatus / L-AUTH / L-VER / L-TST / L-CRT | Unchanged |
| Pathology | Unchanged |
| Role grants | None added |
| L-REP-01 Draft + uniqueness | Preserved |

---

## 4. Status

```text
IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT
```

Do **not** claim `MANUAL_UAT_PASSED` or `ACCEPTED`.  
Do **not** start L-REP-02B.

**Next gate:** Manual UAT.
