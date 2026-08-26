import { describe, expect, it } from 'vitest';
import { deriveCensusDuesKpi } from './census-dues-kpi';

describe('deriveCensusDuesKpi', () => {
  it('uses ledger outstanding when the dashboard loads', () => {
    const kpi = deriveCensusDuesKpi({
      isPending: false,
      isError: false,
      data: {
        patientOutstanding: 16200000,
        patients: [
          { patientOutstanding: 90000 },
          { patientOutstanding: 0 },
          { patientOutstanding: 1200 },
        ],
      },
    });
    expect(kpi).toEqual({
      status: 'ok',
      patientOutstanding: 16200000,
      patientsWithDue: 2,
    });
  });

  it('does not invent a total when the ledger is missing', () => {
    const kpi = deriveCensusDuesKpi({
      isPending: false,
      isError: true,
      data: undefined,
    });
    expect(kpi.status).toBe('unavailable');
  });

  it('keeps last ledger snapshot if a later refetch errors', () => {
    const kpi = deriveCensusDuesKpi({
      isPending: false,
      isError: true,
      data: { patientOutstanding: 500, patients: [{ patientOutstanding: 500 }] },
    });
    expect(kpi).toEqual({ status: 'ok', patientOutstanding: 500, patientsWithDue: 1 });
  });

  it('shows loading before the first ledger response', () => {
    expect(deriveCensusDuesKpi({ isPending: true, isError: false, data: undefined }).status).toBe('loading');
  });
});
