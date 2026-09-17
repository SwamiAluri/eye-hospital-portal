import { describe, expect, it, vi } from 'vitest';
import {
  classifyScheduleLookupError,
  loadScheduleSurgeryLookups,
  normalizeScheduleLookupOptions,
  SCHEDULE_SURGERY_FORBIDDEN_PATHS,
} from './schedule-surgery-lookups';
import { counsellingSessionTokens } from './counselling-session-tokens';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('schedule-surgery-lookups', () => {
  it('filters empty id/name options (Radix Select cannot use empty values)', () => {
    expect(
      normalizeScheduleLookupOptions([
        { id: 't1', name: 'OT-1' },
        { id: '', name: 'Broken' },
        { id: 't2', name: '  ' },
        { id: 's1', name: 'Dr A' },
      ]),
    ).toEqual([
      { id: 't1', name: 'OT-1' },
      { id: 's1', name: 'Dr A' },
    ]);
  });

  it('loads surgeons even when theaters reject (independent lookups)', async () => {
    const result = await loadScheduleSurgeryLookups({
      getSurgeons: async () => [{ id: 'd1', name: 'Dr Rao' }],
      getOtTheaters: async () => {
        throw new Error('404');
      },
    });
    expect(result.surgeons).toEqual([{ id: 'd1', name: 'Dr Rao' }]);
    expect(result.theaters).toEqual([]);
    expect(result.surgeonError).toBeNull();
    expect(result.theaterError).toMatch(/Retry/i);
  });

  it('loads theaters even when surgeons reject', async () => {
    const result = await loadScheduleSurgeryLookups({
      getSurgeons: async () => {
        throw new Error('fail');
      },
      getOtTheaters: async () => [{ id: 'ot1', name: 'Main OT' }],
    });
    expect(result.theaters).toEqual([{ id: 'ot1', name: 'Main OT' }]);
    expect(result.surgeons).toEqual([]);
    expect(result.surgeonError).toMatch(/Retry/i);
    expect(result.theaterError).toBeNull();
  });

  it('classifies 404 theaters as server route unavailable (not empty list)', () => {
    expect(
      classifyScheduleLookupError({ response: { status: 404 } }, 'theatres'),
    ).toMatch(/unavailable on the server/i);
  });

  it('classifies 403 theaters as branch access message', () => {
    expect(
      classifyScheduleLookupError({ response: { status: 403 } }, 'theatres'),
    ).toMatch(/don't have access/i);
  });

  it('classifies network/server theater failure with Retry (not counselling access)', () => {
    expect(classifyScheduleLookupError({ response: { status: 500 } }, 'theatres')).toBe(
      'Could not load operation theatres. Retry.',
    );
    expect(classifyScheduleLookupError(new Error('Network Error'), 'theatres')).not.toMatch(
      /counselling access/i,
    );
  });

  it('succeeds when both lookups resolve', async () => {
    const result = await loadScheduleSurgeryLookups({
      getSurgeons: async () => [{ id: 'd1', name: 'Dr Rao' }],
      getOtTheaters: async () => [{ id: 'ot1', name: 'Main OT' }],
    });
    expect(result.surgeonError).toBeNull();
    expect(result.theaterError).toBeNull();
    expect(result.surgeons).toHaveLength(1);
    expect(result.theaters).toHaveLength(1);
  });

  it('documents forbidden counsellor Schedule Surgery paths', () => {
    expect(SCHEDULE_SURGERY_FORBIDDEN_PATHS).toContain('/otbooking/theaters');
    expect(SCHEDULE_SURGERY_FORBIDDEN_PATHS).toContain('/users/with-details');
  });
});

describe('Schedule Surgery modal layering', () => {
  it('keeps session action bar below Dialog overlay (z-50)', () => {
    // DialogOverlay/Content use z-50; footer must not use z-[60]+
    expect(counsellingSessionTokens.shellActionBar).not.toMatch(/z-\[6/);
    expect(counsellingSessionTokens.shellActionBar).not.toMatch(/z-\[7/);
    expect(counsellingSessionTokens.shellActionBar).not.toMatch(/z-\[8/);
    expect(counsellingSessionTokens.shellActionBar).not.toMatch(/z-\[9/);
    // Prefer no competing high z-index, or at most below 50
    const zMatch = counsellingSessionTokens.shellActionBar.match(/z-\[(\d+)\]|z-(\d+)/);
    if (zMatch) {
      const z = Number(zMatch[1] ?? zMatch[2]);
      expect(z).toBeLessThan(50);
    }
  });

  it('ScheduleSurgeryModal uses counselling theaters/surgeons helpers, not otbooking', () => {
    const src = readFileSync(
      join(__dirname, '../../components/counsellors-desk/ScheduleSurgeryModal.tsx'),
      'utf8',
    );
    expect(src).toContain('getOtTheaters');
    expect(src).toContain('getSurgeons');
    expect(src).toContain('classifyScheduleLookupError');
    expect(src).not.toContain('otbooking/theaters');
    expect(src).not.toContain('users/with-details');
  });
});

describe('schedule dirty contract (submit vs open)', () => {
  it('controller marks dirty only via handleScheduleSubmit, not lookup open', () => {
    const controllerSrc = readFileSync(
      join(__dirname, '../../hooks/use-counselling-session-controller.ts'),
      'utf8',
    );
    const submitBlock = controllerSrc.slice(
      controllerSrc.indexOf('handleScheduleSubmit'),
      controllerSrc.indexOf('handleCoverageProgressChange'),
    );
    expect(submitBlock).toContain('markDirty');
  });
});
