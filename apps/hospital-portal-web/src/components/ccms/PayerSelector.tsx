'use client';

import React, { useEffect, useState } from 'react';
import { listInsurancePayers, type InsurancePayer } from '../../lib/api/ccms/ccms-master-data.api';

interface Props {
  value: string;
  onChange: (payerId: string, payer: InsurancePayer | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PayerSelector({ value, onChange, placeholder = 'Select payer…', disabled, className }: Props) {
  const [payers, setPayers] = useState<InsurancePayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    listInsurancePayers()
      .then(setPayers)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <select disabled className={`${className} opacity-50`}>
        <option>Loading payers…</option>
      </select>
    );
  }

  if (error) {
    return (
      <select disabled className={`${className} opacity-50`}>
        <option>Failed to load payers</option>
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
        <option key={p.id} value={p.id}>{p.name}{p.shortCode ? ` (${p.shortCode})` : ''}</option>
      ))}
    </select>
  );
}
