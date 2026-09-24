# Phase 3I — Targeted Counselling Session 409 Concurrency Fix
# Start → Save Draft → Complete + ReQueue Note Presentation

**Date:** 2026-09-21  
**Session:** `bb000001-2222-2222-2222-000000000007`  
**Status:** **READY FOR TARGETED COUNSELLING SESSION CONCURRENCY MANUAL UAT**  
**Not Accepted** — awaiting manual UAT. Do not start Slice 11 / 12.

---

## 1. Exact root cause

**False 409 on Complete was caused by a stale expected `Version` on the Save that runs inside Complete**, not by a broken Complete CAS rule.

Evidence from the reported toast:

> `Complete failed: This session was updated by another user. Refresh to continue.`

That prefix is only used when `saveCounsellingSession` throws a plain Error (including Save 409). A Complete-side 409 would instead toast:

> `Counselling details were saved, but completion could not be confirmed: …`

So the failing call was **`PUT /sessions/{id}`** with a stale `version`, not `POST …/complete`.

**Why the FE Version was stale**

1. After **Start** / **Save Draft**, the DB Version advances and `updateSessionVersion` schedules a React state update.
2. React state updates are **asynchronous**.
3. An immediate **Complete** (or a second Save) still closed over the **pre-mutation** `session.version`.
4. That stale Version was sent on Save → genuine optimistic concurrency reject → **409** (correct backend behavior, incorrect FE authority for the next write).

Secondary hardening gaps addressed in the same change:

- Start Counseling previously **discarded** the Start response Version and only patched after a follow-up GET + setState.
- On 409, `invalidateSession` alone did not patch local Version because `sessionAppliedRef` skips full re-apply (intentionally preserving dirty form) — Version sync is now an explicit `getSession` + `updateSessionVersion` path.

Optimistic concurrency itself was **not** weakened.

---

## 2. Exact request/version sequence before fix

Illustrative single-user path (matches UAT pattern Assign → Start → Save Draft → Complete):

| Step | Endpoint | Request Version | DB before | DB after | FE local after |
|------|----------|-----------------|-----------|----------|----------------|
| GET | `GET /sessions/{id}` | — | N | N | N |
| Assign | `POST …/assign` | N | N | N+1 | waiting-list refreshed |
| Start | `POST …/start` | N+1 | N+1 | N+2 | setState scheduled (async) |
| Save Draft | `PUT /sessions/{id}` | N+2 (if re-render caught up) **or N+1 if raced** | … | … | setState scheduled |
| Complete → Save | `PUT /sessions/{id}` | **often still N+1 / prior** | newer | unchanged | **409** |
| Complete → Complete | not reached | — | — | — | — |

Audit on the UAT session showed successful content Saves (FieldChanged) while status remained `InProgress` / Version advanced — Complete never transitioned the session.

---

## 3. Exact request/version sequence after fix

| Step | Endpoint | Request Version | Source of expected Version | FE after success |
|------|----------|-----------------|----------------------------|------------------|
| GET | `GET /sessions/{id}` | — | apply → `sessionVersionRef` | ref = N |
| Assign | `POST …/assign` | N | waiting list | list refresh |
| Start | `POST …/start` | ref | `sessionForMutation()` | **ref updated immediately from Start response**, then confirmed via GET |
| Save Draft | `PUT /sessions/{id}` | ref | `sessionForMutation()` | **ref = response Version** (sync) |
| Complete → Save | `PUT /sessions/{id}` | **latest ref** | `sessionForMutation()` | ref = Save response Version |
| Complete → Complete | `POST …/complete` | **Save response Version** | `resolveVersionAfterSave` | ref = Complete response Version |

Invariant: every successful mutation uses `request Version == current authoritative Version` held in `sessionVersionRef` (not a stale React closure).

Genuine external writer still yields 409; no auto-retry; dirty form preserved; Version synced via refetch helper.

---

## 4. Files changed

| File | Change |
|------|--------|
| `apps/hospital-portal-web/src/lib/counsellors-desk/session-version-authority.ts` | Sync Version resolution helpers |
| `apps/hospital-portal-web/src/lib/counsellors-desk/session-version-authority.test.ts` | Unit tests |
| `apps/hospital-portal-web/src/lib/counsellors-desk/requeue-notes-presentation.ts` | Parse/compose/format ReQueue note lines |
| `apps/hospital-portal-web/src/lib/counsellors-desk/requeue-notes-presentation.test.ts` | Unit tests |
| `apps/hospital-portal-web/src/hooks/use-counselling-session-controller.ts` | `sessionVersionRef`, `sessionForMutation`, Start response Version, 409 Version sync, ReQueue note split + recompose on save |
| `apps/hospital-portal-web/src/lib/counsellors-desk/save-counselling-session.ts` | `resolveVersionAfterSave`; 409 Version sync callback |
| `apps/hospital-portal-web/src/lib/counsellors-desk/save-counselling-draft.ts` | 409 Version sync callback |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingWrapupPhase.tsx` | Read-only ReQueue presentation vs editable Counsellor Notes |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingTabPanel.tsx` | Pass `requeueNoteEvents` |
| `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-session-tokens.ts` | `notesRequeueEvents` test id |
| Contract / API / UI tests | Updated for Version ref + ReQueue UX |

No backend ownership / Assign / ReQueue queue / uniqueness / Slice 10 changes.

---

## 5. Why the change is safe

- **Concurrency rule preserved:** expected Version still required; 409 still stops; no auto-retry; no last-write-wins; no silent merge of stale forms.
- **Only FE authority for the next write improved:** sync ref mirrors what the server already returned.
- **Complete still uses Save’s returned Version**, never the Version sent on Save.
- **ReQueue history preserved:** system `[Re-queue …]` lines remain in `AdditionalNotes` via compose-on-save; UI only separates presentation.
- **Historical ReQueue reason stays read-only** — no amendment semantics invented.

---

## 6. Tests added / updated

- `session-version-authority.test.ts` — ref vs stale state; Save→Complete Version chain
- `requeue-notes-presentation.test.ts` — parse/compose/format; history retention
- `save-counselling-session.fs01.test.ts` — Save/Complete Version forwarding; 409 sync; no Complete after Save 409
- `use-counselling-session-controller.version.contract.test.ts` — Version ref, Start response, mutationSession, ReQueue compose
- Waiting-list lifecycle / pending-readonly contracts — `mutationSession?.version`
- `counsellors-desk.version.api.test.ts` — nested `session.version` response shape
- `notes-workspace-ui.test.tsx` — ReQueue vs Counsellor Notes presentation

---

## 7. Test results

```
70 passed (targeted concurrency + notes + lifecycle contracts)
23 passed (session-concurrency + requeue-slice8 + procedures version)
```

---

## 8. Product decision required for ReQueue reason editing?

**Yes — deferred.** No approved product rule found to edit historical ReQueue reasons.

**Current rule applied:** historical ReQueue reasons are **read-only**; Counsellor working notes remain independently editable; persistence recomposes both so history is never deleted.

If product later wants ReQueue reason amendment, that needs an explicit approved rule (and preferably History/Audit semantics) — not invented here.

---

## 9. Manual UAT steps

Use session `bb000001-2222-2222-2222-000000000007` (or a fresh ReQueue → Assign cycle on the same pathway).

1. Waiting List: **Assign** (note response Version).
2. **Start Counseling** → land on `/dashboard/counsellors-desk/{sessionId}?from=waiting-list&lifecycle=start-counseling`.
3. Network: Start `200`; request Version == pre-Start DB Version; response Session Version = N+1.
4. Edit notes / decision / schedule.
5. **Save Draft** → `200`; request Version == current; response Version advanced; toast success.
6. Immediately click **Complete Session** (do not hard-refresh).
7. Network: Save then Complete, both `200`; Complete request Version == Save response Version.
8. Confirm **no** `409` on the happy path.
9. Notes UI: ReQueue block shows **Re-queued / date / Reason** read-only; Counsellor Notes editable without `[Re-queue …]` prefix.
10. Save again and confirm DB `additional_notes` still contains `[Re-queue …]` lines.
11. Negative: with two browsers, mutate in A then Save in B with stale Version → **409**, no auto-retry, dirty form retained, message matches Slice 7 copy.

Capture for each of GET / Assign / Start / Save / Complete: endpoint, request version, status, response version.

---

## 10. Final status

**READY FOR TARGETED COUNSELLING SESSION CONCURRENCY MANUAL UAT**

Do not mark Accepted until the network capture above is green on the single-user Assign → Start → Save Draft → Complete path, and a genuine stale Save/Complete still returns 409.
