# L-ORD-01C UAT BLOCKER — No Orderables Returned — Diagnosis Report

**Date:** 2026-10-09  
**Mode:** Diagnosis only — no code, schema, Pathology, or Collection changes  
**Status:** `DIAGNOSIS_COMPLETE — AWAITING_REVIEW_BEFORE_FIX`

---

## A. Exact orderables request (composer equivalent)

Frontend (`OrderablesPicker` → `listLmsOrderables`):

```http
GET /api/lms/catalogue/orderables
  ?operatingBranchId=74c014cf-9570-4824-bdf9-b369ea11a8f4
  &page=1
  &pageSize=25
```

With search `t` (as typed in UAT):

```http
GET /api/lms/catalogue/orderables
  ?operatingBranchId=74c014cf-9570-4824-bdf9-b369ea11a8f4
  &search=t
  &page=1
  &pageSize=25
```

Base URL: `http://localhost:7076/api` (LaboratoryApi).  
Not `/api/lms/catalogue` admin list. Not Pathology.

## B. HTTP status

**200** for both requests (with `operatingBranchId`).

Missing `operatingBranchId` → **400** `branch_required` (expected).

## C. Response body

```json
{"items":[],"page":1,"pageSize":25,"totalCount":0}
```

Same empty result for `search=t` and `search=UAT`.

## D. Tenant ID

`155fe198-6ae5-4a01-9254-ead5b427247e` (Admin JWT / L-CAT-01 UAT tenant)

## E. Operating branch ID / name

| Field | Value |
|---|---|
| Name | Downtown Hospital |
| Id | `74c014cf-9570-4824-bdf9-b369ea11a8f4` |
| Code | `DOWNTOWN_HOSP` |
| Tenant | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Status | `active` |

Composer uses `useBranchContext().branchId` as `operatingBranchId`.

## F. Relevant catalogue rows (UAT tenant)

| Item id | Type | IsDeleted | CurrentActiveVersionId | LatestVersionId |
|---|---|---|---|---|
| `ceaa49bd-3eb7-4a96-a4eb-d303f9af185e` | TEST | false | **null** | `374db3af-…` (v2) |
| `f7dd25b6-7aba-4da8-a5b4-1ef09d6bac08` | TEST | false | **null** | `f544af89-…` (v1) |
| `a2b5d5a3-b0fc-4a95-bc48-bc57b06dbad9` | PANEL | false | **null** | `7e90b659-…` (v1) |

Versions:

| Version id | Item | Ver | Status | Orderable | DisplayName | Code | EffectiveFrom | EffectiveTo |
|---|---|---|---|---|---|---|---|---|
| `683da9a2-…` | ceaa49bd… | 1 | Superseded | true | UAT Test 002 | UAT-TEST-002 | 2026-10-08 20:33:36Z | 2026-10-08 20:33:38Z |
| `374db3af-…` | ceaa49bd… | 2 | **Retired** | true | UAT Test 003 | UAT-TEST-002 | 2026-10-08 20:38:50Z | 2026-10-08 20:44:49Z |
| `f544af89-…` | f7dd25b6… | 1 | Retired | true | UAT Test 001 - Edited | UAT-TEST-001 | 2026-10-08 20:28:45Z | 2026-10-08 20:29:01Z |
| `7e90b659-…` | a2b5d5a3… | 1 | **Approved** | true | Testing | 5678 | null | null |

Branch applicability rows for tenant: **0** (tenant-wide when Active).

Aggregate checks:

- `status = 'Active'` versions in tenant: **0**
- Items with `current_active_version_id IS NOT NULL`: **0**

## G. Predicate pass/fail (five orderable rules)

### L-CAT-01 UAT item — `ceaa49bd…` / v2 `374db3af…` (UAT Test 003)

| Predicate | Result | Evidence |
|---|---|---|
| 1. Status = Active | **FAIL** | Status = `Retired` (was Active during L-CAT-01 audit; retired 2026-10-08 20:44:49Z) |
| 2. Effective now | **FAIL** | `EffectiveTo` = 2026-10-08 20:44:49Z (past); asOf now is outside window |
| 3. Branch applicable | **PASS** | No applicability rows → tenant-wide |
| 4. Orderable = true | **PASS** | `orderable = t` |
| 5. Parent not soft-deleted | **PASS** | `is_deleted = f` |
| Join: item.CurrentActiveVersionId = version | **FAIL** | `current_active_version_id` is **null** (cleared on retire by design) |

### Item `f7dd25b6…` / v1 Retired (UAT Test 001)

| Predicate | Result |
|---|---|
| Active | **FAIL** (Retired) |
| Effective | **FAIL** (past EffectiveTo) |
| Branch | **PASS** (no rows) |
| Orderable | **PASS** |
| Parent not deleted | **PASS** |
| CurrentActiveVersionId | **FAIL** (null) |

### Panel `a2b5d5a3…` / v1 Approved (Testing)

| Predicate | Result |
|---|---|
| Active | **FAIL** (Approved, never Activated) |
| Effective | **PASS** (null open window) |
| Branch | **PASS** |
| Orderable | **PASS** |
| Parent not deleted | **PASS** |
| CurrentActiveVersionId | **FAIL** (null — never activated) |

### Is there at least one legitimately orderable TEST/PANEL for this tenant/branch?

**No.** Zero Active versions; zero items with a current active version pointer.

## H. Root cause classification

**1. UAT catalogue data/configuration**

The LaboratoryApi orderables endpoint and query behave correctly. The UAT tenant has no catalogue definition that satisfies the approved five orderable predicates simultaneously.

Contributing data facts (not separate primary classes):

- Former L-CAT-01 Active v2 was later **Retired** → no remaining Active version on that item.
- Panel “Testing” remains **Approved** only (not Activated).
- Effective windows on retired/superseded versions are closed.

Not: query defect (6), tenant mismatch (5), branch applicability misconfig as sole cause (2), Orderable flag (4). Effective-date (3) and Active status are failed as consequences of the retired/non-activated UAT catalogue state.

## I. Smallest safe fix (recommendation only — not implemented)

**Do not change application code.**

Via the existing L-CAT catalogue admin workflow (same tenant), ensure at least one TEST or PANEL has:

1. A version in status **Active**
2. `CurrentActiveVersionId` pointing at that version
3. Effective window covering “now” (open or future EffectiveTo)
4. `Orderable = true`
5. Soft-deleted = false
6. Either no branch applicability rows, or Downtown Hospital (`74c014cf-…`) explicitly included

Concrete options (catalogue configuration / UAT data only):

- **Activate** the already-Approved panel version `7e90b659-…` (“Testing”) if product allows Activate from Approved; or  
- Create a new Draft → Review → Approve → **Activate** for a UAT test/panel (or re-activate a new version of `ceaa49bd…` after creating a successor Draft).

Do **not** manually invent SQL rows unless an approved UAT seed procedure exists; prefer the certified catalogue lifecycle UI.

---

## Query vs approved rules

`CatalogueService.ListOrderablesAsync` filters:

1. Item: same tenant, `!IsDeleted`, `CurrentActiveVersionId != null`
2. Version: `Status == Active`, `Orderable == true`, joined on `CurrentActiveVersionId`
3. Effective: `EffectiveFrom <= asOf` (or null), `asOf < EffectiveTo` (or null)
4. Branch: no applicability rows for version → include; else must include `operatingBranchId`
5. Optional search/type/discipline/classification

Matches the authoritative five L-ORD orderable rules. Empty `[]` is correct for current UAT data.

---

## Confirmations

- No Pathology API involved in this path  
- No Pathology changes required  
- No Collection/Specimen work  
- No new LMS product scope  
- L-ORD-01B order semantics unchanged  
- FE correctly calls `/lms/catalogue/orderables` with `operatingBranchId`

**STOP** — diagnosis complete; no fix implemented.
