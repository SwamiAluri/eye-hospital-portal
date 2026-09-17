# Phase 3I — Lifecycle Ownership Claim (Re-evaluate / Start Repeat)

| Field | Value |
|-------|--------|
| **Date** | 2026-09-16 |
| **Status** | **IMPLEMENTED** — ready for Manual UAT gate |
| **Slice** | Bounded Phase 3I lifecycle claim (**not** Slice 6 Reassign) |

---

## Approved product decision

A counsellor may **explicitly claim** an already-owned Done / Repeat Counselling session **only** for:

- `ReEvaluate`
- `StartRepeat`

This is a **lifecycle-specific ownership claim**, not general Reassign.

**General Reassign remains governed by PD-REASSIGN-01 / Slice 6.**

---

## Why this is not Slice 6

| Lifecycle claim (this slice) | General Reassign (Slice 6) |
|------------------------------|----------------------------|
| Actor becomes owner only | Arbitrary counsellor → counsellor |
| Intent-bound (ReEvaluate / StartRepeat) | No lifecycle intent required |
| Done / Repeat only | Broader ownership transfer |
| Lightweight Assign-to-me confirm | Reassign UI / supervisor flows |
| Admin cannot use this as takeover | Admin/Supervisor reassignment |

---

## Endpoint contract

```http
POST /api/Counseling/sessions/{id}/claim-for-lifecycle
Permission: counseling_sessions.update
Body:
{
  "expectedCounselorId": "<guid>",
  "intent": "ReEvaluate" | "StartRepeat"
}
```

403 responses use FE `skipForbiddenRedirect` (stay in context).

Slice 3 `POST .../assign` remains **NULL → target only** and is reused for Done/Repeat + NULL (Assign to me) before continuing into lifecycle.

`UpdateSession(... CounselorId ...)` is **not** used for ownership transfer.

---

## Authorization rules

| Rule | Behavior |
|------|----------|
| Actor | Authenticated counsellor identity only |
| Admin | Forbidden on lifecycle claim (Slice 6 for reassignment) |
| Owner becomes | Current actor only (no peer target) |
| Tenant | Actor tenant must match session tenant |
| Branch | Existing FollowupBranchAccess checks |
| Intent | Validated against Completed + agreement / Repeat projection |
| SurgeryDone | Claim rejected |
| NULL owner | Claim rejected — use Slice 3 Assign |

---

## Expected-owner concurrency

Atomic server check:

`WHERE sessionId = X AND CounselorId = expectedCounselorId` → set `CounselorId = actor`

Zero rows affected → **409 Conflict**. No Version column migration (Slice 7 deferred).

---

## NULL / current / other-owner behavior

1. **Current owner** → do not call claim; navigate with `?lifecycle=` and run existing flow
2. **NULL** → Slice 3 Assign to me → continue lifecycle
3. **Other** → confirm → claim-for-lifecycle → continue lifecycle
4. **409 / failure** → toast + refresh; do not start lifecycle

---

## Grid action matrix

| State | Owner | Action |
|-------|-------|--------|
| Pending | NULL | Assign (existing dialog) |
| Pending | Current / Other | Open / View |
| Done | Any (incl. NULL/other) | **Re-evaluate** |
| Repeat | Any (incl. NULL/other) | **Start Repeat** |
| SurgeryDone | Any | View |

Attention column removed. Action column owns operational CTAs.

---

## Read-only boundary

- Opening Done/Repeat without lifecycle entry remains read-only (existing FE overlay; Slice 4 BE ACL deferred).
- Direct URL does not assign, claim, re-evaluate, or start.
- Large Done Re-evaluate banner removed from workspace.
- Repeat Start Session controls appear only after Waiting List `Start Repeat` with `?lifecycle=start-repeat` and current owner.

---

## Tests

### Backend (`Phase3ILifecycleClaimOwnershipTests`, contract)

- Done/Repeat other-owner claim → actor becomes owner
- Stale expected → 409
- Cross-branch / cross-tenant / Admin → Forbidden
- NULL owner claim → BadRequest (use Assign)
- Wrong intent / SurgeryDone → BadRequest
- Self claim idempotent success
- Assign still NULL-only; already-owned → 409

### Frontend

- Lifecycle CTA matrix (Pending Assign only; Done/Repeat never Assign)
- Ownership decision helper (continue / assign-to-me / claim)
- API claim-for-lifecycle + skipForbiddenRedirect
- Contract: no peer picker; row click no silent lifecycle; banners/Attention

---

## Deferred / known unresolved

- Slice 4 owner mutation ACL
- Slice 5 History/Audit subsystem
- Slice 6 general Reassign (PD-REASSIGN-01)
- Slice 7 Version migration
- Slice 8–12
- Re-evaluate Auth synchronization (dual-store) unless minimal entry compatibility already present

---

## Manual UAT checklist

1. Pending + NULL → Assign dialog
2. Pending + assigned → no Assign
3. Done + current → Re-evaluate direct (editable after existing re-eval)
4. Done + NULL → Assign to me & Re-evaluate → flow (no return to grid)
5. Done + other → Assign to me & Re-evaluate → claim → flow
6. Repeat + current / NULL / other (Start Repeat pattern)
7. SurgeryDone → View only; no claim
8. No Assign on Done/Repeat grid
9. Attention column gone
10. Direct URL Done/Repeat → read-only; no ownership mutation
11. Concurrent claim (stale owner) → conflict toast + refresh
12. Admin cannot lifecycle-claim another counsellor’s Done/Repeat

**STOP** — Manual UAT is the gate before the next Phase 3I slice.
