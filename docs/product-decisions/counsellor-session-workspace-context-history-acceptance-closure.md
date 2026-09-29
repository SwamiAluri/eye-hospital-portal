# Counsellor Session Workspace — PD-RSH-02R Acceptance and Closure

| Field | Value |
|-------|--------|
| **ID** | **PD-RSH-02R** |
| **Title** | Counsellor Session Workspace — Patient Context & History Inline UX |
| **Status** | **PD-RSH-02R — ACCEPTED / CLOSED** |
| **Acceptance date** | **2026-09-27** |
| **Acceptance scope** | Counsellor Session Workspace — Patient Context & History Inline UX only |

**PD-RSH-02R ACCEPTED — IMPLEMENTATION AND MANUAL UAT COMPLETE — CLOSED**

This artifact records acceptance and closure. It does not change production code, tests, APIs, DTOs, the database, or `CounsellingActionBar.tsx`. It does not authorize further work.

---

## 1. Acceptance basis

Acceptance is based on the approved Product Decision, the bounded Implementation Authorization, the completed implementation, automated test completion, the successful corrective implementation, and the successful repeat Manual UAT.

| Governing artifact | Status used for acceptance |
|--------------------|----------------------------|
| Product Decision: `docs/product-decisions/counsellor-session-workspace-context-history-product-decision.md` | **APPROVED** — Product Owner **SELECTED / APPROVED — 2026-09-26** |
| Implementation Authorization: `docs/product-decisions/counsellor-session-workspace-context-history-implementation-authorization.md` | **CREATED / BOUNDED** |
| Implementation Report: `docs/product-decisions/counsellor-session-workspace-context-history-implementation-report.md` | Implementation complete. Corrective implementation complete **2026-09-27** |
| Manual UAT Report: `docs/product-decisions/counsellor-session-workspace-context-history-uat-report.md` | Initial UAT failed. Repeat UAT **PASS — READY FOR ACCEPTANCE** |

Historical records are left as written. This closure does not rewrite them.

---

## 2. Final accepted UX

Accepted navigation order:

**Patient Context | Quote | Decision | Insurance | Notes | Finish | History**

### Patient Context

- First contextual destination.
- Inline workspace.
- Clinical Recommendations.
- Patient Details.
- No popover.
- No dropdown.
- No Sheet.
- No modal.
- No header duplicate actions.

### History

- Last contextual destination.
- Inline workspace.
- Existing audit and history presentation.
- Columns: Event, Date & Time, Actor, Change / Details.
- Newest-first ordering.
- Existing desktop table and narrow stacked presentation.
- `SessionHistoryModal` remains available for its existing dialog behavior.
- Workspace navigation does not open that modal.

### Journey

Quote, Decision, Insurance, Notes, and Finish remain the five certified journey stages.

---

## 3. Journey semantics

`JOURNEY_STAGE_ORDER` remains:

- `quote`
- `decision`
- `insurance`
- `notes`
- `close`

### Patient Context

- Not a journey stage.
- Not in `JOURNEY_STAGE_ORDER`.
- No `JourneyStageId`.
- No `data-journey-status`.
- No `aria-current="step"`.

### History

- Not a journey stage.
- Not in `JOURNEY_STAGE_ORDER`.
- No `JourneyStageId`.
- No `data-journey-status`.
- No `aria-current="step"`.

Only the five certified journey stages may use `aria-current="step"`.

The underlying certified stage remains current while Patient Context or History is selected, and it retains `aria-current="step"`.

---

## 4. Automated test acceptance

Working directory: `apps/hospital-portal-web`.

```
pnpm exec vitest run src/components/counsellors-desk/session/session-page-header.test.tsx src/components/counsellors-desk/session/session-history-slice5.test.tsx src/lib/counsellors-desk/counselling-journey-rail.test.ts --reporter=verbose
```

Result recorded by the repeat UAT gate:

- **49 passed**
- **0 failed**
- **0 skipped**

The corrective journey-rail test covers the contextual-destination semantics: Patient Context and History do not receive `aria-current="step"` or `data-journey-status`, and the current certified stage retains `aria-current="step"` while either destination is selected. `JOURNEY_STAGE_ORDER` remains the five certified ids.

---

## 5. Manual UAT acceptance

### Initial UAT

**FAILED — ACCEPTANCE BLOCKED**

Reason: Patient Context and History incorrectly received `aria-current="step"`.

That failed evidence remains in `docs/product-decisions/counsellor-session-workspace-context-history-uat-report.md`.

### Corrective implementation

**COMPLETE** on 2026-09-27, limited to `CounsellingJourneyRail.tsx` and the journey-rail test.

### Repeat UAT

**PASS — READY FOR ACCEPTANCE**

Repeat UAT confirmed:

- Patient Context `aria-current="step"`: **ABSENT**
- History `aria-current="step"`: **ABSENT**
- Underlying certified stage `aria-current="step"`: **PRESENT**
- `JOURNEY_STAGE_ORDER`: **UNCHANGED**

The repeat UAT also confirmed inline Patient Context and History, the accepted navigation order, no history modal from workspace navigation, no popover, Sheet, dropdown, or modal for Patient Context, responsive behavior, and existing session behavior within the read-only session used for that gate.

---

## 6. Business behavior protection

Acceptance introduced no changes to:

- APIs
- DTOs
- database
- permissions
- ownership
- `CounselorId`
- ReQueue
- Start Counselling
- Create Session
- Waiting List
- session lifecycle
- FSM
- workflow state
- Quote
- Decision
- Insurance
- Notes
- Finish
- Follow-up
- Analytics
- Finalize Surgery
- OT Preparation
- routes

---

## 7. Out-of-scope action bar change

`CounsellingActionBar.tsx` contains an unrelated uncommitted working-tree change involving `revealWorkspaceOnly` and `onRevealWorkspace`.

This change:

- Was not part of the PD-RSH-02R authorization.
- Was not part of the corrective implementation.
- Was not exercised as a PD-RSH-02R requirement.
- Was not tested as part of PD-RSH-02R.
- Is **NOT ACCEPTED**.
- Does **not** form part of this closure.

It is an outstanding separate governance item. This closure does not modify it, remove it, accept it, or create a Product Decision for it.

---

## 8. Out-of-scope working tree changes

The UAT report also identified other unrelated dirty files, including Waiting List, Add Patient, Schedule Surgery, and a schedule display change in `CounsellingWorkflowSections.tsx`.

Those files are not part of PD-RSH-02R acceptance. This closure does not modify them and does not claim they are accepted.

PD-RSH-02R acceptance applies only to the bounded session workspace implementation and its corrective change.

---

## 9. Previous implementation status

The earlier popover-and-modal implementation remains historical:

**IMPLEMENTED — NOT ACCEPTED**

PD-RSH-02R superseded that presentation direction. Historical authorization and report records are not rewritten by this closure.

The current inline implementation is the accepted PD-RSH-02R result.

---

## 10. Final acceptance statement

**PD-RSH-02R ACCEPTED — IMPLEMENTATION AND MANUAL UAT COMPLETE — CLOSED**

Acceptance scope: Counsellor Session Workspace — Patient Context & History Inline UX only.

Acceptance does not authorize any future enhancement or adjacent work.

PD-RSH-02R is formally closed. Next action under PD-RSH-02R: **NONE**.
