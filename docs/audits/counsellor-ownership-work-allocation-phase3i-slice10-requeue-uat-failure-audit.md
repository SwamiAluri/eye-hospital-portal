# Phase 3I Slice 10 — UAT Failure Investigation  
# ReQueue / “Error re-queuing patient”  
# AUDIT ONLY — FIX NOT IMPLEMENTED

**Date:** 2026-09-20  
**Gate:** Slice 10 Manual UAT — **BLOCKED** pending root-cause review  
**Mode:** Diagnosis only — no code, API, permission, DB, or ReQueue semantic changes  

---

## 1. Exact failing workflow

**Observed (UAT report):** Follow-up Center ReQueue fails with toast/text **`Error re-queuing patient`**.  
**Claimed screenshot context:** Follow-up **Log Contact** modal showing **Loading** (screenshot file not present on disk in this workspace; description only).

**Authoritative UI path for ReQueue (code):**

1. `/dashboard/counsellors-desk/surgery-followup` — Active or Cold row  
2. Action **Re-queue** → opens `ReQueueModal`  
3. Modal loads `GET session` Version, user enters reason, submits  
4. `POST /Counseling/sessions/{sessionId}/re-queue`  
5. On failure, toast via `getApiErrorMessage(err, 'Failed to re-queue')`

**Critical string match:** The exact phrase **`Error re-queuing patient` is not the FE fallback.**  
FE fallback is `'Failed to re-queue'`.  
The exact UAT string is produced by the **backend** and surfaced by `getApiErrorMessage` from `response.data.message`.

---

## 2. Exact frontend request

| Item | Evidence |
|------|----------|
| Page | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx` — `ReQueueModal` |
| Handler | `handleSubmit` → `counsellorsDeskApi.reQueueSession(sessionId, payload)` |
| API client | `counsellorsDesk.api.ts` → `POST /Counseling/sessions/${sessionId}/re-queue` |
| Payload | `{ version, expectedCounselorId, reason, sessionType? }` |
| `expectedCounselorId` | From list row: `row.counselorId ?? null` (session projection) |
| `version` | From `getSession(sessionId, { skipCatalogFallback: true })` at modal open |
| Success toast | `` `${patientName} re-queued to waiting list` `` |
| Error toast | `getApiErrorMessage(err, 'Failed to re-queue')` → **uses API `message` when present** |
| 409 path | `isSessionConcurrencyConflict` → concurrency message + reload Version (would **not** show “Error re-queuing patient”) |

**Pre-submit guards (would not call ReQueue):** empty reason; Version not loaded. Those show **form** errors, not this toast.

---

## 3. Exact backend endpoint

| Item | Value |
|------|--------|
| Method / route | `POST /api/Counseling/sessions/{id}/re-queue` |
| Controller | `CounselingController.ReQueueSession` |
| Permission | `counseling_sessions.update` |
| Service | `CounselingWorkflowService.ReQueueSessionAsync` |
| Branch auth | `FollowupBranchAccessService.ResolveAccessibleBranchesAsync` → Forbidden if unauthorized |
| Owner ACL | **Not** `DenyUnlessSessionOwner` — uses CAS on `expectedCounselorId` + Version |
| Structured failures | NotFound / Forbidden / Conflict / BadRequest with **specific** messages |
| Generic failure message | **`Error re-queuing patient`** |

---

## 4. Exact HTTP status

**Not captured from the UAT browser Network panel** (not provided).

**Code-derived mapping for this exact message:**

| Path | Status | Body |
|------|--------|------|
| `ReQueueSessionAsync` outer `catch (Exception)` returns `FailureKind = BadRequest`, `Message = "Error re-queuing patient"` | Controller maps to **`400 Bad Request`** | `{ message: "Error re-queuing patient" }` |
| Controller outer `catch (Exception)` (if exception escapes service — uncommon because service swallows) | **`500`** | `{ message: "Error re-queuing patient" }` |

**Most likely runtime status for this toast text:** **HTTP 400** with that body (service-swallowed exception).  
**Must confirm** with Network tab; do not treat 400 vs 500 as proven without capture.

---

## 5. Exact response / error

| Layer | Message |
|-------|---------|
| API body (authoritative for toast) | `"Error re-queuing patient"` |
| Service log | `_logger.LogError(ex, "Error re-queuing counseling session {SessionId}", …)` — **exception details only in server logs** |
| Controller log (500 path) | `_logger.LogError(ex, "Error re-queuing session {Id}", id)` |

**Inner exception type/message:** **UNKNOWN** — not available without AuthService logs or Network/body beyond the generic message (body does not include exception detail).

---

## 6. Exact backend failure point

### What this message means (proven)

It is **not** one of the structured ReQueue outcomes:

| Structured outcome | Typical message | Would toast show “Error re-queuing patient”? |
|--------------------|-----------------|-----------------------------------------------|
| Ownership CAS mismatch | `Session ownership changed.` | No |
| Version stale | Session concurrency stale message | No (FE also special-cases 409) |
| Branch unauthorized | `Not authorized to requeue this session.` | No |
| SurgeryDone sealed | `SurgeryDone sessions cannot be requeued.` | No |
| Missing reason / Version | Specific BadRequest | No |
| **Unhandled Exception inside `ReQueueSessionAsync`** | **`Error re-queuing patient`** | **Yes** |

So the request **passed validation/CAS entry checks far enough to enter the transactional work**, then an **Exception** was thrown and **remapped** to this generic message (exception discarded from client response).

### Likely throw sites inside the transaction (candidates — not proven)

Code after CAS / during commit can throw; any of these are remapped identically:

1. Relational `ExecuteUpdateAsync` / EF provider errors  
2. Queue soft-delete / create (`CounselorQueue`) — note `BranchId = sessionMeta.BranchId ?? Guid.Empty` when creating a new Waiting row  
3. `StageOwnershipTrailAsync` when prior owner existed — **throws if `_audit is null`**:  
   `"Ownership audit is unavailable; refusing to record OwnershipRequeued…"`  
4. `_audit.StageAsync(...)` failures  
5. `SaveChangesAsync` / DB constraint / FK / CHECK failures  
6. Transaction rollback/commit failures  

**Which of these fired in UAT:** **UNKNOWN without the logged exception.**

---

## 7. Did Slice 10 cause or contribute?

### Slice 10 intended changes (presentation honesty)

- Active/Cold label: `Owner` → `Original Counsellor` via `formatOriginalCounsellorAttribution`  
- Type JSDoc honesty  
- Tests (FE + one CommLog regression)  
- **No** backend list/ReQueue/CounselorId persistence changes  

### ReQueue path vs Slice 10

| Concern | Slice 10 impact? |
|---------|------------------|
| ReQueue request construction | **No** — still `version` + `expectedCounselorId: row.counselorId` + `reason` (Slice 8 FE contract) |
| Row/session identity | **No** — still `row.sessionId` |
| CounselorId field used for CAS | **Unchanged field**; only display label renamed |
| Version fetch | **Unchanged** Slice 8/7 pattern (`getSession`) |
| API response handling | Still `getApiErrorMessage` (surfaces backend message) — not introduced as Slice 10 “honesty” scope, but present in current Follow-up page ReQueue modal |
| List projection / filters | **No** CounselorId filter added |
| Modal state / invalidation | ReQueue success still `onQueued` → refresh; Slice 10 did not add Contact↔ReQueue coupling |

**Verdict on Slice 10 causation:**  
**No evidence that Slice 10 presentation honesty caused this failure.**  
The failing message is a **backend ReQueue exception remap** (Slice 8 service/controller). Label renaming cannot produce this API body.

**Contribution:** **None demonstrated.** Residual risk only if UAT environment mixed unrelated uncommitted ReQueue FE work with Slice 10 in the same file — still does not invent the backend exception text.

---

## 8. Is Slice 8 certified behavior affected?

| Certified Slice 8 rule | Status relative to this failure |
|------------------------|----------------------------------|
| Clear `CounselorId` → NULL | Intended; failure occurs **before success return** if exception mid-transaction (may roll back) |
| Branch authorization | Separate Forbidden path — not this message |
| Version / expectedCounselorId CAS | Separate Conflict messages — not this message |
| OwnershipRequeued history | Only on success path when ownership changed; audit staging can **throw** → this generic message |
| Automated Slice 8 tests | **PASS** this session: 24 tests (`Phase3ISlice8Requeue*`) |

**Certified happy-path tests do not cover** the production exception that produces `"Error re-queuing patient"` (tests assert success / structured failures; they do not assert this generic remap against live DB audit/FK failures).

---

## 9. Contact Log modal vs ReQueue (screenshot)

| Fact | Evidence |
|------|----------|
| Contact Log submit button shows **`Loading…`** | `ContactLogModal.tsx`: `versionLoading ? 'Loading…' : 'Log Contact'` while `getSession` runs |
| ReQueue submit shows **`Queuing…`** / **`Re-queue`** | Different modal copy — not “Loading…” |
| Contact and ReQueue state | Separate React state (`contactModal` vs `reQueueModal`); no shared mutation lock |
| Both call `getSession` for Version | Independent; Contact Loading does **not** block ReQueue submit by code |
| Can both open? | Theoretically both state vars can be set; not a single combined UI |

**Conclusion:** The described **Log Contact “Loading”** screenshot is **not the ReQueue error toast surface**. It is either:

- a **separate** UAT action (Contact Version fetch in progress or stuck), or  
- **unrelated visual context** captured near the ReQueue failure  

It does **not**, by itself, prove Contact submission caused ReQueue to fail.  
If Contact `getSession` were permanently failing, ReQueue would also fail to obtain Version and would show a **form** error — not `"Error re-queuing patient"`.  
Because the UAT string is the **backend ReQueue remap**, a ReQueue **POST did reach the server** with Version + payload.

---

## 10. Relevant existing tests and results

| Suite | Result (this investigation) |
|-------|-----------------------------|
| `Phase3ISlice8Requeue*` (microservices AuthService.Tests) | **24 PASS** |
| Slice 10 FE presentation / page tests | Previously PASS (implementation gate); not re-blamed for this runtime 500/400 |
| Live UAT Network/log capture | **Not available** |

---

## 11. Root cause classification

| Classification | Assessment |
|----------------|------------|
| Slice 10 regression | **Not supported by evidence** |
| Pre-existing Slice 8 issue | **Plausible** — generic exception swallow on ReQueue is Slice 8 code; failure is an **unhandled Exception** inside ReQueue, not a Slice 10 label bug |
| Environment / data / concurrency | **Plausible** — DB constraint, null BranchId → `Guid.Empty` queue insert, audit unavailable, concurrent mutation (though concurrent ownership/version usually returns Conflict text) |
| Contact Log modal interaction | **Not supported** as cause of this toast string |
| Unrelated | Possible only if toast was mis-attributed; string uniquely matches ReQueue backend |
| **Unknown pending evidence** | **YES — inner exception unknown** |

### Working diagnosis (evidence-bounded)

> **Backend ReQueue threw an Exception during the transactional path; client displayed the remapped message `Error re-queuing patient`. Slice 10 label honesty is not implicated. Inner root cause requires server log / Network confirmation.**

---

## 12. Recommended next action

**Do not implement a fix yet.** Collect runtime evidence:

1. **Browser Network** for the failing call:  
   - `POST …/Counseling/sessions/{id}/re-queue`  
   - Status code  
   - Full response JSON  
   - Request payload (`version`, `expectedCounselorId`, `reason`, `sessionType`)  
2. **AuthService logs** at the same timestamp for:  
   - `"Error re-queuing counseling session {SessionId}"`  
   - Full exception type + message + stack  
3. Note session id, whether session had `CounselorId`, `BranchId`, prior queue rows, SurgeryDone seal.  
4. Separately, if Contact modal stuck on Loading: capture `GET` session Version request status (distinct issue).  
5. After exception identity is known, open a **targeted fix ticket** (likely Slice 8 ReQueue hardening / data / audit) — **not** Slice 10 honesty rework; **not** Slice 11/12.

---

## 13. Options A–H (investigation checklist)

| Option | Result |
|--------|--------|
| A. Slice 10 caused | **No evidence** |
| B. Pre-existing Slice 8 ReQueue | **Plausible (exception remap path)** |
| C. Contact Log / modal interaction | **Not supported for this toast** |
| D. Version / optimistic concurrency | **Unlikely as primary** (would show Conflict / FE concurrency toast) |
| E. expectedCounselorId mismatch | **Unlikely as primary** (message would be `Session ownership changed.`) |
| F. Authorization / branch | **Unlikely as primary** (Forbidden message) |
| G. FE error-handling only | **Partial** — FE correctly shows API message; does not invent the failure |
| H. Other concrete cause | **Unhandled backend Exception** (specific cause TBD from logs) |

---

## STOP

No fix implemented. No production/code/DB/permission/ReQueue semantic changes. Slice 11 / 12 not started.

**AUDIT COMPLETE — FIX NOT IMPLEMENTED — MANUAL UAT BLOCKED PENDING ROOT-CAUSE REVIEW**
