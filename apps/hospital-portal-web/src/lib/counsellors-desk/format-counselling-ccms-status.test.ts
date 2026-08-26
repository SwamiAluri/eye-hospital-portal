import { describe, expect, it } from 'vitest';
import { formatCounsellingCcmsStatus } from './format-counselling-ccms-status';

describe('formatCounsellingCcmsStatus', () => {
  it('surfaces backend decision and block reason without remapping', () => {
    expect(
      formatCounsellingCcmsStatus({
        allowed: false,
        decision: 'BLOCK',
        coverageState: 'WAITING_APPROVAL',
        blockReason: 'Pre-authorization is awaiting TPA approval.',
      }),
    ).toBe('WAITING_APPROVAL · BLOCK · Pre-authorization is awaiting TPA approval.');
  });
});
