import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FINALIZE_PAGE = join(
  process.cwd(),
  'src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx',
);
const FINALIZE_MODAL = join(
  process.cwd(),
  'src/components/counsellors-desk/FinalizeOtModal.tsx',
);

describe('Phase 3I Slice 9 — Finalize cancel toast honesty', () => {
  it('cancel success toast says surgery schedule cancelled or status updated (modal)', () => {
    const modal = readFileSync(FINALIZE_MODAL, 'utf8');
    // Package 1: cancel runs via modal; toast is generic status update or schedule cancelled wording.
    expect(modal).toMatch(/Status updated to|surgery schedule cancelled/i);
  });

  it('cancel toast does not claim counselling session re-queued', () => {
    const page = readFileSync(FINALIZE_PAGE, 'utf8');
    const modal = readFileSync(FINALIZE_MODAL, 'utf8');
    expect(page).not.toContain('counselling session re-queued');
    expect(modal).not.toContain('counselling session re-queued');
  });

  it('cancel path uses cancelOtSchedule with reason (no reQueueSession)', () => {
    const modal = readFileSync(FINALIZE_MODAL, 'utf8');
    expect(modal).toContain('cancelOtSchedule');
    expect(modal).toMatch(/cancelOtSchedule\([\s\S]{0,120}cancelReason/);
    expect(modal).not.toContain('reQueueSession');
    const page = readFileSync(FINALIZE_PAGE, 'utf8');
    expect(page).not.toContain('reQueueSession');
  });
});
