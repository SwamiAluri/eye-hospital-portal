import { describe, expect, it } from 'vitest';
import {
  formatDifferentAttributeLabel,
  formatMatchedAttributeLabel,
  formatMatchedEvidenceLabels,
  formatRegistrationPhoneEnding,
  parseRegistrationDuplicateCheckResult,
  registrationIdentityFingerprint,
  resolveMatchedEvidenceLabels,
  shouldShowSoftDuplicateReview,
  toSoftMatchCandidates,
} from '@/lib/patients/registration-duplicate-check';

describe('registration-duplicate-check (DUP-C.3 / DUP-C3A.2c)', () => {
  it('parses minimized registration check response including evidence arrays', () => {
    const parsed = parseRegistrationDuplicateCheckResult({
      isDuplicate: true,
      message: 'Possible matching patients were found. Review before creating a new patient.',
      matches: [
        {
          id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          medicalRecordNumber: 'MRN-1',
          firstName: 'Sam',
          lastName: 'Aluri',
          dateOfBirth: '1987-08-01',
          gender: 'male',
          matchType: 'PhoneMatch',
          matchedAttributes: ['FirstName', 'DateOfBirth', 'Phone'],
          differentAttributes: ['LastName'],
        },
      ],
    });
    expect(parsed.isDuplicate).toBe(true);
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.matches[0]?.matchType).toBe('PhoneMatch');
    expect(parsed.matches[0]?.medicalRecordNumber).toBe('MRN-1');
    expect(parsed.matches[0]?.matchedAttributes).toEqual([
      'FirstName',
      'DateOfBirth',
      'Phone',
    ]);
    expect(parsed.matches[0]?.differentAttributes).toEqual(['LastName']);
    expect(parsed.matches[0]).not.toHaveProperty('contactNumber');
    expect(parsed.matches[0]).not.toHaveProperty('email');
    expect(parsed.matches[0]).not.toHaveProperty('matchConfidence');
    expect(parsed.matches[0]).not.toHaveProperty('differenceReason');
  });

  it('ignores unknown attribute signals and preserves empty arrays', () => {
    const parsed = parseRegistrationDuplicateCheckResult({
      isDuplicate: true,
      matches: [
        {
          id: '1',
          matchType: 'PhoneMatch',
          matchedAttributes: ['Phone', 'HealthId', 'Phone'],
          differentAttributes: null,
        },
      ],
    });
    expect(parsed.matches[0]?.matchedAttributes).toEqual(['Phone']);
    expect(parsed.matches[0]?.differentAttributes).toEqual([]);
  });

  it('shows soft review for soft MatchTypes only', () => {
    expect(
      shouldShowSoftDuplicateReview({
        isDuplicate: true,
        matches: [{ id: '1', matchType: 'PhoneMatch' }],
      }),
    ).toBe(true);
    expect(
      shouldShowSoftDuplicateReview({
        isDuplicate: true,
        matches: [{ id: '1', matchType: 'EmailMatch' }],
      }),
    ).toBe(true);
    expect(
      shouldShowSoftDuplicateReview({
        isDuplicate: true,
        matches: [{ id: '1', matchType: 'FuzzyNameDOB' }],
      }),
    ).toBe(true);
  });

  it('skips soft review for ExactNameDOB so create hard-block remains authoritative', () => {
    expect(
      shouldShowSoftDuplicateReview({
        isDuplicate: true,
        matches: [{ id: '1', matchType: 'ExactNameDOB' }],
      }),
    ).toBe(false);
  });

  it('preserves live Samuel Aluri Aug 1 PhoneMatch DateOfBirth+Phone attributes', () => {
    // Runtime probe shape for MRN-2026-10-49562 — must not drop DateOfBirth.
    const parsed = parseRegistrationDuplicateCheckResult({
      isDuplicate: true,
      matches: [
        {
          id: '03cfe1cc-74f5-48a1-8094-555426b2e3c3',
          medicalRecordNumber: 'MRN-2026-10-49562',
          firstName: 'Samuel',
          lastName: 'Aluri',
          dateOfBirth: '1987-08-01T00:00:00Z',
          gender: 'Male',
          matchType: 'PhoneMatch',
          matchedAttributes: ['DateOfBirth', 'Phone'],
          differentAttributes: ['FirstName', 'LastName'],
        },
      ],
    });
    expect(parsed.matches[0]?.matchedAttributes).toEqual(['DateOfBirth', 'Phone']);
    expect(formatMatchedEvidenceLabels(parsed.matches[0]?.matchedAttributes)).toEqual([
      'Date of birth',
      'Phone number',
    ]);
    const mapped = toSoftMatchCandidates(parsed.matches);
    expect(mapped[0]?.matchedAttributes).toEqual(['DateOfBirth', 'Phone']);
  });

  it('skips soft review when no candidates', () => {
    expect(shouldShowSoftDuplicateReview({ isDuplicate: false, matches: [] })).toBe(false);
    expect(shouldShowSoftDuplicateReview({ isDuplicate: true, matches: [] })).toBe(false);
  });

  it('invalidates acknowledgement fingerprint when identity fields change', () => {
    const a = registrationIdentityFingerprint({
      firstName: 'Sam',
      lastName: 'Aluri',
      dateOfBirth: '1987-08-01',
      phone: '9876543210',
      email: 'a@x.com',
    });
    const b = registrationIdentityFingerprint({
      firstName: 'Sam',
      lastName: 'Aluri',
      dateOfBirth: '1987-08-01',
      phone: '9876543211',
      email: 'a@x.com',
    });
    expect(a).not.toBe(b);
  });

  it('maps candidates with evidence and without confidence for soft dialog', () => {
    const mapped = toSoftMatchCandidates([
      {
        id: '1',
        firstName: 'Sam',
        lastName: 'Aluri',
        medicalRecordNumber: 'MRN-1',
        dateOfBirth: '1987-08-01',
        gender: 'male',
        matchType: 'PhoneMatch',
        matchedAttributes: ['FirstName', 'Phone'],
        differentAttributes: ['LastName'],
      },
    ]);
    expect(mapped[0]?.matchConfidence).toBeNull();
    expect(mapped[0]?.matchType).toBe('PhoneMatch');
    expect(mapped[0]?.matchedAttributes).toEqual(['FirstName', 'Phone']);
    expect(mapped[0]?.differentAttributes).toEqual(['LastName']);
  });

  it('maps attribute signals to concise UI labels without inventing evidence', () => {
    expect(formatMatchedAttributeLabel('FirstName')).toBe('First name');
    expect(formatMatchedAttributeLabel('LastName')).toBe('Last name');
    expect(formatMatchedAttributeLabel('DateOfBirth')).toBe('Date of birth');
    expect(formatMatchedAttributeLabel('Phone')).toBe('Phone number');
    expect(formatMatchedAttributeLabel('Email')).toBe('Email');
    expect(formatDifferentAttributeLabel('LastName')).toBe('Last name differs');
    expect(formatDifferentAttributeLabel('DateOfBirth')).toBe('Date of birth differs');
    expect(formatMatchedAttributeLabel('HealthId')).toBeNull();
  });

  it('aggregates matchedAttributes into display labels without dropping DateOfBirth', () => {
    expect(formatMatchedEvidenceLabels(['DateOfBirth', 'Phone'])).toEqual([
      'Date of birth',
      'Phone number',
    ]);
    expect(formatMatchedEvidenceLabels(['Phone'])).toEqual(['Phone number']);
    expect(formatMatchedEvidenceLabels(['FirstName', 'LastName', 'DateOfBirth'])).toEqual([
      'Name',
      'Date of birth',
    ]);
    expect(formatMatchedEvidenceLabels(['FirstName', 'LastName'])).toEqual(['Name']);
    expect(formatMatchedEvidenceLabels(['Email'])).toEqual(['Email']);
    expect(resolveMatchedEvidenceLabels(['DateOfBirth', 'Phone'], 'PhoneMatch')).toEqual([
      'Date of birth',
      'Phone number',
    ]);
    expect(resolveMatchedEvidenceLabels([], 'PhoneMatch')).toEqual(['Phone number']);
    expect(resolveMatchedEvidenceLabels(null, 'ExactNameDOB')).toEqual([
      'Name',
      'Date of birth',
    ]);
  });

  it('formats masked phone ending for new registration only', () => {
    expect(formatRegistrationPhoneEnding('+91 98765 43210')).toBe('Phone ending 3210');
    expect(formatRegistrationPhoneEnding('12')).toBeNull();
    expect(formatRegistrationPhoneEnding(null)).toBeNull();
  });
});
