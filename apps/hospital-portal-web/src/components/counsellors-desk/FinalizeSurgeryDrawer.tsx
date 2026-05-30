'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { FinalizeSurgeryRecord, FinalizeFormData } from '@/types/counsellors-desk';

interface FinalizeSurgeryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  patient: FinalizeSurgeryRecord | null;
  onSave: (data: FinalizeFormData) => void;
}

const ANESTHESIA_OPTIONS = [
  'General Anesthesia',
  'Local Anesthesia',
  'Topical Anesthesia',
  'Peribulbar Block',
  'Retrobulbar Block',
  'Sub-Tenon Block',
];

const STATUS_OPTIONS: { value: 'Finalised' | 'Confirmed' | 'NotConfirmed'; label: string; active: string; inactive: string }[] = [
  {
    value: 'Finalised',
    label: 'Finalised',
    active: 'bg-indigo-600 text-white border-indigo-600',
    inactive: 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50',
  },
  {
    value: 'Confirmed',
    label: 'Confirmed',
    active: 'bg-blue-600 text-white border-blue-600',
    inactive: 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50',
  },
  {
    value: 'NotConfirmed',
    label: 'Not Confirmed',
    active: 'bg-orange-500 text-white border-orange-500',
    inactive: 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50',
  },
];

const EMPTY_FORM: FinalizeFormData = {
  surgeryName: '',
  anesthesiaType: '',
  anesthetist: '',
  iolPower: '',
  reportingTime: '',
  remarks: '',
  status: '',
};

export function FinalizeSurgeryDrawer({ isOpen, onClose, patient, onSave }: FinalizeSurgeryDrawerProps) {
  const [form, setForm] = useState<FinalizeFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (patient) {
      setForm({ ...EMPTY_FORM, surgeryName: patient.surgeryName, status: '' });
      setErrors({});
    }
  }, [patient]);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.anesthesiaType) e.anesthesiaType = 'Anesthesia type is required';
    if (!form.status) e.status = 'Please select a status';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      onSave(form);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed top-0 right-0 h-full w-[440px] bg-white shadow-2xl z-50
          flex flex-col transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Finalize Surgery</h2>
            {patient && (
              <p className="text-xs text-indigo-100 mt-0.5">{patient.patientName} · {patient.uhid}</p>
            )}
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Surgery Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Surgery Name</label>
            <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium">
              {form.surgeryName || '—'}
            </div>
          </div>

          {/* Anesthesia Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anesthesia Type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.anesthesiaType}
              onChange={(e) => {
                setForm(f => ({ ...f, anesthesiaType: e.target.value }));
                if (e.target.value) setErrors(er => ({ ...er, anesthesiaType: '' }));
              }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.anesthesiaType ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">Select type</option>
              {ANESTHESIA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {errors.anesthesiaType && <p className="text-xs text-red-500 mt-1">{errors.anesthesiaType}</p>}
          </div>

          {/* Anesthetist */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anesthetist</label>
            <input
              type="text"
              placeholder="Enter anesthetist name"
              value={form.anesthetist}
              onChange={(e) => setForm(f => ({ ...f, anesthetist: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* IOL Power */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IOL Power</label>
            <input
              type="text"
              placeholder="e.g. +21.5 D"
              value={form.iolPower}
              onChange={(e) => setForm(f => ({ ...f, iolPower: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Reporting Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Time</label>
            <input
              type="time"
              value={form.reportingTime}
              onChange={(e) => setForm(f => ({ ...f, reportingTime: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              rows={3}
              placeholder="Add any remarks…"
              value={form.remarks}
              onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setForm(f => ({ ...f, status: opt.value }));
                    setErrors(er => ({ ...er, status: '' }));
                  }}
                  className={`flex-1 py-2 px-3 border rounded-lg text-sm font-medium transition-all ${
                    form.status === opt.value ? opt.active : opt.inactive
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.status && <p className="text-xs text-red-500 mt-1">{errors.status}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isSaving && (
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            Save
          </button>
        </div>
      </div>
    </>
  );
}
