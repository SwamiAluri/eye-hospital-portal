# Counsellor Wave 2 — False “Another User” Save Conflict (Coverage Version Sync)

## Status

**IMPLEMENTATION COMPLETE — AUTOMATED TESTS PASS — MANUAL UAT REQUIRED**

## Defect

On Insurance, same counsellor (e.g. Amelia Martinez), session not open elsewhere:

> Save failed: This session was updated by another user. Refresh to continue.

## Root cause

Not another counsellor. CCMS coverage create/draft notifies Auth (`ApplyCcmsCallbackAsync`), which bumps `CounselingSession.Version`. The open counselling page kept the old Version and Save Draft/`Save & Close` sent a stale token → legitimate **409**, misleading copy.

## Fix (bounded)

1. **FE** — Before Save Draft when coverage is in play, sync Version from server; after coverage draft save / case workspace change, sync again.
2. **FE** — On draft-save **409**, if server Version **advanced**, **one** retry with the fresh Version (same dirty form). No retry when Version did not advance (true conflict).
3. **CCMS** — Await Auth notify on **CASE_CREATED** and **DRAFT_SAVED** (so Version bumps before the API returns). State-change remains fire-and-forget.

## Files

- `apps/hospital-portal-web/src/lib/counsellors-desk/sync-counselling-session-version.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/save-counselling-draft.ts`
- `apps/hospital-portal-web/src/hooks/use-counselling-session-controller.ts`
- `microservices/ccms-service/CcmsApi/Services/CoverageCaseService.cs`
- focused tests

## Preserved

Ownership ACL, real multi-user 409, no LWW, no Version bypass.

## UAT

1. Open assigned Insurance session as Amelia.  
2. Ensure coverage Draft case exists / edit policy.  
3. **Save Draft** and **Save & Close** — should succeed without “another user” toast when only this user is on the session.  
4. Optional: genuine two-tab conflict should still 409 after one failed retry path.
