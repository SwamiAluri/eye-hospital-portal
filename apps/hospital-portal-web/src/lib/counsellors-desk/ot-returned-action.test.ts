import { describe, expect, it } from 'vitest';
import { resolveOtReturnedAction } from './ot-returned-action';

describe('resolveOtReturnedAction', () => {
  it('prefers Re-plan to counselling session when counselingSessionId is present', () => {
    expect(
      resolveOtReturnedAction({
        journeyId: 'journey-1',
        counselingSessionId: 'session-9',
      }),
    ).toEqual({
      kind: 'replan',
      label: 'Re-plan',
      href: '/dashboard/counsellors-desk/session-9',
    });
  });

  it('falls back to Open journey when counselingSessionId is missing', () => {
    expect(
      resolveOtReturnedAction({
        journeyId: 'journey-1',
        counselingSessionId: null,
      }),
    ).toEqual({
      kind: 'open-journey',
      label: 'Open journey',
      href: '/dashboard/ip-management/journey/journey-1',
    });
  });

  it('treats empty counselingSessionId as missing', () => {
    expect(
      resolveOtReturnedAction({
        journeyId: 'journey-2',
        counselingSessionId: '   ',
      }).kind,
    ).toBe('open-journey');
  });
});
