import { describe, expect, it } from 'vitest';
import { buildCoverageEstimateSnapshot } from '@/lib/counsellors-desk/coverage-estimate-sync';

describe('coverage estimate mirror data', () => {
  it('uses counselling snapshot amounts without duplicate calculation', () => {
    const ctx = {
      procedureName: '20g PPV With Suture',
      procedureCode: 'PPV20',
      procedureAmount: 65000,
      finalPayable: 70650,
      estimateMode: 'custom' as const,
      investigationLines: [{ name: 'Corneal Topography', amount: 2000, category: 'imaging' as const }],
      investigationTotal: 2000,
    };
    const snapshot = buildCoverageEstimateSnapshot(ctx);
    expect(snapshot.estimatedAmount).toBe(70650);
    expect(snapshot.lineItems.length).toBeGreaterThan(0);
    expect(snapshot.surgeryProcedure).toBe('20g PPV With Suture');
  });
});
