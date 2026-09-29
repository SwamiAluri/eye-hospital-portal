'use client';

import { useState, useEffect, useCallback, useRef, useMemo, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Loader2, Search, AlertCircle } from 'lucide-react';
import type { AddPatientFormData } from '@/types/counsellors-desk';
import { useSurgeonsQuery, useServiceCatalogQuery } from '@/hooks/use-counsellors-desk-queries';
import { SessionTypeSelect } from '@/components/counsellors-desk/SessionTypeSelect';
import { SearchableMasterSelect } from '@/components/counsellors-desk/SearchableMasterSelect';
import { defaultSessionTypeCode } from '@/lib/counsellors-desk/counsellor-master-maps';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  displayIdentifierForWaitingList,
  isScheduleCounsellingBlocked,
  requireSelectedMpiPatient,
  type ScheduleCounsellingDecision,
  type UnifiedPatientHit,
} from '@/lib/counsellors-desk/add-patient-to-waiting-list';
import {
  searchPatientsUnified,
  type UnifiedPatientSearchHit,
} from '@/lib/patients/unified-patient-search';
import { useAuthStore } from '@/lib/auth-store';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddPatientFormData) => Promise<void>;
  /** Existing waiting-list row should be opened instead of creating another session. */
  onOpenExisting: (decision: ScheduleCounsellingDecision) => void;
  /** Patient just registered — already matched, with search hidden until Change. */
  initialPatient?: UnifiedPatientHit | null;
  branchId?: string | null;
}

const EYE_OPTIONS = ['RE', 'LE', 'BE'];

const EMPTY_FORM: AddPatientFormData = {
  patientId: '',
  uhid: '',
  patientName: '',
  eye: '',
  surgeryType: 'Surgery',
  surgeryName: '',
  doctorId: '',
  remarks: '',
  sessionTypeCode: defaultSessionTypeCode('new'),
};

function ScheduleCounsellingDecision({
  decision,
  primaryRef,
  onBack,
  onClose,
  onOpenExisting,
}: {
  decision: ScheduleCounsellingDecision;
  primaryRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onClose: () => void;
  onOpenExisting: () => void;
}) {
  return (
    <div data-testid="schedule-counselling-decision" className="flex flex-col">
      <div className="h-1 w-full bg-amber-500" />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        aria-label="Close"
        data-testid="schedule-counselling-decision-close"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col items-center px-6 pb-2 pt-7 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
          <AlertCircle className="h-7 w-7 text-amber-500" aria-hidden />
        </div>
        <h2
          id="schedule-counselling-decision-title"
          className="mb-1.5 text-base font-bold text-gray-900"
        >
          {decision.title}
        </h2>
        <p className="text-sm leading-relaxed text-gray-500">{decision.body}</p>
        <div className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{decision.patientName}</p>
            {decision.uhid ? (
              <p className="truncate text-xs text-gray-500">{decision.uhid}</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
            {decision.statusLabel}
          </span>
        </div>
      </div>
      <div className="flex gap-2 px-6 pb-6 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          data-testid="schedule-counselling-decision-back"
        >
          Back
        </button>
        <button
          ref={primaryRef}
          type="button"
          onClick={onOpenExisting}
          className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          data-testid="schedule-counselling-decision-primary"
        >
          {decision.primaryLabel}
        </button>
      </div>
    </div>
  );
}

function hitToUnified(hit: UnifiedPatientSearchHit): UnifiedPatientHit {
  return {
    id: hit.id,
    firstName: hit.firstName,
    lastName: hit.lastName,
    mrn: hit.mrn,
    healthId: hit.healthId,
  };
}

function formatHitLabel(hit: UnifiedPatientSearchHit): string {
  const name = `${hit.firstName} ${hit.lastName}`.trim();
  const id = (hit.healthId && hit.healthId.trim()) || hit.mrn;
  const phone = hit.phone?.trim();
  return phone ? `${name} · ${id} · ${phone}` : `${name} · ${id}`;
}

export function AddPatientModal({
  isOpen,
  onClose,
  onAdd,
  onOpenExisting,
  initialPatient,
  branchId: branchIdProp,
}: AddPatientModalProps) {
  const { user, selectedBranchId } = useAuthStore();
  const branchId = branchIdProp ?? selectedBranchId ?? user?.branchId ?? null;
  const [form, setForm] = useState<AddPatientFormData>(EMPTY_FORM);
  const [selected, setSelected] = useState<UnifiedPatientHit | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hits, setHits] = useState<UnifiedPatientSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decision, setDecision] = useState<ScheduleCounsellingDecision | null>(null);
  const searchRootRef = useRef<HTMLDivElement>(null);
  const decisionPrimaryRef = useRef<HTMLButtonElement>(null);
  const surgeonsQuery = useSurgeonsQuery(isOpen);
  const surgeons = surgeonsQuery.data ?? [];
  const loadingSurgeons = surgeonsQuery.isLoading && surgeons.length === 0;
  const catalogQuery = useServiceCatalogQuery(isOpen);
  const surgeryOptions = useMemo(() => {
    const cats = catalogQuery.data?.categories ?? [];
    const opts: { id: string; name: string }[] = [];
    for (const cat of cats) {
      for (const svc of cat.services ?? []) {
        for (const v of svc.variants ?? []) {
          const name = (v.name || svc.name || '').trim();
          if (!name || !v.id) continue;
          opts.push({ id: String(v.id), name });
        }
      }
    }
    return opts;
  }, [catalogQuery.data]);
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 300);

  useEffect(() => {
    if (!isOpen) return;
    setForm(EMPTY_FORM);
    setSearchQuery('');
    setHits([]);
    setSearchOpen(false);
    setErrors({});
    setDecision(null);
    if (initialPatient?.id) {
      const name = `${initialPatient.firstName} ${initialPatient.lastName}`.trim();
      setSelected(initialPatient);
      setForm({
        ...EMPTY_FORM,
        patientId: initialPatient.id,
        patientName: name,
        uhid: displayIdentifierForWaitingList(initialPatient),
      });
      return;
    }
    setSelected(null);
  }, [isOpen, initialPatient]);

  const resetScheduleForm = useCallback(() => {
    setDecision(null);
    setSelected(null);
    setForm(EMPTY_FORM);
    setSearchQuery('');
    setHits([]);
    setSearchOpen(false);
    setErrors({});
  }, []);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (decision) {
        e.preventDefault();
        resetScheduleForm();
        return;
      }
      onClose();
    },
    [decision, onClose, resetScheduleForm],
  );

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  useEffect(() => {
    if (!decision) return;
    decisionPrimaryRef.current?.focus();
  }, [decision]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!searchRootRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Name / phone / UHID typeahead — branchId optional; server resolves authorized branch.
  useEffect(() => {
    if (!isOpen || selected) return;

    if (debouncedQuery.length < 2) {
      setHits([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    void searchPatientsUnified(branchId ?? null, debouncedQuery, 12)
      .then((rows) => {
        if (!cancelled) {
          setHits(rows);
          setSearchOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) setHits([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, branchId, isOpen, selected]);

  const applySelectedPatient = (patient: UnifiedPatientHit) => {
    const name = `${patient.firstName} ${patient.lastName}`.trim();
    const uhid = displayIdentifierForWaitingList(patient);
    setSelected(patient);
    setForm((f) => ({
      ...f,
      patientId: patient.id,
      patientName: name,
      uhid,
    }));
    setSearchQuery('');
    setHits([]);
    setSearchOpen(false);
    setErrors((er) => ({ ...er, patient: '' }));
  };

  const clearSelectedPatient = () => {
    setSelected(null);
    setForm((f) => ({ ...f, patientId: '', patientName: '', uhid: '' }));
    setSearchQuery('');
    setHits([]);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const mpi = requireSelectedMpiPatient(selected);
    if (!mpi.ok) e.patient = mpi.message;
    if (!form.eye) e.eye = 'Please select eye';
    if (!form.doctorId.trim()) e.doctorId = 'Please select a referring doctor';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !selected) return;
    setIsSubmitting(true);
    try {
      await onAdd({
        ...form,
        patientId: selected.id,
        patientName: `${selected.firstName} ${selected.lastName}`.trim(),
        uhid: displayIdentifierForWaitingList(selected),
      });
      onClose();
    } catch (err) {
      if (isScheduleCounsellingBlocked(err)) {
        setDecision(err.decision);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const showDropdown =
    !selected &&
    searchOpen &&
    debouncedQuery.length >= 2 &&
    (searchLoading || hits.length > 0 || (!searchLoading && hits.length === 0));

  return createPortal(
    <>
      <div
        className="counsellor-scrollbar fixed inset-0 z-40 flex items-center justify-center p-3 min-[1600px]:p-4"
        data-testid="add-patient-modal-overlay"
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          if (decision) {
            resetScheduleForm();
            return;
          }
          onClose();
        }}
      >
        <div className="absolute inset-0 bg-black/40" aria-hidden />

        <div
          className="relative flex max-h-[min(92dvh,calc(100dvh-1.5rem))] w-full max-w-[min(28rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl min-[1600px]:max-h-[min(90vh,calc(100dvh-2rem))] min-[1600px]:max-w-md"
          role={decision ? 'alertdialog' : 'dialog'}
          aria-modal="true"
          aria-labelledby={decision ? 'schedule-counselling-decision-title' : 'add-patient-title'}
          data-testid="add-patient-modal"
        >
          {decision ? (
            <ScheduleCounsellingDecision
              decision={decision}
              primaryRef={decisionPrimaryRef}
              onBack={resetScheduleForm}
              onClose={onClose}
              onOpenExisting={() => onOpenExisting(decision)}
            />
          ) : (
            <>
          <div
            className="flex shrink-0 items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 min-[1600px]:px-6 min-[1600px]:py-4"
            data-testid="add-patient-modal-header"
          >
            <h2 id="add-patient-title" className="text-base font-semibold text-white">
              Schedule Counselling
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close"
              data-testid="add-patient-modal-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            data-testid="add-patient-modal-body"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 min-[1600px]:space-y-4 min-[1600px]:px-6 min-[1600px]:py-6"
          >
            <div ref={searchRootRef} className="relative">
              <label htmlFor="add-patient-search" className="block text-sm font-medium text-gray-700 mb-1">
                Patient <span className="text-red-500">*</span>
              </label>

              {selected ? (
                <div
                  className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5"
                  data-testid="add-patient-matched"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      Matched: {form.patientName}
                    </p>
                    <p className="text-xs text-emerald-800 mt-0.5 truncate">
                      {form.uhid || 'MRN pending'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedPatient}
                    className="text-xs font-medium text-emerald-800 hover:underline flex-shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="add-patient-search"
                      type="text"
                      autoComplete="off"
                      placeholder="Search by name, phone, or UHID/MRD"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchOpen(true);
                        if (e.target.value.trim()) setErrors((er) => ({ ...er, patient: '' }));
                      }}
                      onFocus={() => setSearchOpen(true)}
                      className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.patient ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {searchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                  </div>

                  {showDropdown && (
                    <ul
                      className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                      role="listbox"
                    >
                      {searchLoading && hits.length === 0 && (
                        <li className="px-3 py-2 text-xs text-gray-500">Searching MPI…</li>
                      )}
                      {!searchLoading && hits.length === 0 && (
                        <li className="px-3 py-2 text-xs text-gray-500">
                          No patient found. Use New patient to register them.
                        </li>
                      )}
                      {hits.map((hit) => (
                        <li key={hit.id} role="option">
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                            onClick={() => applySelectedPatient(hitToUnified(hit))}
                          >
                            {formatHitLabel(hit)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {errors.patient && (
                <p className="text-xs text-red-500 mt-1" role="alert">
                  {errors.patient}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div>
                <label htmlFor="add-patient-eye" className="block text-sm font-medium text-gray-700 mb-1">
                  Eye <span className="text-red-500">*</span>
                </label>
                <select
                  id="add-patient-eye"
                  value={form.eye}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, eye: e.target.value }));
                    if (e.target.value) setErrors((er) => ({ ...er, eye: '' }));
                  }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.eye ? 'border-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select</option>
                  {EYE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {errors.eye && <p className="text-xs text-red-500 mt-1">{errors.eye}</p>}
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">Surgery Type</span>
                <div className="flex gap-4 mt-1">
                  {(['Procedure', 'Surgery'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="surgeryType"
                        value={t}
                        checked={form.surgeryType === t}
                        onChange={() => setForm((f) => ({ ...f, surgeryType: t }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <SearchableMasterSelect
                label="Surgery / procedure"
                value={form.surgeryName}
                options={surgeryOptions}
                emit="name"
                placeholder={catalogQuery.isLoading ? 'Loading catalogue…' : 'Search surgery or procedure…'}
                loading={catalogQuery.isLoading && surgeryOptions.length === 0}
                error={catalogQuery.isError ? 'Unable to load catalogue' : null}
                onRetry={() => void catalogQuery.refetch()}
                emptyMessage="No procedures found in the service catalogue."
                onChange={(name) => setForm((f) => ({ ...f, surgeryName: name }))}
                data-testid="add-patient-surgery"
              />
            </div>

            <div>
              <SearchableMasterSelect
                label="Doctor"
                value={form.doctorId}
                options={surgeons}
                emit="id"
                placeholder={loadingSurgeons ? 'Loading…' : 'Search referring doctor…'}
                loading={loadingSurgeons}
                error={surgeonsQuery.isError ? 'Unable to load doctors' : null}
                onRetry={() => void surgeonsQuery.refetch()}
                emptyMessage="No doctors found."
                onChange={(id) => {
                  setForm((f) => ({ ...f, doctorId: id }));
                  if (id) setErrors((er) => ({ ...er, doctorId: '' }));
                }}
                data-testid="add-patient-doctor"
              />
              {errors.doctorId && <p className="text-xs text-red-500 mt-1">{errors.doctorId}</p>}
            </div>

            <SessionTypeSelect
              id="add-patient-session-type"
              value={form.sessionTypeCode}
              onChange={(code) => setForm((f) => ({ ...f, sessionTypeCode: code }))}
              context="new"
            />

            <div>
              <label htmlFor="add-patient-remarks" className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <textarea
                id="add-patient-remarks"
                rows={2}
                placeholder="Optional remarks"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div
            className="flex shrink-0 items-center justify-end gap-2 border-t bg-gray-50 px-4 py-2.5 min-[1600px]:gap-3 min-[1600px]:px-6 min-[1600px]:py-4"
            data-testid="add-patient-modal-footer"
          >
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selected}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Schedule Counselling
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
