# Counsellor Visual Standard — Wave 2 Product Decision

| Field | Value |
|-------|--------|
| **Status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Date** | 2026-09-25 |
| **Type** | Product Decision |
| **Implementation authorization** | **NOT CREATED** |
| **Production code** | **NONE MODIFIED** |
| **Tests** | **NONE MODIFIED** |
| **Manual UAT** | **NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

This document records product direction. It does not authorize implementation.

**NO IMPLEMENTATION IS AUTHORIZED BY THIS TASK.**

---

## 1. Why this decision exists

The approved visual and interaction standard, the Cut 1 confirmation, and the page-shell decision remain in force.

Cut 1 confirmed that Finalize Surgery, OT Preparation, Follow-up Center, and Analytics already use the existing Counsellor visual language, and it authorized no production change. Manual review since then shows a remaining hierarchy difference from the Counsellor Waiting List: a second page identity on Finalize and OT, summary strips that do not use the Waiting List summary-card treatment, a persistent grey left edge on Follow-up rows, and Analytics category charts that share one teal fill.

Those observations are the reason for this decision. They are not authorization to code.

This decision does not reopen the accepted Sessions correction. It does not redesign Waiting List. It does not start Cut 2, Cut 3, or Cut 4.

The previously deferred **Finalize workspace heading** is decided here as VS2-01, VS2-02, and VS2-03. Items listed in section 10 stay deferred.

---

## 2. Inspection before the decision

### Staff page title

`resolveStaffPageTitle` returns the sidebar label for the current pathname. `TopNav` renders that string as the only staff `h1` (`app-topnav-title`).

The Finalize and OT workspaces share `/dashboard/counsellors-desk/finalize-surgery`. The sidebar label is **Finalize Surgery**. The resolver does not read workspace state, so the chrome title stays **Finalize Surgery** on both workspaces.

### Workspace and duplicate headings

`activeWorkspace` is local page state: `'finalization'` or `'ot-preparation'`. The content `h1` (`finalize-surgery-page-title`) shows **Surgery Finalization** or **OT Preparation**. When OT Preparation is active, the purpose line **Prepare Finalised surgeries for OT.** (`finalize-ot-prep-purpose`) sits under that heading.

### Summary sources

| Surface | What is on screen today | Source |
|---------|-------------------------|--------|
| Waiting List | Five separate cards: Patients, Pending, Processing, Done, Repeat Counselling | Existing `tabCounts`. Reference only |
| Finalize | One strip: Scheduled, Awaiting Finalise, Surgery Done | Loaded records. Scheduled = record count. Awaiting Finalise = `countNeedsAttention` (`NEEDS_ATTENTION_KPI_LABEL`). Surgery Done = status `SurgeryDone` |
| OT Preparation | One strip: Finalised, Selected | Finalised = filtered Finalised rows. Selected = current selection count, not a lifecycle status |
| Follow-up | One strip that changes with the tab | `GET /Counseling/followups/stats` |
| Analytics | Existing KPI strip, then charts | Existing analytics summary. Not a worklist |

Follow-up stats already differ by tab. Active shows Active, Never Contacted, and Avg Attempts. Cold Leads shows Cold Leads, Declined, Referred, and Avg Attempts. Post-Surgery shows Post-Surgery, the existing post-discharge aging label, Pending Visits, and Avg Days. This decision does not drop or add any of those.

### Follow-up left edge

Active and Post-Surgery rows use `border-l-4 border-l-counselling-border` on every row. That is the grey/ash left edge. Cold rows use `border-l-4 border-l-red-400` on every cold row. Row text, status, and actions are separate from that edge. Waiting List summary cards use a short primary accent on the **card**, not this row edge.

### Analytics color

Decision Funnel already assigns a fixed color per existing outcome stage in `ConversionFunnelChart`: Agreed, Declined, Pending Decision, Exception, and Other/Unclassified. Those colors carry the existing outcome meaning.

Session Types, Surgery Type volume bars, and daily trend marks all use `bg-counselling-primary`. Surgery conversion percent already uses emerald, amber, and red by the existing threshold. The counselling theme defines a teal primary and neutrals. It does not define a categorical chart palette.

Changing those fills is CSS on values the page already receives. It does not need a new field, formula, or API.

---

## 3. Waiting List reference

Waiting List is the visual reference for identity, summary cards, state tabs, vertical order, density, toolbar placement, worklist, pagination, and rhythm.

The order on that page is:

1. Staff chrome identity
2. Existing summary cards
3. Existing state tabs
4. Existing toolbar
5. Worklist
6. Pagination

Waiting List is not a template. Other modules do not take its five cards, columns, filters, metrics, ownership rules, or pagination.

---

## 4. Decisions

### VS2-01 — Finalize identity

When the Surgery Finalization workspace is active, the visible page identity is **Finalize Surgery**.

The content heading **Surgery Finalization** does not remain as a second page title.

Workspace controls, status tabs, filters, the worklist, Open, Finalise, Reopen, print, FSM, and data meaning stay as they are.

### VS2-02 — OT identity

When the OT Preparation workspace is active, the visible page identity is **OT Preparation**.

**Finalize Surgery** is not the page identity in that workspace.

The menu item and the route stay. There is no new route and no second OT worklist. RESP2, FSM, SequenceNo, and ownership stay.

The staff title today cannot follow `activeWorkspace`, because it is pathname-only. A future implementation may set the visible title for this route from the active workspace. That is presentation. It must not rename the sidebar item for the module, and it must not change `resolveStaffPageTitle` for other routes.

### VS2-03 — OT purpose copy

**Prepare Finalised surgeries for OT.** is removed from the proposed presentation. It repeats the workspace name.

### VS2-04 — Finalize summary

Scheduled, Awaiting Finalise, and Surgery Done are presented as separate summary cards in the Waiting List card treatment: label, value, card surface, and the existing compact density.

Formulas, predicates, labels, and sources stay. No fourth metric is added. The card count is three.

### VS2-05 — OT summary

Finalised and Selected use the same card treatment. The card count is two. Selected stays a selection count.

### VS2-06 — Follow-up summary

Existing tab stats use the same card treatment. Active keeps Active, Never Contacted, and Avg Attempts. Cold Leads and Post-Surgery keep the stats they already show from `GET /Counseling/followups/stats`.

No ownership metric. No My Follow-ups. Historical counsellor attribution stays historical.

### VS2-07 — Follow-up row decoration

Remove the persistent grey/ash left edge (`border-l-counselling-border`) from Active and Post-Surgery rows.

Keep patient identity, horizontal row separation, focus, status text, and actions.

The uniform red left edge on every Cold row is not the grey/ash line from this review. It is not decided here.

### VS2-08 — Analytics visualization

Session Types, Surgery Type volume bars, daily trend marks, and any other categorical series that currently share only `counselling-primary` use a restrained multi-color treatment.

Rules:

- Healthcare, professional, accessible, and visually quiet.
- Stable mapping. A category does not change color between renders.
- Color is not the only label. Text labels stay.
- Do not add a theme, a token system, or random colors.
- Reuse colors already present in the product. The counselling theme has no separate chart palette. A future implementation must not add one in order to satisfy this decision.
- Decision Funnel keeps its existing outcome colors and their meanings. Do not recolor Agreed, Declined, Pending Decision, Exception, or Other/Unclassified into a new scheme.
- Surgery conversion percent keeps its existing threshold colors.
- KPI values, formulas, populations, My Work, Authorized Branch, period, drill-down, export, print, and aging stay.

Analytics remains a report. Its KPI strip is not replaced by Waiting List metrics or by a five-card grid.

### VS2-09 — Waiting List

Waiting List stays the reference and stays unchanged. C-01 stays closed. The seven zones, metrics, filters, pagination, and ownership behavior stay.

### VS2-10 — Sessions

The accepted Sessions correction stays closed. The state selector, pagination, and Reassignment Required behavior stay. Sessions does not gain KPI cards.

---

## 5. Protected behavior

Ownership: Phase 3I stays closed. Slice 14 does not exist. Phase 3J does not exist. No Assign, Reassign, or ReQueue change. `CounselorId`, ownership history, and permissions stay.

Finalize and OT: FSM, SequenceNo, RESP2, Package LA, Package B Print, and Package C stay closed. C-LA-04 stays deferred. No new OT worklist. No API, DTO, or database change.

Follow-up: three populations stay. No My Follow-ups. Historical counsellor is not an access list. ReQueue stays.

Analytics: reporting only. My Work and Authorized Branch stay reporting scopes. No new operational worklist. No new KPI.

---

## 6. Decision table

| ID | Area | Decision | Scope | Data/Behavior Change |
|----|------|----------|-------|----------------------|
| VS2-01 | Finalize identity | Finalize Surgery as primary identity; remove duplicate competing heading | Presentation | None |
| VS2-02 | OT identity | OT Preparation becomes active primary identity | Presentation | None |
| VS2-03 | OT purpose copy | Remove redundant purpose sentence | Presentation | None |
| VS2-04 | Finalize summary | Waiting List-style summary cards using existing 3 metrics | Presentation | None |
| VS2-05 | OT summary | Waiting List-style summary cards using existing metrics | Presentation | None |
| VS2-06 | Follow-up summary | Waiting List-style summary cards using existing metrics | Presentation | None |
| VS2-07 | Follow-up row decoration | Remove unwanted left-edge decorative line | Presentation | None |
| VS2-08 | Analytics visualization | Introduce restrained multi-color chart presentation | Presentation | None |
| VS2-09 | Waiting List | Remains reference and unchanged | Protection | None |
| VS2-10 | Sessions | Accepted state remains unchanged | Protection | None |

---

## 7. Future implementation acceptance criteria

These criteria are for a later implementation. They are not work authorized now.

### Finalize

- The page identity reads **Finalize Surgery**.
- No competing **Surgery Finalization** heading remains.
- Scheduled, Awaiting Finalise, and Surgery Done stay correct and use the summary-card treatment.
- Workspace and status controls remain.
- Worklist and actions remain.

### OT

- The active identity reads **OT Preparation**.
- **Finalize Surgery** is not the page identity while OT Preparation is active, using a title path that can follow workspace state.
- **Prepare Finalised surgeries for OT.** is absent.
- Finalised and Selected stay, as cards.
- RESP2 behavior stays.

### Follow-up

- Active, Cold Leads, and Post-Surgery keep their current stats, tabs, filters, and actions.
- The grey/ash left edge is gone from Active and Post-Surgery rows.
- Patient, status, and action content stay.

### Analytics

- KPI values, chart values, formulas, scope, and period stay identical.
- Categorical series that are teal-only today use a deliberate multi-color presentation.
- Funnel outcome colors keep their current meanings.
- Contrast stays acceptable, and color is not the only distinction.
- No new business meaning is added by color.

---

## 8. Product decision gaps

**None.**

No requested item needs an API, DTO, backend, database, permission, workflow, FSM, new metric, or new data source.

Implementation constraint, not a data gap: the staff title is the sidebar label for the pathname. OT identity (VS2-02) needs a later presentation binding from `activeWorkspace` to the visible title on this route only.

---

## 9. Deferred — not part of this decision

- Analytics toolbar-before-KPI order
- Sessions content title treatment
- Finalize column-cue accessibility
- Analytics loading-skeleton accessibility
- Finalize toast versus an in-page error
- Follow-up column-cue typography
- The uniform red left edge on Cold rows
- Global spacing or token redesign
- Shared button redesign
- A universal grid, column resize, column reorder, per-column filters, or a Columns menu
- New search or filter controls
- New APIs, DTO fields, database changes, permissions, ownership, or FSM changes

---

## 10. Gate

| Item | Status |
|------|--------|
| Implementation Authorization | **NOT CREATED** |
| Production Code | **NONE MODIFIED** |
| Tests | **NONE MODIFIED** |
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
| Next gate | Separate bounded Implementation Authorization after Product Owner acceptance of this Product Decision |

**NO IMPLEMENTATION IS AUTHORIZED BY THIS TASK.**
