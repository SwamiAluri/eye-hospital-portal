import { ipJourneyHref } from '@/lib/ip-management/ip-rail-links';

export type OtReturnedAction =
  | { kind: 'replan'; label: 'Re-plan'; href: string }
  | { kind: 'open-journey'; label: 'Open journey'; href: string };

/**
 * OT Returned Action: prefer linked counselling session (Re-plan);
 * otherwise open the IP journey — never invent a session.
 */
export function resolveOtReturnedAction(input: {
  journeyId: string;
  counselingSessionId: string | null | undefined;
}): OtReturnedAction {
  const sessionId = input.counselingSessionId?.trim();
  if (sessionId) {
    return {
      kind: 'replan',
      label: 'Re-plan',
      href: `/dashboard/counsellors-desk/${sessionId}?from=waiting-list`,
    };
  }
  return {
    kind: 'open-journey',
    label: 'Open journey',
    href: ipJourneyHref(input.journeyId),
  };
}
