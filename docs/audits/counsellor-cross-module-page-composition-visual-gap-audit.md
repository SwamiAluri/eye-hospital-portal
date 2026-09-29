# Counsellor cross-module page composition — visual gap audit

| Field | Value |
|-------|--------|
| **Type** | Read-only audit |
| **Date** | 2026-09-25 |
| **Modules** | Finalize Surgery, OT Preparation, Follow-up Center, Analytics |
| **Reference** | Counsellor Waiting List composition, density, and stacking |
| **Production code** | Not modified |
| **Product Decision** | Not created |
| **Implementation Authorization** | Not created |

Sessions header correction is treated as accepted for this audit and is not reopened. Waiting List is reference only.

**Discrepancy, not resolved here.** `counsellor-module-page-shell-operational-summary-product-decision.md` section 6 still describes a Sessions content `<h1>`, back control, and result count in the identity row. The accepted Sessions page no longer renders that block. It uses the staff chrome title and a two-state pill selector. This audit does not amend that document.

---

## A. Executive summary

| Module | Composition |
|--------|-------------|
| Finalize Surgery | Aligned with the approved stack. Workspace heading versus the sidebar label stays deferred. |
| OT Preparation | Aligned with the approved stack on the same route. The same heading deferral applies. |
| Follow-up Center | Aligned. The approved decision already says so, and the current page still matches it. |
| Analytics | Aligned as a reporting surface. Toolbar-before-KPI order stays deferred. It is not a worklist defect. |

No module needs a universal grid, a new KPI, a new worklist, or a change to certified workflow to meet the composition rule.

---

## B. Reference pattern

Accepted Waiting List content, from `waiting-list/page.tsx` and `WaitingListSummaryWidget.tsx`:

1. No in-page page title. The staff chrome title is **Counsellor Waiting List** (sidebar label).
2. Summary cards and status pills: Patients, Pending, Processing, Done, Repeat Counselling, from `tabCounts` (PD-CGX-05 Option A: search and Owner do not change those counts).
3. Filter and action toolbar inside the queue widget.
4. Seven-zone worklist.
5. Client pagination.

Approved common order for other modules: module identity, then an existing summary where one exists, then module state, then existing controls, then the worklist or report, then pagination where the module already pages.

That order is not a column template.

---

## C. Module-by-module current composition

### Finalize Surgery

Route `/dashboard/counsellors-desk/finalize-surgery`. One page, two workspaces. Current order:

1. Content `<h1>` **Surgery Finalization** (`finalize-surgery-page-title`, `staff-page-title`).
2. Summary strip: Scheduled, Awaiting Finalise, Surgery Done (`sessionStatusStrip`).
3. Workspace pills: Surgery Finalization, OT Preparation (`aria-current="page"`).
4. Status tabs: All, Not Confirmed, Confirmed, Finalised, OT Prepared, Cancelled, Surgery Done (`role="tab"`).
5. Date, UHID, and patient-name controls.
6. CSS-grid worklist. Column cues: Patient, Surgery, Status, Schedule, Action. OT Prepared tab adds a selection column.
7. Client pagination footer when the filtered list is not empty.

Loading is a skeleton. Empty copy is “No records found” plus a filter hint. List failure calls `toast.error('Failed to load finalize list')`. There is no in-page error block.

The shell uses `gap-0.5` below 1600px and `gap-2.5` at 1600px and above. Waiting List uses `gap-2.5` at all widths. That difference is the shared compact shell, not a stack defect. Do not retune it to match Waiting List.

Stats use `records` from the date / UHID / name query (`countNeedsAttention` = NotConfirmed or Confirmed). The status tab filters the list and the footer count. It does not recalculate the three summary figures. Date, UHID, and name do change the fetched set, so they change the summary.

### OT Preparation

Same route. When the OT Preparation workspace is active:

1. Content `<h1>` becomes **OT Preparation**.
2. Purpose line: “Prepare Finalised surgeries for OT.”
3. Summary: Finalised (visible filtered rows), Selected (current selection count).
4. The same workspace pills remain above the panel. There is no second status-tab set. The queue is the Finalised preparation list. That is certified, not a missing tab.
5. Separate date, UHID, and name controls, plus Print and Prepare.
6. Worklist with a selection column, then Patient, Surgery, Status, Schedule, Action.
7. Client pagination (`WaitingListQueuePagination`, item label “records”).

Empty state: “No Finalised surgeries”. Selection, Select all visible, one schedule date per Prepare, confirmation dialog, SequenceNo, Reopen, and FSM are present and were not evaluated as change candidates.

### Follow-up Center

Route `/dashboard/counsellors-desk/surgery-followup`. No content `<h1>`. Order:

1. Staff chrome title **Follow-up Center**.
2. Tab-specific stats from `GET /Counseling/followups/stats`.
3. Tabs: Active, Cold Leads, Post-Surgery, with counts (`role="tab"`, `aria-selected`).
4. Search, intention (Active only), Refresh.
5. Population `<h2>`: Active Follow-ups, Cold Leads, or Post-Surgery, plus `{currentTotal} total`.
6. Column cues: Patient, Procedure, Status, Contact, Action (`role="columnheader"`, still 10px uppercase).
7. Rows and server pagination (“Showing x–y of z”).

This matches the approved Follow-up composition. The `<h2>` names the population. It does not repeat the chrome module name.

Search is a debounced `q` sent to the list endpoints. Intention applies only on Active. Tab change clears search. Stats are the filtered population for that tab, not the current page.

### Analytics

Route `/dashboard/counselor/analytics`, body in `CounselorAnalyticsTab.tsx`. No content `<h1>`. Order:

1. Staff chrome title **Analytics**.
2. Toolbar: counselor scope (empty = Authorized Branch, current user = My Work), period 7/14/30, CSV, Print, Refresh.
3. KPI strip from `GET /counseling/analytics/summary`.
4. Funnel, session mix, surgery mix, trends, then PendingDecision aging.
5. Aging table: Patient, Surgery, Phone, Days, Action. Own aging-period pills. Open is a drill-down, not a queue action.

Loading skeletons use `aria-hidden`. Error is an in-page alert with Retry. Toolbar-before-KPI is the deferred order. Section `<h2>` values are report titles, not a second product name.

---

## D. Gap matrix

| Module | Area | Current | Approved direction | Gap? | Classification | Evidence | Future action |
|--------|------|---------|--------------------|------|----------------|----------|---------------|
| Finalize | Stack | Heading, summary, workspace tabs, status tabs, filters, worklist, footer | Same order | No | ALIGNED | `finalize-surgery/page.tsx` header through `finalize-surgery-queue-footer` | None |
| Finalize | Heading vs sidebar “Finalize Surgery” | `<h1>` is Surgery Finalization or OT Preparation | Deferred | Yes, unresolved | DEFERRED PRODUCT DECISION | PD section 7 and section 14 | Do not close in implementation |
| Finalize | Summary labels | Scheduled, Awaiting Finalise, Surgery Done | Keep labels and `countNeedsAttention` | No | CERTIFIED BEHAVIOR — DO NOT CHANGE | `NEEDS_ATTENTION_KPI_LABEL`, `statsBar` | None |
| Finalize | Column cues | `aria-hidden`, hidden below `md` | Readable headers; text in status | Yes, accessibility | PRESENTATION GAP | Cue map near `finalize-surgery-table-viewport`, `aria-hidden` and `max-md:hidden` | Optional later authorization only. Not a stack fix |
| Finalize | List failure | Toast only | In-page error exists on Sessions and Follow-up | Difference recorded | NO ACTION | `toast.error('Failed to load finalize list')` | Do not convert toast behavior in this audit |
| Finalize | Compact gap | `gap-0.5` below 1600px | Do not copy Waiting List `gap-2.5` | No | CERTIFIED BEHAVIOR — DO NOT CHANGE | Shell class on the page root | None |
| OT Preparation | Stack | Workspace heading, purpose, Finalised/Selected, filters, selection, worklist, footer | Existing approved workspace | No | ALIGNED | `finalize-ot-preparation-workspace` | None |
| OT Preparation | FSM, SequenceNo, Prepare, print, packages | Existing handlers and dialogs | Do not change | No | CERTIFIED BEHAVIOR — DO NOT CHANGE | RESP2, Package LA, B Print, C, C-LA-04 deferred | None |
| Follow-up | Stack | Stats, tabs, search/intention/Refresh, population heading, worklist, pager | Same order, already approved | No | ALIGNED | `followup-summary` through `followup-pagination` | None |
| Follow-up | Column-cue type | 10px uppercase, exposed to AT | Restyle not decided | No composition gap | NO ACTION | Cue classes on `followup-column-cues`; PD section 14 | Do not restyle here |
| Follow-up | Population heading plus total | `<h2>` plus `{currentTotal} total` | Population identity, not a second module title | No | ALIGNED | `h2` beside the total | Do not remove |
| Analytics | Stack | Toolbar, KPI, charts, aging | Report, not a queue | No | ALIGNED | `analytics-toolbar` then `analytics-summary` | None |
| Analytics | Toolbar vs KPI order | Toolbar first | Deferred | Yes, unresolved | DEFERRED PRODUCT DECISION | PD section 9 and section 14 | Do not reorder |
| Analytics | Loading region | Skeleton `aria-hidden` | Loading should be announced | Yes, accessibility | PRESENTATION GAP | `data-testid="analytics-loading"` | Optional later authorization. Do not move the toolbar |
| Analytics | Formulas, My Work, drill-down, export, print | Existing | Preserve | No | CERTIFIED BEHAVIOR — DO NOT CHANGE | Summary KPI builder and aging hook | None |
| Waiting List | Whole page | C-01 seven zones | Reference only | No | CERTIFIED BEHAVIOR — DO NOT CHANGE | Not an audit target for change | None |
| Sessions | Partition KPI cards | Not on the page | Not established | No | DATA/API GAP | PD section 10 | Do not invent cards. Not a target of this audit |

---

## E. Header / title matrix

| Module | Staff chrome title | Content heading | Workspace heading | Population / section heading | Class | Duplicate product identity? |
|--------|--------------------|-----------------|-------------------|------------------------------|-------|------------------------------|
| Waiting List | Counsellor Waiting List | None | None | Queue title inside the widget | A via chrome only | No |
| Finalize | Finalize Surgery | `<h1>` Surgery Finalization | Same `<h1>` swaps with the workspace | None | B, and F | Sidebar and `<h1>` differ. **DEFERRED — PRODUCT DECISION REQUIRED** |
| OT Preparation | Finalize Surgery (same route) | `<h1>` OT Preparation | Same | Purpose line is context, not a second module | B, and F | Same deferral |
| Follow-up | Follow-up Center | None | None | `<h2>` Active Follow-ups / Cold Leads / Post-Surgery | C | No. The `<h2>` is the population, not a second “Follow-up Center” |
| Analytics | Analytics | None | None | Widget `<h2>` values: funnel, mixes, trends, PendingDecision Aging | D | No |
| Sessions (accepted, not audited for change) | Counselling Sessions | None after the correction | None | State pills: Counselling Sessions, Reassignment Required | State selector, not a page heading | The pill repeats the chrome words as the default state. That is the accepted correction, not a new finding |

Do not remove the Finalize `<h1>` in order to match Sessions. Discoverability checks expect the heading to change with the workspace.

---

## F. Search / filter matrix

| Module | Controls | Where applied | Paging | Effect on summary |
|--------|----------|---------------|--------|-------------------|
| Waiting List | Search, filters, Owner, date, type | Search and Owner are client filters. Counts come from the fetched population | Client | Counts ignore search and Owner (PD-CGX-05 A) |
| Finalize | Date, UHID, patient name. Status tabs | Date/UHID/name go to `GET /Counseling/ot-schedule`. Status is client-side on that result | Client, resets when scope changes | Summary follows the fetched `records`, not the status tab |
| OT Preparation | Own date, UHID, name | Independent of Finalization filters. Catalog is the Finalised preparation set | Client | Finalised count follows the visible filtered rows. Selected is selection, not a status |
| Follow-up | Search `q`, Active intention, Refresh | `q` is sent to the tab’s list endpoint. Intention only on Active | Server page size already on the page | Stats come from `/followups/stats` for the filtered population, not the page |
| Analytics | Counselor scope, period, aging period, CSV, Print, Refresh | Reporting window and scope on existing analytics endpoints | Aging is not a paged worklist | Every summary figure is the reporting window. Not a queue count |
| Sessions | Not re-audited | Reassignment Required remains the existing URL filter | Server, page size 20, `?page=` | No KPI strip |

No missing search control is recommended. Waiting List search is not a reason to add search elsewhere.

---

## G. Stats / KPI matrix

| Module | Label | Meaning | Source | Approved |
|--------|-------|---------|--------|----------|
| Waiting List | Patients, Pending, Processing, Done, Repeat Counselling | Fetched population after branch, date, and type | `tabCounts` | Yes. Do not change |
| Finalize | Scheduled | Count of fetched schedule rows | `records.length` | Yes |
| Finalize | Awaiting Finalise | NotConfirmed or Confirmed | `countNeedsAttention` | Yes. Do not rename |
| Finalize | Surgery Done | That status in the same fetched set | `records` filter | Yes |
| OT | Finalised | Rows in the current OT prep filter | `otPrepFiltered.length` | Yes |
| OT | Selected | Checked rows | Client selection | Yes. Not a new status |
| Follow-up Active | Active, Never Contacted, Avg Attempts | Active population | `/followups/stats` | Yes |
| Follow-up Cold | Cold Leads, Declined, Referred, Avg Attempts | Cold population. Referred is referred elsewhere | Same DTO | Yes |
| Follow-up Post-Surgery | Post-Surgery, Discharged ≥30 days, Pending Visits, Avg Days | Journey population. ≥30 days is not an SLA | Same DTO | Yes |
| Analytics | Total, Agreed, Declined, Pending, Exception, Other, Eligible, Conversion, Decision, Avg Days, Callbacks | PD13–PD15 window | `/counseling/analytics/summary` | Yes. Do not copy onto Sessions |
| Analytics aging | Pending decision count and buckets | Not the Follow-up intention list | `/counseling/analytics/followup-aging` | Yes |

No new metric is supported by this audit.

---

## H. Grid / column matrix

| Module | Columns | Notes |
|--------|---------|-------|
| Waiting List | Patient, Visit, Procedure/Eye, Owner, Payment/Coverage, Status, Action | C-01. Not a template |
| Finalize | Patient, Surgery, Status, Schedule, Action | OT Prepared tab adds selection for print |
| OT Preparation | Selection, Patient, Surgery, Status, Schedule, Action | Selection is the prepare action, not a data column to remove |
| Follow-up | Patient, Procedure, Status, Contact, Action | No Owner |
| Analytics aging | Patient, Surgery, Phone, Days, Action | Drill-down only |
| Sessions | Patient, Session date, Surgery, Decision, Action | Accepted. Not changed here |

No `CounsellorDataGrid`, resize, reorder, per-column filters, or Columns menu.

---

## I. Cross-module recommendations

**Presentation-only, not authorized**

- Finalize column cues are hidden from assistive technology and hidden below the `md` breakpoint. Follow-up cues are already exposed. A later package could expose the existing Finalize cue text without changing columns, selection, or actions.
- Analytics loading skeleton is `aria-hidden`. A later package could give it a status name without moving the toolbar or the KPI strip.

**Product Decision required, do not implement**

- Finalize / OT content heading versus the sidebar label **Finalize Surgery**.
- Analytics toolbar versus KPI order.

**Data / API, do not invent**

- Sessions partition cards remain without a list-level aggregate. They are outside this audit’s modules.

**Prohibited**

- FSM, SequenceNo, RESP2, package LA / B Print / C, C-LA-04, ownership, ReQueue, Follow-up data sources, Analytics formulas, My Work as a queue, Waiting List C-01, Sessions selector, global header, routes, permissions, APIs, DTOs, and database.

---

## J. Implementation candidates

Not authorized.

### PACKAGE CPG-01

- **Module:** Finalize Surgery and OT Preparation worklists only.
- **Exact presentation issue:** Column cue row is `aria-hidden` and `max-md:hidden`.
- **Existing component to reuse:** The cue text already rendered. Follow-up’s exposed cue pattern (`role="columnheader"`) is the precedent. Do not introduce a table library.
- **Files likely involved:** `finalize-surgery/page.tsx` and its column-cue tests only.
- **Behavior preserved:** Headings, summaries, tabs, filters, selection, Prepare, print, FSM, SequenceNo, RESP2, packages.
- **Tests required:** Cue text remains Patient / Surgery / Status / Schedule / Action; selection column still only where it exists; no heading change.
- **Manual UAT required:** Yes, if a later authorization is written.

### PACKAGE CPG-02

- **Module:** Analytics loading state only.
- **Exact presentation issue:** `analytics-loading` is `aria-hidden`.
- **Existing component to reuse:** The existing skeleton markup.
- **Files likely involved:** `CounselorAnalyticsTab.tsx` and an existing analytics test if one asserts that attribute.
- **Behavior preserved:** Toolbar position, KPI order, formulas, scope, drill-down, export, print.
- **Tests required:** Loading region is not `aria-hidden`; toolbar still precedes the summary in source.
- **Manual UAT required:** Yes, if a later authorization is written.

No other package is justified. Follow-up has no composition package. Heading and toolbar-order work are excluded until a Product Decision closes them.

---

## K. Explicit non-actions

This audit does not authorize:

- Waiting List changes
- Sessions changes
- Finalize behavior changes
- OT FSM changes
- Follow-up behavior changes
- Analytics formula or order changes
- Ownership changes
- API, DTO, or database changes
- New worklists
- A new grid system
- Phase 3I reopening
- Slice 14
- Phase 3J

---

## L. Accessibility and responsive notes

| Check | Finalize / OT | Follow-up | Analytics |
|-------|---------------|-----------|-----------|
| Page heading | Content `<h1>` plus chrome title. Relationship deferred | Chrome title only. Population `<h2>` | Chrome title only. Report `<h2>` values |
| State controls | Workspace `aria-current`. Status `role="tab"` | Tabs `role="tab"` and `aria-selected` | Period and scope are named controls |
| Column cues | Present but `aria-hidden` | Exposed, uppercase | Aging uses `th scope="col"` |
| Focus | Existing `focus-visible` rings on tabs and fields | Same pill and field rings | Same |
| Empty / error | Empty has a message. Load failure is a toast | Empty message. List error is `role="alert"` with Retry. Stats failure says “Stats unavailable” | Error is `role="alert"` with Retry. Loading is hidden from the accessibility tree |
| Responsive | Compact shell. Cues hidden below `md`. Do not drop Status or Action | Columns hide below `sm` by existing rules. Do not drop Status or Action to match a narrower shell | Report stacks. Not a queue |

Responsive result for composition: **pass** for stack. Compact shell spacing is **certified behavior — do not change**. Cue hiding and the hidden Analytics loading region are the presentation notes above.

---

AUDIT COMPLETE — NO IMPLEMENTATION AUTHORIZED.

- production code modified: NO
- tests modified: NO
- API/DTO/DB modified: NO
- permissions modified: NO
- ownership modified: NO
- workflow/FSM modified: NO
- Product Decision created: NO
- Implementation Authorization created: NO
- Manual UAT performed: NO
- Acceptance recorded: NO
