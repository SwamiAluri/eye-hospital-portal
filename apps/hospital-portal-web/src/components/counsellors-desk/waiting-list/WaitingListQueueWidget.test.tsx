import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  WAITING_LIST_OT_GRID,
  WAITING_LIST_WORK_GRID,
} from '@/lib/counsellors-desk/waiting-list-layout';

import { WaitingListQueueWidget } from './WaitingListQueueWidget';

describe('WaitingListQueueWidget', () => {
  it('renders counselling column cues with WAITING_LIST_WORK_GRID', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget count={3} mode="counselling">
        <div>row</div>
      </WaitingListQueueWidget>,
    );

    expect(html).toContain(WAITING_LIST_WORK_GRID);
    expect(html).toContain('Patient');
    expect(html).toContain('Visit');
    expect(html).toContain('Procedure / Eye');
    expect(html).toContain('Owner');
    expect(html).toContain('Payment / Coverage');
    expect(html).toContain('Status');
    expect(html).not.toContain('Attention');
    expect(html).toContain('Action');
    expect(html).toContain('>3<');
    expect(html).toContain('Patient Queue');
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('aria-label="Queue workspace"');
    // Stronger column header hierarchy (table headers, not page titles)
    expect(html).toContain('text-sm font-semibold');
    expect(html).toContain('role="columnheader"');
    expect(html).not.toContain('text-[11px] font-medium');
  });

  it('renders flat toolbar inside the single workspace surface', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget
        count={3}
        toolbar={<div data-testid="embedded-toolbar">Search</div>}
      >
        <div>row</div>
      </WaitingListQueueWidget>,
    );

    expect(html).toContain('data-testid="waiting-list-queue-toolbar"');
    expect(html).toContain('data-testid="embedded-toolbar"');
    expect(html).toContain('Search');
  });

  it('keeps footer outside the scroll region when provided', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget
        count={18}
        footer={<div data-testid="custom-footer">Showing 1–10 of 18</div>}
      >
        <div>row</div>
      </WaitingListQueueWidget>,
    );

    expect(html).toContain('data-testid="custom-footer"');
    expect(html).toContain('Showing 1–10 of 18');
    expect(html).toContain('shrink-0 border-t');
  });

  it('renders empty state without column cues', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget count={0} isEmpty />,
    );

    expect(html).toContain('No patients in queue');
    expect(html).not.toContain('Procedure / Eye');
  });

  it('renders loading skeleton with work grid and staff-worklist-row rows', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget count={0} isLoading />,
    );

    expect(html).toContain(WAITING_LIST_WORK_GRID);
    expect(html).toContain('staff-worklist-row');
    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('Procedure / Eye');
  });

  it('uses WAITING_LIST_OT_GRID cues in ot-returned mode', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget count={2} mode="ot-returned">
        <div>ot-row</div>
      </WaitingListQueueWidget>,
    );

    expect(html).toContain(WAITING_LIST_OT_GRID);
    expect(html).toContain('UHID / Patient');
    expect(html).toContain('Return Reason');
    expect(html).toContain('Surgery Date');
    expect(html).not.toContain('Procedure / Eye');
    expect(html).not.toContain('Attention');
  });
});
