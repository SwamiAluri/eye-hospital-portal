import { describe, expect, it } from 'vitest';
import {
  formatMissingDocumentsMessage,
  requirementsToSlots,
  slotsFromMasterOrFallback,
  withBiometrySlot,
  OPTIONAL_FALLBACK_SLOTS,
} from './ccms-document-slots';

describe('ccms document slots from master', () => {
  it('maps required and optional master rows', () => {
    const slots = requirementsToSlots([
      { documentType: 'surgeon_advice', documentName: 'Surgeon advice', isRequired: true },
      { documentType: 'oct_fundus', documentName: 'OCT / fundus', isRequired: false },
    ]);
    expect(slots).toEqual([
      { key: 'surgeon_advice', label: 'Surgeon advice', required: true, accept: 'image/*,application/pdf' },
      { key: 'oct_fundus', label: 'OCT / fundus', required: false, accept: 'image/*,application/pdf' },
    ]);
  });

  it('falls back to optional uploads when master is empty', () => {
    expect(slotsFromMasterOrFallback([])).toEqual(OPTIONAL_FALLBACK_SLOTS);
    expect(slotsFromMasterOrFallback([]).every(s => !s.required)).toBe(true);
  });

  it('adds an optional biometry print slot when master omitted it', () => {
    const withBio = withBiometrySlot(OPTIONAL_FALLBACK_SLOTS);
    expect(withBio.some(s => s.key === 'biometry_record' && !s.required)).toBe(true);
    expect(withBiometrySlot(withBio)).toHaveLength(withBio.length);
  });

  it('formats the submit block copy', () => {
    expect(formatMissingDocumentsMessage(['Surgeon advice'])).toBe(
      'Pre-authorization cannot be sent until Surgeon advice is attached.',
    );
    expect(formatMissingDocumentsMessage(['Surgeon advice', 'Biometry print'])).toBe(
      'Pre-authorization cannot be sent until Surgeon advice and Biometry print are attached.',
    );
  });
});
