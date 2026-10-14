import { describe, expect, it } from 'vitest';
import {
  DIRECTORY_DOB_PLACEHOLDER,
  directoryDobLatestSelectableDate,
  formatDirectoryDobDigits,
  isoToDirectoryDobDisplay,
  isDirectoryDobOnOrBeforeYesterday,
  parseDirectoryDobDisplay,
  sanitizeDirectoryDobInput,
} from './patient-directory-dob';

describe('patient-directory-dob', () => {
  it('uses DD/MM/YYYY placeholder', () => {
    expect(DIRECTORY_DOB_PLACEHOLDER).toBe('DD/MM/YYYY');
  });

  it('formats numeric entry as DD/MM/YYYY', () => {
    expect(formatDirectoryDobDigits('01011990')).toBe('01/01/1990');
    expect(formatDirectoryDobDigits('0101')).toBe('01/01');
    expect(formatDirectoryDobDigits('01')).toBe('01');
  });

  it('rejects alphabetic characters', () => {
    expect(sanitizeDirectoryDobInput('01/ab/1990')).toBe('01/19/90');
    expect(sanitizeDirectoryDobInput('abc')).toBe('');
  });

  it('converts ISO ↔ display without changing API contract', () => {
    expect(isoToDirectoryDobDisplay('1990-01-01')).toBe('01/01/1990');
    expect(isoToDirectoryDobDisplay('')).toBe('');
    expect(parseDirectoryDobDisplay('01/01/1990')).toEqual({
      status: 'valid',
      iso: '1990-01-01',
    });
  });

  it('rejects invalid calendar dates', () => {
    expect(parseDirectoryDobDisplay('31/02/2025').status).toBe('invalid');
    expect(parseDirectoryDobDisplay('32/01/2025').status).toBe('invalid');
    expect(parseDirectoryDobDisplay('00/12/2025').status).toBe('invalid');
    expect(parseDirectoryDobDisplay('15/13/2025').status).toBe('invalid');
  });

  it('rejects today and future dates for DOB', () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = String(today.getFullYear());
    expect(parseDirectoryDobDisplay(`${dd}/${mm}/${yyyy}`).status).toBe('invalid');
    expect(
      parseDirectoryDobDisplay(
        `01/01/${today.getFullYear() + 1}`,
      ).status,
    ).toBe('invalid');
    expect(isDirectoryDobOnOrBeforeYesterday('1990-01-01')).toBe(true);
    const latest = directoryDobLatestSelectableDate(today);
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    expect(latest.getFullYear()).toBe(yesterday.getFullYear());
    expect(latest.getMonth()).toBe(yesterday.getMonth());
    expect(latest.getDate()).toBe(yesterday.getDate());
  });

  it('supports empty and incomplete while typing', () => {
    expect(parseDirectoryDobDisplay('').status).toBe('empty');
    expect(parseDirectoryDobDisplay('01/01').status).toBe('incomplete');
  });
});
