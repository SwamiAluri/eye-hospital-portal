# Counsellor ReQueue → Start Counselling and Session Header UX Audit

Document type: Read-only product / lifecycle audit  
Date: 2026-09-26  
Mode: Audit only. No production, test, API, DTO, database, permission, ownership, or route change.

Manual UAT for this audit: NOT EXECUTED  
Acceptance: NOT RECORDED  
Implementation Authorization: NOT CREATED

---

## 1. Executive summary

Manual testing re-queued an existing Suresh Babu counselling session, assigned it, and chose Start Counselling. The screen opened the previous session, including its quote, decision, insurance, and notes. Session History showed the re-queue and the later assignment.

That observation matches the current implementation and the certified ReQueue rule. ReQueue does not create a new `CounselingSession`. It returns the same session to the shared Waiting List as a new or reused Waiting queue row, clears current ownership, and then follows the ordinary Pending → Start Counselling path. Start Counselling calls `StartSession` on that same session id.

The request to create a new counselling session at that point is not what the certified product currently defines. It would be a new product decision, not a defect fix. `CreateSession` today refuses a second active episode for the same patient.

The header request is separate. History is a read-only trigger in the patient header. Quote, Decision, Insurance, Notes, and Finish are the journey rail. History can sit beside Finish as its own button without becoming a workflow step, and the existing History table should stay.

Classification of the lifecycle finding: **EXISTING CERTIFIED BEHAVIOR**.

LIFECYCLE DECISION and UX COMPOSITION DECISION must stay separate. Neither is authorized for implementation.

SCOPE STOP — PRODUCT DECISION / AUDIT DOES NOT AUTHORIZE IMPLEMENTATION.

## 2. ReQueue lifecycle trace

Follow-up Center opens `ReQueueModal` on the surgery follow-up page and posts `counsellorsDeskApi.reQueueSession` to `POST /api/Counseling/sessions/{sessionId}/re-queue`.

`CounselingWorkflowService.ReQueueSessionAsync` loads that existing `CounselingSession` by id. On success it:

- Requires a reason and matching Version plus expected `CounselorId`.
- Rejects a session whose OT schedule is SurgeryDone.
- Sets `CounselorId` to null and increments Version.
- Appends a `[Re-queue yyyy-MM-dd]` line to `AdditionalNotes`.
- May update patient intention and session type. It does not change `CounselingSession.Status`. Slice 8 test `Requeue_Owned_ClearsCounselorId_ToNull` asserts Status stays `Completed`.
- Soft-deletes other active queue rows for that same session.
- Reuses an existing Waiting row, or inserts one new `CounselorQueueItem` whose `SessionId` is the same session id, `Status` is `Waiting`, and `QueueType` is `RepeatCounselling`.
- Writes `OwnershipRequeued` history only when the previous owner was not null.

The waiting-list query joins `CounselorQueue` to `CounselingSession` and returns `Id = SessionId`. Queue status `Waiting` is projected as UI status `Pending`. `QueueType` is not the status pill. That is why the row shows Pending, not the Repeat Counselling tab. Repeat Counselling status is reserved for a Completed queue whose `PatientAgreedToSurgery` is not true.

Assignment then sets `CounselorId` on that same session. It does not create a session. An owned Pending row resolves to the label Start Counseling.

## 3. Start Counselling trace

`resolveWaitingListLifecycleAction` returns `{ label: 'Start Counseling', kind: 'open' }` when status is Pending and the current user owns the row.

Waiting List `handleLifecycleAction` for `open` calls `navigateToSession(patient, 'open')`. The route is `/dashboard/counsellors-desk/{patient.id}?from=waiting-list&lifecycle=start-counseling`. `patient.id` is the session id from the waiting-list DTO.

The session controller `handleStartCounselingSession` runs only when `lifecycle=start-counseling`, the projected queue status is Pending, and the actor is the owner. It calls `counsellorsDeskApi.startSession(sessionId, …)` for that same id.

`StartSessionAsync` loads that session, requires the current owner, sets `Status` to `InProgress`, sets `SessionStartTime`, and moves the active queue row from Waiting, Called, or Completed to `InProgress`. It does not insert a `CounselingSession`. Phase 3I comment in that method states Start must not establish or change `CounselorId`.

On that queue transition it also sets `PatientAgreedToSurgery` to null and `PendingDecision` to false. Quote, notes, insurance payload, and surgery recommendation fields are not cleared there.

## 4. CounselingSession identity analysis

| Question | Current source |
|---|---|
| A1. Session id on the Waiting List item after ReQueue | The same `CounselingSession.Id`. The queue row’s `SessionId` is that id. Waiting-list `Id` is that session id. |
| A2. What ReQueue creates | A new or reused Waiting queue item only. Not a new `CounselingSession`. |
| A3. Which id Start Counselling opens | That same session id. |
| A4. Does Start Counselling create a session? | No on this path. |
| A5. Does StartSession reopen the existing session? | Yes. It mutates that session to `InProgress` and clears the two decision flags named above. |
| A9. Established semantic | Return the same counselling episode to the operational queue. Not “begin a new counselling episode.” |

A genuinely new episode is a different certified path. `CreateSessionAsync` calls `TryGetCreateSessionReuseBlockAsync`. After SurgeryDone, no active episode remains and a new session can be created. While any non-cancelled, non-SurgeryDone episode exists, including a Waiting row after ReQueue, create is refused with an instruction to open the existing waiting-list row or continue the existing session.

## 5. Quote, Decision, Insurance, and Notes persistence

A6. Data that remains on the re-queued session:

| Data | After ReQueue | After StartSession on that session |
|---|---|---|
| Quote / package (`PackageAddonsJson`, `PackageAmount`) | Kept | Kept |
| Surgery recommendation and eye | Kept | Kept |
| Insurance fields carried on the session | Kept. ReQueue does not rewrite OT or insurance. | Kept |
| Counsellor notes and `[Re-queue …]` marker in `AdditionalNotes` | Marker appended; other notes kept | Kept |
| Separate notes rows keyed by session id | Kept | Kept |
| `PatientAgreedToSurgery`, `PendingDecision` | Not cleared by ReQueue | Cleared when the active queue row is Waiting, Called, or Completed |
| `CounselorId` | Cleared to null | Unchanged by Start. Already set again by the explicit Assign before Start |
| Ownership history | `OwnershipRequeued` when an owner was cleared, then the later Assign event | Start does not add an ownership event |
| Session status column | Unchanged by ReQueue (certified Completed stays Completed) | Set to `InProgress` |

The previous quote, decision narrative, insurance, and notes therefore appear because they are still stored on that session id. Start is not a blank session. It is also not a completely frozen decision: the agreement flags are reset so the waiting-list outcome can be written again.

## 6. Comparison with related lifecycles

| Path | Session identity | Waiting List action | Start API |
|---|---|---|---|
| Ordinary Pending → Start Counselling | Existing session already on the queue | Start Counseling when the current user owns the row | `StartSession` on that id. Waiting/Called/Completed queue → InProgress |
| Done → Re-evaluate | Same session | Re-evaluate, with a lifecycle claim only when ownership must change | `StartSession` on that id, then Azure re-evaluate enrichment |
| Repeat Counselling → Start Repeat | Same session. UI status is RepeatCounselling, not Pending | Start Repeat | `StartSession` with the repeat session type on that id |
| ReQueue → Assign → Start Counselling | Same session. Queue type `RepeatCounselling`, queue status Waiting, UI status Pending | Start Counseling after assign. Not Start Repeat | Same Pending Start Counseling path |
| Add Patient / `CreateSession` | New session, unless PD-C reuse blocks it | New Pending row for the new id when the counsellor creates it | Not this Start path |
| Subsequent / second-eye after SurgeryDone | New `CounselingSession` is allowed because the prior episode is sealed | Not ReQueue | `CreateSession` |
| OT Returned with no counselling session | Certified create for a row that has no session id | Start Counseling create CTA | Not the re-queued row path |

ReQueue’s `QueueType = RepeatCounselling` does not put the row on the Repeat Counselling tab and does not select Start Repeat. The tab and the CTA follow queue `Status`.

## 7. Classification

**EXISTING CERTIFIED BEHAVIOR**

The user’s expectation of a new session does not match this behavior. That mismatch is not, by itself, an implementation defect. Current source, Slice 8 tests, the Slice 8 implementation report, and PD-REQUEUE-01 agree that the same session returns to the shared queue and ownership is cleared.

Older Slice 8 readiness text said ReQueue still kept `CounselorId`. That described pre-Slice-8 code. Current source and the Slice 8 implementation report both clear `CounselorId`. Session identity was already the same session in that older document. This audit does not treat the pre-implementation snapshot as the live rule.

## 8. Product Decision required

A decision is required only if product wants to change the certified same-session return. It is not required to explain the observed screen. Options are drafted in `docs/product-decisions/counsellor-requeue-start-session-and-session-header-product-decision.md`. No option is selected.

A10. Changing Start after ReQueue to create a new `CounselingSession` would affect session identity, the ownership trail on the old and new ids, historical audit, quote, decision, insurance, notes, surgery linkage (`CounsellingSessionId` on OT schedules), waiting-list projection, Follow-up, Analytics attribution, reporting, and patient history. The old episode’s data would no longer be the row that Start opens.

A11. `CreateSessionAsync` is the certified create path, and PD-C blocks it while this episode is still active. A new session at ReQueue or at Start would need a new lifecycle exception. That is out of the current contract.

A12. Existing tests, not modified:

- `AuthService.Tests/Phase3ISlice8RequeueOwnershipTests.cs`
- `AuthService.Tests/Phase3ISlice8RequeueContractTests.cs`
- `microservices/auth-service/AuthService.Tests/Phase3ISlice8RequeueQueueUniquenessPostgresTests.cs`
- `AuthService.Tests/Phase3IPdCCreateSessionReuseTests.cs`
- `AuthService.Tests/Phase3ISlice2OwnershipCreateStartTests.cs`
- `AuthService.Tests/Phase3ISlice3AssignOwnershipTests.cs`
- `AuthService.Tests/Phase3IPendingReadOnlyUpdateGuardTests.cs`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/requeue-slice8.test.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-lifecycle-action.test.ts`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/waiting-list-lifecycle-claim.contract.test.ts`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/waiting-list-lifecycle-status-sync.contract.test.ts`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/waiting-list-pending-readonly.contract.test.ts`
- `apps/hospital-portal-web/src/hooks/use-counselling-session-controller.version.contract.test.ts`
- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListWorkRow.assign.test.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/start-ot-returned-counselling.test.ts`

## 9. Current header composition

`CounsellingSessionPageContent` stacks `SessionPageHeader` and then `CounsellingSessionChrome`.

The header (`SessionPageHeader`) shows patient identity, status, and session type. Its action group, top to bottom, is History, Clinical Recommendations, and Patient Details. Each is a ghost `CounsellingButton`. History calls `openSessionHistory` in that same component and mounts `SessionHistoryModal`. Clinical Recommendations and Patient Details open their existing sheets.

The workflow strip is `CounsellingJourneyRail`. Stages are fixed as Quote, Decision, Insurance, Notes, Finish (`JourneyStageId`: quote, decision, insurance, notes, close). Finish is a journey stage (`close`), not a separate button. The rail sets `aria-current="step"` on the current stage and scrolls horizontally below the `md` breakpoint.

## 10. Proposed header composition

Patient identity stays in the header, with Patient Details and Clinical Recommendations as the patient-context actions.

History leaves that upper-right group. It sits beside Finish as its own control:

Quote, Decision, Insurance, Notes, Finish, then History.

History continues to open the existing History dialog and table. It does not become a sixth journey stage. The journey rail’s stage type, completion rules, and `aria-current="step"` stay limited to the five workflow stages. A sibling `CounsellingButton`, using the existing History handler and `anchorRef`, is the smallest composition that keeps History visually distinct.

Exact spacing and emphasis stay with the existing counselling tokens. This audit does not choose a new visual treatment.

## 11. History trigger analysis

D1. Layout owners: `CounsellingSessionPageContent.tsx`, `SessionPageHeader.tsx`, `CounsellingSessionChrome.tsx`, `CounsellingJourneyRail.tsx`, `counselling-journey-rail.ts`. History content: `SessionHistoryModal.tsx`, `load-counselling-session-history.ts`.

D2. The History click handler, data load, and dialog live in `SessionPageHeader`. Moving the button is presentation composition if that same handler and dialog stay. The dialog position is anchored to `historyBtnRef`, so the anchor must move with the button.

D3. History does not assign, start, or mutate the session. It has no reason to stay in the header for lifecycle reasons.

D4. Patient Details and Clinical Recommendations already use the header ghost-button pattern and can remain there.

D5. The journey rail does not accept an extra contextual action. Its items are only `JOURNEY_STAGE_ORDER`. Adding History as a stage would mix a read-only dialog trigger into workflow progress.

D6. History should stay visually distinct from the step pills even when placed beside Finish. It is not current/complete/pending workflow progress.

## 12. History table analysis

The surface is `SessionHistoryModal`, a dialog labeled “Session History”, subtitle “Operational audit trail”.

Desktop columns, `md` and wider:

- Event
- Date & Time
- Actor
- Change / Details

Below `md`, the same entries are stacked records, not a different data model. Re-queued rows may label the actor “Requeued by” and show Reason, From, and To inside the details.

Order is newest first (`changedAt` descending) after Auth and Azure history are merged. `[Re-queue]` note markers are added only when an `OwnershipRequeued` row for that reason is absent.

The body scrolls (`overflow-y-auto`, max height about 70vh). Clicking the backdrop or the Close button closes it. There is no Escape handler and no focus trap in this component. Loading copy is “Loading history…”. Empty copy is “No history yet”.

Existing History table is retained; no table redesign is authorized by this audit.

## 13. Accessibility analysis

History, Clinical Recommendations, and Patient Details are native buttons with accessible names from counselling copy. History’s dialog uses `role="dialog"`, `aria-modal="true"`, and `aria-label="Session History"`. The close control has `aria-label="Close session history"`. Decorative icons are `aria-hidden`.

The journey rail is a navigation list. The current stage has `aria-current="step"` and `aria-label="Go to {stage}"`. History must not receive `aria-current="step"` if it is only a dialog trigger.

Focus order today is header actions, then the workflow strip. After a move, History would follow Finish in that strip. Keyboard users can activate the buttons. The dialog does not move focus into itself or restore focus on close. That limitation exists today. This audit does not authorize an accessibility redesign.

## 14. Responsive analysis

Desktop: header identity and actions sit on one row from the `sm` breakpoint. The journey rail is visible without forcing a new layout.

Narrower desktop and small widths: header actions stack and wrap. The journey rail uses horizontal scroll below `sm` and short labels below `md`. An extra History button beside Finish must stay in that scroll row rather than introducing a second navigation pattern.

The History dialog width is `min(36rem, calc(100vw - 1.5rem))`. The table becomes stacked cards below `md`.

## 15. Exact files inspected

Production behavior was read from:

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx`
- `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-lifecycle-action.ts`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`
- `apps/hospital-portal-web/src/hooks/use-counselling-session-controller.ts`
- `microservices/auth-service/AuthService/Controllers/CounselingController.cs`
- `microservices/auth-service/AuthService/Services/CounselingWorkflowService.cs`
- `apps/hospital-portal-web/src/components/counsellors-desk/session/SessionPageHeader.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingSessionPageContent.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingSessionChrome.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingJourneyRail.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-journey-rail.ts`
- `apps/hospital-portal-web/src/components/counsellors-desk/SessionHistoryModal.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/load-counselling-session-history.ts`

Supporting documents included PD-REQUEUE-01, the Slice 8 readiness audit, the Slice 8 implementation report, and the PD-C create-reuse implementation report.

## 16. Existing tests inspected

Listed in section 8. They encode same-session ReQueue, preserved session Status, one Waiting row, Start Counseling via `startSession`, and create-session reuse. None were changed.

Header tests that already cover the History trigger and table, also unchanged: `session-page-header.test.tsx`, `session-history-slice5.test.tsx`.

## 17. Certified behavior protected

This audit does not change C-01, the accepted Sessions correction, Phase 3I ownership, ReQueue, StartSession, Assign, Repeat, Re-evaluate, PD-C second-eye create, Follow-up, Analytics, Finalize, OT, permissions, or routes.

Phase 3I remains closed. Slice 14 does not exist. Phase 3J does not exist.

## 18. Explicit non-actions

No production code, tests, APIs, DTOs, database, permissions, ownership, routes, workflow states, History events, or design-system tokens were modified.

## 19. Recommended next gate

Record a product decision review for two separate items.

LIFECYCLE DECISION: keep certified same-session ReQueue, or explicitly select a new-episode rule. A new-episode rule needs its own authorization because `CreateSession` currently blocks it.

UX COMPOSITION DECISION: whether History moves beside Finish as a distinct dialog trigger, leaving patient-context actions in the header and leaving the History table unchanged.

Do not combine those into one implementation. Do not create an Implementation Authorization from this audit.

SCOPE STOP — PRODUCT DECISION / AUDIT DOES NOT AUTHORIZE IMPLEMENTATION.
