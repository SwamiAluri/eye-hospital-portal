# Hospital Portal — Counsellor Product Portfolio / Product Owner Decision

| Field | Value |
|-------|--------|
| **Date prepared** | 2026-09-22 |
| **Decision recorded** | 2026-09-22 |
| **Document type** | **PRODUCT PORTFOLIO / PRODUCT OWNER DECISION** (preparation retained; Decision 1–5 recorded below) |
| **Mode** | **GOVERNANCE ONLY** — no production code, API, DB, permission, route, ownership, UI, workflow, state machine, or implementation |
| **Baseline audit** | `docs/audits/counsellor-final-acceptance-reconciliation-audit.md` |
| **UAT plan** | `docs/audits/counsellor-residual-acceptance-manual-uat-plan.md` — **READY FOR EXECUTION** |
| **Product Owner decision status** | **DECISION 1 APPROVED — MANUAL UAT / ACCEPTANCE COMPLETION AUTHORIZED** |
| **Manual UAT authorized?** | **YES** |
| **Any implementation authorized by this document?** | **NO** |
| **Residual UAT executed by this recording?** | **NO** |
| **Residual areas A–M accepted by this recording?** | **NO** |

---

## Exact governance statement

```text
CURRENT AUTHORIZED IMPLEMENTATION = NONE

MANUAL UAT / ACCEPTANCE COMPLETION AUTHORIZED = YES
  (residual surface A–M only; UAT plan READY FOR EXECUTION)

PHASE 3I = CLOSED

SLICE 13 = CLOSED

C-01 = ACCEPTED + CLOSED

SLICE 14 = DOES NOT EXIST

PHASE 3J = NOT CREATED

NO SUCCESSOR IMPLEMENTATION PROGRAM IS CURRENTLY APPROVED.

PHASE 2X = BLOCKED

PHASE 2W FORMAL SIGNED = 0 (governance OPEN)

RESIDUAL UAT EXECUTED = NO
RESIDUAL AREAS A–M ACCEPTED = NO
```

**UAT authorization boundary (binding):**

> This Product Owner decision authorizes controlled Manual UAT and acceptance completion only. It does not authorize production implementation, redesign, API/DB changes, permission changes, ownership-model changes, workflow changes, or implementation of deferred decisions.
---

## 1. Decision Purpose

Give the Product Owner an evidence-based decision surface for what happens **after**:

- Phase 3I formal closure  
- Slice 13 formal closure  
- C-01 Waiting List Dashboard Redesign acceptance and closure  
- Counsellor Final Acceptance Reconciliation Audit  

This document distinguishes:

1. Already completed and accepted functionality  
2. Implemented functionality awaiting Manual UAT / acceptance  
3. Deferred / out-of-scope items  
4. Governance dependencies (especially Phase 2W / Phase 2X)  
5. Potential future product scope (discovery only — not authorized)  

**This document MUST NOT silently authorize implementation.**

**Historical preparation note:** Presenting options did not approve them. **As of 2026-09-22, Decision 1–5 are explicitly recorded in §12.** UAT scheduling is now authorized; production implementation remains unauthorized.

**Deferred items remain deferred until explicitly reopened.**

**A future program is not authorized merely because it is described.**

**No Phase 3J is created by this document.**
---

## 2. Current Governance State

| Item | Status |
|------|--------|
| Phase 3I | **CLOSED** (Product Owner Option A, 2026-09-22) |
| Slice 13 | **CLOSED** (Package B Delivery Accepted) |
| C-01 | **ACCEPTED + CLOSED** (Manual UAT PASS — **15 / 15**; **0** failures) |
| Slice 14 | **DOES NOT EXIST** |
| Phase 3J | **NOT CREATED** |
| Current authorized implementation | **NONE** |
| Manual UAT / acceptance completion | **AUTHORIZED** (Decision 1 — APPROVED) |
| Approved successor program | **NONE** |
| Overall Counsellor module status | **MIXED** — see item-level reconciliation (not uniformly product-COMPLETE) |
| Residual A–M Manual UAT | **NOT RUN** |
| Residual A–M Acceptance | **NOT ACCEPTED** |
| Phase 2W formal SIGNED | **0** (OPEN) |
| Phase 2X | **BLOCKED** |

Do not contradict these states. Certified / closed scope is **preserved unchanged** by Decision 1–5.

Certified ownership rules remain **LOCKED**:

- operational queues remain shared  
- active counselling work uses explicit `CounselorId` ownership  
- opening / viewing / starting does **not** establish ownership  
- `CounselorId` is established through explicit assignment  
- `CreatedByUserId` is **not** ownership  
- Waiting List remains shared within server-authorized branch scope  
- ownership mutation requires the certified ACL  
- optimistic concurrency / CAS / 409 remains authoritative  
- ownership history remains authoritative  
- ReQueue → `CounselorId` NULL remains authoritative  
- Follow-up remains shared  
- Analytics My Work is reporting only  
- Finalize Surgery remains shared  
- Reassignment Required is an operational condition, not a lifecycle Status  
- no automatic leave transfer / ownership clearing / ReQueue  
- no cross-branch bypass  
- no new Supervisor role  

---

## 3. Evidence Baseline

Authoritative current baseline:

| Artifact | Role |
|----------|------|
| `docs/audits/counsellor-final-acceptance-reconciliation-audit.md` | **Current residual acceptance surface** |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-program-product-decision.md` | Phase 3I Option A — FORMALLY CLOSED |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-closure.md` | Slice 13 CLOSED; PD-S13-K / PD-S13-L governance UAT gates |
| `docs/audits/phase3i-slice13-package-b-acceptance.md` | Package B Delivery Accepted |
| `docs/product-decisions/counsellor-c01-waiting-list-dashboard-redesign-product-decision.md` | C-01 PD-C01-01…06 APPROVED (historical authorization for closed package) |
| `docs/audits/counsellor-c01-waiting-list-dashboard-redesign-acceptance-closure.md` | C-01 ACCEPTED + CLOSED |
| `docs/product-decisions/counsellor-ot-returned-operational-resolution-product-decision.md` | OT Returned operational resolution (feeds C-01 Area 7 PASS) |
| `docs/audits/hospital-portal-post-phase3i-program-transition-audit.md` | No approved successor; authorized implementation NONE |
| `docs/audits/hospital-portal-product-portfolio-decision-preparation-audit.md` | Broader Hospital Portal portfolio decision surface (context) |

Supporting residual evidence (not acceptance):

| Artifact | Role |
|----------|------|
| PD-S13-K / PD-S13-L (Slice 13 Product Decisions) | Wave 2 / ReQueue→History = governance UAT; **no redesign** |
| `counsellor-session-requeue-notes-to-history-ux-report.md` | ReQueue→History READY FOR MANUAL UAT / Not Accepted |
| `counsellor-ownership-work-allocation-phase3i-pda-b-c-implementation-report.md` | PD-A/B/C READY FOR MANUAL UAT |
| Finalize Surgery null-branch + row-open 403 fix reports | READY FOR MANUAL UAT |
| Phase 2Y / 2Z implementation + 2Z remediation audits | Implemented; awaiting Manual UAT / certification |
| `counsellor-followup-analytics-phase2w-final-gate.md` | Phase 2W: **0 formally SIGNED**; Phase 2X **BLOCKED** |

Classification codes preserved from the Final Acceptance Reconciliation Audit:

| Code | Meaning |
|------|---------|
| **A** | COMPLETE + ACCEPTED |
| **B** | IMPLEMENTED + UAT REQUIRED |
| **C** | IMPLEMENTED + UAT PASSED + ACCEPTANCE RECORD REQUIRED |
| **D** | IMPLEMENTATION GAP — PRODUCT DECISION REQUIRED |
| **E** | DEFERRED / OUT OF SCOPE |
| **F** | SUPERSEDED / NO LONGER APPLICABLE |

---

## 4. Certified / Closed Scope

Do **not** propose reopening any of the following:

| Area | Status |
|------|--------|
| Phase 3I ownership model | **CLOSED / LOCKED** |
| Slices 1–13 certified ownership behavior | **CLOSED** (certified / accepted via program reconciliation + Slice 11–13 DA) |
| Slice 13 Package B (Sessions RR Reassign, navigation, pagination, Sessions UX) | **CLOSED / DELIVERY ACCEPTED** |
| Counsellor navigation (incl. Sessions) | **ACCEPTED** |
| Sessions pagination (client/server Package B contract as closed) | **ACCEPTED** |
| C-01 Waiting List Dashboard Redesign | **ACCEPTED + CLOSED** |
| Waiting List branch authorization (PD16) | **CERTIFIED** |
| Explicit `CounselorId` ownership + ACL | **LOCKED** |
| Ownership History | **LOCKED** |
| CAS / 409 concurrency | **LOCKED** |
| ReQueue → `CounselorId` NULL (backend semantics) | **LOCKED** |
| Follow-up shared operational model (Phase 3I honesty) | **CERTIFIED** |
| Analytics My Work reporting-only (Slice 11) | **ACCEPTED** |
| Finalize Surgery ownership boundaries (Slice 9 honesty) | **CERTIFIED** |
| C-01 OT Returned operational resolution | **ACCEPTED** (within closed C-01) |
| Existing Hospital Portal design system | **AUTHORITATIVE** — do not replace |

C-01 safety — do **not** propose unless Product Owner creates a **new** Product Decision:

- another Waiting List redesign  
- another C-01 implementation pass  
- server-side Waiting List pagination  
- DTO enrichment  
- another OT Returned redesign  
- new Waiting List ownership model  
- My Queue  
- Waiting List ReQueue  

Phase 3I safety — do **not**:

- reopen Phase 3I  
- create Slice 14  
- create Phase 3J  
- extend Slice 13  
- create another ownership slice under Phase 3I  

Any future ownership requirement requires a **new explicit Product Decision / program**.

---

## 5. Remaining Acceptance Surface

The Final Acceptance Reconciliation Audit identifies **14** residual acceptance / governance gates.

**Most are classification B — IMPLEMENTED + UAT REQUIRED.**  
They are **not** new implementation packages.

| # | Gate | Classification | What is required | Implementation authorized? |
|---|------|----------------|------------------|----------------------------|
| 1 | Wave 2 — Quote | **B** | Formal Manual UAT / acceptance (PD-S13-K) | **NO** |
| 2 | Wave 2 — Decision | **B** | Formal Manual UAT / acceptance (PD-S13-K) | **NO** |
| 3 | Wave 2 — Insurance | **B** | Formal Manual UAT / acceptance (PD-S13-K) | **NO** |
| 4 | Wave 2 — Notes | **B** | Formal Manual UAT / acceptance (PD-S13-K) | **NO** |
| 5 | Wave 2 — Finish | **B** | Formal Manual UAT / acceptance (PD-S13-K) | **NO** |
| 6 | ReQueue → History | **B** | Formal Manual UAT / Delivery Acceptance (PD-S13-L); **no redesign** | **NO** |
| 7 | PD-A (OT master configuration / ops) | **B** | Formal Manual UAT / acceptance (incl. ops verification) | **NO** |
| 8 | PD-B (Admin Assign unassigned Repeat) | **B** | Formal Manual UAT / acceptance | **NO** |
| 9 | PD-C (Create reuse / second-eye) | **B** | Formal Manual UAT / acceptance | **NO** |
| 10 | Finalize Surgery — NULL branch data fix | **B** | Formal Manual UAT / acceptance | **NO** |
| 11 | Finalize Surgery — row-open 403 fix | **B** | Formal Manual UAT / acceptance | **NO** |
| 12 | Phase 2Y | **B** | Formal Manual UAT / acceptance | **NO** |
| 13 | Phase 2Z | **B** | Formal Manual UAT / certification | **NO** |
| 14 | Phase 2W formal SIGNED | **D** (governance / Product Decision dependency) | Formal stakeholder SIGNED; Phase 2X remains BLOCKED | **NO** |

Do **not** turn these into redesign, migration, ownership change, or successor-phase scope.

Separate questions the Product Owner must not collapse:

| Question | Residual answer today |
|----------|------------------------|
| Is the functionality implemented? | **YES** for gates 1–13; Phase 2W is governance formality |
| Are automated tests present? | **YES** for most B items (suites exist; audit did not re-run) |
| Has Manual UAT passed? | **NO** for gates 1–13 |
| Is there an acceptance/closure record? | **NO** for gates 1–13; Phase 2W **0 SIGNED** |
| Is further implementation authorized? | **NO** |

---

## 6. Deferred / Out-of-Scope Surface

These remain **deferred / out of scope** unless the Product Owner **explicitly reopens** them through a **new** Product Decision.

They are **decision surfaces only** — **not** implementation tasks.

| ID / Item | Classification | Notes |
|-----------|----------------|-------|
| PD-S13-C — Admin → Reassignment Required handoff | **E** | OUT OF PACKAGE; needs new PD before any coding |
| PD-S13-E — Claim availability | **E** | Deferred → tech/security audit first |
| PD-S13-F — Post-Surgery ownership / D6 persistence SoT | **E** | Deferred; Post-Surgery remains shared |
| PD-S13-G — Legacy ownership stamps | **E** | NO ACTION |
| PD-S13-H — Bulk remediation | **E** | NO ACTION |
| PD-S13-I — Counsellor Dashboard | **E** | NO ACTION |
| PD-S13-J — Additional Waiting List UX | **E** | NO ACTION (C-01 closed its authorized UX package) |
| PD-S13-M — Clinical Recommendations clinical SoT | **E** | Future clinical track if ever |
| PD-S13-PAG-04 — Backend MaxPageSize | **E** | Accepted deferral |
| JWT / session invalidation | **E** | OUT OF SCOPE (security track) |
| HR leave integration | **E** | OUT OF SCOPE |
| Phase 2X — Lifecycle exit / clinical SoT | **E** + **BLOCKED** | Depends on SoT + Phase 2W formal SIGNED |
| Slice 14 | **E** / nonexistent | Do not invent |
| Phase 3J | **E** / not created | Do not invent |
| Server-side Waiting List pagination | **E** | Out of closed C-01 (PD-C01-02 Option A) |
| DTO enrichment | **E** | Out of closed C-01 (PD-C01-03 Option A) |
| My Queue | **E** | Forbidden under certified ownership model |
| Waiting List ReQueue | **E** | Not certified Waiting List CTA |

---

## 7. Phase 2W / Phase 2X Dependency

| Item | Status |
|------|--------|
| Phase 2W formal SIGNED (PD2–PD16) | **0 formally SIGNED** |
| Phase 2W workshop working decisions | Recorded as WORKING — NOT SIGNED |
| Phase 2X | **BLOCKED** |
| Phase 2Y / Phase 2Z | Historically implemented under working decisions; Manual UAT / certification still outstanding (**B**) |

**Phase 2W is not a coding defect.**

It is a **governance / Product Decision dependency**.

Do **not** implement Phase 2X from this document.

Do **not** treat unsigned workshop decisions as formal Product Owner acceptance.

---

## 8. Product Portfolio Decision Options

### OPTION A — ACCEPTANCE COMPLETION TRACK

Product Owner decides to finish the **already implemented** Counsellor residual acceptance surface.

**In scope (governance / UAT only):**

- Schedule Manual UAT for Wave 2 Quote → Finish  
- Schedule Manual UAT for ReQueue → History  
- Schedule Manual UAT for PD-A / PD-B / PD-C  
- Schedule Manual UAT for Finalize Surgery fixes  
- Schedule Manual UAT for Phase 2Y  
- Schedule Manual UAT for Phase 2Z  
- Resolve / document Phase 2W formal SIGNED governance gate  

**Not in scope:**

- Redesign  
- New implementation packages  
- Reopening Phase 3I / C-01  
- Creating Slice 14 / Phase 3J  
- Implementing Phase 2X  

**Implementation authorized by selecting Option A alone?** **NO**  
(UAT scheduling ≠ implementation authorization)

---

### OPTION B — ACCEPTANCE + PRODUCT PORTFOLIO REVIEW

Product Owner keeps existing implemented residuals available for UAT but does **not** immediately schedule all acceptance work.

At the same time, Product Portfolio reviews:

- whether Counsellor requires additional future investment  
- whether deferred items should remain deferred  
- whether new operational requirements exist  
- whether any future ownership, workflow, analytics, or clinical integration work is justified  

**Implementation authorized?** **NO**

---

### OPTION C — CLOSE CURRENT PROGRAM AT CURRENT GOVERNANCE STATE

Product Owner explicitly decides that:

- Phase 3I remains closed  
- Slice 13 remains closed  
- C-01 remains closed  
- existing certified functionality remains accepted  
- residual implemented items remain separately pending acceptance  
- deferred items remain deferred  
- no successor implementation program is created  

This does **NOT** claim the entire Counsellor module is product-COMPLETE.

It records a **deliberate portfolio pause**.

**Implementation authorized?** **NO**

---

### OPTION D — CREATE A NEW FUTURE COUNSELLOR PROGRAM

Only if the Product Owner identifies **new business requirements**.

This option must **NOT** automatically become Phase 3J.

A new program must receive **before any coding**:

- new scope  
- new Product Decision  
- explicit objectives  
- explicit boundaries  
- business-owner approval  
- dependency analysis  
- acceptance criteria  
- explicit implementation authorization  

Do **not** name it Phase 3J.  
Do **not** invent a successor phase number in this document.  
Describing Option D does **not** approve Option D.

**Implementation authorized by describing Option D?** **NO**

---

### Decision distinctions (do not collapse)

The Product Owner must separately decide:

| # | Decision |
|---|----------|
| **A** | What should happen to already implemented but unaccepted functionality? |
| **B** | What should happen to deferred items? |
| **C** | Is there a need for new Counsellor product scope? |
| **D** | Is a new implementation program required? |

---

## 9. Product Owner Decision Matrix

| Decision Area | Current State | Product Owner Decision Required | Options | Implementation Authorized? |
|---------------|---------------|----------------------------------|---------|----------------------------|
| 1. Wave 2 acceptance | **B** — implemented; formal UAT / acceptance outstanding (PD-S13-K) | Schedule UAT now / keep pending / other | UAT now; keep pending; waive with explicit record (if ever) | **NO** |
| 2. ReQueue → History acceptance | **B** — implemented; Not Accepted (PD-S13-L) | Schedule UAT now / keep pending / other | UAT now; keep pending; **no redesign** | **NO** |
| 3. PD-A/B/C acceptance | **B** — READY FOR MANUAL UAT | Schedule UAT now / keep pending / other | UAT now; keep pending | **NO** |
| 4. Finalize fixes acceptance | **B** — READY FOR MANUAL UAT | Schedule UAT now / keep pending / other | UAT now; keep pending | **NO** |
| 5. Phase 2Y acceptance | **B** — awaiting Manual UAT | Schedule UAT now / keep pending / other | UAT now; keep pending | **NO** |
| 6. Phase 2Z acceptance | **B** — remediation not certified | Schedule UAT now / keep pending / other | UAT now; keep pending | **NO** |
| 7. Phase 2W formal SIGNED | **D** — 0 SIGNED | Resolve SIGNED / keep unsigned / other | Formal SIGNED; keep pending | **NO** (signing ≠ coding) |
| 8. Phase 2X | **E** + **BLOCKED** | Keep blocked / reopen only via new PD + SoT | Keep blocked; future PD path | **NO** |
| 9. Deferred PD-S13-C | **E** — OUT OF PACKAGE | Remain deferred / reopen via new PD | Remain deferred; reopen named item | **NO** unless new PD + authorization |
| 10. Deferred PD-S13-E | **E** — deferred | Remain deferred / tech-security audit then PD | Remain deferred; audit path | **NO** unless new PD + authorization |
| 11. Deferred PD-S13-F | **E** — deferred | Remain deferred / D6 SoT audit then PD | Remain deferred; audit path | **NO** unless new PD + authorization |
| 12. Future Counsellor product scope | No approved new scope | None / discovery / other | No new scope; portfolio discovery | **NO** |
| 13. Successor program | **NONE approved** | No successor / new PD program / other | No successor; Option D path | **NO** |
| 14. Portfolio priority | Counsellor residuals vs other modules | Prioritize Counsellor UAT / other module / review first | Option A / B / C / D framing | **NO** |

---

## 10. Explicit Non-Decisions

**Historical preparation wording (retained):** At preparation time this document did not approve options, schedule UAT, mark PASS/ACCEPTED, SIGN Phase 2W, authorize Phase 2X, reopen Phase 3I/C-01, create Slice 14/Phase 3J, or authorize production implementation.

**Superseded only as follows by the recorded Decision 1–5 (2026-09-22):** Option A framing + Decision 1 now **APPROVE** controlled Manual UAT scheduling/execution for residual A–M. All other non-decisions above remain in force.

This decision recording still does **not**:

- mark any residual UAT as PASS  
- mark any residual area ACCEPTED  
- formally SIGN Phase 2W decisions (SIGNED remains **0**)  
- authorize Phase 2X  
- reopen Phase 3I  
- create Slice 14  
- create Phase 3J  
- reopen C-01  
- authorize another Waiting List redesign  
- convert deferred items into backlog implementation  
- authorize production code, API, DB, permission, route, ownership, or UI changes  

---

## 11. Implementation Authorization Boundary

```text
CURRENT AUTHORIZED IMPLEMENTATION = NONE
MANUAL UAT / ACCEPTANCE COMPLETION AUTHORIZED = YES
```

| Action | Authorized by this document? |
|--------|------------------------------|
| Production code change | **NO** |
| API / DB / permission / route change | **NO** |
| Ownership / workflow / state machine change | **NO** |
| UI redesign | **NO** |
| Phase 2X implementation | **NO** |
| Slice 14 / Phase 3J / successor program start | **NO** |
| C-01 reopen / Waiting List redesign | **NO** |
| Deferred Product Decision implementation | **NO** |
| Controlled Manual UAT execution (A–M per UAT plan) | **YES** |
| Formal acceptance recording after UAT PASS | **YES** (governance documentation only — still **not** implementation) |
| Defect governance recording on FAIL | **YES** (does **not** authorize coding) |

Governance sequence (current):

```text
AUDIT
  → PRODUCT DECISION (Decision 1 APPROVED — UAT track)
    → MANUAL UAT (authorized; NOT YET EXECUTED)
      → PASS / FAIL / BLOCKED evidence
        → ACCEPTANCE or DEFECT GOVERNANCE
          → PRODUCT PORTFOLIO REVIEW
```

Production implementation remains unauthorized unless a **separate** explicit Product Decision later authorizes exact work.
---

## 12. Product Owner Decision

**Status: RECORDED — Decision 1–5 approved as specified below (2026-09-22).**  
Product Owner name/signature fields in §15 remain blank if not supplied — **not invented**.

### Decision 1 — Existing Implemented Residuals

**Title:** Proceed with Manual UAT / Acceptance Completion  
**Decision:** **APPROVED**

- [x] Proceed with Manual UAT / acceptance completion  
- [ ] Keep pending without immediate UAT scheduling  
- [ ] Other — explicitly define: ________________________________

**Product Owner decision (recorded):**

Proceed with controlled Manual UAT and acceptance completion for the residual Counsellor acceptance surface **A–M**, using:

`docs/audits/counsellor-residual-acceptance-manual-uat-plan.md`

**Approved UAT scope:**

| ID | Area |
|----|------|
| A | Wave 2 Quote |
| B | Wave 2 Decision |
| C | Wave 2 Insurance |
| D | Wave 2 Notes |
| E | Wave 2 Finish |
| F | ReQueue → History |
| G | PD-A |
| H | PD-B |
| I | PD-C |
| J | Finalize NULL branch |
| K | Finalize 403 |
| L | Phase 2Y |
| M | Phase 2Z |

**This approval authorizes:**

- controlled Manual UAT scheduling  
- execution of the existing UAT scenarios  
- recording PASS / FAIL / BLOCKED / NOT RUN  
- collection of evidence  
- formal acceptance where criteria are satisfied  
- defect governance where UAT identifies failures  

**This approval does NOT authorize implementation.**

**UAT plan status:** **READY FOR EXECUTION**  
**UAT executed by this decision recording:** **NO**  
**All scenarios remain NOT RUN until human UAT occurs.**  
**Do not mark any scenario PASS or any area ACCEPTED in this recording.**

**UAT execution control (before execution):**

- verify test environment  
- verify required fixtures  
- verify required operational configuration  
- verify AuthService restart where required  
- verify appropriate test users/permissions  
- verify evidence capture process  

Then execute the approved UAT plan. **Do not modify production behavior to make a UAT scenario pass.**

**Governance clarifications (retained — not resolved by inference):**

| Item | Status |
|------|--------|
| **W2-I-03** — Insurance depth (shell-only vs deeper CCMS/claim lifecycle) | **UNRESOLVED** — retain UAT plan governance status |
| **PD-C-04** — Optional PD-C sub-items / deferred scope | **UNRESOLVED** — remain deferred / out of residual UAT unless separately confirmed |

### Decision 2 — Phase 2W / Phase 2X

**Decision recorded:**

- Phase 2W formal SIGNED governance **must be resolved/documented**.  
- Current formal SIGNED status: **0**  
- Phase 2W remains a **governance dependency** (not a coding defect).  
- Phase 2X remains **BLOCKED**.  
- Resolving Phase 2W SIGNED does **not** by itself authorize Phase 2X.  
- Phase 2X requires its own applicable governance, clinical/source-of-truth, and implementation gates.  
- **No Phase 2X implementation is authorized by this decision.**

- [x] Resolve formal Phase 2W SIGNED governance first *(as a governance dependency to resolve/document; not as Phase 2X authorization)*  
- [x] Keep Phase 2X blocked  
- [ ] Other — explicitly define: ________________________________

### Decision 3 — Deferred Counsellor Items

**Decision recorded:** Deferred Counsellor items remain **DEFERRED**.

- [x] Remain deferred  
- [ ] Reopen specific item(s) through a new Product Decision  

No implementation authorization is created for:

- PD-S13-C  
- PD-S13-E  
- PD-S13-F  
- PD-S13-G  
- PD-S13-H  
- PD-S13-I  
- PD-S13-J  
- PD-S13-M  
- MaxPageSize  
- JWT/session invalidation security track  
- HR leave/reassignment track  
- other explicitly deferred items identified by the authoritative portfolio/reconciliation artifacts  

Do not expand or reinterpret this list.

### Decision 4 — Future Counsellor Program

**Decision recorded:** No successor Counsellor implementation program is approved at this time.

- [x] No successor program at this time  
- [ ] Initiate a new Product Portfolio discovery / Product Decision  
- [ ] Other — explicitly define: ________________________________

Therefore:

- Phase 3I remains **CLOSED**  
- Slice 14 does **not** exist  
- Phase 3J is **not** created  
- no successor implementation phase is created  

Future Counsellor implementation requires a **new** explicit Product Decision / Product Portfolio gate.

### Decision 5 — Portfolio Priority / Current Counsellor Focus

**Decision recorded:** Current Counsellor focus is **residual acceptance completion only**.

- [x] Counsellor residual acceptance  
- [ ] Another Hospital Portal module/program  
- [ ] Portfolio review before prioritization  
- [ ] Other — explicitly define: ________________________________

**Immediate operational sequence:**

```text
Product Owner approval (Decision 1 — DONE)
  →
Manual UAT
  →
PASS / FAIL / BLOCKED evidence
  →
Acceptance or defect governance
  →
Product Portfolio review
```

No redesign or new implementation is implied by this decision.

### Portfolio option framing (cross-check)

- [x] **OPTION A** — Acceptance completion track  
- [ ] **OPTION B** — Acceptance available + portfolio review  
- [ ] **OPTION C** — Pause at current governance state  
- [ ] **OPTION D** — New future Counsellor program (new PD required; not Phase 3J)  
- [ ] None selected yet  

**Certified ownership model — unchanged by this decision:**

- shared operational queues  
- explicit `CounselorId` ownership  
- `CreatedByUserId` ≠ ownership  
- opening / viewing / starting ≠ ownership  
- explicit assignment  
- owner mutation ACL  
- ownership history  
- optimistic concurrency / 409  
- ReQueue → `CounselorId` NULL  
- Sessions Reassign behavior  
- Finalize / Post-Surgery ownership boundaries  
- Follow-up shared ownership model  
- Analytics My Work as reporting only  

These remain certified and unchanged.
---

## 13. Consequences of Each Option

| Option | What happens | What does **not** happen |
|--------|--------------|---------------------------|
| **A — Acceptance completion** | Product schedules Manual UAT / acceptance packs for B-class residuals; Phase 2W SIGNED may be pursued as governance | No redesign; no Phase 3I reopen; no Slice 14 / Phase 3J; no Phase 2X coding; no C-01 reopen |
| **B — Acceptance + portfolio review** | Residuals remain available for later UAT; portfolio evaluates future investment / deferred reopen needs | No automatic UAT schedule; no implementation; no successor program |
| **C — Pause at current state** | Closed packages stay closed; residuals stay pending acceptance; deferred stay deferred; deliberate pause recorded | Does **not** claim module product-COMPLETE; does not authorize coding |
| **D — New future program** | Only after new PD with scope, boundaries, approval, acceptance criteria, and explicit implementation authorization | Must **not** be named Phase 3J by default; describing D ≠ approving D |

---

## 14. Next Governance Gate

```text
NEXT GOVERNANCE GATE = CONTROLLED HUMAN MANUAL UAT
  (docs/audits/counsellor-residual-acceptance-manual-uat-plan.md)

CURRENT AUTHORIZED IMPLEMENTATION = NONE
MANUAL UAT AUTHORIZED = YES
RESIDUAL UAT EXECUTED = NO
RESIDUAL AREAS A–M ACCEPTED = NO
```

| After… | Typical next gate |
|--------|-------------------|
| Manual UAT PASS for an area | Record acceptance/sign-off for that area only |
| Manual UAT FAIL | Defect governance (no automatic coding authorization) |
| Manual UAT BLOCKED | Resolve prerequisite (ops/env/governance) then retest |
| Phase 2W formal SIGNED capture | Governance documentation; Phase 2X still BLOCKED |
| Residual acceptance packs complete or paused | Product Portfolio review |

---

## 15. Approval / Sign-Off Section

**Status: DECISION 1–5 RECORDED (2026-09-22) — Product Owner wet signature / printed name pending if not supplied**

Decision content above is the authoritative recorded selection. Do **not** invent Product Owner name or handwritten signature metadata.

---

Product Owner:  
____________________________  
*(Leave blank if name not supplied — do not invent.)*

Decision Date:  
**2026-09-22**

Decision:  
**Decision 1 APPROVED — Proceed with Manual UAT / Acceptance Completion (Option A track). Decisions 2–5 recorded as specified in §12.**

Approved Scope:  
**Residual Counsellor Manual UAT / acceptance completion for areas A–M per `counsellor-residual-acceptance-manual-uat-plan.md`. Phase 2W SIGNED to be resolved/documented as governance (N). No implementation scope.**

Explicitly Authorized Implementation:  
**NONE**

Deferred Items:  
**Remain DEFERRED** (PD-S13-C/E/F/G/H/I/J/M, MaxPageSize, JWT/session invalidation, HR leave/reassignment, and other explicitly deferred items per reconciliation/portfolio artifacts). W2-I-03 and PD-C-04 clarifications remain unresolved by inference.

Next Review / Gate:  
**Controlled human Manual UAT execution → acceptance / defect governance → Product Portfolio review**

---

## Control Flags

| Flag | Value |
|------|--------|
| PRODUCT OWNER DECISION 1 | **APPROVED** |
| MANUAL UAT AUTHORIZED | **YES** |
| PRODUCTION IMPLEMENTATION AUTHORIZED | **NO** |
| PRODUCTION CODE MODIFIED | **NO** |
| API / DB / PERMISSIONS / ROUTES MODIFIED | **NO** |
| OWNERSHIP / WORKFLOWS / STATE MACHINES MODIFIED | **NO** |
| UI MODIFIED | **NO** |
| RESIDUAL UAT EXECUTED | **NO** |
| RESIDUAL AREAS ACCEPTED | **NO** |
| UAT PERFORMED / MARKED PASS | **NO** |
| PHASE 3I REOPENED | **NO** |
| SLICE 13 REOPENED | **NO** |
| SLICE 14 CREATED | **NO** |
| PHASE 3J CREATED | **NO** |
| SUCCESSOR IMPLEMENTATION PROGRAM APPROVED | **NO** |
| C-01 REOPENED | **NO** |
| PHASE 2X STARTED | **NO** |
| PHASE 2X | **BLOCKED** |
| PHASE 2W FORMAL SIGNED | **0** (OPEN) |
| CURRENT AUTHORIZED IMPLEMENTATION | **NONE** |

---

**END — COUNSELLOR PRODUCT PORTFOLIO / PRODUCT OWNER DECISION RECORDED (UAT TRACK APPROVED) — STOP**