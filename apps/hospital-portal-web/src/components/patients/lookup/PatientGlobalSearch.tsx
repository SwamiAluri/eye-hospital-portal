'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { OmnisearchTabs } from '@/components/patients/lookup/OmnisearchTabs';
import { useBranchContext } from '@/hooks/use-branch-context';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { resolveOmniSearchHitPath } from '@/lib/patients/patient-omni-search-nav';
import { searchPatientOmni } from '@/lib/patients/patient-omni-search';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type {
  PatientOmniSearchHit,
  PatientOmniSearchScope,
} from '@/types/patient-omni-search';
import {
  omniSearchEmptyHint,
  omniSearchMinQueryLength,
  omniSearchPlaceholder,
} from '@/types/patient-omni-search';

export function PatientGlobalSearch() {
  const router = useRouter();
  const { branchId } = useBranchContext();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<PatientOmniSearchScope>('patients');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [results, setResults] = useState<PatientOmniSearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setScope('patients');
      setResults([]);
      return;
    }

    const trimmed = debouncedQuery.trim();
    const minLength = omniSearchMinQueryLength(scope);
    if (!branchId || (trimmed.length < minLength && scope !== 'care_programs')) {
      if (scope === 'care_programs' && !branchId) {
        setResults([]);
        return;
      }
      if (scope !== 'care_programs') {
        setResults([]);
        return;
      }
    }

    let cancelled = false;
    setLoading(true);
    void searchPatientOmni(branchId, scope, trimmed, 15)
      .then((rows) => {
        if (!cancelled) setResults(rows);
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
  }, [open, branchId, scope, debouncedQuery]);

  const navigateToHit = useCallback(
    (hit: PatientOmniSearchHit) => {
      setOpen(false);
      router.push(resolveOmniSearchHitPath(hit));
    },
    [router],
  );

  const trimmedQuery = debouncedQuery.trim();
  const minLength = omniSearchMinQueryLength(scope);
  const showEmptyHint = !loading && trimmedQuery.length < minLength && scope !== 'care_programs';
  const showNoResults =
    !loading &&
    !showEmptyHint &&
    results.length === 0 &&
    (scope === 'care_programs' || trimmedQuery.length >= minLength);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={patientLookupTestIds.omnisearchTrigger}
        className="hidden md:flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:border-emerald-300 hover:bg-white hover:text-gray-700 transition-colors"
        aria-label="Search patients and more (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        <span>Search…</span>
        <kbd className="ml-2 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
          Ctrl+K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          data-testid={patientLookupTestIds.omnisearchInput}
          placeholder={omniSearchPlaceholder(scope)}
          value={query}
          onValueChange={setQuery}
        />
        <OmnisearchTabs activeScope={scope} onScopeChange={setScope} />
        <CommandList data-testid={patientLookupTestIds.omnisearchList}>
          {loading && <CommandEmpty>Searching…</CommandEmpty>}
          {showEmptyHint && (
            <CommandEmpty data-testid={patientLookupTestIds.omnisearchEmpty}>
              {omniSearchEmptyHint(scope)}
            </CommandEmpty>
          )}
          {showNoResults && (
            <CommandEmpty data-testid={patientLookupTestIds.omnisearchEmpty}>
              No results in this category
            </CommandEmpty>
          )}
          {results.length > 0 && (
            <CommandGroup heading={omniSearchPlaceholder(scope).replace(/…$/, '')}>
              {results.map((hit) => (
                <CommandItem
                  key={`${scope}-${hit.id}`}
                  value={`${hit.title} ${hit.subtitle ?? ''} ${hit.meta ?? ''}`}
                  data-testid={patientLookupTestIds.omnisearchResult(hit.id)}
                  onSelect={() => navigateToHit(hit)}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-gray-900">{hit.title}</span>
                    {(hit.subtitle || hit.meta) && (
                      <span className="truncate text-xs text-gray-500">
                        {[hit.subtitle, hit.meta].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
