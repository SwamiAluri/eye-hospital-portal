import { describe, expect, it } from 'vitest';
import { LATERALITY_MISSING_BLOCKER, operativeEyeDisplay } from './operative-eye-display';

describe('operativeEyeDisplay', () => {
  it('spells out RIGHT / LEFT / BOTH above the abbreviation', () => {
    expect(operativeEyeDisplay('OD')).toEqual({ kind: 'eye', code: 'OD', word: 'RIGHT' });
    expect(operativeEyeDisplay('left eye')).toEqual({ kind: 'eye', code: 'OS', word: 'LEFT' });
    expect(operativeEyeDisplay('OU')).toEqual({ kind: 'eye', code: 'OU', word: 'BOTH' });
  });

  it('renders a laterality blocker rather than an empty slot when the operating eye is null', () => {
    expect(operativeEyeDisplay(null)).toEqual({
      kind: 'missing',
      message: LATERALITY_MISSING_BLOCKER,
    });
    expect(operativeEyeDisplay('')).toEqual({
      kind: 'missing',
      message: LATERALITY_MISSING_BLOCKER,
    });
    expect(operativeEyeDisplay(undefined)).toEqual({
      kind: 'missing',
      message: LATERALITY_MISSING_BLOCKER,
    });
  });
});
