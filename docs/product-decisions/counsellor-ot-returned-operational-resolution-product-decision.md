# Counsellor — OT Returned Operational Resolution
# Product Decision

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-OT-RETURNED-RESOLUTION** (provisional family label — not an approved program phase) |
| **Date prepared** | 2026-09-22 |
| **Date Path 1 recorded** | 2026-09-22 |
| **Date Option D recorded** | 2026-09-22 |
| **Date No-Session audit recorded** | 2026-09-22 |
| **Date Complete No-Session Product Decision Preparation** | 2026-09-22 |
| **Date Final Product Decision + Readiness Audit recorded** | 2026-09-22 |
| **Date No-Session Start Counselling supersession recorded** | 2026-09-22 |
| **Mode** | **PRODUCT DECISION APPROVED (SUPERSEDED NO-SESSION)** — existing-session **Continue Counselling** locked; no-session **Start Counselling** (new session via certified create path); Reason Matrix **Universal**; Open Journey removed as Counsellor OT Returned CTA |
| **Document type** | Governance / Product Decision — OT Returned operational resolution; no-session Start Counselling supersedes prior Remain-in-IP approval |

---

## 1. Decision Status

| Field | Value |
|-------|--------|
| **Decision Path** | **PATH 1 SELECTED** |
| **Workflow (existing-session)** | **OPTION D — CONTINUE / RESUME COUNSELLING — SELECTED** |
| **Existing-session case** (`counselingSessionId` present) | **APPROVED / LOCKED** |
| **No-session case** (`counselingSessionId` NULL) | **APPROVED — START COUNSELLING** (supersedes Remain-in-IP / Open Journey) |
| **OT return reason matrix** | **APPROVED — UNIVERSAL** |
| **Overall Product Decision** | **APPROVED** |
| **Implementation Readiness** | **BOUNDED IMPLEMENTATION REQUIRED** (Start Counselling mutation) |
| **Implementation Authorized** | **YES** — bounded OT Returned Start/Continue implementation (this task) |
| **Implementation Performed** | **IN PROGRESS / SEE §21** |
| **C-01 Reopened** | **NO** |
| **Phase 3I Reopened** | **NO** |
| **Slice 14 Created** | **NO** |
| **Phase 3J Created** | **NO** |
| **PATH 1 SELECTED** | **YES** |
| **OPTION D SELECTED (existing-session)** | **YES — CONTINUE COUNSELLING** |
| **NO-SESSION PREPARATION COMPLETE** | **YES** |
| **NO-SESSION CASE SELECTED** | **YES — START COUNSELLING** |
| **OT RETURN REASON MATRIX SELECTED** | **YES — UNIVERSAL** |
| **PRIOR NO-SESSION (REMAIN IN IP)** | **SUPERSEDED** |

### Selected Product Decision (existing-session case)

> When an OT-returned patient has an existing counselling session, the authoritative operational resolution is to continue/resume that existing counselling journey through the existing Counselling Session workspace.

### Operational flow (decision meaning — not implemented)

```text
OT Returned
    ↓
Existing counselling session identified
    ↓
Continue / Resume existing counselling journey
    ↓
Existing Counselling Session workspace
    ↓
Existing counselling workflow continues
```

This is an **operational workflow decision**. It is **not** permission to redesign the Counselling Session workspace, create a new counselling session, create a new worklist/dashboard, or modify the Waiting List lifecycle.

---

## 2. Context

### Why this Product Decision is required

C-01 Manual UAT left Area 7 — OT Returned as **NOT ACCEPTED / OBSERVATION**. Path 1 was selected to define an authoritative operational workflow. This recording selects **Option D** for the **existing-session** case only.

| Item | Status |
|------|--------|
| C-01 Product Decision | **APPROVED** |
| C-01 implementation | **COMPLETE** |
| C-01 Manual UAT | **14 / 15 PASS** |
| Area 7 — OT Returned | **NOT ACCEPTED / OBSERVATION** (no-session + remaining open items still block full Area 7 closure) |
| C-01 ACCEPTED | **NO** |
| C-01 CLOSED | **NO** |
| Governance path | **PATH 1 SELECTED** |
| Workflow (existing session) | **OPTION D SELECTED** |

Authoritative UAT recording:

`docs/audits/counsellor-c01-waiting-list-dashboard-redesign-uat-observations.md`

Area 7 is **not** a C-01 coding / API / ownership / Phase 3I defect.

### Locked governance facts

| Fact | Status |
|------|--------|
| Phase 3I | **FORMALLY CLOSED** |
| Slice 13 | **CLOSED** |
| Package B | **DELIVERY ACCEPTED** |
| Slice 14 | **DOES NOT EXIST** |
| Phase 3J | **NOT CREATED** |
| OT Returned workflow implementation | **NOT AUTHORIZED** |

This workflow decision is a **separate** OT Returned product-decision track. Do **not** reopen Phase 3I. Do **not** create Slice 14. Do **not** create Phase 3J.

### Authoritative sources (read-only)

1. `docs/product-decisions/counsellor-ot-returned-operational-resolution-product-decision.md` (this file)  
2. `docs/audits/counsellor-c01-waiting-list-dashboard-redesign-uat-observations.md`  
3. `docs/product-decisions/counsellor-c01-waiting-list-dashboard-redesign-product-decision.md`  
4. `docs/audits/counsellor-module-final-completion-audit.md`  
5. `docs/audits/counsellor-ownership-work-allocation-phase3i-program-product-decision.md`  
6. `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-closure.md`  
7. `docs/audits/hospital-portal-post-phase3i-program-transition-audit.md`  
8. `ot-returned-action.ts` — factual navigation context only  

Only **this** Product Decision artifact is modified by this recording task.

---

## 3. Current State vs Selected Decision

### Facts (current implementation — unchanged by this recording)

| Fact | Current state |
|------|----------------|
| OT Returned surface | Waiting List OT Returned tab — IP-journey projection |
| Waiting List lifecycle status | OT Returned is **not** a Waiting List lifecycle status |
| Existing action when session present | **Re-plan** → navigate to counselling session |
| Existing action when session absent | **Open journey** → navigate to IP journey |
| New resolution CTA | **Not implemented** by this task |
| C-01 presentation | **Unchanged** |

### Existing Re-plan / Open Journey distinction

| Case | Current navigation fact | Product Decision meaning |
|------|-------------------------|--------------------------|
| `counselingSessionId` present | Re-plan opens the counselling session | Option D now defines the **intended operational meaning** for this case: **Continue / Resume Counselling** via the existing Counselling Session workspace |
| `counselingSessionId` NULL | Open Journey opens the IP journey | **APPROVED** no-session resolution: **Remain in existing IP operational journey** (§20) |

Historically, Re-plan / Open Journey have been **presentation / navigation** behavior and were **not** previously an approved OT operational transition. Option D defines intended operational meaning for the **existing-session** case only.

**This task does not implement or modify navigation.**

---

## 4. C-01 Relationship

| Statement | Value |
|-----------|--------|
| Path 1 | **SELECTED** |
| Option D (existing-session case) | **SELECTED** |
| Area 7 | Remains unresolved for the **no-session** case and any other explicitly unresolved workflow details |
| C-01 ACCEPTED | **NO** |
| C-01 CLOSED | **NO** |
| C-01 presentation | **Unchanged** |
| Re-plan / Open Journey navigation | **Unchanged** by this recording |
| New CTA | **Not implemented** |
| C-01 acceptance via this task | **Forbidden** — this task cannot mark C-01 accepted |

### What C-01 authorized vs this PD

C-01 authorized **presentation** only. Option D is a **separate** operational workflow Product Decision for the existing-session case. It does **not** reopen C-01 redesign and does **not** authorize implementation by itself.

---

## 5. Central Product Question — Answer Status

> When an OT-returned patient is surfaced to the Counsellor operational workspace, what is the authoritative next operational action?

| Scope | Answer | Status |
|-------|--------|--------|
| **Existing counselling session** (`counselingSessionId` present) | **Continue / Resume Counselling** through the existing Counselling Session workspace | **SELECTED (Option D)** |
| **No linked counselling session** (`counselingSessionId` NULL) | **Remain in existing IP operational journey** (Open Journey) | **APPROVED** (no-session Option D — §20) |
| **OT return reason matrix** | **Universal** — does not vary by `otReturnReason` | **APPROVED** (§20) |

---

## 6. Candidate Options Status

| Option | Status |
|--------|--------|
| A — ReQueue | **NOT SELECTED** (explicitly **No** for OT Returned → Continue/Resume path) |
| B — Repeat Counselling | **NOT SELECTED** |
| C — Return to Waiting List | **NOT SELECTED** (explicitly **No** for existing-session Option D) |
| **D — Continue / Resume Counselling** | **SELECTED** (existing-session case) |
| E — Other approved transition | **NOT SELECTED** |

---

## 7. Existing-session case — Decision (`counselingSessionId` present)

**SELECTED:**

| Topic | Decision |
|-------|----------|
| Authoritative operational resolution | Continue / Resume Counselling |
| Operational anchor | Existing counselling session |
| Operational surface | Existing Counselling Session workspace |
| New counselling session | **No** automatic creation |
| Return to Waiting List | **Not** implied |
| ReQueue | **Not** triggered |
| Automatic ownership transfer | **No** |
| Automatic `CounselorId` clearing | **No** |
| Ownership rules | Existing certified ownership rules remain authoritative |
| Permission model | Existing Counselling Session authorization model remains authoritative |
| Concurrency | Existing CAS / Version / 409 remain applicable if future implementation mutates existing records |

**Do not implement these behaviors in this task.** Recording only.

### Ownership boundary (Option D)

Option D does **NOT** automatically change ownership.

- `CounselorId` remains the ownership source of truth.  
- Opening / viewing / resuming must **not** silently create ownership.  
- Existing ownership must **not** be silently cleared.  
- Existing ownership must **not** be silently transferred.  
- Reassignment is **not** automatically triggered.  
- Ownership History is **not** automatically created merely because the patient is opened / resumed.  

If future implementation requires an ownership mutation, that mutation must be **explicitly defined and authorized** before implementation.

### ReQueue boundary

OT Returned → Continue / Resume Counselling does **NOT** invoke ReQueue.

Do **not** create a second ReQueue mechanism. Certified ReQueue remains a **Follow-up** responsibility unless a separate explicit Product Decision changes it.

### Waiting List boundary

OT Returned does **NOT** become a Waiting List lifecycle status.

Do **not**: insert OT Returned into Waiting List · create a duplicate Waiting List row · create a new Waiting List lifecycle state · automatically requeue · modify PD16 · modify Waiting List assignment behavior.

Waiting List remains the shared operational queue.

### New counselling session

For `counselingSessionId` present: **No** automatic new counselling session. The existing session remains authoritative.

---

## 8. No-Session Case — Governance Audit Gate (`counselingSessionId == NULL`)

> **Supersession (2026-09-22):** Product Owner **APPROVED** Remain in IP (§20). Content below is the historical audit trail; authoritative selection is §20 / §19.13 checkboxes.

| Field | Value |
|-------|--------|
| **Gate type** | Historical **AUDIT + DECISION SURFACE** — selection now recorded in §20 |
| **No-session Product Decision** | **APPROVED — REMAIN IN IP** (see §20) |
| **Implementation Authorized** | **NO** (readiness A — no code change required) |
| **Existing-session Option D** | **UNCHANGED** — not revisited |

### A. CURRENT VERIFIED FACTS

| Fact | Evidence |
|------|----------|
| OT Returned list source | Waiting List page loads IP journeys: `ipManagementApi.listJourneys({ branchId, clinicalState: 'ReadyForSurgery' })`, then client-filters `!!otReturnReason` (`waiting-list/page.tsx`) |
| Data nature | IP `PatientJourney` projection fields `otReturnReason` + `counselingSessionId` (`ip-management.api.ts` / IP service) — **not** Auth Waiting List queue rows |
| No-session CTA | `resolveOtReturnedAction`: when `counselingSessionId` is null/blank → `{ kind: 'open-journey', label: 'Open journey', href: ipJourneyHref(journeyId) }` (`ot-returned-action.ts`) |
| Open Journey route | `/dashboard/ip-management/journey/{journeyId}` — **no query params inventing counselling** (`ip-rail-links.ts`) |
| Resulting state after CTA | Navigation only into existing IP Journey page; **no** automatic Counselling Session create, Waiting List insert, ReQueue, Assign, or `CounselorId` mutation observed on this path |
| Explicit counselling resolution for no-session | **Does not exist** in current OT Returned UI |
| Option D (existing session) | Remains **SELECTED** and **out of scope** for this gate |

### B. EXISTING IMPLEMENTATION EVIDENCE — Exact Trace

```text
OT Returned record (PatientJourney)
  → GET /ip-management/journeys?branchId=&clinicalState=ReadyForSurgery
  → FE filter: otReturnReason truthy
  → Waiting List tab OtReturned → WaitingListOtReturnedRow
  → resolveOtReturnedAction({ journeyId, counselingSessionId: null })
  → CTA: "Open journey"
  → router.push('/dashboard/ip-management/journey/{journeyId}')
  → IP Journey workspace (overview / ward / preop / billing / ot / …)
  → STOP (no automatic counselling side-effect on this CTA)
```

Verified by unit tests: `ot-returned-action.test.ts`, `WaitingListOtReturnedRow.test.tsx` (null → Open journey).

Comment in code (factual, not a Product Decision): *"never invent a session."*

### C. PRODUCT DECISION QUESTIONS (no-session — unanswered)

1. Where should the patient be operationally resolved when `counselingSessionId == NULL`?  
2. Should a new Counselling Session be created?  
3. Should the patient return to the shared Waiting List?  
4. Should ReQueue be used?  
5. Should the patient remain in the IP / Post-Surgery operational workflow?  
6. Is there already an existing workflow that handles this situation?  
7. If a new Counselling Session is proposed, what business evidence supports a new counselling episode?  
8. If Waiting List re-entry is proposed, what workflow supports it and what lifecycle consequences exist?  
9. If ReQueue is proposed, does certified ReQueue meaning actually apply to OT Returned?  
10. If the patient remains in IP, what existing operational action resolves the case?  
11. Does the correct behavior depend on OT Return Reason?  
12. Is there evidence that some OT Return Reasons require different handling?  
13. Should `CounselorId` remain NULL when no existing counselling session exists?  
14. Should a new counselor assignment be required before counselling can continue?  
15. Who is authorized to perform the eventual resolution?  
16. Is a new audit / history event required?  
17. Does any candidate workflow introduce a new lifecycle state or state transition?  
18. Does any candidate workflow create a duplicate operational work item?  
19. What should happen if the responsible operational user is unavailable?  
20. Is the no-session decision independent of the OT Return Reason Matrix, or must the reason matrix be resolved first?  

**Answers:** **NOT SELECTED** in this artifact. Product Owner decision required.

### D. CANDIDATE OPTIONS (repository-supported surfaces — **not ranked, not selected**)

| Option | Concept | Repository-supported today? | Notes (evidence only) |
|--------|---------|-----------------------------|------------------------|
| **A** | Create new Counselling Session / Repeat Counselling | **Partial** — `Add Patient` → `POST /Counseling/sessions` + `AddToQueue` exists as a **general** Waiting List create path (`add-patient-to-waiting-list.ts`); **no** OT Returned CTA wires this for no-session | Would need Product Decision: ownership (who owns?), duplicate queue risk, episode meaning; may need new UI/API wiring |
| **B** | Return to shared Waiting List | **Partial** — shared Waiting List + PD16 exist; Add Patient / session create can populate queue; **no** OT→Waiting List re-entry API/CTA for no-session | Risk of duplicate work item if IP journey remains active; must not invent WL lifecycle status for OT Returned |
| **C** | ReQueue via certified ReQueue | **Exists for counselling sessions** — Auth `ReQueueSessionAsync` clears `CounselorId` → NULL + Ownership History; Follow-up owns ReQueue CTA; Sessions/WL explicitly do **not** expose ReQueue | Certified meaning is ownership release of an **existing** counselling session — **not** evidenced as OT Returned / no-session resolution; Phase 3I: ReQueue ≠ OT action |
| **D** | Remain in IP / Post-Surgery journey; operational resolution elsewhere / manual | **Matches current behavior** — Open Journey → IP journey page; ward board also surfaces `otReturnReason` as operational attention (`ip-row-situation.ts`, `ward-board-queues.ts`) | Does **not** by itself define a counselling resolution; Product must decide if “stay in IP” is the **authoritative** resolution or only interim navigation |
| **E** | Other existing workflow | IP Journey tabs / OT board / ward KPIs already show returned-from-OT context | No dedicated Counsellor “resolve OT no-session” workflow found |

**Do not select A–E here.** Technical convenience ≠ business rule.

### E. OWNERSHIP IMPACT (locked unless separate PD)

| Rule | Implication for candidates |
|------|----------------------------|
| Open / view / start ≠ ownership | Open Journey must not assign `CounselorId` |
| `CounselorId` SoT for active counselling | Creating a new session would require explicit Assign / claim rules — not silent |
| No silent clear / transfer / ReQueue | Candidates A–C that mutate ownership need explicit PD |
| CAS / 409 | Any future session/ownership mutation must retain Version / 409 |

Conflicts: any automatic Assign / ReQueue / create-and-own path without explicit PD → **Product Decision dependency**.

### F. LIFECYCLE IMPACT

| Topic | Finding |
|-------|---------|
| OT Returned | Remains IP projection (`otReturnReason`); ReadyForSurgery filter |
| Waiting List status enum | Must **not** invent OT Returned as WL lifecycle status (C-01 / Phase 3I locked) |
| New state machine | No existing Counsellor state transition dedicated to “OT Returned no-session resolve” |
| IP journey | Open Journey lands on existing clinical/IP state machine without counselling auto-create |

### G. DUPLICATE-WORKLIST RISK

| Risk | Finding |
|------|---------|
| New OT worklist / Dashboard / My OT Returns | **Forbidden** unless separate PD |
| Second Waiting List | **Forbidden** |
| Parallel unresolved queues | OT Returned tab already attention-surfaces IP rows; adding WL insert without clearing IP attention may **duplicate** work |

Prefer existing authoritative surface (IP Journey and/or Counselling Waiting List / Sessions) — Product must choose; do not invent a third queue.

### H. REASON-MATRIX DEPENDENCY

| Finding | Status |
|---------|--------|
| `otReturnReason` stored as free-text string on journey | Yes (`OtReturnReason` / `ot_return_reason`) |
| Enumerated Counsellor reason matrix driving different counselling outcomes | **Not found** in repository Product Decisions / Counsellor OT Returned code |
| Ward / IP surfaces treat reason as display / KPI attention | Yes |

**Assessment:**

> **Reason Matrix Required Before No-Session Decision Can Be Fully Approved** — *unless* Product explicitly decides a **universal** no-session rule that applies to all reasons.

This audit does **not** create the reason matrix and does **not** invent reason-specific rules.

### I. UNRESOLVED BUSINESS RULES

- Authoritative operational resolution for OT Returned when `counselingSessionId == NULL`  
- Whether Open Journey is sufficient as the permanent counselling-side resolution or only interim navigation  
- Whether new counselling episode / Waiting List re-entry / ReQueue are appropriate  
- Ownership / Assign requirements for any new counselling work  
- Interaction with OT Return Reason Matrix  
- Persona / permission for the eventual resolution action  
- Audit event requirements if mutations are later approved  

### J. PRODUCT OWNER DECISION (no-session)

| Decision | Selection | Status |
|----------|-----------|--------|
| No-session authoritative resolution | **Remain in IP** (Open Journey) | **APPROVED** (§20) |
| Option A / B / C / D / E for no-session | **D — Remain in IP** | **APPROVED** |
| Universal vs reason-dependent | **Universal** | **APPROVED** |

### K. IMPLEMENTATION AUTHORIZATION

```text
Implementation Authorized: NO
```

This no-session audit gate does **not** authorize code, UI, API, DB, permission, route, lifecycle, ownership, or C-01 changes.

### L. NEXT GOVERNANCE GATE

```text
NEXT GATE =
PRODUCT OWNER DECISION — OT RETURNED NO-SESSION CASE
(optionally concurrent / prior: OT RETURN REASON MATRIX)

THEN (only after no-session + remaining gaps resolved):
BOUNDED IMPLEMENTATION AUTHORIZATION
(for Option D existing-session + approved no-session behavior)
```

---

## 9. OT return reason matrix

| Field | Value |
|-------|--------|
| Status | **APPROVED — UNIVERSAL** (2026-09-22 §20) |
| Dependency note | No-session counselling resolution does **not** depend on `otReturnReason` content |

Do **not** invent reason-specific rules. Do **not** introduce an enum or controlled vocabulary. Do **not** modify `otReturnReason`. Historical findings remain in §8.H / §19.4.

---

## 10. Operational surface

| Case | Surface |
|------|---------|
| Existing session (Option D) | **Existing Counselling Session workspace** — **SELECTED** |
| No-session | **Existing IP Journey** (Open Journey) — **APPROVED** |

Do **not** create: new worklist · Counsellor Dashboard · My Waiting List · OT-specific Counsellor dashboard · duplicate operational queue.

**No UI implementation** is authorized by this task.

---

## 11. Lifecycle decision

| Topic | Decision |
|-------|----------|
| OT Returned data nature | Remains an **IP-journey projection** |
| Waiting List lifecycle status | **No** — OT Returned is not converted into a Waiting List lifecycle status |
| Existing-session action | Continue / Resume Counselling (**Option D**) |
| No-session action | **Remain in IP** (Open Journey) — **APPROVED** |
| New status enum / WL status / OT lifecycle state / state-machine transition | **Not introduced** |

Any exact technical state transition required to operationalize Resume (or a future no-session resolution) must be defined during a **bounded implementation decision** after Product Decisions are complete.

---
## 12. Permissions

Use the **existing Counselling Session authorization model**.

- Do **not** create a new role.  
- Do **not** create a new permission.  
- Do **not** infer permissions from UI visibility.  
- Backend authorization remains authoritative.  

If implementation later discovers the existing authorization model is insufficient, **STOP** and raise a separate Product / engineering decision rather than inventing a permission.

Status: **PARTIALLY DEFINED** (existing model; exact workflow authorization TBD if needed).

---

## 13. Audit / History

- No new Ownership History event is automatically created merely because the user resumes / opens the existing counselling session.  
- Existing operational audit patterns remain authoritative.  
- If future implementation changes lifecycle or ownership state, the required audit / history event must be explicitly defined in the implementation decision.  
- Do **not** create a new audit store.  

Status: **PARTIALLY DEFINED**.

---

## 14. Concurrency / Safety

If future implementation mutates an existing counselling session or ownership record, existing protections remain authoritative:

- Version  
- CAS  
- HTTP 409  
- no silent overwrite  

Do **not** implement concurrency changes in this task.

Status: **DEFINED BOUNDARY**.

---

## 15. Explicit Non-Authorization

This Option D recording authorizes **NO** implementation.

Specifically **not authorized**:

- code / UI / CTA changes  
- API / DB / migration / permission / route changes  
- ownership / lifecycle / state-machine mutations  
- ReQueue / Waiting List insertion / new session creation  
- inventing no-session behavior  
- inventing OT return reason matrix  
- Phase 3I reopen / Slice 14 / Phase 3J  
- C-01 acceptance / closure  

---

## 16. Product Owner Decision Record

| Decision | Product Owner Selection | Status |
|----------|-------------------------|--------|
| Governance path | Path 1 | **SELECTED** |
| Authoritative OT resolution | Option D — Continue / Resume Counselling | **SELECTED** |
| Existing counselling session | Continue / Resume existing session | **SELECTED** |
| Re-enter Waiting List | No | **SELECTED** |
| Create new session when existing session exists | No | **SELECTED** |
| ReQueue from OT Returned | No | **SELECTED** |
| CounselorId automatic clearing | No | **SELECTED** |
| Automatic ownership transfer | No | **SELECTED** |
| Operational surface | Existing Counselling Session workspace | **SELECTED** |
| OT Returned as Waiting List lifecycle status | No | **SELECTED** |
| No-session case (`counselingSessionId` = NULL) | **Remain in existing IP operational journey** (Open Journey) | **APPROVED** |
| OT return reason matrix | **Universal** — `otReturnReason` does not determine no-session counselling resolution; no enum/vocabulary | **APPROVED** |
| Permissions / persona (no-session) | Existing IP Journey authorization; no new OT resolve permission | **APPROVED** |
| Ownership (no-session) | `CounselorId` remains NULL; no implicit ownership / Assign / history | **APPROVED** |
| Audit / history (no-session) | Navigation non-mutating; no new ownership-history event | **APPROVED** |
| Lifecycle (no-session) | OT Returned remains IP projection/attention; no new state | **APPROVED** |
| Concurrency (no-session) | No new CAS/Version/409 for navigation | **APPROVED** |
| Duplicate work (no-session) | No new worklist / session / WL insert / ReQueue | **APPROVED** |
| C-01 acceptance path | Manual UAT / acceptance remains separate | **NOT SELECTED** (acceptance gate separate) |

### Path 2 status

**PATH 2** (waive Area 7 for C-01) — **NOT SELECTED**.

---

## 17. Implementation Gate

```text
Implementation Authorized:    NO
Implementation Performed:     NO
Implementation Readiness:     A — NO CODE CHANGE REQUIRED (no-session)
```

**Reason (updated 2026-09-22 §20):** Product Decisions for existing-session (Option D), no-session (Remain in IP / Open Journey), and Reason Matrix (Universal) are **APPROVED**. Repository readiness audit classifies no-session as **A — NO CODE CHANGE REQUIRED**. Therefore **no application implementation authorization is required** for the approved no-session behavior.

Existing-session Continue/Resume remains a **decision meaning** over existing Re-plan navigation; no separate application delta is authorized by this recording.

C-01 acceptance remains a **separate manual UAT gate**.

### Governance sequence (updated)

```text
PATH 1 SELECTED
        ↓
OPTION D SELECTED (existing-session case)
        ↓
NO-SESSION AUDIT + PREPARATION COMPLETE
        ↓
NO-SESSION APPROVED — REMAIN IN IP (Universal Reason Matrix)
        ↓
IMPLEMENTATION READINESS = A — NO CODE CHANGE REQUIRED
        ↓
MANUAL UAT / C-01 ACCEPTANCE
```

Do **not** skip Manual UAT.

---

## 18. Governance Gate

```text
Decision Path:                    PATH 1 SELECTED
Workflow (existing session):      OPTION D — CONTINUE / RESUME — SELECTED
Existing-session case:            APPROVED / LOCKED
No-session case:                  APPROVED — REMAIN IN IP (Open Journey)
OT return reason matrix:          APPROVED — UNIVERSAL
Overall Product Decision:         APPROVED

Implementation Readiness:         A — NO CODE CHANGE REQUIRED
Implementation Authorized:        NO
Implementation Performed:         NO

C-01 Accepted:                    NO
C-01 Closed:                      NO

Phase 3I:                         FORMALLY CLOSED
Slice 14:                         DOES NOT EXIST
Phase 3J:                         NOT CREATED
```

### Certified ownership boundaries preserved

- Waiting List remains shared; PD16 remains authoritative.  
- `CounselorId` remains ownership SoT; open/view/start/resume does not establish ownership.  
- Explicit assignment establishes ownership; `CreatedByUserId` is not ownership.  
- ReQueue remains a Follow-up responsibility unless a future Product Decision explicitly defines otherwise.  
- Ownership History / CAS / Version / 409 remain authoritative.  
- Sessions remains active-work / RR host; Follow-up / Finalize remain shared; Analytics My Work remains reporting-only.  
- No duplicate worklist / Counsellor Dashboard / My Waiting List / cross-branch bypass.  
- No automatic ownership transfer without explicit approval.  

### Next governance gate

```text
NEXT GATE = MANUAL UAT / C-01 ACCEPTANCE
```

See **§20 Final Product Decision Recording + Implementation Readiness Audit**.
---

## 19. Complete No-Session Product Decision Preparation

**Date:** 2026-09-22  
**Mode:** Governance preparation only — **no Product Owner selection recorded** — **Implementation Authorized = NO**  
**Preserves:** Path 1; Option D (existing-session); Phase 3I CLOSED; Slice 13 CLOSED; Slice 14 does not exist; Phase 3J not created; C-01 presentation unchanged.

> **Lettering note:** For the **no-session** case below, options are labeled **A–E per this preparation gate** (New Session / Waiting List / ReQueue / Remain in IP / Other). This lettering is **independent** of the earlier existing-session candidate labels in §6 (where **D** meant Continue/Resume). Do not conflate the two alphabets.

### 19.1 Current verified behavior

| Step | Verified fact | Evidence |
|------|---------------|----------|
| Data source | IP `PatientJourney` list — **not** Auth Waiting List queue rows | `waiting-list/page.tsx` → `ipManagementApi.listJourneys({ branchId, clinicalState: 'ReadyForSurgery' })` |
| OT Returned filter | Client filter `!!otReturnReason` | same page |
| Projection fields | `otReturnReason` + `counselingSessionId` on journey DTO | `ip-management.api.ts`; IP `PatientJourney` / `JourneyDtos` |
| Row surface | `WaitingListOtReturnedRow` | counsellor Waiting List OT Returned tab |
| Action resolver | `resolveOtReturnedAction({ journeyId, counselingSessionId })` | `ot-returned-action.ts` |
| **No-session CTA** | **`counselingSessionId` null/blank → `{ kind: 'open-journey', label: 'Open journey' }`** | `ot-returned-action.ts`; tests `ot-returned-action.test.ts`, `WaitingListOtReturnedRow.test.tsx` |
| Route | `/dashboard/ip-management/journey/{journeyId}` — no counselling query params | `ipJourneyHref` in `ip-rail-links.ts` |
| Side effects on CTA | **Navigation only** — no session create, WL insert, ReQueue, Assign, or `CounselorId` mutation on this path | Code + comment: *"never invent a session"* |
| Parallel IP attention | Ward / IP row situation surfaces `otReturnReason` as operational attention | `ip-row-situation.ts`, `ward-board-queues.ts`, ward page |

**Trace (no-session):**

```text
PatientJourney (ReadyForSurgery + otReturnReason set)
  → Waiting List OT Returned tab
  → WaitingListOtReturnedRow
  → resolveOtReturnedAction(counselingSessionId == NULL)
  → "Open journey"
  → /dashboard/ip-management/journey/{id}
  → IP Journey workspace
  → STOP (no automatic counselling mutation)
```

**Governance meaning of current behavior:** Open Journey is **verified interim navigation**. It is **not** automatically the permanent Product Decision for no-session resolution.

### 19.2 Existing-session decision (preserved — do not revisit)

| Topic | Locked decision |
|-------|-----------------|
| Condition | OT Returned + `counselingSessionId != NULL` |
| Selection | **OPTION D — Continue / Resume** existing Counselling Session journey |
| Surface | Existing Counselling Session workspace |
| New session | **No** automatic creation |
| Waiting List re-entry | **Not** implied |
| ReQueue | **Not** triggered |
| Ownership | No silent establish / clear / transfer; `CounselorId` SoT unchanged |
| Permissions / routes / lifecycle | Existing models; no change authorized by this preparation |

Current navigation label **"Re-plan"** remains presentation fact; Option D defines **intended operational meaning** for the existing-session case only.

### 19.3 No-session decision surface (`counselingSessionId == NULL`)

**Status:** **NOT SELECTED** — Product Owner must choose one repository-supported option below. Options are **not ranked**.

#### OPTION A — NEW COUNSELLING SESSION

| Dimension | Repository finding |
|-----------|-------------------|
| Existing implementation evidence | `POST /Counseling/sessions` via `CreateSessionAsync`; Waiting List **Add Patient** path uses create + optional `AddToQueue` (`add-patient-to-waiting-list.ts`). **No** OT Returned no-session CTA wires create. |
| Business meaning evidenced | Create starts a counselling episode (`Status = Scheduled`); PD-C reuse block can **reject** create when a non-historical episode still exists (`TryGetCreateSessionReuseBlockAsync`). Repeat counselling is a **queue status** concept, not proven as OT-return semantics. |
| Ownership impact | Counsellor create can set `CounselorId = currentUserId` + Ownership History `EstablishedOnCreate` (PD-ADM-01: admin/non-counsellor → NULL). Client-supplied `CounselorId` ignored. |
| Lifecycle impact | New session ± queue row; OT Returned IP projection (`otReturnReason`) **not** auto-cleared by counselling create. |
| Authorization impact | Existing Counseling create authorization + assignable-counsellor rules; OT-specific permission **not** found. |
| Audit impact | Create + optional ownership trail; IP journey audit separate. |
| Duplicate-work risk | **High** if historical/active episodes or WL rows exist; PD-C may block; IP OT attention may remain. |
| Required Product Decision | Whether OT return without linked session means a **new counselling episode**; who owns it; how IP attention clears. |

#### OPTION B — RETURN TO WAITING LIST

| Dimension | Repository finding |
|-----------|-------------------|
| Existing implementation evidence | Canonical shared Waiting List (`GET /Counseling/waiting-list`, PD16 branch scope). Insert via create+`AddToQueue` / `AddToQueueAsync`. **No** dedicated OT→WL re-entry API/CTA for no-session. |
| Business meaning evidenced | Shared operational queue for counselling work within branch scope — **not** an OT lifecycle status. |
| Ownership impact | Queue insert does not by itself invent ownership bypass; unowned sessions remain assignable under certified Assign rules. |
| Lifecycle impact | Would add WL work while IP journey may still show OT Returned; must **not** invent OT Returned as WL lifecycle status (locked). |
| Authorization impact | Existing WL / Counseling APIs + PD16. |
| Audit impact | Queue/session audit via Auth; no OT-specific resolve event found. |
| Duplicate-work risk | **High** — patient may remain OT Returned IP attention **and** WL work simultaneously. |
| Required Product Decision | Whether counselling re-entry is required; how duplicate IP/WL responsibility is avoided. |

#### OPTION C — REQUEUE

| Dimension | Repository finding |
|-----------|-------------------|
| Existing implementation evidence | Auth `ReQueueSessionAsync` — requires an **existing** counselling session; clears `CounselorId` → NULL + Ownership History. CTA owned by **Follow-up**; Sessions/WL do **not** expose ReQueue (Phase 3I certified). |
| Business meaning evidenced | Ownership release / return to shared pool for an **owned session** — **not** OT Returned / no-session resolution. |
| Ownership impact | Explicit clear of `CounselorId` — conflicts with “no silent clear” if applied without PD; **inapplicable** when no session exists. |
| Lifecycle impact | Session/queue ownership semantics only; does not create a session from NULL. |
| Authorization impact | Follow-up ReQueue authorization model. |
| Audit impact | Ownership History on ReQueue. |
| Duplicate-work risk | Misapplication would mutate wrong domain; cannot resolve no-session by itself. |
| Required Product Decision | Whether ReQueue meaning is extended to OT Returned (**no repository evidence** that it applies today). |

#### OPTION D — REMAIN IN IP

| Dimension | Repository finding |
|-----------|-------------------|
| Existing implementation evidence | **Matches current CTA** — Open Journey → IP Journey; ward KPI/`returnedFromOt` attention; OT return written when clinical transition SentToOT/InOT → ReadyForSurgery with `req.Reason`. |
| Business meaning evidenced | OT Returned is an **IP/Post-Surgery operational condition** (`ot_return_reason` TEXT on `patient_journey`). Counselling side currently has **no** dedicated resolve mutation. |
| Ownership impact | Navigation does not set `CounselorId`. Remains NULL if no counselling ownership exists. |
| Lifecycle impact | Patient stays on IP clinical/OT state machine; counselling episode not created. |
| Authorization impact | Existing IP journey / ward / OT role permissions for IP actions; counsellor may only navigate if route permitted. |
| Audit impact | IP transition already audited when return occurred; Open Journey itself is not a mutation. |
| Duplicate-work risk | Counsellor tab remains an **attention surface** without counselling ownership — risk of orphan attention unless Product accepts IP-only resolution. |
| Required Product Decision | Whether “remain in IP” is the **authoritative counselling-side resolution** (counsellor has no required counselling action) or only interim navigation. |

#### OPTION E — OTHER EXISTING WORKFLOW

| Dimension | Repository finding |
|-----------|-------------------|
| Existing implementation evidence | IP Journey tabs, OT board, ward board, cancel-surgery (clears `OtReturnReason`), rebook paths — operational elsewhere. **No** dedicated Counsellor “resolve OT no-session” workflow found beyond Open Journey. |
| Business meaning evidenced | Existing IP/OT/ward workflows may clear or supersede OT return in IP domain (e.g. cancel clears reason). |
| Ownership / lifecycle / auth / audit | Follow whichever existing IP workflow Product selects — do not invent a new Counsellor workflow. |
| Duplicate-work risk | Depends on chosen IP workflow. |
| Required Product Decision | Only if Product names a **specific existing** IP/OT/ward action as the counselling-side resolution. |

**Do not select A–E in this preparation.** Technical convenience ≠ business rule. Current Open Journey **must not** be presumed permanent.

### 19.4 Reason Matrix findings

| Question | Finding |
|----------|---------|
| 1. Free text? | **Yes** — `string?` / `TEXT` column `ot_return_reason` |
| 2. Enum? | **No** Counsellor/IP enum for OT return reasons found |
| 3. Controlled vocabulary? | **No** controlled vocabulary / reason code table found |
| 4. Persisted? | **Yes** — `patient_journey.ot_return_reason` |
| 5. Validated? | OT return path sets from `req.Reason` when non-whitespace on SentToOT/InOT → ReadyForSurgery; **not** validated against a code list |
| 6. Used in backend logic? | Presence used for metrics/filters; **content not branched** for counselling outcomes |
| 7. Workflow branch on content? | **No** `switch`/matrix on reason text found |
| 8. Documented reason semantics? | Migration/docs describe purpose (“returned from OT to ward”); **no** Counsellor reason matrix PD |
| 9. UI labels implying meaning? | Display only — FE splits on `" — "` for primary/note presentation (`WaitingListOtReturnedRow`); ward shows “Returned from OT” + reason text |

**Universal vs reason-dependent:** Repository does **not** establish either rule.

```text
Reason Matrix Product Decision Required.
(Do not invent reasons. Do not create the matrix in this gate.)
```

Product may later choose: (a) universal no-session rule for all reasons, or (b) reason-dependent behavior — only after an explicit matrix or explicit waiver.

### 19.5 Ownership findings

Certified rules **preserved** (Phase 3I / this PD):

- `CounselorId` = ownership SoT; `CreatedByUserId` ≠ ownership  
- Open / view / start / resume ≠ ownership  
- Explicit Assign establishes ownership; Reassign authorized only  
- ReQueue semantics unchanged; no silent transfer/clear/cross-branch bypass  

| Question | Status |
|----------|--------|
| 1. Should `CounselorId` remain NULL? | **PRODUCT DECISION REQUIRED** (depends on selected no-session option) |
| 2. If session created, who owns it? | **PRODUCT DECISION REQUIRED** (create-as-owner vs NULL + Assign — both patterns exist) |
| 3. Is explicit Assign required? | **PRODUCT DECISION REQUIRED** |
| 4. Can creation establish ownership? | Evidenced for assignable counsellor create — **whether OT path may use it = PRODUCT DECISION REQUIRED** |
| 5. Can OT resolution transfer ownership? | **No** existing OT→ownership transfer; would need PD — default **forbidden** without approval |
| 6. Is Reassign applicable? | Only if an owned session exists — **not** for pure no-session without create |
| 7. New ownership history event? | Only if mutation approved — reuse existing Ownership History; **do not** invent second store |
| 8. Existing ACL cover action? | Open Journey: navigation. Mutating options: existing Counseling/IP ACLs — sufficiency **PRODUCT/SECURITY DECISION REQUIRED** if gaps found at implementation audit |

### 19.6 Authorization findings

| Finding | Detail |
|---------|--------|
| Prefer | Existing roles + permissions + PD16 branch auth + AuthService patterns |
| Do not create | Supervisor role, new ownership role, new permission family (unless separate Security/Product PD) |
| Current no-session CTA | Navigation to IP Journey — uses existing route protection; **no** OT-resolve mutation permission |
| If Option A/B | Existing Counseling create / queue / Assign permissions likely candidates — **must be confirmed** in implementation readiness, not invented here |
| If Option C | Follow-up ReQueue authorization — **not evidenced** for OT Returned |
| If Option D/E | IP journey / ward / OT permissions for IP operational actions |

```text
If existing authorization is insufficient after option selection:
Authorization Gap — Product/Security Decision Required.
```

### 19.7 Audit / History findings

| Path | Mutation? | Mechanism |
|------|-----------|-----------|
| Open Journey (current) | **No** | No new history required for navigation alone |
| Create session / AddToQueue | **Yes** | Auth session create + optional Ownership History `EstablishedOnCreate` |
| ReQueue | **Yes** | Ownership History (certified) |
| Assign / Reassign | **Yes** | Existing ownership trail |
| IP state transitions (OT return, cancel) | **Yes** | IP journey service + outbox/lifecycle patterns |

**Rule:** Reuse existing audit architecture. Do **not** create a second ownership-history mechanism. Actor / timestamp / patient / journey / previous→resulting state / action / reason — use fields **already supported** by the chosen mechanism.

### 19.8 Lifecycle findings

| Question | Finding until Product selects |
|----------|-------------------------------|
| 1. OT Returned remain IP projection? | **Yes today**; changing this needs PD |
| 2. Become Waiting List lifecycle state? | **No** — locked forbidden unless future PD overrides |
| 3. Create Counselling Session? | **Not today** on no-session CTA; Option A would |
| 4. New counselling episode? | Only if Option A approved **and** PD-C allows |
| 5. Change Follow-up lifecycle? | **Not evidenced** for OT Returned no-session |
| 6. New status? | **Do not introduce** unless explicitly approved |
| 7. New state-machine transition? | **Do not introduce** unless explicitly approved |

For any **approved** no-session behavior, document exactly:

```text
Current condition → User/system action → Resulting operational condition
```

…in the Product Owner selection recording (future gate). This preparation does **not** invent that transition.

### 19.9 Concurrency findings

| Question | Finding |
|----------|---------|
| 1. Which record versioned? | Counseling sessions: Version/CAS/409 on ownership mutations. IP journeys: `ExpectedUpdatedAt` / version guards on transitions. |
| 2. Which operation protected? | Assign / ReQueue / claim / IP transitions — **not** Open Journey navigation |
| 3. Stale state? | Existing 409 / conflict patterns on mutating APIs |
| 4. Two users resolve same OT Return? | **PRODUCT DECISION REQUIRED** once a mutating resolve exists; today both can open journey (idempotent read) |
| 5. Duplicate operational work? | Possible if Option A/B approved without clearing IP attention — see §19.10 |

Do **not** invent a new concurrency mechanism if an existing one applies.

### 19.10 Duplicate-work findings

Could the patient simultaneously exist as OT Returned + IP work + Waiting List + Counselling Session + Follow-up?

| Combination | Risk |
|-------------|------|
| OT Returned tab + active IP journey | **Already true today** (by design as attention projection) |
| + new WL row / new session (A/B) | **Duplicate counselling responsibility** unless IP attention cleared or Product accepts dual surface |
| + ReQueue (C) | N/A without session; misuse risk if forced |
| + Follow-up work | Possible if follow-up episode exists independently |

**Forbidden unless separate PD:** OT Returned worklist · My OT Returns · Counsellor Dashboard · duplicate Waiting List · parallel ownership queue.

Existing authoritative queues remain authoritative.

### 19.11 Edge cases (`counselingSessionId == NULL`)

| # | Edge case | Repository establishment | Status |
|---|-----------|--------------------------|--------|
| 1 | `counselingSessionId == NULL` | Verified path → Open Journey | **Behavior selected?** No — PD required |
| 2 | Patient has OT Returned | `otReturnReason` truthy | Fact |
| 3 | Active IP journey | List uses ReadyForSurgery journeys | Fact |
| 4 | No counselling session linked | Projection null | Fact |
| 5 | No `CounselorId` | Expected when no owned session | Fact; ownership PD required for mutations |
| 6 | Previous historical counselling sessions | PD-C / SurgeryDone may allow new episode | **PRODUCT OWNER DECISION REQUIRED** for OT path |
| 7 | Multiple historical sessions | Possible in domain; create reuse logic scopes non-historical | **PRODUCT OWNER DECISION REQUIRED** |
| 8 | Another active counselling episode | PD-C can block create / force continue-or-ReEvaluate | **PRODUCT OWNER DECISION REQUIRED** (especially vs Option A) |
| 9 | Already on Waiting List | Duplicate detection helpers exist for Add Patient | **PRODUCT OWNER DECISION REQUIRED** |
| 10 | Other downstream operational work | Ward/OT/billing may also show patient | **PRODUCT OWNER DECISION REQUIRED** for responsibility boundary |

### 19.12 Product Owner decision matrix (do not auto-select)

| Decision Area | Repository Finding | Business Rule Needed |
|---------------|-------------------|----------------------|
| No-session resolution | Open Journey = current navigation only; A–E are partial/existing surfaces | Select A / B / C / D / E |
| Reason Matrix | Free-text; no enum/vocab/branching | Universal vs reason-dependent (or more analysis) |
| Ownership | Certified SoT; create-as-owner vs Assign both exist | NULL vs Assign vs create-establishes vs other |
| Authorization | Existing Counseling/IP/Follow-up models; no OT-resolve permission | Sufficient vs named permission vs Security PD |
| Audit/History | Navigation = no mutation; mutating options have existing trails | No new history vs reuse existing mechanism |
| Lifecycle | IP projection today; no WL OT status; no new Counsellor OT transition | Unchanged vs existing transition vs new (explicit) |
| Concurrency | CAS/Version/409 on mutations; N/A for pure navigation | Apply existing vs no mutation vs additional PD |
| Duplicate Work | Dual IP attention + counselling work possible | How (or whether) dual responsibility is allowed |

#### Recommended governance path (order only — **not** a business-rule selection)

1. No-session operational resolution (A–E)  
2. Universal vs reason-dependent behavior  
3. Ownership implications  
4. Persona / permission  
5. Audit / history  
6. Lifecycle / state transition  
7. Concurrency  
8. Duplicate-work validation  
9. Implementation authorization (separate gate)  

### 19.13 PRODUCT OWNER DECISION REQUIRED

**Status (2026-09-22):** Product Owner selections **recorded below** and finalized in §20.

#### NO-SESSION RESOLUTION

- [ ] A — New Counselling Session  
- [ ] B — Return to Waiting List  
- [ ] C — ReQueue  
- [x] D — Remain in IP  
- [ ] E — Other existing workflow  

#### REASON BEHAVIOR

- [x] Universal  
- [ ] Reason-dependent  
- [ ] More analysis required  

#### OWNERSHIP

- [x] CounselorId remains NULL  
- [ ] Explicit assignment required  
- [ ] Existing-session ownership rule applies  
- [ ] Other approved rule  

#### AUTHORIZATION

- [x] Existing authorization sufficient  
- [ ] Specific existing permission required  
- [ ] Security/Product decision required  

*Clarification:* Existing **IP Journey** authorization applies (navigation). No new OT resolve permission.

#### AUDIT

- [x] No mutation / no new history  
- [ ] Existing audit mechanism  
- [ ] Existing ownership history  
- [ ] Other approved audit requirement  

#### LIFECYCLE

- [x] Existing lifecycle unchanged  
- [ ] Existing lifecycle transition  
- [ ] New transition explicitly required  

#### CONCURRENCY

- [ ] Existing CAS/Version/409 applies  
- [x] No mutation  
- [ ] Additional decision required  

> **Product Owner selection date:** 2026-09-22 — recorded in §20. Prior unchecked state superseded by this recording.

### 19.14 Implementation gate (superseded by §20)

Historical preparation gate: Implementation Authorized = NO. See **§20** for final Product Decision recording and readiness classification **A — NO CODE CHANGE REQUIRED**.

### 19.15 C-01 boundary

C-01 Waiting List Dashboard Redesign remains **IMPLEMENTED** with UAT **14/15 PASS**. Area 7 operational meaning is resolved by §20; **C-01 ACCEPTED / CLOSED** still requires a **separate manual UAT acceptance** recording. **Do not** modify C-01 presentation in this gate.

### 19.16 Next gate (historical — superseded)

Superseded by §20.18: next gate = **MANUAL UAT / C-01 ACCEPTANCE**.

---

## 20. Final Product Decision Recording + Implementation Readiness Audit

**Date:** 2026-09-22  
**Mode:** Product Decision recording + readiness audit only — **no application implementation**

### 20.1 Product Decision status

**APPROVED** — complete OT Returned operational resolution Product Decision for both session cases and Reason Matrix (universal).

### 20.2 NO-SESSION CASE — APPROVED

```text
OT Returned + counselingSessionId == NULL
        ↓
Remain in the existing IP operational journey
        ↓
Open Journey → /dashboard/ip-management/journey/{id}
```

The system **MUST NOT** automatically:

- create a new Counselling Session  
- return the patient to the Counsellor Waiting List  
- invoke ReQueue  
- assign a `CounselorId`  
- transfer ownership  
- clear an existing `CounselorId`  
- create a new counselling episode  
- create a new OT Returned worklist  

**Approved operational resolution** = existing **Open Journey → IP Journey** behavior.

### 20.3 REASON MATRIX — APPROVED

**Universal.** No-session resolution does **not** vary by `otReturnReason`.

Reasons recorded by Product Owner:

- `otReturnReason` is free-text  
- no controlled vocabulary  
- no backend reason branching for counselling outcomes  
- no Counsellor reason matrix  
- UI `" — "` split is presentation-only  

**Do not** introduce reason-specific behaviour, enum, or controlled vocabulary. **Do not** modify `otReturnReason`.

### 20.4 EXISTING-SESSION CASE — LOCKED (unchanged)

```text
OT Returned + counselingSessionId != NULL
        ↓
Continue / Resume existing Counselling Session journey
```

Ownership / `CounselorId` / Reassign / Waiting List / ReQueue / lifecycle / permissions / routes — **not revisited**.

### 20.5 OWNERSHIP — APPROVED (no-session)

| Rule | Decision |
|------|----------|
| `CounselorId` | Remains **NULL** |
| Open IP Journey | Does **not** establish counselling ownership |
| View / start IP work | Does **not** establish counselling ownership |
| Assign / Reassign / transfer / clear | **No** automatic |
| Ownership History | **No** event for navigation |

Phase 3I ownership model remains authoritative.

### 20.6 AUTHORIZATION — APPROVED (no-session)

Existing **IP Journey** authorization (`ip-management` layout `ProtectedRoute` + existing IP permissions).  

**No** new OT Resolve permission, Supervisor role, ownership role, or authorization family.  
**No** change to PD16, Counselling authorization, or Follow-up authorization.

### 20.7 AUDIT / HISTORY — APPROVED (no-session)

Navigation is **non-mutating**. No new ownership-history event. No second history store. No OT Returned resolution audit merely for navigation.

### 20.8 LIFECYCLE — APPROVED (no-session)

OT Returned remains an **IP operational projection / attention condition**.  

It does **not** become Waiting List status, Counselling Session status, ReQueue status, or a new lifecycle state.  
**No** new state-machine transition.

### 20.9 CONCURRENCY — APPROVED (no-session)

No new CAS / Version / 409 for navigation. Existing protections remain for actual mutating IP or counselling workflows.

### 20.10 DUPLICATE WORK — APPROVED (no-session)

**No** OT Returned worklist · My OT Returns · Counsellor Dashboard · duplicate WL entry · automatic session · automatic ReQueue · parallel ownership queue.  

Authoritative operational surface = **existing IP Journey**.

### 20.11 EDGE CASE POLICY — APPROVED

For historical / multiple historical / other active counselling sessions, existing Waiting List presence, or other downstream workflows:  

**Do not** invent automatic transitions.  

Approved rule remains: `counselingSessionId == NULL` → remain in IP operational journey.  
Different handling requires a **separate** Product Decision.

### 20.12 Implementation readiness audit (inspect only — no code changes)

| Item | Finding | Aligns with PD? |
|------|---------|-----------------|
| A. `resolveOtReturnedAction(null)` | Returns `{ kind: 'open-journey', label: 'Open journey', href: ipJourneyHref(journeyId) }`; does **not** read `otReturnReason`; never invents a session | **Yes** |
| B. `WaitingListOtReturnedRow` | Uses resolver; CTA navigates via `onNavigate(action.href)`; reason display is presentation split only | **Yes** |
| C. Open Journey navigation | Router push to IP journey href | **Yes** |
| D. IP Journey route | `/dashboard/ip-management/journey/{id}` via `ipJourneyHref` | **Yes** |
| E. IP Journey authorization | `apps/.../ip-management/layout.tsx` wraps with `ProtectedRoute` | **Yes** — existing model |
| F. OT Returned display/attention | WL tab filters `otReturnReason`; ward/IP attention unchanged; no mutation on CTA | **Yes** |
| G. Existing-session path | Non-null session → Re-plan → counselling session route | **Yes** — Option D preserved |
| H. Tests | `ot-returned-action.test.ts` (null + empty → open-journey; present → replan); `WaitingListOtReturnedRow.test.tsx` (Open journey fallback) | **Yes** — evidence only, not modified |

**Side-effect check:** No create session / AddToQueue / ReQueue / Assign / `CounselorId` mutation on no-session CTA path.

### 20.13 Implementation readiness result

```text
A — NO CODE CHANGE REQUIRED
```

Current implementation **already exactly represents** the approved no-session Product Decision. Documentation / Manual UAT acceptance only.

**Implementation Authorization:**

```text
PENDING SEPARATE IMPLEMENTATION GATE — not applicable for no-session
(No implementation authorization is required for the approved no-session behavior.)

Application Implementation Authorized = NO
Application Implementation Performed = NO
```

Do **not** set Implementation Authorized = YES merely because the Product Decision is approved.

### 20.14 Exact implementation delta

**No application implementation required** for the approved no-session behavior.

Optional documentation-only follow-ups (not application code; not authorized here): Manual UAT / C-01 Area 7 acceptance recording in UAT artifacts.

### 20.15 C-01 acceptance impact

Area 7 operational meaning is now **Product-Decision resolved**.  

**C-01 UAT acceptance remains a separate manual acceptance gate.**  

```text
C-01 = NOT ACCEPTED / NOT CLOSED
```

until manual UAT and acceptance are explicitly recorded.

### 20.16 Phase / slice boundary

| Item | Status |
|------|--------|
| Phase 3I | **FORMALLY CLOSED** — not reopened |
| Slice 14 | **DOES NOT EXIST** |
| Phase 3J | **NOT CREATED** |

This is a separate bounded C-01 operational resolution decision.

### 20.17 Files changed by this recording

Only:

`docs/product-decisions/counsellor-ot-returned-operational-resolution-product-decision.md`

### 20.18 Next gate

```text
NEXT GATE = MANUAL UAT / C-01 ACCEPTANCE
```

---

## 21. Superseding Product Decision — No-Session Start Counselling (2026-09-22)

### 21.1 Supersession notice

| Prior approval (§20) | Status |
|----------------------|--------|
| No-session → Remain in IP / Open Journey | **SUPERSEDED** — retained as history only |
| Implementation readiness A — no code change | **SUPERSEDED** for no-session |

| Current approval | Status |
|------------------|--------|
| Existing session → **Continue Counselling** | **UNCHANGED / LOCKED** |
| No session → **Start Counselling** (certified create path) | **APPROVED** |
| Reason matrix | **UNIVERSAL** (unchanged) |
| Open Journey as Counsellor OT Returned CTA | **REMOVED** |

### 21.2 Authoritative operational semantics

```text
CASE A — counselingSessionId != NULL
  → Continue Counselling
  → /dashboard/counsellors-desk/{sessionId}?from=waiting-list
  → no create / no AddToQueue / no ReQueue / no ownership mutation from navigation

CASE B — counselingSessionId == NULL
  → Start Counselling
  → POST /Counseling/sessions (existing certified create; AddToQueue = false)
  → navigate to created (or PD-C conflict existing) Counselling Session workspace
  → NOT Open Journey / IP Journey as Counsellor resolution CTA

CASE C — otReturnReason
  → UNIVERSAL (informational display only; does not branch CTA)
```

### 21.3 Ownership (no-session Start)

Reuse certified create-path ownership (PD-ADM-01 / Phase 3I):

- Assignable counsellor create may establish `CounselorId = actor` + Ownership History `EstablishedOnCreate` — **same as Waiting List Add Patient create**.
- Admin/non-counsellor create → `CounselorId` NULL.
- Client-supplied `CounselorId` ignored.
- Do **not** invent a separate OT ownership mutation.

### 21.4 Waiting List / IP boundaries

- OT Returned remains an **IP journey projection** (not a WL lifecycle status).
- Start Counselling uses `AddToQueue: false` — **no** duplicate Waiting List insert.
- IP Journey remains available as contextual surface; it is **not** the Counsellor OT Returned CTA.

### 21.5 Known residual (not invented in this decision)

There is **no** existing certified API that writes `PatientJourney.CounselingSessionId` when a new counselling session is created from OT Returned. After Start Counselling:

- Navigation lands on the counselling session (success or PD-C conflict SessionId).
- Duplicate create is blocked by certified PD-C reuse (`TryGetCreateSessionReuseBlockAsync`).
- Journey projection may still show `counselingSessionId == NULL` until a future Product Decision authorizes an explicit journey↔session link — **do not invent a link API in this slice**.

### 21.6 Implementation authorization

```text
Implementation Authorized: YES (bounded OT Returned Continue / Start Counselling only)
Phase 3I reopen: NO
Slice 14: DOES NOT EXIST
Phase 3J: NOT CREATED
```

---

## Control Flags

| Flag | Value |
|------|--------|
| PATH 1 SELECTED | **YES** |
| OPTION D SELECTED (existing-session) | **YES — CONTINUE COUNSELLING** |
| NO-SESSION CASE AUDITED | **YES** |
| NO-SESSION PREPARATION COMPLETE | **YES** |
| NO-SESSION CASE SELECTED | **YES — START COUNSELLING** |
| PRIOR REMAIN-IN-IP NO-SESSION | **SUPERSEDED (§21)** |
| OT RETURN REASON MATRIX FINDINGS RECORDED | **YES** |
| OT RETURN REASON MATRIX SELECTED | **YES — UNIVERSAL** |
| OVERALL PRODUCT DECISION APPROVED | **YES** |
| IMPLEMENTATION READINESS | **BOUNDED IMPLEMENTATION (§21)** |
| IMPLEMENTATION AUTHORIZED | **YES (bounded)** |
| IMPLEMENTATION PERFORMED | **SEE APPLICATION CHANGE SET** |
| C-01 ACCEPTED | **NO** |
| C-01 CLOSED | **NO** |
| PHASE 3I REOPENED | **NO** |
| SLICE 14 CREATED | **NO** |
| PHASE 3J CREATED | **NO** |
| ARTIFACT UPDATED | **YES** |

---

**END — OT RETURNED §21 START COUNSELLING SUPERSESSION — IMPLEMENTATION AUTHORIZED (BOUNDED) — STOP AFTER UAT**
