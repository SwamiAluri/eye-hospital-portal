# Global Responsive Density — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **DO NOT START until the user explicitly approves this plan.**

**Goal:** Make the entire Hospital Portal share one coherent responsive density system: frozen Large Desktop (≥1600 CSS px) and intentional Workstation density (<1600), without redesigning approved visuals or Counsellor IA.

**Architecture:** CSS custom-property density tokens on `:root` with `@media (max-width: 1599.98px)` workstation overrides; migrate shell → chrome → opt-in shared primitives → worklists → modules in gated waves. No transform/zoom/DPR density switch.

**Tech Stack:** Next.js 14 App Router · Tailwind 3 · existing shadcn/ui · `globals.css` CSS variables · Playwright e2e under `apps/hospital-portal-web/e2e/`

**Spec:** `apps/hospital-portal-web/docs/superpowers/specs/2026-09-10-global-responsive-density-design.md`

## Global Constraints

- ≥1600 CSS px visual design is FROZEN (pixel-equivalent to current baseline).
- Primary density signal is CSS viewport width only; bands = LARGE_DESKTOP | WORKSTATION.
- Preserve Phase 3 sidebar rule: ≥1600 expanded default, <1600 collapsed default.
- Do not redesign Counsellor approved screens; they consume tokens only.
- Auth keeps its own clamp system unless a proven inconsistency appears.
- Patient portal and kiosk/immersive views are separate tracks — do not force staff density.
- Do not change APIs, permissions, workflows, business rules, or financial/clinical logic.
- Stack freeze: no new UI framework, toast lib, or design system.
- Accessibility: keep usable hit targets; do not shrink icon-only controls below practical use; preserve labels.
- Commit only when the user asks; each wave must be reviewable alone.

---

## File map (planned)

| File | Responsibility |
|------|----------------|
| `src/app/globals.css` | Declare density tokens; desktop SoT + workstation overrides |
| `src/app/dashboard/layout.tsx` | Consume shell pad/gap/content-pad tokens |
| `src/app/admin/layout.tsx` | Align shell densification with dashboard (parity) |
| `src/components/Sidebar.tsx` | Consume width/item/icon tokens; keep 1600 MQ behavior |
| `src/components/TopNav.tsx` | Consume height/pad/gap/avatar tokens |
| `src/components/LiveActivityFeed.tsx` | Bell icon size via token if feasible |
| `src/components/patients/lookup/BranchSwitcher.tsx` | Compact chip geometry via tokens where shared |
| `src/components/ui/button.tsx` (Wave 4) | Optional density-aware default size with escape |
| `src/components/ui/input.tsx` / `select.tsx` (Wave 4) | Same |
| `src/components/ui/card.tsx` / `dialog.tsx` / `sheet.tsx` (Wave 5) | Padding tokens + escape |
| `src/components/ui/table.tsx` (Wave 6) | Head/cell density tokens |
| `e2e/responsive-shell-phase3.spec.ts` | Keep contract; extend baselines |
| `e2e/responsive-density-phase5.spec.ts` (new) | Desktop freeze + workstation matrix |

---

### Task 1: Wave 1 — Global token foundation

**Files:**
- Modify: `apps/hospital-portal-web/src/app/globals.css`
- Test: `apps/hospital-portal-web/e2e/responsive-shell-phase3.spec.ts` (must still pass unchanged)

**Interfaces:**
- Consumes: measured SoT values from spec (56/240/64/12/8 px)
- Produces: CSS variables `--shell-pad`, `--shell-gap`, `--sidebar-expanded-width`, `--sidebar-collapsed-width`, `--topnav-height`, `--topnav-pad-x`, `--topnav-gap`, `--topnav-icon-size`, `--topnav-avatar-size`, `--page-content-pad` with desktop defaults equal to today and workstation overrides under `max-width: 1599.98px`

- [ ] **Step 1: Capture desktop baselines**

Document (in PR notes or e2e comments) measured values at 1920×1080 and 1600×900 for: sidebar width, topnav height, shell pad, content pad. Confirm they match classes already in code (`h-14`, `w-60`/`w-16`, `p-3`/`p-2`).

- [ ] **Step 2: Declare tokens with desktop = current UI**

In `globals.css` `:root`, set token values to **exactly** today’s computed UI (not invented). Example shape (final numbers must match audit):

```css
:root {
  --shell-pad: 12px;
  --shell-gap: 12px;
  --sidebar-collapsed-width: 64px;
  --sidebar-expanded-width: 240px;
  --topnav-height: 56px;
  --topnav-pad-x: 20px;
  --topnav-gap: 16px;
  --topnav-icon-size: 24px;
  --topnav-avatar-size: 32px;
  --page-content-pad: 16px;
}

@media (max-width: 1599.98px) {
  :root {
    --shell-pad: 8px;
    --shell-gap: 8px;
    --topnav-height: 48px; /* only if Wave 2/3 approved to consume */
    --topnav-pad-x: 16px;
    --topnav-gap: 12px;
    --topnav-icon-size: 20px;
    --topnav-avatar-size: 28px;
    --page-content-pad: 12px;
  }
}
```

**Important:** If Wave 1 is tokens-only (no consumers yet), workstation overrides for TopNav may be declared but unused — desktop defaults must not change any rendered pixel.

- [ ] **Step 3: Run Phase 3 e2e**

Run: `npx playwright test e2e/responsive-shell-phase3.spec.ts` from `apps/hospital-portal-web`  
Expected: PASS (sidebar ≥1600 expanded / <1600 collapsed unchanged)

- [ ] **Step 4: Stop for review**

No visual change expected. Request approval before Wave 2.

---

### Task 2: Wave 2 — Application shell

**Files:**
- Modify: `apps/hospital-portal-web/src/app/dashboard/layout.tsx`
- Modify: `apps/hospital-portal-web/src/app/admin/layout.tsx`
- Test: extend or add shell assertions in Phase 5 e2e

**Interfaces:**
- Consumes: `--shell-pad`, `--shell-gap`, `--page-content-pad`
- Produces: density-aware shell chrome with ≥1600 equivalent to current `min-[1600px]:p-3` / `gap-3` and <1600 equivalent to current `p-2` / `gap-2`

- [ ] **Step 1: Replace hardcoded shell pad/gap with tokens on dashboard layout**

Replace outer `p-2 gap-2 min-[1600px]:p-3 min-[1600px]:gap-3` with style/class using `var(--shell-pad)` / `var(--shell-gap)` such that computed px match today’s bands.

- [ ] **Step 2: Align admin layout shell**

Bring `admin/layout.tsx` onto the same shell pad/gap tokens (today always `p-3 gap-3`). At ≥1600 must remain 12px; at <1600 become 8px to match dashboard.

- [ ] **Step 3: Content pad token (default routes only)**

Where dashboard applies `p-4`, switch to `var(--page-content-pad)` **except** no-pad / immersive routes (queue-display, counselling canvases, optometrist exam) — those must stay unchanged.

- [ ] **Step 4: Visual check**

Viewports: 1920, 1600 (no change vs baseline), 1536 (shell gutters match prior dashboard workstation pad).

- [ ] **Step 5: Stop for review**

---

### Task 3: Wave 3 — Sidebar + TopNav

**Files:**
- Modify: `apps/hospital-portal-web/src/components/Sidebar.tsx`
- Modify: `apps/hospital-portal-web/src/components/TopNav.tsx`
- Modify (as needed): `LiveActivityFeed.tsx`, `BranchSwitcher.tsx`
- Test: `e2e/responsive-shell-phase3.spec.ts` + new TopNav height assertions

**Interfaces:**
- Consumes: sidebar width tokens; topnav height/pad/gap/icon/avatar tokens
- Produces: compact TopNav under 1600; unchanged TopNav at ≥1600; Phase 3 sidebar MQ preserved

- [ ] **Step 1: Sidebar widths from tokens**

Use `var(--sidebar-expanded-width)` / `var(--sidebar-collapsed-width)` instead of only `w-60`/`w-16`, keeping `lg` visibility and Phase 3 MQ defaults. Measured width at ≥1600 expanded ≥200px; workstation collapsed ≤80px (existing e2e).

- [ ] **Step 2: TopNav consume height/pad**

At ≥1600: height 56px, pad-x 20px (today). At <1600: height 48px, pad-x 16px (approved proposal). Do not change logout/settings IA.

- [ ] **Step 3: Icon / avatar compaction under 1600 only**

Bell 24→20, avatar 32→28 at workstation; unchanged at desktop.

- [ ] **Step 4: Regression**

Run Phase 3 specs + manual check Counsellor waiting-list at 1600 vs 1536 (sidebar behavior only; page chrome later).

- [ ] **Step 5: Stop for review**

---

### Task 4: Wave 4 — Shared controls (opt-in, not blind)

**Files:**
- Modify: `apps/hospital-portal-web/src/components/ui/button.tsx`
- Modify: `apps/hospital-portal-web/src/components/ui/input.tsx`
- Modify: `apps/hospital-portal-web/src/components/ui/select.tsx`
- Possibly: `pagination.tsx`
- Do **not** force CounsellingButton / exam `min-h-[44px]` down

**Interfaces:**
- Consumes: `--control-height`, `--control-pad-x` (add in this wave if approved)
- Produces: default control geometry that reproduces h-10 at ≥1600; optional h-9 at <1600 **only** when no local override class sets height

- [ ] **Step 1: Inventory escape hatches**

Confirm counselling `min-h-11`, exam `min-h-[44px]`, Button `size="sm"` (`h-8`) still win over density defaults via Tailwind precedence / explicit classes.

- [ ] **Step 2: Implement density-aware defaults with desktop SoT**

Desktop default must compile to same as current `h-10` / `px-4` / input `text-sm`. Workstation may use 36px height **only after** spot-checking doctors-desk, OPD billing, inventory GRN, pharmacy.

- [ ] **Step 3: If risk too high — ship variant instead**

Prefer `density="comfortable" | "compact"` or CSS class `.density-controls` on shell rather than silently changing all buttons. Choose the safer path if consumer breakages appear.

- [ ] **Step 4: Stop for review**

---

### Task 5: Wave 5 — Widgets / cards / overlays

**Files:**
- Modify: `card.tsx`, `dialog.tsx`, `sheet.tsx`, `alert-dialog.tsx` (padding tokens)
- Escape: counselling session widgets, StatCard, exam section cards

**Interfaces:**
- Consumes: `--widget-pad`
- Produces: `p-6` at ≥1600; tighter pad at <1600 for default Card/Dialog only

- [ ] **Step 1: Tokenize default padding only**
- [ ] **Step 2: Verify Dialog max-width / scroll / focus trap unchanged**
- [ ] **Step 3: Spot-check IP overlays (`IpOverlayDialog`) and payment drawers**
- [ ] **Step 4: Stop for review**

---

### Task 6: Wave 6 — Tables / worklists / pagination

**Files:**
- Modify: `ui/table.tsx`, `ui/pagination.tsx`
- Later module PRs: PatientHubTable, CCMS worklists, IP boards, frontdesk queue (local row pad only where needed)

**Interfaces:**
- Consumes: `--table-head-height`, `--row-pad-y`
- Produces: denser `ui/table` under 1600; no IA change; no card conversion

- [ ] **Step 1: Tokenize ui/table head/cell**
- [ ] **Step 2: Do not mass-edit raw `<table>` worklists in same PR**
- [ ] **Step 3: Schedule module worklist follow-ups (Wave 8)**
- [ ] **Step 4: Stop for review**

---

### Task 7: Wave 7 — Auth / Login

**Files:**
- Inspect only first: `auth-theme.css`, `AuthLayoutShell.tsx`
- Modify only if audit gaps prove inconsistency with readable workstation login

**Interfaces:**
- Consumes: existing `--auth-*` clamps
- Produces: preserved auth composition; optional min-size floors if clamps undershoot

- [ ] **Step 1: Verify login at 1536×864 and 1366×768**
- [ ] **Step 2: Change only if broken; otherwise document “preserve as-is”**
- [ ] **Step 3: Stop for review**

---

### Task 8: Wave 8 — Module-specific cleanup

Priority order (highest workstation traffic first):

1. OPD / Frontdesk queue (not TV)
2. Doctor's Desk + patients worklist
3. CCMS cases/claims/ops
4. Ward / IP / OT boards
5. Inventory + Procurement (`/admin/inventory`)
6. Pharmacy / Optical POS (careful with control height)
7. Finance / OPD billing
8. Optometry worklist (not exam canvas)
9. Follow-ups / analytics chrome
10. Admin/HR headers (low priority)

**Rules per module PR:**
- Prefer removing redundant local spacing once tokens exist
- Local override only with written justification
- No Counsellor redesign; only token consumption if shell/widget tokens apply
- No mock data; no route merges

---

### Task 9: Wave 9 — Counsellor validation

**Files:** waiting-list, finalize-surgery, surgery-followup, session `[id]` (Quote/Decision/Insurance/Notes/Finish)

- [ ] **Step 1: ≥1600 screenshot/compare — must match approved baseline**
- [ ] **Step 2: <1600 — collapsed sidebar + token-driven chrome only; no IA change**
- [ ] **Step 3: Confirm counselling-session-tokens clinical type sizes still readable**
- [ ] **Step 4: Stop for review**

---

### Task 10: Wave 10 — Full regression

**Viewports:** 1920×1080, 1600×900, 1536×864, 1440×900, 1366×768, 1280×720, 1200×800, 1024×768

**Capture per viewport:** sidebar, TopNav, page title, summary, controls, widgets, row height, typography, pagination, overflow

**Suites:**
- Existing `e2e/responsive-shell-phase*.spec.ts`
- New `e2e/responsive-density-phase5.spec.ts`
- Spot keyboard/focus on TopNav, Sidebar, one Dialog, one worklist

**Pass criteria:** desktop freeze + workstation intentional density + no horizontal scroll on primary worklists + a11y targets usable

---

## Regression strategy

| Risk | Mitigation |
|------|------------|
| Button/Input global shrink breaks counselling/exam | Escape hatches; Wave 4 opt-in; defer if needed |
| Admin shell change surprises inventory users | Wave 2 explicit admin parity + inventory screenshot |
| Counsellor drift at ≥1600 | Wave 9 hard gate; no visual redesign tasks |
| Double density (page min-[1600px] + tokens) | Wave 8 remove redundant local band classes after tokens |
| Mobile drawer regression | Do not touch `<lg` drawer unless conflict found |
| Financial/clinical logic | Zero API/workflow changes in density PRs |

## Desktop preservation strategy

1. Token defaults = measured current classes.
2. Screenshot/compare 1920 and 1600 before/after each wave.
3. Phase 3 e2e must stay green.
4. Any desktop delta is a wave failure — revert that wave.

## Workstation strategy

1. Collapsed sidebar (existing).
2. Compact TopNav (Wave 3).
3. Slightly tighter content/widget/row density (Waves 2, 5, 6, 8).
4. Typography: one step only where chrome/meta; primary clinical text protected.
5. No over-compaction — professional clinical density, not cramped admin console.
