import { describe, expect, it } from 'vitest';
import { getPreOpStep, PREOP_STEPS } from './preop-steps';

describe('preop-steps Phase 1 coverage terminology', () => {
  it('renames the financial step to Coverage & Payment Status', () => {
    const step = getPreOpStep('financial');
    expect(step.label).toBe('Coverage & Payment Status');
    expect(step.short).toBe('Coverage');
  });

  it('keeps the financial step key stable for routing and readiness', () => {
    expect(PREOP_STEPS.some(s => s.key === 'financial')).toBe(true);
  });
});
