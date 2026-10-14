import { describe, expect, it } from 'vitest';

/** Mirrors AddPatientWizard DOB display helpers (kept in sync with wizard module). */
function isoDateToDdMmYyyy(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function ddMmYyyyToIsoDate(display: string): string | null {
  const trimmed = display.trim();
  if (!trimmed) return null;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1800 || year > 2100) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function maskDdMmYyyyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

describe('Add Patient DOB display ↔ ISO sync', () => {
  it('converts typed DD-MM-YYYY to ISO form state', () => {
    expect(ddMmYyyyToIsoDate('01-08-1987')).toBe('1987-08-01');
    expect(isoDateToDdMmYyyy('1987-08-01')).toBe('01-08-1987');
  });

  it('rejects incomplete and invalid DOB text', () => {
    expect(ddMmYyyyToIsoDate('01-08-19')).toBeNull();
    expect(ddMmYyyyToIsoDate('01-99-1987')).toBeNull();
    expect(ddMmYyyyToIsoDate('')).toBeNull();
  });

  it('masks digit entry into DD-MM-YYYY shape', () => {
    expect(maskDdMmYyyyInput('01081987')).toBe('01-08-1987');
    expect(maskDdMmYyyyInput('01')).toBe('01');
  });
});
