# Counsellor Wave 2 — Final Manual UAT Reconciliation

Governance reconciliation only. No production code, API, schema, permission, or Product Decision change was made.

Evidence basis: repository audits and tests, plus the Product Owner statement in this session that the two remaining Wave 2 defects are **PASS — MANUAL UAT VERIFIED**. Older documents that still say those two items need UAT are historical for those defects.

## 1. Scope

Counsellor session journey under PD-S13-K Option B: formal UAT of the existing Quote → Finish shell. Not a redesign. Not C-01, Phase 3I, Finalize Surgery, or OT Preparation.

Authoritative UAT checklist: `docs/audits/counsellor-residual-acceptance-manual-uat-plan.md` §10.A–E and §13.

That execution table is still blank. Informal “most scenarios passed” in the defect request was not written against scenario IDs, so those rows stay **NOT RECORDED**. They are not marked PASS here.

## 2. Journey

Waiting List (closed) → Session → Quote → Decision → Insurance → Notes → Finish.

The session shell, phase rail, coverage panel, notes wrap-up, and Finish summary are implemented. Completion still uses the existing owner + Version complete path.

## 3. UAT Matrix

| Area | Implementation | Automated | Manual UAT | Acceptance | Status |
|------|----------------|-----------|------------|------------|--------|
| Waiting List / C-01 | Closed | Prior suites | PASS 15/15 | ACCEPTED + CLOSED | I |
| Quote (procedure, eye, IOL, investigations, amount, draft, progression) | Estimate phase | Playwright `wave2d3`, `wave2e4`, `wave2e4r`; estimate-engine units. Suites exist; this reconciliation did not re-run them | W2-Q-01/02/03 **NOT RECORDED** | No pack | D |
| Decision (payment, decision, insurer, schedule) | Decision phase | Playwright `wave2d4`; `counselling-progress` units | Stage reachability W2-D-01/02 **NOT RECORDED**. Schedule optionality **PASS** | No pack | D for stage scenarios; schedule defect I for that behavior |
| Schedule Surgery OT / start time | Optional in `validateScheduleSurgerySubmission`. Date and Doctor still required. OT upsert only when both theatre and start time are present | Unit tests in the defect report (94 passing at implementation). Not a substitute for Manual UAT | **PASS — MANUAL UAT VERIFIED** | Not a separate acceptance pack | Closed as a defect |
| Insurance shell | Coverage tab / `CoveragePreauthPanel` | Playwright `wave2c`, `wave2d2`, `wave2e2` | W2-I-01/02 **NOT RECORDED** | No pack | D |
| Visit Policy immediate refresh + PRIMARY | Draft PATCH upserts the policy; list cache is updated from the post-save GET | `visit-policy-list-cache` units | **PASS — MANUAL UAT VERIFIED** | Not a separate acceptance pack | Closed as a defect |
| Documents | Coverage documents tab | With Insurance Playwright | Not a recorded scenario result | No Counsellor-stage acceptance | D |
| Notes | Wrap-up phase | Playwright `wave2d5`, `wave2e5` | W2-N-01/02 **NOT RECORDED** | No pack | D |
| Finish / Save Session / queue transition | Finish summary + existing complete API | Finish unit contracts; Playwright reaches the Finish stage. This reconciliation did not execute Complete Session | W2-F-01/02 **NOT RECORDED** | No pack | D |
| Insurance depth (claims lifecycle) | CCMS exists outside the counsellor shell | Not Wave 2 acceptance | W2-I-03 **UNRESOLVED** | Not accepted | E (does not block shell scenarios) |

Automated column means tests exist in the repo. It does not mean this reconciliation ran Playwright, and it does not mean Manual UAT passed.

## 4. Recently Fixed UAT Defects

### Schedule Surgery

Status: **PASS — MANUAL UAT VERIFIED**

Current validation matches the certified correction:

| Field | Rule |
|-------|------|
| Date | Required |
| Doctor | Required |
| Operation Theatre | Optional |
| Surgery Start Time | Optional |
| Avoid Time From | Optional |
| Avoid Time To | Optional |

`docs/audits/counsellor-wave2-decision-schedule-and-visit-policy-uat-defects-report.md` still ends with “MANUAL UAT REQUIRED”. That line is **RESOLVED / HISTORICAL** for this defect.

### Visit Policy

Status: **PASS — MANUAL UAT VERIFIED**

After a valid Save Draft, Visit Policies shows the persisted policy without leaving the session. One policy uses the existing backend primary flag (displayed as PRIMARY). Same historical report line is **RESOLVED / HISTORICAL** for this defect.

Not reopened, and not given a new PASS line in their own reports:

- Coverage runtime-loop fix (`counsellor-wave2-insurance-coverage-runtime-loop-defect-report.md`) — **RESOLVED / HISTORICAL** as an open implementation item. Its “MANUAL UAT REQUIRED” footer was not updated because this session did not record a separate scenario ID.
- False “another user” save conflict (`counsellor-wave2-false-another-user-save-conflict-fix-report.md`) — same. Successful Insurance Save Draft in this UAT did not report that failure again. Formal scenario result is still unwritten.

## 5. Remaining Gaps

No implementation defect was found in this reconciliation. No new blocker was reported by the Product Owner.

| Item | Class | Why |
|------|-------|-----|
| W2-Q-01, W2-Q-02, W2-Q-03 | D | Still blank in residual plan §13 |
| W2-D-01, W2-D-02 | D | Schedule PASS does not fill stage or non-owner rows |
| W2-I-01, W2-I-02 | D | Visit Policy PASS does not fill stage or non-owner rows |
| W2-N-01, W2-N-02 | D | Notes not named in this PASS statement |
| W2-F-01, W2-F-02 | D | Finish / owner+Version complete not named in this PASS statement |
| Documents checklist as its own acceptance row | D | Covered only as part of Insurance; no recorded result |
| Wave 2 acceptance pack | D | End-to-end audit: dedicated pack **ABSENT** |
| W2-I-03 insurance depth | E | Portfolio Decision still **UNRESOLVED**. Shell UAT can proceed. Deep CCMS lifecycle is not a Wave 2 code gap |
| Playwright not executed in this reconciliation | B | Suites exist. Absence of a fresh run is not a product defect |

## 6. Deferred Items

Unchanged from the end-to-end audit and portfolio decision:

- PD-S13-C, PD-S13-E, PD-S13-F, PD-S13-M, PD-S13-PAG-04
- PD-C-04 optional sub-items
- Phase 2X (blocked until Phase 2W formal SIGNED and its own gates)
- Phase 2Y Follow-up honesty UAT (residual Area L)
- Phase 2Z Analytics honesty UAT (residual Area M)
- Clinical Recommendations optometrist placeholder
- C-LA-04, JWT session invalidation, HR leave auto-transfer
- OT Prep Package B print and Package C Manual UAT (adjacent; not Wave 2)

## 7. Out of Scope

- Reopen Phase 3I, Slice 14, or Phase 3J
- Redesign Waiting List, Wave 2, Finalize, or OT Preparation
- Change CounselorId, Assign, Reassign, ReQueue, permissions, or FSM
- New Counsellor Dashboard (PD-S13-I Option A: Waiting List stays the landing)
- Deep CCMS claim lifecycle inside Wave 2 unless W2-I-03 is later decided
- Turning My Work or Follow-up into a second operational queue

## 8. Closed / Protected Areas

Confirmed unchanged by this reconciliation:

- C-01 Waiting List: **ACCEPTED + CLOSED**
- Phase 3I ownership (Assign / Reassign / ReQueue / History / Sessions RR): **CLOSED**
- Finalize Surgery Package LA: **ACCEPTED / CLOSED**
- OT Preparation RESP2: **ACCEPTED / CLOSED**
- Package B delivery acceptance (Slice 13): **CLOSED** for that package; Package B print UAT remains an adjacent gap, not a Wave 2 gate
- Package C: implementation exists; Manual UAT not part of Wave 2
- Slice 14: **does not exist**
- Phase 3J: **not created**

## 9. Final Wave 2 Status

**WAVE 2 MANUAL UAT REMAINS**

The two known functional defects are PASS. The residual Stage 1 scenario log is not filled, and there is no Wave 2 acceptance pack. That is an evidence gap, not an implementation gap.

## 10. Single Next Gate

Record results for residual Stage 1 scenarios that are still blank in `docs/audits/counsellor-residual-acceptance-manual-uat-plan.md` §13:

W2-Q-01, W2-Q-02, W2-Q-03, W2-D-01, W2-D-02, W2-I-01, W2-I-02, W2-N-01, W2-N-02, W2-F-01, W2-F-02.

Do not retest Schedule Surgery optionality or Visit Policy refresh unless a new failure appears. Do not write the Wave 2 acceptance pack until those required rows are PASS. W2-I-03 stays a written scope choice and is not this gate.

## Separate from Wave 2 acceptance

| Surface | Status |
|---------|--------|
| Follow-up Center | Implemented. Shared model certified in Phase 3I. Phase 2Y honesty Manual UAT **NOT RUN** (Area L). Not part of Wave 2 acceptance. |
| Analytics | Implemented. Slice 11 My Work **ACCEPTED**. Phase 2Z honesty **NOT RUN** (Area M). Not part of Wave 2 acceptance. |
| Patient Details | Pattern present and treated as closed in the completion audit. Not a Wave 2 blocker. |
| Clinical Recommendations | **DEFERRED** under PD-S13-M (placeholder remains). Not part of Wave 2 acceptance. |
