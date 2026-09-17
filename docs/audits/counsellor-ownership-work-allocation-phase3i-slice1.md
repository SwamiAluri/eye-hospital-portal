# Phase 3I Slice 1 — Waiting List PD16 Server Authorization

| Field | Value |
|-------|--------|
| **Date** | 2026-09-16 |
| **Slice** | Phase 3I Slice 1 only |
| **Product SoT** | `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` |
| **Readiness audit** | `docs/audits/counsellor-ownership-work-allocation-phase3i-implementation-readiness-audit.md` |
| **Status** | **IMPLEMENTED** — ready for manual UAT |

---

## Statement

**Waiting List remains a shared operational queue. Server-side branch authorization controls visibility; CounselorId does not personalize the queue.**

---

## What changed

1. **PD16 on `GET /api/Counseling/waiting-list`**
   - Resolves authorized branches via existing `FollowupBranchAccessService.ResolveAccessibleBranchesAsync` (through controller `ResolveFollowupBranchesAsync`).
   - Client `branchId` is a **request filter only**.
   - Unauthorized requested branch → **403**.
   - Omitted `branchId` → rows limited to **server-authorized branches only** (never tenant-wide).
   - Empty authorized set → empty list (not tenant-wide fallback).

2. **Soft-deleted counselling sessions**
   - Query now requires `s.DeletedAt == null` in addition to `q.DeletedAt == null`.
   - Soft-deleted sessions with active queue rows are **not** returned.

3. **Shared queue preserved**
   - No `CounselorId` visibility filter.
   - No `CreatedByUserId` visibility filter.
   - No Assign/Reassign UI or APIs.
   - No ownership stamping changes.
   - Response DTO / UX unchanged.

---

## Endpoints affected

| Endpoint | Change |
|----------|--------|
| `GET /api/Counseling/waiting-list` | PD16 branch scope + session soft-delete predicate + 403 on unauthorized branch |

**Unchanged:** Create/Start/Update/Complete/Requeue, Follow-up, Finalize, Analytics, Assign (none).

---

## Authorization rule

```
TenantId = JWT tenant
AND BranchId ∈ ResolveAccessibleBranches(user, requestedBranchId?)
AND queue.DeletedAt IS NULL
AND session.DeletedAt IS NULL
AND counseling_sessions.read
```

Precedence for this slice: **Tenant → Branch** (ownership ACL deferred to later slices).

---

## Soft-delete result

| Condition | Visible? |
|-----------|----------|
| Active queue + active session + authorized branch | Yes |
| Soft-deleted queue item | No |
| Soft-deleted counselling session | No (fixed) |
| Unauthorized branch | 403 if requested; omitted → excluded from set |
| Other tenant | No |

---

## Files changed

| File | Role |
|------|------|
| `microservices/auth-service/AuthService/Controllers/CounselingController.cs` | Waiting List PD16 + soft-delete + 403 |
| `microservices/auth-service/AuthService/Services/WaitingListPopulationScope.cs` | **New** — shared query helper for tests + documented predicates |
| `microservices/auth-service/AuthService/Services/FollowupBranchAccessService.cs` | Comment only (Waiting List in PD16 consumers) |
| `AuthService.Tests/WaitingListBranchAuthTests.cs` | **New** — Slice 1 scenarios A–K (+ empty scope) |
| `microservices/auth-service/AuthService.Tests/WaitingListSharedQueueContractTests.cs` | Comment — shared queue + PD16 note |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-slice1.md` | This note |

## Files intentionally not changed

- FE Waiting List UI / filters / Assign CTA  
- CreateSession / StartSession ownership stamp  
- Follow-up / Finalize / Analytics  
- Permissions / seed / migrations / schema  
- CounselorId backfill  

---

## Tests

| Suite | Result |
|-------|--------|
| `WaitingListBranchAuthTests` (12 tests) | **Passed** |
| Contract: no CounselorId/CreatedByUserId on filters | Preserved |

Scenarios covered: authorized branch; unauthorized → throw/403 shape; omit branchId; multi-branch; tampering; other counsellor owned still visible; unassigned visible; CreatedBy ≠ owner still visible; soft-deleted session/queue excluded; cross-tenant excluded; empty authorized → empty.

---

## Remaining Phase 3I gaps (not this slice)

- Assign / Reassign APIs + UI  
- Admin create → CounselorId NULL  
- Remove silent start-if-null stamp  
- Owner mutation ACL  
- History + Audit ownership events  
- Requeue clears CounselorId  
- Concurrency Version  
- Analytics My Work default  
- Post-Surgery assignment  
- Leave / Reassignment Required  

---

## Manual UAT checklist

- [ ] User with Downtown only: WL shows Downtown; omit branchId still Downtown-only  
- [ ] Request unauthorized branchId → 403  
- [ ] Multi-branch user omit branchId → only their branches  
- [ ] Shared queue: another counsellor’s session still listed  
- [ ] Unassigned / NULL CounselorId still listed  
- [ ] Search / pagination / date filters still work  
- [ ] No Assign CTA / ownership badge regression  

**STOP after UAT — do not start Slice 2 until authorized.**
