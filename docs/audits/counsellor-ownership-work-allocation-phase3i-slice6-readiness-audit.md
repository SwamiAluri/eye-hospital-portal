# Phase 3I — Slice 6 General Reassign
## Readiness Audit (DIAGNOSIS ONLY) + Product Decision Closure

| Field | Value |
|-------|--------|
| **Audit date** | 2026-09-17 |
| **PD closure date** | 2026-09-17 |
| **Phase type** | **READINESS / DIAGNOSIS + PD CLOSURE ONLY** — no production code, API, DB, migration, permission seed, UI, or behavior changes |
| **Authoritative product rules** | `counsellor-ownership-work-allocation-phase3h-product-decisions.md` — **PD-REASSIGN-01**, **PD-ASSIGN-01**, **PD-SUP-01**, **PD-AUTH-01**, History + Audit, **PD-CONC-01** |
| **Prior planning** | `counsellor-ownership-work-allocation-phase3i-implementation-readiness-audit.md` § Slice 6 / D1 |
| **Upstream slices (certified)** | Slices 1–5 (Assign, lifecycle claim, owner ACL, History/Audit dual trail); Slice 5 Manual UAT COMPLETE per program |
| **This document** | (1) Original audit evidence — **preserved** as CURRENT findings below; (2) **Product Decision Closure — Approved** for PD-S6-01…17; (3) Updated readiness verdict |
| **Production files changed by this document** | **NO** — only this document |

**Legend**

| Label | Meaning |
|-------|---------|
| **CURRENT** | What code does today (historical audit evidence — unchanged by PD closure) |
| **WORKING (3H)** | Phase 3H working decision (agreed for implementation workflow / not formally signed) |
| **APPROVED PRODUCT DECISION** | Explicitly approved PD-S6-* rule (not yet implemented) |
| **FUTURE IMPLEMENTATION** | Slice 6 coding work — not started |
| **GAP** | Target ≠ current |
| **PRODUCT DECISION REQUIRED** | Was open at original audit; see closure section for APPROVED status |
| **OUT OF SCOPE / SLICE 7 DEPENDENCY** | Slice 7+ or other work — do not implement in Slice 6 |

---

## 1. Executive Summary

**CURRENT:** General Reassign does not exist in production (backend or frontend). Ownership of an already-owned session can change today **only** via lifecycle `claim-for-lifecycle` (peer/NULL → claiming counsellor; Done/Repeat intents). Explicit Assign remains **NULL → target** only (409 if owned). Slice 5 reserved History/Audit name `OwnershipReassigned` but does **not** emit it.

| Metric | Status |
|--------|--------|
| Production Reassign API / UI? | **NO** (CURRENT) |
| Live old→new ownership path today? | **YES** — Claim-for-lifecycle only (not General Reassign) |
| Slice 5 dual trail reusable? | **YES** (`StageOwnershipTrailAsync`) |
| Reserved ChangeType for Reassign? | **YES** — `OwnershipReassigned` (not emitted) |
| PD-S6-01…17 product rules? | **APPROVED** — see § Product Decision Closure |
| Exact supervisory permission (D1 / PD-SUP-01)? | **RESOLVED** — `counseling_sessions.reassign` (ADMIN seed; Counsellor excluded) |
| `counseling_sessions.assign` / reassign permission? | **`.reassign` exists** (IAM only; no endpoint yet) |
| Version / optimistic concurrency? | **NO** — Slice 7 (approved interim: expected-previous-owner) |
| Lifecycle status matrix for Reassign? | **APPROVED** — see closed matrix |
| Safe to implement Slice 6 feature after D1? | **YES** — see Updated Readiness Verdict / D1 Resolved |

**STOP rules:** Do not implement Slice 6 in this documentation task. Do not extend Assign to overwrite owned sessions. Do not replace lifecycle claim with Reassign. Do not clear Requeue ownership (Slice 8). Do not add Version (Slice 7). Do not modify certified Slice 1–5 behavior. Do not invent a permission code here.

**Updated readiness:** Product decisions PD-S6-01…17 are **closed**. D1 IAM mapping is **resolved** (`counseling_sessions.reassign`). General Reassign endpoint/UI remain **FUTURE IMPLEMENTATION**.

---

## 2. Current Ownership Model

Certified Phase 3I hybrid model (Slices 1–5) relevant to Reassign:

| # | Rule | Slice 6 implication |
|---|------|---------------------|
| 1 | Waiting List remains **shared** within server-authorized branch scope (Slice 1) | Reassign must **not** create “My Waiting List”; Owner filter stays client convenience |
| 2 | Open/view ≠ ownership | Reassign is explicit; viewing does not transfer |
| 3 | Start Counseling ≠ ownership | Reassign must **not** silently Start |
| 4 | Create: counsellor → self; Admin/non-counsellor → NULL; client `CounselorId` ignored | Create is not Reassign |
| 5 | Explicit Assign: **NULL → target**; already owned → **409** | Do not collapse into Reassign without product approval |
| 6 | Lifecycle claim: Done/Repeat intents; counsellor-only; Admin forbidden; self no-op no trail | **Not** General Reassign; must remain |
| 7 | Slice 4: content mutate = current `CounselorId`; Update rejects `CounselorId` write (400); **no Admin content bypass** | After Reassign: old owner loses mutate; new owner gains (PD-AUTH-01 / PD-REASSIGN-01) |
| 8 | Slice 5 dual trail: History + `IAuditService.StageAsync` for Create/Assign/Claim | Reassign must reuse same trail; reserved `OwnershipReassigned` |
| 9 | Pending + assigned = content read-only until Start | Whether Pending may be reassigned = **PD-S6-05** |

**Phase 3H working intent (not yet coded):**

| ID | Summary |
|----|---------|
| **PD-REASSIGN-01** | Supervisor/Admin reassigns **active** counselling session A → B; immediate ACL flip; reason + History/Audit; same-branch target unless multi-branch rule |
| **PD-ASSIGN-01** | Initial assign unassigned only; distinct from reassignment |
| **PD-SUP-01** | Permission-based supervisory auth; **no** new hard-coded Supervisor role; exact code = Phase 3I dependency **D1** |
| **PD-AUTH-01** | Owner-level mutate = current owner; supervisory exceptions explicit |
| History + Audit | Assignment / **reassignment** / requeue require dual trail; Actor ≠ Owner |

Sign-off status of Phase 3H decisions: **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED**.

---

## 3. CounselorId Mutation Inventory

Domain: `CounselingSession.CounselorId` → `counselor_id` (`CounselingWorkflow.cs`).

### 3.A Complete writer matrix

| Writer | Endpoint/Job | Current behavior | Actor | Authorization | Transaction | History | Audit | Scope |
|--------|--------------|------------------|-------|---------------|-------------|---------|-------|-------|
| **CreateSessionAsync** | `POST /api/Counseling/sessions` | Client `CounselorId` ignored; assignable counsellor → self; else NULL | Create caller | `counseling_sessions.create` + branch/patient checks | Create txn | `OwnershipEstablishedOnCreate` if owned | `StageAsync` | Insert only (NULL→self when counsellor) |
| **AssignSessionAsync** | `POST .../sessions/{id}/assign` | Atomic **assign-if-null**; queue must include `Waiting`; already owned → **409** | Any actor with update + branch access | `counseling_sessions.update` + branch (actor + target) + `IsAssignableCounsellorAsync` | `BeginTransaction` + `ExecuteUpdateAsync` WHERE null | `OwnershipAssigned` | Dual trail | **NULL → target only** |
| **ClaimSessionForLifecycleAsync** | `POST .../claim-for-lifecycle` | Intents `ReEvaluate` \| `StartRepeat`; queue `Completed`; not SurgeryDone; NULL→actor or other→actor via `expectedCounselorId`; self = success **no-op** (no trail) | **Counsellor only** (Admin forbidden) | `counseling_sessions.update` + counsellor heuristic + branch | Same txn + conditional `ExecuteUpdate` | `OwnershipClaimed` on real transfer | Dual trail | **Only live old→new path** (to **actor**, not arbitrary third party) |
| **UpdateSessionAsync** | `PUT .../sessions/{id}` | `request.CounselorId` → **400**; ownership unchanged | N/A | update + owner ACL for content | N/A for ownership | None | None | **Blocked writer** |
| **StartSessionAsync** / queue start | `POST .../start` | Must **not** change `CounselorId` | Owner | update + owner ACL | Status only | No | No | **Non-writer** |
| **ReQueueSession** | `POST .../re-queue` | Intention/notes + new Waiting queue row; **retains** `CounselorId` | update caller | `counseling_sessions.update` | SaveChanges (no ownership txn) | No `OwnershipRequeued` | No | **Non-writer** (Slice 8 clears) |
| **SeedDataController** / seed SQL | Dev/seed endpoints & SQL INSERTs | Insert with/without `counselor_id` | Seed/ops | Seed auth / manual | SaveChanges / SQL | No | No | Seed inserts only |
| **SQL UPDATE scripts** | Migrations/seeds | Escalation / soft-delete / follow-up seed — **no `SET counselor_id`** found | — | — | — | — | — | **No ownership UPDATE** |
| **Background jobs / other microservices** | Reminders, CCMS outbox, etc. | No counselling ownership writes found | — | — | — | — | — | **None** |
| **General Reassign** | — | **Does not exist** | — | — | — | Reserved name only | — | **GAP / Slice 6** |

Evidence (primary): `CounselingWorkflowService.cs` Create ~829–951; Assign ~1181–1470; Claim ~1476–1847; `DenyUnlessSessionOwner` ~3290–3316; `OwnershipAuditEvents` ~20–27; `StageOwnershipTrailAsync` ~64–118; controller `CounselingController.cs` Assign/Claim permissions.

### 3.B Paths capable of old CounselorId → new CounselorId

| Path | Transition | Arbitrary target? | Notes |
|------|------------|-------------------|-------|
| **ClaimSessionForLifecycleAsync** | Previous owner → **actor** | **No** — always claiming counsellor | Done/Repeat only; Admin blocked |
| Assign | — | — | Rejects if owned |
| Create / Update / Start / Requeue | — | — | Non-transfer or blocked |
| **General Reassign** | A → B (actor may ≠ B) | **Intended by PD-REASSIGN-01** | **Not implemented** |

---

## 4. Existing Reassign Capability

| Surface | Exists? | Evidence |
|---------|---------|----------|
| Backend route `/reassign` / `ReassignSession` | **NO** | Controller comments: Assign does not reassign; Claim “Not general Reassign” |
| FE `reassignSession` API | **NO** | `counsellors-desk.api.ts` — assign + claim only |
| FE Reassign dialog / CTA | **NO** | Waiting List uses `WaitingListAssignDialog` + lifecycle claim |
| History emission `OwnershipReassigned` | **NO** | Reserved comment only; `SessionHistoryModal` labels Assign/Claim/Create only |
| Permission `counseling_sessions.assign` / reassign | **NO** | Catalog: read/create/update/delete/view |
| Unrelated “reassign/transfer” elsewhere | IP slot assign; frontdesk queue transfer | **Different domains** — not counselling ownership |

**Verdict:** No General Reassign implementation exists. Do not create one in this audit. Closest production transfer is **lifecycle claim** (approved exception path, not Slice 6).

---

## 5. Authorization / ACL Analysis

### 5.A Permission catalog (CURRENT)

| Code | Exists | Used for ownership? |
|------|--------|---------------------|
| `counseling_sessions.read` / `.view` | Yes | Read, counselors list, history |
| `counseling_sessions.create` | Yes | Create |
| `counseling_sessions.update` | Yes | Assign, Claim, content mutate, re-queue |
| `counseling_sessions.delete` | Yes | Delete |
| `counseling_sessions.assign` | **No** | — |
| Dedicated reassign / supervisory code | **No** | **D1 open** |

Catalog: `CounselingSessionsPermissionCatalog.cs` (Scope metadata `branch`). Counsellor least-privilege retains read/create/update/delete/view — **no assign/reassign code**.

### 5.B Slice 4 owner mutation ACL (CURRENT)

`DenyUnlessSessionOwner`: unassigned or `CounselorId ≠ actor` → **Forbidden**. **No Admin content bypass** (S4-D5). Admin may Assign (NULL→target) and read; supervisory **content** mutate / Reassign deferred to Slice 6.

**Reuse for General Reassign?**

| Reusable | Not reusable |
|----------|--------------|
| Assign target validation (tenant, branch, `IsAssignableCounsellorAsync`) | `DenyUnlessSessionOwner` as Reassign **authz** (it blocks non-owners) |
| Slice 5 `StageOwnershipTrailAsync` | Assign endpoint (409 if owned) |
| Branch access via `FollowupBranchAccessService` | Claim-for-lifecycle (counsellor-only, Done/Repeat, target=actor) |

### 5.C Who could perform Reassign — evidence only

| Candidate | CURRENT evidence | WORKING (3H) |
|-----------|------------------|---------------|
| Current owner | Can mutate **content** if owner; **cannot** change `CounselorId` via Update | Handoff modelled as Supervisor/Admin unless later owner self-handoff decision |
| Any counsellor with `.update` | Can **Assign** NULL; can **Claim** Done/Repeat to self; **cannot** general A→B | Not General Reassign authority |
| Admin | Can Assign NULL→target; **cannot** Claim; **cannot** content-mutate non-owned | PD-REASSIGN-01: Supervisor/Admin |
| Supervisor role (hard-coded) | **Not used** in counselling ownership | PD-SUP-01: permission-based; no new role |
| Branch manager | No counselling-specific reassign capability found | Map via permissions if granted |

**PRODUCT DECISION REQUIRED — PD-S6-01:** Exact actors + exact permission code(s). Do **not** invent. Do **not** silently reuse `.update` alone (implementation readiness risk: over-privileges every counsellor updater — D1).

FE helpers today (`counselling-auth.ts`): `canShowCounsellingInitialAssign`, `canShowCounsellingAssignToMe` — **no** `canShowReassign`.

---

## 6. Target Counsellor Eligibility

### CURRENT “eligible counsellor”

| Layer | Behavior |
|-------|----------|
| `GET /api/Counseling/counselors?branchId=` | Tenant; soft-delete excluded; role name contains `COUNSEL` **or** UserType/Designation contains `counsel`; optional branch via `UserBranches` active **or** `Users.BranchId` |
| Assign target validation | Same `IsAssignableCounsellorAsync` + same tenant + branch access for **session** branch |
| Not filtered | Capability `counseling_sessions.update` on target; login “active” beyond `DeletedAt`; Admin-as-target heuristics beyond counsellor check |
| FE `WaitingListAssignDialog` | Loads counselors for **session branch**; optional exclude self when Assign-to-me shown |

**PRODUCT DECISION REQUIRED — PD-S6-02 / PD-S6-14:** Whether Reassign reuses **exact** Assign eligibility, or adds extras (must hold `.update`, exclude current owner from picker, exclude inactive, exclude Admin-stamped legacy owners as targets, etc.).

---

## 7. Lifecycle Eligibility Matrix

**CURRENT:** No Reassign API → no coded eligibility. Assign = Waiting + NULL. Claim = Completed + ReEvaluate/StartRepeat. Content mutate = after Start (`AllowsCounselingContentMutation`).

| Session / queue state | Current owner | Reassign allowed today? | Evidence | Decision |
|-----------------------|---------------|-------------------------|----------|----------|
| Pending / Waiting + NULL | Unassigned | N/A — use **Assign** | Assign Waiting+NULL | Keep Assign (**PD-S6-03**) |
| Pending / Waiting + owned | Counsellor A | **No API** | Assign 409 if owned | **PD-S6-05** |
| Processing / InProgress | A | **No API** | Owner ACL only | **PD-S6-06** (critical) |
| Completed / Done (not claiming) | A | Claim path for ReEvaluate only | Claim ≠ Reassign | **PD-S6-07** |
| Repeat Counselling eligible | A / NULL | Claim StartRepeat | Claim ≠ Reassign | **PD-S6-08** |
| SurgeryDone / sealed | A | Claim blocked SurgeryDone | Claim guards | **PD-S6-09**; likely Slice 9/10 boundary |
| Cancelled / deleted | — | No ownership transfer API | Soft-delete / status | Confirm out of Slice 6 |

**WORKING (3H) PD-REASSIGN-01** says “active counselling session” — does **not** enumerate Pending vs InProgress vs Completed. Status matrix remains **PRODUCT DECISION REQUIRED**.

**Invariant (program):** Reassign must **not** silently Start counselling.

---

## 8. Assign vs Lifecycle Claim vs Reassign

| Dimension | Explicit Assign (Slice 3) | Lifecycle Claim | General Reassign (Slice 6) |
|-----------|---------------------------|-----------------|----------------------------|
| Transition | NULL → target | NULL→actor **or** other→actor | **A → B** (WORKING: supervisory) |
| Actor vs owner | Actor may ≠ owner | Owner becomes **actor** | Actor typically ≠ new owner |
| Admin | Allowed (with update + branch) | **Forbidden** | WORKING: Supervisor/Admin |
| Eligibility | Waiting + NULL | Completed + intent; not SurgeryDone | **PD required** |
| Concurrency | Assign-if-null | `expectedCounselorId` | Claim-style expected previous **and/or** Slice 7 Version |
| History | `OwnershipAssigned` | `OwnershipClaimed` | Reserved `OwnershipReassigned` |
| Reason in API | None (`{ counselorId }`) | Intent as Reason | WORKING: **reason required** (PD-REASSIGN-01) |
| Collapse into one endpoint? | Technically possible (if owned → reassign else assign) | Must stay separate from Assign | **PRODUCT DECISION** — Phase 3H treats Assign ≠ Reassign; do not consolidate without approval |

**Recommendation (conceptual, not implementation):** Keep operations **explicitly distinct** based on existing semantics (NULL→B = Assign; A→B supervisory = Reassign; Done/Repeat claim = Claim).

---

## 9. History / Audit Design Readiness

### CURRENT dual trail (Slice 5)

```text
BeginTransaction
  → ownership mutation (ExecuteUpdate / tracked)
  → StageOwnershipTrailAsync (CounselingSessionAuditLog + IAuditService.StageAsync)
  → SaveChangesAsync
  → Commit
catch → Rollback
```

Fail-closed if `_audit` is null. Conflict / zero-row paths rollback and **skip trail**.

| Event | Emitted today | Role |
|-------|---------------|------|
| `OwnershipEstablishedOnCreate` | Yes | Create self-own |
| `OwnershipAssigned` | Yes | Assign |
| `OwnershipClaimed` | Yes | Claim transfer (not self no-op) |
| `OwnershipReassigned` | **Reserved** | Slice 6 |
| `OwnershipRequeued` | Reserved | Slice 8 |

Fields staged today: SessionId, TenantId, Actor, previous/new counselor GUID strings, `Reason` (= intent or source), branchId + source + intent + `correlationId` (= sessionId today) in audit details JSON. No dedicated Reason column beyond `Reason` / details.

### Conceptual Reassign fit (NOT IMPLEMENTED)

| Aspect | Constraint |
|--------|------------|
| ChangeType / Action | Prefer reserved **`OwnershipReassigned`** (**PD-S6-12 / PD-S6-13** confirm) — fits `ChangeType` max 50 |
| Trail helper | Reuse `StageOwnershipTrailAsync`; extend Reason/source for free-text reason if approved |
| FE | Add `SessionHistoryModal` label + `OWNERSHIP_CHANGE_TYPES` |
| Actor ≠ Owner | Preserve (Supervisor actor, Counsellor B new owner) |
| New tables | **Forbidden** — do not create |

---

## 10. Transaction / Failure Safety

| Concern | CURRENT pattern to reuse |
|---------|--------------------------|
| Abstraction | Explicit `BeginTransactionAsync` around mutation + trail + `SaveChanges` |
| Mutation | Prefer relational `ExecuteUpdateAsync` with WHERE expected previous owner (claim-style) |
| Staging | `StageOwnershipTrailAsync` then SaveChanges (Audit `StageAsync` stages until Save) |
| Failure | Exception → Rollback; StageAsync fail before Save → ownership not committed |
| InMemory tests | Transactions ignored (`TransactionIgnoredWarning`); validate by ensuring failed StageAsync prevents persisted ownership |
| Production | Real DB transaction required for ExecuteUpdate + History + Audit consistency |

**Implementation constraint:** Reassign success path must be transactionally consistent with dual trail (same invariant as Slice 5). Conflict paths must not emit History/Audit.

---

## 11. Concurrency Dependency

| Protection today | Assign | Claim | Reassign |
|------------------|--------|-------|----------|
| Atomic WHERE | `CounselorId == null` | null **or** `== expected` | **N/A** |
| Version column on session | **No** | **No** | **No** |
| Stale UI after transfer | Content LWW risk | Claim 409 if expected mismatch | **GAP** |

**Scenarios Slice 6 must document (not solve fully):**

1. Supervisor A reads owner=B; Supervisor C reassigns B→D; A reassigns B→E → without expected-previous or Version, second writer may overwrite or need 409 redesign.  
2. Owner B has session open; Supervisor reassigns B→C; B Save Draft → Slice 4 ACL may 403 on next mutate **if** server reloads owner; without Version, B may still write stale content if load cached (**Slice 7** / **PD-S6-15**).  
3. Concurrent Claim vs future Reassign on Done/Repeat — eligibility overlap **PD** + Slice 7.

**Slice 6 dependency on Slice 7 (PD-S6-16):**

| Stance | Meaning |
|--------|---------|
| Interim | Claim-style `expectedPreviousOwnerId` + conditional ExecuteUpdate without Version migration |
| Full PD-CONC-01 | Session `Version` + 409 stale + FE refresh — **Slice 7 owns** |

Do **not** implement Version in Slice 6. Document chosen interim vs hard-block in product approval.

---

## 12. Downstream Dependencies

| Consumer | Reads CounselorId? | Mutation? | Behavior affected by ownership change? | Slice 6 impact |
|----------|--------------------|-----------|----------------------------------------|----------------|
| Quote / package (Update) | Via session | Owner Update | Yes — owner ACL | Immediate ACL flip (old 403 / new OK) |
| Decision fields | Via session | Owner Update / Complete | Yes | Same |
| Insurance counselling fields | Via session Update; CCMS separate | Session owner-gated; claims path not owner ACL | Partial | Who edits counselling insurance fields changes |
| Notes (`session_notes.*`) | Indirect | Notes permissions — **no** `DenyUnlessSessionOwner` found | **GAP** vs owner ACL | Default **out of Slice 6** unless product expands scope |
| Finish / Complete | Owner gate | Owner Complete | Yes | New owner can finish |
| Finalize Surgery | **No** counselling owner ACL | OT permissions | **PD-FS-01** shared | Must **not** rewrite CounselorId on finalize — **Slice 9 boundary** |
| Follow-up Center | Display/projection | Branch-shared mutate (**PD-FOLLOWUP-01**) | Display label of “original owner” | Honesty of labels; not follow-up ACL — **Slice 10 boundary** |
| Analytics | Filter effective owner (`CounselorId` else CreatedBy) | Read | My Work attribution moves with new stamp | Preserve PD13–15 formulas; Slice 11 My Work separate |
| Patient Details / WL sheet | Display Owner | Read-only | Owner column updates | No mutate |
| Clinical Recommendations | Snapshot read | Read | No owner gate | None |
| Waiting List visibility | Shared; not filtered by owner | Assign/Claim CTAs | Owner indicator / filter / action availability | Keep shared; Owner filter client-only |

---

## 13. UI/UX Readiness

### Reusable patterns (conceptual reuse only)

| Pattern | Path | Fit for Reassign |
|---------|------|------------------|
| **WaitingListAssignDialog** | `waiting-list/WaitingListAssignDialog.tsx` | Strongest: counsellor picker, search, empty/error, session context; today calls **assign only** |
| Ownership display / Owner filter | `WaitingListWorkRow`, `waiting-list-client-filters` | Show current owner; filter does not change shared visibility |
| Session History | `SessionHistoryModal` + header History | Add Reassigned label when emitting |
| Auth helpers | `counselling-auth.ts` | Need new supervisory CTA helper after PD-S6-01 |

### Conceptual minimal UX (AUDIT ONLY — NOT IMPLEMENTED)

```text
Current owner: Amelia Martinez
Action: Reassign
Dialog: Patient · Current owner · New owner [eligible] · [Cancel] [Reassign]
```

**Do not assume** without PD: reason field, confirmation step, effective date, notification, transfer message, queue reshuffle.

Likely UX PDs: reason (**PD-S6-10**), open-session behavior (**PD-S6-15**), notifications (**PD-S6-11**).

---

## 14. Security / IDOR / Scope Analysis

| Threat | CURRENT related control | Slice 6 requirement |
|--------|-------------------------|---------------------|
| Cross-tenant target | Assign rejects target tenant mismatch | Reuse |
| Cross-branch target | Assign requires target branch access for session branch | Reuse unless multi-branch PD |
| IDOR session id | Tenant-scoped session lookup | Reuse |
| Counsellor self-escalation to reassign peers | No Reassign API; Claim limited | **Must not** grant Reassign via `.update` alone without D1 |
| Inactive / deleted target | Soft-delete excluded on Assign | Reuse; inactive-beyond-delete = **PD** |
| Client-supplied owner | Update rejects CounselorId | Keep closed |
| Direct API invoke | RequirePermission + service checks | New endpoint must not rely on FE hide |
| Admin “do everything” | Explicitly rejected (S4-D5 / PD-SUP-01) | Supervisory ops only |

---

## 15. Data Quality / Legacy Analysis

| Condition | CURRENT handling | Reassign risk |
|-----------|------------------|---------------|
| `CounselorId` NULL | Assign / Claim paths | Use **Assign**, not Reassign (**PD-S6-03**) |
| Valid active counsellor | Normal | Target eligibility |
| Inactive / soft-deleted owner | Soft-deleted users excluded from counselor list; session may still hold GUID | Display unresolved name; Leave signal = Slice 12 |
| Deleted / unresolvable user | History may show GUID if name map fails | FE already resolves names where possible |
| Owner outside branch | Possible legacy | Reassign target still branch-validated; actor branch PD16 |
| Legacy Admin-stamped owner | PD-ADM-01: no new Admin-as-owner; legacy no backfill | May need supervisory clear/reassign — **no backfill in Slice 6** |

Do **not** backfill or repair data in Slice 6.

---

## 16. Test Coverage

### Existing (relevant; no Reassign coverage)

| Suite | Covers |
|-------|--------|
| `AuthService.Tests/Phase3ISlice3AssignOwnershipTests.cs` (+ contract) | Assign NULL→target, 409 owned, branch/tenant |
| `Phase3ILifecycleClaimOwnershipTests` (as referenced by program) | Claim peer/null, 409 stale expected, Admin forbidden |
| `Phase3ISlice4OwnerMutationAclTests.cs` | Owner content ACL; Update CounselorId 400; Admin no content bypass |
| `Phase3ISlice5OwnershipHistoryAuditTests.cs` | Dual trail; conflict no trail; StageAsync fail; Requeue no OwnershipRequeued |
| FE: assign/claim API tests, WaitingListAssignDialog, SessionHistory Slice 5, ownership helpers | Assign/Claim/History UX |

### Slice 6 would need (future — do not add now)

- Supervisory permission allow/deny matrix (after D1)  
- A→B success; dual trail `OwnershipReassigned`; Actor ≠ Owner  
- Reason required/optional per PD  
- NULL→B rejected on Reassign (must use Assign)  
- A→A behavior per PD  
- Lifecycle eligibility matrix tests  
- Post-reassign ACL (old 403, new mutate OK)  
- Concurrent expected-previous / conflict no trail  
- FE dialog + History label  
- Regression: Assign/Claim/Create/Start/Requeue unchanged  

No Playwright/E2E ownership reassign found.

---

## 17. Product Decision Register (original audit — superseded by closure)

> **Historical register from the initial readiness audit.** Status values below reflect the pre-closure state.  
> **Authoritative approved rules:** see **Product Decision Closure — Approved** (later in this document). All PD-S6-01…17 are now **APPROVED** at the product-rule level; D1 IAM code mapping remains a separate blocker.

Status key (at original audit): **OPEN** | **WORKING (3H)** | **PARTIAL** → **now: APPROVED** (see closure)

### PD-S6-01 — Who can perform General Reassign?

| | |
|--|--|
| **Current evidence** | No Reassign API. Assign uses `.update`. Claim counsellor-only. Admin blocked on Claim. No hard-coded Supervisor. |
| **Current behavior** | Only Claim can change owned→other (to actor). |
| **WORKING (3H)** | PD-REASSIGN-01 Supervisor/Admin; PD-SUP-01 permission-based. |
| **Decision required** | Exact permission code(s) (**D1**); whether Admin role heuristics allowed for FE CTA or permission-only; whether current owner may self-handoff. |
| **Impact** | Authz design, FE gating, IAM seed if new code. |
| **Status** | **PARTIAL** — actor class WORKING; **permission mapping OPEN** |

### PD-S6-02 — Who can be selected as target counsellor?

| | |
|--|--|
| **Current evidence** | Assign/`getCounselors` heuristics + branch/tenant. |
| **Current behavior** | Target must be assignable counsellor in session branch. |
| **Decision required** | Any extras beyond Assign (capability, active status, exclude self). |
| **Impact** | Picker + server validation. |
| **Status** | **OPEN** (default lean: reuse Assign — confirm) |

### PD-S6-03 — Is Reassign only A → B, with NULL → B remaining Assign?

| | |
|--|--|
| **Current evidence** | Assign rejects owned; Claim separate. Phase 3H Assign ≠ Reassign. |
| **Current behavior** | Distinct endpoints conceptually. |
| **Decision required** | Keep separate operations vs consolidate (not recommended without approval). |
| **Impact** | API shape, UX CTAs, 409 messages. |
| **Status** | **WORKING lean separate** — confirm for Slice 6 |

### PD-S6-04 — Self-reassign A → A?

| | |
|--|--|
| **Current evidence** | Assign never hits A→A (owned → 409). Claim self = success **no-op**, **no trail**. |
| **Current behavior** | Claim precedent: no-op no trail. |
| **Decision required** | Reject vs no-op vs trail for Reassign A→A. **Must not change Claim self no-op.** |
| **Impact** | API errors, audit noise. |
| **Status** | **OPEN** |

### PD-S6-05 — Can Pending sessions be reassigned?

| | |
|--|--|
| **Current evidence** | Pending+owned = content read-only until Start; Assign only Waiting+NULL. |
| **Decision required** | Allow Reassign while Pending without Starting? |
| **Impact** | Ops handoff before counselling starts. |
| **Status** | **OPEN** |

### PD-S6-06 — Can Processing/InProgress sessions be reassigned?

| | |
|--|--|
| **Current evidence** | Owner mutates content; no locks/Version; open UI possible. |
| **WORKING (3H)** | “Active counselling session” implies yes, but not explicit. |
| **Decision required** | Allow mid-session transfer; unsaved drafts / open UI policy (**PD-S6-15** / Slice 7). |
| **Impact** | Clinical safety + concurrency. |
| **Status** | **OPEN** (critical) |

### PD-S6-07 — Can Completed/Done sessions be reassigned?

| | |
|--|--|
| **Current evidence** | Claim handles ReEvaluate ownership separately. |
| **Decision required** | General Reassign on Completed vs Claim-only. |
| **Impact** | Overlap with lifecycle claim. |
| **Status** | **OPEN** |

### PD-S6-08 — Can Repeat Counselling sessions be reassigned?

| | |
|--|--|
| **Current evidence** | Claim StartRepeat. |
| **Decision required** | Reassign vs Claim exclusivity. |
| **Impact** | Same as PD-S6-07. |
| **Status** | **OPEN** |

### PD-S6-09 — Can SurgeryDone / historical sessions be reassigned?

| | |
|--|--|
| **Current evidence** | Claim blocks SurgeryDone; Finalize/Follow-up not counselling-owner ACL. |
| **Decision required** | In Slice 6 vs defer Slice 9/10. |
| **Impact** | Scope boundary (**PD-S6-17**). |
| **Status** | **OPEN** — lean **OUT OF SCOPE Slice 6** pending confirm |

### PD-S6-10 — Is a reassignment reason required?

| | |
|--|--|
| **Current evidence** | Assign API has **no** reason. Claim uses intent string as Reason. PD-REASSIGN-01: reason required. |
| **Decision required** | Required free text vs predefined codes vs optional (3H says required — confirm API shape). |
| **Impact** | Request DTO; History Reason; UX. |
| **Status** | **WORKING (required)** — confirm shape **OPEN** |

### PD-S6-11 — Should reassignment notify the new counsellor?

| | |
|--|--|
| **Current evidence** | No ownership-change SignalR/email wiring on Assign/Claim; local toast only; History/Audit only. Queue display notifier unused for ownership. |
| **Decision required** | Notify previous/new/supervisors? Channel? Or History-only? |
| **Impact** | Integration scope. |
| **Status** | **OPEN** |

### PD-S6-12 — History event name?

| | |
|--|--|
| **Current evidence** | Reserved `OwnershipReassigned`. |
| **Decision required** | Lock name (likely keep reserved). |
| **Impact** | FE labels, tests. |
| **Status** | **WORKING lean** — confirm |

### PD-S6-13 — Audit action name?

| | |
|--|--|
| **Current evidence** | Slice 5 uses same string for History ChangeType and Audit Action. |
| **Decision required** | Confirm parity with `OwnershipReassigned`. |
| **Impact** | Audit queries. |
| **Status** | **WORKING lean** — confirm |

### PD-S6-14 — Same target eligibility as Assign?

| | |
|--|--|
| **Current evidence** | Single `IsAssignableCounsellorAsync` + branch. |
| **Decision required** | Exact reuse vs stricter. |
| **Impact** | Shared validation helper. |
| **Status** | **OPEN** |

### PD-S6-15 — Already-open session when ownership changes?

| | |
|--|--|
| **Current evidence** | No push invalidation on ownership change; next mutate may 403 if owner check hits new CounselorId; no Version. |
| **Decision required** | Soft guidance vs hard lock vs Slice 7 messaging. |
| **Impact** | UX + concurrency dependency. |
| **Status** | **OPEN** — Slice 7 interaction |

### PD-S6-16 — Explicit dependency on Slice 7 concurrency?

| | |
|--|--|
| **Current evidence** | No Version on CounselingSession; Claim has expected-owner; PD-CONC-01 targets reassignment. |
| **Decision required** | Ship Reassign with expected-previous interim **or** hard-block until Slice 7. |
| **Impact** | Sequencing 6→7. |
| **Status** | **OPEN** |

### PD-S6-17 — Downstream boundaries (Slice 9/10)?

| | |
|--|--|
| **Current evidence** | PD-FS-01 / PD-FOLLOWUP-01 / PD-POST-01: Finalize & Follow-up not counselling-owner ACL. |
| **Decision required** | Confirm Slice 6 does **not** change Finalize/Follow-up ownership semantics. |
| **Impact** | Scope control. |
| **Status** | **WORKING lean separate** — confirm |

---

## 18. Implementation Plan — CONCEPTUAL ONLY

**Do not execute.** Sequence if product approves:

1. **Resolve Product Decision Register** (especially PD-S6-01/D1, 05–10, 16).  
2. **Backend contract** — dedicated Reassign endpoint (proposed shape below); do not overload Assign.  
3. **Authorization** — map D1 permission + branch/tenant; never role-name-only.  
4. **Atomic ownership mutation** — conditional ExecuteUpdate previous→new; reject NULL (use Assign); A→A per PD.  
5. **History/Audit** — emit `OwnershipReassigned` via `StageOwnershipTrailAsync` in same txn.  
6. **UI** — supervisory CTA + dialog patterned on WaitingListAssignDialog; History label.  
7. **Tests** — matrix in §16.  
8. **Manual UAT** — ACL flip, reason, trails, regressions Assign/Claim/Pending read-only/Start≠ownership.  

### PROPOSED — NOT IMPLEMENTED API shape

```http
POST /api/Counseling/sessions/{id}/reassign
Authorization: existing JWT + (D1 permission TBD)
Content-Type: application/json

{
  "counselorId": "<Guid>",              // new owner
  "expectedCounselorId": "<Guid|null>", // optional interim concurrency (claim-style)
  "reason": "<string>"                  // if PD-S6-10 requires
}
```

Illustrative responses (reuse Assign/Claim patterns; **not final**): 200 success + new owner; 400 bad target/state/reason; 403 unauthorized/branch; 404 session/target; 409 ownership changed / conflict.

---

## 19. Scope Boundary

| Slice | Scope | Relation to this audit |
|-------|--------|-------------------------|
| **6** | **General Reassign** A→B supervisory (after PDs) | **This document only** |
| **7** | Optimistic concurrency / Version / 409 redesign | Dependency **PD-S6-16**; do not implement |
| **8** | Requeue → NULL + `OwnershipRequeued` | Do not clear ownership here |
| **9** | Finalize / Post-Surgery ownership boundaries | **PD-S6-09 / 17** |
| **10** | Follow-up ownership/lifecycle | Separate |
| **11** | Analytics My Work | Attribution side effect only |
| **12** | Leave / Reassignment Required signal | Wires to Slice 6; not build Reassign UI for leave alone |

**Certified preserve:** Slice 1–5 behavior unchanged by this audit (no code changes).

---

## 20. Original Readiness Verdict (pre–PD closure)

> **Historical.** Recorded at initial audit before PD-S6-01…17 were approved. Superseded by **Updated Readiness Verdict** after Product Decision Closure.

| Gate | Result (at original audit) |
|------|--------|
| Audit inventory complete? | **YES** |
| Reassign already implemented? | **NO** |
| Dual-trail / reserved event ready to extend? | **YES** |
| Product decisions closed for implementation? | **NO** (at that time) |
| Technical gap blocking even product decisions? | **NO** (patterns exist; D1 is product/IAM mapping) |
| Slice 6 implementation started? | **NO** |

### Original final verdict

**BLOCKED — PRODUCT DECISION REQUIRED**

---

## Product Decision Closure — Approved

**Closure date:** 2026-09-17  
**Nature:** PRODUCT-APPROVED decisions for Slice 6 General Reassign.  
**Not implemented.** Distinctions: **CURRENT** (code today) · **APPROVED PRODUCT DECISION** · **FUTURE IMPLEMENTATION** · **SLICE 7 DEPENDENCY**.

These decisions align with Phase 3H **PD-REASSIGN-01**, **PD-ASSIGN-01**, **PD-SUP-01**, **PD-AUTH-01**, History + Audit, and do **not** reopen or alter certified Slices 1–5.

### Consistency with certified Slices 1–5

| Certified behavior | Closure impact |
|--------------------|----------------|
| Slice 1 — shared Waiting List + server branch auth | Unchanged; Reassign does not create private WL (**PD-S6-17**) |
| Slice 2 — Admin create NULL; Start ≠ ownership | Unchanged; Reassign must never Start counselling (**PD-S6-05**) |
| Slice 3 — Assign NULL→target; owned→409 | Unchanged; Reassign strictly A→B (**PD-S6-03**) |
| Lifecycle Claim ReEvaluate/StartRepeat | Unchanged; Done/Repeat Reassign forbidden (**PD-S6-07/08**) |
| Slice 4 — owner content ACL; Update CounselorId 400; no Admin content bypass | Unchanged; after Reassign ACL flips via existing owner check (**PD-S6-15**) |
| Slice 5 — dual trail; reserved `OwnershipReassigned` | Reuse trail; emit reserved name (**PD-S6-12/13**) |
| Claim self no-op no trail | **Must not** be modified (**PD-S6-04**) |

### PD-S6-01 — Who can perform General Reassign?

| Field | Value |
|-------|--------|
| **Decision** | Supervisory ownership operation only |
| **Approved rule** | Allowed actor **class**: Supervisor / Admin. Authorization **MUST** be permission-based (PD-SUP-01). Do **not** authorize merely via `counseling_sessions.update`, counsellor identity, or role-name containing "Supervisor". Do **not** introduce a new hard-coded Supervisor role. Current owner does **not** get General Reassign by virtue of ownership alone. |
| **Scope / impact** | Endpoint authz; FE CTA gating; IAM role↔permission grants |
| **Status** | **APPROVED** (actor policy). Exact permission code = **D1 IMPLEMENTATION DEPENDENCY** (see D1 section) |

### PD-S6-02 — Target counsellor selection

| Field | Value |
|-------|--------|
| **Decision** | Reuse Assign eligibility foundation |
| **Approved rule** | Same tenant; session branch access; `IsAssignableCounsellorAsync`-style validation; not soft-deleted. No second eligibility system. |
| **Scope / impact** | Server validation + FE picker convenience |
| **Status** | **APPROVED** |

### PD-S6-03 — A→B vs NULL→B

| Field | Value |
|-------|--------|
| **Decision** | Operations remain distinct |
| **Approved rule** | General Reassign is **strictly** existing owner A → different eligible B. NULL → B remains Explicit Assign. Do **not** make Reassign act as Assign when `CounselorId` is NULL. Do **not** consolidate endpoints without a future product decision. |
| **Scope / impact** | Separate `/reassign` vs `/assign`; reject NULL on Reassign |
| **Status** | **APPROVED** |

### PD-S6-04 — Self-reassign A→A

| Field | Value |
|-------|--------|
| **Decision** | Reject invalid Reassign |
| **Approved rule** | A → A is **rejected**. No ownership change. No History. No Audit. Do **not** change Claim self no-op behavior. |
| **Scope / impact** | 400-style validation (or project-consistent bad-request); trail silence |
| **Status** | **APPROVED** |

### PD-S6-05 — Pending eligibility

| Field | Value |
|-------|--------|
| **Decision** | Pending + owned may be reassigned |
| **Approved rule** | Pending + A → B allowed. Must **not**: start counselling; change Pending→Processing/InProgress; alter queue lifecycle; create content mutations; bypass Start Counseling. After success: B owns; session remains Pending/read-only until Start. |
| **Scope / impact** | State guard allows Pending; Start remains separate |
| **Status** | **APPROVED** |

### PD-S6-06 — Processing / InProgress eligibility

| Field | Value |
|-------|--------|
| **Decision** | In-progress operational handoff allowed |
| **Approved rule** | Processing/InProgress + A → B allowed. Slice 6 uses **atomic expected-previous-owner** protection. Do **not** add `CounselingSession.Version` in Slice 6. Full optimistic concurrency = **SLICE 7 DEPENDENCY**. |
| **Scope / impact** | Conditional ExecuteUpdate; open-session ACL via server (**PD-S6-15**) |
| **Status** | **APPROVED** |

### PD-S6-07 — Completed / Done

| Field | Value |
|-------|--------|
| **Decision** | General Reassign forbidden |
| **Approved rule** | Done sessions use lifecycle Claim for ReEvaluate ownership only. Do not overlap General Reassign. Do not alter Claim. |
| **Scope / impact** | Reject Reassign when Done/Completed |
| **Status** | **APPROVED** |

### PD-S6-08 — Repeat Counselling

| Field | Value |
|-------|--------|
| **Decision** | General Reassign forbidden |
| **Approved rule** | Repeat ownership via Claim StartRepeat only. Do not replace Claim. Do not alter Claim. |
| **Scope / impact** | Reject Reassign for Repeat lifecycle ownership path |
| **Status** | **APPROVED** |

### PD-S6-09 — SurgeryDone / historical

| Field | Value |
|-------|--------|
| **Decision** | Out of Slice 6 scope |
| **Approved rule** | SurgeryDone / sealed/historical sessions: General Reassign **forbidden / out of scope**. Finalize/Post-Surgery boundaries = Slice 9. |
| **Scope / impact** | Reject / do not build UX for sealed sessions |
| **Status** | **APPROVED** |

### PD-S6-10 — Reassignment reason

| Field | Value |
|-------|--------|
| **Decision** | Reason required |
| **Approved rule** | Concise free-text reason **required**. Reject missing/blank. Persist via existing History/Audit trail (`Reason` / trail details). No new reason-code taxonomy. Max length: follow **existing** project conventions (e.g. `CounselingSessionAuditLog.Reason` has **no** EF `[MaxLength]` today; `ChangeType` is max 50 — do **not** invent a new arbitrary business limit in docs). |
| **Scope / impact** | Request validation; trail Reason field |
| **Status** | **APPROVED** |

### PD-S6-11 — Notification

| Field | Value |
|-------|--------|
| **Decision** | No new notification infrastructure in Slice 6 |
| **Approved rule** | Do **not** add SignalR ownership notifications, email, WhatsApp, new notification events/services. Slice 6 provides ownership change + UI confirmation + History + Audit only. Future notify = separate PD/slice. |
| **Scope / impact** | Out of Slice 6 implementation |
| **Status** | **APPROVED** |

### PD-S6-12 — History event

| Field | Value |
|-------|--------|
| **Decision** | Lock ChangeType |
| **Approved rule** | `OwnershipReassigned`. Reuse Slice 5 History mechanism. No new History table. |
| **Scope / impact** | Emit reserved constant; FE History label |
| **Status** | **APPROVED** |

### PD-S6-13 — Audit action

| Field | Value |
|-------|--------|
| **Decision** | Lock Audit action |
| **Approved rule** | `OwnershipReassigned` (same semantic name as History). Reuse `StageOwnershipTrailAsync` / `IAuditService`. |
| **Scope / impact** | Dual-trail parity |
| **Status** | **APPROVED** |

### PD-S6-14 — Target eligibility

| Field | Value |
|-------|--------|
| **Decision** | Same foundation as Explicit Assign |
| **Approved rule** | No parallel eligibility rule. Server authoritative; FE filter convenience only. Do not rely on hidden UI for authz. |
| **Scope / impact** | Shared validation helper with Assign |
| **Status** | **APPROVED** |

### PD-S6-15 — Already-open session

| Field | Value |
|-------|--------|
| **Decision** | Immediate ACL flip; server ACL authoritative |
| **Approved rule** | After A → B: A must not mutate; B gains owner mutate. Already-open session for A must **not** retain mutation authority. No new realtime invalidation in Slice 6. Do not silently save stale ownership changes. Full stale-session/version UX = **SLICE 7 DEPENDENCY**. |
| **Scope / impact** | Existing `DenyUnlessSessionOwner` on subsequent mutate; expected-previous on Reassign itself |
| **Status** | **APPROVED** |

### PD-S6-16 — Slice 7 concurrency dependency

| Field | Value |
|-------|--------|
| **Decision** | Slice 6 without Version column |
| **Approved rule** | Use atomic expected-previous-owner (Claim-equivalent). Only A→B if `CounselorId` still A. On mismatch: no ownership change, no History, no Audit, conflict response consistent with existing ownership conventions. Do **not**: add Version column/migration; full Slice 7 stale UX; redesign all 409 behavior. |
| **Scope / impact** | `expectedCounselorId` on conceptual Reassign API; **SLICE 7 DEPENDENCY** for Version |
| **Status** | **APPROVED** |

### PD-S6-17 — Downstream boundaries

| Field | Value |
|-------|--------|
| **Decision** | Counselling-session ownership only |
| **Approved rule** | Do **not** change Finalize Surgery, Post-Surgery, Follow-up Center ownership semantics, Analytics formulas, or Waiting List shared-queue semantics. Slice 9 / 10 / 11 / 12 retain their scopes. |
| **Scope / impact** | Prevents scope creep |
| **Status** | **APPROVED** |

---

## Approved lifecycle matrix (Slice 6)

| State | CounselorId | Action |
|------|-------------|--------|
| Pending | NULL | **Assign** |
| Pending | A | **Reassign** A→B allowed (must **not** Start counselling) |
| Processing / InProgress | A | **Reassign** A→B allowed (expected-previous protection) |
| Completed / Done | A | General Reassign **forbidden**; Claim for ReEvaluate only |
| Repeat Counselling | A / NULL | General Reassign **forbidden**; Claim for StartRepeat |
| SurgeryDone | A | General Reassign **forbidden** / out of scope |
| Historical / sealed | A | General Reassign **forbidden** / out of scope |
| Any state | NULL | **Assign**, never Reassign |
| Any owned state | A→A | **Reject**; no trail |

**Invariant:** General Reassign must **never** start counselling. Pending reassignment remains Pending.

---

## Approved ownership operation triangle

### Explicit Assign (certified — unchanged)

```text
NULL → B
```

Purpose: establish initial ownership. Waiting + NULL. Already owned → 409.

### Lifecycle Claim (certified — unchanged)

```text
NULL → actor
A → actor
```

Only intents: `ReEvaluate` | `StartRepeat`. Self-claim = success no-op, no trail. Admin forbidden on Claim.

### General Reassign (APPROVED — FUTURE IMPLEMENTATION)

```text
A → B
```

Purpose: supervisory operational handoff. Actor may ≠ B. Supervisory permission required (D1). Reason required. Dual History/Audit `OwnershipReassigned`. Expected previous owner concurrency (no Version in Slice 6).

---

## Approved History / Audit semantics (FUTURE IMPLEMENTATION)

Reuse Slice 5 transactional pattern:

```text
BeginTransaction
  → conditional ownership mutation (WHERE CounselorId == expected A → set B)
  → StageOwnershipTrailAsync (OwnershipReassigned)
  → SaveChanges
  → Commit
```

On failure → Rollback. On ownership conflict → no mutation, no History, no Audit.

Trail information: SessionId, TenantId, Actor, Previous CounselorId, New CounselorId, Reason, Branch, Source, Intent (if applicable), CorrelationId (existing infrastructure).

**Actor ≠ New Owner** (e.g. Supervisor X reassigns A → B: Actor=X, From=A, To=B).

---

## Approved API direction (CONCEPTUAL — NOT IMPLEMENTED)

```http
POST /api/Counseling/sessions/{id}/reassign
```

```json
{
  "counselorId": "<new owner Guid>",
  "expectedCounselorId": "<current owner Guid>",
  "reason": "<required reason>"
}
```

Do **not** invent additional request properties. Do **not** add this endpoint in the documentation task.

---

## D1 — Permission mapping result (historical pre-implementation note)

> **Superseded.** The inspection below was recorded before D1 IAM implementation.  
> **Authoritative resolution:** see **D1 IAM Permission Mapping — Resolved**.

### Inspection performed (pre-implementation)

| Source | Finding |
|--------|---------|
| `CounselingSessionsPermissionCatalog.cs` | Codes only: `counseling_sessions.read`, `.create`, `.update`, `.delete`, `.view` |
| `CounsellorLeastPrivilegeCatalog.cs` | Retains same counselling session codes; no reassign/supervisory ownership code |
| Repo search for counselling reassign/assign supervisory permission | **Zero** matches for `counseling_sessions.assign`, `counseling_sessions.reassign`, or equivalent supervisory ownership permission |
| Phase 3I implementation readiness **D1** | Already marked unresolved — do not invent code |
| Phase 3H **PD-SUP-01** | Permission-based; if existing codes insufficient → implementation dependency |

### Suitability of existing codes

| Candidate | Suitable for General Reassign alone? | Why |
|-----------|--------------------------------------|-----|
| `counseling_sessions.update` | **NO** | Already grants Assign + Claim + content mutate to counsellors; using it for Reassign would over-privilege every updater (explicitly forbidden by PD-S6-01 / implementation readiness risk) |
| `counseling_sessions.read` / `.view` / `.create` / `.delete` | **NO** | Wrong operation semantics |
| Hard-coded Admin / Supervisor role name | **NO** | Forbidden by PD-SUP-01 / PD-S6-01 |
| Dedicated reassign / supervisory ownership permission | **ABSENT** | Must be introduced via IAM seed/mapping in a future implementation step — **not invented in this document** |

### D1 conclusion

**No suitable existing permission code was identified** that can safely authorize General Reassign without inventing a code or misusing `counseling_sessions.update`.

**IMPLEMENTATION DEPENDENCY / IAM MAPPING TASK (required before coding Slice 6):** Product/IAM must select the minimum permission change consistent with existing Hospital Portal RBAC architecture (catalog + seeder + role grants), then seed/link it to Supervisor/Admin-capable roles. This documentation task does **not** invent or seed that code.

---

## Confirmed FUTURE IMPLEMENTATION scope (next phase only)

**Backend:** dedicated `/reassign`; supervisory auth (after D1); tenant/branch; Assign-equivalent target eligibility; A→B conditional mutation; required reason; dual trail; conflict no trail; **no Version**.

**Frontend:** supervisory CTA; dialog pattern (e.g. WaitingListAssignDialog); current owner; eligible targets; required reason; confirmation; History label for `OwnershipReassigned`; capability gating.

**Tests (future):** supervisory allow; counsellor deny; Admin per resolved permission; cross-tenant/branch deny; invalid target; NULL→B rejected; A→A rejected; Pending/Processing allow; Done/Repeat/SurgeryDone reject; missing reason; dual trail success; conflict no trail; ACL flip; Assign/Claim/Start/Pending read-only/Requeue regressions.

**Manual UAT** mandatory after implementation.

### Explicit out of scope

Slice 7 Version / full concurrency UX · Slice 8 Requeue→NULL / `OwnershipRequeued` · Slice 9 Finalize/Post-Surgery · Slice 10 Follow-up · Slice 11 Analytics My Work · Slice 12 Leave/Reassignment Required · notifications · new audit/History/ownership tables · new worklist · new design system · new Supervisor role · WL/session redesign · Claim replacement · Assign semantic change.

---

## Updated Readiness Verdict

| Gate | Result |
|------|--------|
| Original audit inventory preserved? | **YES** |
| PD-S6-01…17 closed / APPROVED? | **YES** |
| Lifecycle matrix approved & consistent? | **YES** |
| Assign / Claim / Reassign remain distinct? | **YES** |
| Pending reassign does not imply Start? | **YES** (PD-S6-05) |
| SurgeryDone out of scope? | **YES** (PD-S6-09) |
| Slice 7 Version out of scope? | **YES** (PD-S6-16) |
| Downstream Slice 9/10/11/12 unchanged? | **YES** (PD-S6-17) |
| Certified Slices 1–5 contradicted? | **NO** |
| Suitable existing Reassign permission found? | **YES (IAM implemented)** — `counseling_sessions.reassign` |
| Permission invented/seeded by PD-closure docs only? | **NO** — D1 IAM task seeded catalog + ADMIN grant |
| Slice 6 Reassign endpoint/UI started? | **NO** |
| Production counselling ownership behavior changed? | **NO** (IAM catalog/grants only) |

### Final verdict

**READY FOR SLICE 6 IMPLEMENTATION**

> Historical note: Prior to D1 IAM work, this section ended with **BLOCKED — IAM PERMISSION MAPPING REQUIRED**. That blocker is resolved; see **D1 IAM Permission Mapping — Resolved**.

---

## D1 IAM Permission Mapping — Resolved

| Field | Value |
|-------|--------|
| **Resolved date** | 2026-09-17 |
| **Nature** | **IAM IMPLEMENTATION** only — catalog, seed, ADMIN grant, least-privilege strip, tests, SQL migration |
| **General Reassign API/UI?** | **NOT implemented** (FUTURE SLICE 6 IMPLEMENTATION) |

### Exact permission

| Field | Value |
|-------|--------|
| **Code** | `counseling_sessions.reassign` |
| **Name** | Reassign Counseling Session Ownership |
| **Module** | `counsellor` |
| **Action** | `reassign` |
| **ResourceType** | `counseling_sessions` |
| **Scope** | `branch` (same as existing counselling session catalog) |
| **Description** | Supervisory reassignment of an already-owned counselling session to another authorized counsellor (A→B). Does not establish initial ownership (Assign) or lifecycle claim. |

### Why this follows IAM conventions

- Format `{resource}.{operation}` matches counselling catalog and ops such as `ward.investigation.verify`, `ot.safety.override`, `bill.reconciliation.view`.
- Narrower than `counseling_sessions.update` so ordinary counsellors do **not** auto-gain Reassign (**PD-S6-01**).
- Distinct from Assign/Claim (both remain on `.update`).

### Catalog / seed locations

| Layer | Location |
|-------|----------|
| Catalog | `AuthService/SeedData/CounselingSessionsPermissionCatalog.cs` — `ReassignPermissionCode`; `Create()` includes reassign; **`Codes` baseline remains 5** (counsellor seeder cannot auto-grant reassign) |
| C# seeder | `PermissionSeeder.SeedCounselingSessionReassignPermissionsAsync` — grants **ADMIN** only |
| Startup | `Program.cs` — calls reassign seeder after counsellor baseline seed, before least-privilege |
| SQL | `consolidated/migrations/196_counseling_sessions_reassign_rbac.sql` |
| Least privilege | `CounsellorLeastPrivilegeCatalog.RemovedFromCounsellorPermissionCodes` includes `counseling_sessions.reassign` |

### Admin mapping

- Seeded grant: roles with `NormalizedName == "ADMIN"`.
- Dev/demo JWT `*` continues to satisfy any permission check including reassign (existing platform behavior).
- Non-wildcard Admins receive explicit `role_permission` via seeder + migration 196.

### Supervisory mapping (PD-SUP-01)

| Finding | Result |
|---------|--------|
| Hard-coded Supervisor role in counselling SeedData? | **None** — not invented |
| Seeded non-Admin supervisory roles for counselling? | **None** |
| How “Supervisor” actor class is expressed | Any role granted `counseling_sessions.reassign` via **existing IAM role-permission editing** |
| Application code role-name checks for Reassign? | **None introduced** |

### Counsellor least-privilege verification

| Check | Result |
|-------|--------|
| Baseline `Codes` includes reassign? | **NO** |
| RetainedPermissionCodes includes reassign? | **NO** |
| Counsellor still retains `.update`? | **YES** (Assign/Claim unchanged) |
| Accidental counsellor grant stripped? | **YES** via `ApplyCounsellorLeastPrivilegeAsync` + SQL DELETE defence |

### Distinctions

| Layer | Status |
|-------|--------|
| CURRENT production Reassign endpoint | Still absent |
| APPROVED PRODUCT DECISION PD-S6-01…17 | Unchanged |
| IAM IMPLEMENTATION (this task) | **Complete** for D1 |
| FUTURE SLICE 6 IMPLEMENTATION | `/reassign` + FE + History emission — **not started** |

### Tests

- `Phase3ISlice6D1ReassignPermissionTests.cs` (new)
- `PermissionSeederTests` counselling catalog assertions updated
- `CounsellorLeastPrivilegeCatalogTests` asserts reassign strip

### Updated readiness after D1

D1 is resolved. Product decisions remain APPROVED. General Reassign feature is still **not** implemented.

### Final verdict (post–D1)

**READY FOR SLICE 6 IMPLEMENTATION**

---

## Appendix A — Error / conflict behavior (ownership mutations today)

| HTTP | Assign / Claim today | Notes for future Reassign |
|------|----------------------|---------------------------|
| 401 | Auth middleware | Unchanged platform |
| 403 | Branch deny; bad target tenant/branch; Claim non-counsellor/Admin; owner ACL | Map D1 denials here |
| 404 | Session / target not found | Reuse |
| 409 | Assign already owned; Claim expected mismatch | Expected previous / Slice 7 |
| 400 | Empty counselorId; wrong queue state; Update CounselorId; bad claim intent | State eligibility + reason |
| 500 | Unhandled | Avoid; keep transactional |

UnauthorizedAccessException in these handlers typically maps to **403** (not 401).

---

## Appendix B — Self-reassign vs reassign-to-same-owner precedent

| Scenario | Precedent |
|----------|-----------|
| A → A via Claim (already owner) | Success **no-op**; **no** History/Audit |
| NULL → same via Assign | Normal Assign trail (`OwnershipAssigned`) |
| Owned → Assign same or other | **409** already assigned |
| A → A via Reassign | **No code** (CURRENT). **APPROVED:** reject; no trail (**PD-S6-04**) — FUTURE IMPLEMENTATION |

---

## Appendix C — Files inspected (non-exhaustive)

- `microservices/auth-service/AuthService/Services/CounselingWorkflowService.cs`
- `microservices/auth-service/AuthService/Controllers/CounselingController.cs`
- `microservices/auth-service/AuthService/SeedData/CounselingSessionsPermissionCatalog.cs`
- `microservices/auth-service/AuthService/Services/CounselingAnalyticsService.cs`
- `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts`
- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListAssignDialog.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-auth.ts`
- `apps/hospital-portal-web/src/components/counsellors-desk/SessionHistoryModal.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`
- `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md`
- `docs/audits/counsellor-ownership-work-allocation-phase3i-implementation-readiness-audit.md`
- `docs/audits/counsellor-ownership-work-allocation-phase3i-slice4.md` / `slice5.md` / `slice5-readiness-audit.md`
- `AuthService.Tests/Phase3ISlice3*.cs`, `Phase3ISlice4*.cs`, `Phase3ISlice5*.cs`

**Additional D1 inspection:** `CounsellorLeastPrivilegeCatalog.cs`; `PermissionSeeder.cs`; migration 196; Phase 3H PD-SUP-01 / PD-REASSIGN-01.

**STOP.** Do not implement General Reassign endpoint/UI in the D1 IAM task. D1 is resolved — Slice 6 feature implementation may begin in a subsequent task.
