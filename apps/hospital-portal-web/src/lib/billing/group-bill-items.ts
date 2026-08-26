export type BillChargeSourceType =
  | 'Package'
  | 'PackageDiscount'
  | 'Implant'
  | 'Consumable'
  | 'Room'
  | 'Procedure'
  | 'Manual';

export interface ChargeLineItem {
  id: string;
  serviceName: string;
  serviceCode?: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  sourceType?: string | null;
  notes?: string | null;
  status?: string | null;
  sourceRefId?: string | null;
  performedAt?: string | null;
}

export const GROUP_ORDER = [
  'Package',
  'Implant',
  'Consumable',
  'Procedure',
  'Room',
  'Manual',
] as const;

export const GROUP_LABELS: Record<string, string> = {
  Package: 'Package',
  Implant: 'Implants',
  Consumable: 'Consumables',
  Procedure: 'Procedure',
  Room: 'Room',
  Manual: 'Manual',
};

const KNOWN_SOURCES: BillChargeSourceType[] = [
  'Package',
  'PackageDiscount',
  'Implant',
  'Consumable',
  'Room',
  'Procedure',
  'Manual',
];

export function normalizeSourceType(value?: string | null): BillChargeSourceType {
  if (!value) return 'Manual';
  const match = KNOWN_SOURCES.find((k) => k.toLowerCase() === value.toLowerCase());
  return match ?? 'Manual';
}

/** PackageDiscount prints inside the Package section (S-12). */
export function displayGroup(sourceType?: string | null): string {
  const n = normalizeSourceType(sourceType);
  return n === 'PackageDiscount' ? 'Package' : n;
}

export interface BillItemGroup {
  sourceType: string;
  label: string;
  items: ChargeLineItem[];
  subtotal: number;
}

export function groupBillItems(items: ChargeLineItem[]): BillItemGroup[] {
  const buckets = new Map<string, ChargeLineItem[]>();
  for (const item of items) {
    const key = displayGroup(item.sourceType);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }

  const known = GROUP_ORDER as readonly string[];
  const extra = [...buckets.keys()].filter((k) => !known.includes(k)).sort();
  return [...known, ...extra]
    .filter((k) => buckets.has(k))
    .map((k) => {
      const grouped = buckets.get(k)!;
      return {
        sourceType: k,
        label: GROUP_LABELS[k] ?? k,
        items: grouped,
        subtotal: grouped.reduce((sum, line) => sum + line.totalAmount, 0),
      };
    });
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
