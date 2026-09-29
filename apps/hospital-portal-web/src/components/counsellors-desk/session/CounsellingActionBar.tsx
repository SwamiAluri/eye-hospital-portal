'use client';

import { ChevronLeft, ChevronRight, Loader2, Printer } from 'lucide-react';
import {
  buildSessionActionBarModel,
  type SessionActionBarModel,
} from '@/lib/counsellors-desk/counselling-session-actions';
import type { BuildSessionActionBarInput } from '@/lib/counsellors-desk/counselling-session-actions';
import { applySessionNavigation } from '@/lib/counsellors-desk/counselling-session-navigation';
import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import type { SessionMainTab } from '@/lib/counsellors-desk/session-status-summary';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { resolveCounsellingSessionLeaveControl } from '@/lib/counsellors-desk/counselling-session-origin';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives';
import { CounsellingDisabledActionTooltip } from '@/components/counsellors-desk/session/CounsellingDisabledActionTooltip';
import { cn } from '@/lib/utils';

export interface CounsellingActionBarProps extends BuildSessionActionBarInput {
  isSaving: boolean;
  isSavingDraft: boolean;
  saveSessionTooltip?: string | null;
  phaseAdvanceTooltip?: string | null;
  /** URL `from` query — Waiting List entry shows Back instead of Close when applicable. */
  sessionFrom?: string | null;
  /** Header owns Close. Footer keeps journey Back only. */
  hideLeaveControl?: boolean;
  /** Patient Context is showing. Next reveals the current step and does not advance it. */
  revealWorkspaceOnly?: boolean;
  onRevealWorkspace?: () => void;
  onPhaseBack?: () => void;
  onCloseSession?: () => void;
  onPhaseNext?: () => void;
  onSaveSession?: () => void;
  onSaveDraft?: () => void;
  onPrint?: () => void;
  onSubmitToClaims?: () => void;
  onNavigateTab?: (tab: SessionMainTab) => void;
  onNavigatePhase?: (phase: CounsellingPhase) => void;
  onFinishSummaryActive?: (active: boolean) => void;
  navigationBlocked?: boolean;
  className?: string;
}

function resolvePrimaryDisabled(
  model: SessionActionBarModel,
  isSaving: boolean,
  submittingToClaims: boolean,
): boolean {
  if (!model.primary) return true;
  if (model.primary.kind === 'save_session' && (model.primary.disabledReason || isSaving)) {
    return true;
  }
  if (model.primary.kind === 'submit_claims' && (model.primary.disabledReason || submittingToClaims)) {
    return true;
  }
  return !!model.primary.disabledReason;
}

function resolvePrimaryTooltip(
  model: SessionActionBarModel,
  input: Pick<CounsellingActionBarProps, 'saveSessionTooltip' | 'phaseAdvanceTooltip'>,
  isSaving: boolean,
): string | null {
  if (!model.primary) return null;
  if (isSaving) return 'Saving…';
  if (model.primary.kind === 'save_session') {
    return input.saveSessionTooltip ?? model.primary.disabledReason ?? null;
  }
  if (model.primary.kind === 'phase_next') {
    return input.phaseAdvanceTooltip ?? model.primary.disabledReason ?? null;
  }
  return model.primary.disabledReason ?? null;
}

export function CounsellingActionBar({
  isSaving,
  isSavingDraft,
  sessionFrom = null,
  hideLeaveControl = false,
  revealWorkspaceOnly = false,
  onRevealWorkspace,
  onPhaseBack,
  onCloseSession,
  onPhaseNext,
  onSaveSession,
  onSaveDraft,
  onPrint,
  onSubmitToClaims,
  onNavigateTab,
  onNavigatePhase,
  onFinishSummaryActive,
  navigationBlocked = false,
  className,
  ...input
}: CounsellingActionBarProps) {
  const model = buildSessionActionBarModel(input);
  const leaveControl = resolveCounsellingSessionLeaveControl({
    from: sessionFrom,
    showPhaseBack: model.showPhaseBack,
  });
  const primaryIsDisabled = resolvePrimaryDisabled(
    model,
    isSaving,
    input.submittingToClaims,
  );
  const primaryTooltip = resolvePrimaryTooltip(model, input, isSaving);

  const handlePrimary = () => {
    if (!model.primary || primaryIsDisabled || navigationBlocked) return;
    switch (model.primary.kind) {
      case 'phase_next':
        if (revealWorkspaceOnly) {
          onRevealWorkspace?.();
          break;
        }
        onPhaseNext?.();
        break;
      case 'navigate':
        if (revealWorkspaceOnly) {
          onRevealWorkspace?.();
          break;
        }
        applySessionNavigation(
          { tab: model.primary.navigateTab, phase: model.primary.navigatePhase },
          { onNavigateTab, onNavigatePhase, onFinishSummaryActive, isBlocked: navigationBlocked },
        );
        break;
      case 'save_session':
        onSaveSession?.();
        break;
      case 'submit_claims':
        onSubmitToClaims?.();
        break;
      default:
        break;
    }
  };

  const showPrimary = model.primary && model.primary.kind !== 'none';

  return (
    <footer
      data-testid={counsellingTestIds.actionBar}
      className={cn(
        counsellingSessionTokens.shellActionBar,
        'staff-page-footer flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between min-[1600px]:gap-1.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {model.showPhaseBack ? (
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPhaseBack}
            data-testid={counsellingTestIds.btnPhaseBack}
            className={cn(
              'h-9 gap-1 px-2 text-counselling-primary hover:bg-counselling-accent/50 hover:text-counselling-primary',
              counsellingSessionTokens.actionBarLabel,
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {counsellingCopy.back}
          </CounsellingButton>
        ) : null}
        {model.showClose && !hideLeaveControl ? (
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCloseSession}
            aria-label={leaveControl.ariaLabel}
            data-testid={
              leaveControl.showChevron
                ? counsellingTestIds.btnBackToWaitingList
                : counsellingTestIds.btnCloseSession
            }
            className={cn(
              'h-9 gap-1 px-2',
              leaveControl.showChevron
                ? 'text-counselling-primary hover:bg-counselling-accent/50 hover:text-counselling-primary'
                : 'text-counselling-muted-foreground hover:bg-counselling-muted/50 hover:text-counselling-foreground',
              counsellingSessionTokens.actionBarLabel,
            )}
          >
            {leaveControl.showChevron ? (
              <ChevronLeft className="h-4 w-4" aria-hidden />
            ) : null}
            {leaveControl.label}
          </CounsellingButton>
        ) : null}
        {model.statusHint && !showPrimary ? (
          <p
            data-testid={counsellingTestIds.actionBarStatusHint}
            className="truncate text-xs text-counselling-muted-foreground"
          >
            {model.statusHint}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {model.showPrint ? (
          <CounsellingDisabledActionTooltip reason={model.printDisabledReason}>
            <CounsellingButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPrint}
              disabled={!!model.printDisabledReason}
              className={cn(
                'h-9 gap-1.5 px-2 text-counselling-foreground hover:bg-counselling-muted/50',
                counsellingSessionTokens.actionBarLabel,
              )}
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{counsellingCopy.print}</span>
            </CounsellingButton>
          </CounsellingDisabledActionTooltip>
        ) : null}

        {model.showSaveDraft ? (
          <CounsellingDisabledActionTooltip reason={model.saveDraftDisabledReason}>
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              onClick={onSaveDraft}
              disabled={!!model.saveDraftDisabledReason}
              data-testid={counsellingTestIds.btnSaveDraft}
              className={cn(
                'h-9 gap-1.5 border-counselling-primary/40 px-3 text-counselling-primary hover:bg-counselling-accent/50 hover:text-counselling-primary',
                counsellingSessionTokens.actionBarLabel,
                counsellingSessionTokens.actionPill,
              )}
            >
              {isSavingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {counsellingCopy.saveDraft}
            </CounsellingButton>
          </CounsellingDisabledActionTooltip>
        ) : null}

        {showPrimary ? (
          <CounsellingDisabledActionTooltip reason={primaryTooltip}>
            <CounsellingButton
              type="button"
              size="sm"
              onClick={handlePrimary}
              disabled={primaryIsDisabled}
              data-testid={
                model.primary?.kind === 'save_session'
                  ? counsellingTestIds.btnSaveSession
                  : model.primary?.kind === 'phase_next'
                    ? counsellingTestIds.btnPhaseNext
                    : counsellingTestIds.actionBarPrimary
              }
              className={cn(
                'h-9 gap-1 bg-counselling-primary px-4 text-white hover:bg-counselling-primary/90',
                counsellingSessionTokens.actionBarLabel,
                counsellingSessionTokens.actionPill,
              )}
            >
              {revealWorkspaceOnly &&
              (model.primary?.kind === 'phase_next' || model.primary?.kind === 'navigate')
                ? 'Next'
                : model.primary?.label}
              {model.primary?.kind === 'phase_next' || model.primary?.kind === 'navigate' ? (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              ) : null}
              {(isSaving && model.primary?.kind === 'save_session') ||
              (input.submittingToClaims && model.primary?.kind === 'submit_claims') ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
            </CounsellingButton>
          </CounsellingDisabledActionTooltip>
        ) : null}
      </div>
    </footer>
  );
}
