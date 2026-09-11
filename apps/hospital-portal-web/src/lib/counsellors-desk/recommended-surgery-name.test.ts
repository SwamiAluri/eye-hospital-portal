import { describe, expect, it } from 'vitest';
import { recommendedSurgeryName } from './recommended-surgery-name';
import type { SurgeryOption } from '@/types/counsellors-desk';

describe('CS-04 recommendedSurgeryName', () => {
  it('uses surgeryName (not missing .name) for recommended procedure', () => {
    const surgeries = [
      {
        id: '1',
        surgeryName: 'Phaco',
        eye: 'RE',
        cost: 1000,
        isRecommended: true,
      },
    ] as SurgeryOption[];
    expect(recommendedSurgeryName(surgeries)).toBe('Phaco');
  });

  it('returns null when no recommendation', () => {
    expect(
      recommendedSurgeryName([
        { id: '1', surgeryName: 'Phaco', eye: 'RE', cost: 1, isRecommended: false },
      ] as SurgeryOption[]),
    ).toBeNull();
  });
});
