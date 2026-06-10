'use client';

import { ExamSelect } from '@/components/examination/ExamCard';
import type { RetinoscopyNewReadingForm } from '@/lib/optometry/retinoscopy-reading-form';
import {
  RETINOSCOPY_WORKING_DISTANCE_OPTIONS,
  retinoscopyAxisOptions,
  retinoscopyCylinderOptions,
  retinoscopySphereOptions,
} from '@/lib/optometry/retinoscopy-form-options';
import { cn } from '@/lib/utils';

interface RetinoscopyNewReadingColumnProps {
  eyeTitle: string;
  variant: 'od' | 'os';
  form: RetinoscopyNewReadingForm;
  onChange: (next: RetinoscopyNewReadingForm) => void;
  canEdit: boolean;
}

export function RetinoscopyNewReadingColumn({
  eyeTitle,
  variant,
  form,
  onChange,
  canEdit,
}: RetinoscopyNewReadingColumnProps) {
  const boxClass =
    variant === 'od'
      ? 'bg-blue-50 border-blue-200'
      : 'bg-emerald-50 border-emerald-200';

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900">{eyeTitle}</h4>
      <div className={cn('p-3 rounded-lg border', boxClass)}>
        <p className="text-xs font-semibold text-gray-600 mb-2">New Reading</p>
        <div className="space-y-2">
          <ExamSelect
            label="Working Distance"
            value={form.workingDistance}
            onChange={(value) => onChange({ ...form, workingDistance: value })}
            options={RETINOSCOPY_WORKING_DISTANCE_OPTIONS}
            disabled={!canEdit}
          />
          <ExamSelect
            label="Sphere (D)"
            value={form.sphere}
            onChange={(value) => onChange({ ...form, sphere: value })}
            options={retinoscopySphereOptions()}
            disabled={!canEdit}
          />
          <ExamSelect
            label="Cylinder (D)"
            value={form.cylinder}
            onChange={(value) =>
              onChange({
                ...form,
                cylinder: value,
                axis: value ? form.axis : '',
              })
            }
            options={retinoscopyCylinderOptions()}
            disabled={!canEdit}
          />
          <ExamSelect
            label="Axis (°)"
            value={form.axis}
            onChange={(value) => onChange({ ...form, axis: value })}
            options={retinoscopyAxisOptions()}
            disabled={!canEdit || !form.cylinder}
          />
        </div>
      </div>
    </div>
  );
}
