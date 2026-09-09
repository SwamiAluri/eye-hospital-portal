import { describe, expect, it } from 'vitest';
import {
  WAITING_LIST_OT_GRID,
  WAITING_LIST_OT_GRID_TRACKS,
  WAITING_LIST_WORK_GRID,
  WAITING_LIST_WORK_GRID_TRACKS,
  formatWaitingListDoctorDisplay,
} from './waiting-list-layout';

describe('formatWaitingListDoctorDisplay', () => {
  it('collapses repeated Dr. prefixes', () => {
    expect(formatWaitingListDoctorDisplay('Dr. Dr. Smith')).toBe('Dr. Smith');
  });

  it('returns empty for blank input', () => {
    expect(formatWaitingListDoctorDisplay('')).toBe('');
    expect(formatWaitingListDoctorDisplay('   ')).toBe('');
    expect(formatWaitingListDoctorDisplay(null)).toBe('');
    expect(formatWaitingListDoctorDisplay(undefined)).toBe('');
  });
});

describe('WAITING_LIST_WORK_GRID', () => {
  it('exports CSS class wired to counselling-session theme', () => {
    expect(WAITING_LIST_WORK_GRID).toBe('waiting-list-work-grid');
  });

  it('documents five intentional unequal desktop tracks', () => {
    expect(WAITING_LIST_WORK_GRID_TRACKS).toContain('1.6fr');
    expect(WAITING_LIST_WORK_GRID_TRACKS).toContain('8.5rem');
    expect(WAITING_LIST_WORK_GRID_TRACKS.split('minmax(').length - 1).toBe(5);
  });
});

describe('WAITING_LIST_OT_GRID', () => {
  it('exports a separate OT CSS class', () => {
    expect(WAITING_LIST_OT_GRID).toBe('waiting-list-ot-grid');
    expect(WAITING_LIST_OT_GRID).not.toBe(WAITING_LIST_WORK_GRID);
  });

  it('documents five OT desktop tracks', () => {
    expect(WAITING_LIST_OT_GRID_TRACKS.split('minmax(').length - 1).toBe(5);
  });
});
