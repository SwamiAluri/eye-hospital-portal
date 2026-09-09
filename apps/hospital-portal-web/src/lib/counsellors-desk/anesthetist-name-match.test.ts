import { describe, expect, it } from 'vitest';
import {
  findAnesthetistsByDisplayName,
  hasUnresolvedAnesthetistNameConflict,
  normalizeAnesthetistName,
  resolveAnesthetistUiMode,
  type AnesthetistOption,
} from './anesthetist-name-match';

const staff: AnesthetistOption[] = [
  { id: '1', name: 'Dr. John Smith', employeeId: 'AN-102', jobTitle: 'Anaesthetist', specialization: 'Anaesthesia' },
  { id: '2', name: 'Dr. John Smith', employeeId: 'AN-118', jobTitle: 'Anaesthetist', specialization: 'Anaesthesia' },
  { id: '3', name: 'Dr. Priya Nair', employeeId: 'AN-200', jobTitle: 'Anesthesiologist', specialization: '' },
];

describe('normalizeAnesthetistName', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeAnesthetistName('  Dr.  John   Smith ')).toBe('dr. john smith');
  });

  it('treats empty/whitespace as empty', () => {
    expect(normalizeAnesthetistName('   ')).toBe('');
    expect(normalizeAnesthetistName(undefined)).toBe('');
  });
});

describe('findAnesthetistsByDisplayName', () => {
  it('finds case/whitespace-insensitive matches against staff only', () => {
    const matches = findAnesthetistsByDisplayName('dr. john  smith', staff);
    expect(matches.map((m) => m.id)).toEqual(['1', '2']);
  });

  it('returns empty when no staff match', () => {
    expect(findAnesthetistsByDisplayName('External Consultant', staff)).toEqual([]);
  });
});

describe('resolveAnesthetistUiMode', () => {
  it('defaults to list when no saved name', () => {
    expect(resolveAnesthetistUiMode('', staff)).toEqual({ mode: 'list', selectedId: null });
  });

  it('selects matching staff by name (list mode)', () => {
    expect(resolveAnesthetistUiMode('Dr. Priya Nair', staff)).toEqual({
      mode: 'list',
      selectedId: '3',
    });
  });

  it('uses other mode for unmatched saved names', () => {
    expect(resolveAnesthetistUiMode('Visiting Anaesthetist', staff)).toEqual({
      mode: 'other',
      selectedId: null,
    });
  });

  it('when multiple staff share a name, keeps list mode with first match id for selection UI', () => {
    const result = resolveAnesthetistUiMode('Dr. John Smith', staff);
    expect(result.mode).toBe('list');
    expect(result.selectedId).toBe('1');
  });
});

describe('hasUnresolvedAnesthetistNameConflict', () => {
  it('is true only in other mode when the typed name matches staff', () => {
    expect(hasUnresolvedAnesthetistNameConflict('other', 'Dr. Priya Nair', staff)).toBe(true);
    expect(hasUnresolvedAnesthetistNameConflict('list', 'Dr. Priya Nair', staff)).toBe(false);
    expect(hasUnresolvedAnesthetistNameConflict('other', 'Unique External', staff)).toBe(false);
  });
});
