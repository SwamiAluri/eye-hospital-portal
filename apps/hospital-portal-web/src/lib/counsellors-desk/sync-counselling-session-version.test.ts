import { describe, expect, it } from 'vitest';
import { shouldRetryDraftSaveAfterVersionSync } from '@/lib/counsellors-desk/sync-counselling-session-version';

describe('shouldRetryDraftSaveAfterVersionSync', () => {
  it('retries when server Version advanced past the Version we sent (coverage/system writer)', () => {
    expect(
      shouldRetryDraftSaveAfterVersionSync({ requestVersion: 3, freshVersion: 4 }),
    ).toBe(true);
  });

  it('does not retry when fresh Version equals the request Version (true conflict / no advance)', () => {
    expect(
      shouldRetryDraftSaveAfterVersionSync({ requestVersion: 5, freshVersion: 5 }),
    ).toBe(false);
  });

  it('does not retry when fresh Version is missing', () => {
    expect(
      shouldRetryDraftSaveAfterVersionSync({ requestVersion: 2, freshVersion: undefined }),
    ).toBe(false);
  });

  it('retries when request Version was missing but server returns a Version', () => {
    expect(
      shouldRetryDraftSaveAfterVersionSync({ requestVersion: undefined, freshVersion: 1 }),
    ).toBe(true);
  });
});
