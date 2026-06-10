'use client';

import { X } from 'lucide-react';
import type { Patient } from '@/lib/api/patients.api';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import {
  formatPatientDob,
  resolvePatientMrn,
  resolvePatientPhone,
} from '@/lib/patients/patient-display-utils';

interface PatientDemographicsSheetProps {
  open: boolean;
  onClose: () => void;
  patient: Patient | null;
  age: number | null;
  visitLabel?: string;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

export function PatientDemographicsSheet({
  open,
  onClose,
  patient,
  age,
  visitLabel = 'Optometry examination',
}: PatientDemographicsSheetProps) {
  if (!open || !patient) return null;

  const name = `${patient.firstName} ${patient.lastName}`.trim();
  const dob = formatPatientDob(patient.dateOfBirth);
  const mrn = resolvePatientMrn(patient);
  const phone = resolvePatientPhone(patient);

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-sheet-title"
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 id="demo-sheet-title" className="text-lg font-semibold text-gray-900">
            Patient details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-col items-center text-center">
            <PatientAvatar
              photoUrl={patient.photoUrl}
              firstName={patient.firstName}
              lastName={patient.lastName}
              displayName={name}
              size="xl"
              showNoPhotoHint
              className="ring-4 ring-gray-100"
            />
            {!patient.photoUrl && (
              <p className="text-xs text-gray-500 mt-2">No photo on file</p>
            )}
            <p className="text-xl font-bold text-gray-900 mt-3">{name}</p>
            <p className="text-sm text-gray-600 mt-1">
              {age != null ? `${age}y` : '—'} · {patient.gender ?? '—'}
              {patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
            </p>
            {mrn && (
              <p className="text-xs font-mono text-slate-600 mt-1 bg-slate-100 px-2 py-0.5 rounded">
                {mrn}
              </p>
            )}
            <p className="text-xs text-emerald-700 mt-2 font-medium">{visitLabel}</p>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Identity
            </p>
            <Row label="MRN" value={mrn} />
            <Row label="Date of birth" value={dob} />
            <Row label="Blood group" value={patient.bloodGroup} />
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Contact
            </p>
            <Row label="Phone" value={phone} />
            <Row label="Email" value={patient.email} />
          </div>

          {(patient.insuranceProvider || patient.insurancePolicyNumber) && (
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Insurance
              </p>
              <Row label="Provider" value={patient.insuranceProvider} />
              <Row label="Policy" value={patient.insurancePolicyNumber} />
            </div>
          )}

          {(patient.address || patient.city) && (
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Address
              </p>
              <p className="text-sm text-gray-900">
                {[patient.address, patient.city, patient.state, patient.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          )}

          {(patient.emergencyContactName || patient.emergencyContactPhone) && (
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Emergency contact
              </p>
              <Row label="Name" value={patient.emergencyContactName} />
              <Row label="Phone" value={patient.emergencyContactPhone} />
              <Row label="Relation" value={patient.emergencyContactRelation} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
