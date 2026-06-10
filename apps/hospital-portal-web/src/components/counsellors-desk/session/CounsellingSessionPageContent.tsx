'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Printer } from 'lucide-react';
import { CounsellorOutpatientChecklist } from '@/components/counsellors-desk/CounsellorOutpatientChecklist';
import { LegacyPreAdmissionBanner } from '@/components/counsellors-desk/LegacyPreAdmissionBanner';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { SessionPageHeader } from '@/components/counsellors-desk/session/SessionPageHeader';
import { useCounsellingSession } from '@/components/counsellors-desk/session/CounsellingSessionContext';
import { CounsellingEstimatePrintDialog } from '@/components/counsellors-desk/session/CounsellingEstimatePrintDialog';
import { CounsellingSessionPanelSkeleton } from '@/components/counsellors-desk/session/CounsellingSessionPanelSkeleton';
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
import { isCoveragePaymentType } from '@/lib/counsellors-desk/counselling-progress';

const ScheduleSurgeryModal = dynamic(
  () =>
    import('@/components/counsellors-desk/ScheduleSurgeryModal').then((m) => ({
      default: m.ScheduleSurgeryModal,
    })),
  { ssr: false },
);
const SessionHistoryModal = dynamic(
  () =>
    import('@/components/counsellors-desk/SessionHistoryModal').then((m) => ({
      default: m.SessionHistoryModal,
    })),
  { ssr: false },
);
const CoveragePreauthPanel = dynamic(
  () =>
    import('@/components/counsellors-desk/coverage/CoveragePreauthPanel').then((m) => ({
      default: m.CoveragePreauthPanel,
    })),
  {
    ssr: false,
    loading: () => <CounsellingSessionPanelSkeleton label="Loading coverage panel" />,
  },
);
const CounsellingTabPanel = dynamic(
  () =>
    import('@/components/counsellors-desk/session/CounsellingTabPanel').then((m) => ({
      default: m.CounsellingTabPanel,
    })),
  {
    ssr: false,
    loading: () => <CounsellingSessionPanelSkeleton label="Loading counselling panel" />,
  },
);


function isShowCoverageTab(paymentType: string): boolean {
  return isCoveragePaymentType(paymentType);
}

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

  const showCoverageTab = isShowCoverageTab(ctx.paymentType as string);
  const isCounsellingTab = ctx.activeMainTab === 'counselling';
  const isRepeatGateActive = ctx.isRepeatState;
  const showPhaseFooter = isCounsellingTab && !ctx.isReadOnly;

  return (
    <CounsellingTooltipProvider delayDuration={300}>
    <div className="counselling-session flex h-full min-h-0 flex-col p-4">
      <ctx.ConfirmationComponent />
      <SessionPageHeader
        session={ctx.session}
        queueStatus={ctx.queueStatus}
        isDirty={ctx.isDirty}
        historyBtnRef={ctx.historyBtnRef}
        onBack={ctx.handleBack}
        onOpenHistory={ctx.handleOpenHistory}
        doctorRecommendation={doctorRecommendation}
      />

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-counselling-border/80 bg-counselling-card shadow-sm">
        {isRepeatGateActive ? (
          <CounsellingRepeatSessionBanner
            sessionTypeCode={ctx.repeatSessionTypeCode}
            onSessionTypeChange={ctx.setRepeatSessionTypeCode}
            onStartSession={ctx.handleStartRepeatSession}
          />
        ) : null}

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            isRepeatGateActive && 'pointer-events-none select-none opacity-45',
          )}
          aria-disabled={isRepeatGateActive || undefined}
        >
        <CounsellingTabs
          value={ctx.activeMainTab}
          onValueChange={(value) => {
            if (isRepeatGateActive) return;
            ctx.setActiveMainTab(value as 'counselling' | 'coverage' | 'outpatient');
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-shrink-0 border-b border-counselling-border px-4 pt-3">
            <CounsellingTabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
              <CounsellingTabsTrigger
                value="counselling"
                disabled={isRepeatGateActive}
                className="rounded-t-lg rounded-b-none border border-transparent px-4 py-2 data-[state=active]:border-counselling-border data-[state=active]:border-b-white data-[state=active]:bg-counselling-card data-[state=active]:text-counselling-primary disabled:opacity-60"
              >
                Counselling
              </CounsellingTabsTrigger>
              {showCoverageTab ? (
                <CounsellingTabsTrigger
                  value="coverage"
                  disabled={isRepeatGateActive}
                  className="flex items-center gap-1.5 rounded-t-lg rounded-b-none border border-transparent px-4 py-2 data-[state=active]:border-counselling-border data-[state=active]:border-b-white data-[state=active]:bg-counselling-card data-[state=active]:text-counselling-primary disabled:opacity-60"
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
                className="flex items-center gap-1.5 rounded-t-lg rounded-b-none border border-transparent px-4 py-2 data-[state=active]:border-counselling-border data-[state=active]:border-b-white data-[state=active]:bg-counselling-card data-[state=active]:text-counselling-primary disabled:opacity-60"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Outpatient Safety
              </CounsellingTabsTrigger>
            </CounsellingTabsList>
          </div>

        {ctx.coverageTabMounted && (
          <div
            className={
              ctx.activeMainTab !== 'coverage'
                ? 'hidden'
                : 'flex min-h-0 flex-1 flex-col overflow-hidden p-5'
            }
          >
            <CoveragePreauthPanel
              sessionId={ctx.sessionId}
              paymentType={ctx.paymentType as string}
              insuranceCompany={ctx.insuranceCompany}
              patientId={ctx.session.patientId}
              notRequiredPreAuth={ctx.notRequiredPreAuth}
              refreshKey={ctx.coverageRefreshKey}
              initialSubtab={ctx.initialSubtab}
              cachedCaseNumber={ctx.session.ccmsCaseNumber}
              cachedCaseState={ctx.session.ccmsCurrentState}
              sessionSurgery={ctx.packageName || undefined}
              sessionSurgeryDate={ctx.schedule?.selectedDate || undefined}
              sessionPackageRate={ctx.packageRate ? Number(ctx.packageRate) : undefined}
              sessionFinalPayable={
                ctx.counsellingEstimate.finalPayableAmount > 0
                  ? ctx.counsellingEstimate.finalPayableAmount
                  : ctx.mergedEstimate.finalPayableAmount > 0
                    ? ctx.mergedEstimate.finalPayableAmount
                    : undefined
              }
              sessionDoctor={ctx.schedule?.doctor || undefined}
              sessionTheatre={ctx.schedule?.operationTheatre || undefined}
              sessionEye={ctx.selectedEye || undefined}
              sessionInvestigations={
                ctx.selectedInvestigations.size > 0
                  ? Array.from(ctx.selectedInvestigations.values())
                  : undefined
              }
            />
          </div>
        )}

        {ctx.activeMainTab === 'counselling' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CounsellingTabPanel />
          </div>
        )}

        {ctx.activeMainTab === 'outpatient' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <LegacyPreAdmissionBanner counselingSessionId={ctx.sessionId} />
            <CounsellorOutpatientChecklist
              counselingSessionId={ctx.sessionId}
              readOnly={ctx.isReadOnly || !canEditCounsellorOutpatient}
              showRollup
              integrationContext={{
                patientId: ctx.session.patientId,
                paymentType: ctx.paymentType || ctx.session.paymentType,
                notRequiredPreAuth: ctx.notRequiredPreAuth ?? ctx.session.notRequiredPreAuth,
                ccmsCurrentState: ctx.session.ccmsCurrentState,
                packageRate: ctx.packageRate !== '' ? ctx.packageRate : ctx.session.packageRate,
              }}
            />
          </div>
        )}
        </CounsellingTabs>
        </div>
      </div>

      <div
        className={cn(
          'sticky bottom-0 z-[60] mt-4 flex items-center justify-between gap-3 rounded-xl border-t border-counselling-border bg-counselling-card px-4 py-3 shadow-lg sm:px-6',
          isRepeatGateActive && 'pointer-events-none select-none opacity-45',
        )}
        aria-disabled={isRepeatGateActive || undefined}
      >
        <div className="relative flex items-center gap-2">
          {isRepeatGateActive ? (
            <CounsellingButton
              type="button"
              variant="outline"
              onClick={ctx.handleBack}
              className="pointer-events-auto gap-2 opacity-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </CounsellingButton>
          ) : null}
          {!isRepeatGateActive && showPhaseFooter && ctx.activePhase !== 'estimate' ? (
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
          {!isRepeatGateActive ? (
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
          {!isRepeatGateActive &&
          ((showPhaseFooter && ctx.activePhase === 'wrapup') || !showPhaseFooter) ? (
            <CounsellingDisabledActionTooltip reason={ctx.printDisabledReason}>
              <CounsellingButton
                type="button"
                variant="outline"
                onClick={() => ctx.setEstimatePrintOpen(true)}
                disabled={!ctx.canPrintEstimate}
                className="gap-2 border-counselling-primary/40 text-counselling-primary hover:bg-counselling-accent"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Print Estimate</span>
                <span className="sm:hidden">Print</span>
              </CounsellingButton>
            </CounsellingDisabledActionTooltip>
          ) : null}
          {!isRepeatGateActive && showPhaseFooter && ctx.activePhase !== 'wrapup' ? (
            <CounsellingDisabledActionTooltip reason={ctx.phaseAdvanceError}>
              <CounsellingButton
                type="button"
                onClick={() => ctx.goNext()}
                disabled={!ctx.canAdvancePhase}
                data-testid={counsellingTestIds.btnPhaseNext}
                className="gap-1.5 bg-counselling-primary px-5 hover:bg-counselling-primary/90 disabled:opacity-50 sm:px-6"
              >
                {ctx.activePhase === 'estimate' ? 'Next: Patient Decision' : 'Next: Wrap-up'}
                <ChevronRight className="h-4 w-4" />
              </CounsellingButton>
            </CounsellingDisabledActionTooltip>
          ) : !isRepeatGateActive ? (
            <CounsellingDisabledActionTooltip reason={ctx.saveDisabledReason}>
              <CounsellingButton
                type="button"
                onClick={ctx.handleSave}
                disabled={!!ctx.saveDisabledReason}
                data-testid={counsellingTestIds.btnSaveSession}
                className="gap-2 bg-counselling-primary px-6 hover:bg-counselling-primary/90 disabled:opacity-50 sm:px-8"
              >
              {ctx.isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Session
              </CounsellingButton>
            </CounsellingDisabledActionTooltip>
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

      {ctx.isHistoryOpen && (
        <SessionHistoryModal
          isOpen={ctx.isHistoryOpen}
          onClose={() => ctx.setIsHistoryOpen(false)}
          entries={ctx.historyEntries}
          isLoading={ctx.isHistoryLoading}
          anchorRef={ctx.historyBtnRef}
        />
      )}
    </div>
    </CounsellingTooltipProvider>
  );
}
