# Phase 3I — Counselling Session Notes UX Correction
# ReQueue event → existing Session History (not Notes)

**Date:** 2026-09-21  
**Session:** `bb000001-2222-2222-2222-000000000007`  
**Status:** **READY FOR MANUAL UAT**  
**Not Accepted** — awaiting manual UAT. Do not start Slice 11 / 12.

---

## 1. Exact files changed

| File | Change |
|------|--------|
| `…/session/CounsellingWrapupPhase.tsx` | Removed ReQueue event block from Notes |
| `…/session/CounsellingTabPanel.tsx` | Stopped passing `requeueNoteEvents` |
| `…/hooks/use-counselling-session-controller.ts` | Keep parse/compose + `requeueNoteEventsRef` only (no Notes UI state) |
| `…/SessionHistoryModal.tsx` | Label **Re-queued**; Reason + Requeued by; no raw type / Source: Requeue |
| `…/load-counselling-session-history.ts` | Prefer Auth `OwnershipRequeued`; fallback from AdditionalNotes markers |
| `…/session/SessionPageHeader.tsx` | Pass `session.counsellorNotes` into History loader |
| `…/requeue-notes-presentation.ts` (+ tests) | Parse/compose preserved; History fallback helper |
| Notes / History / ownership / concurrency tests | Updated |

**Untouched:** optimistic concurrency / Version / Save Draft / Complete / Assign / ReQueue backend / queue uniqueness / ownership rules.

---

## 2. Existing History infrastructure reused

- `SessionHistoryModal` (existing panel)
- `loadCounsellingSessionHistory` (Azure + Auth merge)
- `GET /Counseling/sessions/{id}/history` → `counseling_session_audit_log`
- Existing `OwnershipRequeued` change type (human label only)

No new History table, component, drawer, or audit system.

---

## 3. How ReQueue events are sourced

1. **Authoritative:** Auth History rows with `changeType = OwnershipRequeued` (when ownership actually changed on ReQueue). Actor = `changedBy` from the trail.
2. **Compatibility fallback:** If Auth emitted no `OwnershipRequeued` for a reason (certified already-unassigned ReQueue), present a read-only History row derived from preserved `[Re-queue YYYY-MM-DD] <reason>` lines in `AdditionalNotes`. Actor is blank (`—`) — **never** inferred from `CounselorId`.

UAT session note: ReQueue ran while unowned → no `OwnershipRequeued` audit row; History will show the marker-derived **Re-queued** event with Reason `Test`.

---

## 4. How raw markers are kept out of editable Notes

- On load: `parseCounsellorAdditionalNotes` → working notes only in the textarea; markers held in `requeueNoteEventsRef`.
- On Save / Save Draft: `composeCounsellorAdditionalNotes` restores markers + working notes into `AdditionalNotes`.
- Notes UI no longer renders any ReQueue card or `[Re-queue …]` text.

---

## 5. Tests added/updated and results

- Notes: no ReQueue in workspace; Counsellor Notes editable
- History: Re-queued label, Reason, Requeued by, multi-event, no raw type/marker
- Marker parse/compose + History fallback / dedupe vs OwnershipRequeued
- Concurrency Version contracts + Save→Complete suite unchanged in intent

**Result:** `75` tests passed across Notes / History / ReQueue / concurrency suites in this run.

---

## 6. Concurrency / ownership / backend confirmation

- No Version / 409 / Save Draft / Complete logic changes in this task.
- No Assign / Reassign / ReQueue API / queue / CounselorId changes.
- Backend ReQueue semantics unchanged (unowned still may omit `OwnershipRequeued` trail).

---

## 7. Manual UAT steps

Session: `bb000001-2222-2222-2222-000000000007`

1. Open Counselling Session.
2. Notes: only Counsellor Notes / Patient / Doctor / Additional Options — no ReQueue card.
3. Counsellor Notes textarea has no `[Re-queue …]` text.
4. Open **History**.
5. See **Re-queued** with Reason `Test` (marker fallback for this unowned ReQueue).
6. Reason is read-only.
7. Actor / Requeued by: `—` for marker fallback; real actor when Auth trail exists.
8. Edit + Save Counsellor Notes; confirm notes save.
9. Confirm `[Re-queue …]` still in persisted `additional_notes` (DB or re-open).
10. Save Draft → Complete still succeeds (concurrency untouched).
11. No ownership / Version / workflow regressions.

---

## 8. Final status

**READY FOR MANUAL UAT**
