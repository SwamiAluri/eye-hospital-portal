'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, User, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useBranchContext } from '@/hooks/use-branch-context';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  searchPatientsUnified,
  type UnifiedPatientSearchHit,
} from '@/lib/patients/unified-patient-search';
import { useClinicalStore } from '@/lib/stores/clinical-store';

interface PatientSearchSelectorProps {
  onPatientSelect?: (patientId: string) => void;
  /** @deprecated Use onPatientSelect */
  onSelect?: (patientId: string) => void;
  currentPath?: string;
}

export default function PatientSearchSelector({
  onPatientSelect,
  onSelect,
  currentPath,
}: PatientSearchSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const resolvedPath = currentPath ?? pathname ?? '/dashboard';
  const { branchId } = useBranchContext();
  const { setCurrentPatient } = useClinicalStore();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const [results, setResults] = useState<UnifiedPatientSearchHit[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!branchId || trimmed.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void searchPatientsUnified(branchId, trimmed, 20)
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, debouncedQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setShowDropdown(true);
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPatient = useCallback(
    (patient: UnifiedPatientSearchHit) => {
      setSearchQuery(`${patient.firstName} ${patient.lastName} (${patient.mrn})`);
      setShowDropdown(false);

      setCurrentPatient({
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        medicalRecordNumber: patient.mrn,
        patientCode: patient.mrn,
        dateOfBirth: patient.dateOfBirth,
        phone: patient.phone ?? undefined,
        email: patient.email ?? undefined,
      } as never);

      const callback = onPatientSelect ?? onSelect;
      if (callback) {
        callback(patient.id);
      } else {
        router.push(`${resolvedPath}?patientId=${patient.id}`);
      }
    },
    [onPatientSelect, onSelect, resolvedPath, router, setCurrentPatient],
  );

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery && setShowDropdown(true)}
          placeholder="Search patient by name, MRN, or phone…"
          className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600" />
          </div>
        )}
        {searchQuery && !isLoading && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            aria-label="Clear search"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {showDropdown && !isLoading && (
        <>
          {results.length > 0 ? (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
              <ul className="py-1">
                {results.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full px-4 py-3 hover:bg-gray-50 flex items-start text-left transition-colors"
                    >
                      <User className="h-5 w-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">
                          {patient.firstName} {patient.lastName}
                        </div>
                        <div className="text-sm text-gray-600 space-y-0.5">
                          <div>MRN: {patient.mrn}</div>
                          {patient.dateOfBirth && (
                            <div>DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</div>
                          )}
                          {patient.phone && <div>Phone: {patient.phone}</div>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : searchQuery.trim().length >= 2 ? (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
              No patients found matching &quot;{searchQuery}&quot;
            </div>
          ) : searchQuery.trim().length > 0 ? (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
              Type at least 2 characters to search
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
