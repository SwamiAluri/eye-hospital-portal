import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from './page';

const detailSpy = vi.hoisted(() => ({ itemId: '' as string }));

vi.mock('@/components/lms/catalogue/CatalogueDetailView', () => ({
  CatalogueDetailView: ({ itemId }: { itemId: string }) => {
    detailSpy.itemId = itemId;
    return <div data-testid="catalogue-detail-stub">detail:{itemId}</div>;
  },
}));

describe('L-CAT-01B catalogue detail route page', () => {
  it('accepts plain { params: { id } } and passes string itemId without throwing', () => {
    const id = 'f7dd25b6-7aba-4da8-a5b4-1ef09d6bac08';
    detailSpy.itemId = '';

    const html = renderToStaticMarkup(<Page params={{ id }} />);

    expect(html).toContain(`detail:${id}`);
    expect(detailSpy.itemId).toBe(id);
  });
});
