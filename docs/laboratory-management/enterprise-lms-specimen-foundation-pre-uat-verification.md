# L-COL-01C — Pre-UAT Authorization / Boundary Verification

**Date:** 2026-10-10  
**Status:** `PRE_UAT_VERIFICATION_COMPLETE`  
**Also:** `IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT`

---

## 1. Branch authorization finding

**Before fix:** Complete Collection did **not** authorize the actor for `CollectionTask.CollectionBranchId`. It only rejected empty Guid. That was insufficient.

**After fix (minimum correction reusing existing platform pattern):**

| Item | Detail |
|---|---|
| A. Method | AuthService `IFollowupBranchAccessService.ResolveAccessibleBranchesAsync` via `InternalLmsReferenceController.ValidateUserBranch` (`POST api/internal/lms/validate-user-branch`); LaboratoryApi `IPlatformReferenceClient.ValidateUserBranchAsync` |
| B. Call site | `SpecimenService.CompleteCollectionAsync` after Completed/branch-required checks, before Specimen create |
| C. Wrong branch + both permissions | **403** `branch_unauthorized` — Complete Collection rejected |
| D. Negative test | `SpecimenServiceTests.CompleteCollection_Rejects_Unauthorized_Branch_Even_With_Both_Permissions` + `InternalLmsValidateUserBranchTests.ValidateUserBranch_Rejects_Unauthorized_Branch` |

Permission gates (manage AND collect) remain in `SpecimenFunctions` via `LaboratoryAuthz.ForbidUnlessAllAsync`.

---

## 2. Location behavior

| Question | Answer |
|---|---|
| A. Copied from CollectionTask? | **Yes** — `Specimen.LocationText = CollectionTask.LocationText` |
| B. Browser may submit replacement? | **No** (removed from request/API client) |
| C. Server permits override? | **No** — `CompleteCollectionRequest` no longer has `LocationText` |

Override was removed because no approved product rule authorized Complete Collection location rewrite.

---

## 3. Test-count reconciliation

| Prior claim | Actual |
|---|---|
| FE 32 | Subset: collection + specimens + L0 + collection.api |
| FE 46 | Full reconciled LMS suite including orders UI/API regression |

Canonical FE command and count are recorded in the implementation report §10 (**46 passed**).

---

## 4. Files changed (this verification pass)

- `AuthService/Controllers/InternalLmsReferenceController.cs` — `validate-user-branch`
- `AuthService.Tests/InternalLmsValidateUserBranchTests.cs` (new)
- `AuthService.Tests/InternalLmsValidateUserPermissionTests.cs` — ctor update
- `LaboratoryApi/Services/PlatformReferenceClient.cs` — `ValidateUserBranchAsync`
- `LaboratoryApi/Services/SpecimenService.cs` — branch check; LocationText from task only
- `LaboratoryApi/Services/SpecimenDtos.cs` — remove LocationText from request
- `LaboratoryApi.Tests/SpecimenServiceTests.cs` — branch + location tests
- FE: `lms-specimens.api.ts`, `CollectionTaskDetailSheet.tsx`
- Docs: implementation report + this verification note

---

## 5. Tests executed

| Suite | Passed | Failed |
|---|---|---|
| LaboratoryApi.Tests (full) | 132 | 0 |
| AuthService InternalLmsValidateUserBranch + UserPermission | 8 | 0 |
| FE LMS reconciled vitest suite (6 files) | 46 | 0 |

---

## 6. Later slices

No Receiving, accession, barcode, labels, custody, aliquots, referral, testing, results, reporting, or billing was implemented.
