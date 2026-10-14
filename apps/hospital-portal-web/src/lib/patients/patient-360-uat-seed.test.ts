import { describe, expect, it } from 'vitest';
import {
  PATIENT_360_UAT_SEED,
  isPatient360UatSeedRecord,
} from '@/lib/patients/patient-360-uat-seed';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('patient 360 UAT seed fixture', () => {
  it('is a deterministic development-only identity', () => {
    expect(PATIENT_360_UAT_SEED.firstName).toBe('UAT360');
    expect(PATIENT_360_UAT_SEED.lastName).toBe('Longitudinal');
    expect(PATIENT_360_UAT_SEED.email).toContain('@example.test');
    expect(isPatient360UatSeedRecord({
      firstName: PATIENT_360_UAT_SEED.firstName,
      lastName: PATIENT_360_UAT_SEED.lastName,
      email: PATIENT_360_UAT_SEED.email,
      phone: PATIENT_360_UAT_SEED.contactNumber,
    })).toBe(true);
    expect(isPatient360UatSeedRecord({ firstName: 'UAT360', lastName: 'Other', email: PATIENT_360_UAT_SEED.email })).toBe(false);
    const script = readFileSync(resolve(__dirname, '../../../scripts/seed-patient-360-uat.ts'), 'utf8');
    expect(script).toContain('development-only');
    expect(script).toContain('idempotent');
    expect(script).toContain('NODE_ENV');
    expect(script).toContain('seedDomains');
    expect(script).not.toContain('UPDATE patients SET');
    expect(script).not.toContain('patient_events');
  });
});
