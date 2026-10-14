# L-CAT-01B — UAT-02 Post-Create Failure Diagnostic

**Date:** 2026-10-08  
**Mode:** Diagnostic only — no code, schema, permission, lifecycle, or data mutations  
**Record under investigation:** `UAT-TEST-001`  
**New catalogue records created during diagnostic:** None  

## Final status

**FIX_REQUIRED_BEFORE_UAT_CONTINUES**

## Root cause category

**B. FRONTEND_ROUTE/DETAIL_RENDER_DEFECT**

POST create **succeeded** and persisted correctly. After navigation to the catalogue detail route, the client page calls React `use(params)` with a plain object (Next.js 14.2.18 App Router client `params` shape). That throws:

`An unsupported type was passed to use(): [object Object]`

which is caught by the app error UI (`Something went wrong`).

This is **not** a backend create failure and **not** an API contract mismatch for the create response.

---

## 1. Exact POST request

Not re-issued during this diagnostic (to avoid creating another persistent catalogue row).

UAT-02 request as executed by the operator / UI:

| Field | Value |
|---|---|
| Method | `POST` |
| URL | `/api/lms/catalogue` → `http://localhost:7076/api/lms/catalogue` |
| Client | `createLmsCatalogueDraft()` in `laboratory-service.api.ts` |
| Body (UAT input) | `catalogueType: TEST`, `internalOrderCode: UAT-TEST-001`, `displayName: UAT Test 001`, `discipline: MOLECULAR_DIAGNOSTICS` (UI label “Molecular Diagnostics”), `changeReason: Initial UAT catalogue draft` |

Source call site: `CatalogueWorkbench.tsx` → `CreateDraftDialog.submit()`.

---

## 2. Exact POST response

### Verdict: **CREATE_SUCCESS**

Live Network capture of the UAT click was not re-run here. Success is established from **persistence + UI list after refresh**, which cannot occur without a successful create path.

Backend contract for create (`CatalogueFunctions.Create` → `CreatedJsonAsync`):

| Field | Expected |
|---|---|
| HTTP status | **201 Created** |
| Body shape | `CatalogueItemDetailDto` (camelCase JSON) |
| Top-level id | Catalogue **item** id (`id`) |
| Version | Nested `currentVersion` / `latestVersionId` / `versionHistory` |
| Location header | **Not set** by `CreatedJsonAsync` (body-only 201) |

Frontend consumption after success:

```ts
const created = await createLmsCatalogueDraft(body);
onCreated(created.id); // string catalogue item id
```

Persisted identity matching that response shape:

| Field | Value |
|---|---|
| Catalogue item id | `f7dd25b6-7aba-4da8-a5b4-1ef09d6bac08` |
| Latest / v1 version id | `f544af89-1894-49de-afa0-d1ee5aadb375` |
| Tenant | `155fe198-6ae5-4a01-9254-ead5b427247e` |

Correlation / request ID: not available without the original Network HAR.

---

## 3. Persisted record verification (read-only)

Azure `hospitalportal` query for `internal_order_code = 'UAT-TEST-001'`:

| Check | Result |
|---|---|
| CatalogueItem count | **1** (`f7dd25b6-7aba-4da8-a5b4-1ef09d6bac08`) |
| Version count | **1** (v1) |
| Type | `TEST` |
| Status | `Draft` |
| Code | `UAT-TEST-001` |
| Display name | `UAT Test 001` |
| Discipline | `MOLECULAR_DIAGNOSTICS` |
| Classification | `LOCAL` |
| Tenant | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Current active version | `null` (expected for Draft) |
| Soft-deleted | `false` |
| Branch applicability rows | **0** → tenant-wide |
| Orphan versions | **0** |
| Duplicate versions | **None** |

Matches the refreshed list row observed in UAT.

---

## 4. Post-create frontend sequence

Confirmed sequence:

1. `CreateDraftDialog.submit()` sets `saving=true`
2. `POST /api/lms/catalogue` succeeds → `LmsCatalogueItemDetailDto`
3. `toast.success('Draft created')`
4. `onCreated(created.id)` with **string** item id
5. `router.push(\`/dashboard/lms/configuration/test-catalogue/${id}\`)`
6. Detail route client page mounts: `test-catalogue/[id]/page.tsx`
7. `use(params)` throws
8. App Router error UI renders “Something went wrong” + exception message

No evidence that create response object itself is passed into `router.push` (navigation argument is a string URL).

---

## 5. Browser console exception

UAT-facing message (also shown in error UI body):

```text
An unsupported type was passed to use(): [object Object]
```

App error shell (`apps/hospital-portal-web/src/app/error.tsx` / `global-error.tsx`) titles the page **Something went wrong** and surfaces `error.message`, which masks stack frames in the UI but logs `error` via `console.error(error)`.

Diagnostic session browser was on login (no authenticated session), so a fresh authenticated console dump was not re-captured. The throw site is confirmed from **compiled client chunk** (below).

---

## 6. React stack / throw site

### Source

`apps/hospital-portal-web/src/app/dashboard/lms/configuration/test-catalogue/[id]/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import { CatalogueDetailView } from '@/components/lms/catalogue/CatalogueDetailView';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CatalogueDetailView itemId={id} />;
}
```

### Compiled client bundle (runtime)

`.next/static/chunks/app/dashboard/lms/configuration/test-catalogue/[id]/page.js`:

```js
function Page(param) {
    let { params } = param;
    const { id } = (0,react__WEBPACK_IMPORTED_MODULE_1__.use)(params);
    return /* CatalogueDetailView */ { itemId: id };
}
```

**Exact failing call:** `react.use(params)` where `params` is a plain object `{ id: string }` under Next.js **14.2.18** client pages (not a Promise).

Repo comparison: other `[id]` client pages (e.g. specialty clinics) use sync `params: { id: string }` and read `params.id` **without** `use()`.

LMS catalogue frontend `use(` search: **only this detail page**.

Stack shape expected at runtime:

```text
Error: An unsupported type was passed to use(): [object Object]
    at Page (test-catalogue/[id]/page.tsx:7)
    … App Router client render …
    … error.tsx / global-error.tsx …
```

---

## 7. Catalogue route / navigation behavior

| Step | Value passed | Type |
|---|---|---|
| `created.id` from POST body | catalogue item GUID | `string` |
| `router.push(...)` | `/dashboard/lms/configuration/test-catalogue/{id}` | `string` URL |
| Detail `params` at render | `{ id: "<guid>" }` | **object** |
| `use(params)` input | that object | **unsupported for `use()`** |

Expected conceptual behavior: create → persist → open detail.  
Actual: create → persist → navigate → **detail page crash**.

List route `/dashboard/lms/configuration/test-catalogue` does not use `use(params)` and therefore can show the new row after refresh.

---

## 8. Response / state shape

| Layer | Shape | Match? |
|---|---|---|
| API create response | `CatalogueItemDetailDto` with top-level `id` (item) | Yes (FE type `LmsCatalogueItemDetailDto`) |
| FE after create | uses `created.id` string for navigation | Yes |
| Detail route typing | annotated as `Promise<{ id: string }>` + `use(params)` | **Incorrect for Next 14.2.18 client pages** |
| Detail view prop | `itemId: string` | Would be fine if `id` were obtained without `use(object)` |

No API contract change indicated. Defect is FE route params consumption.

Stack: Next **14.2.18**, React **18.2.0**. The page uses a Next 15-style async-params/`use(params)` pattern that is incompatible with this stack’s client `params` object.

---

## 9. Duplicate-submission risk

| Check | Current behavior |
|---|---|
| Save draft disabled while in flight | **Yes** — `disabled={saving}`; `saving` set true before await, cleared in `finally` |
| Double-click same in-flight request | Mitigated by disabled button |
| Success then detail crash | User lands on error screen; dialog submit path already completed |
| Retry create with same code | Backend `EnsureUniqueCodeAsync` rejects active duplicate codes with `duplicate_code` — **does not create a second Draft for `UAT-TEST-001`** |
| Residual risk | Operator confusion (“failed” UI despite persisted Draft); “Try again” on error boundary remounts the **same broken detail page** |

No fix applied in this diagnostic.

---

## 10. Root cause

**Catalogue detail client page incorrectly calls `use(params)` on a plain Next.js 14 params object after a successful create navigation.**

- Create persistence: healthy  
- Create response → id extraction → router string URL: healthy  
- Detail route render: **defective**

---

## 11. Evidence

1. DB: single item + single Draft v1 for `UAT-TEST-001` (integrity checks pass).  
2. UAT: list shows row after refresh; create UI toast path implies POST success.  
3. Source: only LMS `use(params)` at `test-catalogue/[id]/page.tsx:7`.  
4. Compiled chunk: `react.use(params)` immediately before `CatalogueDetailView`.  
5. UAT error text matches React `use()` unsupported-type error for `[object Object]`.  
6. Error UI copy matches `error.tsx` / `global-error.tsx` (“Something went wrong” + `error.message`).  
7. Peer routes in the same app use sync `params.id` without `use()`.

---

## 12. Whether code change is required

**Yes.**  
Without fixing the detail route, every successful create (and every direct navigation to `/test-catalogue/[id]`) will hit the error boundary. UAT-02/detail lifecycle steps cannot continue safely.

---

## 13. Smallest safe fix boundary (do not implement yet)

**Single file:**  
`apps/hospital-portal-web/src/app/dashboard/lms/configuration/test-catalogue/[id]/page.tsx`

Align with existing Next 14.2 client `[id]` pages:

- Type `params` as `{ id: string }` (not `Promise<...>`)
- Remove `use` from `react`
- Pass `params.id` into `CatalogueDetailView`

Out of scope for the fix:

- CatalogueService / CatalogueFunctions  
- API contracts  
- schema / permissions / lifecycle  
- create dialog / workbench (except optional tests)  
- error boundary weakening  

---

## 14. Tests that must be added after the fix

1. **Unit/source test** (extend `enterprise-lms-catalogue.test.ts`): detail page must **not** contain `use(params)` / `from 'react'` `use` for params; must read sync `params.id` (or equivalent Next 14-safe pattern).  
2. **Component/route smoke:** render detail page with plain `{ params: { id: '<guid>' } }` and assert it mounts `CatalogueDetailView` without throwing.  
3. **Manual UAT re-check (after fix gate):** open existing `UAT-TEST-001` detail URL; create is optional — prefer navigating to existing id `f7dd25b6-7aba-4da8-a5b4-1ef09d6bac08` before creating another draft.

---

## Decision

**FIX_REQUIRED_BEFORE_UAT_CONTINUES**

### STOP

- No code modified  
- `UAT-TEST-001` not deleted  
- No additional catalogue record created  
- UAT-03 not started  
- L-ORD-01 not started  
