# Counsellor Waiting List  -  Priority Clinical Worklist Redesign

**Date:** 2026-09-05  
**Status:** Draft for approval (no implementation until approved)  
**Surface:** `/dashboard/counsellors-desk/waiting-list`  
**Scope:** Frontend UX/UI redesign only  

## 1. Goal

Redesign the Counsellor Waiting List into a **clinical operational work queue** so a counsellor can, in one scan:

1. See how many patients are in queue  
2. See who needs attention  
3. Read counselling workflow status  
4. See procedure/surgery and eye  
5. See insurance / pre-auth involvement  
6. See what is blocking attention  
7. Take the correct next action  
8. Open the correct counselling session quickly  
9. Search/filter a large queue efficiently  

**Not in scope:** backend business logic, API contracts, queue state-machine semantics, enum renames, new workflow states, Session page changes, Journey Rail, Session Action Bar, Quote estimate layout, card-per-patient layouts.

**Visual kinship:** same counselling application language as Quote -> Decision -> Insurance -> Notes -> Finish (`bg-gray-100` canvas, floating `sessionWidget` surfaces, restrained borders, subtle shadows, limited pills). Optimized for multi-patient scanning, not single-patient deep work.

---

## 2. Sources of truth (locked)

| Concern | SoT |
|---|---|
| Route | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx` |
| List API | `GET /Counseling/waiting-list` via `counsellorsDeskApi.getWaitingList` / `useWaitingListQuery` |
| Queue statuses | FE `WaitingListStatus` in `types/counsellors-desk.ts` |
| Status labels | `getStatusBadge` / `STATUS_BADGE_MAP` in `session-utils.ts` (`Processed` -> **Processing**) |
| Pre-Auth button eligibility | `isCoveragePaymentTypeValue(patient.patientType)` (exact  -  do not approximate) |
| Pre-Auth Queue membership | `isWaitingListPreAuthQueue` -> `isCcmsPreAuthAwaiting` / `CCMS_PREAUTH_AWAITING_STATES` |
| OT Returned data | `ipManagementApi.listJourneys` (`clinicalState=ReadyForSurgery` + return reason) |
| OT Returned action | `resolveOtReturnedAction` |
| Client filters | `applyWaitingListClientFilters` |
| Design tokens | `counselling-session-tokens.ts` + `.counselling-session` theme |
| Permissions | Unchanged (`counseling_sessions.read` at API; no new FE gates) |

---

## 3. Status semantics (unchanged)

| State / tab key | Kind | Meaning | Primary action (label) | Handler / destination |
|---|---|---|---|---|
| `Pending` | `WaitingListStatus` | Waiting to start | **Start** | `handleRowClick` -> Azure `start` (best-effort) + `/dashboard/counsellors-desk/{id}` |
| `Processed` | `WaitingListStatus` | In progress (UI: **Processing**) | **Continue** | `handleRowClick` -> same session route |
| `Done` | `WaitingListStatus` | Completed + agreed | **View** | `handleRowClick` |
| `RepeatCounselling` | `WaitingListStatus` | Needs return visit | **Open** | `handleRowClick` (+ Azure `start`) |
| `AddOnSurgery` | `WaitingListStatus` | Package upgrade counselling | **Open** | `handleRowClick` |
| `SurgeryDone` | `WaitingListStatus` | Surgery done; read-only | **View** | `handleRowClick` |
| `OtReturned` | Synthetic tab | OT returned (IP journey) | **Re-plan** / **Open journey** | `resolveOtReturnedAction` href |
| `PreAuthQueue` | Synthetic tab | Coverage + awaiting CCMS | **Pre-Auth** (primary); row still opens session | `handlePreAuth` and/or `handleRowClick` |

Labels are presentation-only. Do **not** invent a new navigation layer.

---

## 4. Page hierarchy

```text
.counselling-session + bg-gray-100 (shellPage canvas)
│
├── WaitingListSummaryWidget          (compact)
├── WaitingListFilterToolbar          (compact)
└── WaitingListQueueWidget            (dominant  -  flex-1 / majority of viewport)
      ├── normal tab -> WaitingListWorkRow[]
      └── OtReturned tab -> WaitingListOtReturnedRow[]
```

Page file stays orchestration-only: queries, filter state, handlers, compose widgets.

**Out of page:** Journey Rail, Session status strip, Session Action Bar, Estimate 58/42 layout, Finish summary widgets, per-patient cards.

---

## 5. Queue Summary widget

**Component:** `WaitingListSummaryWidget`

**Metrics (unchanged counts):** Total Patients | Procedure | Surgery | Repeat Counselling | Completed (`Done`)

**Visual:**

- One `sessionWidget` surface with an internal metric grid (prefer **one widget**, not five independent decorative cards)
- Quiet: value (`text-2xl` semibold, not extrabold 3xl), label (`text-xs` muted), optional thin MiniBar on counselling muted track
- Icons optional and muted if retained
- Grid: `2 -> 3 -> 5` columns by breakpoint (same as today)

**Role:** orientation only  -  non-interactive in v1 (matches current behaviour).

---

## 6. Search & Filter toolbar

**Component:** `WaitingListFilterToolbar`

**Controls (behavior preserved):**

| Control | Behavior |
|---|---|
| Quick search | Debounced 300ms; client match name / UHID / surgeryName / doctor |
| Type chips | All / Procedure / Surgery  -  client-only; API still forced `type: 'All'` |
| Status tabs | All + six statuses + OtReturned + PreAuthQueue  -  client filter; API `status` unused |
| Date from/to, patient name, MRD | Apply / Reset -> server `fromDate`/`toDate`/`patientName`/`mrd` |
| Add Patient | Existing modal + `addPatientToWaitingList` |

**Visual:**

- Widget surface + `pillTab*` tokens for type chips and status tabs
- Tab labels: human-readable (`Processing` for Processed tab label in UI; keep key `Processed`)
- Counts on tabs preserved
- Filter panel remains collapsible; Apply/Reset unchanged
- Search: counselling search primitive / density styling

---

## 7. Patient Queue widget

**Component:** `WaitingListQueueWidget`

- Dominant widget: title “Patient Queue” + visible count for current filter
- Header row (desktop): column cues  -  Patient | Procedure/Eye | Status | Attention | Action  -  using muted micro labels (not spreadsheet chrome)
- Body: flat worklist rows (hairline dividers; **no** per-row card chrome)
- Selected row: soft counselling accent background

### 7.1 Normal worklist row

**Component:** `WaitingListWorkRow` (replaces table `WaitingListRow`)

**Scanning order:** Patient -> Procedure/Eye -> Status -> Attention -> Action

**Not five equal columns.** Approximate flex allocation (desktop):

| Zone | Share | Notes |
|---|---|---|
| Patient | ~28-32% | Most room |
| Procedure / Eye | ~22-25% | Second most room |
| Status | ~12-14% | Single pill |
| Attention | ~18-20% | Truncate with `title` tooltip |
| Action | ~12-15% | Stable hit target; do not shrink below usable button width |

**Line structure:**

```text
[Patient name]          [Procedure name] [Eye]   [Status pill]   [Attention text]   [Primary btn]
[UHID · age]            
[Type | PatientType | Doctor | Time | #slNo]                              [Demographics icon]
```

Example (one-pass scan):

```text
Balakrishna Rao          Phacoemulsification  RE    Processing      Pre-Auth Required    [Continue]
FRESH-013 | 70 yrs
Insurance | Dr. Kumar | 10:45 AM | #12
```

**Typography (normal row):**

| Element | Treatment |
|---|---|
| Patient name | `text-sm font-semibold` counselling foreground; truncate |
| UHID | **Not monospace.** Align with Session identity: `text-[12px]` / `text-[13px] font-medium` secondary (`shellSecondaryMeta` spirit). Identity, not code |
| Age on identity line | Optional compact `| {age} yrs` next to UHID when present (also in drawer) |
| Procedure | `text-sm font-medium`; truncate |
| Eye | Compact marker (RE/LE/BE); restrained colour; not a large badge cluster |
| Status | Single pill via `getStatusBadge` / aligned `statusPill*` |
| Attention | `text-xs font-medium` amber/muted text  -  **not** a coloured badge |
| Meta line | `text-[12px]` muted; middots; truncate as a unit if needed |
| Primary action | Compact `CounsellingButton` / `min-h-8` |

**Priority without noise:** thin left status accent border; hover + selected only (no loud zebra); no emoji in production row copy.

### 7.2 Attention resolver

**File:** `lib/counsellors-desk/waiting-list-attention.ts` (pure, unit-tested)

Show **at most one** signal. Priority (highest first):

| Priority | Label | Rule (exact helpers) |
|---|---|---|
| 1 | **CCMS Awaiting** | `isWaitingListPreAuthQueue({ patientType, ccmsState, hasCcmsCase, ccmsDecision })` |
| 2 | **Pre-Auth Required** | `isCoveragePaymentTypeValue(patientType)` **and** not already CCMS Awaiting  -  **exact** Pre-Auth button eligibility gate; no alternate coverage heuristics |
| 3 | **Follow-up Due** | `status === 'RepeatCounselling'` and (`followUpDate` or `followUpReason`) |
| 4 | **Upgrade Requested** | `status === 'AddOnSurgery'` and (`previousPackage` or `newPackage` or upgradeDiff) |
|  -  | empty / em dash | Otherwise |

Do not duplicate CCMS awaiting state lists; call existing SoT modules.

### 7.3 Primary action resolver

**File:** `lib/counsellors-desk/waiting-list-primary-action.ts` (pure labels only)

| Context | Label | Invokes |
|---|---|---|
| Pending | Start | existing `handleRowClick` |
| Processed | Continue | same |
| Done | View | same |
| RepeatCounselling | Open | same |
| AddOnSurgery | Open | same |
| SurgeryDone | View | same |
| Active tab `PreAuthQueue` (coverage-eligible) | Pre-Auth | existing `handlePreAuth` |
| Coverage-eligible on other tabs | Primary = status label above; **secondary** compact Pre-Auth when `isCoveragePaymentTypeValue` | `handlePreAuth` + `stopPropagation` |

Do not add a router abstraction; page keeps existing callbacks.

### 7.4 OT Returned row

**Component:** `WaitingListOtReturnedRow`

Same visual language; **different content model**  -  do **not** force Status + Attention.

**Zones:** UHID -> Patient -> Procedure -> Return Reason -> Surgery Date -> Action  

**Action:** `resolveOtReturnedAction` only (Re-plan / Open journey).

### 7.5 Pre-Auth Queue treatment

- Tab filter unchanged (`isWaitingListPreAuthQueue`)
- Same `WaitingListWorkRow` anatomy
- Primary button emphasizes **Pre-Auth** -> `handlePreAuth`
- Row click still opens session via `handleRowClick`
- Attention typically **CCMS Awaiting** when membership rules hold
- Deferred CCMS badges: preserve unresolved/offline behaviour; do not invent rows when badges missing

---

## 8. Patient detail interaction

Extend demographics into a counselling-styled **Sheet** (Radix; no third overlay stack).

**Open via:** demographics icon (`stopPropagation`).

**Drawer contents:** age, gender, remarks, follow-up date/reason, add-on package upgrade details, contact/DOB/blood group/emergency/address when API populates (show “ - ” when empty  -  known backend gap; do not mock).

---

## 9. Spacing & density

| Rule | Value |
|---|---|
| Page stack gap | `gap-3` |
| Widget padding | `sessionWidgetPad` |
| Queue rows | hairline `divide-y`; pad `py-2.5`-`py-3` |
| Row min height | ~56-64px (two lines + meta); not card-tall |
| Action | stable right edge; `min-w` for “Continue” |
| Meta separator | ` | ` muted |

Waiting-list-only token keys under `counselling-session-tokens.ts` only if needed  -  **no new theme CSS file**.

---

## 10. Status & attention treatment

| Concept | Treatment |
|---|---|
| Workflow status | One pill; `getStatusBadge` |
| Attention | Plain text; truncate + `title`; amber/muted  -  never a second status pill |
| Eye | Compact marker |
| Type | Meta line  -  avoid pill spam |

---

## 11. Actions (primary / secondary)

| Control | Role |
|---|---|
| Primary button | State-driven label; focusable |
| Pre-Auth (secondary) | Compact; stopPropagation |
| Demographics | Icon-only; `aria-label` “Patient details” |
| Whole row | Activates same navigation as primary (except when nested control clicked) |

---

## 12. Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| **Desktop (primary)** | Five-zone row; Patient Queue dominates height |
| **Tablet** | Same zones; tighter truncation; Action visible; prefer wrap over 14-col horizontal scroll |
| **Narrow** | Wrap: Patient+Action -> Procedure+Eye+Status -> Attention; meta under patient; pill tracks scroll horizontally |

Desktop workstation efficiency first.

---

## 13. Accessibility

- Focusable rows; Enter/Space = primary navigation  
- Nested buttons use stopPropagation  
- Status and Attention as text (not colour-only)  
- Icon-only controls named  
- Focus-visible counselling rings  
- Empty/error use text + existing EmptyState/status message patterns  
- Left border accent is supplementary, not sole status cue  

---

## 14. Large queue / performance

- Memoize work rows  
- Preserve Query stale time + visibility refetch  
- Preserve deferred CCMS badge batching  
- No new polling/SignalR  
- Virtualization = follow-up if measured jank (~100+ rows)  
- Avoid heavy per-row animation  

---

## 15. Loading / empty / error

| State | Treatment |
|---|---|
| Initial load | Worklist-shaped skeletons inside Queue widget |
| Soft refresh | Keep prior rows; subtle refreshing indicator |
| Empty | EmptyState + filter hint; keep status-specific education copy where present |
| Empty OT Returned | Existing OT education copy |
| Query error | Message + retry; no fake patients |
| 403 | Existing auth/error handling |

---

## 16. Complete field mapping

| Field | Placement |
|---|---|
| `patientName` | Primary  -  Patient |
| `uhid` | Primary  -  under name (readable secondary; **not mono**) |
| `surgeryName` | Primary  -  Procedure |
| `eye` | Primary  -  Eye |
| `status` | Primary  -  Status pill |
| Attention (derived) | Primary  -  Attention |
| Primary / Pre-Auth / OT actions | Action |
| `type`, `patientType`, `doctor`, `time`, `slNo` | Secondary meta line |
| `age` | Identity subline and/or drawer |
| `gender`, `remarks` | Drawer (default; reduce row noise) |
| `followUpDate` / `followUpReason` | Attention + drawer |
| `previousPackage` / `newPackage` / `upgradeDiff` | Attention + drawer |
| Demographics fields | Drawer |
| CCMS state | Attention + Pre-Auth Queue; optional drawer label via `getStateLabel` |
| OT return reason, surgery date, journey ids | OT Returned row only |
| Filter inputs | Filter toolbar |

Nothing operationally meaningful is removed  -  only re-weighted.

---

## 17. Component / file plan

| Path | Role |
|---|---|
| `waiting-list/page.tsx` | Thin orchestrator |
| `components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx` | Summary |
| `.../WaitingListFilterToolbar.tsx` | Search/filters/tabs |
| `.../WaitingListQueueWidget.tsx` | Queue shell |
| `.../WaitingListWorkRow.tsx` | Normal row |
| `.../WaitingListOtReturnedRow.tsx` | OT row |
| `.../WaitingListPatientDetailSheet.tsx` | Detail drawer |
| `lib/counsellors-desk/waiting-list-attention.ts` (+ test) | Attention UI SoT |
| `lib/counsellors-desk/waiting-list-primary-action.ts` (+ test) | Label UI SoT |
| Retire table `WaitingListRow.tsx` after cutover |  -  |

Reuse Session tokens/primitives; do not reuse Journey Rail / Action Bar / Estimate layout.

---

## 18. Testing plan

- Unit: attention priority + Pre-Auth gate exactness; primary-action labels by status/tab  
- Keep green: client-filters, preauth, follow-up, ot-returned-action, add-patient  
- Smoke: filter -> Start/Continue session -> Pre-Auth deep link -> OT actions -> detail sheet  
- FE-only; no backend contract changes  

---

## 19. Explicit non-goals

- Renaming backend enums or changing queue transitions  
- Server-side status tab filtering (unless separately approved)  
- Fixing demographics API population gap  
- Merging OT Returned into counselling Status/Attention model  
- New toast library, design system, or realtime bus  
- Cloning Session Journey / Action Bar onto the queue  

---

## 20. Approval gate

Implementation and writing-plans start only after explicit approval of this specification.

**Self-review:** no TBD placeholders; status vs attention consistent; Pre-Auth gate strict; field map complete; OT separate; UHID not mono; unequal column weights; handlers unchanged; refinements A/B and one-pass scan example included.
