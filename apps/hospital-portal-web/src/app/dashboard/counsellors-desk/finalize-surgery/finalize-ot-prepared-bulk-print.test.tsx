import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FINALIZE_PAGE = join(
  process.cwd(),
  'src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx',
);
const OT_SLIP_HELPER = join(process.cwd(), 'src/lib/counsellors-desk/ot-slip-print.ts');
const PACKAGE_B_HELPER = join(
  process.cwd(),
  'src/lib/counsellors-desk/ot-preparation-prepared-list-print.ts',
);

describe('OT Prepared — bulk OT slip printing contracts', () => {
  const page = readFileSync(FINALIZE_PAGE, 'utf8');
  const slipHelper = readFileSync(OT_SLIP_HELPER, 'utf8');
  const packageB = readFileSync(PACKAGE_B_HELPER, 'utf8');

  it('does not render a row-level Print OT Slip or decorative chevron on any finalization grid', () => {
    expect(page).not.toContain('printOtSlip');
    expect(page).not.toContain('aria-label="Print OT Slip"');
    expect(page).not.toContain('<ChevronRight');
    expect(page).not.toContain('finalize-ot-prepared-row-print-');
    expect(page).toContain('openOtSlipsPrint');
    expect(page).toContain('resolveFinalizeQueuePrimaryAction');
    expect(page).toContain('primary.label');
  });

  it('OT Prepared row action stays the certified primary (Reopen) beside bulk Print OT Slips', () => {
    expect(page).toContain('finalize-ot-prepared-print-slips');
    expect(page).toContain('Print OT Slips');
    expect(page).toContain('primary.label');
    expect(page).toContain('onAction={(action) => void handleAction(action, rec)}');
  });

  it('OT Prepared tab has current-page selection + Print OT Slips (N)', () => {
    expect(page).toContain('finalize-ot-prepared-print-selection-bar');
    expect(page).toContain('finalize-ot-prepared-select-all-visible');
    expect(page).toContain('finalize-ot-prepared-clear-selection');
    expect(page).toContain('finalize-ot-prepared-selected-count');
    expect(page).toContain('finalize-ot-prepared-print-slips');
    expect(page).toContain('selectAllVisibleOtPreparedIds');
    expect(page).toContain('selectedOtPreparedRecordsInOrder');
    expect(page).toContain('Print OT Slips');
  });

  it('Select All Visible uses current page only via reconcileSelectionToVisible', () => {
    expect(page).toContain('reconcileSelectionToVisible');
    expect(page).toContain('selectAllVisibleOtPreparedPrint');
    expect(page).toMatch(/isOtPreparedTab/);
  });

  it('bulk print uses OT slip format — not Package B prepared list', () => {
    expect(slipHelper).toContain('class="ot-slip"');
    expect(slipHelper).toContain('page-break-after:always');
    expect(slipHelper).toContain('Patient Name');
    expect(slipHelper).toContain('Reporting Time');
    expect(slipHelper).not.toContain('OT Preparation — Prepared List');
    expect(packageB).toContain('OT Preparation — Prepared List');
    expect(packageB).not.toContain('class="ot-slip"');
  });

  it('does not introduce new API client methods for bulk print', () => {
    expect(page).not.toMatch(/getOtSlipsBulk|printOtSlipsApi|bulkOtSlip/);
    expect(slipHelper).not.toMatch(/counsellorsDeskApi\./);
    // Package B still owns getOtList for prepared-list print
    expect(packageB).toContain('counsellorsDeskApi.getOtList');
  });

  it('RESP2 OT Prep Print CTA remains separate', () => {
    expect(page).toContain('finalize-ot-prep-print-prepared');
    expect(page).toContain('openOtPreparationPreparedListPrint');
  });
});
