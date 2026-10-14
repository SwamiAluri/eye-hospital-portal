import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClaimsByPatient = vi.fn();

vi.mock('@/lib/api/ccms/ccms-claims.api', () => ({
  getClaimsByPatient: (...args: unknown[]) => getClaimsByPatient(...args),
}));

import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';
import {
  claimEmptyMessage,
  claimUnauthorizedMessage,
  claimUnavailableMessage,
  classifyClaimError,
  loadPatient360Claims,
  mapClaim,
} from '@/lib/patients/patient-360-claims';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 claims read', () => {
  beforeEach(() => {
    getClaimsByPatient.mockReset();
  });

  it('maps stored claim fields and does not derive an approved amount or balance', () => {
    const row = mapClaim({
      id: 'cl1',
      claimNumber: 'CLM-1',
      claimType: 'cashless',
      status: 'active',
      queryStatus: 'none',
      submissionMode: 'manual',
      claimedAmount: 1000,
      submittedAt: '2026-09-01T10:00:00Z',
      acknowledgedAt: null,
      tpaClaimNumber: 'TPA-CLM-1',
      expectedSettlementDate: '2026-10-01',
      claimPacketJson: '{"hidden":true}',
    });
    expect(row).toEqual({
      id: 'cl1',
      claimNumber: 'CLM-1',
      claimType: 'cashless',
      status: 'active',
      queryStatus: 'none',
      submissionMode: 'manual',
      claimedAmount: '₹1000.00',
      submittedAt: '2026-09-01',
      acknowledgedAt: null,
      tpaClaimNumber: 'TPA-CLM-1',
      expectedSettlementDate: '2026-10-01',
    });
  });

  it('keeps multiple rows in the returned order', () => {
    const rows = [
      mapClaim({ id: 'cl2', claimNumber: 'CLM-2', status: 'active', claimType: 'reimbursement' }),
      mapClaim({ id: 'cl1', claimNumber: 'CLM-1', status: 'active', claimType: 'cashless' }),
    ];
    expect(rows.map((row) => row?.claimNumber)).toEqual(['CLM-2', 'CLM-1']);
    expect(rows[0]?.status).toBe('active');
  });

  it('loads one patient read and treats an empty array as no claims', async () => {
    getClaimsByPatient.mockResolvedValue({ claims: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    const result = await loadPatient360Claims(patientId);
    expect(getClaimsByPatient).toHaveBeenCalledTimes(1);
    expect(getClaimsByPatient).toHaveBeenCalledWith(patientId, 1, 20);
    expect(result).toEqual({ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    expect(claimEmptyMessage()).toBe('No claims recorded.');
  });

  it('requests the next claims page and keeps the server total', async () => {
    getClaimsByPatient.mockResolvedValue({
      claims: [{ id: 'cl2', claimNumber: 'CLM-2', status: 'active', claimType: 'cashless' }],
      totalCount: 21,
      pageNumber: 2,
      pageSize: 20,
    });
    const result = await loadPatient360Claims(patientId, 2);
    expect(getClaimsByPatient).toHaveBeenCalledWith(patientId, 2, 20);
    expect(result.rows.map((row) => row.claimNumber)).toEqual(['CLM-2']);
    expect(result.totalCount).toBe(21);
    expect(result.pageNumber).toBe(2);
  });

  it('does not treat a missing list or an HTTP failure as no claims', async () => {
    getClaimsByPatient.mockResolvedValueOnce({ totalCount: 0 });
    await expect(loadPatient360Claims(patientId)).resolves.toEqual({ state: 'unavailable', rows: [] });

    expect(classifyClaimError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifyClaimError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyClaimError({ response: { status: 404 } })).toBe('unavailable');
    expect(classifyClaimError({ response: { status: 500 } })).toBe('unavailable');
    expect(claimUnauthorizedMessage()).not.toMatch(/No claims/i);
    expect(claimUnavailableMessage()).toBe('Claims information is unavailable.');
    expect(claimUnavailableMessage()).not.toMatch(/No claims/i);
  });
});

describe('patient 360 claims presentation boundary', () => {
  it('stays inside Coverage and does not call workspace or mutation APIs', () => {
    const root = resolve(__dirname, '../..');
    const panel = readFileSync(resolve(root, 'components/patients/record/Patient360Coverage.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-claims.ts'), 'utf8');
    expect(panel).toContain('Source: CCMS Claims');
    expect(panel).toContain('Source: CCMS Eligibility');
    expect(panel).toContain('Source: CCMS Authorization');
    expect(panel).toContain('Source: CCMS Coverage Cases');
    expect(panel).toContain('Source: Patient Insurance Profile');
    expect(panel).toContain('Source: OPD bills');
    expect(panel).toContain('loadPatient360Claims');
    expect(reads).toContain('getClaimsByPatient');
    expect(reads).not.toMatch(/workspace|getClaimByCaseId|submitClaim|generateClaimPacket|acknowledgeClaim/i);
    expect(panel).not.toMatch(/submitClaim|generateClaimPacket|\/workspace/i);
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
