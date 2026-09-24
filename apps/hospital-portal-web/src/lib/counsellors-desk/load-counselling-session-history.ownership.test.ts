import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Phase 3I Slice 5 — Auth ownership events must survive Azure/Auth merge.
 */
describe('loadCounsellingSessionHistory ownership merge contract', () => {
  it('keeps non-FieldChanged Auth rows (ownership) when Azure FieldChanged dedupe runs', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, 'load-counselling-session-history.ts'), 'utf8');

    expect(src).toContain("if (e.changeType !== 'FieldChanged') return true");
    expect(src).toContain('counsellorsDeskApi.getSessionHistory');
  });

  it('merges AdditionalNotes ReQueue markers into History only when OwnershipRequeued is missing', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, 'load-counselling-session-history.ts'), 'utf8');
    expect(src).toContain('requeueHistoryEntriesFromAdditionalNotes');
    expect(src).toContain('additionalNotes');
  });
});
