import { describe, expect, it } from 'vitest';
import {
  isCensusInHouse,
  matchesAdmittedCensusFilter,
  matchesCensusSearch,
} from './ip-census-filters';

describe('matchesAdmittedCensusFilter', () => {
  it('keeps in-house patients when the range is today and they were admitted earlier', () => {
    expect(isCensusInHouse('Admitted')).toBe(true);
    expect(matchesAdmittedCensusFilter(
      { clinicalState: 'Admitted', admittedAt: '2026-08-24T10:58:00Z' },
      '2026-08-25',
      '2026-08-25',
    )).toBe(true);
  });

  it('hides discharged patients admitted outside the range', () => {
    expect(matchesAdmittedCensusFilter(
      { clinicalState: 'Discharged', admittedAt: '2026-08-20T10:00:00Z' },
      '2026-08-25',
      '2026-08-25',
    )).toBe(false);
  });

  it('keeps discharged patients admitted in the From–To range', () => {
    expect(matchesAdmittedCensusFilter(
      { clinicalState: 'Discharged', admittedAt: '2026-08-25T08:00:00Z' },
      '2026-08-25',
      '2026-08-25',
    )).toBe(true);
  });
});

describe('matchesCensusSearch', () => {
  it('matches procedure and bed, not only name', () => {
    const row = {
      uhid: 'UAT-014',
      patientName: 'Ananya',
      procedureName: 'Corneal Procedure',
      wardName: 'Day Care Ward',
      bedNumber: 'B01',
    };
    expect(matchesCensusSearch(row, '', 'corneal')).toBe(true);
    expect(matchesCensusSearch(row, '', 'b01')).toBe(true);
    expect(matchesCensusSearch(row, 'UAT-014', '')).toBe(true);
    expect(matchesCensusSearch(row, 'NOPE', '')).toBe(false);
  });
});
