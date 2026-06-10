/**
 * Counselling session design tokens — semantic classes scoped under `.counselling-session`.
 * Prefer shadcn names (`bg-card`, `text-muted-foreground`) or `counselling-*` — both resolve via theme CSS.
 */
export const counsellingSessionTokens = {
  page: 'counselling-session flex min-h-0 flex-1 flex-col bg-background/80',
  card: 'rounded-2xl border border-border/60 bg-card shadow-sm',
  cardHeader: 'border-b border-border px-5 py-4',
  cardBody: 'px-5 py-4',
  sectionTitle: 'text-sm font-semibold text-foreground',
  sectionSubtitle: 'text-sm text-muted-foreground',
  microLabel: 'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
  selectedRow:
    'border-l-4 border-counselling-primary bg-counselling-primary/10 hover:bg-counselling-primary/15',
  readOnlyPanel: 'rounded-xl border border-border bg-muted/90 px-4 py-3',
  accentPanel:
    'rounded-lg border border-counselling-primary/30 bg-counselling-accent/80 px-3 py-2.5',
  accentText: 'text-counselling-accent-foreground',
  primaryText: 'text-counselling-primary',
  touchTarget: 'min-h-11 touch-manipulation',
} as const;

/** Section anchor IDs for progress navigation */
export const counsellingSectionIds = {
  estimateBuilder: 'counselling-step-1',
  investigations: 'counselling-step-2',
  payment: 'counselling-step-3',
  decision: 'counselling-step-4',
  schedule: 'counselling-step-5',
  notes: 'counselling-step-6',
  options: 'counselling-step-7',
} as const;

/** data-testid conventions for E2E */
export const counsellingTestIds = {
  tabCustom: 'counselling-tab-custom',
  tabPackage: 'counselling-tab-package',
  eyeRe: 'counselling-eye-re',
  eyeLe: 'counselling-eye-le',
  eyeBe: 'counselling-eye-be',
  procedureSearch: 'counselling-procedure-search',
  packageSearch: 'counselling-package-search',
  /** @deprecated Use tabCustom / tabPackage */
  pricingModeSelect: 'counselling-pricing-mode-select',
  investigationSearch: 'counselling-investigation-search',
  tabImaging: 'counselling-tab-imaging',
  tabLab: 'counselling-tab-lab',
  quoteFinalPayable: 'counselling-quote-final-payable',
  quoteModeBadge: 'counselling-quote-mode-badge',
  quoteDiscountType: (t: string) => `counselling-quote-discount-${t}`,
  quoteDiscountValue: 'counselling-quote-discount-value',
  quoteDiscountReason: 'counselling-quote-discount-reason',
  quoteDiscountApply: 'counselling-quote-discount-apply',
  followUpDate: 'counselling-follow-up-date',
  quoteOverrideBtn: 'counselling-quote-override-btn',
  btnOpenCoverage: 'counselling-btn-open-coverage',
  quotePanel: 'counselling-quote-panel',
  btnSaveSession: 'counselling-btn-save-session',
  btnPhaseNext: 'counselling-btn-phase-next',
  btnPhaseBack: 'counselling-btn-phase-back',
  quoteGoToEstimate: 'counselling-quote-go-to-estimate',
  phase: (id: string) => `counselling-phase-${id}`,
  packageCard: (id: string) => `counselling-package-card-${id}`,
  pricingModeCustom: 'counselling-pricing-mode-custom',
  pricingModePackage: 'counselling-pricing-mode-package',
} as const;

export type CounsellingSectionId =
  (typeof counsellingSectionIds)[keyof typeof counsellingSectionIds];
