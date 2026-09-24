# Phase 3I — PD-A / PD-B / PD-C Verification Report

**Program:** Counsellor Ownership & Work Allocation  
**Scope:** Final verification + targeted correction for PD-A, PD-B, PD-C only  
**Date:** 2026-09-19  
**Slice 10:** NOT started  

---

## Audit

Inspected (no redesign; compare to approved matrix):

| Area | Location | Verdict |
|---|---|---|
| Create reuse | `CounselingWorkflowService.TryGetCreateSessionReuseBlockAsync` | Matches matrix |
| Create ownership | `CreateSessionAsync` (counsellor self-own / Admin NULL) | Unchanged; no inheritance |
| SurgeryDone SoT | `OtFinalizeSchedules.Status == SurgeryDone` | No session-level column |
| Assign (PD-B) | `AssignSessionAsync` | `Completed` + `PatientAgreedToSurgery != true` + NULL |
| Claim | `ClaimSessionForLifecycleAsync` | Counsellor-only — unchanged |
| Controller 409 | `MapSessionOperationResult` Conflict → 409 | Intact |
| FE duplicate | `findActiveWaitingListDuplicate` / messages | Done → ReEvaluate; Repeat → continue; SurgeryDone allowed |
| FE Assign CTA | `isWaitingListEligibleForInitialAssign` | Includes `RepeatCounselling` unassigned |
| FE lifecycle | `waiting-list-lifecycle-action` | Unassigned Repeat → Assign when `canAssign` |
| PD-A report | OT configuration gap report | Clarified surgery-capable vs all-active |

**Application code:** no behavioral correction required — implementation already satisfied the approved decisions.

**Targeted verification-only changes:**

1. Strengthened PD-C backend tests (active queue Theory; Repeat ownership/SurgeryDone assertions).
2. FE message distinction test (Repeat ≠ ReEvaluate).
3. Contract test comment aligned to PD-B page wording (`Done/owned Repeat`).
4. PD-A gap report section 5 clarified (surgery-capable verification).

---

## PD-A

| Item | Result |
|---|---|
| Code changed | **None** (configuration-only) |
| Report | `docs/audits/counsellor-ownership-work-allocation-phase3i-pda-ot-configuration-gap-report.md` |
| Mechanism | `POST /api/OTBooking/theaters` (`ot.theaters.create`) |

### Already configured

- Downtown Hospital — **3** active OTs  
- CareFirst Bangalore — **2** active OTs  

### Requires operational verification / configuration

- **Banjara Hills** — definitely included (0 OTs; Emma authorized here).  
- Other active branches with 0 OTs — **verify surgery-capability first**, then configure only branches expected to schedule surgery.

Do **not** treat every active branch as automatically requiring an OT.

---

## PD-B

Approved condition (exact):

```text
Completed
AND
PatientAgreedToSurgery != true
AND
CounselorId == NULL
```

| Check | Result |
|---|---|
| Same Assign endpoint | `POST /api/Counseling/sessions/{id}/assign` |
| Admin Assign Counsellor | Available for unassigned Repeat |
| Claim / Start-as-Admin ownership | **Not** established via Claim (counsellor-only) |
| Eligible counsellor + session branch | Preserved |
| Version / 409 | Preserved |
| History / Audit | Preserved |
| Already-owned / SurgeryDone | Rejected |

---

## PD-C

Authoritative matrix (verified):

| Condition | New session | Action |
|---|---:|---|
| Active queue work (Waiting/InProgress/Called/AddOn) | No | Existing episode |
| Done + agreed + !SurgeryDone | No | ReEvaluate |
| Completed + not agreed + !SurgeryDone | No | Repeat / existing episode |
| SurgeryDone | Yes | New episode |

| Invariant | Result |
|---|---|
| No new session while reusable episode exists | Enforced |
| ReEvaluate vs Repeat not collapsed | Distinct messages |
| SessionType unchanged | Yes |
| No ownership inheritance on new episode | Yes (Admin NULL / counsellor self) |
| Prior SurgeryDone session unchanged | Yes |

---

## Tests

### Backend (root `AuthService.Tests`, isolated output `.tmp/pdabc-verify`)

```text
dotnet test AuthService.Tests/AuthService.Tests.csproj
  --filter "FullyQualifiedName~Phase3IPdCCreateSessionReuseTests|FullyQualifiedName~Phase3ISlice3AssignOwnershipTests|FullyQualifiedName~Phase3ILifecycleClaimOwnershipTests"
  -o .tmp/pdabc-verify
→ Failed: 0, Passed: 49
```

```text
dotnet test AuthService.Tests/AuthService.Tests.csproj
  --filter "FullyQualifiedName~Phase3ISlice2|FullyQualifiedName~Phase3ISlice4|FullyQualifiedName~Phase3ISlice5|FullyQualifiedName~Phase3ISlice7|FullyQualifiedName~Phase3IPendingReadOnly"
  -o .tmp/pdabc-verify --no-build
→ Failed: 0, Passed: 40
```

### Backend Slice 8 / 9 ownership (microservice project)

```text
dotnet test microservices/auth-service/AuthService.Tests/AuthService.Tests.csproj
  --filter "FullyQualifiedName~Phase3ISlice8RequeueOwnershipTests|FullyQualifiedName~Phase3ISlice9FinalizeOwnershipBoundaryTests"
  -o .tmp/pdabc-s89
→ Failed: 0, Passed: 31
```

SurgeryDone seal covered including: cannot Assign / Claim ReEvaluate / Claim StartRepeat (plus Slice 9 boundary suite for Reassign/ReQueue seals).

### Frontend Vitest

```text
pnpm exec vitest run
  src/lib/counsellors-desk/add-patient-to-waiting-list.test.ts
  src/lib/counsellors-desk/counselling-initial-assign-capability.test.ts
  src/lib/counsellors-desk/waiting-list-lifecycle-action.test.ts
  src/lib/counsellors-desk/counselling-ownership.test.ts
  src/lib/api/counsellors-desk.assign.api.test.ts
  src/app/dashboard/counsellors-desk/waiting-list/waiting-list-lifecycle-claim.contract.test.ts
→ Test Files 6 passed | Tests 60 passed
```

### Playwright

Not added (no established ownership E2E suite). Manual UAT remains mandatory.

---

## Failures

| Class | Detail |
|---|---|
| **Pre-existing** | Microservice `Phase3ISlice8/9*ContractTests` (7): path resolution looks under `c:\Users\Sam Aluri\AuthService\...` — environment/path bug in contract file readers, not PD-A/B/C |
| **Pre-existing** | Full `tsc --noEmit` reports encoding/parse errors in `WaitingListFilterToolbar.tsx` (untouched by this task; file reads as normal source; Vitest of PD suites green) |
| **Introduced** | None remaining after contract-comment alignment |
| **Environment** | Default `dotnet test` against live AuthService.dll may file-lock; use isolated `-o .tmp/pdabc-verify` |

---

## Regression verification

| Slice | Status |
|---|---|
| 1 Waiting List branch auth | Untouched |
| 2 Admin NULL + no silent Start ownership | Passed (filter suite) |
| 3 Explicit Assign | Passed (+ PD-B extension) |
| 4 Owner mutation ACL | Passed |
| 5 Ownership History + Audit | Passed |
| 6 Reassign | Untouched in this pass; Slice 9 seal suite covers SurgeryDone reassign reject |
| 7 Version/409 | Passed |
| 8 ReQueue → NULL | Ownership suite **31 passed** |
| 9 SurgeryDone seal | Ownership suite **31 passed** |

---

## Out-of-scope findings (not changed)

- Concurrent active surgical episode / OtFinalize upsert ambiguity  
- SessionType specialization for subsequent eye  
- Prior-surgery awareness UX in Add Patient  
- Portal OT theater master admin UI  
- Owned Repeat Admin handoff / All-Branches Waiting List  
- Slice 10+  

---

## Manual UAT checklist

### PD-A

| ID | Check |
|---|---|
| UAT-A1 | Verify Banjara Hills has ≥1 active non-deleted OT after Ops configuration. |
| UAT-A2 | Verify every operational/surgery-capable branch has required OT master data. |
| UAT-A3 | Login as Emma / Banjara-authorized counsellor. Verify Schedule Surgery OT list is non-empty. |
| UAT-A4 | Verify Downtown continues to show its configured OTs. |
| UAT-A5 | Verify a branch without OT configuration returns an honest empty state. |
| UAT-A6 | Verify one branch cannot see another branch's OT data. |

### PD-B

| ID | Check |
|---|---|
| UAT-B1 | Find an unassigned RepeatCounselling session. Expected: **Assign Counsellor**, not Start as Admin. |
| UAT-B2 | Open Assign Counsellor. Verify only eligible counsellors for the session's authorized branch. |
| UAT-B3 | Assign the session. Verify CounselorId, Version, History, Audit. |
| UAT-B4 | Login as the assigned counsellor. Start Repeat using existing lifecycle behavior. |
| UAT-B5 | Verify Admin cannot use Claim-for-lifecycle. |
| UAT-B6 | Verify stale Version produces the existing 409 behavior. |

### PD-C — ReEvaluate (mandatory)

Find/create patient: Counselling Done + `PatientAgreedToSurgery = true` + SurgeryDone = false.  
Attempt new counselling → **no new CounselingSession** → ReEvaluate existing SessionId.  
Verify DB session count unchanged.

### PD-C — Repeat (mandatory)

Find/create patient: Completed + `PatientAgreedToSurgery != true` + SurgeryDone = false.  
Attempt new-counselling entry → **no new session** → existing Repeat lifecycle.  
Verify: no Session B; SessionId preserved; not ReEvaluate; Admin does not silently own.

### PD-C — Second eye / subsequent episode

Session A SurgeryDone via OtFinalizeSchedules → initiate subsequent episode → **Session B created**.  
Verify Session A ≠ B; A remains SurgeryDone/historical/same CounselorId/OT link; B follows normal Create ownership (no inherit).

---

## UAT Status

```text
READY FOR MANUAL UAT
```

```text
PD-A/B/C VERIFIED
→ AUTOMATED TESTS COMPLETE
→ READY FOR MANUAL UAT
→ STOP
```

**Do not start Slice 10. Do not mark Phase 3I accepted until manual UAT completes.**
