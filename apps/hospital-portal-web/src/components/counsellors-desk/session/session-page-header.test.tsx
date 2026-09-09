import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Patient } from '@/lib/api/patients.api';
import { PatientDemographicsContent } from '@/components/examination/PatientDemographicsSheet';
import { SessionPageHeader } from '@/components/counsellors-desk/session/SessionPageHeader';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { CounsellingSession } from '@/types/counsellors-desk';

vi.mock('@/hooks/use-counsellor-master-options', () => ({
  useCounsellorMasterOptions: () => ({
    sessionTypeOptions: [
      { value: 'INITIAL', label: 'Initial Counselling' },
      { value: 'FOLLOW_UP', label: 'Follow-Up' },
    ],
  }),
}));

const basePatient: Patient = {
  id: 'p1',
  medicalRecordNumber: 'FRESH-009',
  patientCode: 'FRESH-009',
  firstName: 'Meena',
  lastName: 'Iyer',
  dateOfBirth: '1980-05-15',
  gender: 'Female',
  contactNumber: '9876543210',
  email: 'meena@example.com',
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
};

const baseSession = {
  id: 's1',
  patientId: 'p1',
  patientName: 'Meena Iyer',
  age: 45,
  gender: 'Female',
  uhid: 'FRESH-009',
  sessionTypeCode: 'INITIAL',
} as CounsellingSession;

describe('PatientDemographicsContent', () => {
  it('renders patient name from first/last and never undefined', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={basePatient}
        age={45}
        visitLabel={counsellingCopy.counsellingSession}
      />,
    );
    expect(html).toContain('Meena Iyer');
    expect(html).not.toContain('undefined');
    expect(html).toContain('FRESH-009');
  });

  it('uses displayNameFallback when first/last are missing', () => {
    const sparse = {
      ...basePatient,
      firstName: undefined as unknown as string,
      lastName: undefined as unknown as string,
    };
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={sparse}
        age={45}
        displayNameFallback="FRESH Patient Nine"
      />,
    );
    expect(html).toContain('FRESH Patient Nine');
    expect(html).not.toContain('undefined');
  });

  it('shows counselling visit/clinical rows when optional context provided', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={basePatient}
        age={45}
        visitLabel={counsellingCopy.counsellingSession}
        counsellingContext={{
          counsellingType: 'Initial Counselling',
          sessionStatus: 'Processing',
          operativeEye: 'RE',
          consultingDoctor: 'Dr. Rao',
        }}
      />,
    );
    expect(html).toContain('Initial Counselling');
    expect(html).toContain('Processing');
    expect(html).toContain('RE');
    expect(html).toContain('Dr. Rao');
    expect(html).toContain('Visit &amp; Session');
    expect(html).toContain('Clinical Context');
    expect(html).toContain('Session Status');
    expect(html).toContain('Consulting Doctor');
  });

  it('omits counselling visit/clinical sections when context omitted (optometry)', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={basePatient}
        age={45}
        visitLabel="Optometry examination"
      />,
    );
    expect(html).toContain('Optometry examination');
    expect(html).not.toContain('Consulting Doctor');
    expect(html).not.toContain('Session Status');
    expect(html).not.toContain('Clinical Context');
    expect(html).not.toContain('Visit &amp; Session');
  });

  it('hides empty contact fields rather than blank rows', () => {
    const noContact = {
      ...basePatient,
      contactNumber: undefined,
      phone: undefined,
      email: undefined,
      address: undefined,
      city: undefined,
    };
    const html = renderToStaticMarkup(
      <PatientDemographicsContent patient={noContact} age={45} />,
    );
    expect(html).toContain('No contact information available');
    expect(html).not.toMatch(/>\s*<\/span>/);
  });

  it('uses section widgets and human-readable sex casing', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={{ ...basePatient, gender: 'male' }}
        age={70}
        counsellingContext={{ operativeEye: 'BE' }}
      />,
    );
    expect(html).toContain('Male');
    expect(html).not.toContain('>male<');
    expect(html).toContain('rounded-xl');
    expect(html).toContain('shadow-sm');
    expect(html).toContain('Identity');
    expect(html).toContain('Contact');
    expect(html).toContain('Date of Birth');
    expect(html).toContain('!h-[88px]');
    expect(html).toContain('text-[20px] font-semibold');
    expect(html).toContain('text-[13px]');
    expect(html).toContain('text-[12.5px]');
  });

  it('does not duplicate hero identity fields inside Identity widget', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={basePatient}
        age={45}
        counsellingContext={{ operativeEye: 'RE' }}
      />,
    );
    // Hero carries name/MRN/age/sex/eye; Identity only adds DOB (and blood group when present).
    expect(html).toContain('Date of Birth');
    expect(html).not.toContain('Full Name');
    expect(html).not.toContain('UHID / MRN');
    const ageLabelMatches = html.match(/>Age</g) ?? [];
    expect(ageLabelMatches.length).toBe(0);
  });

  it('omits Identity widget when there is no extra identity beyond the hero', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={{ ...basePatient, dateOfBirth: undefined as unknown as string, bloodGroup: undefined }}
        age={45}
      />,
    );
    expect(html).toContain('Contact');
    expect(html).not.toContain('>Identity<');
  });
});

describe('SessionPageHeader', () => {
  it('renders patient name prominently and Patient Details action', () => {
    const html = renderToStaticMarkup(
      <SessionPageHeader
        session={baseSession}
        queueStatus="Processed"
        patientDetails={basePatient}
        consultingDoctor="Dr. Rao"
        operativeEye="RE"
      />,
    );
    expect(html).toContain('Meena Iyer');
    expect(html).toContain(counsellingCopy.patientDetails);
    expect(html).toContain(counsellingTestIds.btnPatientDetails);
    expect(html).toContain('FRESH-009');
    expect(html).toContain('Dr. Rao');
    expect(html).toContain('RE');
    expect(html).not.toContain('undefined');
  });

  it('keeps header name from session even if patient name fields missing', () => {
    const sparse = {
      ...basePatient,
      firstName: undefined as unknown as string,
      lastName: undefined as unknown as string,
    };
    const html = renderToStaticMarkup(
      <SessionPageHeader
        session={{ ...baseSession, patientName: 'Session Authoritative Name' }}
        queueStatus="Done"
        patientDetails={sparse}
      />,
    );
    expect(html).toContain('Session Authoritative Name');
    expect(html).not.toContain('undefined');
  });

  it('title-cases sex and uses two-letter initials from display name', () => {
    const html = renderToStaticMarkup(
      <SessionPageHeader
        session={{
          ...baseSession,
          patientName: 'Balakrishna Rao',
          gender: 'male',
        }}
        queueStatus="Processed"
        patientDetails={{
          ...basePatient,
          firstName: 'Balakrishna',
          lastName: '',
          gender: 'male',
        }}
      />,
    );
    expect(html).toContain('Male');
    expect(html).not.toContain('>male<');
    expect(html).toContain('BR');
  });

  it('uses stronger identity scale for photo/avatar and name typography', () => {
    const html = renderToStaticMarkup(
      <SessionPageHeader
        session={baseSession}
        queueStatus="Processed"
        patientDetails={basePatient}
      />,
    );
    expect(html).toContain('h-14');
    expect(html).toContain('w-14');
    expect(html).toContain('ring-2');
    expect(html).toContain('text-[20px]');
    expect(html).toContain('text-[12px]');
    expect(html).toContain('text-[13px]');
    expect(html).toContain('text-sm');
    expect(html).toContain('font-semibold');
    expect(html).toContain('text-counselling-primary');
    expect(html).toContain('MRN FRESH-009');
    expect(html).toContain(' · ');
  });
});
