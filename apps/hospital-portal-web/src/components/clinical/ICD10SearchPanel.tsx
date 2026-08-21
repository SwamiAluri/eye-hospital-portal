'use client';

import { useState, useEffect, useId } from 'react';
import { RadioGroup } from '@headlessui/react';
import {
  Search,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  searchDiagnosisCodes,
  getDiagnosisSuggestions,
} from '@/lib/api/diagnoses.api';
import type {
  DiagnosisCode,
  DiagnosisSearchResult,
  DiagnosisSuggestion,
} from '@/types/diagnosis';

type Laterality = 'OD' | 'OS' | 'OU';

export interface ICD10SearchPanelProps {
  /** When false the panel is not rendered. */
  expanded: boolean;
  onDone: () => void;
  onSelect: (code: DiagnosisCode, laterality: Laterality, isPrimary: boolean) => void;
  patientId?: string;
  patientAge?: number;
  patientGender?: string;
  existingDiagnoses?: DiagnosisCode[];
  defaultLaterality?: Laterality;
  disabled?: boolean;
  /** Smaller typography and result height for nested workspace forms. */
  compact?: boolean;
  'data-testid'?: string;
}

function isCodeAlreadyAdded(code: DiagnosisCode, existing: DiagnosisCode[]): boolean {
  return existing.some(d => d.id === code.id || (d.code && d.code === code.code));
}

export function ICD10SearchPanel({
  expanded,
  onDone,
  onSelect,
  patientId,
  patientAge,
  patientGender,
  existingDiagnoses = [],
  defaultLaterality = 'OU',
  disabled = false,
  compact = false,
  'data-testid': testId,
}: ICD10SearchPanelProps) {
  const primaryCheckboxId = useId();
  const [searchQuery, setSearchQuery] = useState('');
  const [laterality, setLaterality] = useState<Laterality>(defaultLaterality);
  const [isPrimary, setIsPrimary] = useState(false);
  const [searchResults, setSearchResults] = useState<DiagnosisSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([]);
  const [selectedCode, setSelectedCode] = useState<DiagnosisCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'suggestions'>('search');
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  useEffect(() => {
    setLaterality(defaultLaterality);
  }, [defaultLaterality]);

  useEffect(() => {
    if (!expanded) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedCode(null);
      setIsPrimary(false);
      setLaterality(defaultLaterality);
      setActiveTab('search');
      setSuggestionsLoaded(false);
      setSuggestions([]);
      return;
    }
    if (patientId && !suggestionsLoaded) {
      void loadSuggestions();
    }
  }, [expanded, patientId, defaultLaterality, suggestionsLoaded]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(() => {
      void performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  async function loadSuggestions() {
    if (!patientId) return;
    try {
      setSuggestionsLoading(true);
      const results = await getDiagnosisSuggestions(patientId, patientAge, patientGender);
      setSuggestions(results);
      setSuggestionsLoaded(true);
      if (results.length > 0) {
        setActiveTab('suggestions');
      }
    } catch (error) {
      console.error('Error loading diagnosis suggestions:', error);
      setSuggestionsLoaded(true);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function performSearch(query: string) {
    try {
      setLoading(true);
      const results = await searchDiagnosisCodes(query, true, 20);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching diagnosis codes:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectCode(code: DiagnosisCode) {
    setSelectedCode(code);
    if (code.laterality) {
      setLaterality(code.laterality);
    } else {
      setLaterality(defaultLaterality);
    }
    setIsPrimary(existingDiagnoses.length === 0);
  }

  function clearSelection() {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCode(null);
    setIsPrimary(false);
    setLaterality(defaultLaterality);
  }

  function handleAdd() {
    if (!selectedCode || disabled) return;
    onSelect(selectedCode, laterality, isPrimary);
    clearSelection();
  }

  if (!expanded) {
    return null;
  }

  const resultsMaxH = compact ? 'max-h-44' : 'max-h-60';
  const tabClass = (tab: 'search' | 'suggestions') =>
    `px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-indigo-600 text-indigo-700'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  const resultRowClass = (code: DiagnosisCode) => {
    const added = isCodeAlreadyAdded(code, existingDiagnoses);
    const selected = selectedCode?.id === code.id;
    return `w-full text-left rounded-lg border transition-all ${
      compact ? 'p-2 mb-1.5' : 'p-3 mb-2'
    } ${
      selected
        ? 'border-indigo-600 bg-indigo-50'
        : added
          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
          : 'border-gray-200 hover:border-gray-300'
    }`;
  };

  return (
    <div
      data-testid={testId}
      className={`rounded-lg border border-gray-200 bg-white ${compact ? 'p-2.5' : 'p-3'} space-y-2`}
    >
      <div className="flex border-b border-gray-200">
        <button type="button" onClick={() => setActiveTab('search')} className={tabClass('search')}>
          <Search className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />
          Search
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('suggestions')}
          className={tabClass('suggestions')}
        >
          <TrendingUp className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />
          Smart Suggestions{suggestions.length > 0 ? ` (${suggestions.length})` : ''}
        </button>
      </div>

      {activeTab === 'search' && (
        <div>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="text"
              disabled={disabled}
              placeholder="Search ICD-10 code or description…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full rounded-lg border border-gray-300 pl-9 pr-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 ${
                compact ? 'py-1.5 text-sm' : 'py-2 text-sm'
              }`}
              autoFocus
            />
          </div>

          <div className={`${resultsMaxH} overflow-y-auto mt-2`}>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Searching…
              </div>
            )}

            {!loading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-500">
                <AlertCircle className="mx-auto mb-1 h-8 w-8 text-gray-300" aria-hidden="true" />
                No diagnosis codes found
              </div>
            )}

            {searchResults.map(result => (
              <button
                key={result.code.id}
                type="button"
                onClick={() => handleSelectCode(result.code)}
                disabled={disabled || isCodeAlreadyAdded(result.code, existingDiagnoses)}
                className={resultRowClass(result.code)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-indigo-700">
                        {result.code.code}
                      </span>
                      {isCodeAlreadyAdded(result.code, existingDiagnoses) && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                          Added
                        </span>
                      )}
                    </div>
                    <p className={`text-gray-900 ${compact ? 'text-xs mt-0.5' : 'text-sm mt-0.5'}`}>
                      {result.code.description}
                    </p>
                  </div>
                  {selectedCode?.id === result.code.id && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className={`${resultsMaxH} overflow-y-auto`}>
          {suggestionsLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading suggestions…
            </div>
          )}

          {!suggestionsLoading && suggestions.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              <TrendingUp className="mx-auto mb-1 h-8 w-8 text-gray-300" aria-hidden="true" />
              No suggestions available
            </div>
          )}

          {suggestions.map(suggestion => (
            <button
              key={suggestion.code.id}
              type="button"
              onClick={() => handleSelectCode(suggestion.code)}
              disabled={disabled || isCodeAlreadyAdded(suggestion.code, existingDiagnoses)}
              className={resultRowClass(suggestion.code)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-indigo-700">
                      {suggestion.code.code}
                    </span>
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                    {isCodeAlreadyAdded(suggestion.code, existingDiagnoses) && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                        Added
                      </span>
                    )}
                  </div>
                  <p className={`text-gray-900 ${compact ? 'text-xs mt-0.5' : 'text-sm mt-0.5'}`}>
                    {suggestion.code.description}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 italic">{suggestion.reason}</p>
                </div>
                {selectedCode?.id === suggestion.code.id && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedCode && (
        <div className="space-y-2 border-t border-gray-100 pt-2">
          <p className={`text-gray-800 ${compact ? 'text-xs' : 'text-sm'}`}>
            <span className="font-mono font-semibold text-indigo-700">{selectedCode.code}</span>
            {' — '}
            {selectedCode.description}
          </p>

          <div>
            <span className={`block font-medium text-gray-700 ${compact ? 'text-xs mb-1' : 'text-sm mb-1.5'}`}>
              Eye <span className="text-red-600">*</span>
            </span>
            <RadioGroup value={laterality} onChange={setLaterality} disabled={disabled}>
              <div className="grid grid-cols-3 gap-2">
                {(['OD', 'OS', 'OU'] as const).map(eye => (
                  <RadioGroup.Option key={eye} value={eye} disabled={disabled}>
                    {({ checked }) => (
                      <div
                        className={`cursor-pointer rounded-md border text-center transition-all ${
                          compact ? 'px-2 py-1.5' : 'px-3 py-2'
                        } ${
                          checked
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                            : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
                        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <div className={compact ? 'text-xs font-medium' : 'text-sm font-medium'}>{eye}</div>
                      </div>
                    )}
                  </RadioGroup.Option>
                ))}
              </div>
            </RadioGroup>
          </div>

          <label className="flex items-center gap-2">
            <input
              id={primaryCheckboxId}
              type="checkbox"
              disabled={disabled}
              checked={isPrimary}
              onChange={e => setIsPrimary(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className={compact ? 'text-xs text-gray-800' : 'text-sm text-gray-800'}>
              Primary diagnosis
            </span>
          </label>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onDone}
          className={`rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 ${
            compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
          }`}
        >
          Done
        </button>
        <button
          type="button"
          data-testid={testId ? `${testId}-add` : undefined}
          disabled={disabled || !selectedCode}
          onClick={handleAdd}
          className={`rounded-lg font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300 ${
            compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
          } ${selectedCode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300'}`}
        >
          Add to list
        </button>
      </div>
    </div>
  );
}

export default ICD10SearchPanel;
