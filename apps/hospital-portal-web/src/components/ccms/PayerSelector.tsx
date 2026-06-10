'use client';

import React from 'react';
import { type InsurancePayer } from '../../lib/api/ccms/ccms-master-data.api';
import { useCcmsAlignedPayers } from '@/hooks/use-ccms-case';

interface Props {
  value: string;
  onChange: (payerId: string, payer: InsurancePayer | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When true, only payers with a CCMS row are listed (default). */
  configuredOnly?: boolean;
}

export function PayerSelector({
  value,
  onChange,
  placeholder = 'Select insurer…',
  disabled,
  className,
  configuredOnly = true,
}: Props) {
  const { aligned, selectable, isLoading } = useCcmsAlignedPayers();
  const options = configuredOnly ? selectable : aligned;

  if (isLoading && options.length === 0) {
    return (
      <select disabled className={`${className} opacity-50`}>
        <option>Loading payers…</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        const entry = options.find((p) => p.ccmsId === e.target.value) ?? null;
        onChange(e.target.value, entry?.ccmsPayer ?? null);
      }}
      disabled={disabled || options.length === 0}
      className={className}
    >
      <option value="">{options.length === 0 ? 'No insurers configured' : placeholder}</option>
      {options.map((p) => (
        <option
          key={p.providerCode}
          value={p.ccmsId ?? ''}
          disabled={!p.selectable}
        >
          {p.name}
          {p.ccmsPayer?.shortCode ? ` (${p.ccmsPayer.shortCode})` : ''}
          {!p.selectable ? ' — not configured in CCMS' : ''}
        </option>
      ))}
    </select>
  );
}
