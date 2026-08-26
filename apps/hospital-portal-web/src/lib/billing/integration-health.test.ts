import { describe, expect, it } from 'vitest';
import {
  canViewIntegrationHealth,
  formatOldestPending,
  groupDeadByError,
  isMappingDefect,
  retryingCount,
  type OutboxDeadLetter,
} from './integration-health';

function dead(partial: Partial<OutboxDeadLetter>): OutboxDeadLetter {
  return {
    id: '1',
    source: 'Billing',
    eventType: 'PaymentReceived',
    aggregateId: 'a',
    aggregateType: 'OpdBill',
    idempotencyKey: 'k',
    occurredAt: new Date().toISOString(),
    retryCount: 8,
    status: 'Dead',
    subject: 'RCP-1',
    mappingRequired: false,
    isFinancial: true,
    ...partial,
  };
}

describe('integration-health helpers', () => {
  it('gates the page on integration.admin', () => {
    expect(canViewIntegrationHealth(undefined)).toBe(false);
    expect(canViewIntegrationHealth([])).toBe(false);
    expect(canViewIntegrationHealth(['bill.admin'])).toBe(false);
    expect(canViewIntegrationHealth(['integration.admin'])).toBe(true);
    expect(canViewIntegrationHealth(['*'])).toBe(true);
  });

  it('treats implant mapping errors as defects that should not be bulk-requeued', () => {
    expect(isMappingDefect(dead({ mappingRequired: true, eventType: 'ImplantUsed', source: 'IP' }))).toBe(true);
    expect(
      isMappingDefect(
        dead({
          mappingRequired: false,
          source: 'IP',
          eventType: 'ImplantUsed',
          error: 'Billing 422 — no billable variant for INV-2044',
        }),
      ),
    ).toBe(true);
    expect(isMappingDefect(dead({ error: 'CCMS 503 — upstream unavailable' }))).toBe(false);
  });

  it('groups dead letters by last error so operators can requeue a shared root cause', () => {
    const groups = groupDeadByError([
      dead({ id: 'a', error: 'CCMS 503' }),
      dead({ id: 'b', error: 'CCMS 503' }),
      dead({ id: 'c', error: 'no billable variant' }),
    ]);
    expect(groups[0]).toMatchObject({ error: 'CCMS 503', count: 2, ids: ['a', 'b'] });
    expect(groups[1].count).toBe(1);
  });

  it('formats oldest pending age', () => {
    expect(formatOldestPending(undefined)).toBe('—');
    const fourMinAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    expect(formatOldestPending(fourMinAgo)).toBe('4m');
  });

  it('counts retrying as failed plus in-flight processing', () => {
    expect(
      retryingCount({
        pending: 1,
        failed: 2,
        dead: 0,
        processed: 0,
        processing: 3,
        published24h: 10,
        byType: [],
      }),
    ).toBe(5);
  });
});
