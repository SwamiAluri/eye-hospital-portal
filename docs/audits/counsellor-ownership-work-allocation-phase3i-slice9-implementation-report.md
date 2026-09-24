# Phase 3I — Slice 9 Implementation Report

**Phase 3I — Counsellor Ownership & Work Allocation**  
**Slice 9 — Finalize / Post-Surgery Ownership Boundaries**  
**Date:** 2026-09-18  
**Gate:** IMPLEMENTATION COMPLETE — STOP FOR MANUAL UAT

---

## Audit preamble (required)

### Files re-inspected before coding

**Backend:** `CounselingController` OT endpoints, `OtFinalizeService` / `IOtFinalizeService`, `OtFinalizeSchedule`, `InternalOtSyncController` / `MarkSurgeryDoneAsync`, `FollowupListService.GetPostSurgeryAsync`, `FollowupBranchAccessService` / `ResolveFollowupBranchesAsync`, `CounselingWorkflowService` Assign/Claim/Reassign/ReQueue SurgeryDone guards, `CounselingSession.BranchId`, `OtFinalizeAuditLog`, ownership trail helpers.

**Frontend:** `finalize-surgery/page.tsx` cancel toast, `FinalizeOtModal.tsx`, `surgery-followup` Post-Surgery tab, `counsellors-desk.api.ts` cancel/list clients, finalize authorization tests.

### Confirmed vs readiness audit

| Finding | Still true? |
|---------|-------------|
| Finalize has no Counsellor owner / no CounselorId | Yes |
| Upsert did not set `BranchId` | Yes (pre-fix) |
| GetFinalizeList was tenant-only | Yes (pre-fix) |
| Assign lacked SurgeryDone guard | Yes (pre-fix); Claim/Reassign/ReQueue already rejected |
| MarkSurgeryDone does not clear CounselorId | Yes |
| Post-Surgery = discharged journey; no ownership join | Yes |
| Cancel toast claimed “counselling session re-queued” | Yes (pre-fix) |

---

## 1. Scope

Implemented approved PD-S9-01…25 for Finalize / Post-Surgery ownership boundaries only:

- Finalize Surgery remains a **shared** operational queue with **no** counsellor owner
- Post-Surgery remains **shared / unowned** (assignment deferred — D6)
- Finalize **branch authorization** (list + mutations) via existing `FollowupBranchAccessService`
- `OtFinalizeSchedule.BranchId` populated from linked `CounselingSession.BranchId`
- Assign rejects SurgeryDone (seal ownership mutations; retain historical CounselorId)
- CounselorId non-propagation invariants + automated coverage
- Truthful Finalize Cancel toast (no Auth ReQueue / no ownership release claim)
- No Slice 10 / 11 / 12 work

---

## 2. Approved Product Decisions

| PD | Status |
|----|--------|
| PD-S9-01 Finalize must NOT inherit CounselorId | **Implemented** (preserved + tests) |
| PD-S9-02 Post-Surgery must NOT auto-inherit CounselorId | **Implemented** (preserved + tests) |
| PD-S9-03 Authoritative owner sources | **Implemented** (documented boundary) |
| PD-S9-04 Shared queues; no owner / My Work filters | **Implemented** (no owner UI/filters added) |
| PD-S9-05 Do NOT implement Post-Surgery assignment | **NOT implemented (intentional)** |
| PD-S9-06 Finalize does not require counsellor assignment | **Implemented** (no Assign CTA) |
| PD-S9-07 SurgeryDone does NOT clear CounselorId; seals mutations | **Implemented** (+ Assign guard) |
| PD-S9-08 Finalize completion does not create Post-Surgery | **Preserved** |
| PD-S9-09 CounselorId not copied downstream | **Implemented** (preserved + tests) |
| PD-S9-10 Ownership identities independent | **Implemented** |
| PD-S9-11 Non-propagation regression invariant | **Implemented** (tests) |
| PD-S9-12 Finalize server-side branch authorization | **Implemented** |
| PD-S9-13 Reuse `counseling_sessions.read` / `.update` | **Implemented** |
| PD-S9-14 OT audit separate from ownership trail | **Implemented** (preserved + tests) |
| PD-S9-15 No OT Version/409 redesign | **Preserved** |
| PD-S9-16 Authoritative worklists unchanged | **Preserved** |
| PD-S9-17 Correct misleading Cancel toast | **Implemented** |
| PD-S9-18 No My Work / owner filters on Finalize/Post | **Preserved** |
| PD-S9-19 Assign rejects SurgeryDone | **Implemented** |
| PD-S9-20 Preserve Slice 8 Requeue; OT Cancel ≠ Auth ReQueue | **Preserved** |
| PD-S9-21 Follow-up Active/Cold ownership → Slice 10 | **Out of scope** |
| PD-S9-22 cancel-ot back-sync → out of scope | **Out of scope** (toast only) |
| PD-S9-23 Analytics → Slice 11 | **Out of scope** |
| PD-S9-24 Preserve historical counselling ownership | **Implemented** |
| PD-S9-25 Post-Surgery assignment SoT (D6) deferred | **NOT implemented (intentional)** |

**Post-Surgery assignment was intentionally NOT implemented.**

---

## 3. Files Changed

| File | Purpose |
|------|---------|
| `microservices/auth-service/AuthService/Services/OtFinalizeService.cs` | BranchId from session; list/mutation branch auth; heal legacy NULL BranchId from session |
| `microservices/auth-service/AuthService/Services/IOtFinalizeService.cs` | List/detail/OT-list signatures accept authorized branches / userId |
| `microservices/auth-service/AuthService/Controllers/CounselingController.cs` | ResolveFollowupBranchesAsync on OT list/detail; 403 on UnauthorizedAccessException |
| `microservices/auth-service/AuthService/Services/CounselingWorkflowService.cs` | Assign SurgeryDone guard (PD-S9-19) |
| `microservices/auth-service/AuthService/Data/Migrations/20260918220000_BackfillOtFinalizeScheduleBranchId.cs` | Safe backfill BranchId from linked counseling_sessions |
| `apps/hospital-portal-web/.../finalize-surgery/page.tsx` | Truthful cancel toast |
| `microservices/auth-service/AuthService.Tests/Phase3ISlice9FinalizeOwnershipBoundaryTests.cs` | Slice 9 ownership/branch/Assign/Post-Surgery tests |
| `microservices/auth-service/AuthService.Tests/Phase3ISlice9ContractTests.cs` | Contract guards |
| `apps/hospital-portal-web/.../finalize-cancel-toast-slice9.test.tsx` | Cancel toast FE contract |
| `AuthService.Tests/Services/OtFinalize*.cs` (4 files) | Ctor + BranchId/UserBranch fixtures for OT regressions |

---

## 4. Backend Changes

### Finalize branch authorization (PD-S9-12)

- **Branch source:** linked `CounselingSession.BranchId` only (not client/browser/selected-branch invention).
- **Upsert INSERT:** requires session branch; sets `OtFinalizeSchedule.BranchId`; validates actor via `ResolveAccessibleBranchesAsync`.
- **Upsert UPDATE / mutations:** heal NULL `BranchId` from session when authoritative; then enforce actor branch access.
- **GetFinalizeList / GetOtList:** `TenantId AND DeletedAt == null AND BranchId IN authorizedBranches`. Empty authorized set → empty list.
- **GetById + all staff mutations:** same branch boundary server-side.
- **Internal MarkSurgeryDone / Reopen:** unchanged (no staff branch gate on internal key path).
- **Permissions:** unchanged `counseling_sessions.read` / `.update`.

### Assign SurgeryDone guard (PD-S9-19)

- `AssignSessionAsync` rejects linked OT `SurgeryDone` with `BadRequest` / message containing `SurgeryDone` / `cannot be assigned`.
- Does **not** clear `CounselorId`; does **not** write ownership History/Audit on rejection.
- Claim / Reassign / ReQueue SurgeryDone guards remain as certified.

### CounselorId non-propagation

- No `CounselorId` on `OtFinalizeSchedule`; service does not copy/clear counselling ownership on OT paths.
- SurgeryDone retains historical `CounselingSession.CounselorId`.

### Audit separation

- Finalize continues to write `OtFinalizeAuditLog` only.
- No `StageOwnershipTrailAsync` / Ownership* events for ordinary OT Finalize operations.

---

## 5. Frontend Changes

- Cancel success toast: `` `${patientName} surgery schedule cancelled.` ``
- Does **not** say counselling was re-queued / ownership released.
- No Owner / Assigned To / My Work columns on Finalize (unchanged).
- No Post-Surgery assignment UI.
- Optional `branchId` query accepted by BE; FE list continues to rely on server authorized-branch set when omitted (security not FE-dependent).

---

## 6. Database

| Item | Detail |
|------|--------|
| Schema change | **None** — `ot_finalize_schedule.branch_id` already existed |
| Migration | `20260918220000_BackfillOtFinalizeScheduleBranchId` — UPDATE from `counseling_sessions.branch_id` where OT BranchId IS NULL and session branch is NOT NULL |
| New tables / owner columns | **None** |
| FollowUps table | **Not created** |

**Legacy limitation:** rows with NULL BranchId and no resolvable session branch remain excluded from branch-filtered lists (not invented).

---

## 7. API Contract

| Endpoint | Change |
|----------|--------|
| `GET /api/Counseling/ot-schedule` | Optional `branchId`; response filtered to authorized branches; 403 if requested branch unauthorized |
| `GET /api/Counseling/ot-list` | Same branch resolution |
| `GET /api/Counseling/ot-schedule/{id}` | 403 if actor unauthorized for schedule branch |
| OT mutations (upsert/slot/confirm/finalise/cancel/reopen/prepare/details) | 403 on cross-branch / unresolved branch |
| `POST …/sessions/{id}/assign` | SurgeryDone → rejected (existing error contract) |
| Post-Surgery GET | **Unchanged** |

---

## 8. Ownership Boundary

| Surface | Ownership |
|---------|-----------|
| Counselling | `CounselingSession.CounselorId` (authoritative) |
| Finalize Surgery | **Shared / no counsellor owner** |
| Post-Surgery (Slice 9) | **Shared / unowned**; assignment deferred (D6) |
| SurgeryDone | Historical CounselorId **retained**; ownership mutations **sealed** (Assign/Claim/Reassign/Requeue rejected) |
| OT finalizer | Represented in `OtFinalizeAuditLog` actor fields — **not** counselling owner |

---

## 9. Tests

| Command | Passed | Failed | Skipped |
|---------|--------|--------|---------|
| `dotnet test microservices/auth-service/AuthService.Tests --filter FullyQualifiedName~Phase3ISlice9` | **16** | **0** | **0** |
| `dotnet test microservices/auth-service/AuthService.Tests --filter FullyQualifiedName~Phase3ISlice3\|…Slice6\|…Slice7\|…Slice8\|…Slice9` | **87** | **0** | **0** |
| `dotnet test AuthService.Tests --filter FullyQualifiedName~OtFinalize\|…Phase3ISlice3\|…Phase3ILifecycle\|…Phase3ISlice4\|…Phase3ISlice5\|…FollowupList\|…FollowupBranch` | **123** | **0** | **0** |
| `vitest run finalize-cancel-toast-slice9.test.tsx requeue-slice8.test.tsx finalize-ot-authorization.test.ts` | **18** | **0** | **0** |

---

## 10. Regression

| Slice | Result |
|-------|--------|
| 3 Assign | Green; only additive SurgeryDone reject |
| 4 Owner ACL | Unchanged / green in filtered suite |
| 5 History/Audit | Unchanged; Finalize does not emit Ownership* |
| 6 Reassign | Unchanged; SurgeryDone still rejected |
| 7 Version/409 | Unchanged; CounselingSession CAS preserved |
| 8 Requeue | Unchanged; OT Cancel still does **not** call Auth ReQueue |

---

## 11. Manual UAT Matrix

| ID | Scenario | Expected |
|----|----------|----------|
| UAT-01 | Finalize Branch Visibility | Branch A user sees Branch A Finalize; not Branch B |
| UAT-02 | Finalize Cross-Branch Mutation | Direct mutation of Branch B record rejected; no mutation |
| UAT-03 | Finalize Ownership | No Owner / Assigned To / My Work on Finalize |
| UAT-04 | Counsellor Owner Preservation | Counsellor A owns session; staff B finalises → CounselorId remains A |
| UAT-05 | OT Non-Inheritance | OT record has no counsellor owner; finalizer in OT audit |
| UAT-06 | SurgeryDone Seal | Assign / Claim / Reassign / Requeue all rejected; CounselorId unchanged |
| UAT-07 | Post-Surgery | Discharged patient appears; no automatic owner; no Assign; shared branch list |
| UAT-08 | Finalize ≠ Post-Surgery entry | Finalize without discharge does not create Post-Surgery row |
| UAT-09 | Discharge → Post-Surgery | Existing discharge flow populates Post-Surgery SoT |
| UAT-10 | Cancel Toast | Toast describes OT cancellation; must **not** say counselling re-queued |
| UAT-11 | Slice 8 Requeue | Requeue → CounselorId NULL with certified Slice 8 behaviour |
| UAT-12 | Assign After Requeue | NULL → explicit Assign still works |
| UAT-13 | SurgeryDone Assign Guard | Assign against SurgeryDone rejected |
| UAT-14 | History Separation | OT audit shows finalizer; counselling owner historical; no false Ownership* for Finalize |

---

## 12. Known Limitations

- Legacy `ot_finalize_schedule` rows with NULL `BranchId` and no linked session branch cannot be safely classified — excluded from branch-filtered lists until data is repaired from an authoritative source.
- Full Auth-side cancel-ot / RepeatCounselling back-sync remains unimplemented (PD-S9-22).
- OT soft Version++ ≠ Slice 7 CAS (PD-S9-15 — out of Slice 9).
- Post-Surgery assignment persistence SoT (D6) unresolved — assignment not implemented (PD-S9-05 / PD-S9-25).

---

## 13. Out-of-Scope Findings

- D6 Post-Surgery assignment / FollowUps table / PatientJourney.AssignedCounselorId
- cancel-ot microservice / RepeatCounselling back-sync
- Follow-up Center Active/Cold ownership honesty (Slice 10)
- Analytics My Work (Slice 11)
- Leave / Reassignment Required (Slice 12)
- OT Version/409 redesign
- New permission taxonomy / Supervisor role

---

## 14. Gate Status

**IMPLEMENTATION COMPLETE — STOP FOR MANUAL UAT**

Do **not** treat Slice 9 as ACCEPTED.  
Do **not** claim UAT PASSED.  
Do **not** start Slice 10.
