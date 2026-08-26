import { describe, expect, it } from 'vitest';
import type { WardBedDto } from '@/lib/api/ip-management.api';
import {
  isOccupiedPatientCell,
  wardBedStatusLabel,
  wardBedSurfaceLabel,
  wardBedWhoLine,
} from './ward-bed-map';

const occupied: WardBedDto = {
  bedId: 'b-occ',
  description: 'C-04 · Chair',
  roomNo: 'C-04',
  capacity: 1,
  currentOccupancy: 1,
  isAvailable: false,
  bedType: 'DayCareChair',
  bedStatus: 'Occupied',
  bedNumber: 'C-04',
  occupantJourneyId: 'j1',
  occupantUhid: 'UAT-002',
  occupantName: 'Meena Iyer',
};

const available: WardBedDto = {
  bedId: 'b-free',
  description: 'C-06 · Chair',
  roomNo: 'C-06',
  capacity: 1,
  currentOccupancy: 0,
  isAvailable: true,
  bedType: 'Recliner',
  bedStatus: 'Available',
  bedNumber: 'C-06',
};

describe('ward bed map helpers', () => {
  it('shows UHID on occupied and Chair on empty recliner', () => {
    expect(wardBedWhoLine(occupied)).toContain('UAT-002');
    expect(wardBedWhoLine(occupied)).toContain('Meena Iyer');
    expect(wardBedStatusLabel(occupied)).toBe('Occupied');
    expect(wardBedSurfaceLabel('Recliner')).toBe('Chair');
    expect(wardBedWhoLine(available)).toBe('Chair');
    expect(isOccupiedPatientCell(occupied)).toBe(true);
    expect(isOccupiedPatientCell(available)).toBe(false);
  });
});
