# Counselling UI Component Registry (PR0)

Single source of truth for [21st.dev](https://21st.dev/community/components) and shadcn components used in the counselling session redesign.

## Policy

1. **Session components** (`counsellors-desk/session/**`) must import interactive UI from `@/components/counsellors-desk/session/primitives` (PR1+ refactors). Display-only re-exports (`CounsellingBadge`, `CounsellingSeparator`, etc.) live in the same barrel.
2. **Raw HTML** (`<button>`, `<input>`, `<select>`, `<textarea>`) is allowed only inside `primitives/`. Enforced by ESLint `react/forbid-elements` override on `session/**` (see `.eslintrc.json`).
3. **Install new blocks** via shadcn CLI using 21st registry URLs below.

## shadcn configuration

- Config: `apps/hospital-portal-web/components.json`
- Utils: `@/lib/utils` (`cn()`)
- UI path: `@/components/ui`

After pulling this branch, install new Radix dependencies.

**Recommended (this monorepo):** pnpm from repo root:

```bash
cd "Hospital Portal"
pnpm install --filter hospital-portal-web
```

**Alternative:** npm workspaces (may fail without `package-lock.json` on some npm versions):

```bash
npm install -w hospital-portal-web
```

---

## Installed UI components (PR0)

| Component | File | 21st / source |
|-----------|------|---------------|
| Segmented Button Group | `components/ui/segmented-button-group.tsx` | [ruixen.ui/segmented-button-group](https://21st.dev/community/components/ruixen.ui/segmented-button-group) |
| Stepper | `components/ui/stepper.tsx` | [originui/stepper](https://21st.dev/community/components/originui/stepper/controlled-vertical) |
| Radix Tabs | `components/ui/radix-tabs.tsx` | [shadcn/tabs/with-card](https://21st.dev/community/components/shadcn/tabs/with-card) |
| Radio Group | `components/ui/radio-group.tsx` | [Radio Groups](https://21st.dev/community/components) (shadcn) |
| Toggle Group | `components/ui/toggle-group.tsx` | [Toggles](https://21st.dev/community/components) (shadcn) |
| Tooltip | `components/ui/tooltip.tsx` | [Tooltips](https://21st.dev/community/components) (shadcn) |
| Sheet | `components/ui/sheet.tsx` | [Sheets](https://21st.dev/community/components) (shadcn) |
| Scroll Area | `components/ui/scroll-area.tsx` | [Scroll Areas](https://21st.dev/community/components) (shadcn) |
| Accordion | `components/ui/accordion.tsx` | [Accordions](https://21st.dev/community/components) (shadcn) |
| Alert Dialog | `components/ui/alert-dialog.tsx` | [Dialogs / Modals](https://21st.dev/community/components) (shadcn) |

### Pre-existing (reuse)

| Component | File |
|-----------|------|
| Button | `components/ui/button.tsx` |
| Input | `components/ui/input.tsx` |
| Select | `components/ui/select.tsx` |
| Checkbox | `components/ui/checkbox.tsx` |
| Badge | `components/ui/badge.tsx` |
| Card | `components/ui/card.tsx` |
| Alert | `components/ui/alert.tsx` (+ `warning`, `info` variants) |
| Dialog | `components/ui/dialog.tsx` |
| Command | `components/ui/command.tsx` |
| Popover | `components/ui/popover.tsx` |
| Separator | `components/ui/separator.tsx` |
| Empty State | `components/ui/EmptyState.tsx` |

---

## Counselling primitives (import these in PR1+)

Path: `components/counsellors-desk/session/primitives/`

| Primitive | Wraps | Use for |
|-----------|-------|---------|
| `CounsellingButton` | `ui/button` | All actions |
| `CounsellingInput` | `ui/input` | Form fields |
| `CounsellingSelect` | `ui/select` | Payment, insurance, follow-up |
| `CounsellingSegmented` | `segmented-button-group` | RE/LE/BE, Imaging/Lab |
| `CounsellingSearchInput` | Input + clear | Procedure/package search |
| `CounsellingSelectableRow` | `CounsellingButton` + checkbox slot | Procedure/investigation lists |
| `CounsellingInfoAlert` | `ui/alert` | Session state banners, doctor rec, conflicts |
| `CounsellingPhaseTrigger` | `CounsellingButton` | Phase nav sidebar + mobile pills (PR6) |
| `CounsellingCheckbox` | `ui/checkbox` | Investigation rows, workflow options |
| `CounsellingLabel` | `ui/label` | Form field labels in session |
| `CounsellingDatePicker` | Popover + Calendar | Follow-up / schedule dates |
| `CounsellingTooltip*` | `ui/tooltip` | Disabled footer action hints (P2) |
| `CounsellingSheet*` | `ui/sheet` | Mobile quote bottom sheet (P2) |
| `CounsellingCommand*` | `ui/command` | Procedure combobox (P4) |
| `CounsellingSkeleton` | `ui/skeleton` | Catalog loading placeholders (P4) |
| `CounsellingGlassRadioGroup` | RadioGroup + glass CSS | Pricing mode picker (P4) |
| `CounsellingBadge` | `ui/badge` | Status chips, eye badges, counts |
| `CounsellingDialog*` | `ui/dialog` | Print estimate, price override |
| `CounsellingSeparator` | `ui/separator` | Investigation category headers |
| `CounsellingAccordion*` | `ui/accordion` | Notes collapsible (legacy section) |
| `CounsellingProcedureCombobox` | Command + Popover | Legacy; primary flow uses inline catalog search |
| `CounsellingPackageCombobox` | Command + Popover | Legacy; primary flow uses inline catalog search |
| `CounsellingRadioGroup*` | `ui/radio-group` | Patient decision cards, IOL selection |
| `CounsellingToggleGroup*` | `ui/toggle-group` | Quote discount type (% / flat) |
| `CounsellingPricingCard` | `ui/card` | Package selection |
| `CounsellingTabs*` | `radix-tabs` | Custom \| Package tabs (estimate builder) |
| `CounsellingAlertDialog*` | `ui/alert-dialog` | Package → custom confirm |
| `CounsellingEmptyState` | `EmptyState` | Quote/search empty |
| `CounsellingTextarea` | `ui/textarea` | Notes fields (PR4) |
| `CounsellingQuoteSummary` | composed | Read-only quote body (PR4) |

Import barrel:

```tsx
import {
  CounsellingButton,
  CounsellingSegmented,
  CounsellingPricingCard,
  // ...
} from '@/components/counsellors-desk/session/primitives';
```

---

## Design tokens

| Asset | Path |
|-------|------|
| Tailwind semantic classes | `counselling-*` namespace in `tailwind.config.js` |
| Scoped CSS variables | `session/counselling-session-theme.css` (maps to shadcn `--primary`, `--muted`, `--card`, `--border`, etc.) |
| Class token barrel | `lib/counsellors-desk/counselling-session-tokens.ts` |
| Page wrapper class | `counselling-session` on session page root + `CounsellingTabPanel` |

Use semantic classes inside `.counselling-session`:

- **shadcn:** `bg-card`, `text-muted-foreground`, `border-border`, `bg-background`
- **counselling namespace:** `text-counselling-primary`, `bg-counselling-accent` (teal hospital brand)

Both resolve via scoped CSS variables in `counselling-session-theme.css`.

Deprecated stepper/accordion re-exports live in `primitives/legacy-21st.ts` (not in the main barrel).

---

## Phase navigation (canonical — PR6)

The session uses a **3-phase hybrid flow**, not the original 7-step OriginUI stepper.

| Phase | ID anchor | Contains |
|-------|-----------|----------|
| Build Quote | `counselling-step-1` … `counselling-step-2` | Procedure/package + investigations |
| Patient Decision | `counselling-step-3` … `counselling-step-5` | Payment, decision, schedule |
| Wrap-up | `counselling-step-6` … `counselling-step-7` | Notes + options |

| Component | Path |
|-----------|------|
| Phase nav (sidebar + mobile segmented) | `session/CounsellingPhaseNav.tsx` |
| Phase trigger primitive | `session/primitives/CounsellingPhaseTrigger.tsx` |
| Estimate phase | `session/CounsellingEstimatePhase.tsx` |
| Decision phase | `session/CounsellingDecisionPhase.tsx` |
| Wrap-up phase | `session/CounsellingWrapupPhase.tsx` |
| Phase state | `lib/counsellors-desk/counselling-progress.ts` |

### Section anchor IDs (E2E scroll targets)

| Section | ID |
|---------|-----|
| Build estimate (procedure + package) | `counselling-step-1` |
| Investigations | `counselling-step-2` |
| Payment (decision phase) | `counselling-step-3` |
| Decision (decision phase) | `counselling-step-4` |
| Schedule (decision phase, conditional) | `counselling-step-5` |
| Notes (wrap-up phase) | `counselling-step-6` |
| Options (wrap-up phase) | `counselling-step-7` |

---

## E2E `data-testid` conventions

Defined in `counselling-session-tokens.ts` → `counsellingTestIds`.

| Test ID | Element |
|---------|---------|
| `counselling-phase-{estimate\|decision\|wrapup}` | Phase nav step |
| `counselling-btn-phase-next` / `counselling-btn-phase-back` | Footer phase navigation |
| `counselling-tab-custom` / `counselling-tab-package` | Estimate type tabs (custom \| package) |
| `counselling-package-search` | Package catalog inline search input |
| `counselling-tab-imaging` / `counselling-tab-lab` | Investigations segmented tabs (canonical; legacy alias `counselling-inv-*` deprecated) |
| `counselling-procedure-search` | Procedure catalog inline search input |
| `counselling-eye-re` / `counselling-eye-le` / `counselling-eye-be` | Eye selector segmented options |
| `counselling-investigation-search` | Investigation search |
| `counselling-quote-panel` | Desktop quote card |
| `counselling-quote-go-to-estimate` | Empty quote → Build Quote CTA |
| `counselling-quote-mode-badge` | Quote mode badge |
| `counselling-quote-final-payable` | Final payable block |
| `counselling-pricing-mode-custom` / `counselling-pricing-mode-package` | Deprecated glass radio (removed; use estimate type tabs) |
| `counselling-btn-save-session` | Save Session footer button |
| `counselling-btn-open-coverage` | Decision phase → Coverage & Pre-Auth tab |
| `counselling-quote-line-edit-price` | Procedure row price override (pencil) |
| `counselling-quote-discount-apply` | Apply discount Add button |
| `counselling-follow-up-date` | Follow-up date picker (decision phase) |

Deprecated (removed with PR6): `counselling-progress-step-{n}`, `counselling-finalize-{key}`.

Helpers: `e2e/helpers/counselling.ts`

---

## 21st acceptance checklist (current)

| Criterion | Status |
|-----------|--------|
| No raw interactive HTML in `session/**` except `primitives/` | ✅ ESLint `.eslintrc.json` |
| 3-phase nav + `CounsellingPhaseTrigger` | ✅ Replaces 7-step OriginUI stepper |
| Procedure catalog (category + inline search) | ✅ |
| IOL + decision RadioGroup | ✅ |
| Investigations Segmented + Checkbox/Label rows | ✅ |
| Quote discount ToggleGroup | ✅ |
| Calendar date picker (follow-up) | ✅ |
| Session banners → Alert | ✅ |
| Override Textarea | ✅ |
| Mobile Sheet quote | ✅ |
| Tooltips on disabled actions | ✅ |
| Next disabled until phase valid | ✅ |
| Empty quote CTA | ✅ |
| Procedure Skeleton loading | ✅ |
| Estimate type tabs (custom \| package) | ✅ |
| Semantic shadcn tokens | ✅ `bg-card`, `text-muted-foreground`, scoped `--primary` |
| Primitives-only imports in session (no direct `@/components/ui/*`) | ✅ P5 hygiene pass |
| Notes accordion (shadcn) | ✅ `CounsellingNotesSection` |
| Investigation/procedure empty states | ✅ `CounsellingEmptyState` |
| Save / panel loading polish | ✅ Loader2 + `CounsellingSkeleton` |
| Orphan strip / stepper in active UI | ✅ Removed / archived to `legacy-21st.ts` |
| Finalize accordion (steps 4–8) | ⏭️ Intentionally replaced by 3-phase layout (PR6) |

---

## Optional future installs

```bash
# Command palette blocks: https://21st.dev/community/components/s/command-palette
```

---

## PR roadmap

| PR | Scope |
|----|--------|
| **PR0** ✅ | This registry, UI components, primitives, tokens, theme scope |
| **PR1** ✅ | Phase foundation + main session tabs (superseded by PR6 phase nav) |
| **PR2** ✅ | Estimate builder card (Custom \| Package tabs), read-only mirror, quote panel mode badge |
| **PR3** ✅ | Investigations card (segmented tabs, checkbox rows) |
| **PR4** ✅ | Quote summary extraction, panel simplification, workflow/override primitive migration |
| **PR5** ✅ | E2E updates, print dialog primitives, remove deprecated session components |
| **PR6** ✅ | 3-phase hybrid flow — phase nav, estimate/decision/wrap-up phases, compact header |
| **P0** ✅ | PhaseTrigger, Checkbox, Label, DatePicker primitives; ESLint raw-HTML guard; registry sync |
| **P1** ✅ | ToggleGroup discount, RadioGroup decision/IOL, Segmented investigations, Alert banners, DatePicker follow-up, Textarea override remarks |
| **P2** ✅ | Disabled Next until phase valid, empty-quote CTA, mobile Sheet quote, tooltips on blocked footer actions |
| **P3** ✅ | shadcn semantic tokens (`counselling-*` Tailwind + scoped CSS vars); slate/teal hardcode removal |
| **P4** ✅ | Procedure Command combobox, catalog skeleton loading, glass radio pricing mode strip |
| **P5** ✅ | Badge/Dialog/Separator/Accordion barrel; primitives-only session imports |
| **P6** ✅ | Gray hardcode removal in session UI (PDF print doc exempt) |
| **P7** ✅ | Notes accordion, CounsellingLabel forms, decision RadioGroup + Card |
| **P8** ✅ | Empty states, Loader2 save, skeleton panel loading |
| **P9** ✅ | E2E glass radio test; test ID doc sync |

### P2 UX polish details

| Item | Implementation |
|------|----------------|
| Phase Next guard | `canAdvancePhase` / `phaseAdvanceError` from `validatePhase()` — footer Next disabled + tooltip |
| Empty quote CTA | `counselling-quote-go-to-estimate` → `goToPhase('estimate')` when not on estimate phase |
| Mobile quote | `CounsellingQuoteBottomSheet` uses shadcn `Sheet` (side bottom) above sticky footer |
| Disabled tooltips | `CounsellingDisabledActionTooltip` on Print / Next / Save |
