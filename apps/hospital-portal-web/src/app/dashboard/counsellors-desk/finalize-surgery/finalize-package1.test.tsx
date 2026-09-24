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

describe('Package 1 — Finalize page KPI contracts', () => {
  const page = readFileSync(FINALIZE_PAGE, 'utf8');

  it('removes Avg. Wait KPI', () => {
    expect(page).not.toContain('finalize-stat-avg-wait');
    expect(page).not.toContain('Avg. Wait');
    expect(page).not.toContain('avgWait');
  });

  it('uses Awaiting Finalise label for needs-attention KPI', () => {
    expect(page).toContain('NEEDS_ATTENTION_KPI_LABEL');
    expect(page).toContain('countNeedsAttention');
    expect(page).not.toMatch(/sessionStatusDetailLabel\}>Needs Attention</);
  });

  it('queue Confirm checks Reporting Time before API', () => {
    expect(page).toContain('isReportingTimeValid(rec.reportingTime)');
  });

  it('Package LA — Reporting Time display uses 12h formatter on machine HH:mm field', () => {
    expect(page).toContain('formatCounsellingTimeDisplay(rec.reportingTime)');
  });
});

describe('Package 1 — Finalize cancel dialog contracts', () => {
  const modal = readFileSync(FINALIZE_MODAL, 'utf8');

  it('opens cancel confirmation dialog instead of immediate cancel', () => {
    expect(modal).toContain('finalize-cancel-confirm-dialog');
    expect(modal).toContain('openCancelDialog');
    expect(modal).toContain('cancelReason');
  });

  it('posts cancel with cancelReason payload', () => {
    expect(modal).toMatch(/cancelOtSchedule\([^)]*cancelReason/);
  });

  it('does not claim counselling re-queue on cancel', () => {
    expect(modal).not.toContain('re-queued');
    expect(modal).not.toContain('reQueueSession');
  });

  it('Package LA — Confirmed modal has no Finalise footer action (queue retains Finalise)', () => {
    expect(modal).toContain('resolveFinalizeOtModalFooterActions');
    expect(modal).not.toMatch(/runAction\(['"]finalise['"]\)/);
  });

  it('Package LA — C-LA-04 deferred: Cancel Surgery remains in modal', () => {
    expect(modal).toContain('Cancel Surgery');
    expect(modal).toContain('openCancelDialog');
  });
});
