# Counsellor Session Header — PD-RSH-02 Implementation Report

| Field | Value |
|-------|--------|
| **Status** | **PD-RSH-02 IMPLEMENTATION COMPLETE — AUTOMATED TESTS COMPLETE — STOP FOR MANUAL UAT** |
| **Date** | 2026-09-26 |
| **Implementation Authorization** | `docs/product-decisions/counsellor-session-header-patient-context-history-implementation-authorization.md` |
| **Product Decision** | `docs/product-decisions/counsellor-requeue-start-session-and-session-header-product-decision.md` |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

---

## 1. Implementation Authorization

`docs/product-decisions/counsellor-session-header-patient-context-history-implementation-authorization.md`

Status at authorization: **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED**. This report records the implementation of that authorization only.

## 2. Product Decision

`docs/product-decisions/counsellor-requeue-start-session-and-session-header-product-decision.md`

Product Owner selection: PD-RSH-01 **NOT SELECTED**. PD-RSH-02 **SELECTED / APPROVED — 2026-09-26**. PD-RSH-03 **NOT SELECTED**.

## 3. PD-RSH-02 scope

Presentation and composition only.

Patient header: patient identity/context, then one **Patient Context** action.

Workflow row: Quote, Decision, Insurance, Notes, Finish, History.

History is a contextual read-only action beside Finish. It is not a journey stage. The existing History dialog and table were not redesigned.

## 4. Exact production files changed

- `apps/hospital-portal-web/src/components/counsellors-desk/session/SessionPageHeader.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingSessionPageContent.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingSessionChrome.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingJourneyRail.tsx`

Not changed:

- `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-journey-rail.ts`
- `apps/hospital-portal-web/src/components/counsellors-desk/SessionHistoryModal.tsx`

## 5. Exact test files changed

- `apps/hospital-portal-web/src/components/counsellors-desk/session/session-page-header.test.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/session/session-history-slice5.test.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-journey-rail.test.ts`

## 6. Patient Context implementation

The separate upper-right History, Clinical Recommendations, and Patient Details buttons are no longer independent header actions.

One native `CounsellingButton` labeled **Patient Context** replaces them. It uses the existing ghost header action class, `aria-expanded`, and `aria-controls="counselling-patient-context"`.

The controlled panel is markup in `SessionPageHeader`. It is hidden until the button is pressed, positioned over the page rather than as a second header row, and contains the existing buttons:

- Clinical Recommendations still calls `openClinicalRecommendations` and opens `ClinicalRecommendationsSheet`.
- Patient Details still calls `openDetails` and opens `PatientDemographicsSheet` when patient details are available.

No new shared component, button variant, token, sheet, or data source was added. `openClinicalRecommendations` remains in `SessionPageHeader.tsx`.

## 7. History placement

The existing History `CounsellingButton`, `historyBtnRef`, `openSessionHistory`, `loadCounsellingSessionHistory`, and `SessionHistoryModal` stay owned by `SessionPageHeader`.

`renderWorkflowAction` passes that same button into `CounsellingSessionChrome`, which passes it to `CounsellingJourneyRail` as `trailingAction`. The rail renders it as the last item in the existing workflow track, immediately after Finish.

Visual order: Quote, Decision, Insurance, Notes, Finish, History.

## 8. History is not a journey stage

`JOURNEY_STAGE_ORDER` is unchanged: `quote`, `decision`, `insurance`, `notes`, `close`. History was not added. No `JourneyStageId` was added. The trailing item does not use journey-stage status, navigable flags, or stage test ids.

## 9. History has no aria-current="step"

The History button does not set `aria-current`. Only the five journey-stage controls keep the existing `aria-current="step"` behavior. History uses the existing ghost `CounsellingButton` classes, not `journeyTabCurrent`.

## 10. Five workflow stages unchanged

Quote, Decision, Insurance, Notes, and Finish remain the only stages from `JOURNEY_STAGE_ORDER`. Stage completion, navigation, and current-step rules were not edited. `counselling-journey-rail.ts` was not edited.

## 11. History dialog and table unchanged

`SessionHistoryModal.tsx` was not edited. Columns, event generation, sorting, loading, empty state, desktop table versus stacked cards, scroll, dialog behavior, and accessibility behavior are unchanged. PD-RSH-03 was not implemented.

## 12. Responsive behavior

History sits in the existing journey track (`journeyTabTrack`: nowrap, horizontal overflow). Narrow widths keep that scroll. Patient Context, Quote, Decision, Insurance, Notes, Finish, and History are not hidden by a breakpoint. No second navigation row was added.

## 13. Accessibility behavior

Patient Context and History are native buttons with accessible names (`Patient Context`, `View session history`). Keyboard activation uses the existing button behavior. History remains the trigger for the existing history dialog via `onClick={openSessionHistory}` and `anchorRef={historyBtnRef}`. Focus management was not redesigned.

## 14. Automated test results

Working directory: `apps/hospital-portal-web`.

Command 1:

```
pnpm exec vitest run src/components/counsellors-desk/session/session-page-header.test.tsx src/components/counsellors-desk/session/session-history-slice5.test.tsx src/lib/counsellors-desk/counselling-journey-rail.test.ts src/app/dashboard/counsellors-desk/waiting-list/waiting-list-pending-readonly.contract.test.ts --reporter=verbose
```

Result: **52 passed, 0 failed, 0 skipped** (4 files).

Command 2, composition tests that already read the changed session page content:

```
pnpm exec vitest run src/components/counsellors-desk/session/completed-finish-ux.test.tsx src/app/dashboard/counsellors-desk/waiting-list/waiting-list-lifecycle-claim.contract.test.ts --reporter=verbose
```

Result: **10 passed, 0 failed, 0 skipped** (2 files).

Combined: **62 passed, 0 failed, 0 skipped**.

## 15. No API, DTO, or database changes

No API, DTO, backend service, or database change was made.

## 16. No ReQueue, StartSession, or session-creation changes

ReQueue, StartSession, CreateSession, and `CounselingSession` creation were not modified. PD-RSH-01 was not implemented.

## 17. No ownership, permission, or FSM changes

Ownership, `CounselorId`, permissions, Waiting List lifecycle, queue status, and the workflow state machine were not modified.

## 18. Limitations

- Automated proof uses `renderToStaticMarkup` in the Node test environment. Tests show Patient Context, the existing detail and recommendation buttons inside that panel, History after Finish, five journey stages, and no `aria-current` on History. They do not click through a browser session.
- The patient photo still uses its existing control that opens Patient Details. That identity control was already present and is not a second labeled Patient Details header action.
- History is placed only when `renderWorkflowAction` is passed. The session page passes it.

## 19. Rollback approach

Revert the four production files and three test files listed above. No schema, API, or token rollback is required.

## 20. Manual UAT

**NOT EXECUTED**

## 21. Acceptance

**NOT RECORDED**

PD-RSH-01 remains **NOT SELECTED** and was not implemented. PD-RSH-03 remains **NOT SELECTED** and was not implemented.

Next gate: **MANUAL UAT**.
