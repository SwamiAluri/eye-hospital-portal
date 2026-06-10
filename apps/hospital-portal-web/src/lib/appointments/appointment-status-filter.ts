import type { MasterOption } from '@/hooks/use-master-values';

/** Tailwind color token for status filter chips (metadata.color override). */
export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'blue',
  confirmed: 'green',
  'in-progress': 'yellow',
  completed: 'gray',
  cancelled: 'red',
  'no-show': 'red',
};

/** Fallback when master has no appointment.status rows yet (existing tenants pre-seed). */
export const DEFAULT_APPOINTMENT_STATUS_FILTER: MasterOption[] = [
  { value: 'scheduled', label: 'Scheduled', metadata: { color: 'blue' } },
  { value: 'confirmed', label: 'Confirmed', metadata: { color: 'green' } },
  { value: 'in-progress', label: 'In Progress', metadata: { color: 'yellow' } },
  { value: 'completed', label: 'Completed', metadata: { color: 'gray' } },
  { value: 'cancelled', label: 'Cancelled', metadata: { color: 'red' } },
  { value: 'no-show', label: 'No Show', metadata: { color: 'red' } },
];

export function resolveAppointmentStatusFilter(master: MasterOption[]): MasterOption[] {
  return master.length > 0 ? master : DEFAULT_APPOINTMENT_STATUS_FILTER;
}

export function statusChipColor(option: MasterOption): string {
  const meta = option.metadata?.color;
  if (typeof meta === 'string' && meta) return meta;
  return APPOINTMENT_STATUS_COLORS[option.value.toLowerCase()] ?? 'gray';
}
