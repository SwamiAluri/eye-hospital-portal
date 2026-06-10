'use client';

import { BilateralRow, BilateralTable } from './BilateralTable';
import { ExamSelectField } from './ExamSelectField';
import { RxCombobox } from './RxCombobox';
import {
  axisValues,
  cylinderValues,
  snellenValues,
  sphereValues,
} from './exam-rx-options';
import type { PriorVisitRxEye } from '@/lib/optometry/optometry-exam-types';

export type EyeRx = { sphere: string; cylinder: string; axis: string; va: string };

interface RxBilateralPrescriptionCardProps {
  variant: 'old' | 'new';
  rx: { OD: EyeRx; OS: EyeRx };
  priorOd?: PriorVisitRxEye;
  priorOs?: PriorVisitRxEye;
  canEdit: boolean;
  onChange: (eye: 'OD' | 'OS', field: keyof EyeRx, value: string) => void;
  powerChangeOd?: string;
  powerChangeOs?: string;
}

export function RxBilateralPrescriptionCard({
  variant,
  rx,
  priorOd,
  priorOs,
  canEdit,
  onChange,
  powerChangeOd,
  powerChangeOs,
}: RxBilateralPrescriptionCardProps) {
  const showLast = Boolean(priorOd || priorOs);
  const isNew = variant === 'new';

  const priorField = (eye: PriorVisitRxEye | undefined, key: keyof EyeRx) => {
    if (!eye || key === 'va') return undefined;
    if (key === 'sphere') return eye.sphere;
    if (key === 'cylinder') return eye.cylinder;
    return eye.axis;
  };

  const rxCell = (
    field: keyof EyeRx,
    eye: 'OD' | 'OS',
    value: string,
    prior?: string,
  ) =>
    field === 'va' ? (
      <ExamSelectField
        aria-label={`${field} ${eye}`}
        value={value}
        options={snellenValues}
        disabled={!canEdit}
        onChange={(v) => onChange(eye, field, v)}
      />
    ) : (
      <RxCombobox
        value={value}
        options={
          field === 'sphere' ? sphereValues : field === 'cylinder' ? cylinderValues : axisValues
        }
        disabled={!canEdit}
        onChange={(v) => onChange(eye, field, v)}
        priorValue={prior}
      />
    );

  const rows: { key: keyof EyeRx; label: string }[] = [
    { key: 'sphere', label: 'Sphere (D)' },
    { key: 'cylinder', label: 'Cylinder (D)' },
    { key: 'axis', label: 'Axis (°)' },
    { key: 'va', label: 'Visual Acuity' },
  ];

  return (
    <div
      className={`w-fit max-w-full rounded-lg border p-3 ${
        isNew ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'
      }`}
    >
      <BilateralTable showLastColumn={showLast && !isNew} className="va-rx-table">
        {rows.map(({ key, label }) => (
          <BilateralRow
            key={key}
            label={label}
            last={
              showLast && !isNew && key !== 'va'
                ? `${priorField(priorOd, key) ?? '—'} / ${priorField(priorOs, key) ?? '—'}`
                : undefined
            }
            od={rxCell(key, 'OD', rx.OD[key], priorField(priorOd, key))}
            os={rxCell(key, 'OS', rx.OS[key], priorField(priorOs, key))}
          />
        ))}
      </BilateralTable>
      {isNew && (powerChangeOd || powerChangeOs) && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 pt-2 mt-2 border-t border-emerald-200">
          {powerChangeOd && (
            <span>
              Δ OD: <strong className="text-emerald-700">{powerChangeOd}</strong>
            </span>
          )}
          {powerChangeOs && (
            <span>
              Δ OS: <strong className="text-emerald-700">{powerChangeOs}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
