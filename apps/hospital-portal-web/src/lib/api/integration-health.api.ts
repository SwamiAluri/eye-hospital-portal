import { getApi } from '../api';
import { ipManagementApi } from './ip-management.api';
import type { OutboxDeadLetter, OutboxEventDetail, OutboxStats } from '../billing/integration-health';

function asStats(raw: Record<string, unknown> | OutboxStats): OutboxStats {
  const r = raw as Record<string, unknown>;
  const byTypeRaw = (r.byType ?? r.ByType ?? []) as Record<string, unknown>[];
  return {
    pending: Number(r.pending ?? r.Pending ?? 0),
    failed: Number(r.failed ?? r.Failed ?? 0),
    dead: Number(r.dead ?? r.Dead ?? 0),
    processed: Number(r.processed ?? r.Processed ?? 0),
    processing: Number(r.processing ?? r.Processing ?? 0),
    published24h: Number(r.published24h ?? r.Published24h ?? 0),
    oldestPendingAt: (r.oldestPendingAt ?? r.OldestPendingAt ?? null) as string | null,
    byType: byTypeRaw.map((t) => ({
      eventType: String(t.eventType ?? t.EventType ?? ''),
      pending: Number(t.pending ?? t.Pending ?? 0),
      retrying: Number(t.retrying ?? t.Retrying ?? 0),
      dead: Number(t.dead ?? t.Dead ?? 0),
    })),
  };
}

export const integrationHealthApi = {
  getIpStats: async (): Promise<OutboxStats> => {
    const data = await ipManagementApi.getOutboxHealth();
    return asStats(data as OutboxStats);
  },
  getBillingStats: async (): Promise<OutboxStats> => {
    const response = await getApi().get('/billingoutbox/stats');
    return asStats(response.data);
  },
  getIpDead: async (): Promise<OutboxDeadLetter[]> => ipManagementApi.listOutboxDead(),
  getBillingDead: async (): Promise<OutboxDeadLetter[]> => {
    const response = await getApi().get('/billingoutbox/dead');
    return Array.isArray(response.data) ? response.data : [];
  },
  getIpEvent: (eventId: string): Promise<OutboxEventDetail> => ipManagementApi.getOutboxEvent(eventId),
  getBillingEvent: async (eventId: string): Promise<OutboxEventDetail> => {
    const response = await getApi().get(`/billingoutbox/events/${eventId}`);
    return response.data;
  },
  requeueIp: (eventIds: string[], eventType?: string) =>
    ipManagementApi.requeueOutbox(eventIds, eventType),
  requeueBilling: async (eventIds: string[], eventType?: string): Promise<number> => {
    const response = await getApi().post('/billingoutbox/requeue', { eventIds, eventType });
    return Number(response.data?.requeued ?? 0);
  },
  abandonIp: (eventId: string, reason: string, compensatingAction?: string) =>
    ipManagementApi.abandonOutbox(eventId, reason, compensatingAction),
  abandonBilling: async (eventId: string, reason: string, compensatingAction?: string): Promise<void> => {
    await getApi().post('/billingoutbox/abandon', { eventId, reason, compensatingAction });
  },
};

export default integrationHealthApi;
