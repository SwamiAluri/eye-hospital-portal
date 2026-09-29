# Counsellor ReQueue → Start Counselling and Session Header Product Decision

Document type: Product Decision  
Status: **APPROVED — PRODUCT DECISION RECORDED**  
Date: 2026-09-26

Audit: `docs/audits/counsellor-requeue-start-session-and-header-ux-audit.md`

Product Owner selection:

- PD-RSH-01 — NOT SELECTED
- PD-RSH-02 — SELECTED / APPROVED — 2026-09-26
- PD-RSH-03 — NOT SELECTED

Only PD-RSH-02 is approved. This approval records the product decision. It does not authorize implementation.

Implementation Authorization: NOT CREATED  
Production code changed: NO  
Tests changed: NO  
Manual UAT: NOT EXECUTED  
Acceptance: NOT RECORDED

These decisions stay separate. They must not be implemented as one change.

SCOPE STOP — PRODUCT DECISION / AUDIT DOES NOT AUTHORIZE IMPLEMENTATION.

---

## PD-RSH-01 — ReQueue → Start Counselling semantics

Product Owner decision: **NOT SELECTED / NOT APPROVED**

Option A, Option B, and Option C are not selected. Certified ReQueue → Start Counselling same-session behavior stays unchanged. This approval does not change it.

### Observed behavior

1. An existing counselling session was re-queued from Follow-up.
2. Waiting List showed the patient as Pending.
3. The session was explicitly assigned to the current counsellor.
4. Waiting List showed Pending and Start Counselling.
5. Start Counselling opened the previous session, including existing quote, decision, insurance, and notes.
6. Session History showed the re-queued event, then assignment.

### Source-code trace

ReQueue posts to `POST /api/Counseling/sessions/{id}/re-queue`. `ReQueueSessionAsync` updates that same `CounselingSession`: `CounselorId` becomes null, Version increments, a re-queue note is appended, and session Status is left unchanged. It inserts or reuses one Waiting queue row whose `SessionId` is that same id and whose `QueueType` is `RepeatCounselling`.

Waiting List maps queue status `Waiting` to UI status `Pending` and returns the session id as the row id. After Assign, Pending owned by the current user shows Start Counseling. That action routes to `/dashboard/counsellors-desk/{sessionId}?lifecycle=start-counseling`.

`handleStartCounselingSession` calls `StartSession` on that id. `StartSessionAsync` sets the same session to `InProgress` and, when the queue row is Waiting, Called, or Completed, clears `PatientAgreedToSurgery` and `PendingDecision`. It does not create a session and does not clear quote, insurance payload, notes, or surgery recommendation fields.

### Current certified behavior

PD-REQUEUE-01: an owned session requeued into the Waiting List has `CounselorId` cleared. The session returns to the shared Waiting List. Ownership is established again only by explicit assignment. Prior ownership stays in history.

Slice 8 implemented that rule and preserved session Status. Its test `Requeue_Owned_ClearsCounselorId_ToNull` expects Status to remain `Completed`. `Requeue_CreatesExactlyOneActiveWaiting` expects one Waiting row for the same `SessionId` with `QueueType` `RepeatCounselling`.

Ordinary Pending Start Counseling, Done Re-evaluate, and Repeat Counselling Start Repeat all call `StartSession` on the existing id. A new `CounselingSession` is the Add Patient / `CreateSession` path, and only when PD-C allows it. PD-C refuses create while a non-SurgeryDone episode is active, including a Waiting row, and tells the user to open the existing row.

### Classification

**EXISTING CERTIFIED BEHAVIOR**

The observed screen is the certified same-episode return plus the ordinary owned-Pending start. It is not classified as an implementation defect.

### Evidence

CURRENT SOURCE BEHAVIOR: same session id, new or reused Waiting row, UI Pending, Start Counseling calls `StartSession` on that id, prior clinical content remains, decision agreement flags are cleared at Start.

HISTORICAL DOCUMENTED BEHAVIOR: PD-REQUEUE-01 and the Slice 8 implementation report say the same session returns to the queue and ownership is cleared. The pre-Slice-8 readiness audit described an older code path that kept `CounselorId`; current source and the implementation report do not. That older snapshot did not say ReQueue creates a new `CounselingSession`.

No certified document defines ReQueue → Start Counselling as a new counselling episode. Second-eye / subsequent episode create is a separate PD-C rule and applies after SurgeryDone, which ReQueue rejects.

### Impact of changing the behavior

Creating a new `CounselingSession` at ReQueue or at Start Counselling would split session identity. The new id would not carry the previous quote, decision, insurance, notes, surgery link, ownership history, or Follow-up and Analytics attribution unless a separate migration copied them. The old id would remain the historical episode. Waiting List, OT `CounsellingSessionId`, reporting, and patient history would have to say which id is operational. `CreateSessionAsync` currently blocks that create while the re-queued episode is active, so the change needs a new lifecycle exception, not a reuse of Start.

### Candidate options

Product Owner decision: **NOT SELECTED**. No option below is approved.

**Option A — Same episode**

ReQueue returns the same `CounselingSession` to the Waiting List. After explicit assignment, Start Counselling resumes that same session through the existing `StartSession` path. Quote, notes, insurance, and surgery fields stay on that id. This matches current source and PD-REQUEUE-01 / Slice 8 / PD-C.

**Option B — New episode on Start**

ReQueue still returns the patient to the Waiting List, but Start Counselling creates a new `CounselingSession`. This does not match current source. The certified `CreateSession` path rejects a second active episode. Selecting this option would require a new lifecycle transition, a decision about what is copied, and consequences for history, ownership, quote, decision, insurance, notes, surgery, Follow-up, Analytics, and reporting. This audit does not design that transition.

**Option C — Keep the two certified meanings distinct**

ReQueue means “return this counselling episode to the operational queue.” A new counselling episode remains the SurgeryDone / second-eye `CreateSession` path, or Add Patient when no active episode exists. Start Repeat remains the Completed + not-agreed session, which is a different waiting-list status from the Pending row produced by ReQueue. This option does not add a behavior. It records the distinction the repository already implements.

### What is not authorized

No new `CounselingSession`. No ReQueue change. No `StartSession` change. No ownership change. No `CounselorId` change. No API, DTO, or database change.

---

## PD-RSH-02 — Counselling Session header composition

Product Owner decision: **SELECTED / APPROVED**  
Selection date: **2026-09-26**

This selection approves the product composition only. It does not authorize implementation.

### Approved composition

Patient Context  
Quote  
Decision  
Insurance  
Notes  
Finish  
History

Approved order:

Patient Context, then Quote → Decision → Insurance → Notes → Finish → History.

### Patient header

- Patient identity/context
- Patient Context

Patient Context is the combined patient-context action. It covers the existing Patient Details action and the existing Clinical Recommendations action. Both remain available through that combined action. Their underlying behavior, data source, permissions, and clinical content stay unchanged.

### Counselling workflow

- Quote
- Decision
- Insurance
- Notes
- Finish
- History

History is a separate contextual, read-only action placed beside Finish. History is not a sixth journey stage. History must not receive `aria-current="step"`. History continues to open the existing Session History dialog. The existing History table and content are not changed by this approval. PD-RSH-03 is not selected.

### Design constraint

Use the existing Hospital Portal counselling header and journey presentation. History remains a button that opens the existing History dialog. It does not become a journey stage, and it does not change Quote, Decision, Insurance, Notes, or Finish navigation.

The journey rail today only renders the five workflow stages. The smallest consistent placement is a sibling control next to that rail, still using the existing History click handler and anchor, not a new stage id inside `JOURNEY_STAGE_ORDER`.

### Boundaries

No new history backend behavior. No new data. No new action meaning. No new permission. No lifecycle mutation. No ownership mutation. No change to Quote, Decision, Insurance, Notes, or Finish behavior. No change to Clinical Recommendations content or Patient Details data. No token or design-system change. No ReQueue, StartSession, session-creation, `CounselorId`, API, DTO, or database change.

---

## PD-RSH-03 — History table

Product Owner decision: **NOT SELECTED / NOT APPROVED**

The existing History table remains protected by certified behavior. This section is not a separate selected decision. The existing History dialog table is the content surface.

Desktop columns already present:

- Event
- Date & Time
- Actor
- Change / Details

Below the `md` breakpoint the same entries are stacked. Order is newest first. Loading, empty, scroll, and close behavior stay as implemented. Re-queue events continue to come from `OwnershipRequeued`, with the existing notes fallback when that trail is absent.

Existing History table is retained; no table redesign is authorized by this audit.

No new columns. No new history events. No History data-model change.

---

## Out of scope

Implementation, production edits, test edits, API, DTO, database, new session creation, ReQueue, StartSession, ownership, `CounselorId`, History events, History data model, workflow state machines, new statuses, new worklists, Phase 3I reopening, Slice 14, Phase 3J, Quote, Decision, Insurance, Notes, Finish, Clinical Recommendations content, Patient Details data, shared design tokens, quote or notes migration, Follow-up, Analytics, Finalize, OT, and design-system changes.

PD-RSH-02 approval does not authorize those changes.

## Next gate

SEPARATE BOUNDED IMPLEMENTATION AUTHORIZATION FOR PD-RSH-02

Document status: **APPROVED — PRODUCT DECISION RECORDED**

- PD-RSH-01 — NOT SELECTED
- PD-RSH-02 — SELECTED / APPROVED — 2026-09-26
- PD-RSH-03 — NOT SELECTED

Implementation Authorization: NOT CREATED  
This document does not authorize implementation.
