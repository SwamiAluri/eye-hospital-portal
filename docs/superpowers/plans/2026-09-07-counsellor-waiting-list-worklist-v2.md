# Counsellor Waiting List V2 — Clinical Operational Worklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visually redesign the existing Counsellor Waiting List into a clinical operational worklist that matches Counselling Session materials (compact summary, Option A status nav, shared CSS Grid rows) without changing business logic.

**Architecture:** Keep `waiting-list/page.tsx` as the thin orchestrator (queries, filters, handlers). Restyle existing presentational widgets under `src/components/counsellors-desk/waiting-list/`. Strengthen shared grid constants in `waiting-list-layout.ts`. Do not rebuild resolvers or invent new APIs. Page hierarchy is locked: **page context → compact operational summary → filters → Patient Queue**.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, TanStack Query, Tailwind, shadcn Sheet, counselling-session tokens/primitives, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-counsellor-waiting-list-worklist-v2.md`  
**Prior plan (do not re-execute as greenfield):** `docs/superpowers/plans/2026-09-05-counsellor-waiting-list-worklist.md`  
**V1 design (historical):** `docs/superpowers/specs/2026-09-05-counsellor-waiting-list-worklist-design.md`

## Global Constraints

- Frontend-only visual/composition redesign; **no** backend/API/DTO/permission/enum/state-machine changes.
- **No** changes to handler semantics: `handleRowClick`, `handlePreAuth`, `handleDemographics`, `handleAddPatient`, `handleSearch`, `handleReset`, OT fetch, deferred CCMS badges.
- Preserve Pre-Auth SoT: `isCoveragePaymentTypeValue`, `isWaitingListPreAuthQueue`, `isCcmsPreAuthAwaiting`, `CCMS_PREAUTH_AWAITING_STATES`; unresolved badges must not invent PreAuthQueue membership.
- Preserve filter semantics: server Apply for dates/name/MRD; client for type, status tabs, quick search, PreAuthQueue/OtReturned.
- **No MiniBars.** No five KPI metric cards. No Journey Rail / Session Action Bar / Quote layout. No card-per-patient. No nested widgets.
- Status display: `Processed` → label **Processing**; key stays `Processed`. One status pill via `getStatusBadge`. Attention = plain text via `resolveWaitingListAttention` (semantics frozen).
- UHID: readable secondary text — **not** `font-mono`. Doctor display via `formatWaitingListDoctorDisplay` (presentation only).
- Scope page under `.counselling-session` / `counsellingSessionTokens.shellPage`.
- Working directory for commands: `apps/hospital-portal-web`.
- **Do not delete** `WaitingListRow.tsx` until Task 8 is explicitly approved after UAT.
- **Do not commit** unless the user explicitly asks in the execution session; this repo is often dirty — never `git add .`.
- Prefer TDD for new presentation contracts; keep existing waiting-list unit suites green after every task.

## Locked implementation preferences (from approval)

1. **Compact operational summary remains visible** between page context and filters (do not fold it away into the page-context meta line as the default).
2. **Status uses Option A** (quieter text / underline / soft active). Repository evidence: reuse `counsellingSessionTokens.workspaceStepNav`, `workspaceStepItem`, `workspaceStepItemActive` (border-bottom active). **Do not** use Option B (`pillTab*` for Status) unless a later UAT explicitly reverses this preference. Type chips may still use `pillTab*` because they are primary chrome.

## Repository discovery (locked)

### Canonical files (already exist — redesign, do not recreate from scratch)

| Concern | Path |
|---|---|
| Page | `src/app/dashboard/counsellors-desk/waiting-list/page.tsx` |
| Summary | `src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx` |
| Filter | `src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.tsx` |
| Queue | `src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx` |
| Work row | `src/components/counsellors-desk/waiting-list/WaitingListWorkRow.tsx` |
| OT row | `src/components/counsellors-desk/waiting-list/WaitingListOtReturnedRow.tsx` |
| Detail sheet | `src/components/counsellors-desk/waiting-list/WaitingListPatientDetailSheet.tsx` |
| Layout | `src/lib/counsellors-desk/waiting-list-layout.ts` |
| Attention | `src/lib/counsellors-desk/waiting-list-attention.ts` (+ `.test.ts`) |
| Primary action | `src/lib/counsellors-desk/waiting-list-primary-action.ts` (+ `.test.ts`) |
| Legacy row (keep) | `src/components/counsellors-desk/WaitingListRow.tsx` |
| Tokens | `src/lib/counsellors-desk/counselling-session-tokens.ts` |

### Reuse (import; do not invent)

- `CounsellingSessionWidget`, `CounsellingButton`, `CounsellingSearchInput`, `CounsellingInput`
- `counsellingSessionTokens.shellPage`, `sessionWidget*`, `statusPill`, `microLabel`, `sessionStatusStrip` / `sessionStatusDetail*`, `workspaceStep*`, `pillTab*` (Type only)
- `getStatusBadge`, `formatTime`, `isCoveragePaymentTypeValue` from `session-utils`
- shadcn `Sheet*`

### Regression command (run after each wiring task)

```bash
npx vitest run src/lib/counsellors-desk/waiting-list-attention.test.ts src/lib/counsellors-desk/waiting-list-primary-action.test.ts src/lib/counsellors-desk/waiting-list-client-filters.test.ts src/lib/counsellors-desk/waiting-list-preauth.test.ts src/lib/counsellors-desk/waiting-list-follow-up.test.ts src/lib/counsellors-desk/ot-returned-action.test.ts
```

Expected: all PASS.

---

## Target page hierarchy (locked)

```tsx
<div className={cn(counsellingSessionTokens.shellPage, '…')}>
  {/* 1. Page context — plain strip */}
  <header>… Counsellor's Desk / Waiting List …</header>

  {/* 2. Compact operational summary — MUST remain visible here */}
  <WaitingListSummaryWidget stats={stats} />

  {/* 3. Search & filters */}
  <WaitingListFilterToolbar … />

  {/* 4. Dominant Patient Queue */}
  <WaitingListQueueWidget className="min-h-0 flex-1" …>
    {/* WaitingListWorkRow | WaitingListOtReturnedRow */}
  </WaitingListQueueWidget>

  <WaitingListPatientDetailSheet … />
  {/* AddPatientModal unchanged */}
</div>
```

---

### Task 1: Strengthen shared CSS Grid templates

**Files:**
- Modify: `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-layout.ts`
- Create: `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-layout.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `WAITING_LIST_WORK_GRID: string` — desktop five tracks for Patient / Procedure·Eye / Status / Attention / Action
  - `WAITING_LIST_OT_GRID: string` — separate OT tracks
  - `formatWaitingListDoctorDisplay(raw: string | null | undefined): string` (unchanged behaviour)

**Target desktop work grid (intentional unequal tracks — adjust Tailwind arbitrary values to match):**

```ts
export const WAITING_LIST_WORK_GRID =
  'grid w-full min-w-0 grid-cols-1 gap-y-1.5 sm:grid-cols-[minmax(14rem,1.6fr)_minmax(10rem,1.2fr)_minmax(7rem,8.5rem)_minmax(7rem,0.85fr)_minmax(9.5rem,11rem)] sm:items-center sm:gap-x-3 md:gap-x-4';

export const WAITING_LIST_OT_GRID =
  'grid w-full min-w-0 grid-cols-1 gap-y-1.5 sm:grid-cols-[minmax(12rem,1.35fr)_minmax(9rem,1fr)_minmax(9rem,1.1fr)_minmax(6.5rem,0.7fr)_minmax(8.5rem,10rem)] sm:items-center sm:gap-x-3 md:gap-x-4';
```

- [ ] **Step 1: Write failing tests** for doctor display + grid contract markers

```ts
import { describe, expect, it } from 'vitest';
import {
  WAITING_LIST_WORK_GRID,
  WAITING_LIST_OT_GRID,
  formatWaitingListDoctorDisplay,
} from './waiting-list-layout';

describe('formatWaitingListDoctorDisplay', () => {
  it('collapses repeated Dr prefixes', () => {
    expect(formatWaitingListDoctorDisplay('Dr. Dr. Smith')).toBe('Dr. Smith');
  });
  it('returns empty for blank', () => {
    expect(formatWaitingListDoctorDisplay('  ')).toBe('');
  });
});

describe('waiting list grids', () => {
  it('work grid is css grid with five desktop tracks', () => {
    expect(WAITING_LIST_WORK_GRID).toContain('grid');
    expect(WAITING_LIST_WORK_GRID).toMatch(/sm:grid-cols-\[/);
    expect(WAITING_LIST_WORK_GRID.split('_').length).toBeGreaterThanOrEqual(5);
  });
  it('ot grid remains a separate template', () => {
    expect(WAITING_LIST_OT_GRID).not.toEqual(WAITING_LIST_WORK_GRID);
    expect(WAITING_LIST_OT_GRID).toMatch(/sm:grid-cols-\[/);
  });
});
```

- [ ] **Step 2: Run test**

```bash
npx vitest run src/lib/counsellors-desk/waiting-list-layout.test.ts
```

Expected: FAIL if grid still uses weak `minmax(0,…)` tracks, or PASS after Step 3 if tests only assert structure (prefer asserting `1.6fr` / `8.5rem` present so Step 2 fails before update).

- [ ] **Step 3: Update `waiting-list-layout.ts`** to the target track strings above (or equivalent that keeps five named conceptual columns and removes giant empty flex).

- [ ] **Step 4: Re-run layout tests — Expected: PASS

- [ ] **Step 5: Commit only if user authorized**

```bash
git add src/lib/counsellors-desk/waiting-list-layout.ts src/lib/counsellors-desk/waiting-list-layout.test.ts
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "fix(counselling): strengthen waiting-list CSS grid column tracks"
```

---

### Task 2: Compact operational summary (keep visible)

**Files:**
- Modify: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx`
- Create: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.test.tsx`

**Interfaces:**
- Consumes (unchanged):

```ts
export type WaitingListSummaryStats = {
  total: number;
  procedure: number;
  surgery: number;
  repeat: number;
  completed: number;
};

export type WaitingListSummaryWidgetProps = {
  stats: WaitingListSummaryStats;
  className?: string;
  'data-testid'?: string;
};
```

- Produces: thin presentational strip; **non-interactive**; **no MiniBars**; **no five KPI cards**

**Visual target:** Session status-strip kinship — one horizontal inline count row inside `CounsellingSessionWidget` **or** a surface using `sessionStatusStrip` / `sessionStatusDetails` tokens. Counts `text-sm`/`text-base` semibold tabular; labels micro muted. Height ~40–48px content.

**Placement preference (locked):** Page keeps this widget **between** page context and filters (Task 7). Do not remove the widget or hide it by default.

- [ ] **Step 1: Write failing presentation test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WaitingListSummaryWidget } from './WaitingListSummaryWidget';

describe('WaitingListSummaryWidget V2', () => {
  it('renders existing stats as compact inline summary without MiniBars', () => {
    render(
      <WaitingListSummaryWidget
        stats={{ total: 12, procedure: 4, surgery: 5, repeat: 1, completed: 2 }}
      />,
    );
    expect(screen.getByTestId('waiting-list-summary')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/Total/i)).toBeInTheDocument();
    expect(screen.queryByTestId('waiting-list-summary-minibar')).not.toBeInTheDocument();
    // KPI-card smell: avoid five equal text-xl metric blocks — assert compact class contract
    expect(screen.getByTestId('waiting-list-summary-strip')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (missing `waiting-list-summary-strip`)

```bash
npx vitest run src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.test.tsx
```

- [ ] **Step 3: Implement compact strip**

Replace the five-column large-number grid with something equivalent to:

```tsx
<div
  data-testid="waiting-list-summary-strip"
  className={cn(counsellingSessionTokens.sessionStatusDetails, 'sm:!grid-cols-5')}
>
  {METRICS.map(({ key, label }) => (
    <div key={key} className="min-w-0">
      <p className={counsellingSessionTokens.sessionStatusDetailLabel}>{label}</p>
      <p className="text-sm font-semibold tabular-nums text-counselling-foreground sm:text-base">
        {stats[key]}
      </p>
    </div>
  ))}
</div>
```

Keep widget title quiet (e.g. `Queue Summary` or omit decorative chrome). **Do not** add Pre-Auth/Processing counts unless already passed in without new calculations (default: do not expand props).

- [ ] **Step 4: Re-run summary test + regression suite — Expected: PASS**

- [ ] **Step 5: Commit only if user authorized**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.test.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "fix(counselling): compact waiting-list operational summary strip"
```

---

### Task 3: Filter workspace — primary band + Status Option A

**Files:**
- Modify: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.tsx`
- Create: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.test.tsx`

**Interfaces:**
- Consumes: existing `WaitingListFilterToolbarProps` (do not change callback ownership)
- Produces: same controlled behaviour; visual hierarchy only
- Preserve export: `WAITING_LIST_STATUS_TABS` (Processed → Processing label)

**Primary band:** Search · Type (`pillTab*`) · Filters · Reset · Add Patient (primary button)  
**Secondary:** Status Option A using `workspaceStepNav` + `workspaceStepItem` / `workspaceStepItemActive` — **not** a second equal `pillTabTrack`.

- [ ] **Step 1: Write failing test** for Option A status treatment + Processing label

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  WaitingListFilterToolbar,
  WAITING_LIST_STATUS_TABS,
} from './WaitingListFilterToolbar';

const baseProps = {
  quickSearch: '',
  onQuickSearchChange: vi.fn(),
  filters: {
    fromDate: '', toDate: '', patientName: '', mrd: '', type: 'All' as const, status: '',
  },
  onFiltersChange: vi.fn(),
  showFilters: false,
  onToggleFilters: vi.fn(),
  onApply: vi.fn(),
  onReset: vi.fn(),
  activeTab: 'All',
  onTabChange: vi.fn(),
  tabCounts: Object.fromEntries(WAITING_LIST_STATUS_TABS.map((t) => [t.key, 0])),
  hasActiveFilters: false,
  onAddPatient: vi.fn(),
};

describe('WaitingListFilterToolbar V2', () => {
  it('shows Processing label for Processed key', () => {
    render(<WaitingListFilterToolbar {...baseProps} />);
    expect(screen.getByTestId('waiting-list-status-tab-Processed')).toHaveTextContent(/Processing/);
  });

  it('renders status tabs with Option A quiet treatment', () => {
    render(<WaitingListFilterToolbar {...baseProps} />);
    const list = screen.getByRole('tablist', { name: /queue status/i });
    expect(list).toHaveAttribute('data-status-style', 'option-a');
  });

  it('calls onTabChange when a status tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<WaitingListFilterToolbar {...baseProps} onTabChange={onTabChange} />);
    await user.click(screen.getByTestId('waiting-list-status-tab-Pending'));
    expect(onTabChange).toHaveBeenCalledWith('Pending');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** on `data-status-style`

```bash
npx vitest run src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.test.tsx
```

- [ ] **Step 3: Implement hierarchy + Option A**

Status row sketch:

```tsx
<div className="border-t border-counselling-border/50 pt-2">
  <p className={cn(counsellingSessionTokens.microLabel, 'mb-1.5 text-[10px]')}>Status</p>
  <div
    role="tablist"
    aria-label="Queue status"
    data-status-style="option-a"
    className={cn(
      counsellingSessionTokens.workspaceStepNav,
      'flex max-w-full flex-wrap items-center gap-x-3 gap-y-1',
    )}
  >
    {statusTabs.map(({ key, label }) => {
      const isActive = activeTab === key;
      return (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={isActive}
          data-testid={`waiting-list-status-tab-${key}`}
          onClick={() => onTabChange(key)}
          className={cn(
            counsellingSessionTokens.workspaceStepItem,
            'min-h-8 gap-1.5 whitespace-nowrap text-[11px] sm:text-xs',
            isActive && counsellingSessionTokens.workspaceStepItemActive,
          )}
        >
          {label}
          <span className="tabular-nums text-[10px] opacity-80">{tabCounts[key] ?? 0}</span>
        </button>
      );
    })}
  </div>
</div>
```

Keep Type on `pillTab*`. Ensure Add Patient remains the strongest primary control in the top band.

- [ ] **Step 4: Re-run filter tests + regression suite — Expected: PASS**

- [ ] **Step 5: Commit only if user authorized**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.tsx src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.test.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "fix(counselling): waiting-list filter hierarchy and Option A status nav"
```

---

### Task 4: Normal work row — density, grid anatomy, action hierarchy

**Files:**
- Modify: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListWorkRow.tsx`
- Create: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListWorkRow.test.tsx`

**Interfaces:**
- Consumes: existing `WaitingListWorkRowProps` (callbacks unchanged)
- Produces: same navigation/preauth/demographics behaviour; visual redesign only
- Must use `WAITING_LIST_WORK_GRID` from Task 1
- Must call `resolveWaitingListAttention` / `resolveWaitingListPrimaryAction` / `getStatusBadge` unchanged

**Row contract:**
- Min height ~56–64px (`min-h-14` / `py-2.5` class of)
- Patient name ~15–16px semibold; UHID not mono; meta middots; doctor via `formatWaitingListDoctorDisplay`
- Procedure · Eye in one cell
- One status pill; Attention plain amber text (non-dominant)
- Actions: solid primary · ghost Pre-Auth (when secondary) · icon demographics
- Prefer dropping left status accent bar if it still fights the pill (spec allows either; default V2: **remove** accent bar unless UAT asks to restore)

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WaitingListWorkRow } from './WaitingListWorkRow';
import type { WaitingListPatient } from '@/types/counsellors-desk';

const patient = {
  id: 'p1',
  patientName: 'Ada Lovelace',
  uhid: 'UHID-1',
  age: 42,
  type: 'Surgery',
  patientType: 'Cash',
  doctor: 'Dr. Dr. Strange',
  time: '09:30',
  slNo: 3,
  surgeryName: 'Lasik',
  eye: 'BE',
  status: 'Pending',
} as WaitingListPatient;

describe('WaitingListWorkRow V2', () => {
  it('groups procedure and eye and collapses Dr prefix', () => {
    render(
      <WaitingListWorkRow
        patient={patient}
        isSelected={false}
        activeTab="All"
        hasCcmsCase={false}
        onRowClick={vi.fn()}
        onDemographics={vi.fn()}
        onPreAuth={vi.fn()}
      />,
    );
    expect(screen.getByText(/Lasik · BE/)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Strange/)).toBeInTheDocument();
    expect(screen.queryByText(/Dr\. Dr\. Strange/)).not.toBeInTheDocument();
  });

  it('keeps nested primary click from relying on row only via stopPropagation', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onPreAuth = vi.fn();
    render(
      <WaitingListWorkRow
        patient={{ ...patient, patientType: 'Insurance' }}
        isSelected={false}
        activeTab="All"
        hasCcmsCase={false}
        onRowClick={onRowClick}
        onDemographics={vi.fn()}
        onPreAuth={onPreAuth}
      />,
    );
    await user.click(screen.getByRole('button', { name: /pre-auth/i }));
    expect(onPreAuth).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — fix failures by implementing row markup**

```bash
npx vitest run src/components/counsellors-desk/waiting-list/WaitingListWorkRow.test.tsx
```

- [ ] **Step 3: Implement row visual redesign** using shared grid; action hierarchy; quieter attention (`text-[12px] font-medium text-amber-800/80` or similar — not a filled chip). Primary `CounsellingButton` solid; secondary Pre-Auth ghost; demographics icon `aria-label="Patient details"`.

Narrow: keep `grid-cols-1` stack order Patient → Procedure → Status/Attention → Action (existing responsive direction). Ensure `sm:` uses five columns from Task 1.

- [ ] **Step 4: Run work-row tests + attention/primary-action regression — Expected: PASS**

- [ ] **Step 5: Commit only if user authorized**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListWorkRow.tsx src/components/counsellors-desk/waiting-list/WaitingListWorkRow.test.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "fix(counselling): waiting-list work row density and action hierarchy"
```

---

### Task 5: Queue shell + OT Returned row visual alignment

**Files:**
- Modify: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx`
- Modify: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListOtReturnedRow.tsx`

**Interfaces:**
- Queue props unchanged (`mode`, `count`, loading/empty, children)
- OT row props unchanged (`row`, `index`, `onNavigate`)
- Header cues and skeleton **must** use the same `WAITING_LIST_WORK_GRID` / `WAITING_LIST_OT_GRID` as rows

**OT columns (do not force counselling five):** `# / UHID`+Patient · Procedure · Return Reason · Surgery Date · Action — match `WAITING_LIST_OT_GRID` tracks. Preserve `resolveOtReturnedAction`.

- [ ] **Step 1: Update Queue widget**
  - Column cue typography: `microLabel`, slightly stronger tracking
  - Body scroll: ensure `scrollBody` or internal `overflow-y-auto min-h-0` so queue dominates viewport when page is flex column
  - Skeleton rows: `min-h-14`, same grid
  - Optional: contextual title when parent passes title for PreAuthQueue/OtReturned (page may pass `title` prop — already supported)

- [ ] **Step 2: Update OT row** density/type to match work-row materials (name weight, muted UHID, one primary action button). Keep rose accent only if quiet; otherwise soft hover only.

- [ ] **Step 3: Run regression suite — Expected: PASS**

- [ ] **Step 4: Commit only if user authorized**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx src/components/counsellors-desk/waiting-list/WaitingListOtReturnedRow.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "fix(counselling): waiting-list queue shell and OT row alignment"
```

---

### Task 6: Patient detail sheet visual kinship polish

**Files:**
- Modify: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListPatientDetailSheet.tsx`

**Interfaces:**
- Props unchanged: `{ patient, open, onClose }`
- No new fields; no patient API calls

- [ ] **Step 1: Strengthen header identity** — patient name prominent; UHID secondary; sections with clear titles; field rows without nested cards/shadows.

- [ ] **Step 2: Manual/IDE typecheck** — no prop/API additions.

- [ ] **Step 3: Commit only if user authorized**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListPatientDetailSheet.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "fix(counselling): polish waiting-list patient detail sheet"
```

---

### Task 7: Page orchestration — context header + locked hierarchy + density

**Files:**
- Modify: `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`

**Interfaces:**
- All handlers/queries stay in page; **do not** change callback bodies
- Composition order **locked**:

1. Page context (plain)
2. `WaitingListSummaryWidget` (visible)
3. `WaitingListFilterToolbar`
4. `WaitingListQueueWidget` (`flex-1 min-h-0`)
5. Sheet + AddPatientModal

- [ ] **Step 1: Replace weak title** with page context:

```tsx
<header className="shrink-0 px-0.5">
  <p className={cn(counsellingSessionTokens.microLabel, 'text-[10px]')}>Counsellor's Desk</p>
  <h1 className="text-xl font-semibold tracking-tight text-counselling-foreground sm:text-2xl">
    Waiting List
  </h1>
  <p className="mt-0.5 text-xs text-counselling-muted-foreground">
    Active counselling queue
  </p>
</header>
```

Do **not** add Journey Rail / workflow step track.

- [ ] **Step 2: Ensure shell layout** uses flex column + `min-h-0` so Queue grows; keep `gap-2.5`–`gap-3` gutters (Session kinship). Summary remains between header and filters.

- [ ] **Step 3: Pass queue title when useful** (optional): e.g. `title={isOtTab ? 'OT Returned' : activeTab === 'PreAuthQueue' ? 'Pre-Auth Queue' : 'Patient Queue'}` — display only.

- [ ] **Step 4: Run full waiting-list regression**

```bash
npx vitest run src/lib/counsellors-desk/waiting-list-layout.test.ts src/lib/counsellors-desk/waiting-list-attention.test.ts src/lib/counsellors-desk/waiting-list-primary-action.test.ts src/lib/counsellors-desk/waiting-list-client-filters.test.ts src/lib/counsellors-desk/waiting-list-preauth.test.ts src/lib/counsellors-desk/waiting-list-follow-up.test.ts src/lib/counsellors-desk/ot-returned-action.test.ts src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.test.tsx src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.test.tsx src/components/counsellors-desk/waiting-list/WaitingListWorkRow.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Browser UAT** against spec §33 (abbreviated gate below). **STOP for human visual approval** before Task 8.

- [ ] **Step 6: Commit only if user authorized**

```bash
git add src/app/dashboard/counsellors-desk/waiting-list/page.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "fix(counselling): waiting-list V2 page context and hierarchy"
```

---

### Task 8: Retire legacy `WaitingListRow` (gated)

**Files:**
- Delete only when unused: `apps/hospital-portal-web/src/components/counsellors-desk/WaitingListRow.tsx`
- Update e2e selectors only if broken: `apps/hospital-portal-web/e2e/counselling-session.spec.ts` (or waiting-list e2e if present)

**Gate:** Do **not** start this task until browser UAT from Task 7 is explicitly approved.

- [ ] **Step 1: Grep** for `WaitingListRow` imports; remove dead file only if zero production imports.

- [ ] **Step 2: Smoke** navigation paths manually or e2e if fixtures available.

- [ ] **Step 3: Commit only if user authorized**

```bash
git add src/components/counsellors-desk/WaitingListRow.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "refactor(counselling): retire legacy waiting-list table row"
```

---

### Task 9: Verification before completion

- [ ] **Step 1: Re-run regression command from Global Constraints + new component tests**

- [ ] **Step 2: Confirm no business-logic file diffs** in:
  - `waiting-list-attention.ts`
  - `waiting-list-primary-action.ts`
  - `waiting-list-preauth.ts`
  - `waiting-list-client-filters.ts`
  - API modules

- [ ] **Step 3: Confirm MiniBars absent; summary still between context and filters; Status has `data-status-style="option-a"`**

- [ ] **Step 4: Walk Browser UAT checklist (spec §33)** — all boxes

- [ ] **Step 5: Do not claim done without evidence** (verification-before-completion skill)

---

## Browser UAT gate (must pass before Task 8 / “done”)

- [ ] Counsellor's Desk · Waiting List identity clear; no Journey Rail
- [ ] Grey canvas + white widgets + plain gutters
- [ ] Compact summary visible between context and filters; not five KPI cards; no MiniBars
- [ ] Type pills primary; Status Option A quieter underline/soft active
- [ ] Queue dominates height; header+rows share grid alignment
- [ ] Procedure · Eye grouped; one status pill; Processing label; quiet Attention
- [ ] Primary action dominant; Pre-Auth secondary; demographics utility
- [ ] PreAuthQueue / OT Returned / filters / Add Patient / Start-Continue / Sheet smoke OK
- [ ] Narrow stacks without whole-queue horizontal scroll
- [ ] No PHI in console; no handler regressions

---

## Self-review (plan vs V2 spec)

| Spec section | Task coverage |
|---|---|
| §1–4 Problem / UAT / goals / non-goals | Global Constraints |
| §5 Session relationship | Tasks 2–7 (tokens/primitives) |
| §6–7 Hierarchy / page context | Task 7 (+ locked preference) |
| §8 Operational summary | Task 2 (+ visible placement preference) |
| §9–10 Filter + Status Option A | Task 3 |
| §11–13 Queue / grid / row | Tasks 1, 4, 5 |
| §14–18 Identity / procedure / status / attention / actions | Task 4 |
| §19 Pre-Auth Queue | Tasks 4, 7 (display/title only; SoT frozen) |
| §20 OT Returned | Task 5 |
| §21 Detail sheet | Task 6 |
| §22–24 Loading / empty / error | Task 5, 7 (preserve existing empty copy) |
| §25 Responsive | Tasks 4–5 |
| §26 Accessibility | Tasks 3–4 (roles, focus, stopPropagation) |
| §27 Performance | Global Constraints (no new polling/SignalR) |
| §28 Tokens | Tasks 2–3 (sessionStatus* / workspaceStep*) |
| §29–30 Field map / handlers | Global Constraints; Task 7 |
| §31 Components | Repository discovery (existing files) |
| §32–34 Testing / UAT / DoD | Tasks 1–4 tests; Task 9; UAT gate |
| Preference: summary visible | Task 2 + Task 7 |
| Preference: Status Option A | Task 3 (`workspaceStep*`) |

Placeholder scan: none intentional.  
Type consistency: `WaitingListSummaryStats`, `WAITING_LIST_STATUS_TABS`, `WAITING_LIST_WORK_GRID`, existing row/filter props unchanged.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-07-counsellor-waiting-list-worklist-v2.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

**Which approach?**

**Reminder:** Do not implement until you choose an execution approach. Do not commit unless explicitly requested. Stop after Task 7 for browser UAT before retiring `WaitingListRow.tsx`.
