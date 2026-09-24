import { describe, expect, it } from 'vitest';
import {
  resolveMutationVersion,
  resolveVersionAfterSave,
} from './session-version-authority';

describe('session-version-authority — mutation Version (false-409 prevention)', () => {
  it('prefers the sync ref over stale React session.version (Start/Save → immediate Complete)', () => {
    // Start/Save Draft advanced DB + ref to 6; React state still 5 until re-render.
    expect(resolveMutationVersion(6, 5)).toBe(6);
  });

  it('falls back to session.version when the ref is unset (initial apply)', () => {
    expect(resolveMutationVersion(undefined, 4)).toBe(4);
  });

  it('returns undefined when neither side has a Version (fail closed upstream)', () => {
    expect(resolveMutationVersion(undefined, undefined)).toBeUndefined();
  });

  it('Save → Complete uses response Version, not the Version sent on Save', () => {
    expect(resolveVersionAfterSave({ responseVersion: 6, requestVersion: 5 })).toBe(6);
  });

  it('does not invent a bump when Save response omits Version', () => {
    expect(resolveVersionAfterSave({ responseVersion: undefined, requestVersion: 5 })).toBe(5);
  });
});
