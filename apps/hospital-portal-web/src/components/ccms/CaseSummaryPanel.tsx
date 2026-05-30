'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Wallet, User2, FileText } from 'lucide-react';
import type { CoverageCase } from '../../lib/api/ccms/ccms-coverage-cases.api';

interface Props {
  case_: CoverageCase;
  isLoading?: boolean;
}

interface DraftSnapshot {
  insurerName?: string;
  paymentType?: string;
  policyNumber?: string;
  membershipNumber?: string;
  insuredName?: string;
  relationshipToInsured?: string;
  sumInsured?: string | number;
  coPay?: string | number;
  policyExpiry?: string;
  financialYear?: string;
  coverageNotes?: string;
  surgeryDate?: string;
  estimatedSurgery?: string | number;
  estimatedLab?: string | number;
  estimatedRoom?: string | number;
  estimatedMedicines?: string | number;
  estimatedOther?: string | number;
  estimatedAmount?: string | number;
  sessionPackageRate?: string | number;
  clinicalNotes?: string;
  urgencyLevel?: string;
  diagnosisCode?: string;
  procedureCode?: string;
  tpaContactPerson?: string;
  tpaContactEmail?: string;
  tpaContactPhone?: string;
  roomClassEntitlement?: string;
  networkHospitalConfirmed?: boolean;
}

function parseDraftSnapshot(json?: string): DraftSnapshot | null {
  if (!json) return null;
  try { return JSON.parse(json) as DraftSnapshot; }
  catch { return null; }
}

function inr(v?: string | number | null): string | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) || n === 0 ? null : `₹${n.toLocaleString('en-IN')}`;
}

function FieldRow({ label, value, valueClass = '' }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400 shrink-0 mr-3 leading-snug">{label}</span>
      <span className={`text-xs font-medium text-gray-800 text-right leading-snug ${valueClass}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 pt-3 first:pt-0">
      <Icon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</p>
    </div>
  );
}

export function CaseSummaryPanel({ case_: c, isLoading }: Props) {
  const [draftExpanded, setDraftExpanded] = useState(true);

  const draft = useMemo(() => parseDraftSnapshot(c.counsellorDraftJson), [c.counsellorDraftJson]);
  const hasDraft = !!(draft && (draft.insurerName || draft.policyNumber || draft.estimatedAmount || draft.sessionPackageRate));

  const estimatedAmt = c.estimatedAmount
    ?? (draft ? Number(draft.estimatedAmount ?? draft.sessionPackageRate ?? draft.estimatedSurgery ?? 0) || undefined : undefined);

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-gray-100">
        <p className="text-xs font-bold text-indigo-700 tracking-wide">{c.caseNumber}</p>
        <p className="text-xs text-gray-400 mt-0.5">Coverage Summary</p>
      </div>

      <div className="px-4 py-3 space-y-0">
        {/* Payer info */}
        <SectionHeader icon={Wallet} title="Payer" />
        <FieldRow label="Payer Type"   value={c.payerType} />
        {(c.paymentType ?? draft?.paymentType) && (
          <FieldRow label="Payment Mode" value={c.paymentType ?? String(draft?.paymentType ?? '')} />
        )}
        {(c.insurerName ?? draft?.insurerName) && (
          <FieldRow label="Insurer" value={c.insurerName ?? draft?.insurerName} />
        )}
        {(draft?.policyNumber) && (
          <FieldRow label="Policy No." value={draft.policyNumber} />
        )}
        {(draft?.membershipNumber) && (
          <FieldRow label="Membership" value={draft.membershipNumber} />
        )}

        {/* Financial */}
        <SectionHeader icon={TrendingUp} title="Financials" />
        {estimatedAmt && (
          <FieldRow label="Estimated"
            value={<span className="text-indigo-700 font-bold">{inr(estimatedAmt)}</span>} />
        )}
        {c.approvedAmount != null && c.approvedAmount > 0 && (
          <FieldRow label="Approved"
            value={<span className="text-green-700 font-bold">{inr(c.approvedAmount)}</span>} />
        )}
        {c.patientPayableAmount != null && c.patientPayableAmount > 0 && (
          <FieldRow label="Patient Pays"
            value={<span className="text-red-600 font-bold">{inr(c.patientPayableAmount)}</span>} />
        )}
        {draft?.sumInsured && (
          <FieldRow label="Sum Insured" value={inr(draft.sumInsured)} />
        )}
        {draft?.coPay && (
          <FieldRow label="Co-Pay" value={`${draft.coPay}%`} />
        )}

        {/* Counsellor-entered detail */}
        {hasDraft && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDraftExpanded(v => !v)}
              className="w-full flex items-center justify-between py-1 group"
            >
              <div className="flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-indigo-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Counsellor Details {c.isDraft ? '(Draft)' : ''}
                </span>
              </div>
              {draftExpanded
                ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </button>

            {draftExpanded && (
              <div className="mt-2 bg-indigo-50/50 rounded-xl px-3 py-2 space-y-0">
                {draft?.insuredName           && <FieldRow label="Insured Name"    value={draft.insuredName} />}
                {draft?.relationshipToInsured && <FieldRow label="Relationship"    value={draft.relationshipToInsured} />}
                {draft?.policyExpiry && (
                  <FieldRow label="Policy Expiry"
                    value={new Date(draft.policyExpiry).toLocaleDateString('en-IN')} />
                )}
                {draft?.surgeryDate && (
                  <FieldRow label="Surgery Date"
                    value={new Date(draft.surgeryDate).toLocaleDateString('en-IN')} />
                )}
                {draft?.urgencyLevel          && <FieldRow label="Urgency"         value={draft.urgencyLevel} />}
                {draft?.roomClassEntitlement  && <FieldRow label="Room Class"       value={draft.roomClassEntitlement} />}
                {draft?.diagnosisCode         && <FieldRow label="Diagnosis"        value={draft.diagnosisCode} />}
                {draft?.procedureCode         && <FieldRow label="Procedure"        value={draft.procedureCode} />}
                {draft?.tpaContactPerson      && <FieldRow label="TPA Contact"      value={draft.tpaContactPerson} />}
                {draft?.tpaContactPhone       && <FieldRow label="TPA Phone"        value={draft.tpaContactPhone} />}
                {draft?.coverageNotes && (
                  <div className="py-1.5">
                    <span className="text-xs text-gray-400 block mb-0.5">Notes</span>
                    <p className="text-xs text-gray-700 leading-relaxed">{draft.coverageNotes}</p>
                  </div>
                )}
                {c.draftSavedAt && (
                  <p className="text-[11px] text-gray-400 pt-1 border-t border-indigo-100/60">
                    Saved {new Date(c.draftSavedAt).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Patient & dates */}
        <SectionHeader icon={User2} title="Case Info" />
        {c.patientName && <FieldRow label="Patient" value={c.patientName} />}
        <FieldRow label="Created" value={new Date(c.createdAt).toLocaleDateString('en-IN')} />
        {c.preAuthNumber && <FieldRow label="Pre-Auth No." value={
          <span className="font-mono text-xs">{c.preAuthNumber}</span>
        } />}
      </div>
    </div>
  );
}
