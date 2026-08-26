import { describe, expect, it } from 'vitest';
import { chargeStatusBadgeClass } from './charge-status';

describe('chargeStatusBadgeClass', () => {
  it('marks unmapped as danger and missing as warning', () => {
    expect(chargeStatusBadgeClass('unmapped')).toMatch(/red/);
    expect(chargeStatusBadgeClass('missing_charges')).toMatch(/amber/);
    expect(chargeStatusBadgeClass('complete')).toMatch(/teal/);
  });
});
