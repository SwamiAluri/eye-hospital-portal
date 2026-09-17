# Phase 3I — Counsellor Workflow Corrections

| Field | Value |
|-------|--------|
| **Date** | 2026-09-17 |
| **Scope** | Add-Patient ownership · Assign dialog verify · Initial procedure · Completed Finish UX |
| **Status** | **IMPLEMENTED** — automated tests green. Awaiting manual UAT. **STOP**. |
| **Slices 5/6** | **Not started** |

---

## Audit summary

| Issue | Root cause | Fix |
|-------|------------|-----|
| **1** Add Patient owner | `CreateSessionAsync` forced `CounselorId = null` for all actors | Assignable counsellor actor → `CounselorId = currentUserId`; Admin/non-counsellor stay NULL. Client `CounselorId` still ignored. |
| **2** Assign self OR peer | Already implemented | Verified + regression test. No product change. |
| **3** Initial procedure hydration | **Incorrectly** removed `isRecommended` fallback (scheduling selection uses `recommended_surgery` → GetSession flags) | **REVERTED 2026-09-17 (manual UAT)** — restore blob → variant → first `isRecommended`. Scheduling selection is expected SoT for new sessions. |
| **4** Completed Finish looks disabled / no scroll | Repeat grey gate (`pointer-events-none opacity-45`) wrapped Finish; `disabled` greying on notes | Removed grey gate; auto-open Finish for Repeat; `readOnly` without `disabled`/opacity overlays. |

---

## What changed

### Backend
- `CounselingWorkflowService.CreateSessionAsync` — counsellor create establishes self as owner.

### Frontend
- `resolve-hydrated-selected-surgery-id.ts` + `counsellors-desk.api.ts` hydrate
  - **Correction:** restored first-`isRecommended` fallback (scheduling SoT). Blob/variant still win when present.
- `counselling-finish-outcome.ts` — auto-open Finish for all terminal statuses
- `CounsellingSessionPageContent.tsx` — removed scroll-locking grey overlay
- Notes / decision / additional options / pricing card — read-only without greying

### Tests
- BE: `Phase3ISlice2OwnershipCreateStartTests` (10 passed)
- FE: Assign dialog dual-path, hydrate surgery, finish outcome, notes read-only, completed Finish UX, add-patient omit client counselorId

---

## Manual UAT checklist

1. **Counsellor Add Patient** → Waiting List row shows **you** as owner (not Unassigned); **Start Counseling** available without Assign.
2. **Admin Add Patient** (if used) → still Unassigned; Assign still required.
3. **Pending + Unassigned Assign** → **Assign to me** works; peer picker + **Assign** works for another counsellor.
4. **New Initial session** → procedure/package selected during Schedule Initial Counselling appears selected (via `recommended_surgery` → `isRecommended` hydrate).
5. **Re-open saved session with selection** → prior procedure still restored.
6. **Complete Session (agreed)** → status **Done**; Finish opens; page scrollable; not greyed/disabled-looking; mutations blocked.
7. **Complete Session (needs time)** → status **Repeat Counselling**; Finish opens with correct headline; scrollable; not greyed.
8. **Certified rules** — Assign-if-null, claim-for-lifecycle, owner ACL, Processing after draft — unchanged.

**Restart AuthService** after this change (process was stopped briefly to unlock the test build).

---

## STOP

Do **not** start Slice 5 (History/Audit) or Slice 6 (Reassign) until UAT passes.
