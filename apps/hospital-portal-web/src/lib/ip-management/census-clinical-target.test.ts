import { describe, expect, it } from 'vitest';
import {
  censusOpensWorkspace,
  censusTargetState,
} from './census-clinical-target';

describe('censusTargetState', () => {
  it('maps gated census actions onto the clinical states the gates API expects', () => {
    expect(censusTargetState('ready')).toBe('ReadyForSurgery');
    expect(censusTargetState('send')).toBe('SentToOT');
    expect(censusTargetState('discharge')).toBe('Discharged');
    expect(censusTargetState('accept')).toBeUndefined();
  });

  it('opens the pre-op workspace for admit and mark-ready', () => {
    expect(censusOpensWorkspace('admit')).toBe(true);
    expect(censusOpensWorkspace('ready')).toBe(true);
    expect(censusOpensWorkspace('send')).toBe(false);
  });
});
