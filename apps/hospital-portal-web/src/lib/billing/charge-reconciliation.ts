export function canViewChargeReconciliation(permissions: string[] | null | undefined): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes('bill.view') || permissions.includes('bill.admin');
}

export function completenessWarning(recorded: number, missing: number): string | null {
  if (missing <= 0) return null;
  return `${recorded} implants recorded, ${missing} charge missing`;
}

export const BUCKET_COPY: Record<number, string> = {
  1: 'A device is in a patient and the bill does not show it. Direct revenue leakage.',
  2: 'A patient is billed for a device with no usage record. Over-billing and a refund risk.',
  3: 'Inventory left the store with no clinical record. Shrinkage or a missed scan.',
  4: 'An item charged individually that the package already covers. Double-charge.',
  5: 'Used, recorded, but no billable variant exists to price it.',
};

const CSV_BUCKETS: { title: string; key: 'implantedNotCharged' | 'chargedNotImplanted' | 'stockOutNoUsage' | 'packageConsumableOverlap' | 'unmappedItems' }[] = [
  { title: 'Implanted, not charged', key: 'implantedNotCharged' },
  { title: 'Charged, not implanted', key: 'chargedNotImplanted' },
  { title: 'Stock out, no usage recorded', key: 'stockOutNoUsage' },
  { title: 'Package / consumable overlap', key: 'packageConsumableOverlap' },
  { title: 'Unmapped items', key: 'unmappedItems' },
];

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function reconciliationCsv(report: {
  implantedNotCharged: { patientName?: string | null; billNumber?: string | null; itemName: string; serialNumber?: string | null; amount: number; reason: string; occurredAt: string }[];
  chargedNotImplanted: { patientName?: string | null; billNumber?: string | null; itemName: string; serialNumber?: string | null; amount: number; reason: string; occurredAt: string }[];
  stockOutNoUsage: { patientName?: string | null; billNumber?: string | null; itemName: string; serialNumber?: string | null; amount: number; reason: string; occurredAt: string }[];
  packageConsumableOverlap: { patientName?: string | null; billNumber?: string | null; itemName: string; serialNumber?: string | null; amount: number; reason: string; occurredAt: string }[];
  unmappedItems: { patientName?: string | null; billNumber?: string | null; itemName: string; serialNumber?: string | null; amount: number; reason: string; occurredAt: string }[];
}): string {
  const lines = ['Bucket,Patient,Bill,Item,Serial,Amount,Reason,OccurredAt'];
  for (const bucket of CSV_BUCKETS) {
    for (const row of report[bucket.key]) {
      lines.push([
        csvCell(bucket.title),
        csvCell(row.patientName),
        csvCell(row.billNumber),
        csvCell(row.itemName),
        csvCell(row.serialNumber),
        csvCell(row.amount),
        csvCell(row.reason),
        csvCell(row.occurredAt),
      ].join(','));
    }
  }
  return lines.join('\n');
}

export function localDateToUtcRange(fromDate: string, toDate: string): { fromUtc: string; toUtc: string } {
  const fromUtc = `${fromDate}T00:00:00.000Z`;
  const next = new Date(`${toDate}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { fromUtc, toUtc: next.toISOString() };
}

