import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  canDirectoryOfferCheckIn,
  isDirectoryVisitCheckedIn,
} from '@/lib/patients/patient-hub-row-display';

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
import type { PatientLookupRow } from '@/types/patient-lookup';

const noop = () => undefined;

const row: PatientLookupRow = {
  id: 'patient-e4',
  firstName: 'Sam',
  lastName: 'Aluri',
  mrn: 'MRN-E4',
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
  activeEngagements: [{ type: 'queue', label: 'Queue', status: 'waiting' }],
};

describe('Patient Directory Slice B.1 — column stability', () => {
  it('keeps Actions with Print Card and omits retired Engagement/Visit headers', () => {
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
    expect(html).toContain('>Actions<');
    expect(html).toContain('Print Card');
    expect(html).toContain('Book appointment');
    expect(html).not.toContain('>Engagement<');
    expect(html).not.toContain('>Current Visit<');
    expect(html).not.toContain('>Next Appointment<');
    expect(html).toContain('>MRN<');
    expect(html).toContain('>Gender<');
    expect(html).toContain('>Phone<');
  });

  it('reserves Actions width via colgroup and keeps Registration Card outside the worklist headers', () => {
    const table = readWeb('components/patients/lookup/PatientHubTable.tsx');
    const registration = readWeb('components/patients/lookup/PatientRegistrationCardDialog.tsx');
    expect(table).toContain('PATIENT_HUB_COLGROUP_DESKTOP');
    expect(table).toContain("key: 'actions'");
    expect(table).toContain("key: 'mrn'");
    expect(table).toContain("key: 'gender'");
    expect(registration).toContain('View registration card');
  });
});

describe('Patient Directory Slice E.4 — check-in state', () => {
  it('never offers Check in for an already checked-in visit', () => {
    expect(
      isDirectoryVisitCheckedIn({
        primaryOpenVisitId: 'visit-1',
        waitingMinutes: 3,
        scheduledAt: '2026-06-02T04:35:00.000Z',
      }),
    ).toBe(true);
    expect(
      canDirectoryOfferCheckIn({
        primaryOpenVisitId: 'visit-1',
        waitingMinutes: 3,
        scheduledAt: '2026-06-02T04:35:00.000Z',
      }),
    ).toBe(false);
  });

  it('preserves structured Visit metadata and certified directory actions', () => {
    const visit = readWeb('components/patients/lookup/PreviewVisitInfoCard.tsx');
    const actions = readWeb('components/patients/lookup/PatientHubRowActions.tsx');
    const panel = readWeb('components/patients/lookup/PatientPreviewPanel.tsx');
    expect(visit).toContain('label="Time"');
    expect(actions).toContain('Book appointment');
    expect(actions).toContain('Print Card');
    expect(actions).not.toContain('MoreHorizontal');
    expect(panel).toContain('Open Patient 360');
  });
});
