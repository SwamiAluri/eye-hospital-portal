'use client';

import { ExamSelectField } from './ExamSelectField';
import { BilateralRow } from './BilateralTable';

interface BilateralSelectRowProps {
  label: string;
  options: string[];
  odValue: string;
  osValue: string;
  onOdChange: (v: string) => void;
  onOsChange: (v: string) => void;
  disabled?: boolean;
  priorOd?: string;
  priorOs?: string;
  /** Prior visit summary for the Last column (when table uses showLastColumn). */
  lastColumn?: string;
  abnormalOd?: boolean;
  abnormalOs?: boolean;
}

export function BilateralSelectRow({
  label,
  options,
  odValue,
  osValue,
  onOdChange,
  onOsChange,
  disabled,
  priorOd,
  priorOs,
  lastColumn,
  abnormalOd,
  abnormalOs,
}: BilateralSelectRowProps) {
  const last =
    lastColumn ??
    (priorOd || priorOs ? `${priorOd ?? '—'} / ${priorOs ?? '—'}` : undefined);

  return (
    <BilateralRow
      label={label}
      last={last}
      od={
        <div className={abnormalOd ? 'ring-1 ring-amber-300 rounded-md' : ''}>
          <ExamSelectField
            value={odValue}
            options={options}
            onChange={onOdChange}
            disabled={disabled}
            priorValue={priorOd}
            aria-label={`${label} OD`}
          />
        </div>
      }
      os={
        <div className={abnormalOs ? 'ring-1 ring-amber-300 rounded-md' : ''}>
          <ExamSelectField
            value={osValue}
            options={options}
            onChange={onOsChange}
            disabled={disabled}
            priorValue={priorOs}
            aria-label={`${label} OS`}
          />
        </div>
      }
    />
  );
}
