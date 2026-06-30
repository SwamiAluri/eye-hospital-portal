import { describe, expect, it } from 'vitest';
import {
  getDefaultTabForGroup,
  resolveTabGroup,
  isTabInGroup,
  isOverflowTab,
} from '@/lib/patients/patient-record-tabs';

describe('patient-record-tabs groups', () => {
  it('resolveTabGroup maps clinical tabs', () => {
    expect(resolveTabGroup('overview')).toBe('clinical');
    expect(resolveTabGroup('imaging')).toBe('clinical');
    expect(resolveTabGroup('notes')).toBe('clinical');
  });

  it('resolveTabGroup maps admin and billing tabs', () => {
    expect(resolveTabGroup('documents')).toBe('admin');
    expect(resolveTabGroup('insurance')).toBe('billing');
    expect(resolveTabGroup('counseling')).toBe('billing');
  });

  it('getDefaultTabForGroup returns first visible tab', () => {
    expect(getDefaultTabForGroup('admin')).toBe('documents');
    expect(getDefaultTabForGroup('billing')).toBe('billing');
  });

  it('isOverflowTab identifies more-menu tabs', () => {
    expect(isOverflowTab('notes', 'clinical')).toBe(true);
    expect(isOverflowTab('overview', 'clinical')).toBe(false);
    expect(isTabInGroup('scheduling', 'admin')).toBe(true);
  });
});
