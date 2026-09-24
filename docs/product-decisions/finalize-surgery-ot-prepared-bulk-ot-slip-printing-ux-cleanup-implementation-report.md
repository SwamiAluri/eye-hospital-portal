# Finalize Surgery — OT Prepared
# Bulk OT Slip Printing — Action Area UX Cleanup
# Engineering Implementation Report

| Field | Value |
|-------|--------|
| **Document type** | **ENGINEERING IMPLEMENTATION REPORT** |
| **Date** | 2026-09-24 |
| **Slice** | OT Prepared — Action Area Cleanup (UAT remediation) |
| **Parent slice** | OT Prepared — Bulk OT Slip Printing & Print UX |
| **Status** | **IMPLEMENTATION COMPLETE — AUTOMATED TESTS RUN — STOPPED BEFORE MANUAL UAT** |
| **Manual UAT** | **REQUIRED — NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |
| **Package C** | **NOT STARTED** |
| **C-LA-04** | **DEFERRED** |

---

## 1. Implementation status

```text
IMPLEMENTATION: COMPLETE
AUTOMATED TESTS: PASSED (Vitest 44 relevant; Playwright Chromium 5 focused + prior bulk/Package B)
MANUAL UAT: REQUIRED — NOT EXECUTED
ACCEPTANCE: NOT RECORDED
PACKAGE C: NOT STARTED
C-LA-04: DEFERRED
```

---

## 2. Scope

Narrow UX cleanup on **Surgery Finalization → OT Prepared** only:

1. Remove redundant row-level Print icon  
2. Audit and remove decorative `>` chevron (no unique behavior)

Bulk **Print OT Slips (N)** and selection model were **not** redesigned.

---

## 3. Files changed

| Path | Change |
|------|--------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | OT Prepared (`printSelection`): hide row Print + ChevronRight; keep Reopen |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/finalize-ot-prepared-bulk-print.test.tsx` | Contracts: no row Print testid; Reopen-only action; bulk print retained |
| `apps/hospital-portal-web/e2e/finalize-surgery-ot-prepared-bulk-print.spec.ts` | Assert row Print absent; chevron absent; Reopen + bulk print present |
| `docs/product-decisions/finalize-surgery-ot-prepared-bulk-ot-slip-printing-ux-cleanup-implementation-report.md` | **THIS REPORT** |

Shared helper `ot-slip-print.ts` **unchanged** (still used by bulk + other-tab row Print).

---

## 4. Row Print removal

On **OT Prepared tab only** (`showPrintSelect` / `printSelection` active):

- Individual row **Print OT Slip** icon is not rendered  
- Worklist **Print OT Slips (N)** remains the print path, including **Print OT Slips (1)**

On **other Finalization tabs**:

- Row Print icon **retained** (unchanged)

Package B OT Preparation Prepared List Print **unchanged**.

---

## 5. Chevron audit result

| Question | Finding |
|----------|---------|
| Click handler on `ChevronRight`? | **None** |
| Accessibility | `aria-hidden` — decorative only |
| Unique navigation / detail behavior? | **No** — detail open via patient cell (OT Prepared) or whole-row click (other tabs); Reopen via primary button (`action: 'reopen'`) |
| Certified tests requiring chevron on Finalize OT Prepared? | **None found** |

**Verdict:** Chevron has **no unique certified functional behavior** → **REMOVED** on OT Prepared rows.

**Not applicable:** `CHEVRON HAS UNIQUE CERTIFIED BEHAVIOR — PRODUCT DECISION REQUIRED`

On other Finalization tabs the decorative chevron remains (out of this cleanup’s OT Prepared target).

---

## 6. Final OT Prepared row action model

```text
Action column:  [ Reopen ]
```

Worklist level (unchanged):

```text
Select all visible | Clear selection | N selected | Print OT Slips (N)
```

---

## 7. Bulk print preservation

Unchanged:

- Selected-only print  
- Current-page Select All Visible  
- One patient per OT Slip / page break  
- Existing OT Slip fields via `openOtSlipsPrint`  
- Chrome exclusion  

---

## 8. Package B / RESP2 / Package LA / Package C

| Area | Status |
|------|--------|
| Package B Prepared List print | Preserved |
| RESP2 Finalised / Prepare | Preserved |
| Package LA / Reopen / Cancel / C-LA-04 | Preserved (Reopen still rendered) |
| Package C | Not started |
| API / backend / DB | **NONE** |

---

## 9. Automated tests — Vitest

```text
npx vitest run
  finalize-ot-prepared-bulk-print.test.tsx
  finalize-ot-prep-package-b-print.test.tsx
  finalize-ot-prep-resp2.test.tsx
  ot-slip-print.test.ts
  ot-preparation-prepared-list-print.test.ts
  ot-preparation-resp2.test.ts
```

**Result:** 6 files / **44 passed** (exit 0)

---

## 10. Playwright — Chromium

```text
npx playwright test
  e2e/finalize-surgery-ot-prepared-bulk-print.spec.ts
  e2e/finalize-surgery-ot-prep-package-b-print.spec.ts
  --project=chromium
```

**Result:** **5 passed** (exit 0)

Verified on OT Prepared: checkboxes, Select all / Clear / count, Print OT Slips (N), Reopen present, row Print absent (`exact: true`), chevron absent, bulk document still opens; Package B Print separate.

**Limitation:** Native browser print dialog not exercised.

---

## 11. Manual UAT / Acceptance

```text
MANUAL UAT: REQUIRED — NOT EXECUTED
ACCEPTANCE: NOT RECORDED
```

---

## Governance stop

**STOP.** UX cleanup + automated validation + this report complete.

Do not perform Manual UAT, record Acceptance, start Package C, reopen Package B, or modify RESP2 / Package LA / FSM / ownership / API / DB in this task.
