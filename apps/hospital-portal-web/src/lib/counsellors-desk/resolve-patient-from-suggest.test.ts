import { describe, expect, it } from 'vitest';
import {
  normalizePatientIdentifier,
  resolvePatientFromSuggestHits,
} from './resolve-patient-from-suggest';

describe('normalizePatientIdentifier', () => {
  it('strips spaces and dashes and lowercases', () => {
    expect(normalizePatientIdentifier(' UH-12 34 ')).toBe('uh1234');
  });
});

describe('resolvePatientFromSuggestHits', () => {
  const hits = [
    {
      id: 'p1',
      firstName: 'Meena',
      lastName: 'Iyer',
      mrn: 'MRN-100',
      healthId: 'UH-1001',
    },
    {
      id: 'p2',
      firstName: 'Ravi',
      lastName: 'Kumar',
      mrn: 'MRN-200',
      healthId: null,
    },
  ];

  it('matches HealthId / UHID exactly (normalized)', () => {
    const r = resolvePatientFromSuggestHits(hits, 'uh-1001');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patient.id).toBe('p1');
      expect(r.displayName).toBe('Meena Iyer');
      expect(r.displayUhid).toBe('UH-1001');
    }
  });

  it('matches MRN exactly', () => {
    const r = resolvePatientFromSuggestHits(hits, 'MRN-200');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patient.id).toBe('p2');
  });

  it('accepts unique prefix hit when only one candidate matches identifier', () => {
    const r = resolvePatientFromSuggestHits(hits, 'UH-100');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patient.id).toBe('p1');
  });

  it('fails when nothing matches', () => {
    const r = resolvePatientFromSuggestHits(hits, 'NOPE');
    expect(r.ok).toBe(false);
  });
});
