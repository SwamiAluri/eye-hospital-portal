# L-REP-01 — Draft Report Source Uniqueness Pre-UAT Verification

**Date:** 2026-10-12  
**Decision:** PD-REP-DRAFT-UNIQUE-01  
**Final status:** `DRAFT_REPORT_SOURCE_UNIQUENESS_CORRECTION_COMPLETE_READY_FOR_PRE_UAT`

---

## 1. Root cause (closed)

No Draft exclusivity on ResultVersion. Eligible-sources returned all ClinicallyAuthorized Results. Create Draft accepted any distinct idempotency key.

---

## 2. Correction summary

- Claim table `lms_report_draft_source_claims` with unique `(tenant_id, result_version_id)`
- Create/append enforce claims; conflict `409 report_source_already_in_draft`
- Eligible-sources excludes claimed ResultVersions
- UI reloads eligibility; honest 409 message
- Existing duplicate UAT Drafts not deleted; backfill assigns claim to oldest Draft

---

## 3. Migration

| Migration | Purpose |
| --- | --- |
| `20261012180000_AddLmsReportDraftSourceClaims` | Claims table + unique + non-destructive backfill |

Applied via LaboratoryApi `Database.MigrateAsync` (Postgres concurrency test / EF list shows migration present; not Pending).

---

## 4. Tests executed

| Suite | Result |
| --- | --- |
| `ReportServiceTests` (incl. uniqueness, eligible exclude, append same RV, audit fail-closed) | Passed |
| `ReportPostgresConcurrencyTests` (6 concurrent creates, different idempotency keys, same ResultVersion) | Passed — exactly one Draft; others `report_source_already_in_draft` |
| Full `LaboratoryApi.Tests` | **286 passed** |
| `enterprise-lms-reports-ui.test.ts` | **8 passed** |
| LMS FE (`src/app/dashboard/lms` + `src/lib/lms`) | **91 passed** |
| AuthService | Not changed — not re-run |
| LaboratoryApi restarted on :7076 after build | Healthy |
| UAT DB `lms_report_draft_source_claims` | Present (backfill count observed: 2) |

---

## 5. Existing duplicate UAT data (manual recommendation)

Do **not** auto-delete production or UAT rows from this correction.

For Manual UAT clarity only (UAT DB, operator-approved):

1. Identify ResultVersions with multiple Draft Reports (sources share `result_version_id`).
2. The oldest Draft retains the claim after migration backfill.
3. Newer duplicate Drafts remain visible but cannot claim that ResultVersion again.
4. Optional later UAT cleanup: archive/delete orphan duplicate Drafts **only** after operator confirmation. Never against production as part of this task.

---

## 6. Manual UAT checklist (operator)

1. Create first Draft from ResultVersion A.  
2. Return to eligible sources — A must not be selectable.  
3. Attempt duplicate create (different idempotency key) — expect 409 `report_source_already_in_draft`.  
4. Create Draft with multiple compatible ResultVersions from same order — one Report, multiple Sources.  
5. Confirm unrelated Orders cannot be combined.  
6. Open existing Draft — exact ResultVersion provenance + immutable snapshot.  
7. Refresh Reports — state remains correct.  
8. Append path (if exercised): same ResultVersion on same Draft still allowed.

---

## 7. Confirmations

| Check | Result |
| --- | --- |
| No Finalize/Release/PDF/publication | Confirmed |
| No permissions/roles granted | Confirmed |
| No ResultStatus / L-AUTH / L-VER / L-TST / L-CRT changes | Confirmed |
| No Report lifecycle expansion beyond Draft uniqueness | Confirmed |
| Multi-result composition preserved | Confirmed |
| Idempotency preserved | Confirmed |
| Concurrent PG exclusivity evidenced | Confirmed |

---

## 8. Status

**DRAFT_REPORT_SOURCE_UNIQUENESS_CORRECTION_COMPLETE_READY_FOR_PRE_UAT**

Do **not** claim `MANUAL_UAT_PASSED` or `ACCEPTED` from this correction alone.  
Do **not** start Finalize/Release discovery or implementation.
