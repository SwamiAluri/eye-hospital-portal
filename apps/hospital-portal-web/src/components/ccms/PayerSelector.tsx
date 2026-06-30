'use client';

import React, { useMemo } from 'react';
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
  /** Counselling master-data insurers when CCMS list is empty or loading. */
  fallbackPayers?: InsurancePayer[];
}

export function PayerSelector({
  value,
  onChange,
  placeholder = 'Select insurer…',
  disabled,
  className,
  configuredOnly = true,
  fallbackPayers = [],
}: Props) {
  const { aligned, selectable, isLoading } = useCcmsAlignedPayers();
  const ccmsOptions = configuredOnly ? selectable : aligned;

  const options = useMemo(() => {
    const merged = [...ccmsOptions];
    for (const fb of fallbackPayers) {
      const id = fb.id?.trim();
      if (!id) continue;
      if (merged.some((p) => p.ccmsId === id || p.providerCode === id)) continue;
      merged.push({
        providerCode: fb.providerCode ?? id,
        name: fb.name,
        ccmsId: id,
        selectable: true,
        ccmsPayer: fb,
      });
    }
    if (value && !merged.some((p) => p.ccmsId === value)) {
      const label =
        fallbackPayers.find((p) => p.id === value)?.name ??
        ccmsOptions.find((p) => p.ccmsId === value)?.name ??
        value;
      merged.unshift({
        providerCode: value,
        name: label,
        ccmsId: value,
        selectable: true,
        ccmsPayer: fallbackPayers.find((p) => p.id === value) ?? null,
      });
    }
    return merged;
  }, [ccmsOptions, fallbackPayers, value]);

  if (isLoading && options.length === 0) {
    return (
      <select disabled className={`${className} opacity-50`}>
        <option>Loading…</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        const id = e.target.value;
        const entry = options.find((p) => p.ccmsId === id) ?? null;
        onChange(id, entry?.ccmsPayer ?? fallbackPayers.find((p) => p.id === id) ?? null);
      }}
      disabled={disabled || options.length === 0}
      className={className}
    >
      <option value="">{options.length === 0 ? 'No insurers configured' : placeholder}</option>
      {options.map((p) => (
        <option
          key={`${p.providerCode}-${p.ccmsId}`}
          value={p.ccmsId ?? ''}
          disabled={!p.selectable}
        >
          {p.name}
          {p.ccmsPayer?.shortCode ? ` (${p.ccmsPayer.shortCode})` : ''}
        </option>
      ))}
    </select>
  );
}
