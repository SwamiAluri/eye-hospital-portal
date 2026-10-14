import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DuplicatePatientHardBlockContent } from '@/components/patients/DuplicatePatientHardBlockDialog';

const noop = () => undefined;

describe('DuplicatePatientHardBlockContent', () => {
  it('uses Possible Duplicate Patient title and a single description', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientHardBlockContent
        duplicates={[
          {
            id: 'pat-1',
            firstName: 'Sam',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-100',
            dateOfBirth: '1987-01-01',
            gender: 'male',
            matchType: 'ExactNameDOB',
          },
        ]}
        onBackToRegistration={noop}
        onReviewMatching={noop}
      />,
    );
    expect(html).toContain('Possible Duplicate Patient');
    expect(html).toContain(
      'We found existing patients with matching information. Review the match before creating a new patient.',
    );
    expect(html).toContain('Existing patients');
    expect(html).not.toContain('Duplicate Patient Detected');
    expect(html).not.toContain('Review the matching information before creating a new record.');
    expect(html).not.toContain('An existing patient matches the information entered');
    // description appears once in titled content (not repeated under section)
    const description =
      'We found existing patients with matching information. Review the match before creating a new patient.';
    expect(html.split(description).length - 1).toBe(1);
  });

  it('renders ExactNameDOB matched information without candidate actions', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientHardBlockContent
        duplicates={[
          {
            id: 'pat-1',
            firstName: 'Sam',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-100',
            dateOfBirth: '1987-01-01',
            gender: 'male',
            matchType: 'ExactNameDOB',
          },
        ]}
        onBackToRegistration={noop}
        onReviewMatching={noop}
      />,
    );
    expect(html).toContain('Sam Aluri');
    expect(html).toContain('MRN-100');
    expect(html).toContain('male');
    expect(html).toContain('Matched information');
    expect(html).toContain('Name');
    expect(html).toContain('Date of birth');
    expect(html).toContain('aria-label="Matched information: Name, Date of birth"');
    expect(html).toContain('Back to Registration');
    expect(html).toContain('Review matching information');
    expect(html).toContain('data-testid="duplicate-hard-block-candidate-list"');
    expect(html).not.toContain('Open Patient 360');
    expect(html).not.toContain('Create Anyway');
    expect(html).not.toContain('Override');
    expect(html).not.toContain('Merge');
    expect(html).not.toContain('Use this patient');
    expect(html).not.toContain('Confidence');
    expect(html).not.toContain('Levenshtein');
    expect(html).not.toContain('9999900000');
    expect(html).not.toContain('@example.com');
    expect(html).not.toContain('href="/dashboard/patients/');
  });

  it('renders PhoneMatch and EmailMatch presentations without raw PHI', () => {
    const phoneHtml = renderToStaticMarkup(
      <DuplicatePatientHardBlockContent
        duplicates={[
          {
            id: 'pat-phone',
            firstName: 'Sam',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-P',
            matchType: 'PhoneMatch',
          },
        ]}
        onBackToRegistration={noop}
        onReviewMatching={noop}
      />,
    );
    expect(phoneHtml).toContain('Phone number');
    expect(phoneHtml).toContain('aria-label="Matched information: Phone number"');
    expect(phoneHtml).not.toContain('9800000001');
    expect(phoneHtml).not.toContain('Open Patient 360');

    const emailHtml = renderToStaticMarkup(
      <DuplicatePatientHardBlockContent
        duplicates={[
          {
            id: 'pat-email',
            firstName: 'Sam',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-E',
            matchType: 'EmailMatch',
          },
        ]}
        onBackToRegistration={noop}
        onReviewMatching={noop}
      />,
    );
    expect(emailHtml).toContain('Email');
    expect(emailHtml).toContain('aria-label="Matched information: Email"');
    expect(emailHtml).not.toContain('@hospital.com');
  });

  it('renders ALL server matchedAttributes for PhoneMatch (DateOfBirth + Phone)', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientHardBlockContent
        duplicates={[
          {
            id: 'pat-dob-phone',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-2026-10-49562',
            dateOfBirth: '1987-08-01',
            matchType: 'PhoneMatch',
            matchedAttributes: ['DateOfBirth', 'Phone'],
            differentAttributes: ['FirstName', 'LastName'],
          },
        ]}
        onBackToRegistration={noop}
        onReviewMatching={noop}
      />,
    );
    expect(html).toContain('Date of birth');
    expect(html).toContain('Phone number');
    expect(html).toContain('aria-label="Matched information: Date of birth, Phone number"');
  });

  it('renders FuzzyNameDOB and unknown match details', () => {
    const fuzzyHtml = renderToStaticMarkup(
      <DuplicatePatientHardBlockContent
        duplicates={[
          {
            id: 'pat-fuzzy',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-F',
            dateOfBirth: '1987-01-01',
            matchType: 'FuzzyNameDOB',
          },
        ]}
        onBackToRegistration={noop}
        onReviewMatching={noop}
      />,
    );
    expect(fuzzyHtml).toContain('Similar name');
    expect(fuzzyHtml).toContain('Date of birth');
    expect(fuzzyHtml).toContain('aria-label="Matched information: Similar name, Date of birth"');

    const unknownHtml = renderToStaticMarkup(
      <DuplicatePatientHardBlockContent
        duplicates={[
          {
            id: 'pat-1',
            firstName: 'Sam',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-100',
          },
        ]}
        onBackToRegistration={noop}
        onReviewMatching={noop}
      />,
    );
    expect(unknownHtml).toContain('Matched information');
    expect(unknownHtml).toContain('Match details unavailable');
    expect(unknownHtml).toContain('Review matching information');
  });

  it('renders multiple candidates with per-candidate matched evidence and no actions', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientHardBlockContent
        duplicates={[
          {
            id: 'pat-1',
            firstName: 'Sam',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-1',
            dateOfBirth: '1987-01-01',
            matchType: 'PhoneMatch',
          },
          {
            id: 'pat-2',
            firstName: 'Samuel',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-2',
            dateOfBirth: '1987-01-01',
            matchType: 'FuzzyNameDOB',
          },
          {
            id: 'pat-3',
            firstName: 'S',
            lastName: 'Aluri',
            medicalRecordNumber: 'MRN-3',
            dateOfBirth: '1987-01-01',
            matchType: 'ExactNameDOB',
          },
        ]}
        onBackToRegistration={noop}
        onReviewMatching={noop}
      />,
    );
    expect(html).toContain('duplicate-hard-block-candidate-pat-1');
    expect(html).toContain('duplicate-hard-block-candidate-pat-2');
    expect(html).toContain('duplicate-hard-block-candidate-pat-3');
    expect(html).toContain('aria-label="Matched information: Phone number"');
    expect(html).toContain('aria-label="Matched information: Similar name, Date of birth"');
    expect(html).toContain('aria-label="Matched information: Name, Date of birth"');
    expect(html).toContain('max-h-[min(18rem,40vh)]');
    expect(html).not.toContain('Open Patient 360');
    expect(html).not.toContain('duplicate-hard-block-open-');
    expect(html).not.toContain('Create Anyway');
    expect(html).not.toContain('Override');
    expect(html).not.toContain('Merge');
  });

  it('keeps accessible footer actions and selectable candidates for review context', () => {
    const html = renderToStaticMarkup(
      <DuplicatePatientHardBlockContent
        duplicates={[
          {
            id: 'pat-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            medicalRecordNumber: 'MRN-A',
            matchType: 'ExactNameDOB',
          },
        ]}
        onBackToRegistration={noop}
        onReviewMatching={noop}
      />,
    );
    expect(html).toContain('Possible Duplicate Patient');
    expect(html).toContain('data-testid="duplicate-hard-block-back"');
    expect(html).toContain('data-testid="duplicate-hard-block-review"');
    expect(html).toContain('aria-label="Matched information: Name, Date of birth"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('Open Patient 360');
    // Hard block is not soft acknowledgement — no Continue registration path.
    expect(html).not.toContain('Continue Registration');
    expect(html).not.toContain('Continue registration');
    expect(html).not.toContain('duplicate-soft-match-continue');
  });
});

describe('AddPatientWizard duplicate hard-block wiring', () => {
  it('keeps hard-block wiring without Patient 360 navigation from the dialog', () => {
    const wizard = readFileSync(resolve(__dirname, 'AddPatientWizard.tsx'), 'utf8');
    const dialog = readFileSync(resolve(__dirname, 'DuplicatePatientHardBlockDialog.tsx'), 'utf8');
    expect(wizard).toContain('parseDuplicateHardBlockError');
    expect(wizard).toContain('DuplicatePatientHardBlockDialog');
    expect(wizard).toContain('setDuplicateHardBlockOpen(true)');
    expect(wizard).toContain('setSavedPatient(null)');
    expect(wizard).toContain('onReviewMatching={(candidate) =>');
    expect(wizard).toContain("openDuplicateReviewForCandidate(candidate, 'hard')");
    expect(wizard).toContain('goToCompletedStep');
    expect(wizard).toContain('toast.error');
    expect(wizard).toContain('onDuplicatePhaseChange');
    expect(wizard).toContain("setCurrentStepId('REVIEW')");
    expect(wizard).toContain('hostDuplicateDialogsExternally');
    expect(wizard).not.toContain('onOpenPatient360');
    expect(wizard).not.toContain('openExistingPatient360');
    expect(wizard).not.toContain('patientProfileUrl');
    // DUP-C.3 uses create-scoped registration check; view-gated path must stay unused.
    expect(wizard).toContain('checkDuplicatesForRegistration');
    expect(wizard).not.toContain('"/patients/check-duplicates"');
    expect(wizard).not.toContain('Create Anyway');
    expect(wizard).not.toContain('onProceedAnyway');
    expect(dialog).toContain('DialogTitle');
    expect(dialog).toContain('DialogDescription');
    expect(dialog).toContain('Possible Duplicate Patient');
    expect(dialog).toContain('Matched information');
    expect(dialog).toContain('resolveMatchedEvidenceLabels');
    expect(dialog).toContain('Review matching information');
    expect(dialog).toContain('Back to Registration');
    expect(dialog).toContain('w-[min(100vw-1.5rem,36rem)]');
    expect(dialog).not.toContain('Open Patient 360');
    expect(dialog).not.toContain('onOpenPatient360');
    expect(dialog).not.toContain('useHasPermission');
    expect(dialog).not.toContain('patientProfileUrl');
    expect(dialog).not.toContain('Create Anyway');
    expect(dialog).not.toContain('MatchConfidence');
    expect(dialog).not.toContain('DifferenceReason');
  });
});
