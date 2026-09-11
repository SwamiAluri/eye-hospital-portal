'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { CounsellorOutpatientChecklist } from '@/components/counsellors-desk/CounsellorOutpatientChecklist';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { SessionPageHeader } from '@/components/counsellors-desk/session/SessionPageHeader';
import { useCounsellingSession } from '@/components/counsellors-desk/session/CounsellingSessionContext';
import { CounsellingEstimatePrintDialog } from '@/components/counsellors-desk/session/CounsellingEstimatePrintDialog';
import {
  CounsellingSkeleton,
  CounsellingTabs,
  CounsellingTooltipProvider,
} from '@/components/counsellors-desk/session/primitives';
import { CounsellingStatusMessage } from '@/components/counsellors-desk/session/primitives/CounsellingStatusMessage';
import { CounsellingRepeatSessionBanner } from '@/components/counsellors-desk/session/CounsellingRepeatSessionBanner';
import { cn } from '@/lib/utils';
import { counsellingTestIds, counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { findCounsellorVariant } from '@/lib/master-data/clinical-catalog-master';
import { resolveCounsellingQuoteFinalPayable } from '@/lib/counsellors-desk/build-coverage-preview';
import { humanizeProcedureCode } from '@/lib/counsellors-desk/coverage-estimate-sync';
import { CoveragePreauthPanel } from '@/components/counsellors-desk/coverage/CoveragePreauthPanel';
import { CounsellingTabPanel } from '@/components/counsellors-desk/session/CounsellingTabPanel';
import { CounsellingSessionChrome } from '@/components/counsellors-desk/session/CounsellingSessionChrome';
import { CounsellingActionBar } from '@/components/counsellors-desk/session/CounsellingActionBar';
import {
  clarifyPhaseAdvanceHint,
  clarifySaveDraftHint,
  clarifySaveSessionHint,
} from '@/lib/counsellors-desk/counselling-action-hints';
import { recommendedSurgeryName } from '@/lib/counsellors-desk/recommended-surgery-name';

const ScheduleSurgeryModal = dynamic(
  () =>
    import('@/components/counsellors-desk/ScheduleSurgeryModal').then((m) => ({
      default: m.ScheduleSurgeryModal,
    })),
  { ssr: false },
);

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
    return recommendedSurgeryName(surgeries);
  }, [ctx.session]);

  if (ctx.isLoading) {
    return (
      <div className={cn(counsellingSessionTokens.shellPage, 'gap-2 p-4')} aria-busy>
        <CounsellingSkeleton className="h-12 w-full bg-counselling-muted/80" />
        <CounsellingSkeleton className="h-16 w-full bg-counselling-muted/80" />
        <div className="min-h-0 flex-1 border-t border-counselling-border/60 bg-counselling-card/25 p-4">
          <CounsellingStatusMessage tone="loading" title="Loading session" />
        </div>
        <CounsellingSkeleton className="h-10 w-full border-t border-counselling-border/60 bg-counselling-muted/80" />
      </div>
    );
  }

  if (!ctx.session) {
    return (
      <div className="counselling-session p-4">
        <CounsellingStatusMessage tone="error" title="Session not found" description="Return to the waiting list." />
      </div>
    );
  }

  const ccmsCaseNumber = ctx.workspaceCcmsCaseNumber ?? ctx.session.ccmsCaseNumber;

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
  const computedQuotePayable = ctx.counsellingEstimate.finalPayableAmount;
  const sessionFinalPayable =
    computedQuotePayable > 0
      ? computedQuotePayable
      : resolveCounsellingQuoteFinalPayable({
          liveFinalPayable: computedQuotePayable,
          savedFinalPayable: ctx.session?.finalPayableAmount,
          estimateLines: ctx.counsellingEstimate.lines,
        });
  const consultingDoctor = ctx.schedule?.doctor?.trim() || undefined;
  const operativeEye = ctx.selectedEye || ctx.session?.restoredEye || undefined;
  const saveSessionHint = clarifySaveSessionHint(ctx.saveDisabledReason);
  const saveDraftHint = clarifySaveDraftHint(ctx.saveDraftDisabledReason);
  const phaseAdvanceHint = clarifyPhaseAdvanceHint(ctx.phaseAdvanceError);
  const sessionPackageName = ctx.counsellingEstimate.isPackageMode
    ? (ctx.counsellingEstimate.activeTemplate?.name ?? ctx.packageName) || undefined
    : undefined;
  const sessionEstimateMode = ctx.counsellingEstimate.isPackageMode ? ('package' as const) : ('custom' as const);

  const isRepeatGateActive = ctx.isRepeatState;
  const repeatPanelClass = 'pointer-events-none select-none opacity-45';
  const outpatientReadOnly =
    ctx.queueStatus === 'SurgeryDone' || !canEditCounsellorOutpatient || isRepeatGateActive;

  return (
    <CounsellingTooltipProvider delayDuration={300}>
    <div className={counsellingSessionTokens.shellPage}>
    <div className={counsellingSessionTokens.shellPageGrid}>
      <CounsellingTabs
        value={ctx.activeMainTab}
        onValueChange={(value) => {
          if (isRepeatGateActive) return;
          ctx.setActiveMainTab(value as 'counselling' | 'coverage' | 'outpatient');
        }}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className={counsellingSessionTokens.shellChromeStack}>
          <SessionPageHeader
            session={ctx.session}
            queueStatus={ctx.queueStatus}
            patientDetails={ctx.patientDetails}
            patientDetailsLoading={ctx.patientDetailsLoading}
            doctorRecommendation={doctorRecommendation}
            consultingDoctor={consultingDoctor}
            operativeEye={operativeEye}
          />

          <CounsellingSessionChrome
            sessionId={ctx.sessionId}
            queueStatus={ctx.queueStatus}
            activeMainTab={ctx.activeMainTab}
            activePhase={ctx.activePhase}
            phaseCompletion={ctx.phaseCompletion}
            isRepeatState={ctx.isRepeatState}
            isSurgeryDoneState={ctx.isSurgeryDoneState}
            decision={ctx.decision}
            paymentType={ctx.paymentType as string}
            insuranceCompany={ctx.insuranceCompany}
            finalPayableAmount={sessionFinalPayable}
            showCoverageWorkflow={ctx.showCoverageWorkflow}
            coverageTabAvailable={ctx.coverageTabAvailable}
            notRequiredPreAuth={ctx.notRequiredPreAuth}
            coverageProgress={ctx.coverageProgress}
            workspaceCcmsState={ctx.workspaceCcmsState ?? ctx.session.ccmsCurrentState}
            canGoToPhase={ctx.canGoToPhase}
            finishSummaryActive={ctx.finishSummaryActive}
            navigationBlocked={isRepeatGateActive}
            onNavigateTab={(tab) => {
              if (isRepeatGateActive) return;
              ctx.setActiveMainTab(tab);
            }}
            onNavigatePhase={(phase) => {
              if (isRepeatGateActive) return;
              ctx.setActiveMainTab('counselling');
              ctx.goToPhase(phase);
            }}
            onFinishSummaryActive={(active) => {
              if (active) {
                ctx.openFinishSummary();
                return;
              }
              ctx.setFinishSummaryActive(false);
            }}
          />
        </div>

      <div className={cn(counsellingSessionTokens.shellModuleHost, 'staff-page-workspace min-h-0 flex-1')}>
        {isRepeatGateActive ? (
          <CounsellingRepeatSessionBanner
            sessionTypeCode={ctx.repeatSessionTypeCode}
            onSessionTypeChange={ctx.setRepeatSessionTypeCode}
            onStartSession={ctx.handleStartRepeatSession}
          />
        ) : null}

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
                'counselling-hidden-scroll flex min-h-0 flex-1 flex-col overflow-hidden',
                counsellingSessionTokens.shellModuleBodyPadding,
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
              forceReadOnly={isRepeatGateActive || ctx.isReadOnly}
              onProgressChange={ctx.handleCoverageProgressChange}
              onEditQuote={() => {
                if (isRepeatGateActive || ctx.isReadOnly) return;
                ctx.setActiveMainTab('counselling');
                ctx.goToPhase('estimate');
              }}
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
                'counselling-hidden-scroll',
                TAB_SCROLL_CLASS,
                counsellingSessionTokens.shellModuleBodyPadding,
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
      </div>
      </CounsellingTabs>

      <CounsellingActionBar
        queueStatus={ctx.queueStatus}
        activeMainTab={ctx.activeMainTab}
        activePhase={ctx.activePhase}
        phaseCompletion={ctx.phaseCompletion}
        isRepeatState={ctx.isRepeatState}
        isSurgeryDoneState={ctx.isSurgeryDoneState}
        decision={ctx.decision}
        paymentType={ctx.paymentType as string}
        insuranceCompany={ctx.insuranceCompany}
        finalPayableAmount={sessionFinalPayable}
        showCoverageWorkflow={ctx.showCoverageWorkflow}
        coverageTabAvailable={ctx.coverageTabAvailable}
        notRequiredPreAuth={ctx.notRequiredPreAuth}
        coverageProgress={ctx.coverageProgress}
        canAdvancePhase={ctx.canAdvancePhase}
        phaseAdvanceError={ctx.phaseAdvanceError}
        saveDisabledReason={ctx.saveDisabledReason}
        saveSessionTooltip={saveSessionHint}
        phaseAdvanceTooltip={phaseAdvanceHint}
        saveDraftDisabledReason={saveDraftHint ?? ctx.saveDraftDisabledReason}
        printDisabledReason={ctx.printDisabledReason}
        canSubmitToClaims={!!ctx.coverageProgress.canSubmitToClaims}
        submittingToClaims={!!ctx.coverageProgress.submittingToClaims}
        isSaving={ctx.isSaving}
        isSavingDraft={ctx.isSavingDraft}
        finishSummaryActive={ctx.finishSummaryActive}
        navigationBlocked={isRepeatGateActive}
        onPhaseBack={ctx.goToPreviousPhase}
        onPhaseNext={() => ctx.goNext()}
        onSaveSession={ctx.handleSave}
        onSaveDraft={ctx.handleSaveDraft}
        onPrint={() => ctx.setEstimatePrintOpen(true)}
        onSubmitToClaims={() => void ctx.coveragePanelRef.current?.submitToClaims()}
        onNavigateTab={(tab) => {
          if (isRepeatGateActive) return;
          ctx.setActiveMainTab(tab);
        }}
        onNavigatePhase={(phase) => {
          if (isRepeatGateActive) return;
          ctx.setActiveMainTab('counselling');
          ctx.goToPhase(phase);
        }}
        onFinishSummaryActive={(active) => {
          if (active) ctx.openFinishSummary();
          else ctx.setFinishSummaryActive(false);
        }}
      />
    </div>

      <ctx.ConfirmationComponent />
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
