import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

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
    onReset: vi.fn(),
    onNewPatient: vi.fn(),
    onScheduleCounselling: vi.fn(),
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

  it('puts Procedure and Surgery in a type dropdown, not pills', () => {
    const html = renderToStaticMarkup(
      <WaitingListFilterToolbar {...baseProps()} />,
    );

    expect(html).toContain('data-testid="waiting-list-type-filter"');
    expect(html).toContain('aria-label="Filter by type"');
    expect(html).toContain('>All<');
    expect(html).toContain('>Procedure<');
    expect(html).toContain('>Surgery<');
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain('rounded-full');
  });

  it('renders one row: search, dates, clear, new patient, and schedule counselling', () => {
    const html = renderToStaticMarkup(
      <WaitingListFilterToolbar {...baseProps()} />,
    );

    expect(html).toContain('data-testid="waiting-list-filter-toolbar"');
    expect(html).toContain('waiting-list-filter-toolbar__primary');
    expect(html).toContain('w-full');
    expect(html).toContain('grid-cols-[minmax(16rem,1fr)_auto_auto_auto_auto]');
    expect(html).toContain('waiting-list-filter-toolbar__search');
    expect(html).toContain('data-testid="waiting-list-quick-search"');
    expect(html).toContain('data-testid="waiting-list-date-filters"');
    expect(html).toContain('data-testid="waiting-list-from-date"');
    expect(html).toContain('>From<');
    expect(html).toContain('data-testid="waiting-list-to-date"');
    expect(html).toContain('>To<');
    expect(html).toContain('data-testid="waiting-list-filters-reset"');
    expect(html).toContain('data-testid="waiting-list-new-patient"');
    expect(html).toContain('New patient');
    expect(html).toContain('data-testid="waiting-list-add-patient"');
    expect(html).toContain('Schedule counselling');
    expect(html).not.toContain('data-testid="waiting-list-filters-apply"');
    expect(html).not.toContain('Apply dates');
    expect(html).not.toContain('data-testid="waiting-list-active-filters"');
    expect(html).not.toContain('waiting-list-filters-toggle');
    expect(html).not.toContain('>Filters<');
    expect(html).not.toContain('waiting-list-patient-name');
    expect(html).not.toContain('waiting-list-mrd');
    expect(html).not.toContain('>Add Patient<');
  });

  it('wires schedule, new patient, clear, and type dropdown', () => {
    const onScheduleCounselling = vi.fn();
    const onNewPatient = vi.fn();
    const onReset = vi.fn();
    const onFiltersChange = vi.fn();

    const tree = expandToolbar(
      baseProps({
        onScheduleCounselling,
        onNewPatient,
        onReset,
        onFiltersChange,
        quickSearch: 'abc',
      }),
    );

    const schedule = findByTestId(tree, 'waiting-list-add-patient');
    (schedule!.props as { onClick: () => void }).onClick();
    expect(onScheduleCounselling).toHaveBeenCalledTimes(1);

    const register = findByTestId(tree, 'waiting-list-new-patient');
    (register!.props as { onClick: () => void }).onClick();
    expect(onNewPatient).toHaveBeenCalledTimes(1);

    const reset = findByTestId(tree, 'waiting-list-filters-reset');
    expect((reset!.props as { disabled?: boolean }).disabled).toBe(false);
    (reset!.props as { onClick: () => void }).onClick();
    expect(onReset).toHaveBeenCalledTimes(1);

    const type = findByTestId(tree, 'waiting-list-type-filter');
    (type!.props as { onChange: (e: { target: { value: string } }) => void }).onChange({
      target: { value: 'Procedure' },
    });
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      type: 'Procedure',
    });
  });

  it('disables Clear when search, dates, type, and owner are empty', () => {
    const tree = expandToolbar(baseProps());
    const reset = findByTestId(tree, 'waiting-list-filters-reset');
    expect((reset!.props as { disabled?: boolean }).disabled).toBe(true);
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

  it('does not repeat active filters as chips under the row', () => {
    const html = renderToStaticMarkup(
      <WaitingListFilterToolbar
        {...baseProps({
          filters: { ...EMPTY_FILTERS, type: 'Surgery', fromDate: '2026-09-01', toDate: '2026-09-10' },
          ownerFilter: 'Mine',
          onOwnerFilterChange: vi.fn(),
          quickSearch: 'lens',
        })}
      />,
    );

    expect(html).not.toContain('data-testid="waiting-list-active-filters"');
    expect(html).not.toContain('Type: Surgery');
    expect(html).not.toContain('Search active');
    expect(html).not.toContain('Apply dates');
  });
});
