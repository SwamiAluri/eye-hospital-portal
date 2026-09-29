'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { CounsellorOutpatientChecklist } from '@/components/counsellors-desk/CounsellorOutpatientChecklist';
import { SessionHistoryBody } from '@/components/counsellors-desk/SessionHistoryModal';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { SessionPageHeader } from '@/components/counsellors-desk/session/SessionPageHeader';
import { useCounsellingSession } from '@/components/counsellors-desk/session/CounsellingSessionContext';
import { CounsellingEstimatePrintDialog } from '@/components/counsellors-desk/session/CounsellingEstimatePrintDialog';
import {
  CounsellingCard,
  CounsellingCardContent,
  CounsellingCardHeader,
  CounsellingCardTitle,
  CounsellingSkeleton,
  CounsellingTabs,
  CounsellingTooltipProvider,
} from '@/components/counsellors-desk/session/primitives';
import { CounsellingStatusMessage } from '@/components/counsellors-desk/session/primitives/CounsellingStatusMessage';
import { cn } from '@/lib/utils';
import { counsellingTestIds, counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { findCounsellorVariant } from '@/lib/master-data/clinical-catalog-master';
import { resolveCounsellingQuoteFinalPayable } from '@/lib/counsellors-desk/build-coverage-preview';
import { humanizeProcedureCode } from '@/lib/counsellors-desk/coverage-estimate-sync';
import { CoveragePreauthPanel } from '@/components/counsellors-desk/coverage/CoveragePreauthPanel';
import { CounsellingTabPanel } from '@/components/counsellors-desk/session/CounsellingTabPanel';
import { CounsellingSessionChrome } from '@/components/counsellors-desk/session/CounsellingSessionChrome';
import { CounsellingActionBar } from '@/components/counsellors-desk/session/CounsellingActionBar';
import { CounsellingConversationRecorder } from '@/components/counsellors-desk/session/CounsellingConversationRecorder';
import { CounsellingConversationsPanel } from '@/components/counsellors-desk/session/CounsellingConversationsPanel';
import {
  clarifyPhaseAdvanceHint,
  clarifySaveDraftHint,
  clarifySaveSessionHint,
} from '@/lib/counsellors-desk/counselling-action-hints';
import { recommendedSurgeryName } from '@/lib/counsellors-desk/recommended-surgery-name';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { recordingNavigationBlock, type ConversationRecorderPhase } from '@/lib/counsellors-desk/counselling-recording';
import { loadCounsellingSessionHistory } from '@/lib/counsellors-desk/load-counselling-session-history';
import { getStatusBadge } from '@/lib/counsellors-desk/session-utils';
import { buildCounselorNameMap } from '@/lib/counsellors-desk/ownership-display-name';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { useCounsellorMasterOptions } from '@/hooks/use-counsellor-master-options';
import { useCounsellingSessionSummary } from '@/hooks/use-counselling-session-summary';
import { sessionTypeLabelForCode } from '@/lib/counsellors-desk/counsellor-master-maps';
import { ClinicalRecommendationsContent } from '@/components/counsellors-desk/session/ClinicalRecommendationsSheet';
import { PatientDemographicsContent } from '@/components/examination/PatientDemographicsSheet';
import { calcPatientAge } from '@/lib/patients/patient-display-utils';
import type { SessionAuditEntry } from '@/types/counsellors-desk';

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
  const { sessionTypeOptions } = useCounsellorMasterOptions();
  const [contextualDestination, setContextualDestination] = useState<
    'none' | 'patient-context' | 'history' | 'conversations'
  >(() =>
    ctx.sessionFrom === 'waiting-list' && ctx.activeMainTab === 'counselling'
      ? 'patient-context'
      : 'none',
  );
  const [historyEntries, setHistoryEntries] = useState<SessionAuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCounselorNames, setHistoryCounselorNames] = useState<Record<string, string>>({});
  const [recordingPhase, setRecordingPhase] = useState<ConversationRecorderPhase>('idle');
  const [conversationListVersion, setConversationListVersion] = useState(0);
  const recordingLocked = recordingNavigationBlock(recordingPhase) !== null;

  useEffect(() => {
    if (contextualDestination !== 'history' || !ctx.session) return;
    let cancelled = false;
    setHistoryLoading(true);
    const session = ctx.session;
    void (async () => {
      try {
        const [entries, counselors] = await Promise.all([
          loadCounsellingSessionHistory(session.id, session.counsellorNotes),
          counsellorsDeskApi.getCounselors(session.branchId).catch(() => []),
        ]);
        if (cancelled) return;
        setHistoryEntries(entries);
        setHistoryCounselorNames(
          buildCounselorNameMap(counselors, {
            counselorId: session.counselorId,
            counselorName: session.counselorName,
          }),
        );
      } catch {
        if (cancelled) return;
        setHistoryEntries([]);
        setHistoryCounselorNames(
          buildCounselorNameMap([], {
            counselorId: session.counselorId,
            counselorName: session.counselorName,
          }),
        );
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contextualDestination, ctx.session]);

  const doctorRecommendation = useMemo(() => {
    const surgeries = (ctx.session as { surgeries?: Array<{ name?: string; isRecommended?: boolean }> })
      ?.surgeries;
    return recommendedSurgeryName(surgeries);
  }, [ctx.session]);

  /** Stable coverage-panel props — avoid Array.from / inline arrays recreating counsellingCtx every render. */
  const sessionInvestigationsForCoverage = useMemo(() => {
    if (ctx.selectedInvestigations.size === 0) return undefined;
    return Array.from(ctx.selectedInvestigations.values());
  }, [ctx.selectedInvestigations]);

  const sessionEstimateLinesForCoverage = useMemo(() => {
    const lines = ctx.counsellingEstimate.lines;
    return lines.length > 0 ? lines : undefined;
  }, [ctx.counsellingEstimate.lines]);

  const sessionFinalPayable = useMemo(() => {
    const computedQuotePayable = ctx.counsellingEstimate.finalPayableAmount;
    return computedQuotePayable > 0
      ? computedQuotePayable
      : resolveCounsellingQuoteFinalPayable({
          liveFinalPayable: computedQuotePayable,
          savedFinalPayable: ctx.session?.finalPayableAmount,
          estimateLines: ctx.counsellingEstimate.lines,
        });
  }, [
    ctx.counsellingEstimate.finalPayableAmount,
    ctx.counsellingEstimate.lines,
    ctx.session?.finalPayableAmount,
  ]);

  const showOutpatientSafety =
    !ctx.isRepeatState && !ctx.isSurgeryDoneState && ctx.activeMainTab !== 'outpatient';

  const { summary, mergedProgress } = useCounsellingSessionSummary({
    sessionId: ctx.sessionId,
    queueStatus: ctx.queueStatus,
    activeMainTab: ctx.activeMainTab,
    activePhase: ctx.activePhase,
    phaseCompletion: ctx.phaseCompletion,
    isRepeatState: ctx.isRepeatState,
    isSurgeryDoneState: ctx.isSurgeryDoneState,
    decision: ctx.decision,
    paymentType: ctx.paymentType as string,
    insuranceCompany: ctx.insuranceCompany,
    finalPayableAmount: sessionFinalPayable,
    showCoverageWorkflow: ctx.showCoverageWorkflow,
    notRequiredPreAuth: ctx.notRequiredPreAuth,
    coverageProgress: ctx.coverageProgress,
    workspaceCcmsState: ctx.workspaceCcmsState ?? ctx.session?.ccmsCurrentState ?? null,
  });

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
  const consultingDoctor = ctx.schedule?.doctor?.trim() || undefined;
  const operativeEye = ctx.selectedEye || ctx.session?.restoredEye || undefined;
  const doctorRecommendationSummary = doctorRecommendation
    ? operativeEye
      ? `${doctorRecommendation} · ${operativeEye}`
      : doctorRecommendation
    : null;
  const patientDisplayAge =
    calcPatientAge(ctx.patientDetails?.dateOfBirth) ?? ctx.session.age ?? null;
  const sessionTypeLabel = ctx.session.sessionTypeCode
    ? sessionTypeLabelForCode(ctx.session.sessionTypeCode, sessionTypeOptions)
    : null;
  const sessionStatusLabel =
    ctx.queueStatus !== 'RepeatCounselling'
      ? getStatusBadge(ctx.queueStatus).label
      : 'Repeat Counselling';
  const saveSessionHint = clarifySaveSessionHint(ctx.saveDisabledReason);
  const saveDraftHint = clarifySaveDraftHint(ctx.saveDraftDisabledReason);
  const phaseAdvanceHint = clarifyPhaseAdvanceHint(ctx.phaseAdvanceError);
  const sessionPackageName = ctx.counsellingEstimate.isPackageMode
    ? (ctx.counsellingEstimate.activeTemplate?.name ?? ctx.packageName) || undefined
    : undefined;
  const sessionEstimateMode = ctx.counsellingEstimate.isPackageMode ? ('package' as const) : ('custom' as const);

  /** Waiting List owns Start Repeat / Re-evaluate — do not grey or scroll-lock completed session UX. */
  const outpatientReadOnly =
    ctx.queueStatus === 'SurgeryDone' || !canEditCounsellorOutpatient || ctx.isRepeatState;
  const recordingVersion = typeof ctx.session?.version === 'number' ? ctx.session.version : null;
  const canRecordConversation =
    ctx.queueStatus === 'Processed' && ctx.isSessionOwner && recordingVersion !== null;

  return (
    <CounsellingTooltipProvider delayDuration={300}>
    <div className={counsellingSessionTokens.shellPage}>
    <div className={counsellingSessionTokens.shellPageGrid}>
      <CounsellingTabs
        value={ctx.activeMainTab}
        onValueChange={(value) => {
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
            summaryChips={summary.chips}
            summaryStatusLine={summary.statusLine}
            showOutpatientSafety={showOutpatientSafety}
            onCloseSession={ctx.handleClose}
            onOpenOutpatientSafety={() => {
              setContextualDestination('none');
              ctx.setActiveMainTab('outpatient');
            }}
            renderWorkflow={({ openClinicalRecommendations, openSessionHistory }) => (
              <CounsellingSessionChrome
                queueStatus={ctx.queueStatus}
                activeMainTab={ctx.activeMainTab}
                activePhase={ctx.activePhase}
                phaseCompletion={ctx.phaseCompletion}
                isRepeatState={ctx.isRepeatState}
                isSurgeryDoneState={ctx.isSurgeryDoneState}
                showCoverageWorkflow={ctx.showCoverageWorkflow}
                coverageTabAvailable={ctx.coverageTabAvailable}
                coverageProgress={mergedProgress}
                canGoToPhase={ctx.canGoToPhase}
                finishSummaryActive={ctx.finishSummaryActive}
                navigationBlocked={recordingLocked}
                contextualDestination={contextualDestination}
                onSelectPatientContext={() => {
                  if (recordingLocked) return;
                  openClinicalRecommendations();
                }}
                onSelectHistory={() => {
                  if (recordingLocked) return;
                  openSessionHistory();
                }}
                onSelectConversations={() => {
                  if (recordingLocked) return;
                  setContextualDestination('conversations');
                }}
                recordingAction={canRecordConversation ? (
                  recordingVersion !== null ? (
                    <CounsellingConversationRecorder
                      sessionId={ctx.sessionId}
                      expectedVersion={recordingVersion}
                      onPhaseChange={setRecordingPhase}
                      onSaved={() => setConversationListVersion((version) => version + 1)}
                    />
                  ) : null
                ) : null}
                onNavigateTab={(tab) => {
                  setContextualDestination('none');
                  ctx.setActiveMainTab(tab);
                }}
                onNavigatePhase={(phase) => {
                  setContextualDestination('none');
                  ctx.setActiveMainTab('counselling');
                  ctx.goToPhase(phase);
                }}
                onFinishSummaryActive={(active) => {
                  setContextualDestination('none');
                  if (active) {
                    ctx.openFinishSummary();
                    return;
                  }
                  ctx.setFinishSummaryActive(false);
                }}
              />
            )}
            onOpenPatientContext={() => setContextualDestination('patient-context')}
            onOpenHistory={() => setContextualDestination('history')}
          />
        </div>

      <div className={cn(counsellingSessionTokens.shellModuleHost, 'staff-page-workspace min-h-0 flex-1')}>
        <div className={TAB_BODY_CLASS}>
        {ctx.coverageTabMounted && (
          <div
            className={
              contextualDestination !== 'none' || ctx.activeMainTab !== 'coverage'
                ? 'hidden'
                : TAB_BODY_CLASS
            }
          >
            <div
              className={cn(
                'counselling-hidden-scroll flex min-h-0 flex-1 flex-col overflow-hidden',
                counsellingSessionTokens.shellModuleBodyPadding,
              )}
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
              sessionInvestigations={sessionInvestigationsForCoverage}
              sessionEstimateLines={sessionEstimateLinesForCoverage}
              sessionIsPackageMode={ctx.counsellingEstimate.isPackageMode}
              sessionPackageAmount={
                ctx.counsellingEstimate.activeTemplate?.packageAmount
              }
              forceReadOnly={ctx.isReadOnly}
              onProgressChange={ctx.handleCoverageProgressChange}
              onEditQuote={() => {
                if (ctx.isReadOnly) return;
                ctx.setActiveMainTab('counselling');
                ctx.goToPhase('estimate');
              }}
            />
            </div>
          </div>
        )}

        <div
          className={
            contextualDestination !== 'none' || ctx.activeMainTab !== 'counselling'
              ? 'hidden'
              : COUNSELLING_TAB_CLASS
          }
        >
          <CounsellingTabPanel />
        </div>

        {ctx.activeMainTab === 'outpatient' && (
          <div className={contextualDestination !== 'none' ? 'hidden' : TAB_BODY_CLASS}>
            <div
              className={cn(
                'counselling-hidden-scroll',
                TAB_SCROLL_CLASS,
                counsellingSessionTokens.shellModuleBodyPadding,
              )}
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
        {contextualDestination !== 'none' ? (
          <div
            className={cn(
              'counselling-hidden-scroll',
              TAB_SCROLL_CLASS,
              counsellingSessionTokens.shellModuleBodyPadding,
            )}
          >
            {contextualDestination === 'patient-context' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <CounsellingCard>
                  <CounsellingCardHeader>
                    <CounsellingCardTitle>{counsellingCopy.clinicalRecommendations}</CounsellingCardTitle>
                  </CounsellingCardHeader>
                  <CounsellingCardContent>
                    <ClinicalRecommendationsContent
                      doctorRecommendationSummary={doctorRecommendationSummary}
                    />
                  </CounsellingCardContent>
                </CounsellingCard>
                <CounsellingCard>
                  <CounsellingCardHeader>
                    <CounsellingCardTitle>{counsellingCopy.patientDetails}</CounsellingCardTitle>
                  </CounsellingCardHeader>
                  <CounsellingCardContent>
                    {ctx.patientDetailsLoading ? (
                      <CounsellingStatusMessage tone="loading" title="Loading patient details" />
                    ) : ctx.patientDetails ? (
                      <PatientDemographicsContent
                        presentation="workspace"
                        patient={ctx.patientDetails}
                        age={patientDisplayAge}
                        visitLabel={counsellingCopy.counsellingSession}
                        displayNameFallback={ctx.session.patientName}
                        mrnFallback={ctx.session.uhid}
                        genderFallback={ctx.session.gender}
                        counsellingContext={{
                          counsellingType: sessionTypeLabel,
                          sessionStatus: sessionStatusLabel,
                          operativeEye,
                          consultingDoctor,
                        }}
                      />
                    ) : (
                      <CounsellingStatusMessage tone="info" title="Patient details are not available" />
                    )}
                  </CounsellingCardContent>
                </CounsellingCard>
              </div>
            ) : contextualDestination === 'conversations' ? (
              <CounsellingConversationsPanel
                sessionId={ctx.sessionId}
                sessionLabel={sessionTypeLabel}
                historyVersion={conversationListVersion}
                patient={{
                  patientName: ctx.session.patientName,
                  mrn: ctx.session.uhid,
                  ageLabel: patientDisplayAge,
                  sex: ctx.session.gender,
                  eye: operativeEye,
                }}
              />
            ) : (
              <SessionHistoryBody
                entries={historyEntries}
                isLoading={historyLoading}
                counselorNameById={historyCounselorNames}
              />
            )}
          </div>
        ) : null}
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
        contentMutationsLocked={ctx.ownershipLocksMutations}
        printDisabledReason={ctx.printDisabledReason}
        canSubmitToClaims={!!ctx.coverageProgress.canSubmitToClaims}
        submittingToClaims={!!ctx.coverageProgress.submittingToClaims}
        isSaving={ctx.isSaving}
        isSavingDraft={ctx.isSavingDraft}
        finishSummaryActive={ctx.finishSummaryActive}
        navigationBlocked={false}
        sessionFrom={ctx.sessionFrom}
        hideLeaveControl
        revealWorkspaceOnly={contextualDestination === 'patient-context'}
        onRevealWorkspace={() => setContextualDestination('none')}
        onPhaseBack={ctx.goToPreviousPhase}
        onCloseSession={ctx.handleClose}
        onPhaseNext={() => ctx.goNext()}
        onSaveSession={ctx.handleSave}
        onSaveDraft={ctx.handleSaveDraft}
        onPrint={() => ctx.setEstimatePrintOpen(true)}
        onSubmitToClaims={() => void ctx.coveragePanelRef.current?.submitToClaims()}
        onNavigateTab={(tab) => {
          ctx.setActiveMainTab(tab);
        }}
        onNavigatePhase={(phase) => {
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
