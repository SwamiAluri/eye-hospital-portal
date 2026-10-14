import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getEligibilityChecksByPatient = vi.fn();

vi.mock('@/lib/api/ccms/ccms-eligibility.api', () => ({
  getEligibilityChecksByPatient: (...args: unknown[]) => getEligibilityChecksByPatient(...args),
}));

import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';
import {
  classifyEligibilityError,
  eligibilityEmptyMessage,
  eligibilityUnauthorizedMessage,
  eligibilityUnavailableMessage,
  loadPatient360Eligibility,
  mapEligibilityCheck,
} from '@/lib/patients/patient-360-eligibility';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 eligibility read', () => {
  beforeEach(() => {
    getEligibilityChecksByPatient.mockReset();
  });

  it('maps stored eligibility fields and does not derive a percentage or balance', () => {
    const row = mapEligibilityCheck({
      id: 'e1',
      policyNumber: 'POL-1',
      membershipId: 'MEM-1',
      checkMethod: 'manual',
      responseCode: 'manual_entry',
      isEligible: true,
      checkedAt: '2026-09-01T10:00:00Z',
      eligibilityResponseJson: '{"notes":"hidden"}',
      tenantId: '22222222-2222-2222-2222-222222222222',
    });
    expect(row).toEqual({
      id: 'e1',
      policyNumber: 'POL-1',
      membershipId: 'MEM-1',
      checkMethod: 'manual',
      responseCode: 'manual_entry',
      eligible: 'Eligible',
      checkedAt: '2026-09-01',
    });
    expect(mapEligibilityCheck({ id: 'e2', isEligible: false })?.eligible).toBe('Ineligible');
  });

  it('keeps multiple rows in the returned order', () => {
    const rows = [
      mapEligibilityCheck({ id: 'e2', policyNumber: 'POL-2', isEligible: false, checkMethod: 'portal' }),
      mapEligibilityCheck({ id: 'e1', policyNumber: 'POL-1', isEligible: true, checkMethod: 'manual' }),
    ];
    expect(rows.map((row) => row?.policyNumber)).toEqual(['POL-2', 'POL-1']);
  });

  it('loads one patient read and treats an empty array as no eligibility records', async () => {
    getEligibilityChecksByPatient.mockResolvedValue({ eligibilityChecks: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    const result = await loadPatient360Eligibility(patientId);
    expect(getEligibilityChecksByPatient).toHaveBeenCalledTimes(1);
    expect(getEligibilityChecksByPatient).toHaveBeenCalledWith(patientId, 1, 20);
    expect(result).toEqual({ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    expect(eligibilityEmptyMessage()).toBe('No eligibility records recorded.');
  });

  it('requests the next eligibility page and keeps the server total', async () => {
    getEligibilityChecksByPatient.mockResolvedValue({
      eligibilityChecks: [{ id: 'e2', policyNumber: 'POL-2', isEligible: true, checkMethod: 'manual' }],
      totalCount: 21,
      pageNumber: 2,
      pageSize: 20,
    });
    const result = await loadPatient360Eligibility(patientId, 2);
    expect(getEligibilityChecksByPatient).toHaveBeenCalledWith(patientId, 2, 20);
    expect(result.rows.map((row) => row.policyNumber)).toEqual(['POL-2']);
    expect(result.totalCount).toBe(21);
    expect(result.pageNumber).toBe(2);
  });

  it('does not treat a missing list or an HTTP failure as no eligibility records', async () => {
    getEligibilityChecksByPatient.mockResolvedValueOnce({ totalCount: 0 });
    await expect(loadPatient360Eligibility(patientId)).resolves.toEqual({
      state: 'unavailable',
      rows: [],
    });

    expect(classifyEligibilityError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifyEligibilityError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyEligibilityError({ response: { status: 404 } })).toBe('unavailable');
    expect(classifyEligibilityError({ response: { status: 500 } })).toBe('unavailable');
    expect(eligibilityUnauthorizedMessage()).not.toMatch(/No eligibility/i);
    expect(eligibilityUnavailableMessage()).toBe('Eligibility information is unavailable.');
    expect(eligibilityUnavailableMessage()).not.toMatch(/No eligibility/i);
  });
});

describe('patient 360 eligibility presentation boundary', () => {
  it('stays inside Coverage and does not call workspace or mutation APIs', () => {
    const root = resolve(__dirname, '../..');
    const panel = readFileSync(resolve(root, 'components/patients/record/Patient360Coverage.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-eligibility.ts'), 'utf8');
    expect(panel).toContain('Source: CCMS Eligibility');
    expect(panel).toContain('Source: CCMS Authorization');
    expect(panel).toContain('Source: CCMS Coverage Cases');
    expect(panel).toContain('Source: Patient Insurance Profile');
    expect(panel).toContain('Source: OPD bills');
    expect(panel).toContain('loadPatient360Eligibility');
    expect(reads).toContain('getEligibilityChecksByPatient');
    expect(reads).not.toMatch(/workspace|getEligibilityChecks\(|createEligibilityCheck|getPolicyCaptures/i);
    expect(panel).not.toMatch(/createEligibilityCheck|policy-captures|\/workspace/i);
    expect(PATIENT_360_SECTIONS.map((section) => section.key)).toEqual([
      'overview',
      'clinical',
      'care',
      'documents',
      'coverage',
      'administration',
      'timeline',
    ]);
  });
});
