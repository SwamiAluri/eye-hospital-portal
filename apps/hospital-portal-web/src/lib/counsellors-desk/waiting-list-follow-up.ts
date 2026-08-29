/**
 * Waiting List Repeat Counselling follow-up — mirrors counselling session SoT:
 * followUpDate ← DecisionDate, followUpReason ← ReasonsForDelay.
 * Do not invent a second follow-up model.
 */
export function mapRepeatCounsellingFollowUp(args: {
  status: string;
  decisionDate?: string | Date | null;
  reasonsForDelay?: string | null;
}): { followUpDate?: string; followUpReason?: string } {
  if (args.status !== 'RepeatCounselling') {
    return { followUpDate: undefined, followUpReason: undefined };
  }

  let followUpDate: string | undefined;
  if (args.decisionDate) {
    const raw =
      typeof args.decisionDate === 'string'
        ? args.decisionDate
        : args.decisionDate.toISOString();
    followUpDate = raw.split('T')[0] || undefined;
  }

  const reason = args.reasonsForDelay?.trim();
  return {
    followUpDate,
    followUpReason: reason || undefined,
  };
}
