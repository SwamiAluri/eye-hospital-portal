import { describe, expect, it } from 'vitest';
import {
  matchRecommendedProcedureVariant,
  variantIdFromSurgeryOptionId,
} from '@/lib/counsellors-desk/lightweight-session-surgery';

describe('lightweight session surgery', () => {
  it('parses a catalog variant id from a recommended surgery option id', () => {
    expect(variantIdFromSurgeryOptionId('type-e1000001-0000-0000-0000-000000000001-RE')).toBe(
      'e1000001-0000-0000-0000-000000000001',
    );
  });

  it('does not treat a text-only recommendation id as a catalog variant', () => {
    expect(variantIdFromSurgeryOptionId('rec-RE')).toBeUndefined();
  });

  it('matches the stored recommended name against the procedure catalog', () => {
    expect(
      matchRecommendedProcedureVariant(
        [
          { id: 'lasik', name: 'LASIK', code: 'L' },
          { id: 'phaco', name: 'Phacoemulsification with IOL', code: 'PHACO' },
        ],
        'Phacoemulsification',
      ),
    ).toBe('phaco');
  });

  it('returns null when the catalog has no matching procedure', () => {
    expect(matchRecommendedProcedureVariant([{ id: 'a', name: 'LASIK', code: 'L' }], 'Phaco')).toBeNull();
  });
});
