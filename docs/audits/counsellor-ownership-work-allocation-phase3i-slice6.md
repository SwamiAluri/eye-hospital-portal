# Phase 3I — Slice 6 General Reassign
## Implementation Report

| Field | Value |
|-------|--------|
| **Date** | 2026-09-17 |
| **Status** | **READY FOR MANUAL UAT** |
| **D1 IAM** | Accepted — `counseling_sessions.reassign` (branch) |

---

## 1. Scope implemented

Supervisory General Reassign: owned counselling session **A → B** with required reason, expected-previous-owner concurrency, dual History/Audit (`OwnershipReassigned`), Waiting List Reassign CTA/dialog, History UI label.

## 2. Files changed

### Backend
- `CounselingWorkflowService.cs` — `ReassignSessionAsync`; `OwnershipAuditEvents.Reassigned`; `StageOwnershipTrailAsync` optional `reason`
- `ICounselingWorkflowService.cs` — interface method
- `CounselingController.cs` — `POST sessions/{id}/reassign` + `[RequirePermission("counseling_sessions.reassign")]`
- `CounselingWorkflowModels.cs` — `ReassignCounselingSessionRequest`

### Frontend
- `counselling-auth.ts` — reassign permission constant + visibility/eligibility helpers
- `counsellors-desk.api.ts` — `reassignSession`
- `WaitingListReassignDialog.tsx` — new (Assign dialog pattern)
- `WaitingListWorkRow.tsx` — Reassign CTA
- `waiting-list/page.tsx` — wiring
- `SessionHistoryModal.tsx` — `OwnershipReassigned` display

### Tests
- `Phase3ISlice6ReassignOwnershipTests.cs`
- `Phase3ISlice6ReassignContractTests.cs`
- `counselling-reassign-capability.test.ts`
- `counsellors-desk.assign.api.test.ts` (reassign case)

## 3. API contract

```http
POST /api/Counseling/sessions/{id}/reassign
Permission: counseling_sessions.reassign

{
  "counselorId": "<Guid B>",
  "expectedCounselorId": "<Guid A>",
  "reason": "<required free text>"
}
```

Errors: 400 / 403 / 404 / 409 per existing Assign/Claim mapping.

## 4. Authorization

- Controller: `counseling_sessions.reassign` only
- Not authorized by `.update` alone
- No hard-coded Supervisor role
- Actor branch access via `FollowupBranchAccessService`

## 5. Target eligibility

Reuses Assign foundation: `IsAssignableCounsellorAsync`, same tenant, session-branch access, not soft-deleted.

## 6. Lifecycle rules

| State | Behavior |
|-------|----------|
| Pending (Waiting) + owned | Allowed; remains Waiting/Pending; no Start |
| Processing (InProgress/Called) | Allowed; state unchanged |
| Completed/Done/Repeat | Rejected — use Claim |
| SurgeryDone | Rejected |
| NULL owner | Rejected — use Assign |
| A→A | Rejected; no trail |

## 7. Atomic mutation

`ExecuteUpdateAsync` WHERE `CounselorId == expectedCounselorId` (tracked fallback for InMemory). Zero rows → 409. No Version column.

## 8. Conflict / 409

Mismatched expected owner → Conflict; no History/Audit. FE toast + list refresh.

## 9–10. History + Audit

Successful path: `StageOwnershipTrailAsync` with `OwnershipReassigned`, source `Reassign`, intent `GeneralReassign`, free-text reason. Same transaction as mutation.

## 11. Frontend UX

- CTA when `hasPermission(reassign)` + owned Pending/Processed
- Dialog: current owner, eligible peers (excludes current), required reason
- Success toast + Waiting List invalidate/refetch
- No notifications / realtime

## 12–14. Automated test results

| Suite | Command | Result |
|-------|---------|--------|
| Slice 6 (+ D1) BE | `dotnet test …AuthService.Tests --filter Phase3ISlice6` | **Passed: 24 / Failed: 0** |
| Phase 3I regression (root) | `dotnet test …/AuthService.Tests --filter Phase3ISlice5\|Slice3Assign\|LifecycleClaim\|Slice4\|Pending` | **Passed (exit 0)** |
| FE Slice 6 + assign API | `vitest run counselling-reassign-capability + assign.api` | **Passed: 10 / Failed: 0** |
| FE history Slice 5 | `session-history-slice5.test.tsx` | **Passed: 9** (earlier run) |

## 15. Pre-existing failures

None observed in targeted suites. (Earlier IpBilling catalog count was fixed in D1 task.)

## 16. Slice 7+ not implemented

Confirmed: no Version; no Requeue→NULL; no Finalize/Follow-up/Analytics/Leave changes; no notifications.

## 17. Manual UAT checklist

| ID | Scenario |
|----|----------|
| UAT-01 | Admin/reassign permission: Pending owned A→B; stays Pending read-only; no Start |
| UAT-02 | Processing A→B; state stays Processing; no restart |
| UAT-03 | Counsellor with `.update` only: no Reassign UI; API 403 |
| UAT-04 | A→A rejected; no History/Audit |
| UAT-05 | NULL→B via Reassign rejected; Assign still works |
| UAT-06 | Stale expected owner → 409; no overwrite |
| UAT-07 | History: OwnershipReassigned, Actor/From/To/Reason |
| UAT-08 | Immutable Audit OwnershipReassigned |
| UAT-09 | Done/Repeat: no Reassign; Claim unchanged |
| UAT-10 | Cross-branch session/target rejected |
| UAT-11 | Mobile/responsive dialog |
| UAT-12 | Keyboard/a11y on dialog |

**Apply migration 196** (or restart AuthService for C# seeder) and **re-login** so JWT includes `counseling_sessions.reassign` for Admin.

## 18. Unresolved decisions

None for Slice 6. Non-Admin supervisors still receive `.reassign` via IAM role editing (PD-SUP-01) — no seeded Supervisor role.

### Explicit confirmations

- `counseling_sessions.reassign` is the authorization boundary  
- `.update` alone does **not** authorize Reassign  
- No hard-coded Supervisor role  
- Assign / Claim / Pending read-only / owner ACL unchanged  
- Pending remains Pending after reassign  
- Processing remains Processing  
- Completed/Done, Repeat, SurgeryDone excluded  
- NULL→B remains Assign  
- A→A no mutation/trail  
- expected mismatch → 409  
- no Version  
- History + Audit on success  
- no notifications  
- no downstream ownership workflow changes  

**STOP — READY FOR MANUAL UAT**
