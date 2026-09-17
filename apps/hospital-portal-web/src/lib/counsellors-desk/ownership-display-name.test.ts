import { describe, expect, it } from 'vitest';
import {
  buildCounselorNameMap,
  filterCounselorsByQuery,
  formatEligibleCounsellorCount,
  formatOwnershipParty,
  resolveAssignCounsellorListState,
} from '@/lib/counsellors-desk/ownership-display-name';

describe('ownership display name helpers', () => {
  it('NULL / empty → Unassigned', () => {
    expect(formatOwnershipParty(null, {})).toBe('Unassigned');
    expect(formatOwnershipParty(undefined, {})).toBe('Unassigned');
    expect(formatOwnershipParty('', {})).toBe('Unassigned');
    expect(formatOwnershipParty('   ', {})).toBe('Unassigned');
  });

  it('known counselor ID → display name', () => {
    const map = { '48a94c56-ccb2-49c0-9916-bee2703b0251': 'Amelia Martinez' };
    expect(formatOwnershipParty('48a94c56-ccb2-49c0-9916-bee2703b0251', map)).toBe(
      'Amelia Martinez',
    );
  });

  it('unresolved identity → Unknown user (not raw GUID)', () => {
    const guid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(formatOwnershipParty(guid, {})).toBe('Unknown user');
    expect(formatOwnershipParty(guid, {})).not.toContain('aaaaaaaa');
  });

  it('buildCounselorNameMap merges counselors + session owner', () => {
    const map = buildCounselorNameMap(
      [
        {
          id: 'c1',
          firstName: 'Amelia',
          lastName: 'Martinez',
          name: 'Amelia Martinez',
          email: null,
        },
      ],
      { counselorId: 'c2', counselorName: 'Rahul Kumar' },
    );
    expect(map.c1).toBe('Amelia Martinez');
    expect(map.c2).toBe('Rahul Kumar');
  });

  it('filterCounselorsByQuery matches name/email case-insensitively', () => {
    const list = [
      {
        id: '1',
        firstName: 'Amelia',
        lastName: 'Martinez',
        name: 'Amelia Martinez',
        email: 'amelia@test.com',
      },
      {
        id: '2',
        firstName: 'Rahul',
        lastName: 'Kumar',
        name: 'Rahul Kumar',
        email: 'rahul@test.com',
      },
    ];
    expect(filterCounselorsByQuery(list, 'amelia')).toHaveLength(1);
    expect(filterCounselorsByQuery(list, 'RAHUL@')).toHaveLength(1);
    expect(filterCounselorsByQuery(list, 'zzz')).toHaveLength(0);
    expect(filterCounselorsByQuery(list, '')).toHaveLength(2);
  });

  it('formatEligibleCounsellorCount uses actual count', () => {
    expect(formatEligibleCounsellorCount(1)).toBe('1 eligible counsellor');
    expect(formatEligibleCounsellorCount(2)).toBe('2 eligible counsellors');
    expect(formatEligibleCounsellorCount(0)).toBe('0 eligible counsellors');
  });

  it('resolveAssignCounsellorListState distinguishes loading / empty / search / error / ready', () => {
    expect(
      resolveAssignCounsellorListState({
        loading: true,
        error: null,
        eligibleCount: 0,
        filteredCount: 0,
        query: '',
      }),
    ).toBe('loading');

    expect(
      resolveAssignCounsellorListState({
        loading: false,
        error: 'Could not load counsellors.',
        eligibleCount: 0,
        filteredCount: 0,
        query: '',
      }),
    ).toBe('error');

    expect(
      resolveAssignCounsellorListState({
        loading: false,
        error: null,
        eligibleCount: 0,
        filteredCount: 0,
        query: '',
      }),
    ).toBe('empty');

    expect(
      resolveAssignCounsellorListState({
        loading: false,
        error: null,
        eligibleCount: 2,
        filteredCount: 0,
        query: 'zzz',
      }),
    ).toBe('no-match');

    expect(
      resolveAssignCounsellorListState({
        loading: false,
        error: null,
        eligibleCount: 1,
        filteredCount: 1,
        query: '',
      }),
    ).toBe('ready');
  });
});
