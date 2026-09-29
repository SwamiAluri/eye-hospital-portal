# Counsellor Visual Polish — Implementation Authorization

| Field | Value |
|-------|--------|
| **Status** | **IMPLEMENTATION AUTHORIZATION — CREATED / BOUNDED** |
| **Date** | 2026-09-25 |
| **Source Product Decision** | `docs/product-decisions/counsellor-visual-polish-product-decision.md` |
| **Wave 2** | Closed. VS2-01 through VS2-08 stay as implemented. This authorization does not reopen them. |

This document authorizes a future implementation. It does not perform that implementation.

Production code is not modified by this authorization. Tests are not modified. Manual UAT is not executed. Acceptance is not recorded. Performance work is not authorized.

---

## 1. Source check

Inspected, not modified. Current page-root classes match the Product Decision. There is no source mismatch.

| Surface | File | Current top inset | Wide top inset |
|---------|------|-------------------|----------------|
| Waiting List | `waiting-list/page.tsx` | `pt-0.5` | `min-[1600px]:pt-2` |
| Sessions | `sessions/page.tsx` | `pt-0.5` | `min-[1600px]:pt-2.5` |
| Finalize and OT | `finalize-surgery/page.tsx` | `pt-0.5` | `min-[1600px]:pt-2.5` |
| Follow-up | `surgery-followup/page.tsx` | `pt-0.5` | `min-[1600px]:pt-2.5` |
| Analytics | `counselor/analytics/page.tsx` | `pt-0.5` | `min-[1600px]:pt-2.5` |

The inset is on each page root. It is not in `dashboard/layout.tsx`, `TopNav`, or a shared token. `.staff-page-fit` does not add padding.

Categorical colors today are `analyticsCategoryColorClass` in `CounselorAnalyticsTab.tsx`. That function maps a category key onto `counselling-primary` plus the five Decision Funnel hexes. Trend marks call the same function with the date. Funnel colors live only in `ConversionFunnelChart.tsx` and stay there.

---

## 2. Authorized change — VS-POLISH-01

On the five page roots above, replace only the top inset.

- `pt-0.5` becomes `pt-0`
- `min-[1600px]:pt-2` on Waiting List becomes no wide top inset (`pt-0` at every width)
- `min-[1600px]:pt-2.5` on the other four roots is removed the same way

Keep, unchanged, on those same class strings:

- `px-2.5` and `min-[1600px]:px-4`
- `pb-1` and `min-[1600px]:pb-4`
- `gap-0.5`, `gap-2.5`, and `min-[1600px]:gap-2.5` wherever they already are
- `staff-page-fit`, `shellPage`, overflow, and height classes

Do not change card padding, `staff-worklist-row`, shell padding, `--shell-gap`, `--shell-pad`, or `--topnav-height`.

Do not edit `dashboard/layout.tsx` or `TopNav.tsx`. If the inset is later found on a shared component, stop:

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

---

## 3. Authorized change — Analytics categorical color

Edit only `CounselorAnalyticsTab.tsx` for color. Do not edit `ConversionFunnelChart.tsx`.

### Session Types and Surgery Type bars

Replace the current hash into funnel hexes.

Allowed fills only:

- `bg-counselling-primary/90`
- `bg-counselling-primary/70`
- `bg-counselling-primary/50`
- `bg-counselling-primary/40`

Map by the existing category key (session type or surgery type), trimmed. The same key must return the same class. The list order from the API must not be the mapping. Do not use `#059669`, `#b91c1c`, `#d97706`, `#7c3aed`, or `#6b7280` for these bars.

Text labels stay.

### Daily trend marks

Stop using `analyticsCategoryColorClass(t.date)` for a different color per day.

Every trend mark uses `bg-counselling-primary/70`.

### Protected colors

Leave these strings in `ConversionFunnelChart.tsx` exactly as they are:

| Outcome | Color |
|---------|--------|
| Agreed | `#059669` |
| Declined | `#b91c1c` |
| Pending Decision | `#d97706` |
| Exception | `#7c3aed` |
| Other/Unclassified | `#6b7280` |

Leave surgery conversion text as `text-emerald-700`, `text-amber-800`, and `text-red-800`.

Do not add CSS variables, tokens, a theme, a chart library, or a hex palette.

If the four primary opacity classes cannot be used without a new token or theme:

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

---

## 4. Files a future implementation may edit

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx` — top inset only
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx` — top inset only
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` — top inset only
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx` — top inset only
- `apps/hospital-portal-web/src/app/dashboard/counselor/analytics/page.tsx` — top inset only
- `apps/hospital-portal-web/src/components/counselor/CounselorAnalyticsTab.tsx` — categorical fills and trend fill only

Tests only as in section 6.

Do not edit layout, TopNav, tokens, `ConversionFunnelChart.tsx`, shared buttons, or theme files.

---

## 5. Protected behavior

Waiting List: C-01, metrics, filters, seven zones, Owner, actions, pagination, and APIs stay.

Sessions: accepted identity, Counselling Sessions / Reassignment Required, MRN, Eye, Decision, Open, contextual Reassign, pagination, and server paging stay.

Finalize and OT: identities, summary cards, status tabs, FSM, SequenceNo, Prepare, Reopen, RESP2, print, filters, and worklist stay.

Follow-up: tabs, stats, `GET /Counseling/followups/stats`, search, intention, Refresh, attribution, ReQueue, Cold `border-l-red-400`, and the Wave 2 removal of the grey edge stay.

Analytics: toolbar order, KPIs, formulas, scope, My Work, Authorized Branch, period, funnel math, mixes, trends, aging, drill-down, CSV, Print, and Refresh stay.

---

## 6. Tests

Keep existing tests. Update only assertions that still require `pt-0.5`, `pt-2`, or `pt-2.5` on these page roots, or that still require funnel hexes on categorical bars.

Contract coverage must show:

- Each of the five page roots has `pt-0` and does not have `pt-0.5`, `min-[1600px]:pt-2`, or `min-[1600px]:pt-2.5` on that page-root class string.
- Horizontal padding, bottom padding, and existing section gaps remain on those strings.
- Session type and surgery type colors come from the four primary opacity classes, keyed by category, and do not include the five funnel hexes.
- Trend marks use `bg-counselling-primary/70` and do not pass the date into the categorical mapper.
- `ConversionFunnelChart.tsx` still contains the five outcome hexes.

Passing tests are not Manual UAT.

---

## 7. After implementation

Create `docs/product-decisions/counsellor-visual-polish-implementation-report.md` with files changed, classes changed, spacing, Analytics color, tests, protected-behavior confirmation, diff summary, out-of-scope confirmation, **Manual UAT: NOT EXECUTED**, and **Acceptance: NOT RECORDED**.

Then stop for browser UAT of Waiting List, Sessions, Finalize Surgery, OT Preparation, Follow-up Center, and Analytics. Check header-to-first-region spacing, no shell or header movement, Analytics category colors, and Wave 2 behavior.

Do not record acceptance. Do not start performance work.

---

## 8. Stop conditions

Stop, and do not improvise, if the work needs `dashboard/layout.tsx`, `TopNav`, shared spacing tokens, `--shell-gap`, `--shell-pad`, `--topnav-height`, a new color token, a chart library, an API, a DTO, the database, permissions, ownership, workflow, FSM, an analytics formula change, a toolbar reorder, or funnel recoloring.

**SCOPE STOP — PRODUCT DECISION / IMPLEMENTATION AUTHORIZATION DOES NOT COVER THIS CHANGE.**

---

## 9. This authorization

| Item | Status |
|------|--------|
| Production code | **NONE MODIFIED** |
| Tests | **NONE MODIFIED** |
| Manual UAT | **NOT EXECUTED** |
| Acceptance | **NOT RECORDED** |
| Performance work | **NOT AUTHORIZED / NOT STARTED** |
| Wave 2 | **CLOSED AND PROTECTED** |
