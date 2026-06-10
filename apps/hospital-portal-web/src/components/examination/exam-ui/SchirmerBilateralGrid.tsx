'use client';

import { BilateralRow, BilateralTable } from './BilateralTable';
import { ExamInput } from '../ExamCard';

interface SchirmerEye {
  measurement: string;
  time: string;
  interpretation: string;
}

interface SchirmerBilateralGridProps {
  od: SchirmerEye;
  os: SchirmerEye;
  canEdit: boolean;
  onChange: (eye: 'OD' | 'OS', field: 'measurement' | 'time', value: string) => void;
}

function InterpretationBadge({ text }: { text: string }) {
  if (!text) return null;
  const color =
    text === 'Normal'
      ? 'bg-green-50 text-green-700'
      : text === 'Mild Dry Eye'
        ? 'bg-yellow-50 text-yellow-700'
        : 'bg-red-50 text-red-700';
  return (
    <div className={`mt-1 px-2 py-1 rounded text-[10px] font-medium ${color}`}>
      {text}
      <p className="opacity-75 mt-0.5">
        {text === 'Normal' && '>10 mm'}
        {text === 'Mild Dry Eye' && '5–10 mm'}
        {text === 'Severe Dry Eye' && '<5 mm'}
      </p>
    </div>
  );
}

export function SchirmerBilateralGrid({
  od,
  os,
  canEdit,
  onChange,
}: SchirmerBilateralGridProps) {
  return (
    <BilateralTable className="mt-1">
      <BilateralRow
        label="Measurement (mm)"
        od={
          <div>
            <ExamInput
              type="number"
              step="1"
              value={od.measurement}
              disabled={!canEdit}
              className="dense !mb-0"
              onChange={(e) => onChange('OD', 'measurement', e.target.value)}
            />
            <InterpretationBadge text={od.interpretation} />
          </div>
        }
        os={
          <div>
            <ExamInput
              type="number"
              step="1"
              value={os.measurement}
              disabled={!canEdit}
              className="dense !mb-0"
              onChange={(e) => onChange('OS', 'measurement', e.target.value)}
            />
            <InterpretationBadge text={os.interpretation} />
          </div>
        }
      />
      <BilateralRow
        label="Duration (min)"
        od={
          <ExamInput
            type="number"
            step="1"
            value={od.time}
            disabled={!canEdit}
            className="dense !mb-0"
            onChange={(e) => onChange('OD', 'time', e.target.value)}
          />
        }
        os={
          <ExamInput
            type="number"
            step="1"
            value={os.time}
            disabled={!canEdit}
            className="dense !mb-0"
            onChange={(e) => onChange('OS', 'time', e.target.value)}
          />
        }
      />
    </BilateralTable>
  );
}
