import { describe, expect, it } from 'vitest';
import { preOpPayerChipLabel } from './preop-payer-chip';

describe('preOpPayerChipLabel', () => {
  it('does not fall back to financialState values', () => {
    expect(preOpPayerChipLabel(null)).toBe('Self-pay');
    expect(preOpPayerChipLabel('')).toBe('Self-pay');
    expect(preOpPayerChipLabel('Cash')).toBe('Self-pay');
    expect(preOpPayerChipLabel('Insurance')).toBe('Insurance');
    expect(preOpPayerChipLabel('Star Health')).toBe('Star Health');
  });
});
