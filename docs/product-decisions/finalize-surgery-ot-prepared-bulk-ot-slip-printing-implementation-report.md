# Finalize Surgery — OT Prepared
# Bulk OT Slip Printing & Print UX
# Engineering Implementation Report

| Field | Value |
|-------|--------|
| **Document type** | **ENGINEERING IMPLEMENTATION REPORT** |
| **Date** | 2026-09-24 |
| **Slice** | OT Prepared — Bulk OT Slip Printing & Print UX |
| **Product Decision** | OT Prepared Bulk OT Slip Printing & Print UX (approved bounded UX/print slice) |
| **Status** | **IMPLEMENTATION COMPLETE — AUTOMATED TESTS RUN — STOPPED BEFORE MANUAL UAT** |
| **Manual UAT** | **REQUIRED — NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |
| **Package C** | **NOT STARTED** |
| **C-LA-04** | **DEFERRED** |
| **Package B** | **UNCHANGED** (Prepared List print remains separate) |

---

## 1. Implementation status

```text
IMPLEMENTATION: COMPLETE
AUTOMATED TESTS: PASSED (Vitest 43 relevant; Playwright Chromium 13)
MANUAL UAT: REQUIRED — NOT EXECUTED
ACCEPTANCE: NOT RECORDED
PACKAGE C: NOT STARTED
C-LA-04: DEFERRED
```

---

## 2. Product Decision reference

**OT Prepared Bulk OT Slip Printing & Print UX** — bounded frontend/print presentation slice on:

Surgery Finalization → OT Prepared worklist

Does not reopen Package B, RESP2, Package LA, or Package C.

---

## 3. Pre-implementation audit

| Check | Result |
|-------|--------|
| Individual `printOtSlip` | Present on Finalization rows; same field set as OT Slip |
| OT Prepared worklist data | Existing `useFinalizeListQuery` / `mapOtRecord` rows — fields sufficient |
| Package B print | Separate helper `ot-preparation-prepared-list-print.ts` + OT Prep toolbar |
| New API needed? | **NO** — bulk uses already-loaded selected worklist records |
| DATA SOURCE INSUFFICIENT | **NOT APPLICABLE** |

---

## 4. Files changed (this slice)

| Path | Change |
|------|--------|
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-slip-print.ts` | **NEW** — shared single/bulk OT Slip HTML + `openOtSlipsPrint` |
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-slip-print.test.ts` | **NEW** — unit coverage |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | OT Prepared selection bar; row checkboxes; bulk Print OT Slips (N); row Print → shared helper |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/finalize-ot-prepared-bulk-print.test.tsx` | **NEW** — page/helper contracts |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/finalize-ot-prep-package-b-print.test.tsx` | Align printOtSlip contract with shared helper |
| `apps/hospital-portal-web/e2e/finalize-surgery-ot-prepared-bulk-print.spec.ts` | **NEW** — Playwright selection + bulk document + Package B separation |
| `docs/product-decisions/finalize-surgery-ot-prepared-bulk-ot-slip-printing-implementation-report.md` | **THIS REPORT** |

Pre-existing unrelated working-tree changes were **not** reverted.

---

## 5. Selection UX

On **OT Prepared** tab only:

- Individual row checkbox (`finalize-ot-prepared-select-{id}`)
- **Select all visible** — current page only (`selectAllVisibleOtPreparedIds(pagedRecords)`)
- **Clear selection**
- Selection count (`N selected`)
- Contextual **Print OT Slips** / **Print OT Slips (N)** — disabled when N = 0

Selection is reconciled with `reconcileSelectionToVisible` when page/filter changes. Leaving OT Prepared clears selection.

Non–OT Prepared tabs: no print checkboxes / no bulk bar (unchanged row layout).

---

## 6. Select All Visible semantics

```text
ALL VISIBLE ROWS ON THE CURRENT PAGE ONLY
```

Does **not** select other pages, filtered-out, or hidden rows. Same portal convention as RESP2 OT Prep (reuse reconcile helper; separate ID set).

---

## 7. Bulk print approach

- Print **only** selected records via `selectedOtPreparedRecordsInOrder(filtered, selectedIds)`
- `openOtSlipsPrint(selected)` → dedicated popup HTML
- **One patient = one OT Slip section = one printed page** (`page-break-after: always` / `break-after: page`)
- Unselected patients omitted from document

---

## 8. Individual print preservation

- Row **Print OT Slip** retained (`title` / `aria-label` / `finalize-ot-prepared-row-print-{id}`)
- Implementation now calls `openOtSlipsPrint([rec])` — same OT Slip field set, escaped HTML
- Behavior preserved for single-patient shortcut

---

## 9. Data source

| Item | Value |
|------|--------|
| Source | Existing Finalization OT Prepared worklist records (already loaded) |
| New API / endpoint / DTO / DB | **NONE** |
| Package B `getOtList` | **NOT used** by this slice |

---

## 10. Fields printed (existing OT Slip)

Patient Name, UHID, Surgery, Eye, Surgeon, Theatre, Surgery Date, Start Time, Reporting Time (via `formatCounsellingTimeDisplay`), Anesthesia, Package, Package Amount, Patient Type, Payment Mode, Status.

Only fields present on `FinalizeSurgeryRecord`; no invented values.

---

## 11. Chrome exclusion

Print document excludes sidebar, navigation, tabs, pagination, checkboxes, selection controls, Reopen, screen buttons, Package B Prepared List title.

---

## 12. Package B protection

- `ot-preparation-prepared-list-print.ts` semantics unchanged
- OT Prep **Print** → Prepared List remains separate
- Bulk OT Slips do **not** use Package B format or `getOtList`
- No restoration of duplicate OTPrepared grid on OT Prep

---

## 13. RESP2 / Package LA / Package C protection

| Area | Touched? |
|------|----------|
| Finalised worklist / Prepare / SequenceNo / same-date | **NO** |
| Reporting Time normalization / FinalizeOtModal / Cancel | **NO** |
| OTPrepared schedule-date edit / GuardLocked / FSM | **NO** |
| Permissions / ownership / routes / backend | **NO** |

---

## 14. API / backend / DB

```text
API / BACKEND / DB / MIGRATIONS: NONE
PERMISSIONS: NONE
FSM: NONE
OWNERSHIP: NONE
```

---

## 15. Automated tests — Vitest

```text
npx vitest run
  src/lib/counsellors-desk/ot-slip-print.test.ts
  src/app/dashboard/counsellors-desk/finalize-surgery/finalize-ot-prepared-bulk-print.test.tsx
  src/app/dashboard/counsellors-desk/finalize-surgery/finalize-ot-prep-package-b-print.test.tsx
  src/app/dashboard/counsellors-desk/finalize-surgery/finalize-ot-prep-resp2.test.tsx
  src/lib/counsellors-desk/ot-preparation-prepared-list-print.test.ts
  src/lib/counsellors-desk/ot-preparation-resp2.test.ts
```

**Result:** 6 files / **43 passed** (exit 0)

Covers: individual + bulk HTML, page breaks, selected-only, chrome exclusion, Package B separation, no new API client, RESP2 contracts.

---

## 16. Playwright — Chromium

```text
npx playwright test
  e2e/finalize-surgery-ot-prepared-bulk-print.spec.ts
  e2e/finalize-surgery-ot-prep-package-b-print.spec.ts
  e2e/finalize-surgery-ot-discoverability.spec.ts
  --project=chromium
```

**Result:** **13 passed** (exit 0)

Bulk journey verified: OT Prepared loads, row Print present, Select all visible / clear / count, Print OT Slips (N), dedicated multi-slip HTML with page breaks, unselected absent when applicable, Package B CTA separate on OT Prep.

**Limitation:** Native browser print dialog / physical printer not exercised; deterministic print-document + trigger contract verified.

---

## 17. Manual UAT / Acceptance

```text
MANUAL UAT: REQUIRED — NOT EXECUTED
ACCEPTANCE: NOT RECORDED
```

---

## Governance stop

**STOP.** Implementation + automated validation + this report complete.

Do not perform Manual UAT, record Acceptance, start Package C, modify C-LA-04, reopen Package B, redesign RESP2, or change FSM/ownership/API/DB in this task.
