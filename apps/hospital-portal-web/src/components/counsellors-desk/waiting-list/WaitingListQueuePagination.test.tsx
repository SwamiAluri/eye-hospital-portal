import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  WaitingListQueuePagination,
  type WaitingListQueuePaginationProps,
} from './WaitingListQueuePagination';

function baseProps(
  overrides: Partial<WaitingListQueuePaginationProps> = {},
): WaitingListQueuePaginationProps {
  return {
    page: 1,
    pageSize: 10,
    totalCount: 18,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
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

function expand(props: WaitingListQueuePaginationProps): ReactElement {
  return WaitingListQueuePagination(props) as ReactElement;
}

function findByTestId(root: ReactNode, testId: string): ReactElement | undefined {
  let found: ReactElement | undefined;
  walkElements(root, (el) => {
    if ((el.props as { 'data-testid'?: string })['data-testid'] === testId) found = el;
  });
  return found;
}

describe('WaitingListQueuePagination', () => {
  it('renders Showing range and 10 / page option', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueuePagination {...baseProps()} />,
    );

    expect(html).toContain('data-testid="waiting-list-pagination"');
    expect(html).toContain('Showing');
    expect(html).toContain('>1<');
    expect(html).toContain('>10<');
    expect(html).toContain('>18<');
    expect(html).toContain('patients');
    expect(html).toContain('10 / page');
    expect(html).toContain('data-testid="waiting-list-pagination-page-size"');
  });

  it('returns null when totalCount is 0', () => {
    const html = renderToStaticMarkup(
      <WaitingListQueuePagination {...baseProps({ totalCount: 0 })} />,
    );
    expect(html).toBe('');
  });

  it('wires onPageChange for next and page buttons', () => {
    const onPageChange = vi.fn();
    const tree = expand(baseProps({ page: 1, onPageChange }));

    const next = findByTestId(tree, 'waiting-list-pagination-next');
    (next!.props as { onClick: () => void }).onClick();
    expect(onPageChange).toHaveBeenCalledWith(2);

    const page2 = findByTestId(tree, 'waiting-list-pagination-page-2');
    (page2!.props as { onClick: () => void }).onClick();
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('wires onPageSizeChange', () => {
    const onPageSizeChange = vi.fn();
    const tree = expand(baseProps({ onPageSizeChange }));
    const select = findByTestId(tree, 'waiting-list-pagination-page-size');
    (select!.props as { onChange: (e: { target: { value: string } }) => void }).onChange({
      target: { value: '25' },
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
});
