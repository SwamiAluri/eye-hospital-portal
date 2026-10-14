# L-COL-01C — Final UAT UI Corrections Report

**STATUS:** `FINAL_UAT_UI_CORRECTIONS_COMPLETE_READY_FOR_RETEST`

**Do not claim L-COL-01C acceptance.** Next gate: **MANUAL UAT RETEST**, then Product Owner acceptance.

---

## 1. Branch display

**Finding:** Specimen detail rendered raw `collectionBranchId`. Collection workbench already resolved GUID → name via `useBranchContext`.

**Correction:** `SpecimenDetailView` reuses `useBranchContext` and shows `branchName` when available; falls back to GUID.

## 2. Collector display

**Finding:** Specimen API exposes only `collectedByUserId`. LMS Collection detail already shows assign/claim as identifiers. Order provider picker uses `usersApi.getAll()` (staff directory) — out of scope for Specimen read UI and not an LMS collector display contract.

**Correction / limitation:** **No change.** Collector remains the stored UserId. **Non-blocking UX limitation** until a product-approved LMS-safe display-name projection exists (no new staff service/API in this pass).

## 3. Navigation active-state

**Finding:** LMS Overview has `exact: true`, but Sidebar render paths called `isActive(item.href)` without `item.exact`, so `/dashboard/lms` prefix-matched Specimens routes and highlighted Overview + Specimens.

**Correction:** Render paths pass `item.exact`; matching extracted to `isSidebarNavActive`. On `/dashboard/lms/specimens` and `/dashboard/lms/specimens/{id}`, only Specimens is active.

## 4. Specimens landing page

**Decision:** Leave unchanged. Copy accurately describes L-COL-01C (Complete Collection creates Specimens; no Receiving work queue).

## 5. Files changed

- `apps/hospital-portal-web/src/components/lms/specimens/SpecimenDetailView.tsx`
- `apps/hospital-portal-web/src/components/Sidebar.tsx`
- `apps/hospital-portal-web/src/lib/navigation/is-sidebar-nav-active.ts` *(new)*
- `apps/hospital-portal-web/src/lib/navigation/is-sidebar-nav-active.test.ts` *(new)*
- `apps/hospital-portal-web/src/app/dashboard/lms/specimens/enterprise-lms-specimen-ui.test.ts`
- `apps/hospital-portal-web/src/app/dashboard/lms/enterprise-lms-l0-foundation.test.ts`
- `docs/laboratory-management/enterprise-lms-specimen-foundation-final-uat-ui-corrections-report.md` *(this report)*

## 6. Tests

| Suite | Result |
| --- | --- |
| `is-sidebar-nav-active.test.ts` | 2 passed |
| `enterprise-lms-specimen-ui.test.ts` | 8 passed |
| `enterprise-lms-collection-ui.test.ts` | 11 passed |
| `enterprise-lms-l0-foundation.test.ts` | 14 passed |
| **Total** | **35 passed / 0 failed** |

## 7. Business rules

No CollectionTask / Order / OrderTest / Specimen state, authorization, idempotency, concurrency, audit, tenant, or permission/role changes.

## 8. Later LMS slices

None implemented (no Receiving, accession, barcode, labels, custody, testing, results, billing, etc.).
