import { describe, expect, it } from 'vitest';
import { canIssueWristband, formatWristbandGender, wristbandEyeLine } from './wristband-print';

describe('wristband print helpers', () => {
  it('allows print after admit and hides it for expected or cancelled', () => {
    expect(canIssueWristband('Admitted')).toBe(true);
    expect(canIssueWristband('ReadyForSurgery')).toBe(true);
    expect(canIssueWristband('Discharged')).toBe(true);
    expect(canIssueWristband('Expected')).toBe(false);
    expect(canIssueWristband('AdmissionCancelled')).toBe(false);
  });

  it('spells RIGHT/LEFT and never relies on colour', () => {
    expect(wristbandEyeLine('OD')).toEqual({ word: 'RIGHT', abbr: 'OD' });
    expect(wristbandEyeLine('OS')).toEqual({ word: 'LEFT', abbr: 'OS' });
    expect(wristbandEyeLine(null).word).toBe('NOT RECORDED');
  });

  it('maps gender letters to words', () => {
    expect(formatWristbandGender('F')).toBe('Female');
    expect(formatWristbandGender('M')).toBe('Male');
  });
});
