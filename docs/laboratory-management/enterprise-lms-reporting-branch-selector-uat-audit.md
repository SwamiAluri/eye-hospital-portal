# L-REP-01 — Reports Branch Selector UAT Audit

**Date:** 2026-10-12  
**Mode:** AUDIT ONLY (no code changes in this document)  
**Blocker:** Manual UAT — `/dashboard/lms/reports` operating-branch selector shows only “Select branch”

---

## 1. Observed symptom

- Reports page loads; LaboratoryApi / AuthService healthy; migration applied; ClinicallyAuthorized ResultVersions exist.
- Header shows Site: Downtown Hospital / Admin user.
- Operating branch Select has **no authorized branch options** — only the placeholder “Select branch”.
- Without a branch ID, Reports list and eligible-sources APIs are not called usefully.

---

## 2. Actual root cause

Two compounding defects in `ReportsWorkbench` relative to the authoritative `useBranchContext` contract:

### 2.0 Wrong assignment field names (empty/invalid options)

`ReportsWorkbench` rendered:

```tsx
branches.map((b) => (
  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
))
```

`UserBranchAssignment` fields are **`branchId` / `branchName`** (not `id` / `name`). Working Testing/Orders selectors use `b.branchId` / `b.branchName`. Invalid values produce a selector with no usable options even when `/user-branches/me` returns rows.

### 2.1 Wrong context property (selection sync bug)

`useBranchContext()` returns **`branchId`** (effective authorized/home branch), **not** `selectedBranchId`.

```ts
// hooks/use-branch-context.ts return
{ branchId, branches, branchName, selectBranch, isLoading, isReady, error, ... }
```

Reports (copied from Testing/Critical workbench shape) does:

```ts
const { branches, selectedBranchId } = useBranchContext(); // selectedBranchId === undefined
const [branchId, setBranchId] = useState(selectedBranchId || 'none'); // always 'none' initially
```

So the local selector never initializes from the platform effective branch, even when AuthStore / `user.branchId` / default assignment have resolved one.

### 2.2 Missing empty-assignment fallback for options (empty dropdown)

Options are rendered only from `branches.map(...)`.

`branches` comes solely from `GET /user-branches/me`. Admin (and some roles) may have:

- Header “Site” / home branch via `user.branchId` / store, and
- **empty** `user-branches/me` assignment list.

Working Orders UI already handles this:

```tsx
// OrdersWorkbench
const { branchId, branches } = useBranchContext();
// ...
{branchId ? <SelectItem value={branchId}>Current branch</SelectItem> : null}
{branches.map(...)}
```

Reports never adds a SelectItem for the effective `branchId` when it is absent from `branches`, so the dropdown stays empty.

**No new branch model is required.** Platform `/user-branches/me` + `useBranchContext` remain SoT.

---

## 3. Existing working branch pattern

| Surface | Pattern |
|---|---|
| **Authoritative source** | `userBranchesApi.getMyBranches()` → `GET /user-branches/me` |
| **Hook** | `useBranchContext` — never `GET /branches/{id}` for names |
| **Orders** | Destructures `branchId` + `branches`; includes “Current branch” when `branchId` set |
| **Collection / Specimens / Composer** | Destructures `branchId` / `branches` / `branchName` |
| **Names** | `UserBranchAssignment.branchName` from `/user-branches/me` only |

---

## 4. Why Reports diverged

L-REP-01 UI was patterned after Testing/Critical workbenches, which also incorrectly destructure `selectedBranchId` (same latent defect). Orders (and Specimens detail) use the correct `branchId` API.

Reports additionally requires an explicit operating branch before any load (unlike Orders’ “All branches”), so the empty options + stuck `'none'` selection fully blocks UAT.

---

## 5. Exact minimal correction

In `ReportsWorkbench` only:

1. Destructure `branchId` (context), `branches`, `branchName`, `isLoading`, `error`, `selectBranch` from `useBranchContext`.
2. Initialize / sync local selector from context `branchId` (same intent as other LMS pages that auto-pick the platform current branch).
3. When rendering options: if context `branchId` is set and not present in `branches`, add a SelectItem using `branchName` or “Current branch” (Orders pattern) — **no hard-coded Downtown Hospital / GUID**.
4. On user change, update local state and call `selectBranch` so global/localStorage context stays consistent.
5. Surface honest loading / error when branch query fails or no effective branch exists.

Do **not** change Report domain, APIs, permissions, ResultStatus, or other LMS modules in this correction (Testing/Critical same latent bug is out of scope unless required — Reports-only fix).

---

## 6. Confirmation

| Question | Answer |
|---|---|
| New LMS branch hierarchy? | **No** |
| New `/api/lms/branches`? | **No** |
| `GET /branches/{id}` for names? | **No** |
| Hard-code site/branch? | **No** |
| Bypass server branch authz? | **No** |

---

## 7. Audit stamp

```text
L_REP_01_BRANCH_SELECTOR_UAT_AUDIT_COMPLETE
ROOT_CAUSE_WRONG_CONTEXT_PROPERTY_AND_MISSING_CURRENT_BRANCH_OPTION
READY_FOR_MINIMAL_CORRECTION
```
