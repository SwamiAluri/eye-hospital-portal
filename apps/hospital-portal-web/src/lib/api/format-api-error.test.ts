import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { formatApiError } from './ip-management.api';

function axiosErr(status: number, data?: unknown): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    undefined,
    undefined,
    {
      status,
      statusText: 'Error',
      data,
      headers: {},
      config: {} as never,
    },
  );
}

describe('formatApiError', () => {
  it('does not surface axios status-code 404 as the user message', () => {
    expect(formatApiError(axiosErr(404), 'Could not print wristband.')).toBe(
      'Could not print wristband.',
    );
  });

  it('prefers the server error body when present', () => {
    expect(formatApiError(axiosErr(404, { error: 'Journey not found.' }), 'fallback')).toBe(
      'Journey not found.',
    );
  });
});
