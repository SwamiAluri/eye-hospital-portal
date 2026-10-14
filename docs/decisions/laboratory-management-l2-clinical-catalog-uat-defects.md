# Laboratory Management — L2 Clinical Catalog UAT Defects

**Date:** 2026-10-07  
**Type:** L2 UAT DEFECT FIX PASS  
**Status:** FIXES COMPLETE — MANUAL UAT RE-CHECK REQUIRED

```text
L2 UAT DEFECT PASS COMPLETE
ACCEPTANCE: NOT CLAIMED
L3: NOT STARTED
```

---

## Finding 1 — Test/Panel search UI alignment

| Item | Detail |
|---|---|
| **UAT finding** | Catalog dropdown cramped; overlaps subsequent fields; not aligned with Hospital Portal searchable-select patterns |
| **Evidence** | Order New Test dialog; Popover+Command at default `z-50` same as Dialog; missing collision padding / trigger-width polish |
| **Root cause** | Implementation defect — Dialog and Popover both layer at `z-50`; picker lacked `collisionPadding`, `modal={false}`, and dialog-safe z-index used elsewhere (`SelectContent` / exam popovers use `z-[100]`) |
| **Classification** | implementation defect |
| **Fix** | Align `LaboratoryCatalogPicker` + `DoctorSearchAutosuggest` with existing Popover/Command pattern: `z-[100]`, `collisionPadding={16}`, trigger-width, `modal={false}`, clearer Laboratory Test / Panel group headings, denser option spacing |
| **Security impact** | None |
| **Tests** | FE `laboratory-l2-uat-defects.test.tsx`, updated `laboratory-l2-catalog.test.tsx` |

---

## Finding 2 — CBC search returns “No active catalog items”

| Item | Detail |
|---|---|
| **UAT finding** | Search “CBC” → empty |
| **Evidence (DB)** | `laboratory_test_definitions` count = **0** for all tenants. Legacy `lab_test_catalog` has CBC rows (`CBC`, `CBC001`) — Counsellor/Pre-Op catalog only |
| **Root cause** | **CASE D — data prerequisite**, not a search bug. Active Laboratory clinical catalog is empty. CBC exists only in legacy LabTestCatalog, which must **not** be silently promoted |
| **Classification** | data prerequisite (+ documented mapping gap) |
| **Fix** | No fake seed. Empty state now states no active items and points to **Add catalog test**. Search path already correct when definitions exist (backend test: `SearchTests_ReturnsCbcWhenActiveDefinitionExists`) |
| **Legitimate UAT path** | Lab Technician with `patient.update` → **Add catalog test** → create e.g. Name `Complete Blood Count`, Local code `CBC`, Category `hematology`, Specimen `Blood` → reopen Order New Test → search CBC |
| **Do not** | Auto-map LabTestCatalog or ServiceVariant into LaboratoryTestDefinition |
| **Security impact** | None |
| **Tests** | Backend CBC search when definition exists; FE empty-state regression; no hard-coded CBC |

---

## Finding 3 — Ordering clinician → Access Denied

| Item | Detail |
|---|---|
| **UAT finding** | labtech1 searches clinician → redirect to Access Denied |
| **Evidence** | FE called `GET /users/doctors/search` via `useDoctorSearch` / `masterDataApi.searchDoctors`. Endpoint requires **`user.view`**. Global axios interceptor hard-redirects 403 → `/dashboard/unauthorized` |
| **Root cause** | Authorization defect relative to L2 least-privilege: Lab Technician has `laboratory.view` / `patient.view` / `patient.update` but **not** `user.view`. Doctor lookup incorrectly depended on broad user-directory permission |
| **Classification** | authorization defect (endpoint choice / permission binding) — Outcome **A/D hybrid** following Counsellor surgeons pattern |
| **Fix** | Added `GET /api/laboratory/catalog/ordering-clinicians` with **`patient.view`** (returns active Doctor-role users only). FE DoctorSearchAutosuggest now uses this route with `skipForbiddenRedirect: true`. Left `GET /users/doctors/search` as `user.view` unchanged |
| **Security impact** | Lab Technician does **not** gain `user.view` or full user directory. Lookup is doctor-role-scoped, tenant-scoped, active-only |

### Permission table

| | Before | After |
|---|---|---|
| Endpoint used by L2 order form | `GET /users/doctors/search` | `GET /laboratory/catalog/ordering-clinicians` |
| Required permission | `user.view` | `patient.view` |
| Lab Technician effective grants | laboratory.view, patient.view, patient.update (no user.view) | **unchanged** |
| Unrelated user-directory access | Would require granting user.view (rejected) | **Not exposed** |

**Why least privilege:** Same pattern as `CounselingController` surgeons/anesthetists (`counseling_sessions.read` instead of `user.view`). Uses an existing Lab Technician permission already required for Laboratory reads.

---

## Tests executed

```text
Backend (LaboratoryCatalogTests | LabReportWorklistTests | LabReportCanonicalDocumentTests):
Passed!  - Failed: 0, Passed: 48, Skipped: 0

Frontend (l0 + l1 + l2-catalog + l2-uat-defects):
Test Files  4 passed | Tests  46 passed
```

---

## Remaining UAT prerequisites

1. **No active LaboratoryTestDefinition** until an operator creates one via **Add catalog test** (or API `POST /laboratory/catalog/tests`).
2. Restart AuthService with rebuild (not `--no-build`) so ordering-clinicians route is live.
3. Re-run Manual UAT checklist (selector UX, create CBC via Add catalog test, clinician search without Access Denied, create order).

---

## Remaining Manual UAT checklist

1. Lab Technician login  
2. Laboratory Management loads  
3. Order New Test → Test/Panel dropdown aligned, not overlapping fields  
4. Empty catalog message is honest  
5. **Add catalog test** → create Complete Blood Count / CBC / hematology / Blood  
6. Search CBC → select test → code/category/specimen derived  
7. Search ordering clinician (2+ chars) → **no Access Denied**  
8. Select clinician → create order  
9. Worklist row correct  
10. Slice 4 / P360 unchanged  
11. Lab Manager regression  

**Acceptance not claimed. L3 not started.**
