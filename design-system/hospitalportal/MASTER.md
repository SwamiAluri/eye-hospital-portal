# Design System Master File — Hospital Portal (constrained)

> **LOGIC:** When building a specific page, first check `design-system/hospitalportal/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> **This file is hand-constrained.** Raw `ui-ux-pro-max --design-system` output suggested teal/Figtree/marketing patterns.
> Those recommendations are **rejected**. Colors, fonts, and primitives below match the live portal.
> Conflict order: `.cursor/rules` (esp. `00`–`02`, `10`, `14`) → this MASTER → skill search tips.

---

**Project:** HospitalPortal  
**Updated:** 2026-09-10  
**Category:** Eye Hospital Management System (staff EMR / operations)  
**Stack (frozen):** Next.js 14.2 · React 18 · TypeScript · Tailwind 3 · shadcn/ui · Radix · Lucide · Zustand · TanStack Query · SignalR · `react-hot-toast`

---

## Global Rules

### Color Palette (staff dashboard — SoT)

Use existing CSS variables / Tailwind tokens from `apps/hospital-portal-web` (`globals.css`, `tailwind.config.js`). Do **not** introduce `--color-primary` teal from the generator.

| Role | Hex / token | Notes |
|------|-------------|--------|
| Sidebar / chrome | `navy-900` `#0f1e3c` … `navy-600` `#2a4fa3` | Staff shell |
| Primary (actions) | `primary-600` `#059669` / `primary-500` `#10b981` | Emerald CTAs |
| Primary soft | `primary-50`–`100` | Selected rows, soft fills |
| Background | App default (white / gray-50 patterns already in layouts) | No teal wash |
| Destructive | Existing destructive / red patterns in shadcn | Keep semantic meaning |
| Focus ring | Match existing `ring` / focus-visible on shadcn controls | Visible focus required |

**Scoped themes (do not unify globally):**

| Scope | Where |
|-------|--------|
| IP / ward / OT | `.ip-target` + `IpTargetFrame` |
| Counselling session | `.counselling-session` |
| Auth | `.auth-oc` |
| Patient portal | `src/app/patient/` |

### Typography

- **Keep current portal fonts** (existing `font-sans` / layout setup).  
- Do **not** add Figtree, Noto Sans, or other Google Font imports for a redesign.  
- Staff worklists: dense, readable; prefer clarity over display type.

### Spacing

Prefer Tailwind scale already in use (`p-2`, `p-4`, `gap-2`, `gap-4`, etc.). Desktop workstation density beats mobile-first large hero padding. Do not invent a parallel `--space-*` token file.

### Elevation

Use existing shadcn Card / Dialog / Sheet shadows. Avoid decorative hover `translateY` that shifts dense worklist rows.

---

## Component Specs (reuse, do not recreate)

| Need | Use |
|------|-----|
| Button / Input / Select / Table / Badge / Tabs | `src/components/ui/*` |
| Dialog | `ui/dialog.tsx` |
| Side panel | `ui/sheet.tsx` |
| Confirm | `ui/alert-dialog` or `common/ConfirmationDialog` |
| IP overlays | `IpOverlayDialog` |
| Icons | **Lucide only** |
| Toasts | **react-hot-toast** |
| Permissions | `PermissionGate` + `ProtectedRoute` |

Compose domain kits (`counsellors-desk`, `billing`, `ip-management`, …) — do not clone a second design system.

---

## Style Guidelines (agent UX goals)

**Adopt from ui-ux-pro-max (behavior only):**

- Accessible & ethical: contrast ≥ 4.5:1, keyboard, visible focus, semantic HTML, `prefers-reduced-motion`
- Resilient text: chips/badges wrap or `+n` disclosure; no color-only status meaning
- Loading / empty / error / permission denied / retry on every production workflow
- Desktop-first staff UX; patient portal and kiosk may be more consumer-like

**Reject from generator for staff app:**

- Trust & Authority marketing landing (hero → logos → CTA)
- Soft UI / glass / bento / purple AI gradients
- New primary teal (`#0891B2`) or mint backgrounds (`#F0FDFA`)
- 44×44 touch targets as a reason to blow up dense clinical tables (keep usable density; icon buttons still need accessible names)

---

## Anti-Patterns (Do NOT Use)

- ❌ New color system / font stack / UI framework  
- ❌ Emojis as icons (Lucide only)  
- ❌ Invisible focus / low-contrast status text  
- ❌ Happy-path-only screens (no empty/error/loading)  
- ❌ Mock clinical or financial rows to “look complete”  
- ❌ Merging kiosk/patient patterns into staff worklists  
- ❌ Layout-shifting hover transforms on worklist rows  
- ❌ Second toast library or icon pack  

---

## Pre-Delivery Checklist

Before delivering UI changes:

- [ ] Reused existing `ui/*` / domain kit — no new primitive without search  
- [ ] Navy / emerald (or correct scoped theme) — no generator teal  
- [ ] Lucide icons only; no emoji icons  
- [ ] `cursor-pointer` (or equivalent) on clickable controls  
- [ ] Visible focus; keyboard operable  
- [ ] Contrast ≥ 4.5:1 on text and status  
- [ ] `prefers-reduced-motion` respected where motion was added  
- [ ] Loading, empty, error, permission-denied handled  
- [ ] No PHI in logs, URLs, or commits  
- [ ] Permissions / workflow state not bypassed for polish  
- [ ] Staff: dense desktop layout still usable at ~1024–1440px  

---

## How agents should use ui-ux-pro-max here

1. Read this MASTER (+ page override if any).  
2. Read `.cursor/rules/14-ui-ux-pro-max-hospital.mdc`.  
3. Prefer skill **domain** searches (`ux`, `icons`, stack `nextjs` / `shadcn` / `react`) over `--design-system`.  
4. Use `--design-system` only when the user explicitly asks for a **new** visual direction — then still map onto existing tokens unless redesign is approved.  
5. Persist page overrides under `pages/` for real deviations only (e.g. counselling session chrome).
