'use client';

import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { displayPatientName, parseCounsellorDraft } from '@/lib/api/ccms/parse-counsellor-draft';
import { patientApi, type Patient } from '@/lib/api/patients.api';

interface Props {
  case_: CoverageCase;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <InfoRowBlock label={label} value={value} />
  );
}

function InfoRowBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-[11px] text-gray-500 shrink-0 mr-3">{label}</span>
      <span className="text-[11px] font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}

export function PatientDemographicsCard({ case_ }: Props) {
  const draft = parseCounsellorDraft(case_.counsellorDraftJson);
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    if (!case_.patientId) return;
    let cancelled = false;
    setLoading(true);
    patientApi.getById(case_.patientId)
      .then(res => {
        if (cancelled) return;
        const p = (res as { data?: Patient })?.data ?? (res as Patient);
        setPatient(p);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [case_.patientId]);

  const apiName = patient
    ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim()
    : '';
  const nameFromCase = displayPatientName(case_, draft);
  const displayName = nameFromCase !== '—' ? nameFromCase : apiName || '—';

  const dob = patient?.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString('en-IN')
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4 text-indigo-500" />
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Patient</p>
        {loading && <span className="text-[10px] text-gray-400">Loading…</span>}
      </div>
      <p className="text-sm font-bold text-gray-900 mb-2">{displayName}</p>
      <InfoRow label="MRN / UHID" value={patient?.medicalRecordNumber ?? patient?.patientCode} />
      <InfoRow label="Gender" value={patient?.gender} />
      <InfoRow label="Date of Birth" value={dob} />
      <InfoRow label="Mobile" value={patient?.contactNumber ?? patient?.phone} />
      <InfoRow label="Email" value={patient?.email} />
      {draft?.relationshipToInsured && (
        <InfoRow label="Relationship to insured" value={draft.relationshipToInsured} />
      )}
    </div>
  );
}
