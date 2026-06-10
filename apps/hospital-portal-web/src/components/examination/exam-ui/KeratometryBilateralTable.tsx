'use client';

import { BilateralRow, BilateralTable } from './BilateralTable';
import { RxCombobox } from './RxCombobox';
import { axisValues, keratometryKValues } from './exam-rx-options';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';

interface KEye {
  k1: string;
  k2: string;
  axis: string;
}

interface KeratometryBilateralTableProps {
  keratometry: { OD: KEye; OS: KEye };
  priorVisit?: PriorVisitSnapshot | null;
  canEdit: boolean;
  onChange: (eye: 'OD' | 'OS', field: keyof KEye, value: string) => void;
  calculateAverageK: (k1: string, k2: string) => string;
  calculateAstigmatism: (k1: string, k2: string) => string;
}

export function KeratometryBilateralTable({
  keratometry,
  priorVisit,
  canEdit,
  onChange,
  calculateAverageK,
  calculateAstigmatism,
}: KeratometryBilateralTableProps) {
  const showLast = Boolean(priorVisit?.keratometry);

  return (
    <div className="space-y-2">
      <BilateralTable showLastColumn={showLast}>
        <BilateralRow
          label="K1 - Flat (D)"
          last={priorVisit?.keratometry?.od?.k1}
          od={
            <RxCombobox
              value={keratometry.OD.k1}
              options={keratometryKValues}
              disabled={!canEdit}
              onChange={(v) => onChange('OD', 'k1', v)}
              priorValue={priorVisit?.keratometry?.od?.k1}
            />
          }
          os={
            <RxCombobox
              value={keratometry.OS.k1}
              options={keratometryKValues}
              disabled={!canEdit}
              onChange={(v) => onChange('OS', 'k1', v)}
              priorValue={priorVisit?.keratometry?.os?.k1}
            />
          }
        />
        <BilateralRow
          label="K2 - Steep (D)"
          last={priorVisit?.keratometry?.od?.k2}
          od={
            <RxCombobox
              value={keratometry.OD.k2}
              options={keratometryKValues}
              disabled={!canEdit}
              onChange={(v) => onChange('OD', 'k2', v)}
            />
          }
          os={
            <RxCombobox
              value={keratometry.OS.k2}
              options={keratometryKValues}
              disabled={!canEdit}
              onChange={(v) => onChange('OS', 'k2', v)}
            />
          }
        />
        <BilateralRow
          label="Axis (°)"
          od={
            <RxCombobox
              value={keratometry.OD.axis}
              options={axisValues}
              disabled={!canEdit}
              onChange={(v) => onChange('OD', 'axis', v)}
            />
          }
          os={
            <RxCombobox
              value={keratometry.OS.axis}
              options={axisValues}
              disabled={!canEdit}
              onChange={(v) => onChange('OS', 'axis', v)}
            />
          }
        />
        <BilateralRow
          label="Average K (D)"
          od={
            <span className="text-xs font-mono text-blue-800 px-1">
              {keratometry.OD.k1 && keratometry.OD.k2
                ? calculateAverageK(keratometry.OD.k1, keratometry.OD.k2)
                : '—'}
            </span>
          }
          os={
            <span className="text-xs font-mono text-emerald-800 px-1">
              {keratometry.OS.k1 && keratometry.OS.k2
                ? calculateAverageK(keratometry.OS.k1, keratometry.OS.k2)
                : '—'}
            </span>
          }
        />
        <BilateralRow
          label="Astigmatism (D)"
          od={
            <span className="text-xs font-mono text-blue-800 px-1">
              {keratometry.OD.k1 && keratometry.OD.k2
                ? calculateAstigmatism(keratometry.OD.k1, keratometry.OD.k2)
                : '—'}
            </span>
          }
          os={
            <span className="text-xs font-mono text-emerald-800 px-1">
              {keratometry.OS.k1 && keratometry.OS.k2
                ? calculateAstigmatism(keratometry.OS.k1, keratometry.OS.k2)
                : '—'}
            </span>
          }
        />
      </BilateralTable>
    </div>
  );
}
