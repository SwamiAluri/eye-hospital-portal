# L-CAT-01B — UAT-02 Minimal Detail Route Fix Report

**Date:** 2026-10-08  
**Diagnostic SoT:** `enterprise-lms-catalogue-uat-02-failure-diagnostic.md`  
**Scope:** Bounded frontend route correction only  

## Final implementation status

**FIXED — READY FOR MANUAL UAT RESUME (detail-route gate)**

Automated tests passed. Manual lifecycle UAT was **not** continued.

---

## 1. Root cause

After successful `POST /api/lms/catalogue`, navigation to  
`/dashboard/lms/configuration/test-catalogue/[id]` rendered a client page that called React `use(params)` with a plain Next.js **14.2.18** params object, throwing:

`An unsupported type was passed to use(): [object Object]`

Create persistence was already correct; only detail-route params handling was defective.

---

## 2. Exact file changed

| Path | Change |
|---|---|
| `apps/hospital-portal-web/src/app/dashboard/lms/configuration/test-catalogue/[id]/page.tsx` | Sync params fix |
| `apps/hospital-portal-web/src/app/dashboard/lms/configuration/test-catalogue/enterprise-lms-catalogue.test.ts` | Source regression assertion |
| `apps/hospital-portal-web/src/app/dashboard/lms/configuration/test-catalogue/[id]/page.test.tsx` | **Added** render regression test |
| `docs/laboratory-management/enterprise-lms-catalogue-uat-02-fix-report.md` | This report |

No backend, API, schema, lifecycle, permission, AuthService, audit, workbench, or detail-view logic files were modified.

---

## 3. Exact correction

Before:

```tsx
'use client';
import { use } from 'react';
import { CatalogueDetailView } from '@/components/lms/catalogue/CatalogueDetailView';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CatalogueDetailView itemId={id} />;
}
```

After:

```tsx
'use client';

import { CatalogueDetailView } from '@/components/lms/catalogue/CatalogueDetailView';

export default function Page({ params }: { params: { id: string } }) {
  return <CatalogueDetailView itemId={params.id} />;
}
```

---

## 4. Tests executed

1. `enterprise-lms-catalogue.test.ts` (includes new source assertion against `use(params)`)
2. `[id]/page.test.tsx` (new — plain `{ params: { id } }` → `CatalogueDetailView` receives string `itemId`)
3. `enterprise-lms-l0-foundation.test.ts`
4. `laboratory-service.api.test.ts`

Command:

```bash
npx vitest run \
  src/app/dashboard/lms/configuration/test-catalogue/enterprise-lms-catalogue.test.ts \
  src/app/dashboard/lms/configuration/test-catalogue/[id]/page.test.tsx \
  src/app/dashboard/lms/enterprise-lms-l0-foundation.test.ts \
  src/lib/api/laboratory-service.api.test.ts
```

Reconfirm (catalogue detail tests only): same suite subset, 6/6.

---

## 5. Test results

| Suite | Result |
|---|---|
| LMS catalogue + L0 + lab API client (combined) | **22/22 passed** |
| Catalogue detail route + source regressions (reconfirm) | **6/6 passed** |
| Lint on changed `page.tsx` | Clean |
| Full-project `tsc --noEmit` | Pre-existing unrelated errors in `WaitingListFilterToolbar.tsx` (not in this change set); no errors reported for the catalogue detail page |

---

## 6. Regression checks

| Check | Result |
|---|---|
| Test Catalogue list HTTP smoke | **200**; no “Something went wrong”; no `use()` unsupported-type text |
| Detail URL for `f7dd25b6-7aba-4da8-a5b4-1ef09d6bac08` HTTP smoke | **200**; no “Something went wrong”; no `use()` unsupported-type text |
| `UAT-TEST-001` DB integrity | **1 item**, **1 version**, status **Draft**, version **1** |
| Duplicate catalogue item created | **No** |
| Database migration | **None** |
| API / LaboratoryApi / AuthService changes | **None** |
| Pathology `/dashboard/laboratory` tree | Untouched (`src/app/dashboard/laboratory` still present; not modified) |

Note: unauthenticated browser sessions may still redirect to login/unauthorized for LMS gates; the prior crash signature (`use(params)` / “Something went wrong” from that defect) was not observed in the smoke HTML.

---

## 7. Confirmation — no backend / API / schema / lifecycle / permission changes

| Area | Changed? |
|---|---|
| CatalogueService / CatalogueFunctions | No |
| LaboratoryApi contracts | No |
| EF / schema / migrations | No |
| Lifecycle / versioning / effective dating | No |
| Permissions / AuthService / audit | No |
| CreateDraftDialog / CatalogueWorkbench / CatalogueDetailView | No |
| Error boundary | No |
| Next.js / React versions | No |

---

## 8. Manual UAT step to resume

**Resume point:** open existing Draft detail (do **not** create another item first).

1. Sign in with an account that can access LMS catalogue (Admin `*` or explicit `lms.view` + `lms.catalogue.view`).
2. Open:

   `/dashboard/lms/configuration/test-catalogue/f7dd25b6-7aba-4da8-a5b4-1ef09d6bac08`

   Expected: detail renders for **UAT-TEST-001** / Draft / v1 — no “Something went wrong”.
3. Confirm list still shows **UAT-TEST-001**.
4. Only after detail opens successfully, continue remaining Manual UAT steps (submit/approve/activate as per UAT script) under a separately reopened UAT gate.

**Do not** auto-submit / approve / activate in this fix task.

---

## STOP

- Automated tests passed → implementation complete  
- Manual UAT **not** continued  
- `UAT-TEST-001` not submitted / approved / activated  
- UAT-03 not started  
- L-ORD-01 not started  

Manual UAT gate reopens separately after review of this report.
