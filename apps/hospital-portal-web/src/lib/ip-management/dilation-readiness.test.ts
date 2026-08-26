import { describe, expect, it } from 'vitest';
import {
  dilationChipLabel,
  formatDilationMmSs,
  remainingSecondsFromSlice,
  type DilationSlice,
} from './dilation-readiness';

const notReady: DilationSlice = {
  startedAt: '2026-08-25T09:12:00.000Z',
  readyAt: '2026-08-25T09:37:00.000Z',
  remainingSeconds: 252,
  status: 'not_ready',
  medicineName: 'Tropicamide',
};

describe('dilation-readiness', () => {
  it('formats remaining as mm:ss', () => {
    expect(formatDilationMmSs(252)).toBe('04:12');
    expect(formatDilationMmSs(0)).toBe('00:00');
  });

  it('counts down from readyAt', () => {
    const now = new Date('2026-08-25T09:32:48.000Z').getTime();
    expect(remainingSecondsFromSlice(notReady, now)).toBe(252);
  });

  it('ready copy names the drop time', () => {
    const slice: DilationSlice = {
      ...notReady,
      status: 'ready',
      remainingSeconds: 0,
    };
    expect(dilationChipLabel(slice, 0)).toMatch(/Dilation ready/);
  });
});
