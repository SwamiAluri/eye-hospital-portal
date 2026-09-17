# Phase 3I Slice 2 — Admin Create Unassigned + Remove Silent Start Ownership

| Field | Value |
|-------|--------|
| **Date** | 2026-09-16 |
| **Slice** | Phase 3I Slice 2 only |
| **Product SoT** | `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` |
| **Readiness** | `docs/audits/counsellor-ownership-work-allocation-phase3i-implementation-readiness-audit.md` |
| **Prior slice** | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice1.md` |
| **Status** | **IMPLEMENTED** — ready for manual UAT |

---

## Explicit statements

**Opening/viewing/starting a counselling session does not establish CounselorId ownership. Ownership requires explicit assignment.**

**Slice 3 Assign/Reassign behavior is not implemented in Slice 2.**

---

## Implementation status

| Item | Result |
|------|--------|
| Create → CounselorId NULL | Done |
| Client CounselorId on Create ignored | Done |
| Start-if-null stamp removed | Done |
| StartFromQueue does not stamp | Confirmed (unchanged + commented) |
| FE open/start not treated as claim | Comments + payload test; no Assign UI |
| Waiting List shared + Slice 1 PD16 | Preserved |
| DB migration | **NO** |
| Permission changes | **NO** |

---

## CreateSession — before / after

| | Before | After |
|--|--------|-------|
| Rule | `CounselorId = request.CounselorId ?? currentUserId` | `CounselorId = null` |
| Admin create | Admin becomes owner | Unassigned |
| Counsellor create | Self becomes owner | Unassigned |
| Client `request.CounselorId` | Trusted | **Ignored** (no Create ownership bypass; Assign = Slice 3) |
| `CreatedByUserId` | Actor | Actor (unchanged; **not** ownership) |

## StartSession — before / after

| | Before | After |
|--|--------|-------|
| Unassigned start | Stamp `CounselorId = currentUserId` | CounselorId remains **NULL** |
| Owned start | Preserve owner | Preserve owner |
| Status | InProgress | InProgress (unchanged) |
| `UpdatedByUserId` | Actor | Actor (not ownership) |

## Frontend — before / after

| | Before | After |
|--|--------|-------|
| Add Patient payload | Omits counselorId (BE coalesced to creator) | Still omits; BE leaves NULL |
| Waiting List row click | Azure `start` + navigate | Same navigation; Azure start ≠ Auth ownership |
| Pending auto-start in session controller | Called Auth Start (which stamped) | Still calls Auth Start for workflow; **no ownership stamp** |
| Assign UI | None | None (Slice 3) |

---

## CounselorId / CreatedByUserId semantics (Slice 2)

| Field | Meaning after Slice 2 |
|-------|------------------------|
| `CounselorId` | Active counselling owner when assigned; **NULL = unassigned**; not set by Create/Start |
| `CreatedByUserId` | Audit creator only |
| Actor (`UpdatedByUserId` on Start) | Who started/updated — not owner |

**Documented Slice 4 gap:** `UpdateSessionAsync` can still set `request.CounselorId` if provided — free CounselorId write remains until owner ACL / Assign APIs. Not changed in Slice 2.

**Documented Slice 11 gap:** Analytics `CounselorId ?? CreatedByUserId` effective-owner filter unchanged.

---

## APIs changed

| API | Change |
|-----|--------|
| `POST /api/Counseling/sessions` (via `CreateSessionAsync`) | Always create with `CounselorId = null` |
| `POST /api/Counseling/sessions/{id}/start` (via `StartSessionAsync`) | No longer stamps CounselorId |

No new endpoints. No Assign/Reassign.

---

## Exact files changed

| File | Role |
|------|------|
| `microservices/auth-service/AuthService/Services/CounselingWorkflowService.cs` | Create NULL; Start no stamp |
| `AuthService.Tests/Phase3ISlice2OwnershipCreateStartTests.cs` | **New** tests |
| `AuthService.Tests/TestDbContextFactory.cs` | Ignore InMemory transaction warning (test infra) |
| `apps/hospital-portal-web/src/hooks/use-counselling-session-controller.ts` | Comment: auto-start ≠ ownership |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx` | Comment: open ≠ claim |
| `apps/hospital-portal-web/src/lib/counsellors-desk/add-patient-to-waiting-list.test.ts` | Assert no counselorId in create payload |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-slice2.md` | This note |

## Intentionally not changed

Assign/Reassign, owner ACL, Version/concurrency, requeue clear, History/Audit ownership events, Analytics, Follow-up, Finalize, permissions, migrations, Waiting List redesign, historical CounselorId backfill.

---

## Tests

| Suite | Result |
|-------|--------|
| `Phase3ISlice2OwnershipCreateStartTests` (8) | **Passed** |
| `WaitingListBranchAuthTests` (12) — regression Slice 1 | **Passed** |
| FE `add-patient-to-waiting-list.test.ts` | Run with vitest |

Backend Slice 2 cases: Admin/counsellor create NULL; client CounselorId ignored; Start unassigned stays NULL + InProgress; Start preserves existing owner; StartFromQueue no stamp; Create/Start write no ownership audit rows.

---

## Manual UAT scenarios

1. Admin creates patient/session → CounselorId **NULL**  
2. Counsellor opens that session → CounselorId remains **NULL**  
3. Counsellor starts that session → CounselorId remains **NULL**; status may become InProgress  
4. Session remains on shared authorized Waiting List  
5. Another counsellor’s owned session still visible on shared WL  
6. Search / date / pagination unchanged  
7. **Do not** test Assign (Slice 3)

---

## Remaining Phase 3I gaps

Slice 3 Assign/Reassign · Slice 4 owner ACL · History/Audit · Requeue→NULL · Concurrency · Analytics My Work · Post-Surgery assign · Leave/Reassignment Required · UpdateSession free CounselorId write · Analytics CreatedBy fallback

---

## Blockers / dependencies

None for Slice 2. Slice 3 Assign is required before counsellors can establish ownership on new sessions.

**STOP** — await manual UAT. Do not start Slice 3 until authorized.
