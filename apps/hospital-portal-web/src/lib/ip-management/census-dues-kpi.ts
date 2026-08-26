export type CensusDuesKpi =
  | { status: 'loading' }
  | { status: 'ok'; patientOutstanding: number; patientsWithDue: number }
  | { status: 'unavailable' };

/**
 * Census "Patient dues" tile. Billing ledger only — never journey.balanceDue.
 */
export function deriveCensusDuesKpi(args: {
  isPending: boolean;
  isError: boolean;
  data: {
    patientOutstanding?: number;
    patients?: { patientOutstanding?: number }[];
  } | null | undefined;
}): CensusDuesKpi {
  if (args.data) {
    const patientsWithDue = (args.data.patients ?? []).filter(p => (p.patientOutstanding ?? 0) > 0).length;
    return {
      status: 'ok',
      patientOutstanding: args.data.patientOutstanding ?? 0,
      patientsWithDue,
    };
  }
  if (args.isError) return { status: 'unavailable' };
  if (args.isPending) return { status: 'loading' };
  return { status: 'unavailable' };
}
