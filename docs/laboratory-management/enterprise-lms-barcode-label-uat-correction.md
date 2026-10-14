# L-COL-01E — Manual UAT Corrections

**Date:** 2026-10-11  
**Slice:** L-COL-01E (Barcode & Label Lifecycle)  
**Final status:**

```text
CORRECTION_READY_FOR_MANUAL_UAT
```

Manual UAT is **not** re-accepted by this task. L-COL-01E is **not** marked ACCEPTED / UAT_PASSED. L-COL-01F and Testing were **not** started.

---

# Correction A — Generate / Print Label HTTP 404

**Prior Manual UAT state:** `BLOCKED_BY_404`

## A1. Root cause

**Stale LaboratoryApi Azure Functions host** was serving an older `bin\output\LaboratoryApi.dll` that included L-COL-01D specimen list/detail/receive/reject routes but **did not** register L-COL-01E barcode / label functions.

| Evidence (before correction) | Result |
|---|---|
| `GET /api/lms/health` | **200** |
| `GET /api/lms/specimens/{id}` (no auth) | **401** (route present) |
| `GET /api/lms/specimens/{id}/barcode` | **404** (route absent) |
| `POST /api/lms/specimens/{id}/barcode` | **404** (route absent) |
| `POST /api/lms/specimens/{id}/label/print` | **404** (route absent) |

Frontend URL construction was already correct. Secondary gap after routes were live: missing approved barcode configuration row → seeded for Development tenant.

## A2. Exact frontend / backend URLs

| Side | Value |
|---|---|
| FE axios base | `NEXT_PUBLIC_LABORATORY_API_URL` = `http://localhost:7076/api` |
| FE path | `POST /lms/specimens/{id}/label/print` |
| Browser request | `POST http://localhost:7076/api/lms/specimens/{id}/label/print` |
| BE route | `Route = "lms/specimens/{id:guid}/label/print"` + `routePrefix: api` |

## A3. Minimal correction

Rebuild/restart LaboratoryApi; seed approved barcode config; FE URL-contract regression test. No barcode business-rule changes.

## A4. Authenticated probe (after route fix)

Print returned `SPC-20261011-000001` / CODE128; accession remained `ACC-20261011-000001`.

---

# Correction B — Isolated label print window blank / “Pop-up blocked”

**Prior Manual UAT state:** `BLOCKED_BY_PRINT_POPUP`  
**Observed with Chrome already allowing pop-ups for `http://localhost:3000`.**

## B1. Root cause of browser print failure

Two compounding application bugs in the isolated print path:

1. **`window.open` after `await`** — `SpecimenDetailView.onPrint` / reprint submit called the print/reprint API first, then opened the print window. Chrome treats that as a non–user-initiated popup.
2. **`noopener,noreferrer` in window features** — `openSpecimenLabelPrint` used `window.open('', '_blank', 'noopener,noreferrer,width=640,height=480')`. With those features Chrome can return **`null`** from `window.open` while still opening a blank `about:blank` tab. The app then showed *“Pop-up blocked…”* and never wrote label HTML.

Backend print/reprint APIs were already succeeding (audit/idempotency intact).

## B2. Exact print implementation (before → after)

### Before

```text
Click Print / Reprint
  → await printLmsSpecimenLabel / reprintLmsSpecimenLabel
  → JsBarcode CODE128 SVG
  → window.open('', '_blank', 'noopener,noreferrer,…')   // often null + blank tab
  → if null → toast "Pop-up blocked…"
  → else document.write(label HTML) + window.print() on load
```

Files: `SpecimenDetailView.applyLabel` → `openSpecimenLabelPrint` in `specimen-label-print.ts`; reprint via `ReprintSpecimenLabelDialog` → same `applyLabel`.

### After (approved isolated browser print preserved)

```text
Click Print / Reprint
  → openSpecimenLabelPrintWindow() synchronously (features: width=640,height=480 only)
  → if null → application error; no API / no second allocation
  → await existing print/reprint API (unchanged)
  → on failure → abandonSpecimenLabelPrintWindow(win)
  → on success → writeSpecimenLabelPrint(win, label, CODE128 svg)
  → window.onload → focus + window.print()
```

No second popup. No thermal/ZPL/PDF/server print service.

## B3. Why Chrome treated the popup as blocked/blank

| Mechanism | Effect |
|---|---|
| Async boundary before `window.open` | Popup not tied to user gesture → blocker / unreliable open |
| `noopener` / `noreferrer` features | `window.open` returns `null` while blank tab may still appear |
| App null-check | Surfaces *“Pop-up blocked…”* even when site is allow-listed |
| Never reaching `document.write` | Blank `about:blank` with no label content |

Chrome allow-list for `localhost:3000` was **not** the defect.

## B4. Minimal correction

| Change | Detail |
|---|---|
| Sync open | Open blank print window before any `await` on Print and Reprint |
| Usable Window handle | Drop `noopener`/`noreferrer` from features (same pattern as registration-card / OT slip print) |
| Fill existing window | `writeSpecimenLabelPrint` after API success |
| Failure path | Close pre-opened window; no barcode re-allocation; clear error if open returns null |
| Label content | Unchanged approved fields (MRN, Patient, Order, Collected, Accession when present, CODE128 + value); still no DOB |

## B5. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/lib/lms/specimen-label-print.ts` | Split open / write / abandon; remove noopener features |
| `apps/hospital-portal-web/src/components/lms/specimens/SpecimenDetailView.tsx` | Sync open → API → write |
| `apps/hospital-portal-web/src/components/lms/specimens/ReprintSpecimenLabelDialog.tsx` | Sync open → reprint API → hand window to parent |
| `apps/hospital-portal-web/src/lib/lms/specimen-label-print.test.ts` | **New** focused print-flow unit tests |
| `apps/hospital-portal-web/src/app/dashboard/lms/specimens/enterprise-lms-specimen-ui.test.ts` | Contract assertions for sync-open ordering |
| `docs/laboratory-management/enterprise-lms-barcode-label-uat-correction.md` | This report |

## B6. Tests and exact counts

| Suite | Result |
|---|---|
| `specimen-label-print.test.ts` | **Passed 5 / Failed 0** |
| `enterprise-lms-specimen-ui.test.ts` | **Passed 13 / Failed 0** |
| `laboratory-service.api.test.ts` | **Passed 3 / Failed 0** |
| **Frontend total (focused)** | **Passed 21 / Failed 0** |

Covered: sync open features, popup null handling, write into pre-opened window, CODE128 SVG in HTML, DOB omitted, Print opens before await, Reprint opens before await + reason required + no new allocation copy.

Backend barcode lifecycle tests were not re-run for Correction B (no LaboratoryApi source changes in this step). LaboratoryApi health after FE change: **200**.

## B7. Confirmation — backend barcode lifecycle unchanged

- No LaboratoryApi / AuthService / migration / config changes in Correction B.
- Print Label still calls existing `POST …/label/print` (reuses barcode).
- Reprint still calls existing `POST …/label/reprint` with mandatory reason.
- Format `SPC-YYYYMMDD-NNNNNN`, CODE128, allocator, accession, permissions, audit, idempotency untouched.

## B8. Confirmation — audit / idempotency / permissions unchanged

- FE still uses the same authenticated API clients and idempotency keys.
- No permission code changes.
- No audit action changes.
- Failed popup open does **not** call print/reprint APIs.

## B9. Manual UAT status

```text
BLOCKED_BY_404 → fixed (Correction A)
BLOCKED_BY_PRINT_POPUP → CORRECTION_READY_FOR_RERUN (Correction B)
```

**Status:** `CORRECTION_READY_FOR_MANUAL_UAT`

### Resume Manual UAT

1. Ensure LaboratoryApi `:7076` healthy (print routes → **401** unauthenticated, not 404).
2. Hard-refresh the portal (`http://localhost:3000`) so the new print JS loads.
3. On specimen with barcode `SPC-20261011-000001`: **Print Label** should open an isolated window with MRN, Patient, Order, Collected, Accession, CODE128 + value (no DOB), then browser print dialog.
4. **Reprint** with a reason should open the same populated label; barcode unchanged.
5. Do **not** change Chrome pop-up settings again for this defect class.

Do **not** treat this document as Manual UAT pass or L-COL-01E acceptance.
