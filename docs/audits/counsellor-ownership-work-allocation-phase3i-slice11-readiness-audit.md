# Phase 3I Slice 11 — Analytics / My Work  
# READINESS AUDIT + PRODUCT DECISION GATE

**Date:** 2026-09-21  
**Mode:** AUDIT ONLY — no code, schema, permission, ownership, API, or UI changes  
**Slice 11 status:** NOT started  
**Slice 12 status:** NOT started  
**Prior certified gate:** Slice 10 Accepted (Follow-up honesty; 12/12 UAT; supporting checks passed)

**Do not implement Slice 11 from this document.**  
**Do not start Slice 12.**  
**Wait for explicit product decisions before implementation.**

---

## 1. Executive Summary

Slice 11 targets **Counsellor Analytics scope** (“My Work” vs “Authorized Branch”), **not** a new operational worklist.

**Current production:**

| Surface | Behavior today |
|---------|----------------|
| Analytics UI | Defaults to **All counselors** (`counselorId = null`) |
| Analytics APIs | Optional `counselorId`; when set, uses **effective owner** = `CounselorId == id` **OR** (`CounselorId == null` **AND** `CreatedByUserId == id`) |
| Ownership SoT | `CounselingSession.CounselorId` (explicit Assign / claim / create-self / Reassign; ReQueue → NULL) |
| Waiting List / Follow-up / Finalize / Post-Surgery | **Shared** branch queues — no My Work / My Follow-ups filters |
| Permissions | Analytics gated by `counseling_sessions.read` only (no dedicated analytics permission) |

**Phase 3H working product rule PD-ANALYTICS-01** already states: Analytics supports **My Work** + **Authorized Branch**; normal counsellors default to My Work; filter ≠ entitlement; same Phase 2Z formulas. Status: **WORKING — AGREED FOR IMPLEMENTATION / NOT FORMALLY SIGNED**.

**Blocking unresolved gap:** Analytics/session-list still treat `CreatedByUserId` as effective-owner fallback when `CounselorId` is null — this **conflicts** with Phase 3H field rule (`CreatedByUserId` ≠ ownership) and with Slices 2–8 ownership honesty. Slice 11 scope in the Phase 3I readiness audit explicitly requires **rethinking this fallback without breaking PD15 drill parity**.

**Verdict:** **READY FOR PRODUCT DECISION** — architecture, APIs, permissions, and ownership stamps are sufficiently mapped; remaining items are product/sign-off choices (especially CreatedBy fallback and formal PD-ANALYTICS-01 confirmation), not missing discovery or missing tables.

---

## 2. Current Analytics Architecture

### 2.1 Classification

| Tag | Applies? | Evidence |
|-----|----------|----------|
| **session-centric** | **Primary** | Metrics from `counseling_sessions` (+ callbacks via session join) |
| **branch-centric** | **Yes** | PD16 authorized branch set via `FollowupBranchAccessService` |
| **historical / reporting** | **Yes** | Read-only KPIs; date-windowed by `SessionDate` |
| **operational** | **Partial** | Drill to sessions list / Follow-up Center path |
| **counsellor-centric** | **Partial** | Optional counselor filter; **no My Work default** yet |
| **queue-centric** | **No** | Does not use Waiting List / `counselor_queue` as SoT |
| **patient-centric** | **Weak** | Aging shows patient name; population is sessions |

Analytics is **not** a work-allocation board, productivity HR module, or personal operational queue.

### 2.2 Routes

| Route | File | Role |
|-------|------|------|
| `/dashboard/counselor/analytics` | `apps/hospital-portal-web/src/app/dashboard/counselor/analytics/page.tsx` | Canonical Analytics page |
| `/dashboard/counsellors-desk/sessions` | `…/counsellors-desk/sessions/page.tsx` | PD15 KPI → sessions drill-down |
| `/dashboard/counsellors-desk/[id]?from=analytics` | session detail | Open from aging/sessions with origin return |
| `/dashboard/counsellors-desk/surgery-followup` | Follow-up Center | Aging may link here **unscoped** — not PendingDecision SoT |

Sidebar: Counsellor → **Analytics** → `counseling_sessions.read` (`sidebar-menu-sections.tsx`).

**Not counsellor Analytics:** `/dashboard/ccms/analytics`, `/dashboard/analytics`, Role/Department analytics.

### 2.3 Frontend components

| Path | Purpose |
|------|---------|
| `components/counselor/CounselorAnalyticsTab.tsx` | Filters, KPIs, funnel, mixes, trends, aging, CSV/print |
| `components/counselor/ConversionFunnelChart.tsx` | Decision funnel |
| `components/counselor/FollowupAgingTable.tsx` | PendingDecision aging buckets |
| `components/counselor/AnalyticsPrintReport.tsx` | Print layout |
| `hooks/use-counselor-analytics.ts` | TanStack Query + params/types |
| `lib/counsellors-desk/analytics-drilldown.ts` | PD15 URL builders |
| `lib/counsellors-desk/analytics-funnel-pct.ts` | Funnel % helpers |
| `lib/counsellors-desk/counselor-analytics-export.ts` | CSV builder |

**Default today:** `useState<string | null>(null)` → label **“All counselors”** (`CounselorAnalyticsTab.tsx`).

### 2.4 Backend

| Piece | Path |
|-------|------|
| Controller | `microservices/auth-service/AuthService/Controllers/CounselingController.cs` |
| Service | `…/Services/CounselingAnalyticsService.cs` |
| Classifier (PD13) | `CounselingAnalyticsOutcomeClassifier.cs` |
| Date window | `CounselingAnalyticsDateWindow.cs` |
| DTOs | `Models/Counselor/CounselingAnalyticsModels.cs` |
| Indexes | `consolidated/migrations/188_counseling_followup_analytics_indexes.sql` |
| FE contract | `apps/hospital-portal-web/docs/counseling-analytics-phase2d-api-contract.md` |

### 2.5 Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/Counseling/analytics/summary` | `counseling_sessions.read` |
| GET | `/api/Counseling/analytics/trends` | `counseling_sessions.read` |
| GET | `/api/Counseling/analytics/followup-aging` | `counseling_sessions.read` |
| GET | `/api/Counseling/counselors` | `counseling_sessions.read` (picker) |

Query params: `branchId?`, `counselorId?`, `period`, `from?`, `to?`.

### 2.6 Filters today

| Filter | Present? | Behavior |
|--------|----------|----------|
| CounselorId | Yes | Optional; FE default **null** = all counselors in authorized branches |
| Branch | Yes | FE: auth store branch; API: PD16 authorize / 403 |
| Tenant | Implicit | Server `GetTenantId()` — no client tenant picker |
| Date (summary/trends) | Period presets | UI 7/14/30 (default 30); API also custom from/to |
| Aging period | Independent | UI 30/90/180/365 (default **365**) |
| My Work / My Follow-ups / Assigned-to-me | **Absent** on Analytics | “Assigned to me” exists only on **Patient Hub** (unrelated) |

### 2.7 Metrics (Phase 2Z / PD13–15 — do not redesign)

| Metric | Definition | Source |
|--------|------------|--------|
| Total / Agreed / Declined / Pending / Exception / Other | Mutually exclusive partitions | `counseling_sessions` flags + intention |
| Eligible / Conversion % / Decision % | Derived from partitions | same |
| Avg days to decision | mean `(DecisionDate − SessionDate)` | session fields |
| By surgery / session type | Grouped counts | `RecommendedSurgery`, `SessionType` |
| Callback completion % | Completed / total in window | `counselor_callback_requests` |
| Trends | Daily session + agreed counts | `SessionDate` |
| Aging | **PendingDecision only** (≠ Follow-up Active) | session + patient name |

### 2.8 Tests inspected (read-only)

**Backend:** `CounselingAnalyticsServiceTests.cs`, `Phase2ZAnalyticsPartitionTests.cs`, `CounselingAnalyticsDateWindowTests.cs`, `Phase2ZAgingPostgresSafeTests.cs`  

**Frontend:** `counselor-analytics-filter.test.ts`, `counselor-analytics-export.test.ts`, `analytics-drilldown.test.ts`, `analytics-funnel-pct.test.ts`, `analytics-period-presets.test.ts`, `AnalyticsPrintReport.test.tsx`, counsellor RBAC/sidebar nav tests  

**Absent:** any assertion that Analytics defaults to My Work / current user, or that CreatedBy fallback is removed.

---

## 3. Current Counselling Ownership Model

Approved hybrid model (Phase 3H / Slices 1–10) — **do not reinterpret:**

| Rule | Status |
|------|--------|
| Operational queues remain **shared** (Waiting List, Follow-up Center, Finalize, Post-Surgery lists) | Implemented / preserved |
| Active counselling work has explicit `CounselorId` ownership | Implemented |
| Opening/viewing does **not** establish ownership | Implemented |
| Ownership via explicit Assign / claim-for-lifecycle / counsellor create-self | Implemented |
| Waiting List shared within server-authorized branch scope (PD16) | Implemented |
| Follow-up Center shared; **no My Follow-ups**; Original Counsellor = historical attribution (Slice 10) | Implemented / Accepted |
| ReQueue clears `CounselorId` → NULL | Implemented (Slice 8) |
| Completed sessions may retain historical `CounselorId` | Implemented (Complete does not clear owner) |
| Owner-level mutation server-authorized (`DenyUnlessSessionOwner`) | Implemented (Slice 4+) |
| `Version` = optimistic concurrency SoT | Implemented (Slice 7) |

**Authoritative ownership stamp:** `CounselingSession.CounselorId`  
**Not ownership:** `CreatedByUserId`, queue membership, Follow-up intention, opening a row, Patient Hub “Assigned to me”.

---

## 4. CounselingSession Audit

**Entity:** `microservices/auth-service/AuthService/Models/Domain/CounselingWorkflow.cs`  
**Mutations:** `CounselingWorkflowService.cs`

| Field | Authoritative for | Notes |
|-------|-------------------|-------|
| **CounselorId** | Ownership SoT | Nullable UUID; ACL for Start/Update/Complete |
| **Version** | Concurrency SoT | Required on ownership + content writes |
| **Status** | Session lifecycle | Used: `Scheduled`, `InProgress`, `Completed`, `Cancelled` (+ `NoShow` terminal helpers). **No** session status `Waiting` / `Pending` / `ReQueued` |
| **SessionType** | Classification | `Initial` \| `Followup` \| `Recheck` \| `Urgent` |
| **PatientIntention** | Follow-up Center membership | Intention allowlists — not ownership |
| **PendingDecision** | Analytics aging population | Distinct from Follow-up Active |
| **BranchId / TenantId** | Scope | PD16 lists/analytics |
| **SessionDate** | Analytics date window | Primary reporting date axis |
| **CreatedAt / UpdatedAt** | Audit timestamps | |
| **CreatedByUserId** | Creator audit only | **Still used as Analytics/list fallback when owner null** |
| **DeletedAt** | Soft-delete | Filtered on live queries |
| **CompletedAt** | **Does not exist** | Completion → `Status=Completed` + `SessionEndTime` |
| **SessionStartTime / SessionEndTime** | Timing | Start / Complete |

**CounselorId mutation effects (evidence):**

| Action | CounselorId |
|--------|-------------|
| Create (counsellor) | Self-own |
| Create (Admin/non-counsellor) | NULL |
| Assign | NULL → target |
| Claim (lifecycle) | → actor |
| Reassign | expected → target |
| ReQueue | → NULL |
| Start / Complete / content Update | Unchanged (owner ACL) |

---

## 5. CounselorQueueItem Audit

**Table:** `counselor_queue`  
**Entity:** same `CounselingWorkflow.cs`

| Finding | Evidence |
|---------|----------|
| **No `CounselorId` column** on queue row | Ownership joined from session in DTOs |
| Queue Status | `Waiting`, `Called`, `InProgress`, `Completed`, `Cancelled`, `NoShow`, `AddOnSurgery` |
| Role | **Operational queue SoT** (desk board / wait state) |
| Ownership role | **None** — not a projection of ownership |
| Unique active session | `ux_counselor_queue_session_id_active` WHERE `deleted_at IS NULL` |
| Waiting List | Joins queue + session; maps `Waiting`→FE `Pending`, etc.; **no CounselorId visibility filter** |

**Do not equate queue membership with ownership.**  
**Do not propose a second queue for My Work.**

---

## 6. Follow-up Center Boundary

Post–Slice 10 (Accepted):

| Claim | Confirmed? | Evidence |
|-------|------------|----------|
| Shared branch operational queue | Yes | `FollowupListService` + PD16; no `counselorId` query param |
| No My Follow-ups | Yes | FE tests assert absence |
| Label = Original Counsellor | Yes | `formatOriginalCounsellorAttribution` |
| `CounselorId` ≠ Center ACL | Yes | List not owner-filtered; contact/ReQueue paths no `DenyUnlessSessionOwner` |
| Post-Surgery has no counsellor owner | Yes | Separate `patient_journey` projection |

**Docs:**  
`phase3i-slice10-implementation-report.md`, `phase3i-slice10-readiness-audit.md`, `phase3h-product-decisions.md` (**PD-FOLLOWUP-01**).

**Slice 11 must not turn Follow-up Center into My Work.**

---

## 7. Ownership History / Audit Boundary

**Table / trail:** `counseling_session_audit_log` via `StageOwnershipTrailAsync` + platform `IAuditService`.

| ChangeType | Meaning |
|------------|---------|
| `OwnershipEstablishedOnCreate` | null → actor on counsellor create |
| `OwnershipAssigned` | null → target |
| `OwnershipClaimed` | lifecycle claim |
| `OwnershipReassigned` | A → B supervisory |
| `OwnershipRequeued` | previous → null (**only if previously owned**) |

**API:** `GET …/sessions/{id}/history` (last 50) — per-session timeline.

| Use for Slice 11 | Viable? |
|------------------|---------|
| Supplement / timeline / event counts | **Yes** — without changing event semantics |
| Denominator for My Work KPIs | **No as drop-in** — would be a **different formula** than current stamp filter; needs explicit product decision |

Already-unassigned ReQueue does **not** emit `OwnershipRequeued` (Slice 8 certified).

---

## 8. Existing API Inventory

### 8.1 Primary candidates

| Endpoint | Method | Filters | Auth | Branch/Tenant | CounselorId filter? | Pagination | Date | Operational? | Class |
|----------|--------|---------|------|---------------|---------------------|------------|------|--------------|-------|
| `/Counseling/analytics/summary` | GET | period/from/to, branchId, counselorId | `.read` | PD16 | Yes (+ CreatedBy fallback) | No (aggregates) | Yes | Reporting | **REUSE WITH EXTENSION** |
| `/Counseling/analytics/trends` | GET | same | `.read` | PD16 | Yes (+ fallback) | No | Yes | Reporting | **REUSE WITH EXTENSION** |
| `/Counseling/analytics/followup-aging` | GET | same | `.read` | PD16 | Yes (+ fallback) | Buckets + truncate | Yes | Operational aging | **REUSE WITH EXTENSION** |
| `/Counseling/sessions` | GET | status, dates, pendingDecision, counselorId, … | `.read` | PD16 | Yes (+ fallback) | page/pageSize | Yes | Drill / row list | **REUSE WITH EXTENSION** |
| `/Counseling/sessions/{id}` | GET | by id | `.read` | tenant | N/A | N/A | N/A | Open detail | **REUSE AS-IS** |
| `/Counseling/counselors` | GET | optional branchId | `.read` | tenant directory | N/A | list | N/A | Picker | **REUSE AS-IS** |

**Extension meaning (not implemented here):** FE default scope + labels; possibly remove/narrow CreatedBy fallback; supervisor default — **product-gated**.

### 8.2 Not suitable for My Work ownership filter

| Endpoint | Why | Class |
|----------|-----|-------|
| `/Counseling/waiting-list` | Shared intake; intentional no counselorId | **NOT SUITABLE** |
| `/Counseling/followups/active\|cold-leads\|post-surgery\|stats` | Shared Center; PD-FOLLOWUP-01 | **NOT SUITABLE** |
| `/Counseling/ot-schedule` | Finalize; PD-S9-18 | **NOT SUITABLE** |
| `/Counseling/followups/overdue` | Weaker branch authz + legacy semantics | **NOT SUITABLE** |
| `/Counseling/patients/{id}/sessions` | Patient axis, not counsellor My Work | **NOT SUITABLE** |

---

## 9. Existing Frontend Inventory

| Surface | Reuse for Slice 11? |
|---------|---------------------|
| `CounselorAnalyticsTab` + analytics page | **Primary** — scope selector / default / labels |
| Period presets, CSV, print, funnel, aging | **Reuse as-is** (formulas unchanged) |
| `analytics-drilldown.ts` + sessions page | **Reuse** — already carries `counselorId` |
| Waiting List UI | **Do not** add My Work owner filter |
| Follow-up Center UI | **Do not** add My Follow-ups |
| Finalize / Post-Surgery | **Out of Slice 11** aggregation |
| Patient Hub “Assigned to me” | **Do not reuse** — different domain (visits) |
| Shared PermissionGate / counselling chrome | Reuse |

No My Work UI exists today. No new design system required.

---

## 10. Existing Permission Model

| Code | Use |
|------|-----|
| `counseling_sessions.read` | Waiting List, sessions, Follow-up, **Analytics**, counselors picker |
| `counseling_sessions.view` | Legacy alias of read |
| `counseling_sessions.update` | Assign, owned mutates, Center contact/ReQueue |
| `counseling_sessions.reassign` | Supervisory A→B; **removed from Counsellor** least-privilege set |
| Dedicated analytics permission | **Does not exist** |

**Catalog:** `CounselingSessionsPermissionCatalog.cs`, `CounsellorLeastPrivilegeCatalog.cs`.

### Answers (audit)

| Question | Answer |
|----------|--------|
| Can a counsellor safely query their own owned work? | **Mutations:** yes (owner ACL). **Reads:** branch-scoped with `.read`; any counsellor can pass any `counselorId` within authorized branches — **filter ≠ entitlement** (PD-ANALYTICS-01). |
| Can admin/supervisor query other counsellors? | **Yes today** — same `.read` + optional `counselorId` / omit for branch aggregate. |
| Are Analytics permissions sufficient? | **Yes under PD-ANALYTICS-01** (My Work as scope, not ACL). |
| Would a new permission be required? | **Only if** product later requires peer-metric isolation (counsellor cannot see Branch aggregate / peer filter). That would **contradict** current PD-ANALYTICS-01. |
| Dangerously broad? | `.read` spans desk + Analytics + counsellor directory; intentional for shared ops. Client-only “mine” is **not** security. |

**Do not change permissions in Slice 11 unless product explicitly rejects filter≠entitlement.**

---

## 11. Ownership / Work Matrix

**“Candidate for My Work?” = AUDIT QUESTION, not product decision.**  
Phase 3H already frames Slice 11 My Work as **Analytics attribution scope**, not queue personalization — rows still list evidence/open questions.

| Workflow State | Queue | CounselorId | Meaning | Candidate for My Work? |
|----------------|-------|-------------|---------|-------------------------|
| Waiting List — unassigned | `Waiting` | NULL | Shared intake; no owner | **?** Exclude from My Work KPIs (likely yes exclude under stamp-only My Work); still visible on shared WL |
| Waiting List — assigned | `Waiting` / `Called` | Set | Owned but not started; shared WL visibility | **?** Include in Analytics My Work if `SessionDate` in window; **not** as private WL row |
| InProgress counselling | Queue InProgress + Session InProgress | Set (owner ACL) | Active owned work | **?** Include in Analytics My Work; open session is mutation path, not Analytics list |
| Completed — still stamped | Session Completed; may leave Follow-up by intention | Retained | Historical ownership on session | **?** Include in Analytics My Work for date window (reporting); **not** as operational “todo” |
| ReQueued | Waiting (new/kept); prior actives soft-deleted | NULL | Unassigned; OwnershipRequeued if was owned | **?** Drops from stamp-only My Work; may remain via CreatedBy fallback until removed — **open** |
| Follow-up Active | N/A (session intention projection) | Historical stamp / Original Counsellor | Shared Center work | **?** **No as Center filter** (PD-FOLLOWUP-01). May still appear in Analytics My Work if session in window |
| Follow-up Cold | Same | Historical | Shared Center | **?** Same as Active — no My Follow-ups |
| Follow-up Post-Surgery | `patient_journey` | N/A | Shared post-discharge | **?** **No** (Slice 9 / PD-S9-18) |
| Finalize Surgery | OT schedule | N/A counselling owner ACL | Shared finalize | **?** **No** |
| PendingDecision aging | Session flag | Optional filter | Analytics aging ≠ Center Active | **?** Yes for Analytics My Work aging scope |
| CreatedBy-only (owner NULL) | Any | NULL; CreatedBy = user | Creator audit, not ownership | **?** **Unresolved** — code includes via fallback; product says CreatedBy ≠ owner |
| History ownership events | Audit log | Old/New transitions | Timeline | **?** Supplement only — not My Work denominator without new formula |

---

## 12. Candidate My Work Semantics

Do **not** select a winner here. Viable models supported by current system:

### Model A — Analytics My Work = current `CounselorId` stamp (strict)

| Aspect | Detail |
|--------|--------|
| Data source | `counseling_sessions` where `CounselorId == currentUser` |
| Query | Existing analytics/session filters **minus** CreatedBy OR |
| State interpretation | All statuses in date window with stamp |
| Ownership | Current stamp only |
| Branch | PD16 authorized |
| Permissions | `.read` + scope filter |
| Concurrency | Read-only projection; mutate via Version/ACL elsewhere |
| Risks | Unassigned/requeued/Admin-created NULL rows vanish; KPI drop vs today |
| Existing API | **Near AS-IS** after removing fallback |

### Model B — Analytics My Work = effective owner (current code)

| Aspect | Detail |
|--------|--------|
| Data source | `CounselorId == id OR (null AND CreatedByUserId == id)` |
| Query | Current `BuildSessionQuery` / `GetAllSessions` |
| Risks | Treats creator as owner — contradicts PD-WL-02 / Phase 3H; inflates My Work after ReQueue if creator matches |
| Existing API | **AS-IS** |

### Model C — Analytics My Work (PD-ANALYTICS-01 working intent)

| Aspect | Detail |
|--------|--------|
| Definition | Reporting scope default = self attribution; Branch = authorized aggregate |
| Formulas | Unchanged PD13–15 |
| Filter | ≠ entitlement |
| Gap | FE still defaults All; CreatedBy fallback unresolved |

### Model D — Operational “actionable owned sessions” worklist

| Aspect | Detail |
|--------|--------|
| Data source | Sessions (+ optional queue join) filtered by owner + non-terminal statuses |
| Risks | **Second worklist** vs Waiting List; product did not approve personalizing shared queues |
| Existing API | Sessions list with extensions — **possible but out of stated Slice 11 scope** in Phase 3I readiness |

### Model E — History-attributed My Work (point-in-time)

| Aspect | Detail |
|--------|--------|
| Data source | Ownership audit events |
| Risks | Different denominator; History is timeline not KPI SoT |
| Class | New formula — product/architecture decision |

### Model F — Include Follow-up Center items as My Work

| Aspect | Detail |
|--------|--------|
| Conflicts | **PD-FOLLOWUP-01** / Slice 10 Accepted |
| Class | **Not viable** without overturning signed Follow-up decisions |

**Phase 3I planned Slice 11 scope (docs):** Models **C** (+ resolve A vs B fallback), **not** D/E/F.

---

## 13. Data Consistency / Concurrency Analysis

My Work is a **read projection**, not an ownership mutation path.

| Event while My Work open | Expected behavior |
|--------------------------|-------------------|
| Assign / Reassign / ReQueue / Complete | Projection stale until refetch; no second concurrency token |
| Concurrent Update/Complete | Existing `Version` CAS + 409 on mutate — unchanged |
| CounselorId changes under user | Session leaves/joins stamp-based My Work on next query |
| ReQueue → NULL | Leaves strict My Work; may linger under CreatedBy fallback |
| Open then mutate | Owner ACL + Version still apply on session |

**Existing Version / ACL / transaction semantics are sufficient.** Do not invent a My Work concurrency mechanism.

---

## 14. Security / Privacy Analysis

| Requirement | Current posture |
|-------------|-----------------|
| Tenant isolation | Server tenant on queries |
| Authorized branch scope | PD16 on Analytics / sessions / Center |
| Ownership mutation boundaries | Server ACL — separate from Analytics filter |
| Least privilege | `.read` shared across desk+Analytics |
| No client-controlled ownership authz | Filter is **not** entitlement today (documented) |
| Cross-branch leakage | Unauthorized `branchId` → 403 on Analytics |
| PHI via analytics | Aging includes patient name/phone — same as today; no new PHI surface if reusing endpoints |
| Unsafe patterns for “private My Work” | Client-only default to self is **bypassable** via API `counselorId` |

**If product requires hard peer isolation:** current APIs are **unsafe as entitlement** — that is a **product/security decision**, not a silent FE fix. Under PD-ANALYTICS-01, peer Branch visibility is intentional.

**Note:** `GET followups/overdue` uses weaker raw `branchId` — already **NOT SUITABLE** for My Work; do not reuse.

---

## 15. Performance / Scale Analysis

| Topic | Evidence |
|-------|----------|
| Primary query | `counseling_sessions` with tenant + `deleted_at` + `session_date` window + branch IN + optional counselor |
| Indexes | `idx_counseling_sessions_counselor`; `idx_cs_analytics_tenant_session`; `idx_cs_pending_decision_session`; intention/callback/journey indexes (migration 188) |
| Queue join for Analytics | **Not required** today — good |
| History load for KPIs | **Not used** today — keep that way for My Work KPIs |
| Pagination | Aggregates: no; sessions drill: yes — required for row lists |
| Date boundaries | Period/custom windows already required — keep |
| Gaps | Composite `(tenant_id, counselor_id, session_date)` partial index **not** present; counselor filter after tenant/date may scan more as volume grows — **identify only, do not create** |
| N+1 | Analytics service materializes grouped queries; counselor name resolution on session lists — existing pattern |

---

## 16. Reuse Opportunities

| Layer | Reuse |
|-------|-------|
| APIs | Analytics summary/trends/aging + sessions drill + counselors picker |
| Services | `CounselingAnalyticsService`, `GetAllSessionsAsync`, PD16 branch resolver |
| FE | `CounselorAnalyticsTab`, drilldown helpers, export/print |
| Permissions | `counseling_sessions.read` |
| Formulas | Phase 2Z / PD13–15 unchanged |
| Ownership SoT | `CounselorId` stamp (after fallback decision) |
| Do **not** reuse | Waiting List / Follow-up / Finalize as personal queues; Patient Hub assigned-to-me; History as KPI denominator without new formula |

---

## 17. Duplicate Worklist Risk

| Proposed anti-pattern | Audit stance |
|-----------------------|--------------|
| My Work DB table | **Reject** — unnecessary |
| My Work queue / duplicate `CounselorQueueItem` | **Reject** — conflicts with shared WL |
| Duplicate FollowUps table | **Reject** — Center is session projection |
| Duplicate assignment table | **Reject** — `CounselorId` is SoT |
| Personalize Waiting List / Follow-up by owner | **Reject** unless product overturns PD-WL-01 / PD-FOLLOWUP-01 |

**Prefer:** existing Analytics + sessions drill over authorized branches.

If product later demands an operational “actionable owned” board distinct from Analytics, treat as **new architecture/product decision** (likely beyond Slice 11 as currently scoped).

---

## 18. Product Decisions Required

Only decisions **not fully resolved** by repository evidence / accepted slices.

### Already settled (do not re-open without explicit overturn)

| ID | Settled rule | Source |
|----|--------------|--------|
| PD-ANALYTICS-01 (working) | My Work + Authorized Branch scopes; normal default My Work; filter ≠ entitlement; same Phase 2Z formulas | Phase 3H |
| PD-FOLLOWUP-01 | No My Follow-ups; Center shared | Phase 3H + Slice 10 Accepted |
| PD-WL-01 | Waiting List shared | Phase 3H + Slice 1 |
| PD-S9-18 | No My Work on Finalize/Post-Surgery lists | Slice 9 |
| PD-WL-02 (field) | `CreatedByUserId` ≠ ownership SoT | Phase 3H |

### PRODUCT DECISIONS REQUIRED BEFORE IMPLEMENTATION

#### PD-S11-01 — Formal confirmation of My Work definition

| | |
|--|--|
| **Question** | Confirm Slice 11 My Work = **Analytics reporting scope** (current counsellor attribution within PD16), **not** a new operational worklist and **not** personalization of Waiting List / Follow-up. |
| **Evidence** | Phase 3I Slice 11 scope + PD-ANALYTICS-01; code still “All counselors”. |
| **Status** | Working intent exists; **needs formal Slice 11 confirmation / sign-off**. |

#### PD-S11-02 — Included counselling populations for My Work KPIs

| | |
|--|--|
| **Question** | Within the date window, does My Work include all session statuses (Scheduled/InProgress/Completed/Cancelled) that match attribution, or only active/non-terminal? |
| **Evidence** | Analytics today includes all non-deleted sessions in window regardless of Status (partitions by decision flags). |
| **Status** | **Unresolved for “work” naming** — reporting already includes Completed. |

#### PD-S11-03 — NULL CounselorId behavior

| | |
|--|--|
| **Question** | When `CounselorId` is NULL, is the session excluded from My Work? |
| **Evidence** | Strict ownership → exclude; current API may include via CreatedBy. |
| **Status** | **Required** — ties to PD-S11-04. |

#### PD-S11-04 — CreatedBy effective-owner fallback (critical)

| | |
|--|--|
| **Question** | Keep, narrow, or remove `CounselorId == null AND CreatedByUserId == id` from Analytics + sessions drill? |
| **Evidence** | `CounselingAnalyticsService.BuildSessionQuery`; `GetAllSessionsAsync`; conflicts with CreatedBy ≠ owner; needed historically for PD15 drill parity. |
| **Status** | **Required before coding** (explicit Slice 11 dependency in Phase 3I readiness). |

#### PD-S11-05 — ReQueued session behavior in My Work

| | |
|--|--|
| **Question** | After ReQueue clears owner, does the session disappear from My Work immediately (stamp-only), or linger via CreatedBy? |
| **Evidence** | ReQueue → NULL (Slice 8); fallback may retain. |
| **Status** | **Required** (consequence of PD-S11-04). |

#### PD-S11-06 — Follow-up relationship

| | |
|--|--|
| **Question** | Confirm My Work does **not** add Follow-up Center owner filters; Center remains shared; Analytics may still attribute historical sessions. |
| **Evidence** | PD-FOLLOWUP-01 + Slice 10 Accepted. |
| **Status** | **Confirm for Slice 11** (likely reaffirm, not redesign). |

#### PD-S11-07 — Branch scope

| | |
|--|--|
| **Question** | My Work = owned/attributed work across **all authorized branches**, or only **active selected branch**? |
| **Evidence** | Analytics uses selected `branchId` resolved through PD16; omit/null paths use authorized set — FE typically passes current branch. |
| **Status** | **Clarify UX default** (branch selector vs cross-branch My Work). |

#### PD-S11-08 — Admin / Supervisor visibility defaults

| | |
|--|--|
| **Question** | Confirm supervisor/Admin default = Authorized Branch aggregate; normal counsellor = My Work; may counsellor still pick peers? |
| **Evidence** | PD-ANALYTICS-01 allows Branch for supervisors; peer filter via picker exists today. |
| **Status** | **Required** (how to detect supervisor without new role — use `.reassign`? Admin role? explicit list?). **Do not invent a Supervisor role.** |

#### PD-S11-09 — Analytics date semantics

| | |
|--|--|
| **Question** | Confirm My Work inherits existing period presets (7/14/30) + independent aging period — no new My-Work-only date rules. |
| **Evidence** | Phase 2Z shipped; PD-ANALYTICS-01 says same formulas/scopes only. |
| **Status** | Likely **reaffirm** — list only if product wants different defaults. |

#### PD-S11-10 — Permission model

| | |
|--|--|
| **Question** | Keep `.read` + filter≠entitlement, or introduce peer-isolation permission? |
| **Evidence** | No dedicated analytics permission; PD-ANALYTICS-01 prefers filter≠authz. |
| **Status** | **Required only if** security wants isolation; otherwise **reaffirm reuse `.read`**. |

---

## 19. Architectural Dependencies

| Dependency | Status |
|------------|--------|
| Ownership stamp correctness (Slices 2–8) | **Met** |
| Follow-up honesty (Slice 10) | **Met / Accepted** |
| Analytics Phase 2Z formulas (PD13–15) | **Met** — preserve |
| PD16 branch authorization | **Met** on Analytics |
| New tables / queues | **Not required** for planned Slice 11 |
| Slice 12 Leave/Reassignment | **Independent** — do not start |
| CreatedBy fallback decision | **Open** — implementation dependency, not missing architecture |

---

## 20. Implementation Readiness

### Classification

# READY FOR PRODUCT DECISION

### Why this classification (and not others)

| Alternative | Why not |
|-------------|---------|
| Implementation-ready | Formal sign-off + CreatedBy fallback + supervisor-default detection still open |
| NOT READY — ARCHITECTURAL DEPENDENCY | No new aggregate/queue required; Analytics + `CounselorId` exist |
| NOT READY — SECURITY/PERMISSION DEPENDENCY | Current model is intentionally filter≠entitlement; sufficient under PD-ANALYTICS-01 unless product overturns it |
| NOT READY — DATA MODEL DEPENDENCY | Ownership + indexes + session fields sufficient for planned scope |

---

## 21. Recommended Next Gate

1. **Product Decision Workshop (Slice 11 only)** — resolve **PD-S11-01…10**, with **PD-S11-04 (CreatedBy fallback)** as the critical path item.  
2. Produce a short **Slice 11 Product Decision Record** (formalize PD-ANALYTICS-01 + fallback rules).  
3. Only then open **Slice 11 Implementation** scoped to:
   - FE My Work default + Authorized Branch labeling
   - Supervisor/Admin default behavior
   - CreatedBy fallback change (if decided) with PD15 drill parity tests
   - Preserve PD13/14/15 formulas
   - **No** Waiting List / Follow-up / Finalize personalization
   - **No** Slice 12  
4. UAT: My Work default, Branch scope, ReQueue drops/lingers per decision, peer filter behavior, formula regression.

**STOP after product decisions are recorded. Do not implement from this audit alone.**

---

## 22. What Was Inspected / Tested

### Inspected (read-only)

- Phase 3H / 3I / Slice 8–10 audit & product decision docs under `docs/audits/`
- Phase 2 analytics docs (`counsellor-followup-analytics-*`)
- `CounselorAnalyticsTab.tsx`, `use-counselor-analytics.ts`, analytics drilldown/export
- `CounselingController.cs` analytics + sessions + followups + waiting-list permissions
- `CounselingAnalyticsService.cs` (BuildSessionQuery / CreatedBy fallback)
- `CounselingWorkflowService.cs` (GetAllSessions filter, ownership mutations)
- Follow-up presentation + Center page tests (no My Follow-ups)
- Permission catalogs / least-privilege
- Schema indexes (`module03_02_counseling_workflow.sql`, migration 188)
- Sidebar nav Analytics entry

### Not done

- No production code changes  
- No new tests added  
- No implementation of My Work  
- No Slice 12 work  
- Existing test suites were **not re-executed** in this audit session (prior Slice 10 acceptance assumed; Analytics tests inventoried by file presence)

---

## 23. Scope Confirmation

| Item | Status |
|------|--------|
| Slice 10 | **Accepted** (prior gate; honesty preserved) |
| Slice 11 | **Audit only** — this document |
| Slice 12 | **Not started** |
| Production implementation | **None performed** |
| APIs / DB / permissions / ownership / Follow-up / ReQueue / Version | **Unchanged** |

---

**END OF AUDIT — STOP**
)
