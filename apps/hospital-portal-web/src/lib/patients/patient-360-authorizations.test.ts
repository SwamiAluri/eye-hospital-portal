import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthorizationsByPatient = vi.fn();

vi.mock('@/lib/api/ccms/ccms-authorizations.api', () => ({
  getAuthorizationsByPatient: (...args: unknown[]) => getAuthorizationsByPatient(...args),
}));

import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';
import {
  authorizationEmptyMessage,
  authorizationUnauthorizedMessage,
  authorizationUnavailableMessage,
  classifyAuthorizationError,
  loadPatient360Authorizations,
  mapAuthorization,
} from '@/lib/patients/patient-360-authorizations';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 authorization read', () => {
  beforeEach(() => {
    getAuthorizationsByPatient.mockReset();
  });

  it('maps stored authorization fields and does not derive a status', () => {
    const row = mapAuthorization({
      id: 'a1',
      authorizationType: 'preauth',
      preAuthNumber: 'PA-1',
      processStatus: 'pending',
      requestedAmount: 1000,
      approvedAmount: 250,
      submittedAt: '2026-09-01T10:00:00Z',
      receivedAt: null,
      validFrom: '2026-09-02T00:00:00Z',
      validTo: '2026-10-02T00:00:00Z',
      tpaReferenceNumber: 'TPA-8',
      rejectionReason: null,
      clinicalSummary: 'do not show as a calculated status',
      netPayableByPatient: 750,
    });
    expect(row).toEqual({
      id: 'a1',
      authorizationType: 'preauth',
      preAuthNumber: 'PA-1',
      processStatus: 'pending',
      requestedAmount: '₹1000.00',
      approvedAmount: '₹250.00',
      submittedAt: '2026-09-01',
      receivedAt: null,
      validFrom: '2026-09-02',
      validTo: '2026-10-02',
      tpaReferenceNumber: 'TPA-8',
      rejectionReason: null,
    });
    expect(row).not.toHaveProperty('status');
  });

  it('keeps multiple rows in the returned order', () => {
    const rows = [
      mapAuthorization({ id: 'a2', preAuthNumber: 'PA-2', processStatus: 'query_raised', authorizationType: 'enhancement' }),
      mapAuthorization({ id: 'a1', preAuthNumber: 'PA-1', processStatus: 'pending', authorizationType: 'preauth' }),
    ];
    expect(rows.map((row) => row?.preAuthNumber)).toEqual(['PA-2', 'PA-1']);
    expect(rows[0]?.processStatus).toBe('query_raised');
  });

  it('loads one patient read and treats an empty array as no authorizations', async () => {
    getAuthorizationsByPatient.mockResolvedValue({ authorizations: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    const result = await loadPatient360Authorizations(patientId);
    expect(getAuthorizationsByPatient).toHaveBeenCalledTimes(1);
    expect(getAuthorizationsByPatient).toHaveBeenCalledWith(patientId, 1, 20);
    expect(result).toEqual({ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    expect(authorizationEmptyMessage()).toBe('No authorizations recorded.');
  });

  it('requests the next authorization page and keeps the server total', async () => {
    getAuthorizationsByPatient.mockResolvedValue({
      authorizations: [{ id: 'a2', preAuthNumber: 'PA-2', processStatus: 'pending', authorizationType: 'preauth' }],
      totalCount: 21,
      pageNumber: 2,
      pageSize: 20,
    });
    const result = await loadPatient360Authorizations(patientId, 2);
    expect(getAuthorizationsByPatient).toHaveBeenCalledWith(patientId, 2, 20);
    expect(result.rows.map((row) => row.preAuthNumber)).toEqual(['PA-2']);
    expect(result.totalCount).toBe(21);
    expect(result.pageNumber).toBe(2);
  });

  it('does not treat a missing list or an HTTP failure as no authorizations', async () => {
    getAuthorizationsByPatient.mockResolvedValueOnce({ totalCount: 0 });
    await expect(loadPatient360Authorizations(patientId)).resolves.toEqual({
      state: 'unavailable',
      rows: [],
    });

    expect(classifyAuthorizationError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifyAuthorizationError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyAuthorizationError({ response: { status: 404 } })).toBe('unavailable');
    expect(classifyAuthorizationError({ response: { status: 500 } })).toBe('unavailable');
    expect(authorizationUnauthorizedMessage()).not.toMatch(/No authorizations/i);
    expect(authorizationUnavailableMessage()).toBe('Authorization information is unavailable.');
    expect(authorizationUnavailableMessage()).not.toMatch(/No authorizations/i);
  });
});

describe('patient 360 authorization presentation boundary', () => {
  it('stays inside Coverage and does not call workspace or mutation APIs', () => {
    const root = resolve(__dirname, '../..');
    const panel = readFileSync(resolve(root, 'components/patients/record/Patient360Coverage.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-authorizations.ts'), 'utf8');
    const care = readFileSync(resolve(root, 'components/patients/record/Patient360Communication.tsx'), 'utf8');
    expect(panel).toContain('Source: CCMS Authorization');
    expect(panel).toContain('Source: CCMS Coverage Cases');
    expect(panel).toContain('Source: Patient Insurance Profile');
    expect(panel).toContain('Source: OPD bills');
    expect(panel).toContain('loadPatient360Authorizations');
    expect(reads).toContain('getAuthorizationsByPatient');
    expect(reads).not.toMatch(/workspace|getPreAuthByCaseId|generatePreAuth|submitAuth|recordTpaResponse/i);
    expect(panel).not.toMatch(/generatePreAuth|submitAuth|recordTpaResponse|coverage-cases\/\$\{|\/workspace/i);
    expect(care).not.toContain('loadPatient360Authorizations');
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
