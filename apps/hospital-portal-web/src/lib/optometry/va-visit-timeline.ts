import type { OptometryVisitExamRecord } from './optometry-history.types';
import type { VaVisitTimelineEntry } from './va-visit-timeline';

function formatDate(d: unknown): string {
  if (!d) return '—';
  try {
    return new Date(String(d)).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return String(d);
  }
}

export function buildVaVisitTimelineFromPatientHistory(
  visits: OptometryVisitExamRecord[],
  maxItems = 8,
): VaVisitTimelineEntry[] {
  return visits
    .filter((v) => v.segments.visual_acuity_bundle != null)
    .slice(0, maxItems)
    .map((v) => {
      const va = v.segments.visual_acuity_bundle!;
      const parts: string[] = [];
      if (v.summary.distanceVaLine) parts.push(v.summary.distanceVaLine);
      if (v.summary.todaysRxLine) parts.push(v.summary.todaysRxLine);
      if (v.summary.previousGlassesLine) parts.push(`Old: ${v.summary.previousGlassesLine}`);
      return {
        id: v.visitId,
        examinationDate: v.examinationDate,
        label: parts.join(' · ') || 'VA recorded',
        raw: {
          visitId: v.visitId,
          examinationDate: v.examinationDate,
          visualAcuityBundle: va,
          summary: v.summary,
        },
      };
    });
}

export interface VaVisitTimelineEntry {
  id: string;
  examinationDate: string;
  label: string;
  raw: Record<string, unknown>;
}

function vaOneLiner(rec: Record<string, unknown>): string {
  const dist = (rec.distanceVA ?? rec.distance) as
    | Record<string, { unaided?: string; aided?: string }>
    | undefined;
  const od = dist?.OD;
  const os = dist?.OS;
  const parts: string[] = [];
  if (od?.unaided || od?.aided) parts.push(`OD ${od.unaided ?? '—'}${od.aided ? `/${od.aided}` : ''}`);
  if (os?.unaided || os?.aided) parts.push(`OS ${os.unaided ?? '—'}${os.aided ? `/${os.aided}` : ''}`);
  return parts.join(' · ') || 'VA recorded';
}

function rxOneLiner(rec: Record<string, unknown>): string {
  const finalRx = rec.finalRx as Record<string, Record<string, unknown>> | undefined;
  const od = finalRx?.OD;
  if (!od) return 'Rx recorded';
  return `Rx OD ${od.sphere ?? '—'}/${od.cylinder ?? '—'}×${od.axis ?? '—'}`;
}

/** @deprecated — use buildVaVisitTimelineFromPatientHistory */
export function buildVaVisitTimeline(
  vaHistory: unknown[],
  refHistory: unknown[],
  maxItems = 8,
): VaVisitTimelineEntry[] {
  const vaList = (Array.isArray(vaHistory) ? vaHistory : []) as Record<string, unknown>[];
  const refList = (Array.isArray(refHistory) ? refHistory : []) as Record<string, unknown>[];

  const byDay = new Map<string, VaVisitTimelineEntry>();

  const add = (rec: Record<string, unknown>, kind: 'va' | 'ref') => {
    const date = rec.examinationDate ? String(rec.examinationDate) : '';
    const dayKey = date ? formatDate(date) : `unknown-${rec.id ?? Math.random()}`;
    const id = String(rec.id ?? `${kind}-${dayKey}`);
    const snippet = kind === 'va' ? vaOneLiner(rec) : rxOneLiner(rec);
    const existing = byDay.get(dayKey);
    if (existing) {
      existing.label = `${existing.label} · ${snippet}`;
      return;
    }
    byDay.set(dayKey, {
      id,
      examinationDate: date,
      label: snippet,
      raw: rec,
    });
  };

  vaList.forEach((r) => add(r, 'va'));
  refList.forEach((r) => add(r, 'ref'));

  return [...byDay.values()]
    .sort((a, b) => new Date(b.examinationDate || 0).getTime() - new Date(a.examinationDate || 0).getTime())
    .slice(0, maxItems);
}
