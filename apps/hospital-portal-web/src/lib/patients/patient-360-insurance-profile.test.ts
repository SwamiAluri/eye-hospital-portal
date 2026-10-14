import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';

const getByPatient = vi.fn();

vi.mock('@/lib/api/patient-insurance.api', () => ({
  patientInsuranceApi: {
    getByPatient: (...args: unknown[]) => getByPatient(...args),
  },
}));

import {
  classifyInsuranceProfileError,
  insuranceProfileEmptyMessage,
  insuranceProfileUnauthorizedMessage,
  insuranceProfileUnavailableMessage,
  loadPatient360InsuranceProfiles,
  mapInsuranceProfile,
} from '@/lib/patients/patient-360-insurance-profile';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 insurance profile read', () => {
  beforeEach(() => {
    getByPatient.mockReset();
  });

  it('maps the patient-insurance row, including policy money and deletedAt, without a computed balance', () => {
    const row = mapInsuranceProfile({
      id: 'p1',
      providerName: 'Apex Health',
      policyNumber: 'POL-1',
      groupNumber: 'G-9',
      policyType: 'primary',
      planName: 'Eye Shield',
      subscriberName: 'Ada',
      subscriberId: 'MEM-4',
      subscriberRelation: 'self',
      startDate: '2026-01-01T00:00:00',
      endDate: '2026-12-31T00:00:00',
      status: 'active',
      copayAmount: 200,
      deductibleAmount: 1000,
      deductibleMet: 250,
      outOfPocketMax: 5000,
      outOfPocketMet: 250,
      deletedAt: null,
      preAuthNumber: 'PA-9',
      insuranceProvider: 'Registration Payer',
      insurancePolicyNumber: 'REG-1',
    });

    expect(row).toMatchObject({
      id: 'p1',
      providerName: 'Apex Health',
      policyNumber: 'POL-1',
      groupNumber: 'G-9',
      policyType: 'primary',
      status: 'active',
      copayAmount: '200',
      deductibleAmount: '1000',
      deductibleMet: '250',
      outOfPocketMax: '5000',
      outOfPocketMet: '250',
      deletedAt: null,
    });
    expect(row).not.toHaveProperty('preAuthNumber');
    expect(row).not.toHaveProperty('balance');
    expect(row).not.toHaveProperty('insuranceProvider');
  });

  it('keeps a deleted row and its stored status instead of dropping it', () => {
    const row = mapInsuranceProfile({
      id: 'p2',
      providerName: 'Apex Health',
      status: 'active',
      deletedAt: '2026-03-01T00:00:00Z',
    });
    expect(row?.status).toBe('active');
    expect(row?.deletedAt).toBe('2026-03-01');
  });

  it('calls getByPatient with the patient UUID and treats an empty array as no profile', async () => {
    getByPatient.mockResolvedValue({ data: [] });
    const result = await loadPatient360InsuranceProfiles(patientId);
    expect(getByPatient).toHaveBeenCalledWith(patientId);
    expect(result).toEqual({ state: 'ready', rows: [] });
    expect(insuranceProfileEmptyMessage()).toBe('No insurance profile recorded.');
  });

  it('keeps 401, 403, 404, and 500 distinct from an empty profile', () => {
    expect(classifyInsuranceProfileError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifyInsuranceProfileError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyInsuranceProfileError({ response: { status: 404 } })).toBe('unavailable');
    expect(classifyInsuranceProfileError({ response: { status: 500 } })).toBe('unavailable');
    expect(insuranceProfileUnauthorizedMessage()).not.toMatch(/No insurance profile/i);
    expect(insuranceProfileUnavailableMessage()).toBe('Insurance profile is not available in Patient 360.');
    expect(insuranceProfileUnavailableMessage()).not.toMatch(/No insurance|No coverage/i);
  });
});

describe('patient 360 insurance profile boundaries', () => {
  it('reads only the patient-insurance GET inside Coverage and leaves InsuranceTab mutations alone', () => {
    const root = resolve(__dirname, '../..');
    const page = readFileSync(resolve(root, 'components/patients/record/PatientRecordPage.tsx'), 'utf8');
    const panel = readFileSync(resolve(root, 'components/patients/record/Patient360Coverage.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-insurance-profile.ts'), 'utf8');
    const insuranceTab = readFileSync(resolve(root, 'components/patients/tabs/InsuranceTab.tsx'), 'utf8');
    const joined = `${panel}\n${reads}`;

    expect(PATIENT_360_SECTIONS.map((section) => section.key)).toEqual([
      'overview',
      'clinical',
      'care',
      'documents',
      'coverage',
      'administration',
      'timeline',
    ]);
    expect(page).toContain("section === 'coverage'");
    expect(page).toContain('Patient360CoveragePanel');
    expect(reads).toContain('patientInsuranceApi.getByPatient');
    expect(reads.match(/patientInsuranceApi\.getByPatient/g)).toHaveLength(1);
    expect(joined).not.toMatch(/patientInsuranceApi\.(verify|create|update|delete)/);
    expect(reads).not.toMatch(/opdBillsApi|ccms|pre-auth|preauth|insuranceProvider|insurancePolicyNumber/i);
    const financial = readFileSync(resolve(root, 'lib/patients/patient-360-financial.ts'), 'utf8');
    expect(insuranceTab).toContain('patientInsuranceApi.verify');
    expect(panel).not.toContain("notIntegratedMessage('Financial')");
    expect(panel).toContain('loadPatient360Bills');
    expect(panel).toContain('loadPatient360CoverageCases');
    expect(panel).toContain('Source: CCMS Coverage Cases');
    expect(panel).toContain('Source: Patient Insurance Profile');
    expect(panel).not.toContain('Coverage cases are not available in Patient 360.');
    expect(financial).toContain('opdBillsApi.getByPatient');
    expect(financial).not.toMatch(/addPayment|opdBillsApi\.create|opdBillsApi\.update|opdBillsApi\.cancel/);
    expect(panel).not.toMatch(/Verify|Add Insurance|Amount due|Outstanding|Patient balance/i);
  });
});
