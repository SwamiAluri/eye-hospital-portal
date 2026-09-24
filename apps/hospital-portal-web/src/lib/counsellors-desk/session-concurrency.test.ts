import { describe, expect, it } from 'vitest';
import {
  STALE_SESSION_MESSAGE,
  getSessionConcurrencyMessage,
  isSessionConcurrencyConflict,
} from './session-concurrency';

function axiosError(status?: number, message?: string) {
  return {
    response: {
      status,
      data: message ? { message } : undefined,
    },
  };
}

describe('STALE_SESSION_MESSAGE', () => {
  it('matches the approved PD-S7-06 copy', () => {
    expect(STALE_SESSION_MESSAGE).toBe(
      'This session was updated by another user. Refresh to continue.',
    );
  });
});

describe('isSessionConcurrencyConflict', () => {
  it('is true for HTTP 409', () => {
    expect(isSessionConcurrencyConflict(axiosError(409))).toBe(true);
  });

  it('is false for HTTP 403 (ownership/authz — distinct from concurrency)', () => {
    expect(isSessionConcurrencyConflict(axiosError(403))).toBe(false);
  });

  it('is false for other status codes', () => {
    expect(isSessionConcurrencyConflict(axiosError(400))).toBe(false);
    expect(isSessionConcurrencyConflict(axiosError(404))).toBe(false);
    expect(isSessionConcurrencyConflict(axiosError(500))).toBe(false);
  });

  it('is false for non-axios errors', () => {
    expect(isSessionConcurrencyConflict(new Error('boom'))).toBe(false);
    expect(isSessionConcurrencyConflict(null)).toBe(false);
    expect(isSessionConcurrencyConflict(undefined)).toBe(false);
    expect(isSessionConcurrencyConflict('plain string')).toBe(false);
  });

  it('is false when response is present but status is missing', () => {
    expect(isSessionConcurrencyConflict({ response: {} })).toBe(false);
  });
});

describe('getSessionConcurrencyMessage', () => {
  it('prefers the server message when present', () => {
    expect(getSessionConcurrencyMessage(axiosError(409, 'Session ownership changed.'))).toBe(
      'Session ownership changed.',
    );
  });

  it('trims the server message', () => {
    expect(getSessionConcurrencyMessage(axiosError(409, '  Stale version.  '))).toBe(
      'Stale version.',
    );
  });

  it('falls back to STALE_SESSION_MESSAGE when the server message is empty', () => {
    expect(getSessionConcurrencyMessage(axiosError(409, ''))).toBe(STALE_SESSION_MESSAGE);
    expect(getSessionConcurrencyMessage(axiosError(409, '   '))).toBe(STALE_SESSION_MESSAGE);
  });

  it('falls back to STALE_SESSION_MESSAGE when there is no response body', () => {
    expect(getSessionConcurrencyMessage(axiosError(409))).toBe(STALE_SESSION_MESSAGE);
  });

  it('falls back to STALE_SESSION_MESSAGE for non-axios errors', () => {
    expect(getSessionConcurrencyMessage(new Error('boom'))).toBe(STALE_SESSION_MESSAGE);
    expect(getSessionConcurrencyMessage(null)).toBe(STALE_SESSION_MESSAGE);
  });
});
