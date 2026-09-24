# Phase 3I — Slice 7 Optimistic Concurrency / Version
## Decision Closure + Implementation Readiness (AUDIT ONLY)

| Field | Value |
|-------|--------|
| **Audit / PD closure date** | 2026-09-18 |
| **Phase type** | **DECISION CLOSURE + READINESS ONLY** — no production code, API, DB, migration, DTO, FE, permission, ownership, or test changes |
| **Authoritative product rules** | Phase 3H **PD-CONC-01**; this document **PD-S7-01…08 APPROVED** |
| **Prior slices** | Slices 1–6 implemented; Slice 6 Reassign + ownership workflow correction **Manual UAT-accepted** |
| **Prior readiness** | Informal Slice 7 audit verdict was **READY FOR PRODUCT APPROVAL**; product pack below is now **APPROVED** |
| **This document** | Closes PD-S7 register; complete mutation inventory; boundary; READY FOR IMPLEMENTATION gate |
| **Production behavior changed?** | **NO** |

**Legend**

| Label | Meaning |
|-------|---------|
| **CURRENT** | What code does today |
| **APPROVED** | PD-S7-* product rule locked for Slice 7 implementation |
| **FUTURE IMPLEMENTATION** | Slice 7 coding — not started |
| **A / B / C / D** | Mutation classification (§5) |

---

## 1. Executive summary

| Item | Status |
|------|--------|
| Auth `CounselingSession.Version` concurrency token? | **NO** (CURRENT) |
| Ownership concurrency today? | **YES** — Assign-if-null / expectedCounselorId `ExecuteUpdate` → **409** |
| Content mutate concurrency today? | **NO** — owner ACL only; **last-write-wins** |
| PD-S7-01…08? | **APPROVED** (this document) |
| Mutation inventory complete? | **YES** — M18 + M19 Class A approved; ReQueue remains D |
| Technical pattern reusable? | **YES** — OpdBill `RowVersion` + ownership `ExecuteUpdate` |
| Slice 8 Requeue in Slice 7? | **NO** (PD-S7-07) |
| Azure / counselling-service xmin? | **OUT OF SCOPE** (PD-S7-08) |

### Final verdict

**READY FOR SLICE 7 IMPLEMENTATION** (M18 + M19 Class A approved)

---

## 2. Approved PD-S7 decision register

These eight decisions are the **approved product boundary** for Slice 7. No additional product decisions are invented here.

| ID | Title | Status | Approved rule (summary) |
|----|-------|--------|-------------------------|
| **PD-S7-01** | Concurrency token | **APPROVED** | `int Version` on Auth `CounselingSession`; EF concurrency token using OpdBill.RowVersion pattern. **Not** xmin, counselling-service xmin, OT soft Version++, or UpdatedAt. SoT = Auth `counseling_sessions`. |
| **PD-S7-02** | Writes requiring expected Version | **APPROVED** | All existing counselling-session mutations that modify persisted `CounselingSession` state must participate. Inventory in §4–5. Do not apply Version to unrelated entities. |
| **PD-S7-03** | Ownership operations | **APPROVED** | Keep `expectedCounselorId` **and** add Version. Assign: NULL + Version; Claim/Reassign: expectedCounselorId + Version. Do not replace ownership CAS with Version-only. |
| **PD-S7-04** | Ownership advances Version | **APPROVED** | Successful Assign / Claim-for-lifecycle / Reassign must increment Version so stale content saves get **409** (not rely only on later 403). |
| **PD-S7-05** | Missing Version | **APPROVED** | Covered mutations must supply expected Version. No LWW fallback. No grace period. No silent null/missing Version. Document legacy callers; do not invent bypass. |
| **PD-S7-06** | Stale UX | **APPROVED** | **409** = concurrency; **403** = ownership/authz. On 409: stop mutation; never overwrite; refetch; message; review before continue. Suggested: *"This session was updated by another user. Refresh to continue."* No auto-retry. **Do not implement UX in this audit task.** |
| **PD-S7-07** | Requeue | **APPROVED** | Requeue remains **Slice 8**. No Requeue→NULL, no `OwnershipRequeued`, no Slice 7 expansion into Requeue ownership. |
| **PD-S7-08** | Azure secondary sync | **APPROVED** | Keep counselling-service `PatientCounselling` / xmin outside Slice 7. Auth is concurrency SoT. No cross-service sync. |

**Parent rule:** PD-CONC-01 (Phase 3H WORKING) — optimistic concurrency; reject stale; 409; no silent LWW; no auto-merge; no success History on reject.

---

## 3. Auth CounselingSession concurrency SoT

| Item | Value |
|------|--------|
| Entity | `AuthService.Models.Domain.CounselingSession` |
| Table | `counseling_sessions` |
| DbContext | Auth `AppDbContext` |
| Primary service | `CounselingWorkflowService` (+ controller inline ReQueue; `OtFinalizeService`; `CounselorCommunicationService`) |
| CURRENT Version / RowVersion / IsConcurrencyToken | **Absent** |
| CURRENT UpdatedAt | Audit only — **not** a concurrency token (PD-S7-01) |
| counselling-service | `PatientCounselling` + `xmin` — **different SoT** (PD-S7-08) |

---

## 4. Existing concurrency mechanisms (CURRENT)

### 4.1 Ownership (already concurrency-safe for ownership races)

| Op | Endpoint | Mechanism | Conflict |
|----|----------|-----------|----------|
| Assign | `POST …/sessions/{id}/assign` | Txn + `ExecuteUpdate` `WHERE CounselorId IS NULL` | **409** already assigned |
| Claim | `POST …/sessions/{id}/claim-for-lifecycle` | Txn + `ExecuteUpdate` `WHERE CounselorId IS NULL` or `== expectedCounselorId` | **409** ownership changed |
| Reassign | `POST …/sessions/{id}/reassign` | Txn + `ExecuteUpdate` `WHERE CounselorId == expectedCounselorId` | **409** ownership changed |

Successful ownership writes stage History/Audit in the same transaction. Rejected ownership writes emit **no** success trail.

### 4.2 Content / lifecycle (CURRENT weakness)

| Pattern | Behavior |
|---------|----------|
| Load → mutate → `SaveChangesAsync` | Owner ACL (`DenyUnlessSessionOwner`) on many paths |
| Concurrent content edits | **Last-write-wins** |
| After Reassign | Next mutate may **403** if owner reloaded; without Version, stale in-memory payload can still overwrite if ACL still passes on cached owner | 

### 4.3 HTTP mapping (CURRENT)

- Ownership: `AssignSessionFailureKind.Conflict` → `Conflict(...)` (**409**).
- Session ops via `MapSessionOperationResult`: Success→200; Forbidden→**403**; NotFound→404; else→400. **No Conflict branch** yet for Update/Start/Complete (Slice 7 must add).

---

## 5. Complete mutation inventory + classification

Classification key:

| Code | Meaning |
|------|---------|
| **A** | VERSION REQUIRED — mutates `CounselingSession`; optimistic concurrency under PD-S7-02 |
| **B** | OWNERSHIP + VERSION REQUIRED — Assign / Claim / Reassign (PD-S7-03/04) |
| **C** | VERSION NOT REQUIRED — DIFFERENT ENTITY |
| **D** | VERSION NOT REQUIRED — EXPLICIT PRODUCT/SCOPE BOUNDARY |

### 5.1 Direct `CounselingSession` mutations (Auth)

| ID | Method / location | HTTP | Mechanism | CounselorId | Status/lifecycle | Content | ACL (CURRENT) | Txn | 409 today | Class | Notes |
|----|-------------------|------|-----------|-------------|------------------|---------|---------------|-----|-----------|-------|-------|
| M01 | `CreateSessionAsync` | `POST /api/Counseling/sessions` | Tracked Add + SaveChanges | May stamp self if assignable counsellor; client CounselorId ignored | Status=`Scheduled` | Yes (create DTO) | `.create` + branch | Yes | No | **A\*** | **Insert:** server initializes `Version` (default 1 per OpdBill pattern). **No expected Version** on create request. Response must expose Version. |
| M02 | `UpdateSessionAsync` | `PUT /api/Counseling/sessions/{id}` | Tracked SaveChanges | Blocked (400) | May set Status/stage | Yes (Save Draft / content) | `.update` + owner | No | No | **A** | Primary Save Draft path |
| M03 | `UpdateSessionAsync` via advance | `PUT …/sessions/{id}/advance-stage` | Same as M02 | No | CurrentStage | Stage only | `.update` + owner | No | No | **A** | Same Update path |
| M04 | `AssignSessionAsync` | `POST …/assign` | ExecuteUpdate (+ trail SaveChanges) | NULL→target | No | No | `.update` + branch + target | Yes | Yes | **B** | + expected Version; bump Version |
| M05 | `ClaimSessionForLifecycleAsync` | `POST …/claim-for-lifecycle` | ExecuteUpdate | → actor | No Start | No | `.update` + counsellor + expected owner | Yes | Yes | **B** | + expected Version; bump Version |
| M06 | `ReassignSessionAsync` | `POST …/reassign` | ExecuteUpdate | A→B | No | No | `.reassign` | Yes | Yes | **B** | + expected Version; bump Version |
| M07 | `StartSessionAsync` | `POST …/start` | Tracked SaveChanges | Does not set | → InProgress; queue may update | SessionType optional; may clear agree/pending | `.update` + owner | No | No | **A** | Also mutates `CounselorQueue` (queue = C for its own columns) |
| M08 | `CompleteSessionAsync` | `POST …/complete` | Tracked SaveChanges | No | → Completed; queue Completed | End/duration | `.update` + owner | No | No | **A** | CCMS fire-and-forget after — does not write CS again |
| M09 | `CancelSessionAsync` | `POST …/cancel` | Tracked SaveChanges | No | → Cancelled | ReasonsForDelay | `.update` + owner | No | No | **A** | |
| M10 | `DeleteSessionAsync` | `DELETE …/sessions/{id}` | Soft-delete SaveChanges | No | Soft DeletedAt | Cascades notes/docs/queue soft-delete | `.delete` (**no owner check**) | Yes | No | **A** | Version required on soft-delete of CS row |
| M11 | `StartSessionFromQueueAsync` | **No HTTP route** | Tracked SaveChanges | No | → InProgress | Start time | Owner if session linked | No | N/A | **A** | Tests-only entry today; if exposed later, same rule |
| M12 | `CounselingController.ReQueueSession` | `POST …/re-queue` | Tracked SaveChanges | **Unchanged** | No ownership clear | Intention / SessionType / AdditionalNotes + new queue row | `.update` only (**no owner ACL**) | No | No | **D** | **PD-S7-07** — Slice 8. CURRENT requeue behavior unchanged in Slice 7. Residual LWW on these CS fields until Slice 8. |
| M13 | `OtFinalizeService.RefreshSessionFromOpdAsync` | `POST …/refresh-from-opd` | Tracked SaveChanges | No | No | RecommendedSurgery, IolPower | `.update` (**no owner ACL**) | No | No | **A** | |
| M14 | `OtFinalizeService.EnrichRequestFromOpdAsync` (via `UpsertFromCounsellorAsync`) | `POST …/ot-schedule` (conditional CS write) | Tracked; SaveChanges in Upsert | No | No | May set `IolPower` when OPD copy writes | `.update` on OT path | No | OT 409 elsewhere (not CS) | **A** | Only when CS row is modified; require expected session Version when `CounsellingSessionId` present and write occurs |
| M15 | `CounselorCommunicationService.QuickBookFromSessionAsync` | `POST …/sessions/{id}/quick-book-surgery` | Tracked SaveChanges | No | Decision flags | PatientAgreedToSurgery, PendingDecision, DecisionDate | `.update` | No | No | **A** | Also creates `OTSchedule` (C) |
| M16 | Seed `SeedController.SeedCounselorQueue` | `POST /api/Seed/counselor-queue` | Hard RemoveRange + Add | Seed values | Seed | Full rows | Weak / no method permission | Partial | No | **A\*\*** | Dev tooling. Still mutates CS. Slice 7 **production** scope = counselling APIs; seed must not invent LWW grace — either wire Version when touching tracked entities or leave as known residual **dev-only** risk (document; do not add bypass). |
| M17 | Seed `SeedDataController.SeedCounselorQueueData` | `POST /api/SeedData/counselor-queue` | Tracked Add | Seeder | Seed | Insert | `[AllowAnonymous]` | No | No | **A\*\*** | Same as M16 |
| M18 | `CounselorCommunicationService.AddCommLogAsync` | `POST …/sessions/{id}/communication-logs` | Tracked SaveChanges | No | Optional EscalationStatus | LastContactDate, LastContactOutcome, ContactAttemptCount | `.update` path via controller | No | No | **A** | **Audit correction:** was misclassified N08 Class C. Must participate in Version (PD-S7-02). |
| M19 | `ApplyCcmsCallbackAsync` | `POST /api/internal/ccms-callback` | Tracked SaveChanges | No | No | PackageAddonsJson, UpdatedAt | Internal API key | No | No | **A** | **APPROVED Class A.** System writer: no client expected Version; EF original Version concurrency; no LWW; no auto-retry. |

\* Create initializes Version; expected Version N/A on request.  
\*\* Dev/seed residual — does not block READY; implementers must not treat seed as production LWW grace for desk APIs.

### 5.2 Related paths that do **not** mutate `CounselingSession` columns

| ID | Surface | Mutates | Class |
|----|---------|---------|-------|
| N01 | `MarkAddOnSurgeryAsync` | Loads CS for ACL; mutates **queue** only | **C** |
| N02 | `SaveSessionInvestigationsAsync` | Loads CS for ACL/PatientId; writes **CounselorLabOrderItem** | **C** |
| N03 | Session notes CRUD | `CounselingSessionNote` | **C** |
| N04 | Session documents CRUD / upload-audio / verify | `CounselingSessionDocument` | **C** |
| N05 | Ownership History / `CounselingSessionAuditLog` | Audit log rows (written *with* ownership/content ops) | **C** (trail entity); writers of CS remain A/B |
| N06 | Platform `IAuditService` / AuditLog | Platform audit | **C** |
| N07 | CounselorQueue CallNext / queue-only ops | Queue | **C** |
| N08 | ~~Communication logs / callbacks / reminders~~ | ~~Comm tables (session read for context)~~ | ~~**C**~~ → **CORRECTED — see M18 / §5.1a** |
| N09 | counselling-service `PatientCounselling` + xmin | Separate DB | **C** + **PD-S7-08** |
| N10 | OT finalize schedule entity Version soft++ | `OtFinalizeSchedule` | **C** (do not reuse as CS token) |
| N11 | Background jobs / outbox / Azure Functions | **No** Auth CS writers found (except M19 below) | **C** / N/A |

### 5.1a Audit correction — N08 Communication Logs (APPROVED)

| Field | Value |
|-------|--------|
| **Previous classification** | **Class C** — session read for context only |
| **Correct classification** | **Class A** — persisted `CounselingSession` mutation |
| **Inventory ID** | **M18** |
| **Path** | `microservices/auth-service/AuthService/Services/CounselorCommunicationService.cs` |
| **Method** | `AddCommLogAsync` |
| **HTTP** | `POST /api/Counseling/sessions/{sessionId}/communication-logs` |
| **Reason** | Directly writes `LastContactDate`, `LastContactOutcome`, `ContactAttemptCount++`, optional `EscalationStatus = "Normal"` on the Auth `CounselingSession` row |
| **PD-S7-02** | In scope — expected Version required; success increments Version; stale → **409**; no partial mutation; no LWW deferral |
| **Product status** | **APPROVED** for Slice 7 (implementation prompt correction; not a new PD) |

### 5.1b M19 ApplyCcmsCallbackAsync — APPROVED Class A (system writer)

| Field | Value |
|-------|--------|
| **Status** | **APPROVED Class A** |
| **Inventory ID** | **M19** |
| **Path** | `microservices/auth-service/AuthService/Services/CounselingWorkflowService.cs` |
| **Method** | `ApplyCcmsCallbackAsync` |
| **Endpoint / caller** | `POST /api/internal/ccms-callback` — `InternalCcmsCallbackController`; CCMS `AuthServiceClient` only (no browser/FE caller) |
| **CounselingSession fields written** | `PackageAddonsJson`, `UpdatedAt` |
| **Caller Version** | **None** — internal system writer; uses EF original `CounselingSession.Version` as concurrency token (no invented client Version contract) |
| **Conflict** | Must not overwrite newer state; must not auto-retry/reload-merge; surface conflict distinctly (prefer HTTP **409** if compatible with fire-and-forget CCMS logging) |
| **Not deferred** | Do **not** treat as LWW |

### 5.3 Classification summary counts

| Class | Count (inventory IDs) |
|-------|------------------------|
| **A** | M01–M03, M07–M11, M13–M17, **M18**, **M19** |
| **B** | M04–M06 |
| **C** | N01–N07, N09–N11 (**N08 removed from C**) |
| **D** | M12 (ReQueue) |

Residual items (seed tooling; ReQueue LWW until Slice 8) remain documented boundaries, not open product questions.

---

## 6. Ownership Version strategy (FUTURE IMPLEMENTATION)

### 6.1 Intended predicates

**Assign**

```text
WHERE Id = @id AND TenantId = @tid AND DeletedAt IS NULL
  AND CounselorId IS NULL
  AND Version = @expectedVersion
SET CounselorId = @target, UpdatedAt = @now, UpdatedByUserId = @actor,
    Version = Version + 1   -- or SetProperty to expected+1
```

**Claim (NULL path)**

```text
WHERE … AND CounselorId IS NULL AND Version = @expectedVersion
SET CounselorId = @actor, …, Version = Version + 1
```

**Claim (owned path) / Reassign**

```text
WHERE … AND CounselorId = @expectedCounselorId AND Version = @expectedVersion
SET CounselorId = @targetOrActor, …, Version = Version + 1
```

### 6.2 Conflict semantics

| Condition | HTTP |
|-----------|------|
| Zero rows (stale Version and/or stale expectedCounselorId and/or already assigned) | **409** |
| Both Version and expectedCounselorId stale | **409** (single atomic miss — **no priority distinction required**; SQL WHERE is AND) |
| Success | Version incremented; History/Audit only on success |
| Reject | No success History/Audit |

### 6.3 InMemory / tests

Preserve existing tracked fallback for EF InMemory tests: check CounselorId **and** Version before assign; same 409 semantics.

---

## 7. OpdBill concurrency pattern (reuse assessment)

| Piece | Location | Detail |
|-------|----------|--------|
| Property | `OpdBill.cs` | `[ConcurrencyCheck]` `int RowVersion { get; set; } = 1;` column `row_version` |
| EF | `AppDbContext` OpdBill config | `.IsConcurrencyToken().HasDefaultValue(1)` |
| Bump | `AppDbContext.SaveChangesAsync` | Modified OpdBill: `CurrentValue = OriginalValue + 1` |
| Exception | same | `DbUpdateConcurrencyException` → if OpdBill → `InvalidOperationException(BillConcurrency.StaleMessage)` |
| Helper | `BillConcurrency.cs` | `StaleMessage = "This bill was updated by another user."`; `IsStale(ex)` |
| API | e.g. `BillItemsController` | `catch when (BillConcurrency.IsStale(ex)) return Conflict(...)` → **409** |
| Migration | `consolidated/migrations/158_bill_item_source_and_row_version.sql` | `ALTER TABLE opd_bills ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;` |
| Tests | `BillItemIdempotencyTests` etc. | Concurrent update throws stale |

### Safe reuse for CounselingSession

| Reuse | How |
|-------|-----|
| Yes | `int` property + `IsConcurrencyToken` + default 1 |
| Yes | Additive SQL migration pattern (`version integer NOT NULL DEFAULT 1`) |
| Yes | SaveChanges bump for **tracked** Modified `CounselingSession` |
| Yes | Map concurrency exception → Conflict 409 (counselling-specific message per PD-S7-06) |
| Yes | Conceptual `CounselingSessionConcurrency` helper mirroring `BillConcurrency` (same pattern, **not** a second framework) |
| No | Share OpdBill exception filter blindly (entity type check must include CounselingSession) |
| No | OT soft Version++ |
| No | xmin |

**ExecuteUpdate ownership paths** do **not** rely on EF original-value tokens alone — they must set Version in SQL WHERE/SET explicitly (§6).

---

## 8. ExecuteUpdate concurrency design (FUTURE)

| Requirement | Design |
|-------------|--------|
| Atomicity | Keep existing `BeginTransactionAsync` around ownership mutate + trail |
| WHERE | Ownership predicate **AND** `Version == expectedVersion` |
| SET | Ownership fields + `Version = expectedVersion + 1` (or `Version + 1`) + UpdatedAt/By |
| affected == 0 | Rollback; **409**; no History/Audit |
| affected == 1 | Stage History/Audit; SaveChanges for trail; Commit |
| Missing expected Version | **400** (or dedicated bad-request) **before** mutate — PD-S7-05; never treat as unconstrained |

---

## 9. API / Version contract surface (FUTURE — do not implement now)

Do **not** invent new endpoints or change verbs/names. Add `version` / `expectedVersion` on existing contracts.

### 9.1 Responses that must expose Version

| Contract | CURRENT | Proposed |
|----------|---------|----------|
| `CounselingSessionDto` / Details / list waiting-list session payloads | No Version | Include `version: number` |
| Assign / Claim / Reassign success payloads (`AssignSessionResult` / session DTO) | CounselorId etc. | Include new `version` after bump |
| Update/Start/Complete success (`SessionOperationResult.Session`) | Session DTO | Include `version` |

### 9.2 Requests that must carry expected Version

| Endpoint | CURRENT body | Proposed |
|----------|--------------|----------|
| `PUT …/sessions/{id}` (`UpdateCounselingSessionRequest`) | Content fields | + **required** `version` (expected) |
| `PUT …/advance-stage` | `{ stage }` | + **required** `version` |
| `POST …/start` | optional sessionType | + **required** `version` (body) |
| `POST …/complete` | empty / none | + **required** `version` (body) |
| `POST …/cancel` | `{ reason }` | + **required** `version` |
| `DELETE …/sessions/{id}` | none | expected Version via body or existing project query convention — **prefer body `{ version }`** if DELETE body allowed; else established Auth pattern. **Implementation note:** pick one existing Auth convention; do not invent a Version-only endpoint. |
| `POST …/assign` | `{ counselorId }` | + **required** `version` |
| `POST …/claim-for-lifecycle` | `{ expectedCounselorId?, intent }` | + **required** `version` |
| `POST …/reassign` | `{ counselorId, expectedCounselorId, reason }` | + **required** `version` |
| `POST …/refresh-from-opd` | none / minimal | + **required** `version` |
| `POST …/quick-book-surgery` | schedule fields | + **required** `version` |
| `POST …/ot-schedule` (when CS may be written) | OT upsert DTO | + **required** session `version` when `CounsellingSessionId` set |
| `POST …/sessions/{id}/communication-logs` (**M18**) | `CreateCommLogRequest` (channel/outcome/…) | + **required** expected CounselingSession `version` |
| `POST …/sessions` create | create DTO | **No** expected Version; server sets initial |
| `POST /api/internal/ccms-callback` (**M19**) | CCMS linkage fields | **No client Version.** EF original Version; conflict → non-success (prefer 409); no auto-retry |

### 9.3 Explicitly deferred / excluded contracts

| Endpoint | Slice 7 Version? | Why |
|----------|------------------|-----|
| `POST …/re-queue` | **No** (D) | PD-S7-07 |
| Notes / documents / investigations | **No** (C) | Different entities |
| Mark add-on surgery | **No** (C) | Queue only |
| Azure counselling Functions | **No** | PD-S7-08 |

### 9.4 Legacy callers discovered (PD-S7-05)

All CURRENT FE callers omit Version (expected). Must be updated in Slice 7 implementation — **no grace**:

| Client | Mutations |
|--------|-----------|
| `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` | saveSession, start, complete, assign, claim, reassign, refresh-from-opd, reQueue (reQueue deferred), quick-book if used |
| `apps/hospital-portal-web/src/lib/api/counseling-sessions.api.ts` | update, start, complete, cancel, delete, advanceStage |
| `save-counselling-draft.ts` / `save-counselling-session.ts` | build PUT payload / complete |
| Waiting-list Assign / Claim / Reassign dialogs & page | ownership bodies |
| Any integration/test harness posting same routes without Version | Must fail closed after Slice 7 |

---

## 10. Frontend concurrency surface (AUDIT — no FE changes)

### 10.1 Load / store

| Area | CURRENT |
|------|---------|
| Session load | `counsellorsDeskApi` GET session; `use-counselling-session-controller` / waiting-list queries |
| Type | `CounsellingSession` in `types/counsellors-desk.ts` — has `counselorId`, **no Version** |
| Waiting list row | Ownership display fields; **no Version** |

**Future:** persist `version` from GET/list into session controller state and waiting-list row model; refresh updates Version.

### 10.2 Mutation origins

| Action | Origin | Payload builder |
|--------|--------|-----------------|
| Save Draft | Action bar / controller | `save-counselling-draft.ts` → `saveSession` PUT |
| Finish / Complete | `save-counselling-session.ts` | PUT then `completeSession` |
| Start | controller / waiting-list | `startSession` |
| Assign | `WaitingListAssignDialog` | `assignSession` |
| Claim | `waiting-list/page.tsx` | `claimSessionForLifecycle` |
| Reassign | `WaitingListReassignDialog` | `reassignSession` (+ expectedCounselorId) |
| Investigations | draft/complete save | `saveInvestigations` (**C** — no CS Version) |
| ReQueue | `surgery-followup/page.tsx` | `reQueueSession` (**D** / Slice 8) |
| Refresh OPD | desk API helper | `refresh-from-opd` |

### 10.3 409 / 403 CURRENT

| Path | 409 | 403 |
|------|-----|-----|
| Claim | toast + waiting-list refetch | `skipForbiddenRedirect` on API |
| Reassign | toast + `onOwnershipConflict` | same |
| Assign | generic error toast (no dedicated 409 UX) | same |
| Save Draft / Complete / Start | none (backend does not 409) | ownership 403 via MapSessionOperationResult when owner check fails |

### 10.4 Minimum future FE changes (implement in Slice 7)

1. Plumb `version` from session GET into client state.  
2. Include `version` on every A/B mutation payload.  
3. On **409**: stop; toast PD-S7-06 message; refetch authoritative session; **no auto-retry**; block overwrite of refreshed state with stale form until user reviews.  
4. Keep **403** ownership messaging distinct.  
5. After Assign/Claim/Reassign success, update local Version from response (or refetch).  
6. Do **not** add Version to ReQueue in Slice 7.

---

## 11. 403 vs 409 semantics (APPROVED boundary)

| Code | Meaning | Typical cause | UX (future) |
|------|---------|---------------|-------------|
| **409** | Stale concurrency | Wrong/missing Version; ownership CAS miss; already assigned | Stop; refetch; *"This session was updated by another user. Refresh to continue."*; no auto-retry |
| **403** | Authz / ownership ACL | Non-owner mutate; missing `.reassign`; branch deny | Existing ownership/permission behavior |

Scenarios (future verification — not implemented now):

| Scenario | Expected |
|----------|----------|
| A — Content update advances Version; stale Save | **409** |
| B — Reassign advances Version; old owner Save with old Version | **409** (not silent overwrite) |
| C — Concurrent different fields | **409**; **no auto-merge** |
| D — Ownership lost + fresh Version but non-owner | **403** (distinguishable from 409) |

---

## 12. Requeue boundary (PD-S7-07)

| Item | Rule |
|------|------|
| Slice | **8** |
| Slice 7 | Do **not** clear CounselorId; do **not** emit `OwnershipRequeued`; do **not** add Version to re-queue |
| CURRENT | ReQueue may append notes / intention / session type and create queue row; ownership unchanged |
| Residual risk until Slice 8 | ReQueue content fields remain LWW relative to Versioned desk mutations |
| Shared infra | Slice 7 Version column on CS does not require ReQueue changes; ReQueue simply will not send/check Version yet |

---

## 13. Proposed Slice 7 test matrix (do not implement now)

### Backend

- Version property + column mapping + default  
- `IsConcurrencyToken` configuration  
- Migration additive + backfill default  
- Tracked SaveChanges: success increments Version  
- Tracked SaveChanges: stale Version → 409 / stale helper  
- Missing Version on covered mutate → reject (not LWW)  
- Assign / Claim / Reassign: expected Version + ownership WHERE  
- Stale Version → 409; stale expectedCounselorId → 409; both → 409  
- Successful ownership advances Version  
- Rejected ownership: **no** History/Audit  
- Transaction rollback on conflict  
- Update/Start/Complete/Cancel/Delete/Refresh/QuickBook/OT enrich path as applicable  
- Create initializes Version; response includes Version  
- ReQueue unchanged (no Version requirement)  
- Notes/investigations/documents unchanged (C)

### Frontend

- Version loaded into session state  
- Version included on Save Draft / Complete / Start / ownership calls  
- 409 handling: message, refetch, no auto-retry  
- 403 ownership distinct  
- Stale UI cannot overwrite after refresh without review

### Regression

- Phase3I Slice 3 Assign  
- Slice 4 owner ACL + Pending read-only  
- Slice 5 History/Audit  
- Slice 6 Reassign  
- Processing explicit assignment  
- Done/Repeat lifecycle claim  
- Existing counselling draft/finish workflow  

---

## 14. Implementation scope (when Slice 7 coding starts)

**In scope**

- Auth `CounselingSession.Version` + EF token + migration  
- SaveChanges concurrency handling (OpdBill-style)  
- ExecuteUpdate ownership AND Version (Assign/Claim/Reassign)  
- Expected Version on A/B API contracts + responses  
- Controller mapping: Conflict for stale content mutates  
- FE Version plumb + 409 UX (PD-S7-06)  
- Tests per §13  

**Out of scope (explicit)**

- Requeue→NULL / `OwnershipRequeued` / Requeue Version (Slice 8)  
- counselling-service xmin / cross-service sync  
- OT soft Version as CS token  
- Notifications / SignalR ownership push  
- Auto-merge; auto-retry stale saves  
- New concurrency framework / new endpoints / verb renames  
- Permission / role redesign  
- Changing ownership invariants (NULL-only Assign, etc.)

---

## 15. Unresolved decisions

| Item | Status |
|------|--------|
| PD-S7-01…08 | **CLOSED / APPROVED** |
| N08 / M18 communication-log classification | **CORRECTED → Class A (APPROVED)** |
| M19 `ApplyCcmsCallbackAsync` | **APPROVED Class A** (system writer; no FE Version) |
| Mutation inventory | **COMPLETE** for Slice 7 gate |
| Implementation notes | DELETE Version transport chosen; seed residual; ReQueue LWW until Slice 8 |

---

## 16. Files changed by **this** audit task

| File | Change |
|------|--------|
| `docs/audits/counsellor-ownership-work-allocation-phase3i-slice7-readiness-audit.md` | Decision closure + N08→M18 + M19 Class A approval |

Slice 7 production implementation proceeds under continuation prompt.

---

## 17. Verdict

**READY FOR SLICE 7 IMPLEMENTATION**

M18 and M19 are approved Class A. Do **not** start Slice 8.
