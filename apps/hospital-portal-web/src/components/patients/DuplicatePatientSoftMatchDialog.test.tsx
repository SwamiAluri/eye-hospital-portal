import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DuplicatePatientSoftMatchContent } from '@/components/patients/DuplicatePatientSoftMatchDialog';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const registrationDraft = {
  firstName: 'Samuel',
  lastName: 'Levin',
  dateOfBirth: '1987-08-01',
  gender: 'male',
  phone: '+91 98765 43210',
};

describe('DuplicatePatientSoftMatchDialog (DUP-C3A.2d / UX correction)', () => {
  it('renders comparison shell with new registration and existing patient sections', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'c1',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-2026-10-49562',
            dateOfBirth: '1987-08-01',
            gender: 'male',
            matchType: 'PhoneMatch',
            matchedAttributes: ['FirstName', 'DateOfBirth', 'Phone'],
            differentAttributes: ['LastName'],
          },
        ]}
        onDismiss={() => undefined}
        onReviewMatchingInformation={() => undefined}
        onContinueRegistration={() => undefined}
      />,
    );

    expect(html).toContain('Possible Duplicate Patient');
    expect(html).toContain('Review the existing patient before continuing.');
    expect(html).toContain('New registration');
    expect(html).toContain('Samuel Levin');
    expect(html).toContain('Phone ending 3210');
    expect(html).toContain('Existing patient');
    expect(html).toContain('Samuel Aluri');
    expect(html).toContain('MRN-2026-10-49562');
    expect(html).toContain('Match review');
    expect(html).toContain('First name');
    expect(html).toContain('Date of birth');
    expect(html).toContain('Phone number');
    expect(html).toContain('Last name');
    expect(html).toContain('Matches');
    expect(html).toContain('Different');
    expect(html).not.toContain('Edit Registration');
    expect(html).not.toContain('Back to Registration');
    expect(html).not.toContain('data-testid="duplicate-soft-match-back"');
    expect(html).toContain('Review matching information');
    expect(html).toContain('Continue Registration');
    expect(html).toContain('data-testid="duplicate-soft-match-continue"');
    expect(html).not.toContain('Create Anyway');
    expect(html).not.toContain('Open Patient');
    expect(html).not.toContain('Merge');
    expect(html).not.toContain('Patient 360');
    expect(html).not.toContain('98765 43210');
    expect(html).not.toContain('+91');
    expect(html).not.toContain('matchConfidence');
    expect(html).not.toContain('0.90');
    expect(html).not.toContain('PhoneMatch');
    expect(html).not.toContain('Phone number match');
    expect(html).not.toContain('Last name differs');
    expect(html).not.toContain('similar information');
  });

  it('renders DateOfBirth + Phone matchedAttributes together (no MatchType-only drop)', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'c-samuel',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-2026-10-49562',
            dateOfBirth: '1987-08-01',
            matchType: 'PhoneMatch',
            matchedAttributes: ['DateOfBirth', 'Phone'],
            differentAttributes: ['FirstName', 'LastName'],
          },
        ]}
        onDismiss={() => undefined}
        onReviewMatchingInformation={() => undefined}
        onContinueRegistration={() => undefined}
      />,
    );
    expect(html).toContain('Date of birth');
    expect(html).toContain('Phone number');
    expect(html).toContain('aria-label="Date of birth: Matches"');
    expect(html).toContain('aria-label="Phone number: Matches"');
    expect(html).toContain('data-testid="duplicate-soft-match-matched-c-samuel-DateOfBirth"');
    expect(html).toContain('data-testid="duplicate-soft-match-matched-c-samuel-Phone"');
    expect(html).not.toContain('Back to Registration');
    expect(html).not.toContain('data-testid="duplicate-soft-match-back"');
    expect(html).toContain('Continue Registration');
    expect(html).toContain('data-testid="duplicate-soft-match-continue"');
  });

  it('renders Name + Date of birth when FirstName+LastName+DateOfBirth matched', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'c-name-dob',
            firstName: 'Sam',
            lastName: 'Badikolu',
            medicalRecordNumber: 'MRN-X',
            dateOfBirth: '1987-08-01',
            matchType: 'PhoneMatch',
            matchedAttributes: ['FirstName', 'LastName', 'DateOfBirth'],
            differentAttributes: ['Phone'],
          },
        ]}
        onContinueRegistration={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Name: Matches"');
    expect(html).toContain('aria-label="Date of birth: Matches"');
    expect(html).not.toContain('aria-label="First name: Matches"');
    expect(html).not.toContain('aria-label="Last name: Matches"');
  });

  it('phone-only matchedAttributes render Phone number alone', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'c-phone',
            firstName: 'Other',
            lastName: 'Person',
            medicalRecordNumber: 'MRN-P',
            matchType: 'PhoneMatch',
            matchedAttributes: ['Phone'],
            differentAttributes: ['FirstName', 'LastName', 'DateOfBirth'],
          },
        ]}
        onContinueRegistration={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Phone number: Matches"');
    expect(html).not.toContain('aria-label="Date of birth: Matches"');
    expect(html).not.toContain('aria-label="Name: Matches"');
  });

  it('matched rows use red check + Matches + emphasized attribute', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'c1',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-1',
            dateOfBirth: '1987-08-01',
            matchType: 'PhoneMatch',
            matchedAttributes: ['FirstName', 'Phone'],
            differentAttributes: [],
          },
        ]}
        onContinueRegistration={() => undefined}
      />,
    );

    expect(html).toContain('data-evidence-state="matches"');
    expect(html).toContain('aria-label="First name: Matches"');
    expect(html).toContain('aria-label="Phone number: Matches"');
    expect(html).toContain('text-red-600');
    expect(html).toContain('font-semibold');
    expect(html).toContain('Matches');
    expect(html).not.toContain('data-evidence-state="different"');
  });

  it('different rows use green check + Different + emphasized attribute (no dash)', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'c1',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-1',
            dateOfBirth: '1987-08-01',
            matchType: 'PhoneMatch',
            matchedAttributes: ['Phone'],
            differentAttributes: ['LastName'],
          },
        ]}
        onContinueRegistration={() => undefined}
      />,
    );

    expect(html).toContain('data-evidence-state="different"');
    expect(html).toContain('aria-label="Last name: Different"');
    expect(html).toContain('text-green-600');
    expect(html).toContain('Different');
    expect(html).not.toContain('—');
    expect(html).not.toContain('Last name differs');
    expect(html).not.toContain('aria-hidden">—');
  });

  it('renders candidate-specific evidence independently', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'a',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-A',
            dateOfBirth: '1987-08-01',
            matchType: 'PhoneMatch',
            matchedAttributes: ['FirstName', 'DateOfBirth', 'Phone'],
            differentAttributes: ['LastName'],
          },
          {
            id: 'b',
            firstName: 'Samuel',
            lastName: 'Lee',
            medicalRecordNumber: 'MRN-B',
            dateOfBirth: '1990-01-01',
            matchType: 'PhoneMatch',
            matchedAttributes: ['FirstName', 'Phone'],
            differentAttributes: ['LastName', 'DateOfBirth'],
          },
        ]}
        onContinueRegistration={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="duplicate-soft-match-matched-a-DateOfBirth"');
    expect(html).not.toContain('data-testid="duplicate-soft-match-matched-b-DateOfBirth"');
    expect(html).toContain('data-testid="duplicate-soft-match-different-b-DateOfBirth"');
    expect(html).toContain('data-testid="duplicate-soft-match-matched-b-Phone"');
    expect(html).toContain('aria-label="Date of birth: Matches"');
    expect(html).toContain('aria-label="Date of birth: Different"');
    expect(html).toContain('MRN-A');
    expect(html).toContain('MRN-B');
  });

  it('renders Email matched label and omits raw email / confidence', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={{
          firstName: 'Sam',
          lastName: 'Aluri',
          dateOfBirth: '1987-08-01',
          gender: 'male',
        }}
        candidates={[
          {
            id: 'e1',
            firstName: 'Sam',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-E',
            dateOfBirth: '1987-08-01',
            matchType: 'EmailMatch',
            matchedAttributes: ['Email'],
            differentAttributes: [],
          },
        ]}
        onContinueRegistration={() => undefined}
      />,
    );
    expect(html).toContain('Email');
    expect(html).toContain('aria-label="Email: Matches"');
    expect(html).not.toContain('EmailMatch');
    expect(html).not.toContain('Email address match');
    expect(html).not.toContain('@');
    expect(html).not.toContain('0.90');
  });

  it('does not expose full phone or email from candidates', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'c1',
            firstName: 'Sam',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-1',
            matchType: 'PhoneMatch',
            matchedAttributes: ['Phone'],
            differentAttributes: ['FirstName', 'LastName', 'DateOfBirth'],
          },
        ]}
        onContinueRegistration={() => undefined}
      />,
    );
    expect(html).not.toContain('9800000001');
    expect(html).not.toContain('contactNumber');
    expect(html).not.toContain('differenceReason');
    expect(html).toContain('Phone number');
    expect(html).toContain('aria-label="First name: Different"');
  });

  it('candidate rows are selectable radios; Edit Registration is absent', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'c1',
            firstName: 'Sam',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-1',
            matchType: 'PhoneMatch',
            matchedAttributes: ['Phone'],
            differentAttributes: [],
          },
        ]}
        onDismiss={() => undefined}
        onReviewMatchingInformation={() => undefined}
        onContinueRegistration={() => undefined}
      />,
    );
    expect(html).toContain('data-testid="duplicate-soft-match-candidate-c1"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain('data-testid="duplicate-soft-match-edit"');
    expect(html).not.toContain('Edit Registration');
    expect(html).toContain('data-testid="duplicate-soft-match-review"');
    expect(html).toContain('Review matching information');
    expect(html).toContain('data-testid="duplicate-soft-match-continue"');
    expect(html).toContain('Continue Registration');
    expect(html).not.toContain('Back to Registration');
    expect(html).not.toContain('data-testid="duplicate-soft-match-back"');
    // Optional header dismiss (X) may remain; footer Back must not.
    expect(html).toContain('data-testid="duplicate-soft-match-dismiss"');
    expect(html).toContain('overflow-y-auto');
    expect(html).not.toContain('overflow-x-auto');
  });

  it('soft footer is Review + Continue only (no Back to Registration)', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'c1',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-2026-10-49562',
            dateOfBirth: '1987-08-01',
            matchType: 'PhoneMatch',
            matchedAttributes: ['DateOfBirth', 'Phone'],
            differentAttributes: ['FirstName', 'LastName'],
          },
        ]}
        onReviewMatchingInformation={() => undefined}
        onContinueRegistration={() => undefined}
      />,
    );
    expect(html).toContain('Review matching information');
    expect(html).toContain('Continue Registration');
    expect(html).not.toContain('Back to Registration');
    expect(html).not.toContain('duplicate-soft-match-back');
  });

  it('keeps candidate-specific evidence independent when selecting among multiple candidates', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={registrationDraft}
        candidates={[
          {
            id: 'a',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-A',
            matchType: 'PhoneMatch',
            matchedAttributes: ['FirstName', 'DateOfBirth'],
            differentAttributes: ['LastName'],
          },
          {
            id: 'b',
            firstName: 'Samuel',
            lastName: 'Lee',
            medicalRecordNumber: 'MRN-B',
            matchType: 'PhoneMatch',
            matchedAttributes: ['Phone'],
            differentAttributes: ['DateOfBirth'],
          },
        ]}
        onReviewMatchingInformation={() => undefined}
        onContinueRegistration={() => undefined}
      />,
    );
    expect(html).toContain('data-testid="duplicate-soft-match-matched-a-DateOfBirth"');
    expect(html).toContain('data-testid="duplicate-soft-match-matched-b-Phone"');
    expect(html).toContain('data-testid="duplicate-soft-match-different-b-DateOfBirth"');
    expect(html).toContain('Select a possible match to review its evidence.');
  });

  it('soft content keeps approved actions and server evidence only; no Edit Registration', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/patients/DuplicatePatientSoftMatchDialog.tsx'),
      'utf8',
    );
    expect(source).toContain("from '@/components/ui/dialog'");
    expect(source).toContain('DialogTitle');
    expect(source).toContain('DialogDescription');
    expect(source).not.toContain('Edit Registration');
    expect(source).toContain('Continue Registration');
    expect(source).toContain('Review matching information');
    expect(source).not.toContain('Back to Registration');
    expect(source).not.toContain('duplicate-soft-match-back');
    expect(source).toContain('text-red-600');
    expect(source).toContain('text-green-600');
    expect(source).toContain('Matches');
    expect(source).toContain('Different');
    expect(source).toContain('matchedAttributes');
    expect(source).toContain('differentAttributes');
    expect(source).not.toContain('Create Anyway');
    expect(source).not.toContain('Ignore');
    expect(source).not.toContain('Patient 360');
    expect(source).not.toContain('Merge');
    expect(source).not.toContain('resolveDuplicateMatchPresentation');
    expect(source).not.toContain('firstName ===');
    expect(source).not.toContain('draft?.firstName ===');
    expect(source).not.toMatch(/>\s*—\s*</);
    expect(source).not.toContain('formatDifferentAttributeLabel');
  });

  it('continue handler remains uncalled on render; Edit Registration action absent', () => {
    const onContinue = vi.fn();
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        candidates={[]}
        registrationDraft={registrationDraft}
        onContinueRegistration={onContinue}
      />,
    );
    expect(html).not.toContain('Edit Registration');
    expect(html).toContain('Continue Registration');
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('omits new-registration phone when fewer than four digits', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientSoftMatchContent
        registrationDraft={{
          firstName: 'Sam',
          lastName: 'Aluri',
          dateOfBirth: '1987-08-01',
          gender: 'male',
          phone: '12',
        }}
        candidates={[]}
        onContinueRegistration={() => undefined}
      />,
    );
    expect(html).not.toContain('Phone ending');
    expect(html).toContain('Sam Aluri');
  });
});
