import { describe, expect, it } from 'vitest';
import {
  PHASE6_BILLING_EVENTS,
  PHASE6_IP_DASHBOARD_EVENTS,
  ipRealtimeQueryKeys,
  screensRefreshedByEvents,
  shouldRefreshIpBilling,
  shouldRefreshIpDashboard,
  shouldRefreshWardBoard,
} from './ip-realtime-events';

describe('Phase 6 IP / Billing realtime', () => {
  it('subscribes the IP dashboard to every spec clinical event', () => {
    for (const type of PHASE6_IP_DASHBOARD_EVENTS) {
      expect(shouldRefreshIpDashboard(type)).toBe(true);
    }
  });

  it('subscribes billing to every spec financial event', () => {
    for (const type of PHASE6_BILLING_EVENTS) {
      expect(shouldRefreshIpBilling(type)).toBe(true);
    }
  });

  it('does not treat clinical events as billing books', () => {
    expect(shouldRefreshIpBilling('PatientAdmitted')).toBe(false);
    expect(shouldRefreshIpDashboard('Toast')).toBe(false);
  });

  it('converges IP list + billing after the five-user sequence (invalidate/refetch, not payload totals)', () => {
    const sequence = [
      'PatientAdmitted',      // User A admits
      'PatientSentToOT',      // User C sends to OT (User B already has IP list open)
      'PaymentReceived',      // User E records payment (User D has billing open)
    ];
    const screens = screensRefreshedByEvents(sequence);
    expect(screens.ipDashboard).toBe(true);
    expect(screens.billing).toBe(true);
  });

  it('refreshes the ward board on dashboard events and pre-op section hub types', () => {
    expect(shouldRefreshWardBoard('PatientAdmitted')).toBe(true);
    expect(shouldRefreshWardBoard('WardJourneyChanged')).toBe(true);
    expect(shouldRefreshWardBoard('PreOpSectionRequest')).toBe(true);
    expect(shouldRefreshWardBoard('SurgeryCancelledRebook')).toBe(true);
    expect(shouldRefreshWardBoard('Toast')).toBe(false);
    expect(ipRealtimeQueryKeys.wardBoard('b1')).toEqual(['ip-management', 'ward-board', 'b1']);
    expect(ipRealtimeQueryKeys.wardSummary('b1')).toEqual(['ip-management', 'ward-summary', 'b1']);
    expect(shouldRefreshIpDashboard('SlotChanged')).toBe(true);
    expect(ipRealtimeQueryKeys.slots('b1', '2026-08-25', 't1')).toEqual(
      ['ip-management', 'slots', 'b1', '2026-08-25', 't1'],
    );
  });
});
