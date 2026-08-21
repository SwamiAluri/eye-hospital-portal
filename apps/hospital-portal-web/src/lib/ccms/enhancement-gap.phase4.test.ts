import { describe, expect, it } from 'vitest';

/**
 * Mirrors CCMS EnhancementService.EvaluateGap (Phase 4 C) for FE/guardrail tests.
 */
function evaluateGap(
  approvedCoverageAmount: number,
  eligibleAmount: number,
  hasOpenEnhancement: boolean,
) {
  const gap = eligibleAmount - approvedCoverageAmount;
  const needs = gap > 0.01;
  const recommendation = !needs
    ? 'none'
    : hasOpenEnhancement
      ? 'await_open_enhancement'
      : 'request_enhancement';
  return { needsEnhancement: needs, gapAmount: needs ? gap : 0, recommendation };
}

describe('coverage enhancement gap policy (Phase 4 C)', () => {
  it('recommends request when eligible exceeds approved and no open enhancement', () => {
    const r = evaluateGap(10_000, 15_000, false);
    expect(r.needsEnhancement).toBe(true);
    expect(r.gapAmount).toBe(5_000);
    expect(r.recommendation).toBe('request_enhancement');
  });

  it('awaits when an open enhancement already exists', () => {
    expect(evaluateGap(10_000, 15_000, true).recommendation).toBe('await_open_enhancement');
  });

  it('is quiet when coverage covers eligible amount', () => {
    const r = evaluateGap(20_000, 15_000, false);
    expect(r.needsEnhancement).toBe(false);
    expect(r.recommendation).toBe('none');
  });
});
