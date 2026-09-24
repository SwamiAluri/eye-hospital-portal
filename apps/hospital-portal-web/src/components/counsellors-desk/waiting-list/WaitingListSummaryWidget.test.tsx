import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { WAITING_LIST_STATUS_TABS } from './WaitingListFilterToolbar';
import {
  WaitingListSummaryWidget,
  type WaitingListSummaryWidgetProps,
} from './WaitingListSummaryWidget';

const TAB_COUNTS: Record<string, number> = {
  All: 18,
  Pending: 0,
  Processed: 3,
  Done: 9,
  AddOnSurgery: 0,
  RepeatCounselling: 5,
  SurgeryDone: 1,
  OtReturned: 2,
  PreAuthQueue: 2,
};

function baseProps(
  overrides: Partial<WaitingListSummaryWidgetProps> = {},
): WaitingListSummaryWidgetProps {
  return {
    activeTab: 'All',
    onTabChange: vi.fn(),
    tabCounts: TAB_COUNTS,
    ...overrides,
  };
}

function walkElements(
  node: ReactNode,
  visit: (el: ReactElement) => void,
): void {
  if (node == null || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node) walkElements(child, visit);
    return;
  }
  if (!isValidElement(node)) return;
  visit(node);
  const { children } = node.props as { children?: ReactNode };
  walkElements(children, visit);
}

function expandSummary(props: WaitingListSummaryWidgetProps): ReactElement {
  return WaitingListSummaryWidget(props) as ReactElement;
}

function findByTestId(
  root: ReactNode,
  testId: string,
): ReactElement | undefined {
  let found: ReactElement | undefined;
  walkElements(root, (el) => {
    const id = (el.props as { 'data-testid'?: string })['data-testid'];
    if (id === testId) found = el;
  });
  return found;
}

describe('WaitingListSummaryWidget', () => {
  it('renders stats + Surgery Finalization pill-tab status nav', () => {
    const html = renderToStaticMarkup(
      <WaitingListSummaryWidget {...baseProps()} />,
    );

    expect(html).toContain('data-testid="waiting-list-summary"');
    expect(html).toContain('data-testid="waiting-list-stats"');
    expect(html).toContain('aria-label="Queue statistics"');

    expect(html).toContain('data-testid="waiting-list-summary-strip"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Queue status"');
    expect(html).toContain('data-status-style="pill-tab"');
    expect(html).toContain('rounded-full');
    expect(html).toContain('bg-counselling-primary');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain(counsellingSessionTokens.pillTabCurrent);

    // Must not use workspace-step underline for status
    expect(html).not.toContain('data-status-style="workspace-step"');
    expect(html).not.toContain(counsellingSessionTokens.workspaceStepItemActive);

    expect(html).toContain('All');
    expect(html).toContain('Pending');
    expect(html).toContain('Processing');
    expect(html).toContain('Done');
    expect(html).toContain('Add-on Surgery');
    expect(html).toContain('Repeat Counselling');
    expect(html).toContain('Surgery Done');
    expect(html).toContain('OT Returned');
    expect(html).toContain('Pre-Auth Queue');
    expect(html).toContain('>18<');

    expect(html).not.toContain('Queue overview');
    expect(html).not.toContain('waiting-list-summary-minibar');
  });

  it('exports Processed key as Processing via status tabs', () => {
    const processed = WAITING_LIST_STATUS_TABS.find((t) => t.key === 'Processed');
    expect(processed?.label).toBe('Processing');
  });

  it('wires onTabChange for status tabs', () => {
    const onTabChange = vi.fn();
    const tree = expandSummary(baseProps({ onTabChange }));
    const tab = findByTestId(tree, 'waiting-list-status-tab-Pending');
    expect(tab).toBeTruthy();
    (tab!.props as { onClick: () => void }).onClick();
    expect(onTabChange).toHaveBeenCalledWith('Pending');
  });

  it('marks active tab with pillTabCurrent', () => {
    const html = renderToStaticMarkup(
      <WaitingListSummaryWidget {...baseProps({ activeTab: 'Processed' })} />,
    );

    expect(html).toContain('data-testid="waiting-list-status-tab-Processed"');
    expect(html).toContain(counsellingSessionTokens.pillTabCurrent);
    expect(html).toMatch(
      /data-testid="waiting-list-status-tab-Processed"[\s\S]*Processing/,
    );
  });

  it('stats are informational (not clickable filter buttons)', () => {
    const tree = expandSummary(baseProps());
    const stats = findByTestId(tree, 'waiting-list-stats');
    expect(stats).toBeTruthy();
    let hasButton = false;
    walkElements(stats, (el) => {
      if (el.type === 'button') hasButton = true;
    });
    expect(hasButton).toBe(false);
  });
});
