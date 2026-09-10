# Global Responsive Density System — Design Spec (Phase 5)

> **Status:** AUDIT / ARCHITECTURE ONLY — not approved for implementation until explicit sign-off.  
> **Date:** 2026-09-10  
> **Scope:** Entire Hospital Portal (`apps/hospital-portal-web`) — Login → all authenticated screens.  
> **Constraint:** CSS viewport ≥1600px Large Desktop visual SoT is FROZEN.

## Problem

The portal’s approved Large Desktop design is coherent on 28–29" monitors, but below 1600 CSS px the experience is mostly “same desktop geometry with a collapsed sidebar,” not an intentional workstation density. Density behavior is fragmented across shell MQ, counsellor `min-[1600px]` classes, unused CSS layout vars, auth clamps, and ~1200 page-local `text-[…]` overrides.

## Goals

1. One Hospital Portal responsive design system (not Counsellor-only).
2. Two density bands only: **LARGE_DESKTOP** (≥1600) and **WORKSTATION** (<1600 within desktop shell).
3. ≥1600 remains pixel-equivalent to today’s approved UI.
4. <1600 reduces chrome / spacing / selected typography intentionally — no transform, zoom, or DPR switching.
5. Preserve IA, workflows, permissions, clinical/financial safety, Counsellor-approved screens, and existing mobile drawer behavior.

## Non-goals (this phase)

- Tablet/mobile redesign
- Converting tables to cards
- Redesigning Counsellor Quote → Finish / Waiting List / Finalize / OT prep
- Changing business logic, APIs, permissions, or routes
- New UI frameworks or design systems
- Continuous `clamp()` density for staff shell (auth may keep its own clamps)

## Architecture recommendation

**Approach A (recommended): CSS custom properties as density tokens**

- Declare LARGE_DESKTOP values on `:root` / `.dashboard-shell` matching today’s measured UI.
- Override under `@media (max-width: 1599.98px)` for WORKSTATION.
- Migrate consumers in waves: shell → TopNav/Sidebar → opt-in controls → widgets → tables → modules.
- Primary signal: **CSS viewport width** (same as Phase 3 sidebar rule).

**Rejected for primary path**

- **B:** Per-page `min-[1600px]:` everywhere — does not scale to ~293 routes.
- **C:** `data-density` + JS MQ as primary — duplicates Sidebar MQ; hydration risk. Optional later if needed for JS-measured chrome only.

## Density bands

| Band | Condition | Intent |
|------|-----------|--------|
| LARGE_DESKTOP | `min-width: 1600px` | Frozen approved SoT |
| WORKSTATION | `max-width: 1599.98px` and desktop shell (`lg+` / 1024+) | Intentional compact density |
| Mobile shell | `< lg` (1024) | Existing drawer — do not break |

Do not introduce additional density bands. Do not use physical inches or DPR as the density switch.

## Shell baselines (measured — SoT)

| Element | Current value | Source |
|---------|---------------|--------|
| Sidebar expanded | 240px (`lg:w-60`) | `Sidebar.tsx`; `--sidebar-expanded-width` declared unused |
| Sidebar collapsed | 64px (`lg:w-16`) | `Sidebar.tsx` |
| Sidebar default band | ≥1600 expanded; <1600 collapsed | `matchMedia('(min-width: 1600px)')` Phase 3 |
| TopNav height | 56px (`h-14`) | `TopNav.tsx`; `--topnav-height` declared |
| TopNav pad-x | 20px (`px-5`) | `TopNav.tsx` |
| Avatar | 32px | `TopNav.tsx` |
| Bell icon | 24px | `LiveActivityFeed` |
| Dashboard outer pad/gap | <1600: 8px; ≥1600: 12px | `dashboard/layout.tsx` |
| Main content pad | 16px (`p-4`) default | `dashboard/layout.tsx` |
| Admin outer pad/gap | always 12px | `admin/layout.tsx` — **no 1600 band** |
| Patient shell | always `w-60` + `p-3 gap-3` | Separate consumer shell |

## Shared primitive baselines (measured)

| Primitive | Default | Risk if global shrink |
|-----------|---------|----------------------|
| Button md | `h-10` / `text-base` / `px-4` | Critical (~121 consumers) |
| Input / Select | `h-10` / `text-sm` | High |
| Card sections | `p-6` | High |
| Dialog / Sheet / AlertDialog | `p-6` | High |
| Table head / cell | `h-12` / `p-4` | High (many worklists bypass) |
| Pagination | `h-9` controls | Medium |
| Command input | `h-11` | Medium |
| CounsellingButton | `min-h-11` touch | Must keep escape hatch |
| Auth | viewport `clamp()` tokens | Keep separate |

## Token set (only where repeated)

Introduce tokens only when Wave consumers will use them. Desktop value **must equal today’s UI**.

Proposed initial set (workstation numbers are proposals pending approval):

| Token | ≥1600 | <1600 (proposal) |
|-------|-------|------------------|
| `--shell-pad` | 12px | 8px (already) |
| `--shell-gap` | 12px | 8px (already) |
| `--sidebar-expanded-width` | 240px | 240px |
| `--sidebar-collapsed-width` | 64px | 64px |
| `--topnav-height` | 56px | 48px |
| `--topnav-pad-x` | 20px | 16px |
| `--topnav-gap` | 16px | 12px |
| `--topnav-icon-size` | 24px | 20px |
| `--topnav-avatar-size` | 32px | 28px |
| `--page-content-pad` | 16px | 12px |
| `--control-height` | 40px | 36px (Wave 4+, opt-in) |
| `--widget-pad` | 24px | 16–20px (Wave 5+, with escape) |
| `--table-head-height` | 48px | 40px (ui/table only first) |
| `--row-pad-y` | 16px | 10–12px (worklist migration) |

Do **not** blindly shrink all fonts. Primary clinical identifiers stay ≥ readable minimum (prefer ≥12px body / ≥14px primary patient name where already SoT).

## Special cases

1. **Login / Auth** — keep `auth-theme.css` clamp system; do not force dashboard density tokens.
2. **Counsellor** — consume global tokens where chrome overlaps; do not redesign approved session/worklist visuals at ≥1600.
3. **Patient portal** — separate shell; defer staff-density unification.
4. **Kiosk / queue-display** — immersive; out of workstation densification.
5. **Clinical exam / counselling touch targets** — preserve ≥44px where already intentional.

## Implementation gating

Waves 1→10 as in companion plan. Stop after each wave for visual regression on 1920 / 1600 / 1536. No single mega-PR.

## Success criteria

- 1920×1080 and 1600×900: unchanged / demonstrably equivalent.
- 1536×864 @ DPR ~1.25: collapsed sidebar, compact TopNav, tighter widgets/rows, readable clinical text, no unnecessary horizontal scroll, same IA.
- Every production module follows the same density principle via shared tokens first, local exceptions only when justified.
