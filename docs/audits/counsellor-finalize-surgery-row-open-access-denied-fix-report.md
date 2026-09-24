# Counsellor Operational Access — Finalize Surgery Row Open Access Denied

**Status:** Implementation complete — READY FOR MANUAL UAT  
**Date:** 2026-09-20  
**UAT user example:** `counsellor4@hospital.com`  
**Classification:** Implementation defect (A) — not a product permission-matrix gap

---

## 1. Root Cause

Exact failing authorization check:

| Layer | Detail |
|---|---|
| Trigger | Finalize Surgery row click opens `FinalizeOtModal` |
| Bootstrap call | `counsellorsDeskApi.getAnesthetists()` → `GET /users/anesthetists` |
| Backend policy | `[RequirePermission("user.view")]` on `UsersController.GetAnesthetists` |
| Counsellor baseline | Has `counseling_sessions.read`; **does not** have `user.view` (PD-RBAC-01) |
| Client effect | Axios 403 interceptor hard-redirects to `/dashboard/unauthorized` → “Access Denied / You don't have permission to access this resource.” |

List access succeeded because list + surgeons + theaters already use `counseling_sessions.read`. Anaesthetist lookup was the missed sibling of the certified surgeons/theaters least-privilege pattern.

This is **not**:
- a Finalize Surgery list vs detail permission mismatch (`both` use `counseling_sessions.read`)
- a ProtectedRoute mismatch on the list page
- an ownership gate
- a branch-model failure for rows already visible on the list

---

## 2. Click Path

```
Finalize Surgery list
  ProtectedRoute → counseling_sessions.read
  GET /Counseling/ot-schedule → counseling_sessions.read + Slice 9 branch filter
       ↓ row click (openRow)
FinalizeOtModal (in-page modal — no route change)
  Promise.all:
    GET /Counseling/ot-schedule/{id}   → counseling_sessions.read + EnsureActorCanAccessScheduleAsync
    GET /Counseling/surgeons           → counseling_sessions.read  ✅
    GET /Counseling/theaters           → counseling_sessions.read  ✅
    GET /users/anesthetists            → user.view                 ❌ FAIL (pre-fix)
       ↓ after fix
    GET /Counseling/anesthetists       → counseling_sessions.read  ✅
  (+ master_data.lookup for anesthesia types — already on counsellor baseline)
  (+ outpatient checklist GET — JWT only; edit uses counsellor.outpatient_checklist.edit)
```

Destination type: **A. Finalize Surgery detail/modal** (not Patient Details / Counselling Session route).

---

## 3. Permission Matrix (related Counsellor modules)

| Module | List / Route Permission | Detail / Bootstrap Permission | Branch Check | Counsellor Expected | Actual (pre-fix) | Change in this fix? |
|---|---|---|---|---|---|---|
| Finalize Surgery | `counseling_sessions.read` | Detail API: `counseling_sessions.read`; anesthetists was `user.view` | Slice 9 `accessibleBranches` | List + open modal | List OK; open → Access Denied | **Yes** — anesthetists → `counseling_sessions.read` |
| Waiting List | `counseling_sessions.read` | Session route: `counseling_sessions.read` | Existing follow-up/waiting branch model | Intended | Aligned | No |
| Follow-up Center | `counseling_sessions.read` | Same; mutations need `counseling_sessions.update` | Follow-up branch resolve | Intended | Aligned | No |
| Analytics | `counseling_sessions.read` | Counsellor picker: `/Counseling/counselors` (`read`) | Optional branch UX narrow | Intended | Aligned | No |
| Counselling Session | `counseling_sessions.read` | Session APIs under Counseling | Ownership separate from view | Intended | Aligned | No |
| Patient Details (Directory) | `patient.view` | Same; appointment booking gated on `appointment.view` (not granted) | Branch empty-state UX | View directory; not appointment.book | By design | No — product already decided |
| Clinical Recommendations / Comorbidities | Session-embedded counselling context | Uses counselling session permissions / existing fields | N/A | Session context only | No separate nav grant inventable | **No product decision invented** |
| Outpatient checklist (in Finalize modal) | Read: JWT; Edit: `counsellor.outpatient_checklist.edit` | On baseline | N/A | Intended | Aligned | No |

**Product decision gate:** none required for the Finalize Surgery defect.  
Related modules already share `counseling_sessions.read` for nav. No broad grants added (`user.view`, billing, claims, clinical desk, etc.).

---

## 4. Implementation

| File | Why |
|---|---|
| `microservices/auth-service/AuthService/Controllers/CounselingController.cs` | Added `GET /api/Counseling/anesthetists` with `counseling_sessions.read` (mirrors GetSurgeons). Left `UsersController.GetAnesthetists` on `user.view`. |
| `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` | Point `getAnesthetists()` at `/Counseling/anesthetists`. |
| `apps/hospital-portal-web/src/lib/counsellors-desk/anesthetist-name-match.ts` | Comment update only. |
| `AuthService.Tests/CounselingAnesthetistsLookupContractTests.cs` | Contract: Counseling = `read`; Users = `user.view` unchanged. |
| `.../counsellors-desk-anesthetists-api.test.ts` | FE path contract + runtime mock. |
| `.../finalize-surgery-row-open-auth.test.ts` | Click-path / least-privilege bootstrap contract. |
| `.../counsellor-branch-uat-hardening.test.ts` | Regression assertion for anesthetists path. |

**Not changed:** Phase 3I ownership, Waiting List redesign, branch checks, NULL BranchId behavior, role permission seeds, financial/claims permissions.

---

## 5. Security Verification

| Control | Status |
|---|---|
| Branch isolation (Slice 9) | Preserved — list + GetById still use `EnsureActorCanAccessScheduleAsync` / accessibleBranches |
| Tenant isolation | Preserved — Counseling lookups filter `TenantId` |
| Ownership (Phase 3I) | Unchanged — open/view does not Assign/Claim |
| Unauthorized without `counseling_sessions.read` | Still denied by ProtectedRoute + `[RequirePermission]` |
| `UsersController` anesthetists | Still requires `user.view` |
| No universal counsellor grant | No new role permissions; no `user.view` added to Counsellor |
| No billing/claims grants | Confirmed |

---

## 6. Tests

### Frontend (passed)

```text
npx vitest run src/lib/counsellors-desk/counsellors-desk-anesthetists-api.test.ts `
  src/lib/counsellors-desk/finalize-surgery-row-open-auth.test.ts `
  src/lib/counsellors-desk/counsellor-branch-uat-hardening.test.ts
```

Result: **3 files, 15 tests passed.**

### Backend

```text
dotnet msbuild AuthService/AuthService.csproj /t:CoreCompile /p:UseAppHost=false
```

Result: **CoreCompile succeeded** (new `GetAnesthetists` compiles).

```text
dotnet test AuthService.Tests/AuthService.Tests.csproj `
  --filter "FullyQualifiedName~CounselingAnesthetistsLookupContractTests|FullyQualifiedName~CounselingSurgeonsLookupContractTests|FullyQualifiedName~CounselingTheatersLookupContractTests"
```

Full `dotnet test` could not copy `AuthService.dll` while process **AuthService (PID locked)** held the output file. Restart AuthService, then re-run the filter above before/during UAT. Contract tests are reflection-based (same pattern as Surgeons/Theaters).

**Deploy note:** Restart AuthService so `GET /api/Counseling/anesthetists` is live. Frontend alone pointing at the new path will soft-fail the dropdown (empty list) without Access Denied; both FE + restarted BE are required for full UAT.

---

## 7. UAT Checklist

### A. Finalize Surgery
- [ ] Login as Downtown counsellor (e.g. `counsellor4@hospital.com`)
- [ ] Open Finalize Surgery; clear date; see authorized rows
- [ ] Click a row → Finalize OT modal opens (**no Access Denied**)
- [ ] Anaesthetist dropdown loads or shows soft empty/error (not hard redirect)

### B. Branch isolation
- [ ] Banjara-only user cannot open Downtown schedule detail (403 stays denied)
- [ ] Downtown counsellor does not see Banjara-only rows

### C. Patient Details
- [ ] From Counsellor workflow with `patient.view`, Patient Directory opens as today
- [ ] Planned consultation still gated without `appointment.view`

### D. Follow-up Center
- [ ] Opens with `counseling_sessions.read`

### E. Analytics
- [ ] Opens with `counseling_sessions.read`; counsellor picker works without `user.view`

### F. Clinical context / comorbidities
- [ ] Only existing counselling-session context; no new clinical modules exposed

### G. Unauthorized
- [ ] User without `counseling_sessions.read` cannot open Finalize Surgery
- [ ] Cross-branch detail remains denied

---

## 8. Scope Confirmation

- Phase 3I Slice 10 **NOT** started
- No ownership redesign / Assign / Claim / Reassign / 409 changes
- No Waiting List redesign
- No branch authorization weakening / NULL BranchId reintroduction
- No universal counsellor permission grant
- No billing / claims / settlement authorization changes

---

## 9. UAT Gate

**READY FOR MANUAL UAT**

(Do not mark Accepted until human UAT scenarios A–G pass.)
