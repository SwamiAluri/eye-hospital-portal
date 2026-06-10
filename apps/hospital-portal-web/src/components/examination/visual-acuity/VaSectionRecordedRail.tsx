'use client';

import { Pencil, Lock, History, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { snapshotToSummaryData } from '@/lib/optometry/va-section-snapshot';
import type { VaMegaFormState } from '@/lib/optometry/va-section-snapshot';
import type { EyeRx } from '@/components/examination/exam-ui/RxBilateralPrescriptionCard';
import { VA_SECTION_LOCK_TOOLTIP } from '@/lib/optometry/va-visit-detail-format';
import type { VaSectionId } from '@/lib/optometry/visual-acuity-constants';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';
import { getVaSectionPriorHistory, getSectionPriorHistory } from '@/lib/optometry/va-section-history';
import {
  VaRecordedRxTable,
  VaRecordedVaTable,
  rxFromHistoryRecord,
  type VaRecordedEyeRx,
} from './VaRecordedRxTable';
import { cn } from '@/lib/utils';

function formatExamDate(d: unknown): string {
  if (!d) return '—';
  try {
    return new Date(String(d)).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return String(d);
  }
}

function toStr(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  return String(v);
}

function rxFromSnapshot(sectionId: VaSectionId, snapshot: unknown): {
  od?: VaRecordedEyeRx;
  os?: VaRecordedEyeRx;
  distance?: { OD?: { unaided?: string; aided?: string }; OS?: { unaided?: string; aided?: string } };
  near?: { OD?: { unaided?: string; aided?: string }; OS?: { unaided?: string; aided?: string } };
} {
  if (!snapshot) return {};
  if (sectionId === 'old' || sectionId === 'new') {
    const rx = snapshot as { OD: EyeRx; OS: EyeRx };
    return {
      od: {
        sphere: toStr(rx.OD?.sphere),
        cylinder: toStr(rx.OD?.cylinder),
        axis: toStr(rx.OD?.axis),
        va: toStr(rx.OD?.va),
      },
      os: {
        sphere: toStr(rx.OS?.sphere),
        cylinder: toStr(rx.OS?.cylinder),
        axis: toStr(rx.OS?.axis),
        va: toStr(rx.OS?.va),
      },
    };
  }
  if (sectionId === 'refraction') {
    const r = snapshot as {
      OD: { sphere: string; cylinder: string; axis: string };
      OS: { sphere: string; cylinder: string; axis: string };
    };
    return {
      od: { sphere: toStr(r.OD?.sphere), cylinder: toStr(r.OD?.cylinder), axis: toStr(r.OD?.axis) },
      os: { sphere: toStr(r.OS?.sphere), cylinder: toStr(r.OS?.cylinder), axis: toStr(r.OS?.axis) },
    };
  }
  if (sectionId === 'distance') {
    const d = snapshot as {
      distanceVision: VaMegaFormState['distanceVision'];
      nearVision: VaMegaFormState['nearVision'];
    };
    return { distance: d.distanceVision, near: d.nearVision };
  }
  return {};
}

interface VaSectionRecordedRailProps {
  sectionId: VaSectionId;
  snapshot: unknown;
  formState: VaMegaFormState;
  recordedAt?: string;
  isEditing: boolean;
  canEdit: boolean;
  editLocked: boolean;
  onEdit: () => void;
  vaHistory?: unknown[];
  refHistory?: unknown[];
  patientOptometryHistory?: OptometryVisitExamRecord[];
  excludeVisitId?: string;
  powerChangeOd?: string;
  powerChangeOs?: string;
}

export function VaSectionRecordedRail({
  sectionId,
  snapshot,
  formState,
  recordedAt,
  isEditing,
  canEdit,
  editLocked,
  onEdit,
  vaHistory = [],
  refHistory = [],
  patientOptometryHistory,
  excludeVisitId,
  powerChangeOd,
  powerChangeOs,
}: VaSectionRecordedRailProps) {
  const parsed = rxFromSnapshot(sectionId, snapshot);
  const hasTodaySnapshot = snapshot != null;
  const summaryData = hasTodaySnapshot
    ? snapshotToSummaryData(sectionId, snapshot, formState)
    : null;

  const rxSections: VaSectionId[] = ['old', 'new', 'refraction'];
  const useRef = rxSections.includes(sectionId);

  const historyItems = patientOptometryHistory?.length
    ? getVaSectionPriorHistory(sectionId, patientOptometryHistory, excludeVisitId, 5)
    : getSectionPriorHistory(sectionId, vaHistory, refHistory, 5).map((rec) => ({
        examinationDate: String(rec.examinationDate ?? ''),
        visitId: String(rec.id ?? ''),
        snapshot: rec,
        summary: '',
      }));

  const renderTodayBody = () => {
    if (sectionId === 'old' || sectionId === 'new') {
      return <VaRecordedRxTable od={parsed.od} os={parsed.os} showVa />;
    }
    if (sectionId === 'refraction') {
      return <VaRecordedRxTable od={parsed.od} os={parsed.os} showVa={false} />;
    }
    if (sectionId === 'distance') {
      return (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Distance</p>
          <VaRecordedVaTable od={parsed.distance?.OD} os={parsed.distance?.OS} />
          <p className="text-[10px] font-semibold uppercase text-slate-500 pt-1">Near</p>
          <VaRecordedVaTable od={parsed.near?.OD} os={parsed.near?.OS} />
        </div>
      );
    }
    if (sectionId === 'keratometry') {
      const k = summaryData!.keratometry;
      return (
        <VaRecordedRxTable
          showVa={false}
          headers={['K1', 'K2', 'A']}
          od={{ sphere: k.OD.k1, cylinder: k.OD.k2, axis: k.OD.axis }}
          os={{ sphere: k.OS.k1, cylinder: k.OS.k2, axis: k.OS.axis }}
        />
      );
    }
    if (sectionId === 'color') {
      const c = summaryData!.colorVision;
      return (
        <dl className="text-xs space-y-1.5">
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-1">
            <dt className="text-slate-500">Test</dt>
            <dd className="font-medium text-slate-800">{c.testType || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-1">
            <dt className="text-slate-500">Result</dt>
            <dd className="font-medium text-slate-800">{c.result || '—'}</dd>
          </div>
          {c.platesMissed && (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Plates missed</dt>
              <dd className="font-medium text-slate-800">{c.platesMissed}</dd>
            </div>
          )}
        </dl>
      );
    }
    if (sectionId === 'contrast') {
      const cs = summaryData!.contrastSensitivity;
      return (
        <VaRecordedVaTable
          od={{ unaided: cs.OD.score, aided: cs.OD.interpretation }}
          os={{ unaided: cs.OS.score, aided: cs.OS.interpretation }}
          col1Label="Score"
          col2Label="Interp."
        />
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-3">
      {hasTodaySnapshot && (
      <div
        className={cn(
          'rounded-xl border overflow-hidden shadow-sm transition-all',
          isEditing
            ? 'border-emerald-500 ring-2 ring-emerald-200/80'
            : 'border-slate-200',
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
              <p className={cn('text-[10px] mt-0.5 truncate', isEditing ? 'text-emerald-50' : 'text-slate-300')}>
                {new Date(recordedAt).toLocaleString(undefined, {
                  timeZone: 'Asia/Kolkata',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            )}
          </div>
          {canEdit && !editLocked && !isEditing && (
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
          {editLocked && (
            <span
              title={VA_SECTION_LOCK_TOOLTIP}
              className="inline-flex items-center gap-1 text-[10px] text-slate-200 px-2 py-1 bg-white/10 rounded cursor-help shrink-0"
            >
              <Lock className="w-3 h-3" aria-hidden />
              Locked
            </span>
          )}
        </div>

        <div className="p-2.5 bg-white">
          {renderTodayBody()}
          {(powerChangeOd || powerChangeOs) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {powerChangeOd && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                  Δ OD {powerChangeOd}
                </span>
              )}
              {powerChangeOs && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                  Δ OS {powerChangeOs}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {!hasTodaySnapshot && historyItems.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
          <p className="text-xs text-slate-500">No records yet. Enter values on the left and record.</p>
        </div>
      )}

      {historyItems.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
            <History className="w-3.5 h-3.5 text-slate-500" />
            Prior visits
          </p>
          <ul className="space-y-3">
            {historyItems.map((rec, i) => {
              const date = formatExamDate(rec.examinationDate);
              const key = String(rec.visitId ?? `${date}-${i}`);
              const snap = 'snapshot' in rec ? rec.snapshot : rec;
              return (
                <li key={key}>
                  <p className="text-[10px] font-medium text-slate-600 mb-1">{date}</p>
                  {sectionId === 'distance' ? (
                    (() => {
                      const d = snap as {
                        distanceVision?: VaMegaFormState['distanceVision'];
                        nearVision?: VaMegaFormState['nearVision'];
                        distanceVA?: unknown;
                        distance?: unknown;
                      };
                      const dist =
                        d?.distanceVision ??
                        (d?.distanceVA as VaMegaFormState['distanceVision'] | undefined) ??
                        (d?.distance as VaMegaFormState['distanceVision'] | undefined);
                      const near = d?.nearVision;
                      return (
                        <div className="space-y-1">
                          {dist && (
                            <VaRecordedVaTable compact od={dist.OD} os={dist.OS} />
                          )}
                          {near && (
                            <VaRecordedVaTable compact od={near.OD} os={near.OS} />
                          )}
                        </div>
                      );
                    })()
                  ) : useRef ? (
                    (() => {
                      const fromSnap = rxFromSnapshot(sectionId, snap);
                      if (fromSnap.od || fromSnap.os) {
                        return (
                          <VaRecordedRxTable
                            compact
                            showVa={sectionId !== 'refraction'}
                            od={fromSnap.od}
                            os={fromSnap.os}
                          />
                        );
                      }
                      return (
                        <VaRecordedRxTable
                          compact
                          showVa={sectionId !== 'refraction'}
                          od={rxFromHistoryRecord(snap as Record<string, unknown>, 'OD')}
                          os={rxFromHistoryRecord(snap as Record<string, unknown>, 'OS')}
                        />
                      );
                    })()
                  ) : sectionId === 'keratometry' || sectionId === 'color' || sectionId === 'contrast' ? (
                    <p className="text-[10px] text-slate-600">{rec.summary || 'Recorded'}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
