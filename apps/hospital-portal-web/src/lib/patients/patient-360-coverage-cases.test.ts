import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCoverageCasesByPatient = vi.fn();

vi.mock('@/lib/api/ccms/ccms-coverage-cases.api', () => ({
  getCoverageCasesByPatient: (...args: unknown[]) => getCoverageCasesByPatient(...args),
}));

import {
  classifyCoverageCaseError,
  coverageCaseEmptyMessage,
  coverageCaseUnauthorizedMessage,
  coverageCaseUnavailableMessage,
  loadPatient360CoverageCases,
  mapCoverageCase,
} from '@/lib/patients/patient-360-coverage-cases';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 coverage case read', () => {
  beforeEach(() => {
    getCoverageCasesByPatient.mockReset();
  });

  it('maps stored coverage case fields and ignores unrelated payload keys', () => {
    const row = mapCoverageCase({
      id: 'c1',
      caseNumber: 'CCMS-1',
      currentState: 'DRAFT',
      payerType: 'insurance',
      insurerName: 'Apex',
      paymentType: 'Insurance',
      preAuthNumber: 'PA-1',
      approvedAmount: 1500,
      counsellorDraftJson: '{"estimatedAmount":99}',
      estimatedAmount: 99,
      patientPayableAmount: 1500,
    });
    expect(row).toEqual({
      id: 'c1',
      caseNumber: 'CCMS-1',
      currentState: 'DRAFT',
      payerType: 'insurance',
      insurerName: 'Apex',
      paymentType: 'Insurance',
      preAuthNumber: 'PA-1',
      approvedAmount: '₹1500.00',
    });
  });

  it('loads the patient UUID and treats an empty cases array as no cases', async () => {
    getCoverageCasesByPatient.mockResolvedValue({ cases: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    const result = await loadPatient360CoverageCases(patientId);
    expect(getCoverageCasesByPatient).toHaveBeenCalledWith(patientId, 1, 20);
    expect(result).toEqual({ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    expect(coverageCaseEmptyMessage()).toBe('No coverage cases recorded.');
  });

  it('requests the next coverage-case page and keeps the server total', async () => {
    getCoverageCasesByPatient.mockResolvedValue({
      cases: [{ id: 'c2', caseNumber: 'CC-2', currentState: 'DRAFT', payerType: 'insurance' }],
      totalCount: 21,
      pageNumber: 2,
      pageSize: 20,
    });
    const result = await loadPatient360CoverageCases(patientId, 2);
    expect(getCoverageCasesByPatient).toHaveBeenCalledWith(patientId, 2, 20);
    expect(result.state).toBe('ready');
    expect(result.rows).toHaveLength(1);
    expect(result.totalCount).toBe(21);
    expect(result.pageNumber).toBe(2);
    expect(result.pageSize).toBe(20);
  });

  it('does not treat a missing cases array or an HTTP failure as no cases', async () => {
    getCoverageCasesByPatient.mockResolvedValueOnce({ totalCount: 0 });
    await expect(loadPatient360CoverageCases(patientId)).resolves.toEqual({ state: 'unavailable', rows: [] });

    expect(classifyCoverageCaseError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifyCoverageCaseError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyCoverageCaseError({ response: { status: 404 } })).toBe('unavailable');
    expect(classifyCoverageCaseError({ response: { status: 500 } })).toBe('unavailable');
    expect(coverageCaseUnauthorizedMessage()).not.toMatch(/No coverage cases/i);
    expect(coverageCaseUnavailableMessage()).toBe('Coverage information is unavailable.');
    expect(coverageCaseUnavailableMessage()).not.toMatch(/No coverage cases/i);
  });
});

describe('patient 360 coverage case presentation boundary', () => {
  it('does not add coverage-case mutations or treat the case as an insurance profile', () => {
    const root = resolve(__dirname, '../..');
    const panel = readFileSync(resolve(root, 'components/patients/record/Patient360Coverage.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-coverage-cases.ts'), 'utf8');
    const nav = readFileSync(resolve(root, 'lib/patients/patient-360-sections.ts'), 'utf8');
    expect(panel).toContain('Source: CCMS Coverage Cases');
    expect(panel).toContain('Source: Patient Insurance Profile');
    expect(panel).toContain('Source: OPD bills');
    expect(reads).toContain('getCoverageCasesByPatient');
    expect(reads).not.toMatch(/workspace|createCoverageCase|updateCoverageCase|submitToClaimsTeam|recordEligibility/i);
    expect(panel).not.toMatch(/<button|Create Coverage|submit-to-claims|Verify Eligibility/i);
    expect(nav).toContain("{ key: 'coverage', label: 'Coverage', unwired: false }");
    expect(nav).not.toMatch(/key: 'claims'|key: 'insurance'/);
  });
});
