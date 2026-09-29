# Counsellor Cross-Module Visual and Interaction Standard

| Field | Value |
|-------|--------|
| **Document type** | GOVERNANCE / PRODUCT DECISION |
| **Status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Approval date** | **2026-09-25** |
| **Product Decision** | **Approved** |
| **Implementation Authorization** | **NOT CREATED** |
| **Production implementation** | **NONE AUTHORIZED** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |
| **Date** | 2026-09-25 |
| **Decision IDs** | CGVS-01 through CGVS-16 |
| **Principle** | One Counsellor visual and interaction standard, plus module-specific information architecture |

The Product Owner approved this Product Decision on 2026-09-25.

Product Decision approval is not implementation approval. This document does not authorize production implementation.

- **Already approved / certified** means a prior Product Decision or closed package already recorded the behavior. This approval does not re-decide it.
- **Approved product direction** means the standard recorded in this file. It is approved as product direction only. It does not authorize code, tests, or UAT.

---

## 1. Purpose

Define a consistent healthcare operational visual and interaction standard across Counsellor surfaces, using the accepted Waiting List and the accepted Counselling Sessions presentation as references.

The standard is not “make every page identical.”

It is:

**one visual and interaction standard + each module’s own information architecture, data, workflow, and operational meaning.**

Use the existing Hospital Portal design system and existing Counsellor tokens, pills, buttons, widgets, and dialogs.

Do not introduce a new design system, UI framework, grid component, card system, typography system, theme, page framework, universal filter builder, universal worklist, or universal KPI model.

---

## 2. Sources

| Source | How this approval uses it |
|--------|------------------------|
| `docs/audits/counsellor-cross-module-page-composition-visual-gap-audit.md` (2026-09-25) | Current-state findings for Finalize, OT Preparation, Follow-up, and Analytics. Waiting List is the reference. The external paste named `Pasted markdown(20260925-165002).md` is not in this workspace. The audit file above is the matching artifact used here |
| `docs/product-decisions/counsellor-module-page-shell-operational-summary-product-decision.md` | Already approved composition baseline. Deferred heading and toolbar items stay deferred |
| `docs/product-decisions/counsellor-cross-module-grid-and-filter-ux-product-decision.md` | Already approved PD-CGX-01 through PD-CGX-06, including PD-CGX-04 and PD-CGX-05 Option A |
| CGX-1 authorization and report, plus the later Sessions header correction report | Accepted Sessions presentation is locked. This approval does not reopen it |
| Finalize / OT decisions through the closed packages | FSM, SequenceNo, Prepare, Reopen, Cancel, RESP2, Package LA, Package B Print, Package C stay certified. C-LA-04 stays deferred |

The audit found Finalize, OT Preparation, Follow-up, and Analytics already aligned with the approved stack. It did not find a composition defect that this approval turns into a required build. Observations about column cues and the Analytics loading region stay observations.

---

## 3. Waiting List is the reference — not a redesign target

**Already approved / certified.** C-01 remains accepted and closed.

Waiting List shows, today:

- Staff chrome title **Counsellor Waiting List**. No second in-page product title.
- Summary cards and status controls: Patients, Pending, Processing, Done, Repeat Counselling. Counts follow PD-CGX-05 Option A.
- Existing filter and action toolbar.
- Seven-zone worklist: Patient, Visit, Procedure/Eye, Owner, Payment/Coverage, Status, Action.
- Client pagination.
- Compact operational density and the existing visual language.

This approval uses that page as a benchmark for hierarchy, density, and task focus.

It does not copy the five bordered cards onto modules that lack those metrics. It does not copy the seven columns. It does not change Waiting List stats, filters, actions, ownership presentation, or pagination.

**CGVS-13** restates this protection.

---

## 4. CGVS-01 — Common visual language

**Approved product direction.** Implementation is not authorized.

Reuse existing tokens, spacing, button variants, pill and tab primitives, typography, borders, surfaces, focus rings, responsive patterns, dialogs, and the loading, empty, and error patterns a module already uses.

Visual consistency does not require identical markup, identical DOM, or a new shared component when a module already uses a valid structure.

**Exclusions:** new libraries, a universal Counsellor component, and any change to metric or workflow meaning.

**Preserved:** stack freeze and existing `counsellingSessionTokens`.

**Implementation authorization:** required before any code change. Not created.

---

## 5. CGVS-02 — Page and header hierarchy

**Already approved composition, restated.** This approval does not close deferred titles.

Target order, where the module already has each zone:

1. Module identity
2. Existing authoritative summary, where one exists
3. Module state or navigation
4. Existing controls
5. Worklist or report
6. Pagination where the module already pages

This is a compositional standard, not a DOM template. Staff chrome and global navigation are out of scope.

Avoid a second product title in the content area when chrome already names the module. Do not remove a heading that a deferred decision still owns.

**Deferred, not decided here:**

- **FINALIZE WORKSPACE HEADING TREATMENT.** Do not choose among **Finalize Surgery**, **Surgery Finalization**, and **OT Preparation**. The content heading still swaps between **Surgery Finalization** and **OT Preparation**. Discoverability of that swap stays as it is.
- **Sessions content title treatment** remains listed as deferred in the page-shell Product Decision. Separately, the accepted Sessions correction is locked: chrome title, then **Counselling Sessions** / **Reassignment Required**, then the worklist. No content `<h1>`, no back control in that block, no content-level count heading, no standalone Reassignment Required band. This approval does not reopen that page and does not close the older deferral by rewriting it.

**Implementation authorization:** required. Not created. A future authorization must not edit the deferred Finalize headings or the accepted Sessions page.

---

## 6. CGVS-03 — Summary and statistics

**Approved product direction for presentation only.** Implementation is not authorized. Metric definitions are already certified.

Show an existing authoritative metric with the summary treatment that module already uses. Do not invent numbers so pages look symmetrical. Do not replace Waiting List’s five cards with Finalize’s strip, or the reverse.

| Module | Existing figures | Source | This approval |
|--------|------------------|--------|------------|
| Waiting List | Patients, Pending, Processing, Done, Repeat Counselling | `tabCounts` after branch, date, and type. Not search, not Owner | Already approved. Do not change |
| Finalize | Scheduled, Awaiting Finalise, Surgery Done | Fetched schedule rows. Awaiting Finalise is NotConfirmed or Confirmed | Keep labels and predicates |
| OT Preparation | Finalised, Selected | Visible Finalised rows, and the current selection | Selected is a selection count, not a new status |
| Follow-up | Tab-specific stats | `GET /Counseling/followups/stats` | Keep Active, Cold, and Post-Surgery figures |
| Analytics | Existing reporting KPIs | `GET /counseling/analytics/summary` | Keep formulas, populations, period, and scope |
| Sessions | No KPI strip | List total is a result count in the pagination footer | Do not add Pending, Agreed, Declined, In Progress, or a Reassignment Required card |

The visual treatment of an existing statistic may be aligned later. Formulas, populations, APIs, scopes, count rules, periods, and filter effects must not change unless a separate Product Decision says so.

**Data gap, not a visual fill:** Sessions partition cards. **OUT OF SCOPE / SEPARATE PRODUCT DECISION REQUIRED.**

---

## 7. CGVS-04 — State and tab controls

**Approved product direction.** Implementation is not authorized. Similar meaning should use the existing pill or tab pattern. Different meaning stays visually and behaviorally distinct.

Use existing pill controls, journey or workspace tabs, `role="tab"` where the control is already a tab, and `aria-selected` or `aria-current` where the control already uses them. Do not merge states. Do not turn an operational condition into a lifecycle status. Do not create one Counsellor tab model.

| Module | Controls that stay as they are | Meaning |
|--------|--------------------------------|---------|
| Finalize | Workspace pills, then status tabs | Workspace is not a status. Status is the certified FSM list |
| OT Preparation | Workspace selection. No second status-tab set | Finalised preparation queue |
| Follow-up | Active, Cold Leads, Post-Surgery | Three populations, three data sources |
| Sessions | Counselling Sessions / Reassignment Required | Accepted selector. Reassignment Required is the existing filter, not a new lifecycle status |
| Waiting List | C-01 status and type controls | Do not restyle into Finalize’s workspace tabs |
| Analytics | Counselor scope and period | Reporting scope, not a queue |

**Implementation authorization:** required before any visual alignment. Not created.

---

## 8. CGVS-05 — Buttons and action hierarchy

**Approved product direction.** Implementation is not authorized.

Using existing button variants, a primary action should be distinguishable from a secondary, tertiary, contextual, or destructive action.

Do not change an action’s meaning or label for visual consistency. Do not add actions. Do not move an action when the move changes workflow. Do not create Assign, Reassign, or ReQueue behavior. Do not create a personal worklist or an ownership mutation.

| Surface | Protected actions |
|---------|-------------------|
| Finalize / OT | Existing FSM actions, Prepare, Reopen, Cancel, Print |
| Sessions | Open. Reassign only under existing Reassignment Required rules |
| Follow-up | Existing contact, reminder, history, ReQueue, and open-session actions |
| Analytics | Open is drill-down, not a queue mutation |
| Waiting List | C-01 actions |

**Implementation authorization:** required. Not created.

---

## 9. CGVS-06 — Search, filter, and toolbars

**Approved product direction for visual treatment of controls that already exist.** Implementation is not authorized.

Where a module already has search, date, identifier, name, scope, period, intention, refresh, export, or print, that control may share the existing Hospital Portal field and button pattern.

Do not add a control because another module has one. Do not build a universal filter.

| Module | Existing controls |
|--------|-------------------|
| Finalize | Date, UHID, patient name |
| OT Preparation | Date, UHID, patient name, Print, Prepare |
| Follow-up | Search, intention on Active, Refresh |
| Analytics | Counselor scope, period, CSV, Print, Refresh |
| Sessions | Accepted state selector and existing drill-down chips. No Clear. No Refresh added by this approval |
| Waiting List | C-01 toolbar |

Visual consistency is not behavioral consistency. Do not change query meaning, paging, server versus client filtering, count rules, or API contracts.

**Implementation authorization:** required. Not created.

---

## 10. CGVS-07 — Worklist, grid, and list presentation

**Already approved principle, restated: one interaction standard, not one universal grid** (PD-CGX-01, PD-CGX-04).

Columns stay module-specific:

| Module | Columns |
|--------|---------|
| Waiting List | Patient, Visit, Procedure/Eye, Owner, Payment/Coverage, Status, Action |
| Sessions | Patient, Session date, Surgery, Decision, Action |
| Follow-up | Patient, Procedure, Status, Contact, Action |
| Finalize | Patient, Surgery, Status, Schedule, Action |
| OT Preparation | Selection, Patient, Surgery, Status, Schedule, Action |
| Analytics aging | Patient, Surgery, Phone, Days, Action |

**Approved product direction for presentation expectations,** without adding or removing columns: readable headers, clear row hierarchy, predictable action placement, readable status text, consistent alignment, usable targets, visible focus, and responsive overflow that does not drop clinical or operational fields in order to fit a narrow width. Implementation is not authorized.

Do not add column resize, drag reorder, per-column filters, or a Columns menu. PD-CGX-04 still excludes them.

**Implementation authorization:** required. Not created.

---

## 11. CGVS-08 — Loading, empty, and error

**Approved product direction.** Implementation is not authorized. Do not force one mechanism.

- **Loading:** existing skeleton or loading text, structure preserved, no fake rows that look like results, accessible status where the module already exposes one.
- **Empty:** a short module-specific message and a short hint where the page already has one.
- **Error:** a clear failure, a short explanation, and Retry only where Retry already exists.

Recorded current behavior, not a mandate to unify it:

| Module | Current recovery | This approval |
|--------|------------------|------------|
| Finalize | List failure uses the existing toast. Empty state is in the worklist | Do not replace the toast from this document |
| Analytics | In-page alert and Retry. Loading skeleton is `aria-hidden` | Keep the alert. The skeleton observation is not an authorized fix |
| Sessions | Existing loading, empty, and error copy | Do not reopen |
| Follow-up | Population empty copy. List error with Retry. Stats line “Stats unavailable” | Keep |

Changing Finalize’s toast into an in-page error is **OUT OF SCOPE / SEPARATE PRODUCT DECISION REQUIRED** if it changes recovery behavior. It is not authorized here.

---

## 12. CGVS-09 — Pagination

**Approved product direction: shared visual treatment only.** Implementation is not authorized. Paging contracts stay certified.

| Module | Contract that stays |
|--------|---------------------|
| Waiting List | Client pagination |
| Sessions | Server pagination, page size 20, `?page=`, reset and clamp |
| Finalize | Client pagination |
| OT Preparation | Client pagination |
| Follow-up | Server pagination |
| Analytics aging | A report table, not a paged operational queue |

Do not change page size, server versus client paging, URL state, reset, or clamping unless a separate authorization says so.

---

## 13. CGVS-10 — Responsive behavior

**Approved product direction.** Implementation is not authorized.

Desktop-first. Keep status and the primary action available. Use existing stacking and overflow. Do not hide clinical or operational fields to fit a narrow width.

The audit recorded that compact shell spacing is not automatically a defect. Do not change `gap-0.5` or `gap-2.5` only to make every page use the same number. Waiting List spacing is not a universal requirement.

**Implementation authorization:** required. Not created.

---

## 14. CGVS-11 — Accessibility

**Approved product direction.** Implementation is not authorized. Minimum expectations, not an authorization to edit:

- State and tab controls keep the semantics they already have.
- `aria-selected` and `aria-current` stay where they already apply.
- Icon buttons stay named.
- Focus stays visible.
- Status is text, not color alone.
- Tables and lists keep the structure they already have.
- Loading and error states that are already exposed stay exposed.
- No drag-only interaction.
- No action that exists only as an unlabeled icon.

Observations from the audit, still **not authorized:**

| Observation | Classification |
|-------------|----------------|
| Finalize column cues are `aria-hidden` and hidden below `md` | Presentation candidate only |
| Analytics loading skeleton is `aria-hidden` | Presentation candidate only |
| Follow-up cues already use `role="columnheader"` | Certified exposure. Do not restyle the 10px uppercase cues in this approval |

---

## 15. CGVS-12 — Module-specific information architecture

The standard does not erase these differences.

| Module | Identity | Summary | State | Controls | Worklist or report | Pagination | Protected behavior |
|--------|----------|---------|-------|----------|--------------------|------------|--------------------|
| Waiting List | Chrome title only | Five C-01 cards | C-01 status and type | C-01 toolbar | Seven zones | Client | Shared queue. Open does not claim |
| Sessions | Chrome title. Accepted state pills. No content page heading | None | Counselling Sessions / Reassignment Required | Existing drill-down chips | Patient, Session date, Surgery, Decision, Action | Server, size 20 | Reassign only when the existing rule applies |
| Finalize | Deferred workspace `<h1>` | Scheduled, Awaiting Finalise, Surgery Done | Workspace pills, then status tabs | Date, UHID, name | Patient, Surgery, Status, Schedule, Action | Client | FSM, modal, print selection rules |
| OT Preparation | Same deferred `<h1>` swap, plus purpose line | Finalised, Selected | Workspace pills. No extra status tabs | Date, UHID, name, Print, Prepare | Selection plus the Finalize columns | Client | RESP2, SequenceNo, one date per Prepare, confirm |
| Follow-up | Chrome title. Population `<h2>` | Tab stats | Active, Cold Leads, Post-Surgery | Search, intention, Refresh | Patient, Procedure, Status, Contact, Action | Server | Historical counsellor is not ACL. ReQueue unchanged |
| Analytics | Chrome title. Report section headings | Existing KPI strip | Scope and period in the toolbar, which sits above the strip | CSV, Print, Refresh | Charts and aging table | Not an operational pager | My Work is reporting. Open is drill-down |

---

## 16. CGVS-13 — Waiting List reference protection

**Already approved / certified.**

Waiting List is the reference, not a redesign target. C-01 stays closed. The seven zones, count semantics, filters, actions, ownership presentation, and pagination stay unchanged.

---

## 17. CGVS-14 — Certified behavior protection

**Already approved / certified.** This approval does not reopen any of the following.

- Phase 3I is closed. Slice 14 does not exist. Phase 3J does not exist.
- C-01 is accepted and closed. Waiting List stays unchanged and shared. Viewing or opening does not establish ownership.
- `CounselorId` semantics stay. `CreatedByUserId` is not ownership.
- ReQueue stays. Follow-up stays shared. Historical counsellor attribution is not an access-control list. There is no My Follow-ups.
- Analytics My Work stays a reporting scope, not a queue.
- Finalize stays shared. RESP2, FSM, and SequenceNo stay. No second OT Preparation worklist.
- Package LA, Package B Print, and Package C stay closed. C-LA-04 stays deferred.
- Post-Surgery projection semantics stay.
- Permissions, APIs, and DTOs stay.
- The accepted Sessions correction stays. This approval does not change that implementation.
- CGX-1 behavior that the correction did not replace stays: MRN, Eye under Surgery, Decision, Open, contextual Reassign, page size 20, and server paging.

---

## 18. CGVS-15 — Deferred decisions

This approval does not resolve:

1. **Sessions content title treatment,** as still recorded deferred in the page-shell Product Decision. The accepted correction is not reopened and is not declared closed by this file.
2. **Finalize workspace heading treatment.**
3. **Analytics toolbar-before-KPI order.**
4. Follow-up column-cue typography (10px uppercase), already recorded as not decided.
5. Whether Finalize’s toast-only list failure should gain an in-page error. Not decided. Not authorized.
6. Sessions partition metrics. Data source not established.

---

## 19. Data, API, and domain boundary

This Product Decision does not authorize API changes, DTO changes, database changes, new fields, new KPIs that need new data, new filters that need new data, new ownership data, permission changes, route changes, workflow changes, lifecycle changes, FSM changes, ownership changes, ReQueue changes, Assign or Reassign changes, or new worklists.

Any of those is **OUT OF SCOPE / SEPARATE PRODUCT DECISION REQUIRED.**

---

## 20. CGVS-16 — Implementation governance

**Approved product direction for the gate. This approval does not authorize implementation.**

Product Decision approval does not authorize production implementation.

Every future implementation must follow:

**APPROVED PRODUCT DECISION → BOUNDED IMPLEMENTATION AUTHORIZATION → IMPLEMENTATION → AUTOMATED TESTS → MANUAL UAT → ACCEPTANCE → NEXT BOUNDED CUT**

No future cut is automatically authorized by this approval. Each cut needs its own Implementation Authorization.

This file is the approved Product Decision. It is not an Implementation Authorization.

No UAT is executed by this document. No acceptance is recorded. No recommended cut is passed.

---

## 21. Proposed future candidates

**PROPOSED — NOT AUTHORIZED.** Not tickets. Not dates. Not packages. Not required fixes.

- Presentation-only exposure of existing Finalize column cues, without changing columns, selection, or headings.
- Presentation-only naming of the Analytics loading region, without moving the toolbar or the KPI strip.
- Cross-module alignment of existing button variants.
- Cross-module alignment of existing stat presentation, without new metrics or changed formulas.
- Cross-module alignment of existing pills and tabs, without merging meanings.
- Worklist header readability where a module still uses a treatment a prior decision left open.
- Responsive spacing refinement that does not force one gap value and does not hide status or the primary action.

Each item, if ever built, needs its own authorization, tests, Manual UAT, and acceptance artifact.

---

## 22. Decision table

| ID | Decision | Direction | Scope | Exclusions | Preserved | Authorization |
|----|----------|-----------|-------|------------|-----------|---------------|
| CGVS-01 | Common visual language | **Approved product direction.** Reuse existing Hospital Portal and Counsellor primitives | All Counsellor operational and reporting surfaces named in CGVS-12 | New system, new grid, identical DOM | Stack freeze | Required later. Not created |
| CGVS-02 | Page hierarchy | **Already approved** order, restated. Deferred titles stay open | Content area below chrome | Chrome, Finalize heading choice, Sessions reopen | Accepted Sessions correction. Deferred Finalize headings | Required later. Not created |
| CGVS-03 | Statistics | **Approved product direction.** Visual treatment of **certified** metrics only | Existing labels in section 6 | New KPIs, formula changes, Sessions partition cards | PD-CGX-05 A, PD-FS-01 label Awaiting Finalise, PD13–PD15 | Required later. Not created |
| CGVS-04 | State and tabs | **Approved product direction.** Shared control language. **Certified** meanings stay separate | Existing pills and tabs | Universal tab model, merged states | Workspace versus status, three Follow-up populations, Sessions selector | Required later. Not created |
| CGVS-05 | Actions | **Approved product direction.** Visual hierarchy. **Certified** actions unchanged | Existing buttons | New actions, moved workflow, ownership mutation | FSM, ReQueue, Open versus Reassign, Analytics drill-down | Required later. Not created |
| CGVS-06 | Toolbars | **Approved product direction.** Visual treatment of existing controls | Controls listed in section 9 | Universal filter, new filters | Query, paging, and count contracts | Required later. Not created |
| CGVS-07 | Worklists | **Already approved** PD-CGX-01 and PD-CGX-04. **Approved product direction** adds presentation expectations only | Module columns in section 10 | Universal grid, resize, reorder, Columns menu | Five information architectures | Required later. Not created |
| CGVS-08 | Loading, empty, error | **Approved product direction.** Presentation rule. Mechanisms may differ | Existing states | Replacing Finalize toast from this file | Sessions, Follow-up, and Analytics recovery as they are | Required later. Not created |
| CGVS-09 | Pagination | **Approved product direction.** Visual treatment. **Certified** contracts | Existing pagers | Page size, server/client, URL, reset, clamp | Sessions size 20 and `?page=`. Aging is not a queue | Required later. Not created |
| CGVS-10 | Responsive | **Approved product direction.** Desktop-first. Keep status and primary action | Layout | Forced identical gaps. Hiding fields | Compact shell finding from the audit | Required later. Not created |
| CGVS-11 | Accessibility | **Approved product direction.** Minimums. Audit notes stay candidates | Existing semantics | Cue or skeleton edits without a later authorization | Follow-up cue exposure | Required later. Not created |
| CGVS-12 | Module IA | **Already approved** differences, tabulated | Six surfaces | Making them identical | All column and action sets above | Not an implementation |
| CGVS-13 | Waiting List protection | **Already approved / certified** | Reference only | Any Waiting List edit | C-01 | None. Do not implement |
| CGVS-14 | Certified behavior | **Already approved / certified** | Protection list in section 17 | Phase 3J, Slice 14, package reopen | Ownership, FSM, packages | None. Do not implement |
| CGVS-15 | Deferred items | **Deferred.** Not solved by this approval | Section 18 | Closing them inside a visual standard | Sessions correction locked against further edits by this approval | Separate decision required |
| CGVS-16 | Governance | **Approved.** Approval is not implementation | Process | This file as an authorization | Separate IA, tests, UAT, acceptance for each cut | Not created |

---

## 23. Recommended future implementation cuts

Planning guidance only. Every cut below is **PROPOSED — NOT AUTHORIZED**.

This approval does not create an Implementation Authorization for any cut.

### CUT 1 — Counsellor visual foundation

**PROPOSED — NOT AUTHORIZED**

- **Target:** Finalize Surgery, OT Preparation, Follow-up Center, Analytics.
- **Scope:** existing statistics presentation, existing pills and tabs, existing button hierarchy, existing search / filter / action toolbar presentation, presentation-only spacing and alignment, presentation-only loading / empty / error alignment.
- **Excluded:** Waiting List, Sessions, APIs, DTOs, database, permissions, ownership, FSM, workflow, new metrics, new filters, new actions, deferred headings, Analytics toolbar / KPI order.

### CUT 2 — Worklist and grid presentation

**PROPOSED — NOT AUTHORIZED**

- **Target:** Finalize, OT Preparation, Follow-up, Analytics aging table.
- **Scope:** header readability, row hierarchy, status presentation, alignment, action placement, selection presentation, responsive overflow, pagination presentation.
- **Preserve:** existing columns and information architecture.
- **Prohibited:** universal grid, column resize, drag reorder, column filters, Columns menu, new columns, removing operational or clinical fields.

### CUT 3 — Accessibility and responsive polish

**PROPOSED — NOT AUTHORIZED**

- **Scope:** presentation-level accessibility candidates from the audit, Finalize column cues, Analytics loading-region semantics, focus and named-control checks, responsive worklist behavior.
- **Excluded:** workflow changes and data changes.

### CUT 4 — Cross-module visual regression and UAT

**PROPOSED — NOT AUTHORIZED**

- **Target:** Finalize, OT Preparation, Follow-up, Analytics.
- **Validate, when a later authorization exists:** stats, tabs, buttons, controls, worklists, pagination, loading, empty, error, responsive behavior, accessibility, and regression against certified behavior.

---

## 24. Next governance gate

**PRODUCT DECISION APPROVED — IMPLEMENTATION NOT AUTHORIZED**

**Next gate:** create a separate bounded Implementation Authorization for the first approved implementation cut.

Do not treat this file as that authorization. No cut is automatically authorized.

**STOP.**
