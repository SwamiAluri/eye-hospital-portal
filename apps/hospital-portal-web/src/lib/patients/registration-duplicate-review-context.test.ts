import { describe, expect, it } from 'vitest';
import {
  duplicateEvidenceForField,
  formatDuplicateReviewCandidateLabel,
  isHardDuplicateReviewBlocking,
  resolveDuplicateReviewSeverity,
} from '@/lib/patients/registration-duplicate-review-context';

describe('registration-duplicate-review-context', () => {
  it('maps server matchedAttributes / differentAttributes without inventing evidence', () => {
    const ctx = {
      candidateId: 'a',
      severity: 'soft' as const,
      matchedAttributes: ['FirstName', 'DateOfBirth', 'Phone'],
      differentAttributes: ['LastName'],
    };
    expect(duplicateEvidenceForField('firstName', ctx)).toBe('matched');
    expect(duplicateEvidenceForField('dateOfBirth', ctx)).toBe('matched');
    expect(duplicateEvidenceForField('phone', ctx)).toBe('matched');
    expect(duplicateEvidenceForField('lastName', ctx)).toBe('different');
    expect(duplicateEvidenceForField('email', ctx)).toBeNull();
  });

  it('keeps candidate evidence isolated and prefers matched over different for same field', () => {
    const a = {
      candidateId: 'a',
      severity: 'soft' as const,
      matchedAttributes: ['FirstName', 'DateOfBirth'],
      differentAttributes: ['LastName'],
    };
    const b = {
      candidateId: 'b',
      severity: 'soft' as const,
      matchedAttributes: ['Phone'],
      differentAttributes: ['DateOfBirth'],
    };
    expect(duplicateEvidenceForField('dateOfBirth', a)).toBe('matched');
    expect(duplicateEvidenceForField('dateOfBirth', b)).toBe('different');
    expect(duplicateEvidenceForField('phone', a)).toBeNull();
    expect(duplicateEvidenceForField('phone', b)).toBe('matched');
    expect(duplicateEvidenceForField('firstName', null)).toBeNull();
  });

  it('DateOfBirth + Phone selection highlights only those Review fields', () => {
    const ctx = {
      candidateId: 'samuel-phone-dob',
      severity: 'soft' as const,
      matchedAttributes: ['DateOfBirth', 'Phone'],
      differentAttributes: ['FirstName', 'LastName'],
    };
    expect(duplicateEvidenceForField('dateOfBirth', ctx)).toBe('matched');
    expect(duplicateEvidenceForField('phone', ctx)).toBe('matched');
    expect(duplicateEvidenceForField('firstName', ctx)).toBe('different');
    expect(duplicateEvidenceForField('lastName', ctx)).toBe('different');
    expect(duplicateEvidenceForField('email', ctx)).toBeNull();
  });

  it('formats selected candidate label for the review banner', () => {
    expect(
      formatDuplicateReviewCandidateLabel({
        candidateId: '1',
        firstName: 'Samuel',
        lastName: 'Aluri',
        medicalRecordNumber: 'MRN-1',
        severity: 'soft',
        matchedAttributes: [],
        differentAttributes: [],
      }),
    ).toBe('Samuel Aluri · MRN-1');
  });

  it('resolves hard severity from hard dialog source (not matchedAttributes count)', () => {
    expect(
      resolveDuplicateReviewSeverity({
        source: 'hard',
        matchType: 'PhoneMatch',
      }),
    ).toBe('hard');
    expect(
      resolveDuplicateReviewSeverity({
        source: 'soft',
        matchType: 'PhoneMatch',
      }),
    ).toBe('soft');
    expect(
      resolveDuplicateReviewSeverity({
        source: 'soft',
        matchType: 'ExactNameDOB',
      }),
    ).toBe('hard');
  });

  it('blocks create when Review context severity is hard', () => {
    expect(
      isHardDuplicateReviewBlocking({
        candidateId: 'sam',
        matchType: 'ExactNameDOB',
        severity: 'hard',
        matchedAttributes: ['FirstName', 'LastName', 'DateOfBirth', 'Phone'],
        differentAttributes: [],
      }),
    ).toBe(true);
    expect(
      isHardDuplicateReviewBlocking({
        candidateId: 'samuel',
        matchType: 'PhoneMatch',
        severity: 'soft',
        matchedAttributes: ['DateOfBirth', 'Phone'],
        differentAttributes: ['FirstName', 'LastName'],
      }),
    ).toBe(false);
    expect(isHardDuplicateReviewBlocking(null)).toBe(false);
  });
});
