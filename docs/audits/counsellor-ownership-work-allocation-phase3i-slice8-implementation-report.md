# Slice 8 Implementation Report

**Phase 3I — Counsellor Ownership & Work Allocation**  
**Slice 8 — Requeue → NULL / Unassigned**  
**Date:** 2026-09-18  
**Gate:** IMPLEMENTATION COMPLETE — STOP FOR MANUAL UAT

---

## Audit preamble (required)

### Files inspected

**Backend:** `CounselingController.ReQueueSession`, `CounselingWorkflowService` (Assign/Claim/Reassign/StageOwnershipTrailAsync/OwnershipAuditEvents), `CounselingSession` / `CounselorQueueItem`, `ReQueueSessionRequest`, `SessionConcurrency`, `FollowupBranchAccessService`, `AppDbContext` Version bump, Slice 5–7 tests, waiting-list GET projection, `CancelSessionAsync` / `DeleteSessionAsync` queue lifecycle.

**Frontend:** `surgery-followup/page.tsx` (inline `ReQueueModal`), `counsellors-desk.api.ts`, `ReQueuePayload`, `session-concurrency.ts`, `ContactLogModal` Version pattern, `waiting-list-lifecycle-action.ts`, `SessionHistoryModal`, Waiting List CTA helpers.

### Current Requeue flow (pre-Slice 8)

Controller-inline: load session → optional intention/type/notes → **insert new Waiting** → SaveChanges. **CounselorId retained.** No Version CAS, no branch gate, no ownership trail, no SurgeryDone guard, no active-Waiting idempotency.

### Reusable services/helpers

`CounselingWorkflowService` + `StageOwnershipTrailAsync`, Assign/Claim/Reassign ExecuteUpdate CAS, `ResolveAccessibleBranchesAsync`, `SessionConcurrency.StaleMessage`, queue `DeletedAt` soft-delete (from DeleteSession), FE `session-concurrency` + ContactLog lazy Version pattern.

### Exact mutation points

1. `POST …/re-queue` → workflow `ReQueueSessionAsync`
2. `CounselingSession.CounselorId → NULL` + `Version + 1` (CAS)
3. Soft-delete prior non-kept queue rows; reuse or create one Waiting
4. `OwnershipRequeued` History + Audit when A → NULL only

### Identified risks (mitigated)

| Risk | Mitigation |
|------|------------|
| Duplicate Waiting | Reuse existing Waiting; soft-delete other active rows |
| Historical Done + Pending both “current” | Soft-delete prior queue rows via existing `DeletedAt` (records remain auditable) |
| Stale ownership overwrite | expectedCounselorId + Version CAS; 409; no retry |
| SurgeryDone requeue | Explicit reject |

---

## 1. Scope

Implemented approved PD-S8-01…16:

- Requeue clears `CounselorId` → NULL (no auto-assign)
- Version + expectedCounselorId CAS (409 on mismatch)
- Required reason; `OwnershipRequeued` dual trail when ownership changes
- Exactly one active Waiting; historical rows soft-deleted (not hard-deleted)
- Branch authorization; reuse `counseling_sessions.update`
- Reject SurgeryDone; preserve session Status / intention / type / notes behaviour
- FE: reason, Version, expectedCounselorId, 409 handling, History label, Waiting List refresh

---

## 2. Files Changed

| File | Purpose |
|------|---------|
| `…/CounselingWorkflowService.cs` | `ReQueueSessionAsync`; `OwnershipAuditEvents.Requeued` |
| `…/ICounselingWorkflowService.cs` | Interface |
| `…/CounselingController.cs` | Thin ReQueue → service; 403/409/400/404 |
| `…/CounselorCommunicationModels.cs` | Extend `ReQueueSessionRequest` |
| `…/CounselingWorkflowModels.cs` | `ReQueueSessionResult` |
| `…/Phase3ISlice8RequeueOwnershipTests.cs` | Backend ownership/queue/trail tests |
| `…/Phase3ISlice8RequeueContractTests.cs` | Contract guards |
| `AuthService.Tests/Phase3ISlice5…` | Flip retain-owner Requeue assertion → Slice 8 pointer |
| `…/surgery-followup/page.tsx` | ReQueueModal Version/reason/CAS/409 |
| `…/counsellors-desk.api.ts` | Payload + `skipForbiddenRedirect` |
| `…/counsellors-desk.ts` | `ReQueuePayload` / response types |
| `…/SessionHistoryModal.tsx` | `OwnershipRequeued` display |
| `…/requeue-slice8.test.tsx` | FE contract + CTA + History |

---

## 3. Backend

- **Authorization:** `[RequirePermission("counseling_sessions.update")]`; service branch via `ResolveAccessibleBranchesAsync`
- **Requeue flow:** Controller → `ReQueueSessionAsync` → transaction
- **Ownership CAS:** `CounselorId == expected` + `Version == expected` → set NULL + Version+1 (ExecuteUpdate relational; tracked fallback InMemory)
- **Queue:** Soft-delete other non-deleted queue rows for session; reuse Waiting or insert one `RepeatCounselling` Waiting
- **History/Audit:** `OwnershipRequeued` only when previous owner was non-null; same transaction as mutation
- **NULL→NULL:** Allowed; no ownership event; Version still bumps on success

---

## 4. Frontend

- Required reason (trim); optional session type
- Lazy `getSession` Version; send `expectedCounselorId` from row (null if unowned)
- 409 → `isSessionConcurrencyConflict` toast + reload Version; **no auto-retry**
- Success → invalidate followups + waiting list
- History: Ownership requeued, From → Unassigned, Reason, Source Requeue

---

## 5. API Contract

`POST /api/Counseling/sessions/{id}/re-queue`

**Request:**
```json
{
  "version": 1,
  "expectedCounselorId": "guid-or-null",
  "reason": "…",
  "newIntention": "…?",
  "notes": "…?",
  "sessionType": "…?"
}
```

**Success 200:** `{ success, tokenNumber, queueItemId, message, counselorId: null, version }`  
**Errors:** 400 / 403 / 404 / 409 (stale or ownership mismatch)

---

## 6. Database

No migrations. Soft-delete uses existing `CounselorQueueItem.DeletedAt`.

---

## 7. Tests

| Command | Result |
|---------|--------|
| `dotnet test microservices/auth-service/AuthService.Tests --filter FullyQualifiedName~Phase3ISlice8` | **passed** 24 / failed 0 / skipped 0 |
| `dotnet test microservices/auth-service/AuthService.Tests --filter FullyQualifiedName~Phase3ISlice` | **passed** 71 / failed 0 / skipped 0 |
| `dotnet test AuthService.Tests --filter FullyQualifiedName~Phase3ISlice5` | **passed** 13 / failed 0 / skipped 0 |
| `vitest run` requeue-slice8 + session-history-slice5 + waiting-list-lifecycle + session-concurrency + assign.api | **passed** 50 / failed 0 / skipped 0 |

---

## 8. Regression

| Slice | Impact |
|-------|--------|
| 3 Assign | Unchanged; post-Requeue NULL enables Assign |
| 4 Owner ACL | Unchanged |
| 5 History/Audit | Requeued constant now emitted on Requeue only |
| 6 Reassign | Unchanged; still rejects NULL |
| 7 Version | Requeue now participates; shared CAS/409 patterns |

---

## 9. Manual UAT Matrix

| ID | Scenario | Expected |
|----|----------|----------|
| UAT-01 | Owned → Requeue | CounselorId NULL; WL Unassigned; exactly one active Waiting |
| UAT-02 | Requeue History | OwnershipRequeued A → Unassigned; actor + reason |
| UAT-03 | Already-unassigned Requeue | No NULL→NULL ownership event |
| UAT-04 | Assign after Requeue | Assign available; B becomes owner; no auto-assign |
| UAT-05 | Wrong/stale owner/Version | 409; no ownership restore; no dup Waiting; no trail |
| UAT-06 | Cross-branch | Rejected |
| UAT-07 | SurgeryDone | Cannot Requeue |
| UAT-08 | Duplicate Requeue | No duplicate active Waiting |
| UAT-09 | Blank/whitespace reason | Cannot submit |
| UAT-10 | Existing Follow-up Requeue path | No regression for valid callers |

---

## 10. Known Limitations

- True parallel DB race for duplicate Waiting is mitigated by reuse + soft-delete; stress under load not automated beyond sequential repeat.
- Soft-deleted historical queue rows leave WL via `DeletedAt` filter (auditable in DB / audit trail, not as live WL rows).

---

## 11. Out-of-Scope Findings

- OT Cancel / Finalize “re-queued” toast honesty (Slice 9 adjacent)
- Billing/IP outbox requeue
- Analytics My Work
- Realtime ownership push
- New permission / reason-code taxonomy

---

## 12. Gate Status

**IMPLEMENTATION COMPLETE — STOP FOR MANUAL UAT**

Do not treat Slice 8 as accepted. Do not start Slice 9 until Manual UAT acceptance.
