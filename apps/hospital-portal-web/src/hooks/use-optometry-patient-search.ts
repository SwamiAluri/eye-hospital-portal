'use client';

import { useEffect, useState } from 'react';
import {
  searchDirectoryPatients,
  type DirectoryPatientRow,
} from '@/lib/optometry/optometry-patient-search';

const DEBOUNCE_MS = 500;
const MIN_CHARS = 2;

function resolveSearchError(err: unknown): string {
  const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (status === 403) return message ?? 'You do not have permission to search patients';
  if (status === 401) return 'Session expired — please sign in again';
  return message ?? 'Patient search failed';
}

export function useOptometryPatientSearch(branchId: string | undefined, searchTerm: string) {
  const [directoryResults, setDirectoryResults] = useState<DirectoryPatientRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const trimmed = searchTerm.trim();
  const isActive = trimmed.length >= MIN_CHARS && !!branchId;

  useEffect(() => {
    if (!isActive) {
      setDirectoryResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsSearching(true);
      setSearchError(null);
      void searchDirectoryPatients(branchId!, trimmed)
        .then((rows) => {
          if (!cancelled) setDirectoryResults(rows);
        })
        .catch((err) => {
          if (!cancelled) {
            setDirectoryResults([]);
            setSearchError(resolveSearchError(err));
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [branchId, trimmed, isActive]);

  return { directoryResults, isSearching, searchError, isActive, minChars: MIN_CHARS };
}
