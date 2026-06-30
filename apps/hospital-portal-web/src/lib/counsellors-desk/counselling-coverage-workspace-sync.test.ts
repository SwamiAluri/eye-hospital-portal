import { describe, expect, it } from 'vitest';
import {
  counsellingSyncPatchesEqual,
  extractCounsellingSyncFromCoverageForm,
} from './counselling-coverage-workspace-sync';

const providers = [
  { value: 'p1', label: 'Star Health' },
  { value: 'p2', label: 'HDFC ERGO' },
];

describe('counselling-coverage-workspace-sync', () => {
  it('extracts insurer from provider id when name is missing', () => {
    const patch = extractCounsellingSyncFromCoverageForm(
      { insuranceProviderId: 'p2' },
      providers,
    );
    expect(patch.insuranceProviderId).toBe('p2');
    expect(patch.insuranceCompany).toBe('HDFC ERGO');
  });

  it('prefers explicit insurer name over provider lookup', () => {
    const patch = extractCounsellingSyncFromCoverageForm(
      { insurerName: 'Custom TPA', insuranceProviderId: 'p1' },
      providers,
    );
    expect(patch.insuranceCompany).toBe('Custom TPA');
  });

  it('detects patch equality for loop prevention', () => {
    expect(
      counsellingSyncPatchesEqual(
        { insuranceCompany: 'A', estimatedAmount: 1000 },
        { insuranceCompany: 'A', estimatedAmount: 1000 },
      ),
    ).toBe(true);
    expect(
      counsellingSyncPatchesEqual(
        { insuranceCompany: 'A' },
        { insuranceCompany: 'B' },
      ),
    ).toBe(false);
  });
});
