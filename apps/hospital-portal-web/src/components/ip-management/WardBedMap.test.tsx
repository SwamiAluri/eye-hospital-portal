import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WardBedMap } from './WardBedMap';
import type { WardBedDto } from '@/lib/api/ip-management.api';

const occupied: WardBedDto = {
  bedId: 'bed-4',
  description: 'C-04',
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
  bedId: 'bed-6',
  description: 'C-06',
  roomNo: 'C-06',
  capacity: 1,
  currentOccupancy: 0,
  isAvailable: true,
  bedType: 'Recliner',
  bedStatus: 'Available',
  bedNumber: 'C-06',
};

describe('WardBedMap', () => {
  it('shows UHID on occupied and does not make available a patient control', () => {
    const html = renderToStaticMarkup(
      <WardBedMap
        beds={[occupied, available]}
        onOccupiedClick={vi.fn()}
      /> as React.ReactElement,
    );
    expect(html).toContain('UAT-002');
    expect(html).toContain('Occupied');
    expect(html).toContain('Available');
    expect(html).toContain('Chair');
    expect(html).toContain('data-occupied="true"');
    expect(html).toContain('data-occupied="false"');
    expect(html).toContain('data-testid="ward-bed-cell-bed-4"');
    expect(html).toMatch(/<button[^>]*data-testid="ward-bed-cell-bed-4"/);
    expect(html).not.toMatch(/<button[^>]*data-testid="ward-bed-cell-bed-6"/);
    expect(html).toContain('colour is not the only cue');
  });
});
