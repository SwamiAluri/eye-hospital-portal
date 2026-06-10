'use client';

import { Pencil, History, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { IopSectionId } from '@/lib/optometry/iop-section-constants';
import {
  evaluateTargetIopStatus,
  formatPachymetrySnapshotSummary,
  formatSchirmerSnapshotSummary,
  formatTonometrySnapshotSummary,
  formatTrendRowSummary,
  formatVisualFieldSnapshotSummary,
  getSectionPriorHistory,
  getTonometryPriorHistory,
  getIopSectionPriorHistoryFromVisits,
  type PriorIopSectionEntry,
} from '@/lib/optometry/iop-section-history';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';

interface IopSectionRecordedRailProps {
  sectionId: IopSectionId;
  snapshot: unknown;
  recordedAt?: string;
  isEditing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  iopTrend?: unknown[];
  priorIopExtended?: unknown;
  priorExaminationDate?: string;
  patientOptometryHistory?: OptometryVisitExamRecord[];
  excludeVisitId?: string;
  targetIOPOD?: number;
  targetIOPOS?: number;
}

function TonometrySummaryBody({
  snap,
}: {
  snap: ReturnType<typeof formatTonometrySnapshotSummary>;
}) {
  return (
    <dl className="text-xs space-y-1.5">
      <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold uppercase text-slate-500 border-b border-slate-100 pb-1">
        <span>Phase</span>
        <span className="text-blue-700">OD</span>
        <span className="text-emerald-700">OS</span>
      </div>
      <div className="grid grid-cols-3 gap-1 tabular-nums">
        <span className="text-slate-600">Pre-dil</span>
        <span className="font-medium">{snap.preOd ?? '—'}</span>
        <span className="font-medium">{snap.preOs ?? '—'}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 tabular-nums">
        <span className="text-slate-600">Post-dil</span>
        <span className="font-medium">{snap.postOd ?? '—'}</span>
        <span className="font-medium">{snap.postOs ?? '—'}</span>
      </div>
    </dl>
  );
}

function TargetIopBadges({
  snap,
  targetIOPOD,
  targetIOPOS,
}: {
  snap: ReturnType<typeof formatTonometrySnapshotSummary>;
  targetIOPOD?: number;
  targetIOPOS?: number;
}) {
  const status = evaluateTargetIopStatus(
    { od: snap.preOd, os: snap.preOs },
    targetIOPOD,
    targetIOPOS,
  );
  if (!status.od && !status.os) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {status.od && (
        <span
          className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded-full border',
            status.od === 'at-goal'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200',
          )}
        >
          OD {status.od === 'at-goal' ? 'At goal ✓' : 'Above target'}
          {targetIOPOD != null ? ` (≤${targetIOPOD})` : ''}
        </span>
      )}
      {status.os && (
        <span
          className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded-full border',
            status.os === 'at-goal'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200',
          )}
        >
          OS {status.os === 'at-goal' ? 'At goal ✓' : 'Above target'}
          {targetIOPOS != null ? ` (≤${targetIOPOS})` : ''}
        </span>
      )}
    </div>
  );
}

function PriorHistoryList({
  title,
  items,
  renderTonometryRow,
}: {
  title: string;
  items: PriorIopSectionEntry[] | Record<string, unknown>[];
  renderTonometryRow?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 shadow-sm">
      <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
        <History className="w-3.5 h-3.5 text-slate-500" />
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => {
          if (renderTonometryRow) {
            const rec = item as Record<string, unknown>;
            const row = formatTrendRowSummary(rec);
            const key = String(rec.id ?? `${row.date}-${i}`);
            return (
              <li key={key} className="text-xs">
                <p className="text-[10px] font-medium text-slate-600 mb-0.5">{row.date}</p>
                <p className="tabular-nums text-slate-800">
                  OD {row.od ?? '—'} · OS {row.os ?? '—'}
                  {row.method ? ` (${row.method})` : ''}
                </p>
              </li>
            );
          }
          const entry = item as PriorIopSectionEntry;
          return (
            <li key={`${entry.date}-${i}`} className="text-xs">
              <p className="text-[10px] font-medium text-slate-600 mb-0.5">{entry.date}</p>
              <p className="text-slate-800">{entry.summary}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function IopSectionRecordedRail({
  sectionId,
  snapshot,
  recordedAt,
  isEditing,
  canEdit,
  onEdit,
  iopTrend = [],
  priorIopExtended,
  priorExaminationDate,
  patientOptometryHistory,
  excludeVisitId,
  targetIOPOD,
  targetIOPOS,
}: IopSectionRecordedRailProps) {
  const hasTodaySnapshot = snapshot != null;

  const visitHistory =
    patientOptometryHistory && patientOptometryHistory.length > 0
      ? getIopSectionPriorHistoryFromVisits(
          sectionId,
          patientOptometryHistory,
          excludeVisitId,
          5,
        )
      : [];

  const tonometryHistory =
    visitHistory.length > 0
      ? []
      : sectionId === 'nct' || sectionId === 'atn'
        ? getTonometryPriorHistory(sectionId, iopTrend, 5)
        : [];

  const draftHistory =
    visitHistory.length > 0
      ? visitHistory
      : getSectionPriorHistory(sectionId, priorIopExtended, priorExaminationDate, 3);

  const renderTodayBody = () => {
    switch (sectionId) {
      case 'nct':
      case 'atn': {
        const tonometrySnap = formatTonometrySnapshotSummary(snapshot as object);
        return (
          <>
            <TonometrySummaryBody snap={tonometrySnap} />
            {sectionId === 'nct' && (
              <TargetIopBadges
                snap={tonometrySnap}
                targetIOPOD={targetIOPOD}
                targetIOPOS={targetIOPOS}
              />
            )}
          </>
        );
      }
      case 'schirmer':
        return (
          <p className="text-xs font-medium text-slate-800">
            {formatSchirmerSnapshotSummary(snapshot as object)}
          </p>
        );
      case 'pachymetry': {
        const p = snapshot as {
          OD?: { cct?: string; correctedIOP?: string };
          OS?: { cct?: string; correctedIOP?: string };
        };
        return (
          <dl className="text-xs space-y-1.5">
            <p className="text-slate-800 font-medium">
              {formatPachymetrySnapshotSummary(snapshot as object)}
            </p>
            {(p?.OD?.correctedIOP || p?.OS?.correctedIOP) && (
              <p className="text-[11px] text-blue-700">
                Corrected IOP: OD {p.OD?.correctedIOP ?? '—'} · OS {p.OS?.correctedIOP ?? '—'} mmHg
              </p>
            )}
          </dl>
        );
      }
      case 'visual-field':
        return (
          <p className="text-xs font-medium text-slate-800">
            {formatVisualFieldSnapshotSummary(snapshot as object)}
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {hasTodaySnapshot && (
        <div
          className={cn(
            'rounded-xl border overflow-hidden shadow-sm transition-all',
            isEditing ? 'border-emerald-500 ring-2 ring-emerald-200/80' : 'border-slate-200',
          )}
        >
          <div
            className={cn(
              'px-3 py-2 flex items-center justify-between gap-2 border-b',
              isEditing
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-800 text-white border-slate-700',
            )}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 shrink-0 opacity-90" />
                {isEditing ? 'Editing today' : 'Recorded today'}
              </p>
              {recordedAt && (
                <p
                  className={cn(
                    'text-[10px] mt-0.5 truncate',
                    isEditing ? 'text-emerald-50' : 'text-slate-300',
                  )}
                >
                  {new Date(recordedAt).toLocaleString(undefined, {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}
            </div>
            {canEdit && !isEditing && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-white text-slate-800 hover:bg-slate-50 border-0 shrink-0 h-8"
                leftIcon={<Pencil className="w-3.5 h-3.5" />}
                onClick={onEdit}
              >
                Edit
              </Button>
            )}
          </div>
          <div className="p-2.5 bg-white">{renderTodayBody()}</div>
        </div>
      )}

      {!hasTodaySnapshot && tonometryHistory.length === 0 && draftHistory.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
          <p className="text-xs text-slate-500">No records yet. Enter values on the left and record.</p>
        </div>
      )}

      <PriorHistoryList
        title={visitHistory.length > 0 ? 'Prior visits' : 'Prior visits (IOP trend)'}
        items={tonometryHistory}
        renderTonometryRow={visitHistory.length === 0}
      />
      <PriorHistoryList
        title={visitHistory.length > 0 ? undefined : 'Last visit snapshot'}
        items={draftHistory}
      />
    </div>
  );
}
