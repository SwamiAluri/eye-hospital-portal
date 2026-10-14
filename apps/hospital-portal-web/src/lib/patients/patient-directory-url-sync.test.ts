import { describe, expect, it, vi } from 'vitest';
import {
  replaceDirectoryUrlState,
  shouldHydrateSearchFromUrl,
} from './patient-directory-url-sync';

describe('patient-directory-url-sync', () => {
  it('does not hydrate search from URL while the input is focused', () => {
    expect(
      shouldHydrateSearchFromUrl({
        searchFocused: true,
        localSearch: 'Sa',
        urlQ: 'S',
      }),
    ).toBe(false);
  });

  it('hydrates search from URL when unfocused and values differ', () => {
    expect(
      shouldHydrateSearchFromUrl({
        searchFocused: false,
        localSearch: 'old',
        urlQ: 'Sam',
      }),
    ).toBe(true);
    expect(
      shouldHydrateSearchFromUrl({
        searchFocused: false,
        localSearch: 'Sam',
        urlQ: 'Sam',
      }),
    ).toBe(false);
  });

  it('updates the browser URL with history.replaceState instead of navigation', () => {
    const replaceState = vi.fn();
    const href = replaceDirectoryUrlState(
      { q: 'Sam', page: 1, tab: 'all' },
      {
        history: { replaceState, state: { keep: true } },
        location: { pathname: '/dashboard/patients', search: '' },
      },
    );
    expect(href).toContain('/dashboard/patients?');
    expect(href).toContain('q=Sam');
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState.mock.calls[0]?.[2]).toBe(href);
  });
});
