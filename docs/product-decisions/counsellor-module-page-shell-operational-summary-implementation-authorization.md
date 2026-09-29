# Counsellor Page Composition Alignment — Implementation Authorization

| Field | Value |
|-------|--------|
| **Document type** | **GOVERNANCE / IMPLEMENTATION AUTHORIZATION** |
| **Date** | 2026-09-25 |
| **Status** | **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED** |
| **Package** | Counsellor Page Composition Alignment |
| **Source Product Decision** | `docs/product-decisions/counsellor-module-page-shell-operational-summary-product-decision.md` |
| **Product Decision status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Production code in this task** | **NOT MODIFIED** |
| **CGX-1** | **NOT MODIFIED.** Manual UAT still pending. Acceptance not recorded |
| **This document** | Authorizes a future implementation. It is not that implementation |

This Product Decision records approved design direction only in the source file. **This file is the Implementation Authorization.** It does not itself change UI, API, DTO, database, permissions, ownership, routes, workflow, FSM, or tests.

---

## 1. Governance status

**IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED**

The audit found one presentation change that stays inside the approved Product Decision. Follow-up and Analytics need no work under this package. Finalize already matches the approved stack; its heading question stays deferred, so this package does not edit it.

Deferred items stay deferred:

1. **SESSIONS CONTENT TITLE TREATMENT — DEFERRED**
2. **FINALIZE WORKSPACE HEADING TREATMENT — DEFERRED**
3. Analytics toolbar-versus-KPI order — deferred

---

## 2. Source Product Decision

`docs/product-decisions/counsellor-module-page-shell-operational-summary-product-decision.md`

Approved direction used here:

- Waiting List is the visual reference only.
- Common order: module identity, then an existing summary where one already exists, then state/navigation, then existing controls, then worklist or report, then pagination where the module already pages.
- No universal grid, no identical columns, no invented KPIs, no new worklists.
- Existing tokens and counselling primitives only. No new UI library, grid, card system, type system, theme, or page framework.

---

## 3. Package purpose

Align Counsellor page composition with that order **only where the current screen breaks it**, without solving a deferred decision and without changing certified behavior.

---

## 4. Audit findings

Inspection was read-only. Routes:

- Sessions: `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx`
- Finalize: `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`
- Follow-up: `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx`
- Analytics: `apps/hospital-portal-web/src/components/counselor/CounselorAnalyticsTab.tsx`
- Waiting List reference: `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`

Shared shell: `counsellingSessionTokens.shellPage` plus `staff-page-fit`. No new page framework exists.

| Surface | Current stack | Against the approved order |
|---------|---------------|----------------------------|
| Waiting List (reference only) | Summary and status tabs, then filter toolbar inside the queue, then worklist, then pagination. No in-page `<h1>`. Compact shell uses `gap-2.5`. Seven zones and PD-CGX-05 Option A unchanged | Not a target |
| Sessions | One header row: back control, `<h1>` Counselling Sessions, `{totalCount} sessions`, and the Reassignment Required pill. Then drill-down chips when present. Then the worklist widget (loading, error, empty, or table). Then server pagination | **State control shares the identity row.** Summary zone correctly absent. Title text and result count stay. Loading, empty, and error already use one primary line, one hint, and Retry on error. Worklist headers already use the CGX-1 readable header class |
| Finalize | Workspace `<h1>` (Surgery Finalization or OT Preparation), purpose line only on OT Preparation, then the existing summary strip, then workspace tabs, then status tabs, then the existing date / UHID / name toolbar, then the worklist, then the queue footer | **Order already matches.** Headings, labels Scheduled / Awaiting Finalise / Surgery Done / Finalised / Selected, tabs, filters, and actions are certified. Not edited |
| Follow-up | Stats strip, population tabs, search / intention / Refresh, section heading, column cues, rows, server pagination | **Order already matches** the accepted decision. Column-cue type remains 10px uppercase; restyling that is a recorded non-decision, not this package |
| Analytics | Toolbar (counselor scope, period, CSV, Print, Refresh), then KPI strip, then funnel, mixes, trends, aging | Toolbar-before-KPI is the **deferred** order. Do not reorder. Aging header type is CGX-1 and stays |

**Spacing observation, not a defect to implement.** Below 1600px, Sessions, Finalize, and Follow-up use `gap-0.5`. Waiting List uses `gap-2.5`. Follow-up is already accepted as composition-aligned and uses the compact gap. Changing Sessions or Finalize to the Waiting List gap would diverge from that accepted compact shell and is not required to fix stack order.

**Not inferred.** No new Sessions KPI, no new Finalize metric, no new Follow-up owner, no new Analytics formula.

---

## 5. Exact authorized scope

**One module is authorized: Counselling Sessions.**

The only authorized edit is presentation placement of the existing Reassignment Required control.

**Not authorized for implementation in this package:** Finalize Surgery, Follow-up Center, Analytics, Waiting List, TopNav, staff chrome, sidebar, global navigation, CGX-1 behavior.

---

## 6. Sessions scope

**Authorized**

In `sessions/page.tsx` only, move the existing Reassignment Required button out of the identity `<header>` so it is its own state band:

1. Existing content header stays first and keeps, unchanged: back control (`aria-label="Go back"`), `<h1>` text **Counselling Sessions** (`data-testid="sessions-list-title"`, `staff-page-title`), and the result count (`data-testid="sessions-list-count"`, same `{totalCount}` wording).
2. The existing Reassignment Required control sits **under** that header and **above** drill-down chips (`sessions-filter-chips`) and the worklist.
3. The control keeps its current label, `aria-pressed`, `data-testid="reassignment-required-filter"`, toggle behavior, and `pillTab` / `pillTabCurrent` classes. It does not become a new tab set or a count card.

**Preserve exactly**

- Content title string and chrome. **SESSIONS CONTENT TITLE TREATMENT — DEFERRED.** Do not remove either title. Do not edit `TopNav.tsx` or `resolve-staff-page-title.ts`.
- Result count stays a result count in its current header place. Do not move it into a KPI or into the pagination footer under this package. The Product Decision says that footer-only placement is not authorized yet.
- No KPI strip. No Pending, Agreed, Declined, In Progress, or Reassignment Required count.
- No Clear. No Refresh. No new filter. Drill-down chips stay as they are.
- Page size 20, server paging, `?page=`.
- Decision, Open, contextual Reassign, MRN, Eye under Surgery.
- Ownership. Loading, empty, and error copy already added for CGX-1 stays verbatim.
- Do not edit `sessions-list-presentation.tsx` (MRN line, eye line, header class).

---

## 7. Finalize scope

**No implementation is authorized for Finalize Surgery under this package.**

The audit found the approved order already in place: workspace identity, existing summary, state tabs, existing controls, worklist, pagination. Changing Surgery Finalization / OT Preparation would resolve **FINALIZE WORKSPACE HEADING TREATMENT — DEFERRED**. This package does not do that.

Do not change Scheduled, Awaiting Finalise, Surgery Done, Finalised, Selected, their predicates, tabs, filters, actions, `FinalizeOtModal`, FSM, SequenceNo, RESP2, Package LA, Package B Print, or Package C.

---

## 8. Follow-up scope

**NO IMPLEMENTATION REQUIRED FOR FOLLOW-UP UNDER THIS PACKAGE.**

The Product Decision already accepts this composition. The audit did not find a presentation-only defect that is required to reach that order. Do not change information architecture, data sources, historical counsellor attribution, ReQueue, actions, filters, columns, endpoints, ownership, or CGX-1 column-cue exposure.

---

## 9. Analytics scope

**NO IMPLEMENTATION REQUIRED FOR ANALYTICS UNDER THIS PACKAGE.**

Toolbar-versus-KPI order stays deferred. Do not reorder it. Do not change formulas, populations, period, Authorized Branch, My Work reporting scope, peer counselor scope, funnel, mixes, trends, aging table, drill-down, export, or print. Do not edit the CGX-1 aging header class.

---

## 10. Explicit exclusions

- TopNav, staff chrome, notifications, profile, logout, sidebar, global navigation
- Waiting List page, C-01, seven zones, KPI formulas, PD-CGX-05 Option A, filters, tabs, pagination, URL state
- Removing or rewriting the Sessions content title or the chrome title
- Finalize workspace headings and the Finalize Surgery sidebar label
- Analytics toolbar / KPI order
- Sessions KPI strip or any new aggregate
- New filters, search models, columns, worklists, or a grid framework
- Copying Waiting List KPI cards, tabs, filters, columns, Owner, payment/coverage, or actions
- CGX-1 behavior: Sessions MRN, Eye, Decision, Open, Reassign, pagination; Follow-up cue exposure; Analytics aging header type
- Changing compact `gap-0.5` shells to Waiting List `gap-2.5`
- Follow-up cue typography (non-decision in the Product Decision)
- Renaming Awaiting Finalise to Needs Attention

---

## 11. Protected certified behavior

- Phase 3I closed. Slice 14 does not exist. Phase 3J not created.
- C-01 accepted and closed. Waiting List unchanged.
- Ownership unchanged. Viewing or opening does not claim.
- Follow-up historical counsellor is not ACL. ReQueue unchanged. No My Follow-ups.
- Analytics My Work stays reporting. PD13–PD15 unchanged.
- Finalize RESP2, FSM, SequenceNo unchanged. No second OT worklist.
- Package LA, Package B Print, and Package C closed. C-LA-04 deferred.
- CGX-1 implementation and automated tests stay as they are. This package must not rewrite them. Manual UAT for CGX-1 stays a separate pending gate. CGX-1 acceptance is not recorded.

---

## 12. API / DTO / database impact

**None.** No endpoint, DTO, query, or schema change. If implementation seems to need one, stop (section 17).

---

## 13. Permission / ownership / workflow impact

**None.** No permission code, `CounselorId` rule, claim-on-open behavior, FSM transition, or route change.

---

## 14. Automated test requirements

Run the existing Sessions contract and pagination tests after the placement change. They must still pass, including:

- MRN rendering and label **MRN** (not UHID)
- Eye under Surgery; no separate Eye column
- Decision values unchanged
- Open unchanged
- Reassignment Required control still present (`reassignment-required-filter`), same pressed behavior
- Contextual Reassign unchanged
- Page size 20, server paging, `?page=`
- No new KPI test id and no new metric label introduced by this package

Add one placement assertion: the Reassignment Required control is not inside the identity header that contains `sessions-list-title`, and the title string remains **Counselling Sessions**. Do not assert removal of the content title or any TopNav change.

Finalize, Follow-up, Analytics, and Waiting List tests must stay green because those files are not edited. If a test fails because an untouched file was edited, that edit is out of scope.

Record the command and the pass count in the implementation report.

---

## 15. Manual UAT gate

Required sequence for the future implementation:

**AUDIT → IMPLEMENTATION → AUTOMATED TESTS → MANUAL UAT → ACCEPTANCE**

Manual UAT is mandatory. Automated tests are not acceptance.

Stop after implementation, automated tests, and the implementation report. Do not write an acceptance artifact during implementation. Do not perform Manual UAT as part of writing this authorization.

CGX-1 Manual UAT remains separate and still pending.

---

## 16. Implementation report requirement

After implementation, write only:

`docs/product-decisions/counsellor-module-page-shell-operational-summary-implementation-report.md`

Include:

- Exact files changed
- Exact modules changed
- Exact presentation changes
- Files intentionally untouched
- API / DTO impact (none)
- Database impact (none)
- Permissions impact (none)
- Ownership impact (none)
- Workflow / FSM impact (none)
- Test commands and exact test counts
- Known limitations
- Confirmation that Sessions content-title treatment, Finalize workspace headings, and Analytics toolbar/KPI order remain deferred
- Confirmation that CGX-1 was not modified
- Manual UAT status: not started by the implementation task
- Acceptance status: not recorded

---

## 17. Stop conditions

Stop and do not improvise if the work requires any of the following. Report:

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

- Removing or changing the TopNav / staff chrome title
- Resolving Sessions title duplication, including deleting the content `<h1>` or the header result count
- Changing Finalize workspace headings
- Reordering the Analytics toolbar and KPI strip
- Creating a Sessions KPI or deriving a new aggregate
- API, DTO, or database changes
- Ownership or permission changes
- Workflow or FSM changes
- A new worklist, filter, or search model
- Editing Waiting List
- Editing Follow-up or Analytics for this package
- Changing MRN, Eye, Decision, Open, Reassign, page size, or pagination behavior
- Editing `sessions-list-presentation.tsx` or the CGX-1 aging header

---

## 18. Acceptance boundary

This authorization is not implementation and not acceptance.

Acceptance of the future Sessions placement change requires a later governance artifact after Manual UAT. It does not accept CGX-1, C-01, Packages LA / B Print / C, or the deferred title items.

**STOP. Do not implement under this task.**
