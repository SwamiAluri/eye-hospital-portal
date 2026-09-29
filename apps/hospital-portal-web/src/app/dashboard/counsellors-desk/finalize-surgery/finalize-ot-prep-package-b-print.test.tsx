import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRINT_HELPER = join(
  process.cwd(),
  'src/lib/counsellors-desk/ot-preparation-prepared-list-print.ts',
);
const FINALIZE_PAGE = join(
  process.cwd(),
  'src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx',
);

describe('Package B — OT Preparation print page contracts', () => {
  const helper = readFileSync(PRINT_HELPER, 'utf8');
  const page = readFileSync(FINALIZE_PAGE, 'utf8');

  it('print helper uses existing getOtList and dedicated HTML (no new API)', () => {
    expect(helper).toContain('counsellorsDeskApi.getOtList');
    expect(helper).toContain('buildOtPreparationPreparedListPrintHtml');
    expect(helper).toContain('openOtPreparationPreparedListPrint');
    expect(helper).toContain('OT Preparation — Prepared List');
    expect(helper).toContain('No prepared OT surgeries for this surgery date.');
    expect(helper).not.toMatch(/ot-list-print|prepare-print-v2|newOtPrint/);
  });

  it('print HTML excludes SPA chrome and RESP2 screen controls', () => {
    expect(helper).not.toMatch(/Prepare OT/);
    expect(helper).not.toMatch(/Select all visible/);
    expect(helper).not.toMatch(/sidebar/i);
    expect(helper).not.toMatch(/pagination/i);
    expect(helper).not.toMatch(/checkbox/i);
  });

  it('row Print OT Slip is absent; bulk OT slips and Package B print remain', () => {
    expect(page).not.toContain('const printOtSlip');
    expect(page).not.toContain('aria-label="Print OT Slip"');
    expect(page).not.toContain('onPrint=');
    expect(page).not.toContain('<ChevronRight');
    expect(page).toContain('openOtSlipsPrint');
    expect(page).toContain('Print OT Slips');
    expect(page).toContain('finalize-ot-prep-print-prepared');
    expect(page).toContain('openOtPreparationPreparedListPrint');
  });

  it('OT Prep Print does not restore prepared grid or Package A date-dashboard', () => {
    expect(page).not.toContain('finalize-ot-prepared-grid');
    expect(page).not.toContain('finalize-ot-surgery-date-catalog');
    expect(page).toContain('filterFinalisedForOtPrepWorklist');
  });
});
