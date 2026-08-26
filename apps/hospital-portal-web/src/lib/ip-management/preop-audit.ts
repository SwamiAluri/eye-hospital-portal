import type {
  JourneyAuditLogDto,
  PreOpCompletionDto,
  PreOpSectionClearanceDto,
} from '@/lib/api/ip-management.api';

export type PreOpAuditEventKind = 'completion' | 'section' | 'journey';

export interface PreOpAuditEvent {
  id: string;
  at: string;
  kind: PreOpAuditEventKind;
  title: string;
  detail?: string;
  actor?: string;
}

function parseTime(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function completionEvents(completions: PreOpCompletionDto[]): PreOpAuditEvent[] {
  const events: PreOpAuditEvent[] = [];

  for (const c of completions) {
    const at = c.completedAt ?? c.enteredAt ?? c.updatedAt;
    if (!at) continue;

    if (c.isBypassed) {
      events.push({
        id: `bypass-${c.id}`,
        at,
        kind: 'completion',
        title: `${c.itemLabel} bypassed`,
        detail: c.bypassReason ?? undefined,
        actor: c.completedByRole ?? undefined,
      });
      continue;
    }

    if (c.isCompleted || c.source === 'derived') {
      const detailParts: string[] = [];
      if (c.source === 'derived') detailParts.push('Auto-derived');
      if (c.resultValue?.trim()) detailParts.push(c.resultValue.trim());
      if (c.notes?.trim() && c.notes !== c.resultValue) detailParts.push(c.notes.trim());

      events.push({
        id: `completion-${c.id}`,
        at,
        kind: 'completion',
        title: c.source === 'derived' ? `${c.itemLabel} derived` : c.itemLabel,
        detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
        actor: c.completedByRole ?? undefined,
      });
    }
  }

  return events;
}

function sectionEvents(sections: PreOpSectionClearanceDto[]): PreOpAuditEvent[] {
  const events: PreOpAuditEvent[] = [];

  for (const s of sections) {
    if (s.confirmedAt) {
      events.push({
        id: `section-confirmed-${s.id}`,
        at: s.confirmedAt,
        kind: 'section',
        title: `${s.sectionCategory} clearance confirmed`,
        detail: s.confirmationNotes ?? undefined,
      });
    } else if (s.respondedAt) {
      events.push({
        id: `section-responded-${s.id}`,
        at: s.respondedAt,
        kind: 'section',
        title: `${s.sectionCategory} — ${s.status}`,
        detail: s.responseNotes ?? undefined,
        actor: s.externalResponderName ?? undefined,
      });
    } else if (s.requestedAt) {
      events.push({
        id: `section-requested-${s.id}`,
        at: s.requestedAt,
        kind: 'section',
        title: `${s.sectionCategory} clearance requested`,
        detail: s.urgency !== 'Normal' ? `Urgency: ${s.urgency}` : undefined,
      });
    }
  }

  return events;
}

function journeyEvents(logs: JourneyAuditLogDto[]): PreOpAuditEvent[] {
  return logs.map(log => ({
    id: `journey-${log.id}`,
    at: log.performedAt || log.changedAt,
    kind: 'journey' as const,
    title: log.action || log.fieldChanged,
    detail:
      log.oldValue && log.newValue
        ? `${log.oldValue} → ${log.newValue}`
        : log.newValue ?? log.oldValue ?? undefined,
  }));
}

/** Merge clearance + journey audit into a single timeline (newest first). */
export function buildPreOpAuditTimeline(input: {
  completions?: PreOpCompletionDto[];
  sectionClearances?: PreOpSectionClearanceDto[];
  journeyAudit?: JourneyAuditLogDto[];
  limit?: number;
}): PreOpAuditEvent[] {
  const merged = [
    ...completionEvents(input.completions ?? []),
    ...sectionEvents(input.sectionClearances ?? []),
    ...journeyEvents(input.journeyAudit ?? []),
  ];

  merged.sort((a, b) => parseTime(b.at) - parseTime(a.at));

  const limit = input.limit ?? 100;
  return merged.slice(0, limit);
}
