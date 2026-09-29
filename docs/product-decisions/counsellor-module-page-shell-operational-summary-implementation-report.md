# Counsellor Page Composition Alignment — Sessions Header Correction

| Field | Value |
|-------|--------|
| **Package** | Counsellor Page Composition Alignment — Sessions header / state selector correction |
| **Prior implementation** | The in-content identity header plus a standalone Reassignment Required band failed browser UAT |
| **Date** | 2026-09-25 |
| **Manual UAT** | **NOT PERFORMED** for this correction |
| **Acceptance** | **NOT RECORDED** |

This report is not acceptance.

---

## Exact files changed

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/sessions-page-composition.contract.test.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/sessions-cgx1.contract.test.ts` (content-title assertion replaced by an assertion that the duplicate content heading is absent; MRN, Eye, Decision, Open, Reassign, and paging assertions kept)
- `apps/hospital-portal-web/src/lib/counsellors-desk/sessions-pagination.contract.test.ts` (content back control and heading count assertions updated; paging footer, page size, and `?page=` assertions kept)

## Exact UI structure changed

Removed the content identity block: back control, `<h1>` Counselling Sessions, and the `{totalCount} sessions` heading line.

The page content now starts with one compact state selector, using the existing pill tab classes:

1. **Counselling Sessions** — selected when Reassignment Required is off. This is the default. Choosing it calls the existing `setReassignmentRequired(false)`.
2. **Reassignment Required** — the existing filter control (`data-testid="reassignment-required-filter"`, `aria-pressed`). Choosing it calls the existing `setReassignmentRequired(true)`, which still writes the existing URL parameter and resets the page to 1.

The selector sits above drill-down chips and the existing worklist. There is no second page heading, no standalone Reassignment Required band, and no content-level session-count heading.

The pagination footer still shows the existing range and `totalCount`. That is the paging contract, not a new summary.

The staff chrome title is still **Counselling Sessions**. `TopNav` and `resolve-staff-page-title.ts` were not edited.

## Untouched

Waiting List, Finalize Surgery, OT Preparation, Follow-up Center, Analytics, global header, TopNav, `sessions-list-presentation.tsx`, APIs, DTOs, database, permissions, ownership, routes, and workflow / FSM.

MRN, Eye under Surgery, Decision, Open, contextual Reassign, page size 20, server paging, `?page=`, loading, empty, and error copy are unchanged.

## API / DTO / database / permissions / ownership / workflow

None.

## Automated tests

From `apps/hospital-portal-web`:

```
npx vitest run src/lib/counsellors-desk/sessions-page-composition.contract.test.ts src/lib/counsellors-desk/sessions-list-presentation.test.tsx src/lib/counsellors-desk/sessions-cgx1.contract.test.ts src/lib/counsellors-desk/sessions-pagination.contract.test.ts src/lib/counsellors-desk/sessions-package-b.contract.test.ts src/lib/counsellors-desk/sessions-package-b-ux.contract.test.ts src/lib/counsellors-desk/sessions-pagination.test.ts src/lib/counsellors-desk/sessions-rr-reassign.test.ts src/lib/counsellors-desk/reassignment-required-filter.test.ts src/lib/navigation/resolve-staff-page-title.test.ts
```

**54 passed / 0 failed / 0 skipped** (10 files).

## Known limitations

- This correction has not been checked in the browser. The previous composition failed that review; this change replaces it.
- The visible page name is the staff chrome title. The content selector repeats the words **Counselling Sessions** as the default state, not as a page heading.
- Choosing the already selected state does not flip the filter. Returning from Reassignment Required is the **Counselling Sessions** control.
- The list total is no longer shown beside a content heading. It remains in the pagination footer when the list has rows.

## Manual UAT

**NOT PERFORMED**

## Acceptance

**NOT RECORDED**

IMPLEMENTATION COMPLETE — AUTOMATED TESTS COMPLETE — STOP FOR MANUAL UAT
