'use client';

import { BilateralRow, BilateralTable } from './BilateralTable';
import { CompactSelect } from './CompactSelect';
import { ExamInput } from '../ExamCard';

export interface VisualFieldEyeState {
  testType: string;
  md: string;
  psd: string;
  reliability: string;
  defects: string;
}

interface VisualFieldBilateralTableProps {
  od: VisualFieldEyeState;
  os: VisualFieldEyeState;
  canEdit: boolean;
  onChange: (eye: 'OD' | 'OS', patch: Partial<VisualFieldEyeState>) => void;
}

const testTypeOptions = [
  { value: 'Confrontation', label: 'Confrontation' },
  { value: 'Automated Perimetry', label: 'Automated Perimetry' },
];

const reliabilityOptions = [
  { value: 'Excellent', label: 'Excellent' },
  { value: 'Good', label: 'Good' },
  { value: 'Fair', label: 'Fair' },
  { value: 'Poor', label: 'Poor' },
];

export function VisualFieldBilateralTable({
  od,
  os,
  canEdit,
  onChange,
}: VisualFieldBilateralTableProps) {
  return (
    <BilateralTable className="mt-1">
      <BilateralRow
        label="Test type"
        od={
          <CompactSelect
            value={od.testType}
            disabled={!canEdit}
            onChange={(v) => onChange('OD', { testType: v })}
          >
            {testTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </CompactSelect>
        }
        os={
          <CompactSelect
            value={os.testType}
            disabled={!canEdit}
            onChange={(v) => onChange('OS', { testType: v })}
          >
            {testTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </CompactSelect>
        }
      />
      {(od.testType === 'Automated Perimetry' || os.testType === 'Automated Perimetry') && (
        <>
          <BilateralRow
            label="MD (dB)"
            od={
              od.testType === 'Automated Perimetry' ? (
                <ExamInput
                  type="number"
                  step="0.01"
                  value={od.md}
                  disabled={!canEdit}
                  className="dense !mb-0"
                  onChange={(e) => onChange('OD', { md: e.target.value })}
                />
              ) : (
                <span className="text-[11px] text-slate-400">—</span>
              )
            }
            os={
              os.testType === 'Automated Perimetry' ? (
                <ExamInput
                  type="number"
                  step="0.01"
                  value={os.md}
                  disabled={!canEdit}
                  className="dense !mb-0"
                  onChange={(e) => onChange('OS', { md: e.target.value })}
                />
              ) : (
                <span className="text-[11px] text-slate-400">—</span>
              )
            }
          />
          <BilateralRow
            label="PSD (dB)"
            od={
              od.testType === 'Automated Perimetry' ? (
                <ExamInput
                  type="number"
                  step="0.01"
                  value={od.psd}
                  disabled={!canEdit}
                  className="dense !mb-0"
                  onChange={(e) => onChange('OD', { psd: e.target.value })}
                />
              ) : (
                <span className="text-[11px] text-slate-400">—</span>
              )
            }
            os={
              os.testType === 'Automated Perimetry' ? (
                <ExamInput
                  type="number"
                  step="0.01"
                  value={os.psd}
                  disabled={!canEdit}
                  className="dense !mb-0"
                  onChange={(e) => onChange('OS', { psd: e.target.value })}
                />
              ) : (
                <span className="text-[11px] text-slate-400">—</span>
              )
            }
          />
        </>
      )}
      <BilateralRow
        label="Reliability"
        od={
          <CompactSelect
            value={od.reliability}
            disabled={!canEdit}
            onChange={(v) => onChange('OD', { reliability: v })}
          >
            {reliabilityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </CompactSelect>
        }
        os={
          <CompactSelect
            value={os.reliability}
            disabled={!canEdit}
            onChange={(v) => onChange('OS', { reliability: v })}
          >
            {reliabilityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </CompactSelect>
        }
      />
      <BilateralRow
        label="Field defects"
        od={
          <textarea
            value={od.defects}
            disabled={!canEdit}
            rows={2}
            onChange={(e) => onChange('OD', { defects: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
          />
        }
        os={
          <textarea
            value={os.defects}
            disabled={!canEdit}
            rows={2}
            onChange={(e) => onChange('OS', { defects: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
          />
        }
      />
    </BilateralTable>
  );
}
