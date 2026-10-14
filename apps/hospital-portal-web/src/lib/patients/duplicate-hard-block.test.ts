import { describe, expect, it } from 'vitest';
import {
  formatDuplicateCandidateDob,
  formatDuplicateCandidateName,
  formatDuplicateMatchReason,
  parseDuplicateHardBlockError,
  registrationStepForDuplicates,
  registrationStepForMatchType,
  resolveDuplicateMatchPresentation,
} from '@/lib/patients/duplicate-hard-block';

describe('parseDuplicateHardBlockError', () => {
  it('detects the certified create hard-block payload including matchType', () => {
    const parsed = parseDuplicateHardBlockError({
      response: {
        status: 400,
        data: {
          error: 'Duplicate patient detected',
          message: 'A patient with very similar details already exists. Please review before creating.',
          duplicates: [
            {
              id: 'pat-1',
              firstName: 'Sam',
              lastName: 'Aluri',
              medicalRecordNumber: 'MRN-100',
              dateOfBirth: '1987-01-01',
              gender: 'male',
              matchType: 'ExactNameDOB',
              matchConfidence: 1,
            },
          ],
        },
      },
    });
    expect(parsed.isDuplicateHardBlock).toBe(true);
    expect(parsed.duplicates).toHaveLength(1);
    expect(parsed.duplicates[0]?.id).toBe('pat-1');
    expect(parsed.duplicates[0]?.medicalRecordNumber).toBe('MRN-100');
    expect(parsed.duplicates[0]?.matchType).toBe('ExactNameDOB');
    expect(parsed.duplicates[0]?.matchConfidence).toBe(1);
    expect(parsed.message).toContain('similar details');
  });

  it('preserves server matchedAttributes / differentAttributes on hard-block candidates', () => {
    const parsed = parseDuplicateHardBlockError({
      response: {
        status: 400,
        data: {
          error: 'Duplicate patient detected',
          message: 'blocked',
          duplicates: [
            {
              id: 'pat-2',
              firstName: 'Samuel',
              lastName: 'Aluri',
              matchType: 'PhoneMatch',
              matchedAttributes: ['DateOfBirth', 'Phone'],
              differentAttributes: ['FirstName', 'LastName'],
            },
          ],
        },
      },
    });
    expect(parsed.isDuplicateHardBlock).toBe(true);
    expect(parsed.duplicates[0]?.matchedAttributes).toEqual(['DateOfBirth', 'Phone']);
    expect(parsed.duplicates[0]?.differentAttributes).toEqual(['FirstName', 'LastName']);
  });

  it('handles multiple candidates and ignores rows without ids', () => {
    const parsed = parseDuplicateHardBlockError({
      response: {
        status: 400,
        data: {
          error: 'Duplicate patient detected',
          message: 'blocked',
          duplicates: [
            { id: 'a', firstName: 'Ada', lastName: 'Lovelace', medicalRecordNumber: 'MRN-A' },
            { firstName: 'Missing', lastName: 'Id' },
            { id: 'b', firstName: 'Grace', lastName: 'Hopper', medicalRecordNumber: 'MRN-B' },
          ],
        },
      },
    });
    expect(parsed.isDuplicateHardBlock).toBe(true);
    expect(parsed.duplicates.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('does not treat ordinary create failures as hard blocks', () => {
    const parsed = parseDuplicateHardBlockError({
      response: {
        status: 400,
        data: { message: 'Branch is required' },
      },
    });
    expect(parsed.isDuplicateHardBlock).toBe(false);
    expect(parsed.duplicates).toEqual([]);
  });

  it('formats candidate identity helpers safely', () => {
    expect(
      formatDuplicateCandidateName({
        id: 'x',
        firstName: 'Sam',
        lastName: 'Aluri',
      }),
    ).toBe('Sam Aluri');
    expect(formatDuplicateCandidateName({ id: 'x' })).toBe('Existing patient');
    expect(formatDuplicateCandidateDob('1987-01-15')).toBeTruthy();
    expect(formatDuplicateCandidateDob(null)).toBeNull();
  });
});

describe('resolveDuplicateMatchPresentation', () => {
  it('maps ExactNameDOB to name + DOB fields and explanation', () => {
    const presentation = resolveDuplicateMatchPresentation('ExactNameDOB');
    expect(presentation.known).toBe(true);
    expect(presentation.label).toBe('Exact name + date of birth');
    expect(presentation.matchedFields).toEqual(['Name', 'Date of birth']);
    expect(presentation.explanation).toBe('Exact name and date of birth match');
  });

  it('maps PhoneMatch to phone number only', () => {
    const presentation = resolveDuplicateMatchPresentation('PhoneMatch');
    expect(presentation.known).toBe(true);
    expect(presentation.label).toBe('Phone number');
    expect(presentation.matchedFields).toEqual(['Phone number']);
    expect(presentation.explanation).toBe('Phone number matches an existing patient');
  });

  it('maps EmailMatch to email only', () => {
    const presentation = resolveDuplicateMatchPresentation('EmailMatch');
    expect(presentation.known).toBe(true);
    expect(presentation.label).toBe('Email address');
    expect(presentation.matchedFields).toEqual(['Email']);
    expect(presentation.explanation).toBe('Email address matches an existing patient');
  });

  it('maps FuzzyNameDOB to similar name + DOB', () => {
    const presentation = resolveDuplicateMatchPresentation('FuzzyNameDOB');
    expect(presentation.known).toBe(true);
    expect(presentation.label).toBe('Similar name + date of birth');
    expect(presentation.matchedFields).toEqual(['Similar name', 'Date of birth']);
    expect(presentation.explanation).toBe('Name is similar and date of birth matches');
  });

  it('does not invent a reason for unknown MatchType', () => {
    expect(resolveDuplicateMatchPresentation('Unknown')).toEqual({
      known: false,
      label: 'Match details unavailable',
      matchedFields: [],
      explanation: 'Match details unavailable',
    });
    expect(resolveDuplicateMatchPresentation(null).known).toBe(false);
    expect(resolveDuplicateMatchPresentation(undefined).matchedFields).toEqual([]);
  });

  it('keeps formatDuplicateMatchReason as a known-label helper only', () => {
    expect(formatDuplicateMatchReason('ExactNameDOB')).toBe('Exact name + date of birth');
    expect(formatDuplicateMatchReason('PhoneMatch')).toBe('Phone number');
    expect(formatDuplicateMatchReason('EmailMatch')).toBe('Email address');
    expect(formatDuplicateMatchReason('FuzzyNameDOB')).toBe('Similar name + date of birth');
    expect(formatDuplicateMatchReason('Unknown')).toBeNull();
    expect(formatDuplicateMatchReason(null)).toBeNull();
  });

  it('guides registration return step from MatchType without inventing fields', () => {
    expect(registrationStepForMatchType('ExactNameDOB')).toBe(1);
    expect(registrationStepForMatchType('FuzzyNameDOB')).toBe(1);
    expect(registrationStepForMatchType('PhoneMatch')).toBe(2);
    expect(registrationStepForMatchType('EmailMatch')).toBe(2);
    expect(registrationStepForMatchType('Other')).toBeNull();
    expect(
      registrationStepForDuplicates([
        { id: 'a', matchType: 'PhoneMatch' },
        { id: 'b', matchType: 'ExactNameDOB' },
      ]),
    ).toBe(2);
    expect(registrationStepForDuplicates([{ id: 'a' }])).toBeNull();
  });
});
