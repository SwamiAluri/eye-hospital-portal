import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  patientLookupRowFromSummary,
  resolveCreatedPatientPreviewRow,
} from '@/lib/patients/created-patient-preview-handoff';
import type { PatientLookupRow, PatientSummary } from '@/types/patient-lookup';

function summary(partial: Partial<PatientSummary> & Pick<PatientSummary, 'id'>): PatientSummary {
  return {
    id: partial.id,
    firstName: partial.firstName ?? 'Ada',
    lastName: partial.lastName ?? 'Lovelace',
    mrn: partial.mrn ?? 'MRN-1',
    dateOfBirth: partial.dateOfBirth ?? '1815-12-10',
    gender: partial.gender ?? 'female',
    phone: partial.phone ?? null,
    email: partial.email ?? null,
    photoThumbnailUrl: partial.photoThumbnailUrl ?? null,
    clinicalAcuity: partial.clinicalAcuity ?? 'routine',
    activeEngagements: partial.activeEngagements ?? [],
    careProgramCodes: partial.careProgramCodes ?? [],
    dataQuality: partial.dataQuality ?? {
      isIncomplete: false,
      issues: [],
      hasStaleVitals: false,
    },
    ipAdmission: partial.ipAdmission ?? null,
  };
}

function row(partial: Partial<PatientLookupRow> & Pick<PatientLookupRow, 'id'>): PatientLookupRow {
  return {
    id: partial.id,
    firstName: partial.firstName ?? 'Ada',
    lastName: partial.lastName ?? 'Lovelace',
    mrn: partial.mrn ?? 'MRN-1',
    dateOfBirth: partial.dateOfBirth ?? '1815-12-10',
    gender: partial.gender ?? 'female',
    isFavorite: false,
    careProgramCodes: [],
    clinicalAcuity: 'routine',
    activeEngagements: [],
  };
}

describe('created-patient-preview-handoff', () => {
  it('maps summary to a Preview lookup row keyed by patient.id', () => {
    const mapped = patientLookupRowFromSummary(
      summary({
        id: 'created-1',
        firstName: 'John',
        lastName: 'Smith',
        mrn: 'MRN-NEW',
        clinicalAcuity: 'low',
      }),
    );
    expect(mapped.id).toBe('created-1');
    expect(mapped.firstName).toBe('John');
    expect(mapped.lastName).toBe('Smith');
    expect(mapped.mrn).toBe('MRN-NEW');
    expect(mapped.clinicalAcuity).toBe('low');
  });

  it('prefers the row already present in the current filtered lookup page', () => {
    const listRow = row({ id: 'p1', firstName: 'List', mrn: 'MRN-LIST' });
    const resolved = resolveCreatedPatientPreviewRow({
      createdPatientId: 'p1',
      rows: [listRow],
      summary: summary({ id: 'p1', firstName: 'Summary', mrn: 'MRN-SUM' }),
    });
    expect(resolved?.id).toBe('p1');
    expect(resolved?.firstName).toBe('List');
    expect(resolved?.mrn).toBe('MRN-LIST');
  });

  it('falls back to summary-backed row when created patient is outside current filters', () => {
    const resolved = resolveCreatedPatientPreviewRow({
      createdPatientId: 'p-out',
      rows: [row({ id: 'other', firstName: 'Samuel' })],
      summary: summary({ id: 'p-out', firstName: 'John', lastName: 'Smith', mrn: 'MRN-OUT' }),
    });
    expect(resolved?.id).toBe('p-out');
    expect(resolved?.firstName).toBe('John');
    expect(resolved?.mrn).toBe('MRN-OUT');
  });

  it('returns null when ids do not match (no invented handoff)', () => {
    expect(
      resolveCreatedPatientPreviewRow({
        createdPatientId: 'a',
        rows: [row({ id: 'b' })],
        summary: summary({ id: 'c' }),
      }),
    ).toBeNull();
  });
});

describe('PatientHubPage created-patient Preview handoff wiring', () => {
  const hub = readFileSync(
    join(process.cwd(), 'src/components/patients/lookup/PatientHubPage.tsx'),
    'utf8',
  );

  it('hands off created patient.id to open Preview on Success Close without clearing search', () => {
    expect(hub).toContain('onRegistrationComplete');
    expect(hub).toContain('createdHandoffPatientId');
    expect(hub).toContain('openCreatedPatientPreview');
    expect(hub).toContain('resolveCreatedPatientPreviewRow');
    expect(hub).toContain('patientLookupApi.getSummary');
    expect(hub).toContain('openPreview');
    expect(hub).toContain('previewPatientId');
    expect(hub).toContain('PatientRegistrationSuccessDialog');
    // Preserve Directory context — handoff spreads current URL state; no search reset.
    expect(hub).toContain('urlStateRef.current');
    expect(hub).not.toContain('setSearch("")');
    expect(hub).not.toContain("setSearch('')");
  });
  it('invalidates lookup on create and only opens Preview after Success Close', () => {
    expect(hub).toContain('patientLookupKeys.all');
    expect(hub).toContain('invalidateQueries');
    expect(hub).toContain('createdHandoffPatientId.current = patient.id');
    expect(hub).toContain('PatientRegistrationSuccessDialog');
    expect(hub).toContain('openCreatedPatientPreview(handoffId)');
    // Must not open Preview merely because Add Patient dialog closed.
    expect(hub).not.toMatch(
      /setAddPatientOpen\(next\);[\s\S]{0,200}?openCreatedPatientPreview/,
    );
  });
});
