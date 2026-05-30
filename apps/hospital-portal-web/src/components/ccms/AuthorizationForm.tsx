'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Stethoscope, DollarSign, Send, RefreshCw, Plus, Trash2 } from 'lucide-react';
import type { GeneratePreAuthRequest } from '@/lib/api/ccms/ccms-authorizations.api';
import type { PreAuthPrefillData } from '@/lib/ccms/build-preauth-prefill';
import {
  type DiagnosisEntry,
  type ProcedureEntry,
  emptyDiagnosis,
  emptyProcedure,
  parseDiagnosisJson,
  parseProceduresJson,
  serializeDiagnosisJson,
  serializeProceduresJson,
  formatDiagnosisSummary,
  formatProceduresSummary,
} from '@/lib/ccms/clinical-code-fields';
import { EstimateTaxSummary, computeEstimate } from './EstimateTaxSummary';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  serviceTaxApplicable?: boolean;
  serviceTaxPercent?: number;
  prefill?: PreAuthPrefillData | null;
  prefillLoading?: boolean;
  onSubmit: (req: GeneratePreAuthRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

type Tab = 'clinical' | 'financial' | 'submit';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 items-start py-2 border-b border-gray-50 last:border-0">
      <label className="text-xs text-gray-500 pt-1.5 col-span-1">{label}</label>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${props.className ?? ''}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${props.className ?? ''}`}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

function applyPrefillField<T>(current: T, incoming: T | undefined): T {
  if (incoming === undefined || incoming === null || incoming === '') return current;
  if (typeof current === 'number' && current !== 0 && current !== '') return current;
  if (typeof current === 'string' && current.trim()) return current;
  return incoming;
}

export function AuthorizationForm({
  caseId,
  serviceTaxApplicable = false,
  serviceTaxPercent = 0,
  prefill,
  prefillLoading = false,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('clinical');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const prefillApplied = useRef(false);

  // Clinical fields
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [treatingDoctorName, setTreatingDoctorName] = useState('');
  const [treatingDoctorReg, setTreatingDoctorReg] = useState('');
  const [admissionDate, setAdmissionDate] = useState('');
  const [expectedDischargeDate, setExpectedDischargeDate] = useState('');
  const [lengthOfStayDays, setLengthOfStayDays] = useState<number | ''>('');
  const [roomTypeRequested, setRoomTypeRequested] = useState('');
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([emptyDiagnosis()]);
  const [procedures, setProcedures] = useState<ProcedureEntry[]>([emptyProcedure()]);

  // Financial fields
  const [requestedAmount, setRequestedAmount] = useState<number | ''>('');
  const [estimatedTotalCost, setEstimatedTotalCost] = useState<number | ''>('');
  const [copayAmount, setCopayAmount] = useState<number | ''>(0);
  const [deductibleAmount, setDeductibleAmount] = useState<number | ''>(0);

  useEffect(() => {
    if (!prefill || prefillApplied.current) return;
    prefillApplied.current = true;

    setClinicalSummary(v => applyPrefillField(v, prefill.clinicalSummary));
    setTreatingDoctorName(v => applyPrefillField(v, prefill.treatingDoctorName));
    setTreatingDoctorReg(v => applyPrefillField(v, prefill.treatingDoctorReg));
    setAdmissionDate(v => applyPrefillField(v, prefill.admissionDate));
    setExpectedDischargeDate(v => applyPrefillField(v, prefill.expectedDischargeDate));
    if (prefill.lengthOfStayDays != null) {
      setLengthOfStayDays(v => (v === '' ? prefill.lengthOfStayDays! : v));
    }
    setRoomTypeRequested(v => applyPrefillField(v, prefill.roomTypeRequested));
    if (prefill.diagnosisJson?.trim()) {
      setDiagnoses(parseDiagnosisJson(prefill.diagnosisJson));
    }
    if (prefill.proceduresJson?.trim()) {
      setProcedures(parseProceduresJson(prefill.proceduresJson));
    }
    if (prefill.estimatedTotalCost != null && prefill.estimatedTotalCost > 0) {
      setEstimatedTotalCost(v => (v === '' ? prefill.estimatedTotalCost! : v));
    }
    if (prefill.requestedAmount != null && prefill.requestedAmount > 0) {
      setRequestedAmount(v => (v === '' ? prefill.requestedAmount! : v));
    }
    if (prefill.copayAmount != null) {
      setCopayAmount(v => (v === '' || v === 0 ? prefill.copayAmount! : v));
    }
    if (prefill.deductibleAmount != null) {
      setDeductibleAmount(v => (v === '' ? prefill.deductibleAmount! : v));
    }
  }, [prefill]);

  const taxResult = computeEstimate({
    estimatedMedicalCost: estimatedTotalCost === '' ? 0 : estimatedTotalCost,
    serviceTaxApplicable,
    serviceTaxPercent,
    approvedAmount:       requestedAmount === '' ? 0 : requestedAmount,
    copayAmount:          copayAmount === '' ? 0 : copayAmount,
    deductibleAmount:     deductibleAmount === '' ? 0 : deductibleAmount,
  });

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'clinical',   label: 'Clinical Details',  icon: <Stethoscope className="w-3.5 h-3.5" /> },
    { key: 'financial',  label: 'Financial Details', icon: <DollarSign   className="w-3.5 h-3.5" /> },
    { key: 'submit',     label: 'Review & Submit',   icon: <Send         className="w-3.5 h-3.5" /> },
  ];

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!requestedAmount || requestedAmount <= 0)
      errs.requestedAmount = 'Requested amount is required.';
    if (!estimatedTotalCost || estimatedTotalCost <= 0)
      errs.estimatedTotalCost = 'Estimated cost is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) { setActiveTab('financial'); return; }

    const req: GeneratePreAuthRequest = {
      requestedAmount:      requestedAmount === '' ? 0 : requestedAmount,
      roomClassRequested:   roomTypeRequested || undefined,
      roomTypeRequested:    roomTypeRequested || undefined,
      diagnosisJson:        serializeDiagnosisJson(diagnoses),
      proceduresJson:       serializeProceduresJson(procedures),
      clinicalSummary:      clinicalSummary || undefined,
      treatingDoctorName:   treatingDoctorName || undefined,
      treatingDoctorReg:    treatingDoctorReg || undefined,
      admissionDate:        admissionDate || undefined,
      expectedDischargeDate: expectedDischargeDate || undefined,
      lengthOfStayDays:     lengthOfStayDays === '' ? undefined : lengthOfStayDays,
      estimatedTotalCost:   estimatedTotalCost === '' ? 0 : estimatedTotalCost,
      copayAmount:          copayAmount === '' ? 0 : copayAmount,
      deductibleAmount:     deductibleAmount === '' ? 0 : deductibleAmount,
      serviceTaxAmount:     taxResult.serviceTaxAmount,
      netPayableByInsurer:  taxResult.insurancePays,
      netPayableByPatient:  taxResult.patientPayable,
    };

    await onSubmit(req);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors
              ${activeTab === t.key
                ? 'bg-white border border-b-white border-gray-200 text-indigo-700 -mb-px'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {prefillLoading && (
          <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Loading counsellor draft, OT schedule, and clinical data…
          </div>
        )}
        {activeTab === 'clinical' && (
          <div className="space-y-0">
            <FieldRow label="Treating Doctor">
              <Input
                placeholder="Dr. Full Name"
                value={treatingDoctorName}
                onChange={e => setTreatingDoctorName(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Reg. No.">
              <Input
                placeholder="Medical registration number"
                value={treatingDoctorReg}
                onChange={e => setTreatingDoctorReg(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Room Type">
              <select
                value={roomTypeRequested}
                onChange={e => setRoomTypeRequested(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— Select —</option>
                <option value="general">General Ward</option>
                <option value="semi-private">Semi-Private</option>
                <option value="private">Private</option>
                <option value="icu">ICU / HDU</option>
              </select>
            </FieldRow>
            <FieldRow label="Admission Date">
              <Input type="date" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} />
            </FieldRow>
            <FieldRow label="Expected Discharge">
              <Input type="date" value={expectedDischargeDate} onChange={e => setExpectedDischargeDate(e.target.value)} />
            </FieldRow>
            <FieldRow label="LOS (days)">
              <Input
                type="number" min={0} placeholder="0"
                value={lengthOfStayDays}
                onChange={e => setLengthOfStayDays(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </FieldRow>
            <FieldRow label="Diagnosis">
              <div className="space-y-2">
                {diagnoses.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5 items-start">
                    <Input
                      className="col-span-3"
                      placeholder="ICD-10"
                      value={row.icd10}
                      onChange={e => setDiagnoses(prev => prev.map((r, j) => j === i ? { ...r, icd10: e.target.value } : r))}
                    />
                    <Input
                      className="col-span-8"
                      placeholder="Description"
                      value={row.description}
                      onChange={e => setDiagnoses(prev => prev.map((r, j) => j === i ? { ...r, description: e.target.value } : r))}
                    />
                    {diagnoses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDiagnoses(prev => prev.filter((_, j) => j !== i))}
                        className="col-span-1 p-1.5 text-gray-400 hover:text-red-500 rounded"
                        aria-label="Remove diagnosis"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDiagnoses(prev => [...prev, { ...emptyDiagnosis(), isPrimary: false }])}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add diagnosis
                </button>
              </div>
            </FieldRow>
            <FieldRow label="Procedures">
              <div className="space-y-2">
                {procedures.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5 items-start">
                    <Input
                      className="col-span-3"
                      placeholder="Code"
                      value={row.code}
                      onChange={e => setProcedures(prev => prev.map((r, j) => j === i ? { ...r, code: e.target.value } : r))}
                    />
                    <Input
                      className="col-span-8"
                      placeholder="Procedure name"
                      value={row.name}
                      onChange={e => setProcedures(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                    />
                    {procedures.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setProcedures(prev => prev.filter((_, j) => j !== i))}
                        className="col-span-1 p-1.5 text-gray-400 hover:text-red-500 rounded"
                        aria-label="Remove procedure"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setProcedures(prev => [...prev, emptyProcedure()])}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add procedure
                </button>
              </div>
            </FieldRow>
            <FieldRow label="Clinical Summary">
              <Textarea
                rows={4}
                placeholder="Brief clinical history and reason for hospitalisation..."
                value={clinicalSummary}
                onChange={e => setClinicalSummary(e.target.value)}
              />
            </FieldRow>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-0">
            <FieldRow label="Estimated Total Cost *">
              <div className="relative">
                <span className="absolute left-3 top-1.5 text-gray-400 text-sm">₹</span>
                <Input
                  type="number" min={0} placeholder="0.00"
                  className="pl-6"
                  value={estimatedTotalCost}
                  onChange={e => setEstimatedTotalCost(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              {errors.estimatedTotalCost && <p className="text-xs text-red-500 mt-1">{errors.estimatedTotalCost}</p>}
            </FieldRow>
            <FieldRow label="Requested Amount *">
              <div className="relative">
                <span className="absolute left-3 top-1.5 text-gray-400 text-sm">₹</span>
                <Input
                  type="number" min={0} placeholder="0.00"
                  className="pl-6"
                  value={requestedAmount}
                  onChange={e => setRequestedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              {errors.requestedAmount && <p className="text-xs text-red-500 mt-1">{errors.requestedAmount}</p>}
            </FieldRow>
            <FieldRow label="Co-pay Amount">
              <div className="relative">
                <span className="absolute left-3 top-1.5 text-gray-400 text-sm">₹</span>
                <Input
                  type="number" min={0} placeholder="0.00"
                  className="pl-6"
                  value={copayAmount}
                  onChange={e => setCopayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </FieldRow>
            <FieldRow label="Deductible">
              <div className="relative">
                <span className="absolute left-3 top-1.5 text-gray-400 text-sm">₹</span>
                <Input
                  type="number" min={0} placeholder="0.00"
                  className="pl-6"
                  value={deductibleAmount}
                  onChange={e => setDeductibleAmount(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </FieldRow>

            {/* Live tax + coverage summary */}
            <div className="pt-3">
              <EstimateTaxSummary
                breakdown={{
                  estimatedMedicalCost: estimatedTotalCost === '' ? 0 : estimatedTotalCost,
                  serviceTaxApplicable,
                  serviceTaxPercent,
                  approvedAmount:   requestedAmount === '' ? 0 : requestedAmount,
                  copayAmount:      copayAmount === '' ? 0 : copayAmount,
                  deductibleAmount: deductibleAmount === '' ? 0 : deductibleAmount,
                }}
                showTaxNote={serviceTaxApplicable}
              />
            </div>
          </div>
        )}

        {activeTab === 'submit' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Review the summary below before submitting the pre-authorisation request.
            </p>

            {/* Clinical summary */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
              {[
                ['Treating Doctor', treatingDoctorName || '—'],
                ['Room Type', roomTypeRequested || '—'],
                ['Admission Date', admissionDate || '—'],
                ['Expected Discharge', expectedDischargeDate || '—'],
                ['LOS', lengthOfStayDays !== '' ? `${lengthOfStayDays} days` : '—'],
                ['Diagnosis', formatDiagnosisSummary(diagnoses)],
                ['Procedures', formatProceduresSummary(procedures)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between px-3 py-2 text-xs">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-800 font-medium">{v}</span>
                </div>
              ))}
            </div>

            {/* Financial summary */}
            <EstimateTaxSummary
              breakdown={{
                estimatedMedicalCost: estimatedTotalCost === '' ? 0 : estimatedTotalCost,
                serviceTaxApplicable,
                serviceTaxPercent,
                approvedAmount:   requestedAmount === '' ? 0 : requestedAmount,
                copayAmount:      copayAmount === '' ? 0 : copayAmount,
                deductibleAmount: deductibleAmount === '' ? 0 : deductibleAmount,
              }}
              showTaxNote={serviceTaxApplicable}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
        >
          Cancel
        </button>
        <div className="flex gap-2">
          {activeTab !== 'submit' && (
            <button
              onClick={() => setActiveTab(activeTab === 'clinical' ? 'financial' : 'submit')}
              className="px-4 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
            >
              Next →
            </button>
          )}
          {activeTab === 'submit' && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Submitting…' : 'Submit Pre-Auth'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
