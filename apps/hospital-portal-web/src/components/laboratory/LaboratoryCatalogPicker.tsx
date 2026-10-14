'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  laboratoryCatalogApi,
  type LaboratoryPanelDetailDto,
  type LaboratoryPanelSummaryDto,
  type LaboratoryTestDefinitionDto,
} from '@/lib/api/laboratory-catalog.api';
import { cn } from '@/lib/utils';

export type CatalogSelection =
  | { kind: 'test'; test: LaboratoryTestDefinitionDto }
  | { kind: 'panel'; panel: LaboratoryPanelDetailDto };

interface LaboratoryCatalogPickerProps {
  value: CatalogSelection | null;
  onChange: (value: CatalogSelection | null) => void;
  disabled?: boolean;
  /** Already-selected catalog keys (`test:{id}` / `panel:{id}`) — hidden from results. */
  excludeKeys?: string[];
  /** Load active catalog options on focus/open without requiring a search term. */
  loadOnOpen?: boolean;
}

type FlatHit =
  | { kind: 'test'; id: string; row: LaboratoryTestDefinitionDto }
  | { kind: 'panel'; id: string; row: LaboratoryPanelSummaryDto };

/**
 * PatientSearchAutosuggest-style catalog picker (input + absolute listbox, not Popover Select).
 */
export function LaboratoryCatalogPicker({
  value,
  onChange,
  disabled,
  excludeKeys = [],
  loadOnOpen = false,
}: LaboratoryCatalogPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 250);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<LaboratoryTestDefinitionDto[]>([]);
  const [panels, setPanels] = useState<LaboratoryPanelSummaryDto[]>([]);

  useEffect(() => {
    if (value) {
      setTerm(
        value.kind === 'test'
          ? `${value.test.name} (${value.test.localCode})`
          : `${value.panel.name} (${value.panel.localCode})`,
      );
    }
  }, [value]);

  useEffect(() => {
    if (value) {
      setTests([]);
      setPanels([]);
      setLoading(false);
      setError(null);
      return;
    }

    const trimmed = debounced.trim();
    const shouldLoad = loadOnOpen ? open || trimmed.length > 0 : trimmed.length >= 2;
    if (!shouldLoad) {
      setTests([]);
      setPanels([]);
      setLoading(false);
      setError(null);
      return;
    }

    // When loadOnOpen and focused with empty term, wait until open.
    if (loadOnOpen && trimmed.length === 0 && !open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const search = trimmed.length >= 2 ? trimmed : undefined;
    void Promise.all([
      laboratoryCatalogApi.searchTests({ search, activeOnly: true, take: 40 }),
      laboratoryCatalogApi.searchPanels({ search, activeOnly: true, take: 40 }),
    ])
      .then(([tRes, pRes]) => {
        if (cancelled) return;
        setTests(Array.isArray(tRes.data) ? tRes.data : []);
        setPanels(Array.isArray(pRes.data) ? pRes.data : []);
        setActiveIndex(0);
      })
      .catch(() => {
        if (!cancelled) {
          setTests([]);
          setPanels([]);
          setError('Unable to load laboratory catalog.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, value, open, loadOnOpen]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const exclude = useMemo(() => new Set(excludeKeys), [excludeKeys]);

  const visiblePanels = useMemo(
    () => panels.filter((p) => !exclude.has(`panel:${p.id}`)),
    [panels, exclude],
  );
  const visibleTests = useMemo(
    () => tests.filter((t) => !exclude.has(`test:${t.id}`)),
    [tests, exclude],
  );

  const hits = useMemo<FlatHit[]>(() => {
    const panelHits: FlatHit[] = visiblePanels.map((row) => ({ kind: 'panel', id: row.id, row }));
    const testHits: FlatHit[] = visibleTests.map((row) => ({ kind: 'test', id: row.id, row }));
    return [...panelHits, ...testHits];
  }, [visiblePanels, visibleTests]);

  const queryReady = loadOnOpen
    ? open && !value
    : debounced.trim().length >= 2 && !value;
  const showDropdown = open && queryReady;

  const selectHit = async (hit: FlatHit) => {
    setLoading(true);
    setError(null);
    try {
      if (hit.kind === 'test') {
        const { data } = await laboratoryCatalogApi.getTest(hit.id);
        onChange({ kind: 'test', test: data });
      } else {
        const { data } = await laboratoryCatalogApi.getPanel(hit.id);
        onChange({ kind: 'panel', panel: data });
      }
      setTerm('');
      setOpen(false);
      setTests([]);
      setPanels([]);
    } catch {
      setError(hit.kind === 'test' ? 'Unable to load test details.' : 'Unable to load panel details.');
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    onChange(null);
    setTerm('');
    setOpen(false);
    setTests([]);
    setPanels([]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown && event.key === 'ArrowDown' && hits.length > 0) {
      setOpen(true);
      setActiveIndex(0);
      event.preventDefault();
      return;
    }
    if (!showDropdown) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, hits.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0 && hits[activeIndex]) {
      event.preventDefault();
      void selectHit(hits[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0 w-full" data-testid="laboratory-catalog-picker">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        role="combobox"
        aria-label="Search laboratory test or panel"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        value={term}
        onChange={(e) => {
          if (value) onChange(null);
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search or select laboratory test/panel…"
        className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-16 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
        data-testid="laboratory-catalog-search"
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
          data-testid="laboratory-catalog-results"
        >
          {loading && <li className="px-3 py-2 text-sm text-gray-500">Loading…</li>}
          {error && (
            <li className="px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </li>
          )}
          {!loading && !error && hits.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-600" role="status" data-testid="laboratory-catalog-empty">
              <p className="font-medium text-gray-800">No active laboratory catalog items</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Try another name or code, or use Add catalog test.
              </p>
            </li>
          )}

          {!loading && !error && visiblePanels.length > 0 && (
            <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Laboratory Panels
            </li>
          )}
          {!loading &&
            !error &&
            visiblePanels.map((panel) => {
              const index = hits.findIndex((h) => h.kind === 'panel' && h.id === panel.id);
              return (
                <li
                  key={`panel-${panel.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    'cursor-pointer border-b border-gray-50 px-3 py-2 text-sm last:border-0',
                    index === activeIndex ? 'bg-emerald-50' : 'hover:bg-gray-50',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void selectHit({ kind: 'panel', id: panel.id, row: panel })}
                  data-testid={`laboratory-catalog-panel-${panel.id}`}
                >
                  <p className="font-medium text-gray-900">{panel.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Panel · {panel.localCode}
                    {panel.category ? ` · ${panel.category}` : ''}
                  </p>
                </li>
              );
            })}

          {!loading && !error && visibleTests.length > 0 && (
            <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Laboratory Tests
            </li>
          )}
          {!loading &&
            !error &&
            visibleTests.map((test) => {
              const index = hits.findIndex((h) => h.kind === 'test' && h.id === test.id);
              const specimen =
                test.specimenTypes.find((s) => s.isDefault)?.specimenType ??
                test.specimenTypes[0]?.specimenType;
              return (
                <li
                  key={`test-${test.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    'cursor-pointer border-b border-gray-50 px-3 py-2 text-sm last:border-0',
                    index === activeIndex ? 'bg-emerald-50' : 'hover:bg-gray-50',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void selectHit({ kind: 'test', id: test.id, row: test })}
                  data-testid={`laboratory-catalog-test-${test.id}`}
                >
                  <p className="font-medium text-gray-900">{test.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {[test.localCode, test.category, specimen].filter(Boolean).join(' · ')}
                  </p>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
