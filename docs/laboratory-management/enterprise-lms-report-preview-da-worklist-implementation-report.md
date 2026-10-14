# L-REP-03 CUT D-A — Worklist Preview Extension  
# Implementation Report

**Date:** 2026-10-13  
**Slice:** L-REP-03 CUT D-A (extension) — Reports worklist Official PDF Preview  
**Mode:** BOUNDED IMPLEMENTATION REPORT  

---

## 1. Scope

Extend D-A so eligible Enterprise LMS Reports **worklist** rows expose:

`Open | Preview | Download`

Reuse the shared `ReportOfficialPdfPreview` component already used on Report Detail.  
**D-B (Patient 360) not started.**

---

## 2. Files changed

| File | Change |
| --- | --- |
| `apps/hospital-portal-web/src/components/lms/reports/ReportOfficialPdfPreview.tsx` | Shared preview: calls `downloadLmsOfficialPdf` internally; `button` \| `link` trigger variants |
| `apps/hospital-portal-web/src/components/lms/reports/ReportsWorkbench.tsx` | Preview on eligible rows beside Open / Download |
| `apps/hospital-portal-web/src/components/lms/reports/ReportDetailView.tsx` | Pass `reportId` + `operatingBranchId` into shared preview (behavior preserved) |
| `apps/hospital-portal-web/src/components/lms/reports/ReportOfficialPdfPreview.test.tsx` | Worklist + shared lifecycle assertions |
| `apps/hospital-portal-web/src/lib/lms/enterprise-lms-reports-ui.test.ts` | Worklist Preview wiring assertions |

Unchanged by this extension: eligibility helper + its tests (still used by Report Detail).

---

## 3. Behavior

### Worklist

- Preview shown only when `canDownload` (`lms.reports.download`) **and** server-projected `officialPdfDownloadEligible` **and** `businessReportNumber` **and** valid branch.
- Trigger label: **Preview** (link style matching Open/Download).
- Loads PDF via existing `downloadLmsOfficialPdf({ reportId, operatingBranchId })`.
- Dialog / iframe / loading / error / object-URL revoke / stale-cancel unchanged from shared component.

### Report Detail

- Still shows **Preview Official PDF** + **Download Official PDF** when `isLmsOfficialPdfPreviewEligible(detail)`.
- Same shared component and download client.

### Eligibility / authorization

| Layer | Behavior |
| --- | --- |
| Worklist UX | `officialPdfDownloadEligible` (server projection) |
| Detail UX | `isLmsOfficialPdfPreviewEligible` (Released + number + Succeeded current artifact) |
| Authority | CUT C Download endpoint remains authoritative (permission, tenant, branch equality, current artifact, fail-closed `DOWNLOAD_OFFICIAL_PDF`) |

---

## 4. Automated tests

```text
npx vitest run src/lib/lms/lms-official-pdf-preview-eligibility.test.ts `
  src/lib/lms/enterprise-lms-reports-ui.test.ts `
  src/components/lms/reports/ReportOfficialPdfPreview.test.tsx
```

| Result | Value |
| --- | --- |
| Test files | **3 passed** |
| Tests | **22 passed / 0 failed** |
| Suites | eligibility (6), ReportOfficialPdfPreview (4), enterprise-lms-reports-ui (12) |

---

## 5. Scope verification

| Area | Status |
| --- | --- |
| CUT C Download backend / contract | **Unchanged** |
| Backend APIs / schema / migrations | **None** |
| Permissions / role grants | **None** |
| Patient 360 / D-B | **Untouched** |
| Pathology / Patient Portal | **Untouched** |
| PDF generation / Release / Number | **Untouched** |

---

## 6. Limitations

- Manual UAT not executed by this task.
- Worklist Preview UX visibility uses server `officialPdfDownloadEligible`; hiding the button is not authorization.
- No new backend Option B path (D-B later); worklist continues to use existing CUT C branch query context.

---

## 7. Manual UAT scenarios

1. Worklist: eligible Released row shows Open | Preview | Download.  
2. Worklist Preview renders correct Official PDF.  
3. Close/reopen Preview — no stale content.  
4. Open same report — Report Detail Preview still works.  
5. Compare worklist Preview, Detail Preview, and Download.  
6. Draft/ineligible rows keep existing actions (no invalid Preview).  
7. Unauthorized-branch account cannot retrieve PDF.  
8. No public/SAS URL.  
9. Preview does not change report status, current artifact, or Report Number.

---

## 8. Status stamps

```text
D_A_WORKLIST_PREVIEW_IMPLEMENTATION = COMPLETE
AUTOMATED_TESTS_PASSED = 22/22
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
D_B_NOT_STARTED
CUT_C_UNCHANGED
NEXT_GATE = MANUAL_UAT
```

Do **not** stamp `ACCEPTED_L_REP_03_CUT_D` or whole-CUT-D acceptance from this extension alone.
