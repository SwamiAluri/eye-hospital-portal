import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { WaitingListFilters } from '@/types/counsellors-desk';

import {
  WAITING_LIST_STATUS_TABS,
  WAITING_LIST_TYPE_OPTIONS,
  WaitingListFilterToolbar,
  type WaitingListFilterToolbarProps,
} from './WaitingListFilterToolbar';

const EMPTY_FILTERS: WaitingListFilters = {
  fromDate: '',
  toDate: '',
  patientName: '',
  mrd: '',
  type: 'All',
  status: 'All',
};

function baseProps(
  overrides: Partial<WaitingListFilterToolbarProps> = {},
): WaitingListFilterToolbarProps {
  return {
    quickSearch: '',
    onQuickSearchChange: vi.fn(),
    filters: EMPTY_FILTERS,
    onFiltersChange: vi.fn(),
    onApply: vi.fn(),
    onReset: vi.fn(),
    hasActiveFilters: false,
    onAddPatient: vi.fn(),
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

function expandToolbar(props: WaitingListFilterToolbarProps): ReactElement {
  return WaitingListFilterToolbar(props) as ReactElement;
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

function findAllButtons(root: ReactNode): ReactElement[] {
  const buttons: ReactElement[] = [];
  walkElements(root, (el) => {
    if (el.type === 'button') buttons.push(el);
  });
  return buttons;
}

describe('WaitingListFilterToolbar', () => {
  it('exports Processed key with Processing display label for Queue summary reuse', () => {
    const processed = WAITING_LIST_STATUS_TABS.find((t) => t.key === 'Processed');
    expect(processed?.label).toBe('Processing');
    expect(WAITING_LIST_TYPE_OPTIONS).toEqual(['All', 'Procedure', 'Surgery']);
  });

  it('does not render status navigation (status lives in Queue summary)', () => {
    const html = renderToStaticMarkup(
      <WaitingListFilterToolbar {...baseProps()} />,
    );

    expect(html).not.toContain('waiting-list-status-tab-');
    expect(html).not.toContain('aria-label="Queue status"');
  });

  it('keeps type filter on pillTab tokens with All / Procedure / Surgery', () => {
    const html = renderToStaticMarkup(
      <WaitingListFilterToolbar {...baseProps()} />,
    );

    expect(html).toContain('aria-label="Filter by type"');
    expect(html).toContain('role="group"');
    expect(html).toMatch(
      /aria-label="Filter by type"[\s\S]*rounded-full[\s\S]*>All</,
    );
    expect(html).toContain(counsellingSessionTokens.pillTabCurrent);
    expect(html).toContain('>All<');
    expect(html).toContain('>Procedure<');
    expect(html).toContain('>Surgery<');
  });

  it('renders search, type, dates, Add Patient — no Filters toggle or duplicate name/MRD fields', () => {
    const html = renderToStaticMarkup(
      <WaitingListFilterToolbar {...baseProps()} />,
    );

    expect(html).toContain('data-testid="waiting-list-filter-toolbar"');
    expect(html).toContain('min-[1600px]:flex-nowrap');
    // Workstation search uses grid minmax(12rem,1fr); not a fixed max-[1599px] width cap.
    expect(html).toContain('grid-cols-[minmax(12rem,1fr)_auto_auto_auto]');
    expect(html).toContain('waiting-list-filter-toolbar__search');
    expect(html).not.toContain('max-[1599px]:max-w-[min(100%,20rem)]');
    expect(html).toContain('data-testid="waiting-list-quick-search"');
    expect(html).toContain('data-testid="waiting-list-add-patient"');
    expect(html).toContain('data-testid="waiting-list-date-filters"');
    expect(html).toContain('data-testid="waiting-list-from-date"');
    expect(html).toContain('data-testid="waiting-list-to-date"');
    expect(html).toContain('data-testid="waiting-list-filters-apply"');
    expect(html).not.toContain('waiting-list-filters-toggle');
    expect(html).not.toContain('>Filters<');
    expect(html).not.toContain('waiting-list-patient-name');
    expect(html).not.toContain('waiting-list-mrd');
    expect(html).not.toContain('Patient Name');
    expect(html).not.toContain('MRD / UHID');
    expect(html).not.toContain(counsellingSessionTokens.sessionWidget);
  });

  it('wires onAddPatient, onReset, onApply, and type filter change', () => {
    const onAddPatient = vi.fn();
    const onReset = vi.fn();
    const onApply = vi.fn();
    const onFiltersChange = vi.fn();

    const tree = expandToolbar(
      baseProps({
        onAddPatient,
        onReset,
        onApply,
        onFiltersChange,
        hasActiveFilters: true,
        quickSearch: 'abc',
      }),
    );

    const add = findByTestId(tree, 'waiting-list-add-patient');
    (add!.props as { onClick: () => void }).onClick();
    expect(onAddPatient).toHaveBeenCalledTimes(1);

    const reset = findByTestId(tree, 'waiting-list-filters-reset');
    (reset!.props as { onClick: () => void }).onClick();
    expect(onReset).toHaveBeenCalledTimes(1);

    const apply = findByTestId(tree, 'waiting-list-filters-apply');
    (apply!.props as { onClick: () => void }).onClick();
    expect(onApply).toHaveBeenCalledTimes(1);

    const typeButtons = findAllButtons(tree).filter((btn) => {
      const kids = (btn.props as { children?: ReactNode }).children;
      return kids === 'Procedure';
    });
    expect(typeButtons.length).toBe(1);
    (typeButtons[0].props as { onClick: () => void }).onClick();
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      type: 'Procedure',
    });
  });

  it('wires onQuickSearchChange on primary search', () => {
    const onQuickSearchChange = vi.fn();
    const tree = expandToolbar(baseProps({ onQuickSearchChange }));
    const search = findByTestId(tree, 'waiting-list-quick-search');
    expect(search).toBeTruthy();
    (search!.props as { onChange: (v: string) => void }).onChange('mrd-1');
    expect(onQuickSearchChange).toHaveBeenCalledWith('mrd-1');
  });

  it('uses expanded search placeholder covering counsellor', () => {
    const html = renderToStaticMarkup(
      <WaitingListFilterToolbar {...baseProps()} />,
    );

    expect(html).toContain(
      'Search patient, MRN, doctor, procedure, counsellor...',
    );
  });

  it('renders client-side Owner filter with visible Owner: label and wires change', () => {
    const onOwnerFilterChange = vi.fn();
    const html = renderToStaticMarkup(
      <WaitingListFilterToolbar
        {...baseProps({
          ownerFilter: 'All',
          onOwnerFilterChange,
        })}
      />,
    );

    expect(html).toContain('Owner:');
    expect(html).toContain('data-testid="waiting-list-owner-filter"');
    expect(html).toContain('>All<');
    expect(html).toContain('>My Sessions<');
    expect(html).toContain('>Unassigned<');
    expect(html).toContain('>Other Counsellors<');

    const tree = expandToolbar(
      baseProps({
        ownerFilter: 'All',
        onOwnerFilterChange,
      }),
    );

    const select = findByTestId(tree, 'waiting-list-owner-filter');
    expect(select).toBeTruthy();
    (select!.props as { onChange: (e: { target: { value: string } }) => void }).onChange({
      target: { value: 'Mine' },
    });
    expect(onOwnerFilterChange).toHaveBeenCalledWith('Mine');
  });

  it('shows active-filter chips when type/owner/search/dates applied', () => {
    const html = renderToStaticMarkup(
      <WaitingListFilterToolbar
        {...baseProps({
          filters: { ...EMPTY_FILTERS, type: 'Surgery' },
          ownerFilter: 'Mine',
          onOwnerFilterChange: vi.fn(),
          quickSearch: 'lens',
          appliedFromDate: '2026-09-01',
          appliedToDate: '2026-09-10',
        })}
      />,
    );

    expect(html).toContain('data-testid="waiting-list-active-filters"');
    expect(html).toContain('Type: Surgery');
    expect(html).toContain('Owner: My Sessions');
    expect(html).toContain('Search active');
    expect(html).toContain('Apply dates');
  });
});
