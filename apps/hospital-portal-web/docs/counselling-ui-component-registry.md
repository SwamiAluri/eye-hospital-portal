# Counselling UI Component Registry (PR0)

Single source of truth for [21st.dev](https://21st.dev/community/components) and shadcn components used in the counselling session redesign.

**Related:** [ward-preop-workspace-spec.md](./ward-preop-workspace-spec.md) (optional counsellor investigation values → ward §1, Phase 9).

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
| `CounsellingDatePicker` | Popover + Calendar | Follow-up dates (`variant="compact"`) |
| `SessionDatePicker` | `CounsellingDatePicker` | Shared alias; use for new integrations |
| `CounsellingSearchInput` | Input + clear | Procedure/package search; `density="catalog"` (h-9) in filter bars |
| `CounsellingSelectableRow` | `CounsellingButton` + checkbox slot | Procedure/investigation lists; default `density="catalog"` |
| `CounsellingInfoAlert` | `ui/alert` | Session state banners, doctor rec, conflicts |
| `CounsellingWizardNav` | `session/CounsellingWizardNav.tsx` | Horizontal icon-card session flow (mirrors Coverage wizard) |
| `CounsellingPhaseTrigger` | `CounsellingButton` | Legacy timeline step |
| `CounsellingStepper*` | `ui/stepper` | Legacy vertical stepper primitive (retained for reuse) |
| `CounsellingCheckbox` | `ui/checkbox` | Investigation rows, workflow options |
| `CounsellingLabel` | `ui/label` | Form field labels in session |
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
| Title Case UI copy | `lib/counsellors-desk/counselling-copy.ts` — **single source** for session + coverage labels (Phase 8 ✅) |
| Page wrapper class | `counselling-session` on session page root + `CounsellingTabPanel` |

### Catalog density tokens (desktop workstation)

Applied to procedure/package/investigation lists — single outer scroll on the workspace column (no nested `max-h-*` list scroll).

| Token | Purpose |
|-------|---------|
| `catalogRow` | h-9 list rows |
| `catalogInput` | h-9 search/select in filter bars |
| `catalogListGap` | `space-y-0.5` between rows |
| `catalogCategoryGap` | `space-y-2` between category blocks |
| `catalogSelectedRow` | inset ring selection (no `border-l-4` layout shift) |
| `catalogStickyFilters` | sticky filter bar inside estimate cards |

`CounsellingDatePicker` / `SessionDatePicker` variants:

| Variant | Use |
|---------|-----|
| `compact` (default) | Follow-up — quick picks + chevron month nav |
| `scheduling` | Surgery — month/year dropdowns, h-9 trigger |

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
| Session Notes | `counselling-step-6` … `counselling-step-7` | Notes + options |

| Component | Path |
|-----------|------|
| Phase nav (horizontal icon-card wizard inside phase cards) | `CounsellingPhaseNav` → `CounsellingWizardNav`; embedded in Build Estimate / Decision / Session Notes |
| Stepper primitives | `session/primitives/CounsellingStepper.tsx` |
| Phase trigger primitive (legacy) | `session/primitives/CounsellingPhaseTrigger.tsx` |
| Estimate phase | `session/CounsellingEstimatePhase.tsx` |
| Decision phase | `session/CounsellingDecisionPhase.tsx` |
| Session Notes phase | `session/CounsellingWrapupPhase.tsx` |
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
| `counselling-btn-save-session` | Complete Session footer button (test id retained; kind `save_session`) |
| `counselling-btn-patient-details` | Patient details link (session header) |
| `counselling-btn-save-draft` | Save Draft footer button (all tabs) |
| `counselling-insurance-company` | Insurance company select (Decision phase payment) |
| `counselling-btn-open-coverage` | Decision phase → Coverage & Pre-Auth tab |
| `counselling-quote-line-edit-price` | Procedure row price override (pencil) |
| `counselling-quote-discount-apply` | Apply discount Add button |
| `counselling-follow-up-date` | Follow-up date picker (decision phase, `SessionDatePicker` compact) |
| `counselling-schedule-surgery-date` | Schedule Surgery modal date (`SessionDatePicker` scheduling) |

### Coverage & Pre-Auth (`coverage-test-ids.ts`)

| Test ID | Element |
|---------|---------|
| `coverage-insurer-name` | Insurer / TPA field (Policy step) |
| `coverage-estimated-amount` | Surgery/procedure amount field (CoverageEstimateTab) |
| `coverage-surgery-date` | Estimated surgery date (`CoverageDatePicker` scheduling) |
| `coverage-policy-expiry-date` | Policy expiry date (`CoverageDatePicker` scheduling) |
| `policy-card-ocr-panel` | Insurance card scan upload panel |
| `policy-extraction-review` | OCR review modal after scan |
| `coverage-step-policy` / `coverage-step-estimate` / `coverage-step-documents` | Coverage wizard icon-card steps (Phase 5) |
| `coverage-visit-policies-rail` | Right-rail visit policy CRUD list |
| `coverage-manage-visit-policies` | Policy step → Manage Policies CTA |
| `visit-policy-add` / `visit-policy-number` / `visit-policy-save` | Visit policy form (right rail) |

Deprecated (removed with PR6): `counselling-progress-step-{n}`, `counselling-finalize-{key}`, numbered coverage tabs (`1 · Policy`, …), `coverage-preview-banner`.

Helpers: `e2e/helpers/counselling.ts` — `goCoverageWizardStep`, `goCoverageTabWithWizard`, `coverageWizardStep`, `counsellingPhaseStep`, `visitPoliciesRail`, `patientDetailsButton`.

---

## 21st acceptance checklist (current)

| Criterion | Status |
|-----------|--------|
| No raw interactive HTML in `session/**` except `primitives/` | ✅ ESLint `.eslintrc.json` |
| 3-phase nav + horizontal icon-card wizard | ✅ Replaces vertical sidebar (Coverage-style) |
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
| **P9** ✅ | E2E helpers + spec sync for wizard steps, visit policies rail, header chip, Title Case labels |
| **Coverage P1–P4** ✅ | Editable coverage (no preview gate), tabbed wizard, counselling→CCMS sync, policy card OCR, E2E parity |
| **Coverage P5–P10** ✅ | Save Draft / Complete Session footer, orchestration, cross-tab sync, audit gap fixes |

### Coverage & Pre-Auth components

| Component | Path | Role |
|-----------|------|------|
| `CoveragePreauthPanel` | `coverage/CoveragePreauthPanel.tsx` | Main tab: icon-card wizard steps + left column content + right rail |
| `CoverageWizardNav` | `coverage/CoverageWizardNav.tsx` | Horizontal icon-card stepper (Policy / Estimate / Documents) with completion state |
| `CoveragePreauthRail` | `coverage/CoveragePreauthRail.tsx` | Right rail: CCMS status, **VisitPolicyList** CRUD, document progress |
| `InsuranceDetailsTab` | `coverage/InsuranceDetailsTab.tsx` | Step 1 policy fields + `PayerSelector` |
| `CoverageEstimateTab` | `coverage/CoverageEstimateTab.tsx` | Step 2 procedure details + two-card billing UI (estimate bill + coverage split) |
| `CoverageEstimateBillCard` | `coverage/estimate/CoverageEstimateBillCard.tsx` | Card 1: billable items (grouped), additional charges, tax, footer totals |
| `CoverageSplitCard` | `coverage/estimate/CoverageSplitCard.tsx` | Card 2: insurance vs patient split (no duplicate grand total) |
| `coverage-bill-ui.tsx` | `coverage/estimate/coverage-bill-ui.tsx` | Shared billing row/section primitives |
| `coverage-estimate-sync.ts` | `lib/counsellors-desk/coverage-estimate-sync.ts` | Line-item build/merge, `syncSource` tracking, override-aware counselling→coverage sync |
| `CoverageDatePicker` | `coverage/CoverageDatePicker.tsx` | Re-export of `SessionDatePicker` for Policy / Estimate dates |
| `useCoverageForm` | `coverage/useCoverageForm.ts` | Form types, `FINANCIAL_YEARS`, doc slots — **not** the active state hook (see below) |
| `VisitPoliciesTab` | `coverage/VisitPoliciesTab.tsx` | Rich multi-policy editor — **deferred**; `VisitPolicyList` + `VisitPolicyForm` used instead |
| `PatientInsurerChip` | `coverage/PatientInsurerChip.tsx` | Opt-in patient insurer (never silent pre-fill) |
| `PolicyCardOcrPanel` | `coverage/PolicyCardOcrPanel.tsx` | *(unused on Policy step)* — card OCR lives on Documents step via `CoverageDocumentsTab` |
| `PolicyExtractionReview` | `coverage/PolicyExtractionReview.tsx` | Confidence-coded review before apply |
| `CoverageDocumentsTab` | `coverage/CoverageDocumentsTab.tsx` | Intake document slots (`insurance_card_*`) |

### Coverage wizard architecture (accepted hybrid)

`CoveragePreauthPanel` owns sync mode, case load/create, counselling merge, and save/submit. Step UI is split into tab components via `coverage-form-mappers.ts`:

| Step | Component | State owner |
|------|-----------|-------------|
| Policy | `InsuranceDetailsTab` + `PatientInsurerChip`; full visit-policy list in right rail | Panel `form` + mappers |
| Estimate | `CoverageEstimateTab` | Panel `form` + mappers |
| Documents | `CoverageDocumentsTab` | CCMS document API |

`useCoverageForm` remains available for a future full hook migration (auto-save, tab status). `VisitPoliciesTab` is kept for CCMS-desk-style editing but not wired to avoid duplicating `VisitPolicyList` API glue.

### Coverage sync modes

| Mode | Trigger | Coverage tab behaviour |
|------|---------|----------------------|
| `editable` | Draft CCMS states (or no case yet) | Full edit; auto-create case on first open; localStorage draft when case exists |
| `locked` | Pre-auth / outcome states | Read-only; rail shows status |

Counselling dirty state no longer gates the Coverage tab. Unsaved counselling values merge into the form silently via `counsellingDirty` sync.

### Session save actions

| Action | Placement | Behaviour |
|--------|-----------|-----------|
| **Complete Session** | `SessionPageHeader` (all tabs) | Full finalize via `saveCounsellingSession` — decision required; coverage/outpatient orchestration in controller |
| **Save Draft** | Sticky footer | Partial persist; silent (no toast) |
| **Print Estimate** | Sticky footer | Counselling tab / wrap-up phase |
| **Phase Back / Next** | Sticky footer | Counselling tab only |

Test IDs: `counselling-btn-save-session` (header), `counselling-btn-save-draft` (footer). Session history UI removed. Coverage + Outpatient use counselling teal tokens (`counselling-*`).

### Cross-tab workspace sync (Step 8)

Shared in-memory fields between Counselling and Coverage (no banners or toasts):

| Field | Counselling state | Coverage form |
|-------|-------------------|---------------|
| Insurer | `insuranceCompany` | `insurerName` / `insuranceProviderId` |
| Estimate | `mergedEstimate.finalPayableAmount`, `packageRate` | `estimatedAmount` |
| Surgery date | `schedule.selectedDate` | `surgeryDate` |

Implementation: `counselling-coverage-workspace-sync.ts` + `applyCoverageWorkspaceSync` in the session controller. Counselling → Coverage merges on every `counsellingCtx` change; Coverage → Counselling emits via `onWorkspaceSync` with loop skip via `counsellingSyncSkipRef`. Outpatient rollup uses `workspaceIntegrationContext` (live payment type + CCMS state). Save Draft is silent (no toast).

Counselling payment insurer test ID: `counselling-insurance-company`.

### Coverage test IDs (`coverage-test-ids.ts`)

| ID | Element |
|----|---------|
| `coverage-insurer-name` | Insurer field (InsuranceDetailsTab / PayerSelector) |
| `coverage-estimated-amount` | Surgery/procedure amount (CoverageEstimateTab) |
| `policy-card-ocr-panel` | OCR upload panel |
| `policy-ocr-slot-insurance_card_front` | Front card slot |
| `policy-extraction-review` | OCR review modal |
| `visit-policy-add` | Add visit policy button |
| `visit-policy-number` | Visit policy form policy # |
| `visit-policy-save` | Visit policy form save |
| `coverage-step-policy` / `coverage-step-estimate` / `coverage-step-documents` | Wizard icon-card steps |
| `coverage-visit-policies-rail` | Visit policy list (right rail) |
| `coverage-manage-visit-policies` | Manage Policies link on Policy step |
| `coverage-surgery-date` / `coverage-policy-expiry-date` | Scheduling date pickers |

### P2 UX polish details

| Item | Implementation |
|------|----------------|
| Phase Next guard | `canAdvancePhase` / `phaseAdvanceError` from `validatePhase()` — footer Next disabled + tooltip |
| Empty quote CTA | `counselling-quote-go-to-estimate` → `goToPhase('estimate')` when not on estimate phase |
| Mobile quote | `CounsellingQuoteBottomSheet` uses shadcn `Sheet` (side bottom) above sticky footer |
| Disabled tooltips | `CounsellingDisabledActionTooltip` on Print / Next / Save |

---

## Optional pre-op investigation values (Phase 9 — Ward Pre-Op)

**Spec:** [ward-preop-workspace-spec.md](./ward-preop-workspace-spec.md) §1, §9, Phase 9.

Counsellors may **optionally** enter investigation result values during a counselling session (e.g. patient brings external lab reports). Values copy to the IP ward journey as **`draft` / unverified** — ward nursing must verify before PAC.

### Policy

1. **Optional** — never blocks counselling finalize or OT scheduling.
2. Use counselling session primitives (`CounsellingInput`, `CounsellingButton`) for consistency.
3. Do not duplicate full ward investigation UI in counselling; expose only overlapping keys (blood sugar, creatinine, A-scan notes, etc.).
4. Saved to `counsellor_checklist_completions.result_value` with `entry_status = draft`.
5. On journey / clearance init, `CounsellorChecklistService` copies to ward §1 as unverified.

### Components (Phase 9 — wired)

| Component | Path | Purpose |
|-----------|------|---------|
| `CounsellingPreOpInvestigationsPanel` | `components/counsellors-desk/session/CounsellingPreOpInvestigationsPanel.tsx` | Collapsible optional values panel on Wrap-up phase |
| `CounsellingInvestigationValueRow` | `components/counsellors-desk/session/CounsellingInvestigationValueRow.tsx` | Single optional value + unit for a mapped test key |

### Placement

- **Counselling session — Wrap-up phase** — collapsible “Pre-admission lab values” accordion (`CounsellingPreOpInvestigationsPanel`).
- Not on Coverage or Outpatient checklist tabs (those remain P0 safety items only).

### Test IDs

| ID | Element |
|----|---------|
| `counselling-preop-investigations-panel` | Collapsible panel root |
| `counselling-preop-investigation-{itemKey}` | Value input for mapped test |
| `counselling-preop-investigation-save` | Save draft values |

### Cross-module sync

| Counselling | Ward §1 |
|-------------|---------|
| `result_value` on session completion | `pre_op_completions.result_value` |
| `entry_status: draft` | `counsellorDraft: true` badge until ward verifies |
| Session `counselingSessionId` | `patient_journey.counseling_session_id` link |
