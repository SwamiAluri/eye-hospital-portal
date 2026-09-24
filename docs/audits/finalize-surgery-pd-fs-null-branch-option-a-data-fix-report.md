# Finalize Surgery — PD-FS-NULL-BRANCH Option A Data Fix Report

**Date:** 2026-09-20  
**Decision:** PD-FS-NULL-BRANCH — Option A (approved)  
**Mode:** Data correction only — no application behavior change  
**UAT gate:** READY FOR MANUAL UAT (not accepted)

---

## 1. Decision Applied

Apply the certified Slice 9 backfill of `ot_finalize_schedule.branch_id` from linked `counseling_sessions.branch_id` for healable rows only.

Preserved (unchanged):

- Fail-closed list predicate: `BranchId != null && accessibleBranches.Contains(BranchId)`
- Slice 9 writer / mutation-time heal behavior
- Branch authorization strength
- Date semantics
- Ownership / Waiting List / Phase 3I Slices 1–9 product rules
- No Slice 10
- No empty-state / cache UX work

---

## 2. Root Cause Recap

Empty Finalize Surgery with Date cleared was **category G**: all active OT rows had `NULL BranchId`, so Slice 9 list filtering returned `[]` even though schedules existed.

---

## 3. Data Correction Executed

**SQL (identical to `BackfillOtFinalizeScheduleBranchId.Up`):**

```sql
UPDATE ot_finalize_schedule ofs
SET branch_id = cs.branch_id
FROM counseling_sessions cs
WHERE ofs.counselling_session_id = cs.id
  AND ofs.tenant_id = cs.tenant_id
  AND ofs.branch_id IS NULL
  AND cs.branch_id IS NOT NULL;
```

| Metric | Before | After |
|---|---|---|
| Active OT rows | 22 | 22 |
| Active with `BranchId` | 0 | **21** |
| Active `NULL BranchId` | 22 | **1** |
| Remaining healable | 21 | **0** |
| Remaining unhealable (no session branch) | 1 | **1** (still excluded) |
| Rows updated | — | **21** |

**EF history:** inserted `20260918220000_BackfillOtFinalizeScheduleBranchId` / `8.0.0` (idempotent `WHERE NOT EXISTS`).

**Traced schedule** `cab9772c-…`: `BranchId` now `74c014cf-…` (Downtown), status `NotConfirmed`.

Artifact script: `artifacts/apply-backfill-ot-finalize-branchid.sql`.

---

## 4. Branch Isolation Verification (post-backfill)

| Authorized scope | Simulated list count (`BranchId != null` + branch match) |
|---|---|
| Downtown `74c014cf-…` | **21** |
| Banjara Hills `9b2f6670-…` | **0** |

All 21 backfilled rows map to Downtown. Banjara-only actors still correctly see zero Downtown schedules. The single NULL-branch row remains excluded by the fail-closed predicate.

---

## 5. Application Code Changes

**None for this Option A execution.**  
No date, ownership, Waiting List, list-predicate, or UX changes.

---

## 6. Tests Executed

| Suite | Result | Notes |
|---|---|---|
| FE FS-01 + FS-02 (`save-counselling-session.fs01.test.ts`, `prepare-ot-date-scope.test.ts`) | **PASS 23/23** | |
| BE FS-02 (`OtFinalizePrepareOtDateScope`) | **PASS 9/9** | |
| BE `Phase3ISlice9FinalizeOwnershipBoundary` | **PASS 11/11** | Branch isolation / ownership boundary |
| BE `Phase3ISlice9ContractTests` (subset in prior run) | **3 FAIL — PRE-EXISTING / UNRELATED** | `DirectoryNotFoundException` resolving source paths when `OutputPath` was polluted; not caused by backfill data |

---

## 7. Regression / Scope Confirmation

- Phase 3I Slices 1–9 product rules: not modified  
- Ownership: unchanged  
- Waiting List: unchanged  
- Date semantics: unchanged  
- Branch authorization: **not weakened**  
- Slice 10: **not started**  
- Unhealable NULL-branch row: **still excluded** (by design)

---

## 8. Manual UAT Checklist

1. Log in as a **Downtown-authorized** counsellor/admin.  
2. Open `/dashboard/counsellors-desk/finalize-surgery` with **Date cleared**.  
3. Expect non-zero Scheduled / queue rows (up to 21 active Downtown schedules).  
4. Confirm traced/NotConfirmed cases appear under appropriate status tabs.  
5. Select an explicit surgery date → only that date’s rows.  
6. Clear date → active queue discoverable again.  
7. As a **Banjara-only** user (e.g. Emma): Finalize Surgery remains empty for Downtown-only data (isolation).  
8. Confirm Waiting List Completed/Done behavior unchanged.  
9. Confirm no CounselorId ownership on Finalize Surgery.  
10. Confirm the one unlinked NULL-branch OT row still does not appear.

---

## 9. UAT Gate

**READY FOR MANUAL UAT**

Do **not** mark Accepted until human UAT completes and explicitly accepts.
