'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  searchPatientsUnified,
  type UnifiedPatientSearchHit,
} from '@/lib/patients/unified-patient-search';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { formatPatientLookupSubtitle } from '@/lib/patients/patient-disambiguation';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import { cn } from '@/lib/utils';

interface PatientSearchAutosuggestProps {
  branchId: string | null;
  value: string;
  onChange: (value: string) => void;
  onSelectPatient?: (patient: UnifiedPatientSearchHit) => void;
  className?: string;
}

export function PatientSearchAutosuggest({
  branchId,
  value,
  onChange,
  onSelectPatient,
  className,
}: PatientSearchAutosuggestProps) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [results, setResults] = useState<UnifiedPatientSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(value, 250);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!branchId || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void searchPatientsUnified(branchId, trimmed, 8)
      .then((rows) => {
        if (!cancelled) {
          setResults(rows);
          setActiveIndex(rows.length > 0 ? 0 : -1);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, debouncedQuery]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const queryReady = debouncedQuery.trim().length >= 2;
  const showDropdown = open && queryReady;

  const selectPatient = (patient: UnifiedPatientSearchHit) => {
    setOpen(false);
    if (onSelectPatient) {
      onSelectPatient(patient);
      return;
    }
    router.push(patientProfileUrl(patient.id));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown && event.key === 'ArrowDown' && results.length > 0) {
      setOpen(true);
      setActiveIndex(0);
      event.preventDefault();
      return;
    }

    if (!showDropdown) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      selectPatient(results[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative min-w-0 flex-1', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="search"
        role="combobox"
        aria-label="Search patients by name, MRN, phone, or email"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search name, MRN, phone, email…"
        title="Search name, MRN, phone, or email. Ctrl+K searches all categories."
        className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        data-testid={patientLookupTestIds.searchInput}
      />

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          data-testid={patientLookupTestIds.autosuggestList}
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-600" role="status">
              <p className="font-medium text-gray-800">No patients found</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Try another name, MRN, phone number, or email.
              </p>
            </li>
          )}
          {results.map((patient, index) => (
            <li
              key={patient.id}
              role="option"
              aria-selected={index === activeIndex}
              data-testid={patientLookupTestIds.autosuggestResult(patient.id)}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm border-b border-gray-50 last:border-0',
                index === activeIndex ? 'bg-emerald-50' : 'hover:bg-gray-50',
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectPatient(patient)}
            >
              <p className="font-medium text-gray-900">
                {patient.firstName} {patient.lastName}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatPatientLookupSubtitle(patient)}
              </p>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
