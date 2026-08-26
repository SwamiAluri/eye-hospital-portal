import { describe, expect, it } from 'vitest';
import {
  otClinicalChip,
  otCoverageProjection,
  otFinancialChip,
  otLaterality,
  otSeqLabel,
  otStateChip,
  sortOtBoardRows,
} from './ot-board-display';

describe('otLaterality', () => {
  it('spells laterality as word plus code', () => {
    expect(otLaterality('OD')).toEqual({ text: 'RIGHT OD', missing: false });
  });

  it('does not invent an eye when unset', () => {
    expect(otLaterality(null)).toEqual({ text: 'Eye not set', missing: true });
  });
});

describe('otClinicalChip', () => {
  it('overlays Accepted on SentToOT', () => {
    expect(otClinicalChip('SentToOT', 'Accepted')).toEqual({
      status: 'in-progress',
      label: 'Accepted in OT',
    });
  });

  it('keeps Sent to OT when not yet accepted', () => {
    expect(otClinicalChip('SentToOT', 'SentToOT').label).toBe('Sent to OT');
  });
});

describe('otStateChip', () => {
  it('uses OT-owned labels, not counselling StatusBadge strings', () => {
    expect(otStateChip('InProgress').label).toBe('Surgery in progress');
    expect(otStateChip('Accepted').status).toBe('in-progress');
  });
});

describe('otFinancialChip', () => {
  it('treats missing state as unavailable projection, not authorised', () => {
    expect(otFinancialChip(null).label).toBe('No financial projection');
    expect(otFinancialChip('Paid').label).toBe('Collected');
  });
});

describe('otCoverageProjection', () => {
  it('does not invent self-pay or approved from an empty mode', () => {
    expect(otCoverageProjection(null)).toBeNull();
    expect(otCoverageProjection('TPA')).toBe('TPA');
  });
});

describe('otSeqLabel / sortOtBoardRows', () => {
  it('prefers slotLabel', () => {
    expect(otSeqLabel({ slotLabel: 'AM-1', slotSequenceNo: 9 })).toBe('AM-1');
  });

  it('orders by slot sequence then label', () => {
    const sorted = sortOtBoardRows([
      { slotSequenceNo: 2, slotLabel: 'AM-2', surgeryScheduledAt: 'b' },
      { slotSequenceNo: 1, slotLabel: 'AM-1', surgeryScheduledAt: 'a' },
    ]);
    expect(sorted.map(r => r.slotLabel)).toEqual(['AM-1', 'AM-2']);
  });
});
