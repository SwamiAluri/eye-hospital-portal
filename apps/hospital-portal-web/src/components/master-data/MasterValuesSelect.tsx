'use client';

import { useMasterValues } from '@/hooks/use-master-values';
import { Loader2, AlertCircle } from 'lucide-react';

export interface MasterValuesSelectProps {
  entityType: string;
  value: string;
  onChange: (value: string) => void;
  /** Stored form value — code (default) or display label */
  optionValue?: 'code' | 'label';
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * F2.3 — Standard loading / error / empty states for master-driven dropdowns.
 */
export function MasterValuesSelect({
  entityType,
  value,
  onChange,
  optionValue = 'code',
  id,
  className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500',
  placeholder,
  disabled = false,
  required = false,
}: MasterValuesSelectProps) {
  const { options, loading, error } = useMasterValues(entityType);

  const emptyLabel =
    placeholder ??
    (loading
      ? 'Loading…'
      : error
        ? 'Failed to load options'
        : options.length === 0
          ? 'No options configured'
          : 'Select…');

  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading || error || options.length === 0}
        required={required}
        className={`${className} ${loading ? 'pr-9' : ''} disabled:opacity-60 disabled:cursor-not-allowed`}
        aria-busy={loading}
        aria-invalid={error}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={optionValue === 'label' ? o.label : o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {loading && (
        <Loader2
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin pointer-events-none"
          aria-hidden
        />
      )}
      {error && !loading && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Could not load master data. Check admin configuration.
        </p>
      )}
    </div>
  );
}
