import { describe, expect, it } from 'vitest';
import {
  patient360CanonicalIdentityKey,
  shouldSkipDuplicateCanonicalOnAll,
} from '@/lib/patients/patient-360-document-identity';

describe('patient360 document identity', () => {
  it('normalizes canonical identity keys', () => {
    expect(patient360CanonicalIdentityKey('  abc  ')).toBe('abc');
    expect(patient360CanonicalIdentityKey('')).toBeNull();
    expect(patient360CanonicalIdentityKey(null)).toBeNull();
  });

  it('dedupes the same canonical id on All only', () => {
    const seen = new Set<string>();
    expect(shouldSkipDuplicateCanonicalOnAll('all', seen, 'doc-1')).toBe(false);
    expect(shouldSkipDuplicateCanonicalOnAll('all', seen, 'doc-1')).toBe(true);
    expect(shouldSkipDuplicateCanonicalOnAll('counselling', seen, 'doc-1')).toBe(false);
    expect(shouldSkipDuplicateCanonicalOnAll('general', new Set(), 'doc-1')).toBe(false);
  });
});
