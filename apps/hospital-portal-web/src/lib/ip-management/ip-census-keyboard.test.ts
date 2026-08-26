import { describe, expect, it } from 'vitest';
import { isEditableKeyboardTarget, nextCensusIndex } from './ip-census-keyboard';

describe('nextCensusIndex', () => {
  it('selects first on down and last on up when nothing is selected', () => {
    expect(nextCensusIndex(null, 1, 5)).toBe(0);
    expect(nextCensusIndex(null, -1, 5)).toBe(4);
  });

  it('clamps rather than wrapping', () => {
    expect(nextCensusIndex(0, -1, 5)).toBe(0);
    expect(nextCensusIndex(4, 1, 5)).toBe(4);
    expect(nextCensusIndex(2, 1, 5)).toBe(3);
  });

  it('returns null for an empty list', () => {
    expect(nextCensusIndex(null, 1, 0)).toBeNull();
  });
});

describe('isEditableKeyboardTarget', () => {
  it('treats inputs as editable and ignores plain nodes', () => {
    expect(isEditableKeyboardTarget({ tagName: 'INPUT' } as EventTarget)).toBe(true);
    expect(isEditableKeyboardTarget({ tagName: 'DIV', isContentEditable: false } as EventTarget)).toBe(false);
    expect(isEditableKeyboardTarget(null)).toBe(false);
  });
});
