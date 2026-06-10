'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';

interface LastVisitSummaryBarProps {
  priorVisit: PriorVisitSnapshot | null;
  loading?: boolean;
}

function formatDate(iso?: string) {
  if (!iso) return 'Previous visit';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Previous visit';
  }
}

export default function LastVisitSummaryBar({ priorVisit, loading }: LastVisitSummaryBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 animate-pulse">
        Loading last visit values…
      </div>
    );
  }

  if (!priorVisit) {
    return (
      <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 flex items-center gap-2">
        <History className="w-3.5 h-3.5" />
        No prior examination on record for comparison
      </div>
    );
  }

  const rxOd = priorVisit.refraction?.finalRxOD ?? priorVisit.refraction?.startingRxOD;
  const rxOs = priorVisit.refraction?.finalRxOS ?? priorVisit.refraction?.startingRxOS;
  const rxLine =
    rxOd || rxOs
      ? `Rx OD ${rxOd?.sphere ?? '—'}/${rxOd?.cylinder ?? '—'}×${rxOd?.axis ?? '—'} · OS ${rxOs?.sphere ?? '—'}/${rxOs?.cylinder ?? '—'}×${rxOs?.axis ?? '—'}`
      : null;

  return (
    <div className="bg-slate-50 border-b border-slate-200">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-2 flex items-center justify-between text-left hover:bg-slate-100/80 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <History className="w-3.5 h-3.5 text-indigo-600" />
            Last visit: {formatDate(priorVisit.examinationDate)}
          </span>
          {priorVisit.visualAcuity?.distanceOD && (
            <span>
              VA OD {priorVisit.visualAcuity.distanceOD}
              {priorVisit.visualAcuity.distanceOS ? ` · OS ${priorVisit.visualAcuity.distanceOS}` : ''}
            </span>
          )}
          {priorVisit.iop?.od != null && (
            <span>
              IOP OD {priorVisit.iop.od}
              {priorVisit.iop.os != null ? ` / OS ${priorVisit.iop.os}` : ''}
              {priorVisit.iop.method ? ` (${priorVisit.iop.method})` : ''}
            </span>
          )}
          {rxLine && <span className="text-slate-600">{rxLine}</span>}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-6 pb-3 text-xs text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <p className="font-medium text-slate-800 mb-1">Visual acuity</p>
            <p>Distance OD: {priorVisit.visualAcuity?.distanceOD ?? '—'}</p>
            <p>Distance OS: {priorVisit.visualAcuity?.distanceOS ?? '—'}</p>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-1">Refraction (final)</p>
            <p>OD: {rxOd?.sphere ?? '—'} / {rxOd?.cylinder ?? '—'} × {rxOd?.axis ?? '—'}</p>
            <p>OS: {rxOs?.sphere ?? '—'} / {rxOs?.cylinder ?? '—'} × {rxOs?.axis ?? '—'}</p>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-1">IOP / Keratometry</p>
            <p>IOP: OD {priorVisit.iop?.od ?? '—'} · OS {priorVisit.iop?.os ?? '—'}</p>
            {priorVisit.keratometry?.od && (
              <p>
                K OD: {priorVisit.keratometry.od.k1}/{priorVisit.keratometry.od.k2} @{' '}
                {priorVisit.keratometry.od.axis}°
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
