# Counsellor Visual Standard — Wave 2 Implementation Authorization

| Field | Value |
|-------|--------|
| **Status** | **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED** |
| **Date** | 2026-09-25 |
| **Package** | Counsellor Visual Standard — Wave 2 |
| **Source Product Decision** | `docs/product-decisions/counsellor-cross-module-visual-standard-wave2-product-decision.md` |
| **Product Decision status** | APPROVED — PRODUCT DECISION RECORDED |

This document authorizes a future implementation. It does not perform that implementation.

Production code is not modified by this authorization. Tests are not modified by this authorization. Manual UAT is not executed. Acceptance is not recorded.

---

## 1. Package

| Target | Route / owner | Role |
|--------|----------------|------|
| Finalize Surgery | `/dashboard/counsellors-desk/finalize-surgery` | In scope |
| OT Preparation | Same route, workspace `ot-preparation` | In scope |
| Follow-up Center | `/dashboard/counsellors-desk/surgery-followup` | In scope |
| Analytics | `/dashboard/counselor/analytics` | In scope |
| Waiting List | waiting-list page | Reference only. Do not modify |
| Sessions | sessions page | Protected. Do not modify |

Authorized decision IDs only: **VS2-01, VS2-02, VS2-03, VS2-04, VS2-05, VS2-06, VS2-07, VS2-08**.

---

## 2. Pre-implementation audit

Inspected, not modified.

### Identity

- Staff chrome title comes from `resolveStaffPageTitle` in `TopNav`. It matches the sidebar label for the pathname. For this route the label is **Finalize Surgery**. The resolver does not read workspace state. There is no existing title override.
- `resolveStaffPageTitle('/dashboard/counsellors-desk/finalize-surgery', …)` must keep returning **Finalize Surgery**. Existing resolver tests depend on that. Do not change resolver behavior for any route.
- The sidebar item label stays **Finalize Surgery**.
- Page state is `activeWorkspace: 'finalization' | 'ot-preparation'` in `finalize-surgery/page.tsx` (initial `'finalization'`).
- The content `h1` `finalize-surgery-page-title` renders **Surgery Finalization** or **OT Preparation**.
- When OT Preparation is active, `finalize-ot-prep-purpose` renders **Prepare Finalised surgeries for OT.**
- Workspace buttons stay **Surgery Finalization** and **OT Preparation**.

### Summaries

- Finalize metrics are local: Scheduled = loaded record count, Awaiting Finalise = `countNeedsAttention` / `NEEDS_ATTENTION_KPI_LABEL`, Surgery Done = status `SurgeryDone`. They render inside `sessionStatusStrip`.
- OT metrics are local: Finalised = `otPrepFiltered.length`, Selected = `otPrepSelectedCount`. Selected is the current selection, not a status.
- Follow-up KPIs come from `useFollowupStatsQuery` → `GET /Counseling/followups/stats`, rendered in `followup-summary` with `sessionStatusStrip`. Active: Active, Never Contacted, Avg Attempts. Cold and Post-Surgery keep their existing labels from the same source.
- Waiting List cards live in `WaitingListSummaryWidget`. That widget also owns Waiting List status tabs and five Waiting List metrics. Do not import it into these modules. Do not edit it. Reuse its existing card classes locally: `rounded-lg border border-counselling-border/70 border-l-[3px] border-l-counselling-primary bg-counselling-card px-3 py-2.5 shadow-sm`, with the label above the value.

### Follow-up row edge

- Active rows and Post-Surgery rows: `border-l-4 border-l-counselling-border`.
- Cold rows: `border-l-4 border-l-red-400`. Out of scope. Leave that class in place.
- Horizontal separation is `border-b border-counselling-border/40`. Keep it.

### Analytics color

- `Bar` in `CounselorAnalyticsTab.tsx` uses `bg-counselling-primary/70` for Session Types and Surgery Type volume.
- Daily trend marks use `bg-counselling-primary/60`.
- Surgery conversion percent already uses emerald / amber / red by threshold. Do not change that.
- `ConversionFunnelChart.tsx` already maps outcomes to fixed colors: Agreed `#059669`, Declined `#b91c1c`, Pending Decision `#d97706`, Exception `#7c3aed`, Other/Unclassified `#6b7280`. Do not edit those entries.
- Those five colors plus the existing `counselling-primary` class are already in the product. No new token or chart theme is required.

### Presentation-only

Every authorized item can be done in the page or chart presentation. None needs an API, DTO, database, permission, ownership, or FSM change.

No **SCOPE STOP** item was found.

---

## 3. Authorized changes

### A — Finalize identity (VS2-01)

When `activeWorkspace === 'finalization'`, the visible page identity is **Finalize Surgery**.

Remove the competing content heading **Surgery Finalization**.

Do not change FSM, status tabs, filters, the worklist, Open, Finalise, Reopen, Print, SequenceNo, predicates, APIs, DTOs, database, or permissions.

The workspace button may still read **Surgery Finalization**. That is navigation, not the page identity.

### B — OT identity (VS2-02)

When `activeWorkspace === 'ot-preparation'`, the visible page identity is **OT Preparation**.

**Finalize Surgery** must not remain the visible page identity in that workspace.

Keep the route `/dashboard/counsellors-desk/finalize-surgery`. Do not add a route or a second OT worklist. Do not change RESP2, FSM, SequenceNo, or ownership. Do not rename the sidebar item. Do not change navigation labels.

Allowed mechanism, and no other:

- `resolveStaffPageTitle` stays pathname-based and still returns **Finalize Surgery** for this route.
- `TopNav` may apply a route-local title only while the pathname is `/dashboard/counsellors-desk/finalize-surgery`, using the current workspace: **Finalize Surgery** or **OT Preparation**.
- That override must not affect any other pathname.
- Do not add a title context, store, or override API for other modules.

If the visible OT title cannot be done without changing `resolveStaffPageTitle` for other routes, or without a new shared title system:

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

### C — OT purpose copy (VS2-03)

Remove the visible text **Prepare Finalised surgeries for OT.** Do not replace it.

### D — Finalize summary cards (VS2-04)

Replace the Finalize summary strip with three separate cards:

- Scheduled
- Awaiting Finalise
- Surgery Done

Same formulas, predicates, labels, and sources. No fourth metric.

### E — OT summary cards (VS2-05)

Two cards: **Finalised** and **Selected**. Selected stays a selection count. Do not change selection, RESP2, or Prepare.

### F — Follow-up summary cards (VS2-06)

Use the same card treatment for the stats the active tab already shows.

- Active: Active, Never Contacted, Avg Attempts
- Cold Leads: the existing Cold stats from `GET /Counseling/followups/stats`
- Post-Surgery: the existing Post-Surgery stats from that same source

Do not change population, formulas, attribution, tabs, filters, actions, pagination, ReQueue, or historical counsellor meaning. No My Follow-ups.

### G — Follow-up grey row edge (VS2-07)

Remove `border-l-4 border-l-counselling-border` from Active rows and Post-Surgery rows only.

Keep row separation, patient text, status, actions, focus, and accessibility semantics.

Do not change `border-l-4 border-l-red-400` on Cold rows.

### H — Analytics multi-color (VS2-08)

Session Types bars, Surgery Type volume bars, and daily trend marks that use only `counselling-primary` get a stable multi-color treatment.

Rules:

- Draw only from colors already in the product: `counselling-primary` and the five outcome colors already listed in `ConversionFunnelChart` (`#059669`, `#b91c1c`, `#d97706`, `#7c3aed`, `#6b7280`).
- Map by the existing category key (session type, surgery type, or trend date order). The same key keeps the same color. Do not assign colors at random.
- Keep text labels. Color is not the only meaning.
- Do not edit Decision Funnel stage colors.
- Do not edit surgery conversion threshold colors.
- Do not add CSS variables, a chart palette, or a theme.
- Do not change KPI values, formulas, scope, period, drill-down, export, print, or aging.

If this requires a new shared token or chart-palette system:

**SCOPE STOP — SHARED DESIGN SYSTEM CHANGE IS NOT AUTHORIZED.**

---

## 4. Files a future implementation may edit

Production, only as required for A–H:

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx`
- `apps/hospital-portal-web/src/components/counselor/CounselorAnalyticsTab.tsx`
- `apps/hospital-portal-web/src/components/TopNav.tsx` — route-local title only, as in change B

Tests, only to lock A–H. Do not weaken unrelated contracts.

Do not edit:

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-session-tokens.ts`
- `apps/hospital-portal-web/src/components/counselor/ConversionFunnelChart.tsx` (funnel colors stay)
- `apps/hospital-portal-web/src/lib/navigation/resolve-staff-page-title.ts`
- `apps/hospital-portal-web/src/lib/navigation/sidebar-menu-sections.tsx`
- Shared `CounsellingButton`, global theme, global tokens, universal grid

`ConversionFunnelChart.tsx` may be read. It may not be recolored.

---

## 5. Tests the implementation may update

Cover only the bounded behavior:

- Finalize visible identity is **Finalize Surgery** while that workspace is active.
- The competing **Surgery Finalization** content heading is absent.
- Scheduled, Awaiting Finalise, and Surgery Done remain.
- Workspace and status controls and existing actions remain.
- OT identity is **OT Preparation** while that workspace is active.
- **Prepare Finalised surgeries for OT.** is absent.
- Finalised and Selected remain.
- Follow-up tab stats remain, including Cold and Post-Surgery labels already on the page.
- `border-l-counselling-border` is absent on Active and Post-Surgery rows.
- `border-l-red-400` remains on Cold rows.
- Analytics formulas and Decision Funnel outcome colors remain.
- Categorical fills use a stable mapping from the existing color set.
- `resolveStaffPageTitle` still returns **Finalize Surgery** for this pathname.

Do not add tests for deferred items. Passing tests are not Manual UAT.

After implementation, run the relevant Counsellor suite plus these bounded tests and record passed, failed, and skipped.

---

## 6. Protected behavior

Waiting List is not modified. Sessions is not modified, including the accepted state selector, MRN, Eye, Decision, Reassign, pagination, and Reassignment Required.

Also unchanged: Phase 3I, ownership, `CounselorId`, Assign / Reassign / ReQueue, permissions, FSM, SequenceNo, RESP2, Package LA, Package B Print, Package C, C-LA-04 (still deferred), Follow-up attribution, My Follow-ups (still absent), Analytics My Work, Authorized Branch, period, drill-down, export, print, and aging.

---

## 7. Out of scope

- Analytics toolbar-before-KPI order
- Sessions content title
- Finalize column-cue accessibility
- Analytics loading `aria-hidden`
- Finalize toast versus an in-page error
- Follow-up column-cue typography
- Cold-row red edge
- Global spacing, tokens, or button redesign
- Universal grid, column resize, column reorder, per-column filters, Columns menu
- New search, filters, KPIs, metrics, APIs, DTO fields, database, permissions, ownership, workflow, FSM, routes, or worklists

If implementation would require any of those, or a new design system or shared token:

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

If it would require a shared design-system change:

**SCOPE STOP — SHARED DESIGN SYSTEM CHANGE IS NOT AUTHORIZED.**

---

## 8. After implementation

Create `docs/product-decisions/counsellor-cross-module-visual-standard-wave2-implementation-report.md` with the authorization reference, date, production files, test files, what changed, protected-behavior confirmation, Waiting List and Sessions confirmation, automated results, limitations, deferred items, **Manual UAT: NOT EXECUTED**, and **Acceptance: NOT RECORDED**.

Then stop for manual browser UAT of Finalize Surgery, OT Preparation, Follow-up Center, Analytics, Waiting List, and Counselling Sessions.

Do not record UAT as passed. Do not record acceptance. Do not start another visual package, Cut 2, Cut 3, Cut 4, or another Product Decision.

---

## 9. This authorization

| Item | Status |
|------|--------|
| Implementation | **NOT STARTED** |
| Production code | **NONE MODIFIED** |
| Tests | **NONE MODIFIED** |
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
