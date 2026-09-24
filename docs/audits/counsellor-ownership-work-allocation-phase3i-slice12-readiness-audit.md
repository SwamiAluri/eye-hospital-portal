# Phase 3I Slice 12 — Leave / Reassignment Required  
# READINESS AUDIT

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-21 |
| **Mode** | **AUDIT ONLY** — no production code, API, schema, migration, permission, ownership, UI, or formula changes |
| **Working title** | Leave / Reassignment Required |
| **Prior gate** | Phase 3I Slice 11 — Analytics / My Work **ACCEPTED** (`docs/audits/phase3i-slice11-implementation-report.md`) |
| **Prior product SoT** | Phase 3H `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` (**PD-LEAVE-01**, Hybrid E, PD-WL-*, PD-SUP-01, PD16); Slices 6–11 Accepted / certified behaviors |
| **Slice 12 implementation** | **NOT STARTED** |
| **Slice 13 / adjacent** | **NOT STARTED** |

**Do not implement Slice 12 from this document.**  
**Do not invent final Leave / Reassignment product behavior.**  
**Next gate after this audit: PRODUCT DECISION (separate prompt).**

---

## 1. Audit Status

| Metric | Status |
|--------|--------|
| Slice 12 readiness audit | **COMPLETE** |
| Product Decision Record | **NOT STARTED** (this task does not create it) |
| Implementation | **NOT STARTED** |
| Production code changed by this task | **NO** |

### Gate decision

> **READY FOR PRODUCT DECISION**

Repository evidence is sufficient to enumerate current ownership/user lifecycle behavior, orphan risks, reusable APIs, and the explicit product questions Slice 12 must resolve. Remaining ambiguity is **product/policy**, not missing discovery of core ownership mechanics.

This document is **not** “READY FOR IMPLEMENTATION.”

---

## 2. Scope

Slice 12 investigates the **operational lifecycle gap** when a counsellor who owns counselling sessions becomes unavailable (leave, inactivity, deactivation, branch/access loss, departure), and whether / how the system should surface a **Reassignment Required** operational condition and resolve ownership.

In scope for **audit**:

1. Current behaviour of `CounselingSession.CounselorId` when the owning user becomes unavailable.  
2. Existing Assign / Reassign / ReQueue / ownership ACL / Version-CAS / History.  
3. Existing user/employee deactivation and branch-membership workflows.  
4. Whether any “Reassignment Required” signal, worklist, or auto-remediation already exists.  
5. Implications for Waiting List, Follow-up, Finalize/Post-Surgery, Analytics My Work, and PD16.  
6. Product decisions required before any implementation.

Out of scope for this task: implementation, schema, permissions, UI, auto-reassignment, or starting adjacent slices.

---

## 3. Prior Certified Constraints

Treat as binding unless a later **approved** decision explicitly supersedes them.

| ID / Slice | Rule | Slice 12 implication |
|------------|------|----------------------|
| Ownership SoT | `CounselingSession.CounselorId` only; `CreatedByUserId` ≠ ownership | Do not use CreatedBy as orphan ownership |
| Hybrid E / PD7 | Shared operational queues; owned active counselling via explicit Assign | Leave must not invent a second ownership model |
| PD-WL-01 / 02 | Waiting List shared; NULL owner valid | ReQueue→NULL remains valid unassigned state |
| Slice 6 | Assign / Reassign + owner mutation ACL | Reuse; do not bypass ACL |
| Slice 8 | ReQueue clears `CounselorId`; `OwnershipRequeued` when previously owned | Optional fallback only if product chooses; CAS preserved |
| Slice 9 | Finalize/Post-Surgery outside counsellor My Work personalization | Leave must not invent Finalize ownership |
| Slice 10 | Follow-up Center shared; Original Counsellor = historical | Leave must not create My Follow-ups |
| Slice 11 Accepted | My Work = Analytics attribution only; **not** an operational worklist | Slice 12 must not turn Analytics My Work into Reassignment Required queue |
| PD16 | Server-side branch authorization | Cross-branch reassignment remains constrained |
| PD-SUP-01 | Permission-based supervisory auth; **no** new Supervisor role | Prefer existing `counseling_sessions.reassign` |
| **PD-LEAVE-01** (Phase 3H, **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED**) | No automatic `CounselorId` change on leave/inactive/branch/departure; surface **Reassignment Required** (ops condition, **not** new lifecycle state); Supervisor/Admin explicit reassign; preserve history; IAM blocks access | Narrows options (rejects silent auto-transfer as default) **but does not replace** Slice 12 implementable PDs (triggers, population, surface, sequencing) |

**Critical audit note:** PD-LEAVE-01 is a **prior working workshop rule**, not a Slice 12 Accepted product decision record. Slice 12 Product Decision must either **confirm/refine** PD-LEAVE-01 into implementable PD-S12-* decisions or explicitly supersede parts of it with evidence.

---

## 4. Repository Evidence

### 4.1 Core ownership services / APIs

| Concern | Evidence |
|---------|----------|
| Session model | `microservices/auth-service/AuthService/Models/Domain/CounselingWorkflow.cs` — `CounselingSession.CounselorId`, `CreatedByUserId`, `Version` → table `counseling_sessions` |
| Workflow SoT | `…/Services/CounselingWorkflowService.cs` |
| HTTP surface | `…/Controllers/CounselingController.cs` (`api/Counseling`) |
| Create stamp | `CreateSessionAsync` — client `CounselorId` ignored; counsellor create → self; Admin/non-counsellor → NULL; `CreatedByUserId = actor` |
| Assign | `POST …/sessions/{id}/assign` → `AssignSessionAsync`; permission `counseling_sessions.update`; NULL→target; Version CAS |
| Reassign | `POST …/sessions/{id}/reassign` → `ReassignSessionAsync`; permission `counseling_sessions.reassign`; A→B; reason; Version CAS |
| Claim-for-lifecycle | `POST …/claim-for-lifecycle` — actor-only claim for ReEvaluate/StartRepeat |
| ReQueue | `POST …/sessions/{id}/re-queue` → `ReQueueSessionAsync`; clears `CounselorId`; `OwnershipRequeued` iff previously owned |
| Owner ACL | `DenyUnlessSessionOwner` — unassigned/non-owner → Forbidden for content mutate |
| History | No separate OwnershipHistory table; `counseling_session_audit_log` via `StageOwnershipTrailAsync` + platform `IAuditService` |
| FE API | `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` |
| FE ownership UX | `…/lib/counsellors-desk/counselling-ownership.ts`; `use-counselling-session-controller.ts` |

### 4.2 User / counsellor lifecycle

| Concern | Evidence |
|---------|----------|
| User entity | `…/Models/Identity/AppUser.cs` — `UserStatus`, `ActivationStatus`, `BranchId`, `DeletedAt`; **no** `IsActive` bool; **no** employment leave field on user |
| Deactivate | `UsersController.Deactivate` (`POST /users/{id}/deactivate`, permission `user.delete`) — sets `UserStatus = "inactive"` **only** |
| Bulk deactivate | `BulkOperationsController.BulkDeactivate` — `UserStatus` / `ActivationStatus`; no counselling side effects |
| Login gate | `AuthController` rejects inactive/suspended on login/refresh |
| Branch membership | `UsersController` update `BranchId`; `UserBranchesController` assign/remove — **no** counselling ownership side effects |
| Counsellor eligibility | `IsAssignableCounsellorAsync` — userType/designation/role contains counsel; **does not check `UserStatus`** |
| Assign target lookup | `DeletedAt == null` only — **does not reject inactive `UserStatus`** |
| Counsellor picker | `GetCounselors` — `DeletedAt == null` + counsellor role/heuristic; **does not filter inactive `UserStatus`** |
| HR Employee | `Employee.EmploymentStatus` / resignation fields via Employee APIs — **not wired** to clear/flag `CounselorId` |
| Admin UI deactivate | `apps/hospital-portal-web/src/app/dashboard/admin/users/page.tsx` → `usersApi.deactivate` |
| HR leave admin UI | Separate staff/leave surfaces; **not** counselling ownership remediation |

### 4.3 Analytics / shared surfaces (must not be misused)

| Surface | Evidence | Slice 12 constraint |
|---------|----------|---------------------|
| Analytics My Work | Slice 11 Accepted — `CounselorAnalyticsTab` + strict `CounselorId` attribution | **Not** an operational Reassignment Required queue |
| Waiting List | Shared PD-WL-01 | Visibility shared; not currently “inactive-owner worklist” |
| Follow-up Center | Slice 10 — Original Counsellor historical | Shared; no My Follow-ups |
| Finalize | `OtFinalizeService` — does not copy `CounselorId` | Outside Slice 12 personalization unless PD says otherwise |

### 4.4 Prior plan references (docs only — not runtime)

- Phase 3I readiness: Slice 12 “Detect inactive/missing owner; surface ops condition; no auto CounselorId change; wire to Slice 6” (`counsellor-ownership-work-allocation-phase3i-implementation-readiness-audit.md` §Slice 12).  
- Phase 3H **PD-LEAVE-01** text (workshop rule).  
- No runtime matches for “Reassignment Required” / PD-LEAVE automation in counselling services.

---

## 5. Current Ownership Lifecycle

| Stage | Current behaviour (evidence) |
|-------|------------------------------|
| **A. Creation** | Counsellor create → `CounselorId = actor`; Admin create → NULL; `CreatedByUserId = actor` (audit). Client CounselorId ignored. |
| **B. Assignment** | Explicit Assign NULL→target; `.update`; branch auth on actor+target; Version CAS; `OwnershipAssigned`. |
| **C. Reassignment** | Explicit Reassign A→B; `.reassign`; reason; expected owner match; Version CAS; `OwnershipReassigned`. |
| **D. ReQueue** | Clears `CounselorId` → NULL; returns to shared Waiting semantics; `OwnershipRequeued` if previously owned. |
| **E. Analytics** | Strict `CounselorId` My Work; NULL excluded; completed owned sessions remain historical reporting. |
| **F. Follow-up** | Shared Center; Original Counsellor = display/historical attribution; mutation ACL separate from list ACL. |
| **G. Finalize/Post-Surgery** | Does not inherit/copy counsellor ownership as Finalize SoT. |
| **H. Content mutate** | Owner-only via `DenyUnlessSessionOwner` (+ Version). Supervisors reassign; they do **not** get content-mutate bypass. |

**Ownership is never established by open/view/start alone** (certified Hybrid E / Slice 2–4 behaviour).

---

## 6. User / Counsellor Lifecycle

| Capability | Exists? | Counselling ownership effect |
|------------|---------|------------------------------|
| Canonical `UserStatus` (active/inactive/…) | **Yes** | Login blocked when inactive; **ownership unchanged** |
| Canonical HR “on leave” tied to counselling | **No** | Employee `EmploymentStatus` independent of `CounselorId` |
| Canonical “leave event” for counselling | **No** | Not present in counselling runtime |
| Deactivate blocks login | **Yes** (`AuthController`) | Prevents new authenticated work; existing JWT may persist until expiry (no revoke found on Deactivate) |
| Deactivate clears `CounselorId` | **No** | Orphaned ownership stamp remains |
| Deactivate blocks if owned sessions exist | **No** | No pre-check |
| Role removal clears ownership | **No** | Role changes do not touch sessions |
| Branch change clears ownership | **No** | Branch APIs independent of ownership |
| Assign/Reassign rejects inactive target | **No** | Only `DeletedAt` + counsellor heuristic + branch |
| GetCounselors excludes inactive | **No** | Inactive counsellor may still appear as picker target |

---

## 7. Ownership Orphan Scenarios

### 7.1 Gap inventory (canonical concepts)

| # | Concept | Present in repo? | Evidence |
|---|---------|------------------|----------|
| 1 | Canonical “inactive counsellor” for counselling | **Partial** — `AppUser.UserStatus` only; not counselling-aware | `UsersController.Deactivate` |
| 2 | Canonical “leave” event/state for ownership | **No** | HR leave ≠ counselling |
| 3 | Canonical “reassignment required” state/flag | **No** | PD-LEAVE-01 docs only; no column/API/UI |
| 4 | Canonical worklist for affected owned sessions | **No** | No dedicated queue; Analytics My Work ≠ ops list |
| 5 | Prevent retaining ownership after deactivation | **No** (stamp retained; login blocked) | Deactivate body |
| 6 | Force reassignment before deactivation | **No** | Deactivate unconditional |
| 7 | Automatic reassignment | **No** | Matches PD-LEAVE-01 “no auto” |
| 8 | Mechanism clearing `CounselorId` | **Yes** — ReQueue (and reassign replaces owner) | `ReQueueSessionAsync` |
| 9 | Preserve historical attribution after reassignment | **Yes** — audit trail + stamp moves | `OwnershipReassigned` / history API |
| 10 | Prevent unauthorized ownership take | **Yes** — Assign/Reassign auth + owner ACL | Slice 3/4/6 |

### 7.2 Lifecycle matrix (current behaviour — not desired future)

| Scenario | CounselorId | User state | Current behaviour | Risk / gap | Existing mechanism |
|----------|-------------|------------|-------------------|------------|--------------------|
| Active counsellor + assigned Waiting | Set | active | Owner mute/start per ACL | None for happy path | Assign + ACL |
| Active + InProgress | Set | active | Owner-only mutate | None | DenyUnlessSessionOwner |
| Active + Completed (retained stamp) | Set | active | Historical ownership; Analytics My Work includes in window | None | Slice 11 / PD-S11-02 |
| User deactivated while owning | **Remains set** | inactive | Cannot login; sessions stay owned; no flag | **Silent orphan ownership** | IAM login block only |
| User loses counsellor role while owning | **Remains set** | may still active | Can still login; may fail new assign eligibility; owned sessions still owned | Orphan / ACL ambiguity for “is counsellor” | Role APIs ≠ ownership |
| User moves/loses branch while owning | **Remains set** | branch changed | PD16 may block actor/target for new ops; stamp unchanged | Cross-branch orphan / ops confusion | Branch APIs + PD16 on actions |
| Reassigned A→B | B | A may still active | A loses mutate; B gains; history recorded | None | Reassign |
| ReQueued | NULL | prior owner active/inactive | Shared WL; exits prior My Work | None for intentional release | ReQueue |
| NULL-owner session | NULL | N/A | Shared WL; Assign required | Intentional | PD-WL-02 |
| Historical owner after reassignment | Prior in audit only | N/A | Trail retains old/new | None | History API |
| Assign **to** inactive user | Would set inactive user | inactive target | **Allowed by code** (DeletedAt check only) | Can create new orphan ownership | Gap vs desired leave policy |

**Bottom line today:** deactivation / leave / branch loss **do not** change `CounselorId`. Owned InProgress / assigned Waiting sessions remain stamped to an unavailable user with **no operational signal**.

---

## 8. Reassignment Mechanisms

| Mechanism | Permission | Effect on CounselorId | History | Suitable for leave remediation? |
|-----------|------------|----------------------|---------|----------------------------------|
| **Assign** | `counseling_sessions.update` | NULL → target | `OwnershipAssigned` | Only if first released to NULL |
| **Reassign** | `counseling_sessions.reassign` | A → B | `OwnershipReassigned` + reason | **Primary existing path** for owned sessions |
| **Claim-for-lifecycle** | `.update` | → actor | `OwnershipClaimed` | Narrow intents; not general leave cover |
| **ReQueue** | `.update` | * → NULL | `OwnershipRequeued` if owned | Releases to shared queue; **not** transfer to a named counsellor |

All ownership mutations use **Version / CAS** (Slice 7). Concurrent leave remediation must preserve that contract.

**Identifying affected sessions without a new worklist (technically possible today):**

- Query `counseling_sessions` where `CounselorId == unavailableUserId` and `DeletedAt == null`, optionally filtered by Status / queue state / branch.  
- Existing list APIs already accept counsellor filters for sessions/analytics (reporting), but there is **no** dedicated ops surface labelled Reassignment Required.  
- Composite DB index on `(tenant_id, counselor_id)` was **not** found; Analytics indexes are primarily `(tenant_id, session_date)` (`consolidated/migrations/188_counseling_followup_analytics_indexes.sql`). Volume concern → implementation consideration only.

---

## 9. Authorization / Security

| Action | Permission / gate | Notes |
|--------|-------------------|-------|
| Assign | `counseling_sessions.update` + branch + target counsellor | Actor may be peer/admin with update |
| Reassign | `counseling_sessions.reassign` (Admin seed; stripped from Counsellor least-privilege) | Supervisory path (PD-SUP-01) |
| ReQueue | `counseling_sessions.update` + expected owner/version | Owner/actor path |
| Content mutate | `.update` + **owner ACL** | No Admin content bypass |
| View WL / sessions | `counseling_sessions.read` + PD16 | Shared visibility |
| Deactivate user | `user.delete` | No counselling ownership check |
| Branch assign/remove | User-branch permissions | No ownership check |

### Inactive / departed counsellor capabilities (today)

| Capability | After `UserStatus=inactive` | After soft-delete (`DeletedAt`) |
|------------|----------------------------|----------------------------------|
| Login / refresh | **Blocked** | Not a normal login user |
| View owned sessions (authenticated) | **Cannot** (no login) | N/A |
| Mutate owned sessions | **Cannot** (no login); ACL would still require owner match if token leaked/expired not revoked | Assign target lookup excludes deleted |
| Reassign / complete / communicate as owner | **Cannot** via portal login | — |
| Create new ownership as target | Code may still allow Assign **to** inactive (not deleted) user | Deleted excluded |

**No existing rule** defines counselling behaviour for “permission removed but still active login” or “branch removed while owning” beyond action-time PD16 denials — **PRODUCT DECISION REQUIRED**.

---

## 10. Branch Implications (PD16)

- Assign/Reassign already enforce actor + target authorized for **session branch**.  
- Changing a user’s branch / `user_branches` **does not** auto-reassign or clear ownership.  
- A user who loses branch access may still appear as historical `CounselorId` while unable to act on that branch.  
- Cross-branch reassignment remains forbidden by existing Reassign guards unless product later changes PD16 (out of Slice 12 default).  
- Follow-up Center remains branch-shared (PD-FOLLOWUP-01) — leave remediation must not personalize Follow-up.

---

## 11. Data / History / Audit

| Question | Answerable today? | How |
|----------|-------------------|-----|
| Who owned before leave? | **Yes** (if stamp still set) / history for prior changes | `CounselorId` + audit log |
| Who reassigned? | **Yes** after Reassign | `ChangedByUserId` / audit actor |
| When reassigned? | **Yes** | `ChangedAt` |
| Why reassigned? | **Yes** if reason supplied | Reassign requires reason |
| Was original owner inactive? | **Not in ownership trail** | Must join `Users.UserStatus` at query time; not stamped on audit event |
| Automatically requeued? | **Only if ReQueue called** | Distinguishes via `OwnershipRequeued` source=`Requeue` |
| Manual reassignment? | **Yes** | `OwnershipReassigned` source=`Reassign` |

**No schema field** today for: `ReassignmentRequired`, leave reason, unavailable-at, or inactive-owner marker.

Schema additions (if any) are a **future product/architecture decision** — not authorized by this audit.

---

## 12. UX / Operational Surface

| Existing surface | Could host Reassignment Required? | Fit |
|------------------|-----------------------------------|-----|
| Admin Users deactivate | Pre-check / block / warn | Strong for **sequencing** (PD-S12-15), not ongoing ops list |
| Waiting List | Shared; not filtered by inactive owner | Weak unless product adds an ops filter (risk: new personalized WL) |
| Counselling Sessions list | Can filter by counsellorId | Possible **query surface** without new entity |
| Session detail Assign/Reassign/ReQueue | Remediation actions already exist | Strong for **resolution**, not discovery |
| Ownership History panel | Shows trail after the fact | Audit, not worklist |
| Follow-up Center | Shared; Original Counsellor historical | **Unsuitable** as leave worklist |
| Analytics My Work | Attribution reporting | **Forbidden** as ops queue (Slice 11) |
| Dedicated “Reassignment Required” queue | **Does not exist** | Product/architecture decision if required |

**Finding:** There is **no authoritative operational worklist** today for inactive-owner sessions. Resolution APIs exist (Reassign/ReQueue); discovery/signalling does not.

---

## 13. Performance / Architecture Considerations

| Topic | Evidence-backed note |
|-------|----------------------|
| Find sessions by owner | Filter `CounselorId == userId` is sufficient for correctness |
| Indexes | No dedicated `(tenant_id, counselor_id)` index found; may matter for large tenants → **implementation consideration only** |
| Background jobs | None for leave ownership remediation |
| Bulk reassignment | No bulk Reassign API found; would be new if product requires |
| Event on deactivate | Deactivate does not emit counselling events |

Do **not** add indexes/migrations in Slice 12 audit.

---

## 14. Existing Test Coverage

| Area | Coverage (representative) |
|------|---------------------------|
| Assign | `AuthService.Tests/Phase3ISlice3AssignOwnershipTests.cs`, contract tests |
| Reassign | `…/Phase3ISlice6ReassignOwnershipTests.cs`, D1 permission tests |
| ReQueue | `Phase3ISlice8RequeueOwnershipTests.cs` (+ queue uniqueness) |
| Owner ACL | `Phase3ISlice4OwnerMutationAclTests.cs` |
| History/Audit | `Phase3ISlice5OwnershipHistoryAuditTests.cs` |
| Version/CAS | `Phase3ISlice7OptimisticConcurrencyTests.cs` |
| Finalize boundary | `Phase3ISlice9FinalizeOwnershipBoundaryTests.cs` |
| Analytics attribution | `Phase3ISlice11AnalyticsAttributionTests.cs` |
| User deactivation → ownership | **Not found** |
| Inactive target assign rejection | **Not found** |
| Reassignment Required signal | **Not found** (by design — not implemented) |

### Minimum future Slice 12 test categories (candidates — do not write now)

1. Deactivate / unavailable owner leaves `CounselorId` unchanged (regression vs auto-clear).  
2. Detection query returns expected InProgress / assigned populations (per PD).  
3. Reassign from inactive owner succeeds under `.reassign` + CAS.  
4. ReQueue from inactive-owner session (if allowed by PD).  
5. Deactivation sequencing (block vs warn vs allow) per PD.  
6. Assign/Reassign **rejects inactive targets** if PD requires.  
7. No Analytics/Follow-up/WL personalization regressions.  
8. History distinguishes manual Reassign vs ReQueue.

---

## 15. Product Decisions Required

Prior **PD-LEAVE-01** answers the coarse policy (“no auto transfer; Supervisor reassigns; surface Reassignment Required”), but Slice 12 still needs **implementable** decisions. Candidate IDs:

| ID | Question | Why required |
|----|----------|--------------|
| **PD-S12-01** | Definition of “leave / unavailable” triggers (UserStatus inactive? Employee on_leave? role loss? branch loss? temporary flag?) | Multiple IAM/HR signals exist; counselling listens to none |
| **PD-S12-02** | Which ownership states require reassignment (Waiting assigned / InProgress / Completed / all non-NULL?) | PD-LEAVE-01 says “active sessions” — undefined in code |
| **PD-S12-03** | Is reassignment mandatory **before** account deactivation? | Deactivate currently unconditional |
| **PD-S12-04** | Assigned-but-not-started sessions on leave | Population ambiguity |
| **PD-S12-05** | InProgress sessions on leave | Highest clinical/ops risk |
| **PD-S12-06** | Completed sessions on leave | Historical stamp vs remediation |
| **PD-S12-07** | Follow-up historical Original Counsellor on leave | Slice 10: historical; confirm no mutation |
| **PD-S12-08** | Branch access removed while owning | PD16 interaction |
| **PD-S12-09** | Who may remediate (confirm `counseling_sessions.reassign` only vs also owner self-ReQueue) | Auth already exists; confirm actor matrix |
| **PD-S12-10** | Is automatic reassignment to a designated user permitted? | PD-LEAVE-01 says no by default — confirm/supersede |
| **PD-S12-11** | Is ReQueue an acceptable remediation / fallback? | Clears ownership vs transfers |
| **PD-S12-12** | Audit/history semantics for leave remediation (reason codes, inactive marker) | Trail exists; leave-specific semantics do not |
| **PD-S12-13** | Concurrency / Version-CAS during remediation | Preserve Slice 7 |
| **PD-S12-14** | Dedicated “Reassignment Required” operational surface vs reuse sessions list / admin gate | **No surface exists today** |
| **PD-S12-15** | User/account deactivation sequencing vs counselling checks | Admin Users path |
| **PD-S12-16** | Cross-branch reassignment rules under leave | Likely preserve PD16 deny |
| **PD-S12-17** *(additional)* | May Assign/Reassign **target** an inactive/unavailable counsellor? | Code allows inactive today |
| **PD-S12-18** *(additional)* | Confirm Analytics My Work must remain non-operational for leave | Slice 11 Accepted |
| **PD-S12-19** *(additional)* | JWT/session invalidation on deactivate relative to owned-session risk | Deactivate does not revoke tokens |

If Product Decision confirms PD-LEAVE-01 unchanged and only chooses surface + population + sequencing, some candidates may collapse — that collapse belongs in the Product Decision Record, not this audit.

---

## 16. Options / Technical Feasibility

**Do not select a model here.** Audit options only. All assume ownership SoT remains `CounselorId` and Version-CAS remains.

### Option A — Block deactivation until owned work reassigned

| | |
|--|--|
| Supporting infra | Admin `Deactivate`; query by `CounselorId`; Reassign API |
| Missing | Pre-check in `UsersController.Deactivate`; UI gating; definition of “blocking” statuses |
| APIs | Users deactivate + counselling Reassign |
| Permissions | `user.delete` + `.reassign` |
| Audit | Existing Reassign trail; optional deny audit |
| Concurrency | Reassign CAS before deactivate |
| Branch | PD16 on Reassign targets |
| Surfaces | Admin Users + session Reassign UX |

### Option B — Allow deactivation; expose affected sessions for mandatory reassignment

| | |
|--|--|
| Supporting infra | Deactivate as-is; query by owner; Reassign |
| Missing | Detection signal; ops surface (PD-S12-14); possibly status badge |
| Matches PD-LEAVE-01 direction | Closest to “flag Reassignment Required; no auto change” |
| Surfaces | New or reused list; **not** Analytics My Work |

### Option C — Automatically ReQueue affected sessions

| | |
|--|--|
| Supporting infra | `ReQueueSessionAsync` |
| Missing | Trigger hook; bulk ReQueue; leave-specific reason; product conflict with PD-LEAVE-01 “no auto” unless superseded |
| Risk | Drops named ownership to shared queue without transfer |

### Option D — Automatically reassign to a designated user

| | |
|--|--|
| Supporting infra | Reassign API primitives |
| Missing | Designated covering counsellor config; trigger; bulk; strongly conflicts with PD-LEAVE-01 unless superseded |
| Permissions / audit | Would need explicit actor (system vs admin) policy |

### Option E — Preserve ownership; mark user unavailable for **new** work only

| | |
|--|--|
| Supporting infra | Login block already; picker/assign target filters could exclude inactive |
| Missing | Inactive-target rejection; optional “unavailable” flag distinct from deactivate |
| Does not remediate | Existing InProgress orphans remain unless combined with A/B |

### Option F — Hybrid (E + B)

Preserve stamp; block new assign-to-inactive; surface remediation list; Supervisor Reassign. Feasible with existing Reassign + IAM; still needs product choices on population/surface/sequencing.

---

## 17. Acceptance Criteria Candidates

*Clearly marked as **requiring Product Decision** — not acceptance of implementation.*

| Candidate | Depends on |
|-----------|------------|
| No automatic `CounselorId` mutation on deactivate/leave/branch change (unless PD supersedes) | PD-S12-10 / PD-LEAVE-01 confirm |
| Affected population explicitly defined and detectable by query | PD-S12-02/04/05/06 |
| Remediation uses existing Reassign and/or ReQueue with Version-CAS | PD-S12-09/11/13 |
| History records actor, previous owner, new owner/NULL, reason | PD-S12-12 |
| No new Supervisor role; reuse `.reassign` | PD-S12-09 / PD-SUP-01 |
| Waiting List / Follow-up / Finalize / Analytics My Work remain unpersonalized | PD-S12-07/14/18 |
| Assign/Reassign target policy for inactive users explicit | PD-S12-17 |
| Deactivation sequencing explicit (block / warn / allow) | PD-S12-03/15 |
| Reassignment Required ≠ new counselling lifecycle Status | PD-LEAVE-01 / PD-S12-14 |

---

## 18. Out of Scope

This audit does **not**:

- Implement Slice 12  
- Change production code, APIs, DB schema, migrations  
- Add permissions or roles  
- Add queues/worklists/UI  
- Modify Assign / Reassign / ReQueue / ownership ACL  
- Modify Waiting List, Follow-up Center, Analytics, Finalize/Post-Surgery  
- Redesign Hospital Portal UI  
- Start Product Decision Record writing beyond listing required decisions  
- Start implementation or any adjacent slice (13+)  

---

## 19. Readiness Decision

### Verdict: **READY FOR PRODUCT DECISION**

**Rationale:**

1. Ownership lifecycle (create/assign/reassign/requeue/ACL/history/CAS) is fully mapped and already shipped through Slices 2–8.  
2. User deactivation / branch / role behaviour is mapped: **ownership is not cleared**; silent orphan stamps are the primary gap.  
3. No runtime “Reassignment Required” signal or dedicated worklist exists — confirming the Slice 12 problem space.  
4. PD-LEAVE-01 provides directional workshop policy but leaves implementable questions open (population, surface, sequencing, inactive targets).  
5. Reusable remediation infrastructure exists (Reassign, ReQueue, History, PD16, `.reassign`).  
6. Remaining work is **product decision**, not further repository archaeology of core ownership.

### Next gate (mandatory)

```text
AUDIT COMPLETE ✅
→ PRODUCT DECISION  (separate explicit prompt / record)
→ IMPLEMENTATION    (only after Product Decision accepted)
```

**Do not start Slice 12 implementation from this audit alone.**

---

**END — SLICE 12 READINESS AUDIT COMPLETE — STOP**
