import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-permissions', () => ({
  useHasPermission: (code: string) => code === 'appointment.view',
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { PatientHubMobileCards } from './PatientHubMobileCards';
import type { PatientLookupRow } from '@/types/patient-lookup';

const noop = () => undefined;

describe('PatientHubMobileCards Slice B.1', () => {
  it('renders the empty state', () => {
    const html = renderToStaticMarkup(
      <PatientHubMobileCards
        rows={[]}
        previewId={null}
        isLoading={false}
        isError={false}
        isReady
        onRowClick={noop}
        onOpenProfile={noop}
      />,
    );
    expect(html).toContain('patient-hub-mobile-list-state');
    expect(html).toContain('No patients match your filters.');
  });

  it('uses the approved mobile hierarchy', () => {
    const row: PatientLookupRow = {
      id: 'patient-1',
      firstName: 'Sam',
      lastName: 'Aluri',
      mrn: 'MRN-1',
      dateOfBirth: '1990-01-15',
      gender: 'male',
      clinicalAcuity: 'low',
      isFavorite: false,
      careProgramCodes: ['CATARACT'],
      phone: '9999900000',
      reasonForVisit: 'Follow-up review',
      currentStation: 'Triage',
      assignedProviderName: 'Dr. Rao',
      assignedProviderRole: 'Ophthalmologist',
      scheduledAt: '2026-10-08T05:00:00.000Z',
      activeEngagements: [{ type: 'queue', label: 'Queue', status: 'waiting' }],
    };
    const html = renderToStaticMarkup(
      <PatientHubMobileCards
        rows={[row]}
        previewId={null}
        isLoading={false}
        isError={false}
        isReady
        onRowClick={noop}
        onOpenProfile={noop}
      />,
    );
    expect(html).toContain('MRN-1');
    expect(html).toContain('+91-9999900000');
    expect(html).not.toContain('tel:');
    expect(html).toContain('Follow-up review');
    expect(html).toContain('Dr. Rao');
    expect(html).toContain('Triage');
    expect(html).toContain('>Check-in<');
    expect(html).toContain('Print Card');
    expect(html).not.toContain('Book appointment');
    expect(html).not.toContain('CATARACT');
    expect(html).not.toContain('Low acuity');
    expect(html).toContain('href="/dashboard/patients/patient-1"');
  });
});
