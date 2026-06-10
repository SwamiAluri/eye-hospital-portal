'use client';

import { History } from 'lucide-react';
import type { MedicalHistorySectionId } from '@/lib/medical-history/medical-history-constants';
import { getMhSectionPriorHistory } from '@/lib/medical-history/medical-history-prior-visit';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return iso;
  }
}

interface MhPriorSectionPanelProps {
  sectionId: MedicalHistorySectionId;
  patientOptometryHistory?: OptometryVisitExamRecord[];
  excludeVisitId?: string;
}

export function MhPriorSectionPanel({
  sectionId,
  patientOptometryHistory = [],
  excludeVisitId,
}: MhPriorSectionPanelProps) {
  const rows = getMhSectionPriorHistory(
    sectionId,
    patientOptometryHistory,
    excludeVisitId,
    5,
  );

  if (rows.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-2.5">
      <p className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1.5 mb-2">
        <History className="w-3.5 h-3.5" />
        Prior visits
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.visitId} className="text-xs">
            <p className="text-[10px] font-medium text-indigo-800">{formatDate(row.examinationDate)}</p>
            <p className="text-slate-700 mt-0.5 line-clamp-3">{row.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
