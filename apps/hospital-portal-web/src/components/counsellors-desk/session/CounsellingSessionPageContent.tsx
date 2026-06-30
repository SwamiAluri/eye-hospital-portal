'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Printer } from 'lucide-react';
import { CounsellorOutpatientChecklist } from '@/components/counsellors-desk/CounsellorOutpatientChecklist';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { SessionPageHeader } from '@/components/counsellors-desk/session/SessionPageHeader';
import { useCounsellingSession } from '@/components/counsellors-desk/session/CounsellingSessionContext';
import { CounsellingEstimatePrintDialog } from '@/components/counsellors-desk/session/CounsellingEstimatePrintDialog';
import {
  CounsellingButton,
  CounsellingSkeleton,
  CounsellingTabs,
  CounsellingTabsList,
  CounsellingTabsTrigger,
  CounsellingTooltipProvider,
} from '@/components/counsellors-desk/session/primitives';
import { CounsellingDisabledActionTooltip } from '@/components/counsellors-desk/session/CounsellingDisabledActionTooltip';
import { CounsellingRepeatSessionBanner } from '@/components/counsellors-desk/session/CounsellingRepeatSessionBanner';
import { cn } from '@/lib/utils';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { isCoveragePaymentType } from '@/lib/counsellors-desk/counselling-progress';
import { findCounsellorVariant } from '@/lib/master-data/clinical-catalog-master';
import { resolveCoverageSessionFinalPayable } from '@/lib/counsellors-desk/build-coverage-preview';
import { humanizeProcedureCode } from '@/lib/counsellors-desk/coverage-estimate-sync';
import { CoveragePreauthPanel } from '@/components/counsellors-desk/coverage/CoveragePreauthPanel';
import { CounsellingTabPanel } from '@/components/counsellors-desk/session/CounsellingTabPanel';

const ScheduleSurgeryModal = dynamic(
  () =>
    import('@/components/counsellors-desk/ScheduleSurgeryModal').then((m) => ({
      default: m.ScheduleSurgeryModal,
    })),
  { ssr: false },
);

function isShowCoverageTab(paymentType: string): boolean {
  return isCoveragePaymentType(paymentType);
}

/** Constrains flex/grid children so inner overflow-y-auto scrolls instead of growing the page. */
const TAB_BODY_CLASS = 'flex min-h-0 flex-1 flex-col overflow-hidden';
/** Scroll region for single-column tabs (coverage / outpatient). */
const TAB_SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain';
/** Flex fill region for counselling — panel manages its own workspace/quote scroll split. */
const COUNSELLING_TAB_CLASS = 'flex min-h-0 flex-1 flex-col overflow-hidden';

export function CounsellingSessionPageContent() {
  const ctx = useCounsellingSession();
  const { canEditCounsellorOutpatient } = useIpChecklistPermissions();

  const doctorRecommendation = useMemo(() => {
    const surgeries = (ctx.session as { surgeries?: Array<{ name?: string; isRecommended?: boolean }> })
      ?.surgeries;
    return surgeries?.find((s) => s.isRecommended)?.name ?? null;
  }, [ctx.session]);

  if (ctx.isLoading) {
    return (
      <div className="counselling-session space-y-4 p-6" aria-busy aria-label="Loading session">
        <CounsellingSkeleton className="mx-auto h-10 w-10 rounded-full bg-counselling-muted" />
        <CounsellingSkeleton className="h-8 w-48 bg-counselling-muted" />
        <CounsellingSkeleton className="h-64 w-full rounded-xl bg-counselling-muted" />
        <p className="text-center text-sm text-counselling-muted-foreground">Loading session…</p>
      </div>
    );
  }

  if (!ctx.session) {
    return (
      <div className="py-20 text-center text-counselling-muted-foreground">
        <p>Session not found</p>
      </div>
    );
  }

  const ccmsCaseNumber = ctx.workspaceCcmsCaseNumber ?? ctx.session.ccmsCaseNumber;
  const showCoverageTab = isShowCoverageTab(ctx.paymentType as string) || !!ccmsCaseNumber;

  const coverageProcedureVariant = findCounsellorVariant(ctx.procedureVariants, ctx.selectedVariantId);
  const counsellingProcedureLine = ctx.counsellingEstimate.lines.find(
    (line) => line.kind === 'procedure' || line.key === 'procedure',
  );
  const counsellingProcedureLineLabel = counsellingProcedureLine?.label?.trim();
  const sessionSurgeryOption = ctx.session?.surgeries?.find(
    (s) =>
      (ctx.selectedVariantId && s.variantId === ctx.selectedVariantId) ||
      (ctx.selectedSurgeryId && s.id === ctx.selectedSurgeryId),
  );
  const variantBySurgeryOption = sessionSurgeryOption?.variantId
    ? findCounsellorVariant(ctx.procedureVariants, sessionSurgeryOption.variantId)
    : undefined;
  const sessionProcedureName = ctx.counsellingEstimate.isPackageMode
    ? (ctx.counsellingEstimate.activeTemplate?.name ?? ctx.packageName) || undefined
    : coverageProcedureVariant?.name ??
      variantBySurgeryOption?.name ??
      (counsellingProcedureLineLabel &&
      counsellingProcedureLineLabel.toLowerCase() !== 'procedure'
        ? counsellingProcedureLineLabel
        : undefined) ??
      sessionSurgeryOption?.surgeryName ??
      undefined;
  const sessionProcedureCode =
    coverageProcedureVariant?.code ??
    variantBySurgeryOption?.code ??
    ctx.procedureVariants.find((v) => v.id === sessionSurgeryOption?.variantId)?.code;
  const sessionProcedureNameResolved =
    sessionProcedureName ??
    (sessionProcedureCode ? humanizeProcedureCode(sessionProcedureCode) : undefined);
  const sessionProcedureAmount = counsellingProcedureLine?.amount;
  const sessionFinalPayable = resolveCoverageSessionFinalPayable({
    liveFinalPayable: ctx.counsellingEstimate.finalPayableAmount,
    savedFinalPayable: ctx.session?.finalPayableAmount,
    estimateLines: ctx.counsellingEstimate.lines,
  });
  const sessionPackageName = ctx.counsellingEstimate.isPackageMode
    ? (ctx.counsellingEstimate.activeTemplate?.name ?? ctx.packageName) || undefined
    : undefined;
  const sessionEstimateMode = ctx.counsellingEstimate.isPackageMode ? ('package' as const) : ('custom' as const);

  const isCounsellingTab = ctx.activeMainTab === 'counselling';
  const isRepeatGateActive = ctx.isRepeatState;
  const repeatPanelClass = 'pointer-events-none select-none opacity-45';
  const showPhaseFooter =
    isCounsellingTab && !ctx.isSurgeryDoneState && !isRepeatGateActive;
  const showFooterActions = !ctx.isSurgeryDoneState;
  const outpatientReadOnly =
    ctx.queueStatus === 'SurgeryDone' || !canEditCounsellorOutpatient || isRepeatGateActive;
  const tabTriggerClass =
    'rounded-t-lg rounded-b-none border border-transparent px-4 py-2 data-[state=active]:border-counselling-border data-[state=active]:border-b-white data-[state=active]:bg-counselling-card data-[state=active]:text-counselling-primary disabled:pointer-events-none disabled:opacity-45';

  return (
    <CounsellingTooltipProvider delayDuration={300}>
    <div className="counselling-session grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden p-4">
      <ctx.ConfirmationComponent />
      <SessionPageHeader
        session={ctx.session}
        queueStatus={ctx.queueStatus}
        patientDetails={ctx.patientDetails}
        patientDetailsLoading={ctx.patientDetailsLoading}
        onBack={ctx.handleBack}
        doctorRecommendation={doctorRecommendation}
        onSaveSession={ctx.handleSave}
        saveDisabledReason={ctx.saveDisabledReason}
        isSaving={ctx.isSaving}
        showSaveSession={showFooterActions}
      />

      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-counselling-border/80 bg-counselling-card shadow-sm">
        {isRepeatGateActive ? (
          <CounsellingRepeatSessionBanner
            sessionTypeCode={ctx.repeatSessionTypeCode}
            onSessionTypeChange={ctx.setRepeatSessionTypeCode}
            onStartSession={ctx.handleStartRepeatSession}
          />
        ) : null}

        <CounsellingTabs
          value={ctx.activeMainTab}
          onValueChange={(value) => {
            if (isRepeatGateActive) return;
            ctx.setActiveMainTab(value as 'counselling' | 'coverage' | 'outpatient');
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex-shrink-0 border-b border-counselling-border px-4 pt-3">
            <CounsellingTabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
              <CounsellingTabsTrigger
                value="counselling"
                disabled={isRepeatGateActive}
                className={tabTriggerClass}
              >
                Counselling
              </CounsellingTabsTrigger>
              {showCoverageTab ? (
                <CounsellingTabsTrigger
                  value="coverage"
                  disabled={isRepeatGateActive}
                  className={cn('flex items-center gap-1.5', tabTriggerClass)}
                >
                  Coverage &amp; Pre-Auth
                  {ctx.activeMainTab !== 'coverage' ? (
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-amber-400"
                      title="Pre-auth required"
                    />
                  ) : null}
                </CounsellingTabsTrigger>
              ) : null}
              <CounsellingTabsTrigger
                value="outpatient"
                disabled={isRepeatGateActive}
                className={cn('flex items-center gap-1.5', tabTriggerClass)}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Outpatient Safety
              </CounsellingTabsTrigger>
            </CounsellingTabsList>
          </div>

        <div className={TAB_BODY_CLASS}>
        {ctx.coverageTabMounted && (
          <div
            className={
              ctx.activeMainTab !== 'coverage'
                ? 'hidden'
                : TAB_BODY_CLASS
            }
          >
            <div
              className={cn(
                TAB_SCROLL_CLASS,
                'p-5',
                isRepeatGateActive && repeatPanelClass,
              )}
              aria-disabled={isRepeatGateActive || undefined}
            >
            <CoveragePreauthPanel
              ref={ctx.coveragePanelRef}
              sessionId={ctx.sessionId}
              paymentType={ctx.paymentType as string}
              insuranceCompany={ctx.insuranceCompany}
              insuranceProviderOptions={ctx.insuranceProviderOptions}
              patientId={ctx.session.patientId}
              notRequiredPreAuth={ctx.notRequiredPreAuth}
              refreshKey={ctx.coverageRefreshKey}
              counsellingSyncSkipRef={ctx.counsellingSyncSkipRef}
              onWorkspaceSync={ctx.applyCoverageWorkspaceSync}
              onCaseWorkspaceChange={ctx.handleCaseWorkspaceChange}
              initialSubtab={ctx.initialSubtab}
              cachedCaseNumber={ctx.session.ccmsCaseNumber}
              cachedCaseState={ctx.session.ccmsCurrentState}
              sessionSurgery={sessionProcedureNameResolved ?? sessionPackageName}
              sessionProcedureName={sessionProcedureNameResolved}
              sessionProcedureCode={sessionProcedureCode}
              sessionProcedureAmount={sessionProcedureAmount}
              sessionPackageName={sessionPackageName}
              sessionEstimateMode={sessionEstimateMode}
              sessionSurgeryDate={ctx.schedule?.selectedDate || undefined}
              sessionPackageRate={ctx.packageRate ? Number(ctx.packageRate) : undefined}
              sessionFinalPayable={sessionFinalPayable}
              sessionDoctor={ctx.schedule?.doctor || undefined}
              sessionTheatre={ctx.schedule?.operationTheatre || undefined}
              sessionEye={ctx.selectedEye || undefined}
              sessionInvestigations={
                ctx.selectedInvestigations.size > 0
                  ? Array.from(ctx.selectedInvestigations.values())
                  : undefined
              }
              sessionEstimateLines={
                ctx.counsellingEstimate.lines.length > 0
                  ? ctx.counsellingEstimate.lines
                  : undefined
              }
              sessionIsPackageMode={ctx.counsellingEstimate.isPackageMode}
              sessionPackageAmount={
                ctx.counsellingEstimate.activeTemplate?.packageAmount
              }
              forceReadOnly={isRepeatGateActive}
            />
            </div>
          </div>
        )}

        <div
          className={
            ctx.activeMainTab !== 'counselling'
              ? 'hidden'
              : cn(COUNSELLING_TAB_CLASS, isRepeatGateActive && repeatPanelClass)
          }
          aria-disabled={isRepeatGateActive || undefined}
        >
          <CounsellingTabPanel />
        </div>

        {ctx.activeMainTab === 'outpatient' && (
          <div className={TAB_BODY_CLASS}>
            <div
              className={cn(
                TAB_SCROLL_CLASS,
                'p-5',
                isRepeatGateActive && repeatPanelClass,
              )}
              aria-disabled={isRepeatGateActive || undefined}
            >
            <CounsellorOutpatientChecklist
              ref={ctx.outpatientChecklistRef}
              counselingSessionId={ctx.sessionId}
              readOnly={outpatientReadOnly}
              showRollup
              integrationContext={ctx.workspaceIntegrationContext}
            />
            </div>
          </div>
        )}
        </div>
        </CounsellingTabs>
      </div>

      <div className="z-[60] flex shrink-0 items-center justify-between gap-3 rounded-xl border border-counselling-border bg-counselling-card px-4 py-3 shadow-lg sm:px-6">
        <div className="relative flex items-center gap-2">
          {isRepeatGateActive ? (
            <CounsellingButton
              type="button"
              variant="outline"
              onClick={ctx.handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </CounsellingButton>
          ) : null}
          {showFooterActions && showPhaseFooter && ctx.activePhase !== 'estimate' ? (
            <CounsellingButton
              type="button"
              variant="outline"
              onClick={ctx.goToPreviousPhase}
              data-testid={counsellingTestIds.btnPhaseBack}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </CounsellingButton>
          ) : null}
          {showFooterActions && !isRepeatGateActive ? (
            <CounsellingButton
              type="button"
              variant="outline"
              onClick={ctx.handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </CounsellingButton>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {showFooterActions &&
          ((showPhaseFooter && ctx.activePhase === 'wrapup') || !showPhaseFooter) ? (
            <CounsellingDisabledActionTooltip reason={ctx.printDisabledReason}>
              <CounsellingButton
                type="button"
                variant="outline"
                onClick={() => ctx.setEstimatePrintOpen(true)}
                disabled={!!ctx.printDisabledReason}
                className="gap-2 border-counselling-primary/40 text-counselling-primary hover:bg-counselling-accent"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">{counsellingCopy.printEstimate}</span>
                <span className="sm:hidden">{counsellingCopy.print}</span>
              </CounsellingButton>
            </CounsellingDisabledActionTooltip>
          ) : null}
          {showFooterActions && showPhaseFooter && ctx.activePhase !== 'wrapup' ? (
            <CounsellingDisabledActionTooltip reason={ctx.phaseAdvanceError}>
              <CounsellingButton
                type="button"
                onClick={() => ctx.goNext()}
                disabled={!ctx.canAdvancePhase}
                data-testid={counsellingTestIds.btnPhaseNext}
                className="gap-1.5 bg-counselling-primary px-5 hover:bg-counselling-primary/90 disabled:opacity-50 sm:px-6"
              >
                {ctx.activePhase === 'estimate'
                  ? counsellingCopy.nextPatientDecision
                  : counsellingCopy.nextSessionNotes}
                <ChevronRight className="h-4 w-4" />
              </CounsellingButton>
            </CounsellingDisabledActionTooltip>
          ) : null}
          {showFooterActions ? (
            <>
              <CounsellingDisabledActionTooltip reason={ctx.saveDraftDisabledReason}>
                <CounsellingButton
                  type="button"
                  variant="outline"
                  onClick={ctx.handleSaveDraft}
                  disabled={!!ctx.saveDraftDisabledReason}
                  data-testid={counsellingTestIds.btnSaveDraft}
                  className="gap-2 border-counselling-border px-4 sm:px-5"
                >
                  {ctx.isSavingDraft && <Loader2 className="h-4 w-4 animate-spin" />}
                  {counsellingCopy.saveDraft}
                </CounsellingButton>
              </CounsellingDisabledActionTooltip>
            </>
          ) : null}
        </div>
      </div>

      <CounsellingEstimatePrintDialog
        open={ctx.estimatePrintOpen}
        onOpenChange={ctx.setEstimatePrintOpen}
        data={ctx.estimatePdfData}
      />

      {ctx.isScheduleModalOpen && (
        <ScheduleSurgeryModal
          isOpen={ctx.isScheduleModalOpen}
          onClose={() => ctx.setIsScheduleModalOpen(false)}
          onSubmit={ctx.handleScheduleSubmit}
          existingSchedule={ctx.schedule}
        />
      )}

    </div>
    </CounsellingTooltipProvider>
  );
}
