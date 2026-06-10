'use client';

import { BilateralRow, BilateralTable } from './BilateralTable';
import { RxCombobox } from './RxCombobox';
import { axisValues, cylinderValues, sphereValues } from './exam-rx-options';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';

interface RefractionBilateralTableProps {
  refraction: { OD: { sphere: string; cylinder: string; axis: string }; OS: { sphere: string; cylinder: string; axis: string } };
  priorVisit?: PriorVisitSnapshot | null;
  canEdit: boolean;
  onChange: (eye: 'OD' | 'OS', field: 'sphere' | 'cylinder' | 'axis', value: string) => void;
}

export function RefractionBilateralTable({
  refraction,
  priorVisit,
  canEdit,
  onChange,
}: RefractionBilateralTableProps) {
  const priorOd = priorVisit?.refraction?.finalRxOD;
  const priorOs = priorVisit?.refraction?.finalRxOS;
  const showLast = Boolean(priorOd || priorOs);

  return (
    <BilateralTable showLastColumn={showLast}>
      <BilateralRow
        label="Sphere (D)"
        last={priorOd?.sphere}
        od={
          <RxCombobox
            value={refraction.OD.sphere}
            options={sphereValues}
            disabled={!canEdit}
            onChange={(v) => onChange('OD', 'sphere', v)}
            priorValue={priorOd?.sphere}
          />
        }
        os={
          <RxCombobox
            value={refraction.OS.sphere}
            options={sphereValues}
            disabled={!canEdit}
            onChange={(v) => onChange('OS', 'sphere', v)}
            priorValue={priorOs?.sphere}
          />
        }
      />
      <BilateralRow
        label="Cylinder (D)"
        last={priorOd?.cylinder}
        od={
          <RxCombobox
            value={refraction.OD.cylinder}
            options={cylinderValues}
            disabled={!canEdit}
            onChange={(v) => onChange('OD', 'cylinder', v)}
          />
        }
        os={
          <RxCombobox
            value={refraction.OS.cylinder}
            options={cylinderValues}
            disabled={!canEdit}
            onChange={(v) => onChange('OS', 'cylinder', v)}
          />
        }
      />
      <BilateralRow
        label="Axis (°)"
        last={priorOd?.axis}
        od={
          <RxCombobox
            value={refraction.OD.axis}
            options={axisValues}
            disabled={!canEdit}
            onChange={(v) => onChange('OD', 'axis', v)}
          />
        }
        os={
          <RxCombobox
            value={refraction.OS.axis}
            options={axisValues}
            disabled={!canEdit}
            onChange={(v) => onChange('OS', 'axis', v)}
          />
        }
      />
    </BilateralTable>
  );
}
