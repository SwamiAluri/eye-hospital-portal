# Phase 2W — Follow-up Center + Analytics
## Hospital Operations Workshop Decision Pack

| Field | Value |
|-------|--------|
| **Date** | ____________________ |
| **Document type** | Workshop decision capture (not an implementation specification) |
| **Primary SoT** | `docs/audits/counsellor-followup-analytics-phase2w-product-decisions.md` |
| **Supporting audit** | `docs/audits/counsellor-followup-analytics-phase2v-audit.md` |
| **Rule** | Where the repository does not establish an authoritative hospital rule: **PRODUCT / CLINICAL OPERATIONS DECISION REQUIRED**. Do not infer hospital policy from code. |

### Workshop participants

| Role | Name | Present? |
|------|------|----------|
| Counselling Operations Lead | ____________________ | [ ] |
| Clinical / Patient-flow Lead | ____________________ | [ ] |
| Hospital IT / Platform Owner | ____________________ | [ ] |
| Product Owner | ____________________ | [ ] |
| Additional attendee | ____________________ | [ ] |
| Additional attendee | ____________________ | [ ] |

**STATUS:** WORKSHOP / DECISION CAPTURE ONLY — **working decisions recorded; formal sign-off pending**

**IMPLEMENTATION:** BLOCKED UNTIL FORMAL SIGN-OFF

**Phase 2X:** Must not begin until the Phase 2W Workshop Gate at the end of this pack is **SIGNED** and consistency checks pass. Working decisions alone do **not** authorize Phase 2X.

> **Working decisions captured from the Phase 2W product-decision workshop. These are not formal hospital sign-offs. Formal sign-off remains pending.**

---

## Live Decision Capture Table (working)

| PD | Decision | Selected Option | Final Rule (working summary) | Owner | Effective | Exceptions | Notes | Sign-off | Status |
|----|----------|-----------------|------------------------------|-------|-----------|------------|-------|----------|--------|
| PD2 | Active Population | **A** | Seven Active intentions; orphans excluded; stay Active until surgery **completed** (booking ≠ exit); Next Action required; exhausted contact sequence → explicit exit | TBD | TBD | TBD | See PD2 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD3 | Cold Population | **A** | Declined + ReferredElsewhere; re-engagement allowed; exit via closure / re-engage / opt-out; no arbitrary time auto-exit; due/Next Action not auto-required | TBD | TBD | TBD | See PD3 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD4 | Post-Surgery Responsibility | **A** | Remains in Counsellor Center for defined non-clinical coordination; clinical/Ward authoritative; counsellor completion ≠ clinical completion | TBD | TBD | TBD | See PD4 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD5 | Due Date | **C** | No generic Center due / invented SLA; Next Action + business-event dates; **no** +7/+30/+14 | TBD | TBD | TBD | See PD5 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD6 | Priority / Escalation | **A** | No formal priority until hospital-approved model; do not treat UI High Priority as authoritative | TBD | TBD | TBD | See PD6 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD7 | Ownership | **A** | `CounselorId` is owner; one owner; supervisor reassignment; no new IAM role; respect PD16 | TBD | TBD | TBD | See PD7 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD8 | Reason Taxonomy | **C** | Structured Follow-up Reason + optional notes; keep Reason / Outcome / Delay / Next Action distinct | TBD | TBD | TBD | See PD8 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD9 | Lifecycle / Exit | **A** | Intention + exit matrix only; **surgery booked ≠ Active exit**; surgery **completed** exits Active; no separate state machine unless separately approved | TBD | TBD | TBD | See PD9 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD10 | Schedule Visit | **B** | Navigate to existing authorized appointment workflow; no duplicate booking/tables/permissions | TBD | TBD | TBD | See PD10 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD11 | Reminder | **B** | Staff follow-up task; not proof of patient contact/delivery | TBD | TBD | TBD | See PD11 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD12 | Callback | **B** / existing callback integration | Surface existing callbacks as actionable owner items; existing SoT; not a generic due date | TBD | TBD | TBD | See PD12 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD13 | Analytics Partition | **A** | Mutually exclusive; PendingDecision ≠ Active; precedence + Exception/Other rules; formulas deferred to Phase 2Z after formal authorization | TBD | TBD | TBD | See PD13 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD14 | Analytics Aging | **C** / separate aging view | Separate PendingDecision backlog; own period control; default **365 days**; does not inherit Summary period | TBD | TBD | TBD | See PD14 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD15 | Analytics Drill-down | **A** | Population-safe destinations; PendingDecision → session list (not Active Center); Aging → Follow-up Center PendingDecision filter | TBD | TBD | TBD | See PD15 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD16 | Branch Isolation | **D** | Supervisor-dependent; server-side authorization is security boundary; client filter ≠ security; technical verification pending implementation | TBD | TBD | TBD | See PD16 working rule | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |

**Formal fields still required for SIGNED status:** Owner (real), Effective From, Exceptions (**None** if none), Notes (**None** if none), Sign-off Name / Role / Date. Cross-decision consistency review: **20 PASS / 0 CONDITIONAL / 0 CONFLICTS** (see Phase 2W Cross-Decision Consistency Review). Formal stakeholder sign-off still required before Phase 2W SIGNED / Phase 2X authorization.

---

## Why this workshop exists (keep central)

### Follow-up Center — counsellor shift questions

1. Who needs my attention?
2. Why does this patient need follow-up?
3. What happened previously?
4. What should I do next?
5. Who owns this follow-up?
6. What is the priority?
7. What happened after my follow-up?
8. When is this follow-up considered complete?
9. Which existing hospital workflow should I use next?

### Analytics — management questions

1. How much counselling happened?
2. How many patients reached a decision?
3. How many agreed / declined / remain undecided?
4. How much follow-up workload exists?
5. Why are patients pending?
6. How effective are follow-ups?
7. How does performance vary by branch / counsellor / procedure / time?
8. Where are bottlenecks?
9. Can management move from an insight to the correct operational queue/workflow?

This workshop decides hospital-operational rules. It is **not** a software data-model design session.

**Forbidden during workshop (engineering later, only after sign-off):** inventing due/SLA/priority; merging Active with Analytics `PendingDecision`; merging legacy `/api/FollowUps`; reviving SessionDate+7 / +30 / DecisionDate+14; creating a FollowUps table; inventing appointment permissions or clinical SOPs.

---

## How to capture each decision

For every PD below:

- Discuss options **without** pre-selecting.
- Mark **exactly one** Hospital decision checkbox (or Other).
- Fill Final rule, Owner, Effective from, Exceptions, Notes, Sign-off.
- Leave blank what is not decided — do not guess.

---

### PDx template (reference only)

Business question → Current system behavior → Decision options → Hospital decision (unchecked) → Final rule → Owner → Effective from → Exceptions → Notes → Sign-off.

---

# Decisions PD2–PD16

---

### PD2 — Active Population

Business question:  
Which patient intentions belong in the counsellor’s **Active** follow-up workload, what does each mean operationally, and when does a patient leave Active?

Current system behavior:  
Active allowlist is exactly seven codes in `FollowupQueryContracts.ActiveIntentions`: `WillingWeek`, `WillingMonth`, `WillingQuarter`, `WillingCallToConfirm`, `Undecided`, `WaitingFinancial`, `WaitingFear`. No `Status` filter. Agree / complete / quick-book do **not** clear intention. Master also seeds orphans **not** in Active: `WillingNow`, `WillingTwoWeeks`, `WillingSixMonths`, `SecondOpinion`. Orphans must not be silently added.

Decision options:  
A. Confirm the current seven remain Active; dispose orphans by explicit map/deprecate/leave-orphan (no silent include)  
B. Change the Active allowlist (add/remove codes — list in Final rule)  
C. Replace intention-based Active with another population rule (define in Final rule)  
D. Other

Hospital decision:  
[x] A  
[ ] B  
[ ] C  
[ ] D  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Active Follow-up consists of these seven approved intentions: WillingWeek, WillingMonth, WillingQuarter, WillingCallToConfirm, Undecided, WaitingFinancial, WaitingFear.

The following remain excluded/orphan intentions: WillingNow, WillingTwoWeeks, WillingSixMonths, SecondOpinion.

A patient who agrees remains in Active Follow-up until surgery is COMPLETED. Surgery BOOKING does NOT remove the patient from Active. Every Active patient must have a planned Next Action. If the hospital-defined contact/escalation sequence is exhausted, the patient exits Active through an explicitly approved closure/destination. Do not invent the contact-sequence duration or SLA.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option A. Orphans left orphan (not silent-include). Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD3 — Cold Population

Business question:  
Which declined / referred patients remain counsellor **Cold** workload, is re-engagement allowed, and when does Cold end?

Current system behavior:  
Cold = `Declined` | `ReferredElsewhere` only. Sort by `UpdatedAt ?? CreatedAt`. Re-queue can move out. No opt-out flag. No due date. No forced next action. Analytics “declined” uses a **different** formula — do not equate Cold with Analytics declined without decision.

Decision options:  
A. Keep both Declined and ReferredElsewhere in Cold workload with explicit exit/re-engagement rules below  
B. Keep Declined only; remove or archive ReferredElsewhere from counsellor workload  
C. Cold is archive-only (view/history, not active workload)  
D. Other

Hospital decision:  
[x] A  
[ ] B  
[ ] C  
[ ] D  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Cold contains Declined and ReferredElsewhere. Re-engagement is allowed where appropriate. Cold exits through: explicit closure; approved re-engagement/move; explicit patient opt-out. Do not introduce arbitrary time-based automatic exit. A generic due date or Next Action is not automatically required solely because a patient is in Cold.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option A. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD4 — Post-Surgery Responsibility

Business question:  
What is the **counsellor’s** responsibility for discharged patients in Follow-up Center Post-Surgery, and what makes that work complete — without merging clinical post-op ownership?

Current system behavior:  
Population = `patient_journey.IsDischarged == true` (not counselling intention). Enrichment: discharge summary, pending incomplete post-op visits, opportunistic latest counseling `SessionId`. KPI Over30Days from `DischargedAt`. No counsellor “complete” state. Schedule Visit absent from Center. Clinical post-op booking exists separately (IP / Ward `FollowUpAppointmentPanel` with `appointment.create`). Opportunistic SessionId is **not** proven authoritative for Open Session (G13).

Decision options:  
A. Keep Post-Surgery in Counsellor Center with defined counsellor responsibilities below  
B. Remove Post-Surgery from Counsellor Center (clinical/ward only)  
C. Display-only discharged list (no counsellor completion actions)  
D. Other

Hospital decision:  
[x] A  
[ ] B  
[ ] C  
[ ] D  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Post-Surgery remains within the Counsellor Center for defined non-clinical coordination/follow-up responsibilities. Clinical assessment and post-operative decisions remain governed by the existing clinical/Ward workflow. Counsellor completion means completion of the counsellor's defined operational responsibilities. Clinical/overall patient journey completion is NOT equivalent to counsellor follow-up completion. Existing Ward/IP workflow remains authoritative and is not replaced.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option A. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD5 — Due Date

Business question:  
Does Follow-up Center have an authoritative operational “act by” date — and if not, which separate signals do counsellors use?

Current system behavior:  
**No** authoritative Center due date. SessionDate, DecisionDate, LastContactDate, NextActionDate (comm log), CallbackDate, DischargedAt, clinical post-op dates, and Waiting List FollowUpDate projection exist for other purposes. `+7 / +30 / +14` heuristics are **not** authoritative and **must not be revived**.

Decision options:  
A. Dedicated operational Follow-up Due Date  
B. Reuse an existing date with explicit semantic mapping  
C. No generic due date (use separate signals only)  
D. Other

Hospital decision:  
[ ] A  
[ ] B  
[x] C  
[ ] D  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

No generic Follow-up Center due date or arbitrary SLA is introduced. Follow-up timing is driven by explicit Next Action and authoritative business-event dates where applicable. Do NOT restore or introduce the old +7 / +30 / +14 date heuristics. Do not label a patient Due/Overdue based on an invented calculation.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option C. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD6 — Priority / Escalation

Business question:  
Should Follow-up Center order patients by priority/escalation, and what does “High Priority” mean operationally?

Current system behavior:  
`MapAlertLevel(EscalationStatus, LastContactDate)` can show Critical/High/Medium/Normal. UrgentHigh KPI = SupervisorAlert | Escalated. Escalation writers are largely incomplete; never-contacted can map to Medium. UI concepts exist without a complete write path → **misleading** if treated as hospital SLA.

Decision options:  
A. No priority model  
B. SLA-based  
C. Callback priority  
D. Clinical escalation  
E. Operational / manual priority  
F. Other

Hospital decision:  
[x] A  
[ ] B  
[ ] C  
[ ] D  
[ ] E  
[ ] F  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

No formal priority classification is introduced until a hospital-approved priority/escalation model is defined. Existing High Priority information must not be represented as an authoritative clinical or operational priority. Do not infer priority from age of follow-up, patient intention, number of contact attempts, arbitrary dates, or invented SLA.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option A. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD7 — Ownership

Business question:  
Who owns a follow-up row — who can see, act, claim, reassign, and close?

Current system behavior:  
Session may have `CounselorId`. Center list DTOs omit owner. Lists filter by tenant (+ optional branch), not assignee. Analytics API supports `counselorId` filter; UI deferred. Permissions today: `counseling_sessions.read` / `.update`. Do **not** invent new IAM roles in this workshop without IAM ownership present.

Decision options:  
A. Session `CounselorId` is follow-up owner  
B. Dedicated Follow-up Assignee (new field — only if signed later)  
C. Queue / branch ownership only  
D. Unassigned until claimed  
E. Hybrid (define in Final rule)  
F. Other

Hospital decision:  
[x] A  
[ ] B  
[ ] C  
[ ] D  
[ ] E  
[ ] F  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Existing CounselorId is the follow-up owner. One designated owner exists at a time. The assigned counsellor can see and act on the follow-up within authorized scope. Reassignment is performed by an authorized supervisor or appropriate existing operational role. No new IAM role should be created solely for Follow-up Center ownership. Ownership must respect PD16 branch authorization.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option A. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD8 — Reason Taxonomy

Business question:  
Is Follow-up Reason free text or a hospital-approved structured list — and how is it separated from delay/barrier and cancellation reasons?

Current system behavior:  
`ReasonsForDelay` is free text and can be overloaded (e.g. cancel reason overwrites same field). Intention (`PatientIntention`) is separate. Communication outcome is separate (comm log). Example categories in Phase 2W are **not** approved taxonomy — hospital must supply the list or choose free text.

Decision options:  
A. Remain free text (with clear separation rules vs cancel / delay)  
B. Structured taxonomy — hospital provides **approved** list in Notes / attachment  
C. Hybrid (structured primary + free-text “other”)  
D. Other

Hospital decision:  
[ ] A  
[ ] B  
[x] C  
[ ] D  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Use a structured Follow-up Reason with optional supporting notes. Keep these concepts distinct: Follow-up Reason; Communication Outcome; Delay/Barrier; Next Action. Do not overload one reason field with these different meanings. Use hospital-approved taxonomy when available.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option C. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD9 — Lifecycle / Exit

Business question:  
When does a patient leave Active, Cold, or Post-Surgery — and are separate lifecycle states required?

Current system behavior:  
Implicit: intention drives Active/Cold; discharge drives Post-Surgery; re-queue can move; no explicit “Completed follow-up” state. Agree / schedule / complete do not automatically clear Active intention.

Decision options:  
A. Intention + exit matrix only — **no** separate lifecycle states  
B. Explicit lifecycle states required (list exact states in Final rule — do not infer a state machine)  
C. Other

Hospital decision:  
[x] A  
[ ] B  
[ ] C  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Use intention + explicit exit matrix. Do NOT introduce a separate lifecycle state machine unless separately approved.

Active: Undecided → STAY; Agreed surgery not booked → STAY; Agreed surgery booked but not completed → STAY; Surgery completed → EXIT Active → approved next workflow/Post-Surgery process; Declined → EXIT Active → Cold; ReferredElsewhere → EXIT Active → Cold; Explicit patient opt-out → EXIT; Hospital-defined contact/escalation sequence exhausted → EXIT to approved closure/destination.

Cold: remains while applicable; re-engagement → EXIT Cold → approved Active/workflow; opt-out → EXIT; explicit closure → EXIT.

Post-Surgery: counsellor responsibilities incomplete → STAY; counsellor responsibilities complete → EXIT Post-Surgery.

CRITICAL: Surgery BOOKED is NOT an Active exit. Surgery COMPLETED is the transition out of Active. Surgery booked ≠ follow-up completed. Clinical completion ≠ counsellor completion. Do not invent contact-sequence timing.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option A. Critical: booked stays Active until completed. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD10 — Schedule Visit

Business question:  
May counsellors book or request appointments from Follow-up Center, or only navigate / do nothing?

Current system behavior:  
Schedule Visit is **intentionally absent** from Center. Ward uses `appointment.create` via FollowUpAppointmentPanel. Appointments API permissions: `appointment.view/create/update/cancel/delete`. Do **not** invent counsellor appointment permissions in this workshop.

Decision options:  
A. Counsellor can book appointments  
B. Counsellor can only navigate to existing appointment workflow  
C. Counsellor can request an appointment (not slot book)  
D. No appointment action in Center  
E. Other

Hospital decision:  
[ ] A  
[x] B  
[ ] C  
[ ] D  
[ ] E  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Schedule Visit navigates to the existing authorized appointment workflow. Follow-up Center does not introduce independent appointment-booking logic, duplicate appointment tables, or new counsellor-specific appointment permissions. Existing appointment availability, conflict handling, and authorization remain authoritative.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option B. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD11 — Reminder

Business question:  
What does “Reminder” mean — actual patient message, staff task, intent/log only, or remove?

Current system behavior:  
`POST …/patients/{id}/reminders` writes communication log / outbound intent. No proven SMS/WhatsApp/email delivery in the Center path. UI must not imply a message was sent unless delivery is proven.

Decision options:  
A. Actual patient communication  
B. Staff reminder task  
C. Reminder intent / log only  
D. Remove Reminder action  
E. Other

Hospital decision:  
[ ] A  
[x] B  
[ ] C  
[ ] D  
[ ] E  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Reminder creates an actionable staff follow-up task. Reminder creation does NOT mean patient contacted, reminder delivered, or communication successful. Actual communication/contact outcome must come from the appropriate communication workflow. Do not represent reminder creation as proof of patient communication.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option B. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD12 — Callback

Business question:  
Should callbacks appear in Follow-up Center, how, and how do they relate to generic due date?

Current system behavior:  
Callbacks live in `counselor_callback_requests` (`CallbackDate`) via separate APIs. Not surfaced as Center list columns today. **Keep CallbackDate separate from generic Due Date** unless the hospital deliberately maps them under PD5.

Decision options:  
A. Surface callbacks in Follow-up Center (define where below)  
B. Keep callbacks only in existing callback workflows (not Center)  
C. Hybrid (badge only / filter only — define below)  
D. Other

Hospital decision:  
[ ] A  
[x] B  
[ ] C  
[ ] D  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Existing callback requests are surfaced in Follow-up Center as actionable, owner-based follow-up items. Existing callback data/workflow remains the source of truth. Do NOT create a duplicate callback system. Callback completion requires an actual callback outcome. Rescheduled callbacks remain actionable. Callback timing does not automatically become a generic Follow-up Center due date under PD5. (Workshop working selection: B / existing callback integration.)

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option B / existing callback integration. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD13 — Analytics Partition

Business question:  
How should management KPIs partition agreed / declined / pending so buckets are mutually exclusive and trustworthy?

Current system behavior:  
- agreed = `PatientAgreedToSurgery == true`  
- declined = agreed false AND pending false  
- undecided = `PendingDecision == true`  
- conversion = agreed/total  
- decision rate = (agreed+declined)/total  

Formulas **permit overlap** (agreed + pending) and a **gap** (null agreement + not pending). **Do not change Analytics formulas before this is signed.** Active Follow-up (intention allowlist) remains **conceptually separate** from Analytics `PendingDecision` unless explicitly approved to merge (currently forbidden without that decision).

Decision options:  
A. Adopt mutually exclusive buckets with precedence filled below (keep Active ≠ PendingDecision)  
B. Also redefine Active to align with PendingDecision (**explicit merge approval required**)  
C. Other

Hospital decision:  
[x] A  
[ ] B  
[ ] C  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

**Selected option:** A — Mutually exclusive classification.

Analytics shall use a mutually exclusive outcome partition. **PendingDecision is distinct from Active Follow-up** and must not be silently merged with Active.

**Working classification / precedence:**

| Case | Working classification |
|------|------------------------|
| 1. PendingDecision + Agreed | **PendingDecision** takes precedence |
| 2. Declined + PendingDecision | **Separate/Exception** classification |
| 3. Agreed + Declined | **Separate/Exception** classification |
| 4. PendingDecision only | **PendingDecision** |
| 5. Agreed only | **Agreed** |
| 6. Declined only | **Declined** |
| 7. No recognized outcome flags | **Other/Unclassified** |

**Exception handling:** Exception is **NOT** an outcome. Exception records remain part of Total Sessions; are excluded from the normal outcome funnel; are excluded from outcome percentages; must be surfaced separately as an Exception count for operational/data-quality review. Do not silently force contradictory records into Agreed, Declined, or PendingDecision.

**Other/Unclassified handling:** Other/Unclassified is **NOT** an outcome. These records remain part of Total Sessions; are excluded from the normal outcome funnel; are excluded from outcome percentages; must be surfaced separately as an Other/Unclassified count.

**Recommended percentage denominator (working):**  
Eligible Outcome Sessions = Total Sessions − Exception − Other/Unclassified  

- Conversion % = Agreed / Eligible Outcome Sessions × 100  
- Decision % = (Agreed + Declined) / Eligible Outcome Sessions × 100  

**Implementation hold:** These formulas are **not** authorization to change the existing Analytics implementation yet. Phase **2Z** will reconcile these classification rules with existing approved formulas after **formal sign-off**. Implementation must **not** proceed until the Phase 2W Final Gate is formally authorized.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option A with explicit precedence + Exception/Other rules. Formal sign-off pending. Do not implement Analytics formula changes until Final Gate AUTHORIZED.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD14 — Analytics Aging

Business question:  
What time window and population does Aging represent for management?

Current system behavior:  
Aging population = **`PendingDecision` only** — **not** Follow-up Active intentions. Do **not** merge. Buckets 0–3, 4–7, 8–14, 15+ by days since SessionDate. FE historically passes branch more than period → ambiguous vs Summary 7/14/30. UI must eventually state the window unambiguously.

Decision options:  
A. Aging follows selected Summary period  
B. Aging remains 365-day operational backlog  
C. Separate Aging date control  
D. Other

Hospital decision:  
[ ] A  
[ ] B  
[x] C  
[ ] D  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

Aging remains a separate PendingDecision backlog view. It has its own period control. Default Aging period = 365 days. Aging does NOT automatically inherit the Summary/Trends period. Aging population remains PendingDecision only. (Workshop working selection: C / Separate aging view.)

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option C / separate aging view. Formal sign-off pending.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD15 — Analytics Drill-down

Business question:  
From each Analytics insight, which **existing** hospital workflow should management open — without creating duplicate worklists?

Current system behavior:  
Aging row → Session; Aging button → Center (no filters; population mismatch disclaimer exists). No KPI→worklist drill-down. **Do not** map `PendingDecision` to Active Follow-up Center unless the hospital explicitly changes that population definition.

Decision options:  
A. Approve the mapping table below (reuse existing routes only)  
B. No drill-down for most KPIs until populations are redefined  
C. Other

Hospital decision:  
[x] A  
[ ] B  
[ ] C  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

**Selected option:** A — Population-safe destination mapping.

**Principle:** Every Analytics metric must drill into a destination whose population actually corresponds to the metric. Do not route every metric to Follow-up Center merely because Follow-up Center exists. No Analytics drill-down should create a duplicate worklist; reuse the authoritative operational destination/worklist wherever possible.

**Working mapping:**

| Metric | Destination |
|--------|-------------|
| 1. Total Sessions | Filtered Counselling Session list |
| 2. Agreed | Filtered Counselling Session list, Agreed population |
| 3. Declined | Filtered Counselling Session list, Declined population |
| 4. PendingDecision / Undecided | Filtered Counselling Session list, PendingDecision population |
| 5. Conversion | Filtered Counselling Session list, Agreed population, same approved Analytics scope/window/filter context |
| 6. Aging bucket | Follow-up Center, filtered to the corresponding PendingDecision population |
| 7. Surgery mix | Filtered Counselling Session list for the selected surgery |
| 8. Follow-up workload | Follow-up Center |

**CRITICAL SAFETY RULE:** PendingDecision must **NOT** automatically drill into **Active** Follow-up Center. PendingDecision and Active Follow-up are distinct populations unless the hospital formally redefines Active.

Exact destination/filter mapping remains explicit before implementation. Implementation must **not** proceed until the Phase 2W Final Gate is formally authorized (Phase **2Z** for Analytics drill-down).

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option A with population-safe mapping. Formal sign-off pending. Do not implement drill-down until Final Gate AUTHORIZED.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

### PD16 — Branch Isolation

Business question:  
How are Follow-up Center and Analytics scoped by branch — as security, not only UI filter?

Current system behavior:  
Tenant JWT + RLS are strong. Branch filter is largely **client-optional** on Center. Do **not** rely on client-side branch filtering as security.

Decision options:  
A. Branch restricted (server-enforced)  
B. Explicit multi-branch allow-list  
C. Tenant-wide counselling access  
D. Supervisor-dependent  
E. Other

Hospital decision:  
[ ] A  
[ ] B  
[ ] C  
[x] D  
[ ] E  
[ ] Other: __________

Final rule:  
**WORKING DECISION — NOT FORMALLY SIGNED**

**Selected option:** D — Supervisor-dependent.

**Security principle:** **Server-side** branch authorization is the security boundary. A **client-side** branch filter is **NOT** a security control.

**Working rule:**

- Normal counsellor users may access only branch data they are authorized to access.  
- Multi-branch/supervisor users may access only explicitly authorized branches.  
- A branch filter is a presentation/filtering mechanism only.  
- The API/server must independently enforce branch authorization.  
- Tenant isolation remains mandatory.  
- A client-supplied `branchId` must never grant access to an otherwise unauthorized branch.  
- Authorization must be evaluated server-side for relevant Follow-up Center and Analytics operations.  
- Do not invent new permissions or silently broaden existing access.  

**Technical verification:** The implementation phase must verify actual server-side authorization behavior before PD16 is considered **technically** complete. This documentation update closes the **product-decision** conditional only; it does **not** claim production enforcement has been implemented or tested.

Owner / responsible role:  
TBD — Pending Formal Sign-off

Effective from:  
TBD — Pending Formal Sign-off

Exceptions:  
TBD — Pending Formal Sign-off

Notes:  
Working decision Option D. Formal sign-off pending. Product rule explicit; technical server-side verification remains an implementation responsibility after authorization.

Sign-off:  
Name: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Role: PENDING FORMAL STAKEHOLDER SIGN-OFF  
Date: PENDING FORMAL STAKEHOLDER SIGN-OFF

---

## Cross-Decision Consistency

After capturing PD2–PD16, validate that decisions do not conflict.  
If conflict: mark **DECISION CONFLICT — REQUIRES WORKSHOP RESOLUTION**. Do **not** resolve automatically.

---

# Phase 2W Cross-Decision Consistency Review

**Review status:**  
**20 PASS · 0 CONDITIONAL · 0 CONFLICTS**

Working decisions (PD2–PD16) remain **WORKING — NOT FORMALLY SIGNED** / **PENDING FORMAL STAKEHOLDER SIGN-OFF**. This review is **not** implementation authorization and does **not** make Phase 2W SIGNED. Prior CONDITIONAL items **16 / 18 / 20** are closed as **product-decision PASS** (see detail below). Technical verification of PD16 server-side enforcement remains an **implementation** responsibility and is **not** claimed as done by this documentation update.

| # | Cross-decision check | Result | Finding / Required follow-up |
|---|---|---|---|
| 1 | Active ↔ Lifecycle Exits | **PASS** | Active population and lifecycle exits are consistent; surgery booking does not exit Active; surgery completion does. |
| 2 | Cold ↔ Lifecycle Exits | **PASS** | Cold population and explicit Cold exit rules are consistent. |
| 3 | Post-Surgery ↔ Completion | **PASS** | Post-Surgery remains while counsellor responsibilities are incomplete; completion is separate from clinical completion. |
| 4 | Due Date ↔ Next Action | **PASS** | PD5 avoids a generic due date; timing is driven by explicit Next Action and authoritative business-event dates where applicable. |
| 5 | Due Date ↔ Callback | **PASS** | Callback remains distinct from generic due/SLA semantics. |
| 6 | Priority ↔ Due/SLA | **PASS** | No formal priority/SLA is introduced under the current working decision. |
| 7 | Priority ↔ Escalation | **PASS** | No automatic escalation or unsupported priority model is introduced. |
| 8 | Ownership ↔ Branch Isolation | **PASS** | Follow-up ownership does not override branch authorization. |
| 9 | Ownership ↔ Permissions | **PASS** | CounselorId/ownership is not equivalent to authorization; existing permissions remain authoritative. |
| 10 | Reason Taxonomy ↔ Cancellation | **PASS** | Follow-up Reason, Communication Outcome, Delay/Barrier, and Next Action remain distinct; cancellation/decline/referred handling remains lifecycle-driven. |
| 11 | Lifecycle ↔ Completion | **PASS** | Surgery completion transitions out of Active; counsellor operational completion is separate and applies to the appropriate lifecycle population. |
| 12 | Schedule Visit ↔ Appointment Permissions | **PASS** | Schedule Visit navigates to the existing authorized appointment workflow; no new appointment permission is implied. |
| 13 | Schedule Visit ↔ Post-Surgery Responsibility | **PASS** | Appointment workflow does not replace counsellor non-clinical Post-Surgery responsibilities or clinical/Ward ownership. |
| 14 | Reminder ↔ Communication | **PASS** | Reminder is a staff task, not evidence of patient contact or delivery. |
| 15 | Callback ↔ Follow-up Ownership | **PASS** | Existing callback data/workflow remains the source of truth; callback ownership must align with the approved follow-up ownership model. |
| 16 | Analytics Partition ↔ Flags | **PASS** | Mutually exclusive classification is defined. PendingDecision does not silently merge with Active. Contradictory combinations are Exception. Unrecognized outcomes are Other/Unclassified. |
| 17 | Aging ↔ Summary Period | **PASS** | Aging has its own period/control and default backlog window; it does not inherit Summary/Trends period semantics. |
| 18 | Drill-down ↔ Destination Population | **PASS** | Drill-down destinations are population-safe. PendingDecision does not route to Active Follow-up Center by default. Exact metric-to-destination mapping is documented. |
| 19 | PendingDecision ↔ Active | **PASS** | Active and PendingDecision remain explicitly distinct; no implicit merge is permitted. |
| 20 | Branch ↔ Tenant / Authorization | **PASS** | Product rule is explicit: server-side authorization is the security boundary; client branch filtering is not security. Technical implementation verification remains a Phase 2X/implementation responsibility — **not** claimed as production-verified by this documentation. |

### Check 16 — PD13 Analytics Partition (PASS — product-decision closed)

- Mutually exclusive classification is defined with explicit precedence (PendingDecision + Agreed → PendingDecision; Declined + PendingDecision → Exception; Agreed + Declined → Exception; etc.).  
- PendingDecision does not silently merge with Active.  
- Exception and Other/Unclassified remain separately visible; excluded from normal outcome funnel/percentages.  
- **Do not** change Analytics implementation until Phase 2W Final Gate is formally authorized; Phase **2Z** reconciles formulas after sign-off.

### Check 18 — PD15 Analytics Drill-down (PASS — product-decision closed)

- Population-safe destinations are documented (session list vs Follow-up Center as specified).  
- PendingDecision / Undecided drills to filtered Counselling Session list (PendingDecision) — **not** Active Follow-up Center.  
- Aging bucket → Follow-up Center filtered to corresponding PendingDecision population.  
- Exact mapping must remain explicit before implementation; Phase **2Z** after formal authorization.

### Check 20 — PD16 Branch Isolation (PASS — product-decision closed; technical verify later)

- Option D / supervisor-dependent working rule is explicit.  
- Server-side authorization is the security boundary; client filter is presentation only.  
- Tenant isolation mandatory; client `branchId` must not grant unauthorized access.  
- **Do not** claim production authorization has already been technically verified. Verify during authorized implementation.

## Cross-Decision Review Conclusion

The 20-point review found:

- **20** checks **PASS**  
- **0** checks **CONDITIONAL**  
- **0** decision **CONFLICTS**

The working decisions (including closed PD13 / PD15 / PD16 product-decision conditionals) are internally coherent enough for **formal stakeholder sign-off**, but they are **NOT** implementation authorization.

**Still required before Phase 2W can become SIGNED / Phase 2X authorized:**

1. Formal stakeholder sign-off (Owner, Effective From, Exceptions/None, Notes/None, Name / Role / Date) for PD2–PD16.  
2. Final Gate re-run returning **AUTHORIZED**.  

**Phase 2W:** WORKING / NOT FORMALLY SIGNED  
**Phase 2X:** BLOCKED / NOT AUTHORIZED  

Do **not** check any SIGNED or Phase 2X authorization boxes based on this review alone.

**Consistency overall (legacy checkboxes — not formal SIGNED):**  
[x] Passes (no conflicts) — **20 PASS / 0 CONDITIONAL / 0 CONFLICTS** (product-decision level)  
[ ] DECISION CONFLICT — REQUIRES WORKSHOP RESOLUTION  

---

## Implementation Readiness Matrix

Mark **Signed?** only after the PD sign-off block is complete.  
A phase is **Ready** only when its dependency decisions are signed and consistency passes — **not** merely because an option checkbox exists.

| Decision | Signed? | Engineering phase unlocked | Dependencies | Notes |
|----------|---------|----------------------------|--------------|-------|
| PD2 Active population | [ ] No [ ] Yes | **2X** | Orphans + exits with PD9 | |
| PD3 Cold population | [ ] No [ ] Yes | **2X** | Exit/opt-out with PD9 | |
| PD4 Post-Surgery responsibility | [ ] No [ ] Yes | **2X** (+ SessionId safety) | Clinical ownership clear | |
| PD5 Due date | [ ] No [ ] Yes | **2Y** | May depend PD12 if mapped | |
| PD6 Priority / escalation | [ ] No [ ] Yes | **2Y** | May depend PD5 if SLA | |
| PD7 Ownership | [ ] No [ ] Yes | **2X** | Align PD16 | |
| PD8 Reason taxonomy | [ ] No [ ] Yes | **2X** / later UX | Hospital list if structured | |
| PD9 Lifecycle / exit | [ ] No [ ] Yes | **2X** | Align PD2/PD3/PD4 | |
| PD10 Schedule Visit | [ ] No [ ] Yes | **2AA** | IAM/appointment perms if A | |
| PD11 Reminder | [ ] No [ ] Yes | **2AA** | Integration if A | |
| PD12 Callback | [ ] No [ ] Yes | **2AA** | Align PD5 | |
| PD13 Analytics partition | [ ] No [ ] Yes | **2Z** | Do not change formulas early | |
| PD14 Analytics aging | [ ] No [ ] Yes | **2Z** | Keep ≠ Active | |
| PD15 Analytics drill-down | [ ] No [ ] Yes | **2Z** | Align PD13/PD2 | |
| PD16 Branch isolation | [ ] No [ ] Yes | **2X** / **2Z** | Server enforcement | |
| Intention validation / orphan handling | — | **2X** | PD2 signed | |
| Post-Surgery SessionId safety (G13) | — | **2X** interim honesty | PD4 may refine | |
| Counsellor filter (Analytics) | — | **2Z** | PD7 / PD16 | |
| EXPLAIN / functional E2E | — | **2AB** | After 2X–2AA as applicable | |
| UX polish / P3 | — | **2AC** | After operational honesty | |

### Sequence reminder (do not start early)

| Phase | Scope | Ready only when… |
|-------|--------|------------------|
| **2X** | Lifecycle/exit, ownership, intention validation, orphan handling, Post-Surgery SessionId safety | PD2, PD3, PD4, PD7, PD9, PD16 (P1) signed; consistency OK |
| **2Y** | Due date, priority | PD5, PD6 signed (or explicit “none”) |
| **2Z** | Analytics partition, aging, drill-down, counsellor filter | PD13–PD15 (+ ownership/branch as needed) signed |
| **2AA** | Schedule Visit, Reminder, Callback | PD10–PD12 signed |
| **2AB** | EXPLAIN, functional E2E | Prior phases as applicable |
| **2AC** | UX polish / P3 | Operational honesty complete |

---

# Phase 2W Workshop Gate

**Overall status:**

[x] OPEN — working decisions captured; formal sign-off incomplete (not formally SIGNED)  
[ ] CONDITIONAL — decisions made but conflicts remain  
[ ] SIGNED — implementation may begin  

> Working decisions captured from the Phase 2W product-decision workshop. These are **not** formal hospital sign-offs. Formal sign-off remains pending. Phase 2X remains **BLOCKED**. Cross-decision consistency review: **20 PASS / 0 CONDITIONAL / 0 CONFLICTS**. PD13/PD15/PD16 product-decision conditionals are closed as working rules; formal sign-off and Final Gate AUTHORIZED are still required before implementation.

### Explicit engineering authorization

**Phase 2X may begin only if:**

[ ] All P1 decisions are signed (at minimum: PD2 exits / orphans, PD3, PD4 responsibility, PD5, PD6, PD7, PD9, PD16 — per Phase 2W gate)  
[ ] Cross-decision consistency check passes  
[ ] No unresolved hospital/clinical ownership conflict  
[ ] No invented due / SLA / priority remains  
[ ] Active and PendingDecision remain explicitly defined (or merge explicitly signed under PD13/PD15)  
[ ] Branch policy is explicit  
[ ] Sign-off table below is complete  

Otherwise:

**STOP — Phase 2X remains blocked.**

### Final sign-off table

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Counselling Operations Lead | | | |
| Clinical / Patient-flow Lead | | | |
| Hospital IT / Platform Owner | | | |
| Product Owner | | | |

---

## Document control

| Item | Value |
|------|--------|
| Workshop pack path | `docs/audits/counsellor-followup-analytics-phase2w-workshop-pack.md` |
| Does not replace | Phase 2W product-decisions.md (full rationale / impact tables) |
| Production code changed | **NO** — document preparation only |
| Phase 2X | **BLOCKED** until gate is SIGNED |
