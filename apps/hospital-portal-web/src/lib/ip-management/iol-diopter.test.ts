import { describe, expect, it } from 'vitest';
import {
  describeIolMismatch,
  formatIolDiopter,
  iolDioptersDiffer,
  parseIolDiopter,
  plannedIolDiffers,
  biometryMissingEyePhrase,
} from './iol-diopter';

describe('parseIolDiopter', () => {
  it('treats 21 and 21.00 as the same two-decimal value', () => {
    expect(parseIolDiopter('21')).toBe(21);
    expect(parseIolDiopter('+21.00 D')).toBe(21);
    expect(iolDioptersDiffer(parseIolDiopter('21')!, 21.00)).toBe(false);
  });

  it('does not treat a 0.50 D catalog step as a match', () => {
    expect(iolDioptersDiffer(21.00, 21.50)).toBe(true);
  });

  it('returns null for empty planned power', () => {
    expect(parseIolDiopter('')).toBeNull();
    expect(parseIolDiopter('n/a')).toBeNull();
  });

  it('formats with sign and unit', () => {
    expect(formatIolDiopter(21)).toBe('+21.00 D');
    expect(formatIolDiopter(-1.5)).toBe('-1.50 D');
  });

  it('plannedIolDiffers when biometry and journey disagree', () => {
    expect(plannedIolDiffers('+21.00 D', '+21.00 D')).toBe(false);
    expect(plannedIolDiffers('+21.00 D', '+19.50 D')).toBe(true);
    expect(plannedIolDiffers('+21.00 D', null)).toBe(true);
    expect(plannedIolDiffers(null, null)).toBe(false);
  });

  it('names the operating eye for empty biometry copy', () => {
    expect(biometryMissingEyePhrase('RE')).toBe('right eye');
    expect(biometryMissingEyePhrase('OS')).toBe('left eye');
    expect(biometryMissingEyePhrase('BE')).toBe('both eyes');
  });
});

describe('describeIolMismatch', () => {
  it('blocks 21.00 vs 21.50', () => {
    const r = describeIolMismatch({
      plannedPower: 21,
      scannedPower: 21.5,
      implanted: true,
    });
    expect(r.blocked).toBe(true);
    expect(r.message).toContain('+21.50 D');
    expect(r.message).toContain('+21.00 D');
  });

  it('blocks model mismatch independently of power', () => {
    const r = describeIolMismatch({
      plannedPower: 21,
      scannedPower: 21,
      plannedModel: 'SN60WF',
      scannedModel: 'SN6AD1',
      implanted: true,
    });
    expect(r.blocked).toBe(true);
    expect(r.message).toContain('SN6AD1');
    expect(r.message).toContain('SN60WF');
  });

  it('does not treat empty planned power as a block', () => {
    const r = describeIolMismatch({
      plannedPower: null,
      scannedPower: 21,
      implanted: true,
    });
    expect(r.blocked).toBe(false);
    expect(r.powerRequired).toBe(false);
  });
});
