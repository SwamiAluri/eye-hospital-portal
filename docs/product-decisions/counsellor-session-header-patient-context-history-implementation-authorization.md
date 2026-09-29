# Counsellor Session Header — PD-RSH-02 Implementation Authorization

| Field | Value |
|-------|--------|
| **Status** | **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED** |
| **Date** | 2026-09-26 |
| **Source Product Decision** | `docs/product-decisions/counsellor-requeue-start-session-and-session-header-product-decision.md` |
| **Product Decision status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Product Owner selection** | PD-RSH-01 **NOT SELECTED**. PD-RSH-02 **SELECTED / APPROVED — 2026-09-26**. PD-RSH-03 **NOT SELECTED**. |
| **Audit** | `docs/audits/counsellor-requeue-start-session-and-header-ux-audit.md` |
| **Production implementation** | **NOT STARTED** |
| **Production code** | **NONE MODIFIED BY THIS DOCUMENT** |
| **Tests** | **NONE MODIFIED BY THIS DOCUMENT** |
| **Implementation report** | **NOT CREATED** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

This document authorizes a future implementation of PD-RSH-02 only. It does not perform that implementation.

**IMPLEMENTATION IS NOT YET EXECUTED.**

The Product Decision approval does not itself authorize implementation. This authorization does.

---

## 1. Authorized scope

PD-RSH-02 only. Presentation and composition of the counselling session header and workflow row.

Approved composition:

**Patient header**

- Patient identity/context
- Patient Context

**Workflow row**

- Quote
- Decision
- Insurance
- Notes
- Finish
- History

Order: Patient Context, then Quote → Decision → Insurance → Notes → Finish → History.

PD-RSH-01 is not selected. Certified same-session ReQueue → Start Counselling stays. PD-RSH-03 is not selected. The History table is not redesigned.

---

## 2. Patient Context

Patient Context is one combined patient-context action. It covers the existing Patient Details action and the existing Clinical Recommendations action. Both must remain available through that one action.

Preserve the existing sheets, data, and open behavior:

- `PatientDemographicsSheet` for Patient Details
- `ClinicalRecommendationsSheet` for Clinical Recommendations
- Existing `CounsellingButton` and counselling copy for accessible names

Do not create clinical data, change recommendation content, change Patient Details content, change permissions, change APIs, change DTOs, change data sources, or change clinical rules. Do not invent a recommendation source of truth.

Remove the separate upper-right History, Patient Details, and Clinical Recommendations buttons so those controls are not duplicated. Patient identity, status, and session type stay in the header. The header must not grow a second action row.

If exposing both existing sheets requires a new shared menu, a new button variant, or a new component file, stop. Use exactly:

SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.

---

## 3. History placement

Move the History trigger out of the upper-right patient-header action group. Place it beside and after Finish in the existing workflow presentation.

Final order: Quote, Decision, Insurance, Notes, Finish, History.

History is a contextual, read-only action. It is not a journey stage.

Do not add History to `JOURNEY_STAGE_ORDER`. Do not give History a `JourneyStageId`. Do not set `aria-current="step"` on History. Do not change the five stages Quote, Decision, Insurance, Notes, and Finish, including their completion, navigation, and current-step rules.

Keep the existing History click handler, `loadCounsellingSessionHistory`, and `SessionHistoryModal`. Move the trigger and its `historyBtnRef` anchor with it. The dialog must keep opening from that handler.

`counselling-journey-rail.ts` must not gain a sixth stage. Prefer leaving that file unchanged. `SessionHistoryModal.tsx` must stay unchanged. Prefer leaving it unchanged.

---

## 4. History dialog and table

PD-RSH-03 is not selected. Do not redesign the History table. Do not add or remove columns. Do not change event generation, the data model, sort order, loading, empty state, or the desktop-table versus stacked-card breakpoint.

The existing dialog remains the surface. This authorization moves its trigger only.

Current desktop columns stay: Event, Date & Time, Actor, Change / Details.

---

## 5. Design system and responsive behavior

Reuse `CounsellingButton`, existing counselling tokens, the journey rail, its spacing, typography, focus rings, and horizontal scroll. Do not create a design system, tokens, component library, button variant, typography, workflow stage, navigation system, modal, sheet, or history component. Do not edit shared design tokens.

The journey rail already scrolls horizontally at narrow widths (`overflow-x-auto` below `sm`, short labels below `md`). History stays in that same workflow row. Do not add a second navigation row. Do not hide History or Patient Context. Do not remove Quote, Decision, Insurance, Notes, or Finish.

History and Patient Context stay visually distinct from journey-stage pills. They must not use `journeyTabCurrent` or `aria-current="step"`.

---

## 6. Accessibility

Patient Context and History remain native buttons. History remains the dialog trigger for the existing `role="dialog"` history surface. The five workflow stages keep their current button and `aria-current="step"` behavior.

Do not rewrite focus management. Do not add a focus trap, Escape handling, or dialog-focus redesign. Do not run a broader accessibility pass.

---

## 7. Authorized production files

Inspect the current implementation first. Change only the smallest set required from this list:

| File | Role in this authorization |
|---|---|
| `apps/hospital-portal-web/src/components/counsellors-desk/session/SessionPageHeader.tsx` | Patient identity. Replace the separate Patient Details and Clinical Recommendations buttons with Patient Context. Remove the History button from this group. |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingSessionPageContent.tsx` | Only if the History trigger must be passed from the header owner into the workflow row. |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingSessionChrome.tsx` | Only if History must render in the workflow section after the journey rail, in the same horizontal presentation. |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingJourneyRail.tsx` | Only if a sibling slot after Finish is required. Do not change stage definitions. |
| `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-journey-rail.ts` | Read only unless a compile break forces a touch. Do not add History to `JOURNEY_STAGE_ORDER`. Prefer no edit. |
| `apps/hospital-portal-web/src/components/counsellors-desk/SessionHistoryModal.tsx` | Read only. Do not edit. |

Do not assume every listed file changes. If another production file is required, stop. Do not work around the list.

Current layout, confirmed by inspection for this authorization:

- `SessionPageHeader` renders History, Clinical Recommendations, and Patient Details as separate ghost buttons, and owns `openSessionHistory` plus `SessionHistoryModal`.
- `CounsellingSessionPageContent` stacks the header, then `CounsellingSessionChrome`.
- `CounsellingSessionChrome` renders `CounsellingJourneyRail`, then the session summary strip.
- `CounsellingJourneyRail` renders only the stages built from `JOURNEY_STAGE_ORDER`: quote, decision, insurance, notes, close (Finish).

---

## 8. Authorized tests

Inspect tests before editing them. Change or add assertions only where needed to prove PD-RSH-02. Do not weaken existing assertions. Do not rewrite unrelated tests.

| Test | Allowed use |
|---|---|
| `apps/hospital-portal-web/src/components/counsellors-desk/session/session-page-header.test.tsx` | Patient Context, removal of duplicate header actions, History no longer living only in the old header group when the trigger moves. |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/session-history-slice5.test.tsx` | History still opens the existing dialog. Table columns and content assertions stay. |
| `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-journey-rail.test.ts` | Only if needed to prove the five stages are unchanged and History is absent from `JOURNEY_STAGE_ORDER`. Prefer no edit if current assertions already prove that. |

Required proof:

1. Patient Context is present.
2. Patient Context still opens the existing Patient Details and Clinical Recommendations behavior.
3. Quote, Decision, Insurance, Notes, and Finish are unchanged.
4. History is present after Finish.
5. History still opens the existing History dialog.
6. History is not a journey stage and does not receive `aria-current="step"`.
7. The existing five stages remain.
8. The existing History table and content remain.
9. Responsive composition stays valid where tests already cover it.

If another test file must change, stop.

---

## 9. Protected behavior

Leave unchanged:

- PD-RSH-01. ReQueue returns the same `CounselingSession`, creates or reuses a Waiting queue row, requires explicit assignment, shows Pending, and Start Counselling calls `StartSession` on that same id.
- PD-RSH-03. History table, columns, sort, loading, empty state, and responsive table/card layout.
- Phase 3I closure. C-01. Accepted Sessions correction.
- Quote, Decision, Insurance, Notes, and Finish behavior.
- Follow-up, Analytics, Finalize, OT, permissions, routes, APIs, DTOs, database, FSM, workflow states, and the ownership model.

Do not create a `CounselingSession`. Do not modify ReQueue, StartSession, CreateSession, `CounselorId`, ownership, Ownership History, Waiting List lifecycle, queue type, or queue status.

---

## 10. Out of scope

ReQueue, StartSession, CreateSession, session creation, `CounselorId`, ownership, permissions, Waiting List, Follow-up, Analytics, Finalize, OT Preparation, the Sessions worklist, quote/decision/insurance/notes/finish business logic, History event generation, History API, History DTO, History database model, History table design, History columns, sorting, loading, empty state, design tokens, shared theme, global layout, TopNav, new workflow stages, new routes, new APIs, new DTOs, new backend services, new database fields, a new component library, a new button variant, a new accessibility framework, and a new responsive framework.

Do not reopen Phase 3I. Slice 14 does not exist. Phase 3J does not exist.

---

## 11. Stop conditions

Stop immediately if the change needs an API, DTO, or database change; a new `CounselingSession`; a ReQueue or StartSession change; an ownership or permission change; a workflow or FSM change; a new lifecycle status; a History backend, event, or data-model change; a shared token or design-system change; a new shared component; an unlisted production file; a broad accessibility redesign; or a broad responsive redesign.

Use exactly:

SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.

Do not write a new product decision inside the implementation.

---

## 12. Implementation principle

Smallest composition change. Intended result:

Patient header: identity/context, then one Patient Context control.

Workflow row: Quote, Decision, Insurance, Notes, Finish, then History in that same row.

History stays visually distinct from workflow-stage state. Patient Context stays visually distinct from workflow-stage state. The header gets smaller, not larger. No duplicated controls. No extra page chrome.

---

## 13. Validation the implementation must run

After the later implementation, from `apps/hospital-portal-web`, run the relevant counselling session tests, at minimum:

- `src/components/counsellors-desk/session/session-page-header.test.tsx`
- `src/components/counsellors-desk/session/session-history-slice5.test.tsx`
- `src/lib/counsellors-desk/counselling-journey-rail.test.ts`
- any directly affected session composition test that already imports the changed files

Report passed, failed, skipped, and the exact commands. If a failure needs a change outside this authorization, stop. Do not weaken the assertion.

This authorization does not run those tests. No automated test has been executed for PD-RSH-02 under this document.

---

## 14. Implementation report the later implementation must write

Path, not yet created:

`docs/product-decisions/counsellor-session-header-patient-context-history-implementation-report.md`

It must include:

1. This authorization
2. The Product Decision
3. PD-RSH-02 approved scope
4. Exact production files changed
5. Exact test files changed
6. Patient Context implementation
7. History placement
8. Confirmation History is not a journey stage
9. Confirmation History does not receive `aria-current="step"`
10. Confirmation the five workflow stages are unchanged
11. Confirmation the History dialog and table are unchanged
12. Responsive behavior
13. Accessibility behavior
14. Test results
15. Confirmation of no API, DTO, or database changes
16. Confirmation of no ReQueue, StartSession, or session-creation changes
17. Confirmation of no ownership, permission, or FSM changes
18. Limitations
19. Rollback
20. Manual UAT: NOT EXECUTED
21. Acceptance: NOT RECORDED

Do not claim UAT or acceptance in that report.

---

## 15. Manual UAT gate

After implementation and automated tests, stop. Do not perform Manual UAT as part of implementation. Do not record acceptance.

Later UAT should check a smaller header, Patient Context opening the existing Patient Details and Clinical Recommendations content, unchanged Quote, Decision, Insurance, Notes, and Finish, History beside Finish opening the existing dialog, an unchanged History table, responsive behavior, keyboard use of the two buttons, and no session-workflow regression.

---

## 16. State of this document

| Item | State |
|---|---|
| PD-RSH-01 | NOT SELECTED |
| PD-RSH-02 | SELECTED / APPROVED — 2026-09-26. Implementation **NOT YET EXECUTED**. |
| PD-RSH-03 | NOT SELECTED |
| Implementation Authorization | CREATED / BOUNDED |
| Production code | NONE MODIFIED |
| Tests | NONE MODIFIED |
| Manual UAT | NOT EXECUTED |
| Acceptance | NOT RECORDED |

Next gate: implement only this authorization, then automated tests, then stop for Manual UAT.
