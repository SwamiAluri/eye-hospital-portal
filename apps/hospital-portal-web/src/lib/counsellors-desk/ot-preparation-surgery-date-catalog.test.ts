import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';
import {
  buildSurgeryDateCatalog,
  formatSurgeryDateRelativeLabel,
  OT_PREP_SURGERY_DATE_CATALOG_FILTERS,
  resolveOtPreparationDayPresentation,
  shouldClearPreparedOtListOnDateChange,
  summarizeOtPreparationMetrics,
} from './ot-preparation-surgery-date-catalog';
import { selectFinalisedForPrepareDate } from './prepare-ot-date-scope';

function rec(
  overrides: Partial<FinalizeSurgeryRecord> & Pick<FinalizeSurgeryRecord, 'id' | 'status'>,
): FinalizeSurgeryRecord {
  return {
    uhid: 'U1',
    patientName: 'P',
    surgeryName: 'Phaco',
    eyes: 'RE',
    patientType: 'Cash',
    paymentMode: 'Cash',
    surgeon: 'Dr',
    startTime: '09:00',
    theaterName: 'OT-1',
    version: 1,
    isLocked: false,
    scheduleDate: '2026-09-10',
    ...overrides,
  } as FinalizeSurgeryRecord;
}

describe('PD-OTPREP-UAT-01 / RESP-09 relative labels (actual ScheduleDate only)', () => {
  const today = new Date(2026, 8, 23); // local 23 Sep 2026

  it('labels Today with weekday+date for an actual ScheduleDate equal to today', () => {
    expect(formatSurgeryDateRelativeLabel('2026-09-23', today)).toBe('Today · Wed, 23 Sep');
  });

  it('labels Tomorrow with weekday+date for an actual ScheduleDate equal to tomorrow', () => {
    expect(formatSurgeryDateRelativeLabel('2026-09-24', today)).toBe('Tomorrow · Thu, 24 Sep');
  });

  it('labels other actual dates as weekday + day + month (no relative prefix)', () => {
    expect(formatSurgeryDateRelativeLabel('2026-09-26', today)).toBe('Sat, 26 Sep');
    expect(formatSurgeryDateRelativeLabel('2026-09-29', today)).toBe('Tue, 29 Sep');
    expect(formatSurgeryDateRelativeLabel('2026-10-02', today)).toBe('Fri, 02 Oct');
    expect(formatSurgeryDateRelativeLabel('2026-04-08', today)).toMatch(/^Wed,\s*08\s*Apr$/i);
  });

  it('does not invent dates — only formats provided ScheduleDate', () => {
    const catalog = buildSurgeryDateCatalog([
      rec({ id: 'a', status: 'Finalised', scheduleDate: '2026-09-24' }),
    ]);
    expect(catalog.map((e) => e.scheduleDate)).toEqual(['2026-09-24']);
    expect(catalog).toHaveLength(1);
  });

  it('orders catalog chronologically from actual ScheduleDate values only', () => {
    const catalog = buildSurgeryDateCatalog([
      rec({ id: 'c', status: 'Finalised', scheduleDate: '2026-09-30' }),
      rec({ id: 'a', status: 'OTPrepared', scheduleDate: '2026-09-24' }),
      rec({ id: 'b', status: 'Finalised', scheduleDate: '2026-09-25' }),
      rec({ id: 'd', status: 'Confirmed', scheduleDate: '2026-09-20' }),
    ]);
    expect(catalog.map((e) => e.scheduleDate)).toEqual([
      '2026-09-24',
      '2026-09-25',
      '2026-09-30',
    ]);
  });

  it('catalog presentation never emits generated horizon labels', () => {
    const workstation = new Date(2026, 8, 23);
    const catalog = buildSurgeryDateCatalog([
      rec({ id: 'a', status: 'Finalised', scheduleDate: '2026-09-23' }),
      rec({ id: 'b', status: 'Finalised', scheduleDate: '2026-09-24' }),
      rec({ id: 'c', status: 'OTPrepared', scheduleDate: '2026-09-26' }),
    ]);
    const labels = catalog.map((e) => formatSurgeryDateRelativeLabel(e.scheduleDate, workstation));
    expect(labels).toEqual([
      'Today · Wed, 23 Sep',
      'Tomorrow · Thu, 24 Sep',
      'Sat, 26 Sep',
    ]);
    const forbidden = [/Next 2 days/i, /This week/i, /Next week/i, /next_two_days/i];
    for (const label of labels) {
      for (const re of forbidden) {
        expect(label).not.toMatch(re);
      }
    }
  });
});

describe('RESP preparation queue grid layout contract', () => {
  it('keeps Patient/Procedure capped and compact columns; no Action column', async () => {
    const { OT_PREPARATION_READY_GRID_CLASS } = await import(
      './ot-preparation-surgery-date-catalog'
    );
    expect(OT_PREPARATION_READY_GRID_CLASS).toContain('w-max');
    expect(OT_PREPARATION_READY_GRID_CLASS).toContain('min-w-full');
    expect(OT_PREPARATION_READY_GRID_CLASS).toMatch(/14rem/);
    expect(OT_PREPARATION_READY_GRID_CLASS).toMatch(/12rem/);
    expect(OT_PREPARATION_READY_GRID_CLASS).toMatch(/2\.25rem/);
    expect(OT_PREPARATION_READY_GRID_CLASS).toMatch(/3\.75rem/);
    expect(OT_PREPARATION_READY_GRID_CLASS).toMatch(/4\.75rem_6\.25rem/);
    expect(OT_PREPARATION_READY_GRID_CLASS).not.toMatch(/1\.4fr|1\.1fr|0\.7fr/);
    expect(OT_PREPARATION_READY_GRID_CLASS).not.toMatch(/repeat\(9,\s*1fr\)/);
  });
});

describe('RESP-08 preparation metrics', () => {
  it('derives ready-for-selected-date and dates-requiring-preparation from catalog', () => {
    const records = [
      rec({ id: 'a', status: 'Finalised', scheduleDate: '2026-04-07' }),
      rec({ id: 'b', status: 'Finalised', scheduleDate: '2026-04-07' }),
      rec({ id: 'c', status: 'OTPrepared', scheduleDate: '2026-04-02' }),
      rec({ id: 'd', status: 'Finalised', scheduleDate: '2026-04-08' }),
    ];
    const catalog = buildSurgeryDateCatalog(records);
    const readySelected = selectFinalisedForPrepareDate(records, '2026-04-07').length;
    expect(summarizeOtPreparationMetrics(catalog, readySelected)).toEqual({
      readyForSelectedDate: 2,
      datesRequiringPreparation: 2,
    });
  });
});

describe('Package A final correction — no generated date horizons', () => {
  it('does not export quick-nav / horizon resolvers', async () => {
    const mod = await import('./ot-preparation-surgery-date-catalog');
    expect(mod).not.toHaveProperty('resolveOtPrepQuickNavDate');
    expect(mod).not.toHaveProperty('OtPrepQuickNavKind');
  });

  it('historical date selection load plan remains READ-only (Prepare not invoked)', async () => {
    const { createOtPrepDateLoadPlan } = await import('./ot-preparation-surgery-date-catalog');
    const plan = createOtPrepDateLoadPlan('2026-09-25');
    expect(plan).toEqual({
      date: '2026-09-25',
      readOnly: true,
      invokePrepare: false,
    });
  });
});

describe('PD-OTPREP-RESP day presentation (no prepared grid)', () => {
  const day = '2026-09-25';

  it('READY uses concise operational copy', () => {
    const presentation = resolveOtPreparationDayPresentation({
      selectedDate: day,
      readyCount: 3,
      preparedCountInRecords: 0,
    });
    expect(presentation.kind).toBe('ready');
    expect(presentation.primaryMessage).toBe('Ready for OT Preparation');
    expect(presentation.secondaryMessage ?? '').not.toMatch(/use |when ready|to view/i);
  });

  it('completion after Prepare uses OT list prepared copy', () => {
    const presentation = resolveOtPreparationDayPresentation({
      selectedDate: day,
      readyCount: 0,
      preparedCountInRecords: 3,
      completionForDate: day,
      completionCount: 3,
    });
    expect(presentation.kind).toBe('completion');
    expect(presentation.primaryMessage).toBe('OT list prepared');
    expect(presentation.secondaryMessage).toBe('3 surgeries prepared');
  });

  it('already-prepared with no remaining Finalised', () => {
    const presentation = resolveOtPreparationDayPresentation({
      selectedDate: day,
      readyCount: 0,
      preparedCountInRecords: 2,
    });
    expect(presentation.kind).toBe('already_prepared');
    expect(presentation.primaryMessage).toBe('OT list already prepared');
    expect(presentation.secondaryMessage).toBe('2 surgeries prepared');
  });

  it('NONE uses No eligible surgeries', () => {
    const presentation = resolveOtPreparationDayPresentation({
      selectedDate: day,
      readyCount: 0,
      preparedCountInRecords: 0,
    });
    expect(presentation.kind).toBe('none');
    expect(presentation.primaryMessage).toBe('No eligible surgeries');
  });

  it('stale clear still required on date change', () => {
    expect(shouldClearPreparedOtListOnDateChange('2026-09-24', '2026-09-25')).toBe(true);
  });

  it('completion for another date does not override ready on selected date', () => {
    const presentation = resolveOtPreparationDayPresentation({
      selectedDate: day,
      readyCount: 1,
      preparedCountInRecords: 0,
      completionForDate: '2026-09-24',
      completionCount: 2,
    });
    expect(presentation.kind).toBe('ready');
  });
});

describe('RESP-05 Prepare eligibility (all remaining Finalised)', () => {
  it('selectFinalisedForPrepareDate returns all Finalised for the selected day', () => {
    const records = [
      rec({ id: 'a', status: 'Finalised', scheduleDate: '2026-09-25' }),
      rec({ id: 'b', status: 'Finalised', scheduleDate: '2026-09-25' }),
      rec({ id: 'c', status: 'OTPrepared', scheduleDate: '2026-09-25' }),
      rec({ id: 'd', status: 'Finalised', scheduleDate: '2026-09-26' }),
    ];
    const eligible = selectFinalisedForPrepareDate(records, '2026-09-25');
    expect(eligible.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('RESP page contract — preparation workspace, no prepared grid / horizons', () => {
  it('finalize-surgery page has no generated horizon quick-nav and no OT Prep prepared grid', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const pagePath = path.join(
      process.cwd(),
      'src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx',
    );
    const src = await fs.readFile(pagePath, 'utf8');
    expect(src).not.toMatch(/Next 2 days/);
    expect(src).not.toMatch(/This week/);
    expect(src).not.toMatch(/Next week/);
    expect(src).not.toMatch(/next_two_days/);
    expect(src).not.toMatch(/this_week/);
    expect(src).not.toMatch(/next_week/);
    expect(src).not.toMatch(/resolveOtPrepQuickNavDate/);
    expect(src).not.toMatch(/finalize-ot-quick-nav/);
    expect(src).not.toMatch(/finalize-ot-prepared-grid/);
    expect(src).not.toMatch(/getOtList/);
    // RESP2: primary date-dashboard removed; Finalised worklist + selection
    expect(src).not.toMatch(/finalize-ot-surgery-date-catalog/);
    expect(src).not.toMatch(/buildSurgeryDateCatalog/);
    expect(src).not.toMatch(/summarizeOtPreparationMetrics/);
    expect(src).not.toMatch(/resolveOtPreparationDayPresentation/);
    expect(src).not.toMatch(/Prepare New List/);
    expect(src).toMatch(/ot-preparation-resp2/);
    expect(src).toMatch(/finalize-ot-prepare-selected/);
    expect(src).toMatch(/finalize-ot-prep-select-all-visible/);
    expect(src).toMatch(/buildContinuedPrepareItems/);
    expect(src).toMatch(/highestOtPreparedSequenceForDate/);
    expect(src).toMatch(/type="checkbox"/);
    expect(src).toMatch(/finalize-ot-view-prepared/);
    expect(src).toMatch(/submitPrepareOtList/);
    expect(src).not.toMatch(/Prepare Finalised surgeries for OT/);
    expect(src).toMatch(/FinalizeOtModal/);
  });
});

describe('PERF-03 Finalize OT catalog deferred load', () => {
  const pageSrc = readFileSync(
    resolve(__dirname, '../../app/dashboard/counsellors-desk/finalize-surgery/page.tsx'),
    'utf8',
  ).replace(/\r\n/g, '\n');
  const hookSrc = readFileSync(
    resolve(__dirname, '../../hooks/use-counsellors-desk-queries.ts'),
    'utf8',
  ).replace(/\r\n/g, '\n');

  it('enables the existing undated catalog query only for OT Preparation', () => {
    expect(hookSrc).toMatch(
      /export function useFinalizeListQuery\(filters: FinalizeListFilters, enabled = true\)/,
    );
    expect(pageSrc).toContain('useFinalizeListQuery(debouncedFilters)');
    expect(pageSrc).toContain(
      'useFinalizeListQuery(\n    { ...OT_PREP_SURGERY_DATE_CATALOG_FILTERS },\n    activeWorkspace === \'ot-preparation\',\n  )',
    );
    expect(pageSrc).toContain(
      "if (activeWorkspace === 'ot-preparation') {\n          void catalogQuery.refetch();",
    );
    expect(pageSrc).toMatch(/import \{ FinalizeOtModal \} from/);
    expect(pageSrc).not.toMatch(/dynamic\(\(\) => import\([^)]*FinalizeOtModal/);
  });

  it('keeps the undated catalog filters and certified OT preparation rules', () => {
    expect(OT_PREP_SURGERY_DATE_CATALOG_FILTERS).toEqual({
      date: '',
      uhid: '',
      name: '',
    });
    expect(pageSrc).toContain('highestOtPreparedSequenceForDate');
    expect(pageSrc).toContain('submitPrepareOtList');
    expect(pageSrc).toContain("action === 'reopen'");
    expect(pageSrc).toContain('counsellorsDeskApi.reopenOtCase');
    expect(pageSrc).toContain('Selected surgeries must have the same surgery date');
    expect(pageSrc).toContain("from '@/lib/counsellors-desk/ot-preparation-resp2'");
    expect(pageSrc).toContain('buildContinuedPrepareItems');
  });

  it('keeps pending Finalised, catalog error, and success empty distinct', () => {
    expect(pageSrc).toContain("finalisedSummaryPending ? '—' : otPrepFiltered.length");
    expect(pageSrc).toContain('{otPrepSelectedCount}');
    expect(pageSrc).toContain("isLoading ? '—' : statsBar.total");
    expect(pageSrc).toContain("isLoading ? '—' : statsBar.pendingActions");
    expect(pageSrc).toContain("isLoading ? '—' : statsBar.surgeryDone");
    expect(pageSrc).toContain('data-testid="finalize-ot-prep-catalog-error"');
    expect(pageSrc).toContain('role="alert"');
    expect(pageSrc).toContain('void catalogQuery.refetch()');
    expect(pageSrc).toContain('No Finalised surgeries');
    const errorStart = pageSrc.indexOf('data-testid="finalize-ot-prep-catalog-error"');
    const emptyStart = pageSrc.indexOf('No Finalised surgeries');
    expect(errorStart).toBeGreaterThan(-1);
    expect(emptyStart).toBeGreaterThan(errorStart);
    expect(pageSrc.slice(errorStart, emptyStart)).not.toContain('No Finalised surgeries');
    expect(pageSrc).toContain("activeWorkspace === 'ot-preparation'");
    expect(pageSrc).toContain('<div role="status">');
    expect(pageSrc).toContain('aria-hidden');
  });
});
