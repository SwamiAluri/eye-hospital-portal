# Counsellor Session Workspace — PD-RSH-02R Implementation Authorization

| Field | Value |
|-------|--------|
| **Status** | **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED** |
| **Date** | 2026-09-26 |
| **Product Decision** | **PD-RSH-02R APPROVED** |
| **Source** | `docs/product-decisions/counsellor-session-workspace-context-history-product-decision.md` |
| **Product Owner decision** | **SELECTED / APPROVED — 2026-09-26** |
| **Production implementation** | **NOT STARTED** |
| **Production code** | **NO CHANGE IN THIS STEP** |
| **Tests** | **NO CHANGE IN THIS STEP** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |
| **Future implementation report** | `docs/product-decisions/counsellor-session-workspace-context-history-implementation-report.md` — **NOT CREATED** |

This document authorizes a later implementation. It does not perform that implementation. It does not edit `.tsx`, `.ts`, `.cs`, or test files.

**IMPLEMENTATION IS NOT EXECUTED BY THIS DOCUMENT.**

Historical PD-RSH-02 authorization and implementation report stay as written. That earlier implementation is **IMPLEMENTED — NOT ACCEPTED**. It is not the architecture this authorization tells the next implementation to repeat.

---

## 1. Authorized UX

Workspace navigation order:

1. Patient Context
2. Quote
3. Decision
4. Insurance
5. Notes
6. Finish
7. History

Contextual workspace destinations: **Patient Context**, **History**.

Certified counselling journey stages, unchanged: **Quote**, **Decision**, **Insurance**, **Notes**, **Finish**.

Patient Context and History must not become journey stages. Do not modify `JOURNEY_STAGE_ORDER`. Do not add a `JourneyStageId`, lifecycle status, FSM transition, completion rule, or current-stage rule for either destination.

They may share the visual navigation surface. They stay semantically distinct. Only the five certified stages may use `aria-current="step"`.

This authorization forbids another header-popover and modal-trigger move. Patient Context and History must be inline workspace destinations under the session navigation, using the same session workspace as Quote, Decision, Insurance, Notes, and Finish.

---

## 2. Repository audit

Audit date: 2026-09-26. Evidence is the current source. No production file was edited for this audit.

### Where navigation state lives

Certified journey state is not local to the rail. It is controller state in `apps/hospital-portal-web/src/hooks/use-counselling-session-controller.ts`:

- `activeMainTab`: `counselling` | `coverage` | `outpatient`
- `activePhase`: counselling phase, including `estimate`, `decision`, and `wrapup`
- `finishSummaryActive`: presentation flag for Finish. Finish is already not a counselling phase.

`CounsellingSessionPageContent` reads that state from the session controller and passes it into chrome and the action bar.

### How the five stages are mapped

`JOURNEY_STAGE_ORDER` in `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-journey-rail.ts` is exactly `quote`, `decision`, `insurance`, `notes`, `close`.

`getJourneyStageNavigationTarget` maps them to existing navigation:

| Stage | Target |
|---|---|
| Quote | counselling tab, `estimate` phase, Finish summary off |
| Decision | counselling tab, `decision` phase, Finish summary off |
| Insurance | coverage tab, Finish summary off |
| Notes | counselling tab, `wrapup` phase, Finish summary off |
| Finish | counselling tab, `finishSummaryActive` true |

`applySessionNavigation` in `counselling-session-navigation.ts` applies tab, phase, and Finish-summary changes. It does not know Patient Context or History.

### How navigation is drawn

`CounsellingJourneyRail` builds pills only from `buildJourneyRailStages`. A selected navigable stage is a button with `aria-current="step"` when its status is current. The unaccepted PD-RSH-02 implementation added History only as `trailingAction` after those pills. It did not give History a stage id. Patient Context is not on the rail. It is a header disclosure in `SessionPageHeader`.

### How content is mounted

`CounsellingSessionPageContent` mounts three bodies under `shellModuleHost`, switched by `activeMainTab` with the existing `hidden` class rather than by destroying the counselling tree:

- Coverage tab: `CoveragePreauthPanel` — Insurance
- Counselling tab: `CounsellingTabPanel`
- Outpatient tab: outpatient checklist — not one of the five stages

Inside `CounsellingTabPanel`, `activePhase` and `finishSummaryActive` choose the body:

- `estimate` — `CounsellingEstimatePhase` — Quote
- `decision` — `CounsellingDecisionPhase` — Decision
- `finishSummaryActive` — `CounsellingFinishSummary` — Finish
- otherwise — `CounsellingWrapupPhase` — Notes

Insurance is a different tab from Quote, Decision, Notes, and Finish. An inline destination that lives only inside `CounsellingTabPanel` cannot cover Insurance. The correct host for Patient Context and History is the module area in `CounsellingSessionPageContent`, beside the existing tab bodies.

### Cards, responsive layout, and chrome

`CounsellingCard` already exists in `session/primitives/CounsellingCard.tsx`. Session workspaces already use `grid gap-3 sm:grid-cols-2` for side-by-side cards that stack on narrow widths (`CounsellingWorkflowSections`, package workspace, notes strips). Loading, empty, and error presentation already exists on those surfaces and on the History modal. No new token or card primitive is required.

### Patient Details and Clinical Recommendations

`ClinicalRecommendationsContent` is already exported from `ClinicalRecommendationsSheet.tsx`. It renders the existing doctor recommendation summary and the existing optometrist placeholder. `ClinicalRecommendationsSheet` is the Sheet wrapper.

`PatientDemographicsContent` is already exported from `PatientDemographicsSheet.tsx`. It renders the existing demographics fields. `PatientDemographicsSheet` is the Sheet wrapper.

The unaccepted header opens those sheets from a disclosure. PD-RSH-02R forbids a Sheet from this workspace navigation. The inline cards must render the existing content components, not the Sheet wrappers.

### History

`loadCounsellingSessionHistory` loads the existing entries. `SessionHistoryModal` renders loading, the empty state, the desktop table, and the `md:hidden` stacked records. Columns are Event, Date & Time, Actor, and Change / Details. Ordering is the existing newest-first order from the loader. The table is not a separate export. It is inside the modal, which is `role="dialog"` and a fixed overlay.

Production callers of `SessionHistoryModal`: `SessionPageHeader` only. Tests also render it (`session-history-slice5.test.tsx`, `requeue-slice8.test.tsx`). Removal is not safe to authorize. The modal stays. The session workspace navigation must stop opening it.

### Accessibility today

Journey pills use native buttons and `aria-current="step"` only for the current certified stage. History in the unaccepted implementation is a native button without `aria-current`. Patient Context is a native button with `aria-expanded` controlling a hidden panel. That panel is the presentation being replaced.

### Audit answer

The existing workspace can show Patient Context and History on the same visual rail as the five stages **without** modifying certified workflow semantics, if and only if those two destinations are page-level presentation state in `CounsellingSessionPageContent` and do not enter `activeMainTab`, `activePhase`, `finishSummaryActive`, `JOURNEY_STAGE_ORDER`, or `SessionNavigationTarget`.

Do not extend the controller. Do not add a tab or phase. Finish is already a presentation flag; do not copy that pattern into the journey model for Patient Context or History.

Contextual destinations can participate visually by rendering sibling controls on the existing rail, outside `buildJourneyRailStages`.

No API, DTO, database, permission, ownership, FSM, new clinical source, or new history event is required for this presentation. This authorization does not stop for scope.

---

## 3. Authorized implementation approach

Smallest architecture that matches the audit:

1. Add page-local presentation state in `CounsellingSessionPageContent` only. Values: no contextual destination, Patient Context, or History. This state is not workflow state. It is not persisted. It does not call `setActiveMainTab`, `goToPhase`, or `openFinishSummary`.

2. Draw Patient Context as the first control on the existing journey track, and History as the last control after Finish. Render them in `CounsellingJourneyRail` outside the stage list. Do not give them `data-journey-status`, a stage id, or `aria-current="step"`. Reuse the existing pill/button appearance for consistency. The selected contextual control may look selected. It must not use journey-step semantics.

3. Selecting Quote, Decision, Insurance, Notes, or Finish clears the contextual destination and then uses the existing navigation handlers. Do not change those handlers' targets.

4. Selecting Patient Context or History sets the page-local destination and does not change journey state. The module host hides the current tab body with the existing `hidden` pattern and shows the inline workspace. Do not unmount counselling, coverage, or outpatient state.

5. When the contextual destination is cleared, the previously active Quote, Decision, Insurance, Notes, or Finish body shows again because `activeMainTab`, `activePhase`, and `finishSummaryActive` were not changed.

6. Remove the header Patient Context disclosure, the header History button, and the header mount of `SessionHistoryModal`. Do not leave Patient Details, Clinical Recommendations, or History as duplicate header actions. The photo remains identity. It must not stay a second opener for Patient Details.

7. Patient Context inline workspace uses existing `CounsellingCard` and the existing `sm:grid-cols-2` stacking pattern. Children are `ClinicalRecommendationsContent` and `PatientDemographicsContent` with the same inputs the header already passes into the sheets. Do not open `ClinicalRecommendationsSheet` or `PatientDemographicsSheet` from this navigation.

8. History inline workspace calls the existing `loadCounsellingSessionHistory` and renders the existing table through an export of the current modal body. See authorized edit to `SessionHistoryModal.tsx` below. Do not open the modal from the workspace navigation.

9. Do not change `CounsellingActionBar` rules. It stays bound to the underlying journey state. Do not add an action-bar mode for contextual destinations.

`openSessionHistory` and `openClinicalRecommendations` must remain identifiers in `SessionPageHeader.tsx`, and that file must not gain `isReadOnly`. The Pending read-only contract reads those strings and is not an authorized test change. The functions must not gate Patient Context or History. They may supply the inline workspace instead of opening a popover, sheet, or modal.

Keep `navigationBlocked={false}` and the comment `Waiting List owns Start Repeat / Re-evaluate` in `CounsellingSessionPageContent.tsx`. Existing contract tests read those strings and are not authorized edits.

---

## 4. Patient Context

First contextual destination. Inline under the navigation, in `shellModuleHost`.

Forbidden for this destination: popover, dropdown, header-only action, modal, Sheet from this navigation, second header action row.

Two cards:

1. Clinical Recommendations — existing `ClinicalRecommendationsContent` and its current inputs, including the existing doctor recommendation summary. Do not invent recommendation text or a new source.
2. Patient Details — existing `PatientDemographicsContent` and its current inputs. Do not invent demographic fields.

Desktop: two columns where the existing `sm:grid-cols-2` pattern already does. Narrow: the same grid stacks. Do not hide either card.

---

## 5. History

Last contextual destination. Inline under the navigation.

Forbidden: opening `SessionHistoryModal` from this navigation.

Preserve Event, Date & Time, Actor, Change / Details, newest-first order, `loadCounsellingSessionHistory`, loading, empty state, desktop table versus stacked records below `md`, and existing event rendering.

Authorized reuse, not a redesign: export the existing history body from `SessionHistoryModal.tsx` and render that export in the workspace. The modal component stays. Its props, dialog role, and test-rendered content stay valid. Do not change columns, events, sort, API, DTO, or database behavior.

Do not remove `SessionHistoryModal`. No separate removal authorization exists. The only production caller is the header, but tests still mount the modal.

---

## 6. Certified journey

Leave unchanged:

- `JOURNEY_STAGE_ORDER` and stage ids
- `getJourneyStageNavigationTarget`
- `buildJourneyRailStages` status and completion rules
- `applySessionNavigation`
- Quote, Decision, Insurance, Notes, and Finish components and their save, validation, and business rules
- controller tab, phase, and Finish-summary behavior

`counselling-journey-rail.ts`, `counselling-session-navigation.ts`, and `use-counselling-session-controller.ts` are not authorized edits.

---

## 7. Patient header

The header keeps patient identity, status, session type, and existing identity metadata.

It must not keep the Patient Context disclosure, a History workspace trigger, or separate Patient Details and Clinical Recommendations header buttons.

No second header action row.

---

## 8. Authorized production files

| File | Why it may change |
|---|---|
| `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingSessionPageContent.tsx` | Page-local contextual destination. Mount inline Patient Context and History in the existing module host. Clear that destination when a certified stage is chosen. Keep existing tab bodies mounted. |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingJourneyRail.tsx` | Render Patient Context before the stage list and History after Finish, outside `buildJourneyRailStages`, without journey-step semantics. |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingSessionChrome.tsx` | Pass the contextual destination and its selection handlers into the rail. Remove the History-only `historyAction` trigger path. |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/SessionPageHeader.tsx` | Remove the header disclosure, duplicate header actions, and modal mount. Keep identity. Keep `openSessionHistory` and `openClinicalRecommendations` ungated, for the inline path and the Pending contract. |
| `apps/hospital-portal-web/src/components/counsellors-desk/SessionHistoryModal.tsx` | Export the existing history body so the workspace reuses loading, empty, desktop table, stacked records, columns, and event rendering. Do not change the modal's own behavior or remove it. |

No other production file is authorized.

Import, but do not edit: `ClinicalRecommendationsContent`, `PatientDemographicsContent`, `CounsellingCard`, `loadCounsellingSessionHistory`.

If a correct implementation needs a file not in the table, stop. Do not add the file.

---

## 9. Authorized test files

| File | Why it may change |
|---|---|
| `apps/hospital-portal-web/src/components/counsellors-desk/session/session-page-header.test.tsx` | Replace popover and header-action assertions with Patient Context inline, both cards, no popover, and no duplicate header actions. Do not drop proof that both contents still render. |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/session-history-slice5.test.tsx` | Prove History is last, inline, and does not open the modal from workspace navigation. Keep existing column, loading, empty, responsive, and event assertions. |
| `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-journey-rail.test.ts` | Only to reaffirm the five stage ids and that Patient Context and History are absent from `JOURNEY_STAGE_ORDER`. Do not change stage, completion, or navigation expectations. Prefer no edit if current assertions already prove that. |

No other test file is authorized. Do not add a test file. Do not weaken assertions. Quote, Decision, Insurance, Notes, Finish, ReQueue, StartSession, and ownership tests stay as they are. Update only the three files above, and only where PD-RSH-02R changes the superseded popover or modal-trigger expectations.

Required proof for the later implementation:

- Patient Context is first and renders inline.
- Clinical Recommendations and Patient Details cards are present from existing content.
- No popover, dropdown, modal, or Sheet is used for Patient Context.
- No duplicate Patient Details or Clinical Recommendations header action.
- Quote, Decision, Insurance, Notes, and Finish remain, in that order, with unchanged journey semantics.
- History is last, renders inline, keeps Event, Date & Time, Actor, Change / Details, and newest-first order.
- History has no `aria-current="step"` and is not in `JOURNEY_STAGE_ORDER`.
- Workspace navigation does not open `SessionHistoryModal`.
- Existing responsive table/card behavior for History remains.
- Patient Context cards use the existing responsive grid.

---

## 10. Visual system

Reuse counselling navigation pills, `CounsellingButton`, `CounsellingCard`, existing typography, spacing, borders, shadows, focus rings, and the existing loading and empty states. Do not add a theme, token family, component library, global navigation, page framework, modal system, popover system, or workflow framework.

---

## 11. Protected behavior

Do not authorize changes to ReQueue, StartSession, CreateSession, `CounselingSession` creation, `CounselorId`, ownership, Ownership History, Waiting List lifecycle, queue status, queue type, permissions, branch authorization, Quote, Decision, Insurance, Notes, or Finish business rules, Follow-up, Analytics, Finalize Surgery, OT Preparation, Phase 3I, C-01, the accepted Sessions correction, FSM, routes, APIs, DTOs, database, or audit event generation.

PD-RSH-01 remains **NOT SELECTED**. Certified same-session ReQueue behavior stays unchanged.

---

## 12. Out of scope

ReQueue redesign, Start Counselling redesign, new session creation, ownership, `CounselorId`, permissions, Waiting List, Follow-up, Analytics, Finalize, OT Preparation, Quote, Decision, Insurance, Notes, and Finish business rules, History event, API, DTO, or database redesign, new history events or columns, new clinical or demographic content, new data sources, new APIs, DTOs, database fields, workflow states, FSM states, lifecycle statuses, a new design system, theme, tokens, component library, or global navigation, Phase 3J, and Slice 14.

Do not reopen Phase 3I. Do not remove `SessionHistoryModal`.

---

## 13. Stop conditions

Stop immediately, and do not widen this authorization, if implementation requires an API, DTO, or database change; a new permission; an ownership change; a workflow or FSM change; a new lifecycle status; a new clinical source; a new history event; a new audit model; a new design system; a new shared token; a new global navigation architecture; a broad rewrite of the counselling journey; or a change to certified Quote, Decision, Insurance, Notes, or Finish behavior.

Also stop if a production or test file outside the authorized lists is required.

Use exactly:

SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.

---

## 14. Future implementation report

The later implementation may create:

`docs/product-decisions/counsellor-session-workspace-context-history-implementation-report.md`

It must include:

1. Product Decision reference
2. Implementation Authorization reference
3. Exact implementation scope
4. Exact production files changed
5. Exact test files changed
6. Repository audit findings
7. Navigation architecture implemented
8. Patient Context implementation
9. Clinical Recommendations presentation
10. Patient Details presentation
11. History inline implementation
12. Confirmation History is not a journey stage
13. Confirmation five journey stages remain unchanged
14. Responsive behavior
15. Accessibility behavior
16. API, DTO, and database impact
17. Permission and ownership impact
18. FSM and workflow impact
19. Automated test results
20. Limitations
21. Rollback approach
22. Manual UAT: **NOT EXECUTED**
23. Acceptance: **NOT RECORDED**

---

## 15. UAT gate

After the later implementation and its automated tests, stop. Do not perform Manual UAT in that implementation. Do not record acceptance.

Later UAT must check inline Patient Context as the first destination, with both cards and without popover, modal, Sheet, or duplicate header actions; unchanged Quote, Decision, Insurance, Notes, and Finish; inline History as the last destination with the existing columns, records, newest-first order, and narrow layout; and no regression in counselling behavior, ReQueue, Start Counselling, ownership, or the five journey stages.

---

## 16. Status of this authorization

| Item | State |
|---|---|
| Product Decision | **PD-RSH-02R APPROVED** |
| Implementation Authorization | **CREATED / BOUNDED** |
| Production implementation | **NOT STARTED** |
| Production code | **NO CHANGE IN THIS STEP** |
| Tests | **NO CHANGE IN THIS STEP** |
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |

Next gate: implement only this authorization, run automated tests, then stop for Manual UAT.

PD-RSH-02R IMPLEMENTATION AUTHORIZATION CREATED — NO PRODUCTION CHANGE — STOP FOR IMPLEMENTATION
