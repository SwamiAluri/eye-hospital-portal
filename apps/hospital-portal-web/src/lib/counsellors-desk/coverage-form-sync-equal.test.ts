import { describe, expect, it } from 'vitest';
import {
  coverageFormsSyncEqual,
} from '@/lib/counsellors-desk/coverage-form-sync-equal';
import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';

describe('coverageFormsSyncEqual', () => {
  it('treats identical sync fields as equal even when object identity differs', () => {
    const a: CoveragePanelForm = {
      insurerName: 'United India Insurance',
      paymentType: 'Insurance',
      estimatedAmount: 12000,
      clinicalNotes: 'Procedure: Phaco',
    };
    const b: CoveragePanelForm = { ...a };
    expect(a).not.toBe(b);
    expect(coverageFormsSyncEqual(a, b)).toBe(true);
  });

  it('detects meaningful counselling sync field changes', () => {
    const a: CoveragePanelForm = { estimatedAmount: 1000 };
    const b: CoveragePanelForm = { estimatedAmount: 2000 };
    expect(coverageFormsSyncEqual(a, b)).toBe(false);
  });
});
