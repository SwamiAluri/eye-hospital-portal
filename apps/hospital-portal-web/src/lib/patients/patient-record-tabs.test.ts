import { describe, expect, it } from 'vitest';
import {
  getDefaultTabForGroup,
  HIDDEN_FROM_RECORD_SHELL,
  isRecordShellTab,
  PATIENT_RECORD_TAB_GROUPS,
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
    expect(resolveTabGroup('visits')).toBe('admin');
    expect(resolveTabGroup('insurance')).toBe('billing');
    expect(resolveTabGroup('scheduling')).toBe('admin');
  });

  it('getDefaultTabForGroup returns first visible tab', () => {
    expect(getDefaultTabForGroup('admin')).toBe('encounters');
    expect(getDefaultTabForGroup('billing')).toBe('billing');
    expect(getDefaultTabForGroup('clinical')).toBe('overview');
  });

  it('hides placeholder and broken tabs from the operational shell', () => {
    const shown = Object.values(PATIENT_RECORD_TAB_GROUPS).flatMap((group) => [
      ...group.visible,
      ...group.overflow,
    ]);
    for (const hidden of HIDDEN_FROM_RECORD_SHELL) {
      expect(isRecordShellTab(hidden)).toBe(false);
      expect(shown).not.toContain(hidden);
    }
    for (const kept of [
      'overview',
      'vitals',
      'allergies',
      'visits',
      'scheduling',
      'medications',
      'prescriptions',
      'lab_results',
      'imaging',
      'billing',
      'insurance',
      'consents',
      'notes',
      'communications',
      'optical',
      'medical_records',
      'encounters',
    ] as const) {
      expect(isRecordShellTab(kept)).toBe(true);
      expect(shown).toContain(kept);
    }
  });

  it('isOverflowTab identifies more-menu tabs', () => {
    expect(isOverflowTab('notes', 'clinical')).toBe(true);
    expect(isOverflowTab('overview', 'clinical')).toBe(false);
    expect(isTabInGroup('scheduling', 'admin')).toBe(true);
  });
});
