'use client';

import { BilateralRow, BilateralTable } from './BilateralTable';
import { ExamInput } from '../ExamCard';

interface PachymetryEye {
  cct: string;
  correctedIOP: string;
}

interface PachymetryBilateralTableProps {
  od: PachymetryEye;
  os: PachymetryEye;
  canEdit: boolean;
  onCctChange: (eye: 'OD' | 'OS', cct: string) => void;
  correctionSourceNote?: string;
}

export function PachymetryBilateralTable({
  od,
  os,
  canEdit,
  onCctChange,
  correctionSourceNote,
}: PachymetryBilateralTableProps) {
  return (
    <div>
    <BilateralTable className="mt-1">
      <BilateralRow
        label="CCT (μm)"
        od={
          <ExamInput
            type="number"
            step="1"
            value={od.cct}
            disabled={!canEdit}
            className="dense !mb-0"
            onChange={(e) => onCctChange('OD', e.target.value)}
          />
        }
        os={
          <ExamInput
            type="number"
            step="1"
            value={os.cct}
            disabled={!canEdit}
            className="dense !mb-0"
            onChange={(e) => onCctChange('OS', e.target.value)}
          />
        }
      />
      <BilateralRow
        label="Corrected IOP"
        od={
          od.cct ? (
            <div className="px-2 py-1 bg-blue-50 rounded text-xs">
              <span className="font-bold text-blue-700 tabular-nums">{od.correctedIOP}</span>
              <span className="text-gray-600 ml-1">mmHg</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )
        }
        os={
          os.cct ? (
            <div className="px-2 py-1 bg-blue-50 rounded text-xs">
              <span className="font-bold text-blue-700 tabular-nums">{os.correctedIOP}</span>
              <span className="text-gray-600 ml-1">mmHg</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )
        }
      />
    </BilateralTable>
    {correctionSourceNote && (
      <p className="text-[11px] text-slate-500 mt-2">{correctionSourceNote}</p>
    )}
    </div>
  );
}
