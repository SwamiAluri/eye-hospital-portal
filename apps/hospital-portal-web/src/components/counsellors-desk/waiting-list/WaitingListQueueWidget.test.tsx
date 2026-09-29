import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { WAITING_LIST_WORK_GRID } from '@/lib/counsellors-desk/waiting-list-layout';
import { resolveWaitingListQueueTitle } from '@/lib/counsellors-desk/waiting-list-empty-copy';

import { WaitingListQueueWidget } from './WaitingListQueueWidget';

const TAB_TITLES = [
  'All',
  'Pending',
  'Processing',
  'Done',
  'Add-on Surgery',
  'Repeat Counselling',
  'Surgery Done',
  'OT Returned',
  'Pre-Auth Queue',
] as const;

describe('WaitingListQueueWidget — no duplicate section title', () => {
  it('renders column cues directly after toolbar with no section heading', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget
        count={3}
        title="Processing"
        toolbar={<div data-testid="embedded-toolbar">Search</div>}
      >
        <div>row</div>
      </WaitingListQueueWidget>,
    );

    expect(html).toContain(WAITING_LIST_WORK_GRID);
    expect(html).toContain('data-testid="waiting-list-queue-toolbar"');
    expect(html).toContain('Patient');
    expect(html).toContain('Visit');
    expect(html).toContain('Procedure / Eye');
    expect(html).toContain('Owner');
    expect(html).toContain('Payment / Coverage');
    expect(html).toContain('Status');
    expect(html).toContain('Action');
    expect(html).toContain('role="columnheader"');
    expect(html).toContain('overflow-y-auto');
    // Accessible name only — not a visible h2 section title.
    expect(html).toContain('aria-label="Processing patient queue"');
    expect(html).not.toContain('sessionWidgetTitle');
    expect(html).not.toContain('>Processing</h2>');
    expect(html).not.toContain('>3<');
    expect(html).not.toContain(' patients</');
    expect(html).not.toContain('Patient Queue');
    expect(html).not.toContain('Unresolved OT-returned counselling attention');
  });

  it.each(TAB_TITLES)(
    'does not render a visible duplicate "%s" section title above the grid',
    (title) => {
      const html = renderToStaticMarkup(
        <WaitingListQueueWidget count={8} title={title}>
          <div data-testid="row">row</div>
        </WaitingListQueueWidget>,
      );

      expect(html).not.toMatch(new RegExp(`<h[12][^>]*>\\s*${title}\\s*</h[12]>`));
      expect(html).not.toContain(`${title}</h2>`);
      expect(html).not.toContain('8 patients');
      expect(html).toContain('Patient');
      expect(html).toContain('Action');
      expect(html).toContain(`aria-label="${title} patient queue"`);
    },
  );

  it('maps active tabs to aria titles without Patient Queue', () => {
    expect(resolveWaitingListQueueTitle('Processed')).toBe('Processing');
    expect(resolveWaitingListQueueTitle('OtReturned')).toBe('OT Returned');
    expect(resolveWaitingListQueueTitle('All')).toBe('All');
  });

  it('keeps footer / pagination outside the scroll region', () => {
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

  it('renders empty state without column cues or tab section title', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget
        count={0}
        title="Processing"
        isEmpty
        emptyContent={
          <p role="status" className="text-sm font-medium">
            No patients in progress
          </p>
        }
      />,
    );

    expect(html).toContain('No patients in progress');
    expect(html).not.toContain('Procedure / Eye');
    expect(html).not.toContain('>Processing</h2>');
    expect(html).not.toContain('Unresolved OT-returned counselling attention');
  });

  it('OT Returned empty state stays concise without section title', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget
        count={0}
        title="OT Returned"
        mode="ot-returned"
        isEmpty
        emptyContent={
          <p role="status" className="text-sm font-medium">
            No OT-returned patients
          </p>
        }
      />,
    );

    expect(html).toContain('No OT-returned patients');
    expect(html).not.toContain('>OT Returned</h2>');
    expect(html).not.toContain('Unresolved OT-returned counselling attention');
    expect(html).not.toContain('Patient Queue');
    expect(html).not.toContain('ReadyForSurgery');
  });

  it('renders loading skeleton without section title', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueueWidget count={0} title="Pending" isLoading />,
    );

    expect(html).toContain(WAITING_LIST_WORK_GRID);
    expect(html).toContain('staff-worklist-row');
    expect(html).toContain('animate-pulse');
    expect(html).toContain('role="status"');
    expect(html).toContain('>Loading<');
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).not.toContain('>Pending</h2>');
    expect(html).not.toContain('Procedure / Eye');
  });
});
