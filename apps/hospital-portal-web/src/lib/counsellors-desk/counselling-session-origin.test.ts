import { describe, expect, it } from 'vitest';
import {
  buildCounsellingSessionHref,
  COUNSELLING_SESSION_ORIGIN,
  parseCounsellingSessionOrigin,
  resolveCounsellingSessionCloseHref,
  resolveCounsellingSessionLeaveControl,
} from './counselling-session-origin';

describe('counselling-session-origin', () => {
  it('maps waiting-list origin to Waiting List', () => {
    expect(resolveCounsellingSessionCloseHref('waiting-list')).toBe(
      '/dashboard/counsellors-desk/waiting-list',
    );
  });

  describe('leave control — Waiting List Back presentation', () => {
    it('from=waiting-list without phase-back shows Back (not Close)', () => {
      const leave = resolveCounsellingSessionLeaveControl({
        from: 'waiting-list',
        showPhaseBack: false,
      });
      expect(leave.label).toBe('Back');
      expect(leave.ariaLabel).toBe('Back to Waiting List');
      expect(leave.showChevron).toBe(true);
      expect(leave.usesCloseSemantics).toBe(true);
    });

    it('from=waiting-list&lifecycle=re-evaluate still shows Back presentation', () => {
      // Lifecycle query is separate; leave control keys only off `from`.
      const leave = resolveCounsellingSessionLeaveControl({
        from: 'waiting-list',
        showPhaseBack: false,
      });
      expect(leave.label).toBe('Back');
      expect(leave.ariaLabel).toBe('Back to Waiting List');
    });

    it('from=waiting-list with phase-back keeps Close label to avoid two Backs', () => {
      const leave = resolveCounsellingSessionLeaveControl({
        from: 'waiting-list',
        showPhaseBack: true,
      });
      expect(leave.label).toBe('Close');
      expect(leave.ariaLabel).toBe('Close');
      expect(leave.showChevron).toBe(false);
      expect(leave.usesCloseSemantics).toBe(true);
    });

    it('non–waiting-list origins keep Close', () => {
      for (const from of ['follow-up', 'finalize', 'analytics'] as const) {
        const leave = resolveCounsellingSessionLeaveControl({
          from,
          showPhaseBack: false,
        });
        expect(leave.label).toBe('Close');
        expect(leave.ariaLabel).toBe('Close');
      }
    });

    it('leave control never implies lifecycle or ownership mutations', () => {
      const leave = resolveCounsellingSessionLeaveControl({
        from: 'waiting-list',
        showPhaseBack: false,
      });
      expect(leave.usesCloseSemantics).toBe(true);
      expect(leave.label).not.toMatch(/Re-evaluate|Start Repeat|Assign|Claim/i);
    });
  });

  it('maps follow-up origin to Follow-up Center', () => {
    expect(resolveCounsellingSessionCloseHref('follow-up')).toBe(
      '/dashboard/counsellors-desk/surgery-followup',
    );
  });

  it('maps finalize and analytics origins', () => {
    expect(resolveCounsellingSessionCloseHref('finalize')).toBe(
      '/dashboard/counsellors-desk/finalize-surgery',
    );
    expect(resolveCounsellingSessionCloseHref('analytics')).toBe(
      '/dashboard/counselor/analytics',
    );
  });

  it('falls back to Waiting List when origin missing', () => {
    expect(resolveCounsellingSessionCloseHref(null)).toBe(
      '/dashboard/counsellors-desk/waiting-list',
    );
    expect(resolveCounsellingSessionCloseHref(undefined)).toBe(
      '/dashboard/counsellors-desk/waiting-list',
    );
    expect(resolveCounsellingSessionCloseHref('')).toBe(
      '/dashboard/counsellors-desk/waiting-list',
    );
  });

  it('falls back to Waiting List when origin invalid', () => {
    expect(resolveCounsellingSessionCloseHref('hack')).toBe(
      '/dashboard/counsellors-desk/waiting-list',
    );
    expect(resolveCounsellingSessionCloseHref('../admin')).toBe(
      '/dashboard/counsellors-desk/waiting-list',
    );
  });

  it('parses only known origins', () => {
    expect(parseCounsellingSessionOrigin('waiting-list')).toBe(
      COUNSELLING_SESSION_ORIGIN.WaitingList,
    );
    expect(parseCounsellingSessionOrigin('FOLLOW-UP')).toBe(
      COUNSELLING_SESSION_ORIGIN.FollowUp,
    );
    expect(parseCounsellingSessionOrigin('nope')).toBeNull();
  });

  it('builds session href with from query', () => {
    expect(buildCounsellingSessionHref('sess-1', COUNSELLING_SESSION_ORIGIN.WaitingList)).toBe(
      '/dashboard/counsellors-desk/sess-1?from=waiting-list',
    );
    expect(
      buildCounsellingSessionHref('sess-1', COUNSELLING_SESSION_ORIGIN.FollowUp, {
        tab: 'coverage',
      }),
    ).toBe('/dashboard/counsellors-desk/sess-1?from=follow-up&tab=coverage');
  });
});
