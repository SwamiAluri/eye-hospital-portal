import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FINALIZE_PAGE = join(
  process.cwd(),
  'src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx',
);

describe('RESP2 — OT Preparation Finalised worklist contracts', () => {
  const page = readFileSync(FINALIZE_PAGE, 'utf8');

  it('uses Finalised worklist presentation (not date-dashboard)', () => {
    expect(page).toContain('finalize-ot-preparation-workspace');
    expect(page).toContain('filterFinalisedForOtPrepWorklist');
    expect(page).toContain('finalize-ot-prep-toolbar');
    expect(page).not.toContain('finalize-ot-surgery-date-catalog');
    expect(page).not.toContain('Ready for OT Preparation');
    expect(page).not.toContain('Dates requiring preparation');
    expect(page).not.toContain('Prepare New List');
  });

  it('implements page-local selection + select all visible', () => {
    expect(page).toContain('finalize-ot-prep-select-all-visible');
    expect(page).toContain('selectAllVisibleIds');
    expect(page).toContain('reconcileSelectionToVisible');
    expect(page).toContain('type="checkbox"');
  });

  it('blocks mixed-date Prepare and confirms with selected count', () => {
    expect(page).toContain('resolveSinglePrepareScheduleDate');
    expect(page).toContain('Selected surgeries must have the same surgery date');
    expect(page).toContain('finalize-ot-prep-confirm');
    expect(page).toContain('finalize-ot-prep-confirm-count');
  });

  it('submits only selected IDs with continued SequenceNo via existing Prepare API', () => {
    expect(page).toContain('selectedRecordsInWorklistOrder');
    expect(page).toContain('highestOtPreparedSequenceForDate');
    expect(page).toContain('buildContinuedPrepareItems');
    expect(page).toContain('submitPrepareOtList');
    expect(page).toContain('requestOtPrepPrepare');
    expect(page).toContain('confirmOtPrepPrepare');
  });

  it('reuses FinalizeOtModal and View OT Prepared → Finalization', () => {
    expect(page).toContain('FinalizeOtModal');
    expect(page).toContain('finalize-ot-view-prepared');
    expect(page).toContain("setActiveTab('OTPrepared')");
    expect(page).not.toContain('finalize-ot-prepared-grid');
  });

  it('does not invent a second Prepare endpoint or route', () => {
    expect(page).not.toMatch(/submitPrepareOtListV2|prepareOtBatch|newPrepare/);
    expect(page).toContain("activeWorkspace === 'ot-preparation'");
  });

  it('Package B — Print CTA invokes dedicated prepared-list print (not SPA window.print)', () => {
    expect(page).toContain('finalize-ot-prep-print-prepared');
    expect(page).toContain('openOtPreparationPreparedListPrint');
    expect(page).toContain('printOtPreparationPreparedList');
    // RESP2: page must not call getOtList directly (print helper owns READ)
    expect(page).not.toMatch(/getOtList/);
    // OT Prep Print must not call SPA window.print — only the dedicated helper
    expect(page).not.toMatch(
      /printOtPreparationPreparedList[\s\S]{0,400}window\.print\(/,
    );
  });
});
