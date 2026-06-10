'use client';

import { BilateralRow, BilateralSectionHeader, BilateralTable } from './BilateralTable';
import { ExamInput } from '../ExamCard';

interface EyeIop {
  value: string;
  time: string;
}

interface IopMeasurementGridProps {
  title: string;
  od: EyeIop;
  os: EyeIop;
  priorOd?: string | number;
  priorOs?: string | number;
  canEdit: boolean;
  onChange: (eye: 'OD' | 'OS', field: 'value' | 'time', value: string) => void;
  getIOPStatus: (value: string) => { text: string; color: string };
}

export function IopMeasurementGrid({
  title,
  od,
  os,
  priorOd,
  priorOs,
  canEdit,
  onChange,
  getIOPStatus,
}: IopMeasurementGridProps) {
  const showLast = priorOd != null || priorOs != null;

  return (
    <div className="mb-4">
      <BilateralSectionHeader title={title} />
      <BilateralTable showLastColumn={showLast} className="mt-1">
        <BilateralRow
          label="IOP Value (mmHg)"
          last={showLast ? `${priorOd ?? '—'} / ${priorOs ?? '—'}` : undefined}
          od={
            <div>
              <ExamInput
                type="number"
                step="0.1"
                value={od.value}
                disabled={!canEdit}
                className="dense !mb-0"
                onChange={(e) => onChange('OD', 'value', e.target.value)}
              />
              {od.value && (
                <div className={`mt-0.5 px-1 py-0.5 rounded text-[10px] font-medium ${getIOPStatus(od.value).color}`}>
                  {getIOPStatus(od.value).text}
                </div>
              )}
            </div>
          }
          os={
            <div>
              <ExamInput
                type="number"
                step="0.1"
                value={os.value}
                disabled={!canEdit}
                className="dense !mb-0"
                onChange={(e) => onChange('OS', 'value', e.target.value)}
              />
              {os.value && (
                <div className={`mt-0.5 px-1 py-0.5 rounded text-[10px] font-medium ${getIOPStatus(os.value).color}`}>
                  {getIOPStatus(os.value).text}
                </div>
              )}
            </div>
          }
        />
        <BilateralRow
          label="Time"
          od={
            <ExamInput
              type="time"
              value={od.time}
              disabled={!canEdit}
              className="dense !mb-0"
              onChange={(e) => onChange('OD', 'time', e.target.value)}
            />
          }
          os={
            <ExamInput
              type="time"
              value={os.time}
              disabled={!canEdit}
              className="dense !mb-0"
              onChange={(e) => onChange('OS', 'time', e.target.value)}
            />
          }
        />
      </BilateralTable>
    </div>
  );
}
