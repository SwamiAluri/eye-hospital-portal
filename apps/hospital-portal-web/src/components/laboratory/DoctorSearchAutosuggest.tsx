'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  laboratoryCatalogApi,
  type LaboratoryOrderingClinicianDto,
} from '@/lib/api/laboratory-catalog.api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';

export type LaboratoryOrderingClinician = LaboratoryOrderingClinicianDto;

export interface DoctorSearchAutosuggestProps {
  value: LaboratoryOrderingClinician | null;
  onSelect: (doctor: LaboratoryOrderingClinician | null) => void;
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * PatientSearchAutosuggest-style ordering clinician picker.
 * Uses GET /laboratory/catalog/ordering-clinicians (patient.view).
 */
export function DoctorSearchAutosuggest({
  value,
  onSelect,
  disabled,
  'data-testid': testId = 'laboratory-doctor-search',
}: DoctorSearchAutosuggestProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 250);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [options, setOptions] = useState<LaboratoryOrderingClinician[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value) setTerm(value.fullName);
  }, [value]);

  useEffect(() => {
    if (value) {
      setOptions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const trimmed = debounced.trim();
    // Load eligible clinicians on open; search filters when 2+ chars.
    if (!open && trimmed.length < 2) {
      setOptions([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const search = trimmed.length >= 2 ? trimmed : undefined;
    void laboratoryCatalogApi
      .searchOrderingClinicians({ search, take: 20 })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.data) ? data.data : [];
        setOptions(rows);
        setActiveIndex(rows.length > 0 ? 0 : -1);
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setError('Could not search clinicians.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, value, open]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const queryReady = !value;
  const showDropdown = open && queryReady;

  const select = (doctor: LaboratoryOrderingClinician) => {
    onSelect(doctor);
    setTerm(doctor.fullName);
    setOpen(false);
  };

  const clear = () => {
    onSelect(null);
    setTerm('');
    setOpen(false);
    setOptions([]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown && event.key === 'ArrowDown' && options.length > 0) {
      setOpen(true);
      setActiveIndex(0);
      event.preventDefault();
      return;
    }
    if (!showDropdown) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0 && options[activeIndex]) {
      event.preventDefault();
      select(options[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0 w-full" data-testid={testId}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        role="combobox"
        aria-label="Search ordering clinician"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        value={term}
        onChange={(e) => {
          if (value) onSelect(null);
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search ordering clinician…"
        className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-16 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
        data-testid={`${testId}-input`}
      />
      {value && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
          onClick={clear}
          disabled={disabled}
        >
          Clear
        </button>
      )}

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[100] mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          data-testid={`${testId}-results`}
        >
          {loading && <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>}
          {error && (
            <li className="px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </li>
          )}
          {!loading && !error && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-600" role="status" data-testid={`${testId}-empty`}>
              <p className="font-medium text-gray-800">No doctors found</p>
              <p className="mt-0.5 text-xs text-gray-500">Try another name or license number.</p>
            </li>
          )}
          {!loading &&
            !error &&
            options.map((doctor, index) => (
              <li
                key={doctor.id}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'cursor-pointer border-b border-gray-50 px-3 py-2 text-sm last:border-0',
                  index === activeIndex ? 'bg-emerald-50' : 'hover:bg-gray-50',
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(doctor)}
                data-testid={`${testId}-option-${doctor.id}`}
              >
                <p className="font-medium text-gray-900">{doctor.fullName}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[doctor.specialization, doctor.department, doctor.licenseNumber]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
