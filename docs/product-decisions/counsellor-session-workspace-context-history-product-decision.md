# PD-RSH-02R — Counsellor Session Workspace — Patient Context & History Inline UX

| Field | Value |
|-------|--------|
| **ID** | **PD-RSH-02R** |
| **Title** | Counsellor Session Workspace — Patient Context & History Inline UX |
| **Type** | Product Decision |
| **Status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Date** | 2026-09-26 |
| **Product Owner decision** | **SELECTED / APPROVED — 2026-09-26** |
| **Prior decision** | `docs/product-decisions/counsellor-requeue-start-session-and-session-header-product-decision.md` |
| **Prior authorization** | `docs/product-decisions/counsellor-session-header-patient-context-history-implementation-authorization.md` |
| **Prior implementation report** | `docs/product-decisions/counsellor-session-header-patient-context-history-implementation-report.md` |
| **Implementation Authorization** | **CREATED / BOUNDED** — `docs/product-decisions/counsellor-session-workspace-context-history-implementation-authorization.md` |
| **Production code in this step** | **NO CHANGE** |
| **Tests in this step** | **NO CHANGE** |
| **Manual UAT for PD-RSH-02R** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

The Product Owner selected and approved PD-RSH-02R on 2026-09-26. This document records that product decision. It does not implement it. Implementation is bounded by the separate Implementation Authorization.

**THIS PRODUCT DECISION DOES NOT ITSELF EDIT PRODUCTION CODE.**

---

## 1. Status

**APPROVED — PRODUCT DECISION RECORDED.**

The Product Owner approved PD-RSH-02R on 2026-09-26. PD-RSH-02R is the authoritative product direction for the next implementation of the Counsellor Session Patient Context and History presentation. This approval does not start that implementation.

Previous PD-RSH-02 implementation status, recorded here without rewriting that report:

**IMPLEMENTED — NOT ACCEPTED.**

Automated tests for that implementation passed. Manual UAT of that implementation was not executed as a recorded gate, and acceptance was not recorded. Screenshot review of that presentation showed it does not match the intended session workspace UX. That implementation must not be called accepted.

## 2. Date

2026-09-26.

## 3. Product Owner decision state

**SELECTED / APPROVED — 2026-09-26.**

PD-RSH-02R is the authoritative product direction for the next implementation of Patient Context and History presentation. Implementation still requires the separate bounded Implementation Authorization. This approval does not change production code.

PD-RSH-01 remains **NOT SELECTED**. Certified same-session ReQueue behavior stays unchanged.

## 4. Relationship to PD-RSH-02

The 2026-09-26 Product Decision remains historically valid for the composition it approved:

Patient Context, then Quote → Decision → Insurance → Notes → Finish → History.

That approval did not, by its later implementation interpretation, describe inline workspace destinations. The implementation authorization and implementation report treated Patient Context as a header disclosure containing Patient Details and Clinical Recommendations, and treated History as the existing Session History modal opened from a trigger after Finish.

Those historical documents stay as written. This decision does not edit them.

For presentation, that interpretation is superseded by PD-RSH-02R:

- Patient Context is not a header popover, dropdown, or header-only action.
- History is not a modal opened from the workspace navigation.

PD-RSH-02R keeps the approved order and clarifies how those two destinations appear inside the session workspace. The Product Owner approved that clarification on 2026-09-26. PD-RSH-02R is the authoritative product direction for the next implementation. The earlier implementation report remains the record of what was built and not accepted.

## 5. Problem / UX correction

The executed PD-RSH-02 implementation was a composition move only:

- Patient Context opened as a header panel containing the existing Patient Details and Clinical Recommendations actions, which still opened their existing sheets.
- History stayed the existing Session History modal, with its trigger moved to sit after Finish.

That presentation does not match the intended session workspace. Counsellors already move among Quote, Decision, Insurance, Notes, and Finish as destinations in the workspace under the session navigation. Patient Context and History were expected to use that same visual and interaction language, and to show their content in the workspace beneath the navigation, not in a popover and not in a modal.

The correction is presentation and composition. It is not a new clinical, demographic, audit, or workflow model.

## 6. Approved direction

Approved by the Product Owner on 2026-09-26.

The session workspace navigation uses one visual order:

1. Patient Context
2. Quote
3. Decision
4. Insurance
5. Notes
6. Finish
7. History

Patient Context and History are contextual workspace destinations.

Quote, Decision, Insurance, Notes, and Finish remain the existing certified counselling journey stages.

Patient Context and History must not become additional FSM or journey stages.

Selecting Patient Context or History changes which content is shown in the workspace below the navigation. It does not create a journey stage, a lifecycle status, or a completion rule.

The desired experience is the same session workspace, the same counselling visual language, and a different content destination.

## 7. Session workspace navigation order

Patient Context  
Quote  
Decision  
Insurance  
Notes  
Finish  
History

Patient Context is the first contextual destination. History is the last contextual destination. The five certified stages stay in their existing order between them.

The patient identity header stays responsible for patient identity, status, and existing patient identity information. It must not contain a Patient Context popover or a second header action row. Patient Details, Clinical Recommendations, and History must not be duplicated as independent header actions.

## 8. Patient Context behavior

Patient Context is the first contextual workspace destination.

It must not be:

- a popover
- a dropdown
- a header-only action
- a modal
- a Sheet opened from this workspace navigation
- a second header action row

When Patient Context is selected, the content area below the existing session navigation renders an inline Patient Context workspace.

That workspace contains two existing patient-context surfaces, presented as cards or widgets:

1. Clinical Recommendations
2. Patient Details

Conceptually:

```
Patient Context
------------------------------------------------
┌─────────────────────────┐  ┌──────────────────────┐
│ Clinical Recommendations│  │ Patient Details      │
│                         │  │                      │
│ Existing content        │  │ Existing content     │
│ / existing source       │  │ / existing source    │
└─────────────────────────┘  └──────────────────────┘
```

Fields and content come from the existing implementations. This decision does not invent clinical information, demographic information, clinical rules, data sources, API fields, DTO fields, permissions, or recommendation logic.

The redesign is presentation and composition only. Existing Patient Details data, source, and behavior are preserved. Existing Clinical Recommendations data, source, and behavior are preserved.

## 9. Clinical Recommendations card

The Clinical Recommendations card shows the existing Clinical Recommendations content from the existing source.

It does not add recommendation text, rules, or a new source of truth. It does not replace the clinical meaning of the current surface. It presents that existing content inside the Patient Context workspace card.

## 10. Patient Details card

The Patient Details card shows the existing Patient Details content from the existing source.

It does not add demographic fields, identifiers, or a new source of truth. It presents that existing content inside the Patient Context workspace card.

## 11. History inline workspace

History is the last contextual workspace destination.

History must not open as a modal from this workspace navigation.

When History is selected, the content area below the navigation renders the History workspace inline.

Conceptually:

```
History
Operational audit trail

┌──────────┬────────────────┬──────────┬───────────────────┐
│ Event    │ Date & Time    │ Actor    │ Change / Details  │
├──────────┼────────────────┼──────────┼───────────────────┤
│ ...      │ ...            │ ...      │ ...               │
└──────────┴────────────────┴──────────┴───────────────────┘
```

The existing History information remains authoritative. Preserve:

- Event
- Date & Time
- Actor
- Change / Details
- existing newest-first ordering
- existing data source
- existing loading behavior
- existing empty behavior
- existing responsive behavior
- existing accessibility behavior
- existing history event semantics

This decision does not redesign the History data model. No new history events. No new columns. No API redesign. No database change. No new audit semantics.

The change is existing History data and table content, shown in a new inline workspace presentation.

`SessionHistoryModal` may remain in the repository for other certified callers. Removal is not part of this Product Decision. A later implementation audit must prove a safe removal before any caller is dropped. This decision does not require that removal.

## 12. Journey-stage semantics

The certified journey stages remain exactly:

1. Quote
2. Decision
3. Insurance
4. Notes
5. Finish

Do not add Patient Context or History to `JOURNEY_STAGE_ORDER`.

Do not add a `JourneyStageId`, lifecycle status, FSM transition, completion rule, or current-stage rule for Patient Context or History.

They may share the visual navigation surface so the workspace looks consistent. Their meaning stays different. They must not use `aria-current="step"` as journey-stage semantics.

If navigation needs a presentation state for these contextual destinations, a later implementation must use an existing established pattern or a minimal page-level presentation state. It must not invent a new workflow state.

## 13. Visual and interaction standards

The redesign follows the existing Hospital Portal counselling session UX.

Use existing:

- navigation, tabs, and pills
- `CounsellingButton` patterns
- card and widget patterns
- typography
- spacing
- borders
- shadows
- responsive behavior
- focus states
- loading, empty, and error mechanisms

Do not introduce a new design system, theme, token set, component library, global navigation, page framework, modal pattern, popover pattern, or workflow framework.

## 14. Responsive behavior

On desktop, the two Patient Context cards may sit side by side using existing session workspace and card patterns.

On narrow layouts, those cards may stack vertically using existing responsive behavior.

History keeps the existing responsive behavior of the History information: the current desktop table and the current narrow stacked presentation. This decision does not invent a new breakpoint system.

Do not hide Patient Context, Quote, Decision, Insurance, Notes, Finish, or History.

## 15. Accessibility expectations

Patient Context and History remain reachable as workspace destinations with accessible names. They are not journey steps.

Only Quote, Decision, Insurance, Notes, and Finish may keep the existing `aria-current="step"` semantics.

Inline content must reuse existing focus, labelling, table, and loading or empty announcements already used by those surfaces. This decision does not authorize a broad accessibility redesign or a new focus-management system.

## 16. Existing data and source preservation

Presentation and composition only.

Preserve existing:

- Patient Details data, source, and behavior
- Clinical Recommendations data, source, and behavior
- History event, date and time, actor, and change or details content
- History newest-first order, loading, empty state, and event semantics

Do not invent clinical information, demographic information, clinical rules, data sources, API fields, DTO fields, permissions, recommendation logic, history events, or audit semantics.

## 17. Protected business behavior

Do not alter:

- ReQueue
- StartSession
- CreateSession
- `CounselingSession` creation
- `CounselorId`
- ownership
- Ownership History
- Waiting List lifecycle
- queue status
- queue type
- permissions
- branch authorization
- Quote business rules
- Decision business rules
- Insurance business rules
- Notes behavior
- Finish behavior
- Follow-up
- Analytics
- Finalize Surgery
- OT Preparation
- Phase 3I closure
- C-01
- accepted Sessions correction
- FSM
- routes
- APIs
- DTOs
- database
- audit event generation

PD-RSH-01 remains **NOT SELECTED**. Certified same-session ReQueue behavior remains unchanged.

## 18. Out of scope

Out of scope for this decision and for any later implementation that follows it unless a separate decision says otherwise:

- Treating this product-decision record as permission to edit production code without the Implementation Authorization
- Rewriting historical PD-RSH-02 documents or the implementation report
- Treating the previous implementation as accepted
- Removing `SessionHistoryModal` as part of this decision
- Adding Patient Context or History to `JOURNEY_STAGE_ORDER`
- A sixth or seventh journey stage
- New workflow, FSM, or lifecycle status
- New clinical or demographic content
- History column, event, API, DTO, or database changes
- ReQueue, StartSession, CreateSession, ownership, permissions
- Quote, Decision, Insurance, Notes, or Finish business-rule changes
- Follow-up, Analytics, Finalize, OT, Phase 3I, C-01
- A new design system, token set, theme, component library, modal, or popover pattern
- Phase 3J or Slice 14

## 19. Implementation boundary

**Implementation Authorization: CREATED / BOUNDED** in `docs/product-decisions/counsellor-session-workspace-context-history-implementation-authorization.md`.

**Production implementation: NOT STARTED.**

**Production code: NO CHANGE IN THIS STEP.**

**Tests: NO CHANGE IN THIS STEP.**

This Product Decision records approval. It does not implement the workspace. The Implementation Authorization is the only permission to implement, and that work has not started.

The implementation must prefer:

- existing session navigation
- existing Quote, Decision, Insurance, Notes, and Finish presentation
- existing card and widget primitives
- existing Patient Details content and source
- existing Clinical Recommendations content and source
- existing History data and table rendering

Do not assume a specific component architecture before that repository audit.

If inline presentation requires a new shared component, a new design token, a new API, a new DTO, new backend behavior, a new permission, or a workflow change, that implementation must stop rather than invent it.

## 20. UAT boundary

**Manual UAT: NOT EXECUTED FOR PD-RSH-02R.**

The earlier PD-RSH-02 implementation was not accepted. Screenshot review showed the popover and modal presentation does not match this approved direction. That review is not a recorded Manual UAT of PD-RSH-02R, and it is not acceptance of the previous implementation.

Manual UAT of PD-RSH-02R cannot start until the authorized implementation exists. Approval of this decision is not Manual UAT and is not acceptance.

## 21. Acceptance boundary

**Acceptance: NOT RECORDED.**

Neither the previous PD-RSH-02 implementation nor PD-RSH-02R is accepted. Acceptance cannot be recorded from this approval.

## 22. Next gate

**IMPLEMENT ONLY THE AUTHORIZED IMPLEMENTATION AUTHORIZATION, THEN AUTOMATED TESTS, THEN STOP FOR MANUAL UAT.**

Do not implement from this product-decision document itself. Use the Implementation Authorization.

---

Document status: **APPROVED — PRODUCT DECISION RECORDED**

- Product Owner decision: **SELECTED / APPROVED — 2026-09-26**
- PD-RSH-02R: authoritative product direction for the next Patient Context and History presentation implementation
- Previous PD-RSH-02 implementation: **IMPLEMENTED — NOT ACCEPTED**
- PD-RSH-01: **NOT SELECTED**
- Implementation Authorization: **CREATED / BOUNDED**
- Production implementation: **NOT STARTED**
- Production code in this step: **NO CHANGE**
- Tests in this step: **NO CHANGE**
- Manual UAT for PD-RSH-02R: **NOT EXECUTED**
- Acceptance: **NOT RECORDED**
