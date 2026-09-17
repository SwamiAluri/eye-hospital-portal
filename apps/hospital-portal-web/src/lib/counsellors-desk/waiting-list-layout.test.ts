import { describe, expect, it } from 'vitest';
import {
  WAITING_LIST_OT_GRID,
  WAITING_LIST_OT_GRID_TRACKS,
  WAITING_LIST_WORK_GRID,
  WAITING_LIST_WORK_GRID_TRACKS,
  WAITING_LIST_WORK_GRID_TRACKS_COMPRESSED,
  WAITING_LIST_WORK_GRID_TRACKS_LAPTOP,
  WAITING_LIST_WORK_GRID_TRACKS_WORKSTATION,
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

  it('documents seven intentional unequal desktop tracks (Patient|Visit|Procedure|Owner|Payment|Status|Action)', () => {
    expect(WAITING_LIST_WORK_GRID_TRACKS).toContain('1.2fr');
    expect(WAITING_LIST_WORK_GRID_TRACKS.split('minmax(').length - 1).toBe(7);
    // Action track sized for single-line lifecycle CTAs (Re-evaluate / Start Repeat)
    expect(WAITING_LIST_WORK_GRID_TRACKS).toContain('minmax(9.5rem, 11rem)');
  });

  it('documents workstation fluid tracks (seven zones, flexible mins)', () => {
    expect(WAITING_LIST_WORK_GRID_TRACKS_COMPRESSED.split('minmax(').length - 1).toBe(7);
    expect(WAITING_LIST_WORK_GRID_TRACKS_LAPTOP.split('minmax(').length - 1).toBe(7);
    expect(WAITING_LIST_WORK_GRID_TRACKS_COMPRESSED).toContain('minmax(0,');
    expect(WAITING_LIST_WORK_GRID_TRACKS_WORKSTATION).toBe(WAITING_LIST_WORK_GRID_TRACKS_COMPRESSED);
    expect(WAITING_LIST_WORK_GRID_TRACKS_WORKSTATION).toContain('minmax(8.75rem, 10.25rem)');
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
