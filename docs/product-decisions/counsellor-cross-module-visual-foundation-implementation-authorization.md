# Counsellor Visual Foundation — Cut 1 Implementation Authorization

| Field | Value |
|-------|--------|
| **Document type** | GOVERNANCE / IMPLEMENTATION AUTHORIZATION |
| **Status** | **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED** |
| **Date** | 2026-09-25 |
| **Package** | Counsellor Visual Foundation — Cut 1 |
| **Source Product Decision** | `docs/product-decisions/counsellor-cross-module-visual-interaction-standard-product-decision.md` |
| **Product Decision status** | **APPROVED — PRODUCT DECISION RECORDED** (2026-09-25) |
| **Source decision IDs** | CGVS-01, CGVS-03, CGVS-04, CGVS-05, CGVS-06, CGVS-08, CGVS-10. Boundaries from CGVS-02, CGVS-07, CGVS-09, CGVS-11, CGVS-12, CGVS-13, CGVS-14, CGVS-15, CGVS-16 stay in force |
| **Production code in this task** | **NOT MODIFIED** |
| **Tests in this task** | **NOT MODIFIED** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

Product Decision approval is not this authorization. This authorization is not acceptance.

---

## 1. Status

**IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED**

The pre-implementation audit found the four target modules already using the established Counsellor visual language for the areas Cut 1 covers. **No production edit is required.**

An implementation that edits files in order to “align” an area marked **ALREADY ALIGNED — NO CHANGE REQUIRED** is outside this authorization.

---

## 2. Date

2026-09-25

---

## 3. Source Product Decision

`docs/product-decisions/counsellor-cross-module-visual-interaction-standard-product-decision.md`

Approved 2026-09-25. Implementation still follows: authorization, then implementation, automated tests, Manual UAT, acceptance, then the next cut. Cuts 2, 3, and 4 are not authorized here.

---

## 4. Purpose

Presentation-only alignment of existing Counsellor operational surfaces with the existing Hospital Portal / Counsellor visual language.

One visual and interaction standard. Module-specific information architecture, data, workflow, and operational meaning stay.

The modules are not required to look identical.

---

## 5. Target modules

| In scope for inspection | Out of scope for edits |
|-------------------------|------------------------|
| Finalize Surgery | Waiting List |
| OT Preparation (same route as Finalize) | Sessions |
| Follow-up Center | Global header / TopNav |
| Analytics | |

Waiting List is the reference benchmark only. Sessions stays locked.

---

## 6. Pre-implementation audit findings

Read-only inspection of current production code. A visual difference is not treated as a defect when the module already uses the shared primitives and certified behavior.

### A. Statistics

| Module | Path | Current | Primitive | Verdict | Change |
|--------|------|---------|-----------|---------|--------|
| Finalize | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | Scheduled, Awaiting Finalise, Surgery Done | `sessionStatusStrip` | **ALREADY ALIGNED — NO CHANGE REQUIRED** | None. Labels and `countNeedsAttention` stay |
| OT Preparation | Same file | Finalised, Selected | Same strip | **ALREADY ALIGNED — NO CHANGE REQUIRED** | Selected stays a selection count |
| Follow-up | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx` | Tab-specific stats from `/followups/stats` | `sessionStatusStrip` | **ALREADY ALIGNED — NO CHANGE REQUIRED** | None |
| Analytics | `apps/hospital-portal-web/src/components/counselor/CounselorAnalyticsTab.tsx` | Existing summary KPIs | `sessionStatusStrip` | **ALREADY ALIGNED — NO CHANGE REQUIRED** | Do not reorder above the toolbar |

Do not copy Waiting List’s five bordered cards onto these strips.

### B. Pills and tabs

| Module | Current | Verdict |
|--------|---------|---------|
| Finalize | Workspace controls use `journeyTab` / `journeyTabCurrent` and `aria-current="page"`. Status tabs use `pillTab` / `pillTabCurrent`, `role="tab"`, `aria-selected` | **ALREADY ALIGNED — NO CHANGE REQUIRED** |
| OT Preparation | Same workspace controls. No second status-tab set | **ALREADY ALIGNED — NO CHANGE REQUIRED** |
| Follow-up | Active, Cold Leads, Post-Surgery use `pillTab` and `role="tab"` | **ALREADY ALIGNED — NO CHANGE REQUIRED** |
| Analytics | Period pills use `pillTab`. Counselor scope is the existing select | **ALREADY ALIGNED — NO CHANGE REQUIRED**. Do not move this toolbar |

### C. Buttons

Existing actions use `CounsellingButton` with `default`, `outline`, or `ghost`, including Finalize FSM actions, Prepare, Print, Cancel, Reopen paths, Follow-up row actions, and Analytics CSV, Print, Refresh, and Retry.

**ALREADY ALIGNED — NO CHANGE REQUIRED.** Do not change labels, handlers, permissions, or placement.

### D. Toolbars

| Module | Controls | Current | Verdict |
|--------|----------|---------|---------|
| Finalize | Date, UHID, Patient Name | `CounsellingInput`, `aria-label`s, `h-8` | **ALREADY ALIGNED — NO CHANGE REQUIRED** |
| OT Preparation | Date, UHID, Patient Name, Print, Prepare | Same input pattern. Filters are independent of Finalization | **ALREADY ALIGNED — NO CHANGE REQUIRED** |
| Follow-up | Search, intention, Refresh | `CounsellingSearchInput`, named select, outline Refresh | **ALREADY ALIGNED — NO CHANGE REQUIRED** |
| Analytics | Scope, period, CSV, Print, Refresh | Existing controls in `analytics-toolbar` | **ALREADY ALIGNED — NO CHANGE REQUIRED** |

**Observation, not a defect.** Below 1600px, Finalize and OT field labels use `text-[10px] uppercase`; at 1600px they use `text-xs` and normal case. That is the existing compact breakpoint in the same toolbar, not a missing primitive. CGVS-10 does not require identical type sizes. Do not restyle those labels in Cut 1.

### E–G. Loading, empty, error

| Module | Current | Verdict |
|--------|---------|---------|
| Finalize | Skeleton while loading. Empty: “No records found”. List failure: `toast.error('Failed to load finalize list')` | **ALREADY ALIGNED — NO CHANGE REQUIRED**. Do not replace the toast |
| OT Preparation | Skeleton. Empty: “No Finalised surgeries” | **ALREADY ALIGNED — NO CHANGE REQUIRED** |
| Follow-up | Skeleton. Population empty copy. List error with Retry. “Stats unavailable” | **ALREADY ALIGNED — NO CHANGE REQUIRED** |
| Analytics | Pulse skeleton (`analytics-loading`). In-page alert and Retry | **ALREADY ALIGNED — NO CHANGE REQUIRED** for Cut 1 mechanism |

The Analytics skeleton is `aria-hidden`. That is **OUT OF SCOPE — CUT 3 CANDIDATE**. This IA does not remove `aria-hidden`.

### H–J. Spacing, responsive, accessibility of these controls

Compact shells on Finalize, OT, and Follow-up use `gap-0.5` below 1600px and `gap-2.5` at 1600px and above. Waiting List uses `gap-2.5` throughout. **ALREADY ALIGNED — NO CHANGE REQUIRED.** Do not equalize the numbers.

Focus rings, named fields, tab semantics, and text status pills are already present on these controls. Do not remove them.

Finalize column cues (`aria-hidden`, hidden below `md`) are **OUT OF SCOPE — CUT 3 CANDIDATE**. They are worklist chrome, not Cut 1 toolbar or stat alignment.

---

## 7. Authorized scope

**No production file change is authorized**, because every Cut 1 area is already aligned.

The future implementation step may:

- Re-read the files named in section 6.
- Confirm the verdicts.
- Run the regression tests in section 12.
- Write an implementation report that states no production file was edited.

It may not invent a visual diff, restyle labels, equalize gaps, reorder Analytics, replace the Finalize toast, or edit shared tokens.

---

## 8. Exact visual areas

Covered only as “already aligned, do not change”:

- Existing statistics presentation
- Existing pills and tabs
- Existing button hierarchy
- Existing search, filter, and action toolbars
- Existing loading, empty, and error mechanisms
- Existing compact spacing

Not covered: worklist columns and cue typography (Cut 2 or Cut 3), Analytics toolbar-before-KPI order (deferred), Finalize headings (deferred), Finalize toast replacement (deferred).

---

## 9. Expected files / components

| Path | Role in this IA |
|------|-----------------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | Inspect only. Covers Finalize and OT Preparation. **No edit** |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx` | Inspect only. **No edit** |
| `apps/hospital-portal-web/src/components/counselor/CounselorAnalyticsTab.tsx` | Inspect only. **No edit** |

Do not edit:

- `counselling-session-tokens.ts`
- `CounsellingButton` or other shared primitives
- Waiting List pages or widgets
- Sessions `page.tsx`
- `TopNav` or `resolve-staff-page-title.ts`

A shared-component edit could change Waiting List or Sessions. That is a stop.

---

## 10. Explicit exclusions

Waiting List and C-01. Sessions, including the accepted state selector. Deferred items in section 16. APIs, DTOs, database, permissions, routes, ownership, `CounselorId`, ReQueue, Assign, Reassign, workflow, FSM, SequenceNo. New metrics, filters, actions, columns, or worklists. Universal grid, resize, reorder, column filters, Columns menu, new theme, new spacing system, universal filter builder, universal KPI component. Cut 2, Cut 3, and Cut 4.

---

## 11. Certified behavior protection

Phase 3I is closed. Slice 14 does not exist. Phase 3J does not exist. C-01 is accepted and closed. Waiting List stays shared. Viewing or opening does not establish ownership. `CounselorId` semantics stay. `CreatedByUserId` is not ownership. ReQueue stays. Follow-up stays shared. Historical counsellor attribution is not an access-control list. There is no My Follow-ups. Analytics My Work stays reporting. Finalize stays shared. RESP2, FSM, and SequenceNo stay. Package LA, Package B Print, and Package C stay closed. C-LA-04 stays deferred. Post-Surgery projection semantics stay. Permissions and APIs/DTOs stay. The accepted Sessions correction and remaining CGX-1 behavior stay.

---

## 12. Test requirements

After the implementation confirmation, run existing tests that lock the current labels, tabs, and actions for Finalize, Follow-up, and Analytics. Do not add a test that expects a new visual treatment.

The run must show:

1. Statistic labels unchanged, including Awaiting Finalise, Finalised, and Selected.
2. Tab and pill semantics unchanged (`role="tab"` / `aria-selected` / `aria-current` where they exist today).
3. Button labels and handlers unchanged.
4. Filter controls unchanged.
5. Loading, empty, and error behavior unchanged, including the Finalize toast and the Analytics Retry.
6. No new API call introduced by this cut.
7. No API contract change.
8. No workflow, FSM, or ownership change.
9. Waiting List sources unchanged.
10. Sessions sources unchanged.
11. Required operational fields not newly hidden.
12. Existing accessibility attributes not removed.

Automated tests are not acceptance.

If the confirmation edits a production file, **stop**. That edit is not covered.

---

## 13. Manual UAT requirements

Manual UAT is required after that confirmation, even when the result is “no visual diff,” so a reviewer can see the four modules still match this audit.

**Automated tests are not acceptance.**

Check Finalize Surgery, OT Preparation, Follow-up Center, and Analytics for hierarchy, statistics, pills and tabs, buttons, toolbars, loading, empty, error, and desktop responsive behavior, and for no regression in certified workflow.

Waiting List and Sessions get a look only. They are not targets.

Do not record UAT as passed in the implementation task. Do not record it in this authorization.

---

## 14. Acceptance boundary

Acceptance, if later recorded, applies only to Cut 1 for Finalize Surgery, OT Preparation, Follow-up Center, and Analytics.

It does not accept Cut 2, Cut 3, Cut 4, Waiting List, the Sessions correction, deferred decisions, column-cue work, or the Analytics loading-region candidate.

---

## 15. Stop conditions

If any proposed edit needs a new Product Decision, API, DTO, database, permission, ownership, workflow, FSM, route, new data, new metric, new filter, new action, a deferred decision, a Waiting List edit, or a Sessions edit, do not solve it.

Record:

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

Stops already identified, and left unresolved:

| Item | Classification |
|------|----------------|
| Finalize `<h1>` versus sidebar **Finalize Surgery** | Deferred. Do not change |
| Analytics toolbar before KPI strip | Deferred. Do not reorder |
| Finalize toast versus an in-page error | Deferred. Do not replace the toast |
| Follow-up 10px uppercase column cues | Deferred typography. Not Cut 1 |
| Finalize column cues `aria-hidden` | **OUT OF SCOPE — CUT 3 CANDIDATE** |
| Analytics loading `aria-hidden` | **OUT OF SCOPE — CUT 3 CANDIDATE** |
| Equalizing `gap-0.5` and `gap-2.5` | Not a defect. Do not change |
| Sessions partition KPIs | Data gap. Not this cut |
| Editing shared tokens or `CounsellingButton` | Would risk Waiting List and Sessions. Stop |

---

## 16. Out of scope / future candidates

**PROPOSED — NOT AUTHORIZED**

- Cut 2 worklist and grid presentation.
- Cut 3 accessibility and responsive polish, including Finalize column cues and the Analytics loading region.
- Cut 4 cross-module visual regression as its own package. Cut 1 still requires its own Manual UAT before acceptance.

---

## 17. Final implementation authorization statement

**IMPLEMENTATION AUTHORIZED ONLY FOR THE BOUNDED CUT 1 SCOPE DESCRIBED IN THIS DOCUMENT.**

That scope is confirmation that Finalize Surgery, OT Preparation, Follow-up Center, and Analytics already match the Cut 1 visual areas, with no production edit.

Nothing outside that scope is authorized.

This IA does not authorize Cut 2, Cut 3, Cut 4, Waiting List changes, Sessions changes, deferred Product Decisions, or business, data, or API changes.

**STOP. Do not implement under this task.**
