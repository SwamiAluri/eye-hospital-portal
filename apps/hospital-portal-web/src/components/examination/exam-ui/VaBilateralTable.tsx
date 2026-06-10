'use client';

import { BilateralRow, BilateralTable } from './BilateralTable';
import { ExamSelectField } from './ExamSelectField';
import { nearVAValues, snellenValues } from './exam-rx-options';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';

interface VaEye {
  unaided: string;
  aided: string;
}

interface VaBilateralTableProps {
  distanceVision: { OD: VaEye; OS: VaEye };
  nearVision: { OD: VaEye; OS: VaEye };
  priorVisit?: PriorVisitSnapshot | null;
  canEdit: boolean;
  onDistanceChange: (eye: 'OD' | 'OS', field: 'unaided' | 'aided', value: string) => void;
  onNearChange: (eye: 'OD' | 'OS', field: 'unaided' | 'aided', value: string) => void;
}

function vaSelect(
  value: string,
  options: string[],
  disabled: boolean,
  onChange: (v: string) => void,
  label: string,
) {
  return (
    <ExamSelectField
      aria-label={label}
      value={value}
      options={options}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

export function VaBilateralTable({
  distanceVision,
  nearVision,
  priorVisit,
  canEdit,
  onDistanceChange,
  onNearChange,
}: VaBilateralTableProps) {
  const showLast = Boolean(priorVisit?.visualAcuity);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold text-gray-800 mb-2">Distance Vision</h4>
        <BilateralTable showLastColumn={showLast}>
          <BilateralRow
            label="Unaided"
            last={priorVisit?.visualAcuity?.distanceOD}
            od={vaSelect(
              distanceVision.OD.unaided,
              snellenValues,
              !canEdit,
              (v) => onDistanceChange('OD', 'unaided', v),
              'Distance unaided OD',
            )}
            os={vaSelect(
              distanceVision.OS.unaided,
              snellenValues,
              !canEdit,
              (v) => onDistanceChange('OS', 'unaided', v),
              'Distance unaided OS',
            )}
          />
          <BilateralRow
            label="Aided (Corrected)"
            od={vaSelect(
              distanceVision.OD.aided,
              snellenValues,
              !canEdit,
              (v) => onDistanceChange('OD', 'aided', v),
              'Distance aided OD',
            )}
            os={vaSelect(
              distanceVision.OS.aided,
              snellenValues,
              !canEdit,
              (v) => onDistanceChange('OS', 'aided', v),
              'Distance aided OS',
            )}
          />
        </BilateralTable>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-gray-800 mb-2">Near Vision</h4>
        <BilateralTable showLastColumn={showLast}>
          <BilateralRow
            label="Unaided"
            last={priorVisit?.visualAcuity?.nearOD}
            od={vaSelect(
              nearVision.OD.unaided,
              nearVAValues,
              !canEdit,
              (v) => onNearChange('OD', 'unaided', v),
              'Near unaided OD',
            )}
            os={vaSelect(
              nearVision.OS.unaided,
              nearVAValues,
              !canEdit,
              (v) => onNearChange('OS', 'unaided', v),
              'Near unaided OS',
            )}
          />
          <BilateralRow
            label="Aided (Corrected)"
            od={vaSelect(
              nearVision.OD.aided,
              nearVAValues,
              !canEdit,
              (v) => onNearChange('OD', 'aided', v),
              'Near aided OD',
            )}
            os={vaSelect(
              nearVision.OS.aided,
              nearVAValues,
              !canEdit,
              (v) => onNearChange('OS', 'aided', v),
              'Near aided OS',
            )}
          />
        </BilateralTable>
      </div>
    </div>
  );
}
