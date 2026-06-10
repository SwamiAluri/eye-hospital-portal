'use client';

import { Pencil, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VaSectionSummaryLine } from '@/lib/optometry/va-section-summary';
import { VA_SECTION_LOCK_TOOLTIP } from '@/lib/optometry/va-visit-detail-format';
import { VaSectionHistoryPanel } from './VaSectionHistoryPanel';
import type { VaSectionId } from '@/lib/optometry/visual-acuity-constants';
import { VA_SECTIONS } from '@/lib/optometry/visual-acuity-constants';

interface VaSectionSummaryPanelProps {
  sectionId: VaSectionId;
  lines: VaSectionSummaryLine[];
  recordedAt?: string;
  canEdit: boolean;
  editLocked: boolean;
  onEdit: () => void;
  vaHistory?: unknown[];
  refHistory?: unknown[];
}

export function VaSectionSummaryPanel({
  sectionId,
  lines,
  recordedAt,
  canEdit,
  editLocked,
  onEdit,
  vaHistory,
  refHistory,
}: VaSectionSummaryPanelProps) {
  const meta = VA_SECTIONS.find((s) => s.id === sectionId);
  const hasContent = lines.some((l) => l.value && l.value !== '—' && !l.value.endsWith(': —'));

  return (
    <div className="h-full flex flex-col rounded-lg border border-slate-200 bg-slate-50/80 p-3 min-h-[12rem]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-800">Recorded today</h4>
          {recordedAt && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              {new Date(recordedAt).toLocaleString(undefined, {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>
        {canEdit && !editLocked && (
          <Button type="button" size="sm" variant="outline" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={onEdit}>
            Edit
          </Button>
        )}
        {editLocked && (
          <span
            title={VA_SECTION_LOCK_TOOLTIP}
            className="inline-flex items-center gap-1 text-[10px] text-slate-500 px-2 py-1 bg-white border border-slate-200 rounded cursor-help"
          >
            <Lock className="w-3 h-3" aria-hidden />
            Locked
          </span>
        )}
      </div>

      {!hasContent ? (
        <p className="text-xs text-slate-500 italic flex-1">No values recorded in this section.</p>
      ) : (
        <ul className="space-y-2 flex-1 text-xs font-mono text-slate-800">
          {lines.map((line) => (
            <li key={`${line.label ?? ''}-${line.value}`} className="leading-snug">
              {line.label && (
                <span className="text-slate-500 font-sans text-[10px] uppercase block">{line.label}</span>
              )}
              {line.value}
            </li>
          ))}
        </ul>
      )}

      {meta?.showHistoryPanel && (
        <div className="mt-3 pt-2 border-t border-slate-200">
          <VaSectionHistoryPanel sectionId={sectionId} vaHistory={vaHistory} refHistory={refHistory} />
        </div>
      )}
    </div>
  );
}
