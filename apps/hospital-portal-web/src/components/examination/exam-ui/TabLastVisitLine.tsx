'use client';

import type { OptometryExamTabId } from '@/lib/optometry/optometry-exam-types';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import { formatRetinoscopyTabLastVisitLine } from '@/lib/optometry/retinoscopy-section-history';
import { formatAnteriorTabLastVisitLine } from '@/lib/optometry/anterior-segment-section-history';
import { formatPosteriorTabLastVisitLine } from '@/lib/optometry/posterior-segment-tab-utils';

const TAB_SUMMARY: Record<
  OptometryExamTabId,
  (p: PriorVisitSnapshot) => string | null
> = {
  'medical-history': (p) => {
    const raw = p.raw as {
      conditions?: string[];
      allergies?: string[];
      medications?: string[];
    } | undefined;
    const cond = raw?.conditions?.length ?? 0;
    const allergy = raw?.allergies?.length ?? 0;
    const meds = raw?.medications?.length ?? 0;
    if (!cond && !allergy && !meds) return null;
    const parts: string[] = [];
    if (cond) parts.push(`${cond} condition(s)`);
    if (allergy) parts.push(`${allergy} allergy alert(s)`);
    if (meds) parts.push(`${meds} medication(s)`);
    return parts.join(' · ');
  },
  'visual-acuity': (p) => {
    const va = p.visualAcuity;
    if (!va) return null;
    const od =
      va.distanceODUnaided && va.distanceODAided
        ? `${va.distanceODUnaided} / ${va.distanceODAided} aided`
        : va.distanceOD;
    const os =
      va.distanceOSUnaided && va.distanceOSAided
        ? `${va.distanceOSUnaided} / ${va.distanceOSAided} aided`
        : va.distanceOS;
    if (!od && !os) return null;
    return `VA distance OD ${od ?? '—'} · OS ${os ?? '—'}`;
  },
  iop: (p) => {
    if (p.iop?.od == null && p.iop?.os == null) return null;
    return `IOP OD ${p.iop?.od ?? '—'} / OS ${p.iop?.os ?? '—'}${p.iop?.method ? ` (${p.iop.method})` : ''}`;
  },
  retinoscopy: (p) => formatRetinoscopyTabLastVisitLine(p),
  anterior: (p) => formatAnteriorTabLastVisitLine(p),
  posterior: (p) => formatPosteriorTabLastVisitLine(p.raw as Record<string, unknown> | undefined),
  medications: () => null,
  'optical-prescription': (p) => {
    const od = p.refraction?.finalRxOD ?? p.refraction?.startingRxOD;
    if (!od?.sphere) return null;
    return `Last Rx OD ${od.sphere}/${od.cylinder ?? '—'}×${od.axis ?? '—'}`;
  },
  referral: () => null,
  diagnosis: () => null,
  advice: () => null,
};

interface TabLastVisitLineProps {
  tabId: OptometryExamTabId;
  priorVisit: PriorVisitSnapshot | null;
}

export function TabLastVisitLine({ tabId, priorVisit }: TabLastVisitLineProps) {
  if (!priorVisit) return null;
  const line = TAB_SUMMARY[tabId](priorVisit);
  if (!line) return null;
  return (
    <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 mb-3">
      <span className="font-semibold text-slate-700">Last visit: </span>
      {line}
    </p>
  );
}
