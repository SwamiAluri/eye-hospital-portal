import { describe, expect, it } from 'vitest';
import { ipBillingHref, ipJourneyHref, ipCollectBillHref, ipOtHref, ipWardHref } from './ip-rail-links';

describe('ip-rail-links', () => {
  it('opens IP billing (S-11) from the census rail, not OPD billing', () => {
    expect(ipBillingHref({ id: 'j1', patientId: 'p1' }, 'bill-9')).toBe(
      '/dashboard/ip-management/billing?journeyId=j1&patientId=p1&billId=bill-9',
    );
  });

  it('keeps cashier collect on the OPD bill', () => {
    expect(ipCollectBillHref('bill-9')).toBe('/dashboard/billing/opd?billId=bill-9');
  });

  it('deep-links ward intents and OT board', () => {
    expect(ipWardHref('j1', 'transfer')).toBe('/dashboard/ip-management/ward?patient=j1&intent=transfer');
    expect(ipWardHref('j1', 'postop')).toBe('/dashboard/ip-management/ward?patient=j1&intent=postop');
    expect(ipOtHref('j1')).toBe('/dashboard/ip-management/operation-theatre?patient=j1');
    expect(ipJourneyHref('j1', 'discharge')).toBe('/dashboard/ip-management/journey/j1?tab=discharge');
  });
});
