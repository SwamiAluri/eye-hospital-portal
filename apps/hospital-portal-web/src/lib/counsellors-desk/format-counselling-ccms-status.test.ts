import { describe, expect, it } from 'vitest';
import { formatCounsellingCcmsStatus } from './format-counselling-ccms-status';

describe('formatCounsellingCcmsStatus', () => {
  it('uses Waiting for TPA when coverage is with TPA even if admission is BLOCK', () => {
    expect(
      formatCounsellingCcmsStatus({
        allowed: false,
        decision: 'BLOCK',
        coverageState: 'WAITING_APPROVAL',
        blockReason: 'Pre-authorization is awaiting TPA approval.',
      }),
    ).toBe('Waiting for TPA');
  });

  it('uses Authorization Required for blocked draft', () => {
    expect(
      formatCounsellingCcmsStatus({
        allowed: false,
        decision: 'BLOCK',
        coverageState: 'DRAFT',
        blockReason: 'Coverage authorization is not ready',
      }),
    ).toBe('Authorization Required');
  });
});
