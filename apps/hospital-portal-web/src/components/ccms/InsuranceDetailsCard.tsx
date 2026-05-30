'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { formatMoney, parseCounsellorDraft } from '@/lib/api/ccms/parse-counsellor-draft';

interface Props {
  case_: CoverageCase;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-[11px] text-gray-500 shrink-0 mr-3">{label}</span>
      <span className="text-[11px] font-medium text-gray-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export function InsuranceDetailsCard({ case_ }: Props) {
  const draft = parseCounsellorDraft(case_.counsellorDraftJson);
  const insurer = draft?.insurerName ?? case_.insurerName ?? case_.payerName;
  const hasAny = insurer || case_.policyNumber || draft?.policyNumber
    || draft?.sumInsured || draft?.surgeryDate || draft?.tpaContactEmail;

  if (!hasAny) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-indigo-500" />
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Insurance</p>
        </div>
        <p className="text-[11px] text-gray-400 italic">No insurance details yet — counsellor draft or CCMS capture pending.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-indigo-500" />
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Insurance &amp; Pre-Auth</p>
      </div>
      <InfoRow label="Insurer / TPA" value={insurer ?? case_.payerType} />
      <InfoRow label="Policy No." value={case_.policyNumber ?? draft?.policyNumber} />
      <InfoRow label="Membership" value={case_.membershipNumber ?? draft?.membershipNumber} />
      <InfoRow label="Sum insured" value={formatMoney(draft?.sumInsured)} />
      <InfoRow label="Co-pay" value={draft?.coPay != null ? `${draft.coPay}%` : null} />
      <InfoRow label="Policy expiry" value={
        draft?.policyExpiry
          ? new Date(draft.policyExpiry).toLocaleDateString('en-IN')
          : null
      } />
      <InfoRow label="Surgery date" value={
        draft?.surgeryDate
          ? new Date(draft.surgeryDate).toLocaleDateString('en-IN')
          : case_.surgeryDate
            ? new Date(case_.surgeryDate).toLocaleDateString('en-IN')
            : null
      } />
      <InfoRow label="Urgency" value={draft?.urgencyLevel ?? case_.urgencyLevel} />
      <InfoRow label="TPA contact" value={draft?.tpaContactPerson} />
      <InfoRow label="TPA email" value={draft?.tpaContactEmail ?? case_.tpaContactEmail} />
      <InfoRow label="TPA phone" value={draft?.tpaContactPhone ?? case_.tpaContactPhone} />
      {draft?.clinicalNotes && (
        <div className="pt-2 mt-1 border-t border-gray-100">
          <p className="text-[10px] text-gray-500 mb-1">Clinical notes</p>
          <p className="text-[11px] text-gray-700 whitespace-pre-line leading-relaxed">{draft.clinicalNotes}</p>
        </div>
      )}
    </div>
  );
}
