import { describe, expect, it } from 'vitest';
import {
  formatHubSchedule,
  formatPatientHubIdentityLine,
  pickPrimaryVisitEngagement,
} from '@/lib/patients/patient-hub-row-display';

describe('patient-hub-row-display', () => {
  it('formatPatientHubIdentityLine joins mrn age gender', () => {
    const line = formatPatientHubIdentityLine({
      mrn: 'MRN-001',
      dateOfBirth: '1990-01-15',
      gender: 'Male',
    });
    expect(line).toContain('MRN-001');
    expect(line).toContain('Male');
  });

  it('pickPrimaryVisitEngagement prefers IP then queue', () => {
    const ip = pickPrimaryVisitEngagement([
      { type: 'opd', label: 'OPD' },
      { type: 'ip', label: 'IP' },
    ]);
    expect(ip?.type).toBe('ip');

    const queue = pickPrimaryVisitEngagement([
      { type: 'opd', label: 'OPD' },
      { type: 'queue', label: 'Queue' },
    ]);
    expect(queue?.type).toBe('queue');
  });

  it('formatHubSchedule returns dash for empty', () => {
    expect(formatHubSchedule(null)).toBe('—');
  });
});
