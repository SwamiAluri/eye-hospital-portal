'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, CheckCircle2, Loader2, Search, UserPlus } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { AddPatientFormData } from '@/types/counsellors-desk';
import { useSurgeonsQuery } from '@/hooks/use-counsellors-desk-queries';
import { SessionTypeSelect } from '@/components/counsellors-desk/SessionTypeSelect';
import { defaultSessionTypeCode } from '@/lib/counsellors-desk/counsellor-master-maps';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  displayIdentifierForWaitingList,
  requireSelectedMpiPatient,
  type UnifiedPatientHit,
} from '@/lib/counsellors-desk/add-patient-to-waiting-list';
import {
  searchPatientsUnified,
  type UnifiedPatientSearchHit,
} from '@/lib/patients/unified-patient-search';
import { useAuthStore } from '@/lib/auth-store';

const PatientFormModal = dynamic(() => import('@/components/patients/PatientFormModal'), {
  ssr: false,
});

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddPatientFormData) => Promise<void>;
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

export function AddPatientModal({ isOpen, onClose, onAdd, branchId: branchIdProp }: AddPatientModalProps) {
  const { user, selectedBranchId } = useAuthStore();
  const branchId = branchIdProp ?? selectedBranchId ?? user?.branchId ?? null;
  const [form, setForm] = useState<AddPatientFormData>(EMPTY_FORM);
  const [selected, setSelected] = useState<UnifiedPatientHit | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hits, setHits] = useState<UnifiedPatientSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchRootRef = useRef<HTMLDivElement>(null);
  const surgeonsQuery = useSurgeonsQuery(isOpen);
  const surgeons = surgeonsQuery.data ?? [];
  const loadingSurgeons = surgeonsQuery.isLoading && surgeons.length === 0;
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 300);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setSelected(null);
      setSearchQuery('');
      setHits([]);
      setSearchOpen(false);
      setRegisterOpen(false);
      setErrors({});
    }
  }, [isOpen]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (registerOpen) return;
        onClose();
      }
    },
    [onClose, registerOpen],
  );

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!searchRootRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Name / phone / UHID typeahead (option A — pick from list).
  useEffect(() => {
    if (!isOpen || selected) return;

    if (!branchId) {
      setHits([]);
      setSearchLoading(false);
      return;
    }

    if (debouncedQuery.length < 2) {
      setHits([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    void searchPatientsUnified(branchId, debouncedQuery, 12)
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
    if (!branchId) e.patient = 'Branch is required. Select a branch and try again.';
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

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget && !registerOpen) onClose();
        }}
      >
        <div className="absolute inset-0 bg-black/40" />

        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-patient-title"
        >
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
            <h2 id="add-patient-title" className="text-base font-semibold text-white">
              Schedule Counselling
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
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
                          No patients found. Register a new patient below.
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

                  <button
                    type="button"
                    onClick={() => setRegisterOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Register new patient
                  </button>
                </>
              )}

              {errors.patient && (
                <p className="text-xs text-red-500 mt-1" role="alert">
                  {errors.patient}
                </p>
              )}
              {!branchId && (
                <p className="text-xs text-amber-700 mt-1">Select a branch to search or register patients.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <label htmlFor="add-patient-surgery" className="block text-sm font-medium text-gray-700 mb-1">
                Surgery Name
              </label>
              <input
                id="add-patient-surgery"
                type="text"
                placeholder="e.g. Phacoemulsification"
                value={form.surgeryName}
                onChange={(e) => setForm((f) => ({ ...f, surgeryName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="add-patient-doctor" className="block text-sm font-medium text-gray-700 mb-1">
                Doctor <span className="text-red-500">*</span>
              </label>
              <select
                id="add-patient-doctor"
                value={form.doctorId}
                onChange={(e) => {
                  setForm((f) => ({ ...f, doctorId: e.target.value }));
                  if (e.target.value) setErrors((er) => ({ ...er, doctorId: '' }));
                }}
                disabled={loadingSurgeons}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 ${
                  errors.doctorId ? 'border-red-400' : 'border-gray-300'
                }`}
              >
                <option value="">{loadingSurgeons ? 'Loading…' : 'Select Doctor'}</option>
                {surgeons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
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
        </div>
      </div>

      {registerOpen && (
        <PatientFormModal
          isOpen={registerOpen}
          onClose={() => setRegisterOpen(false)}
          onSave={(patient) => {
            if (!patient.id) {
              setErrors((er) => ({
                ...er,
                patient: 'Registration did not return a patient id. Try again.',
              }));
              return;
            }
            applySelectedPatient({
              id: patient.id,
              firstName: patient.firstName,
              lastName: patient.lastName,
              mrn: patient.medicalRecordNumber || '',
              healthId: null,
            });
            // Close registration so Matched chip is visible on waiting-list Add Patient.
            setRegisterOpen(false);
          }}
        />
      )}
    </>
  );
}
