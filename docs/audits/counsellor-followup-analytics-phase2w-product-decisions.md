# Phase 2W — Counsellor Follow-up Center + Analytics  
## Product / Hospital Operations Decision Gate

**Date:** 2026-09-11  
**Phase type:** PRODUCT DECISION / SPECIFICATION ONLY — **no code implementation**  
**Inputs:** Phase 2V audit (`docs/audits/counsellor-followup-analytics-phase2v-audit.md`) + current repository code  
**Rule:** Where the repository does not establish an authoritative hospital rule, status is **PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**. Do not treat proposed options as approved.

**Sign-off required before any Phase 2X+ engineering:**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Counselling Operations Lead | | | |
| Clinical / Patient-flow Lead (post-surgery) | | | |
| Hospital IT / Platform Owner | | | |
| Product Owner | | | |

---

## 1. Executive Summary

Phase 2V found Follow-up Center + Analytics **technically substantial** but **not operationally complete**. The binding blockers are product/business rules, not selector cleanup.

This document converts gaps G01–G25 into an explicit decision pack. **Almost all P1 product rules remain unsigned.** Engineering must not invent due dates, SLA, priority, ownership, exit rules, appointment permissions, or analytics partition changes.

| Category | Count (this gate) |
|----------|-------------------|
| Locked from code (confirm or change) | Few — populations, permissions, population splits |
| Ready for interim engineering (safety / honesty only) | Few — e.g. SessionId Open risk, High Priority honesty |
| **Blocked — hospital / clinical ops decision** | Majority of PD1–PD16 |

**Overall Phase 2W status:** **DECISION GATE OPEN — IMPLEMENTATION BLOCKED**

---

## 2. Product Goal

### Follow-up Center (counsellor shift)

A counsellor must answer from one operational worklist:

1. Who needs my attention?  
2. Why does this patient need follow-up?  
3. What happened previously?  
4. What should I do next?  
5. Who owns this follow-up?  
6. What is the priority?  
7. What happened after my follow-up?  
8. When is this follow-up considered complete?  
9. Which existing hospital workflow should I use next?

### Analytics (supervisor / management)

1. How much counselling happened?  
2. How many patients reached a decision?  
3. How many agreed / declined / remain undecided?  
4. How much follow-up workload exists?  
5. Why are patients pending?  
6. How effective are follow-ups?  
7. How does performance vary by branch / counsellor / procedure / time?  
8. Where are bottlenecks?  
9. Can management move from an insight to the correct operational queue/workflow?

**Non-goals for this gate:** UI redesign, new design system, merging Active with PendingDecision, merging legacy `/api/FollowUps`, inventing +7/+30/+14.

---

## 3. Follow-up Conceptual Model

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED** (model structure proposed for approval; values/rules unsigned)

### RATIONALE

Phase 2V showed overloaded semantics (`ReasonsForDelay`, intention vs pending decision, alert without writers). Concepts must stay distinct before fields or UI are added.

### CURRENT SYSTEM

| Concept | Today’s representation | Overload risk |
|---------|------------------------|---------------|
| Patient intention | `PatientIntention` string on `counseling_sessions` | Also drives Active/Cold population |
| Follow-up / delay reason | `ReasonsForDelay` free text | Cancel reason overwrites same field |
| Communication outcome | Comm log `Outcome` | Not a population key |
| Next action | Comm log `NextActionDate` (+ notes) | Not on Center list DTO |
| Callback | `counselor_callback_requests.CallbackDate` | Separate API; not on Center rows |
| Due date | **None authoritative** for Center | Old +7/+30/+14 removed / non-authoritative |
| Priority | Derived `AlertLevel` from `EscalationStatus` + never-contacted | Escalation writers incomplete |
| Escalation | `EscalationStatus` on session | Mostly unread/unwritten |
| Closure / exit | Intention change or soft-delete / journey change | No explicit “follow-up complete” |

### APPROVED BEHAVIOR (pending sign-off of conceptual separation)

Adopt this **conceptual separation** (names may map to existing or new fields later):

| Letter | Concept | Meaning | Must not be |
|--------|---------|---------|-------------|
| **A** | Patient intention | Patient disposition toward surgery / counselling readiness | Not due date; not communication outcome |
| **B** | Follow-up reason | Why counsellor must act (barrier / request) | Not cancel reason by default |
| **C** | Communication outcome | Result of a contact attempt | Not intention |
| **D** | Next action | What staff should do next + optional date | Not generic SLA due |
| **E** | Callback | Patient/staff-scheduled callback event | Not merged into generic due without decision |
| **F** | Due date | Operational “act by” if product chooses one | Not SessionDate+N heuristics |
| **G** | Priority | Ordering / attention signal if product chooses one | Not invented High/Med/Low without writers |
| **H** | Escalation | Supervisor / SLA breach path if product chooses one | Not cosmetic KPI |
| **I** | Closure / exit | Explicit leave of Center population | Not silent side effect of unrelated status |

### SOURCE OF TRUTH

Conceptual model: this document after sign-off.  
Field mapping: still PRODUCT DECISION per PD5–PD9.

### AFFECTED POPULATIONS

Active, Cold, Post-Surgery, Analytics (read of same session fields).

### FRONTEND / BACKEND / DATABASE / AUTHORIZATION / E2E IMPACT

None until signed; then cascade into PD5–PD12 implementations.

### MIGRATION REQUIRED

Unknown until field mapping chosen.

### OPEN QUESTIONS

Which concepts become persisted columns vs derived? Which stay log-only?

---

## 4. Active Population Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**

**LOCKED FROM CODE (confirm or change):** Current Active allowlist is exactly seven codes in `FollowupQueryContracts.ActiveIntentions`. Orphans must not be silently added.

### RATIONALE

Active is the primary counsellor workload. Ambiguous exit and orphan master codes create invisible or sticky patients.

### CURRENT SYSTEM

`PatientIntention ∈ { WillingWeek, WillingMonth, WillingQuarter, WillingCallToConfirm, Undecided, WaitingFinancial, WaitingFear }`  
No `Status` filter. Agree / complete / quick-book do **not** clear intention.  
Master also seeds: `WillingNow`, `WillingTwoWeeks`, `WillingSixMonths`, `SecondOpinion` — **not** in Active.

### APPROVED BEHAVIOR

_Fill after workshop. Template:_

| Intention | Keep in Active? Y/N | Operational meaning | Counsellor next action | Planned next action required? | Due date required? | Leaves Active when… |
|-----------|---------------------|---------------------|------------------------|-------------------------------|--------------------|---------------------|
| WillingWeek | | | | | | |
| WillingMonth | | | | | | |
| WillingQuarter | | | | | | |
| WillingCallToConfirm | | | | | | |
| Undecided | | | | | | |
| WaitingFinancial | | | | | | |
| WaitingFear | | | | | | |

**Orphans (must choose explicitly):**

| Code | Option | Notes |
|------|--------|-------|
| WillingNow | Include in Active / Map to existing / Deprecate / Leave orphan | Do not silent-include |
| WillingTwoWeeks | same | |
| WillingSixMonths | same | |
| SecondOpinion | same | |

**Exit triggers to decide (Y/N per event):** agreement; surgery scheduling; surgery completion; session cancellation; session completion; explicit closure.

### SOURCE OF TRUTH (after sign-off)

Server allowlist + write validation; FE filter mirrors server.

### AFFECTED POPULATIONS

Active lists, Active stats, re-queue intention writes, session Decision UI.

### FRONTEND IMPACT

Intention filter labels; row “why”; empty orphan handling.

### BACKEND IMPACT

Allowlist; optional Status exclusions; exit predicates; write validation (ties to G19).

### DATABASE IMPACT

Possibly intention data cleanup migration for orphans — only if chosen.

### AUTHORIZATION IMPACT

Unchanged unless ownership (PD7) changes who may set intention.

### E2E IMPACT

Allowlist + exit scenarios.

### MIGRATION REQUIRED

Only if remapping orphan intentions or backfilling exits.

### OPEN QUESTIONS

1. Are all seven still Active?  
2. Per-intention counsellor SOP?  
3. Orphan policy?  
4. Exit on agree / schedule / complete / cancel?

---

## 5. Cold Population Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**

**LOCKED FROM CODE (confirm or change):** Cold = `Declined` | `ReferredElsewhere` only.

### RATIONALE

Cold may be workload or archive. Re-engagement without policy creates compliance / contact risk.

### CURRENT SYSTEM

Cold intention set as above. Sort by `UpdatedAt ?? CreatedAt`. Re-queue can move out. No opt-out flag. No due date. No forced next action.

### APPROVED BEHAVIOR

_Workshop must answer:_

1. Is every Declined patient a follow-up candidate?  
2. Should ReferredElsewhere remain in counsellor workload?  
3. Re-engagement policy (if any) — **do not invent interval**?  
4. Is next action required?  
5. Is due date required?  
6. When does Cold leave the workload?  
7. Explicit patient opt-out of future contact?

### SOURCE OF TRUTH

Intention allowlist + exit rules after sign-off.

### AFFECTED POPULATIONS

Cold list/stats; Analytics declined (different formula — do not equate).

### FRONTEND / BACKEND / DATABASE / AUTHORIZATION / E2E IMPACT

Depends on exit/opt-out/re-engagement choices.

### MIGRATION REQUIRED

Only if opt-out field or Cold exit history required.

### OPEN QUESTIONS

As listed 1–7 above.

---

## 6. Post-Surgery Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**

**LOCKED FROM CODE:** Population = `patient_journey.IsDischarged == true` (not counselling intention). Clinical post-op visits exist separately (IP).

### RATIONALE

Without a counsellor responsibility definition, Post-Surgery is an unbounded discharged list. Merging clinical post-op dates into counsellor due dates without decision is forbidden.

### CURRENT SYSTEM

Journey discharged rows; enrich discharge summary, pending incomplete post-op visits, opportunistic latest counseling `SessionId`. KPI Over30Days from `DischargedAt`. FE ≥30d presentation cue. No counsellor “complete” state. Schedule Visit absent.

### APPROVED BEHAVIOR

_Workshop must choose counsellor responsibility (one or more, or none):_

- [ ] Appointment coordination  
- [ ] Patient contact / wellbeing call  
- [ ] Satisfaction follow-up  
- [ ] Clinical follow-up coordination  
- [ ] Financial / admin closure  
- [ ] Other: ________  
- [ ] **Remove Post-Surgery from Counsellor Center** (clinical/ward only)

Then define:

1. Which clinical post-op milestones appear in Center (display only vs actionable)?  
2. Which remain exclusively clinical/ward?  
3. What makes counsellor post-surgery follow-up **complete**?  
4. Separate operational completion state? Y/N  

**Interim engineering safety (may proceed without inventing clinical SOP — product may approve as interim):**

- Do not treat opportunistic `SessionId` as authoritative Open Session until journey↔session link exists (G13).

### SOURCE OF TRUTH

Journey SoT for population; counsellor completion SoT TBD.

### AFFECTED POPULATIONS

Post-Surgery tab/stats; IP post-op; Appointments if Schedule Visit later.

### FRONTEND IMPACT

Row purpose, actions, Open Session visibility, completion action if any.

### BACKEND IMPACT

Exit predicate; SessionId enrichment policy; optional completion flag — only if decided.

### DATABASE IMPACT

Possible completion flag on journey or counselling side — only if decided. **Do not create FollowUps table yet.**

### AUTHORIZATION IMPACT

If clinical actions: need clinical permissions — do not invent.

### E2E IMPACT

Post-surgery entry/exit/completion.

### MIGRATION REQUIRED

Only if completion state approved.

### OPEN QUESTIONS

Responsibility scope; completion criteria; relationship to ward `FollowUpAppointmentPanel`.

---

## 7. Due Date Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**  
**Most important unresolved P1 (G01).**

**LOCKED FROM CODE:** `+7 / +30 / +14` are **not** authoritative and must not be revived.

### RATIONALE

No Center due SoT exists. Implementing any formula without hospital sign-off invents clinical/ops policy.

### CURRENT SYSTEM

| Date | Role today |
|------|------------|
| SessionDate | Session calendar; Analytics window |
| DecisionDate | Decision; Waiting List FollowUpDate projection when RepeatCounselling |
| LastContactDate | Sort / never-contacted / alert heuristic |
| NextActionDate | Per communication log |
| CallbackDate | Callback entity |
| DischargedAt | Post-surgery aging KPI |
| Clinical post-op dates | IP / clinical |
| Waiting List FollowUpDate | Projection, not Center due |

### APPROVED BEHAVIOR — choose **exactly one**

**OPTION A — Dedicated operational Follow-up Due Date**  
If chosen, define:

| Item | Value |
|------|-------|
| Source field / table | |
| Writer (role + API) | |
| Owner | |
| Populations that use it | Active / Cold / Post / none |
| Missing-date behavior | |
| Timezone semantics | |
| Relationship to CallbackDate / NextActionDate | |

**OPTION B — Reuse existing date with explicit semantic mapping**  
If chosen, map per population:

| Population | Authoritative date field | Meaning |
|------------|--------------------------|---------|
| Active | | |
| Cold | | |
| Post-Surgery | | |

**OPTION C — No generic due date** (recommended framing if hospital cannot define A/B quickly)  
UI replaces “Due/Overdue” with explicit separate signals:

- Next action date (if present)  
- Callback date (if present)  
- Contact aging (never contacted / last contact)  
- Discharge aging (post-surgery)  

No single “overdue” badge unless defined under Priority (PD6).

### SOURCE OF TRUTH

Whichever option is signed; never FE heuristics.

### AFFECTED POPULATIONS

All Center tabs; possibly Analytics; overdue endpoint semantics.

### FRONTEND IMPACT

Remove or relabel any implied due; show chosen signals only.

### BACKEND IMPACT

No due formula until signed; if A, new field + writers; if C, stop implying due via High Priority without SLA.

### DATABASE IMPACT

A → new column/table decision; B/C → none for due.

### AUTHORIZATION IMPACT

Who may set due (if A).

### E2E IMPACT

Due absence or due rules as signed.

### MIGRATION REQUIRED

Only Option A (or B backfill).

### OPEN QUESTIONS

Which option? Per-population mapping? Timezone (UTC calendar vs branch local)?

---

## 8. Priority Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**

**Do NOT invent High/Medium/Low.**

### RATIONALE

UI shows alert / High Priority KPI, but escalation writers are incomplete → **misleading operational priority** (G04/G25).

### CURRENT SYSTEM

`MapAlertLevel(EscalationStatus, LastContactDate)`:

- SupervisorAlert → Critical  
- Escalated → High  
- Overdue → Medium  
- never contacted → Medium  
- else Normal  

UrgentHigh KPI = SupervisorAlert | Escalated.  
Almost no service writers set Escalation/OverdueSince; Answered* can reset Overdue→Normal.

### APPROVED BEHAVIOR — choose model

| Model | Description |
|-------|-------------|
| **None** | Remove/relabel High Priority KPI; show contact aging only |
| **SLA-based** | Define SLA clocks + writers (requires due or contact SLA) |
| **Callback priority** | Scheduled callbacks surface first |
| **Clinical escalation** | Clinical events drive escalation (define events) |
| **Operational priority** | Explicit staff/supervisor set priority |
| **Other** | ________ |

If priority exists, workshop must fill:

| Attribute | Value |
|-----------|-------|
| Inputs | |
| Calculation | |
| Owner | |
| Persistence | |
| Update trigger | |
| Escalation threshold | |
| De-escalation | |
| UI meaning | |

**Interim honesty (engineering after product approves interim):**  
Either (a) hide UrgentHigh KPI until writers exist, or (b) label as “Escalation status (manual/incomplete)” — product picks a or b.

### SOURCE OF TRUTH

Signed model + server writers.

### AFFECTED POPULATIONS

Active primarily; stats KPIs.

### FRONTEND / BACKEND / DATABASE / AUTHORIZATION / E2E IMPACT

Depends on model; SLA may need new fields.

### MIGRATION REQUIRED

Only if new priority persistence.

### OPEN QUESTIONS

Keep EscalationStatus vocabulary? Who sets SupervisorAlert?

---

## 9. Ownership Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**

### RATIONALE

Counsellor cannot answer “who owns this?” — `CounselorId` exists on session but is not on Center DTOs/UI (G03). Must align with existing `counseling_sessions.read/update` and branch policy (PD16).

### CURRENT SYSTEM

Session may have `CounselorId`. Center list DTOs omit owner. Lists filter by tenant (+ optional branch), not by assignee. Analytics API supports `counselorId` filter; UI deferred. Queue entries on re-queue have operational waiting-list ownership patterns separate from Center.

### APPROVED BEHAVIOR — choose

| Option | Model |
|--------|-------|
| **A** | Session `CounselorId` is Follow-up owner |
| **B** | Explicit Follow-up Assignee (new field) |
| **C** | Queue / branch ownership only (no personal owner) |
| **D** | Unassigned until claimed |
| **E** | Hybrid (define rules) |

Then define:

| Rule | Value |
|------|-------|
| Who can see | |
| Who can act | |
| Who can reassign | |
| Supervisors see all? | |
| Branch behavior | (link PD16) |
| Audit trail | |

### SOURCE OF TRUTH

Signed ownership field + authz rules.

### AFFECTED POPULATIONS

All Center lists; Analytics counsellor filter; reassign UX.

### FRONTEND IMPACT

Owner column; claim/reassign; “my follow-ups” filter if D/E.

### BACKEND IMPACT

DTO projection; optional filter `assigneeId` / `counselorId`; reassign API if needed.

### DATABASE IMPACT

B → new assignee column; A → reuse session field.

### AUTHORIZATION IMPACT

Must use existing permission patterns; do not invent roles without IAM alignment.

### E2E IMPACT

Visibility / reassign / claim.

### MIGRATION REQUIRED

If B or backfill A.

### OPEN QUESTIONS

Is session counsellor always the follow-up owner after handoff? Multi-counsellor teams?

---

## 10. Reason Taxonomy Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**

**Do NOT automatically adopt the example list.**

### RATIONALE

`ReasonsForDelay` is free text and overloaded with cancel reason (G05).

### CURRENT SYSTEM

Free-text `ReasonsForDelay`; Waiting List projects as FollowUpReason for RepeatCounselling; cancel writes into same field; template targeting exists for delay codes; no AuthService enum master for delay reasons.

### APPROVED BEHAVIOR

Hospital must provide **actual** taxonomy (or choose “remain free text”).

Example candidates for discussion only (not approved):

- Financial; Insurance / pre-auth; Family decision; Patient undecided; Scheduling; Patient requested callback; Additional counselling; Medical concern; Patient unreachable; Declined; Referred elsewhere; Other  

Also decide field separation:

| Concept | Same field as ReasonsForDelay? | Separate field? |
|---------|--------------------------------|-----------------|
| Follow-up reason | | |
| Delay reason | | |
| Cancellation reason | | |

### SOURCE OF TRUTH

Master data vs free text after sign-off.

### AFFECTED POPULATIONS

Session Decision; Waiting List; Center “why”; Analytics “why pending” (if surfaced).

### FRONTEND / BACKEND / DATABASE / AUTHORIZATION / E2E IMPACT

Structured master → pickers + validation; cancel must stop overwriting follow-up reason if separated.

### MIGRATION REQUIRED

If structured codes + backfill.

### OPEN QUESTIONS

Hospital taxonomy; cancel vs delay separation.

---

## 11. Lifecycle / Exit Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED** (P1 G02)

### RATIONALE

Without exit rules, Active never shrinks when patients convert. Do not assume a state machine from the example list.

### CURRENT SYSTEM

Implicit: intention drives Active/Cold; discharge drives Post-Surgery; re-queue can move; no “Completed follow-up” state.

### APPROVED BEHAVIOR

**Required:** Exit matrix (Y = leave population / N = stay / Move = to other tab):

| Event | Active | Cold | Post-Surgery |
|-------|--------|------|--------------|
| Patient agrees | | | |
| Surgery booked | | | |
| Surgery completed | | | |
| Session completed | | | |
| Patient declines | | | |
| Referred elsewhere | | | |
| Patient requests no further contact | | | |
| Follow-up completed (explicit) | | | |
| Post-surgery counselling completed | | | |
| Session cancelled | | | |

**Optional lifecycle labels** (only if hospital wants explicit states — examples not assumed):

_New / Needs contact / Contact attempted / Contacted / Action pending / Scheduled / Converted / Declined / Referred / Completed / Closed_ — tick which are required, or “no separate lifecycle; use intention + exit matrix only.”

### SOURCE OF TRUTH

Server population predicates after sign-off.

### AFFECTED POPULATIONS

All Center tabs; stats; Analytics workload interpretation.

### FRONTEND IMPACT

Remove sticky rows; completion actions; clear “done” UX.

### BACKEND IMPACT

Exit predicates on list queries and/or writers that clear intention / set completion.

### DATABASE IMPACT

Possible completion / closed flags — only if decided. **No FollowUps table yet.**

### AUTHORIZATION IMPACT

Who may close.

### E2E IMPACT

Entry/exit scenarios per event.

### MIGRATION REQUIRED

Possibly clear stale Active rows after rule change.

### OPEN QUESTIONS

Full exit matrix; whether explicit lifecycle states are needed beyond intention.

---

## 12. Schedule Visit Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED** (G09)

**LOCKED FROM CODE:** Schedule Visit is intentionally absent from Center. Ward uses `appointment.create` via FollowUpAppointmentPanel.

### RATIONALE

Booking is a clinical/ops permission boundary; do not invent counsellor appointment permissions.

### CURRENT SYSTEM

No Center Schedule Visit. Appointments API: `appointment.view/create/update/cancel/delete`. Reminder ≠ booking.

### APPROVED BEHAVIOR — choose one

| Option | Meaning |
|--------|---------|
| **A** | Counsellors may book appointments from Center |
| **B** | Counsellors may only navigate to existing appointment workflow |
| **C** | Counsellors may request an appointment (task/request, not slot book) |
| **D** | No appointment action in Center (status quo) |

If **A**, also define:

| Item | Value |
|------|-------|
| Appointment type | |
| Doctor / clinic ownership | |
| Branch | |
| Slot selection | |
| Duplicate handling | |
| Permissions | (must map to existing `appointment.*` or approved new code) |
| Cancellation | |
| Post-booking Center behavior | (exit? stay? next action?) |

### SOURCE OF TRUTH

Appointments service if A/B; Center remains non-booking if D.

### AFFECTED POPULATIONS

Active / Post-Surgery primarily.

### FRONTEND / BACKEND / DATABASE / AUTHORIZATION / E2E IMPACT

A → major; B → deep-link only; C → request entity TBD; D → none.

### MIGRATION REQUIRED

Unlikely for D/B; possible for C.

### OPEN QUESTIONS

Counsellor vs ward ownership of post-op visits; conflict with IP follow-up booking.

---

## 13. Reminder Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED** (G12)

### RATIONALE

API creates outbound/log intent; no proven delivery pipeline. UI must not imply message sent.

### CURRENT SYSTEM

`POST …/patients/{id}/reminders` → communication log; JourneyId on request unused; no SMS/WhatsApp/email send proven in Center path.

### APPROVED BEHAVIOR — choose

| Option | Meaning |
|--------|---------|
| **A** | Send actual patient communication |
| **B** | Record a reminder task for staff |
| **C** | Record reminder intent only (honest label) |
| **D** | Remove the Reminder action |

If **A**, choose channel(s): SMS / WhatsApp / email / phone task / other — and name the owning integration service.

### SOURCE OF TRUTH

Signed semantics + integration owner.

### AFFECTED POPULATIONS

All tabs with Reminder.

### FRONTEND IMPACT

Rename button/copy; success toast must match reality.

### BACKEND IMPACT

A → delivery integration; B → task model; C → label only; D → deprecate endpoint usage.

### DATABASE IMPACT

Depends on A/B.

### AUTHORIZATION IMPACT

Possibly separate send permission — do not invent without IAM.

### E2E IMPACT

Reminder success/failure semantics.

### MIGRATION REQUIRED

Unlikely for C/D.

### OPEN QUESTIONS

Delivery vendor; consent; JourneyId persistence.

---

## 14. Callback Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED** (G11; ties to PD5)

### RATIONALE

Callbacks are first-class entities but invisible on Center rows. Merging CallbackDate into generic due without decision is forbidden.

### CURRENT SYSTEM

Schedule/complete/reschedule callback APIs; Contact modal can schedule callback; Analytics counts callbacks; Center DTOs omit next callback.

### APPROVED BEHAVIOR

| Question | Answer |
|----------|--------|
| Appear directly in Follow-up Center? | Y/N |
| Placement | row badge / column / filter / separate sub-tab / none |
| Priority relationship | |
| Show callback date? | |
| Show callback status? | |
| Ownership | |
| Completion from Center? | |
| Reschedule from Center? | |
| Relationship to generic Due Date | **separate** unless PD5 Option A/B explicitly maps |

### SOURCE OF TRUTH

`counselor_callback_requests` remains callback SoT.

### AFFECTED POPULATIONS

Active/Cold primarily; Analytics callbacks.

### FRONTEND / BACKEND IMPACT

DTO enrichment + actions if yes.

### DATABASE IMPACT

None if reuse existing table.

### AUTHORIZATION IMPACT

Existing update permission unless narrowed.

### E2E IMPACT

Callback visible / complete / reschedule.

### MIGRATION REQUIRED

No.

### OPEN QUESTIONS

Today’s callbacks worklist vs Center embedding.

---

## 15. Analytics Partition Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED** (G14)

**Do NOT change formulas without this sign-off.**

### RATIONALE

Current predicates allow overlap (agreed + pending) and a gap (null agreed + not pending).

### CURRENT SYSTEM

- agreed = `PatientAgreedToSurgery == true`  
- declined = agreed false AND pending false  
- undecided = `PendingDecision == true`  
- conversion = agreed/total  
- decision rate = (agreed+declined)/total  

### APPROVED BEHAVIOR

Define **mutually exclusive** management buckets and precedence:

| Case | Wins / bucket |
|------|----------------|
| agreed + pending | |
| declined + pending | |
| null agreement + not pending | |
| agreed + not pending | |
| declined + not pending | |
| pending + null agreed | |

Then redefine:

| Metric | Formula after partition |
|--------|-------------------------|
| agreed | |
| declined | |
| pending / undecided | |
| conversion rate | |
| decision rate | |

### SOURCE OF TRUTH

`CounselingAnalyticsService` after approved change; document in Phase 2D contract update.

### AFFECTED POPULATIONS

Analytics Summary/Trends/funnel; **not** Follow-up Active (intention).

### FRONTEND IMPACT

KPI copy if definitions change.

### BACKEND IMPACT

Formula change + tests.

### DATABASE IMPACT

None (unless data cleanup of inconsistent flags).

### AUTHORIZATION IMPACT

None.

### E2E IMPACT

Metric assertions.

### MIGRATION REQUIRED

Data cleanup optional if flags inconsistent.

### OPEN QUESTIONS

Precedence; whether PendingDecision and PatientAgreedToSurgery are co-constrained on write.

---

## 16. Analytics Aging Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED** (G15)

**LOCKED FROM CODE:** Aging population = `PendingDecision` only — **not** Follow-up Active intentions. Do not merge.

### RATIONALE

Summary/Trends use 7/14/30; Aging defaults to 365d with FE not passing period → ambiguous management meaning.

### CURRENT SYSTEM

Buckets 0–3, 4–7, 8–14, 15+ by days since SessionDate; FE passes branchId only.

### APPROVED BEHAVIOR — choose

| Option | Meaning |
|--------|---------|
| **A** | Aging follows selected Summary period |
| **B** | Aging remains 365-day operational backlog |
| **C** | Separate Aging date control |
| **D** | Other |

UI must label unambiguously (e.g. “Pending decisions — last 365 days” vs “within selected period”).

### SOURCE OF TRUTH

Signed window rule + FE wiring.

### AFFECTED POPULATIONS

Aging only (PendingDecision).

### FRONTEND IMPACT

Pass period or dedicated control; copy.

### BACKEND IMPACT

Already supports period/from/to — wiring decision.

### DATABASE IMPACT

None.

### AUTHORIZATION IMPACT

None.

### E2E IMPACT

Period vs aging consistency cases.

### MIGRATION REQUIRED

No.

### OPEN QUESTIONS

Bucket boundaries stay 0–3/4–7/8–14/15+?

---

## 17. Analytics Drill-down Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED** (G17)

**Do NOT create duplicate worklists.**

### RATIONALE

Management needs insight → workflow. Wrong mapping (PendingDecision → Active Center) confuses ops.

### CURRENT SYSTEM

Aging row → Session; Aging button → Center (no filters; population mismatch disclaimer exists). No KPI drill-down.

### APPROVED BEHAVIOR — mapping table

| Metric / insight | Destination | Filters passed | Or no drill-down |
|------------------|-------------|----------------|------------------|
| Total sessions | Waiting List / Session search / none / other | | |
| Agreed | | | |
| Declined | | | |
| Undecided / PendingDecision | **must resolve** | | |
| Conversion | | | |
| Aging bucket row | Session (keep?) / other | | |
| Surgery mix row | | | |
| Follow-up workload (Center stats) | Center tab | | |

**Critical:** PendingDecision → which operational queue?

Candidates (choose one): Waiting List (if queue reflects pending); filtered session list (API); Center **only if** product redefines Active to include PendingDecision (currently **forbidden merge** without explicit decision); no drill-down.

### SOURCE OF TRUTH

Signed mapping; reuse existing routes only.

### AFFECTED POPULATIONS

Analytics UX; possibly new filtered list API — not a second patient store.

### FRONTEND IMPACT

Links from KPIs with query params.

### BACKEND IMPACT

May need filtered list endpoints matching analytics predicates.

### DATABASE IMPACT

None.

### AUTHORIZATION IMPACT

Same read permission unless destination differs.

### E2E IMPACT

Drill-down navigation + population assertions.

### MIGRATION REQUIRED

No.

### OPEN QUESTIONS

PendingDecision destination; whether to remove misleading Center button until mapped.

---

## 18. Branch Isolation Decision

### DECISION

**STATUS: PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED** (G18 P1 security/ops)

### RATIONALE

Tenant isolation is strong; branchId is optional on APIs — client can omit and see tenant-wide counselling data.

### CURRENT SYSTEM

UI sends `selectedBranchId ?? user.branchId`. APIs accept nullable `branchId`. RLS is tenant-scoped.

### APPROVED BEHAVIOR — choose

| Option | Meaning |
|--------|---------|
| **A** | Branch restricted (server enforces user’s branch) |
| **B** | Multi-branch (explicit allow-list) |
| **C** | Tenant-wide for counselling roles |
| **D** | Supervisor-dependent (counsellor A, supervisor C/B) |

If **A** or **D**: define **server-side** enforcement (not client-only).

### SOURCE OF TRUTH

AuthZ policy + API enforcement after sign-off.

### AFFECTED POPULATIONS

All Counseling follow-up/analytics endpoints.

### FRONTEND IMPACT

Branch picker visibility; cannot clear branch if A.

### BACKEND IMPACT

Mandatory branch from JWT claims / role policy.

### DATABASE IMPACT

None.

### AUTHORIZATION IMPACT

Core — align with hospital IAM.

### E2E IMPACT

Cross-branch denial tests.

### MIGRATION REQUIRED

No.

### OPEN QUESTIONS

Which roles are supervisors? Multi-branch counsellor reality?

---

## 19. Approved UX Implications

### STATUS

**Conceptual only — no redesign / no implementation in 2W.**  
Visual language: Waiting List / Finalize Surgery counselling ops shell.

### Follow-up Center row story (target after decisions)

```
WHO → WHY → HISTORY → NEXT ACTION → OWNER → PRIORITY → OUTCOME
```

| Slot | Shows (after decisions) | Must avoid |
|------|-------------------------|------------|
| WHO | Name, UHID, phone, procedure; age/sex if G22 approved | Card clutter |
| WHY | Intention and/or structured reason — not overloaded free text alone | Pill spam |
| HISTORY | Last contact + attempts; drawer for full log | Duplicate status layers |
| NEXT ACTION | NextAction / Callback / Open session / Requeue — as signed | Fake Schedule Visit |
| OWNER | Per PD7 | Invented assignee UI |
| PRIORITY | Per PD6 or absent | Fake High/Med/Low |
| OUTCOME / EXIT | Closure path per PD11 | Silent disappear |

Compact worklist; meaningful KPIs only; Contact/Reminder tokens aligned to counselling system (G23 — after semantics PD11).

### Analytics story (target)

```
WHAT HAPPENED → WHY → WHERE → WHO → WHAT NEEDS ATTENTION
```

KPI hierarchy → trends → aging → **drill to existing workflows** (PD15). Counsellor filter if PD16/PD7 allow (G16). Aging label matches PD14. No second worklist.

---

## 20. Data Model Implications

| If decision… | Possible data impact | Create FollowUps table? |
|--------------|----------------------|-------------------------|
| PD5 Option A | New due field on session or related | **No by default** |
| PD7 Option B | Assignee field | No |
| PD8 structured | Master codes + column | No |
| PD9 / PD6 exit/completion | Completion / closed flags | No unless later approved |
| PD11 A/B reminder | Task or integration refs | No |
| PD4 post-surgery complete | Journey or counselling completion | No |
| Default | Reuse `counseling_sessions`, logs, callbacks, journey | **Do not create FollowUps table yet** |
| Legacy | `/api/FollowUps` / `follow_up_appointment` | **Do not merge** |

---

## 21. API Implications

| Area | Possible changes after sign-off |
|------|----------------------------------|
| Follow-up lists | Exit predicates; owner; nextAction; callback summary; Status filter |
| Stats | Align with exit/priority honesty |
| Intention write | Allowlist validation (G19) once Active/Cold signed |
| Reminders | Semantics/labels or delivery |
| Appointments | Only if PD10 A |
| Analytics Summary | Partition formulas if PD13 |
| Aging | Period param wiring if PD14 A/C |
| Branch | Mandatory branch if PD16 A/D |
| Drill-down | Filtered list endpoints matching analytics — reuse populations |

**Unchanged until signed:** PatientIntention semantics; Analytics formulas; Active≠PendingDecision split.

---

## 22. Database Implications

| Item | Now | After decisions |
|------|-----|-----------------|
| Migration 188 indexes | Present | Keep; EXPLAIN validate (G21) |
| New columns | None in 2W | Only if PD5A / PD7B / PD8 / completion signed |
| FollowUps table | Out of scope | Remains out of scope until separate approval |
| Intention data | Orphans possible | Cleanup only if PD2 orphan policy |

---

## 23. Authorization Implications

| Current | After decisions |
|---------|-----------------|
| `counseling_sessions.read` / `.update` | Remain baseline unless IAM expands |
| Branch optional | May become enforced (PD16) |
| Owner filter | May restrict list (PD7) |
| `appointment.create` | Only if PD10 A grants counsellors |
| `followup.*` legacy | Stay separate |

Do not invent permission codes in engineering without IAM approval.

---

## 24. E2E Implications

After decisions + implementation phases:

| Area | Required coverage |
|------|-------------------|
| Populations | Active/Cold/Post entry/exit per matrix |
| Actions | Contact, reminder (per semantics), requeue, history, session nav |
| Authz | read/update denial; branch isolation if A/D |
| Analytics | partition metrics; aging window; counselor filter; CSV/print; drill-down |
| Negatives | no +7/+30/+14; Schedule Visit only if A |
| Responsive | expand beyond 1920/1600/1280 |

Phase 1 visual suite remains insufficient alone.

---

## 25. Implementation Sequence

| Phase | Gate | Work |
|-------|------|------|
| **2W** | **This document signed** | Decisions only |
| **2X** | PD2/3/4 exit + PD7 ownership + PD9 lifecycle + G19 allowlist validation + G13 SessionId safety | Server population honesty |
| **2Y** | PD5 due + PD6 priority signed (or explicit Option C / no priority) | Due/priority UI honesty |
| **2Z** | PD13–PD15 + G16 | Analytics trust + drill-down |
| **2AA** | PD10 + PD11 + PD12 | Visit / reminder / callback |
| **2AB** | After above | EXPLAIN + functional E2E |
| **2AC** | P3 | Tokens, age/sex if approved, docs |

**No Phase 2X start until sign-off table at top is complete for P1 decisions (PD5, PD6, PD7, PD9, PD16, PD4 responsibility, PD2 exits).**

---

## 26. Open Questions (master list)

1. Due date Option A / B / C?  
2. Active allowlist confirm + orphan policy?  
3. Exit matrix for agree / book / complete / cancel / close?  
4. Cold re-engagement + opt-out?  
5. Post-surgery counsellor responsibility + completion?  
6. Priority model or none?  
7. Ownership A–E?  
8. Reason taxonomy + cancel separation?  
9. Lifecycle states beyond intention?  
10. Schedule Visit A–D?  
11. Reminder A–D + channel?  
12. Callbacks on Center?  
13. Analytics mutually exclusive partition?  
14. Aging window A–D?  
15. PendingDecision drill-down destination?  
16. Branch isolation A–D?  
17. Is High Priority KPI interim-hidden until writers exist?  
18. Age/sex on Center rows (G22)?  

---

# Final gate summary (required terminal deliverable)

## 1. Decisions ready for implementation

**None of the P1 product rules are signed yet.**

**Ready only as “confirm current code locks” (not full product SOP):**

- Active allowlist of seven codes (confirm or change — do not silent-expand).  
- Cold = Declined | ReferredElsewhere (confirm or change).  
- Post-Surgery = discharged journeys (confirm responsibility separately).  
- Active ≠ PendingDecision aging (must remain split unless explicit merge decision).  
- Permissions baseline `counseling_sessions.read/update`.  
- Do not revive +7/+30/+14.  
- Do not merge legacy `/api/FollowUps`.  
- Schedule Visit remains absent until PD10 ≠ D.

**Interim engineering candidates (require explicit product “interim approve” checkbox, still no invented SLA):**

- G13: do not present opportunistic Post-Surgery SessionId as authoritative Open.  
- G04 honesty: hide or relabel High Priority KPI until escalation writers exist.  
- G12 honesty: Reminder copy = intent/log until PD11 chooses A.  
- G23/G24: token alignment + doc refresh (P3, non-behavioral).

## 2. Decisions still blocked

**All of:** PD1 values, PD2–PD16 operational choices (due, priority, ownership, exit, post-surgery SOP, Schedule Visit, reminder, callback surfacing, analytics partition, aging window, drill-down, branch isolation, reason taxonomy).

## 3. P0 / P1 / P2 / P3 implications

| Severity | Implication |
|----------|-------------|
| **P0** | None newly identified; do not ship invented due/SLA that misleads clinical ops |
| **P1** | Blocked: due (G01), exit (G02), ownership (G03), priority writers (G04), SessionId (G13), branch (G18) |
| **P2** | Blocked or deferred: reason, status inclusion, orphans, post complete, Schedule Visit, next action, callbacks, reminder, analytics partition/aging/drill-down/filter, intention validation, E2E, EXPLAIN |
| **P3** | age/sex, modal tokens, stale docs — after P1/P2 |

## 4. Exact implementation order

See §25: **2W sign-off → 2X lifecycle/ownership → 2Y due/priority → 2Z analytics → 2AA visit/reminder/callback → 2AB EXPLAIN/E2E → 2AC polish.**

## 5. Data-model changes required

**Unknown until sign-off.** Possible later: due field, assignee, structured reason, completion flags. **FollowUps table: not approved.**

## 6. API changes required

**Unknown until sign-off.** Likely: list DTO enrichment, exit predicates, intention validation, analytics formula (if PD13), branch enforcement, optional appointment wiring.

## 7. UI changes required

**Unknown until sign-off.** Conceptual: WHO→WHY→HISTORY→NEXT→OWNER→PRIORITY→OUTCOME; Analytics WHAT→WHY→WHERE→WHO→ATTENTION with honest labels and drill-down to existing workflows.

## 8. E2E tests required

Functional coverage for populations/exits/actions/authz/analytics/drill-down/responsive — after implementation phases (§24).

## 9. Performance tests required

EXPLAIN ANALYZE on UAT PostgreSQL for migration 188 query shapes (G21) — after or parallel to 2AB; does not unblock product decisions.

## 10. Explicit items that must remain unchanged (until separate approval)

- No production/frontend/backend/database/E2E changes in Phase 2W  
- No FollowUps table  
- No merge of legacy `/api/FollowUps` into Center  
- No merge of Active intention with Analytics PendingDecision  
- No invented due dates / SLA / High-Medium-Low  
- No invented appointment permissions  
- No silent Analytics formula change  
- No silent PatientIntention semantic change  
- No silent state machine  
- No UI redesign / new design system  
- No revival of +7/+30/+14  

---

## Workshop checklist (print / use in meeting)

- [ ] PD2 Active allowlist + orphans + exits  
- [ ] PD3 Cold policy  
- [ ] PD4 Post-surgery responsibility + completion  
- [ ] PD5 Due Option A/B/C  
- [ ] PD6 Priority model or none  
- [ ] PD7 Ownership A–E  
- [ ] PD8 Reason taxonomy  
- [ ] PD9 Exit matrix  
- [ ] PD10 Schedule Visit A–D  
- [ ] PD11 Reminder A–D  
- [ ] PD12 Callbacks on Center  
- [ ] PD13 Analytics partition  
- [ ] PD14 Aging window  
- [ ] PD15 Drill-down map (esp. PendingDecision)  
- [ ] PD16 Branch isolation  
- [ ] Sign-off table completed  

---

*End of Phase 2W. STOP — no production implementation.*
