import { describe, expect, it, vi } from 'vitest';
import { registrationCardPatient } from '@/components/patients/lookup/PatientRegistrationCardDialog';
import {
  buildRegistrationCardPrintDocumentHtml,
  openRegistrationCardPrint,
} from '@/lib/patients/registration-card-print';
import type { PatientLookupRow } from '@/types/patient-lookup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function baseRow(partial: Partial<PatientLookupRow> = {}): PatientLookupRow {
  return {
    id: 'sam-1',
    firstName: 'Sam',
    lastName: 'Aluri',
    mrn: 'MRN-SAM',
    dateOfBirth: '1987-08-01',
    gender: 'Male',
    phone: '8919653433',
    email: null,
    photoThumbnailUrl: null,
    isFavorite: false,
    lastVisitAt: null,
    careProgramCodes: [],
    reasonForVisit: null,
    scheduledAt: null,
    clinicalAcuity: 'routine',
    queuePriority: null,
    activeEngagements: [],
    assignedProviderName: null,
    assignedProviderRole: null,
    primaryOpenVisitId: null,
    waitingMinutes: null,
    currentStation: null,
    roomNumber: null,
    ipAdmission: null,
    ...partial,
  };
}

describe('registration card patient photo propagation', () => {
  it('preserves Directory photoThumbnailUrl as card photoUrl (does not drop)', () => {
    const mapped = registrationCardPatient(
      baseRow({
        photoThumbnailUrl: '/uploads/patients/sam.jpg',
      }),
    );
    expect(mapped.photoUrl).toBe('/uploads/patients/sam.jpg');
    expect(mapped.id).toBe('sam-1');
    expect(mapped.medicalRecordNumber).toBe('MRN-SAM');
  });

  it('omits photoUrl when Directory has no thumbnail (fallback avatar path)', () => {
    const mapped = registrationCardPatient(baseRow({ photoThumbnailUrl: null }));
    expect(mapped.photoUrl).toBeUndefined();
  });

  it('print HTML includes absolute photo src when photo_url is available', () => {
    const html = buildRegistrationCardPrintDocumentHtml({
      firstName: 'Sam',
      lastName: 'Aluri',
      medicalRecordNumber: 'MRN-SAM',
      dateOfBirth: '1987-08-01',
      gender: 'Male',
      contactNumber: '8919653433',
      photoUrl: 'https://cdn.example.com/patients/sam.jpg',
    });
    expect(html).toContain('class="rc-avatar"');
    expect(html).toContain('src="https://cdn.example.com/patients/sam.jpg"');
    // CSS may mention .rc-avatar-fallback; assert markup uses <img>, not fallback div.
    expect(html).toContain('<img class="rc-avatar"');
    expect(html).not.toContain('<div class="rc-avatar-fallback"');
    expect(html).toContain('@page{size:3.5in 2in;margin:0;}');
  });

  it('print HTML uses fallback avatar when photo is unavailable', () => {
    const html = buildRegistrationCardPrintDocumentHtml({
      firstName: 'Sam',
      lastName: 'Aluri',
      medicalRecordNumber: 'MRN-SAM',
      photoUrl: null,
    });
    expect(html).toContain('<div class="rc-avatar-fallback"');
    expect(html).not.toContain('<img class="rc-avatar"');
  });

  it('openRegistrationCardPrint resolves relative photo paths for about:blank', () => {
    const write = vi.fn();
    const openWindow = vi.fn(() => ({
      document: { write, close: vi.fn() },
    }));
    const result = openRegistrationCardPrint(
      {
        patient: {
          firstName: 'Sam',
          lastName: 'Aluri',
          medicalRecordNumber: 'MRN-SAM',
          photoUrl: '/uploads/patients/sam.jpg',
        },
      },
      { openWindow: openWindow as never },
    );
    expect(result.opened).toBe(true);
    const written = String(write.mock.calls[0]?.[0] ?? '');
    expect(written).toContain('class="rc-avatar"');
    expect(written).toMatch(/src="https?:\/\/[^"]*\/uploads\/patients\/sam\.jpg"/);
  });

  it('RegistrationCardPreview resolves photoUrl and Directory mapper keeps thumbnail', () => {
    const cell = readFileSync(
      join(process.cwd(), 'src/components/patients/lookup/PatientRegistrationCardDialog.tsx'),
      'utf8',
    );
    const preview = readFileSync(
      join(process.cwd(), 'src/components/patients/RegistrationCardPreview.tsx'),
      'utf8',
    );
    expect(cell).toContain('photoUrl: row.photoThumbnailUrl');
    expect(preview).toContain('resolvePatientPhotoUrl');
    expect(preview).toContain('registration-card-patient-photo');
    expect(preview).toContain('registration-card-photo-fallback');
  });
});
