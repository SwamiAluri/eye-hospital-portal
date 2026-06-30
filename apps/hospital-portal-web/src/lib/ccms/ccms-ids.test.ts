import { describe, expect, it } from 'vitest';
import { isCcmsUuid, resolveCcmsProviderUuid } from '@/lib/ccms/ccms-ids';
import type { AlignedCcmsPayer } from '@/lib/ccms/resolve-ccms-payers';

const aligned: AlignedCcmsPayer[] = [
  {
    providerCode: 'HDFC_ERGO',
    name: 'HDFC Ergo',
    ccmsId: 'a1111111-1111-1111-1111-111111111111',
    ccmsPayer: null,
    selectable: true,
  },
];

describe('ccms-ids', () => {
  it('detects UUID vs master provider code', () => {
    expect(isCcmsUuid('HDFC_ERGO')).toBe(false);
    expect(isCcmsUuid('a1111111-1111-1111-1111-111111111111')).toBe(true);
  });

  it('resolves master code to CCMS UUID', () => {
    expect(resolveCcmsProviderUuid('HDFC_ERGO', aligned)).toBe(
      'a1111111-1111-1111-1111-111111111111',
    );
    expect(resolveCcmsProviderUuid('a1111111-1111-1111-1111-111111111111', aligned)).toBe(
      'a1111111-1111-1111-1111-111111111111',
    );
  });
});
