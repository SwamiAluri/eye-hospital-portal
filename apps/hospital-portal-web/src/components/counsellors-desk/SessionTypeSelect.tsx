'use client';

import { useMemo } from 'react';
import { useCounsellorMasterOptions } from '@/hooks/use-counsellor-master-options';
import { defaultSessionTypeCode } from '@/lib/counsellors-desk/counsellor-master-maps';

const FALLBACK_SESSION_TYPES = [
  { value: 'INITIAL', label: 'Initial Counseling' },
  { value: 'FOLLOW_UP', label: 'Follow-Up' },
  { value: 'PRE_OP', label: 'Pre-Op Counseling' },
  { value: 'POST_OP', label: 'Post-Op Counseling' },
  { value: 'PACKAGE', label: 'Package Finalization' },
];

interface SessionTypeSelectProps {
  value: string;
  onChange: (code: string) => void;
  /** Default when value is empty */
  context?: 'new' | 'repeat' | 'requeue';
  label?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function SessionTypeSelect({
  value,
  onChange,
  context = 'new',
  label = 'Session Type',
  className = '',
  disabled = false,
  id,
}: SessionTypeSelectProps) {
  const { sessionTypeOptions, sessionTypeLoading } = useCounsellorMasterOptions();

  const choices = useMemo(
    () => (sessionTypeOptions.length > 0 ? sessionTypeOptions : FALLBACK_SESSION_TYPES),
    [sessionTypeOptions],
  );

  const resolvedValue = value || defaultSessionTypeCode(context);

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <select
        id={id}
        value={resolvedValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || sessionTypeLoading}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
      >
        {choices.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
