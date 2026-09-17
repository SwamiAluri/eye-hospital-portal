/**
 * Counselling session design tokens — semantic classes scoped under `.counselling-session`.
 * Prefer shadcn names (`bg-card`, `text-muted-foreground`) or `counselling-*` — both resolve via theme CSS.
 */
export const counsellingSessionTokens = {
  page: 'counselling-session flex min-h-0 flex-1 flex-col bg-counselling-muted/25',
  /** Wave 2E-5RR-W — grey canvas; white widgets float above (matches dashboard bg-gray-100) */
  shellPage:
    'counselling-session flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100',
  shellPageGrid:
    'grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-1.5 overflow-hidden min-[1600px]:gap-3',
  /** Shared floating widget surface (header, patient, status, Notes, Estimate) */
  sessionWidget:
    'rounded-xl border border-counselling-border/70 bg-counselling-card shadow-sm',
  sessionWidgetPad: 'px-3 py-2 min-[1600px]:px-4 min-[1600px]:py-3 sm:min-[1600px]:px-5 sm:min-[1600px]:py-3.5',
  sessionWidgetTitle:
    'flex items-center gap-2 text-sm font-semibold text-counselling-foreground',
  shellChromeStack:
    'flex shrink-0 flex-col gap-1.5 bg-transparent px-2.5 pb-0.5 pt-1.5 min-[1600px]:gap-3 min-[1600px]:px-4 min-[1600px]:pb-1 min-[1600px]:pt-3',
  shellHeader: '',
  /** Workflow nav stays on plain background — not a widget */
  shellWorkflow: 'shrink-0 bg-transparent px-0 py-0.5 min-[1600px]:py-1',
  shellModuleHost: 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent',
  shellModuleTabs:
    'flex-shrink-0 border-b border-counselling-border/60 bg-counselling-muted/20 px-4 pt-1.5',
  shellModuleBodyPadding: 'p-2.5 min-[1600px]:p-4',
  /** Floating footer widget — grey gutter from shellPageGrid gap */
  shellActionBar:
    'z-40 mx-2.5 mb-1.5 shrink-0 rounded-xl border border-counselling-border/70 bg-counselling-card px-3 py-1.5 shadow-sm min-[1600px]:mx-4 min-[1600px]:mb-3 min-[1600px]:px-4 min-[1600px]:py-2.5',
  actionBarLabel: 'text-sm font-semibold',
  patientLabel:
    'text-[12px] font-semibold uppercase leading-4 tracking-wide text-counselling-muted-foreground',
  patientName:
    'truncate text-base font-semibold leading-5 text-counselling-foreground min-[1600px]:text-[20px] min-[1600px]:leading-6 max-sm:text-[15px]',
  shellMeta:
    'text-sm font-medium leading-5 tabular-nums text-counselling-foreground/80 max-sm:text-[13px]',
  shellSecondaryMeta:
    'text-[13px] font-medium leading-5 tabular-nums text-counselling-muted-foreground',
  patientDetailsAction:
    'text-sm font-semibold leading-5 text-counselling-primary',
  patientStatusPill: 'text-[13px] font-semibold leading-[18px]',
  patientHeaderPad:
    'px-3 py-2 min-[1600px]:px-4 min-[1600px]:py-3 sm:min-[1600px]:px-5 sm:min-[1600px]:py-3.5',
  patientHeaderPhoto:
    'h-10 w-10 ring-2 ring-counselling-accent/90 min-[1600px]:h-14 min-[1600px]:w-14 max-sm:h-10 max-sm:w-10',
  patientHeaderGap: 'gap-2 min-[1600px]:gap-3 sm:min-[1600px]:gap-3.5',
  patientHeaderStack: 'flex flex-col gap-0.5',
  patientHeaderZones: 'gap-2 min-[1600px]:gap-3 sm:min-[1600px]:gap-4',
  shellStatusLine: 'text-xs font-medium leading-snug text-counselling-foreground',
  /** Wave 2E-4R — primary workflow step navigation (connected full-width strip) */
  workflowStepTrack:
    'grid w-full min-w-0 grid-cols-5 overflow-hidden rounded-md border border-counselling-border bg-counselling-card shadow-sm',
  workflowStepItem: 'min-w-0 border-r border-counselling-border last:border-r-0',
  workflowStepConnector: 'hidden',
  workflowStepConnectorActive: '',
  workflowStepConnectorMuted: '',
  workflowStepButton:
    'flex min-h-[3.25rem] w-full flex-row items-center justify-center gap-1.5 px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/40 disabled:cursor-default sm:min-h-14 sm:gap-2 sm:px-3',
  workflowStepButtonCurrent:
    'bg-counselling-primary/12 font-semibold text-counselling-primary ring-1 ring-inset ring-counselling-primary/30',
  workflowStepButtonCompleted:
    'bg-counselling-primary/[0.05] text-counselling-foreground hover:bg-counselling-primary/10',
  workflowStepButtonAvailable:
    'bg-counselling-card text-counselling-foreground hover:bg-counselling-muted/40',
  workflowStepButtonPending:
    'bg-counselling-muted/15 text-counselling-muted-foreground',
  workflowStepButtonSkipped:
    'bg-counselling-muted/10 text-counselling-muted-foreground/75',
  workflowStepLabel:
    'truncate text-[10px] font-semibold uppercase leading-tight tracking-wide sm:text-[11px]',
  workflowStepLabelCurrent: 'text-counselling-primary',
  workflowStepCheck: 'h-3.5 w-3.5 shrink-0 text-counselling-primary',
  /** Wave 2E-5RR-W — status read-back as a compact widget */
  sessionStatusStrip:
    'rounded-xl border border-counselling-border/70 bg-counselling-card px-2.5 py-1.5 shadow-sm min-[1600px]:px-3 min-[1600px]:py-2.5 sm:min-[1600px]:px-4',
  sessionStatusDetails:
    'grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4 min-[1600px]:gap-x-4 min-[1600px]:gap-y-2',
  sessionStatusDetailLabel:
    'text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground',
  sessionStatusDetailValue: 'text-xs font-medium leading-snug text-counselling-foreground',
  sessionStatusDetailValueWarning: 'text-xs font-medium leading-snug text-amber-800',
  sessionStatusDetailValueSuccess:
    'text-sm font-semibold leading-snug tabular-nums text-emerald-700',
  sessionStatusDetailValueDanger: 'text-xs font-medium leading-snug text-red-800',
  /** Wave 2E-2 — navigation visual families */
  moduleNav: 'flex-shrink-0 border-b border-counselling-border/50 px-4',
  moduleNavList: 'flex min-w-0 flex-nowrap items-end gap-4 overflow-x-auto overscroll-x-contain',
  moduleNavItem:
    'relative min-h-9 shrink-0 border-b-2 border-transparent px-0.5 pb-2 pt-1 text-sm font-medium text-counselling-muted-foreground transition-colors hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 data-[state=active]:border-counselling-primary data-[state=active]:font-semibold data-[state=active]:text-counselling-foreground',
  workflowProgressTrack: 'flex min-w-0 flex-nowrap items-center overflow-x-auto overscroll-x-contain py-0.5',
  workflowProgressItem: 'flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5',
  workflowProgressConnector:
    'hidden h-px min-w-[0.75rem] flex-1 shrink sm:block sm:min-w-[1rem]',
  workflowProgressConnectorActive: 'bg-counselling-primary/35',
  workflowProgressConnectorMuted: 'bg-counselling-border/60',
  workflowProgressMarker:
    'flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border transition-colors',
  workflowProgressMarkerCurrent:
    'border-counselling-primary bg-counselling-primary ring-2 ring-counselling-primary/25',
  workflowProgressMarkerCompleted: 'border-counselling-primary bg-counselling-primary',
  workflowProgressMarkerAvailable:
    'border-counselling-primary/50 bg-counselling-primary/15',
  workflowProgressMarkerPending: 'border-counselling-border bg-transparent',
  workflowProgressMarkerSkipped: 'border-dashed border-counselling-border/70 bg-transparent',
  workflowProgressLabel: 'min-w-0 truncate text-[11px] font-medium leading-tight sm:text-xs',
  workflowProgressLabelCurrent:
    'font-semibold text-counselling-primary underline decoration-counselling-primary/40 decoration-2 underline-offset-4',
  workflowProgressLabelCompleted: 'text-counselling-foreground',
  workflowProgressLabelMuted: 'text-counselling-muted-foreground',
  workflowProgressLink:
    'inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left transition-colors hover:text-counselling-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 focus-visible:ring-offset-1',
  workflowProgressStatic:
    'inline-flex min-w-0 flex-1 items-center gap-1.5 text-left',
  outpatientAccessLink:
    'shrink-0 text-[11px] font-medium text-counselling-muted-foreground underline-offset-2 transition-colors hover:text-counselling-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45',
  workspaceStepNav: 'min-w-0 border-b border-counselling-border/40 pb-2',
  workspaceStepItem:
    'inline-flex items-center border-b-2 border-transparent px-1 py-0.5 text-xs font-medium text-counselling-muted-foreground transition-colors hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 focus-visible:ring-offset-1 disabled:hover:text-counselling-muted-foreground',
  workspaceStepItemActive:
    'border-counselling-primary font-semibold text-counselling-foreground',
  workspaceStepItemComplete: 'text-counselling-primary/90',
  workspaceStepSeparator: 'select-none px-1.5 text-xs text-counselling-border',
  modeSegmented:
    'rounded-lg border border-counselling-border/70 bg-counselling-muted/40 p-0.5',
  filterSegmented: 'inline-flex gap-1 rounded-md bg-counselling-muted/30 p-0.5',
  card: 'rounded-2xl border border-border/60 bg-card shadow-sm',
  cardHeader: 'border-b border-border px-5 py-4',
  cardBody: 'px-5 py-4',
  sectionTitle: 'text-sm font-semibold text-foreground',
  sectionSubtitle: 'text-sm text-muted-foreground',
  microLabel: 'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
  /** @deprecated Prefer catalogSelectedRow for procedure/investigation lists */
  selectedRow:
    'border-l-4 border-counselling-primary bg-counselling-primary/10 hover:bg-counselling-primary/15',
  /** Dense catalog list row (~36px) — desktop counsellor workstation */
  catalogRow: 'min-h-9 py-1.5 text-sm',
  catalogInput: 'h-9 text-sm',
  catalogListGap: 'space-y-0.5',
  catalogCategoryGap: 'space-y-2',
  catalogSelectedRow:
    'ring-2 ring-inset ring-counselling-primary/35 bg-counselling-accent/50 hover:bg-counselling-accent/60',
  catalogUnselectedRow:
    'border border-transparent bg-card hover:border-border/80 hover:bg-muted/80',
  /** Sticky filter bar inside estimate/investigation cards (single outer scroll) */
  catalogStickyFilters:
    'sticky top-0 z-10 border-b border-counselling-border/60 bg-card px-3 py-2',
  readOnlyPanel: 'rounded-xl border border-border bg-muted/90 px-4 py-3',
  accentPanel:
    'rounded-lg border border-counselling-primary/30 bg-counselling-accent/80 px-3 py-2.5',
  accentText: 'text-counselling-accent-foreground',
  primaryText: 'text-counselling-primary',
  touchTarget: 'min-h-11 touch-manipulation',
  catalogTouchTarget: 'min-h-9 touch-manipulation',
  /** Flat counselling workspace shell — Quote, Decision, Notes */
  quoteWorkspace: 'space-y-4',
  counsellingWorkspace: 'space-y-4',
  /** Wave 2E-4R — quote workspace shell */
  quoteWorkspaceTitle:
    'text-xs font-semibold uppercase tracking-wide text-counselling-foreground',
  quoteWorkspaceDivider: 'mt-2 border-t border-counselling-border/70',
  quoteConfigRow:
    'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-10',
  quoteConfigControl: 'min-w-0 space-y-1.5',
  quoteConfigLabel: 'text-xs font-medium text-counselling-muted-foreground',
  quoteProcedureEyeBlock: 'space-y-3',
  quoteSectionHeading:
    'text-xs font-semibold uppercase tracking-wide text-counselling-foreground',
  quoteSectionDivider: 'border-t border-counselling-border/50',
  quoteSelectedProcedureLabel:
    'mb-1.5 text-xs font-medium text-counselling-muted-foreground',
  /** Wave 2E-5 — quote workspace phase header (matches Decision/Notes) */
  quoteWorkspaceHeader: 'mb-1 space-y-1',
  quoteWorkspaceStatusComplete:
    'rounded px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-900',
  quoteWorkspaceStatusRequired:
    'rounded px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-950',
  quoteHeroPayable:
    'rounded-lg border border-counselling-border/60 bg-counselling-muted/20 px-3 py-3 sm:px-4',
  quoteSelectedProcedureBox:
    'rounded-lg border border-counselling-primary/30 bg-counselling-accent/50 px-3 py-2.5 shadow-sm',
  quoteSelectedProcedureRow:
    'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
  quoteSelectedProcedureMain: 'min-w-0 flex-1',
  quoteSelectedProcedureTrailing: 'flex shrink-0 items-center gap-3 sm:gap-4',
  quoteSelectedProcedureName: 'text-sm font-semibold leading-snug text-counselling-foreground',
  quoteSelectedProcedureMeta: 'text-xs font-normal text-counselling-muted-foreground',
  quoteSelectedProcedurePrice:
    'text-sm font-semibold tabular-nums text-counselling-foreground',
  quoteSelectedProcedureAction: 'h-8 shrink-0 px-3 text-xs',
  quoteCatalogTableHeader:
    'mb-1 grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-counselling-border/50 pb-1 text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground',
  quoteBiometryStatus: 'text-xs leading-snug text-counselling-muted-foreground',
  quoteBiometryWarning: 'text-xs leading-snug text-amber-800',
  quoteSummaryRail:
    'min-h-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-counselling-border/70 bg-counselling-card shadow-sm lg:self-stretch',
  quoteSummaryInner:
    'flex min-h-0 w-full flex-1 flex-col overflow-hidden px-3 py-2.5 sm:px-4 min-[1600px]:px-5 min-[1600px]:py-4 sm:min-[1600px]:px-6 sm:min-[1600px]:pb-5 min-[1600px]:lg:min-h-[12rem]',
  quoteSummaryPanel:
    'counselling-estimate-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1 [scrollbar-width:thin]',
  quoteSummaryTitle:
    'flex items-center gap-2 text-sm font-semibold text-counselling-foreground',
  quoteSummaryMode: 'mt-0.5 text-xs font-medium text-counselling-foreground',
  quoteFinalPayableBlock: 'mt-3 border-t border-counselling-border/40 pt-3',
  quoteFinalPayableAmount:
    'text-[1.75rem] font-bold leading-none tabular-nums tracking-tight text-counselling-foreground sm:text-3xl',
  quoteSummaryBreakdown: 'mt-3 space-y-1.5 border-t border-counselling-border/40 pt-3 text-sm',
  investigationFilterBar: 'mb-2 space-y-2',
  /** Wave 2H — quote mode tabs (4 columns, no overflow clip) */
  quoteModeTabTrack:
    'grid w-full min-w-0 grid-cols-2 rounded-md border border-counselling-border bg-counselling-card shadow-sm sm:grid-cols-4',
  quoteModeTabItem: 'min-w-0 border-r border-counselling-border last:border-r-0',
  /** Wave 2K — waiting-list / dense pill patterns */
  pillTabTrack: 'flex min-w-0 flex-wrap items-center gap-1.5',
  /** Wave 2E-5RR-W — journey rail: wide gaps + larger bold labels (desktop); denser below 1600 */
  journeyTabTrack:
    'flex min-w-0 flex-nowrap items-center gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] min-[1600px]:gap-6 sm:min-[1600px]:gap-8 lg:min-[1600px]:gap-10',
  journeyTab:
    'inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 min-[1600px]:min-h-9 min-[1600px]:gap-1.5 min-[1600px]:px-3.5 min-[1600px]:py-2 min-[1600px]:text-sm',
  pillTab:
    'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-transparent bg-counselling-muted/70 px-3 py-1.5 text-xs font-semibold text-counselling-foreground transition-colors hover:bg-counselling-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
  pillTabCurrent:
    'border-counselling-primary bg-counselling-primary text-white hover:bg-counselling-primary/90',
  pillTabComplete:
    'border-counselling-primary/20 bg-counselling-primary/10 text-counselling-primary',
  /** Journey rail completed — soft green fill, no visible border */
  journeyTabComplete:
    'border-transparent bg-counselling-primary/10 text-counselling-primary hover:bg-counselling-primary/15',
  journeyTabCurrent:
    'border-transparent bg-counselling-primary text-white hover:bg-counselling-primary/90',
  journeyTabMuted:
    'border-transparent bg-counselling-muted/40 text-counselling-muted-foreground hover:bg-counselling-muted/70',
  pillTabMuted:
    'bg-counselling-muted/40 text-counselling-muted-foreground hover:bg-counselling-muted/70',
  statusPill:
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
  statusPillComplete: 'bg-emerald-100 text-emerald-800',
  statusPillRequired: 'bg-amber-100 text-amber-900',
  statusPillInfo: 'bg-sky-100 text-sky-900',
  statusPillDanger: 'bg-red-100 text-red-900',
  statusPillDot: 'h-1.5 w-1.5 shrink-0 rounded-full',
  statusPillDotComplete: 'bg-emerald-500',
  statusPillDotRequired: 'bg-amber-500',
  statusPillDotInfo: 'bg-sky-500',
  statusPillDotDanger: 'bg-red-500',
  workspacePanel:
    'rounded-lg border border-counselling-border/70 bg-counselling-card shadow-sm',
  choiceRow:
    'flex min-h-9 cursor-pointer items-center gap-3 rounded-md border-l-4 border-transparent px-2 py-2 transition-colors hover:bg-counselling-muted/40',
  choiceRowSelected:
    'rounded-md border-l-counselling-primary bg-counselling-accent/50',
  /** Notes Additional Options — denser bordered pills */
  notesOptionRow:
    'flex min-h-9 w-full cursor-pointer items-center gap-3 rounded-lg border border-counselling-border/80 bg-counselling-card px-3 py-2 text-left transition-colors hover:bg-counselling-muted/30',
  notesOptionRowSelected:
    'border-counselling-border/80 bg-emerald-50',
  sessionAdditionalOptionsLabel:
    'text-xs font-medium text-counselling-muted-foreground',
  actionPill: 'rounded-full',
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
  scheduleSurgeryDate: 'counselling-schedule-surgery-date',
  scheduleSurgeryModal: 'counselling-schedule-surgery-modal',
  scheduleSurgeryOt: 'counselling-schedule-surgery-ot',
  scheduleSurgeryDoctor: 'counselling-schedule-surgery-doctor',
  scheduleSurgeryLookupError: 'counselling-schedule-surgery-lookup-error',
  scheduleSurgeryLookupRetry: 'counselling-schedule-surgery-lookup-retry',
  insuranceCompany: 'counselling-insurance-company',
  quoteOverrideBtn: 'counselling-quote-override-btn',
  btnOpenCoverage: 'counselling-btn-open-coverage',
  decisionWorkspaceHeader: 'counselling-decision-workspace-header',
  decisionWorkspaceStatus: 'counselling-decision-workspace-status',
  decisionWorkspaceBlocker: 'counselling-decision-workspace-blocker',
  decisionSummaryStrip: 'counselling-decision-summary-strip',
  decisionInlineBlocker: 'counselling-decision-inline-blocker',
  counsellingPhaseNav: 'counselling-phase-nav',
  quotePanel: 'counselling-quote-panel',
  btnSaveSession: 'counselling-btn-save-session',
  btnSaveDraft: 'counselling-btn-save-draft',
  btnPatientDetails: 'counselling-btn-patient-details',
  btnSessionHistory: 'counselling-btn-session-history',
  btnPhaseNext: 'counselling-btn-phase-next',
  btnPhaseBack: 'counselling-btn-phase-back',
  btnCloseSession: 'counselling-btn-close-session',
  /** Origin leave when entered from Waiting List (Close semantics, Back presentation). */
  btnBackToWaitingList: 'counselling-btn-back-to-waiting-list',
  sessionSummaryBar: 'counselling-session-summary-bar',
  sessionSummaryHeadline: 'counselling-session-summary-headline',
  sessionSummaryChips: 'counselling-session-summary-chips',
  sessionSummaryChip: (id: string) => `counselling-session-summary-chip-${id}`,
  sessionSummaryNextAction: 'counselling-session-summary-next-action',
  sessionSummaryNextActionBtn: 'counselling-session-summary-next-action-btn',
  sessionChrome: 'counselling-session-chrome',
  actionBar: 'counselling-action-bar',
  actionBarPrimary: 'counselling-action-bar-primary',
  actionBarStatusHint: 'counselling-action-bar-status-hint',
  journeyStage: (id: string) => `counselling-journey-stage-${id}`,
  journeyRail: 'counselling-journey-rail',
  outpatientAccess: 'counselling-outpatient-access',
  clinicalContextRow: 'counselling-clinical-context-row',
  /** Compact header action that opens Clinical Recommendations sheet. */
  btnClinicalRecommendations: 'counselling-btn-clinical-recommendations',
  clinicalRecommendations: 'counselling-clinical-recommendations',
  clinicalRecommendationsSheet: 'counselling-clinical-recommendations-sheet',
  clinicalRecommendationsSheetRoot: 'counselling-clinical-recommendations-sheet-root',
  clinicalRecommendationDoctor: 'counselling-clinical-recommendation-doctor',
  clinicalRecommendationOptometrist: 'counselling-clinical-recommendation-optometrist',
  clinicalRecommendationsCallout: 'counselling-clinical-recommendations-callout',
  clinicalRecommendationsSubtitle: 'counselling-clinical-recommendations-subtitle',
  notesAdditionalOptionsSection: 'counselling-notes-additional-options-section',
  quoteGoToEstimate: 'counselling-quote-go-to-estimate',
  refreshFromOpd: 'counselling-refresh-from-opd',
  phase: (id: string) => `counselling-phase-${id}`,
  packageCard: (id: string) => `counselling-package-card-${id}`,
  pricingModeCustom: 'counselling-pricing-mode-custom',
  pricingModePackage: 'counselling-pricing-mode-package',
  quoteWorkspace: 'counselling-quote-workspace',
  quoteWorkspaceHeader: 'counselling-quote-workspace-header',
  quoteWorkspaceStatus: 'counselling-quote-workspace-status',
  quoteInlineBlocker: 'counselling-quote-inline-blocker',
  quoteModeNav: 'counselling-quote-mode-nav',
  quoteProcedureCatalogGrid: 'counselling-quote-procedure-catalog-grid',
  quoteSelectionConfigure: 'counselling-quote-selection-configure',
  procedureCatalogCard: (id: string) => `counselling-procedure-catalog-card-${id}`,
  quoteConfig: 'counselling-quote-config',
  quoteSelectedProcedure: 'counselling-quote-selected-procedure',
  quoteSelectedPackage: 'counselling-quote-selected-package',
  quoteSelectedEyeBadge: 'counselling-quote-selected-eye-badge',
  quoteSelectProcedure: 'counselling-quote-select-procedure',
  quoteChangeProcedure: 'counselling-quote-change-procedure',
  procedureCatalogueSheet: 'counselling-procedure-catalogue-sheet',
  procedureCatalogueCancel: 'counselling-procedure-catalogue-cancel',
  quoteBiometryStatus: 'counselling-quote-biometry-status',
  quoteSummaryBreakdown: 'counselling-quote-summary-breakdown',
  quoteItemizedBreakdown: 'counselling-quote-itemized-breakdown',
  quoteDiscountPanel: 'counselling-quote-discount-panel',
  quoteDiscountToggle: 'counselling-quote-discount-toggle',
  quotePackageEditPrice: 'counselling-quote-package-edit-price',
  quoteEstimateEyeBadge: 'counselling-quote-estimate-eye-badge',
  decisionWorkspace: 'counselling-decision-workspace',
  decisionFundingHandoff: 'counselling-decision-funding-handoff',
  decisionOption: (value: string) => `counselling-decision-option-${value.toLowerCase()}`,
  decisionFollowUpSection: 'counselling-decision-follow-up-section',
  notesWorkspace: 'counselling-notes-workspace',
  notesWorkspaceHeader: 'counselling-notes-workspace-header',
  notesWorkspaceStatus: 'counselling-notes-workspace-status',
  notesInlineBlocker: 'counselling-notes-inline-blocker',
  notesCounsellorField: 'counselling-notes-counsellor',
  notesPatientField: 'counselling-notes-patient',
  notesDoctorField: 'counselling-notes-doctor',
  notesAdditionalOptions: 'counselling-notes-additional-options',
  notesReadinessStrip: 'counselling-notes-readiness',
  notesDocumentationSection: 'counselling-notes-documentation',
  finishWorkspace: 'counselling-finish-workspace',
  finishOutcomeWidget: 'counselling-finish-outcome-widget',
  finishSummaryWidget: 'counselling-finish-summary-widget',
  finishFinancialWidget: 'counselling-finish-financial-widget',
  finishCoverageWidget: 'counselling-finish-coverage-widget',
  finishDocsWidget: 'counselling-finish-docs-widget',
  finishNextStepsWidget: 'counselling-finish-next-steps-widget',
} as const;

export type CounsellingSectionId =
  (typeof counsellingSectionIds)[keyof typeof counsellingSectionIds];
