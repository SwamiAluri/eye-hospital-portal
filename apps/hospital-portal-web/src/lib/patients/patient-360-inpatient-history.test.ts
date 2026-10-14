import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();

vi.mock('@/lib/api', () => ({
  getApi: () => ({ get }),
}));

import {
  classifyInpatientHistoryError,
  inpatientHistoryEmptyMessage,
  inpatientHistoryUnauthorizedMessage,
  inpatientHistoryUnavailableMessage,
  loadPatient360InpatientHistory,
  mapInpatientHistory,
} from '@/lib/patients/patient-360-inpatient-history';

describe('patient 360 inpatient history mapping', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('uses admitted_at and discharged_at and ignores createdAt', () => {
    const row = mapInpatientHistory({
      id: 'j1',
      admittedAt: '2026-03-01T08:15:00',
      dischargedAt: '2026-03-02T11:00:00',
      clinicalState: 'Discharged',
      createdAt: '2020-01-01T00:00:00',
      procedureName: 'Cataract',
    });
    expect(row).toEqual({
      id: 'j1',
      admittedAt: '2026-03-01 08:15',
      dischargedAt: '2026-03-02 11:00',
      clinicalState: 'Discharged',
    });
    expect(row?.admittedAt).not.toContain('2020');
  });

  it('keeps a null admission time null', () => {
    const row = mapInpatientHistory({
      id: 'j2',
      admittedAt: null,
      dischargedAt: null,
      clinicalState: 'AdmissionCancelled',
      createdAt: '2026-01-01T00:00:00',
    });
    expect(row?.admittedAt).toBeNull();
    expect(row?.clinicalState).toBe('AdmissionCancelled');
  });

  it('keeps empty, unauthorized, and unavailable distinct', async () => {
    get.mockResolvedValueOnce({ data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 20 } });
    await expect(loadPatient360InpatientHistory('p1')).resolves.toMatchObject({
      state: 'ready',
      rows: [],
      totalCount: 0,
    });
    expect(inpatientHistoryEmptyMessage()).toBe('No inpatient history recorded.');
    expect(inpatientHistoryEmptyMessage()).not.toBe(inpatientHistoryUnauthorizedMessage());
    expect(inpatientHistoryEmptyMessage()).not.toBe(inpatientHistoryUnavailableMessage());

    get.mockRejectedValueOnce({ response: { status: 403 } });
    await expect(loadPatient360InpatientHistory('p1')).resolves.toMatchObject({ state: 'unauthorized', rows: [] });

    get.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(loadPatient360InpatientHistory('p1')).resolves.toMatchObject({ state: 'unavailable', rows: [] });
    expect(classifyInpatientHistoryError({ response: { status: 401 } })).toBe('unauthorized');
  });

  it('requests the patient-scoped history page', async () => {
    get.mockResolvedValueOnce({
      data: {
        items: [{ id: 'j1', admittedAt: '2026-03-01T08:00:00', dischargedAt: null, clinicalState: 'Discharged' }],
        totalCount: 21,
        pageNumber: 2,
        pageSize: 20,
      },
    });
    const result = await loadPatient360InpatientHistory('patient-1', 2);
    expect(get).toHaveBeenCalledWith(
      '/patient-journeys/patients/patient-1/patient-360/inpatient-history',
      { params: { pageNumber: 2, pageSize: 20 } },
    );
    expect(result.totalCount).toBe(21);
    expect(result.pageNumber).toBe(2);
    expect(result.rows[0]?.clinicalState).toBe('Discharged');
  });
});
