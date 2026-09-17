# Phase 3I — Counsellor Ownership & Work Allocation
## Implementation Readiness Audit

| Field | Value |
|-------|--------|
| **Audit date** | 2026-09-16 |
| **Phase type** | **DIAGNOSIS / IMPLEMENTATION PLANNING ONLY** — no production code, API, DB, migration, seed, permission, UI, route, test, or fixture changes |
| **Authoritative product spec** | `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` |
| **Prior diagnosis** | `docs/audits/counsellor-ownership-work-allocation-phase3h-audit.md` |
| **Decision status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** (formal named sign-off = **0**) |
| **Production files changed by this audit** | **NO** |

**Legend**

| Label | Meaning |
|-------|---------|
| **CURRENT PRODUCTION BEHAVIOR** | What code does today |
| **APPROVED TARGET BEHAVIOR** | Phase 3H working decisions (not yet implemented) |
| **GAP** | Target ≠ current; Phase 3I work required |

---

## 1. Executive summary

Phase 3H product decisions define a **Hybrid (PD7 E)** ownership model: shared operational queues remain shared; **active counselling work** has explicit `CounselorId` ownership via **assignment** (not open/start); Follow-up and Finalize Surgery stay branch-shared and do **not** inherit counselling ownership as ACL; Post-Surgery uses **explicit assignment**; requeue clears ownership; Analytics defaults to **My Work**; concurrency rejects stale writes.

**Current production** stamps `CounselorId` on create/start but **does not enforce** owner ACL, has **no Assign/Reassign APIs**, leaves Waiting List without server PD16, leaves requeue ownership unchanged, uses Analytics default **All**, and uses **last-write-wins** on counselling mutations.

| Metric | Count / status |
|--------|----------------|
| Inventory surfaces traced (A–Z) | 26 |
| Material gaps vs Phase 3H | **28** |
| Security risks (threat model rows) | **12** |
| Implementation dependencies | **8** |
| Named formal sign-off | **0** (not a Slice-1 blocker per Phase 3H gate) |
| Phase 3I readiness | **READY FOR IMPLEMENTATION** — begin with **Slice 1** |

**Do not** treat target behavior as already implemented.

---

## 2. Authoritative decisions referenced

| ID | Selected working rule (summary) |
|----|----------------------------------|
| **PD7** | Hybrid E — `CounselorId` = active counselling owner; not every downstream workflow |
| **PD-WL-01** | Shared Waiting List; server branch auth; visibility ≠ mutate owned session |
| **PD-WL-02** | `CounselorId` NULL allowed; no backfill; CreatedBy ≠ owner |
| **PD-ADM-01** | Admin/non-counsellor create → `CounselorId = NULL` |
| **PD-START-01** | Explicit Assign establishes ownership; open/view ≠ claim |
| **PD-ASSIGN-01** | Counsellor may assign unassigned → self or same-branch peer; server validates |
| **PD-REASSIGN-01** | Supervisor/Admin reassigns owned sessions; immediate ACL flip; reason + audit |
| **History + Audit** | Dual trail for assign/reassign/requeue; Actor ≠ Owner; transactional consistency |
| **PD-AUTH-01** | Owner-level mutate = current CounselorId (+ explicit supervisory ops) |
| **PD-SUP-01** | Permission-based supervisory auth; no hard-coded new Supervisor role |
| **PD-FS-01** | Finalize Surgery shared; no CounselorId OT ownership |
| **PD-POST-01** | Post-Surgery shared queue + explicit assign; no auto-inherit |
| **PD-REQUEUE-01** | Requeue → `CounselorId = NULL`; history preserved |
| **PD-ANALYTICS-01** | My Work default; Branch scope; same Phase 2Z formulas |
| **PD-FOLLOWUP-01** | Active/Cold branch-shared; original CounselorId not ACL |
| **PD-CONC-01** | Optimistic concurrency; reject stale (409); no silent LWW |
| **PD-LEAVE-01** | No auto transfer; surface Reassignment Required; Supervisor reassigns |
| **PD-ADM-02** | Admin→Amelia: unassigned → explicit Assign (self or Ravi); Actor ≠ Owner |
| **PD7-PRECEDENCE** | Tenant → Branch → Ownership (+ permissions always) |
| **PD7-AUDIT** | Dedicated ownership events via existing History + Audit |

**Preserved (do not change in Phase 3I ownership work):** PD13, PD14, PD15, PD16 product rule, PD4 responsibility type, Phase 2X lifecycle, Phase 2Z analytics formulas/destinations.

---

## 3. Current architecture

```
Tenant (JWT) 
  → counseling_sessions.* permissions (RequirePermission)
    → optional PD16 via FollowupBranchAccessService (some endpoints only)
      → CounselingSession.CounselorId (stamped; NOT ACL today)
        → Operational History: counseling_session_audit_log (field/status changes)
        → Platform Audit: IAuditService / audit_logs (StageAsync for atomic staging)
```

| Layer | Primary locations |
|-------|-------------------|
| Entity | `AuthService/Models/Domain/CounselingWorkflow.cs` — `CounselingSession`, `CounselorQueueItem`, `CounselingSessionAuditLog` |
| Workflow | `AuthService/Services/CounselingWorkflowService.cs` |
| HTTP | `AuthService/Controllers/CounselingController.cs` (`api/Counseling`) |
| Follow-up | `FollowupListService.cs` + `FollowupBranchAccessService.cs` |
| Analytics | `CounselingAnalyticsService.cs` + `CounselingAnalyticsOutcomeClassifier.cs` |
| OT Finalize | `OtFinalizeService.cs` (`OtFinalizeSchedule.Version`) |
| Platform audit | `AuditService.cs` (`IAuditService`) |
| Permissions | `CounselingSessionsPermissionCatalog.cs`, `CounsellorLeastPrivilegeCatalog.cs` |
| FE desk | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/*`, `src/lib/api/counsellors-desk.api.ts` |
| FE analytics | `src/app/dashboard/counselor/analytics/page.tsx`, `use-counselor-analytics.ts` |

---

## 4. Current implementation behavior (inventory A–Z)

| ID | Item | Path / endpoint | Permission | CURRENT PRODUCTION BEHAVIOR | Phase 3I change? |
|----|------|-----------------|------------|-----------------------------|------------------|
| A | CounselingSession entity | `Models/Domain/CounselingWorkflow.cs` | — | Fields: `TenantId`, `BranchId?`, `CounselorId?`, `CreatedByUserId?`, `UpdatedByUserId?`, soft-delete. **No Version/rowversion** | **Yes** — concurrency column likely |
| B | CounselorId | Same | — | Nullable Guid; stamped on create/start; updatable via Update; projected on Follow-up Active/Cold | **Yes** — semantics + ACL |
| C | CreatedByUserId | Same | — | Set on create to actor; Analytics/session-list **effective-owner fallback** when CounselorId null | **Yes** — stop treating as SoT owner |
| D | CreateSession | `POST /api/Counseling/sessions` → `CreateSessionAsync` | `.create` | `CounselorId = request.CounselorId ?? currentUserId`; create uses PD16 effective branch + patient branch check | **Yes** — PD-ADM-01 NULL for non-counsellor; validate client CounselorId |
| E | UpdateSession | `PUT /api/Counseling/sessions/{id}` | `.update` | Tenant + soft-delete; **any** `.update` may set CounselorId; field-change history for some fields | **Yes** — owner ACL; lock free CounselorId write |
| F | GetSessionById | `GET .../sessions/{id}` | `.read` | Tenant + id; **no** PD16; **no** owner check | **Yes** — branch auth; read vs mutate policy |
| G | StartSession | `POST .../sessions/{id}/start` | `.update` | If CounselorId null → stamp actor (**silent claim**) | **Yes** — remove silent stamp (PD-START-01) |
| H | StartSessionFromQueue | Service-only (~1746); **no HTTP** | — | Sets InProgress; **does not** stamp CounselorId | Align/deprecate if unused |
| I | CompleteSession | `POST .../complete` | `.update` | No owner check; does not change CounselorId | **Yes** — owner ACL |
| J | RequeueSession | `POST .../sessions/{id}/re-queue` | `.update` | New Waiting queue item; intention/notes; **CounselorId unchanged**; **no** ownership History/Audit row | **Yes** — clear to NULL + History/Audit |
| K | Waiting List API | `GET .../waiting-list` | `.read` | Shared; tenant; optional **client** branchId; **no** CounselorId/CreatedBy filter; queue soft-delete; session soft-delete **not** joined filter noted in 3H audit | **Yes** — server PD16; keep shared; Assign capability elsewhere |
| L | Waiting List UI | `counsellors-desk/waiting-list/page.tsx` + rows/modals | `.read` | Shared; sends branchId; Add Patient **omits** counselorId; row open may Azure-start + navigate; **no Assign CTA** | **Yes** — Assign UX; stop silent ownership path |
| M | Follow-up Active | `GET followups/active` + surgery-followup page | `.read` / mutate `.update` | PD16 branches; intention allowlist; owner **projected**; **not** filtered by owner | **Mostly preserve**; label honesty |
| N | Follow-up Cold | `GET followups/cold-leads` | same | Same pattern | **Mostly preserve** |
| O | Follow-up Post-Surgery | `GET followups/post-surgery` | `.read` | Discharged journeys; `SessionId=null` (G13); **no** owner field/assign | **Yes** — PD-POST-01 assign SoT (no FollowUps table) |
| P | Finalize Surgery | `OtFinalizeService` + finalize-surgery page | `.read`/`.update` | Shared OT; **no** CounselorId owner; soft `Version++`; list **no** PD16 | **Boundary preserve**; optional PD16 + actor audit clarity |
| Q | Analytics | `CounselingAnalyticsService` + counselor/analytics | `.read` | PD16; optional counselorId; default **All**; CreatedBy fallback | **Yes** — My Work default FE (+ scope labels); formulas unchanged |
| R | Branch authorization | `FollowupBranchAccessService` | — | UserBranches + AppUser.BranchId; used on Follow-up/Analytics/session list/create — **not** Waiting List / GetById / OT list | **Yes** — extend per PD-WL-01 / precedence |
| S | UserBranches / BranchId | Users + UserBranches | — | Active membership drives PD16 | Reuse |
| T | RBAC | `counseling_sessions.read/create/update/delete/view` | — | **No** assign/reassign supervisory code | **Dependency** — PD-SUP-01 |
| U | Operational History | `counseling_session_audit_log` via Update paths; `GET sessions/{id}/history` | `.read` | ChangeType/Old/New/Reason/ChangedBy/ChangedAt; **no** OwnershipAssigned events; requeue writes none | **Yes** — ownership event types |
| V | Immutable Audit | `IAuditService` / `audit_logs` (`StageAsync` atomic) | — | Platform hash-chain audit; **not wired** to counselling ownership mutations today | **Yes** — StageAsync on assign/reassign/requeue |
| W | Concurrency | CounselingSession: **none**; OT: soft Version++; Conflict() used on some OT endpoints | — | Counselling = **last-write-wins** | **Yes** — PD-CONC-01 |
| X | Assign/Reassign APIs | **None** | — | Informal via Update CounselorId / create coalesce / start-if-null | **Yes** — dedicated APIs |
| Y | Counselors master | `GET /api/Counseling/counselors` | `.read` | Role name contains COUNSEL; **no** branch filter on list | **Yes** — validate assignee branch on Assign |
| Z | Tests / Playwright | Contract tests (shared WL, PD16 lists); e2e shell/UAT responsive | — | **No** ownership ACL/assign/requeue-clear/My Work assertions | **Yes** — expand matrix §20 |

### Ownership inference map (do not assume CounselorId alone)

| Signal | Treated as ownership today? | Phase 3I |
|--------|----------------------------|----------|
| `CounselorId` | Yes (stamp/display/filter); **not** ACL | SoT owner when assigned |
| `CreatedByUserId` | Analytics/list **effective owner fallback** | **Must not** be SoT owner |
| `currentUserId` | Create coalesce; start-if-null; UpdatedBy | Actor only unless Assign-to-self |
| Role | Counselor list heuristic | Not ownership |
| Client `branchId` | Convenience filter (WL) | Never authorization |
| Patient creator | Not session owner in code | Must not infer |
| Session starter / opener | FE auto-start Pending → BE stamp | **Forbidden** silent claim |
| Quick-book / PatientAgreed / OT status | Not CounselorId ACL | Keep unrelated |
| Follow-up data | Owner display only | Not Follow-up ACL |

---

## 5. Gap matrix

| # | Area | CURRENT | APPROVED TARGET | Gap severity |
|---|------|---------|-----------------|--------------|
| G01 | Waiting List PD16 | Client branch optional; omit → tenant-wide | Server-authorized branch scope | **P0** |
| G02 | Waiting List shared visibility | Shared (OK) | Shared (OK) | None (preserve) |
| G03 | CounselorId WL filter | None (OK) | None (OK) | None |
| G04 | Assign API/UI | Missing | Explicit Assign self/peer | **P0** |
| G05 | Silent start stamp | Start-if-null stamps actor | Open/start ≠ ownership | **P0** |
| G06 | Admin create coalesce | Creator becomes owner | CounselorId NULL | **P0** |
| G07 | Client CounselorId trust | Update/Create accept Guid | Server validate always | **P0** |
| G08 | Owner mutate ACL | Any `.update` | Current owner (+ supervisory) | **P0** |
| G09 | GetSessionById branch | No PD16 | Server branch | **P1** |
| G10 | Reassign API | Missing (free Update) | Supervisor/Admin only | **P0** |
| G11 | Supervisory permission | Only `.update` | Permission-mapped capability | **P0 dependency** |
| G12 | History ownership events | FieldChanged only | Assign/Reassign/Requeue History | **P0** |
| G13 | Platform Audit ownership | Not staged | StageAsync with mutation | **P0** |
| G14 | Requeue clears owner | Does **not** | → NULL | **P0** |
| G15 | Requeue History/Audit | None | Required | **P0** |
| G16 | Session Version | Absent | Optimistic concurrency | **P0** |
| G17 | Concurrent assign | Race / LWW | One winner + 409 | **P0** |
| G18 | Analytics My Work default | Default All | My Work for normal counsellor | **P1** |
| G19 | Analytics CreatedBy fallback | Effective owner | Align with CreatedBy ≠ owner | **P1** |
| G20 | Follow-up ACL | Already shared (OK) | Remain shared | Preserve; comment cleanup |
| G21 | Post-Surgery assign | No owner/assign SoT | Explicit assign; no inherit | **P1** |
| G22 | Finalize CounselorId inherit | Not used as owner (OK) | Must stay non-owner | Preserve + audit clarity |
| G23 | Finalize list PD16 | Tenant-wide list | Branch-authorized preferred | **P2** |
| G24 | Leave / Reassignment Required | No surfacing | Ops condition (not lifecycle state) | **P2** |
| G25 | Actor ≠ Owner on peer assign | N/A (no assign) | Required | **P0** with G04 |
| G26 | Legacy Admin-owned rows | Exist in ops | No backfill; preserve history | Ops/migration later |
| G27 | Soft-deleted session on WL join | Weak session filter (3H) | Exclude deleted sessions | **P1** verify/fix |
| G28 | E2E ownership coverage | Absent | Required scenarios 1–26 | **P1** with slices |

**Gap count: 28** (including preservations noted; material change gaps ≈ **24**)

---

## 6. Security assessment

| # | Threat | CURRENT risk | Required Phase 3I control | Endpoint(s) | Permission | Test |
|---|--------|--------------|---------------------------|-------------|------------|------|
| S01 | Tenant IDOR | Low (JWT tenant on queries) | Keep tenant filter everywhere | All | * | Cross-tenant deny |
| S02 | Branch IDOR | **High** on WL / GetById / OT list | Server PD16; ignore client grant | WL, GetById, OT list | `.read` | Cross-branch deny |
| S03 | CounselorId tampering | **High** (Update/Create) | Dedicated Assign/Reassign; reject free Update of owner | Create/Update/Assign | `.create`/`.update`/supervisory | Tamper blocked |
| S04 | Owner mutation bypass | **High** | PD-AUTH-01 server checks | Update/Start/Complete/Draft | `.update` | Non-owner 403 |
| S05 | Supervisor privilege escalation | **Medium** (any updater reassigns via Update) | PD-SUP-01 permission + operation check | Reassign | supervisory | Counsellor cannot reassign owned |
| S06 | Cross-branch assignment | **High** if Assign naive | Same-branch validation | Assign | `.update` + validate | Blocked |
| S07 | Cross-tenant assignment | Low if tenant enforced | Keep tenant on target user | Assign | * | Blocked |
| S08 | Reassignment bypass | **High** | Only supervisory path changes owned | Update CounselorId | supervisory | Blocked |
| S09 | Stale update | **High** (LWW) | Version + 409 | Mutate/Assign | `.update` | 409 |
| S10 | Concurrent assignment | **High** | Atomic assign-if-null + version | Assign | `.update` | One winner |
| S11 | Unauthorized GetSessionById | **Medium** (tenant-wide read) | PD16 + read policy | GetById | `.read` | Cross-branch 403 |
| S12 | Client-only authorization | **High** if FE hides only | Server authoritative | All | * | API-only attacks |

**Security risk rows: 12**

---

## 7. History / Audit assessment

| Mechanism | Role | Fields today | Ownership ready? |
|-----------|------|--------------|------------------|
| `CounselingSessionAuditLog` | **Operational History** for session | SessionId, ChangeType, OldValue, NewValue, Reason, ChangedByUserId, ChangedAt, TenantId | **Partial** — can encode OwnershipAssigned/Reassigned/Requeued; **no BranchId column** (branch via session join) |
| `IAuditService` / `AuditLog` | **Immutable platform Audit** | Action, resourceType, resourceId, details, old/new, user, hash chain; **`StageAsync`** for same-SaveChanges atomicity | **Reusable** — Stage ownership events with counselling SaveChanges |
| OT `OtFinalizeAuditLog` | OT-only | Separate | Keep distinct from counselling owner |

**Reuse strategy (do not invent parallel system):**

1. On Assign/Reassign/Requeue: write **History** row (`CounselingSessionAuditLog`) with Actor in `ChangedByUserId`, previous/new owner in Old/New (JSON or structured text), reason in `Reason`.  
2. Same transaction: `IAuditService.StageAsync(...)` for immutable audit.  
3. Rejected concurrency: **no** success History/Audit business event.  
4. Actor ≠ Owner always explicit in payload/details.

**Gap:** Requeue and ownership stamps currently write **neither** dedicated History nor platform Audit for ownership.

---

## 8. Concurrency assessment

| Asset | Pattern | Reusable? |
|-------|---------|-----------|
| `CounselingSession` | No version | Need add `Version` (int) or rowversion — **new column = migration in implementation slice** |
| `OtFinalizeSchedule.Version` | Soft increment; Conflict() on some OT paths | Conceptual reuse; strengthen expected-version check for counselling |
| EF `IsConcurrencyToken` | Not on counselling session | Prefer configure Version as concurrency token |
| API Conflict | OT returns `Conflict(...)` (~409 family) | Align counselling stale mutate to **409 Conflict** (or established equivalent) |

**Recommended technical strategy:**

1. Add `CounselingSession.Version` (int, default 0) with EF concurrency token.  
2. Assign unassigned: conditional update `WHERE CounselorId IS NULL AND Version = @v` (or transaction + token).  
3. Mutate/reassign/requeue: require expected version; on conflict return **409**; UI refresh.  
4. Do **not** auto-merge clinical fields.  
5. Do not invent a second concurrency bus.

**CURRENT:** last-write-wins. **TARGET:** PD-CONC-01.

---

## 9. Legacy data assessment

| Pattern | Source | Preserve? | Migration now? |
|---------|--------|-----------|----------------|
| CounselorId = Admin/creator | Create coalesce | History yes; current owner misleading | **No backfill** |
| CounselorId = NULL | Legacy / rare | Valid under PD-WL-02 | **No backfill** |
| CounselorId ≠ worker | Shared mutate without reassignment | Ops review later | No auto |
| Inactive user still owner | No leave process | PD-LEAVE-01 flag later | No auto clear |
| Cross-branch ownership | Possible via Update | Block new; legacy review | No silent fix |
| Downtown 18 Admin-created | Ops scenario | Shared WL visibility intentional historically | **Do not assign Amelia / do not backfill** |

If later remediation approved: **DATA MIGRATION REQUIRED** (separate gate). Phase 3I must not mutate these rows by default.

---

## 10. Implementation dependencies

| # | Dependency | Status |
|---|------------|--------|
| D1 | **PD-SUP-01 permission mapping** — exact existing vs minimum new code for reassignment | **Unresolved** — “Permission dependency — exact existing/new permission must be resolved during implementation.” Do **not** invent code in this audit |
| D2 | CounselingSession **Version** column + migration | Required for PD-CONC-01 |
| D3 | Dedicated **Assign** + **Reassign** API contracts | Missing |
| D4 | Transactional **History + Audit** wiring (`StageAsync` + session audit log) | Pattern exists; ownership events missing |
| D5 | Waiting List **server PD16** via `FollowupBranchAccessService` | Service exists; WL not wired |
| D6 | Post-Surgery **assignment persistence SoT** without FollowUps table (e.g. journey extension / related existing entity — design in slice) | **Design dependency** |
| D7 | Who may **requeue** (owner and/or supervisor) under PD-AUTH-01 | Align in Slice 6 design |
| D8 | FE Assign CTA + stop Pending auto-start ownership path | UX dependency on B/D |

**Implementation dependency count: 8**

**Non-blockers for starting Slice 1:** formal named sign-off (0) — Phase 3H gate allows working-decision implementation workflow.

---

## 11. Recommended Phase 3I slices

Adjusted for codebase dependencies (foundation → ownership write path → downstream surfaces).

### Slice 1 — Server authorization foundation + Waiting List PD16
| | |
|--|--|
| **Scope** | Enforce PD16 on Waiting List GET; verify soft-delete session exclusion; document GetSessionById branch plan; no Assign yet |
| **Files** | `CounselingController.GetWaitingList`; `FollowupBranchAccessService`; WL contract tests |
| **APIs** | `GET waiting-list` |
| **DB** | None |
| **Permissions** | None new |
| **Security** | Closes branch IDOR on WL |
| **Tests** | Unauthorized branch 403; omit branchId does not grant all unauthorized; shared CounselorId filter still absent |
| **UAT** | Amelia sees Downtown only within authorized branch |
| **Rollback** | Revert controller filter wiring |
| **Depends on** | None |
| **Risks** | Users missing UserBranches see empty WL — ops must have branch assignment |

### Slice 2 — Admin create unassigned + remove silent start stamp
| | |
|--|--|
| **Scope** | PD-ADM-01 create NULL for non-counsellor; stop Start-if-null ownership stamp; stop FE treating open as claim (disable auto-own path) |
| **Files** | `CounselingWorkflowService.CreateSessionAsync/StartSessionAsync`; Add Patient payload; session controller auto-start |
| **APIs** | Create; Start |
| **DB** | None (behavior only) |
| **Security** | Stops Admin-as-owner + silent claim |
| **Tests** | Admin create → null; Start does not set CounselorId |
| **Depends on** | Slice 1 preferred |
| **Risks** | Temporary period with more NULL owners until Assign ships — **must ship Slice 3 promptly** |

### Slice 3 — Explicit Assignment (initial)
| | |
|--|--|
| **Scope** | Assign API: unassigned → self/peer same branch; Actor ≠ Owner; concurrency-safe; WL Assign CTA |
| **Files** | New service methods + controller endpoints; `counsellors-desk.api.ts`; Waiting List UI |
| **APIs** | **New** Assign (exact route to design in impl) |
| **DB** | Prefer with Slice 7 Version; if Version not ready, use transactional assign-if-null |
| **Permissions** | `.update` for initial assign (per PD-ASSIGN-01) |
| **Security** | Validates target counsellor + branch; rejects client tampering |
| **Tests** | Self/peer assign; cross-branch block; concurrent one winner |
| **Depends on** | Slice 2 |
| **Risks** | Peer list from counselors API needs branch validation |

### Slice 4 — Owner authorization (mutate ACL)
| | |
|--|--|
| **Scope** | PD-AUTH-01 on Update/Start(content)/Complete/draft/decision paths; read/history retained; lock free CounselorId on Update |
| **Files** | `CounselingWorkflowService` mutate methods; FE disable controls |
| **APIs** | Existing mutate endpoints |
| **DB** | None |
| **Security** | Closes owner mutation bypass |
| **Tests** | Non-owner 403; owner OK; unassigned mutate policy explicit |
| **Depends on** | Slice 3 |
| **Risks** | Over-blocking Follow-up/Finalize if poorly scoped — **exclude** those per PD-FOLLOWUP/FS |

### Slice 5 — History + Audit for ownership
| | |
|--|--|
| **Scope** | Dual History + Audit on Assign (and prepare hooks for Reassign/Requeue); StageAsync transactional |
| **Files** | Workflow + `AuditService` usage; history DTO/UI |
| **APIs** | Assign (+ later reassign/requeue) |
| **DB** | None if reusing audit_log tables |
| **Tests** | Actor ≠ Owner fields; atomic with ownership change |
| **Depends on** | Slice 3 |
| **Risks** | Incomplete reason capture |

### Slice 6 — Reassignment (Supervisor/Admin)
| | |
|--|--|
| **Scope** | PD-REASSIGN-01; resolve **D1** permission; reason required; immediate ACL; History+Audit |
| **Files** | Reassign endpoint; FE supervisory UI |
| **APIs** | **New** Reassign |
| **Permissions** | **D1 resolution required** |
| **Depends on** | Slice 4–5, D1 |
| **Risks** | Using `.update` alone may over-privilege — prefer distinct capability |

### Slice 7 — Concurrency (Version + 409)
| | |
|--|--|
| **Scope** | Add Version; EF token; Assign/mutate/reassign/requeue conflict behavior; FE refresh messaging |
| **Files** | Entity, migration, services, FE |
| **DB** | **Migration** for Version |
| **Depends on** | Slices 3–6 ideally co-designed; can land early after Slice 3 if assign races critical |
| **Risks** | Migration on live UAT; clients omitting version |

### Slice 8 — Requeue clears ownership
| | |
|--|--|
| **Scope** | PD-REQUEUE-01 NULL + History/Audit; who-may-requeue rule |
| **Files** | `ReQueueSession` |
| **Depends on** | Slice 5, 7 |
| **Risks** | Existing owned requeues suddenly unassigned — intended |

### Slice 9 — Finalize / Post-Surgery boundaries
| | |
|--|--|
| **Scope** | PD-FS-01 preserve shared; ensure finalize does not rewrite CounselorId; audit actor clarity; PD-POST-01 explicit assign design **without FollowUps table**; optional OT list PD16 |
| **Depends on** | Slice 3 patterns; D6 design |
| **Risks** | Inventing Post-Surgery owner field incorrectly |

### Slice 10 — Follow-up Center honesty
| | |
|--|--|
| **Scope** | Confirm no CounselorId ACL; relabel “original counselling owner”; actor attribution on contact/reminder/requeue; **no** My Follow-ups filter |
| **Depends on** | Slice 8 for requeue semantics from Center |
| **Risks** | Accidental owner filter |

### Slice 11 — Analytics scope
| | |
|--|--|
| **Scope** | My Work default; Authorized Branch option; do not change PD13/14/15; rethink CreatedBy effective-owner fallback without breaking drill parity |
| **Depends on** | Ownership stamp correctness (Slices 2–3) |
| **Risks** | KPI denominator confusion if fallback removed carelessly |

### Slice 12 — Leave / Reassignment Required surfacing
| | |
|--|--|
| **Scope** | Detect inactive/missing owner; surface ops condition; no auto CounselorId change; wire to Slice 6 |
| **Depends on** | Slice 6 |
| **Risks** | False positives on temporary IAM glitches |

**Recommended order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12  
*(Concurrency Slice 7 may be pulled forward to land with Slice 3 if race risk is unacceptable.)*

---

## 12. Test strategy

### Backend unit / authorization / integration
- Create Admin → CounselorId NULL  
- Assign self / peer / cross-branch deny / cross-tenant deny  
- Client CounselorId tamper on Update denied  
- Non-owner mutate 403; owner OK; supervisor reassign OK  
- Requeue → NULL + History + Audit  
- Concurrent assign one success  
- Stale mutate 409  
- WL PD16 enforcement  
- Analytics formulas unchanged snapshot tests (Phase 2Z)  
- Follow-up population unchanged (Active ≠ PendingDecision)

### Concurrency / History-Audit
- Version conflict  
- Rejected write has no success History  
- Actor ≠ Owner on peer assign  

### Frontend unit
- Assign CTA states  
- Analytics default My Work  
- Controls disabled for non-owner  
- Waiting List filters still exclude counselorId  

### Playwright / Manual UAT
Cover required scenarios **1–26** (see §13).

---

## 13. Manual UAT plan (required scenarios)

| # | Scenario | Pass criteria |
|---|----------|---------------|
| 1 | Admin creates | CounselorId NULL |
| 2 | Amelia sees unassigned | On shared authorized WL |
| 3 | Amelia Assign to myself | Owner = Amelia; Actor = Amelia |
| 4 | Amelia Assign to Ravi | Owner = Ravi; Actor = Amelia |
| 5 | Ravi is owner after peer assign | Ravi can owner-mutate |
| 6 | Amelia actor not owner | Amelia cannot owner-mutate Ravi’s session |
| 7 | Counsellor cannot mutate another’s owned session | 403 / UI disabled |
| 8 | Supervisor/Admin reassigns | Succeeds with reason |
| 9 | Previous owner loses mutate | Immediate |
| 10 | New owner gains mutate | Immediate |
| 11 | Reassignment History + Audit | Both present; Actor ≠ Owner fields |
| 12 | Requeue clears CounselorId | NULL; returns to shared WL |
| 13 | Requeue History + Audit | Previous owner preserved historically |
| 14 | Follow-up branch-shared | Non-original counsellor can act |
| 15 | Finalize does not inherit CounselorId | Finalize OK; CounselorId unchanged |
| 16 | Post-Surgery no auto-inherit | Unassigned / explicit assign only |
| 17 | Analytics My Work | Default for normal counsellor |
| 18 | Analytics Branch | Authorized branch aggregate |
| 19 | Cross-branch assign blocked | Deny |
| 20 | Cross-tenant blocked | Deny |
| 21 | Client CounselorId tamper blocked | Deny |
| 22 | Client branchId tamper blocked | Deny / no grant |
| 23 | Concurrent assign | One winner |
| 24 | Stale mutation | 409 + refresh |
| 25 | Inactive owner | Reassignment Required; no auto transfer |
| 26 | Legacy ownership preserved | No silent backfill of 18 / Admin-owned |

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| Slice 2 before Slice 3 leaves many NULL owners without Assign UX | Ship 2+3 tightly; feature flag if needed |
| Using `.update` for reassignment over-privileges | Resolve D1 before Slice 6 |
| PD16 on WL empties queues for users without UserBranches | Ops checklist; reuse existing branch assignment tooling |
| Version migration impact | Default 0; careful deploy |
| Post-Surgery SoT invents FollowUps table | Forbidden — design D6 first |
| Breaking Phase 2Z formulas | Snapshot tests; no formula edits |
| Formal sign-off still 0 | Document working-decision basis; do not claim SIGNED |

---

## 15. Out-of-scope items (Phase 3I must not do unless separately authorized)

- Named formal hospital signature fabrication  
- Backfill / migrate Downtown 18 or Admin-owned rows by default  
- New FollowUps table  
- Due/SLA/priority invention  
- Schedule Visit / Reminder / Callback redesign  
- New counselling lifecycle state machine (Reassignment Required ≠ lifecycle state)  
- PD13/14/15 formula or drill destination changes  
- Hard-coded new Supervisor role solely for ownership  
- Parallel audit system  
- Duplicate worklists  
- Client-side-only authorization  
- Redesign of certified Waiting List / Finalize / Follow-up UX beyond ownership affordances  

### Must NOT break (certified / preserved)

- Phase 2X lifecycle behavior  
- Phase 2Z analytics definitions  
- Waiting List approved shared UX (add Assign; do not personalize population)  
- Counselling session journey  
- Finalize Surgery approved workflow (shared)  
- Follow-up Center approved populations (Active/Cold shared)  
- Post-Surgery clinical responsibility boundary (PD4)  
- Tenant isolation  
- Existing RBAC catalog (except minimum D1 if proven)  
- Existing History/Audit infrastructure (extend, don’t replace)  
- CCMS / documents / financial / insurance / pre-auth  
- Existing responsive behavior  

---

## 16. Implementation gate

### Phase 3I implementation readiness: **READY FOR IMPLEMENTATION**

| Check | Result |
|-------|--------|
| Phase 3H decisions consolidated for ownership scope | **YES** |
| Current vs target gaps documented | **YES** |
| Security threats mapped | **YES** |
| History/Audit reuse path identified | **YES** |
| Concurrency strategy identified (existing Conflict + new Version) | **YES** |
| Slice plan with dependencies | **YES** |
| Formal named sign-off | **NO** — not blocking per Phase 3H working-decision gate |
| Exact supervisory permission code | **OPEN dependency D1** — resolve during Slice 6 (does not block Slice 1) |
| Post-Surgery persistence SoT | **OPEN dependency D6** — does not block Slice 1 |
| Production code changed by this audit | **NO** |

**Exact blockers for Slice 1:** **None.**

**Slice 1 may begin** (Waiting List server PD16 + related foundation). Do **not** implement Slice 1 in this audit task.

**Blockers before full ownership closure (Slices 6/9):** D1 (supervisory permission), D6 (Post-Surgery assign SoT).

---

## Appendix A — Waiting List checklist vs decisions

| Question | CURRENT | TARGET |
|----------|---------|--------|
| Remains shared? | Yes | Yes |
| Branch auth server-side? | No | Yes |
| CounselorId filters visibility? | No | No |
| CreatedByUserId filters visibility? | No | No |
| Client branchId establishes auth? | Effectively yes if trusted | Never |
| Soft-deleted sessions excluded? | Queue yes; session join weak | Must verify/exclude |
| Unassigned can appear? | Rare (create stamps) | Yes (intentional NULL) |
| Explicit assign? | No | Yes |
| Assign self / peer? | No | Yes |
| Arbitrary client CounselorId? | Yes via Create/Update | No |
| Assign concurrency-safe? | N/A | Required |
| Open/start silent assign? | Yes (start-if-null) | No |

## Appendix B — Key file index

| Area | Path |
|------|------|
| Entity | `microservices/auth-service/AuthService/Models/Domain/CounselingWorkflow.cs` |
| Workflow | `.../Services/CounselingWorkflowService.cs` |
| Controller | `.../Controllers/CounselingController.cs` |
| Follow-up | `.../Services/FollowupListService.cs` |
| Branch | `.../Services/FollowupBranchAccessService.cs` |
| Analytics | `.../Services/CounselingAnalyticsService.cs` |
| OT | `.../Services/OtFinalizeService.cs` |
| Audit | `.../Services/AuditService.cs` |
| Permissions | `.../SeedData/CounselingSessionsPermissionCatalog.cs` |
| WL FE | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/` |
| API FE | `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` |
| Analytics FE | `apps/hospital-portal-web/src/app/dashboard/counselor/analytics/page.tsx` |
| Product SoT | `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` |

---

*End of Phase 3I Implementation Readiness Audit.*  
**NO PRODUCTION CODE CHANGED. STOP — do not implement Slice 1 in this task.**
