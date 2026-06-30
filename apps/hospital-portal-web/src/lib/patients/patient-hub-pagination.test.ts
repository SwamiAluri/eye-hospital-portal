import { describe, expect, it } from 'vitest';
import {
  getPatientHubPageRange,
  getVisiblePageNumbers,
} from '@/lib/patients/patient-hub-pagination';

describe('patient-hub-pagination', () => {
  it('getPatientHubPageRange returns zero range for empty results', () => {
    expect(getPatientHubPageRange(1, 25, 0)).toEqual({ start: 0, end: 0 });
  });

  it('getPatientHubPageRange clamps end on last page', () => {
    expect(getPatientHubPageRange(3, 25, 52)).toEqual({ start: 51, end: 52 });
  });

  it('getVisiblePageNumbers returns all pages for small totals', () => {
    expect(getVisiblePageNumbers(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it('getVisiblePageNumbers ellipsizes near the start', () => {
    expect(getVisiblePageNumbers(2, 12)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 12]);
  });

  it('getVisiblePageNumbers ellipsizes in the middle', () => {
    expect(getVisiblePageNumbers(6, 12)).toEqual([1, 'ellipsis', 5, 6, 7, 'ellipsis', 12]);
  });

  it('getVisiblePageNumbers ellipsizes near the end', () => {
    expect(getVisiblePageNumbers(11, 12)).toEqual([1, 'ellipsis', 8, 9, 10, 11, 12]);
  });
});
