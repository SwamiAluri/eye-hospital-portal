import { describe, expect, it } from 'vitest';
import { clinicalBadgeLabel, clinicalBadgeTone, coverageToneToBadge } from './ip-target-badges';

describe('ip-target badges', () => {
  it('maps clinical states to mockup tones', () => {
    expect(clinicalBadgeTone('Admitted')).toBe('inhouse');
    expect(clinicalBadgeTone('InOT')).toBe('ot');
    expect(clinicalBadgeTone('ReadyForSurgery')).toBe('ok');
    expect(clinicalBadgeTone('CancelledSurgery')).toBe('cancel');
    expect(clinicalBadgeLabel('ReadyForSurgery')).toBe('Ready for OT');
  });

  it('maps coverage chip tones to badge classes', () => {
    expect(coverageToneToBadge('ok')).toBe('ok');
    expect(coverageToneToBadge('warn')).toBe('ot');
    expect(coverageToneToBadge('danger')).toBe('danger');
  });
});
