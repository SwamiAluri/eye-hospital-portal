'use client';

import { buildMhVisitTimeline } from '@/lib/medical-history/medical-history-prior-visit';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';

interface MhVisitTimelineProps {
  patientOptometryHistory?: OptometryVisitExamRecord[];
  compact?: boolean;
}

export function MhVisitTimeline({
  patientOptometryHistory = [],
  compact = false,
}: MhVisitTimelineProps) {
  const entries = buildMhVisitTimeline(patientOptometryHistory);

  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-slate-500 px-1 py-2 italic">No prior MH visits on file.</p>
    );
  }

  return (
    <div className={compact ? 'px-1' : ''}>
      <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide px-1 mb-1">
        MH visit history
      </p>
      <ul className={`space-y-1 overflow-y-auto ${compact ? 'max-h-36' : 'max-h-48'}`}>
        {entries.map((e) => (
          <li key={e.id}>
            <div className="px-2 py-1.5 rounded-md text-[11px] bg-white border border-slate-100">
              <span className="font-medium text-slate-800 block">
                {new Date(e.examinationDate).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Asia/Kolkata',
                })}
              </span>
              <span className="text-slate-600 line-clamp-2">{e.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
