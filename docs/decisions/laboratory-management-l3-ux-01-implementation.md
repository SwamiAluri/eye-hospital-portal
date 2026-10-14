# Laboratory Management — L3-UX-01 Implementation

**Slice:** L3-UX-01 — Laboratory Order Summary / Estimate Sheet  
**Status:** CORRECTION IMPLEMENTATION COMPLETE · AUTOMATED TESTS COMPLETE · MANUAL UAT READY  
**Date:** 2026-10-08  
**Correction:** Runtime 404 fix + integrated two-column UX (Counselling estimate structural pattern)

---

## 1. Slice identity

| Field | Value |
|---|---|
| ID | L3-UX-01 |
| Name | Laboratory Order Summary / Estimate Sheet |
| Preconditions | L3-COM-01 implementation complete + automated tests complete + manual UAT pass; FIN-VIS-01 / UX-SUM-01 APPROVED |
| Type | Read-only composition-time summary (no financial mutations) |

---

## 2. Objective

Provide a concise, healthcare-grade, read-only commercial/clinical summary during laboratory order composition:

- Summarize selected LabReport/order tests
- Preserve L2 multi-test Order Composer
- Use L3-COM-01 commercial mapping + `IChargeCatalogResolver`
- Show monetary amounts only when authorized (FIN-VIS-01)
- Distinguish MAPPED / UNMAPPED / NON_BILLABLE / UNPRICED
- Never invent a price, create charges, OpdBill, payments, insurance claims, or a Laboratory ledger

---

## 3. Preconditions

- L3-COM-01 IMPLEMENTATION COMPLETE / AUTOMATED TESTS COMPLETE / MANUAL UAT PASS  
  (`docs/decisions/laboratory-management-l3-com-01-manual-uat-result.md`)
- PD-LAB-FIN-VIS-01 APPROVED
- PD-LAB-UX-SUM-01 APPROVED
- L2 Order Composer intact

---

## 4. Repository audit findings

| Topic | Finding |
|---|---|
| L2 Order Composer | `LaboratoryOrderDialog.tsx` — Dialog composer with multi-select table; create via `labReportsApi.createFromCatalog` |
| L3-COM-01 mapping | `LaboratoryCommercialMappingService` + catalog commercial endpoints; states MAPPED/UNMAPPED/NON_BILLABLE/UNPRICED |
| Sheet pattern | Existing `@/components/ui/sheet` right-side Sheet (Counsellor / Patient demographics / Patient filters) |
| Price SoT | `IChargeCatalogResolver.ResolveVariantAsync` → `variant_prices` (branch override still not applied — COM-03 follow-up) |
| FIN-VIS permissions | Existing certified `bill.view` / `opd_bill.view` (not `patient.update`) |
| LabReport create | Unchanged; unmapped remains clinically orderable; no OpdBill side effects |
| Quantity model | Composition model has no per-line quantity — Summary uses quantity `1` |
| Panel expansion | Matches create-from-catalog: panel → active member tests as distinct lines with panel context |

---

## 5. Files changed

### Backend
- `AuthService/Services/LaboratoryCommercialMappingService.cs` — `BuildOrderSummaryAsync` + resolver unit-price capture
- `AuthService/Controllers/LaboratoryCatalogController.cs` — `POST order-summary` + FIN-VIS gate
- `AuthService.Tests/LaboratoryOrderSummaryTests.cs` — **new**

### Frontend
- `src/components/laboratory/LaboratoryOrderSummarySheet.tsx` — **new** right-side Sheet
- `src/components/laboratory/LaboratoryOrderDialog.tsx` — Order Summary action + Sheet wiring
- `src/lib/api/laboratory-catalog.api.ts` — `getOrderSummary` + DTOs
- `src/app/dashboard/laboratory/laboratory-l3-ux-01-order-summary.test.tsx` — **new**
- `src/app/dashboard/laboratory/laboratory-l3-com-01-commercial.test.tsx` — adjust Composer assertion (Summary now in-scope for UX-01)

### Documentation
- this file

---

## 6. APIs added/changed

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/api/laboratory/catalog/order-summary` | `patient.view` (+ amounts require `bill.view` **or** `opd_bill.view`) | Read-only composition summary |

Request:

```json
{ "items": [ { "testDefinitionId": "..." }, { "panelId": "..." } ] }
```

Response includes clinical identity, commercial state, optional ServiceVariant identity, and monetary fields **only** when FIN-VIS authorized.

Existing L3-COM-01 commercial endpoints and LabReport create APIs unchanged.

---

## 7. Permission behavior

| Action | Permission |
|---|---|
| Open / read Order Summary (clinical + commercial state) | `patient.view` |
| See monetary amounts (unit price / line / total) | `bill.view` **or** `opd_bill.view` |
| Commercial mapping mutations | unchanged — `patient.update` (L3-COM-01) |

No new permission codes.  
`patient.update` is **not** used as a financial-visibility permission.  
Server-side FIN-VIS enforcement: unauthorized responses omit unit prices / estimates (`FinancialAmountsVisible = false`).

---

## 8. Financial visibility behavior

- Lab technicians without Billing view permissions see commercial readiness chips and optional SV identity; message: “Amounts are not shown for this role.”
- Authorized Billing/Finance users see resolver-derived unit price, quantity, line estimate, and estimate total when available.
- Client also gates rendering via `useHasAnyPermission(['bill.view','opd_bill.view'])` — **not** authoritative; server strips amounts.
- No payment / charge / collect CTA.

---

## 9. Commercial-state behavior

Preserves L3-COM-01 semantics exactly:

| State | Meaning in Summary |
|---|---|
| MAPPED | Active SV + resolver priced — amount shown only if FIN-VIS |
| UNMAPPED | No usable SV mapping — clinically orderable; no price |
| NON_BILLABLE | Explicit catalog non-billable — no price; not “missing config” |
| UNPRICED | SV mapped but no applicable positive price |

No new commercial states.

---

## 10. UX behavior

```text
ORDER COMPOSER → Order Summary action → RIGHT-SIDE SHEET
  → Clinical summary (per-line)
  → Commercial readiness
  → Conditional financial estimate
  → Return to Composer
```

- Existing L2 selected-test table **not** redesigned
- Composer state preserved when Summary closes
- Compact, desktop-friendly Sheet (`sm:max-w-md`, scrollable body)
- Patient context shown when already selected in Composer

---

## 11. Tests added

### Frontend (`laboratory-l3-ux-01-order-summary.test.tsx`)
- Opens from Composer via Sheet
- Composer remains functional
- Distinct lines + commercial states
- FIN-VIS gating (no money for unauthorized)
- No payment/charge CTA / no fabricated prices
- Close preserves Composer
- Compact layout
- API client order-summary + authorized amount path

### Backend (`LaboratoryOrderSummaryTests.cs`)
- `patient.view` gate
- Unauthorized omits monetary amounts
- Authorized returns resolver-derived amounts
- UNMAPPED ≠ UNPRICED ≠ NON_BILLABLE
- Cross-tenant NotFound
- No OpdBill / OpdBillItem side effects
- Multi-test distinct lines

---

## 12. Full regression results

### Frontend
```text
Command: npx vitest run src/app/dashboard/laboratory
Result:  86 passed (9 files)
         Failures: 0 · Skipped: 0
Baseline: 77 → +9 L3-UX-01
```

### Backend
```text
Command: dotnet test AuthService.Tests/AuthService.Tests.csproj --filter
  "FullyQualifiedName~LaboratoryCatalogTests
  |LabReportWorklistTests
  |LabReportCanonicalDocumentTests
  |LaboratoryClinicalCatalogBootstrapTests
  |LaboratoryCommercialMappingTests
  |LaboratoryOrderSummaryTests"

Result:  Passed: 73 · Failed: 0 · Skipped: 0
Baseline: 66 → +7 L3-UX-01
```

---

## 13. Known limitations

- Branch-aware `variant_prices.branch_id` override still not applied by `ResolveVariantAsync` (documented L3-COM-01 / COM-03 follow-up). Summary uses the existing resolver path; no parallel branch-price system.
- Composition quantity is always `1` (no quantity field in current order model).
- Estimate total sums only lines with resolved prices; mixed UNMAPPED/UNPRICED lines leave gaps honest (no fabrication).
- Insurance status / claim display deferred (INS slices).
- Opening Summary is not audited (read-only; no mutation noise).

---

## 14. Out-of-scope findings (documented, not implemented)

- L3-COM-02 charge posting / OpdBill / BillChargeSource
- Payments, refunds, reversals
- Insurance / CCMS mutation
- Specimen / accession / results / verification / release
- Lifecycle cancel/hold/resume / new Lab statuses
- Branch-aware pricing redesign
- ServiceVariant tenant-model redesign
- L2 Order Composer redesign / Catalog Admin redesign
- New permission codes

---

## 15. Manual UAT checklist (two-column correction)

**Do not mark manual UAT passed automatically.**

1. Open Laboratory → **Order New Laboratory Tests**.
2. Confirm composer is a **two-column workspace** (left composition / right Order Summary).
3. Confirm left side retains patient, clinician, priority, tests, indication, notes.
4. Confirm right side shows integrated **Order Summary** panel.
5. Confirm there is **no** separate right-side Sheet / nested overlay for Summary.
6. Select one mapped test; confirm Summary updates without a second button/overlay.
7. Select multiple tests; confirm distinct item cards/lines.
8. Verify **MAPPED**.
9. Verify **UNMAPPED**.
10. Verify **NON_BILLABLE**.
11. Verify **UNPRICED** if legitimate data exists; else record `NOT TESTABLE IN CURRENT DATA`.
12. Unauthorized financial role: no unit/line/total amounts (“Amounts are not shown for this role.”).
13. Authorized financial role (`bill.view` / `opd_bill.view`): resolver-derived amounts when priced.
14. Confirm no Pay / Collect / Charge CTA.
15. Confirm **Create order** still works.
16. Confirm Cancel / close resets composer as before.
17. Short viewport: left scrolls; summary remains accessible; no critical overflow.
18. Narrow viewport: single-column stack (composer then summary).
19. Confirm Network call `POST /api/laboratory/catalog/order-summary` is **not** route-404 (AuthService must be on current binary).
20. Confirm no OpdBill / payment / insurance side effects from Summary preview.

---

## 16. Correction log (UAT 404 + UX)

### 16.1 404 root cause

| Finding | Evidence |
|---|---|
| Authoritative route | `POST /api/laboratory/catalog/order-summary` on `LaboratoryCatalogController` (`[Route("api/laboratory/catalog")]` + `[HttpPost("order-summary")]`) |
| Frontend client | `laboratoryCatalogApi.getOrderSummary` → `POST /laboratory/catalog/order-summary` against `NEXT_PUBLIC_API_URL` (`http://localhost:5073/api`) — path correct |
| Running AuthService at UAT | Process started **14:45**; L3-UX-01 binary compiled **16:07** — **stale process** |
| Swagger before restart | Listed COM-01 commercial routes; **did not** list `order-summary` |
| Masking behaviour | `TenantResolutionMiddleware` returns **400 Tenant ID is required** when `X-Tenant-ID` is absent — can obscure a true route-404 in unauthenticated probes |
| Fix applied | Restart AuthService on current Debug build; Swagger now lists `/api/laboratory/catalog/order-summary` |

**Conclusion:** Not a wrong frontend URL and not a missing controller in source. Runtime AuthService had not loaded the L3-UX-01 assembly. No duplicate endpoint created; route unchanged.

### 16.2 UX correction

| Before | After |
|---|---|
| Dialog composer + separate Order Summary **Sheet** overlay | Single Dialog **two-column workspace** |
| Explicit “Order Summary” footer button | Persistent right-rail summary (Counselling estimate structural pattern) |
| `LaboratoryOrderSummarySheet.tsx` | `LaboratoryOrderSummaryPanel.tsx` (no Sheet) |

Desktop: left ~62% composition / right ~38% summary. Narrow: stacked composer → summary. Footer remains Cancel + Create order only.

### 16.3 Files changed (correction)

- `LaboratoryOrderDialog.tsx` — two-column workspace; remove Sheet/button
- `LaboratoryOrderSummaryPanel.tsx` — **new** integrated panel
- `LaboratoryOrderSummarySheet.tsx` — **removed**
- `laboratory-l3-ux-01-order-summary.test.tsx` — updated for panel layout
- `laboratory-l2-order-composer-ux.test.tsx` — allow widened height-capped dialog
- this document

API route/contract unchanged. FIN-VIS (`bill.view` / `opd_bill.view`) unchanged.

### 16.4 Correction regression

| Suite | Result |
|---|---|
| Frontend `npx vitest run src/app/dashboard/laboratory` | **86 passed** |
| Backend Laboratory filter + OrderSummary | **73 passed** |

AuthService restarted; Swagger registers `order-summary`.

---

## 17. Explicit final status

```text
L3-UX-01 CORRECTION IMPLEMENTATION COMPLETE
AUTOMATED TESTS COMPLETE
MANUAL UAT READY
404 ROOT CAUSE = STALE AUTHSERVICE BINARY (ROUTE NOW LIVE)
UX = INTEGRATED TWO-COLUMN SUMMARY (NO SHEET OVERLAY)
NO CHARGE POSTING
NO OPD BILL MUTATION
NO PAYMENT / INSURANCE WORKFLOW
L3-COM-02 NOT STARTED
NEXT GATE = MANUAL UAT
```
