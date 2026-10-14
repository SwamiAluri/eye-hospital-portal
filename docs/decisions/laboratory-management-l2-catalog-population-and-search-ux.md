# Laboratory Management — L2 Catalog Population + Search UX

**Date:** 2026-10-07  
**Type:** L2 SUB-PHASE IMPLEMENTATION  
**Authorization:** Product Owner authorized legitimate catalog bootstrap + Patient-style search UX  
**Status:** IMPLEMENTATION COMPLETE — MANUAL UAT REQUIRED

```text
STATUS: IMPLEMENTATION COMPLETE — MANUAL UAT REQUIRED

AUDIT: PASS
CATALOG BOOTSTRAP: PASS
CBC: FOUND (CBC001, CBC)
ACTIVE TEST COUNT: 36
ACTIVE PANEL COUNT: 0
ORDERING CLINICIAN: PASS (patient.view least-privilege preserved)
PATIENT-STYLE SEARCH UX: PASS
AUTOMATED TESTS: Backend 50 passed; Frontend 55 passed
RUNTIME VERIFICATION: AuthService bootstrap imported=36 cbc=True; listening :5073
DATABASE: no new schema migration (bootstrap into existing clinical catalog tables)
CERTIFIED REGRESSION: PASS (Slice 4 + L1 + P360 clinical)
MANUAL UAT: REQUIRED
ACCEPTANCE: NOT CLAIMED
L3: NOT STARTED
```

---

## 1. Audit findings

| Surface | State before this pass |
|---|---|
| `laboratory_test_definitions` | 0 rows |
| `laboratory_panels` | 0 rows |
| `lab_test_catalog` | 81 active (Counsellor/Pre-Op + Imaging/Scan mixed) |
| Runtime search | Correct API; empty because no clinical definitions |
| Ordering clinician | Already on `/laboratory/catalog/ordering-clinicians` + `patient.view` |
| Test/Panel UX | Popover/Command (not Patient-style) |

Live `lab_test_catalog` columns do **not** include `description` / `is_pre_operative` (EF entity has extras). Bootstrap uses a column projection to avoid that schema drift.

---

## 2–3. Catalog sources & ownership

| Source | Owner | Clinical Lab? | Commercial? | Bootstrap? |
|---|---|---|---|---|
| `LabTestCatalog` (`test_type=Lab`) | Counsellor / Pre-Op | Yes (eligible) | Has price (ignored) | **Yes — controlled** |
| `LabTestCatalog` (`Imaging`/`Scan`) | Diagnostics imaging | No | — | **No** |
| Service Catalog / ServiceVariant | Billing | Commercial only | Yes | No auto-link (no FK in LabTestCatalog) |
| `LaboratoryTestDefinition` | Laboratory | SoT after bootstrap | Optional SV | Target |
| `LaboratoryPanel` | Laboratory | Yes | — | None in source |
| Imaging/Scanning catalogs | Imaging | No | — | No |

---

## 4–5. Mapping rules & bootstrap strategy

**Eligible:** `test_type = Lab`, has `test_code`, not Imaging/Scan, not Cardiac/Cardiac Investigations, not specimen `N/A`, not ECG/Echo/BP names/codes, tenant null or India Eye UAT tenant.

**Identity:** `LocalCode` (unique) + tenant. Different codes for same display name (e.g. `CBC` vs `CBC001`) remain **separate** definitions.

**Mechanism:** `LaboratoryClinicalCatalogBootstrap.EnsureFromLabTestCatalogAsync` — Development/UAT/Testing only, idempotent, invoked from `Program.cs` (same pattern as Lab UAT account bootstrap).

**Runtime SoT:** Search continues to use `LaboratoryTestDefinition` / `LaboratoryPanel` only — never live-queries `LabTestCatalog`.

---

## 6–12. Reconciliation (runtime India Eye tenant)

| Metric | Count |
|---|---|
| Source laboratory records (`lab_test_catalog` active) | 81 |
| Eligible | 36 |
| Imported | 36 |
| Already existing | 0 (first run) |
| Excluded | 45 |
| Active tests after bootstrap | 36 |
| Active panels | 0 |
| With specimen | 20 |
| Without specimen | 16 |
| Linked ServiceVariant | 0 |
| Analytes | 0 (none in source; not fabricated) |

**Exclusion buckets (summary):** non-Lab Imaging/Scan; Cardiac/ECG/Echo/BP; specimen N/A.

**CBC verification:**

| LocalCode | Name | Category | Specimen | TAT |
|---|---|---|---|---|
| CBC001 | Complete Blood Count (CBC) | Haematology | Blood (EDTA) | 4h |
| CBC | Complete Blood Count (CBC) | Pre-Operative Panel | (none in source) | — |

**Panels:** none imported (no legitimate panel membership in source).  
**Analytes:** empty.  
**ServiceVariant:** all null.  
**Missing metadata:** description (not on live LabTestCatalog schema), method, LOINC/SNOMED (not invented).

---

## 13–18. UX / API / permissions

### Test / Panel
PatientSearchAutosuggest pattern: search input + absolute listbox, 2-char min, 250ms debounce, Arrow/Enter/Escape, Clear, `z-[100]`, Laboratory Tests / Panels groups.

### Ordering clinician
Same Patient-style pattern. Endpoint: `GET /api/laboratory/catalog/ordering-clinicians` with **`patient.view`**. `skipForbiddenRedirect: true`. Does **not** use `/users/doctors/search` / `user.view`.

### Lab Technician grants (unchanged)
`laboratory.view`, `patient.view`, `patient.update`

---

## 19–21. API / DB / Add catalog test

- No new tables. Bootstrap writes into existing L2 clinical catalog tables.
- `POST /laboratory/catalog/tests` now rejects duplicate `LocalCode` per tenant.
- Add catalog test continues to create `LaboratoryTestDefinition` (not LabTestCatalog).

---

## 22. Tests and exact results

```text
Backend filter (bootstrap + catalog + L1 worklist + Slice 4):
Passed!  - Failed: 0, Passed: 50, Skipped: 0

Frontend (L0 + L1 + L2 catalog + UAT defects + population UX + P360 clinical):
Test Files  6 passed | Tests  55 passed
```

---

## 23. Runtime verification

```text
✓ Laboratory clinical catalog bootstrap: imported=36 existing=0 eligible=36 excluded=45 cbc=True
Now listening on: http://localhost:5073
```

---

## 24. Manual UAT checklist

1. Login as Lab Technician  
2. Open Laboratory Management  
3. Order New Test  
4. Search/select patient  
5. Test/Panel looks like Patient search  
6. Search CBC  
7. CBC appears (CBC001 and/or CBC)  
8. Select CBC  
9–12. Verify name / code / category / specimen (derived)  
13. Test Code not editable  
14. Category not arbitrary  
15–16. Ordering clinician Patient-style search  
17–18. Select doctor; no Access Denied  
19. Authoritative clinician  
20–21. Indication + notes  
22–24. Create order; worklist; metadata  
25. Patient 360 Laboratory  
26. Slice 4 Documents  
27–28. Lab Manager essential checks  
29. Authorization boundaries  

---

## 25–26. Limitations & L3+ deferrals

- No fabricated panels/analytes/reference ranges.  
- Pre-Op “Surgical Profile” imported as a **test** (source had no panel membership).  
- Dual CBC codes preserved deliberately.  
- L3–L16 out of scope (routing, specimen, results, verify, QC, FHIR/HL7/LIS, Counsellor bridge, etc.).

---

## 27. Acceptance status

```text
ACCEPTANCE: NOT CLAIMED
L3: NOT STARTED
```
