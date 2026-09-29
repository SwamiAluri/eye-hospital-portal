# Counsellor Residual Acceptance — Manual UAT Execution & Acceptance Plan

| Field | Value |
|-------|--------|
| **Date** | 2026-09-22 |
| **Document type** | Manual UAT execution & acceptance plan |
| **Status** | **UAT PLAN — READY FOR EXECUTION** |
| **Scope** | Residual Counsellor acceptance surface only (A–N below) |
| **Author / Owner** | ____________________________ |
| **Baseline audit** | `docs/audits/counsellor-final-acceptance-reconciliation-audit.md` |
| **Portfolio decision artifact** | `docs/product-decisions/hospital-portal-counsellor-product-portfolio-decision.md` |
| **Production code / API / DB / permissions / routes / ownership / UI modified by this document** | **NO** |

---

## 1. Document Control

| Field | Value |
|-------|--------|
| Document ID | `counsellor-residual-acceptance-manual-uat-plan` |
| Version | 1.0 |
| Status | **UAT PLAN — READY FOR EXECUTION** |
| Authorization of this document | **Manual UAT planning / execution only** |
| Implementation authorized | **NONE** |

This document prepares controlled Manual UAT and acceptance recording for residual Counsellor areas. It does **not** approve redesign, coding, Phase 3I reopen, Slice 14, Phase 3J, Phase 2X, C-01 reopen, or deferred Product Decision implementation.

**Execution note:** Populate Result / Evidence / Defect / Acceptance columns during actual UAT. Do **not** mark PASS or ACCEPTED in this plan until human execution completes with evidence.

---

## 2. Governance Baseline

```text
Phase 3I                              = CLOSED
Slice 13                              = CLOSED
C-01 Waiting List Dashboard Redesign  = ACCEPTED + CLOSED
Slice 14                              = DOES NOT EXIST
Phase 3J                              = NOT CREATED
Successor implementation program      = NONE APPROVED
Current authorized implementation     = NONE
Current task authorization            = MANUAL UAT / ACCEPTANCE COMPLETION ONLY
Phase 2X                              = BLOCKED
Phase 2W formal SIGNED                = 0 (unresolved governance dependency)
Deferred items                        = REMAIN DEFERRED
```

### 2.1 Portfolio decision nuance (recorded — not silently reconciled)

| Artifact | State |
|----------|--------|
| `hospital-portal-counsellor-product-portfolio-decision.md` | **PENDING** — Product Owner Decisions 1–5 unsigned |
| This UAT plan | Prepared under residual-acceptance governance for controlled Manual UAT |

**Conflict handling:** The portfolio preparation artifact is not yet signed. This plan does **not** invent Option A approval. Before **executing** UAT, Product Owner should confirm Decision 1 = *Proceed with Manual UAT / acceptance completion* (or equivalent) on the portfolio decision form. Preparing this plan does **not** authorize implementation.

### 2.2 Authoritative sources used

| Source | Role |
|--------|------|
| Final Acceptance Reconciliation Audit | Residual surface A–N classification |
| Phase 3I program Product Decision (Option A) | Phase 3I CLOSED |
| Slice 13 closure + PD-S13-K / PD-S13-L | Wave 2 / ReQueue→History = formal UAT; no redesign |
| C-01 acceptance-closure | C-01 ACCEPTED + CLOSED |
| PDA-B-C implementation report + UAT decision gate + PD-A OT gap report | PD-A/B/C expected checks |
| ReQueue→History UX report | ReQueue→History UAT steps |
| Finalize null-branch + row-open 403 fix reports | Finalize UAT checklists |
| Phase 2Y operational honesty | PD5/PD6 honesty criteria |
| Phase 2Z implementation + UAT remediation | PD13–15 + F-01…F-05 retest criteria |
| Phase 2W final gate | Formal SIGNED governance checklist |
| Journey rail / session routes / Counseling APIs (read-only) | Wave 2 stage shell evidence |

---

## 3. UAT Rules

1. UAT validates **already-implemented** behavior.  
2. UAT does **not** authorize implementation.  
3. UAT does **not** authorize redesign.  
4. UAT does **not** authorize adjacent fixes.  
5. Any defect must be recorded separately (see §13).  
6. A defect does **not** automatically authorize coding.  
7. A failed test must **not** be silently converted into PASS.  
8. Retest requires the defect to be resolved through a **separately authorized** implementation path before retest.  
9. Acceptance requires **explicit** evidence and sign-off.  
10. Automated tests ≠ Manual UAT ≠ Formal acceptance.  
11. Do not invent business rules. If expected behavior cannot be established from authoritative evidence → **GOVERNANCE CLARIFICATION REQUIRED**.  
12. Do not use ambiguous statuses (“mostly pass”, “looks good”, “working”, “verified enough”).

---

## 4. UAT Evidence Standard

Acceptable evidence for each executed scenario:

| Element | Required? |
|---------|-----------|
| Tester identity | **YES** |
| Environment (URL / tenant / branch / build if known) | **YES** |
| Date/time | **YES** |
| Scenario ID | **YES** |
| Preconditions | **YES** |
| Expected result | **YES** |
| Actual result | **YES** |
| Result: PASS / FAIL / BLOCKED / NOT RUN | **YES** |
| Screenshot/video | Where useful (not mandatory if text evidence is sufficient) |
| API / network evidence | Where necessary (e.g. 403, 409, anesthetists path) |
| Database evidence | Where necessary (e.g. `CounselorId`, session count, `branch_id`) |
| Defect reference | If FAIL or BLOCKED due to product defect |

Do **not** put PHI, tokens, or credentials in evidence artifacts or commits.

---

## 5. Acceptance Status Definitions

| Status | Meaning |
|--------|---------|
| **PASS** | Expected behavior observed and evidence recorded |
| **FAIL** | Expected behavior was not observed |
| **BLOCKED** | UAT cannot legitimately execute because a prerequisite is missing |
| **NOT RUN** | Scheduled but not yet executed |
| **ACCEPTED** | UAT PASS plus explicit acceptance/sign-off |

An area may be marked **ACCEPTED** only when **all** of §17 conditions are met. Otherwise: **NOT ACCEPTED**.

---

## 6. No-Scope-Expansion Rule

This UAT plan **explicitly prohibits**:

- Phase 3I reopening  
- Slice 14 creation  
- Phase 3J creation  
- C-01 reopening  
- Waiting List redesign  
- new Counsellor Dashboard  
- new My Work worklist  
- ownership model changes  
- Reassign redesign  
- ReQueue redesign  
- new Supervisor role  
- new ownership entity  
- API redesign  
- DB migration  
- claim / JWT changes  
- automatic leave transfer  
- Phase 2X implementation  
- deferred Product Decision implementation  

```text
NO NEW IMPLEMENTATION IS AUTHORIZED BY THIS DOCUMENT.
```

---

## 7. Residual Acceptance Surface (confirmed)

| ID | Area | Classification (reconciliation audit) | Nature |
|----|------|----------------------------------------|--------|
| A | Wave 2 — Quote | **B** | Functional UAT |
| B | Wave 2 — Decision | **B** | Functional UAT |
| C | Wave 2 — Insurance | **B** | Functional UAT |
| D | Wave 2 — Notes | **B** | Functional UAT |
| E | Wave 2 — Finish | **B** | Functional UAT |
| F | ReQueue → History | **B** | Functional UAT |
| G | PD-A | **B** | Ops/config + functional UAT |
| H | PD-B | **B** | Functional UAT |
| I | PD-C | **B** | Functional UAT |
| J | Finalize NULL branch | **B** | Functional UAT |
| K | Finalize 403 | **B** | Functional UAT |
| L | Phase 2Y | **B** | Functional UAT |
| M | Phase 2Z | **B** | Functional UAT (retest after remediation) |
| N | Phase 2W formal SIGNED | **D** | Governance checklist (not coding defect) |

---

## 8. UAT Execution Order

| Stage | Areas | Notes |
|-------|-------|-------|
| **Stage 0** | **N — Phase 2W formal SIGNED** | Governance prerequisite review. Does **not** block Stage 1–5 functional UAT of already-shipped B items. Does **block** any Phase 2X thinking. |
| **Stage 1** | A–E Wave 2 Quote → Finish | Certified journey order |
| **Stage 2** | F ReQueue → History | After Wave 2 Notes familiarity helpful |
| **Stage 3** | G–I PD-A / PD-B / PD-C | PD-A may be **BLOCKED** until ops OT config for surgery-capable branches |
| **Stage 4** | J–K Finalize NULL branch / 403 | Independent of Wave 2 |
| **Stage 5** | L–M Phase 2Y / Phase 2Z | Follow-up Center then Analytics |
| **Stage 6** | Consolidated acceptance review | Sign-off per area + portfolio next gate |

Order may be adjusted only for environment blockers (e.g. AuthService down = D6) — record as BLOCKED, do not invent new scope.

---

## 9. Ownership invariants (all functional stages)

Validate on every Wave 2 / ownership-adjacent scenario unless marked N/A:

| Invariant | Expected (certified) |
|-----------|----------------------|
| Opening / viewing session | Does **not** establish `CounselorId` |
| Starting session | Does **not** establish or change `CounselorId` |
| Ownership establishment | Explicit Assign / certified claim-for-lifecycle only |
| Non-owner mutations | Read-only / denied per certified ACL |
| APIs | Existing `api/Counseling` (and related certified endpoints) |
| Permissions | Existing `counseling_sessions.read` / `.update` / `.reassign` as applicable — no invented grants |
| Queues | No new worklist created during UAT |

---

# 10. Test Scenarios

Result / Defect / Acceptance columns start as **NOT RUN** / blank / **NOT ACCEPTED**.

---

## 10.A Wave 2 — Quote

**Authoritative criteria basis:** PD-S13-K Option B (formal UAT required; do not reimplement); journey rail stage `quote` ↔ estimate phase; session route `/dashboard/counsellors-desk/[id]`; owner mutation ACL (Slice 4).  
**Note:** No dedicated Wave 2 Quote acceptance pack under `docs/audits/`. Deep quote/package/discount rule matrices in `counselling-counsellor-guide.md` are **operational guide evidence**, not a Product Decision. If Product requires formal acceptance of every guide rule, mark **GOVERNANCE CLARIFICATION REQUIRED** for expanded Quote checklist; scenarios below validate **documented journey shell + ownership**.

### W2-Q-01 — Quote stage reachable for owned session

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-Q-01 |
| **Area** | A — Wave 2 Quote |
| **Objective** | Confirm Quote/Estimate stage is available on owned active session |
| **Preconditions** | Counsellor with `counseling_sessions.read` (+ update as needed); session with explicit `CounselorId` = current counsellor; not terminal |
| **Test steps** | 1. From Waiting List, open owned session (no silent claim). 2. Navigate journey rail to **Quote**. 3. Observe estimate/quote workspace loads. |
| **Expected result** | Quote stage opens; existing Counseling session APIs used; no new ownership stamp from open/navigate |
| **Evidence required** | Tester, env, date, actual vs expected; optional screenshot of Quote stage |
| **Result** | PASS — 2026-09-25 12:27 local. Actor counsellor4. Owned InProgress session `bb000001-…0005`. Quote stage current; estimate workspace visible. CounselorId unchanged on open. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### W2-Q-02 — Non-owner Quote is read-only

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-Q-02 |
| **Area** | A — Wave 2 Quote |
| **Objective** | Non-owner cannot mutate Quote |
| **Preconditions** | Session owned by another counsellor; actor has read access within branch scope |
| **Test steps** | 1. Open session as non-owner. 2. Attempt Quote mutation (save/edit). |
| **Expected result** | Read-only / denied per certified owner ACL; no ownership transfer |
| **Evidence required** | UI state + network deny if applicable |
| **Result** | PASS — 2026-09-25 12:27 local. Other-owner session `c5d20fdf-…`. Quote loaded. Save Draft and Complete Session controls absent. CounselorId stayed the other counsellor; version unchanged. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### W2-Q-03 — Open ≠ ownership (Waiting List → Quote path)

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-Q-03 |
| **Area** | A — Wave 2 Quote |
| **Objective** | Opening unassigned eligible item does not silently set CounselorId |
| **Preconditions** | Unassigned Waiting List item; actor may Assign or open per certified CTA |
| **Test steps** | 1. Open/view without completing Assign (use certified Assign dialog path). 2. Confirm `CounselorId` remains NULL until explicit Assign. |
| **Expected result** | No silent ownership; Assign remains explicit |
| **Evidence required** | Session ownership field / History absence of Assign |
| **Result** | PASS — 2026-09-25 12:27 local. Unassigned session `bb000001-…0015` opened on Quote. CounselorId remained null. Assign was not used. Version unchanged. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.B Wave 2 — Decision

**Basis:** PD-S13-K; journey rail `decision`; `CounsellingDecisionPhase`.

### W2-D-01 — Decision stage reachable after Quote completion path

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-D-01 |
| **Area** | B — Wave 2 Decision |
| **Objective** | Decision stage opens via certified journey |
| **Preconditions** | Owned session; Quote/estimate phase completion state sufficient for Decision per existing journey rules |
| **Test steps** | 1. Advance or select **Decision** on journey rail. 2. Confirm Decision workspace loads. |
| **Expected result** | Decision stage available; existing session Update fields used; no ownership change from navigation |
| **Evidence required** | Tester/env/date + actual result |
| **Result** | PASS — 2026-09-25 12:27 local. Same owned InProgress session. Decision stage became current; decision workspace visible. CounselorId unchanged. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### W2-D-02 — Non-owner Decision read-only

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-D-02 |
| **Area** | B — Wave 2 Decision |
| **Objective** | Non-owner cannot mutate Decision |
| **Preconditions** | Other-owner session |
| **Test steps** | Attempt Decision save/mutation as non-owner |
| **Expected result** | Denied / read-only; no ownership transfer |
| **Evidence required** | UI + optional network |
| **Result** | PASS — 2026-09-25 12:27 local. Other-owner session. Decision workspace did not open. CounselorId unchanged; version unchanged. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.C Wave 2 — Insurance

**Basis:** PD-S13-K; journey rail `insurance` ↔ coverage tab; Coverage/Insurance sealed with session read-only.  
**Clarification:** No standalone Counsellor Insurance formal acceptance pack under `docs/audits/`. CCMS module UAT checklist is **not** Wave 2 Insurance stage acceptance. Scenarios validate **stage reachability + ownership seal**; deep CCMS claim lifecycle = out of this residual surface unless Product clarifies.

### W2-I-01 — Insurance/coverage stage reachable when coverage workflow applies

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-I-01 |
| **Area** | C — Wave 2 Insurance |
| **Objective** | Insurance/coverage stage opens when journey shows coverage workflow |
| **Preconditions** | Owned session with coverage workflow enabled per existing session type rules |
| **Test steps** | 1. Select **Insurance** on journey rail / coverage tab. 2. Confirm coverage/insurance panel loads. |
| **Expected result** | Stage loads; uses existing Counseling/coverage paths; no invented CCMS ownership |
| **Evidence required** | Tester/env/date + actual |
| **Result** | PASS — 2026-09-25 12:27 local. Owned Insurance InProgress session. Insurance stage current; policy step and Visit Policies visible. No coverage-load failure toast. CounselorId unchanged. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### W2-I-02 — Insurance respects session read-only for non-owner

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-I-02 |
| **Area** | C — Wave 2 Insurance |
| **Objective** | Non-owner cannot mutate insurance/coverage via session seal |
| **Preconditions** | Other-owner session with coverage UI |
| **Test steps** | Attempt coverage mutation as non-owner |
| **Expected result** | Read-only / denied; no ownership change |
| **Evidence required** | UI/network |
| **Result** | PASS — 2026-09-25 12:27 local. Other-owner Insurance session `bb000001-…0010`. Insurance stage stayed pending and not navigable. Coverage form and Save Draft were unavailable. CounselorId stayed the other counsellor. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### W2-I-03 — GOVERNANCE CLARIFICATION (deep Insurance business rules)

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-I-03 |
| **Area** | C — Wave 2 Insurance |
| **Objective** | Establish whether Product requires formal UAT of CCMS/preauth claim lifecycle inside Wave 2 |
| **Preconditions** | Product Owner input |
| **Test steps** | N/A until clarification |
| **Expected result** | **GOVERNANCE CLARIFICATION REQUIRED** — no invented CCMS acceptance criteria in this plan |
| **Evidence required** | Product Owner written scope for Insurance depth |
| **Result** | BLOCKED (governance) until clarified — or mark N/A if Product accepts shell-only Insurance UAT via W2-I-01/02 |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.D Wave 2 — Notes

**Basis:** PD-S13-K; wrap-up phase; ReQueue stripped from Notes (also covered in F).

### W2-N-01 — Notes stage editable for owner

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-N-01 |
| **Area** | D — Wave 2 Notes |
| **Objective** | Owner can edit Counsellor Notes on Notes/wrap-up stage |
| **Preconditions** | Owned non-terminal session |
| **Test steps** | 1. Open **Notes**. 2. Edit Counsellor Notes. 3. Save / Save Draft per existing UI. |
| **Expected result** | Notes save via existing session Update; Version/409 preserved |
| **Evidence required** | Actual save success |
| **Result** | PASS — 2026-09-25 12:27 local. Notes field editable. Save Draft toast “Draft saved”. Version 5 → 6. Queue stayed InProgress. CounselorId unchanged. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### W2-N-02 — Notes UI has no ReQueue card / raw marker text

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-N-02 |
| **Area** | D — Wave 2 Notes |
| **Objective** | Notes no longer owns ReQueue presentation |
| **Preconditions** | Session with prior ReQueue markers if available (see F) |
| **Test steps** | Inspect Notes workspace for ReQueue card or `[Re-queue …]` in editable textarea |
| **Expected result** | No ReQueue card; no raw marker text in editable notes (per ReQueue→History UX report) |
| **Evidence required** | Screenshot or written observation |
| **Result** | PASS — 2026-09-25 12:27 local. No ReQueue card. Editable Notes did not contain a raw `[Re-queue` marker. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.E Wave 2 — Finish

**Basis:** PD-S13-K; journey `close` / Finish summary; `POST …/sessions/{id}/complete` owner + Version.

### W2-F-01 — Finish summary reachable for owner

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-F-01 |
| **Area** | E — Wave 2 Finish |
| **Objective** | Finish stage / finish summary opens via journey |
| **Preconditions** | Owned session eligible for Finish per existing journey completion rules |
| **Test steps** | Navigate to **Finish** / activate finish summary |
| **Expected result** | Finish summary presents; no false grey-gate that blocks certified navigation (per completed-finish UX contract intent) |
| **Evidence required** | Observation of Finish UI |
| **Result** | BLOCKED — 2026-09-25 12:27 local. Finish stayed pending and not navigable; summary did not open. The owned seed session was not finish-eligible (UI showed 1 of 4 required). Not recorded as a defect. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### W2-F-02 — Complete requires owner + Version

| Field | Content |
|-------|---------|
| **Scenario ID** | W2-F-02 |
| **Area** | E — Wave 2 Finish |
| **Objective** | Complete Session succeeds for owner with concurrency Version |
| **Preconditions** | Owned session ready to complete under existing validation |
| **Test steps** | 1. Complete as owner. 2. Optionally retry with stale Version to observe 409 if safely reproducible. |
| **Expected result** | Owner complete succeeds; non-owner complete denied; 409 on stale Version if tested |
| **Evidence required** | Success toast/network; optional 409 evidence |
| **Result** | BLOCKED — 2026-09-25 12:27 local. Complete Session did not complete the seed session. UI showed “1 of 4 required”. Queue stayed InProgress; version stayed 6; CounselorId unchanged. Stale-version 409 was not attempted. Non-seed sessions were not completed. |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.F ReQueue → History

**Basis:** PD-S13-L Option A; `counsellor-session-requeue-notes-to-history-ux-report.md` Manual UAT steps; Slice 8 ReQueue → `CounselorId` NULL.

### RQ-H-01 — Notes clean; History shows Re-queued

| Field | Content |
|-------|---------|
| **Scenario ID** | RQ-H-01 |
| **Area** | F — ReQueue → History |
| **Objective** | ReQueue event appears in History, not Notes |
| **Preconditions** | Prefer documented UAT session if still valid, or owned session that can be ReQueued via certified Follow-up/session ReQueue path |
| **Test steps** | Per UX report §7: Open session → Notes clean → Open History → see **Re-queued** with Reason; Actor/Requeued by per Auth trail or `—` for marker fallback |
| **Expected result** | History label **Re-queued**; Reason read-only; no raw change type / Source: Requeue; Notes without ReQueue card |
| **Evidence required** | Notes + History observations |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### RQ-H-02 — ReQueue clears CounselorId (when ownership changed)

| Field | Content |
|-------|---------|
| **Scenario ID** | RQ-H-02 |
| **Area** | F — ReQueue → History |
| **Objective** | Certified ReQueue → `CounselorId` NULL when ownership actually cleared |
| **Preconditions** | Owned session eligible for ReQueue |
| **Test steps** | 1. Note CounselorId. 2. ReQueue with reason via certified path. 3. Verify CounselorId NULL. 4. Confirm return to shared Waiting List visibility within branch scope. |
| **Expected result** | `CounselorId` NULL; History `OwnershipRequeued` when ownership changed; shared queue behavior preserved |
| **Evidence required** | Ownership field / History / Waiting List row |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### RQ-H-03 — Save Notes preserves markers; concurrency untouched

| Field | Content |
|-------|---------|
| **Scenario ID** | RQ-H-03 |
| **Area** | F — ReQueue → History |
| **Objective** | Edit Notes after ReQueue; markers remain persisted; Save Draft/Complete still works |
| **Preconditions** | Session with ReQueue markers |
| **Test steps** | Edit + Save Counsellor Notes; confirm markers still in persisted additional notes; Save Draft → Complete still succeeds where applicable |
| **Expected result** | Working notes editable; markers preserved in storage; no Version/ownership regression |
| **Evidence required** | Save success; optional DB/network |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.G PD-A — OT master configuration

**Basis:** UAT decision gate (PD-A); PD-A OT configuration gap report; PDA-B-C Manual UAT checklist UAT-A1…A6.  
**Nature:** Primarily **ops/configuration** verification, not application redesign.

### PD-A-01 — Surgery-capable branch OT master present (UAT-A1/A2)

| Field | Content |
|-------|---------|
| **Scenario ID** | PD-A-01 |
| **Area** | G — PD-A |
| **Objective** | Surgery-capable branches used in UAT have ≥1 active non-deleted OT |
| **Preconditions** | Ops may need to configure OTs via `POST /api/OTBooking/theaters` (`ot.theaters.create`) **before** UAT — configuration is ops work, not this UAT plan’s implementation |
| **Test steps** | Verify Banjara Hills (and other surgery-capable branches in scope) have active OTs; Downtown remains configured |
| **Expected result** | Per checklist: Banjara ≥1 after ops; Downtown continues; branches not expected to schedule surgery may remain empty |
| **Evidence required** | OT count by branch (read-only query or Schedule Surgery list) |
| **Result** | NOT RUN — may be **BLOCKED** if ops config incomplete |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### PD-A-02 — Emma / Banjara Schedule Surgery OT list (UAT-A3)

| Field | Content |
|-------|---------|
| **Scenario ID** | PD-A-02 |
| **Area** | G — PD-A |
| **Objective** | Banjara-authorized counsellor sees non-empty OT list when OTs configured |
| **Preconditions** | PD-A-01 PASS for Banjara |
| **Test steps** | Login as Emma (or Banjara-authorized counsellor); open Schedule Surgery OT picker |
| **Expected result** | OT list non-empty |
| **Evidence required** | Observation |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### PD-A-03 — Empty / isolation honesty (UAT-A4/A5/A6)

| Field | Content |
|-------|---------|
| **Scenario ID** | PD-A-03 |
| **Area** | G — PD-A |
| **Objective** | Downtown OTs still visible; zero-OT branch honest empty; no cross-branch OT leak |
| **Preconditions** | Known configured and unconfigured branches |
| **Test steps** | Compare Downtown vs zero-OT branch vs cross-branch actor |
| **Expected result** | Downtown OK; empty state honest; branch isolation preserved |
| **Evidence required** | Observation per actor |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.H PD-B — Admin Assign unassigned Repeat

**Basis:** PDA-B-C approved condition: `Completed` + `PatientAgreedToSurgery != true` + `CounselorId == NULL`; UAT-B1…B6.

### PD-B-01 — Assign Counsellor CTA (not Start-as-Admin)

| Field | Content |
|-------|---------|
| **Scenario ID** | PD-B-01 |
| **Area** | H — PD-B |
| **Objective** | Unassigned Repeat shows Assign Counsellor for Admin |
| **Preconditions** | Unassigned RepeatCounselling session |
| **Test steps** | As Admin/Super Admin, locate item; confirm **Assign Counsellor**, not Start-as-Admin ownership |
| **Expected result** | Assign path available; Claim remains counsellor-only |
| **Evidence required** | UI CTA observation |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### PD-B-02 — Assign eligible counsellor; History/Version

| Field | Content |
|-------|---------|
| **Scenario ID** | PD-B-02 |
| **Area** | H — PD-B |
| **Objective** | Assign sets CounselorId; History/Audit; Version/409 preserved |
| **Preconditions** | PD-B-01 path available |
| **Test steps** | UAT-B2…B6: eligible branch counsellors only; Assign; assigned counsellor Starts Repeat; Admin cannot Claim-for-lifecycle; stale Version → 409 |
| **Expected result** | Explicit ownership only; Claim counsellor-only; 409 on stale Version |
| **Evidence required** | Ownership + History + optional 409 |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.I PD-C — Create reuse / second-eye

**Basis:** PDA-B-C matrix (ReEvaluate / Repeat / SurgeryDone → new episode); mandatory UAT sections in PDA report.

### PD-C-01 — ReEvaluate (no new session)

| Field | Content |
|-------|---------|
| **Scenario ID** | PD-C-01 |
| **Area** | I — PD-C |
| **Objective** | Done + agreed + !SurgeryDone → ReEvaluate existing session |
| **Preconditions** | Patient: Counselling Done + `PatientAgreedToSurgery = true` + SurgeryDone = false |
| **Test steps** | Attempt new counselling entry; verify no new CounselingSession; existing SessionId reused for ReEvaluate |
| **Expected result** | Session count unchanged; ReEvaluate path (not Repeat) |
| **Evidence required** | DB session count / SessionId |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### PD-C-02 — Repeat (no new session; not ReEvaluate)

| Field | Content |
|-------|---------|
| **Scenario ID** | PD-C-02 |
| **Area** | I — PD-C |
| **Objective** | Completed + not agreed + !SurgeryDone → existing Repeat lifecycle |
| **Preconditions** | Matching patient/session |
| **Test steps** | Attempt new-counselling entry; verify no Session B; SessionId preserved; not ReEvaluate; Admin does not silently own |
| **Expected result** | Existing episode / Repeat; no silent Admin ownership |
| **Evidence required** | SessionId + ownership |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### PD-C-03 — Subsequent / second-eye after SurgeryDone

| Field | Content |
|-------|---------|
| **Scenario ID** | PD-C-03 |
| **Area** | I — PD-C |
| **Objective** | SurgeryDone Session A → new Session B; no ownership inheritance |
| **Preconditions** | Session A SurgeryDone via OtFinalizeSchedules |
| **Test steps** | Initiate subsequent episode; verify Session B created; A remains historical/SurgeryDone; B Create ownership rules (Admin NULL / counsellor self — no inherit) |
| **Expected result** | A ≠ B; A unchanged; B no ownership inheritance |
| **Evidence required** | Two session IDs + ownership fields |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### PD-C-04 — GOVERNANCE CLARIFICATION (optional sub-decisions)

| Field | Content |
|-------|---------|
| **Scenario ID** | PD-C-04 |
| **Area** | I — PD-C |
| **Objective** | Confirm SessionType specialization / Add Patient prior-surgery UX / concurrent episode guard are **out of PD-C UAT** |
| **Preconditions** | Product Owner confirmation |
| **Test steps** | N/A — deferred items from UAT decision gate §11 |
| **Expected result** | **GOVERNANCE CLARIFICATION REQUIRED** only if Product insists these are in-scope for residual acceptance; default = **out of scope / deferred** |
| **Evidence required** | Product Owner note |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.J Finalize — NULL branch data fix

**Basis:** `finalize-surgery-pd-fs-null-branch-option-a-data-fix-report.md` Manual UAT checklist §8.  
**Preserved:** Fail-closed list (`BranchId != null` + accessibleBranches); no CounselorId ownership on Finalize; unhealable NULL row excluded.

### FS-NB-01 — Downtown list discoverable with Date cleared

| Field | Content |
|-------|---------|
| **Scenario ID** | FS-NB-01 |
| **Area** | J — Finalize NULL branch |
| **Objective** | Downtown-authorized user sees Finalize Surgery rows when Date cleared |
| **Preconditions** | Downtown-authorized counsellor/admin; AuthService live |
| **Test steps** | Open `/dashboard/counsellors-desk/finalize-surgery`; clear Date; expect non-zero Scheduled/queue rows |
| **Expected result** | Rows visible (post-backfill); date filter still works when set |
| **Evidence required** | Row count observation |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### FS-NB-02 — Branch isolation + unhealable NULL excluded + no ownership

| Field | Content |
|-------|---------|
| **Scenario ID** | FS-NB-02 |
| **Area** | J — Finalize NULL branch |
| **Objective** | Banjara-only empty for Downtown data; NULL unhealable excluded; no CounselorId ownership |
| **Preconditions** | Banjara-only user available |
| **Test steps** | Checklist items 7–10 from null-branch report |
| **Expected result** | Isolation preserved; unlinked NULL row absent; Waiting List Done unchanged; Finalize not ownership SoT |
| **Evidence required** | Cross-actor observation |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.K Finalize — row-open 403 fix

**Basis:** `counsellor-finalize-surgery-row-open-access-denied-fix-report.md` UAT checklist §7.  
**Expected:** Modal opens without Access Denied; `GET /Counseling/anesthetists` with `counseling_sessions.read` (not `user.view`).

### FS-403-01 — Counsellor opens Finalize OT modal

| Field | Content |
|-------|---------|
| **Scenario ID** | FS-403-01 |
| **Area** | K — Finalize 403 |
| **Objective** | Counsellor with `counseling_sessions.read` opens row without Access Denied |
| **Preconditions** | Downtown counsellor (e.g. documented `counsellor4@hospital.com`); FE + **restarted** AuthService with `/Counseling/anesthetists` live |
| **Test steps** | Open Finalize Surgery → click row → modal opens; anaesthetist dropdown loads or soft-empty (not hard redirect to unauthorized) |
| **Expected result** | No Access Denied hard redirect; anesthetists path under Counseling |
| **Evidence required** | Network: `/Counseling/anesthetists` (not `/users/anesthetists`); UI observation |
| **Result** | NOT RUN — **BLOCKED** if AuthService not restarted (env D6) |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### FS-403-02 — Branch / unauthorized regression

| Field | Content |
|-------|---------|
| **Scenario ID** | FS-403-02 |
| **Area** | K — Finalize 403 |
| **Objective** | Cross-branch detail still denied; users without read cannot open Finalize |
| **Preconditions** | Cross-branch and unauthorized actors |
| **Test steps** | Checklist B + G from fix report |
| **Expected result** | Branch 403 preserved; unauthorized denied; ownership unchanged |
| **Evidence required** | Network 403 / route deny |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.L Phase 2Y — Follow-up operational honesty

**Basis:** `counsellor-followup-analytics-phase2y-operational-honesty.md` (PD5 Option C; PD6 Option A; Post-Surgery aging label).

### P2Y-01 — No High Priority KPI / no AlertLevel priority pills

| Field | Content |
|-------|---------|
| **Scenario ID** | P2Y-01 |
| **Area** | L — Phase 2Y |
| **Objective** | Follow-up Center does not present formal priority model |
| **Preconditions** | User with Follow-up Center access |
| **Test steps** | Open `/dashboard/counsellors-desk/surgery-followup`; inspect Active KPIs and row chrome |
| **Expected result** | No **High Priority** KPI; no Critical/High/Medium/Normal priority pills as priority model |
| **Evidence required** | Observation |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### P2Y-02 — No DueDate / overdue wiring in Center

| Field | Content |
|-------|---------|
| **Scenario ID** | P2Y-02 |
| **Area** | L — Phase 2Y |
| **Objective** | No generic DueDate / invented SLA due heuristics in Center |
| **Preconditions** | Follow-up Center open |
| **Test steps** | Confirm Center UI does not show DueDate field or overdue-from-DueDate workflow |
| **Expected result** | No DueDate presentation; overdue endpoint not used as Center membership |
| **Evidence required** | Observation |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### P2Y-03 — Post-Surgery aging factual label

| Field | Content |
|-------|---------|
| **Scenario ID** | P2Y-03 |
| **Area** | L — Phase 2Y |
| **Objective** | Post-Surgery aging uses factual discharge aging |
| **Preconditions** | Post-Surgery tab with aged discharges if available |
| **Test steps** | Confirm KPI **Discharged ≥30 days**; row **{n}d since discharge**; not due/SLA/priority |
| **Expected result** | Factual aging only |
| **Evidence required** | Observation |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.M Phase 2Z — Analytics honesty (retest after remediation)

**Basis:** Phase 2Z implementation (PD13–15) + remediation F-01…F-05.  
**Note:** Historical Phase 2Z UAT matrix recorded FAIL before remediation. This plan is a **retest**. Prior FAIL is not current PASS.

### P2Z-01 — KPI strip honesty (F-05 / PD13)

| Field | Content |
|-------|---------|
| **Scenario ID** | P2Z-01 |
| **Area** | M — Phase 2Z |
| **Objective** | Summary shows Total, Agreed, Declined, Pending, Exception, Other, Eligible, Conversion, Decision |
| **Preconditions** | `/dashboard/counselor/analytics`; AuthService up |
| **Test steps** | Load Analytics Summary; verify KPI strip fields and Conversion/Decision vs Eligible |
| **Expected result** | Honest partition KPIs; Exception/Other not treated as eligible outcome rates in funnel |
| **Evidence required** | KPI values observation |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### P2Z-02 — Counsellor picker (F-01)

| Field | Content |
|-------|---------|
| **Scenario ID** | P2Z-02 |
| **Area** | M — Phase 2Z |
| **Objective** | Counsellor options load via Counseling counselors API without `user.view` |
| **Preconditions** | Counsellor/admin with `counseling_sessions.read` |
| **Test steps** | Open counsellor filter; verify options load (or explicit error — not silent empty) |
| **Expected result** | Usable counsellor list; filter propagates to Summary/Trends/Aging/CSV |
| **Evidence required** | Network path + UI |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### P2Z-03 — Agreed / Conversion drill (F-02) + PendingDecision never → Active Center (PD15)

| Field | Content |
|-------|---------|
| **Scenario ID** | P2Z-03 |
| **Area** | M — Phase 2Z |
| **Objective** | Agreed/Conversion drill uses agreed=true + pendingDecision=false; PendingDecision does not navigate to Active Follow-up |
| **Preconditions** | Analytics loaded with data |
| **Test steps** | Click Agreed/Conversion; inspect Sessions URL filters; click Pending/Aging; confirm destination is Sessions (not Active Center) |
| **Expected result** | PD13 Agreed partition filters; PendingDecision ≠ Active Center |
| **Evidence required** | URL/query params |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### P2Z-04 — PendingDecision Aging (PD14)

| Field | Content |
|-------|---------|
| **Scenario ID** | P2Z-04 |
| **Area** | M — Phase 2Z |
| **Objective** | Aging titled PendingDecision Aging; periods 30/90/180/365 default 365; no Critical/High/Medium/Normal labels |
| **Preconditions** | Analytics Aging section |
| **Test steps** | Verify title, periods, buckets 0–3 / 4–7 / 8–14 / 15+; independent of Summary 7/14/30 |
| **Expected result** | Per PD14 |
| **Evidence required** | Observation |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

### P2Z-05 — Branch authorization on Analytics + sessions drill (F-04)

| Field | Content |
|-------|---------|
| **Scenario ID** | P2Z-05 |
| **Area** | M — Phase 2Z |
| **Objective** | Unauthorized branch → 403; omitted → authorized set; sessions drill does not bypass branch auth |
| **Preconditions** | Multi-branch actor + unauthorized branch id if safely testable |
| **Test steps** | Attempt unauthorized branchId on Analytics; omit branch; drill to Sessions and confirm authorized scope |
| **Expected result** | 403 / authorized-only; no tenant-wide leak |
| **Evidence required** | Network 403 / list scope |
| **Result** | NOT RUN |
| **Defect reference** | |
| **Acceptance state** | NOT ACCEPTED |

---

## 10.N Phase 2W — Formal SIGNED governance checklist

**Nature:** Governance / Product Decision dependency — **not** a coding defect.  
**Phase 2X:** Remains **BLOCKED**. No Phase 2X work is created by this plan.

| Decision / artifact | Required sign-off | Current status | Evidence | Owner | Date | Final status |
|---------------------|-------------------|----------------|----------|-------|------|--------------|
| Phase 2W Final Gate (`counsellor-followup-analytics-phase2w-final-gate.md`) | Formal SIGNED fields for PD2–PD16 | **0 formally SIGNED** | Final gate §1 | | | OPEN |
| PD2 Active Population | Option + Final rule + Owner + Effective + Exceptions + Notes + Sign-off | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD3 Cold Population | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD4 Post-Surgery Responsibility | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD5 Due Date | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD6 Priority / Escalation | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD7 Ownership | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD8 Reason Taxonomy | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD9 Lifecycle / Exit | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD10 Schedule Visit | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD11 Reminder | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD12 Callback | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD13 Analytics Partition | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD14 Analytics Aging | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD15 Analytics Drill-down | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| PD16 Branch Isolation | Same | WORKING — NOT SIGNED | Phase 2W PD pack | | | OPEN |
| Phase 2X authorization | Requires formal SIGNED + clinical/SoT gates | **BLOCKED** | Final gate + Phase 2X blockers | | | BLOCKED |

**Rules:**

- Formal SIGNED ≠ workshop WORKING confirmation.  
- Closing Phase 2W SIGNED does **not** authorize Phase 2X alone if clinical SoT blockers remain.  
- Phase 2Y / Phase 2Z functional UAT may proceed as residual B-item retests; they do **not** close Phase 2W SIGNED.

---

## 11. Defect Governance

### Classifications

| Code | Meaning |
|------|---------|
| **D1** | Functional defect |
| **D2** | Authorization / security defect |
| **D3** | Data / persistence defect |
| **D4** | UX / accessibility defect |
| **D5** | Governance / documentation defect |
| **D6** | Environment / test infrastructure blocker |

### Failure record template

| Field | Content |
|-------|---------|
| Scenario | |
| Observed behavior | |
| Expected behavior | |
| Severity | |
| Classification (D1–D6) | |
| Evidence | |
| Affected route / component / API | |
| Product Decision required? | YES / NO |
| Implementation authorized? | **NO** (until separate PD/authorization) |

A defect found during UAT must be routed through the appropriate governance gate **before** any coding.

---

## 12. Acceptance Matrix

| ID | Area | Implementation Evidence | Automated Evidence | Manual UAT | Acceptance | Dependency | Status |
|----|------|-------------------------|--------------------|------------|------------|------------|--------|
| A | Wave 2 Quote | Journey rail + Estimate phase | Playwright wave2 + units (suites exist; not re-run here) | NOT RUN | NOT ACCEPTED | PD-S13-K; owned session | NOT RUN |
| B | Wave 2 Decision | Decision phase | Playwright wave2d4 | NOT RUN | NOT ACCEPTED | PD-S13-K | NOT RUN |
| C | Wave 2 Insurance | Coverage tab path | wave2c + units | NOT RUN | NOT ACCEPTED | PD-S13-K; W2-I-03 clarification | NOT RUN |
| D | Wave 2 Notes | Wrap-up phase | Notes/requeue units | NOT RUN | NOT ACCEPTED | PD-S13-K | NOT RUN |
| E | Wave 2 Finish | Finish summary + complete API | Finish UX contracts | NOT RUN | NOT ACCEPTED | PD-S13-K | NOT RUN |
| F | ReQueue → History | UX report READY FOR MANUAL UAT | Documented 75 tests PASS (prior report) | NOT RUN | NOT ACCEPTED | PD-S13-L | NOT RUN |
| G | PD-A | OT config + theaters lookup | Theater contracts (prior) | NOT RUN | NOT ACCEPTED | Ops OT config may BLOCK | NOT RUN |
| H | PD-B | Assign Repeat eligibility | PDA Assign suites (prior) | NOT RUN | NOT ACCEPTED | Unassigned Repeat fixture | NOT RUN |
| I | PD-C | Create reuse matrix | Phase3IPdC tests (prior) | NOT RUN | NOT ACCEPTED | Fixtures for ReEvaluate/Repeat/SurgeryDone | NOT RUN |
| J | Finalize NULL branch | Data fix report | Slice 9 boundary (prior) | NOT RUN | NOT ACCEPTED | Downtown data present | NOT RUN |
| K | Finalize 403 | Anesthetists Counseling path | FE contract tests (prior) | NOT RUN | NOT ACCEPTED | AuthService restart | NOT RUN |
| L | Phase 2Y | Honesty doc | Follow-up page tests | NOT RUN | NOT ACCEPTED | Follow-up Center access | NOT RUN |
| M | Phase 2Z | Impl + remediation F-01…F-05 | Analytics unit tests | NOT RUN | NOT ACCEPTED | AuthService up; retest | NOT RUN |
| N | Phase 2W SIGNED | Final gate | N/A | GOVERNANCE OPEN | NOT CLOSED | Stakeholder sign-off | OPEN |

Do **not** claim automated PASS for this plan’s execution unless freshly recorded. Do **not** claim Manual UAT PASS until §16 is populated with PASS evidence.

---

## 13. UAT Execution Record

Populate during actual UAT:

| Scenario | Tester | Date | Environment | Result | Evidence | Defect | Retest | Acceptance |
|----------|--------|------|-------------|--------|----------|--------|--------|------------|
| W2-Q-01 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | PASS | Owned InProgress Quote opened; CounselorId unchanged | | | NOT ACCEPTED |
| W2-Q-02 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | PASS | Other-owner Quote viewable; save controls absent; CounselorId unchanged | | | NOT ACCEPTED |
| W2-Q-03 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | PASS | Unassigned open left CounselorId null; Assign not used | | | NOT ACCEPTED |
| W2-D-01 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | PASS | Decision workspace loaded; CounselorId unchanged | | | NOT ACCEPTED |
| W2-D-02 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | PASS | Other-owner Decision workspace did not open; CounselorId unchanged | | | NOT ACCEPTED |
| W2-I-01 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | PASS | Insurance/policy stage loaded; CounselorId unchanged | | | NOT ACCEPTED |
| W2-I-02 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | PASS | Other-owner Insurance not navigable; no coverage save control; CounselorId unchanged | | | NOT ACCEPTED |
| W2-I-03 | | | | NOT RUN | | | | NOT ACCEPTED |
| W2-N-01 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | PASS | Notes edited; Draft saved; version 5→6; CounselorId unchanged | | | NOT ACCEPTED |
| W2-N-02 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | PASS | No ReQueue card; no raw Re-queue marker in Notes | | | NOT ACCEPTED |
| W2-F-01 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | BLOCKED | Finish not navigable; session not finish-eligible (1 of 4 required) | | | NOT ACCEPTED |
| W2-F-02 | Stage 1 execution as counsellor4 | 2026-09-25 12:27 | Local portal :3000, Auth :5073 | BLOCKED | Complete did not succeed; session stayed InProgress; stale 409 not attempted | | | NOT ACCEPTED |
| RQ-H-01 | | | | NOT RUN | | | | NOT ACCEPTED |
| RQ-H-02 | | | | NOT RUN | | | | NOT ACCEPTED |
| RQ-H-03 | | | | NOT RUN | | | | NOT ACCEPTED |
| PD-A-01 | | | | NOT RUN | | | | NOT ACCEPTED |
| PD-A-02 | | | | NOT RUN | | | | NOT ACCEPTED |
| PD-A-03 | | | | NOT RUN | | | | NOT ACCEPTED |
| PD-B-01 | | | | NOT RUN | | | | NOT ACCEPTED |
| PD-B-02 | | | | NOT RUN | | | | NOT ACCEPTED |
| PD-C-01 | | | | NOT RUN | | | | NOT ACCEPTED |
| PD-C-02 | | | | NOT RUN | | | | NOT ACCEPTED |
| PD-C-03 | | | | NOT RUN | | | | NOT ACCEPTED |
| PD-C-04 | | | | NOT RUN | | | | NOT ACCEPTED |
| FS-NB-01 | | | | NOT RUN | | | | NOT ACCEPTED |
| FS-NB-02 | | | | NOT RUN | | | | NOT ACCEPTED |
| FS-403-01 | | | | NOT RUN | | | | NOT ACCEPTED |
| FS-403-02 | | | | NOT RUN | | | | NOT ACCEPTED |
| P2Y-01 | | | | NOT RUN | | | | NOT ACCEPTED |
| P2Y-02 | | | | NOT RUN | | | | NOT ACCEPTED |
| P2Y-03 | | | | NOT RUN | | | | NOT ACCEPTED |
| P2Z-01 | | | | NOT RUN | | | | NOT ACCEPTED |
| P2Z-02 | | | | NOT RUN | | | | NOT ACCEPTED |
| P2Z-03 | | | | NOT RUN | | | | NOT ACCEPTED |
| P2Z-04 | | | | NOT RUN | | | | NOT ACCEPTED |
| P2Z-05 | | | | NOT RUN | | | | NOT ACCEPTED |

---

## 14. Final Acceptance Gate

An area can be marked **ACCEPTED** only when:

1. Authoritative acceptance criteria exist (or Product explicitly accepts shell-only scope in writing for Wave 2 Insurance depth);  
2. UAT was executed;  
3. Result is **PASS** for required scenarios of that area;  
4. Evidence is recorded;  
5. No unresolved blocking defect exists for that area;  
6. Required Product Owner / business acceptance is recorded.

If any condition is missing: **NOT ACCEPTED**.

---

## 15. UAT Summary (pre-execution baseline)

| Metric | Value |
|--------|------:|
| Total acceptance areas (A–N) | **14** |
| UAT-ready functional areas (A–M) | **13** (subject to env/ops fixtures) |
| UAT blocked areas (known) | **0 hard** at plan time; **conditional**: PD-A (ops OT), FS-403 (Auth restart), W2-I-03 (governance depth) |
| UAT not-run areas | **14** (all) |
| Passed | **0** |
| Failed | **0** |
| Accepted | **0** |
| Outstanding governance decisions | Phase 2W formal SIGNED (0); Portfolio Decision 1–5 pending; W2-I-03 Insurance depth; PD-C-04 optional sub-scope |

---

## 16. Governance Decision Required

| Item | Decision needed |
|------|-----------------|
| Portfolio Decision 1 | Confirm proceed with Manual UAT scheduling (recommended before execution) |
| W2-I-03 | Shell-only Insurance UAT vs deep CCMS lifecycle in residual acceptance |
| PD-C-04 | Confirm optional PD-C sub-items remain deferred |
| PD-A ops | Confirm surgery-capable branches OT configuration responsibility before PD-A UAT |
| Phase 2W | Formal SIGNED capture for PD2–PD16 (governance; not coding) |
| Phase 2X | Remain BLOCKED — no implementation |
| Any FAIL during UAT | Defect governance before any coding authorization |

---

## 17. Implementation Authorization

```text
NO NEW IMPLEMENTATION IS AUTHORIZED BY THIS DOCUMENT.

CURRENT AUTHORIZED IMPLEMENTATION = NONE

PHASE 3I = CLOSED
SLICE 13 = CLOSED
C-01 = ACCEPTED + CLOSED
SLICE 14 = DOES NOT EXIST
PHASE 3J = NOT CREATED
PHASE 2X = BLOCKED
```

---

## 18. Next Gate

After execution:

```text
UAT RESULTS
  → ACCEPTANCE / DEFECT GOVERNANCE
    → PRODUCT PORTFOLIO DECISION
```

Do **not** create another implementation phase automatically.

---

## Control Flags

| Flag | Value |
|------|--------|
| PRODUCTION IMPLEMENTATION PERFORMED | **NO** |
| PHASE 3I REOPENED | **NO** |
| SLICE 14 CREATED | **NO** |
| PHASE 3J CREATED | **NO** |
| C-01 REOPENED | **NO** |
| PHASE 2X STARTED | **NO** |
| UAT EXECUTED BY THIS TASK | **NO** (plan only) |
| ANY AREA MARKED PASS/ACCEPTED BY THIS TASK | **NO** |

---

**END — COUNSELLOR RESIDUAL ACCEPTANCE MANUAL UAT PLAN — READY FOR EXECUTION — STOP**
