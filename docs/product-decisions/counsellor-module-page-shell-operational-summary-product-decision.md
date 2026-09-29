# Counsellor Module Page Shell & Operational Summary Consistency

| Field | Value |
|-------|--------|
| **Document type** | **GOVERNANCE / PRODUCT DECISION** |
| **Date** | 2026-09-25 |
| **Status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Implementation Authorization** | **NOT CREATED** |
| **Production code, UI, API, DTO, database, permissions, ownership, routes, workflow / FSM** | **NOT MODIFIED** |
| **Waiting List / C-01** | **REFERENCE ONLY. NOT AN IMPLEMENTATION TARGET. NOT REOPENED** |
| **Hospital Portal global header** | **OUT OF SCOPE** |
| **CGX-1** | Implementation and automated tests are complete. Manual UAT is still pending. Acceptance is **not** recorded. This decision does **not** modify CGX-1. |

This file is not acceptance of CGX-1 and does not authorize a build.

Approved with explicit deferral of:

1. Sessions content-title versus staff-chrome relationship.
2. Finalize workspace heading versus module-title relationship.

Neither deferred item is solved. This Product Decision records approved design direction only. It does not authorize implementation.

---

## 1. Governance status

**APPROVED — PRODUCT DECISION RECORDED**

Approved with explicit deferral of:

1. Sessions content-title versus staff-chrome relationship (**SESSIONS CONTENT TITLE TREATMENT — DEFERRED**).
2. Finalize workspace heading versus module-title relationship (**FINALIZE WORKSPACE HEADING TREATMENT — DEFERRED**).

The remaining decisions in this document are approved. The two title items stay open. They are not represented as solved.

This Product Decision records approved design direction only. It does not authorize implementation.

**Implementation Authorization has NOT been created.**

---

## 2. Background

The accepted Counsellor Waiting List is the visual reference for page composition. Its **page content** today is:

1. Operational summary cards and status tabs (`WaitingListSummaryWidget`)
2. Filter and action bar inside the queue widget
3. Worklist
4. Pagination

The Waiting List page component does **not** render its own `<h1>`. The visible name **Counsellor Waiting List** is the staff chrome title from the sidebar label (`resolveStaffPageTitle` → `TopNav`, `data-testid="app-topnav-title"`). This decision does not add an in-page Waiting List title and does not change that chrome.

Current content hierarchy on the other four surfaces, from the code as of this review:

| Surface | In-content title | Summary | State / navigation | Controls | Worklist or report |
|---------|------------------|---------|--------------------|----------|--------------------|
| Sessions | `<h1>` **Counselling Sessions**, then `{n} sessions`, then a back control in the same row | None | Reassignment Required pill | Drill-down chips only. No Clear, no Refresh | Patient, Session date, Surgery, Decision, Action. Server page size 20 |
| Finalize Surgery | `<h1>` swaps between **Surgery Finalization** and **OT Preparation** | Scheduled, Awaiting Finalise, Surgery Done. OT workspace: Finalised, Selected | Workspace tabs, then status tabs | Date, UHID, patient name | Patient, Surgery, Status, Schedule, Action |
| Follow-up Center | No in-content module `<h1>`. Worklist `<h2>` is Active Follow-ups, Cold Leads, or Post-Surgery | Stats strip for the active tab | Active, Cold Leads, Post-Surgery | Search, intention (Active only), Refresh | Patient, Procedure, Status, Contact, Action |
| Analytics | No in-content module `<h1>` | Existing summary strip from `CounselingAnalyticsSummaryDto` | Period pills and counselor scope in the toolbar, which sits **above** the KPI strip in the current component | CSV, Print, Refresh | Funnel, mixes, trends, aging table. Not a queue |

**Discrepancy with the requested “page title first” picture.** Waiting List content starts at the summary. The title the operator sees for that page is the chrome title. Sessions now has both that chrome `<h1>` (**Counselling Sessions**) and a second content `<h1>` with the same words, plus the result count. Finalize’s content `<h1>` does not match the sidebar label **Finalize Surgery**; it names the active workspace, and the workspace tab repeats **Surgery Finalization**.

This decision does not fix those by editing chrome or by overriding the Finalize discoverability title swap. Both title questions are **deferred** in section 14. The rest of this decision is approved subject to those deferrals.

---

## 3. Scope

**In scope for this decision only**

- Counselling Sessions (`/dashboard/counsellors-desk/sessions`)
- Finalize Surgery, including the existing OT Preparation workspace on the same route (`/dashboard/counsellors-desk/finalize-surgery`)
- Follow-up Center (`/dashboard/counsellors-desk/surgery-followup`)
- Analytics (`/dashboard/counselor/analytics`)

**Out of scope**

- Hospital Portal global header, TopNav, notifications, profile, logout, sidebar, and global navigation
- Any Waiting List implementation change, including adding a content title
- Reopening Phase 3I, C-01, Package LA, Package B Print, or Package C
- C-LA-04
- Ownership redesign, `CounselorId` changes, new worklists
- API, DTO, or database changes
- A universal grid or identical columns
- Retroactive edits to CGX-1

---

## 4. Reference pattern

**Approved.** This is a **common page-composition pattern**, not a universal grid.

Approved order inside the Counsellor module content area:

1. Page title / module identity
2. Existing authoritative summary, where one already exists
3. State / navigation
4. Existing controls
5. Worklist or report
6. Pagination or result range, where that module already pages

This is **not** a universal grid, identical columns, identical KPIs, identical filters, or identical workflows.

Waiting List is the density and stacking reference: summary and tabs, then controls, then the worklist, then the range. It is not a column template.

Do not create identical column sets. Do not create `CounsellorDataGrid`. Do not force the same KPIs. Do not force the same filters.

The composition rule does not close the deferred title items. How the Sessions content title relates to the staff chrome, and whether Finalize keeps workspace-specific headings, stay deferred in section 14.

---

## 5. Design principle

**Counsellor Waiting List establishes the common visual hierarchy and page-shell pattern. Each other Counsellor module adopts that hierarchy while preserving its own certified information architecture, workflow, metrics, data source, actions, and operational meaning.**

**Approved.**

**Common:** visual hierarchy, spacing, density, readable headers, summary placement where an authoritative summary already exists, navigation placement, control placement, worklist or report placement, empty / loading / error structure, accessibility.

**Module-specific:** KPIs, tabs, filters, columns, actions, formulas, workflow, data source, ownership, state meaning, reporting scope.

**Waiting List visual hierarchy is not operational worklist behavior.** Analytics may share stacking and type. It does not become a queue.

---

## 6. Sessions decision

### Title hierarchy — DEFERRED

**SESSIONS CONTENT TITLE TREATMENT — DEFERRED**

Observation, unchanged: the staff chrome renders the Counselling Sessions title, and the Sessions content also renders Counselling Sessions. That is duplicated visible heading treatment. The content row also shows the back control and `{totalCount} sessions`.

Sessions title duplication is acknowledged as a presentation concern. The staff chrome is outside this Product Decision, so the final relationship between chrome title and content title is deferred to a future bounded presentation decision. No CGX-1 modification is authorized by this decision.

This decision does not authorize removal of the staff chrome title, modification of TopNav, removal of the Sessions content title, or any route change.

### Result count

`{totalCount} sessions` is `SessionListResponse` total for the current server filters. The pagination footer already states the same total as a range (`Showing x–y of z sessions`).

**Approved:** this number **remains a result count**. It is not promoted into a KPI card and not given a new formula. A later presentation package may keep it only in the pagination zone so it is not read as a summary metric. That placement is not authorized here. Page size **20**, server paging, and `?page=` stay.

### Summary / KPI

**Approved: no Sessions KPI strip.**

The list payload does not provide partition counts. Analytics summary counts (Pending, Agreed, Declined, and the PD13–PD15 figures) are a **different population** (reporting window, branch, counselor scope). Copying those labels onto Sessions would invent an operational meaning.

| Proposed card | Decision |
|---------------|----------|
| Total Sessions as a card | Not a new metric. Same as the result count above |
| Pending, Agreed, Declined, In Progress as Sessions cards | **DATA SOURCE / METRIC DEFINITION NOT ESTABLISHED — FUTURE PRODUCT DECISION REQUIRED.** Not on the list response as a strip |
| Reassignment Required as a count card | The control is an existing filter. A count card is **not** on the current list UI. Do not invent one here |

### State, controls, worklist

- State control remains the Reassignment Required pill. Semantics unchanged.
- No new filters, no Clear, no Refresh, unless a later decision says so. Drill-down chips stay.
- Worklist columns stay: Patient (name, MRN when present), Session date, Surgery (procedure, eye when present), Decision, Action.
- Open stays primary. Reassign stays contextual. Ownership unchanged. No permanent Owner column.

---

## 7. Finalize Surgery decision

### Titles — DEFERRED

**FINALIZE WORKSPACE HEADING TREATMENT — DEFERRED**

Current content `<h1>` (`data-testid="finalize-surgery-page-title"`) stays **Surgery Finalization** or **OT Preparation**, depending on the active workspace. The workspace tab also says **Surgery Finalization**. The sidebar label is **Finalize Surgery**.

Finalize workspace heading treatment remains deferred because existing discoverability checks expect workspace-specific identification. Existing Surgery Finalization / OT Preparation heading behavior remains unchanged. Any future title change requires a separate Product Decision that explicitly evaluates the discoverability impact.

This decision does not collapse those headings into one static **Finalize Surgery** heading, one universal heading, or another competing heading. It does not change discoverability behavior. It does not reopen RESP2, Package LA, Package B Print, or Package C.

OT Preparation remains a workspace on this route, not a second worklist. The purpose line “Prepare Finalised surgeries for OT.” stays workspace context, not a new module.

### Summary

**Approved:** keep the summaries that already exist. Do not add cards. Do not rename **Awaiting Finalise** to Needs Attention in this decision. Existing predicates, labels, FSM, RESP2, SequenceNo, and workspace behavior stay.

| Workspace | Existing figures | Source |
|-----------|------------------|--------|
| Surgery Finalization | Scheduled, **Awaiting Finalise**, Surgery Done | In-memory list for the current date / UHID / name query. Awaiting Finalise is `countNeedsAttention`: status **NotConfirmed** or **Confirmed** (`NEEDS_ATTENTION_KPI_LABEL`, PD-FS-01). The shipped label is **Awaiting Finalise**, not “Needs Attention” |
| OT Preparation | Finalised, Selected | Visible Finalised rows and the current selection |

Do not rename Awaiting Finalise in this decision. Do not add KPIs whose predicate is not already this helper.

### Controls and worklist

Status tabs, schedule date, UHID, and patient name stay. Columns stay Patient, Surgery, Status, Schedule, Action, plus the existing selection column only where it is already authorized.

**Protected:** FSM, `FinalizeOtModal`, SequenceNo, cancel, Reopen, RESP2, ownership, permissions, Package LA, Package B Print, Package C.

---

## 8. Follow-up decision

**Approved: the current composition is the reference-aligned pattern for this module.**

It already stacks a tab-specific stats strip, population tabs, search and intention controls, then the worklist and server pagination. No new columns, filters, endpoints, or owner concept.

The content area has no module `<h1>`. The chrome title is **Follow-up Center**. The worklist `<h2>` (Active Follow-ups, Cold Leads, Post-Surgery) names the active population, not a second product. This decision does not add a content `<h1>` that would repeat the chrome name, and it does not remove the `<h2>`.

Bounded visual spacing or header type may be proposed later. It is not required to change the information architecture, and it is not authorized here.

**Preserve:** Active, Cold Leads, Post-Surgery; three data sources; historical counsellor attribution (not ACL); ReQueue; existing actions; no My Follow-ups; no current-owner inference; no invented Post-Surgery counsellor; no SLA or priority chrome.

---

## 9. Analytics decision

Analytics stays a **reporting** surface. Waiting List stacking does not import queue behavior.

**Approved:** keep the existing KPI strip, formulas, populations, period control, counselor scope (Authorized Branch, My Work as reporting scope, peer counselor), funnel, mixes, trends, aging table, drill-downs, export, and print.

**Deferred:** the visual toolbar-versus-KPI ordering. Current code puts the toolbar **above** the KPI strip. That order differs from Waiting List (summary, then filters). Reorder is not authorized unless a later decision authorizes it separately. Recording the difference is not permission to edit it now.

**Do not add:** operational Owner, Assign, Reassign, row selection, a My Work queue, or a new patient worklist.

---

## 10. KPI / metric source matrix

Values below are the metrics **already shown**. None are new.

| Module | Metric | Meaning | Existing source | API/DTO change | Decision |
|--------|--------|---------|-----------------|----------------|----------|
| Waiting List (reference only) | Patients, Pending, Processing, Done, Repeat Counselling | Fetched population after branch, date, and type. Not search, not Owner, not the current page (PD-CGX-05 Option A) | `tabCounts` on `GET /Counseling/waiting-list` plus the OT Returned projection for that tab | No | **Do not change.** Not a target of this decision |
| Sessions | `{n} sessions` | Server total for the current list filters | `SessionListResponse.totalCount` | No | **Result count only.** Not a new KPI strip |
| Sessions | Pending / Agreed / Declined / In Progress cards | Not defined for this page | List DTO has decision flags per row, not a summary. Analytics summary is a different scope | Would be a new aggregate | **DATA SOURCE / METRIC DEFINITION NOT ESTABLISHED — FUTURE PRODUCT DECISION REQUIRED** |
| Sessions | Reassignment Required count | Filter, not a card | `reassignmentRequired` query | No card exists | **Do not invent a card** |
| Finalize | Scheduled | Count in the current fetched schedule set used by the page stats | `GET /Counseling/ot-schedule` list, client summary | No | **Keep.** Presentation placement only, if ever authorized |
| Finalize | Awaiting Finalise | NotConfirmed + Confirmed | `countNeedsAttention` / PD-FS-01 | No | **Keep the predicate and the label** |
| Finalize | Surgery Done | Count of that status in the same summary set | Same list | No | **Keep** |
| Finalize OT workspace | Finalised, Selected | Rows in the OT prep list, and how many are selected | Same list plus client selection | No | **Keep.** Selected is a UI selection count, not a new status |
| Follow-up Active | Active, Never Contacted, Avg Attempts | Filtered Active population, not the current page | `GET /Counseling/followups/stats` | No | **Keep** |
| Follow-up Cold | Cold Leads, Declined, Referred, Avg Attempts | Filtered Cold population | Same stats DTO | No | **Keep.** “Referred” is the existing short label for referred elsewhere |
| Follow-up Post-Surgery | Post-Surgery, Discharged ≥30 days, Pending Visits, Avg Days | Journey population. ≥30 days is factual aging, not an SLA | Same stats DTO | No | **Keep** |
| Analytics | Total, Agreed, Declined, Pending, Exception, Other, Eligible, Conversion, Decision, Avg Days, Callbacks | PD13–PD15 reporting window for the selected branch and counselor scope | `GET /counseling/analytics/summary` | No | **Keep formulas and populations** |
| Analytics | Aging buckets | Pending-decision age buckets. Not the Follow-up intention list | `GET /counseling/analytics/followup-aging` | No | **Keep.** Not a worklist |

---

## 11. Cross-module interaction conventions

These apply only when a future authorization implements them. They are not a build order.

- **Title:** module identity stays in the content hierarchy. The Sessions chrome-versus-content relationship and the Finalize workspace heading are deferred (section 14). Chrome and TopNav stay out of scope. Do not add a further competing heading.
- **Summary:** only the metrics in section 10 that already exist. Same visual strip pattern as today’s counselling stats (`sessionStatusStrip`), not a new card system. Waiting List’s five bordered cards stay unique to Waiting List (C-01). Do not copy that card chrome onto Sessions by inventing numbers.
- **Tabs:** existing pill or journey tabs. Do not merge tab meanings.
- **Controls:** existing controls only. Align spacing. Do not add a shared filter builder.
- **Headers:** readable title-case, as CGX-1 did for Sessions and the aging table. Do not reopen Follow-up uppercase cues unless a later authorization bounds typography only.
- **Empty, loading, error:** one primary line and one recovery hint, module nouns kept.
- **Responsive:** desktop-first. Do not hide status or the primary action to match a narrower shell.
- **Accessibility:** text in status, visible focus, named controls. No drag-only column tools (PD-CGX-04).

---

## 12. Module-specific information architecture

| Module | Columns / body | Actions |
|--------|----------------|---------|
| Waiting List (unchanged reference) | Patient, Visit, Procedure / Eye, Owner, Payment / Coverage, Status, Action | Existing lifecycle actions |
| Sessions | Patient, Session date, Surgery, Decision, Action | Open; Reassign only when Reassignment Required applies |
| Follow-up | Patient, Procedure, Status, Contact, Action | Existing contact, reminder, history, Re-queue, open session rules |
| Finalize | Patient, Surgery, Status, Schedule, Action | Existing FSM and print actions |
| Analytics | Reporting charts and the aging table (Patient, Surgery, Phone, Days, Action) | Drill-down Open only. Not Assign or Reassign |

PD-CGX-01 remains: **one interaction model, five information architectures.**

---

## 13. Protected certified behavior

- Phase 3I is closed. Slice 14 does not exist. Phase 3J does not exist.
- C-01 is accepted and closed. The seven-zone Waiting List is unchanged. PD-CGX-05 Option A (counts ignore search and Owner) is unchanged.
- Shared Waiting List. Viewing or opening does not claim. `CounselorId` semantics unchanged.
- Follow-up historical counsellor is not ACL. ReQueue unchanged. No My Follow-ups.
- Analytics My Work is reporting scope, not a queue. PD13–PD15 unchanged. Drill-downs unchanged.
- Finalize stays shared. RESP2, FSM, and SequenceNo unchanged. No second OT Prepared worklist.
- Package LA, Package B Print, and Package C stay closed.
- C-LA-04 stays deferred.
- CGX-1: implementation complete, automated tests complete, Manual UAT pending, acceptance not recorded. This decision does not modify that package.

---

## 14. Explicit Deferrals / Non-Decisions

The following are **not solved**.

| Item | Status |
|------|--------|
| Sessions content-title versus staff chrome | **DEFERRED.** SESSIONS CONTENT TITLE TREATMENT — DEFERRED. Duplication is acknowledged. Chrome and TopNav are out of scope. Do not remove either title. No CGX-1 change. Future bounded presentation decision only |
| Finalize workspace heading versus static module title | **DEFERRED.** FINALIZE WORKSPACE HEADING TREATMENT — DEFERRED. Keep **Surgery Finalization** / **OT Preparation**. Discoverability behavior unchanged. A future title change needs a separate Product Decision that evaluates discoverability impact |
| Analytics toolbar versus KPI visual order | **DEFERRED** unless separately authorized |
| Sessions Pending / Agreed / Declined / In Progress KPI cards | **DATA SOURCE / METRIC DEFINITION NOT ESTABLISHED — FUTURE PRODUCT DECISION REQUIRED** |
| Reassignment Required count card | Not an existing metric. Do not invent one |
| New Finalize KPIs beyond Scheduled, Awaiting Finalise, Surgery Done, and the OT Finalised / Selected pair | Not established |
| Renaming Awaiting Finalise to “Needs Attention” | Not decided. Shipped label stays **Awaiting Finalise** |
| Follow-up cue typography | CGX-1 exposed the cues. Restyling is not decided |
| New search models, column filters, Columns menu, resize, reorder | PD-CGX-04 still excludes them |
| New operational worklists | Not allowed |
| Global header standardization | Out of scope. Separate future decision |

---

## 15. Implementation boundary

This Product Decision records approved design direction only. It does not authorize implementation.

**Implementation Authorization has NOT been created.**

Future implementation requires a separate bounded Implementation Authorization.

No production file was modified by writing this artifact. UI, API, DTO, database, permissions, ownership, routes, workflow, and FSM are unchanged. CGX-1 is unchanged.

---

## 16. Future implementation packages

Proposed only. **Not authorized.**

| Id | Would cover, after a later approval | Must not include |
|----|-------------------------------------|------------------|
| Shell presentation package | Content-area spacing using the approved hierarchy, excluding the deferred title items | Waiting List, TopNav, Sessions title removal, new KPIs, API, CGX-1 edits |
| Sessions title package | Only after a later decision closes SESSIONS CONTENT TITLE TREATMENT | TopNav, chrome removal, CGX-1 edits until that decision exists |
| Finalize heading package | Only after a later decision closes FINALIZE WORKSPACE HEADING TREATMENT and evaluates discoverability | FSM, SequenceNo, RESP2, packages LA / B / C, a static heading before that decision |
| Analytics stack package | Place the **existing** KPI strip and **existing** controls in reference order, only if that reorder is later authorized | Formula, scope, drill-down, queue behavior |

CGX-1 Manual UAT stays on its own track. These packages do not replace it.

---

## 17. Manual UAT / acceptance

- This Product Decision is not acceptance of any screen.
- CGX-1 Manual UAT remains separate and is still pending.
- Any future implementation needs automated tests and Manual UAT.
- Acceptance needs a later explicit governance artifact.

### UAT observation recorded (not an authorization)

CGX-1 is functioning: Sessions MRN and eye, Follow-up cue exposure, and Analytics aging header type are present.

The visual review also found a page-composition gap: Waiting List stacks summary, tabs, controls, and the worklist. Sessions repeats its heading; that relationship is deferred and no operational summary is added. Finalize workspace headings stay as they are; that heading treatment is deferred. Follow-up already follows the composition closely and that composition is approved. Analytics keeps the same stacking discipline and remains a report. The global header is not part of this concern.

This observation does **not** authorize a change to CGX-1.

---

## 18. Next governance gate

The two title items are deferred, and the remaining decisions are approved. The next gate is a **separate bounded Implementation Authorization review**. It has not been created.

That review, if opened, may cover only the approved composition direction: existing summaries, existing controls, existing worklists and reports, and the metric locks in section 10. It must exclude:

- Sessions content-title versus staff chrome
- Finalize workspace heading versus a static module title
- Analytics toolbar-versus-KPI reorder, unless that deferral is closed first
- Unsupported Sessions partition metrics
- TopNav and the global header
- Waiting List, C-01, CGX-1 modification, ownership, FSM, and API or DTO changes

CGX-1 Manual UAT remains a separate gate and is still pending. Acceptance of CGX-1 is not recorded here.

**STOP.**
