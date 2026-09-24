import { describe, expect, it } from 'vitest';
import {
  WAITING_LIST_URL_DEFAULTS,
  WAITING_LIST_URL_PARAMS,
  applyWaitingListUrlState,
  parseWaitingListUrlState,
  resetWaitingListUrlFilters,
} from './waiting-list-url-state';

describe('waiting-list-url-state', () => {
  it('parses defaults when params are empty', () => {
    expect(parseWaitingListUrlState(new URLSearchParams())).toEqual(
      WAITING_LIST_URL_DEFAULTS,
    );
  });

  it('parses valid tab/type/owner/q/page/pageSize', () => {
    const params = new URLSearchParams(
      'tab=Pending&type=Surgery&owner=Mine&q=cataract&page=3&pageSize=25',
    );
    expect(parseWaitingListUrlState(params)).toEqual({
      tab: 'Pending',
      type: 'Surgery',
      owner: 'Mine',
      search: 'cataract',
      page: 3,
      pageSize: 25,
    });
  });

  it('falls back on invalid values', () => {
    const params = new URLSearchParams(
      'tab=Nope&type=X&owner=Everyone&page=0&pageSize=99',
    );
    expect(parseWaitingListUrlState(params)).toEqual({
      tab: 'All',
      type: 'All',
      owner: 'All',
      search: '',
      page: 1,
      pageSize: 10,
    });
  });

  it('omits defaults when serializing', () => {
    const next = applyWaitingListUrlState(
      new URLSearchParams('unrelated=1'),
      WAITING_LIST_URL_DEFAULTS,
    );
    expect(next.get('unrelated')).toBe('1');
    expect(next.get(WAITING_LIST_URL_PARAMS.tab)).toBeNull();
    expect(next.get(WAITING_LIST_URL_PARAMS.type)).toBeNull();
    expect(next.get(WAITING_LIST_URL_PARAMS.owner)).toBeNull();
    expect(next.get(WAITING_LIST_URL_PARAMS.search)).toBeNull();
    expect(next.get(WAITING_LIST_URL_PARAMS.page)).toBeNull();
    expect(next.get(WAITING_LIST_URL_PARAMS.pageSize)).toBeNull();
  });

  it('serializes non-default view state', () => {
    const next = applyWaitingListUrlState(new URLSearchParams(), {
      tab: 'PreAuthQueue',
      type: 'Procedure',
      owner: 'Unassigned',
      search: 'lens',
      page: 2,
      pageSize: 50,
    });
    expect(next.get('tab')).toBe('PreAuthQueue');
    expect(next.get('type')).toBe('Procedure');
    expect(next.get('owner')).toBe('Unassigned');
    expect(next.get('q')).toBe('lens');
    expect(next.get('page')).toBe('2');
    expect(next.get('pageSize')).toBe('50');
  });

  it('does not invent ownership-mutation params', () => {
    const next = applyWaitingListUrlState(new URLSearchParams(), {
      ...WAITING_LIST_URL_DEFAULTS,
      tab: 'Pending',
    });
    expect(next.has('assign')).toBe(false);
    expect(next.has('claim')).toBe(false);
    expect(next.has('reassign')).toBe(false);
    expect(next.has('counselorId')).toBe(false);
    expect(next.has('patientName')).toBe(false);
    expect(next.has('mrd')).toBe(false);
  });

  it('reset clears filter/view keys and restores page 1', () => {
    const current = new URLSearchParams(
      'tab=Done&type=Surgery&owner=Other&q=x&page=4&pageSize=25&keep=1',
    );
    const next = resetWaitingListUrlFilters(current);
    expect(next.get('keep')).toBe('1');
    expect(next.get('tab')).toBeNull();
    expect(next.get('type')).toBeNull();
    expect(next.get('owner')).toBeNull();
    expect(next.get('q')).toBeNull();
    expect(next.get('page')).toBeNull();
    expect(next.get('pageSize')).toBe('25');
  });
});
