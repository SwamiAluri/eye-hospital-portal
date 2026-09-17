# Phase 3I — Counselling Session UX Correction

| Field | Value |
|-------|--------|
| **Date** | 2026-09-16 |
| **Scope** | Notes spacing + Clinical Recommendations header action + Sheet |
| **Status** | **IMPLEMENTED** — ready for manual UAT |
| **Slice 3** | **Not implemented** |

---

## Statement

Clinical Recommendations is a contextual header action. Its details are
displayed in the existing right-side Sheet pattern.

Optometrist content remains static UX placeholder content and is not a
clinical source of truth.

Phase 3I Slice 3 Assign/Reassign was not implemented.

---

## Observed Notes spacing issue

On the Counselling Session Notes workspace, the Doctor notes field and the
Additional Options heading had insufficient vertical separation. Combined with
`flex-1` + `overflow-hidden` on the Notes shell, the Doctor field could appear
clipped against Additional Options at workstation densities.

---

## Fix applied (Notes) — preserved

File: `CounsellingWrapupPhase.tsx`

- Preserved approved structure: Counsellor → Patient → Doctor → Additional Options
- Each note field wrapper uses `shrink-0` with consistent `space-y-1` label→input rhythm
- Documentation stack uses `space-y-2.5` between fields
- Additional Options is a separate section (`notesAdditionalOptionsSection`) with
  `border-t`, `pt-3.5`, and `mt-auto`
- Replaced section `overflow-hidden` with `overflow-x-hidden` to avoid clipping
- Notes spacing correction was **not undone** in later header refinements

---

## Patient Details Sheet — final UX refinement

Patient Details Sheet composition aligned to approved visual reference:

- Title + subtitle (“Key information for this patient”) + Close
- Hero identity card (avatar, name, MRN, age · sex · eye)
- Identity / Contact / Visit & Session / Clinical Context cards with icon headers
- Session status uses existing amber pill treatment (no new status system)
- No footer disclaimer / instructional copy
- Counselling callers get `counselling-session` portal chrome; optometry callers keep neutral chrome
- Clinical Recommendations Sheet untouched (separate contextual panel)

---

## Header action polish

Chevron / arrow link treatment (`>`) replaced with sibling contextual actions:

- **Stethoscope** + Clinical Recommendations
- **UserRound** + Patient Details

Same ghost-button language, accessible names, focus rings. No large pills,
saturated backgrounds, or expanded recommendation content in the header.

---

## Blank Sheet — root cause and fix

### Root cause

`ClinicalRecommendationsSheet` uses Radix `Sheet` / `SheetContent`, which
**portals to `document.body`**. That places the panel **outside** the
`.counselling-session` ancestor where counselling CSS variables
(`--counselling-*` and remapped `--foreground` / `--muted`, etc.) are defined.

Body copy and accents used counselling-scoped tokens without that class on
the portaled panel, so the Sheet **shell** (overlay + panel chrome) opened
while recommendation text could appear blank / invisible.

This matches the established Waiting List detail sheet pattern, which already
puts `counselling-session` on `SheetContent`.

### Fix applied

On `ClinicalRecommendationsSheet` `SheetContent`:

- Add `counselling-session` so theme variables resolve in the portal
- Align surface with Waiting List / Patient Details: `bg-gray-100`,
  counselling border/card tokens
- Keep scrollable body (`min-h-0 flex-1 overflow-y-auto`)
- Defer Patient Details open via `requestAnimationFrame` after closing
  Clinical Recommendations to avoid Radix dual-Dialog race

---

## Sheet behavior

**Title:** Clinical Recommendations

**Patient context:** name + MRN from session/patient

**Doctor** (existing `doctorRecommendation` path + eye):

- Example: `EDOF Lens (40cm-Distance) · RE`
- **View clinical details** → closes this sheet, then opens existing
  `PatientDemographicsSheet`

**Optometrist** (static UX placeholder):

- `Distance + near visual needs reviewed`
- `Optical correction discussed`
- No details action / fake route
- No Doctor/Optometrist tabs

Placeholder module:
`src/lib/counsellors-desk/clinical-recommendations-placeholder.ts`

---

## Backend / API / DB / ownership

| Area | Changed? |
|------|----------|
| Backend services / controllers | **NO** |
| API contracts | **NO** |
| Database / migrations | **NO** |
| CounselorId / ownership | **NO** |
| Assign / Reassign | **NO** |
| Permissions | **NO** |

---

## Tests

### Added / updated

- `session-page-header.test.tsx`
  - Icon+label header actions; no chevron
  - Compact header (no amber panel / no body content in header)
  - Sheet mock (Waiting List pattern) for open→content regression
  - Closed sheet mounts nothing
  - Optometrist still renders when Doctor summary absent
- Notes tests unchanged; remain green

### Executed

```text
vitest run src/components/counsellors-desk/session/
         src/lib/counsellors-desk/counselling-journey-navigation.test.ts
         src/lib/counsellors-desk/counselling-session-navigation.test.ts
         src/lib/counsellors-desk/counselling-progress.test.ts
```

### Results

See latest vitest run in implementation report (all green).

---

## Accessibility

- Triggers: semantic buttons, `aria-label`, focus-visible rings, Lucide icons `aria-hidden`
- Sheet: Radix title, Close with `aria-label`, Escape / focus trap via Radix

---

## Responsive validation

Uses existing flex/wrap tokens. **Manual UAT** at 1280 / 1366 / 1440 / 1600 / 1920.

---

## Remaining Phase 3I work

- Manual UAT for this interaction fix
- Phase 3I Slice 3 — Assign / Reassign (**not** started)
- Future clinical-source integration for Optometrist placeholder

---

## Manual UAT checklist

### A. Header

1. Compact patient header
2. Clinical Recommendations = icon + label button
3. Patient Details = matching icon + label button
4. No primary `>` / `→` chevron treatment
5. No large amber recommendation panel in header

### B. Clinical Recommendations Sheet

6–15. Open sheet; title; Doctor + Optometrist content **visible**; no Optometrist details; close

### C. Doctor details transition

16–20. View clinical details → Clinical sheet closes → PatientDemographicsSheet opens

### D. Patient Details

21–23. Patient Details still opens existing sheet

### E. Notes

24–25. Spacing + Additional Options unchanged

### F. Responsive

26–30. 1280 / 1366 / 1440 / 1600 / 1920 — no clip/overlap/overflow

### G. Ownership

Opening session does not change CounselorId; no Assign/Reassign UI
