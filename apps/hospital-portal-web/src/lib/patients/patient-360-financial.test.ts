import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getByPatient = vi.fn();

vi.mock('@/lib/api', () => ({
  opdBillsApi: {
    getByPatient: (...args: unknown[]) => getByPatient(...args),
  },
}));

import {
  classifyFinancialError,
  financialEmptyMessage,
  financialUnauthorizedMessage,
  financialUnavailableMessage,
  loadPatient360Bills,
  mapFinancialBill,
} from '@/lib/patients/patient-360-financial';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 financial read', () => {
  beforeEach(() => {
    getByPatient.mockReset();
  });

  it('maps stored bill fields without deriving a new balance or status', () => {
    const row = mapFinancialBill({
      id: 'b1',
      billNumber: 'OPD-1',
      billDate: '2026-09-01T00:00:00',
      netAmount: 1000,
      amountPaid: 400,
      balanceDue: 600,
      status: 'Pending',
      isFreeVisit: false,
    });

    expect(row).toMatchObject({
      id: 'b1',
      billNumber: 'OPD-1',
      status: 'Pending',
      netAmount: '₹1000.00',
      amountPaid: '₹400.00',
      balanceDue: '₹600.00',
      isFreeVisit: false,
    });
    expect(row).not.toHaveProperty('outstanding');
  });

  it('keeps two bills distinct and does not invent a status', () => {
    const first = mapFinancialBill({ id: 'b1', billNumber: 'OPD-1', status: 'Pending', balanceDue: 10 });
    const second = mapFinancialBill({ id: 'b2', billNumber: 'OPD-2', status: 'Paid', balanceDue: 0 });
    expect(first?.billNumber).toBe('OPD-1');
    expect(second?.billNumber).toBe('OPD-2');
    expect(first?.status).toBe('Pending');
    expect(second?.status).toBe('Paid');
  });

  it('loads the patient UUID and treats an empty bills array as no records', async () => {
    getByPatient.mockResolvedValue({ data: { bills: [], total: 0 } });
    const result = await loadPatient360Bills(patientId);
    expect(getByPatient).toHaveBeenCalledWith(patientId, 1, 50);
    expect(result).toEqual({ state: 'ready', rows: [] });
    expect(financialEmptyMessage()).toBe('No billing records found.');
  });

  it('renders an authorized bill and keeps unauthorized distinct from an empty list', async () => {
    getByPatient.mockResolvedValueOnce({
      data: {
        bills: [{
          id: 'b1',
          billNumber: 'OPD-1',
          netAmount: 1000,
          amountPaid: 400,
          balanceDue: 600,
          status: 'Pending',
          isFreeVisit: false,
        }],
        total: 1,
      },
    });
    const ready = await loadPatient360Bills(patientId);
    expect(getByPatient).toHaveBeenCalledWith(patientId, 1, 50);
    expect(ready.state).toBe('ready');
    expect(ready.rows[0]).toMatchObject({
      billNumber: 'OPD-1',
      netAmount: '₹1000.00',
      amountPaid: '₹400.00',
      balanceDue: '₹600.00',
      status: 'Pending',
    });

    getByPatient.mockRejectedValueOnce({ response: { status: 401 } });
    const denied = await loadPatient360Bills(patientId);
    expect(denied).toEqual({ state: 'unauthorized', rows: [] });
    expect(financialUnauthorizedMessage()).not.toBe(financialEmptyMessage());
    expect(financialUnavailableMessage()).not.toBe(financialEmptyMessage());
  });

  it('does not treat a missing bill list or an HTTP failure as no records', async () => {
    getByPatient.mockResolvedValueOnce({ data: { total: 0 } });
    await expect(loadPatient360Bills(patientId)).resolves.toEqual({ state: 'unavailable', rows: [] });

    expect(classifyFinancialError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifyFinancialError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyFinancialError({ response: { status: 404 } })).toBe('unavailable');
    expect(classifyFinancialError({ response: { status: 500 } })).toBe('unavailable');
    expect(financialUnauthorizedMessage()).not.toMatch(/No billing records/i);
    expect(financialUnavailableMessage()).toBe('Financial information is not available in Patient 360.');
    expect(financialUnavailableMessage()).not.toMatch(/No billing records/i);
  });
});

describe('patient 360 financial presentation boundary', () => {
  it('does not add billing mutations or a summed patient balance', () => {
    const root = resolve(__dirname, '../..');
    const panel = readFileSync(resolve(root, 'components/patients/record/Patient360Coverage.tsx'), 'utf8');
    const page = readFileSync(resolve(root, 'components/patients/record/PatientRecordPage.tsx'), 'utf8');
    expect(panel).toContain('Source: OPD bills');
    expect(panel).toContain('Balance due');
    expect(panel).not.toMatch(/addPayment|Create Bill|Refund|Print Bill|Generate Invoice|Outstanding balance|Patient balance/i);
    expect(page).not.toContain('Existing record tools');
  });
});
