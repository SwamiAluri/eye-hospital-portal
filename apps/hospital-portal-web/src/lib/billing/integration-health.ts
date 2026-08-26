export type OutboxSource = 'IP' | 'Billing';

export interface OutboxTypeStats {
  eventType: string;
  pending: number;
  retrying: number;
  dead: number;
}

export interface OutboxStats {
  pending: number;
  failed: number;
  dead: number;
  processed: number;
  processing: number;
  published24h: number;
  oldestPendingAt?: string | null;
  byType: OutboxTypeStats[];
}

export interface OutboxDeadLetter {
  id: string;
  source: OutboxSource;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  correlationId?: string | null;
  idempotencyKey: string;
  occurredAt: string;
  lastAttemptAt?: string | null;
  retryCount: number;
  error?: string | null;
  status: string;
  subject: string;
  mappingRequired: boolean;
  isFinancial: boolean;
}

export interface OutboxEventDetail extends OutboxDeadLetter {
  processedAt?: string | null;
  maskedPayloadJson: string;
  abandonReason?: string | null;
  compensatingAction?: string | null;
}

export function canViewIntegrationHealth(permissions: string[] | null | undefined): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes('integration.admin');
}

export function isMappingDefect(row: Pick<OutboxDeadLetter, 'mappingRequired' | 'error' | 'eventType'>): boolean {
  if (row.mappingRequired) return true;
  const err = row.error ?? '';
  return /billable variant|unmapped|no mapped/i.test(err);
}

export function groupDeadByError(rows: OutboxDeadLetter[]): { error: string; count: number; ids: string[] }[] {
  const map = new Map<string, { error: string; ids: string[] }>();
  for (const row of rows) {
    const key = (row.error ?? 'Unknown error').trim() || 'Unknown error';
    const cur = map.get(key) ?? { error: key, ids: [] };
    cur.ids.push(row.id);
    map.set(key, cur);
  }
  return [...map.values()]
    .map((g) => ({ error: g.error, count: g.ids.length, ids: g.ids }))
    .sort((a, b) => b.count - a.count);
}

export function formatOldestPending(iso?: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  return `${hr}h`;
}

export function retryingCount(stats: OutboxStats | null | undefined): number {
  if (!stats) return 0;
  return (stats.failed ?? 0) + (stats.processing ?? 0);
}
