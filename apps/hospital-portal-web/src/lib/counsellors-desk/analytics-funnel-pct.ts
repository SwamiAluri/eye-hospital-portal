/**
 * Phase 2Z PD13 — funnel percentage rules.
 * Eligible = Total - Exception - Other/Unclassified.
 * Agreed / Declined / PendingDecision % use Eligible only.
 * Exception and Other remain count-visible and are excluded from eligible-outcome %.
 */

export type FunnelPctStage =
  | 'total'
  | 'agreedCount'
  | 'declinedCount'
  | 'pendingDecisionCount'
  | 'exceptionCount'
  | 'otherUnclassifiedCount';

export type FunnelPctResult = {
  pct: number | null;
  denominatorLabel: string;
  /** When false, UI must not show a misleading Eligible percentage. */
  showEligiblePct: boolean;
};

export function funnelStagePercentage(
  stage: FunnelPctStage,
  count: number,
  totalSessions: number,
  eligibleOutcomeSessions: number,
): FunnelPctResult {
  if (stage === 'total') {
    return {
      pct: 100,
      denominatorLabel: 'total sessions',
      showEligiblePct: true,
    };
  }

  if (stage === 'exceptionCount' || stage === 'otherUnclassifiedCount') {
    return {
      pct: null,
      denominatorLabel: 'total sessions (excluded from eligible %)',
      showEligiblePct: false,
    };
  }

  if (eligibleOutcomeSessions <= 0) {
    return {
      pct: 0,
      denominatorLabel: 'eligible outcome sessions',
      showEligiblePct: true,
    };
  }

  return {
    pct: Math.round((count / eligibleOutcomeSessions) * 100),
    denominatorLabel: 'eligible outcome sessions',
    showEligiblePct: true,
  };
}
