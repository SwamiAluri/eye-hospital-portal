import type { WardBedDto } from '@/lib/api/ip-management.api';

export type WardBedMapKind = 'available' | 'occupied' | 'cleaning' | 'reserved' | 'other';

export function wardBedMapKind(bed: Pick<WardBedDto, 'bedStatus' | 'isAvailable'>): WardBedMapKind {
  const status = (bed.bedStatus ?? '').trim().toLowerCase();
  if (status === 'occupied') return 'occupied';
  if (status === 'cleaning') return 'cleaning';
  if (status === 'reserved') return 'reserved';
  if (status === 'available' || bed.isAvailable) return 'available';
  return 'other';
}

export function wardBedStatusLabel(bed: Pick<WardBedDto, 'bedStatus' | 'isAvailable'>): string {
  const raw = (bed.bedStatus ?? '').trim();
  if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return bed.isAvailable ? 'Available' : 'Occupied';
}

/** Recliner / DayCareChair render as Chair on the map. */
export function wardBedSurfaceLabel(bedType: string | null | undefined): string {
  const raw = (bedType ?? '').trim();
  if (raw === 'Recliner' || raw === 'DayCareChair') return 'Chair';
  return raw || 'Bed';
}

export function wardBedNumberLabel(bed: Pick<WardBedDto, 'bedNumber' | 'roomNo'>): string {
  return (bed.bedNumber ?? bed.roomNo ?? '').trim() || '—';
}

export function wardBedWhoLine(bed: WardBedDto): string {
  const kind = wardBedMapKind(bed);
  if (kind === 'occupied') {
    const who = [bed.occupantName, bed.occupantUhid].filter(Boolean).join(' · ');
    return who || 'Occupied';
  }
  if (kind === 'reserved') return 'Reserved';
  if (kind === 'cleaning') return 'Turnaround';
  return wardBedSurfaceLabel(bed.bedType);
}

export function isOccupiedPatientCell(bed: WardBedDto): boolean {
  return wardBedMapKind(bed) === 'occupied' && Boolean(bed.occupantJourneyId);
}
