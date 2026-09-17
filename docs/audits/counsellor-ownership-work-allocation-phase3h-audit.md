# Phase 3H Counsellor Ownership & Work Allocation Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-09-16 |
| **Phase type** | **DIAGNOSIS ONLY** — no code, DB, permission, or lifecycle changes |
| **Inputs** | Phase 2V–2Z audits; Phase 2W product decisions / workshop / final gate; Phase 2X Slice 1/2; Phase 2Y honesty; Phase 2Z implementation + UAT remediation; Phase 3F/3G session docs; current AuthService + hospital-portal-web counselling code |
| **Rule** | Answers derived from code, contracts, and documented decisions only. Where hospital policy is unsigned → **PRODUCT DECISION REQUIRED**. Do not invent policy. |

---

## A. Executive Summary

**Current production behavior is a hybrid of two incomplete models:**

1. **Shared operational queues** — Waiting List (contract **PD-WL-01**), Follow-up Center lists, and Finalize Surgery OT list are **not** filtered by `CounselorId`. Any user with `counseling_sessions.read` (and branch scope where PD16 is enforced) sees the same work.
2. **Stamped session ownership** — `CounselingSession.CounselorId` is treated in code comments/DTOs as **authoritative owner (PD7 working Option A)** and is **auto-set** on create (to acting user) and on start **only when null**. Ownership is **display + Analytics filter**, not server-side ACL.

**PD7 working workshop rule** (not formally signed): `CounselorId` is the follow-up owner; one owner at a time; assigned counsellor can see/act within authorized scope; supervisor reassigns; respect PD16. **Formal sign-off = 0.** Engineering has partially stamped/projected ownership without implementing claim, reassignment workflow, or owner-scoped authorization.

**Admin creates 18 Downtown sessions → Amelia sees them:** This matches **intentional shared Waiting List** behavior (tenant + optional client branch filter; no `CounselorId` filter). It is **not** proof that those sessions are “Amelia’s.” If Admin created them without sending `counselorId`, `CounselorId` is **Admin’s user id**, not Amelia’s. Amelia can still open/start/work them because **ownership is not enforced**.

**Do not:** filter Waiting List by `CounselorId`, backfill ownership, treat `CreatedByUserId` as owner, or ship Claim/Assign without a signed product decision.

---

## B. Existing Ownership Model

### B.1 Field meanings (verified)

| Field | Meaning from code / contracts | Is ownership? |
|-------|-------------------------------|---------------|
| `CounselingSession.CounselorId` | Nullable Guid; Follow-up DTOs: *“Authoritative owner — CounselingSession.CounselorId (PD7). Null when unassigned.”* (`FollowupListModels.cs`) | **Yes — operational owner field (working PD7 A)** |
| `CreatedByUserId` | Set on create to acting user; audit creator | **No** — not ownership. Analytics/session-list use it **only as effective-owner fallback when `CounselorId` is null** (PD15 drill parity), not as SoT owner |
| `UpdatedByUserId` | Last mutator | **No** |
| `TenantId` | Multi-tenant isolation | Security boundary |
| `BranchId` | Session/queue branch; PD16 lists require authorized set | Scope boundary (where enforced) |
| Logged-in user | JWT user id used for create default, start stamp, audit, callbacks | Actor, not automatic list filter |

### B.2 Documented decisions vs implementation

| Decision | Documented rule | Status | Current implementation | Ambiguity |
|----------|-----------------|--------|------------------------|-----------|
| **PD7 Ownership** | Working **A**: `CounselorId` owner; one owner; supervisor reassign; no new IAM role; respect PD16 | **WORKING — NOT FORMALLY SIGNED** | Stamp on create/start-when-null; project on Follow-up Active/Cold; Analytics `counselorId` filter; **no** owner ACL; **no** claim/reassign API | Who may see/act if not owner? Waiting List vs Follow-up? Admin-as-owner after create? |
| **PD16 Branch** | Working **D**: supervisor-dependent; **server-side** auth = security | WORKING — NOT SIGNED | Enforced on Follow-up, Analytics, session list (post-2Z F-04); **not** on Waiting List or OT finalize list | Waiting List / OT remain weaker than PD16 product rule |
| **PD13 Partition** | Mutually exclusive outcome classifier; Active ≠ PendingDecision | Implemented in 2Z (working; formal unsigned) | Classifier + eligible rates | Do not change in 3H |
| **PD14 Aging** | PendingDecision only; independent period; default 365d | Implemented in 2Z | Aging API + UI | Do not merge with Active |
| **PD15 Drill-down** | Population-safe; PendingDecision → sessions list, **not** Active Center | Implemented in 2Z | Drill URLs + sessions filters; effective-owner fallback | Filter ≠ entitlement |
| **PD-WL-01** | Waiting List stays **shared** (no `CounselorId` / `CreatedByUserId` filter properties) | Contract test locked | `WaitingListSharedQueueContractTests` + FE shared-queue test | Conflicts with naïve “personal queue” reading of PD7 unless product clarifies WL vs Follow-up |

**Cross-decision note (Phase 2W workshop check 9):** *CounselorId/ownership is not equivalent to authorization; existing permissions remain authoritative.* Current code matches that separation: permissions gate modules; ownership does not.

---

## C. Waiting List Population

### C.1 API

| Item | Evidence |
|------|----------|
| Endpoint | `GET /api/Counseling/waiting-list` — `CounselingController.GetWaitingList` |
| Permission | `counseling_sessions.read` |
| Source | `counselor_queue` ⋈ `counseling_sessions` ⋈ `patients` |

**Filters applied:**

| Filter | Applied? |
|--------|----------|
| Tenant (`q.TenantId`) | **Yes** (JWT) |
| Soft-delete (`q.DeletedAt == null`) | **Yes** (queue) |
| Optional date (`AddedToQueueAt`) | **Yes** when provided |
| Optional `BranchId` | **Yes** — **client-supplied only**; **no** `FollowupBranchAccessService` |
| Status / name / MRD / type | In-memory after query |
| `CounselorId` | **No** |
| `CreatedByUserId` | **No** |
| Session soft-delete | **Not** filtered on session join |
| PD16 authorized branches | **No** |

**Population type:** **B / hybrid — branch-optional shared tenant queue.** Omitting `branchId` returns **all tenant** queue rows. FE typically sends `selectedBranchId ?? user.branchId` (convenience, not server auth).

**API does not support:** assigned-only, unassigned-only, assigned-to-me, claim, reassign. Contract deliberately excludes `CounselorId` / `CreatedByUserId` filter properties (**PD-WL-01**).

### C.2 Frontend

- No owner column; no claim/assign; row open starts Azure session best-effort then navigates.
- Add Patient does **not** send `counselorId` → server defaults owner to **creator**.

### C.3 Admin → Amelia scenario (18 Downtown patients)

| Observation | Classification |
|-------------|----------------|
| Amelia sees the 18 | **Intentional shared Waiting List** (PD-WL-01 + current query) |
| Are they “Amelia’s”? | **No** — unless `CounselorId` equals Amelia (unlikely if Admin created them) |
| Documented product decision for personal vs shared WL? | **PRODUCT DECISION REQUIRED** (PD7 does not redefine Waiting List; PD-WL-01 locks shared filter contract) |
| Unfinished ownership model? | **Yes** — ownership stamped/displayed elsewhere but not used as WL scope or ACL |

**Do not remove, backfill, or auto-assign those 18.**

---

## D. Session Ownership

### D.1 Create — `CreateSessionAsync`

```
CounselorId = request.CounselorId ?? currentUserId
CreatedByUserId = currentUserId
```

| Question | Answer |
|----------|--------|
| Auto-assigned? | **Yes**, to acting user when request omits `CounselorId` |
| Admin creates? | `CounselorId` = **Admin** (same path; no role-specific logic) |
| Counsellor Amelia creates? | `CounselorId` = **Amelia** |
| Null on insert? | **Not in practice** for new creates (coalesce). Column remains nullable for legacy |
| Client override? | **Yes** — request may set any Guid; **no** check that it is a counsellor or authorized assignee |
| Later change? | `UpdateSessionAsync`: `if (request.CounselorId.HasValue) session.CounselorId = …` — **no supervisor gate** |
| Claim API? | **None** |
| Reassign API? | **None** (generic update only) |
| Ownership-change audit? | Generic field-change audit may record changes; **no** dedicated ownership audit event |

Files: `CounselingWorkflowService.CreateSessionAsync` (~754–796); `UpdateSessionAsync` (~926); `CounselingController.CreateSession`.

### D.2 Start — `StartSessionAsync`

| Question | Answer |
|----------|--------|
| Assign when null? | **Yes** — stamps `CounselorId = currentUserId` only if unset |
| If already owned by Admin/A? | **Does not overwrite**; start still proceeds |
| Another counsellor start? | **Allowed** if they have `counseling_sessions.update` + same tenant |
| Status precondition? | **None** (can re-enter InProgress paths via queue rules) |
| Server ownership authz? | **None** |
| UI filtering? | Cosmetic / navigation only — **not** security |

**Gap:** `StartSessionFromQueueAsync` sets session `InProgress` but **does not** stamp `CounselorId`.

### D.3 Complete / update / get-by-id

- `CompleteSessionAsync` / updates: tenant + soft-delete + permission; **no** owner match.
- `GetSessionById`: tenant + id; **no** branch PD16; **no** owner check → within-tenant IDOR for holders of read.

---

## E. Session Start / Claim / Assignment

| Concept | In counselling codebase? |
|---------|--------------------------|
| Claim | **No** |
| Assign / reassign dedicated API | **No** |
| Owner stamp | Create default; start-if-null; open Update |
| Queue “Call Next” | Changes queue status to Called; **does not** set `CounselorId` |
| Callback `AssignedToUserId` | Separate callback entity defaults assignee to creator — **not** session ownership |

**Related platform patterns (report only — do not copy automatically):**

| Pattern | Module | Relevance |
|---------|--------|-----------|
| `assignedToMe` | Patient Hub lookup | Personal filter on patient search — not counselling queue |
| Doctor / Optometry `CallNext` | Doctor/Optometry queues | Room/staff call-next; different domain |
| SupervisorAssignment / TrainingAssignment / bed AssignedTo | Various | Different SoTs |
| Callback `AssignedToUserId` | Counsellor communications | Closest “assignee” field; not wired to Waiting List/Center ownership |

---

## F. Finalize Surgery Ownership

| Question | Answer |
|----------|--------|
| Filter by `CounselorId`? | **No** (`OtFinalizeService.GetFinalizeListAsync`) |
| Filter by branch (PD16)? | **No** on list |
| Filter by tenant? | **Yes** |
| Shows all counselling OT rows in tenant (plus date/name/status filters)? | **Yes** |
| Another counsellor finalize Amelia’s? | **Yes**, if they have `counseling_sessions.update` |
| Ownership enforced? | **No** — audit fields only |
| Queue type | **Operational shared queue**, not personal |

FE: filters date / uhid / name only; mutate gated by `counseling_sessions.update`.

---

## G. Follow-up Center Ownership

| Tab | Population | `CounselorId` affects population? | Owner on DTO/UI | Act on others? |
|-----|------------|-----------------------------------|-----------------|----------------|
| Active | Intention allowlist + tenant + authorized branches | **No** | Yes (DTO + inline “Owner”) | **Yes** if `.update` |
| Cold | Declined / ReferredElsewhere + branches | **No** | Yes | **Yes** |
| Post-Surgery | Discharged `patient_journey` | N/A (no session owner on row; SessionId honesty G13) | **No** | Limited (no opportunistic session) |

| Question | Answer |
|----------|--------|
| Branch-scoped? | **Yes** via `FollowupBranchAccessService` (PD16) |
| Tenant-scoped? | **Yes** |
| `counselorId` API filter on Center lists? | **No** |
| Counselor filter UI? | **No** |
| Contact / Reminder / Requeue ownership check? | **No** |
| Requeue changes `CounselorId`? | **No** — updates intention/notes/queue; sets `UpdatedByUserId` only |
| Claim/reassign? | **No** |

**Preserve:** Active Follow-up intention population ≠ PendingDecision Analytics aging (PD13/14/15). Do not merge.

**PD7 working vs current:** Working rule says assigned counsellor sees/acts; Center still shows **all** authorized-branch rows and allows any updater to act. Slice 1 only **projects** owner; it does **not** restrict population (`Ownership_DoesNotChangeActiveMembership` test).

---

## H. Analytics Counselor Scope

| Item | Current behavior |
|------|------------------|
| Default scope | **All counsellors** in authorized branches (`counselorId` omitted) |
| `counselorId` filter | Optional; UI picker (“All counselors” + list from `GET /Counseling/counselors` after 2Z F-01 remediation) |
| Effective owner when filtering | `CounselorId == id OR (CounselorId null AND CreatedByUserId == id)` |
| Filter = entitlement? | **No** — any reader can pass another counsellor’s Guid |
| Branch | PD16 via `FollowupBranchAccessService`; unauthorized → 403 |
| “All Counsellors” valid? | **Yes** as authorized-branch aggregate under current permissions |
| Normal counsellor | Sees **branch-authorized aggregate** by default (not “mine”) |
| Supervisor / multi-branch | Same permission model; broader `UserBranches` → broader aggregate |
| KPI vs operational queues | Analytics partitions ≠ Waiting List / Active Center (by design) |
| Expose another counsellor’s patients? | **Yes** via All or by selecting their id (PHI within counselling read permission) |

Do **not** modify PD13/14/15 formulas in this phase.

---

## I. Branch / Tenant Security

| Surface | Tenant | Branch (PD16) | Counsellor ownership ACL |
|---------|--------|---------------|--------------------------|
| Waiting List | Yes | **Weak** (optional client filter) | None |
| Session get/update/start/complete | Yes | Weak / none on mutate | None |
| Session list / Analytics / Follow-up | Yes | **Enforced** | Filter only (Analytics/sessions), not ACL |
| OT finalize | Yes | None on list | None |
| Create session | Yes | Effective branch + patient branch checks | Client may set any `CounselorId` |

**Authorization boundary today:** `counseling_sessions.*` + tenant (+ PD16 where wired). **Not** “must be session owner.”

Client-passable: `branchId`, `counselorId`, `sessionId`, `patientId` — risks are **within-tenant / cross-counsellor / optional cross-branch** where PD16 is absent, not cross-tenant (tenant from JWT).

---

## J. Concurrency

| Risk | Control today |
|------|----------------|
| Two counsellors open same session | Allowed |
| Two start same session | Allowed; last write wins; no owner lock |
| Concurrent update/complete | No row version on `CounselingSession` |
| Concurrent requeue / contact | Permission only |
| OT finalize | Soft `IsLocked` + app `Version++`; not EF concurrency token |

**Gap:** No claim lock, optimistic concurrency, or “already InProgress by another user” rejection. **PRODUCT DECISION REQUIRED** if shared desk must prevent double work.

---

## K. Admin → Counsellor Workflow

| Scenario | Current behavior | Documented expected | Gap | Product decision? |
|----------|------------------|---------------------|-----|-------------------|
| **1** Admin creates → Amelia works | Shared WL shows row; `CounselorId`=Admin; Amelia can start/update without reassignment | PD7: owner should see/act; supervisor reassign — unsigned | Owner ≠ worker; no claim | **Yes** |
| **2** Admin creates → other counsellor works | Same as 1 for any counsellor with access | Same | Same | **Yes** |
| **3** Amelia owns → takeover | Other counsellor can mutate; `CounselorId` stays Amelia unless Update | PD7: supervisor reassign | No reassign UX/API; silent takeover | **Yes** |
| **4** Counselling done → finalize | Shared OT list; any updater | Unsigned who owns finalize | No ownership link | **Yes** |
| **5** Surgery done → post-surgery | Discharged journeys; no counsellor owner | PD4 unsigned | Responsibility/completion undefined | **Yes** (PD4) |
| **6** Requeue | New queue Waiting item; `CounselorId` unchanged | Unsigned | Shared WL again | **Yes** |
| **7** Counsellor leaves | Sessions retain stale `CounselorId`; still visible/actionable by others | Unsigned | No reassignment/unassign SOP | **Yes** |

---

## L. New Counsellor Workflow

| Setup | Inherited automatically? | Requires explicit setup? |
|-------|--------------------------|--------------------------|
| Role Counsellor/Counselor | When assigned | Role assignment |
| `counseling_sessions.*` | Linked by seeder to Counsellor roles | Role must exist + seeder/migration applied |
| `patient.view` / `patient.create` | Workflow seeder | Same |
| `package_templates.read` | Workflow seeder | Same |
| Least-privilege strip of IP/Ward grants | Seeder when run | Ops must run seed path |
| Branch (`User.BranchId` / `UserBranches`) | **Not** automatic from role | **Explicit branch assignment required** for PD16 lists to return data |
| Waiting List visibility | If `.read` + FE sends branch that has queue rows | Empty if no branch / wrong branch / no queue |
| Ownership behavior | Same as existing: create stamps self; lists shared | Same gaps |
| Follow-up / Analytics | Same permission + PD16 | Branch assignments drive scope |

**Consistent for new and existing** only if: role permissions seeded **and** branch assigned. Do not auto-create branch assignments (out of scope / forbidden for this audit phase).

---

## M. Existing Data Quality

**Safe live UAT/production aggregate counts were not run in this audit** (no verified safe read-only DB connection / approved audit tooling in this session environment).

**Patterns expected from code paths (not counted):**

| Pattern | Likely source |
|---------|----------------|
| `CounselorId` populated | All creates since PD7 stamp; start-if-null |
| `CounselorId` = Admin/creator ≠ working counsellor | Admin/front-desk Add Patient |
| `CounselorId` null | Legacy pre-stamp rows; any path that never set it; StartSessionFromQueue without stamp |
| `CounselorId` ≠ `CreatedByUserId` | Explicit request override; update reassignment; start after null with different later updater (create always aligned initially) |
| Analytics “effective owner” fallback | Null `CounselorId` + filter by `CreatedByUserId` |

**Do not backfill. Do not infer ownership from `CreatedByUserId` for operational SoT.**

If a later read-only SQL audit is approved, recommend counts by: null vs set; equal/unequal CreatedBy; branch; status; last 30/90 days — without mutating data.

---

## N. Current Gaps

1. **PD7 unsigned** while partial stamping/projection shipped.  
2. **Waiting List shared by contract** vs ownership field implying personal work — unexplained in UX.  
3. **Admin create stamps Admin as owner** while queue is shared → misleading ownership.  
4. **No claim / supervised reassign** despite PD7 working text.  
5. **UpdateSession open `CounselorId` write** without supervisor permission.  
6. **No ownership ACL** on start/complete/follow-up/OT.  
7. **Waiting List / OT lack PD16** enforcement present on Follow-up/Analytics.  
8. **StartSessionFromQueueAsync** skips ownership stamp.  
9. **No concurrency / double-work protection.**  
10. **Finalize / Post-Surgery** have no counsellor ownership model.  
11. **Analytics defaults to All** while ops queues are shared — “mine” nowhere except optional Analytics filter.  
12. **UX:** Waiting List / Finalize show no owner; Follow-up shows owner but allows acting on others; no handoff affordance.

---

## O. Product Decisions Required

Answer the Phase 3H core questions only with **current behavior** + **decision status**:

| # | Question | Current behavior (code) | Product status |
|---|----------|-------------------------|----------------|
| 1 | See every branch/shared queue patient? | **Yes** on Waiting List (shared); Follow-up/Analytics within PD16 | **PRODUCT DECISION REQUIRED** whether this remains policy |
| 2 | See only assigned? | **No** (lists not owner-filtered) | **PRODUCT DECISION REQUIRED** (PD7 working A implies personal act scope but lists contradict) |
| 3 | Unassigned shared until claimed? | **No claim**; create usually **assigns creator**, not null | **PRODUCT DECISION REQUIRED** (PD7 D vs A vs hybrid) |
| 4 | Claim? | **Not implemented** | **PRODUCT DECISION REQUIRED** |
| 5 | Reassign? | Informal via Update; PD7 wants supervisor | **PRODUCT DECISION REQUIRED** |
| 6 | Auto-assign on start? | **Only if null** | Confirm or change — **PRODUCT DECISION REQUIRED** for Admin-owned rows |
| 7 | Admin creates? | Owner=Admin; queue shared | **PRODUCT DECISION REQUIRED** (assign on create? unassigned? claim?) |
| 8 | A creates, B continues? | B can work; owner unchanged | **PRODUCT DECISION REQUIRED** (handoff rules) |
| 9 | After counselling completed? | Status/queue mapping; owner persists | **PRODUCT DECISION REQUIRED** (clear? keep? transfer to OT?) |
| 10 | Who owns finalize? | Shared OT; no CounselorId | **PRODUCT DECISION REQUIRED** |
| 11 | Who owns post-surgery FU? | Shared discharged list; PD4 open | **PRODUCT DECISION REQUIRED** (PD4) |
| 12 | Analytics default me vs all? | **All** authorized; filter optional | **PRODUCT DECISION REQUIRED** (align with PD7/PD16) |

**Still authoritative as working-but-unsigned workshop captures (do not silently reinterpret):** PD7 A, PD13 A, PD14 separate aging, PD15 population-safe drills, PD16 D server-side branch, PD-WL-01 shared Waiting List filter contract, Active ≠ PendingDecision.

---

## P. Possible Operational Models

**Do not rank.** Implications only.

### MODEL A — PERSONAL QUEUE

| | |
|--|--|
| **Behavior** | Counsellor sees only `CounselorId = self` (plus maybe supervisor “all”) |
| **Advantages** | Clear workload; matches PD7 A “assigned can see/act” literally |
| **Risks** | Breaks PD-WL-01 shared queue; Admin-created rows invisible to counsellors unless reassigned; orphan Admin-owned backlog |
| **Affected** | Waiting List, Follow-up, possibly Finalize, Analytics default |
| **Backend** | Owner filters; deny cross-owner mutate; reassign API; create policy for Admin |
| **Frontend** | Mine filter default; hide others; reassign UI |
| **Authz** | Ownership ACL **in addition to** permissions + PD16 |
| **Migration** | Likely reassignment of Admin-owned / null rows — **PRODUCT DECISION** before any backfill |

### MODEL B — SHARED QUEUE + CLAIM

| | |
|--|--|
| **Behavior** | All authorized see unassigned/shared; claim sets `CounselorId`; then owned |
| **Advantages** | Fits current Waiting List sharing; explicit ownership moment |
| **Risks** | Need unassigned state (today create stamps creator); claim races; UX for Admin-stamped rows |
| **Affected** | Waiting List, session start, Follow-up |
| **Backend** | Claim endpoint + concurrency; possibly null/clear owner on Admin create |
| **Frontend** | Claim CTA; owner badge; mine vs unclaimed filters |
| **Authz** | Claim permission; prevent double claim |
| **Migration** | Policy for existing Admin-owned rows (clear vs claim-required) |

### MODEL C — SHARED QUEUE + ASSIGNMENT

| | |
|--|--|
| **Behavior** | Supervisor/Admin assigns; counsellors work assigned; unassigned visible to authorized |
| **Advantages** | Matches PD7 “supervisor reassign”; Admin create can assign Amelia |
| **Risks** | Bottleneck on assigner; still need unassigned handling |
| **Affected** | Create/Add Patient, Admin tools, Waiting List, Follow-up |
| **Backend** | Assign/reassign API with supervisor check; list filters |
| **Frontend** | Assign picker; unassigned queue |
| **Authz** | Distinct assign permission or existing admin role mapping — **do not invent without IAM** |
| **Migration** | Bulk assign tooling if required later |

### MODEL D — HYBRID

| | |
|--|--|
| **Behavior** | Waiting List: shared branch queue; Active counselling workspace: claimed/assigned; Supervisor: all authorized |
| **Advantages** | Preserves PD-WL-01 + PD7 owner for deep work; closest to **current accidental hybrid** if formalized |
| **Risks** | Dual semantics must be taught; Finalize/Follow-up/Analytics scope must be specified per surface |
| **Affected** | All counsellor surfaces with **different** rules per surface |
| **Backend** | Per-endpoint scope matrix; claim optional on start |
| **Frontend** | Owner display on WL; claim on open; supervisor toggle |
| **Authz** | Read shared vs mutate owned (or mutate shared until claim) — must be explicit |
| **Migration** | Minimal if claim-on-first-open adopted for Admin-owned |

**Existing pieces supporting each:**

| Piece | A | B | C | D |
|-------|---|---|---|---|
| Shared Waiting List query | Blocks | Supports | Supports | Supports |
| `CounselorId` stamp create/start | Partial | Partial (start-if-null) | Supports assign field | Supports |
| Follow-up owner projection | Supports display | Supports | Supports | Supports |
| Analytics counselor filter | Supports “mine” view | Supports | Supports | Supports |
| Claim/reassign API | Missing | Missing | Missing | Missing |
| Owner ACL | Missing | Missing | Missing | Missing |
| PD7 working A text | Aligns intent | Partial | Aligns reassign | Hybrid needs E-style clarity |

---

## Q. Recommended Implementation Sequence

**PRODUCT DECISION REQUIRED.**

Formal Phase 2W sign-off for **PD7** (and clarifying Waiting List vs Follow-up vs Finalize vs Analytics scope) is still **not complete**. Phase 2X Slice 1 only projected ownership; it did **not** authorize owner-scoped queues or claim.

Until stakeholders sign:

1. What each surface’s population rule is (shared vs mine vs unassigned+claim vs assigned).  
2. What Admin create must do to `CounselorId`.  
3. Claim vs supervisor assign vs hybrid.  
4. Whether mutate requires owner match.  
5. Finalize + Post-Surgery ownership.  
6. Analytics default (All vs Me).  

…**no production implementation sequence is authorized** beyond continuing diagnosis / decision workshops.

**Interim engineering (only if separately approved; not in 3H):** honesty UX (show owner on Waiting List; label shared queue) without changing filters — still needs product approval if it implies policy.

---

## Answers snapshot (diagnosis, not policy)

### What is already authoritative (working / locked from code — not all formally signed)

- `CounselorId` is the named owner field (PD7 working A; Follow-up DTO comments).  
- `CreatedByUserId` is audit (+ Analytics null-owner fallback only).  
- Waiting List is a **shared** queue by **PD-WL-01**.  
- Active ≠ PendingDecision aging.  
- PD13/14/15 implemented shapes (formal unsigned).  
- Permissions `counseling_sessions.read/update/create` gate modules.  
- PD16 server branch auth on Follow-up / Analytics / session list.

### What is already implemented

- Create default + start-if-null ownership stamp.  
- Follow-up Active/Cold owner projection.  
- Analytics optional counselor filter (default All).  
- Shared Waiting List / Follow-up / Finalize populations.

### What is inconsistent

- Owner stamped but lists/actions ignore owner.  
- Admin-as-owner vs counsellor-as-worker.  
- PD16 on some endpoints, not Waiting List / OT.  
- PD7 “supervisor reassign” vs open Update.  
- StartSession vs StartSessionFromQueue stamp gap.

### What is missing

- Formal PD7 sign-off; claim/reassign; owner ACL; concurrency; Finalize/Post-Surgery ownership; WL owner UX; data quality audit counts.

### What requires explicit product decision

- All twelve core business questions in §O; Models A–D selection; Admin create policy; counsellor leave/handoff; Analytics default.

---

## STOP

**Phase 3H complete as diagnosis only.**

No production changes. No migration. No seed changes. No permission changes. No Waiting List scope change. No `CounselorId` backfill. No Claim/Assign implementation. No PD13/14/15 changes. No UAT or certification claim.

1. Authoritative: shared Waiting List contract + CounselorId as owner **field** + permission/tenant/(partial) branch security.  
2. Implemented: stamp + project + Analytics filter; shared ops queues.  
3. Inconsistent: ownership vs shared action surfaces; Admin create; PD16 coverage.  
4. Missing: signed policy, claim/reassign, ACL, concurrency, finalize/FU ownership.  
5. **PRODUCT DECISION REQUIRED** before any ownership/work-allocation implementation.
