import { describe, expect, it } from 'vitest';
import {
  censusAgeSex,
  censusClinicalChip,
  censusProcedureLine,
  formatCensusAdmitted,
  formatCensusSlot,
  tidyClinicalText,
} from './ip-census-display';

describe('tidyClinicalText', () => {
  it('replaces mojibake em dashes in procedure names', () => {
    expect(tidyClinicalText('25g PPV â€ Sutureless OD')).toBe('25g PPV — Sutureless OD');
  });
});

describe('formatCensusSlot', () => {
  it('labels missing slots instead of a bare dash', () => {
    expect(formatCensusSlot(null)).toEqual({ text: 'Unassigned', unassigned: true });
    expect(formatCensusSlot('AM-3')).toEqual({ text: 'AM-3', unassigned: false });
  });
});

describe('formatCensusAdmitted', () => {
  it('returns an em dash when admission time is missing', () => {
    expect(formatCensusAdmitted(null)).toBe('—');
  });
});

describe('censusClinicalChip', () => {
  it('maps IP clinical states onto StatusChip vocabulary with labels', () => {
    expect(censusClinicalChip('Admitted')).toEqual({ status: 'in-progress', label: 'Admitted' });
    expect(censusClinicalChip('CancelledSurgery').status).toBe('rejected');
    expect(censusClinicalChip('InOT').label).toBe('In OT');
  });
});

describe('censusProcedureLine', () => {
  it('spells laterality as word plus code and flags missing eye', () => {
    expect(censusProcedureLine('LASIK', 'OD')).toEqual({
      procedure: 'LASIK',
      laterality: 'RIGHT OD',
      lateralityMissing: false,
    });
    expect(censusProcedureLine('Phaco', null).lateralityMissing).toBe(true);
  });
});

describe('censusAgeSex', () => {
  it('joins age and sex without inventing a value', () => {
    expect(censusAgeSex(null, 54, 'F')).toBe('54y · F');
  });
});
