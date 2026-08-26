import { describe, expect, it } from 'vitest';
import { parseIpCensusSearchParams, serializeIpCensusSearchParams } from './ip-census-url';

describe('parseIpCensusSearchParams', () => {
  it('defaults tab, fin and session to All and patient to null', () => {
    expect(parseIpCensusSearchParams(new URLSearchParams())).toEqual({
      tab: 'All',
      patient: null,
      fin: 'All',
      session: 'All',
    });
  });

  it('reads tab, patient, fin and session', () => {
    const params = new URLSearchParams('tab=InHouse&patient=abc-1&fin=HasBalance&session=Morning');
    expect(parseIpCensusSearchParams(params)).toEqual({
      tab: 'InHouse',
      patient: 'abc-1',
      fin: 'HasBalance',
      session: 'Morning',
    });
  });

  it('ignores unknown tab and fin values', () => {
    const params = new URLSearchParams('tab=PartiallyPaid&fin=Nope&patient=%20&session=AM');
    expect(parseIpCensusSearchParams(params)).toEqual({
      tab: 'All',
      patient: null,
      fin: 'All',
      session: 'All',
    });
  });
});

describe('serializeIpCensusSearchParams', () => {
  it('omits default All values and writes patient when selected', () => {
    expect(serializeIpCensusSearchParams({ tab: 'All', patient: 'j1', fin: 'All', session: 'All' }))
      .toBe('patient=j1');
    expect(serializeIpCensusSearchParams({ tab: 'InOt', patient: null, fin: 'Cleared', session: 'Afternoon' }))
      .toBe('tab=InOt&fin=Cleared&session=Afternoon');
  });

  it('clears patient when selection is dismissed', () => {
    const current = new URLSearchParams('tab=PostOp&patient=old&fin=HasBalance');
    const next = serializeIpCensusSearchParams(
      { tab: 'PostOp', patient: null, fin: 'HasBalance', session: 'All' },
      current,
    );
    expect(next).toBe('tab=PostOp&fin=HasBalance');
  });
});
