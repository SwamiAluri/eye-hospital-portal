import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Patient } from '@/lib/api/patients.api';
import { PatientDemographicsContent, PatientDemographicsSheet } from '@/components/examination/PatientDemographicsSheet';
import { SessionPageHeader } from '@/components/counsellors-desk/session/SessionPageHeader';
import {
  ClinicalRecommendationsContent,
  ClinicalRecommendationsSheet,
} from '@/components/counsellors-desk/session/ClinicalRecommendationsSheet';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { OPTOMETRIST_RECOMMENDATION_PLACEHOLDER } from '@/lib/counsellors-desk/clinical-recommendations-placeholder';
import type { CounsellingSession } from '@/types/counsellors-desk';

vi.mock('@/hooks/use-counsellor-master-options', () => ({
  useCounsellorMasterOptions: () => ({
    sessionTypeOptions: [
      { value: 'INITIAL', label: 'Initial Counselling' },
      { value: 'FOLLOW_UP', label: 'Follow-Up' },
    ],
  }),
}));

/**
 * Radix Sheet portals do not render under renderToStaticMarkup (no document).
 * Mirror WaitingListPatientDetailSheet.test — passthrough when open so we can
 * assert Clinical Recommendations body content (blank-sheet regression).
 */
vi.mock('@/components/ui/sheet', () => {
  function passthrough(displayName: string) {
    const Comp = ({
      children,
      className,
      ...rest
    }: {
      children?: ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => (
      <div data-sheet={displayName} className={className} {...rest}>
        {children}
      </div>
    );
    Comp.displayName = displayName;
    return Comp;
  }

  return {
    Sheet: ({
      children,
      open,
    }: {
      children?: ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (open ? <div data-sheet="Sheet">{children}</div> : null),
    SheetContent: ({
      children,
      className,
      hideCloseButton,
      ...rest
    }: {
      children?: ReactNode;
      className?: string;
      hideCloseButton?: boolean;
      [key: string]: unknown;
    }) => {
      const {
        side: _side,
        overlayClassName: _overlay,
        overlayTestId: _otid,
        ...dom
      } = rest;
      return (
        <div data-sheet="SheetContent" className={className} {...dom}>
          {!hideCloseButton ? (
            <button type="button" data-sheet="SheetClose">
              <span className="sr-only">Close</span>
            </button>
          ) : null}
          {children}
        </div>
      );
    },
    SheetHeader: passthrough('SheetHeader'),
    SheetTitle: passthrough('SheetTitle'),
    SheetDescription: passthrough('SheetDescription'),
    SheetClose: passthrough('SheetClose'),
  };
});

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
    expect(html).not.toContain('>Mobile<');
    expect(html).not.toContain('>Email<');
    expect(html).not.toContain('>Address<');
  });

  it('uses polished section cards and human-readable sex casing', () => {
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
    expect(html).toContain('Gender');
    expect(html).toContain('Age');
    expect(html).toContain('70 years');
    expect(html).toContain('patient-details-identity-hero');
    expect(html).toContain('h-14');
    expect(html).toContain('w-14');
    expect(html).toContain('text-[18px] font-semibold');
    expect(html).toContain('text-[13px]');
    expect(html).toContain('text-[12.5px]');
    expect(html).toContain('lucide-user-round');
    expect(html).toContain('lucide-phone');
    expect(html).not.toContain('This information is pulled from the patient record');
    expect(html).not.toContain('provided to support your counselling session');
  });

  it('keeps Identity free of name/MRN labels while showing DOB gender age', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={basePatient}
        age={45}
        counsellingContext={{ operativeEye: 'RE' }}
      />,
    );
    expect(html).toContain('Date of Birth');
    expect(html).toContain('Gender');
    expect(html).toContain('Age');
    expect(html).toContain('45 years');
    expect(html).not.toContain('Full Name');
    expect(html).not.toContain('UHID / MRN');
  });

  it('omits Identity widget when no identity fields are available', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={{
          ...basePatient,
          dateOfBirth: undefined as unknown as string,
          bloodGroup: undefined,
          gender: undefined as unknown as string,
        }}
        age={null}
      />,
    );
    expect(html).toContain('Contact');
    expect(html).not.toContain('lucide-user-round');
    expect(html).not.toContain('Date of Birth');
  });

  it('renders counselling visit and clinical cards with status treatment', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsContent
        patient={basePatient}
        age={45}
        visitLabel={counsellingCopy.counsellingSession}
        counsellingContext={{
          counsellingType: 'Initial Counselling',
          sessionStatus: 'Pending',
          operativeEye: 'RE',
          consultingDoctor: 'Dr. Rao',
        }}
      />,
    );
    expect(html).toContain('Visit &amp; Session');
    expect(html).toContain('Clinical Context');
    expect(html).toContain('Initial Counselling');
    expect(html).toContain('Pending');
    expect(html).toContain('bg-amber-100');
    expect(html).toContain('lucide-calendar-days');
    expect(html).toContain('lucide-eye');
    expect(html).toContain('Dr. Rao');
  });
});

describe('PatientDemographicsSheet', () => {
  it('opens with title, sr-only description, close control, and no footer disclaimer', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsSheet
        open
        onClose={() => undefined}
        patient={basePatient}
        age={45}
        visitLabel={counsellingCopy.counsellingSession}
        counsellingContext={{
          counsellingType: 'Initial Counselling',
          sessionStatus: 'Pending',
          operativeEye: 'RE',
        }}
      />,
    );
    expect(html).toContain('data-sheet="Sheet"');
    expect(html).toContain(counsellingCopy.patientDetails);
    expect(html).toContain('patient-details-subtitle');
    expect(html).toContain('sr-only');
    expect(html).not.toContain(counsellingCopy.patientDetailsSubtitle);
    expect(html).not.toContain('Key information for this patient');
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('counselling-session');
    expect(html).toContain('Meena Iyer');
    expect(html).toContain('FRESH-009');
    expect(html).toContain('patient-details-identity-hero');
    expect(html).toContain('Identity');
    expect(html).toContain('Contact');
    expect(html).toContain('Visit &amp; Session');
    expect(html).toContain('Clinical Context');
    expect(html).toContain('45 yrs');
    expect(html).toContain('Female');
    expect(html).toContain('Eye RE');
    expect(html).not.toContain('This information is pulled from the patient record');
    expect(html).not.toContain('provided to support your counselling session');
  });

  it('uses compact field-row density for Identity and Visit sections', () => {
    const html = renderToStaticMarkup(
      <PatientDemographicsSheet
        open
        onClose={() => undefined}
        patient={basePatient}
        age={45}
        visitLabel={counsellingCopy.counsellingSession}
        counsellingContext={{
          counsellingType: 'Initial Counselling',
          sessionStatus: 'Pending',
          operativeEye: 'RE',
        }}
      />,
    );
    expect(html).toContain('gap-2');
    expect(html).toContain('py-1.5');
    expect(html).not.toContain('py-2.5 last:border-0');
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

  it('renders Clinical Recommendations and Patient Details as icon+label header buttons', () => {
    const html = renderToStaticMarkup(
      <SessionPageHeader
        session={baseSession}
        queueStatus="Processed"
        patientDetails={basePatient}
        doctorRecommendation="EDOF Lens (40cm-Distance)"
        operativeEye="RE"
      />,
    );

    expect(html).toContain(`data-testid="${counsellingTestIds.btnClinicalRecommendations}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.btnPatientDetails}"`);
    expect(html).toContain(`aria-label="${counsellingCopy.clinicalRecommendations}"`);
    expect(html).toContain(`aria-label="${counsellingCopy.patientDetails}"`);
    expect(html).toContain('type="button"');
    expect(html).toContain('lucide-stethoscope');
    expect(html).toContain('lucide-user-round');
    expect(html).toContain(counsellingCopy.clinicalRecommendations);

    // No chevron / arrow as primary action visual.
    expect(html).not.toContain('lucide-chevron-right');
    // Compact header only — no expanded amber recommendation panel.
    expect(html).not.toContain('border-l-2 border-amber-400/80 bg-amber-50/60');
    expect(html).not.toContain('EDOF Lens (40cm-Distance) · RE');
    expect(html).not.toContain(OPTOMETRIST_RECOMMENDATION_PLACEHOLDER.lines[0]);
    expect(html).not.toContain(`data-testid="${counsellingTestIds.clinicalRecommendationDoctor}"`);
    expect(html).not.toMatch(/role="tablist"|TabsTrigger/i);
  });

  it('keeps Clinical Recommendations trigger when Doctor recommendation is absent', () => {
    const html = renderToStaticMarkup(
      <SessionPageHeader
        session={baseSession}
        queueStatus="Processed"
        patientDetails={basePatient}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.btnClinicalRecommendations}"`);
    expect(html).toContain(counsellingCopy.clinicalRecommendations);
    expect(html).not.toContain('border-l-2 border-amber-400/80 bg-amber-50/60');
  });
});

describe('ClinicalRecommendationsContent', () => {
  it('renders Doctor and Optometrist cards — no patient identity or clinical-details CTA', () => {
    const html = renderToStaticMarkup(
      <ClinicalRecommendationsContent doctorRecommendationSummary="EDOF Lens (40cm-Distance) · RE" />,
    );

    expect(html).toContain(`data-testid="${counsellingTestIds.clinicalRecommendationsSheet}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.clinicalRecommendationDoctor}"`);
    expect(html).toContain('EDOF Lens (40cm-Distance) · RE');
    expect(html).toContain(counsellingCopy.clinicalRecommendationDoctorHint);
    expect(html).toContain(`data-testid="${counsellingTestIds.clinicalRecommendationOptometrist}"`);
    expect(html).toContain('Distance + near visual needs reviewed');
    expect(html).toContain('Optical correction discussed');
    expect(html).toContain(counsellingCopy.clinicalRecommendationOptometristHint);
    expect(html).not.toContain(`data-testid="${counsellingTestIds.clinicalRecommendationsCallout}"`);
    expect(html).not.toContain(counsellingCopy.clinicalRecommendationsCallout);
    expect(html).not.toContain('Key recommendations from the clinical team');
    expect(html).not.toContain('UX placeholders until clinical sources are connected');
    expect(html).toContain('lucide-check');
    expect(html).toContain('rounded-xl');
    expect(html).toContain('bg-sky-50/90');
    expect(html).toContain('bg-emerald-50/90');

    expect(html).not.toContain('Meena Iyer');
    expect(html).not.toContain('MRN ');
    expect(html).not.toContain(`>${counsellingCopy.patient}<`);
    expect(html).not.toContain(counsellingCopy.viewClinicalDetails);
    expect(html).not.toMatch(/View optometrist details|optometrist-details|\/optometrist\//i);
    expect(html).not.toMatch(/role="tablist"|TabsTrigger/i);
  });

  it('omits Doctor section when recommendation summary is absent', () => {
    const html = renderToStaticMarkup(
      <ClinicalRecommendationsContent doctorRecommendationSummary={null} />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.clinicalRecommendationOptometrist}"`);
    expect(html).not.toContain(`data-testid="${counsellingTestIds.clinicalRecommendationDoctor}"`);
    expect(html).not.toContain(`data-testid="${counsellingTestIds.clinicalRecommendationsCallout}"`);
  });
});

describe('ClinicalRecommendationsSheet (blank-sheet regression)', () => {
  it('when open, renders polished Sheet with Doctor + Optometrist cards', () => {
    const html = renderToStaticMarkup(
      <ClinicalRecommendationsSheet
        open
        onClose={() => undefined}
        doctorRecommendationSummary="EDOF Lens (40cm-Distance) · RE"
      />,
    );

    expect(html).toContain('data-sheet="Sheet"');
    expect(html).toContain('data-sheet="SheetContent"');
    expect(html).toContain('counselling-session');
    expect(html).toContain(counsellingCopy.clinicalRecommendations);
    expect(html).toContain(`data-testid="${counsellingTestIds.clinicalRecommendationsSubtitle}"`);
    expect(html).toContain('sr-only');
    expect(html).not.toContain(counsellingCopy.clinicalRecommendationsSubtitle);
    expect(html).not.toContain('Key recommendations from the clinical team');
    expect(html).toContain('aria-label="Close"');

    expect(html).toContain(`data-testid="${counsellingTestIds.clinicalRecommendationDoctor}"`);
    expect(html).toContain('EDOF Lens (40cm-Distance) · RE');
    expect(html).toContain(`data-testid="${counsellingTestIds.clinicalRecommendationOptometrist}"`);
    expect(html).toContain('Distance + near visual needs reviewed');
    expect(html).toContain('Optical correction discussed');
    expect(html).not.toContain(`data-testid="${counsellingTestIds.clinicalRecommendationsCallout}"`);
    expect(html).not.toContain(counsellingCopy.clinicalRecommendationsCallout);

    expect(html).not.toContain('Vikram UAT-IP-127');
    expect(html).not.toContain('MRN UAT-MR-127');
    expect(html).not.toContain(counsellingCopy.viewClinicalDetails);
    expect(html).not.toMatch(/View optometrist details|optometrist-details|\/optometrist\//i);
  });

  it('when closed, does not mount recommendation body', () => {
    const html = renderToStaticMarkup(
      <ClinicalRecommendationsSheet
        open={false}
        onClose={() => undefined}
        doctorRecommendationSummary="EDOF Lens (40cm-Distance) · RE"
      />,
    );
    expect(html).toBe('');
  });

  it('still shows Optometrist when Doctor recommendation is missing', () => {
    const html = renderToStaticMarkup(
      <ClinicalRecommendationsSheet
        open
        onClose={() => undefined}
        doctorRecommendationSummary={null}
      />,
    );
    expect(html).toContain(counsellingCopy.clinicalRecommendations);
    expect(html).toContain(`data-testid="${counsellingTestIds.clinicalRecommendationOptometrist}"`);
    expect(html).toContain('Distance + near visual needs reviewed');
    expect(html).not.toContain(`data-testid="${counsellingTestIds.clinicalRecommendationDoctor}"`);
  });
});
