# Counsellor Session Workspace — PD-RSH-02R Manual UAT Report

| Field | Value |
|-------|--------|
| **UAT date** | 2026-09-27 |
| **Product Decision** | PD-RSH-02R **APPROVED** |
| **Implementation** | Complete in the working tree |
| **Production changes during this UAT** | **NONE** |
| **Test changes during this UAT** | **NONE** |
| **Acceptance** | **NOT RECORDED** |

---

## 1. Product Decision

`docs/product-decisions/counsellor-session-workspace-context-history-product-decision.md`

**PD-RSH-02R — APPROVED — PRODUCT DECISION RECORDED.** Product Owner: **SELECTED / APPROVED — 2026-09-26.**

## 2. Implementation Authorization

`docs/product-decisions/counsellor-session-workspace-context-history-implementation-authorization.md`

Status: **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED.**

## 3. Implementation Report

`docs/product-decisions/counsellor-session-workspace-context-history-implementation-report.md`

Status recorded there: **PD-RSH-02R IMPLEMENTATION COMPLETE — AUTOMATED TESTS COMPLETE — STOP FOR MANUAL UAT.** That report's Manual UAT and Acceptance fields were **NOT EXECUTED** and **NOT RECORDED** before this gate.

## 4. Environment

- Local Hospital Portal already running.
- Frontend: `http://localhost:3000`
- Auth API: `http://localhost:5073/api`
- Counselling API: `http://localhost:7071/api`
- Route pattern: `/dashboard/counsellors-desk/{session}`
- Desktop viewport: 1440×900
- Narrow viewport: 390×844
- This session has no browser MCP. The live app was driven with Playwright Chromium against the running frontend. No production or test file was edited. No session draft was saved.

Opening a session issued the existing session-controller lock request. Leaving the page issued the existing unlock. Those calls are the current open/leave behavior. This UAT did not submit Save Draft, ReQueue, Start Counselling, Create Session, or a workflow transition.

## 5. Test Session

Existing sessions only. No seed data was created for this UAT.

| Use | Session status | Session type | Identifier recorded |
|-----|----------------|--------------|---------------------|
| Primary workspace | In progress | Initial | id suffix `5daf51` |
| Finish stage | Completed | existing completed session | id suffix `520565` |

The in-progress session opened on Quote. Its header showed the existing Processing status and Initial Counseling session-type pill. The action bar presented **Session read-only**, with Print, and Back once the underlying stage was no longer the first stage. Save Draft was not offered on this login, which matches the existing read-only ownership presentation.

History on the primary session returned 9 events. Patient name, MRN, recommendation text, and history actor text are not recorded here.

Finish was **Not yet available** on the in-progress session, which is the existing pending rule. Finish was exercised on the existing completed session, where the Finish control was available and the stage status was `completed`.

## 6. UAT Results

| ID | Scenario | Result | Evidence / Notes |
|----|----------|--------|------------------|
| UAT-01 | Session opens | PASS | Existing in-progress session opened on `/dashboard/counsellors-desk/{session}`. Counselling workflow navigation was present. Header showed Processing and Initial Counseling. No page error. |
| UAT-02 | Navigation order | PASS | Order observed: Patient Context, Quote, Decision, Insurance, Notes, Finish, History. Five `data-journey-status` nodes only: `quote`, `decision`, `insurance`, `notes`, `close`. |
| UAT-03 | Patient Context inline | FAIL | Patient Context is first and opens inline under the navigation. No dialog, popover, dropdown, sheet, or backdrop. Clinical Recommendations and Patient Details render in the workspace. **When selected, the Patient Context button has `aria-current="step"`.** Approved PD-RSH-02R and the UAT gate forbid that. |
| UAT-04 | Clinical Recommendations | PASS | Inline card title Clinical Recommendations. Doctor and Optometrist surfaces were present. No header Clinical Recommendations action. No dialog. |
| UAT-05 | Patient Details | PASS | Inline card title Patient Details. Identity and Visit & Session sections were present. Details were loaded, not the missing-details message. No header Patient Details action. Photo is not a second opener. |
| UAT-06 | Quote | PASS | Selecting Quote cleared the contextual workspace and showed the existing quote workspace. Underlying quote status stayed `current`. No dialog. |
| UAT-07 | Decision | PASS | Selecting Decision showed the existing decision workspace. Action bar stayed the read-only bar for that stage, with Back. |
| UAT-08 | Insurance | PASS | Selecting Insurance showed the existing insurance workspace (`counselling-insurance-policy-widget` / coverage rail). Contextual content was not shown. |
| UAT-09 | Notes | PASS | Selecting Notes showed the existing notes workspace. Underlying stage status became `current` for notes. |
| UAT-10 | Finish | PASS | On the in-progress session, Finish stayed pending and was not a button. On the existing completed session, Go to Finish opened `counselling-finish-workspace` and the finish outcome widget, with `aria-current="step"` on the Finish stage only. No dialog. |
| UAT-11 | History inline | FAIL | History is last. It renders inline. `SessionHistoryModal` did not open. Dialog count stayed 0. No backdrop. **When selected, the History button (`View session history`) has `aria-current="step"`.** |
| UAT-12 | History table/data | PASS | Loading history text appeared, then cleared. Desktop columns: Event, Date & Time, Actor, Change / Details. 9 rows. Times ran newest-first (25 Sept 2026, then 22 Sept 2026). At 390px the desktop table was hidden and the stacked presentation was shown. Empty state was not on this session because rows were present. |
| UAT-13 | Contextual navigation transitions | PASS | Patient Context → Quote, Quote → Patient Context, Patient Context → History, History → Quote, History → Decision, History → Notes, Notes → History, History → Finish (pending on the in-progress session; Finish workspace confirmed on the completed session), Finish → Patient Context. The in-page marker survived every transition. URL stayed on the same session. No modal. Certified stages restored their existing workspaces. Underlying stage ids did not gain Patient Context or History. |
| UAT-14 | Journey semantics | FAIL | `JOURNEY_STAGE_ORDER` in source remains `quote`, `decision`, `insurance`, `notes`, `close`. `JourneyStageId` is still those five ids. Patient Context and History have no `data-journey-status` and are outside the five stage nodes. Live selection still assigns `aria-current="step"` to Patient Context and History. While either is selected, the certified current stage gives up `aria-current="step"`. That is journey-step semantics on a contextual destination. |
| UAT-15 | Responsive behavior | PASS | At 1440px the Patient Context grid (`grid gap-3 sm:grid-cols-2`) computed to two columns, 660px and 660px. At 390px it computed to one column. History table versus stacked records followed the existing `md` split. Document and rail overflow were 0 at both widths. Keyboard focus on Patient Context matched `:focus-visible` and showed the existing counselling focus ring. |
| UAT-16 | Existing session regression | PASS | Back from Insurance returned Decision. Save Draft was not offered on the read-only session; the action bar said Session read-only and kept Print. Quote, Decision, Insurance, Notes, and Finish presentations remained the existing workspaces. History and Patient Details / Clinical Recommendations content remained the existing surfaces. No ReQueue, Start Counselling, Create Session, or ownership control was used. |
| UAT-17 | Automated regression | PASS | Fresh run in `apps/hospital-portal-web`: `pnpm exec vitest run` on the three authorized files, `--reporter=verbose`. **48 passed, 0 failed, 0 skipped** (3 files). Tests were not edited. The implementation report had recorded 46 passed; this gate records the fresh count. |

## 7. Scope Deviations

1. **Patient Context and History use `aria-current="step"` when selected.** This is inside the approved decision and authorization, and it fails them. It is not a new visual request. No code was changed during UAT.

2. **`CounsellingActionBar.tsx` is modified and is not an authorized production file.** The uncommitted diff adds `revealWorkspaceOnly` / `onRevealWorkspace`. When Patient Context is showing, a primary Next or navigate action reveals the underlying workspace instead of advancing it, and the primary label is forced to Next. The authorization says not to add an action-bar mode and not to edit that file. On these sessions the primary action was absent because the bar was read-only, so that Next override was not exercised in the browser. The code is still present.

BLOCKED — SEPARATE PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION REQUIRED.

That sentence applies to keeping or redesigning the action-bar mode. It does not authorize a fix in this UAT. The `aria-current="step"` failure does not need a new product decision; the approved decision already forbids it.

Other dirty files in the working tree (Waiting List, Add Patient, Schedule Surgery, and a two-line schedule display change in `CounsellingWorkflowSections.tsx`) were not part of this scenario and were not treated as PD-RSH-02R behavior.

## 8. Business Behavior Protection

This UAT did not change application code.

Confirmed against the approved boundary and this session:

- No API changes.
- No DTO changes.
- No database changes.
- No permission changes.
- No ownership changes.
- No FSM changes.
- No workflow-state changes.
- No ReQueue changes.
- No Start Counselling changes.
- No Create Session changes.

Contextual selection did not add a journey stage id. Certified stage targets were unchanged in source: `counselling-journey-rail.ts` is not in the implementation diff.

## 9. Final UAT Decision

**UAT FAILED — ACCEPTANCE BLOCKED**

Patient Context and History are inline, in the approved order, and the five certified stages still render. Acceptance is blocked because selecting either contextual destination sets `aria-current="step"`.

Acceptance is **NOT RECORDED**.

Sections 1–9 record the original failed Manual UAT. They are unchanged. The later gate is **Repeat UAT — Corrective Implementation** below.

---

## Repeat UAT — Corrective Implementation

| Field | Value |
|-------|--------|
| **Repeat UAT date** | 2026-09-27 |
| **Corrective implementation date** | 2026-09-27 |
| **Production file changed by the correction** | `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingJourneyRail.tsx` |
| **Test file changed by the correction** | `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-journey-rail.test.ts` |
| **Production or test changes during this UAT** | **NONE** |
| **Acceptance** | **NOT RECORDED** |

### Environment

Local Hospital Portal. Frontend `http://localhost:3000`. Auth API `http://localhost:5073/api`. Counselling API `http://localhost:7071/api`.

Route pattern: `/dashboard/counsellors-desk/{session}`.

No browser automation tool is registered in this session. The running application was driven with Playwright Chromium.

Viewports: 1440×900 and 390×844.

Primary session: existing in-progress session, type Initial, id suffix `5daf51`. It opened on Quote. Header showed Processing and Initial Counseling. The session was **read-only** for this login. Save Draft was not offered and was not used. No ReQueue, Start Counselling, or Create Session.

Finish is pending on that session, which is the existing rule. Finish was checked on an existing completed session, id suffix `520565`.

### Automated test result

```
pnpm exec vitest run src/components/counsellors-desk/session/session-page-header.test.tsx src/components/counsellors-desk/session/session-history-slice5.test.tsx src/lib/counsellors-desk/counselling-journey-rail.test.ts --reporter=verbose
```

**49 passed, 0 failed, 0 skipped** (3 files). Tests were not edited.

### Critical aria-current result

| Step | Patient Context `aria-current="step"` | History `aria-current="step"` | Certified stage that kept `aria-current="step"` |
|------|----------------------------------------|-------------------------------|--------------------------------------------------|
| A. Quote | ABSENT | ABSENT | Quote PRESENT |
| B. Patient Context | ABSENT | ABSENT | Quote PRESENT |
| C. History | ABSENT | ABSENT | Quote PRESENT |
| D. Decision | ABSENT | ABSENT | Decision PRESENT |
| E. Patient Context again | ABSENT | ABSENT | Decision PRESENT |
| F. History again | ABSENT | ABSENT | Decision PRESENT |

Patient Context and History have no `data-journey-status` and no journey-stage id. When selected, each uses the existing selected pill presentation.

Patient Context: **aria-current="step" = ABSENT**

History: **aria-current="step" = ABSENT**

Underlying current certified stage: **aria-current="step" = PRESENT**

JOURNEY_STAGE_ORDER: **UNCHANGED**

Live stage nodes remained exactly `quote`, `decision`, `insurance`, `notes`, `close`.

### Patient Context result

PASS. First destination. Opens inline. Dialog count 0. No popover, dropdown, sheet, or backdrop. Clinical Recommendations, including Doctor and Optometrist, and Patient Details, including Identity, were visible. Header actions were Outpatient Safety and Close. No Patient Details or Clinical Recommendations header action.

### History result

PASS. Last destination. Opens inline. Dialog count 0. No backdrop. Loading history was shown, then the desktop table. Columns: Event, Date & Time, Actor, Change / Details. Nine rows, newest-first (25 Sept 2026, then 22 Sept 2026). At 390px the desktop table was hidden and the stacked presentation was shown. History `aria-current="step"` stayed absent. The underlying certified stage kept `aria-current="step"`.

### Certified journey regression

PASS. Quote, Decision, Notes, and Insurance opened their existing workspaces. Only the selected certified stage had `aria-current="step"`. On the in-progress session, Finish stayed "Not yet available", which is the existing pending rule. On the completed session, Finish opened the existing finish workspace with `aria-current="step"` on `close`. Selecting Patient Context from Finish left `close` current with `aria-current="step"`.

The Insurance policy workspace was not painted at a 400ms sample. A same-session recheck after the existing panel load showed the Policy workspace, coverage steps, and `counselling-insurance-policy-widget`, with Insurance still the only `aria-current="step"`.

### Responsive result

PASS. At 1440px Patient Context was two columns, 660px and 660px. At 390px it was one column. History used the desktop table at 1440px and stacked records at 390px. Document and rail overflow were 0. Keyboard focus on Patient Context matched `:focus-visible` and showed the existing counselling focus ring. Navigation stayed usable.

### Contextual transitions

PASS. Patient Context, Quote, Decision, Insurance, Notes, and History returned their existing presentations. The in-page marker survived. The session URL did not change. No modal opened. Selecting Patient Context or History did not change the current certified stage id. Finish → Patient Context was verified on the completed session.

### Action Bar governance observation

This corrective UAT did not change `CounsellingActionBar.tsx`.

The working tree still contains an unrelated uncommitted diff in that file, including `revealWorkspaceOnly` and `onRevealWorkspace`. That behavior was not exercised, not tested as a PD-RSH-02R requirement, and is **not accepted**. It remains an outstanding governance item outside this gate.

The read-only session showed the existing action-bar text Session read-only, with Print on desktop and Back after leaving the first stage. That observation is not approval of the uncommitted action-bar mode.

### Final UAT decision

**PD-RSH-02R MANUAL UAT PASS — READY FOR ACCEPTANCE**

Acceptance is **NOT RECORDED**. The next gate is acceptance / closure. This UAT does not record it.
