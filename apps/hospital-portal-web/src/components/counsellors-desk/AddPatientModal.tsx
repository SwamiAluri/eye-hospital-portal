'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { AddPatientFormData } from '@/types/counsellors-desk';
import { useSurgeonsQuery } from '@/hooks/use-counsellors-desk-queries';
import { SessionTypeSelect } from '@/components/counsellors-desk/SessionTypeSelect';
import { defaultSessionTypeCode } from '@/lib/counsellors-desk/counsellor-master-maps';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddPatientFormData) => Promise<void>;
}

const EYE_OPTIONS = ['RE', 'LE', 'BE'];

const EMPTY_FORM: AddPatientFormData = {
  uhid: '',
  patientName: '',
  eye: '',
  surgeryType: 'Surgery',
  surgeryName: '',
  doctor: '',
  remarks: '',
};

export function AddPatientModal({ isOpen, onClose, onAdd }: AddPatientModalProps) {
  const [form, setForm] = useState<AddPatientFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const surgeonsQuery = useSurgeonsQuery(isOpen);
  const surgeons = surgeonsQuery.data ?? [];
  const loadingSurgeons = surgeonsQuery.isLoading && surgeons.length === 0;

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setErrors({});
    }
  }, [isOpen]);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.uhid.trim()) e.uhid = 'UHID / MRD is required';
    if (!form.patientName.trim()) e.patientName = 'Patient name is required';
    if (!form.eye) e.eye = 'Please select eye';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await onAdd(form);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
          <h2 className="text-base font-semibold text-white">Add Patient to Waiting List</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* UHID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              UHID / MRD <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter UHID or MRD number"
              value={form.uhid}
              onChange={(e) => {
                setForm(f => ({ ...f, uhid: e.target.value }));
                if (e.target.value.trim()) setErrors(er => ({ ...er, uhid: '' }));
              }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.uhid ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.uhid && <p className="text-xs text-red-500 mt-1">{errors.uhid}</p>}
          </div>

          {/* Patient Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Full patient name"
              value={form.patientName}
              onChange={(e) => {
                setForm(f => ({ ...f, patientName: e.target.value }));
                if (e.target.value.trim()) setErrors(er => ({ ...er, patientName: '' }));
              }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.patientName ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.patientName && <p className="text-xs text-red-500 mt-1">{errors.patientName}</p>}
          </div>

          {/* Eye + Surgery Type row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Eye <span className="text-red-500">*</span>
              </label>
              <select
                value={form.eye}
                onChange={(e) => {
                  setForm(f => ({ ...f, eye: e.target.value }));
                  if (e.target.value) setErrors(er => ({ ...er, eye: '' }));
                }}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.eye ? 'border-red-400' : 'border-gray-300'}`}
              >
                <option value="">Select</option>
                {EYE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {errors.eye && <p className="text-xs text-red-500 mt-1">{errors.eye}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Surgery Type</label>
              <div className="flex gap-4 mt-1">
                {(['Procedure', 'Surgery'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="surgeryType"
                      value={t}
                      checked={form.surgeryType === t}
                      onChange={() => setForm(f => ({ ...f, surgeryType: t }))}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Surgery Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surgery Name</label>
            <input
              type="text"
              placeholder="e.g. Phacoemulsification"
              value={form.surgeryName}
              onChange={(e) => setForm(f => ({ ...f, surgeryName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Doctor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
            <select
              value={form.doctor}
              onChange={(e) => setForm(f => ({ ...f, doctor: e.target.value }))}
              disabled={loadingSurgeons}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            >
              <option value="">{loadingSurgeons ? 'Loading…' : 'Select Doctor'}</option>
              {surgeons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          <SessionTypeSelect
            id="add-patient-session-type"
            value={form.sessionTypeCode}
            onChange={(code) => setForm((f) => ({ ...f, sessionTypeCode: code }))}
            context="new"
          />

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="Optional remarks"
              value={form.remarks}
              onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isSubmitting && (
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            Add Patient
          </button>
        </div>
      </div>
    </div>
  );
}
