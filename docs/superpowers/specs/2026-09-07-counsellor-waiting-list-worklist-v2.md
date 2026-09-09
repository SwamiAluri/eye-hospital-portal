# Counsellor Waiting List — Clinical Operational Worklist Redesign (V2)

**Status:** Design specification only — awaiting approval  
**Date:** 2026-09-07  
**Route:** `/dashboard/counsellors-desk/waiting-list`  
**Supersedes (visually):** `docs/superpowers/specs/2026-09-05-counsellor-waiting-list-worklist-design.md` (V1)  
**Does not modify:** V1 spec file, production code, tests, or the approved implementation plan until a separate V2 plan is authorized  

**Visual reference (approved):** Counselling Session application — Quote → Decision → Insurance → Notes → Finish (`.counselling-session` shell, `CounsellingSessionWidget`, `counsellingSessionTokens`)  

**Not a Session clone:** Waiting List remains a multi-patient operational work queue. No Journey Rail, no Session Action Bar, no Quote/Decision layout copy.

---

## 1. Problem Statement

The Waiting List passed functional checks under the V1 plan (`docs/superpowers/plans/2026-09-05-counsellor-waiting-list-worklist.md`), but **browser UAT rejected the visual design**.

The page assembled the correct *structural* pieces (Summary, Filter, Queue, work rows) and preserved business handlers, yet the rendered result still reads as:

- a thin KPI strip + filter chrome + spreadsheet-like list, or
- a "redesigned HTML table" wearing counselling tokens,

rather than a **clinical operational worklist** that belongs to the same counselling application as Quote / Decision / Insurance / Notes.

V1 correctly defined widget boundaries and field mapping. V2 exists because **composition, hierarchy, density, alignment, and kinship with Session chrome failed in the browser** — not because queue rules, APIs, or handlers are wrong.

---

## 2. Browser UAT Findings

Observed against the current cutover (`WaitingListSummaryWidget`, `WaitingListFilterToolbar`, `WaitingListQueueWidget`, `WaitingListWorkRow`, `WaitingListOtReturnedRow`, page shell on `counsellingSessionTokens.shellPage`):

| Finding | Why it fails clinically |
|---|---|
| Excessive horizontal whitespace | Columns do not claim intentional width; empty fr space reads as unfinished layout |
| Weak page identity | Title alone does not establish "Counsellor's Desk · Waiting List" workstation context |
| Summary feels like a KPI dashboard | Five equal numeric cells (even without MiniBars) still shout "admin dashboard" |
| MiniBars (earlier iterations) | Decorative noise; no clinical decision value |
| Search vs status competition | Type pills and Status pills share the same visual weight (`pillTabTrack` twice) |
| Queue columns misaligned | Flex-era collapse / weak shared template enforcement; Procedure/Eye and Status visually mix |
| Rows vertically collapsed | Typography too small for available canvas; meta lines crush into one another |
| Attention too heavy | "Pre-Auth Required" repeated across rows dominates scanning |
| Equal-weight actions | Primary / Pre-Auth / demographics compete as peer buttons |
| Green/teal over-dominance | Primary counselling green floods action column |
| Generic table feel | Header cues + divide-y rows still read as admin table, not worklist |
| Weak Session kinship | Widgets present, but spacing/type/status treatment do not match Session's restrained density |

**Functional note (preserve):** Filters, tabs (including `OtReturned` / `PreAuthQueue`), Apply/Reset, Add Patient, row navigation, Pre-Auth deep-link, deferred CCMS badges, and OT Returned source remain correct. V2 is visual/composition only.

---

## 3. UX Goals

1. **One clinical workstation page** — grey Session canvas, white functional widgets, plain gutters between them.
2. **Dominant Patient Queue** — multi-patient scanning is the job; chrome never out-competes the queue.
3. **Precise column alignment** — one shared CSS Grid template for header and every normal row.
4. **Clear scan order** — Patient → Procedure/Eye → Status → Attention → Action.
5. **Hierarchy, not chrome volume** — primary search/type/filters/add vs secondary status views.
6. **Compact clinical density** — ~56–64px row minimum; readable type; controlled padding; no giant empty columns.
7. **Session visual kinship** — reuse `counsellingSessionTokens`, `CounsellingSessionWidget`, `CounsellingButton`, `CounsellingSearchInput`, `CounsellingInput`, `statusPill` / `getStatusBadge()`.
8. **One primary action per row** — secondary Pre-Auth and demographics subordinate.
9. **Attention as signal, not banner** — plain text, compact, never a second status pill.
10. **Desktop-first workstation** — tablet/narrow defined; no horizontal scroll as the primary strategy.

---

## 4. Non-Goals

- No backend, API, DTO, permission, or enum changes.
- No new queue states, metrics, or Pre-Auth/CCMS business rules.
- No Journey Rail / Session Action Bar / Quote layout.
- No card-per-patient, card-per-metric, nested widgets.
- No second toast/realtime/polling stack; no SignalR on this page.
- No new colour system or action palette.
- No deletion of `WaitingListRow.tsx` in this design phase (retirement remains a later approved task).
- No implementation plan or production code in this deliverable.
- Do not invent demographics or patient API calls per row.

---

## 5. Relationship to Counselling Session UI

| Session pattern | Waiting List V2 use |
|---|---|
| `shellPage` grey canvas (`bg-gray-100` + `.counselling-session`) | Page root |
| `sessionWidget` + `CounsellingSessionWidget` | Filter workspace + Patient Queue (+ optional compact summary surface) |
| Plain transparent gutters (`shellChromeStack` spacing language: `gap-3`, `px-4`) | Between widgets |
| `patientName` / `shellMeta` / `shellSecondaryMeta` type scale | Adapt for **rows** (smaller than Session header hero, larger than current V1 row type) |
| `statusPill` + `getStatusBadge()` | Exactly one status pill per row |
| `CounsellingButton` variants | Primary solid; secondary/ghost for Pre-Auth; ghost icon for demographics |
| `CounsellingSearchInput` / `CounsellingInput` | Filter workspace |
| `PatientDemographicsSheet` kinship | `WaitingListPatientDetailSheet` sections — same restraint, no nested-card overload |
| Journey Rail / Action Bar / module tabs | **Do not use** |

Waiting List borrows **materials**, not **workflow chrome**.

---

## 6. Page Hierarchy

Top → bottom on desktop:

1. **Page context** (plain strip or single thin identity surface — not a Journey Rail)
2. **Operational summary** (optional compact strip — not five KPI cards)
3. **Search & filter workspace** (one widget)
4. **Patient Queue** (dominant widget; grows to fill remaining viewport height)

**Widget count target:** 2–3 meaningful widgets maximum.  
Everything else stays on the grey canvas.

```
┌─────────────────────────────────────────────────────────────┐
│  grey counselling canvas (shellPage)                        │
│  ┌─ Page context (plain or thin) ─────────────────────────┐ │
│  │ Counsellor's Desk · Waiting List · operational line    │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ Compact operational summary (optional thin widget) ───┐ │
│  │ Total 12 · Procedure 4 · Surgery 5 · Repeat 1 · Done 2 │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ Search & Filters widget ──────────────────────────────┐ │
│  │ primary controls … · status views (secondary)          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ Patient Queue widget (flex-1) ────────────────────────┐ │
│  │ column header (same grid)                              │ │
│  │ work rows / OT rows                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Page Context / Header

**Purpose:** Establish workstation identity without adding navigation.

**Recommended content:**

- Eyebrow / product line: `Counsellor's Desk`
- Title: `Waiting List`
- One concise operational line (examples — display only, no new metrics):
  - "Active counselling queue"
  - or filtered context when Apply filters are active (e.g. date range label from existing filter state)

**Rules:**

- Do **not** create another sidebar or in-page nav layer.
- Do **not** copy Session Journey Rail or workflow step track.
- Prefer plain background for this strip (Session puts workflow on plain canvas). If a thin widget is used, it must not compete with Patient Queue height.
- Icons optional and restrained (e.g. existing `Users`); no decorative illustration.

**Resolves UAT:** weak page identity.

---

## 8. Operational Summary

### Verdict on current five-KPI presentation

The V1/current `WaitingListSummaryWidget` five-column large-number grid still reads as a **dashboard KPI strip**, even after MiniBars removal. Large `text-lg`/`text-xl` numerics with equal columns over-weight chrome above the queue.

### MiniBars

**Do not use MiniBars.** They add motion/noise without changing counsellor decisions. Counts already exist; bars do not add clinical value.

### V2 presentation

Prefer a **compact operational summary** modeled on Session's compact status read-back (`sessionStatusStrip` / `sessionStatusDetails` language):

- Single horizontal **inline count strip** inside one thin surface (or the page-context strip itself).
- Format: label + tabular count, separated by middots or quiet vertical rules — **not** five equal "metric cards."
- Typography: counts ~`text-sm`/`text-base` semibold tabular; labels micro/uppercase muted — Session `sessionStatusDetailLabel` / `sessionStatusDetailValue` kinship.
- Height budget: roughly one Session status-strip (~40–48px content), not a second dashboard.

### Metrics (unchanged sources)

Preserve existing page-computed stats only:

| Display | Source meaning (unchanged) |
|---|---|
| Total | Existing total |
| Procedure | Existing procedure count |
| Surgery | Existing surgery count |
| Repeat Counselling | Existing repeat count (label may say "Repeat") |
| Completed | Existing completed/Done count |

**Pre-Auth / Processing:** Only surface if already available from current tab counts / existing computations **without new calculations**. Prefer status tabs to carry Processing / Pre-Auth Queue counts rather than expanding the summary into a sixth KPI engine.

### Placement

- Prefer **below page context, above filter widget**, or integrated into page context as a quiet second line.
- If space is contested on laptop height, summary may collapse into page-context meta line; Queue height wins.

**Resolves UAT:** KPI-dashboard appearance; MiniBars noise.

---

## 9. Search & Filter Workspace

**One** `CounsellingSessionWidget` titled e.g. `Search & Filters` (existing).

### Primary control band (first visual tier)

Left → right (wrap on tablet):

1. `CounsellingSearchInput` — quick search (existing debounce ownership stays on page)
2. Type segment: All / Procedure / Surgery — **one** compact segmented control (`pillTabTrack` / `pillTab*` tokens)
3. Filters toggle (`CounsellingButton` outline/secondary) + active-filter indicator
4. Reset (when active)
5. **Add Patient** — strongest control in this band (`CounsellingButton` primary)

Expanded filter panel (unchanged fields): From, To, Patient Name, MRD, **Apply**.

### Visual hierarchy rules

- Primary band uses larger hit targets and clearer separation.
- Status views must **not** sit as a second equal `pillTabTrack` competing with Type.
- Avoid making every control look like peer navigation pills.

**Resolves UAT:** search/status competition; filter chrome noise.

---

## 10. Status Navigation

Status remains **secondary queue views**, not primary chrome.

**Preserve keys / labels** from `WAITING_LIST_STATUS_TABS`:

| Key | Label |
|---|---|
| All | All |
| Pending | Pending |
| Processed | Processing |
| Done | Done |
| AddOnSurgery | Add-on Surgery |
| RepeatCounselling | Repeat Counselling |
| SurgeryDone | Surgery Done |
| OtReturned | OT Returned |
| PreAuthQueue | Pre-Auth Queue |

**Tab counts:** preserve existing `tabCounts` wiring including OtReturned / PreAuthQueue.

### V2 visual treatment

- Place under a quiet `Status` micro-label (already present) **inside** the filter widget.
- Use a **quieter** control language than Type:
  - **Option A (preferred):** text/segment tabs with underline or soft fill only when selected; smaller type (`text-[11px]`–`12px`); muted inactive.
  - **Option B:** reuse `pillTab*` but visually de-emphasized (lower contrast, denser wrap, no dual "navigation systems" feeling).
- Horizontal wrap preferred over primary horizontal scroll; overflow-x only as last resort on narrow widths.
- Active tab may show count chip; inactive counts stay muted.

**Do not** invent a second status system for PreAuthQueue (see §19).

---

## 11. Patient Queue

Dominant workspace: `WaitingListQueueWidget` + rows.

**Requirements:**

- Title: `Patient Queue` (or contextual when OtReturned / PreAuthQueue).
- Header count: existing numeric count.
- Shared column cue row + identical grid on every data row.
- Flat rows inside one widget — **no per-patient cards**.
- Soft row separators (`divide-y` / hairline) — restrained, Session-border kinship (`border-counselling-border/40`).
- Selected row: quiet `bg-counselling-accent/35` (existing direction).
- Optional left status accent bar may remain **only if** it stays 2px and does not fight the status pill; if it adds noise in UAT, drop accent and keep pill only.
- Queue body scrolls inside the widget; page chrome stays fixed.

**Resolves UAT:** generic table feel → clinical worklist; fills vertical space intentionally.

---

## 12. CSS Grid Column Model

**Mandatory:** CSS Grid — not independent flex widths that let columns collapse.

Shared constant (evolve `WAITING_LIST_WORK_GRID` in `waiting-list-layout.ts`):

**Desktop (≥ sm/md workstation):** five columns — conceptual:

| Column | Role | Width intent |
|---|---|---|
| PATIENT | Identity + meta | Largest flexible track (`minmax(14rem, 1.6fr)` class) |
| PROCEDURE / EYE | Clinical subject | Mid track (`minmax(10rem, 1.2fr)`) |
| STATUS | One pill | Fixed-ish narrow (`minmax(7rem, 8.5rem)` or `max-content` capped) |
| ATTENTION | One plain signal | Mid-narrow (`minmax(7rem, 0.85fr)`) |
| ACTION | Primary + subordinates | Fixed end track (`minmax(9.5rem, 11rem)` or `auto` with `justify-items: end`) |

**Rules:**

- Column **header** and **every normal row** use the **same** `grid-template-columns`.
- Align items center vertically on desktop.
- Gap: controlled `gap-x-3`–`gap-x-4` — enough to separate, not empty oceans.
- Do **not** implement as `<table>` spreadsheet. Semantic/worklist div grid is correct.
- Truncation with `title`/`aria-label` for overflow; never let Procedure bleed into Status.

**OT Returned** uses a **separate** shared grid (`WAITING_LIST_OT_GRID`) — see §20.

**Resolves UAT:** column misalignment; Procedure/Eye vs Status mix; empty columns.

---

## 13. Normal Work Row

**Anatomy (scan order):**

1. **Patient**
2. **Procedure / Eye**
3. **Status**
4. **Attention**
5. **Action**

**Density:**

- Min height ≈ **56–64px** (content + padding).
- Horizontal padding aligned with header cues.
- Three text tiers in Patient zone only (name / UHID·age / meta) — not four competing sizes across the row.
- Procedure line at name-adjacent weight; Status/Attention quieter.

**Interaction:**

- Entire row activates primary navigation (`onRowClick` / existing `handleRowClick` semantics).
- Nested buttons `stopPropagation`.
- Keyboard: Enter / Space on row; focus-visible ring using counselling primary ring token.

**Component:** continue `WaitingListWorkRow` (redesign styles/layout only).

---

## 14. Patient Identity

**Strongest text in the row:** patient name.

| Line | Content | Type intent |
|---|---|---|
| 1 | `patientName` | Semibold ~15–16px (readable; not Session 20px hero) |
| 2 | UHID · Age | Medium muted ~12.5–13px; **never monospace** |
| 3 | Type · Patient Type · Doctor · Time · SL No. | Quiet meta ~12px; middot-separated |

**Display hygiene (presentation only — do not alter backend data):**

- Use `formatWaitingListDoctorDisplay` to collapse duplicated `Dr. Dr.` prefixes.
- Human-readable labels only; no camelCase enum dumps.
- Time via existing `formatTime` where applicable.

---

## 15. Procedure / Eye

**Eye MUST visually belong to Procedure** in one cell:

```
Lasik · BE
```

- Single truncated line in the PROCEDURE / EYE column.
- Never place Eye under Status or as a separate floating chip that drifts.
- Missing procedure → em-dash; missing eye → omit eye segment.

---

## 16. Status

- Exactly **one** status pill per row.
- Source: existing `getStatusBadge(patient.status)`.
- Token: `counsellingSessionTokens.statusPill` + badge `cls`.
- `Processed` displays as **Processing**; internal key stays `Processed`.
- No second pill for attention or Pre-Auth.

---

## 17. Attention

- Source: existing `resolveWaitingListAttention()` — **no semantic changes**.
- Presentation: **plain text only** (not a pill, not a badge, not a filled chip).
- Colour: restrained semantic amber text (`text-amber-800` / Session warning kinship) — **not** colour-only (text content carries meaning).
- Compact truncation; full string in `title` and included in row `aria-label`.
- Empty → quiet em dash or blank (prefer blank if em dash adds noise).
- **Must not dominate** the queue when many rows show `Pre-Auth Required` — weight below Patient/Procedure/Action.

**Resolves UAT:** Attention visual over-weight.

---

## 18. Actions

Preserve all existing actions; fix hierarchy.

| Priority | Control | Treatment |
|---|---|---|
| Primary | Start / Continue / View / Open, or **Pre-Auth** when `resolveWaitingListPrimaryAction` returns `preauth` (PreAuthQueue + coverage) | One solid `CounsellingButton` (default primary token) — dominant width/weight |
| Secondary | Pre-Auth when coverage and not already primary | Ghost/text `CounsellingButton` — muted, smaller |
| Utility | Patient details | Icon-only ghost (`User`); accessible name "Patient details" |

**Rules:**

- Reuse counselling button tokens only — no new palette.
- Do not remove actions.
- Green must not paint the entire action column; one primary button is enough.
- Touch targets ≥ 32–36px height on desktop; ≥ 40px where tap-primary on narrow.

**Resolves UAT:** equal-weight buttons; green dominance.

---

## 19. Pre-Auth Queue

**Exact SoT (unchanged):**

- `isCoveragePaymentTypeValue`
- `isWaitingListPreAuthQueue`
- `isCcmsPreAuthAwaiting`
- `CCMS_PREAUTH_AWAITING_STATES`
- Deferred badges via `useDeferredCcmsBadges` — unresolved badges must not invent queue membership

**Visual communication without a second status system:**

- Queue title / empty copy may say Pre-Auth Queue context.
- Status column still uses `getStatusBadge()` for counselling status.
- Attention may show `CCMS Awaiting` / `Pre-Auth Required` via existing resolver.
- Primary action becomes Pre-Auth when resolver says so.
- Optional quiet contextual hint in queue headerAction (count only today) — do not add a parallel status taxonomy.

---

## 20. OT Returned

**Do not force** Patient / Procedure / Status / Attention / Action.

**Separate anatomy + shared OT grid:**

| Column | Content |
|---|---|
| # / UHID | Journey index + UHID |
| Patient | Name (+ quiet meta if already available) |
| Procedure | Procedure text |
| Return Reason | `otReturnReason` |
| Surgery Date | Existing date display |
| Action | Existing `resolveOtReturnedAction` primary only |

Same counselling materials; `WaitingListOtReturnedRow` stays distinct. No new OT logic; `ipManagementApi.listJourneys` ReadyForSurgery + reason filter unchanged.

---

## 21. Patient Detail Sheet

Continue `WaitingListPatientDetailSheet` direction:

- shadcn `Sheet` primitives
- Strong patient identity in header (name + UHID)
- Meaningful sections (identity, counselling/queue fields, follow-up/upgrade when present)
- Field rows like Session demographics restraint — **no nested-card overload**
- Display-only formatting (`formatPatientDob`, `formatPatientSex`, etc.)
- **No invented demographics; no new patient API**

Kinship: Session header → `PatientDemographicsSheet` pattern, adapted to waiting-list payload fields only.

---

## 22. Loading

- Initial queue load: skeleton rows that **mirror the same CSS Grid** (already sketched in `WaitingListQueueWidget`).
- Filter/summary chrome may remain visible.
- OT Returned: existing OT loading flag → same skeleton mode `ot-returned`.
- Soft refresh: preserve non-destructive refresh indicator if already present; do not block entire page unnecessarily.
- CCMS badges: deferred — rows render without inventing PreAuth membership while pending.

---

## 23. Empty

- Empty state **inside** Queue widget body (not a separate page card stack).
- Copy contextual to tab (All / PreAuthQueue / OtReturned / filtered).
- Offer Reset when filters active; never fake demo rows.

---

## 24. Error

- Preserve existing waiting-list query error surfacing (toast / inline as currently wired).
- Failed load must not look like an empty successful queue.
- No silent discard of queue data.
- Integration/CCMS failure must not fabricate PreAuthQueue membership.

---

## 25. Responsive Behaviour

### Desktop workstation (primary)

- Five-column grid; queue fills remaining height.
- Multi-patient scanning optimized; density 56–64px rows.

### Tablet

- Keep five columns if width ≥ ~768–900px with slightly tighter tracks.
- If cramped: allow Procedure+meta to truncate earlier; keep Patient + Action visible.
- Status tabs wrap; primary filter band stacks search above controls.

### Narrow / mobile

- **Do not** use horizontal scroll of the whole worklist as the primary solution.
- Transform grid to **stacked work row**:
  - Row 1: Patient name + primary action
  - Row 2: UHID · age · meta
  - Row 3: Procedure · Eye
  - Row 4: Status pill + Attention text
- Column cue header hidden on narrow (already `hidden sm:grid`).
- OT Returned: analogous stack (Patient / Reason / Date / Action).
- Touch targets enlarged; Sheet remains full-height drawer pattern.

---

## 26. Accessibility

| Requirement | Spec |
|---|---|
| Keyboard rows | `role="button"` (or equivalent), tabIndex 0, Enter/Space |
| focus-visible | Counselling primary ring; visible on rows and controls |
| Nested buttons | `stopPropagation` on Pre-Auth, primary, demographics |
| Demographics control | Accessible name; not mouse-only |
| Status / Attention | Text labels — not colour-only |
| Touch targets | ≥ 32px desktop controls; comfortable tap on narrow |
| Sheet | Focus trap / dismiss via existing shadcn Sheet a11y |
| Status tabs | `role="tablist"` / `aria-selected` (preserve) |
| Type control | `role="group"` + `aria-pressed` (preserve) |
| Live region | Optional polite announce on tab change count — only if already patterned; do not invent noisy announcements |

---

## 27. Performance

**Preserve:**

- React Query `useWaitingListQuery` / invalidation behaviour
- Debounced quick search
- Client filter engine `applyWaitingListClientFilters`
- Deferred CCMS badge batching (`useDeferredCcmsBadges`)
- Existing staleTime / query keys

**Do not add:**

- Polling, SignalR, N+1 patient APIs per row, per-row network for demographics
- Heavy animation libraries or decorative motion

Row memoization (`memo` on `WaitingListWorkRow`) may remain.

---

## 28. Design Tokens

**Source of truth:** `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-session-tokens.ts` + Session theme CSS under `.counselling-session`.

| Concern | Token / primitive (evidence-based) |
|---|---|
| Page canvas | `shellPage` |
| Widget surface | `sessionWidget` via `CounsellingSessionWidget` |
| Widget padding | `sessionWidgetPad` (tune denser if needed without new token file) |
| Widget title | `sessionWidgetTitle` |
| Micro labels | `microLabel` |
| Status pills | `statusPill` + `getStatusBadge().cls` |
| Type segments | `pillTabTrack`, `pillTab`, `pillTabCurrent`, `pillTabMuted` |
| Buttons | `CounsellingButton` |
| Search | `CounsellingSearchInput` |
| Inputs | `CounsellingInput` |
| Attention text | Restrained amber text (Session warning kinship) — not a new attention token pack |
| Selection | `bg-counselling-accent/35` |
| Borders / dividers | `border-counselling-border/40`–`/70` |

**Do not** create a waiting-list-only colour system.

---

## 29. Complete Field Mapping

### Normal counselling row → UI

| UI | Field / resolver | Notes |
|---|---|---|
| Name | `patient.patientName` | Strongest text |
| UHID | `patient.uhid` | Never mono |
| Age | `patient.age` | `· N yrs` when > 0 |
| Type | `patient.type` | Meta |
| Patient Type | `patient.patientType` | Meta; coverage gate input |
| Doctor | `patient.doctor` | `formatWaitingListDoctorDisplay` |
| Time | `patient.time` | `formatTime` when clock-like |
| SL No. | `patient.slNo` | `#n` |
| Procedure | `patient.surgeryName` | With eye |
| Eye | `patient.eye` | Same cell as procedure |
| Status pill | `getStatusBadge(patient.status)` | Processed → Processing label |
| Attention | `resolveWaitingListAttention(...)` | Plain text |
| Primary action | `resolveWaitingListPrimaryAction(...)` | Label + kind |
| Secondary Pre-Auth | `isCoveragePaymentTypeValue` && tab ≠ PreAuthQueue | Ghost |
| Demographics | opens sheet with same `WaitingListPatient` | No extra fetch |
| CCMS inputs | deferred badge `state` / ready flag | No invented membership |

### Filter / chrome fields

Quick search; type; fromDate; toDate; patientName; mrd; Apply; Reset; Add Patient; status tabs + counts — all existing page state.

### OT Returned

Existing journey DTO fields + `resolveOtReturnedAction` — unchanged mapping conceptually; layout-only redesign.

### Detail sheet

Existing sheet field set only — no new properties.

---

## 30. Existing Handler / Business Rule Preservation

**Absolutely unchanged in V2 implementation (when later authorized):**

| Area | Preserve |
|---|---|
| API | `GET /Counseling/waiting-list` via `useWaitingListQuery` / `counsellorsDeskApi.getWaitingList` |
| Row click | Existing `handleRowClick` / azure start for Pending & RepeatCounselling + navigate `/dashboard/counsellors-desk/{id}` |
| Pre-Auth | Existing `handlePreAuth` → `?tab=coverage&subtab=preauth` |
| Coverage gate | `isCoveragePaymentTypeValue` |
| PreAuthQueue membership | `isWaitingListPreAuthQueue` + awaiting helpers + deferred ready gate |
| OT Returned | `ipManagementApi.listJourneys` + reason filter + action resolver |
| Filters | Client type/tabs/quick search; server Apply dates/name/MRD; API type forced `All` as today |
| Add Patient | Existing modal / callback |
| Permissions / nav | Existing |
| Status enums | No new keys |
| Attention / primary resolvers | Semantics frozen; presentation only |

V2 may restyle components and shared grid constants; it must not change callbacks' business outcomes.

---

## 31. Component Architecture

**Keep ownership boundaries** (page owns queries/handlers; children presentational):

| Unit | Path (existing) | V2 role |
|---|---|---|
| Page | `.../waiting-list/page.tsx` | Orchestration only |
| Summary | `WaitingListSummaryWidget.tsx` | Restyle to compact strip **or** fold into page context |
| Filter | `WaitingListFilterToolbar.tsx` | Primary vs secondary hierarchy |
| Queue shell | `WaitingListQueueWidget.tsx` | Dominant scroll host + shared header grid |
| Work row | `WaitingListWorkRow.tsx` | Grid anatomy redesign |
| OT row | `WaitingListOtReturnedRow.tsx` | Separate OT grid anatomy |
| Detail sheet | `WaitingListPatientDetailSheet.tsx` | Visual kinship polish only |
| Layout constants | `waiting-list-layout.ts` | Strengthen shared templates |
| Attention / primary | `waiting-list-attention.ts`, `waiting-list-primary-action.ts` | Unchanged logic |
| Legacy row | `WaitingListRow.tsx` | Remains on disk until explicit retirement task |

**Reuse (do not invent names without evidence):**

- `CounsellingSessionWidget`
- `CounsellingButton`, `CounsellingSearchInput`, `CounsellingInput`
- `counsellingSessionTokens`
- shadcn `Sheet*`
- `AddPatientModal` (dynamic import as today)

Optional thin presentational helper for page context header **only if** needed — prefer extending page JSX over a new design-system package.

---

## 32. Testing Requirements

When implementation is later authorized:

- **Do not weaken** existing unit tests for attention / primary-action resolvers (semantics unchanged).
- Update component tests only for presentation contracts that intentionally change (e.g. MiniBars absence, compact summary structure, grid role attributes).
- Preserve behavioural tests: tab keys, Processing label, PreAuthQueue gating, OT mode, filter Apply/Reset wiring via callbacks.
- No new E2E mandatory for design-only approval of this document.
- Browser UAT checklist (§33) is the visual acceptance gate.

---

## 33. Browser UAT Checklist

Approve V2 UI only when **all** pass:

- [ ] Page reads as Counsellor's Desk Waiting List workstation, not admin KPI dashboard
- [ ] Grey canvas + white widgets + plain gutters match Session materials
- [ ] No Journey Rail / Session workflow chrome
- [ ] Summary is compact strip (or folded) — not five KPI cards; no MiniBars
- [ ] Search/Type/Filters/Add Patient clearly primary; Status clearly secondary
- [ ] Patient Queue dominates viewport height
- [ ] Column header and rows share identical alignment (Patient / Procedure·Eye / Status / Attention / Action)
- [ ] Procedure · Eye never drifts into Status
- [ ] Patient name strongest; UHID not monospace; no `Dr. Dr.` duplication in display
- [ ] One status pill; Processed shows Processing
- [ ] Attention plain, compact, non-dominant
- [ ] One dominant primary action; Pre-Auth secondary; demographics utility
- [ ] PreAuthQueue communicates via existing status + attention + primary action — no second status system
- [ ] OT Returned uses separate columns and still matches counselling materials
- [ ] Detail sheet strong identity, no nested-card overload, no invented fields
- [ ] Desktop density ~56–64px rows; less wasted horizontal whitespace
- [ ] Narrow: stacked row, no primary horizontal scroll of whole queue
- [ ] Keyboard focus-visible; nested buttons do not double-fire row navigation
- [ ] Loading / empty / error distinguishable
- [ ] No PHI in console; no API/handler regressions in smoke paths (start/continue, Pre-Auth, Add Patient, filters, OT)

---

## 34. Definition of Done

This **specification** is done when:

1. This file exists at the path below and covers sections 1–34.
2. It explains why V1/current UI failed visually and how V2 composition fixes each UAT defect.
3. It freezes business-rule non-changes and reusable token/component evidence.
4. Stakeholders explicitly approve this V2 design **before** any new implementation plan or code.

**Implementation DoD (future, not this task):** visual UAT checklist §33 pass + preserved handlers/tests + no backend changes + no unapproved commits.

---

## Appendix A — Why V1 Failed vs How V2 Fixes It

| V1 / current failure | V2 fix |
|---|---|
| Five equal KPI cells | Compact inline operational strip / Session status-strip kinship |
| MiniBars | Explicitly forbidden |
| Dual pill navigation (Type + Status) | Primary band vs secondary status treatment |
| Weak shared alignment | Mandatory identical CSS Grid template header+rows; intentional track sizes |
| Procedure/Eye vs Status mix | Single Procedure·Eye cell; Status track capped |
| Attention dominance | Plain amber text, lower visual weight |
| Peer action buttons | Primary solid / secondary ghost / utility icon |
| Small type + large empty space | Larger identity type + denser padding + tracks that consume width |
| Table-like queue | Worklist rows in one dominant widget; Session surfaces |
| Weak page identity | Explicit Counsellor's Desk · Waiting List context |

---

## Appendix B — Explicit stop

**After this document:** stop.  
No implementation plan. No production code. No test changes. No commit.  
Wait for explicit approval of this V2 design specification.

---

*End of V2 design specification.*
