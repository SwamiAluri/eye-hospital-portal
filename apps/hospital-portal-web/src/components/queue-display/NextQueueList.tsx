'use client';

import type { QueueDisplayPatient } from '@/lib/api/queue-display.api';
import {
  BRAND_THEME,
  emptyNextPlaceholder,
  NEXT_QUEUE_MAX,
  splitToken,
  urgencyBadgeClass,
} from './queue-display-theme';

interface NextQueueListProps {
  nextQueue: QueueDisplayPatient[];
}

function NextRow({ patient, index }: { patient: QueueDisplayPatient; index: number }) {
  const isEmpty = !patient.patientName && patient.tokenNumber === '—';
  const { prefix, suffix, hasStructured } = splitToken(patient.tokenNumber || '—');

  return (
    <div
      className={`flex items-stretch gap-3 rounded-xl border bg-white px-4 py-4 shadow-sm ${
        isEmpty ? 'border-dashed border-slate-200 opacity-50' : 'border-slate-200/90'
      }`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: isEmpty ? '#e2e8f0' : BRAND_THEME.stripe,
      }}
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center self-center">
        <span className="text-sm font-bold text-slate-500 tabular-nums">{index + 1}</span>
      </div>

      <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
        {isEmpty ? (
          <p className="text-slate-400 font-medium text-lg">—</p>
        ) : (
          <>
            {hasStructured ? (
              <div className="leading-none">
                <span className="queue-tv-next-token-prefix font-mono text-slate-500 tabular-nums">
                  {prefix}
                </span>
                <span className="queue-tv-next-token font-mono font-black text-slate-900 tabular-nums block">
                  {suffix}
                </span>
              </div>
            ) : (
              <span className="queue-tv-next-token font-mono font-black text-slate-900 tabular-nums">
                {patient.tokenNumber}
              </span>
            )}
            <p className="queue-tv-next-name font-semibold text-slate-800 leading-snug line-clamp-2 mt-1">
              {patient.patientName}
            </p>
            <p className="queue-tv-next-meta text-slate-500">
              {patient.gender}
              {patient.gender && patient.ageCategory ? ' · ' : ''}
              {patient.ageCategory}
            </p>
          </>
        )}
      </div>

      {!isEmpty && (
        <div className="flex flex-col gap-1 items-end justify-center flex-shrink-0">
          {patient.urgency !== 'Routine' && (
            <span className={urgencyBadgeClass(patient.urgency, 'sm')}>{patient.urgency}</span>
          )}
          {patient.isReturnVisit && (
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-teal-100 text-teal-800">
              Pass {patient.passNumber}
            </span>
          )}
          {!patient.isReturnVisit && patient.reasonLabel && (
            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-slate-100 text-slate-600">
              {patient.reasonLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function NextQueueList({ nextQueue }: NextQueueListProps) {
  const items =
    nextQueue.length > 0
      ? nextQueue.slice(0, NEXT_QUEUE_MAX)
      : Array.from({ length: NEXT_QUEUE_MAX }, () => emptyNextPlaceholder());

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-3">Next in Queue</p>
      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
        {items.map((patient, i) => (
          <NextRow key={`${patient.tokenNumber}-${i}`} patient={patient} index={i} />
        ))}
      </div>
    </div>
  );
}
