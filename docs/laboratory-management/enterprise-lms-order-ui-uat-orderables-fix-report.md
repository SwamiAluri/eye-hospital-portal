# L-ORD-01C UAT — Orderables Blocker — Fix Report

**Date:** 2026-10-09  
**Status:** `TECHNICAL_FIX_COMPLETE — RESUME_MANUAL_UAT`  
**L-ORD-01C acceptance:** Not granted

---

## 1. Exact root cause

**A. No valid UAT orderable catalogue data** (also **C** / **D** as consequences for prior L-CAT-01 rows).

LaboratoryApi `GET /api/lms/catalogue/orderables` was correct. The UAT tenant had **zero** Active, currently effective, orderable catalogue versions with `CurrentActiveVersionId` set.

## 2. Exact evidence

| Check | Result |
|---|---|
| Composer request | `GET /api/lms/catalogue/orderables?operatingBranchId=74c014cf-9570-4824-bdf9-b369ea11a8f4&page=1&pageSize=25` (+ optional `search=t`) |
| Before fix | **200** `{"items":[],"totalCount":0}` |
| Auth | Admin JWT tenant `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Branch | Downtown Hospital `74c014cf-9570-4824-bdf9-b369ea11a8f4` |
| Active versions in tenant | **0** before fix |
| Items with `current_active_version_id` | **0** before fix |

`ListOrderablesAsync` enforces the five approved predicates (Active + current-active join, effective window, branch applicability / tenant-wide, Orderable, parent not deleted). Empty `[]` was correct.

## 3. Catalogue records inspected

| Item | Type | Latest status | CurrentActiveVersionId | Notes |
|---|---|---|---|---|
| `ceaa49bd-…` (UAT Test 003 / L-CAT-01) | TEST | Retired v2 | null | Was Active in L-CAT-01; retired; EffectiveTo past |
| `f7dd25b6-…` (UAT Test 001) | TEST | Retired | null | Not orderable |
| `a2b5d5a3-…` (Testing) | PANEL | Approved | null | Not Active; **0 panel components** (cannot Activate safely for submit) |

| Candidate | Active | Effective Now | Branch Applicable | Orderable | Parent Not Deleted | Included? |
|---|---|---|---|---|---|---|
| UAT Test 003 v2 | Fail (Retired) | Fail | Pass (tenant-wide) | Pass | Pass | Excluded |
| UAT Test 001 | Fail (Retired) | Fail | Pass | Pass | Pass | Excluded |
| Panel Testing | Fail (Approved) | Pass | Pass | Pass | Pass | Excluded |

## 4. API correct or defective?

**API correct.** No LaboratoryApi / Orders UI / Pathology code change.

## 5. Exact fix applied

Used existing L-CAT-01B catalogue lifecycle API (Admin `*`):

1. `POST /api/lms/catalogue` — create Draft TEST  
2. `POST …/submit-review`  
3. `POST …/approve`  
4. `POST …/activate` with `effectiveFrom` = UTC yesterday (open `effectiveTo`)

**Created UAT orderable:**

| Field | Value |
|---|---|
| Item id | `5a078cb7-8778-4cff-b39f-8a7e737c37f9` |
| Version id | `d0c22738-c883-4b93-bc7d-51b348eeab39` |
| Type | TEST |
| Code | `UAT-ORD-01C-001` |
| Display name | `UAT Orderable CBC` |
| Status | **Active** |
| Orderable | true |
| EffectiveFrom | `2026-10-08T06:41:08Z` |
| EffectiveTo | null |
| Branch | tenant-wide (no applicability rows) |
| Soft-deleted | false |

## 6. Source code changed?

**No.**

## 7. Database / configuration changed?

**Yes — UAT catalogue data only** via approved lifecycle (new Active TEST). No SQL bypass. No new migration. No schema change.

## 8. Files changed

None in application source. Report only: this file (and prior diagnosis doc already present).

## 9. Tests / live verification

| Check | Result |
|---|---|
| Downtown orderables | **200** `totalCount: 1` — UAT Orderable CBC |
| Search `t` / `UAT` | **200** includes the item |
| Other tenant | **200** empty |
| No auth | **401** |
| Tenant-wide other branch | **200** includes item (expected for tenant-wide) |
| LaboratoryApi Order + Catalogue (+ Pathology-related filter) | **53 passed** |
| AuthService LMS catalogue/orders permission tests | **4 passed** |
| FE L-ORD-01C vitest (`orders-ui`, `lms-orders.api`, `l0-foundation`) | **27 passed** |

## 10. Confirmations

- Pathology unchanged  
- No Collection/Specimen functionality added  
- No new LMS product scope  
- L-ORD-01B order semantics preserved  
- Order Intake SoT remains `GET /api/lms/catalogue/orderables`  
- Permission for orderables remains `lms.orders.create` (Admin `*` used for UAT)

## 11. Next Manual UAT step

1. Open `/dashboard/lms/orders`  
2. **New Order** with operating branch **Downtown Hospital**  
3. Confirm Tests / Panels shows **UAT Orderable CBC** (`UAT-ORD-01C-001`)  
4. Select it → appears under **SELECTED**  
5. Continue L-ORD-01C sequence: Save Draft → Submit → Detail → Amend → Version History → Cancel → Concurrency → boundary checks  

Do **not** treat this as L-ORD-01C acceptance.

**STOP** — resume Manual UAT. Do not proceed to Collection.
