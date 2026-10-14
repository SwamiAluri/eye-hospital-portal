import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const webRoot = resolve(__dirname, '../..');

function readWeb(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

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

import { PatientHubTable } from '@/components/patients/lookup/PatientHubTable';
import { PatientHubRegistrationCell } from '@/components/patients/lookup/PatientRegistrationCardDialog';
import type { PatientLookupRow } from '@/types/patient-lookup';

const noop = () => undefined;

const row: PatientLookupRow = {
  id: 'patient-e3',
  firstName: 'Sam',
  lastName: 'Aluri',
  mrn: 'MRN-E3',
  dateOfBirth: '1987-01-01',
  gender: 'male',
  clinicalAcuity: 'low',
  isFavorite: false,
  careProgramCodes: [],
  reasonForVisit: 'General Check-up',
  currentStation: 'Optometry',
  assignedProviderName: 'System Administrator',
  assignedProviderRole: 'Admin',
  primaryOpenVisitId: 'visit-1',
  waitingMinutes: 8,
  scheduledAt: '2026-06-08T14:35:00.000Z',
  phone: '9999900000',
  activeEngagements: [{ type: 'opd', label: 'OPD', status: 'open' }],
};

describe('Patient Directory Slice B.1 — discovery columns', () => {
  it('keeps the approved desktop column set when preview is closed', () => {
    const html = renderToStaticMarkup(
      <PatientHubTable
        rows={[row]}
        previewId={null}
        isLoading={false}
        isError={false}
        isReady
        currentSort="name"
        currentSortDir="asc"
        onSort={noop}
        onRowClick={noop}
        onOpenProfile={noop}
      />,
    );
    expect(html).toContain('data-compact="false"');
    expect(html).toContain('>Patient<');
    expect(html).toContain('>MRN<');
    expect(html).toContain('>Gender<');
    expect(html).toContain('>Phone<');
    expect(html).toContain('>Provider<');
    expect(html).toContain('>Actions<');
    expect(html).not.toContain('>Next Appointment<');
    expect(html).not.toContain('>Current Visit<');
    expect(html).not.toContain('>Location<');
  });

  it('keeps Provider independent when compact columns are enabled', () => {
    const html = renderToStaticMarkup(
      <PatientHubTable
        rows={[row]}
        previewId={row.id}
        isLoading={false}
        isError={false}
        isReady
        currentSort="name"
        currentSortDir="asc"
        onSort={noop}
        compactColumns
        onRowClick={noop}
        onOpenProfile={noop}
      />,
    );
    expect(html).toContain('data-compact="true"');
    expect(html).toContain('>Provider<');
    expect(html).toContain('System Administrator');
    expect(html).toContain('>MRN<');
    expect(html).toContain('>Gender<');
    expect(html).not.toContain('>Next Appointment<');
  });

  it('registration card surface remains available via Print Card / cell', () => {
    const cell = readWeb('components/patients/lookup/PatientRegistrationCardDialog.tsx');
    const actions = readWeb('components/patients/lookup/PatientHubRowActions.tsx');
    const html = renderToStaticMarkup(<PatientHubRegistrationCell row={row} />);
    expect(html).toContain('View registration card');
    expect(actions).toContain('RegistrationCardPreview');
    expect(actions).toContain('registrationCardPatient');
    expect(cell).toContain('photoUrl: row.photoThumbnailUrl');
  });
});

describe('Patient Directory Slice E.3 — preview surfaces', () => {
  it('keeps Visit as a structured metadata surface without nested scroll', () => {
    const visit = readWeb('components/patients/lookup/PreviewVisitInfoCard.tsx');
    const panel = readWeb('components/patients/lookup/PatientPreviewPanel.tsx');
    expect(visit).toContain('label="Time"');
    expect(visit).toContain('label="Provider"');
    expect(panel).toContain('showCheckIn');
    expect(panel).toContain('canDirectoryOfferCheckIn');
  });

  it('keeps preview body as the only preview scroll surface', () => {
    const panel = readWeb('components/patients/lookup/PatientPreviewPanel.tsx');
    const split = readWeb('components/patients/lookup/PatientPreviewSplitPane.tsx');
    expect(panel).toContain('previewBody');
    expect(split).toContain('w-1/2');
    expect(split).not.toContain('max-w-[480px]');
  });

  it('does not introduce page-level horizontal overflow on the directory shell', () => {
    const page = readWeb('components/patients/lookup/PatientHubPage.tsx');
    expect(page).toContain('overflow-auto');
    expect(page).toContain('compactColumns={showDockedPreview || !canDock}');
    expect(page).toContain('replaceDirectoryUrlState');
  });

  it('keeps appointment authorization and Patient 360 handoff unchanged', () => {
    const actions = readWeb('components/patients/lookup/PatientHubRowActions.tsx');
    const panel = readWeb('components/patients/lookup/PatientPreviewPanel.tsx');
    expect(actions).toContain("useHasPermission('appointment.view')");
    expect(actions).toContain('Book appointment');
    expect(panel).toContain('Open Patient 360');
    expect(panel).toContain('buildFrontDeskCheckInHref');
  });
});
