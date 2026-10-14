# L-REP-01 — Reports Branch Selector UAT Correction

**Date:** 2026-10-12  
**Audit:** [enterprise-lms-reporting-branch-selector-uat-audit.md](./enterprise-lms-reporting-branch-selector-uat-audit.md)  
**Scope:** Manual UAT blocker — empty operating-branch selector on `/dashboard/lms/reports`

---

## 1. Root cause

1. **Wrong assignment fields:** `ReportsWorkbench` rendered `b.id` / `b.name`, but `UserBranchAssignment` exposes **`branchId` / `branchName`** (from `GET /user-branches/me`). Options were therefore blank/invalid even when the list loaded.
2. **Wrong context property:** Destructured non-existent `selectedBranchId` from `useBranchContext()` instead of **`branchId`** (effective platform branch).
3. **Missing Orders fallback:** When `/user-branches/me` is empty but Auth provides an effective `branchId` (common for Admin), Orders shows a “Current branch” option; Reports did not.

No new branch model was required.

---

## 2. Existing branch source reused

| Piece | Source |
|---|---|
| Hook | `useBranchContext` |
| API | `userBranchesApi.getMyBranches()` → `GET /user-branches/me` |
| Option shape | `branchId` + `branchName` |
| Empty-list fallback | Orders “Current branch” pattern via context `branchId` + `branchName` |
| Persistence | `selectBranch` → AuthStore + `selected_branch_id` localStorage |

Forbidden patterns not introduced: hard-coded Downtown Hospital / GUIDs, `GET /branches/{id}`, `/api/lms/branches`, Reports-specific branch master.

---

## 3. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/lms/reports/ReportsWorkbench.tsx` | Correct context + field names; current-branch option; loading/error/empty branch states; `selectBranch` on change |
| `apps/hospital-portal-web/src/lib/lms/enterprise-lms-reports-ui.test.ts` | Branch-selector contract tests |
| `docs/laboratory-management/enterprise-lms-reporting-branch-selector-uat-audit.md` | Audit |
| `docs/laboratory-management/enterprise-lms-reporting-branch-selector-uat-correction.md` | This record |

---

## 4. Exact correction

- Use `branchId: contextBranchId`, `branches`, `branchName`, `selectBranch`, loading/error from `useBranchContext`.
- Sync local selector from `contextBranchId`.
- Render `SelectItem` with `b.branchId` / `b.branchName`.
- If context branch not in assignment list → `SelectItem` with `branchName || 'Current branch'`.
- Honest `reports-branches-loading` / `reports-branches-error` / `reports-branches-empty` states.
- Pass selected `branchId` to Reports APIs unchanged.

---

## 5. Tests executed

| Suite | Result |
|---|---|
| `enterprise-lms-reports-ui.test.ts` | **7 passed** |
| Authorized Results UX regression | **8 passed** (paired run) |
| AuthService / LaboratoryApi | **Not changed** — not re-run for this FE-only fix |

---

## 6. Confirmations

| Check | Status |
|---|---|
| No product/business rule change to Report domain | **Yes** |
| No permissions/roles granted | **Yes** |
| No LmsReport / ResultStatus / L-AUTH/VER/TST/CRT changes | **Yes** |
| No Finalize/Release/PDF/publication | **Yes** |
| Manual UAT readiness (selector populates from platform context) | **Ready** |

---

## 7. Manual UAT expectation

1. Open `/dashboard/lms/reports`.
2. Operating branch shows authorized assignment names and/or “Current branch” / resolved `branchName` for the platform effective branch.
3. Selecting a branch loads Draft Reports + eligible ClinicallyAuthorized sources for that branch ID.
4. Server-side branch authorization remains enforced.

Do not claim MANUAL_UAT_PASSED or ACCEPTED from this correction alone.

---

## 8. Final status

```text
BRANCH_SELECTOR_CORRECTION_COMPLETE_READY_FOR_MANUAL_UAT
```
