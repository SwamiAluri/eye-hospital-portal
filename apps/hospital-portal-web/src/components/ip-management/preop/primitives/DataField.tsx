'use client';

import { useId } from 'react';
import { StatusChip } from './StatusChip';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';
import { WARD_PREOP_V2_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface DataFieldOption {
  value: string;
  label: string;
}

export interface DataFieldProps {
  /** Stable key for test IDs + label association. */
  fieldKey: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  /** Auto-save hook (e.g. on blur). */
  onCommit?: () => void;

  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;

  /** `text` | `numeric` data entry, or `select` from `options`. */
  inputType?: 'text' | 'numeric' | 'select';
  options?: DataFieldOption[];

  unit?: string;
  referenceRange?: string;

  /** Optional status chip shown beside the label. */
  status?: PreOpStatus;
  /** Provenance line, e.g. "Counsellor draft", "Auto-filled from demographics", "LIS/PACS". */
  source?: string;
  /** Verification timestamp string (read context). */
  verifiedAt?: string;

  className?: string;
}

/**
 * Reusable read/edit field for investigation results and clinical values.
 * One component adapts by `inputType` so we never repeat Result/Unit/Ref blocks
 * per investigation (blueprint §9, §14). Label is programmatically associated.
 */
export function DataField({
  fieldKey,
  label,
  value,
  onChange,
  onCommit,
  readOnly = false,
  required = false,
  placeholder,
  inputType = 'text',
  options = [],
  unit,
  referenceRange,
  status,
  source,
  verifiedAt,
  className = '',
}: DataFieldProps) {
  const inputId = `${useId()}-${fieldKey}`;

  return (
    <div className={`space-y-1 ${className}`} data-testid={WARD_PREOP_V2_TEST_IDS.dataField(fieldKey)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-gray-600">
          {label}
          {required && (
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {status && <StatusChip status={status} size="sm" />}
      </div>

      {readOnly ? (
        <p className="text-sm font-medium text-gray-900">
          {value?.trim() ? value : <span className="text-gray-400">—</span>}
          {value?.trim() && unit ? <span className="text-gray-500"> {unit}</span> : null}
        </p>
      ) : inputType === 'select' ? (
        <select
          id={inputId}
          data-testid={WARD_PREOP_V2_TEST_IDS.dataFieldInput(fieldKey)}
          value={value}
          required={required}
          onChange={e => onChange?.(e.target.value)}
          onBlur={onCommit}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">{placeholder ?? 'Select…'}</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            id={inputId}
            data-testid={WARD_PREOP_V2_TEST_IDS.dataFieldInput(fieldKey)}
            type="text"
            inputMode={inputType === 'numeric' ? 'decimal' : 'text'}
            value={value}
            required={required}
            placeholder={placeholder}
            aria-describedby={referenceRange ? `${inputId}-ref` : undefined}
            onChange={e => onChange?.(e.target.value)}
            onBlur={onCommit}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {unit && <span className="shrink-0 text-xs text-gray-500">{unit}</span>}
        </div>
      )}

      {(referenceRange || source || verifiedAt) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
          {referenceRange && (
            <span id={`${inputId}-ref`}>Ref: {referenceRange}</span>
          )}
          {source && <span>{source}</span>}
          {verifiedAt && <span>Verified {verifiedAt}</span>}
        </div>
      )}
    </div>
  );
}
