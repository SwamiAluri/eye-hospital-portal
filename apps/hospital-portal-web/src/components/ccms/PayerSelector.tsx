'use client';

import React from 'react';
import { type InsurancePayer } from '../../lib/api/ccms/ccms-master-data.api';
import { useCcmsMasterData } from '@/hooks/use-ccms-case';

interface Props {
  value: string;
  onChange: (payerId: string, payer: InsurancePayer | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Fallback list used when the CCMS master-data endpoint is unavailable */
  fallbackPayers?: InsurancePayer[];
}

export function PayerSelector({
  value,
  onChange,
  placeholder = 'Select insurer / TPA…',
  disabled,
  className,
  fallbackPayers = [],
}: Props) {
  const { payers: cachedPayers, isLoading } = useCcmsMasterData();
  const payers = cachedPayers.length > 0 ? cachedPayers : fallbackPayers;
  const usedFallback = cachedPayers.length === 0 && fallbackPayers.length > 0;

  if (isLoading && payers.length === 0) {
    return (
      <select disabled className={`${className} opacity-50`}>
        <option>Loading payers…</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={e => {
        const selected = payers.find(p => p.id === e.target.value) ?? null;
        onChange(e.target.value, selected);
      }}
      disabled={disabled}
      className={className}
    >
      <option value="">{placeholder}</option>
      {payers.map(p => (
        <option key={p.id} value={p.id}>
          {p.name}{p.shortCode ? ` (${p.shortCode})` : ''}
        </option>
      ))}
      {usedFallback && payers.length > 0 && (
        <option disabled value="">── CCMS offline — showing local list ──</option>
      )}
    </select>
  );
}
