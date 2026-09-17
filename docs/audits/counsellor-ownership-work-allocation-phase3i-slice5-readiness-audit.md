# Phase 3I — Slice 5 Ownership History + Audit
## Readiness Audit (DIAGNOSIS ONLY)

| Field | Value |
|-------|--------|
| **Audit date** | 2026-09-17 |
| **Phase type** | **READINESS / DIAGNOSIS ONLY** — no production code, API, DB, migration, permission, UI, or behavior changes |
| **Authoritative product rules** | `counsellor-ownership-work-allocation-phase3h-product-decisions.md` — **History + Audit** / **PD7-AUDIT** |
| **Prior planning** | `counsellor-ownership-work-allocation-phase3i-implementation-readiness-audit.md` §7 / Slice 5 |
| **Upstream slices (assumed UAT-complete per program)** | Slices 1–4; Assign; lifecycle claim; Waiting List UX; procedure hydration |
| **This task** | Determine whether Slice 5 can be implemented safely by **reusing** existing History + Audit |
| **Production files changed by this audit** | **NO** |

**Legend**

| Label | Meaning |
|-------|---------|
| **CURRENT** | What code does today |
| **TARGET** | Phase 3H working decisions |
| **GAP** | Target ≠ current |
| **PRODUCT DECISION** | Needs explicit product rule before/during Slice 5 |
| **OUT OF SCOPE** | Slice 6 / 7 / 8 or other work — do not implement in Slice 5 |

---

## 1. Executive verdict

**CONDITIONAL READY** to implement Slice 5 using **existing** dual infrastructure:

1. **Operational History:** `counseling_session_audit_log` / `CounselingSessionAuditLog` + `GET /api/Counseling/sessions/{id}/history` + FE `SessionHistoryModal` / `loadCounsellingSessionHistory`
2. **Immutable Audit:** `IAuditService` / `audit_log` with `StageAsync` (same pattern as OPD billing / refunds)

Do **not** invent a new History table, Event Store, or parallel audit framework.

| Metric | Status |
|--------|--------|
| Authoritative dual-trail framework exists? | **YES** |
| Ownership mutations currently write dedicated History? | **NO** |
| Ownership mutations currently StageAsync platform Audit? | **NO** (`CounselingWorkflowService` does not inject `IAuditService`) |
| Assign / Claim mutation surfaces stable? | **YES** (server-authoritative) |
| UpdateSession free CounselorId write? | **CLOSED (Slice 4)** — rejects with 400 |
| Requeue clears ownership + audits? | **NO** — **Slice 8** (prepare hooks only in Slice 5) |
| Reassign exists? | **NO** — **Slice 6** (prepare event naming only) |
| Product decisions still open for Slice 5? | **YES — 5** (see §10) |
| New IAM permission required for Slice 5? | **NO** (reuse `counseling_sessions.read` / `.update`; platform `audit.view` remains admin trail) |
| DB migration required for minimum Slice 5? | **NO** if Branch/Actor/Owner encoded in existing columns + JSON payloads |
| Slice 5 start blocker? | Resolve §10 product decisions **or** implement against locked defaults in §11 |

**STOP rules for implementers:** Do not start Slice 6. Do not clear Requeue ownership. Do not add Version. Do not change Assign/Claim semantics. Do not reopen UpdateSession ownership writes.

---

## 2. What the system must answer after Slice 5

Per Phase 3H History + Audit / program objective:

| Question | Answered by Operational History? | Answered by Immutable Audit? |
|----------|----------------------------------|------------------------------|
| Who owned this session (timeline)? | **Yes** — successive Old/New owner fields | Structured old/new + details |
| When did ownership change? | `ChangedAt` | `Timestamp` / `CreatedAt` |
| Who performed the action (Actor)? | `ChangedByUserId` (+ name join) | `UserId` (+ IP/UA/session) |
| Previous owner? | `OldValue` (structured) | `OldValues` |
| New owner? | `NewValue` | `NewValues` |
| Branch / tenant context? | Tenant on row; **Branch via session join or payload** (no BranchId column today) | Tenant on row; Branch in `Description`/details JSON |
| What operation caused it? | `ChangeType` (+ Reason / intent) | `Action` + `ResourceType` |

Illustrative timeline (target, not current):

```text
Session created (unassigned | counsellor-owned) 
  → Assigned (NULL → Counsellor A) by Actor
  → Lifecycle claim (A → B, ReEvaluate|StartRepeat) by B
  → Reassigned (B → C) by Supervisor          [Slice 6]
  → Requeued (C → NULL) by Actor              [Slice 8]
```

**Actor ≠ Owner** must remain explicit in both trails (e.g. Admin assigns Ravi: Actor=Admin, NewOwner=Ravi).

---

## 3. Authoritative ownership model (approved — do not redesign)

| # | Rule | Slice 5 implication |
|---|------|---------------------|
| 1–5 | Shared WL; open/start ≠ ownership; explicit ownership; NULL valid | Audit only **actual** ownership writes |
| 6–8 | Counsellor create → self; Admin create → NULL; client CounselorId ignored | Create may be an ownership *establishment* event — see **PD-S5-01** |
| 9–10 | Assign = NULL → target only; no overwrite | Audit Assign successes only |
| 11–14 | Lifecycle claim for ReEvaluate/StartRepeat; may take from peer; ≠ Reassign | Claim **must** be audited in Slice 5 (live mutation path) |
| 15 | General Reassign = Slice 6 | Prepare ChangeType only; do not build API |
| 16–18 | Server-authoritative ownership; tenant/branch server auth | History/Audit must use server-derived Actor/Tenant/Branch — never client-asserted owner |

---

## 4. Ownership mutation inventory (CURRENT)

### 4.A Create Session / Add Patient

| Item | Evidence |
|------|----------|
| Path | `POST /api/Counseling/sessions` → `CreateSessionAsync` |
| File | `CounselingWorkflowService.cs` ~757–851; controller ~272 |
| CounselorId write? | **YES** (server-derived only) |
| Logic | `ownerCounselorId = null`; if actor passes `IsAssignableCounsellorAsync` → `ownerCounselorId = currentUserId`. **`request.CounselorId` ignored** |
| Actor identity | JWT → `GetCurrentUserId()` → `currentUserId`; also stored as `CreatedByUserId` (creator ≠ ownership SoT) |
| Admin / non-counsellor | Remains **NULL** (PD-ADM-01) |
| Counsellor | Self-owned at create |
| History today? | **NO** ownership row |
| Platform Audit today? | **NO** |
| Permission | `counseling_sessions.create` |

### 4.B Explicit Assign

| Item | Evidence |
|------|----------|
| Endpoint | `POST /api/Counseling/sessions/{id}/assign` |
| Controller | `CounselingController.AssignSession` ~321–357 |
| Service | `AssignSessionAsync` ~1080–1343 |
| Permission | `counseling_sessions.update` |
| Request | `{ counselorId }` only — **no Reason field** |
| Guards | Tenant session; CounselorId must be NULL else **409**; queue must include `Waiting`; actor branch via `FollowupBranchAccessService`; target counsellor + same-branch; target tenant match |
| Atomicity | Relational: `ExecuteUpdateAsync` assign-if-null; InMemory: tracked assign-if-null |
| Concurrency | Second writer → **409** already assigned |
| Already owned | **Conflict** — no overwrite |
| Response | Success + SessionId + CounselorId + CounselorName |
| FE | `counsellorsDeskApi.assignSession` → Waiting List Assign dialog |
| History today? | **NO** |
| Platform Audit today? | **NO** (only `LogInformation`) |

### 4.C Lifecycle claim

| Item | Evidence |
|------|----------|
| Endpoint | `POST /api/Counseling/sessions/{id}/claim-for-lifecycle` |
| Controller | ~363+ |
| Service | `ClaimSessionForLifecycleAsync` ~1349–1692 |
| Request | `{ expectedCounselorId?, intent: ReEvaluate\|StartRepeat }` |
| Permission | `counseling_sessions.update` |
| Actor | Counsellor only (Admin blocked — Slice 6 reassign) |
| NULL → actor | Allowed when `expectedCounselorId` null |
| Other → actor | Allowed when `expectedCounselorId` matches current |
| Self already owner | Success **no-op** (no CounselorId write) |
| Branch/tenant | Actor tenant + branch access |
| Conflicts | Ownership changed → **409** |
| Eligibility | Queue `Completed`; not SurgeryDone; intent vs agreed/repeat |
| Mutation | `ExecuteUpdateAsync` conditional on null or expected owner |
| History today? | **NO** |
| Platform Audit today? | **NO** |

### 4.D UpdateSession

| Item | Evidence |
|------|----------|
| Path | `PUT .../sessions/{id}` → `UpdateSessionAsync` ~866+ |
| CounselorId write? | **NO** — if `request.CounselorId.HasValue` → **400** (Slice 4 S4-D2) |
| Owner ACL | `DenyUnlessSessionOwner` — non-owner / unassigned → **403** |
| History today? | `PatientTypeChanged`, client-supplied `FieldChanged` only — **not ownership** |
| Classification | **Slice 4 CLOSED** for ownership bypass. Residual: DTO may still *accept* CounselorId property then reject — intentional reject-not-ignore. **Not Slice 5 work.** Not Slice 6. Not open product debt for free write. |

### 4.E Requeue

| Item | Evidence |
|------|----------|
| Endpoint | `POST .../sessions/{id}/re-queue` ~1590–1668 |
| CounselorId change? | **NO** — retained |
| Queue | **New** `CounselorQueueItem` Status=`Waiting`, QueueType=`RepeatCounselling` |
| History / Audit ownership? | **NO** |
| Relation | **PD-REQUEUE-01** + **Slice 8** clear to NULL + dual trail. Slice 5 may add a **shared writer helper** only — **must not** change Requeue behavior. |

### 4.F Start / other counselling mutates

| Path | CounselorId write? | Notes |
|------|--------------------|-------|
| `StartSessionAsync` | **NO** (Slice 2) | Owner ACL from Slice 4 |
| `StartSessionFromQueue` | **NO** | Comment: do not stamp |
| Complete / Cancel / AddOn / Investigations / Advance-stage | **NO** | Content mutates only |
| Analytics / Follow-up projections | Read / filter only | CreatedBy fallback is **not** SoT owner |
| `SeedDataController` | Sets CounselorId | **Dev/seed only** — not production ownership workflow |
| CCMS callback `ApplyCcmsCallbackAsync` | Does not touch CounselorId | Package addons only |

### 4.G Repository-wide mutation surfaces (summary)

| Writes CounselorId in production counselling path? | Surfaces |
|----------------------------------------------------|----------|
| **YES** | CreateSessionAsync; AssignSessionAsync; ClaimSessionForLifecycleAsync |
| **NO (blocked)** | UpdateSessionAsync |
| **NO (unchanged)** | Requeue; Start; Complete; Follow-up; OT Finalize |
| **Non-prod** | SeedDataController |

No separate `SetCounselor` command, ownership outbox, or background job ownership writer found in AuthService counselling workflow.

---

## 5. Existing audit / history infrastructure

### 5.1 Operational History (session-facing) — AUTHORITATIVE for counsellor UX

| Aspect | Detail |
|--------|--------|
| Entity / table | `CounselingSessionAuditLog` → `counseling_session_audit_log` |
| Schema | `Id`, `TenantId`, `SessionId`, `ChangeType` (max 50), `OldValue`, `NewValue`, `Reason`, `ChangedByUserId`, `ChangedAt` |
| **Missing columns** | **No BranchId**, no ActorName denorm, no correlation id column, no immutability hash |
| Writers today | `UpdateSessionAsync` only (`PatientTypeChanged`, `FieldChanged`) |
| Read API | `GET /api/Counseling/sessions/{id}/history` — permission `counseling_sessions.read`; join user name; **`Take(50)`** |
| FE assets | `counsellorsDeskApi.getSessionHistory` + `loadCounsellingSessionHistory` (Azure + Auth merge) + `SessionHistoryModal` |
| FE wiring (CURRENT) | **ORPHANED** — no page/hook currently imports `SessionHistoryModal` or `loadCounsellingSessionHistory` (confirmed 2026-09-17). GET History API remains live. |
| Known ChangeTypes (Auth) | `PatientTypeChanged`, `FieldChanged` (+ comments mention StatusChanged/StageTransition historically) |
| FE ACTION_CONFIG | Azure + Auth types (StartCounselling, SaveCounselling, ReEvaluate, …) — **no ownership types** |
| Secondary Azure store | `counselling-service` `counselling_audit_log` — clinical/save history only; **not** AuthService ownership SoT |

**Reuse decision:** Encode ownership events as new `ChangeType` values + structured Old/New (JSON or GUID strings) + Actor in `ChangedByUserId`. Prefer **no migration** for minimum Slice 5.

### 5.2 Immutable platform Audit — AUTHORITATIVE for compliance / hash-chain trail

| Aspect | Detail |
|--------|--------|
| Entity / table | `AuditLog` → `audit_log` |
| Service | `IAuditService` / `AuditService` (`Program.cs` DI registered) |
| Atomic staging | `StageAsync` — queues row on shared `AppDbContext`; caller `SaveChangesAsync` commits with business change |
| Proven pattern | `OpdBillService.StageFinancialAuditAsync`, `RefundService` — refuse mutation if audit unavailable |
| Fields | UserId, Action, ResourceType, ResourceId, Description, OldValues, NewValues, TenantId, IP, UA, SessionId, EventHash, PreviousEventHash, SequenceNumber, RetentionDays (~7y), IsImmutable |
| **Missing** | **No BranchId column** — put branch in Description/details JSON |
| Read API | `AuditLogsController` — permission **`audit.view`** (admin/compliance UI, not counsellor session sheet) |
| Counselling wiring | **None** — `CounselingWorkflowService` constructor has **no** `IAuditService` |

**Reuse decision:** Inject `IAuditService`; on successful ownership mutation call `StageAsync` with ResourceType e.g. `CounselingSession`, Action e.g. `OwnershipAssigned` / `OwnershipClaimed`, details JSON including actor, previousOwner, newOwner, branchId, intent/source, correlation.

### 5.3 Other audit mechanisms (not authoritative for counselling ownership)

| Mechanism | Role vs Slice 5 |
|-----------|-----------------|
| Azure counselling history | Clinical/save/price events; merge in FE — keep; do not replace Auth ownership SoT |
| `OtFinalizeAuditLog` | OT-only — keep distinct (**PD-FS-01**) |
| Activation / Department access audits | IAM/access — unrelated |
| Billing outbox “Requeue” | Integration outbox — **not** counselling requeue |
| Application `LogInformation` on Assign/Claim | Ops logs only — **not** History/Audit SoT; avoid PHI |

### 5.4 Dual-trail authority map

| Concern | Authoritative store | Consumer |
|---------|---------------------|----------|
| Counsellor-visible session ownership timeline | `counseling_session_audit_log` | Session History UI / `.read` |
| Immutable accountability / tamper-evident | `audit_log` via `IAuditService` | `audit.view` / compliance |
| Clinical Azure history | Azure API | Merged modal (non-ownership) |

Phase 3H: **both** required for assignment / reassignment / requeue. Lifecycle claim is an ownership mutation introduced after Phase 3H text — treat as dual-trail mandatory under same principle (**confirm PD-S5-02**).

---

## 6. Critical technical gap: ExecuteUpdate vs StageAsync

**CURRENT:** Assign and Claim prefer `ExecuteUpdateAsync` for atomic conditional ownership writes. That path **does not** go through EF change-tracker `SaveChanges` for the session row.

**StageAsync pattern** assumes the caller later `SaveChangesAsync` on the same context (and preferably same DB transaction).

**Implication for Slice 5 (design constraint, not a reason to invent a new audit system):**

1. Wrap ownership mutation + History insert + `StageAsync` in an **explicit DB transaction**.
2. After successful `ExecuteUpdate` (affected > 0), `Add` `CounselingSessionAuditLog`, `StageAsync(...)`, then `SaveChangesAsync`, then commit.
3. If History/Audit save fails → **rollback** (ownership must not remain changed without trail — Phase 3H transactional consistency).
4. Conflict / zero-row ExecuteUpdate → **no** History/Audit success event.
5. Self-claim no-op → **no** ownership event.
6. InMemory test path (tracked update + SaveChanges) must also emit dual trail in the same transaction.

Reference: financial services refuse the money mutation if audit cannot be staged.

**Do not** drop assign-if-null atomicity to “make audit easier.” Preserve concurrency semantics from Slice 3/claim.

---

## 7. Authorization / security for Slice 5

| Control | Recommendation |
|---------|----------------|
| Writing History/Audit | Server-only inside Assign / Claim (/ Create if approved) — never client-submitted audit rows |
| Reading session History | Existing `counseling_sessions.read` — sufficient for counsellor operational continuity (PD-AUTH-01 read retained) |
| Reading platform `audit_log` | Existing `audit.view` — do **not** broaden to all counsellors in Slice 5 |
| New permissions | **None** for Slice 5 minimum |
| Branch / tenant | Derive from session + JWT; store in payload; do not trust client branch on write |
| Actor ≠ Owner | Persist both IDs explicitly; never collapse |
| PHI | Store user IDs / branch IDs / intent codes — avoid clinical free text in platform audit details |
| Rejected attempts | Optional security logging later; Phase 3H requires success trail for successful mutations — do not invent failed-assign audit product without decision |

---

## 8. Persistence model recommendation (minimum Slice 5)

**Reuse existing tables. No new History table. No migration required for MVP.**

### Operational History row (illustrative)

| Column | Usage |
|--------|--------|
| `ChangeType` | Dedicated ownership types (see §10 naming) — max length 50 |
| `OldValue` | Previous owner Guid string or `null` / JSON `{ "counselorId": null }` |
| `NewValue` | New owner Guid string or JSON |
| `Reason` | Human/system reason **or** intent (`ReEvaluate` / `StartRepeat`) / source (`Assign` / `Create`) — align with FieldChanged convention carefully (FieldChanged overloads Reason as field name) |
| `ChangedByUserId` | **Actor** |
| `TenantId` / `SessionId` / `ChangedAt` | As today |

Branch: include in JSON New/Old/details **or** resolve via session join at read time (session.BranchId). Phase 3H wants branch in structured fields — JSON in Old/New/Reason or Description is enough without schema change.

### Platform Audit row (illustrative)

| Field | Example |
|-------|---------|
| Action | `OwnershipAssigned` / `OwnershipClaimed` |
| ResourceType | `CounselingSession` |
| ResourceId | sessionId |
| OldValues / NewValues | previous/new counselor Guids |
| Description | JSON: `{ actorUserId, previousCounselorId, newCounselorId, branchId, source, intent?, correlationId }` |
| UserId | Actor |

---

## 9. Events that need recording

| Event | Mutates CounselorId? | Dual trail required by Phase 3H? | Slice ownership |
|-------|----------------------|----------------------------------|-----------------|
| Create — counsellor self-own | NULL→self (server) | **PRODUCT DECISION PD-S5-01** (assignment-like) | Slice 5 if Yes |
| Create — Admin NULL | No ownership set | No ownership event | — |
| Assign (NULL→target) | Yes | **YES** | **Slice 5** |
| Lifecycle claim (actual transfer) | Yes | **YES** (recommended; confirm PD-S5-02) | **Slice 5** |
| Lifecycle claim self no-op | No | No | — |
| Reassign | Yes | YES | **Slice 6** (prepare type name only) |
| Requeue → NULL | Yes (target) | YES | **Slice 8** (helper optional in S5) |
| Failed 409/403 | No | Not required as business success trail | Optional later |
| FieldChanged / PatientType | No ownership | Existing | Preserve |

---

## 10. Product decisions required before/during Slice 5

| ID | Question | Options | Suggested default (working only — needs confirm) |
|----|----------|---------|--------------------------------------------------|
| **PD-S5-01** | Does counsellor **Create** self-ownership require dual History+Audit? | A) Yes as `OwnershipEstablishedOnCreate` B) No — only Assign/Claim/Reassign/Requeue | **A** — Create is explicit ownership establishment under PD-ADM-01 / counsellor Add Patient |
| **PD-S5-02** | Is lifecycle claim dual-trail mandatory in Slice 5? | A) Yes B) Defer | **A** — live peer/NULL ownership transfer; not covered by Assign-only Slice 5 text but required for accountability |
| **PD-S5-03** | Exact `ChangeType` / Action names | e.g. `OwnershipAssigned`, `OwnershipClaimed`, `OwnershipEstablishedOnCreate`, (`OwnershipReassigned`, `OwnershipRequeued` reserved) | Lock names ≤50 chars; FE labels in SessionHistoryModal |
| **PD-S5-04** | Is **Reason** required on Assign / Claim? | A) Optional B) Required C) System-generated only (intent/source) | **C for Claim** (intent); **C/A for Assign** (no API reason today — do not expand Assign contract in Slice 5 unless product insists) |
| **PD-S5-05** | Slice 5 FE scope | A) BE dual trail only (API-verifiable) B) BE + **re-wire** History entry point + ownership labels in `SessionHistoryModal` | **B preferred** — modal/loader exist but are **unwired**; labels alone do not restore counsellor-visible History. No new History page. |

Also confirm (non-blocking if defaults accepted):

- **No historical backfill** of past Assign/Claim/Create ownership events.
- Platform audit remains `audit.view`; counsellor uses session History.
- `Take(50)` may bury ownership under FieldChanged noise — optional later increase/filter; not a Slice 5 blocker if ownership rows are written.

**Unresolved from earlier phases (not Slice 5 blockers):** PD-SUP-01 reassignment permission (**Slice 6**); who may requeue (**Slice 8**); Version column (**Slice 7**).

---

## 11. Minimum bounded Slice 5 implementation (when approved)

### In scope

1. Inject `IAuditService` into `CounselingWorkflowService`.
2. Shared private helper e.g. `StageOwnershipTrailAsync(...)` writing:
   - one `CounselingSessionAuditLog` row
   - one `IAuditService.StageAsync` row
3. Call helper **inside a transaction** on successful:
   - `AssignSessionAsync` (affected ownership write)
   - `ClaimSessionForLifecycleAsync` (actual ownership write only)
   - `CreateSessionAsync` **if PD-S5-01 = Yes** when `ownerCounselorId` set
4. Payload always includes Actor, previousOwner, newOwner, tenant, branchId (from session), source/action, claim intent when applicable.
5. FE (if PD-S5-05 = B): **re-wire** an existing counselling session surface to open History via `loadCounsellingSessionHistory` + `SessionHistoryModal`; add ACTION_CONFIG labels for ownership ChangeTypes; do not invent a second History UI. Ensure merge path keeps non-FieldChanged Auth rows (already does).
6. Automated tests: dual trail present; Actor ≠ Owner when peer/admin assign; conflict path writes **zero** ownership events; self-claim no-op writes **zero**; transactional failure rolls back (as feasible in test host).

### Explicitly out of scope

| Item | Owner |
|------|-------|
| Reassign API / supervisory permission | Slice 6 |
| Requeue → CounselorId NULL | Slice 8 |
| CounselingSession.Version / 409 upgrade beyond existing | Slice 7 |
| New IAM permissions | Not needed |
| New DB tables / Event Store | Forbidden |
| Changing Assign/Claim eligibility or ownership semantics | Forbidden |
| Re-opening UpdateSession CounselorId writes | Forbidden (Slice 4) |
| Backfill legacy ownership | Forbidden without separate gate |
| Admin content-mutate bypass | Forbidden |

### Suggested locked ChangeTypes (pending PD-S5-03)

| ChangeType | When |
|------------|------|
| `OwnershipAssigned` | Assign NULL→target |
| `OwnershipClaimed` | Lifecycle claim transfer |
| `OwnershipEstablishedOnCreate` | Counsellor create self-own (if PD-S5-01) |
| `OwnershipReassigned` | Reserved — Slice 6 |
| `OwnershipRequeued` | Reserved — Slice 8 |

---

## 12. UpdateSession / Slice 4 classification

| Question | Answer |
|----------|--------|
| Still accepts CounselorId on wire? | Property may be present on request DTO |
| Server write? | **Rejected 400** |
| FE ownership authority? | No |
| Audit/security gap for ownership bypass? | **Closed by Slice 4** |
| Slice 5 work? | **None** beyond not regressing the reject |
| Classification | **Slice 4 completed dependency** — not Slice 5, not Slice 6, not open free-write debt |

---

## 13. Gap matrix (Slice 5 focused)

| # | Gap | Severity | Slice |
|---|-----|----------|-------|
| G-S5-01 | Assign success writes neither History nor Audit | **P0** | 5 |
| G-S5-02 | Claim success writes neither History nor Audit | **P0** | 5 |
| G-S5-03 | Create counsellor-own has no ownership trail | **P1** | 5 if PD-S5-01 |
| G-S5-04 | `CounselingWorkflowService` lacks `IAuditService` | **P0** | 5 |
| G-S5-05 | ExecuteUpdate path needs explicit txn dual-write strategy | **P0** | 5 design |
| G-S5-06 | No ownership ChangeTypes / FE labels | **P1** | 5 |
| G-S5-06b | Session History modal/loader **unwired** from any live page | **P1** | 5 (if PD-S5-05 = B) |
| G-S5-07 | History `Take(50)` may hide events under FieldChanged volume | **P2** | optional |
| G-S5-08 | No BranchId on history/audit tables | **P2** | encode in payload; migration not required |
| G-S5-09 | Requeue retains owner + no trail | **P0** for program | **8** |
| G-S5-10 | Reassign missing | **P0** for program | **6** |

---

## 14. Readiness checklist

| Checkpoint | Status |
|------------|--------|
| Dual infrastructure identified and reusable | **PASS** |
| Mutation surfaces fully inventoried | **PASS** |
| Assign/Claim stable enough to attach trails | **PASS** |
| UpdateSession ownership bypass closed | **PASS** (Slice 4) |
| No need for new audit framework | **PASS** |
| Product decisions for Create/Claim/naming/reason/FE | **OPEN** (§10) |
| Transactional strategy for ExecuteUpdate + StageAsync documented | **PASS** (constraint stated) |
| FE History display | **PARTIAL** — modal/loader exist but **unwired**; resolve via PD-S5-05 |
| Permissions for Slice 5 | **PASS** (reuse) |
| Migration required for MVP | **NO** |
| Safe to implement without Slice 6/8 behavior changes | **YES** |

---

## 15. Final recommendation

**Proceed to Slice 5 implementation only after confirming §10 (or accepting suggested defaults in writing).**

Slice 5 is a **wiring + contract + UI label** slice on existing tables — not a greenfield audit platform.

Recommended sequence once approved:

1. Lock PD-S5-01…05  
2. Implement dual-trail helper + Assign + Claim (+ Create if Yes)  
3. FE History: labels + **re-wire** entry point if PD-S5-05 = B  
4. Contract/integration tests  
5. Manual UAT: Assign peer (Actor≠Owner), Assign self, Claim from peer, Claim NULL, Create counsellor, conflict 409 leaves no trail; History visible if FE wired  
6. **STOP** — do not start Slice 6 until Slice 5 UAT passes  

---

## 16. Evidence index (primary files)

| Area | Path |
|------|------|
| Create / Update / Assign / Claim | `microservices/auth-service/AuthService/Services/CounselingWorkflowService.cs` |
| HTTP Assign / Claim / History / Requeue | `microservices/auth-service/AuthService/Controllers/CounselingController.cs` |
| History entity | `Models/Domain/CounselingWorkflow.cs` (`CounselingSessionAuditLog`) |
| Platform audit | `Models/Domain/AuditLog.cs`, `Services/AuditService.cs` |
| Audit admin API | `Controllers/AuditLogsController.cs` |
| Financial StageAsync precedent | `Services/OpdBillService.cs`, `Services/RefundService.cs` |
| FE Assign / Claim / History | `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts`, `SessionHistoryModal.tsx`, `load-counselling-session-history.ts` |
| Product dual-trail rule | `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` § History + Audit / PD7-AUDIT |
| Slice 4 lock | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice4.md` |

---

**Document status:** READY FOR PRODUCT CONFIRMATION → then implementation planning / coding in a separate task.  
**This audit made zero production code changes.**
