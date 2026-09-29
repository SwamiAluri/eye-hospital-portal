# Counsellor Visual Polish — Product Decision

| Field | Value |
|-------|--------|
| **Status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Date** | 2026-09-25 |
| **Type** | Product Decision |
| **Follows** | Counsellor Visual Standard — Wave 2, after Manual UAT |
| **Implementation authorization** | **NOT CREATED** |
| **Production code** | **NONE MODIFIED** |
| **Tests** | **NONE MODIFIED** |
| **Manual UAT for this package** | **NOT EXECUTED** |
| **Acceptance for this package** | **NOT RECORDED** |

This document records direction. It does not authorize implementation.

Wave 2 decisions VS2-01 through VS2-08 stay as recorded. This file does not edit them. It adds a later polish package.

---

## 1. Background

Manual review after Wave 2 found the six Counsellor surfaces acceptable in function and in the Wave 2 presentation. Two visual issues remain.

1. There is more vertical space than needed between the staff header and the first content region.
2. Analytics category colors look separately chosen. Several of those colors are the same hex values as Decision Funnel outcomes, so a category can look like success, decline, warning, or exception when it is only a name.

---

## 2. Spacing audit

The staff header is `TopNav`, rendered by `apps/hospital-portal-web/src/app/dashboard/layout.tsx`. These six routes are no-pad routes. `main` does not add `p-[var(--page-content-pad)]` for them.

### Shared shell — scope risk, not in this decision

The shell (`data-testid="app-shell"`) uses `p-[var(--shell-pad)]` and the column under the header uses `gap-[var(--shell-gap)]`.

| Token | At 1600px and above | Below 1600px |
|-------|---------------------|--------------|
| `--shell-pad` | 12px | 8px |
| `--shell-gap` | 12px | 8px |

`--shell-gap` is the grey band between the header card and `main`. It applies to every dashboard route that uses this layout. Changing `dashboard/layout.tsx`, `--shell-gap`, or `--shell-pad` would change unrelated modules. **That change is out of scope.** Header height (`--topnav-height`) is also out of scope.

### Page-owned space — in scope

`.staff-page-fit` does not add padding. The top inset is the page root `pt-*` class. `gap-*` on that root is space between sections after the first region, not space above it.

| Surface | Page root | First region | Top inset below 1600px | Top inset at 1600px and above | Where it lives |
|---------|-----------|--------------|-------------------------|-------------------------------|----------------|
| Waiting List | `waiting-list/page.tsx` | `WaitingListSummaryWidget` | `pt-0.5` (2px) | `pt-2` (8px) | Page only |
| Counselling Sessions | `sessions/page.tsx` | Session state pills | `pt-0.5` | `pt-2.5` (10px) | Page only |
| Finalize Surgery | `finalize-surgery/page.tsx` | Summary cards | `pt-0.5` | `pt-2.5` | Same page as OT |
| OT Preparation | Same file, `ot-preparation` workspace | Same summary cards | Same | Same | Same page as Finalize |
| Follow-up Center | `surgery-followup/page.tsx` | `followup-summary` | `pt-0.5` | `pt-2.5` | Page only |
| Analytics | `counselor/analytics/page.tsx` | Toolbar inside `CounselorAnalyticsTab` | `pt-0.5` | `pt-2.5` | Page wrapper only. The tab does not add its own top padding |

Horizontal padding (`px-2.5`, and `px-4` at 1600px) and bottom padding stay. Section `gap-0.5` / `gap-2.5` stays. Card padding stays. `staff-worklist-row` density stays.

---

## 3. Spacing decision

On these six surfaces only, remove the page-root top padding (`pt-0.5` and `min-[1600px]:pt-2` or `min-[1600px]:pt-2.5`).

Use the existing `pt-0` utility. Do not add a spacing token. Do not change the shell, the sidebar, or the header height.

Waiting List remains the compact reference. This correction only removes the extra inset these pages add above their first region. It does not copy Waiting List content.

The shared 8px or 12px shell gutter stays. If that gutter is still too large after this correction, that is a separate shell decision. It is not part of this package.

---

## 4. Analytics visualization decision

Wave 2 mapped Session Types, Surgery Type bars, and trend dates onto this set:

- `counselling-primary`
- `#059669`
- `#b91c1c`
- `#d97706`
- `#7c3aed`
- `#6b7280`

The last five values are the Decision Funnel outcome colors (Agreed, Declined, Pending Decision, Exception, Other/Unclassified). Using them for category names makes an unrelated category look like an outcome. That mapping is replaced for categorical series only.

### Semantic colors stay semantic

Do not recolor Decision Funnel:

| Outcome | Color |
|---------|--------|
| Agreed | `#059669` |
| Declined | `#b91c1c` |
| Pending Decision | `#d97706` |
| Exception | `#7c3aed` |
| Other/Unclassified | `#6b7280` |

Do not change surgery conversion threshold text (`text-emerald-700`, `text-amber-800`, `text-red-800`).

### Categorical colors do not mean status

Session Types and Surgery Type volume bars distinguish names only. A color must not be read as clinical or business status.

Rules:

- Do not use the five funnel hexes for these series.
- Do not cycle six unrelated colors.
- Do not color by array index.
- The same category key keeps the same color on every render.
- Use steps of the existing `counselling-primary` fill only, through opacity classes that already exist in the product (for example `/90`, `/70`, `/50`, `/40`). That is one hue, not a new palette and not a new token.
- Map the category key to a step with a stable function. Order of the API list must not change the color.
- Text labels stay. Color is not the only way to tell categories apart.

Daily trend marks are a time series, not a set of named categories. Use one categorical fill, `bg-counselling-primary/70`, for every day. Do not give each day a different color. The existing date and count text stays.

If this cannot be done with existing `counselling-primary` opacity classes, stop. Do not add CSS variables, a chart theme, or a chart library.

---

## 5. Protected behavior

Waiting List: spacing correction only. Metrics, filters, seven zones, ownership, actions, pagination, and C-01 stay.

Sessions: spacing correction only. The accepted identity, Counselling Sessions / Reassignment Required, MRN, Eye, Decision, Open, Reassign, pagination, ownership, and server paging stay.

Finalize and OT: top padding only, on the shared page. Identity, cards, metrics, FSM, SequenceNo, and RESP2 stay as Wave 2 left them.

Follow-up: top padding only. Stats, tabs, the removed grey edge, and the Cold red edge stay.

Analytics: categorical fills and trend fill only. Toolbar order, KPIs, formulas, scope, My Work, Authorized Branch, period, funnel, mixes, aging, drill-down, CSV, Print, and Refresh stay.

---

## 6. Exclusions

- New design system, spacing token, theme, or chart library
- Global shell, sidebar, or header-height changes
- `--shell-gap` and `--shell-pad`
- Typography redesign, new cards, new metrics, new filters, new worklists
- APIs, DTOs, database, permissions, ownership, workflow, FSM
- Sessions or Waiting List redesign
- Analytics formula changes and toolbar reorder
- Decision Funnel recoloring
- Recoloring conversion-threshold text

---

## 7. Future implementation acceptance

Not authorized until a separate Implementation Authorization exists.

- Each of the six surfaces has no page-root top padding above the first region.
- Horizontal padding, bottom padding, section gaps, cards, and row density are unchanged.
- Shell gap and header height are unchanged.
- Session Type and Surgery Type fills are primary-teal steps, stable per category key, and do not use funnel hexes.
- Trend marks share one primary fill.
- Funnel outcome colors and conversion-threshold colors are unchanged.
- KPI values and scope behavior are unchanged.

---

## 8. Gate

| Item | Status |
|------|--------|
| Production code | **NONE MODIFIED** |
| Tests | **NONE MODIFIED** |
| Implementation Authorization | **NOT CREATED** |
| Manual UAT for this package | **NOT EXECUTED** |
| Acceptance for this package | **NOT RECORDED** |
| Next gate | Separate bounded Implementation Authorization |

**NO IMPLEMENTATION IS AUTHORIZED BY THIS TASK.**
