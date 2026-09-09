# Counsellor Waiting List — Priority Clinical Worklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Counsellor Waiting List UI into a priority clinical worklist (Summary + Filter + Queue widgets with worklist rows) while preserving every existing handler, filter, Pre-Auth, and OT Returned semantic.

**Architecture:** Keep `waiting-list/page.tsx` as a thin orchestrator owning queries, filter state, and existing callbacks. Extract presentational widgets under `components/counsellors-desk/waiting-list/`. Put attention and primary-action **labels** in pure lib resolvers that call existing Pre-Auth SoT helpers. Reuse counselling session tokens/primitives for visual language; do not clone Session chrome (Journey Rail, Action Bar, Estimate layout).

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, TanStack Query, Tailwind, shadcn Sheet/Button, counselling-session tokens/primitives, Vitest, existing Playwright counselling e2e.

**Spec:** `docs/superpowers/specs/2026-09-05-counsellor-waiting-list-worklist-design.md`

## Global Constraints

- Frontend-only redesign; no backend/API/state-machine/enum changes.
- Do not invent workflow states, navigation layers, or new destinations.
- Reuse exact Pre-Auth SoT: `isCoveragePaymentTypeValue`, `isWaitingListPreAuthQueue`, `isCcmsPreAuthAwaiting`, `CCMS_PREAUTH_AWAITING_STATES`.
- Preserve filter semantics: server Apply for dates/name/MRD; client for type chip, status tabs, quick search, PreAuthQueue; type forced `All` on API.
- No pagination/sort exists today — do not invent either.
- No Journey Rail, Session Action Bar, Quote estimate layout, or card-per-patient UI.
- UHID: readable secondary text (`text-[12px]`/`text-[13px] font-medium`) — **not** `font-mono`.
- Status = one pill via `getStatusBadge`; Attention = one plain-text signal (not a second badge).
- Scope page under `.counselling-session` / grey canvas tokens (`shellPage` / `bg-gray-100`).
- Working directory for commands: `apps/hospital-portal-web`.
- Prefer TDD for pure resolvers; keep existing waiting-list unit tests green after every wiring task.

---

## Repository discovery (locked for implementers)

### Canonical files (today)

| Concern | Actual path |
|---|---|
| Page | `src/app/dashboard/counsellors-desk/waiting-list/page.tsx` (`CounsellorWaitingListPage`) |
| Table row | `src/components/counsellors-desk/WaitingListRow.tsx` |
| Types | `src/types/counsellors-desk.ts` (`WaitingListPatient`, `WaitingListStatus`, `WaitingListFilters`) |
| Query | `src/hooks/use-counsellors-desk-queries.ts` → `useWaitingListQuery` |
| Query keys | `src/lib/counsellors-desk/counsellors-desk-query-keys.ts` (`LIST_STALE_MS = 60000`) |
| API | `src/lib/api/counsellors-desk.api.ts` → `getWaitingList` → `GET /Counseling/waiting-list` |
| Client filters | `src/lib/counsellors-desk/waiting-list-client-filters.ts` |
| Pre-Auth queue | `src/lib/counsellors-desk/waiting-list-preauth.ts` |
| Coverage gate | `src/lib/counsellors-desk/session-utils.ts` → `isCoveragePaymentTypeValue` / `getStatusBadge` |
| CCMS awaiting | `src/lib/ccms/ccms-preauth-awaiting.ts` |
| Deferred badges | `src/hooks/use-deferred-ccms-badges.ts` (`pending` \| `none` \| `ready{state}`) |
| OT action | `src/lib/counsellors-desk/ot-returned-action.ts` → `resolveOtReturnedAction` |
| OT data | `ipManagementApi.listJourneys({ branchId, clinicalState: 'ReadyForSurgery' })` then `otReturnReason` |
| Demographics today | **Inline** `PatientDemographicsPanel` in `page.tsx` (not a separate file) |
| Add Patient | `AddPatientModal` dynamic import |

### Reusable Session pieces (import; do not clone chrome)

| Piece | Path |
|---|---|
| Widget surface | `CounsellingSessionWidget` or `counsellingSessionTokens.sessionWidget*` |
| Tokens | `src/lib/counsellors-desk/counselling-session-tokens.ts` (`shellPage`, `sessionWidget`, `pillTab*`, `statusPill*`, `shellSecondaryMeta`) |
| Button / search / empty | `session/primitives` (`CounsellingButton`, `CounsellingSearchInput`, `CounsellingEmptyState`, `CounsellingStatusMessage`) |
| Sheet primitive | `src/components/ui/sheet.tsx` |
| Status labels | `getStatusBadge` in `session-utils.ts` |
| Optional avatar | `PatientAvatar` — optional on queue rows (spec does not require avatar in primary row; skip unless density allows) |

**Do not reuse on queue:** `CounsellingJourneyRail`, `CounsellingSessionChrome`, `CounsellingActionBar`, `CounsellingSessionLayout`, phase/Finish widgets.

**Note on `PatientDemographicsSheet`:** It requires `Patient` from `patients.api`. Waiting list only has `WaitingListPatient` (+ often-empty demographics). Plan creates `WaitingListPatientDetailSheet` mapped from `WaitingListPatient` (Sheet + counselling surfaces). Do **not** force a fake `Patient` adapter.

### Pagination / sorting

**Absent.** Footer only shows “Showing N of M”. Do not add pagination or sort in this plan.

---

## Handler reuse map (do not change semantics)

All normal-row primary navigation continues to call page-owned callbacks. New components receive them as props.

| Context | UI label (presentation only) | Existing handler | Destination / side effects | Propagation |
|---|---|---|---|---|
| Pending | Start | `handleRowClick(patient)` | `setSelectedId`; `counsellingAzureApi.start(patient.id)` fire-and-forget; `router.push(/dashboard/counsellors-desk/{id})` | Row / primary button |
| Processed (UI: Processing) | Continue | same | navigate only (no azure start) | same |
| Done | View | same | navigate only | same |
| RepeatCounselling | Open | same | azure `start` + navigate | same |
| AddOnSurgery | Open | same | navigate only | same |
| SurgeryDone | View | same | navigate only | same |
| Coverage row secondary | Pre-Auth | `handlePreAuth(patient.id)` | `?tab=coverage&subtab=preauth` | `stopPropagation` on button |
| Tab `PreAuthQueue` primary | Pre-Auth | `handlePreAuth(patient.id)` | same deep link | Primary button; row click may still call `handleRowClick` (preserve both) |
| Demographics | icon | `handleDemographics(patient)` | sets `demographicsPatient` → Sheet open | `stopPropagation` |
| OT Returned | Re-plan / Open journey | `resolveOtReturnedAction` then `router.push(action.href)` | session id → counselling; else IP journey href | Button click |
| Add Patient | — | `handleAddPatient` | `addPatientToWaitingList`, tab→Pending, invalidate+refetch, toast | Modal |

**Permission assumptions (unchanged):** Sidebar ungated; API enforces `counseling_sessions.read` / create/update. Do not add new FE PermissionGate on the list.

**Implementation rule:** `WaitingListWorkRow` must call `onRowClick` / `onPreAuth` / `onDemographics` props — never `router.push` internally for those paths.

---

## Filter behaviour map (preserve exactly)

| Control | Where logic lives today | Server? | Client? | Move to |
|---|---|---|---|---|
| Quick search (300ms debounce) | page state | No | Yes (name/uhid/surgery/doctor) | Toolbar UI; state stays on page or lifted into toolbar via controlled props |
| Type chips All/Procedure/Surgery | `filters.type` | No (API forced `type: 'All'`) | Yes immediate | Toolbar |
| Status tabs incl. OtReturned/PreAuthQueue | `activeTab` | No | Yes | Toolbar |
| fromDate/toDate/patientName/mrd | draft `filters` → Apply → `appliedFilters` | Yes after Apply | Name/MRD also re-applied client-side | Toolbar |
| Apply (`handleSearch`) | page | Sets `appliedFilters` with `type: 'All'` | — | page callback |
| Reset (`handleReset`) | page | Clears applied + quick search | — | page callback |
| Tab counts | page `tabCounts` | — | Type-scoped; OtReturned=journey length; PreAuth=`isPreAuthQueueRow` | pass counts into Toolbar |
| Stats cards | over full `patients` not filtered | — | — | Summary widget |
| Pagination | none | — | — | none |

`applyWaitingListClientFilters` signature must remain the filter engine — do not rewrite rules; only call from page after toolbar state updates.

---

## Pre-Auth SoT (critical)

```text
isCoveragePaymentTypeValue(patientType)     -> Pre-Auth button eligibility + Attention "Pre-Auth Required"
isWaitingListPreAuthQueue({...})            -> PreAuthQueue tab membership + Attention "CCMS Awaiting"
  -> requires isCoveragePaymentTypeValue AND hasCcmsCase
  -> isCcmsPreAuthAwaiting(ccmsState, ccmsDecision)
CCMS_PREAUTH_AWAITING_STATES                -> WAITING_APPROVAL, PREAUTH_SENT, CLARIFICATION_REQUIRED, RESUBMITTED, PREAUTH_GENERATED (+ decision BLOCK)
```

Page `isPreAuthQueueRow` today: only when deferred badge `status === 'ready'`, then `isWaitingListPreAuthQueue({ hasCcmsCase: true, ... })`. Unresolved badges **must not** enter Pre-Auth Queue. Attention resolver must respect the same inputs (pass `hasCcmsCase` / `ccmsState` from badge readiness).

---

## Target file structure

| Path | Responsibility |
|---|---|
| `src/lib/counsellors-desk/waiting-list-attention.ts` | Pure attention label resolver |
| `src/lib/counsellors-desk/waiting-list-attention.test.ts` | Unit tests |
| `src/lib/counsellors-desk/waiting-list-primary-action.ts` | Pure primary button label resolver |
| `src/lib/counsellors-desk/waiting-list-primary-action.test.ts` | Unit tests |
| `src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx` | Five metrics in one widget |
| `src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.tsx` | Search, chips, tabs, filter panel, Add Patient trigger |
| `src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx` | Queue shell, loading/empty, list of rows |
| `src/components/counsellors-desk/waiting-list/WaitingListWorkRow.tsx` | Normal priority worklist row |
| `src/components/counsellors-desk/waiting-list/WaitingListOtReturnedRow.tsx` | OT Returned row |
| `src/components/counsellors-desk/waiting-list/WaitingListPatientDetailSheet.tsx` | Detail Sheet from WaitingListPatient |
| `src/app/dashboard/counsellors-desk/waiting-list/page.tsx` | Orchestrator only — wire widgets; keep handlers |
| Retire | `src/components/counsellors-desk/WaitingListRow.tsx` after cutover (delete when unused) |

Optional: add waiting-list row density keys to `counselling-session-tokens.ts` only if needed — no new theme CSS file.

---

### Task 1: Attention resolver (TDD)

**Files:**
- Create: `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-attention.ts`
- Create: `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-attention.test.ts`

**Interfaces:**
- Consumes: `isCoveragePaymentTypeValue`, `isWaitingListPreAuthQueue`, `WaitingListStatus` / patient fields
- Produces:

```ts
export type WaitingListAttentionLabel =
  | 'CCMS Awaiting'
  | 'Pre-Auth Required'
  | 'Follow-up Due'
  | 'Upgrade Requested'
  | null;

export function resolveWaitingListAttention(input: {
  status: WaitingListStatus;
  patientType?: string | null;
  ccmsState?: string | null;
  hasCcmsCase: boolean;
  ccmsDecision?: string | null;
  followUpDate?: string;
  followUpReason?: string;
  previousPackage?: string;
  newPackage?: string;
  upgradeDiff?: number;
}): WaitingListAttentionLabel;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { resolveWaitingListAttention } from './waiting-list-attention';

describe('resolveWaitingListAttention', () => {
  it('returns CCMS Awaiting via isWaitingListPreAuthQueue (ready awaiting case)', () => {
    expect(
      resolveWaitingListAttention({
        status: 'Processed',
        patientType: 'Insurance',
        ccmsState: 'WAITING_APPROVAL',
        hasCcmsCase: true,
      }),
    ).toBe('CCMS Awaiting');
  });

  it('returns Pre-Auth Required for coverage type when not in Pre-Auth Queue', () => {
    expect(
      resolveWaitingListAttention({
        status: 'Pending',
        patientType: 'Insurance',
        hasCcmsCase: false,
      }),
    ).toBe('Pre-Auth Required');
  });

  it('does not invent Pre-Auth Required for Cash', () => {
    expect(
      resolveWaitingListAttention({
        status: 'Pending',
        patientType: 'Cash',
        hasCcmsCase: false,
      }),
    ).toBeNull();
  });

  it('returns Follow-up Due for RepeatCounselling with follow-up fields', () => {
    expect(
      resolveWaitingListAttention({
        status: 'RepeatCounselling',
        patientType: 'Cash',
        hasCcmsCase: false,
        followUpDate: '2026-09-20',
      }),
    ).toBe('Follow-up Due');
  });

  it('returns Upgrade Requested for AddOnSurgery with package fields', () => {
    expect(
      resolveWaitingListAttention({
        status: 'AddOnSurgery',
        patientType: 'Cash',
        hasCcmsCase: false,
        previousPackage: 'Std',
        newPackage: 'Prem',
      }),
    ).toBe('Upgrade Requested');
  });

  it('priority: CCMS Awaiting beats Pre-Auth Required', () => {
    expect(
      resolveWaitingListAttention({
        status: 'Processed',
        patientType: 'Insurance',
        ccmsState: 'PREAUTH_SENT',
        hasCcmsCase: true,
      }),
    ).toBe('CCMS Awaiting');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/counsellors-desk/waiting-list-attention.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Write minimal implementation**

```ts
import type { WaitingListStatus } from '@/types/counsellors-desk';
import { isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';
import { isWaitingListPreAuthQueue } from '@/lib/counsellors-desk/waiting-list-preauth';

export type WaitingListAttentionLabel =
  | 'CCMS Awaiting'
  | 'Pre-Auth Required'
  | 'Follow-up Due'
  | 'Upgrade Requested'
  | null;

export function resolveWaitingListAttention(input: {
  status: WaitingListStatus;
  patientType?: string | null;
  ccmsState?: string | null;
  hasCcmsCase: boolean;
  ccmsDecision?: string | null;
  followUpDate?: string;
  followUpReason?: string;
  previousPackage?: string;
  newPackage?: string;
  upgradeDiff?: number;
}): WaitingListAttentionLabel {
  if (
    isWaitingListPreAuthQueue({
      patientType: input.patientType,
      ccmsState: input.ccmsState,
      hasCcmsCase: input.hasCcmsCase,
      ccmsDecision: input.ccmsDecision,
    })
  ) {
    return 'CCMS Awaiting';
  }
  if (isCoveragePaymentTypeValue(input.patientType)) {
    return 'Pre-Auth Required';
  }
  if (
    input.status === 'RepeatCounselling' &&
    (Boolean(input.followUpDate?.trim()) || Boolean(input.followUpReason?.trim()))
  ) {
    return 'Follow-up Due';
  }
  if (
    input.status === 'AddOnSurgery' &&
    (Boolean(input.previousPackage) ||
      Boolean(input.newPackage) ||
      (input.upgradeDiff != null && input.upgradeDiff !== 0))
  ) {
    return 'Upgrade Requested';
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/counsellors-desk/waiting-list-attention.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/counsellors-desk/waiting-list-attention.ts src/lib/counsellors-desk/waiting-list-attention.test.ts
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "feat(counselling): add waiting-list attention resolver"
```

---

### Task 2: Primary action label resolver (TDD)

**Files:**
- Create: `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-primary-action.ts`
- Create: `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-primary-action.test.ts`

**Interfaces:**
- Consumes: `WaitingListStatus`, `isCoveragePaymentTypeValue`
- Produces:

```ts
export type WaitingListPrimaryActionKind = 'row-navigate' | 'preauth';

export function resolveWaitingListPrimaryAction(input: {
  status: WaitingListStatus;
  activeTab: string;
  patientType?: string | null;
}): { label: string; kind: WaitingListPrimaryActionKind };
```

Rules:
- If `activeTab === 'PreAuthQueue'` and `isCoveragePaymentTypeValue(patientType)` → `{ label: 'Pre-Auth', kind: 'preauth' }`
- Else by status: Pending→Start, Processed→Continue, Done→View, RepeatCounselling→Open, AddOnSurgery→Open, SurgeryDone→View
- `kind: 'row-navigate'` for all status defaults

- [ ] **Step 1: Write the failing test** covering each status + PreAuthQueue override + Cash on PreAuthQueue tab still uses status label (should not happen in filtered list, but resolver stays safe: if not coverage, fall through to status).

- [ ] **Step 2: Run vitest — expect FAIL**

Run: `npx vitest run src/lib/counsellors-desk/waiting-list-primary-action.test.ts`

- [ ] **Step 3: Implement resolver** (labels only; no router)

- [ ] **Step 4: Run vitest — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/counsellors-desk/waiting-list-primary-action.ts src/lib/counsellors-desk/waiting-list-primary-action.test.ts
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "feat(counselling): add waiting-list primary action labels"
```

---

### Task 3: Summary widget

**Files:**
- Create: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx`

**Interfaces:**
- Consumes: `{ total: number; procedure: number; surgery: number; repeat: number; completed: number }`
- Produces: presentational widget only (non-interactive)

- [ ] **Step 1: Implement component** using `CounsellingSessionWidget` or `sessionWidget` + internal 2/3/5 grid; `text-2xl font-semibold` values; muted labels; optional MiniBar (copy small helper into file or pass as children). No click handlers.

- [ ] **Step 2: Manual check** — import temporarily from page or Story not required; proceed to page wiring in Task 8. For this task, ensure TypeScript compiles: `npx tsc --noEmit -p tsconfig.json` is heavy; prefer ESLint on the file if available. Minimum: open file has no type errors in IDE.

- [ ] **Step 3: Commit**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "feat(counselling): add waiting-list summary widget"
```

---

### Task 4: Filter toolbar (UI extract; same semantics)

**Files:**
- Create: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.tsx`

**Interfaces:**
- Consumes controlled props from page (do not move query ownership into toolbar):

```ts
export type WaitingListFilterToolbarProps = {
  quickSearch: string;
  onQuickSearchChange: (v: string) => void;
  filters: WaitingListFilters;
  onFiltersChange: (next: WaitingListFilters) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  onApply: () => void;
  onReset: () => void;
  activeTab: string;
  onTabChange: (key: string) => void;
  tabCounts: Record<string, number>;
  statusTabs: ReadonlyArray<{ key: string; label: string }>; // Processed label shown as Processing
  typeOptions: ReadonlyArray<'All' | 'Procedure' | 'Surgery'>;
  hasActiveFilters: boolean;
  onAddPatient: () => void;
};
```

- [ ] **Step 1: Move STATUS_TABS presentation** — keep keys identical; change display label for `Processed` to `Processing` (key remains `Processed`).

- [ ] **Step 2: Implement toolbar** with `sessionWidget`, `CounsellingSearchInput`, `pillTab*` chips/tabs, collapsible filter panel (fromDate/toDate/patientName/mrd), Apply/Reset, Add Patient button. No new filter rules.

- [ ] **Step 3: Regression** — after page wires toolbar (Task 8), run:

`npx vitest run src/lib/counsellors-desk/waiting-list-client-filters.test.ts src/lib/counsellors-desk/waiting-list-preauth.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListFilterToolbar.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "feat(counselling): extract waiting-list filter toolbar"
```

---

### Task 5: Normal worklist row

**Files:**
- Create: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListWorkRow.tsx`

**Interfaces:**
- Consumes: same callbacks as `WaitingListRowProps` plus `activeTab`, `attention`, and primary action from resolvers (or compute inside row via resolvers)

```ts
export type WaitingListWorkRowProps = {
  patient: WaitingListPatient;
  isSelected: boolean;
  activeTab: string;
  ccmsState?: string;
  hasCcmsCase: boolean;
  onRowClick: (patient: WaitingListPatient) => void;
  onDemographics: (patient: WaitingListPatient) => void;
  onPreAuth: (patientId: string) => void;
};
```

Layout (flex, unequal shares ~28-32 / 22-25 / 12-14 / 18-20 / 12-15):
1. Patient: name semibold; UHID **without** `font-mono`; optional `· {age} yrs`
2. Procedure + eye compact
3. Status: `getStatusBadge(patient.status)` single pill
4. Attention: `resolveWaitingListAttention(...)` as muted/amber text; truncate + `title`
5. Action: `CounsellingButton` label from `resolveWaitingListPrimaryAction`; if kind preauth → `onPreAuth`; else `onRowClick`
6. Meta line: `Type · patientType · Doctor · Time · #slNo`
7. Secondary Pre-Auth when coverage and activeTab !== PreAuthQueue (stopPropagation)
8. Demographics icon stopPropagation
9. Thin left status accent; hover/selected; memoize

- [ ] **Step 1: Implement `WaitingListWorkRow`** (memo)

- [ ] **Step 2: Verify** resolvers used; no local router; UHID not mono

- [ ] **Step 3: Commit**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListWorkRow.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "feat(counselling): add waiting-list worklist row"
```

---

### Task 6: OT Returned row

**Files:**
- Create: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListOtReturnedRow.tsx`

**Interfaces:**
- Consumes: `PatientJourneyRowDto` (same type page uses today), `onAction: (href: string) => void` **or** call `resolveOtReturnedAction` inside and `router` via `onNavigate(href)` prop from page

```ts
export type WaitingListOtReturnedRowProps = {
  row: PatientJourneyRowDto;
  index: number;
  onNavigate: (href: string) => void;
};
```

Zones: UHID · Patient · Procedure · Return Reason · Surgery Date · Action (`resolveOtReturnedAction` label). Same visual language; **no** Status/Attention columns.

- [ ] **Step 1: Implement component**

- [ ] **Step 2: Keep green**

`npx vitest run src/lib/counsellors-desk/ot-returned-action.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListOtReturnedRow.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "feat(counselling): add OT returned worklist row"
```

---

### Task 7: Patient detail Sheet

**Files:**
- Create: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListPatientDetailSheet.tsx`
- Remove inline `PatientDemographicsPanel` from page when wired

**Interfaces:**

```ts
export type WaitingListPatientDetailSheetProps = {
  patient: WaitingListPatient | null;
  open: boolean;
  onClose: () => void;
};
```

Show: age, gender, remarks, follow-up, upgrade package details, contact/DOB/blood/emergency/address with "—" when empty. Use `Sheet` from `ui/sheet` + counselling widget sections. Do not mock missing API demographics.

- [ ] **Step 1: Implement Sheet**

- [ ] **Step 2: Commit**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListPatientDetailSheet.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "feat(counselling): add waiting-list patient detail sheet"
```

---

### Task 8: Queue widget + page orchestration cutover

**Files:**
- Create: `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx`
- Modify: `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`

**Interfaces:**
- Queue widget props: `mode: 'counselling' | 'ot-returned'`, loading/empty/error slots, children or row render props, title + count
- Page keeps: `useWaitingListQuery`, OT fetch, `useDeferredCcmsBadges`, `handleRowClick`, `handlePreAuth`, `handleDemographics`, `handleAddPatient`, `handleSearch`, `handleReset`, `applyWaitingListClientFilters`, toasts

Page structure:

```tsx
<div className={cn(counsellingSessionTokens.shellPage /* or page + bg-gray-100 */, 'space-y-3 p-4')}>
  <WaitingListSummaryWidget ... />
  <WaitingListFilterToolbar ... />
  <WaitingListQueueWidget ...>
    {/* Work rows or OT rows */}
  </WaitingListQueueWidget>
  <WaitingListPatientDetailSheet ... />
  <AddPatientModal ... />
</div>
```

Loading: worklist-shaped skeletons (not 14 `<td>`). Empty: preserve RepeatCounselling and OT educational copy. Error: keep toast on query error; optionally show `CounsellingStatusMessage` + retry via `refetchWaitingList`.

- [ ] **Step 1: Implement Queue widget**

- [ ] **Step 2: Rewrite page JSX** to compose widgets; **handlers unchanged in body**

- [ ] **Step 3: Run regression unit tests**

```bash
npx vitest run src/lib/counsellors-desk/waiting-list-attention.test.ts src/lib/counsellors-desk/waiting-list-primary-action.test.ts src/lib/counsellors-desk/waiting-list-client-filters.test.ts src/lib/counsellors-desk/waiting-list-preauth.test.ts src/lib/counsellors-desk/waiting-list-follow-up.test.ts src/lib/counsellors-desk/ot-returned-action.test.ts
```

Expected: all PASS

- [ ] **Step 4: Manual browser checklist** (UAT): open `/dashboard/counsellors-desk/waiting-list` → counts → tabs → quick search → Apply dates → Start/Continue opens session → Pre-Auth deep link → demographics Sheet → OT Returned Re-plan/Open journey → Add Patient still works

- [ ] **Step 5: Commit**

```bash
git add src/components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx src/app/dashboard/counsellors-desk/waiting-list/page.tsx
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "feat(counselling): cut over waiting list to worklist widgets"
```

---

### Task 9: Retire table row + smoke e2e

**Files:**
- Delete (when unused): `apps/hospital-portal-web/src/components/counsellors-desk/WaitingListRow.tsx`
- Optionally extend: `apps/hospital-portal-web/e2e/counselling-session.spec.ts` only if selectors break — prefer updating selectors to worklist rows; do not add new workflow assertions beyond navigation smoke

- [ ] **Step 1: Grep for `WaitingListRow` imports; remove dead file**

- [ ] **Step 2: Run counselling e2e smoke if environment available**

`npm run test:e2e:counselling`  
If fixtures unavailable, document manual verification from Task 8 Step 4 as gate.

- [ ] **Step 3: Commit**

```bash
git add -A src/components/counsellors-desk/WaitingListRow.tsx src/components/counsellors-desk/waiting-list e2e/counselling-session.spec.ts
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "refactor(counselling): retire waiting-list table row"
```

---

### Task 10: Verification before completion

- [ ] **Step 1: Spec coverage check** — confirm page hierarchy, unequal columns, UHID not mono, attention vs status, OT separate, field mapping, loading/empty/error, a11y focus on row/buttons

- [ ] **Step 2: Run full waiting-list unit suite** (same command as Task 8 Step 3)

- [ ] **Step 3: Confirm no API/backend files changed** (`git diff --name-only` should be FE counselling waiting-list + tokens only)

- [ ] **Step 4: Final commit only if leftover docs/chore needed; otherwise stop**

---

## Self-review (plan vs spec)

| Spec section | Task coverage |
|---|---|
| §4 Page hierarchy | Task 8 |
| §5 Summary | Task 3 |
| §6 Search/Filter | Task 4 |
| §7 Work row / attention / actions / OT / PreAuthQueue | Tasks 1, 2, 5, 6, 8 |
| §8 Detail Sheet | Task 7 |
| §9–13 Density/a11y/responsive | Tasks 5, 8 (implementers apply tokens; responsive wrap in WorkRow) |
| §14 Performance | memo row; preserve deferred CCMS + query stale (Task 8) |
| §15 Loading/empty/error | Task 8 |
| §16 Field mapping | Tasks 5, 7 |
| §17 File plan | Target structure above |
| §18 Tests | Tasks 1, 2, 8, 9 |
| §19 Non-goals | Global Constraints |

Placeholder scan: none intentional. Type names aligned: `resolveWaitingListAttention`, `resolveWaitingListPrimaryAction`, widget filenames match spec §17.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-05-counsellor-waiting-list-worklist.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

**Which approach?**
