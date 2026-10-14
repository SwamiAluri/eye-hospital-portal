import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Gen-1 Directory no longer mounts PatientAdvancedFilterSheet.
 * Keep a guard that the live page uses always-visible toolbar filters.
 */
describe('directory filter surface (always-visible Gen-1)', () => {
  it('Directory page mounts toolbar filters instead of the advanced Sheet', () => {
    const page = readFileSync(resolve(__dirname, 'PatientHubPage.tsx'), 'utf8');
    const toolbar = readFileSync(
      resolve(__dirname, 'PatientDirectoryToolbarFilters.tsx'),
      'utf8',
    );
    expect(page).toContain('PatientDirectoryToolbarFilters');
    expect(page).not.toContain('PatientAdvancedFilterSheet');
    expect(page).not.toContain('PatientFilterChips');
    expect(toolbar).toContain('Gender');
    expect(toolbar).toContain('prefix="DOB From:"');
    expect(toolbar).toContain('prefix="To:"');
    expect(toolbar).toContain('onApply({ ...state, ...partial, page: 1 })');
    expect(toolbar).not.toContain('>Apply<');
    expect(toolbar).not.toContain('filterApply');
    expect(page).toContain('filterClear');
    expect(page).toContain('source: "census-bar"');
  });
});
