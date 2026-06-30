import { describe, expect, it } from 'vitest';

import { resolveCoverageSessionFinalPayable } from '@/lib/counsellors-desk/build-coverage-preview';

describe('resolveCoverageSessionFinalPayable', () => {
  it('prefers saved total when live estimate has no procedure line', () => {
    expect(
      resolveCoverageSessionFinalPayable({
        liveFinalPayable: 2700,
        savedFinalPayable: 138100,
        estimateLines: [
          { key: 'inv-1', label: 'OCT', amount: 1500, kind: 'investigation' },
          { key: 'inv-2', label: 'B-Scan', amount: 1200, kind: 'investigation' },
        ],
      }),
    ).toBe(138100);
  });

  it('uses live total when procedure line is present', () => {
    expect(
      resolveCoverageSessionFinalPayable({
        liveFinalPayable: 138100,
        savedFinalPayable: 120000,
        estimateLines: [
          { key: 'procedure', label: 'ICL', amount: 135000, kind: 'procedure' },
          { key: 'inv-1', label: 'OCT', amount: 3100, kind: 'investigation' },
        ],
      }),
    ).toBe(138100);
  });

  it('falls back to saved when live is zero', () => {
    expect(
      resolveCoverageSessionFinalPayable({
        liveFinalPayable: 0,
        savedFinalPayable: 50000,
        estimateLines: [],
      }),
    ).toBe(50000);
  });
});
