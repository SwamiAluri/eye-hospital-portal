import { describe, expect, it } from 'vitest';
import {
  buildPatientHubFilterUrl,
  resolveOmniSearchHitPath,
} from '@/lib/patients/patient-omni-search-nav';
import type { PatientOmniSearchHit } from '@/types/patient-omni-search';

describe('patient-omni-search-nav', () => {
  it('buildPatientHubFilterUrl serializes hub filters', () => {
    const url = buildPatientHubFilterUrl({ programCodes: 'CATARACT', page: '1' });
    expect(url).toContain('/dashboard/patients?');
    expect(url).toContain('programCodes=CATARACT');
  });

  it('resolveOmniSearchHitPath routes patient profile hits', () => {
    const hit: PatientOmniSearchHit = {
      id: 'abc',
      title: 'Test',
      actionType: 'patient_profile',
      patientId: 'abc',
    };
    expect(resolveOmniSearchHitPath(hit)).toBe('/dashboard/patients/abc');
  });

  it('resolveOmniSearchHitPath routes hub filter hits', () => {
    const hit: PatientOmniSearchHit = {
      id: 'H25',
      title: 'Cataract',
      actionType: 'hub_filter',
      hubFilter: { diagnosis: 'H25' },
    };
    expect(resolveOmniSearchHitPath(hit)).toContain('diagnosis=H25');
  });
});
