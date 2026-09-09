import { describe, expect, it } from 'vitest';
import {
  canMutateCoverageDocuments,
  isCoverageFormReadOnly,
  resolveCoverageSyncMode,
} from './coverage-sync-mode';

describe('coverage sync mode', () => {
  it('locks policy form for submitted/closed CCMS states', () => {
    expect(resolveCoverageSyncMode('WAITING_APPROVAL')).toBe('locked');
    expect(resolveCoverageSyncMode('CLOSED')).toBe('locked');
    expect(isCoverageFormReadOnly('locked', false)).toBe(true);
  });

  it('allows document mutations unless counselling session is repeat-gated', () => {
    expect(canMutateCoverageDocuments({ forceReadOnly: false })).toBe(true);
    expect(canMutateCoverageDocuments({ forceReadOnly: true })).toBe(false);
    expect(canMutateCoverageDocuments({ forceReadOnly: false })).toBe(true);
  });

  it('keeps document mutations independent of CCMS workflow lock', () => {
    expect(resolveCoverageSyncMode('CLOSED')).toBe('locked');
    expect(canMutateCoverageDocuments({ forceReadOnly: false })).toBe(true);
  });
});
