import type { UnmappedChargeItem } from '@/lib/api/charge-mapping.api';

export const CHARGE_MAPPING_TEST_IDS = {
  page: 'charge-mapping-page',
  noPermission: 'charge-mapping-no-permission',
  refresh: 'charge-mapping-refresh',
  replay: 'charge-mapping-replay',
  empty: 'charge-mapping-empty',
  map: 'charge-mapping-map',
  postedCallout: 'charge-mapping-posted',
  packageUnmapped: 'charge-mapping-package-unmapped',
  openPackage: 'charge-mapping-open-package',
} as const;

export function rankUnmappedItems(items: UnmappedChargeItem[]): UnmappedChargeItem[] {
  return [...items].sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return b.estimatedValue - a.estimatedValue;
  });
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

export function canManageChargeMapping(permissions: string[] | null | undefined): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes('bill.admin');
}

export function formatParkedItemSubtitle(item: UnmappedChargeItem): string {
  const bits: string[] = [];
  if (item.lastPatientName?.trim()) bits.push(item.lastPatientName.trim());
  if (item.lastUhid?.trim()) bits.push(item.lastUhid.trim());
  if (item.lastUsedAt) {
    bits.push(new Date(item.lastUsedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  }
  if (bits.length > 0) return bits.join(' · ');
  return item.itemCode || item.itemId || '';
}

export function unmappedPackageCallout(packageName?: string | null): string {
  const name = packageName?.trim() || 'A counselling package';
  return `${name} has an unmapped component. Explosion will park that line until you map it here. Clinical admit is not blocked.`;
}

export type ReplayToastTone = 'success' | 'warning';

export function formatReplayToast(result: {
  posted: number;
  needsAdjustment: number;
  stillUnmapped: number;
  markedNonChargeable?: number;
  blockedNoBill?: number;
}): { tone: ReplayToastTone; message: string; postedCallout: boolean } {
  const posted = Number(result.posted) || 0;
  const blocked = Number(result.blockedNoBill) || 0;
  const needsAdjustment = Number(result.needsAdjustment) || 0;
  const stillUnmapped = Number(result.stillUnmapped) || 0;
  if (posted > 0 && blocked === 0) {
    return {
      tone: 'success',
      message: `Charge posted. ${posted} parked line(s) are on OpdBill.`,
      postedCallout: true,
    };
  }
  if (blocked > 0) {
    const postedBit = posted > 0 ? `${posted} posted. ` : '';
    return {
      tone: 'warning',
      message: `${postedBit}${blocked} parked charge(s) have no OpdBill line and stay Open. Replay is not a financial post.`,
      postedCallout: posted > 0,
    };
  }
  return {
    tone: 'success',
    message: `Posted ${posted}. ${needsAdjustment} closed bills need a credit note. ${stillUnmapped} still unmapped.`,
    postedCallout: posted > 0,
  };
}
