import { describe, expect, it } from 'vitest';
import {
  compareReadyForOtQueue,
  formatBoardScopeDate,
  formatDurationMinutes,
  formatSlotLabel,
  matchesSlotSession,
  slotCardBadges,
  sortIpCensusRows,
} from './ip-slot-display';

describe('formatSlotLabel', () => {
  it('renders AM/PM/EV sequence tags', () => {
    expect(formatSlotLabel('Morning', 3)).toBe('AM-3');
    expect(formatSlotLabel('Afternoon', 1)).toBe('PM-1');
    expect(formatSlotLabel('Evening', 2)).toBe('EV-2');
    expect(formatSlotLabel(null, 1)).toBeNull();
  });
});

describe('matchesSlotSession', () => {
  it('filters by session and treats All as pass-through', () => {
    expect(matchesSlotSession({ slotSession: 'Morning' }, 'All')).toBe(true);
    expect(matchesSlotSession({ slotSession: 'Morning' }, 'Morning')).toBe(true);
    expect(matchesSlotSession({ slotSession: 'Afternoon' }, 'Morning')).toBe(false);
  });
});

describe('compareReadyForOtQueue', () => {
  it('orders by sequence then planned arrival', () => {
    const rows = [
      { id: 'late', slotSequenceNo: 2, plannedArrivalAt: '2026-08-25T02:15:00Z' },
      { id: 'first', slotSequenceNo: 1, plannedArrivalAt: '2026-08-25T01:45:00Z' },
      { id: 'unslotted', slotSequenceNo: null, plannedArrivalAt: null },
    ];
    rows.sort(compareReadyForOtQueue);
    expect(rows.map(r => r.id)).toEqual(['first', 'late', 'unslotted']);
  });
});

describe('sortIpCensusRows', () => {
  it('orders Ready for OT by slot sequence using the census tab key', () => {
    const rows = [
      { id: 'second', slotSequenceNo: 2, plannedArrivalAt: '2026-08-25T02:15:00Z' },
      { id: 'first', slotSequenceNo: 1, plannedArrivalAt: '2026-08-25T03:00:00Z' },
    ];
    expect(sortIpCensusRows(rows, 'ReadyForOt').map(r => r.id)).toEqual(['first', 'second']);
    expect(sortIpCensusRows(rows, 'ReadyForSurgery').map(r => r.id)).toEqual(['second', 'first']);
    expect(sortIpCensusRows(rows, 'All').map(r => r.id)).toEqual(['second', 'first']);
  });
});

describe('formatDurationMinutes', () => {
  it('renders minutes and hours', () => {
    expect(formatDurationMinutes(null)).toBe('—');
    expect(formatDurationMinutes(25)).toBe('25m');
    expect(formatDurationMinutes(90)).toBe('1h 30m');
    expect(formatDurationMinutes(120)).toBe('2h');
  });
});

describe('formatBoardScopeDate', () => {
  it('renders day-month-year in en-GB', () => {
    expect(formatBoardScopeDate('2026-08-24')).toBe('24 Aug 2026');
  });
});

describe('slotCardBadges', () => {
  it('shows Ready, In OT and PAC pending like the S-13 mockup', () => {
    expect(slotCardBadges({ clinicalState: 'ReadyForSurgery', pacCompleted: true, otState: 'NotSent' }).map(b => b.label))
      .toEqual(['Ready']);
    expect(slotCardBadges({ clinicalState: 'InOT', pacCompleted: true, otState: 'InProgress' }).map(b => b.label))
      .toContain('In OT');
    expect(slotCardBadges({ clinicalState: 'Admitted', pacCompleted: false }).map(b => b.label))
      .toContain('PAC pending');
    expect(slotCardBadges({ clinicalState: 'Expected', pacCompleted: false }).map(b => b.label))
      .toEqual(['Not admitted']);
  });
});
