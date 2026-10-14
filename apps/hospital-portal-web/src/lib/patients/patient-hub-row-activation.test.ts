import { describe, expect, it } from 'vitest';
import { shouldActivateRowPreview } from './patient-hub-row-activation';

describe('shouldActivateRowPreview', () => {
  const row = { id: 'row' };
  const link = { id: 'name' };

  it('opens preview for Enter and Space on the row', () => {
    expect(shouldActivateRowPreview({ key: 'Enter', target: row, currentTarget: row })).toBe(true);
    expect(shouldActivateRowPreview({ key: ' ', target: row, currentTarget: row })).toBe(true);
  });

  it('does not open preview when a nested control receives the key', () => {
    expect(shouldActivateRowPreview({ key: 'Enter', target: link, currentTarget: row })).toBe(false);
    expect(shouldActivateRowPreview({ key: ' ', target: link, currentTarget: row })).toBe(false);
  });

  it('ignores other keys on the row', () => {
    expect(shouldActivateRowPreview({ key: 'Tab', target: row, currentTarget: row })).toBe(false);
  });
});
