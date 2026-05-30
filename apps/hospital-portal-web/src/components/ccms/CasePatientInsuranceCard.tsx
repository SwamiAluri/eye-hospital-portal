'use client';

import React from 'react';
import Link from 'next/link';
import { User, Shield, ExternalLink, Phone, Mail, Hash, HeartPulse } from 'lucide-react';
import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { displayPatientName, parseCounsellorDraft, formatMoney } from '@/lib/api/ccms/parse-counsellor-draft';
import { useCasePatient } from '@/hooks/useCasePatient';

interface Props {
  case_: CoverageCase;
  /** When true renders Patient | Insurance side-by-side. Default false = stacked (safe inside any container width). */
  twoColumn?: boolean;
}

function Row({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
      {icon && <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>}
      <span className="text-xs text-gray-500 shrink-0 mr-auto">{label}</span>
      <span className="text-xs font-semibold text-gray-800 text-right max-w-[55%]">{value}</span>
    </div>
  );
}

export function CasePatientInsuranceCard({ case_, twoColumn = false }: Props) {
  const draft = parseCounsellorDraft(case_.counsellorDraftJson);
  const { patient, loading } = useCasePatient(case_.patientId);

  const apiName      = patient ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() : '';
  const nameFromCase = displayPatientName(case_, draft);
  const displayName  = nameFromCase !== '—' ? nameFromCase : apiName || '—';

  const initials = displayName !== '—'
    ? displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const insurer = draft?.insurerName ?? case_.insurerName ?? (case_ as unknown as Record<string, unknown>).payerName as string | undefined;
  const hasInsurance = !!(
    insurer || case_.policyNumber || draft?.policyNumber ||
    draft?.sumInsured || draft?.surgeryDate || draft?.tpaContactEmail
  );

  const counsellorLink = case_.sessionId
    ? `/dashboard/counsellors-desk/${case_.sessionId}?tab=coverage&subtab=documents`
    : null;

  return (
    <div className={`grid ${twoColumn ? 'grid-cols-2' : 'grid-cols-1'} bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm`}>

      {/* ── Patient column ─────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br from-indigo-50/60 to-slate-50 p-4 ${twoColumn ? 'border-r border-gray-100' : 'border-b border-gray-100'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
            {loading ? <User className="w-5 h-5 opacity-70" /> : initials}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Patient</p>
            <p className="text-sm font-extrabold text-gray-900 truncate mt-0.5">{displayName}</p>
          </div>
        </div>

        {/* Demographics */}
        <div className="space-y-0">
          <Row label="MRN / UHID"   value={patient?.medicalRecordNumber ?? patient?.patientCode}  icon={<Hash  className="w-3.5 h-3.5" />} />
          <Row label="Gender"        value={patient?.gender} />
          <Row label="Date of Birth" value={patient?.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('en-IN') : null} />
          <Row label="Mobile"        value={patient?.contactNumber ?? patient?.phone}               icon={<Phone className="w-3.5 h-3.5" />} />
          <Row label="Email"         value={patient?.email}                                         icon={<Mail  className="w-3.5 h-3.5" />} />
          {draft?.relationshipToInsured && (
            <Row label="Relationship" value={draft.relationshipToInsured} />
          )}
        </div>
      </div>

      {/* ── Insurance column ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-50/40 to-teal-50/30 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Insurance &amp; Pre-Auth</p>
              {insurer && <p className="text-sm font-bold text-gray-800 mt-0.5 leading-tight">{insurer}</p>}
            </div>
          </div>
          {counsellorLink && (
            <Link href={counsellorLink}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex-shrink-0">
              <ExternalLink className="w-3.5 h-3.5" /> Edit
            </Link>
          )}
        </div>

        {hasInsurance ? (
          <div className="space-y-0">
            {!insurer && <Row label="Insurer / TPA" value={case_.payerType} />}
            <Row label="Policy No."    value={case_.policyNumber ?? draft?.policyNumber} />
            <Row label="Membership"    value={case_.membershipNumber ?? draft?.membershipNumber} />
            <Row label="Sum Insured"   value={formatMoney(draft?.sumInsured)} />
            <Row label="Co-pay"        value={draft?.coPay != null ? `${draft.coPay}%` : null} />
            <Row label="Policy Expiry" value={draft?.policyExpiry ? new Date(draft.policyExpiry).toLocaleDateString('en-IN') : null} />
            <Row
              label="Surgery Date"
              value={
                draft?.surgeryDate  ? new Date(draft.surgeryDate).toLocaleDateString('en-IN')
                : case_.surgeryDate ? new Date(case_.surgeryDate as string).toLocaleDateString('en-IN')
                : null
              }
              icon={<HeartPulse className="w-3.5 h-3.5" />}
            />
            <Row label="Urgency"     value={draft?.urgencyLevel ?? case_.urgencyLevel} />
            <Row label="TPA Contact" value={draft?.tpaContactPerson} />
            <Row label="TPA Email"   value={draft?.tpaContactEmail ?? case_.tpaContactEmail} />
            <Row label="TPA Phone"   value={draft?.tpaContactPhone ?? case_.tpaContactPhone} />
            {draft?.diagnosisCode  && <Row label="Diagnosis"  value={draft.diagnosisCode} />}
            {draft?.procedureCode  && <Row label="Procedure"  value={draft.procedureCode} />}
            {(draft?.coverageNotes || draft?.clinicalNotes) && (
              <div className="pt-2 mt-1 border-t border-gray-100 space-y-2">
                {draft?.coverageNotes && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Coverage notes</p>
                    <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{draft.coverageNotes}</p>
                  </div>
                )}
                {draft?.clinicalNotes && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Clinical notes</p>
                    <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{draft.clinicalNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2 py-2">
            <p className="text-xs text-gray-400 italic">
              No insurance data yet — counsellor draft or CCMS capture pending.
            </p>
            {counsellorLink ? (
              <Link href={counsellorLink}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Complete coverage in Counsellor Desk
              </Link>
            ) : (
              <p className="text-xs text-gray-400">
                Once the counsellor saves the coverage draft, details will appear here.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
