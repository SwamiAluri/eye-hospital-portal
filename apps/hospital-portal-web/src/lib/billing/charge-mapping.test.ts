import { describe, expect, it } from 'vitest';
import {
  canManageChargeMapping,
  formatParkedItemSubtitle,
  formatReplayToast,
  rankUnmappedItems,
  unmappedPackageCallout,
} from './charge-mapping';

describe('charge-mapping helpers', () => {
  it('fails closed without bill.admin', () => {
    expect(canManageChargeMapping(undefined)).toBe(false);
    expect(canManageChargeMapping([])).toBe(false);
    expect(canManageChargeMapping(['bill.update'])).toBe(false);
    expect(canManageChargeMapping(['bill.admin'])).toBe(true);
    expect(canManageChargeMapping(['*'])).toBe(true);
  });

  it('ranks unmapped items by usage then value', () => {
    const ranked = rankUnmappedItems([
      { itemName: 'rare', itemCode: 'r', itemType: 'Consumable', useCount: 2, estimatedValue: 90000, openExceptionCount: 2 },
      { itemName: 'common', itemCode: 'c', itemType: 'Consumable', useCount: 140, estimatedValue: 1000, openExceptionCount: 140 },
      { itemName: 'mid', itemCode: 'm', itemType: 'IOL', useCount: 140, estimatedValue: 5000, openExceptionCount: 1 },
    ]);
    expect(ranked.map((i) => i.itemName)).toEqual(['mid', 'common', 'rare']);
  });

  it('shows last patient and UHID on parked rows', () => {
    expect(formatParkedItemSubtitle({
      itemName: 'Alcon SN60WF',
      itemCode: 'INV-1',
      itemType: 'IOL',
      useCount: 1,
      estimatedValue: 14000,
      openExceptionCount: 1,
      lastPatientName: 'Meena Iyer',
      lastUhid: 'UAT-002',
      lastUsedAt: '2026-08-25T10:00:00Z',
    })).toMatch(/Meena Iyer · UAT-002/);
  });

  it('package unmapped copy parks, does not block admit', () => {
    expect(unmappedPackageCallout('Phaco + IOL')).toContain('Phaco + IOL has an unmapped component');
    expect(unmappedPackageCallout('Phaco + IOL')).toContain('Clinical admit is not blocked');
  });

  it('replay toast does not treat a zero-post as financial success', () => {
    const blocked = formatReplayToast({
      posted: 0,
      needsAdjustment: 0,
      stillUnmapped: 0,
      blockedNoBill: 2,
    });
    expect(blocked.tone).toBe('warning');
    expect(blocked.postedCallout).toBe(false);
    expect(blocked.message).toMatch(/stay Open/);

    const posted = formatReplayToast({
      posted: 3,
      needsAdjustment: 0,
      stillUnmapped: 0,
      blockedNoBill: 0,
    });
    expect(posted.tone).toBe('success');
    expect(posted.postedCallout).toBe(true);
  });
});
