'use client';

import { History, CalendarClock, Edit2, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RetinoscopySectionId } from '@/lib/optometry/retinoscopy-section-constants';
import {
  calculateNeutralizingPower,
  formatPrescription,
  getRetinoscopyPriorHistory,
} from '@/lib/optometry/retinoscopy-section-history';
import type {
  DryRetinoscopyData,
  RetinoscopyReading,
  SubjectiveRefractionData,
  SubjectiveRefractionReading,
  WetRetinoscopyData,
} from '@/lib/optometry/retinoscopy-types';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';

const TODAY_ROWS_MAX = 3;
const PRIOR_VISITS_MAX = 3;

interface RetinoscopySectionRecordedRailProps {
  sectionId: RetinoscopySectionId;
  wetData?: WetRetinoscopyData;
  dryData?: DryRetinoscopyData;
  subjectiveData?: SubjectiveRefractionData;
  recordedAt?: string;
  isEditing?: boolean;
  canEdit?: boolean;
  onEditOdReading?: (reading: RetinoscopyReading) => void;
  onDeleteOdReading?: (id: string) => void;
  onEditOsReading?: (reading: RetinoscopyReading) => void;
  onDeleteOsReading?: (id: string) => void;
  onEditSubjectiveReading?: (reading: SubjectiveRefractionReading) => void;
  onDeleteSubjectiveReading?: (id: string) => void;
  onMarkSubjectiveFinal?: (id: string) => void;
  onEditDrug?: () => void;
  onDeleteDrug?: () => void;
  patientOptometryHistory?: OptometryVisitExamRecord[];
  excludeVisitId?: string;
  priorExaminationDate?: string;
}

function formatRecordedAt(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return '';
  }
}

function lastN<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return items.slice(-n);
}

const thClass =
  'px-1.5 py-1 text-[10px] font-semibold text-slate-600 border-b border-slate-200 text-center';
const tdClass = 'px-1.5 py-1 text-[10px] font-mono text-slate-800 border-b border-slate-100 text-center';

function ReadingActions({
  canEdit,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  if (!canEdit) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex items-center justify-center gap-0.5">
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className="p-1 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-40"
        title="Edit reading"
      >
        <Edit2 className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!onDelete}
        className="p-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-40"
        title="Delete reading"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

type WetDryTodayRow = {
  key: string;
  index: number;
  eye: 'OD' | 'OS';
  reading: RetinoscopyReading;
  accent: 'od' | 'os';
};

function buildWetDryTodayRows(
  odReadings: RetinoscopyReading[],
  osReadings: RetinoscopyReading[],
): { rows: WetDryTodayRow[]; hiddenCount: number } {
  const od = lastN(odReadings, TODAY_ROWS_MAX);
  const os = lastN(osReadings, TODAY_ROWS_MAX);
  const hiddenCount =
    Math.max(0, odReadings.length - TODAY_ROWS_MAX) +
    Math.max(0, osReadings.length - TODAY_ROWS_MAX);

  const rows: WetDryTodayRow[] = [];
  od.forEach((reading, i) => {
    const index = odReadings.length - od.length + i + 1;
    rows.push({
      key: `od-${reading.id}`,
      index,
      eye: 'OD',
      reading,
      accent: 'od',
    });
  });
  os.forEach((reading, i) => {
    const index = osReadings.length - os.length + i + 1;
    rows.push({
      key: `os-${reading.id}`,
      index,
      eye: 'OS',
      reading,
      accent: 'os',
    });
  });
  rows.sort((a, b) => a.index - b.index || (a.eye === 'OD' ? -1 : 1));
  return { rows, hiddenCount };
}

function WetDryTodayTable({
  odReadings,
  osReadings,
  canEdit,
  onEditOd,
  onDeleteOd,
  onEditOs,
  onDeleteOs,
}: {
  odReadings: RetinoscopyReading[];
  osReadings: RetinoscopyReading[];
  canEdit: boolean;
  onEditOd?: (r: RetinoscopyReading) => void;
  onDeleteOd?: (id: string) => void;
  onEditOs?: (r: RetinoscopyReading) => void;
  onDeleteOs?: (id: string) => void;
}) {
  const { rows, hiddenCount } = buildWetDryTodayRows(odReadings, osReadings);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-50">
              <th className={cn(thClass, 'text-left')}>#</th>
              <th className={cn(thClass, 'text-left')}>Eye</th>
              <th className={thClass}>Rx</th>
              <th className={thClass}>Dist</th>
              <th className={thClass}>Neutr</th>
              <th className={cn(thClass, 'w-14')}> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const neutral = calculateNeutralizingPower(
                row.reading.sphere,
                row.reading.workingDistance,
              ).toFixed(2);
              const onEdit = row.eye === 'OD' ? onEditOd : onEditOs;
              const onDelete = row.eye === 'OD' ? onDeleteOd : onDeleteOs;
              return (
                <tr
                  key={row.key}
                  className={row.accent === 'od' ? 'bg-blue-50/30' : 'bg-emerald-50/30'}
                >
                  <td className={cn(tdClass, 'text-left font-semibold text-slate-600')}>
                    {row.index}
                  </td>
                  <td
                    className={cn(
                      tdClass,
                      'text-left font-semibold',
                      row.accent === 'od' ? 'text-blue-800' : 'text-emerald-800',
                    )}
                  >
                    {row.eye}
                  </td>
                  <td className={cn(tdClass, 'text-left max-w-[120px] truncate')}>
                    {formatPrescription(
                      row.reading.sphere,
                      row.reading.cylinder,
                      row.reading.axis,
                    )}
                  </td>
                  <td className={tdClass}>{row.reading.workingDistance}cm</td>
                  <td className={tdClass}>{neutral}D</td>
                  <td className={tdClass}>
                    <ReadingActions
                      canEdit={canEdit}
                      onEdit={onEdit ? () => onEdit(row.reading) : undefined}
                      onDelete={onDelete ? () => onDelete(row.reading.id) : undefined}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <p className="text-[10px] text-slate-500 text-center">
          +{hiddenCount} older reading{hiddenCount === 1 ? '' : 's'} not shown
        </p>
      )}
    </div>
  );
}

function SubjectiveTodayTable({
  readings,
  canEdit,
  onEdit,
  onDelete,
  onMarkFinal,
}: {
  readings: SubjectiveRefractionReading[];
  canEdit: boolean;
  onEdit?: (r: SubjectiveRefractionReading) => void;
  onDelete?: (id: string) => void;
  onMarkFinal?: (id: string) => void;
}) {
  const visible = lastN(readings, TODAY_ROWS_MAX);
  const hiddenCount = Math.max(0, readings.length - TODAY_ROWS_MAX);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-50">
              <th className={cn(thClass, 'text-left')}>#</th>
              <th className={thClass}>OD</th>
              <th className={thClass}>OS</th>
              <th className={thClass}>VA OD</th>
              <th className={thClass}>VA OS</th>
              <th className={thClass}>Final</th>
              <th className={cn(thClass, 'w-14')}> </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((reading) => (
              <tr
                key={reading.id}
                className={reading.isFinal ? 'bg-emerald-50/60' : undefined}
              >
                <td className={cn(tdClass, 'text-left font-semibold text-slate-600')}>
                  {reading.isFinal ? '★' : reading.entryNumber}
                </td>
                <td className={cn(tdClass, 'text-left max-w-[100px] truncate')}>
                  {formatPrescription(reading.odSphere, reading.odCylinder, reading.odAxis)}
                </td>
                <td className={cn(tdClass, 'text-left max-w-[100px] truncate')}>
                  {formatPrescription(reading.osSphere, reading.osCylinder, reading.osAxis)}
                </td>
                <td className={tdClass}>{reading.vaAchievedOD || '—'}</td>
                <td className={tdClass}>{reading.vaAchievedOS || '—'}</td>
                <td className={tdClass}>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onMarkFinal?.(reading.id)}
                      className="inline-flex items-center justify-center p-0.5 rounded hover:bg-emerald-100"
                      title="Mark as final prescription"
                    >
                      {reading.isFinal ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  ) : reading.isFinal ? (
                    '★'
                  ) : (
                    '—'
                  )}
                </td>
                <td className={tdClass}>
                  <ReadingActions
                    canEdit={canEdit}
                    onEdit={onEdit ? () => onEdit(reading) : undefined}
                    onDelete={onDelete ? () => onDelete(reading.id) : undefined}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <p className="text-[10px] text-slate-500 text-center">
          +{hiddenCount} older reading{hiddenCount === 1 ? '' : 's'} not shown
        </p>
      )}
    </div>
  );
}

function WetDrugStrip({
  data,
  canEdit,
  onEditDrug,
  onDeleteDrug,
}: {
  data: WetRetinoscopyData;
  canEdit?: boolean;
  onEditDrug?: () => void;
  onDeleteDrug?: () => void;
}) {
  const parts: string[] = [];
  if (data.drug) parts.push(data.drug);
  if (data.duration != null) parts.push(`${data.duration} min`);
  if (data.timeAdministered) parts.push(`@ ${data.timeAdministered}`);
  if (parts.length === 0) return null;
  return (
    <div className="flex items-start justify-between gap-2 text-[11px] text-slate-700 bg-blue-50/80 border border-blue-100 rounded-md px-2 py-1.5">
      <p className="min-w-0">
        <span className="font-medium text-slate-800">Cycloplegic: </span>
        {parts.join(' · ')}
      </p>
      {canEdit && (
        <div className="flex gap-0.5 shrink-0">
          {onEditDrug && (
            <button
              type="button"
              onClick={onEditDrug}
              className="p-1 rounded text-blue-600 hover:bg-blue-100"
              title="Edit cycloplegic drug"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onDeleteDrug && (
            <button
              type="button"
              onClick={onDeleteDrug}
              className="p-1 rounded text-red-600 hover:bg-red-50"
              title="Delete cycloplegic drug"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function latestReadingRx(readings: RetinoscopyReading[]): string {
  if (!readings.length) return '—';
  const r = readings[readings.length - 1];
  const rx = formatPrescription(r.sphere, r.cylinder, r.axis);
  const neutral = calculateNeutralizingPower(r.sphere, r.workingDistance).toFixed(2);
  return `${rx} @ ${r.workingDistance}cm (${neutral}D)`;
}

function PriorVisitsTable({
  sectionId,
  rows,
}: {
  sectionId: RetinoscopySectionId;
  rows: ReturnType<typeof getRetinoscopyPriorHistory>;
}) {
  const visible = rows.slice(0, PRIOR_VISITS_MAX);
  if (visible.length === 0) return null;

  if (sectionId === 'subjective') {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-50">
              <th className={cn(thClass, 'text-left')}>Visit</th>
              <th className={thClass}>OD</th>
              <th className={thClass}>OS</th>
              <th className={thClass}>Note</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const data = row.snapshot as SubjectiveRefractionData;
              const final = data?.readings?.find((r) => r.isFinal);
              const target = final ?? data?.readings?.[data.readings.length - 1];
              const note = final
                ? '★ Final'
                : target
                  ? `#${target.entryNumber}`
                  : '—';
              return (
                <tr key={row.visitId}>
                  <td className={cn(tdClass, 'text-left font-medium text-slate-800 whitespace-nowrap')}>
                    {row.examinationDate}
                  </td>
                  <td className={cn(tdClass, 'text-left max-w-[100px] truncate')}>
                    {target
                      ? formatPrescription(target.odSphere, target.odCylinder, target.odAxis)
                      : '—'}
                  </td>
                  <td className={cn(tdClass, 'text-left max-w-[100px] truncate')}>
                    {target
                      ? formatPrescription(target.osSphere, target.osCylinder, target.osAxis)
                      : '—'}
                  </td>
                  <td className={tdClass}>{note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const showDrug = sectionId === 'wet';

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-50">
            <th className={cn(thClass, 'text-left')}>Visit</th>
            {showDrug && <th className={cn(thClass, 'text-left')}>Drug</th>}
            <th className={thClass}>OD (latest)</th>
            <th className={thClass}>OS (latest)</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const snap = row.snapshot as WetRetinoscopyData | DryRetinoscopyData;
            const wetSnap = sectionId === 'wet' ? (snap as WetRetinoscopyData) : null;
            const drug = wetSnap?.drug
              ? [wetSnap.drug, wetSnap.duration != null ? `${wetSnap.duration}m` : null]
                  .filter(Boolean)
                  .join(' ')
              : '—';
            return (
              <tr key={row.visitId}>
                <td className={cn(tdClass, 'text-left font-medium text-slate-800 whitespace-nowrap')}>
                  {row.examinationDate}
                </td>
                {showDrug && (
                  <td className={cn(tdClass, 'text-left max-w-[80px] truncate')}>{drug}</td>
                )}
                <td className={cn(tdClass, 'text-left max-w-[110px] truncate')}>
                  {latestReadingRx(snap.odReadings ?? [])}
                </td>
                <td className={cn(tdClass, 'text-left max-w-[110px] truncate')}>
                  {latestReadingRx(snap.osReadings ?? [])}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RetinoscopySectionRecordedRail({
  sectionId,
  wetData,
  dryData,
  subjectiveData,
  recordedAt,
  isEditing = false,
  canEdit = true,
  onEditOdReading,
  onDeleteOdReading,
  onEditOsReading,
  onDeleteOsReading,
  onEditSubjectiveReading,
  onDeleteSubjectiveReading,
  onMarkSubjectiveFinal,
  onEditDrug,
  onDeleteDrug,
  patientOptometryHistory = [],
  excludeVisitId,
  priorExaminationDate,
}: RetinoscopySectionRecordedRailProps) {
  const priorRows = getRetinoscopyPriorHistory(
    sectionId,
    patientOptometryHistory,
    excludeVisitId,
    PRIOR_VISITS_MAX,
  );

  const odReadings =
    sectionId === 'wet'
      ? (wetData?.odReadings ?? [])
      : sectionId === 'dry'
        ? (dryData?.odReadings ?? [])
        : [];
  const osReadings =
    sectionId === 'wet'
      ? (wetData?.osReadings ?? [])
      : sectionId === 'dry'
        ? (dryData?.osReadings ?? [])
        : [];
  const subjectiveReadings = sectionId === 'subjective' ? (subjectiveData?.readings ?? []) : [];

  const hasTodayReadings =
    sectionId === 'subjective'
      ? subjectiveReadings.length > 0
      : odReadings.length > 0 || osReadings.length > 0;

  const hasWetDrug = sectionId === 'wet' && Boolean(wetData?.drug);
  const showTodayPanel = hasTodayReadings || hasWetDrug;

  return (
    <div className="flex flex-col gap-3">
      {showTodayPanel && (
        <div
          className={cn(
            'rounded-xl border overflow-hidden shadow-sm',
            isEditing ? 'border-emerald-500 ring-2 ring-emerald-200/80' : 'border-slate-200',
          )}
        >
          <div
            className={cn(
              'px-3 py-2 border-b',
              isEditing
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-800 text-white border-slate-700',
            )}
          >
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 shrink-0 opacity-90" />
              {isEditing ? 'Editing today' : "Today's readings"}
            </p>
            {recordedAt && (
              <p
                className={cn(
                  'text-[10px] mt-0.5 truncate',
                  isEditing ? 'text-emerald-50' : 'text-slate-300',
                )}
              >
                Recorded {formatRecordedAt(recordedAt)}
              </p>
            )}
          </div>

          <div className="p-2.5 bg-slate-50/80 space-y-2 max-h-[min(70vh,520px)] overflow-y-auto">
            {sectionId === 'wet' && wetData && (
              <WetDrugStrip
                data={wetData}
                canEdit={canEdit}
                onEditDrug={onEditDrug}
                onDeleteDrug={onDeleteDrug}
              />
            )}

            {sectionId === 'subjective' ? (
              <SubjectiveTodayTable
                readings={subjectiveReadings}
                canEdit={canEdit}
                onEdit={onEditSubjectiveReading}
                onDelete={onDeleteSubjectiveReading}
                onMarkFinal={onMarkSubjectiveFinal}
              />
            ) : (
              <WetDryTodayTable
                odReadings={odReadings}
                osReadings={osReadings}
                canEdit={canEdit}
                onEditOd={onEditOdReading}
                onDeleteOd={onDeleteOdReading}
                onEditOs={onEditOsReading}
                onDeleteOs={onDeleteOsReading}
              />
            )}

            {!hasTodayReadings && sectionId !== 'wet' && (
              <p className="text-[11px] text-slate-500 text-center py-2">
                No readings added yet. Use the form on the left.
              </p>
            )}
          </div>
        </div>
      )}

      {!showTodayPanel && priorRows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
          <p className="text-xs text-slate-500">
            Enter values on the left, then Record section.
          </p>
        </div>
      )}

      {(priorExaminationDate || priorRows.length > 0) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
          {priorExaminationDate && (
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <CalendarClock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
              <span>
                <span className="font-medium text-slate-700">Immediate prior visit: </span>
                {priorExaminationDate}
              </span>
            </div>
          )}

          {priorRows.length > 0 && (
            <div className={priorExaminationDate ? 'pt-2 border-t border-slate-200' : ''}>
              <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 mb-2">
                <History className="w-3.5 h-3.5" />
                Prior visits (last {PRIOR_VISITS_MAX})
              </p>
              <PriorVisitsTable sectionId={sectionId} rows={priorRows} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
