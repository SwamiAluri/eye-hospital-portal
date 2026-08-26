import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';

export function ipBillingHref(
  journey: Pick<PatientJourneyRowDto, 'id' | 'patientId'>,
  billId?: string | null,
): string {
  const q = new URLSearchParams({ journeyId: journey.id });
  if (journey.patientId) q.set('patientId', journey.patientId);
  if (billId) q.set('billId', billId);
  return `/dashboard/ip-management/billing?${q.toString()}`;
}

export function ipCollectBillHref(billId: string): string {
  return `/dashboard/billing/opd?billId=${billId}`;
}

export function ipJourneyHref(journeyId: string, tab?: string): string {
  const base = `/dashboard/ip-management/journey/${journeyId}`;
  return tab ? `${base}?tab=${tab}` : base;
}

export function ipWardHref(journeyId: string, intent?: 'transfer' | 'postop' | 'discharge'): string {
  const q = new URLSearchParams({ patient: journeyId });
  if (intent) q.set('intent', intent);
  return `/dashboard/ip-management/ward?${q.toString()}`;
}

export function ipOtHref(journeyId: string): string {
  return `/dashboard/ip-management/operation-theatre?patient=${encodeURIComponent(journeyId)}`;
}
