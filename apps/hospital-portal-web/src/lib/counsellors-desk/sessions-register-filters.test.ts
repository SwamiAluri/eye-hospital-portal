import { describe, expect, it } from 'vitest';
import {
  applySessionsRegisterDraft,
  buildSessionsFilterChips,
  clearSessionsDrilldownFilters,
  hasSessionsDrilldownFilters,
  readSessionsRegisterDraft,
  removeSessionsFilterChip,
  resolveSessionsEmptyCopy,
  shouldShowAnalyticsContext,
} from './sessions-register-filters';
import {
  buildSessionsOpenHref,
  resolveCounsellingSessionCloseHref,
} from './counselling-session-origin';

const AGREED =
  'analyticsOutcome=Agreed&patientAgreedToSurgery=true&pendingDecision=false&sessionDateFrom=2026-09-01&sessionDateTo=2026-09-27&counselorId=c1&branchId=b1';

describe('sessions register filter chips', () => {
  it('collapses an Agreed drill-down into one outcome chip plus date, counsellor, and branch', () => {
    const chips = buildSessionsFilterChips({
      search: AGREED,
      counselorLabel: 'Amelia Martinez',
      branchLabel: 'Madhapur',
    });
    const labels = chips.map((chip) => chip.label);
    expect(labels).toEqual([
      'Decision: Agreed',
      'Date: Sep 1 – Sep 27',
      'Owner: Amelia Martinez',
      'Branch: Madhapur',
    ]);
    expect(labels).not.toContain('Not pending');
    expect(labels).not.toContain('Agreed to surgery');
  });

  it('names the Agreed chip removal and drops only the outcome parameters', () => {
    const chips = buildSessionsFilterChips({ search: AGREED });
    const agreed = chips.find((chip) => chip.id === 'outcome');
    expect(agreed?.removeAriaLabel).toBe('Remove Decision Agreed filter');
    const next = removeSessionsFilterChip(new URLSearchParams(AGREED), agreed!.removeKeys);
    expect(next.get('pendingDecision')).toBeNull();
    expect(next.get('patientAgreedToSurgery')).toBeNull();
    expect(next.get('analyticsOutcome')).toBeNull();
    expect(next.get('counselorId')).toBe('c1');
    expect(next.get('sessionDateFrom')).toBe('2026-09-01');
    expect(next.get('branchId')).toBe('b1');
    expect(next.get('page')).toBeNull();
  });

  it('labels Conversion separately while removing the same agreed parameters', () => {
    const chips = buildSessionsFilterChips({
      search: 'analyticsOutcome=Conversion&patientAgreedToSurgery=true&pendingDecision=false',
    });
    expect(chips).toHaveLength(1);
    expect(chips[0]?.label).toBe('Decision: Agreed');
    expect(chips[0]?.removeAriaLabel).toBe('Remove Decision Agreed filter');
    expect(chips[0]?.removeKeys).toEqual([
      'pendingDecision',
      'patientAgreedToSurgery',
      'analyticsOutcome',
    ]);
  });

  it('collapses Declined and does not add a second not-pending chip', () => {
    const chips = buildSessionsFilterChips({
      search: 'analyticsOutcome=Declined&patientAgreedToSurgery=false&pendingDecision=false',
    });
    expect(chips.map((chip) => chip.label)).toEqual(['Decision: Declined']);
  });

  it('collapses pending-decision aging into a pending chip and a date chip', () => {
    const chips = buildSessionsFilterChips({
      search:
        'analyticsOutcome=Pending+0%E2%80%933&pendingDecision=true&agingBucket=bucket_0_3&sessionDateFrom=2026-09-25&sessionDateTo=2026-09-28',
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      'Decision: Pending',
      'Date: Sep 25 – Sep 28',
    ]);
    const dates = chips.find((chip) => chip.id === 'dates');
    expect(dates?.removeAriaLabel).toBe('Remove date range filter');
    const next = removeSessionsFilterChip(
      new URLSearchParams(
        'analyticsOutcome=Pending+decision&pendingDecision=true&agingBucket=bucket_0_3&sessionDateFrom=2026-09-25&sessionDateTo=2026-09-28&page=3',
      ),
      dates!.removeKeys,
    );
    expect(next.get('sessionDateFrom')).toBeNull();
    expect(next.get('sessionDateTo')).toBeNull();
    expect(next.get('agingBucket')).toBeNull();
    expect(next.get('pendingDecision')).toBe('true');
    expect(next.get('page')).toBeNull();
  });

  it('uses one surgery chip and does not duplicate the display-only outcome label', () => {
    const chips = buildSessionsFilterChips({
      search: 'analyticsOutcome=Phaco&recommendedSurgery=Phaco',
    });
    expect(chips).toHaveLength(1);
    expect(chips[0]?.label).toBe('Surgery: Phaco');
    expect(chips[0]?.removeAriaLabel).toBe('Remove surgery filter');
    expect(chips[0]?.removeKeys).toEqual(['recommendedSurgery', 'analyticsOutcome']);
  });

  it('does not invent a Total chip for the display-only analytics label', () => {
    const chips = buildSessionsFilterChips({
      search: 'analyticsOutcome=Total&sessionDateFrom=2026-09-01',
    });
    expect(chips.map((chip) => chip.label)).toEqual(['Date: From Sep 1']);
    expect(shouldShowAnalyticsContext('Total')).toBe(true);
    expect(shouldShowAnalyticsContext(null)).toBe(false);
  });

  it('falls back to existing filter wording when names cannot be resolved', () => {
    const chips = buildSessionsFilterChips({
      search: 'counselorId=c1&branchId=b1',
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      'Owner: Counselor filtered',
      'Branch: Branch filtered',
    ]);
    expect(chips[0]?.removeAriaLabel).toBe('Remove owner filter');
    expect(chips[1]?.removeAriaLabel).toBe('Remove branch filter');
  });

  it('clear removes drill-down filters, search, status, and Reassignment Required', () => {
    const next = clearSessionsDrilldownFilters(
      new URLSearchParams(`${AGREED}&reassignmentRequired=true&status=InProgress&search=S-10&page=4`),
    );
    expect(next.get('analyticsOutcome')).toBeNull();
    expect(next.get('pendingDecision')).toBeNull();
    expect(next.get('patientAgreedToSurgery')).toBeNull();
    expect(next.get('sessionDateFrom')).toBeNull();
    expect(next.get('counselorId')).toBeNull();
    expect(next.get('branchId')).toBeNull();
    expect(next.get('reassignmentRequired')).toBeNull();
    expect(next.get('status')).toBeNull();
    expect(next.get('search')).toBeNull();
    expect(next.get('page')).toBeNull();
    expect(hasSessionsDrilldownFilters(next)).toBe(false);
  });
});

describe('sessions register filter sheet', () => {
  it('maps owner, status, decision, dates, surgery, and reassignment together', () => {
    const next = applySessionsRegisterDraft(new URLSearchParams('page=3'), {
      counselorId: 'c1',
      status: 'InProgress',
      decision: 'Agreed',
      sessionDateFrom: '2026-08-29',
      sessionDateTo: '2026-09-28',
      recommendedSurgery: 'Phaco',
      reassignmentRequired: true,
      branchId: 'b1',
    });
    expect(next.get('counselorId')).toBe('c1');
    expect(next.get('status')).toBe('InProgress');
    expect(next.get('pendingDecision')).toBe('false');
    expect(next.get('patientAgreedToSurgery')).toBe('true');
    expect(next.get('sessionDateFrom')).toBe('2026-08-29');
    expect(next.get('sessionDateTo')).toBe('2026-09-28');
    expect(next.get('recommendedSurgery')).toBe('Phaco');
    expect(next.get('reassignmentRequired')).toBe('true');
    expect(next.get('branchId')).toBe('b1');
    expect(next.get('page')).toBeNull();
    expect(readSessionsRegisterDraft(next).decision).toBe('Agreed');
  });

  it('maps Pending and Declined without exposing extra boolean chips', () => {
    const pending = applySessionsRegisterDraft(new URLSearchParams(), {
      counselorId: '',
      status: '',
      decision: 'Pending',
      sessionDateFrom: '',
      sessionDateTo: '',
      recommendedSurgery: '',
      reassignmentRequired: false,
      branchId: '',
    });
    expect(buildSessionsFilterChips({ search: pending }).map((chip) => chip.label)).toEqual([
      'Decision: Pending',
    ]);

    const declined = applySessionsRegisterDraft(pending, {
      ...readSessionsRegisterDraft(pending),
      decision: 'Declined',
    });
    expect(declined.get('patientAgreedToSurgery')).toBe('false');
    expect(buildSessionsFilterChips({ search: declined }).map((chip) => chip.label)).toEqual([
      'Decision: Declined',
    ]);
  });

  it('removing the owner chip keeps decision and reassignment', () => {
    const current = new URLSearchParams(
      'counselorId=c1&pendingDecision=false&patientAgreedToSurgery=true&reassignmentRequired=true&page=2',
    );
    const owner = buildSessionsFilterChips({ search: current, counselorLabel: 'Amelia Martinez' }).find(
      (chip) => chip.id === 'counselor',
    );
    const next = removeSessionsFilterChip(current, owner!.removeKeys);
    expect(next.get('counselorId')).toBeNull();
    expect(next.get('pendingDecision')).toBe('false');
    expect(next.get('reassignmentRequired')).toBe('true');
    expect(next.get('page')).toBeNull();
  });
});

describe('sessions register empty copy', () => {
  it('selects the four approved empty states', () => {
    expect(resolveSessionsEmptyCopy({ reassignmentRequired: false, hasDrilldownFilters: false })).toEqual({
      title: 'No counselling sessions',
      hint: 'Sessions in your authorized branches will show here.',
    });
    expect(resolveSessionsEmptyCopy({ reassignmentRequired: false, hasDrilldownFilters: true })).toEqual({
      title: 'No sessions match these filters',
      hint: 'Clear filters to see sessions in your authorized branches.',
    });
    expect(resolveSessionsEmptyCopy({ reassignmentRequired: true, hasDrilldownFilters: false })).toEqual({
      title: 'No sessions require reassignment',
      hint: 'This list shows open sessions whose owner is inactive, removed, or no longer authorized for the branch.',
    });
    expect(resolveSessionsEmptyCopy({ reassignmentRequired: true, hasDrilldownFilters: true })).toEqual({
      title: 'No sessions require reassignment for these filters',
      hint: 'Clear filters to see every reassignment in your authorized branches.',
    });
  });
});

describe('sessions open return query', () => {
  it('preserves the list query on a recognized sessions origin', () => {
    const href = buildSessionsOpenHref('sess-9', 'counselorId=c1&pendingDecision=false&page=2');
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/dashboard/counsellors-desk/sess-9');
    expect(url.searchParams.get('from')).toBe('sessions');
    const back = resolveCounsellingSessionCloseHref('sessions', url.searchParams.get('returnQuery'));
    expect(back).toBe(
      '/dashboard/counsellors-desk/sessions?counselorId=c1&pendingDecision=false&page=2',
    );
  });

  it('ignores return targets that are not session-list parameters', () => {
    expect(resolveCounsellingSessionCloseHref('sessions', 'https://evil.example')).toBe(
      '/dashboard/counsellors-desk/sessions',
    );
    expect(resolveCounsellingSessionCloseHref('sessions', '/dashboard/admin')).toBe(
      '/dashboard/counsellors-desk/sessions',
    );
    expect(resolveCounsellingSessionCloseHref('hack', 'reassignmentRequired=true')).toBe(
      '/dashboard/counsellors-desk/waiting-list',
    );
    expect(resolveCounsellingSessionCloseHref('waiting-list', 'page=4')).toBe(
      '/dashboard/counsellors-desk/waiting-list',
    );
  });
});
