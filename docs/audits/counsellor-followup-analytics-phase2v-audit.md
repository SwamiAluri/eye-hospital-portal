# Phase 2V — Counsellor Follow-up Center + Analytics  
## Full Product Re-Certification & Gap Analysis

**Audit date:** 2026-09-11  
**Scope:** Discovery / certification only — no production implementation  
**Source of truth:** Current repository code (not prior phase documents)  
**Primary surfaces:**
- Follow-up Center: `/dashboard/counsellors-desk/surgery-followup`
- Analytics: `/dashboard/counselor/analytics`
- Backend: AuthService `FollowupListService`, `CounselingAnalyticsService`, `CounselingController`

---

## 1. Executive Summary

Substantial Follow-up Center and Analytics capability is **implemented and operable** for list/search/pagination/stats, contact/reminder/requeue, and management Summary/Trends/Aging. The product is **not yet operationally complete** for real hospital counselling shifts.

**Overall status: PARTIAL PASS — PRODUCTION GAPS REMAIN**

| Verdict | Detail |
|---------|--------|
| Populations (Active / Cold / Post-Surgery) | Implemented with authoritative intention / discharge predicates |
| Due date / SLA / priority model | **BLOCKED — PRODUCT DECISION REQUIRED** (+7/+30/+14 not authoritative; confirmed absent from Center BE) |
| Ownership / exit lifecycle | Fragmented / implicit — no counsellor assignee on Center DTOs; no explicit “leave follow-up workload” |
| Contact history | Persisted and queryable; last-contact surfaced on Active; full history via drawer |
| Schedule Visit | Absent by design; ward uses `appointment.create` — counsellor product decision still open |
| Analytics formulas | Backend-owned; Summary↔Trends consistent; Aging ≠ Active Follow-up (intentional) |
| Drill-down | Aging → session + Center button only; KPI→worklist missing |
| Performance | Indexes (migration 188) implemented; **EXPLAIN not proven** |
| E2E | Phase 1 visual/smoke only; functional mutations / auth / CSV largely **NOT COVERED** |
| Security | `counseling_sessions.read` / `.update`; tenant JWT+RLS strong; branch filter client-optional |

**Do not treat “Counsellor E2E green” as product certification.** The operational questions (due date, owner, priority, exit, Schedule Visit, drill-down) remain the binding gaps.

---

## 2. Current Architecture

```
Counsellor Ops Shell (dashboard layout — counselling canvas)
├── Waiting List          /dashboard/counsellors-desk/waiting-list
├── Counselling Session   /dashboard/counsellors-desk/[sessionId]
├── Finalize Surgery      /dashboard/counsellors-desk/finalize-surgery
├── Follow-up Center      /dashboard/counsellors-desk/surgery-followup   ← Phase 2B/2F lists
└── Analytics             /dashboard/counselor/analytics                 ← Phase 2D

AuthService (api/Counseling)
├── GET  followups/active | cold-leads | post-surgery | stats
├── POST sessions/{id}/communication-logs | callbacks | re-queue
├── POST patients/{id}/reminders
└── GET  analytics/summary | trends | followup-aging

SoT entities
├── counseling_sessions          (Active / Cold / Analytics)
├── counselor_communication_log  (contact history)
├── counselor_callback_requests  (callbacks / analytics)
└── patient_journey (+ discharge_summary, post_op visits)  (Post-Surgery)

PARALLEL / DO NOT CONFUSE
├── /api/FollowUps + follow_up_appointment     (legacy clinical follow-up; followup.* perms)
└── IP Ward FollowUpAppointmentPanel           (appointment.create)
```

**Frontend stack (Follow-up Center):**  
`surgery-followup/page.tsx` → `use-counsellors-desk-queries.ts` → `counsellors-desk.api.ts` → AuthService.

**Not used by Center:** `follow-up.api.ts` / `use-follow-ups.ts` / `FollowUpsController`.

---

## 3. Follow-up Center Current State

### Route & chrome
| Item | Current |
|------|---------|
| Route | `/dashboard/counsellors-desk/surgery-followup` |
| Title | Follow-up Center |
| Permission | `counseling_sessions.read` (`ProtectedRoute` + sidebar) |
| Tabs | Active \| Cold Leads \| Post-Surgery |
| KPIs | Server `/followups/stats` (filtered population, not page-scoped) |
| Search | Debounced `q` → server |
| Pagination | Page size 20 |
| Intention filter | Active tab only |
| Branch | `selectedBranchId ?? user.branchId` |
| Date filter | Removed (tests assert absence) |

### Operational questions vs UI

| Question | Answered today? | Evidence |
|----------|-----------------|----------|
| 1. Which patients need attention? | **Partial** | Active `alertLevel` + High Priority KPI; Post ≥30d cue; Cold flat |
| 2. Why follow-up? | **Partial** | Intention + procedure/surgery; Notes unused on Cold row; no canonical reason column |
| 3. What happened previously? | **Partial** | Inline last contact (Active); History drawer; Cold attempts/outcome not on row |
| 4. What should I do next? | **Weak** | Actions exist; no row-level next-action; `NextActionDate` not on list DTO |
| 5. Who owns it? | **No** | No counsellor/owner on Active/Cold/Post DTOs or UI |
| 6. Priority? | **Partial / non-authoritative** | Escalation-derived alert; never-contacted → Medium; Escalation writers largely missing |
| 7. What happened after follow-up? | **Weak** | Comm logs if recorded; no outcome→exit loop |
| 8. When can patient leave workload? | **No** | No close/complete-follow-up; exit = intention change / soft-delete / journey change |

### Patient identity on rows
| Field | Active | Cold | Post-Surgery |
|-------|--------|------|--------------|
| Name | Yes | Yes | Yes |
| UHID/MRN | Yes | Yes | Yes |
| Phone | Yes | Yes | Yes |
| Age/sex | **No** (session has age/gender elsewhere; not on Center DTO) | No | No |
| Procedure | RecommendedSurgery | RecommendedSurgery | ProcedureName / SurgeryType |
| Surgery/visit context | Session-derived | Session-derived | Discharge + pending post-op visits |

---

## 4. Follow-up Population Rules

### 4.1 ACTIVE

| Aspect | Exact rule |
|--------|------------|
| Source | `counseling_sessions` |
| Entry | `PatientIntention` ∈ Active allowlist |
| Allowlist | `WillingWeek`, `WillingMonth`, `WillingQuarter`, `WillingCallToConfirm`, `Undecided`, `WaitingFinancial`, `WaitingFear` |
| Tenant | `TenantId == jwt tenant` |
| Soft-delete | `DeletedAt == null` |
| Branch | Optional `branchId` |
| Status filter | **None** (Cancelled/Completed still included if intention matches) |
| PendingDecision | **Not used** |
| Search | Patient name / MRN / phone / RecommendedSurgery (Contains) |
| Sort | Null `LastContactDate` first → ascending LastContactDate → Id |
| Pagination | page≥1, pageSize 1–100 (default 20) |
| Count/stats | Same builder; filtered population |
| Mutations | List read-only; intention via session update / re-queue |
| Exit | Intention leaves allowlist **or** soft-delete. **No** auto-exit on agree / OT / complete |

**Confirmed allowlist:** `FollowupQueryContracts.cs` + FE `ACTIVE_FOLLOWUP_INTENTIONS`.

**Orphans (master catalog, not Active):** `WillingNow`, `WillingTwoWeeks`, `WillingSixMonths`, `SecondOpinion` — PRODUCT DECISION REQUIRED whether to include.

### 4.2 COLD

| Aspect | Exact rule |
|--------|------------|
| Source | `counseling_sessions` |
| Entry | `PatientIntention` ∈ `{Declined, ReferredElsewhere}` |
| Tenant / soft-delete / branch | Same pattern as Active |
| Intention query filter | None (fixed population) |
| Sort | `UpdatedAt ?? CreatedAt` DESC → Id |
| Exit | Intention change (e.g. re-queue) or soft-delete |

### 4.3 POST-SURGERY

| Aspect | Exact rule |
|--------|------------|
| Source | `patient_journey` (AuthService read-only) |
| Entry | `IsDischarged == true` |
| Tenant / soft-delete / branch | Journey fields |
| Counseling session | **Not required** for inclusion |
| Enrichment | Discharge summary; incomplete post-op visits; **latest** counseling session by `CreatedAt` for patient |
| Sort | `DischargedAt` DESC |
| DaysSinceDischarge | Computed at read from UTC now — **not a due date** |
| Over30Days KPI | `DischargedAt <= UtcNow - 30 days` |
| Exit | Journey no longer discharged / soft-deleted — **no counsellor “complete post-surgery F/U”** |

**Populations must not be merged.** Active ≠ Cold ≠ Post-Surgery ≠ Analytics Aging (`PendingDecision`).

---

## 5. Follow-up Date / Timing Audit

### 5.1 +7 / +30 / +14 heuristics

| Claim | Status |
|-------|--------|
| Authoritative in Follow-up Center backend | **FALSE** — absent from `FollowupQueryContracts`, `FollowupListService`, migration 188 |
| Authoritative in Follow-up Center frontend | **FALSE** — explicit non-use in `followup-presentation.ts` |
| Nearby numbers | `followups/overdue?days=7` = contact staleness; Post KPI Over30Days; Analytics aging buckets 0–3/4–7/8–14/15+ — **not** Active/Cold/Post due formulas |

### 5.2 Date inventory (counsellor Follow-up relevant)

| Field | Entity | Writer | Reader (Center) | Meaning | Authoritative due? |
|-------|--------|--------|-----------------|---------|-------------------|
| SessionDate | counseling_sessions | Session create/update | Active/Cold DTO | Session calendar date | No |
| DecisionDate | counseling_sessions | Session update / quick-book | Waiting-list projection; analytics | Decision timestamp | No (decision ≠ F/U due) |
| LastContactDate | counseling_sessions | Comm log | Active/Cold sort, alert, KPIs | Last contact day | Heuristic for alert only |
| OverdueSinceDate | counseling_sessions | **No C# writer found** | Active DTO | Intended overdue start | **Not runtime-authoritative** |
| NextActionDate | counselor_communication_log | Comm log | Comm log GET only | Per-log next action | Candidate — **not on list** |
| CallbackDate | counselor_callback_requests | Schedule/reschedule | Callbacks / analytics | Callback day | Candidate — **not population due** |
| DischargedAt | patient_journey | IP management | Post-surgery | Discharge time | Aging KPI only |
| EscalatedAt / SlaBreachAt | session | **No service writer** | Model | Escalation timestamps | Unused |
| ReasonsForDelay | session | Update / cancel overwrite | Waiting-list reason | Free text (not a date) | N/A |
| FollowUpDate (waiting-list DTO) | Projection from DecisionDate when RepeatCounselling | — | Waiting List | Workflow projection | Do not mix with Center due |

### 5.3 FOLLOW-UP DATE DECISION MATRIX

| Population | Candidate date | Meaning | Suitable as operational due date? | Evidence |
|------------|----------------|---------|------------------------------------|----------|
| Active | LastContactDate + offset | Contact freshness | **No — not defined as due** | Sort/alert only |
| Active | NextActionDate (log) | Staff-planned next step | **Possible** if product adopts; not wired | Comm log only |
| Active | CallbackDate | Scheduled callback | **Possible** for callback subset | Separate entity |
| Active | DecisionDate | Decision moment | **No** | Wrong semantics |
| Active | SessionDate +7/+30 | Old FE heuristic | **No — non-authoritative** | Explicitly removed |
| Cold | LastContactDate / UpdatedAt | Recency | Sort only | No due |
| Cold | SessionDate +30 | Old heuristic | **No** | Removed |
| Post-Surgery | DischargedAt +14 | Old heuristic | **No** | Removed |
| Post-Surgery | DischargedAt | Discharge aging | KPI / cue only (≥30d) | Not due |
| Post-Surgery | Clinical post-op visit dates | Clinical schedule | **Clinical ownership** — not counsellor due without decision | IP post-op |

### Verdict

**BLOCKED — PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**

Do not implement a Follow-up Center due date until product defines the authoritative field(s) and exit/SLA rules.

---

## 6. Follow-up Reason Audit

### CURRENT MODEL

| Concept | Storage | Notes |
|---------|---------|-------|
| Intention | `PatientIntention` (string) | Population driver for Active/Cold |
| Delay / follow-up reason | `ReasonsForDelay` (free text) | Also overwritten by **cancel reason** |
| Waiting-list FollowUpReason | Projection of ReasonsForDelay | RepeatCounselling queue only |
| Comm outcome | Outcome strings on logs | Answered*, NoAnswer, DeclinedContact, … |
| Callback type | Includes DelayReason as type code | Callback taxonomy, not Center reason |
| Insurance / financial | Intention `WaitingFinancial` + session coverage elsewhere | Not a structured F/U reason enum |
| Post-surgery | Discharge condition + pending visits | Journey-owned |

**One field, multiple meanings:** `ReasonsForDelay` = delay reason **and** cancel reason — overloaded.

### REQUIRED OPERATIONAL MODEL (gap — not implemented)

A production Follow-up Center typically needs **distinct** concepts:

1. Population reason (intention / post-discharge)  
2. Structured delay / barrier reason  
3. Communication outcome  
4. Next recommended action  
5. Closure reason  

**Do not merge** intention ↔ PendingDecision ↔ ReasonsForDelay ↔ callback type.

**PRODUCT DECISION REQUIRED:** structured reason taxonomy vs free text; separate cancel reason.

---

## 7. Follow-up Lifecycle Audit

| Event | Current effect on Center populations | Authoritative? |
|-------|--------------------------------------|----------------|
| Intention → Active code | ENTER Active | Yes |
| Intention → Declined / ReferredElsewhere | EXIT Active → ENTER Cold | Yes |
| Patient agrees (`PatientAgreedToSurgery=true`) | Intention **unchanged** → may stay Active | **Gap** |
| Quick-book surgery | Agreed=true, PendingDecision=false; intention uncleared | **Gap** |
| Session Completed | Status only; still in Active/Cold if intention matches | **Gap** |
| Schedule callback | Callback row; population unchanged | Yes (side table) |
| Unreachable / NoAnswer | Comm log + LastContact*; Escalation Overdue→Normal only if Answered* | Partial |
| Re-queue | Optional NewIntention; creates Waiting List RepeatCounselling | Yes |
| More counselling | Via re-queue / session type | Implicit |
| Undecided | In Active | Yes |
| Referred elsewhere | Cold | Yes |
| Discharge | ENTER Post-Surgery (independent of counselling Active) | Yes |
| “Follow-up completed” | **No flag / closed population** | **Missing** |
| Escalation Closed | Seed/docs only; lists ignore for inclusion | Not exit |

**Verdict:** Lifecycle is **implicit and fragmented**. No explicit operational state machine for “in follow-up workload → done.”

---

## 8. Contact / Communication Audit

| Capability | Persisted? | On list DTO? | Queryable? | Tenant-safe? | Auditable? |
|------------|------------|--------------|------------|--------------|------------|
| Last contact date | Yes | Active/Cold | Yes | Yes (session tenant) | Via log |
| Attempt count | Yes | Active/Cold (Cold unused on FE row) | Yes | Yes | Yes |
| Last outcome | Yes | Active/Cold (FE underuses) | Yes | Yes | Yes |
| Full history | Comm logs | Drawer only | GET communication-logs | Yes | Yes |
| Staff on contact | CounselorId / CreatedByUserId on log | History | Yes | Yes | Yes |
| Timestamp | CommunicationAt | History | Yes | Yes | Yes |
| Next action | NextActionDate on log | History if returned | Yes | Yes | Partial |
| Callback date | Callback entity | **Not on Center rows** | Callbacks API | Yes | Yes |
| Reminder | Creates outbound log | — | Logs | JourneyId on request **not persisted** | Log-only (no delivery) |

**Missing for Centre reliability:** row-level next action; callback surface on queue; writers for EscalationStatus / OverdueSinceDate; reminder delivery; JourneyId persistence on reminders.

---

## 9. Follow-up Action Audit

| Action | FE | API | Persistence | Authz | Idempotency / notes |
|--------|----|-----|-------------|-------|---------------------|
| Contact | ContactLogModal | POST `…/communication-logs` (+ optional callbacks) | Comm log; updates LastContact* | `counseling_sessions.update` | New log each submit |
| Reminder | SendReminderModal | POST `…/patients/{id}/reminders` | Outbound log only | update | **No delivery pipeline** |
| History | PatientHistoryDrawer | GET communication-logs | Read | read (no PermissionGate) | — |
| Requeue | ReQueueModal (Active/Cold) | POST `…/re-queue` | Intention + CounselorQueue | update | Creates FU- token queue entry |
| Open session | Router push | — | — | read | Post only if SessionId |
| Schedule Visit | **Absent** | — | — | — | E2E asserts absence |
| Schedule Callback | Inside Contact modal | POST callbacks | Callback row | update | Not visit booking |

### Schedule Visit — product status

| Item | Finding |
|------|---------|
| Counsellor Center UI | Not present (not stubbed) |
| `/api/Appointments` | Exists; `appointment.view/create/update/cancel/delete` |
| Ward pattern | `FollowUpAppointmentPanel` → `appointmentsApi.createFollowUp` (`appointmentType: 'Follow-up'`) gated by `appointment.create` |
| Counsellor permission for appointments | **Not wired** into Follow-up Center |
| Phase 2B contract | Schedule Visit out of scope |

**PRODUCT DECISION REQUIRED:** whether counsellors may book visits; which appointment type; ownership vs ward/OT clinical follow-up.

---

## 10. Frontend UX Audit

### Strengths
- Same counselling ops shell family as Waiting List / Finalize Surgery
- Compact worklist; server KPIs; tabs; search; pagination; loading skeleton; error+retry; empty copy
- Intention pills use counselling tokens; alert borders for Active
- Responsive: priority columns hide Procedure/Status/Contact below `sm`; density band `min-[1600px]`; tab overflow-x; vertical list scroll

### Gaps / inconsistencies
- Contact/Reminder modals still use marketing blue/violet gradients (not counselling tokens)
- Cold row underuses attempt count / outcome / notes
- EscalationStatus / OverdueSinceDate / lastContactOutcome not fully surfaced
- No ownership column; no next-action column; no exit action
- Grid SoT is Tailwind string (`FOLLOWUP_WORK_GRID`) vs CSS class tracks on Waiting List / Finalize
- No deep-link from Waiting List / Session into Center
- Analytics Aging → Center link risks population confusion (PendingDecision ≠ Active)

### Accessibility / keyboard
- History: Escape + backdrop
- Keyboard shortcut Ctrl+F → Center
- Full a11y audit of all dialogs not certified in this phase beyond code patterns

### Responsive evidence (code + E2E)
- E2E profiles: **1920, 1600, 1280** only (`counsellor-followup-analytics-phase1.spec.ts`)
- **NOT covered in E2E:** 1536@1.25, 1440, 1366, 1200, 1024
- Code breakpoints: `sm` column hide; `min-[1600px]` density — no zoom/transform/DPR CSS found for Center

---

## 11. Backend / API Audit

### Follow-up Center endpoints

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/Counseling/followups/active` | `counseling_sessions.read` |
| GET | `/api/Counseling/followups/cold-leads` | read |
| GET | `/api/Counseling/followups/post-surgery` | read |
| GET | `/api/Counseling/followups/stats` | read |
| GET | `/api/Counseling/followups/overdue` | read (staleness; not Center tab) |

### Related mutations

| Method | Route | Permission |
|--------|-------|------------|
| GET/POST | `…/sessions/{id}/communication-logs` | read / update |
| POST | `…/sessions/{id}/callbacks` | update |
| PATCH | `…/callbacks/{id}/complete\|reschedule` | update |
| POST | `…/sessions/{id}/re-queue` | update |
| POST | `…/patients/{id}/reminders` | update |

### Gaps
- Intention write path is free-string — **no server allowlist validation**
- Status not excluded from Active/Cold
- Escalation fields largely read-only in services
- Post-surgery SessionId = latest by CreatedAt — wrong-session risk

---

## 12. Database Audit

### Migration 188 (`188_counseling_followup_analytics_indexes.sql`)

| Index | Purpose | Query fit |
|-------|---------|-----------|
| `idx_cs_analytics_tenant_session` | Analytics SessionDate window | Good (tenant+date) |
| `idx_cs_followup_intention_contact` | Active/Cold intention + contact | Good for filter; nulls-first ORDER may be partial |
| `idx_cs_pending_decision_session` | Aging PendingDecision | Good |
| `idx_callback_tenant_date` | Callback analytics all statuses | Good |
| `idx_pj_discharged_followup` | Post-surgery discharged | Good |

Verify script: name presence only — **no EXPLAIN**.

### Classification

**IMPLEMENTED BUT NOT EXPLAIN-PROVEN**

Also weak: leading-wildcard `%q%` search; Cold ORDER BY UpdatedAt/CreatedAt; optional branch/counselor composites not in 188.

---

## 13. Analytics Metric Audit

**Service:** `CounselingAnalyticsService`  
**Window:** `CounselingAnalyticsDateWindow` — UTC calendar, half-open `[FromInclusive, ToExclusive)` on `SessionDate` (callbacks on `CallbackDate`).

### Summary formulas

| Metric | Formula | Zero-denom |
|--------|---------|------------|
| totalSessions | Count in window + tenant (+ optional branch/counselor) | — |
| agreedCount | `PatientAgreedToSurgery == true` | — |
| declinedCount | `Agreed == false AND PendingDecision == false` | — |
| undecidedCount | `PendingDecision == true` | — |
| conversionRate | agreed/total × 100, 1 dp | 0 |
| decisionRate | (agreed+declined)/total × 100 | 0 |
| avgDaysToDecision | Avg (DecisionDate − SessionDate) where DecisionDate set | 0 if none |
| bySurgeryType | Non-empty RecommendedSurgery, top 8 | — |
| bySessionType | Group SessionType | — |
| callbackCompletionRate | completed/total × 100 | 0 |

**Caveats:**
1. Agreed ignores PendingDecision → overlap with undecided possible  
2. `Agreed == null && PendingDecision == false` matches **no** bucket  
3. Status not filtered (Cancelled etc. included)  
4. Soft-delete excluded

### Trends
Same session query as Summary; group by SessionDate → `{date, count, agreedCount}`; sparse (zero days omitted).

### Aging
| Item | Behavior |
|------|----------|
| Population | `PendingDecision == true` only (`population: "PendingDecision"`) |
| Default window | period **365** when FE omits period |
| FE | Passes **branchId only** → always 365d default |
| Buckets | 0–3, 4–7, 8–14, 15+ by days since SessionDate |
| Lists | Cap 100/bucket; `truncated` flag |

---

## 14. Analytics UX Audit

| Concern | Status |
|---------|--------|
| KPI hierarchy | Total, Conversion, Avg Days, Callback completion → Funnel → Session types → Surgery mix → Trends → Aging |
| Period 7/14/30 | Summary + Trends only |
| Custom from/to | API yes; UI no |
| Counsellor filter | API yes; **UI deferred** |
| Branch | Implicit auth store |
| CSV | Summary + surgery; not trends/aging |
| Print | `window.print()` |
| Loading / error / empty | Present per section |
| Funnel | Four independent counts — not a true sequential funnel |
| Management Q: bottlenecks | Aging + undecided only; no procedure/counsellor drill without UI filter |

---

## 15. Analytics Drill-down Audit

| From | To | Status | Classification |
|------|----|--------|----------------|
| Aging row Open | Counselling Session | Exists | Easy FE (done) |
| Aging “Follow-up Center” | Center (no query filters) | Exists | Easy FE but **population mismatch** — product decision on meaning |
| KPI / funnel / surgery → worklist | — | Absent | Needs API filtered list **and/or** product decision (PendingDecision vs Active) |
| Summary undecided → Aging | — | Absent | Easy FE if same window passed (today windows differ) |
| Aging → Waiting List | — | Absent | Product decision |

**Do not build duplicate worklists** for PendingDecision if product maps them to existing Center/Waiting List with clear semantics.

---

## 16. Security / Authorization Audit

| Surface | Permission |
|---------|------------|
| Pages + GETs (lists, stats, analytics, history) | `counseling_sessions.read` |
| Contact, reminder, requeue, callbacks POST | `counseling_sessions.update` |
| Legacy `/api/FollowUps` | `followup.read/create/update/delete` — **separate** |
| Ward Schedule Visit | `appointment.create` |

| Isolation | Assessment |
|-----------|------------|
| Tenant | JWT `GetTenantId` + query filter + RLS — **strong** |
| Branch | Optional client filter — **not hard server isolation** |
| Counsellor | Analytics API supports counselorId; Center lists do **not** filter by assigned counsellor; ownership not on DTO |

---

## 17. Cross-module Integration Audit

| Module | Integration | SoT | Risk |
|--------|-------------|-----|------|
| Waiting List | Re-queue creates RepeatCounselling; DecisionDate/ReasonsForDelay projected as follow-up fields | Session + queue | No deep-link to Center |
| Session / Decision | Intention / PendingDecision / Agreed written in session | Session | Agree does not exit Active |
| Insurance / Notes / Finish | Indirect via session | Session | No Center-specific wiring |
| Finalize Surgery / OT | Sibling nav | Journey / OT | No Center deep-link |
| Patient Journey | Post-surgery tab | Journey | SessionId enrichment = latest session (stale/wrong risk) |
| Appointments | Not from Center | Appointments service | Schedule Visit deferred |
| CCMS | Session coverage elsewhere | CCMS | Analytics is counselling, not claims |
| Analytics ↔ Center | Aging button | Different populations | Confusion if users equate KPIs |

---

## 18. E2E Coverage Audit

**Primary spec:** `e2e/counsellor-followup-analytics-phase1.spec.ts` (visual/fit + light UI).  
**Do not equate** `test:e2e:counselling` session waves with Follow-up Center coverage.

### Follow-up

| Capability | Status |
|------------|--------|
| Active / Cold / Post tabs | COVERED (smoke) |
| Search | COVERED |
| Intention filter | COVERED |
| Due-date UI removed | COVERED (negative) |
| Schedule Visit absent | COVERED (negative) |
| History | COVERED (data-dependent soft-pass) |
| Pagination | NOT COVERED |
| Branch | NOT COVERED |
| Contact / Reminder / Requeue | NOT COVERED |
| Session navigation assert | NOT COVERED |
| Auth denial | NOT COVERED |
| Empty / API error / mutation failure | NOT COVERED |

### Analytics

| Capability | Status |
|------------|--------|
| Page + funnel/trends/aging presence | COVERED (shallow) |
| Period 7/14/30 | COVERED |
| CSV / Print | NOT COVERED |
| Counselor filter | NOT COVERED |
| Branch / custom dates | NOT COVERED |
| Auth / empty / API error | NOT COVERED |
| Responsive 1920/1600/1280 | COVERED |
| Other viewports | NOT COVERED |

**No `test.skip` found** in phase1; environment depends on auth storage + live data.

---

## 19. Responsive Audit

| Viewport | Evidence |
|----------|----------|
| 1920 / 1600 / 1280 | E2E overflow ≤1px + screenshots |
| 1536 @ DPR 1.25 | **NOT CERTIFIED** in this audit |
| 1440 / 1366 / 1200 / 1024 | **NOT CERTIFIED** |
| Browser zoom / transform / DPR CSS | Not used for Center (good) |
| Priority columns | Below `sm`: Patient + Action only |
| Analytics charts | Measured shallowly in phase1; full usability not proven at all widths |

**Compare baseline:** Waiting List / Finalize use CSS work-grid classes; Center uses Tailwind grid string — family-consistent shell, grid SoT differs.

---

## 20. Product Gap Matrix

| ID | Area | Current State | Gap | Severity | Evidence | Decision Required? | Recommended Next Action |
|----|------|---------------|-----|----------|----------|--------------------|-------------------------|
| G01 | Due date | No authoritative due | Cannot answer “when is it due?” | **P1** | FollowupQueryContracts; date matrix | **Yes** | Product defines base field + rules; then engineer |
| G02 | Exit / lifecycle | Intention-only exit | Agree/surgery/complete leave patients in Active | **P1** | Quick-book / Complete leave intention | **Yes** | Define exit events; implement predicates |
| G03 | Ownership | CounselorId on session; not on Center DTO/UI | Cannot answer who owns follow-up | **P1** | FollowupListModels lack owner | **Yes** | Define assignee model (session counselor vs queue vs unassigned) |
| G04 | Priority / escalation | Alert from Escalation + never-contacted; writers missing | Priority not operationally trustworthy | **P1** | MapAlertLevel; no EscalationStatus writers | **Yes** | Define escalation writers/SLA or stop showing High Priority KPI |
| G05 | Reason model | Free-text ReasonsForDelay overloaded | Why-follow-up ambiguous | **P2** | Cancel overwrites ReasonsForDelay | **Yes** | Taxonomy + separate cancel reason |
| G06 | Status inclusion | No Status filter on Active/Cold | Cancelled may clutter workload | **P2** | FollowupListService predicates | **Yes** | Exclude Cancelled/NoShow? |
| G07 | Orphan intentions | WillingNow etc. excluded | Patients may vanish from Center | **P2** | Master vs Active allowlist | **Yes** | Include or migrate |
| G08 | Post-surgery exit | Discharged journeys forever (until undischarge) | No counsellor completion | **P2** | Journey-only population | **Yes** | Define post-surgery F/U done |
| G09 | Schedule Visit | Absent | Cannot book from Center | **P2** | E2E negative; ward appointment.create | **Yes** | Product: counsellor booking yes/no |
| G10 | Next action on row | Only in history logs | Weak “what next?” | **P2** | NextActionDate not on list DTO | Partial | Surface nextAction/callback if product agrees |
| G11 | Callbacks on queue | Separate API | Counsellor may miss scheduled callbacks | **P2** | DTOs omit callbacks | No (eng) | Optional enrichment |
| G12 | Reminder delivery | Log only | Reminder ≠ message sent | **P2** | Reminders handler | **Yes** | Delivery channel or rename UX |
| G13 | Post SessionId | Latest CreatedAt | Wrong session open | **P1** | FollowupListService enrichment | No | Link journey↔session or hide Open |
| G14 | Analytics agreed/undecided overlap | Possible double-count | Management metrics can mislead | **P2** | GetSummaryAsync predicates | **Yes** | Partition rules |
| G15 | Aging window vs period UI | Aging always ~365d | Supervisor misreads period pills | **P2** | FollowupAgingTable filters | **Yes** | Bind Aging to period or label clearly |
| G16 | Counsellor analytics filter UI | API only | Cannot answer “by counsellor?” in UI | **P2** | CounselorAnalyticsTab deferred | No (eng after product) | Surface counselorId filter |
| G17 | Drill-down KPIs | Absent | Cannot go aggregate→ops | **P2** | No KPI links | **Yes** | Map metrics→populations carefully |
| G18 | Branch hard isolation | Client optional | Cross-branch if client omits | **P1** (security) | APIs accept nullable branchId | **Yes** | Enforce branch policy for counselling roles? |
| G19 | Intention write validation | Free string | Bad codes escape allowlists | **P2** | UpdateSession / ReQueue | **Yes** | Server validate |
| G20 | E2E functional | Visual smoke | Mutations/auth/CSV untested | **P2** | phase1.spec | No | Expand E2E |
| G21 | EXPLAIN performance | Indexes exist | Not proven under load | **P2** | 188 + verify name-only | No | Run EXPLAIN ANALYZE on UAT PG |
| G22 | Age/sex on rows | Absent | Identity incomplete vs waiting list | **P3** | DTOs | No | Add if ops needs |
| G23 | Modal token drift | Blue/violet gradients | Visual inconsistency | **P3** | Contact/Reminder modals | No | Align counselling tokens |
| G24 | Doc staleness | Phase 2B/2D docs lag code | Misguides implementers | **P3** | Contract docs vs 188 / removed Schedule Visit | No | Refresh docs |
| G25 | High/Med/Low invention | AlertLevel exists from escalation | Must not invent new priority without writers | **P1** (process) | MapAlertLevel | **Yes** | Keep or replace with real SLA |

### Classification buckets

**A. IMPLEMENTED / PASS**  
Active/Cold/Post lists; search; pagination; filtered stats; branch filter param; contact/history/requeue/reminder log; Analytics Summary/Trends/Aging; CSV/print UI; auth gates; migration 188; removal of +7/+30/+14 from Center; Schedule Visit absence intentional.

**B. IMPLEMENTED BUT NEEDS VALIDATION**  
Responsive beyond 3 viewports; index effectiveness (EXPLAIN); Summary partition under messy data; Post-surgery SessionId enrichment; Aging future SessionDate edge; reminder UX meaning.

**C. PRODUCT DECISION REQUIRED**  
Due date; exit lifecycle; ownership; escalation/SLA writers; reason taxonomy; Schedule Visit; orphan intentions; status exclusion; post-surgery done; analytics partition; aging period binding; branch hard isolation; KPI drill-down mapping.

**D. ENGINEERING GAP**  
DTO owner/next-action/callback enrichment; intention write validation; SessionId linking; counsellor filter UI; KPI drill-down after decisions; modal token alignment; doc refresh.

**E. E2E COVERAGE GAP**  
Contact/reminder/requeue; pagination; auth denial; CSV/print; empty/error; mutation failure; most viewports; counselor filter.

**F. PERFORMANCE VALIDATION GAP**  
EXPLAIN ANALYZE; `%q%` at scale; Cold sort without supporting index; branch/counselor composite filters.

---

## 21. Product Decisions Required

1. **Authoritative Follow-up due date** (field + formula per population) — or explicitly “no due date; use LastContact / Callback / Discharge aging only.”  
2. **Exit rules** when patient agrees, is scheduled, surgery done, session completed, referred, or post-surgery counselling finished.  
3. **Ownership model** (session CounselorId vs queue assignee vs unassigned vs escalation).  
4. **Escalation / priority** — who writes EscalationStatus / OverdueSinceDate; meaning of High Priority KPI.  
5. **Structured follow-up / delay reasons** vs free text; cancel reason separation.  
6. **Include orphan master intentions** in Active?  
7. **Exclude Cancelled/Completed** from Active/Cold?  
8. **Post-surgery counsellor completion** criteria.  
9. **Schedule Visit** for counsellors — yes/no, appointment type, permissions.  
10. **Reminder** = real delivery vs “log reminder intent.”  
11. **Analytics partition** for agreed/declined/undecided (overlap/gap rules).  
12. **Aging date window** vs Summary period pills.  
13. **Drill-down mapping** PendingDecision → which operational queue.  
14. **Branch isolation** mandatory vs optional for counselling roles.

---

## 22. Engineering Work Required (after decisions)

1. Implement approved due/exit/ownership/escalation rules server-side (never FE heuristics).  
2. Validate intention allowlist on write.  
3. Fix or remove misleading Post-surgery Open Session when SessionId is opportunistic.  
4. Surface counselor filter on Analytics UI.  
5. Align Aging period with product decision; fix KPI drill-down without duplicate worklists.  
6. Optional: nextAction/callback enrichment on list DTOs.  
7. EXPLAIN ANALYZE on UAT PostgreSQL for 188 indexes.  
8. Expand E2E for mutations, auth, CSV, errors, remaining viewports.  
9. Refresh Phase 2B/2D contract docs to match code.  
10. Align Contact/Reminder modal styling to counselling tokens.

---

## 23. Recommended Implementation Order

| Phase | Focus | Gate |
|-------|-------|------|
| **2W** | Product workshop — decide G01–G14 items; written SoT | No code until decisions signed |
| **2X** | Lifecycle + exit + ownership + intention validation (server) | P1 closures |
| **2Y** | Due/priority **only if decided**; else remove/relabel misleading High Priority KPI | Avoid fake SLA |
| **2Z** | Analytics consistency (period/aging, partition, counselor UI, safe drill-down) | Management trust |
| **2AA** | Schedule Visit **only if approved** via existing Appointments | Else keep out of scope |
| **2AB** | EXPLAIN validation + E2E functional expansion | Production readiness |
| **2AC** | UX polish (tokens, unused fields, docs) | P3 |

---

## 24. Explicit Out-of-Scope Items (this phase & until approved)

- Creating a `FollowUps` table for counselling Center  
- Inventing due dates / SLA / High-Medium-Low without writers  
- Implementing Schedule Visit / appointment permissions for counsellors  
- Merging Active intention with Analytics PendingDecision  
- Changing Analytics formulas without evidence of inconsistency **and** product approval  
- Merging legacy `/api/FollowUps` with Counseling Follow-up Center  
- UI redesign / new design system  
- Modifying production code, fixtures, or E2E in Phase 2V  
- Claiming EXPLAIN-proven performance  

---

## Appendix A — Key file index

| Layer | Path |
|-------|------|
| Follow-up page | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx` |
| Presentation | `apps/hospital-portal-web/src/lib/counsellors-desk/followup-presentation.ts` |
| Analytics page | `apps/hospital-portal-web/src/app/dashboard/counselor/analytics/page.tsx` |
| Aging UI | `apps/hospital-portal-web/src/components/counselor/FollowupAgingTable.tsx` |
| Contracts | `microservices/auth-service/AuthService/Services/FollowupQueryContracts.cs` |
| Lists | `…/Services/FollowupListService.cs` |
| Analytics | `…/Services/CounselingAnalyticsService.cs` |
| Indexes | `consolidated/migrations/188_counseling_followup_analytics_indexes.sql` |
| E2E | `apps/hospital-portal-web/e2e/counsellor-followup-analytics-phase1.spec.ts` |
| Phase 2B doc (may lag) | `apps/hospital-portal-web/docs/counseling-followups-phase2b-api-contract.md` |
| Phase 2D doc (may lag) | `apps/hospital-portal-web/docs/counseling-analytics-phase2d-api-contract.md` |

## Appendix B — Doc vs code discrepancies found

| Prior doc claim | Current code |
|-----------------|--------------|
| Due-date heuristics “remain frontend” (2B) | Removed from Center FE; BE never authoritative |
| Schedule Visit / reminder delivery “unchanged” | Schedule Visit absent; reminder log-only |
| Analytics indexes “candidates → Phase 2E” | Migration 188 present |
| COUNSELOR_MODULE_REFERENCE mock analytics paths | Live Phase 2D Analytics at `/dashboard/counselor/analytics` |
| Archive BACKEND_FOLLOWUP guide / Phase2_FollowUp_Tables | Parallel clinical FollowUps domain — not Center |

**CURRENT CODE WINS.** Prior docs that conflict are stale.

---

*End of Phase 2V audit. Stop — no production implementation in this phase.*
