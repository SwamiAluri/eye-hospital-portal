import { describe, expect, it } from 'vitest';
import {
  formatPatientApiError,
  sanitizePatientWritePayload,
} from './patient-write-payload';

describe('sanitizePatientWritePayload', () => {
  it('omits blank email so ASP.NET [EmailAddress] does not reject empty string', () => {
    const out = sanitizePatientWritePayload({
      firstName: 'Samuel',
      lastName: 'Paul',
      dateOfBirth: '2005-01-13',
      gender: 'Male',
      email: '',
      contactNumber: '',
    });
    expect(out).not.toHaveProperty('email');
    expect(out).not.toHaveProperty('contactNumber');
    expect(out.firstName).toBe('Samuel');
  });

  it('keeps a real email', () => {
    const out = sanitizePatientWritePayload({
      firstName: 'A',
      lastName: 'B',
      dateOfBirth: '2005-01-13',
      gender: 'Male',
      email: 'a@b.com',
    });
    expect(out.email).toBe('a@b.com');
  });
});

describe('formatPatientApiError', () => {
  it('surfaces field validation errors from ProblemDetails', () => {
    const msg = formatPatientApiError({
      response: {
        data: {
          title: 'One or more validation errors occurred.',
          errors: { email: ['The Email field is not a valid e-mail address.'] },
        },
      },
    });
    expect(msg).toMatch(/email/i);
    expect(msg).not.toBe('Failed to save patient');
  });

  it('falls back when no structured error', () => {
    expect(formatPatientApiError({})).toBe('Failed to save patient');
  });
});
