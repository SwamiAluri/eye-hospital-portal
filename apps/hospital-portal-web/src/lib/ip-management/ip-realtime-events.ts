/** Shared NotificationHub types. Payloads are ignored; clients refetch APIs. */
export const IP_DASHBOARD_HUB_TYPES = new Set([
  'PatientAdmitted',
  'BedChanged',
  'PatientSentToOT',
  'PatientAcceptedInOT',
  'SurgeryStarted',
  'SurgeryCompleted',
  'PostOpUpdated',
  'PatientReadyForDischarge',
  'PatientDischarged',
  'PatientCancelled',
  'IpJourneyChanged',
  'WardJourneyChanged',
  'PreOpMarkReady',
  'JourneyReadyReverted',
  'PatientReceivedFromOt',
  'ClaimStatusChanged',
  'PaymentReceived',
  'PaymentReversed',
  'BillCreated',
  'BillFinalized',
  'RefundCreated',
  'PatientObligationChanged',
  'SlotChanged',
]);

export const IP_BILLING_HUB_TYPES = new Set([
  'PaymentReceived',
  'PaymentReversed',
  'BillCreated',
  'BillFinalized',
  'RefundCreated',
  'PatientObligationChanged',
  'ClaimStatusChanged',
]);

/** Quiet poll if the hub is down — same cadence as Ward. */
export const IP_REALTIME_POLL_MS = 45_000;

export const ipRealtimeQueryKeys = {
  journeysAll: ['ip-management', 'journeys'] as const,
  journeys: (branchId: string, filters: Record<string, string>) =>
    ['ip-management', 'journeys', branchId, filters] as const,
  transitionGatesAll: ['ip-management', 'transition-gates'] as const,
  transitionGates: (journeyId: string, newState: string) =>
    ['ip-management', 'transition-gates', journeyId, newState] as const,
  billingAll: ['ip-billing'] as const,
  billingDashboard: (branchId: string, preset: string, from: string, to: string) =>
    ['ip-billing', 'dashboard', branchId, preset, from, to] as const,
  wardBoardAll: ['ip-management', 'ward-board'] as const,
  wardBoard: (branchId: string) => ['ip-management', 'ward-board', branchId] as const,
  wardSummary: (branchId: string) => ['ip-management', 'ward-summary', branchId] as const,
  wardBedsAll: ['ip-management', 'ward-beds'] as const,
  wardBeds: (wardId: string) => ['ip-management', 'ward-beds', wardId] as const,
  slotsAll: ['ip-management', 'slots'] as const,
  slots: (branchId: string, date: string, theatreId: string) =>
    ['ip-management', 'slots', branchId, date, theatreId] as const,
  censusTabCounts: (branchId: string) => ['ip-management', 'census-tab-counts', branchId] as const,
};

/** Ward-only hub types not already on the IP dashboard set. */
export const WARD_EXTRA_HUB_TYPES = new Set([
  'SurgeryCancelledRebook',
  'PreOpSectionRequest',
  'PreOpSectionResponse',
  'PreOpSectionOnHold',
  'PreOpSectionRejected',
]);

export function shouldRefreshIpDashboard(type: string): boolean {
  return IP_DASHBOARD_HUB_TYPES.has(type);
}

export function shouldRefreshIpBilling(type: string): boolean {
  return IP_BILLING_HUB_TYPES.has(type);
}

export function shouldRefreshWardBoard(type: string): boolean {
  return shouldRefreshIpDashboard(type) || WARD_EXTRA_HUB_TYPES.has(type);
}

/** Spec Phase 6 §1 — IP dashboard must subscribe to these hub types. */
export const PHASE6_IP_DASHBOARD_EVENTS = [
  'PatientAdmitted',
  'BedChanged',
  'PatientSentToOT',
  'PatientAcceptedInOT',
  'SurgeryStarted',
  'SurgeryCompleted',
  'PostOpUpdated',
  'PatientReadyForDischarge',
  'PatientDischarged',
  'PatientCancelled',
] as const;

/** Spec Phase 6 §2 — Billing must invalidate on these hub types (no ledger in payload). */
export const PHASE6_BILLING_EVENTS = [
  'PaymentReceived',
  'PaymentReversed',
  'BillCreated',
  'BillFinalized',
  'RefundCreated',
  'PatientObligationChanged',
  'ClaimStatusChanged',
] as const;

/**
 * Multi-user convergence: each actor's event refreshes the screens that must
 * refetch APIs. Totals are never taken from the SignalR payload.
 */
export function screensRefreshedByEvents(events: readonly string[]): {
  ipDashboard: boolean;
  billing: boolean;
} {
  return {
    ipDashboard: events.some(shouldRefreshIpDashboard),
    billing: events.some(shouldRefreshIpBilling),
  };
}
