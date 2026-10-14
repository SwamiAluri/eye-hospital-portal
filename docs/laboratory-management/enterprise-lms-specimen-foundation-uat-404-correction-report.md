# L-COL-01C — Manual UAT Complete Collection 404 Correction Report

**STATUS:** `UAT_CORRECTION_COMPLETE_READY_FOR_RETEST`

**Do not claim L-COL-01C acceptance.** Next gate: **MANUAL UAT RETEST**.

---

## 1. STATUS

`UAT_CORRECTION_COMPLETE_READY_FOR_RETEST`

---

## 2. Exact root cause of the 404

**Stale LaboratoryApi Azure Functions host** was serving an older `bin\output\LaboratoryApi.dll` that did **not** contain `SpecimenFunctions` / `LmsCollectionCompleteCollection`.

The frontend client path and HTTP method were already correct. The browser hit LaboratoryApi (`http://localhost:7076/api/...`), not the Next.js origin. The 404 was route-missing on the stale host (same operational class as the prior Collection 404 incident), not a contract mismatch and not an authorization false-404.

**Secondary risk (would have blocked the next UAT step after Lab route fix):** AuthService on `:5073` was also stale (started 2026-10-09) and did **not** expose `POST /api/internal/lms/validate-user-branch` (404). That endpoint is required by Complete Collection branch authorization. AuthService was rebuilt and restarted so Complete Collection can proceed past route registration.

---

## 3. Exact browser request before correction

| Field | Value |
| --- | --- |
| Method | `POST` |
| Browser URL | `http://localhost:7076/api/lms/collection/tasks/{collectionTaskId}/complete-collection` |
| FE base | `NEXT_PUBLIC_LABORATORY_API_URL` default `http://localhost:7076/api` via `getLaboratoryApi()` |
| Client path | `/lms/collection/tasks/${collectionTaskId}/complete-collection` (`lms-specimens.api.ts`) |
| Body | `{ expectedCollectionTaskRowVersion, patientIdentityConfirmed: true, idempotencyKey }` |
| Observed UI error | `Request failed with status code 404` |

UAT task context: `COL-20261009-000004` / Order `LAB-20261009-000006` / patient Revathi Sundar / MRN000001 / status Completed.

---

## 4. Exact backend route actually registered

After host refresh, LaboratoryApi admin functions include:

- Function name: `LmsCollectionCompleteCollection`
- Trigger: `POST`
- Route: `lms/collection/tasks/{id:guid}/complete-collection`
- Public URL template: `http://localhost:7076/api/lms/collection/tasks/{id}/complete-collection`
- Authz: `lms.specimens.manage` **AND** `lms.collection.collect`

Unauthenticated probe after correction: **HTTP 401** (route present), not 404.

---

## 5. Exact correction made

1. Confirmed FE ↔ BE contract already matched (no duplicate endpoint created).
2. Rebuilt LaboratoryApi Debug; ensured running host loads worker DLL containing `SpecimenFunctions`.
3. Verified `func start --port 7076` exposes `LmsCollectionCompleteCollection` (function count includes Specimen routes).
4. Rebuilt and restarted AuthService (`dotnet run --launch-profile http` on `:5073`) so `validate-user-branch` is registered.
5. Applied EF migration `20261010162749_AddLmsSpecimenTables` to the configured database (`lms_specimens` tables).
6. Updated stale Collection workbench subtitle copy.
7. Detail sheet Branch label now resolves via existing `useBranchContext` (same pattern as worklist) when branch name is available.
8. Added FE↔BE Complete Collection route contract regression test.

---

## 6. LaboratoryApi restart required?

**Yes.** The failure was operational: stale Functions host / stale `bin\output` worker without Specimen routes. Restart (with current build) was required.

AuthService restart was also required for branch validation (otherwise Complete Collection would fail after the Lab route existed).

---

## 7. Exact frontend / base URL used

| Item | Value |
| --- | --- |
| LaboratoryApi host | `http://localhost:7076` |
| FE axios base | `http://localhost:7076/api` (`laboratory-service.api.ts`) |
| Complete Collection path | `/lms/collection/tasks/{id}/complete-collection` |
| Full URL | `http://localhost:7076/api/lms/collection/tasks/{id}/complete-collection` |
| AuthService (branch validate) | `http://127.0.0.1:5073` (`POST /api/internal/lms/validate-user-branch`) |

---

## 8. Tests executed and pass/fail counts

| Suite | Filter / files | Result |
| --- | --- | --- |
| LaboratoryApi.Tests | `Specimen` \| `LaboratoryAuthz` \| `CollectionService` | **Passed 48 / Failed 0** |
| AuthService.Tests | `ValidateUserBranch` | **Passed 2 / Failed 0** |
| Vitest LMS UI/API | specimen UI + collection UI + collection.api | **Passed 20 / Failed 0** (3 files) |

Includes Complete Collection service semantics, idempotency, concurrency, branch authorization, authz manage∧collect constant check, Collection regression, Specimen UI, and new FE↔BE route contract assertion.

---

## 9. Specimen creation confirmation

Automated `SpecimenServiceTests` confirm Complete Collection creates exactly one Specimen in state **Collected** for an eligible Completed task (including historical Completed-without-Specimen), and duplicate/idempotent replays do not create a second Specimen.

Live route probes after correction:

- Lab Complete Collection (no JWT): **401** (reachable)
- Auth validate-user-branch (no JWT): **401** (reachable; was **404** on stale AuthService)
- Specimen tables migration: **applied**

Manual browser retest on `COL-20261009-000004` remains the acceptance gate.

---

## 10. State preservation confirmation

Per approved semantics and automated tests (`CompleteCollection_Creates_Specimen_Collected_Without_Changing_Task_Order_Or_OrderTest`):

| Entity | Expected after Complete Collection |
| --- | --- |
| CollectionTask | remains **Completed** |
| Order | remains **Submitted** |
| OrderTest | remains **Ordered** |
| Specimen | created, state **Collected** |

No CollectionTask / Order / OrderTest lifecycle changes were implemented in this correction.

---

## 11. Stale “no Specimen in this slice” copy

**Corrected** in `CollectionWorkbench.tsx`:

- Before: `Collection planning and shared branch work queue — no Specimen in this slice`
- After: `Collection planning and shared branch work queue — Complete Collection creates Specimens`

UI regression test asserts the old phrase is absent.

---

## 12. Branch display finding

- Collection worklist already resolved branch GUID → name via `useBranchContext`.
- CollectionTask detail API exposes `collectionBranchId` only (no branch display name field).
- **Correction applied (non-blocking UX):** detail sheet now uses the same `useBranchContext` lookup to show branch name when present; falls back to GUID if not in context.
- No new branch API / product scope added.

---

## 13. DOB finding

- Detail/Complete Collection UI projects `patientDateOfBirthSnapshot` from the CollectionTask (sourced from Order version snapshot).
- Empty display (`—`) is retained when the Order patient snapshot has no DOB.
- No new patient data source; DOB is not invented.
- If UAT patient Revathi Sundar shows `DOB —`, treat as honest empty snapshot unless a later data-fix shows the Order version actually stores a DOB that the projection drops (not observed as a code drop in CollectionService mapping).

---

## 14. Later LMS slices

**Confirmed not implemented** in this correction: Receiving, Accession, Barcode, Labels, Custody, Aliquots, Referral, Testing, Results, Verification, Authorization, Reporting, Billing, Specimen Claim/Assign, Recollection UX, CollectionTask/Order/OrderTest lifecycle ownership changes, Pathology, role grants.

---

## Retest checklist (manual)

1. Ensure LaboratoryApi `:7076` and AuthService `:5073` are the restarted processes from this correction.
2. Open Completed task `COL-20261009-000004` (or equivalent eligible task).
3. Complete Collection with identity confirmation.
4. Expect HTTP success (201/200), Specimen **Collected**, states unchanged as in §10.
5. Refresh → exactly one Specimen; second Complete Collection must not create another Specimen.
