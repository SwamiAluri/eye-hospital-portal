# Phase 3I — Slice 8 ReQueue → NULL
## Readiness Audit (AUDIT ONLY)

| Field | Value |
|-------|--------|
| **Audit date** | 2026-09-18 |
| **Phase type** | **READINESS / DIAGNOSIS ONLY** — no production code, API, DB, migration, permission, UI, ownership, ReQueue, or test changes |
| **Authoritative parent rule** | Phase 3H **PD-REQUEUE-01** (WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED) |
| **Prior slices (accepted)** | Slices 1–7 implemented, tested, Manual UAT-accepted |
| **Slice 7 boundary (accepted)** | **PD-S7-07** — Requeue remains Slice 8; no Requeue→NULL, no `OwnershipRequeued`, no Slice 7 Version contract on re-queue |
| **This document** | Complete ReQueue inventory; CURRENT behavior; ownership/queue SoT; Version interaction; PD-S8 register; implementation boundary |
| **Production behavior changed?** | **NO** |

**Legend**

| Label | Meaning |
|-------|---------|
| **CURRENT** | What code does today |
| **WORKING (3H)** | Phase 3H workshop agreement — not formally signed |
| **PRODUCT DECISION REQUIRED** | Open PD-S8-* item — blocks implementation until approved |
| **FUTURE IMPLEMENTATION** | Slice 8 coding — **not started** |
| **OUT OF SCOPE** | Must not change in Slice 8 |

---

## 1. Executive Summary

| Item | Status |
|------|--------|
| Counselling ReQueue endpoint exists? | **YES** — `POST /api/Counseling/sessions/{id}/re-queue` |
| Clears `CounselorId` today? | **NO** — **retains** owner (**CURRENT**) |
| Creates new Waiting queue row? | **YES** — always `Add` new `CounselorQueueItem` |
| Updates / soft-deletes prior queue row? | **NO** |
| Creates new `CounselingSession`? | **NO** — same session |
| Mutates session lifecycle `Status`? | **NO** |
| History / Audit ownership trail? | **NO** — `OwnershipRequeued` reserved, not emitted |
| Owner ACL on ReQueue? | **NO** — any `counseling_sessions.update` |
| Branch authorization gate? | **NO** — tenant + session load only |
| Optimistic Version contract? | **NO** — no request Version; session still Modified → Version bumps implicitly |
| Duplicate Waiting rows possible? | **YES** — no idempotency / unique active-Waiting guard |
| Primary FE caller? | Follow-up Center `surgery-followup/page.tsx` |
| Billing/IP “requeue” related? | **NO** — outbox only; out of scope |
| OT cancel “re-queued” toast related? | **Misleading copy** — does **not** call Auth ReQueue |
| PD-REQUEUE-01 working target? | `CounselorId → NULL` + History/Audit; explicit Assign thereafter |
| Slice 8 product register closed? | **NO** — PD-S8-01…16 open |

### Core finding

**CURRENT ReQueue** returns a patient to the Waiting List as a **new Waiting queue row** while **keeping** `CounselingSession.CounselorId`. That contradicts the accepted ownership model and **PD-REQUEUE-01** (owned → Unassigned on requeue). Waiting List Owner is projected from session `CounselorId`, so post-ReQueue rows currently show the **prior owner** and **Start Counseling / View**, not **Assign**.

### Final verdict

**READY FOR PRODUCT APPROVAL**

Implementation must not start until PD-S8 decisions are approved. Do **not** treat this document as READY FOR IMPLEMENTATION.

---

## 2. Current ReQueue implementation

### 2.1 Authoritative writer (only counselling ReQueue path)

| Aspect | CURRENT |
|--------|---------|
| File | `microservices/auth-service/AuthService/Controllers/CounselingController.cs` |
| Method | `ReQueueSession` (~1686–1766) |
| HTTP | `POST /api/Counseling/sessions/{id}/re-queue` |
| Permission | `[RequirePermission("counseling_sessions.update")]` |
| Service layer | **None** — logic is **inline in the controller** (not `CounselingWorkflowService`) |
| Transaction | **None** — single tracked `SaveChangesAsync()` |
| Owner ACL | **None** |
| Branch gate | **None** (no `ResolveAccessibleBranchesAsync`) |
| Eligibility by session/queue status | **None** |
| Idempotency | **None** |

### 2.2 Request / response

**Request DTO** — `ReQueueSessionRequest` (`CounselorCommunicationModels.cs` ~170–181):

| Field | Required? | Effect |
|-------|-----------|--------|
| `NewIntention` | No | May set `CounselingSession.PatientIntention` (writable-intention normalize) |
| `Notes` | No | Appends to `AdditionalNotes` with `[Re-queue {date}]` prefix |
| `SessionType` | No | May set `SessionType` (trim) |
| `Version` | **Absent** | — |
| `Reason` | **Absent** (notes are optional free text) | — |
| `ExpectedCounselorId` | **Absent** | — |

**Response:** `{ success, tokenNumber, queueItemId, message }` — **no** `CounselorId`, **no** `Version`.

### 2.3 Exact CURRENT field mutations

**`CounselingSession` (same row):**

| Field | Written? | Value |
|-------|----------|-------|
| `CounselorId` | **No** | **Retained** |
| `Status` | **No** | Unchanged (`Scheduled` / `InProgress` / `Completed` / …) |
| `PatientIntention` | Conditional | From `NewIntention` |
| `SessionType` | Conditional | From `SessionType` |
| `AdditionalNotes` | Conditional | Append re-queue note |
| `UpdatedAt` / `UpdatedByUserId` | Yes | Actor + UtcNow |
| `Version` | Implicit | Bumped by `AppDbContext.SaveChangesAsync` when entity is Modified (Slice 7) — **not** client-checked |

**`CounselorQueueItem` (new row):**

| Field | Value |
|-------|-------|
| `Status` | `"Waiting"` |
| `QueueType` | `"RepeatCounselling"` |
| `BranchId` | `session.BranchId ?? Guid.Empty` |
| `SessionId` / `PatientId` / `TenantId` | From session / actor tenant |
| `TokenNumber` | `FU-{yyMMdd}-{pos:D3}` |
| `QueuePosition` | max Waiting position in tenant+branch + 1 |
| Prior queue rows | **Untouched** (not Cancelled, not soft-deleted) |

### 2.4 Answers to audit checklist A–J

| # | Question | CURRENT answer |
|---|----------|----------------|
| A | Create new queue row? | **Yes** |
| A | Update existing queue row? | **No** |
| A | Create new CounselingSession? | **No** |
| A | Update CounselingSession? | **Yes** (notes/intention/type/audit stamps; **not** CounselorId/Status) |
| A | Update CounselorId? | **No** |
| A | Update queue status (existing)? | **No** |
| A | Update session Status? | **No** |
| A | Duplicate Waiting rows? | **Yes, possible** on repeat ReQueue |
| A | Retain existing owner? | **Yes** |
| A | Create History / Audit / ownership History? | **No** |
| A | Change Version intentionally? | No contract; **implicit bump** on Modified |
| B | Previous queue row? | Remains as-is (often `Completed` → WL Done/Repeat) |
| C | New queue row? | `Waiting` → WL **Pending** |
| D | Authoritative WL display row? | **One API row per queue item** — both prior Completed and new Waiting can appear |
| E | Operates on session and/or queue? | **Both** — session content stamps + new queue |
| F | Participates in Version concurrency contract? | **No** (no expected Version) |
| G | Optimistic concurrency protection? | **No** explicit; EF token may throw only if another writer raced mid-SaveChanges |
| H | Two users requeue same session? | Both succeed → **two Waiting rows** (no CAS) |
| I | ReQueue while owned? | Allowed; owner **retained** |
| J | ReQueue while unassigned? | Allowed; stays NULL; still adds Waiting row |

---

## 3. Complete mutation inventory

### 3.1 Counselling ReQueue writers

| ID | File | Method | Endpoint / caller | Entity | Fields written | CounselorId | Version | Queue | Txn | Perm | Branch | History/Audit | FE |
|----|------|--------|-------------------|--------|----------------|-------------|---------|-------|-----|------|--------|---------------|-----|
| **RQ-01** | `CounselingController.cs` | `ReQueueSession` | `POST …/re-queue` | `CounselingSession` + new `CounselorQueueItem` | Intention/SessionType/Notes/Updated*; queue Waiting row | **Unchanged** | Implicit bump | **Insert Waiting** | No | `.update` | Tenant only | None | Follow-up Center |

**Only RQ-01 is the counselling ReQueue ownership-relevant writer.**

### 3.2 Related paths (not Slice 8 ReQueue; must not be confused)

| ID | Surface | Behavior | Slice 8? |
|----|---------|----------|----------|
| RQ-X1 | `BillingOutboxController.Requeue` / `BillingCcmsOutboxService.RequeueAsync` | Outbox Dead/Failed → Pending | **OUT OF SCOPE** |
| RQ-X2 | IP `IntegrationOutboxService` requeue | IP outbox | **OUT OF SCOPE** |
| RQ-X3 | Admin Integration Health FE | Calls billing/IP requeue | **OUT OF SCOPE** |
| RQ-X4 | `OtFinalizeService.CancelAsync` + `BackSyncToCounsellingAsync` | OT Cancelled; HTTP to missing `…/cancel-ot`; **does not** call Auth ReQueue; **does not** clear CounselorId | **OUT OF SCOPE** (honesty gap; Slice 9 adjacent) |
| RQ-X5 | Finalize Surgery FE toast “counselling session re-queued” | Copy overclaim | **OUT OF SCOPE** |
| RQ-X6 | `AddToQueueAsync` / Create session queue | Initial Waiting on create | **OUT OF SCOPE** |
| RQ-X7 | Seed counselor-queue endpoints | Dev seed | **OUT OF SCOPE** |

### 3.3 Direct `CounselorId` mutations (ownership SoT — Auth)

| Op | Clears to NULL? | Notes |
|----|-----------------|-------|
| Create (Admin / non-counsellor) | Starts NULL | PD-ADM-01 |
| Create (assignable counsellor) | Sets self | Create ownership |
| Assign | Only when already NULL | Slice 3 |
| Claim-for-lifecycle | May claim from NULL | Done/Repeat |
| Reassign | Rejects NULL | Slice 6 |
| Start / Complete / Cancel / Update | Must not clear | Slice 2/4 |
| **ReQueue** | **Does not clear (CURRENT)** | **Slice 8 target** |
| Soft-delete session | Soft-deletes queues; does not “unassign” for WL | Different lifecycle |

**Repository-wide search confirmation:** no production counselling path currently implements `CounselorId = NULL` as a ReQueue side effect. Reserved comment only: `OwnershipAuditEvents` — `OwnershipRequeued` “do not emit until Slice 8”.

---

## 4. Current CounselorId behavior

| Context | CURRENT |
|---------|---------|
| After ReQueue | **Same** `CounselorId` as before |
| Unowned session ReQueue | Remains NULL |
| Actor of ReQueue | Does **not** become owner |
| Silent Start ownership | Still forbidden (Slice 2) — ReQueue does not Start |
| PD-REQUEUE-01 target | Owned → **NULL**; history preserved; no auto-assign |

---

## 5. Queue state behavior

### 5.1 Queue vs session ownership (SoT)

| Concept | Source of truth | Notes |
|---------|-----------------|-------|
| Active counselling owner | **`CounselingSession.CounselorId`** | Only ownership SoT |
| Queue row “owner” | **None** — `CounselorQueueItem` has **no** CounselorId column | Queue is operational state only |
| Waiting List Owner column | Session `CounselorId` (+ user name join) | Projected per queue row |
| Auth queue status | `CounselorQueueItem.Status` | Waiting / Called / InProgress / Completed / … |
| Counselling lifecycle status | `CounselingSession.Status` | Scheduled / InProgress / Completed / … — **orthogonal** to queue |
| Waiting List Status badge | Mapped from **queue** status (+ OT SurgeryDone / agreed flags for Completed) | See §12 |

**Goal:** do **not** invent a second ownership field on the queue row. Slice 8 clears session ownership only.

### 5.2 CURRENT queue lifecycle on ReQueue

```
Prior queue row (e.g. Completed)  ──unchanged──► still visible as Done/Repeat/SurgeryDone
New queue row (Waiting)           ──created───► visible as Pending
Same CounselingSession            ──CounselorId retained──► Owner still A
```

---

## 6. CounselingSession lifecycle interaction

| Field | CURRENT on ReQueue |
|-------|--------------------|
| `CounselingSession.Status` | **Unchanged** |
| Queue `Status` (new) | Forced `"Waiting"` |
| WL projected status (new row) | **Pending** |
| Start Counseling later | Uses existing Start rules + owner ACL; may flip Waiting→InProgress |

**PRODUCT DECISION REQUIRED (PD-S8-05):** whether session `Status` must be reset (e.g. Completed → Scheduled) when requeued, or left unchanged while only queue returns to Waiting.

---

## 7. Version / concurrency interaction (Slice 7 accepted)

| Item | CURRENT / assessment |
|------|----------------------|
| `CounselingSession.Version` | Exists; `[ConcurrencyCheck]`; EF concurrency token; bumped on every Modified SaveChanges |
| ReQueue writes CounselingSession? | **Yes** (content stamps) |
| Slice 8 will write `CounselorId = NULL`? | **If PD-REQUEUE-01 implemented — Yes** → ownership mutation |
| Expected Version required today? | **No** |
| Atomic ownership predicate today? | **No** |
| Stale Version on ReQueue today? | Client unaware; response has no Version; FE cannot refresh Version from ReQueue |
| 403 vs 409 mapping | Slice 7: **403** authz/ownership; **409** stale Version — must remain |
| Suitable Version contract on API? | **No** — must be added if product requires Version participation |

**Assessment:** Clearing `CounselorId` is a `CounselingSession` mutation. Under **PD-S7-02/03/04** spirit and **PD-CONC-01**, Slice 8 **should** participate in Version + ownership CAS — **but this is not silently assumed**. See **PD-S8-06**.

Race example (CURRENT → target expectation under accepted 403/409):

1. Counsellor A opens owned session (Version N).  
2. Actor ReQueues → CounselorId NULL, Version N+1 (if Slice 8 clears + bumps).  
3. A Save Draft with Version N → **409** (stale) and/or subsequent owner check → **403** if Version somehow matched but owner NULL.

Do not invent new conflict codes.

---

## 8. Assign / Reassign interaction

| Op | Rule (accepted) | After CURRENT ReQueue | After target ReQueue→NULL |
|----|-----------------|----------------------|---------------------------|
| Assign | NULL → target; requires Waiting/InProgress/Called; expected Version | **Rejected** if owner retained (“already assigned”) | **Eligible** on new Waiting row |
| Reassign | A → B; rejects NULL | Still available if owned Pending/Processed | **Must reject** NULL — use Assign |
| Claim | Done/Repeat Completed-queue path | Not for fresh Waiting | Unchanged |
| Start | Owner ACL; no stamp | Owner can Start on Pending row | After Assign only |

**Documented interactions (do not change Assign/Reassign in Slice 8):**

- After ReQueue→NULL, **Assign remains the only NULL → owner path**.
- Reassign continues to reject unassigned sessions.
- No automatic ownership restore; no Start silent ownership.

---

## 9. History / Audit interaction

| Item | CURRENT | Reserved / WORKING |
|------|---------|-------------------|
| Dual trail helper | `StageOwnershipTrailAsync` (Slice 5) | Reusable |
| ReQueue trail today | **None** | — |
| Reserved ChangeType | Comment only: `OwnershipRequeued` | Not in emitted constants body (comment under `OwnershipAuditEvents`) |
| FE `SessionHistoryModal` | Labels Create/Assigned/Claimed/Reassigned only | No `OwnershipRequeued` label yet |
| PD-REQUEUE-01 | Preserve previous owner, actor, timestamp, reason where applicable, transition to unassigned | WORKING |

**PRODUCT DECISION REQUIRED (PD-S8-07 / PD-S8-08):** exact event name (`OwnershipRequeued` vs `OwnershipCleared` vs other), required fields (Actor, From, To=NULL, Source, Intent, Reason), and same-transaction boundary with queue insert + CounselorId clear.

Do **not** select/implement an event name without product approval.

---

## 10. Permissions / ACL

| Gate | CURRENT |
|------|---------|
| Endpoint permission | `counseling_sessions.update` |
| Owner ACL | **Absent** |
| Supervisory permission | **Not used** (unlike Reassign’s `.reassign`) |
| Admin | Same as any `.update` holder |
| Phase 3H matrix | “Actor must be authorized; clears ownership — Phase 3I must enforce who may requeue (owner and/or supervisor)” |

**PRODUCT DECISION REQUIRED (PD-S8-03):** who may ReQueue (any Follow-up `.update` actor per PD-FOLLOWUP-01; owner only; owner + Admin/reassign holders; new permission). Do **not** invent Supervisor role. Do **not** seed a new permission without IAM decision.

---

## 11. Branch / tenant behavior

| Check | CURRENT |
|-------|---------|
| Tenant | Session load `TenantId == actor tenant` |
| Branch authorization | **None** on ReQueue |
| Queue `BranchId` | Copied from `session.BranchId ?? Empty` |
| Cross-branch queue creation | Possible if session.BranchId set and actor lacks that branch — **gap vs PD16** |
| CounselorId NULL branch ambiguity | None — branch remains on session/queue |
| Assign after NULL | Assign already enforces actor/target branch access |

**PRODUCT DECISION REQUIRED (PD-S8-04):** whether Slice 8 must add `ResolveAccessibleBranchesAsync` (or equivalent) before mutate.

---

## 12. Waiting List behavior

### 12.1 Projection (CURRENT)

`GET /api/Counseling/waiting-list` — one row **per** non-deleted queue item joined to session.

| WL field | Derived from |
|----------|--------------|
| Owner | `session.CounselorId` / name |
| Status | Queue status map: Waiting→Pending; Called/InProgress→Processed; Completed→ SurgeryDone / Done / RepeatCounselling |
| Version | `session.Version` |
| Visibility | Shared within authorized branches (Slice 1); not filtered by CounselorId |

### 12.2 Primary CTA (CURRENT FE)

`resolveWaitingListLifecycleAction` + `isWaitingListEligibleForInitialAssign`:

| State | CTA |
|-------|-----|
| Pending/Processed + **NULL** owner | **Assign** |
| Pending + current owner | **Start Counseling** |
| Pending + peer owner | **View** |
| Processed + current owner | **Continue** |
| Done / Repeat | Re-evaluate / Start Repeat (claim path) |

### 12.3 After CURRENT ReQueue (owned retained)

New Waiting row → **Pending + Owner A** → **Start Counseling** (if you) / **View** (peer) — **not Assign**.

### 12.4 After target ReQueue→NULL (intended under PD-REQUEUE-01 + certified WL)

New Waiting row → **Pending + Unassigned** → **Assign** (existing CTA). No new CTA invented.

**PRODUCT DECISION REQUIRED (PD-S8-09):** handling of **duplicate** prior Completed + new Pending rows for same session after ReQueue (display, soft-delete prior, cancel prior, leave both).

---

## 13. Duplicate / idempotency analysis

| Risk | CURRENT |
|------|---------|
| Repeat ReQueue | New Waiting row each time |
| Unique constraint on (SessionId, Status=Waiting) | **Not observed** in entity |
| Conditional insert / expected-state predicate | **None** |
| Concurrent double submit | Two Waiting rows |

**PRODUCT DECISION REQUIRED (PD-S8-10):** allow duplicates; reject if active Waiting exists; soft-delete prior Waiting; cancel prior Completed; or reuse existing Waiting row.

---

## 14. Downstream impact

| Module | Consumes CounselorId / Waiting? | Slice 8 should mutate? |
|--------|----------------------------------|------------------------|
| Finalize Surgery / OT | OT schedule; cancel back-sync is separate | **No** — counselling-session-only |
| Follow-up Center | Invokes ReQueue; branch-shared (PD-FOLLOWUP-01) | Caller only; no Center redesign |
| Analytics | May filter My Work by CounselorId | Indirect: unassigned drops from My Work — **document, don’t change Analytics** |
| Patient Details / Clinical Recommendations | Not ReQueue writers | **No** |
| Insurance / Quote / Decision / Notes | Session content; ReQueue may append notes / intention / type | Keep content side-effects **minimal** unless product expands |
| Communication logs | Separate | **No** |
| M18/M19 | Comm log / CCMS callback Version writers | **Preserve Slice 7** |

**Boundary recommendation for product:** Slice 8 remains **Auth counselling session + queue row for that session** only.

---

## 15. API contract

### 15.1 CURRENT

| Item | Value |
|------|-------|
| Method | POST |
| Path | `/api/Counseling/sessions/{id}/re-queue` |
| Body | `{ newIntention?, notes?, sessionType? }` |
| Success | 200 + token/queue id |
| Errors | 404 not found; 400 intention normalize; 500 |
| Version | None |
| Ownership clear | None |

### 15.2 Conceptual Slice 8 contract (NOT implemented)

Pending product approval, likely needs:

- Clear `CounselorId` → NULL when owned (PD-REQUEUE-01)
- Dual History + Audit on ownership clear
- Possibly `expectedVersion` (+ return bumped Version)
- Possibly reason field
- Possibly branch gate + who-may-requeue rule
- Prefer **extend existing endpoint** unless product forbids (do not create a second ReQueue endpoint without decision)

**PD-S8-11** covers Version/reason/response shape.

---

## 16. Frontend callers

| Caller | Behavior |
|--------|----------|
| `counsellors-desk.api.ts` `reQueueSession` | POST re-queue; typed `ReQueuePayload` |
| `surgery-followup/page.tsx` `ReQueueModal` | Notes + session type; optional notes placeholder “Reason for re-queuing…” (**not** required); `PermissionGate` `.update`; on success toast + `handleRefresh` |
| Waiting List | No direct ReQueue button (CURRENT) |
| Session page | No ReQueue button found |
| 403/409 handling on ReQueue | Generic toast error only — no dedicated stale-Version UX |
| Open counselling page after remote ReQueue | Stale editor possible until refetch; owner ACL / Version should block mutate after Slice 8 clears ownership |

**OUT OF SCOPE for Slice 8 unless product expands:** redesign Follow-up Center; new WL ReQueue CTA.

---

## 17. Existing tests

| Test | Category | Asserts |
|------|----------|---------|
| `Phase3ISlice5OwnershipHistoryAuditTests.Requeue_RetainsCounselorId_NoOwnershipRequeuedEvent` | Backend ownership regression | Owner retained; no `OwnershipRequeued` History |
| Billing outbox Requeue tests | Unrelated | Outbox only |
| FE Vitest for ReQueue ownership | **None found** | — |
| HTTP controller integration for re-queue | **None found** | Mirror DB path only |

---

## 18. Required new tests (FUTURE — do not add in this audit)

Minimum for Slice 8 after PD approval:

1. Owned → NULL + Waiting row  
2. Already NULL → behavior per PD (no-op ownership trail vs reject)  
3. Waiting List projection Owner=Unassigned + Assign eligibility  
4. Assign succeeds after ReQueue  
5. Reassign rejects NULL after ReQueue  
6. Stale Version → 409 (if Version required)  
7. Prior owner Save Draft → 403 and/or 409  
8. History + Audit ownership event (approved name)  
9. Duplicate ReQueue per PD-S8-10  
10. Branch authorization deny  
11. Permission deny  
12. Lifecycle fields preserved/changed per PD-S8-05  
13. Regression: Start does not stamp ownership; Assign/Reassign/Claim unchanged  
14. Flip Slice 5 retain-owner regression to clear-owner  

---

## 19. Product Decision Register

Parent: **PD-REQUEUE-01** (WORKING — not formally signed). Slice-local decisions below are **PENDING** — none marked APPROVED in this audit.

| ID | Decision | Current evidence | Recommended bounded option (non-binding) | Implementation consequence | Blocks implementation? |
|----|----------|------------------|---------------------------------------------|----------------------------|------------------------|
| **PD-S8-01** | Confirm ReQueue clears `CounselingSession.CounselorId` → NULL | CURRENT retains; PD-REQUEUE-01 Option A | **Adopt PD-REQUEUE-01** — clear to NULL; no auto-assign | Ownership CAS + trail | **Yes** |
| **PD-S8-02** | Unowned ReQueue (already NULL) | Allowed today; adds Waiting | Allow queue side-effects; **no** ownership History (or explicit no-op) | Avoid false OwnershipRequeued | **Yes** |
| **PD-S8-03** | Who may ReQueue | Any `.update`; no owner ACL; PD-FOLLOWUP-01 shared Follow-up | Prefer: Follow-up branch-authorized `.update` **or** owner+Admin; document | Permission/ACL gates | **Yes** |
| **PD-S8-04** | Branch authorization on ReQueue | None today | Require session.BranchId ∈ actor authorized branches (PD16) | Align with Assign/WL | **Yes** |
| **PD-S8-05** | Session.Status / content on ReQueue | Status unchanged; may set intention/type/notes | Prefer: **preserve** Status; keep optional notes/type; no OT/payment/insurance changes | Lifecycle preservation | **Yes** |
| **PD-S8-06** | Version concurrency on ReQueue | No contract; implicit bump | Require `expectedVersion`; bump on success; **409** stale; return new Version | API + FE payload | **Yes** |
| **PD-S8-07** | Ownership History/Audit event name | Reserved `OwnershipRequeued` comment | Prefer reserved name **if** approved; else product picks | Trail + FE modal label | **Yes** |
| **PD-S8-08** | Reason required? | Notes optional; placeholder suggests reason | Prefer: required Reason (like Reassign) **or** optional Notes-as-reason with audit mapping | DTO + validation | **Yes** |
| **PD-S8-09** | Prior queue row fate | Untouched → duplicate WL rows | Prefer: soft-delete or Cancel non-Waiting rows for session **or** leave + document duplicate display | Queue mutation scope | **Yes** |
| **PD-S8-10** | Idempotency / duplicate Waiting | Unbounded inserts | Prefer: reject if active Waiting exists **or** reuse single Waiting | Predicate/unique rule | **Yes** |
| **PD-S8-11** | API shape | Existing POST re-queue | Extend same endpoint; add Version (± Reason); do not fork | Contract + FE | **Yes** |
| **PD-S8-12** | Ownership clear atomicity | Plain SaveChanges | Single txn: clear CounselorId (+ Version CAS) + queue policy + StageOwnershipTrailAsync | Move logic into workflow service recommended | **Yes** |
| **PD-S8-13** | Eligibility matrix (when ReQueue allowed) | Any non-deleted session | Define Pending/Processing/Completed/Done/Repeat/SurgeryDone rules | Guard clauses | **Yes** |
| **PD-S8-14** | expectedCounselorId predicate | Absent | Prefer: if owned, optional/required expected owner match (like Reassign) for race safety | 409 ownership changed | **Yes** |
| **PD-S8-15** | OT cancel / Finalize “re-queued” honesty | Toast overclaim; cancel-ot missing | **Out of Slice 8** — track separately | Prevent scope creep | No (scope) |
| **PD-S8-16** | New permission code? | `.update` only | Prefer reuse `.update` under PD-S8-03 unless IAM proves insufficient | Avoid new role/permission unless required | **Yes** if `.update` insufficient |

---

## 20. Ownership transition matrix (CURRENT vs open target)

Legend: **C** = CURRENT · **?** = PRODUCT DECISION REQUIRED · Target column states PD-REQUEUE-01 intent only where clear.

| # | Scenario | ReQueue allowed (C) | CounselorId (C → target intent) | Queue (C) | Lifecycle Status (C) | Version (C) | History (C) | Who (C) | WL after (C → intent) |
|---|----------|---------------------|----------------------------------|-----------|----------------------|-------------|-------------|---------|------------------------|
| 1 | Pending + NULL | Yes | NULL → NULL | +Waiting | Unchanged | Implicit bump | None | `.update` | Pending Unassigned → Assign |
| 2 | Pending + A | Yes | A → **A (C)** / **NULL (?)** | +Waiting | Unchanged | Implicit bump | None | `.update` | Pending owned (C) → Unassigned Assign (?) |
| 3 | Processing + A | Yes | A retained (C) | +Waiting (dup risk) | Unchanged | Implicit bump | None | `.update` | Mixed rows (?) |
| 4 | Processing + NULL | Yes | NULL | +Waiting | Unchanged | Implicit bump | None | `.update` | Pending Unassigned |
| 5 | Completed/Done + A | Yes (typical Follow-up) | A retained (C) / NULL (?) | +Waiting | Session stays Completed | Implicit bump | None | `.update` | Done **and** Pending (C) |
| 6 | Repeat + A | Yes | Same as 5 | +Waiting | Unchanged | Implicit bump | None | `.update` | Same duplicate pattern |
| 7 | SurgeryDone | Yes (no guard) | Retained (C) | +Waiting | Unchanged | Implicit bump | None | `.update` | SurgeryDone + Pending (?) |
| 8 | Already requeued | Yes | Retained (C) | Another Waiting | Unchanged | Implicit bump | None | `.update` | Multiple Pending |
| 9 | Multiple Waiting rows | Yes | Retained (C) | Another Waiting | Unchanged | Implicit bump | None | `.update` | N Pending rows |
| 10 | Stale Version | No check | N/A | Insert proceeds | Unchanged | May bump / race | None | `.update` | ? under PD-S8-06 |
| 11 | Inactive counsellor owner | Yes | Retained (C) | +Waiting | Unchanged | Implicit bump | None | `.update` | Stale owner name until NULL |
| 12 | Cross-branch / mismatch | Tenant only | Retained (C) | Queue uses session branch | Unchanged | Implicit bump | None | `.update` | PD16 gap |

---

## 21. Exact Slice 8 implementation boundary (after PD approval)

**In scope (conceptual):**

1. Auth counselling ReQueue path only (`ReQueueSession` / equivalent workflow method).  
2. `CounselingSession.CounselorId` → NULL when owned (per approved PD-S8-01).  
3. Waiting queue policy per PD-S8-09/10.  
4. Dual History + Audit ownership event per PD-S8-07/08.  
5. Version / expected-owner predicates per PD-S8-06/14.  
6. Branch/permission gates per PD-S8-03/04/16.  
7. Tests listed in §18.  
8. Minimal FE: send Version/Reason if required; refresh Follow-up; Waiting List already shows Assign when NULL.  
9. FE History label for approved event name.

**Recommended move (implementation design, not this audit):** relocate ReQueue from controller-inline into `CounselingWorkflowService` to reuse StageOwnershipTrail + ExecuteUpdate patterns — **only after PD approval**.

---

## 22. Explicit out-of-scope list

- Implement Slice 8 / clear CounselorId now  
- Change Assign / Reassign / Claim semantics  
- Change Pending read-only / Start silent ownership  
- Slice 7 Version semantics for other mutations  
- Finalize Surgery / OT cancel-ot / OT board  
- Follow-up Center redesign / Analytics My Work formula changes  
- CCMS / communication logs / M18 / M19  
- Billing/IP outbox requeue  
- New Supervisor role  
- New History/Audit framework or tables  
- Waiting List redesign / new CTA kinds  
- Migrations unless PD requires schema (none identified for NULL clear)  
- Permission catalog changes unless PD-S8-16 requires  

---

## 23. Risks / blockers

| Risk | Severity | Notes |
|------|----------|-------|
| Owned sessions remain owned after ReQueue | **P0** | Breaks shared WL + Assign model |
| Duplicate Waiting + Done rows | **P0** | Operator confusion; double work |
| No Version contract while mutating session | **P0** | Stale content / ownership races vs Slice 7 |
| No History on ownership clear | **P0** | Violates PD-REQUEUE-01 auditability |
| No branch gate | **P1** | PD16 gap |
| Who-may-requeue undefined | **P1** | Follow-up shared vs owner ACL tension |
| OT cancel toast honesty | **P2** | Out of Slice 8 but confuses UAT |
| Controller-inline ownership mutation | **P1** | Harder to keep txn/trail parity with Assign |

**No technical gap blocks writing the product pack** — blockers are **product decisions** (PD-S8-*).

---

## 24. Final verdict

**READY FOR PRODUCT APPROVAL**

Next gate: approve PD-S8-01…16 (and reaffirm PD-REQUEUE-01 for Phase 3I).  
Then: IMPLEMENTATION → AUTOMATED TESTS → MANUAL UAT → ACCEPTANCE.

**STOP.** Do not implement Slice 8 from this audit.

---

## Appendix A — Key file index

| Area | Path |
|------|------|
| ReQueue endpoint | `microservices/auth-service/AuthService/Controllers/CounselingController.cs` |
| ReQueue DTO | `…/Models/Counselor/CounselorCommunicationModels.cs` |
| Ownership trail / reserved event | `…/Services/CounselingWorkflowService.cs` |
| Version bump | `…/Context/AppDbContext.cs` |
| Session / queue entities | `…/Models/Domain/CounselingWorkflow.cs` |
| Waiting List | `CounselingController.GetWaitingList` |
| Assign / Reassign | `CounselingWorkflowService.AssignSessionAsync` / `ReassignSessionAsync` |
| FE API | `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` |
| Follow-up UI | `…/surgery-followup/page.tsx` |
| WL CTA | `…/waiting-list-lifecycle-action.ts`, `counselling-auth.ts` |
| History modal | `…/SessionHistoryModal.tsx` |
| Slice 5 retain-owner test | `AuthService.Tests/Phase3ISlice5OwnershipHistoryAuditTests.cs` |
| Parent PD | `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` § PD-REQUEUE-01 |
| Slice 7 Requeue boundary | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice7-readiness-audit.md` PD-S7-07 |

## Appendix B — Intended operational transition (product intent — not implemented)

```
OWNED COUNSELLING SESSION (CounselorId = A)
        ↓
      REQUEUE  (authorized actor; approved gates)
        ↓
correct queue/lifecycle policy (PD-S8-05/09/10)
        ↓
CounselorId = NULL  (+ Version/CAS/trail per PD-S8-06/07/12/14)
        ↓
shared Waiting List (Owner = Unassigned)
        ↓
explicit Assign required before counselling work resumes
```

Without: implicit ownership, duplicate unbounded work (unless PD allows), broken lifecycle, missing audit, stale-write vulnerability, permission/branch bypass, or downstream ownership corruption.
