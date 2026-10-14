# Laboratory Management — L3-COM-01 Implementation

**Slice:** L3-COM-01 — ServiceVariant commercial mapping / chargeability foundation  
**Status:** IMPLEMENTATION COMPLETE · AUTOMATED TESTS COMPLETE · MANUAL UAT READY  
**Date:** 2026-10-08

---

## 1. Slice objective

Establish the authoritative commercial identity chain:

```text
LaboratoryTestDefinition → ServiceVariant → variant_prices → IChargeCatalogResolver
```

Purpose: commercial mapping + price-resolution readiness.  
This slice does **not** post charges, create bills, collect payment, create insurance claims, or create a Laboratory financial ledger.

---

## 2. Implementation gate

L2 acceptance is not claimed; L3-COM-01 proceeds under explicit program waiver.

## 3. Program waiver for L2 acceptance

L2 acceptance remains unclaimed; L3-COM-01 was authorized under explicit program waiver.

COM-01 / COM-02 (Option A) / COM-03: **APPROVED** in product-owner decision closure.

---

## 4. Repository audit findings

| Topic | Finding |
|---|---|
| `LaboratoryTestDefinition.ServiceVariantId` | Already nullable FK column; create API already accepted optional SV |
| ServiceVariant tenancy | **Global** catalog (no `tenant_id`) — Service Catalog V2. Tenant safety is enforced on LTD ownership, not on SV rows |
| Active SV | `IsActive && DeletedAt == null` |
| SV admin picker | Billing `ChargeMapping` uses `bill.admin`; Lab must not require it |
| Price SoT | `variant_prices` via `IChargeCatalogResolver.ResolveVariantAsync` |
| Branch-aware resolution | Resolver pick helper has branch param but **branch override not applied** in current `ResolveVariantAsync` path (documented COM-03 follow-up) |
| Non-billable field | **Absent** before this slice — COM-02 Option A required explicit catalog flag |
| Catalog admin permission | Existing `patient.update` (create catalog / order). Reused for mapping mutations |
| Catalog read permission | Existing `patient.view` |
| Audit | `IAuditService.StageAsync` available; Lab catalog create had no audit — mapping mutations now audited |
| Soft-delete | LTD uses `DeletedAt` + query filter |
| Bootstrap | ~36 LTD rows, `ServiceVariantId = null`, not auto-mapped |
| CBC identities | Distinct `CBC001` vs `CBC` preserved |

**Contradiction note:** PO wording that ServiceVariant is a “tenant entity” does not match repository reality (global catalog). Implementation enforces tenant isolation on `LaboratoryTestDefinition` and validates active global SV identity. Cross-tenant LTD mapping is rejected (404).

---

## 5. Files changed

### Backend
- `AuthService/Models/Domain/LaboratoryCatalog.cs` — `IsNonBillable`
- `AuthService/Services/LaboratoryCommercialMappingService.cs` — **new**
- `AuthService/Controllers/LaboratoryCatalogController.cs` — commercial endpoints + enrichment
- `AuthService/Program.cs` — DI registration
- `AuthService/Data/Migrations/20261008143000_AddLaboratoryTestDefinitionIsNonBillable.cs`
- `AuthService/Data/Migrations/20261008143000_AddLaboratoryTestDefinitionIsNonBillable.sql`
- `AuthService.Tests/LaboratoryCommercialMappingTests.cs` — **new**
- `AuthService.Tests/LaboratoryCatalogTests.cs` — controller ctor wiring

### Frontend
- `src/lib/api/laboratory-catalog.api.ts`
- `src/components/laboratory/LaboratoryCatalogAdminDialog.tsx`
- `src/components/laboratory/LaboratoryWorkbench.tsx`
- `src/app/dashboard/laboratory/laboratory-l3-com-01-commercial.test.tsx` — **new**

### Documentation
- this file

---

## 6. APIs changed

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/laboratory/catalog/tests` | `patient.view` | Enriched with `commercialState`, SV identity (no unit prices) |
| GET | `/api/laboratory/catalog/tests/{id}` | `patient.view` | Same + `resolverKind` |
| GET | `/api/laboratory/catalog/tests/{id}/commercial` | `patient.view` | Full commercial read model |
| PUT | `/api/laboratory/catalog/tests/{id}/commercial/map` | `patient.update` | Map active ServiceVariant |
| DELETE | `/api/laboratory/catalog/tests/{id}/commercial/map` | `patient.update` | Unmap |
| PUT | `/api/laboratory/catalog/tests/{id}/commercial/non-billable` | `patient.update` | COM-02 Option A |
| GET | `/api/laboratory/catalog/service-variants` | `patient.update` | Active SV picker (identity only, no prices) |

Existing LabReport create / catalog-order APIs unchanged and still do not touch OpdBill.

---

## 7. Schema / migration

```sql
ALTER TABLE laboratory_test_definitions
  ADD COLUMN IF NOT EXISTS is_non_billable boolean NOT NULL DEFAULT false;
```

- Existing NULL `service_variant_id` rows remain **UNMAPPED** (not non-billable).
- No Laboratory price/billing/ledger tables.
- Prefer existing `service_variant_id` FK; no new mapping table.

---

## 8. Permission behavior

| Action | Permission |
|---|---|
| Read commercial state | `patient.view` |
| Map / unmap / non-billable / SV search | `patient.update` |
| Monetary amounts in Lab UI | **Not exposed** in this slice (FIN-VIS — clinical-first) |

No new permission codes. No grant of `user.view`, `bill.admin`, or finance permissions to Laboratory users.

---

## 9. Mapping semantics

| Condition | Commercial state |
|---|---|
| `IsNonBillable = true` | `NON_BILLABLE` |
| `ServiceVariantId` null and not non-billable | `UNMAPPED` |
| Mapped + resolver `Mapped` | `MAPPED` (financially actionable for future L3-COM-02) |
| Mapped + resolver `Unpriced` | `UNPRICED` |
| Mapped but SV missing/inactive at read time | `UNMAPPED` (stale) |

Rules:
- Unmapped may remain clinically orderable.
- Unmapped is not financially actionable.
- No fabricated prices; no Manual billing fallback.
- NON_BILLABLE + active SV mapping is rejected.
- Null SV is never silently converted to NON_BILLABLE.

---

## 10. Non-billable semantics (COM-02 Option A)

Explicit `LaboratoryTestDefinition.IsNonBillable`.  
`ServiceVariantItemMaps.IsChargeable` is **not** used as the Lab catalog rule.

---

## 11. Resolver integration

Read-only calls to `IChargeCatalogResolver.ResolveVariantAsync`.  
Retains Mapped / Unmapped / NonChargeable / Unpriced semantics (Lab UI maps to MAPPED / UNMAPPED / UNPRICED; NonChargeable is item-map specific and not used for LTD).

Branch-aware price override not redesigned in this slice (follow-up).

---

## 12. Audit behavior

Mutations stage `IAuditService` rows (same SaveChanges as the catalog change):

- `LaboratoryCommercialMap`
- `LaboratoryCommercialUnmap`
- `LaboratoryCommercialNonBillableSet`
- `LaboratoryCommercialNonBillableClear`

Payload includes previous/new snapshot: test id, tenant, local code, ServiceVariantId, IsNonBillable.

---

## 13. Automated tests

### Frontend (`npx vitest run src/app/dashboard/laboratory`)
- **77 passed** (baseline 69 + 8 L3-COM-01)
- Failures: 0 · Skipped: 0

### Backend (Laboratory filter + L3-COM-01)
```text
FullyQualifiedName~LaboratoryCatalogTests
|LabReportWorklistTests
|LabReportCanonicalDocumentTests
|LaboratoryClinicalCatalogBootstrapTests
|LaboratoryCommercialMappingTests
```
- **66 passed** (baseline 53 + 13 L3-COM-01)
- Failures: 0 · Skipped: 0

Coverage includes: valid/invalid/cross-tenant LTD mapping, unmap, non-billable, contradictions, UNMAPPED vs NON_BILLABLE, MAPPED vs UNPRICED, audit, unauthorized attribute gates, L2 catalog-order without OpdBill mutation, CBC001 vs CBC distinct.

---

## 14. Manual UAT checklist (NOT PASSED)

1. Open Laboratory → **Catalog admin**.
2. Select a known test (e.g. CBC001).
3. Map explicitly to an existing valid ServiceVariant.
4. Verify state **MAPPED** (or **UNPRICED** if no global price).
5. Verify selected ServiceVariant name/code displayed.
6. Verify commercial read endpoint / detail reflects resolver state.
7. Confirm an unmapped test shows **UNMAPPED**.
8. Mark a test non-billable (after unmap) → **NON_BILLABLE**.
9. Reproduce mapped-without-price → **UNPRICED**.
10. Unmap a mapping → **UNMAPPED**.
11. Verify audit log for map/unmap/non-billable.
12. Attempt map on another tenant’s test id → not found.
13. User without `patient.update` cannot mutate mapping.
14. Create L2 Laboratory order for an unmapped test → succeeds.
15. Confirm clinical ordering still works.
16. Confirm **no** Billing charge / OpdBill created.
17. Confirm **no** CCMS claim created.
18. Confirm **no** payment created.
19. Confirm P360 / Laboratory worklist intact.
20. Confirm L2 Order Composer was **not** redesigned (no Order Summary / prices).

**Do not mark manual UAT passed automatically.**

---

## 15. Known limitations

- ServiceVariant is global; “tenant-scoped SV” wording in PO docs is repository-inaccurate.
- Branch-aware `variant_prices.branch_id` override not applied by current resolver path.
- Lab commercial UI does not show monetary amounts (FIN-VIS).
- Existing catalog remains largely UNMAPPED until human mapping (no auto-map / no fake prices).
- AuthService process may need restart after build if it was stopped for DLL unlock during tests.

---

## 16. Explicit out-of-scope

L3-UX-01 Order Summary · L3-COM-02 charge posting · BillChargeSource · OpdBill · payments · insurance/CCMS · specimen/accession/results · QC · LIS/FHIR/HL7 · Laboratory ledger · new financial permissions · Order Composer redesign · L3 routing / notifications / lifecycle.

---

## 17. Follow-up dependencies

| Item | Owner / slice |
|---|---|
| L3-COM-01 Manual UAT / acceptance | Human / PO |
| Branch-aware ResolveVariantAsync | Billing implementation design |
| L3-UX-01 Order Summary | After FIN-VIS UX + COM-01 acceptance |
| L3-COM-02 charge posting | After BILL-01/04/05/06 + PAY-01 |
| Optional Security Decision if `patient.update` is too broad for mapping | Security |

---

## Final status

```text
L3-COM-01 IMPLEMENTATION COMPLETE
AUTOMATED TESTS COMPLETE
MANUAL UAT READY
L2 ACCEPTANCE NOT CLAIMED
PROGRAM WAIVER USED FOR L3-COM-01
NO CHARGE POSTING IMPLEMENTED
NO LAB FINANCIAL LEDGER
L3-COM-02 NOT STARTED
NEXT GATE = L3-COM-01 MANUAL UAT / ACCEPTANCE
```
