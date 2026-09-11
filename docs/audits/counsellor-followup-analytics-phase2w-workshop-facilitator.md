# Phase 2W — Hospital Workshop Facilitator Pack

| Field | Value |
|-------|--------|
| **Purpose** | Help a hospital / clinical-operations facilitator walk stakeholders through PD2–PD16 |
| **Phase** | PHASE 2W — PRODUCT DECISION WORKSHOP |
| **Phase 2X** | **BLOCKED** — do not implement |
| **Companion capture form** | `docs/audits/counsellor-followup-analytics-phase2w-workshop-pack.md` (working decisions recorded; formal sign-off pending) |
| **Gate status (last documentation refresh)** | **OPEN** — working decisions captured; **0 formally SIGNED** (`counsellor-followup-analytics-phase2w-final-gate.md`) |
| **Rule** | Facilitator guides discussion. Stakeholders decide. Engineering does **not** invent policy. Working workshop confirmations ≠ formal sign-off. |

**Capture path after this workshop:**  
Working decisions in Workshop Pack → ~~cross-decision consistency review~~ (**20 PASS / 0 CONDITIONAL / 0 CONFLICTS**) → formal stakeholder sign-off → Phase 2W Final Gate re-run → AUTHORIZED? → only then Phase 2X.

---

# Workshop Working Outcome

> Conversational / workshop confirmations below are **WORKING DECISIONS — NOT FORMALLY SIGNED**. Owner, Effective From, Exceptions/None, Notes/None, and Sign-off Name/Role/Date remain pending formal hospital sign-off. Do **not** treat this section as authorization.

| PD | Selected option (working) | Critical working rule (summary) |
|----|---------------------------|----------------------------------|
| PD2 | **A** | Seven Active intentions; orphans excluded; stay Active until surgery **completed** (booking ≠ exit); Next Action required |
| PD3 | **A** | Declined + ReferredElsewhere; re-engagement allowed; exit via closure / re-engage / opt-out; no arbitrary auto-exit |
| PD4 | **A** | Post-Surgery stays in Counsellor Center for defined non-clinical coordination; clinical/Ward remains authoritative |
| PD5 | **C** | No generic due / invented SLA; Next Action + business-event dates; **no** +7/+30/+14 |
| PD6 | **A** | No formal priority until hospital-approved model; UI High Priority not authoritative |
| PD7 | **A** | `CounselorId` owner; one owner; supervisor reassignment; no new IAM role; respect PD16 |
| PD8 | **C** | Structured Follow-up Reason + notes; keep Reason / Outcome / Delay / Next Action distinct |
| PD9 | **A** | Intention + exit matrix only; **surgery booked remains Active until surgery completion**; no separate state machine unless separately approved |
| PD10 | **B** | Schedule Visit → existing authorized appointment workflow only |
| PD11 | **B** | Reminder = staff task; not proof of communication |
| PD12 | **B** / existing callback integration | Surface existing callbacks; existing SoT; not a generic due date |
| PD13 | **A** | Mutually exclusive partition; PendingDecision ≠ Active; Exception/Other rules; formulas deferred to Phase 2Z after formal authorization |
| PD14 | **C** / separate aging view | PendingDecision Aging; own period control; default **365 days**; does not inherit Summary period |
| PD15 | **A** | Population-safe drill-down; PendingDecision → session list (not Active Center); Aging → Follow-up Center PendingDecision |
| PD16 | **D** | Supervisor-dependent; server-side auth = security boundary; client filter ≠ security; technical verify at implementation |

### Critical rules to keep visible in the room

1. Surgery booked remains Active until surgery completion.  
2. No generic due date / no invented +7/+30/+14 SLA.  
3. No formal priority until hospital-approved model exists.  
4. PendingDecision remains distinct from Active Follow-up.  
5. Branch authorization is server-side.  
6. Schedule Visit uses existing appointment workflow.  
7. Reminder is a staff task, not proof of communication.  
8. Callback uses existing callback source of truth.  
9. Analytics drill-down must preserve population integrity.  
10. No separate lifecycle state machine unless separately approved.

### Unresolved formal sign-off fields (all PDs)

- Owner → **TBD — Pending Formal Sign-off**  
- Effective From → **TBD — Pending Formal Sign-off**  
- Exceptions → **TBD** (must become **None** or explicit list at formal sign-off)  
- Notes → may keep workshop notes; formal **None** if empty at sign-off  
- Sign-off Name / Role / Date → **PENDING FORMAL STAKEHOLDER SIGN-OFF**

### Remaining gate steps

1. ~~Complete the 20-point cross-decision consistency review~~ — **done** (**20 PASS / 0 CONDITIONAL / 0 CONFLICTS**).  
2. ~~Close CONDITIONAL product-decision gates (PD13 / PD15 / PD16)~~ — **done** as **working** rules (not formally SIGNED).  
3. Capture formal stakeholder sign-offs in the Workshop Pack.  
4. Re-run Phase 2W Final Gate.  
5. Begin Phase 2X **only** if Final Gate returns **AUTHORIZED**.  
6. (Later) Technical verification of PD16 server-side branch enforcement during authorized implementation — documentation does **not** claim this is already verified in production.

---

# Workshop Rules

Read aloud at the start of the meeting:

1. **Silence is not approval.**
2. **Recommended is not approved.**
3. **An option listed is not an option selected.**
4. **Engineering cannot make clinical/operational policy decisions.**
5. **Every decision requires an accountable owner.**
6. **Every signed rule must have an effective date.**
7. **Exceptions must explicitly say "None" when there are none.**
8. **Notes must explicitly say "None" when there are none.**
9. **Sign-off requires name, role, and date.**
10. **Conflicts must be resolved before authorization.**
11. **Phase 2X cannot start while required P1 decisions remain unsigned.**

Record answers in the Workshop Pack (or Live Decision Capture Table below). Do **not** mark Phase 2X authorized in this facilitator document.

---

# Do Not Decide in Engineering

**DO NOT let engineering decide:**

- patient follow-up eligibility  
- patient intention semantics  
- clinical ownership  
- post-surgery responsibility  
- due dates  
- SLA  
- priority  
- escalation policy  
- lifecycle exit criteria  
- appointment authority  
- reminder semantics  
- callback responsibility  
- branch operational policy  
- Analytics business definitions  

Engineering may only implement **signed** rules after the Final Gate returns **AUTHORIZED**.

---

# Recommended Workshop Order

Use this order (from Phase 2W / Final Gate dependency chain). Do not reorder without evidence from the source documents.

| Order | Decision | Why here |
|-------|----------|----------|
| 1 | **PD2** Active Population | Defines who is in primary counsellor workload |
| 2 | **PD3** Cold Population | Defines declined/referred workload before exits |
| 3 | **PD4** Post-Surgery Responsibility | Clinical vs counsellor ownership of discharged list |
| 4 | **PD7** Ownership | Who owns a row before exit/claim rules |
| 5 | **PD9** Lifecycle / Exit | Exit matrix needs PD2–PD4 populations defined |
| 6 | **PD16** Branch Isolation | Security/ops scope for ownership and lists |
| 7 | **PD5** Due Date | After populations know who is in queues |
| 8 | **PD6** Priority / Escalation | Often depends on whether a due/SLA exists |
| 9 | **PD8** Reason Taxonomy | Barriers/cancel wording after workload defined |
| 10 | **PD10** Schedule Visit | After Post-Surgery / Active next-workflow clarity |
| 11 | **PD11** Reminder | Contact action semantics |
| 12 | **PD12** Callback | After due date mapping choice |
| 13 | **PD13** Analytics Partition | Management buckets (not Active intention) |
| 14 | **PD14** Analytics Aging | Window after partition population clear |
| 15 | **PD15** Analytics Drill-down | Needs PD13 + clear Active ≠ PendingDecision |

**First block (1–6)** unlocks Phase 2X prerequisites.  
**Second block (7–9)** feeds Phase 2Y / honesty.  
**Third block (10–12)** feeds Phase 2AA.  
**Fourth block (13–15)** feeds Phase 2Z.

---

# Phase 2X Blocking Decisions

**Phase 2X is NOT authorized today.** These must be **SIGNED** before Phase 2X can begin (per Final Gate / Phase 2W sequence):

| Must be signed | What must be explicit |
|----------------|------------------------|
| **PD2** | Active allowlist confirm/change; per-intention meaning; **orphan** policy (`WillingNow`, `WillingTwoWeeks`, `WillingSixMonths`, `SecondOpinion`) |
| **PD3** | Cold membership; re-engagement; opt-out; when Cold leaves |
| **PD4** | Counsellor post-surgery responsibility **or** remove from Center; **completion** criteria |
| **PD7** | Owner model; see / act / claim / reassign / close; supervisor behavior |
| **PD9** | Exit matrix (STAY / EXIT / MOVE); lifecycle yes/no |
| **PD16** | Branch policy; server-side enforcement if restricted |

**Related rules that must be filled with those PDs (not separate PDs):**

- Active **exit** triggers (with PD9)  
- Cold **exit** / re-engagement (with PD9)  
- Post-Surgery **completion** (with PD4 + PD9)  
- Orphan intention handling (with PD2)  
- PatientIntention write / allowlist validation intent (with PD2)

**Note:** Phase 2W product-decisions also list PD5/PD6 among P1 product gaps for full operational honesty. Per implementation sequence, due/priority are **Phase 2Y**. They still need workshop decisions but do **not** unlock Phase 2X by themselves. Do **not** claim Phase 2X is authorized after this facilitator pack alone.

---

# Live Decision Capture Table

Fill during the workshop. Transfer signed detail into the Workshop Pack.  
**Current repository state:** working options recorded; status remains **WORKING — NOT FORMALLY SIGNED** until formal fields are complete.

| PD | Decision | Selected Option | Final Rule | Owner | Effective | Exceptions | Notes | Sign-off | Status |
|----|----------|-----------------|------------|-------|-----------|------------|-------|----------|--------|
| PD2 | Active Population | **A** (working) | Seven Active; orphans excluded; Active until surgery **completed**; Next Action required | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD3 | Cold Population | **A** (working) | Declined + ReferredElsewhere; re-engage; exit via closure/re-engage/opt-out | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD4 | Post-Surgery Responsibility | **A** (working) | Stay in Center for non-clinical coordination; clinical/Ward authoritative | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD5 | Due Date | **C** (working) | No generic due; Next Action + event dates; no +7/+30/+14 | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD6 | Priority / Escalation | **A** (working) | No formal priority until approved model | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD7 | Ownership | **A** (working) | CounselorId owner; supervisor reassign; respect PD16 | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD8 | Reason Taxonomy | **C** (working) | Structured reason + notes; distinct concepts | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD9 | Lifecycle / Exit | **A** (working) | Exit matrix; booked ≠ exit; completed exits Active | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD10 | Schedule Visit | **B** (working) | Navigate existing appointment workflow | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD11 | Reminder | **B** (working) | Staff task ≠ communication proof | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD12 | Callback | **B** / existing (working) | Surface existing callbacks; existing SoT | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD13 | Analytics Partition | **A** (working) | Mutually exclusive; PendingDecision precedence; Exception/Other; formulas hold until authorized | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD14 | Analytics Aging | **C** / separate (working) | PendingDecision Aging; own period; default 365d | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD15 | Analytics Drill-down | **A** (working) | Population-safe map; PendingDecision ≠ Active Center | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |
| PD16 | Branch Isolation | **D** (working) | Server-side auth boundary; client filter ≠ security | TBD | TBD | TBD | Workshop working | PENDING FORMAL STAKEHOLDER SIGN-OFF | **WORKING — NOT FORMALLY SIGNED** |

Do **not** invent formal Owner / Effective / Sign-off values. Do **not** mark Phase 2X authorized here.

---

# Cross-Decision Checklist

# Phase 2W Cross-Decision Consistency Review

**Facilitator note:** The cross-decision review is complete with **20 PASS**, **0 CONDITIONAL**, and **0 CONFLICTS**. PD13 / PD15 / PD16 product-decision conditionals are closed as **working** rules. Formal sign-off and Final Gate AUTHORIZED are still required. Technical verification of PD16 server-side enforcement remains an implementation responsibility after authorization — not claimed as production-verified here.

**Review status:** 20 PASS · 0 CONDITIONAL · 0 CONFLICTS  

Working decisions unchanged in status: **WORKING — NOT FORMALLY SIGNED**. Phase 2X remains **BLOCKED / NOT AUTHORIZED**.

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
| 16 | Analytics Partition ↔ Flags | **PASS** | Mutually exclusive classification defined; PendingDecision ≠ Active merge; contradictory → Exception; unrecognized → Other/Unclassified. |
| 17 | Aging ↔ Summary Period | **PASS** | Aging has its own period/control and default backlog window; it does not inherit Summary/Trends period semantics. |
| 18 | Drill-down ↔ Destination Population | **PASS** | Population-safe mapping documented; PendingDecision does not route to Active Follow-up Center by default. |
| 19 | PendingDecision ↔ Active | **PASS** | Active and PendingDecision remain explicitly distinct; no implicit merge is permitted. |
| 20 | Branch ↔ Tenant / Authorization | **PASS** | Server-side authorization is the security boundary; client filter is not security. Technical implementation verification remains pending after authorization. |

## Cross-Decision Review Conclusion

- **20 PASS · 0 CONDITIONAL · 0 CONFLICTS**  
- Coherent for formal stakeholder sign-off; **not** implementation authorization.  
- Still required for Phase 2W **SIGNED** / Phase 2X: formal stakeholder sign-offs + Final Gate AUTHORIZED.

If any future conflict appears: **DECISION CONFLICT — REQUIRES WORKSHOP RESOLUTION**. Do not resolve with engineering judgment.

---

# Product goals (keep visible in the room)

**Counsellor Follow-up Center must answer:** WHO → WHY → HISTORY → NEXT ACTION → OWNER → PRIORITY → OUTCOME → WHEN COMPLETE → WHICH EXISTING WORKFLOW NEXT?

**Analytics must answer:** counselling volume → decisions → agreed/declined/undecided → follow-up workload → why pending → follow-up effectiveness → branch/counsellor/procedure/time → bottlenecks → drill to correct existing workflow?

---

# Decisions PD2–PD16 (facilitator script)

For each PD: discuss → select option in Workshop Pack → fill Final rule fields → sign.  
Facilitator does **not** answer the stakeholder questions.

---

## PD2 — Active Population

### Why this decision is required

Active is the primary counsellor workload. Phase 2V/2W show intention codes drive membership, but exits are weak (agree/complete/quick-book do not clear intention), and master seeds orphan codes that are **not** in Active. Without a hospital rule, patients stick or disappear inconsistently. Orphans must not be silently added.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
Active allowlist = exactly seven codes in `FollowupQueryContracts.ActiveIntentions`: `WillingWeek`, `WillingMonth`, `WillingQuarter`, `WillingCallToConfirm`, `Undecided`, `WaitingFinancial`, `WaitingFear`. No Status filter. Orphans seeded but not in Active: `WillingNow`, `WillingTwoWeeks`, `WillingSixMonths`, `SecondOpinion`.

**HOSPITAL DECISION REQUIRED:** Which intentions stay Active; operational meaning; counsellor action; next-action/due requirements; when they leave; orphan fate.

### Decision options

A. Confirm the current seven remain Active; dispose orphans by explicit map/deprecate/leave-orphan (no silent include)  
B. Change the Active allowlist (add/remove codes — list in Final rule)  
C. Replace intention-based Active with another population rule (define in Final rule)  
D. Other  

### Questions for hospital stakeholders

1. Should all seven current codes remain counsellor Active workload?  
2. For each code, what should the counsellor do next?  
3. When should a patient **leave** Active (agree, book, complete, cancel, explicit close)?  
4. What should happen to orphan codes (`WillingNow`, `WillingTwoWeeks`, `WillingSixMonths`, `SecondOpinion`)?  
5. If a patient never responds, do they stay Active indefinitely?  
6. Must every Active row have a planned next action?

### Required final rule

- Selected option / Other  
- Final Rule (include per-intention table + orphan disposition from Workshop Pack)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Unlocks / feeds:** PD9 exits; PD8 (why); PD5 (if due required per intention); PD15 (must not confuse with PendingDecision).  
**Needed before:** PD9 exit matrix for Active.

---

## PD3 — Cold Population

### Why this decision is required

Cold may be workload or archive. Re-engagement without hospital policy creates contact/compliance risk. Analytics “declined” is a **different** formula — must not be equated without decision.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
Cold = `Declined` | `ReferredElsewhere` only. Sort by `UpdatedAt ?? CreatedAt`. Re-queue can move out. No opt-out flag. No due date. No forced next action.

**HOSPITAL DECISION REQUIRED:** Who stays in Cold; re-engagement; next action/due; exit; opt-out.

### Decision options

A. Keep both Declined and ReferredElsewhere in Cold workload with explicit exit/re-engagement rules  
B. Keep Declined only; remove or archive ReferredElsewhere from counsellor workload  
C. Cold is archive-only (view/history, not active workload)  
D. Other  

### Questions for hospital stakeholders

1. Is every Declined patient a follow-up candidate?  
2. Should ReferredElsewhere remain counsellor workload?  
3. Is re-engagement permitted — under what hospital-approved policy (do not invent an interval in engineering)?  
4. When does Cold leave the workload?  
5. Is explicit patient opt-out of future contact required?  
6. Should Cold rows require a next action or due date?

### Required final rule

- Selected option / Other  
- Final Rule  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Feeds:** PD9 Cold exits; PD5 if due required; PD8 cancel/decline reasons.  
**Align with:** PD2 (who is not Active).

---

## PD4 — Post-Surgery Responsibility

### Why this decision is required

Post-Surgery is currently an unbounded discharged list without counsellor completion. Merging clinical post-op ownership into counsellor due dates without decision is forbidden. Opportunistic `SessionId` Open Session is not proven authoritative (G13).

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
Population = `patient_journey.IsDischarged == true`. Enrichment: discharge summary, pending incomplete post-op visits, opportunistic latest counseling `SessionId`. Over30Days from `DischargedAt`. No counsellor complete state. Schedule Visit absent. Ward/IP uses `FollowUpAppointmentPanel` + `appointment.create`.

**HOSPITAL DECISION REQUIRED:** Counsellor responsibilities vs clinical/ward-only; completion; Center display vs remove.

### Decision options

A. Keep Post-Surgery in Counsellor Center with defined counsellor responsibilities  
B. Remove Post-Surgery from Counsellor Center (clinical/ward only)  
C. Display-only discharged list (no counsellor completion actions)  
D. Other  

### Questions for hospital stakeholders

1. Who is responsible for the patient after discharge — counsellor, ward, both, or neither in this Center?  
2. Should counsellors coordinate appointments, wellbeing calls, satisfaction, clinical follow-up, and/or financial closure?  
3. Which post-op milestones should appear in Counsellor Center vs ward-only?  
4. What makes counsellor post-surgery follow-up **complete**?  
5. Is a separate counsellor completion state required?  
6. How should this interact with Ward/IP FollowUpAppointmentPanel?

### Required final rule

- Selected option / Other  
- Final Rule (include responsibility ticks + completion)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Feeds:** PD9 Post-Surgery exits; PD10 Schedule Visit; G13 SessionId safety scope in Phase 2X after authorization.  
**Must not merge:** clinical post-op ownership without explicit decision.

---

## PD7 — Ownership

### Why this decision is required

Counsellors cannot answer “who owns this?” — `CounselorId` may exist on session but Center DTOs/UI omit owner (G03). Lists are tenant (+ optional branch), not assignee-scoped.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
Session may have `CounselorId`. Center lists omit owner. Permissions baseline: `counseling_sessions.read` / `.update`. Analytics API supports `counselorId` filter; UI deferred. Do not invent new IAM roles in the workshop without IAM present.

**HOSPITAL DECISION REQUIRED:** Owner model; who can see/act/claim/reassign/close; supervisors; multi-counsellor; audit.

### Decision options

A. Session `CounselorId` is follow-up owner  
B. Dedicated Follow-up Assignee (new field — only if signed later)  
C. Queue / branch ownership only  
D. Unassigned until claimed  
E. Hybrid (define in Final rule)  
F. Other  

### Questions for hospital stakeholders

1. Who owns a follow-up patient on the counselor’s shift?  
2. Who can claim or reassign the patient?  
3. Do supervisors see all follow-ups in scope?  
4. Can more than one counsellor work the same patient?  
5. Who can close/complete a follow-up?  
6. How does ownership interact with branch (see PD16)?

### Required final rule

- Selected option / Other  
- Final Rule (include see/act/claim/reassign/close table)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Must align with:** PD16.  
**Feeds:** Phase 2X ownership; later Analytics counsellor filter (2Z).

---

## PD9 — Lifecycle / Exit

### Why this decision is required

Without exit rules, Active never shrinks when patients convert (G02). Do not assume a state machine from example labels.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
Implicit: intention → Active/Cold; discharge → Post-Surgery; re-queue can move; no “Completed follow-up” state. Agree/schedule/complete do not automatically clear Active intention.

**HOSPITAL DECISION REQUIRED:** Exit matrix; whether separate lifecycle states exist.

### Decision options

A. Intention + exit matrix only — **no** separate lifecycle states  
B. Explicit lifecycle states required (list **exact** states in Final rule)  
C. Other  

### Questions for hospital stakeholders

1. When should the patient leave this work queue after they agree to surgery?  
2. After surgery is booked or completed?  
3. After the patient declines or is referred elsewhere?  
4. After session cancel or explicit “follow-up completed”?  
5. For Post-Surgery, when is counsellor work done?  
6. Do you need named lifecycle states beyond intention + exit matrix?

### Required final rule

- Selected option / Other  
- Final Rule + completed exit matrix (STAY | EXIT | MOVE TO OTHER POPULATION only)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Requires:** PD2, PD3, PD4 populations understood.  
**Feeds:** Phase 2X lifecycle; completion vs PD4.

---

## PD16 — Branch Isolation

### Why this decision is required

Branch filter is largely client-optional; tenant JWT+RLS are strong. Client-side branch filtering is **not** authorization (G18). Hospital must define operational branch scope.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
Tenant isolation via JWT/RLS. Center branch filter optional on client. Not proven as server-enforced branch security for Follow-up lists.

**HOSPITAL DECISION REQUIRED:** Restricted vs multi-branch vs tenant-wide vs supervisor-dependent; counsellor vs supervisor visibility; cross-branch; switching rules.

### Decision options

A. Branch restricted (server-enforced)  
B. Explicit multi-branch allow-list  
C. Tenant-wide counselling access  
D. Supervisor-dependent  
E. Other  

### Questions for hospital stakeholders

1. Should a counsellor only see their branch’s follow-ups?  
2. Can supervisors see cross-branch?  
3. Is multi-branch work an allow-list or tenant-wide?  
4. What happens when a patient moves branch?  
5. Who may switch branch context?  
6. Must enforcement be server-side (recommended for security — stakeholders still choose A–E)?

### Required final rule

- Selected option / Other  
- Final Rule (include A/D enforcement table if applicable)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Working capture (not formal sign-off)

**WORKING — NOT FORMALLY SIGNED.** Selected option **D** — Supervisor-dependent. **Server-side** branch authorization is the security boundary; client branch filter is **not** security. Normal users / multi-branch supervisors only within authorized branches; tenant isolation mandatory; client `branchId` must not grant unauthorized access; do not invent permissions. Technical verification of production server-side enforcement remains an **implementation** responsibility after authorization — **not** claimed as verified here. Formal Owner/Effective/Exceptions/Sign-off remain PENDING.

### Decision dependency

**Align with:** PD7.  
**Feeds:** Phase 2X branch work if A/D; Analytics branch (2Z). Product-decision conditional closed as working rule. Until **formally SIGNED** + Final Gate AUTHORIZED: **BLOCKED — do not implement branch isolation changes**.

---

## PD5 — Due Date

### Why this decision is required

No authoritative Center due date (G01). Old +7/+30/+14 are **not** authoritative and must **not** be revived. Without a decision, UI must not invent overdue.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
SessionDate, DecisionDate, LastContactDate, NextActionDate (comm log), CallbackDate, DischargedAt, clinical post-op dates, Waiting List FollowUpDate projection exist for other purposes. No Center due SoT.

**HOSPITAL DECISION REQUIRED:** Dedicated due vs mapped existing date vs no generic due (separate signals).

### Decision options

A. Dedicated operational Follow-up Due Date  
B. Reuse an existing date with explicit semantic mapping  
C. No generic due date (use separate signals only)  
D. Other  

### Questions for hospital stakeholders

1. Does every Active patient need an “act by” date?  
2. If yes, what field/source is authoritative?  
3. If no, which signals should counsellors use (next action, callback, last contact, discharge aging)?  
4. How does this relate to CallbackDate (keep separate unless deliberately mapped)?  
5. What happens when the date is missing?  
6. Whose timezone/calendar rules apply?

### Required final rule

- Selected option / Other  
- Final Rule (+ A/B field table or C signal ticks)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Feeds:** PD6 (if SLA); PD12; Phase **2Y** (not 2X).  
**Forbidden:** SessionDate+7 / +30 / DecisionDate+14 heuristics.

---

## PD6 — Priority / Escalation

### Why this decision is required

UI shows AlertLevel / High Priority KPI, but escalation writers are incomplete → misleading operational priority (G04/G25). Do not approve High/Medium/Low merely because UI displays them.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
`MapAlertLevel(EscalationStatus, LastContactDate)` → Critical/High/Medium/Normal. UrgentHigh KPI = SupervisorAlert | Escalated. Writers largely incomplete; never-contacted can map to Medium.

**HOSPITAL DECISION REQUIRED:** Priority model or none; High Priority KPI fate; if priority exists — inputs, calculation, owner, persistence, triggers, de-escalation, UI meaning.

### Decision options

A. No priority model  
B. SLA-based  
C. Callback priority  
D. Clinical escalation  
E. Operational / manual priority  
F. Other  

### Questions for hospital stakeholders

1. Should Follow-up Center order by priority at all?  
2. If yes, what makes a patient high priority?  
3. Who sets or clears escalation?  
4. Should “High Priority” KPI remain, hide until writers exist, or be relabeled incomplete/manual?  
5. Is priority the same as being overdue on a due date (PD5)?  
6. What happens if the patient does not respond?

### Required final rule

- Selected option / Other  
- Final Rule (+ attribute table if B–F; High Priority KPI tick)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Often depends on:** PD5.  
**Phase:** **2Y**.

---

## PD8 — Reason Taxonomy

### Why this decision is required

`ReasonsForDelay` is free text and can be overloaded (e.g. cancel overwrites same field). Follow-up reason, delay/barrier, and cancellation must be separated explicitly. Example categories in Phase 2W are **not** approved taxonomy.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
Free-text `ReasonsForDelay`. Intention separate. Communication outcome on comm log.

**HOSPITAL DECISION REQUIRED:** Free text vs structured (hospital supplies list) vs hybrid; separation of reason types.

### Decision options

A. Remain free text (with clear separation rules vs cancel / delay)  
B. Structured taxonomy — hospital provides **approved** list  
C. Hybrid (structured primary + free-text “other”)  
D. Other  

### Questions for hospital stakeholders

1. Do counsellors need a fixed list of follow-up reasons?  
2. Who owns and maintains that list?  
3. Must cancel reason be a separate field from barrier/delay?  
4. What happens if “Other” is selected?  
5. Should Analytics use structured reasons for “why pending”?  

### Required final rule

- Selected option / Other  
- Final Rule (+ separation table; attach approved list if B/C)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Align with:** cancel flows; PD9 decline/cancel exits.  
Do **not** auto-adopt example categories from product-decisions.md.

---

## PD10 — Schedule Visit

### Why this decision is required

Schedule Visit is intentionally absent from Center. Booking is a permission boundary. Do not invent counsellor `appointment.*` rights.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
No Center Schedule Visit. Ward: `appointment.create` via FollowUpAppointmentPanel. Appointments API: `appointment.view/create/update/cancel/delete`.

**HOSPITAL DECISION REQUIRED:** Book vs navigate vs request vs none; if book — type, clinic, branch, slots, duplicates, permissions, cancel, Center behavior after booking.

### Decision options

A. Counsellor can book appointments  
B. Counsellor can only navigate to existing appointment workflow  
C. Counsellor can request an appointment (not slot book)  
D. No appointment action in Center  
E. Other  

### Questions for hospital stakeholders

1. Should counsellors book appointments from Follow-up Center?  
2. Or only open an existing appointment screen?  
3. Who owns the clinic/doctor/slot?  
4. What permissions already exist — and may counsellors use them?  
5. After booking, does the patient leave Active / Post-Surgery?  
6. How does this relate to Post-Surgery responsibility (PD4)?

### Required final rule

- Selected option / Other  
- Final Rule (+ A detail table if A)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Align with:** PD4, PD9.  
**Phase:** **2AA**. Do not invent appointment permissions.

---

## PD11 — Reminder

### Why this decision is required

Reminder API creates log/intent; delivery not proven. UI must not imply a message was sent (G12).

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
`POST …/patients/{id}/reminders` → communication log / outbound intent. No proven SMS/WhatsApp/email send on Center path.

**HOSPITAL DECISION REQUIRED:** Actual send vs staff task vs intent/log vs remove; if send — channel, consent, owner, status, failure.

### Decision options

A. Actual patient communication  
B. Staff reminder task  
C. Reminder intent / log only  
D. Remove Reminder action  
E. Other  

### Questions for hospital stakeholders

1. When a counsellor clicks Reminder, what should actually happen?  
2. Is patient messaging consented and which channel?  
3. Who owns the integration if messages are real?  
4. What does success/failure mean to the counsellor?  
5. Should the button be renamed to match reality?

### Required final rule

- Selected option / Other  
- Final Rule (+ A channel table if A)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Phase:** **2AA**. UI wording must match signed semantics.

---

## PD12 — Callback

### Why this decision is required

Callbacks exist as a separate entity but are not Center list columns. CallbackDate must stay separate from generic Due Date unless hospital maps them (PD5).

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
`counselor_callback_requests` + `CallbackDate`; separate APIs; not Center row surfacing by default.

**HOSPITAL DECISION REQUIRED:** Surface in Center or not; where; date/status; owner; complete/reschedule; relation to due.

### Decision options

A. Surface callbacks in Follow-up Center (define where)  
B. Keep callbacks only in existing callback workflows (not Center)  
C. Hybrid (badge / filter only — define)  
D. Other  

### Questions for hospital stakeholders

1. Should callbacks appear directly in Follow-up Center?  
2. As badge, column, filter, or sub-tab?  
3. Who owns the callback vs the follow-up row (PD7)?  
4. Can counsellor complete or reschedule from Center?  
5. Is CallbackDate the same as due date, or separate?

### Required final rule

- Selected option / Other  
- Final Rule (+ checklist answers)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Align with:** PD5, PD7.  
**Phase:** **2AA**.

---

## PD13 — Analytics Partition

### Why this decision is required

Current Analytics formulas allow overlap (agreed + pending) and a gap (null agreement + not pending) (G14). Do not change formulas before sign-off. Active Follow-up ≠ PendingDecision unless explicit merge.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
agreed = `PatientAgreedToSurgery == true`; declined = agreed false AND pending false; undecided = `PendingDecision == true`; conversion = agreed/total; decision rate = (agreed+declined)/total.

**HOSPITAL DECISION REQUIRED:** Mutually exclusive buckets; precedence for overlap/gap cases; final formulas.

### Decision options

A. Adopt mutually exclusive buckets with precedence (keep Active ≠ PendingDecision)  
B. Also redefine Active to align with PendingDecision (**explicit merge approval required**)  
C. Other  

### Questions for hospital stakeholders

1. If a patient is both agreed and pending, which KPI bucket wins?  
2. What about declined + pending?  
3. What about null agreement and not pending?  
4. How should conversion and decision rate be defined after partition?  
5. Must Active Follow-up stay separate from PendingDecision?

### Required final rule

- Selected option / Other  
- Final Rule (+ overlap table + formulas)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Working capture (not formal sign-off)

**WORKING — NOT FORMALLY SIGNED.** Selected option **A**. Mutually exclusive partition; PendingDecision ≠ Active; PendingDecision + Agreed → PendingDecision; Declined + PendingDecision / Agreed + Declined → Exception; no recognized flags → Other/Unclassified; Exception/Other in Total Sessions but out of outcome funnel/%; Eligible Outcome Sessions denominator (formulas hold until Final Gate AUTHORIZED / Phase 2Z). Formal Owner/Effective/Exceptions/Sign-off remain PENDING.

### Decision dependency

**Feeds:** PD14, PD15.  
**Phase:** **2Z**. Product-decision conditional closed as working rule. Until **formally SIGNED** + Final Gate AUTHORIZED: **BLOCKED — do not implement Analytics partition changes**.

---

## PD14 — Analytics Aging

### Why this decision is required

Aging population is PendingDecision only — not Active intentions. Summary uses 7/14/30; Aging often defaults to 365d with unclear FE period wiring (G15). UI must state the window unambiguously.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
Buckets 0–3, 4–7, 8–14, 15+ by days since SessionDate; PendingDecision only; FE historically passes branch more than period.

**HOSPITAL DECISION REQUIRED:** Aging window option; keep or change buckets; label wording.

### Decision options

A. Aging follows selected Summary period  
B. Aging remains 365-day operational backlog  
C. Separate Aging date control  
D. Other  

### Questions for hospital stakeholders

1. Should Aging match the Summary period the manager selected?  
2. Or always show a long operational backlog (e.g. 365 days)?  
3. Do bucket boundaries 0–3 / 4–7 / 8–14 / 15+ remain?  
4. What exact label should managers see?  
5. Confirm Aging is **not** Active Follow-up workload?

### Required final rule

- Selected option / Other  
- Final Rule (+ buckets + label draft)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Decision dependency

**Align with:** PD13 population.  
**Phase:** **2Z**. Until signed: **BLOCKED — AGING WINDOW NOT FULLY DEFINED**.

---

## PD15 — Analytics Drill-down

### Why this decision is required

Management needs insight → existing workflow. Wrong mapping (PendingDecision → Active Center) confuses ops. Do not create duplicate worklists.

### Current repository behavior

**CURRENT SYSTEM BEHAVIOR:**  
Aging row → Session; Aging button → Center without filters (mismatch disclaimer). No KPI→worklist drill-down.

**HOSPITAL DECISION REQUIRED:** Destination + filters per metric; PendingDecision destination explicit; or no drill-down.

### Decision options

A. Approve the mapping table (reuse existing routes only)  
B. No drill-down for most KPIs until populations are redefined  
C. Other  

### Questions for hospital stakeholders

1. From Total sessions / Agreed / Declined / Pending — where should the manager land?  
2. Where should PendingDecision open — Waiting List, session search, Center (only if Active redefined), or nowhere?  
3. Should Aging open Session only or a filtered queue?  
4. Should Follow-up workload open which Center tab?  
5. Are duplicate worklists forbidden (standing rule — confirm)?

### Required final rule

- Selected option / Other  
- Final Rule (+ mapping table)  
- Owner  
- Effective From  
- Exceptions (or **None**)  
- Notes (or **None**)  
- Sign-off Name / Role / Date  

### Working capture (not formal sign-off)

**WORKING — NOT FORMALLY SIGNED.** Selected option **A** — population-safe destination mapping. Total/Agreed/Declined/PendingDecision/Conversion/Surgery mix → filtered Counselling Session list (as specified); Aging → Follow-up Center PendingDecision filter; Follow-up workload → Follow-up Center. **PendingDecision must NOT automatically drill into Active Follow-up Center.** No duplicate worklists. Formal Owner/Effective/Exceptions/Sign-off remain PENDING.

### Decision dependency

**Requires clarity from:** PD13, PD2 (Active ≠ PendingDecision unless B).  
**Phase:** **2Z**. Product-decision conditional closed as working rule. Until **formally SIGNED** + Final Gate AUTHORIZED: **BLOCKED — do not implement Analytics drill-down**.

---

# Workshop Outcome

Record at end of meeting (also update Workshop Pack gate):

[x] **OPEN** — workshop working decisions captured; formal sign-off **not** completed  
[ ] **CONDITIONAL** — decisions made but sign-offs incomplete / conflicts remain  
[ ] **SIGNED** — all required decisions and sign-offs completed  

## Authorization

[x] **PHASE 2X NOT AUTHORIZED**  
[ ] **PHASE 2X AUTHORIZED**

> **WARNING:** PHASE 2X AUTHORIZATION MUST NOT BE CHECKED UNTIL THE PHASE 2W FINAL GATE HAS BEEN RE-RUN AND RETURNS AUTHORIZED.

**Next process steps:**

```
WORKING DECISIONS IN WORKSHOP PACK
        ↓
20-POINT CROSS-DECISION CONSISTENCY REVIEW  ← done (20 PASS / 0 CONDITIONAL / 0 CONFLICTS)
        ↓
FORMAL STAKEHOLDER SIGN-OFF
        ↓
PHASE 2W FINAL GATE RE-RUN
        ↓
AUTHORIZED?
   ├── NO  → resolve decisions / conflicts
   └── YES → Phase 2X implementation may begin (separate prompt)
```

---

# Facilitator quick checklist

- [ ] Workshop rules read  
- [ ] Participants recorded in Workshop Pack  
- [ ] PD2 → PD16 walked in recommended order  
- [ ] Live capture table updated  
- [ ] Cross-decision checklist reviewed after selections  
- [ ] Workshop Pack Final rules + sign-offs completed for each PD  
- [ ] Final Gate **not** marked AUTHORIZED in this document  
- [ ] No production code changed  
- [ ] Phase 2X **not** started  

---

## Document control

| Item | Value |
|------|--------|
| This file | `docs/audits/counsellor-followup-analytics-phase2w-workshop-facilitator.md` |
| Does not replace | Workshop Pack (capture) or Final Gate (authorization) |
| Production code | **NO** changes |
| Phase 2X | **NOT STARTED / BLOCKED** |
