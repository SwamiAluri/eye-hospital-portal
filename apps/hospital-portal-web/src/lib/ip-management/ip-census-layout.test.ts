import { describe, expect, it } from 'vitest';
import {
  CENSUS_COLUMNS,
  censusColumnsVisible,
  censusPresentationForWidth,
} from './ip-census-layout';

describe('censusPresentationForWidth', () => {
  it('docks at 1280 and above', () => {
    expect(censusPresentationForWidth(1280)).toBe('docked');
    expect(censusPresentationForWidth(1440)).toBe('docked');
  });

  it('uses a sheet between 1024 and 1280', () => {
    expect(censusPresentationForWidth(1024)).toBe('sheet');
    expect(censusPresentationForWidth(1279)).toBe('sheet');
  });

  it('uses cards below 1024', () => {
    expect(censusPresentationForWidth(1023)).toBe('cards');
    expect(censusPresentationForWidth(390)).toBe('cards');
  });
});

describe('censusColumnsVisible', () => {
  it('keeps the full census column set when the rail is open', () => {
    const compact = censusColumnsVisible(true).map(c => c.key);
    expect(compact).toEqual([
      'clinical', 'patient', 'procedure', 'ward', 'slot', 'admitted', 'ot', 'next', 'attention',
    ]);
  });

  it('does not shed columns when the pane is closed', () => {
    expect(censusColumnsVisible(false)).toHaveLength(CENSUS_COLUMNS.length);
    expect(censusColumnsVisible(true)).toEqual(censusColumnsVisible(false));
  });
});
