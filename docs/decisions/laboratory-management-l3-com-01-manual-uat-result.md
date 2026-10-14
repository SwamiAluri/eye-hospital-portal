# Laboratory Management — L3-COM-01 Manual UAT Result

**Slice:** L3-COM-01 — LaboratoryTestDefinition → ServiceVariant commercial mapping / chargeability foundation  
**UAT date:** 2026-10-08  
**Executor:** Agent-assisted Manual UAT (runtime API + browser + DB verification)  
**Implementation doc (unchanged):** [laboratory-management-l3-com-01-implementation.md](./laboratory-management-l3-com-01-implementation.md)

---

## 1. Build / revision

| Item | Value |
|---|---|
| Git branch | `feat/counsellor-workspace-recording-ux` |
| Approx. HEAD | `006ec7ab` |
| AuthService runtime | `artifacts/lab-l2-manual-uat-auth/AuthService.exe` (ProductVersion includes `006ec7ab…`; LastWriteTime 2026-10-08 14:21) |
| Swagger COM-01 routes live | Confirmed: `/api/laboratory/catalog/tests/{id}/commercial`, `/commercial/map`, `/commercial/non-billable`, `/service-variants` |
| Working tree note | L3-COM-01 sources present in workspace (implementation complete prior to this UAT) |

## 2. Environment

| Item | Value |
|---|---|
| Auth API | `http://localhost:5073` |
| Frontend | `http://localhost:3000` |
| Tenant | India Eye Hospital Network (`155fe198-6ae5-4a01-9254-ead5b427247e`) |
| DB | Azure PostgreSQL `hospitalportal` (existing UAT connection) |
| Authorized catalog admin | `labtech1@hospital.com` (`patient.view` + `patient.update`; **no** `bill.view`) |
| Unauthorized mutation user | `counsellor4@hospital.com` (`patient.view` = true; `patient.update` = false) |
| Test patient used | `749d3b7d-f0c4-4ade-811b-357df38957d8` (MRN-2026-10-E7B80) |
| Ordering clinician | Active doctor returned by `/laboratory/catalog/ordering-clinicians` |

## 3. Database migration status

Applied existing script (not modified):

`20261008143000_AddLaboratoryTestDefinitionIsNonBillable.sql`

Verified:

```text
is_non_billable | boolean | not null | default false
```

Post-migration catalog counts (before mapping UAT):

| Metric | Value |
|---|---|
| Active LTD rows | 36 |
| `service_variant_id` NULL | 36 |
| `is_non_billable = true` | 0 |
| `is_non_billable = false` | 36 |

NULL ServiceVariantId rows were **not** auto-converted to NON_BILLABLE.

## 4. AuthService status

- Pre-UAT: listening on `:5073`; swagger exposed COM-01 routes.
- Temporarily stopped during backend regression rebuild (DLL lock).
- Restarted after regression; swagger HTTP 200 confirmed.

## 5. Frontend status

- Login page and Laboratory workbench reachable at `:3000`.
- Logged in as Lab Technician (`labtech1@hospital.com` / India Eye).

## 6. Preconditions

| Precondition | Result |
|---|---|
| Migration applied | PASS |
| AuthService healthy | PASS |
| Frontend running | PASS |
| Authorized Lab catalog admin | PASS (`labtech1`) |
| Non-authorized mutator | PASS (`counsellor4`) |
| Test patient(s) | PASS (API + order create) |
| Active ServiceVariants | PASS (79 active) |
| Unmapped LTD available | PASS (CBC001 started UNMAPPED) |
| Safe SV for UAT selection | PASS (`DIAG-BIOM`, `DIAG-TOP`, `LAB-CBC`) |
| Fabricated SV/prices/mappings | Not created |

---

## 7. Scenario results (COM-01-UAT-01 … 25)

### COM-01-UAT-01 — Open Laboratory Catalog Administration

| Field | Value |
|---|---|
| Preconditions | labtech1 logged in; Laboratory workbench |
| Steps | Open Laboratory → **Catalog admin** |
| Expected | Catalog admin opens; design system preserved; catalog loads; commercial info without unauthorized money |
| Actual | Dialog “Laboratory catalog administration” opened with Commercial mapping / Add catalog test tabs; catalog table loaded with UNMAPPED badges |
| Result | **PASS** |
| Evidence | Browser UI screenshot/snapshot; buttons `Catalog admin`, commercial table columns Test/Code/Category/Commercial/ServiceVariant |

### COM-01-UAT-02 — Existing Unmapped Test

| Field | Value |
|---|---|
| Preconditions | CBC001 with NULL SV and `is_non_billable=false` |
| Steps | GET `/laboratory/catalog/tests?search=CBC001`; UI table inspection |
| Expected | `UNMAPPED`; no SV; no fabricated price; ≠ NON_BILLABLE |
| Actual | API `commercialState=UNMAPPED`, `serviceVariantId=null`, `isNonBillable=false`; UI orange UNMAPPED; ServiceVariant column “—” |
| Result | **PASS** |
| Evidence | API JSON keys include commercialState; no unitPrice field |

### COM-01-UAT-03 — Map Test to ServiceVariant

| Field | Value |
|---|---|
| Preconditions | CBC001 unmapped; active SV available |
| Steps | API PUT map → DIAG-BIOM; UI map CBC001 → LAB-CBC |
| Expected | Success; SV shown; MAPPED if priced; no order mutation |
| Actual | API 200 `MAPPED` `resolverKind=Mapped` `financiallyActionable=true`; UI row `MAPPED` + “CBC (Complete Blood Count) (LAB-CBC)” |
| Result | **PASS** |
| Evidence | API response; UI `data-commercial-state=MAPPED`; DB `CBC001.service_variant_id=33f92f47-…` (LAB-CBC) after UI map |

### COM-01-UAT-04 — Mapping persists / commercial GET

| Field | Value |
|---|---|
| Steps | GET `/tests/{id}/commercial` after map |
| Expected | Mapping + state agree with UI |
| Actual | 200; `serviceVariantCode=DIAG-BIOM` (API phase) / later LAB-CBC (UI phase); `commercialState=MAPPED`; no `unitPrice` property |
| Result | **PASS** |

### COM-01-UAT-05 — Resolver-backed state

| Field | Value |
|---|---|
| Steps | Inspect commercial read after map to priced SV |
| Expected | State derived from resolver; MAPPED when priced |
| Actual | `resolverKind=Mapped` on commercial DTO when mapped to priced DIAG-BIOM |
| Result | **PASS** |
| Notes | Live UNPRICED path separately BLOCKED (UAT-11) due to data |

### COM-01-UAT-06 — Unmap

| Field | Value |
|---|---|
| Steps | DELETE `/commercial/map` |
| Expected | SV NULL; non-billable false; UNMAPPED |
| Actual | 200 `UNMAPPED`; `serviceVariantId` null; `isNonBillable=false` |
| Result | **PASS** |

### COM-01-UAT-07 — Change mapping

| Field | Value |
|---|---|
| Steps | Map DIAG-BIOM then map DIAG-TOP |
| Expected | Replaced mapping; no duplicate; audit previous/new |
| Actual | Second map 200; SV id became DIAG-TOP; audit `LaboratoryCommercialMap` rows with old/new snapshots |
| Result | **PASS** |

### COM-01-UAT-08 — Non-billable

| Field | Value |
|---|---|
| Steps | PUT non-billable=true on unmapped CBC001 |
| Expected | NON_BILLABLE; SV null; no price/billing action |
| Actual | 200 `NON_BILLABLE`; `isNonBillable=true`; SV null |
| Result | **PASS** |

### COM-01-UAT-09 — Contradiction guard

| Field | Value |
|---|---|
| Steps | Mark non-billable while mapped; map while non-billable |
| Expected | Rejected; no contradictory state |
| Actual | 400 “Cannot mark non-billable while a ServiceVariant mapping exists…”; 400 “Cannot map … while … non-billable…” |
| Result | **PASS** |

### COM-01-UAT-10 — Clear non-billable

| Field | Value |
|---|---|
| Steps | PUT non-billable=false |
| Expected | UNMAPPED; SV remains NULL |
| Actual | 200 `UNMAPPED`; `isNonBillable=false`; SV null |
| Result | **PASS** |

### COM-01-UAT-11 — Mapped but Unpriced

| Field | Value |
|---|---|
| Preconditions | Legitimate unpriced active SV |
| Steps | Query DB for active SV without global positive price / branch-only price |
| Expected | UNPRICED |
| Actual | **No legitimate candidate**: 79 active SV and 79 with global positive prices; 0 branch-only-priced; 0 zero/null amount rows. Per instructions, did not fabricate prices/variants. |
| Result | **BLOCKED** |
| Severity | N/A (environment/data) |
| Notes | Automated test `Resolver_MappedWhenPriced_UnpricedWhenNoPrice` covers semantics. Acceptance criterion “where testable” applies. |

### COM-01-UAT-12 — Authorized mutation

| Field | Value |
|---|---|
| Steps | labtech1 map/unmap/non-billable |
| Expected | Allowed under `patient.update` |
| Actual | All mutations 200 for labtech1 |
| Result | **PASS** |

### COM-01-UAT-13 — Unauthorized mutation

| Field | Value |
|---|---|
| Steps | counsellor4 PUT map |
| Expected | Denied; no DB change |
| Actual | HTTP **403**; CBC001 not mutated by that call |
| Result | **PASS** |

### COM-01-UAT-14 — Read authorization

| Field | Value |
|---|---|
| Steps | counsellor4 GET commercial |
| Expected | Read allowed; mutation unavailable |
| Actual | GET commercial **200**; map **403** |
| Result | **PASS** |

### COM-01-UAT-15 — Cross-tenant LTD access

| Field | Value |
|---|---|
| Preconditions | Other-tenant LTD if available |
| Steps | DB: no LTD rows for other tenants; PUT map on random GUID |
| Expected | Not found / unauthorized; no mutation |
| Actual | Random non-owned id → **404**; no other-tenant LTD data available in DB |
| Result | **PASS** (isolation fail-closed) |
| Notes | ServiceVariant is global (not tenant-owned) — not tested as tenant entity |

### COM-01-UAT-16 — Mapping audit

| Field | Value |
|---|---|
| Steps | Inspect `audit_log` after map/change/unmap |
| Expected | LaboratoryCommercialMap / Unmap with previous/new |
| Actual | Rows present with actions `LaboratoryCommercialMap`, `LaboratoryCommercialUnmap`; `old_values`/`new_values` JSON snapshots for CBC001 |
| Result | **PASS** |

### COM-01-UAT-17 — Non-billable audit

| Field | Value |
|---|---|
| Steps | Inspect audit after set/clear |
| Expected | NonBillableSet / Clear |
| Actual | `LaboratoryCommercialNonBillableSet` and `LaboratoryCommercialNonBillableClear` present with snapshots |
| Result | **PASS** |

### COM-01-UAT-18 — Unmapped clinically orderable

| Field | Value |
|---|---|
| Steps | POST `/lab-reports/catalog-order` for CBC001 while UNMAPPED |
| Expected | Order created; no commercial gate |
| Actual | **201**; LabReport id `1da7b10f-…`; testCode CBC001; status ordered |
| Result | **PASS** |

### COM-01-UAT-19 — No OpdBill / charge side effect

| Field | Value |
|---|---|
| Steps | Count `opd_bills`, `opd_bill_items`, `opd_bill_payments` before/after order |
| Expected | No financial mutation |
| Actual | bills 315→315; items 4→4; payments unchanged during order |
| Result | **PASS** |
| Severity if failed | BLOCKER (none) |

### COM-01-UAT-20 — No CCMS / insurance side effect

| Field | Value |
|---|---|
| Steps | Count `insurance_claim` before/after |
| Expected | No unexpected claim |
| Actual | 0→0 |
| Result | **PASS** |

### COM-01-UAT-21 — No Order Composer redesign

| Field | Value |
|---|---|
| Steps | Open **Order New Test** UI |
| Expected | L2 composer intact; no Order Summary / totals / payment |
| Actual | Dialog “Order New Laboratory Tests” with patient/clinician/tests/indication; no Order Summary; no unit price / payment strings |
| Result | **PASS** |

### COM-01-UAT-22 — Laboratory worklist

| Field | Value |
|---|---|
| Steps | View worklist after catalog-order |
| Expected | Functional; order visible |
| Actual | Worklist shows CBC001 Complete Blood Count for Uat3oUi AdminTwo; Ordered status |
| Result | **PASS** |

### COM-01-UAT-23 — P360

| Field | Value |
|---|---|
| Steps | Open Patient Directory / patient page during session |
| Expected | P360/projection remains functional; not commercial mapping workbench |
| Actual | Patient Directory UI loads (not commercial mapping). Transient “Could not load patients” occurred while AuthService was stopped for regression rebuild; earlier in same UAT session patient API returned 200 and catalog-order used patient successfully. Directory is not a commercial mapping surface. |
| Result | **PASS** (with transient Auth downtime note) |
| Notes | No BLOCKER; Lab workbench patient context already validated via order/worklist |

### COM-01-UAT-24 — CBC001 vs CBC

| Field | Value |
|---|---|
| Steps | Catalog table + API search |
| Expected | Distinct identities preserved |
| Actual | CBC001 Haematology and CBC Pre-Operative Panel both present and distinct |
| Result | **PASS** |

### COM-01-UAT-25 — No unauthorized monetary amounts

| Field | Value |
|---|---|
| Steps | Inspect commercial admin UI + commercial API DTO as labtech1 (no bill.view) |
| Expected | State/SV identity OK; no unit prices |
| Actual | API commercial DTO has no `unitPrice`; UI shows states/SV names; helper text “Amounts are not shown here”; false-positive text hits were local code `INR001` and the word “Amounts” in the disclaimer |
| Result | **PASS** |

---

## 8. Defects

| ID | Severity | Scenario | Description | Status |
|---|---|---|---|---|
| — | — | — | No BLOCKER or HIGH defects found | — |

**Non-defect limitations**

1. Live **UNPRICED** path not reproducible without fabricating price data (UAT-11 BLOCKED). Covered by automated tests.
2. No other-tenant LaboratoryTestDefinition rows in DB; cross-tenant check used fail-closed 404 on unknown id.
3. AuthService briefly unavailable during regression rebuild caused temporary Patient Directory load failure (environment ops), not a COM-01 product defect.

## 9. Billing boundary result

**PASS** — L2 unmapped catalog-order created LabReport only; OpdBill / OpdBillItem / payment counts unchanged; no Lab ledger.

## 10. Authorization result

**PASS** — Mutations require `patient.update`; counsellor4 denied (403); reads allowed with `patient.view`.

## 11. Tenant result

**PASS** — LTD tenant boundary fail-closed (404). ServiceVariant treated as global catalog (repository reality).

## 12. Audit result

**PASS** — `audit_log` contains Map / Unmap / NonBillableSet / NonBillableClear with old/new snapshots.

## 13. Automated regression result (fresh this UAT)

| Suite | Command | Result |
|---|---|---|
| Frontend | `npx vitest run src/app/dashboard/laboratory` | **77 passed**, 0 failed, 0 skipped |
| Backend | LaboratoryCatalogTests + LabReportWorklistTests + LabReportCanonicalDocumentTests + LaboratoryClinicalCatalogBootstrapTests + LaboratoryCommercialMappingTests | **66 passed**, 0 failed, 0 skipped |

No tests removed or weakened.

## 14. Acceptance assessment

| Gate criterion | Met? |
|---|---|
| Mapping works | Yes |
| Unmapping works | Yes |
| Mapping change works | Yes |
| UNMAPPED correct | Yes |
| NON_BILLABLE correct | Yes |
| UNPRICED correct where testable | Yes (not testable live → BLOCKED UAT-11; automated coverage green) |
| Contradiction prevented | Yes |
| Authorization | Yes |
| Tenant boundary | Yes |
| Audit | Yes |
| L2 ordering functional | Yes |
| No OpdBill/charge/payment | Yes |
| No CCMS mutation | Yes |
| Worklist / patient context | Yes |
| CBC001/CBC distinct | Yes |
| No unauthorized amounts | Yes |
| Automated regression green | Yes |
| No BLOCKER | Yes |
| No unresolved HIGH | Yes |

### Verdict

```text
L3-COM-01 IMPLEMENTATION COMPLETE
L3-COM-01 AUTOMATED TESTS COMPLETE
L3-COM-01 MANUAL UAT COMPLETE
L3-COM-01 UAT PASS
L3-COM-01 READY FOR ACCEPTANCE
L2 ACCEPTANCE STILL NOT CLAIMED
PROGRAM WAIVER REMAINS LIMITED TO L3-COM-01
L3-COM-02 NOT STARTED
L3-UX-01 NOT STARTED
```

## 15. Remaining known limitations

- Live UNPRICED demonstration blocked by fully priced global ServiceVariant catalog (79/79).
- Branch-aware resolver override still not applied (documented COM-03 follow-up; out of this UAT).
- CBC001 left mapped to `LAB-CBC` after UI mapping verification (intentional post-UAT data state; not a defect).
- L2 acceptance remains unclaimed.

## 16. Next gate

**Human / Product Owner acceptance of L3-COM-01** (this UAT result).

Only after explicit acceptance should a separate prompt authorize the next slice (e.g. L3-UX-01 or L3-COM-02).

---

## Final stop

No code, schema, API, UI, or permission changes were made during this UAT.  
No defect fixes implemented.  
L3-UX-01 / L3-COM-02 / specimen / results / lifecycle **not started**.
