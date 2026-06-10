'use client';

import type { VaSectionId } from '@/lib/optometry/visual-acuity-constants';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import { getVaSectionPriorSummary } from '@/lib/optometry/visual-acuity-prior-summary';

interface VaSectionPriorStripProps {
  sectionId: VaSectionId;
  priorVisit?: PriorVisitSnapshot | null;
}

export function VaSectionPriorStrip({ sectionId, priorVisit }: VaSectionPriorStripProps) {
  const summary = getVaSectionPriorSummary(sectionId, priorVisit);
  const emptyMessage =
    summary?.emptyMessage ?? 'No prior data on record for this section.';

  const hasLines = (summary?.lines.length ?? 0) > 0;

  return (
    <div className="mb-3 px-3 py-2 rounded-lg bg-indigo-50/80 border border-indigo-100 text-xs text-slate-700">
      <p className="font-semibold text-indigo-900 mb-0.5">
        Prior visit{summary?.date ? ` · ${summary.date}` : ''}
      </p>
      {hasLines ? (
        <ul className="space-y-0.5 font-mono text-[11px] sm:text-xs">
          {summary!.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500 italic">{emptyMessage}</p>
      )}
    </div>
  );
}
