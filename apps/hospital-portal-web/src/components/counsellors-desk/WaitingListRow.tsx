'use client';

import React, { memo } from 'react';
import { ChevronRight, User } from 'lucide-react';
import type { WaitingListPatient } from '@/types/counsellors-desk';

const STATUS_BORDER: Record<string, string> = {
  Pending:           'border-l-amber-400',
  Processed:         'border-l-blue-400',
  Done:              'border-l-emerald-400',
  AddOnSurgery:      'border-l-violet-400',
  RepeatCounselling: 'border-l-orange-400',
  SurgeryDone:       'border-l-teal-400',
};

const STATUS_BADGE: Record<string, string> = {
  Pending:           'bg-amber-100 text-amber-700 ring-amber-200',
  Processed:         'bg-blue-100 text-blue-700 ring-blue-200',
  Done:              'bg-emerald-100 text-emerald-700 ring-emerald-200',
  AddOnSurgery:      'bg-violet-100 text-violet-700 ring-violet-200',
  RepeatCounselling: 'bg-orange-100 text-orange-700 ring-orange-200',
  SurgeryDone:       'bg-teal-100 text-teal-700 ring-teal-200',
};

const INSURANCE_TYPES = ['Insurance', 'TPA', 'CoPay', 'CGHS', 'SGHS', 'GovernmentScheme'];

const CCMS_STATE_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT:                  { label: 'Draft',            cls: 'bg-gray-100 text-gray-600' },
  ELIGIBILITY_PENDING:    { label: 'Eligibility Check',cls: 'bg-amber-100 text-amber-700' },
  ELIGIBILITY_VERIFIED:   { label: 'Eligibility OK',  cls: 'bg-blue-100 text-blue-700' },
  PREAUTH_GENERATED:      { label: 'Pre-auth Ready',   cls: 'bg-blue-100 text-blue-700' },
  PREAUTH_SENT:           { label: 'Sent to CCMS',     cls: 'bg-indigo-100 text-indigo-700' },
  WAITING_APPROVAL:       { label: 'Awaiting Approval',cls: 'bg-violet-100 text-violet-700' },
  APPROVED:               { label: 'Approved',         cls: 'bg-emerald-100 text-emerald-700' },
  PARTIAL_APPROVAL:       { label: 'Partial Approved', cls: 'bg-teal-100 text-teal-700' },
  REJECTED:               { label: 'Rejected',         cls: 'bg-red-100 text-red-700' },
  EXPIRED:                { label: 'Expired',          cls: 'bg-red-100 text-red-700' },
  CLARIFICATION_REQUIRED: { label: 'Clarification Req',cls: 'bg-amber-100 text-amber-700' },
  RESUBMITTED:            { label: 'Resubmitted',      cls: 'bg-blue-100 text-blue-700' },
  BILL_PENDING:           { label: 'Bill Pending',     cls: 'bg-purple-100 text-purple-700' },
  CLAIM_RAISED:           { label: 'Claim Raised',     cls: 'bg-violet-100 text-violet-700' },
  FULL_SETTLEMENT:        { label: 'Settled',          cls: 'bg-emerald-100 text-emerald-700' },
  CLOSED:                 { label: 'Closed',           cls: 'bg-gray-100 text-gray-500' },
};

function PreAuthStateBadge({ state }: { state: string }) {
  const cfg = CCMS_STATE_BADGE[state];
  if (!cfg) return null;
  return (
    <span className={`block text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${cfg.cls} leading-tight`}>
      {cfg.label}
    </span>
  );
}

export interface WaitingListRowProps {
  patient: WaitingListPatient;
  idx: number;
  isSelected: boolean;
  ccmsState?: string;
  onRowClick: (patient: WaitingListPatient) => void;
  onDemographics: (patient: WaitingListPatient) => void;
  onPreAuth: (patientId: string) => void;
}

function WaitingListRowComponent({
  patient,
  idx,
  isSelected,
  ccmsState,
  onRowClick,
  onDemographics,
  onPreAuth,
}: WaitingListRowProps) {
  const borderColor = STATUS_BORDER[patient.status] ?? 'border-l-gray-200';
  const isInsurance = INSURANCE_TYPES.includes(patient.paymentType as string);

  return (
    <tr
      onClick={() => onRowClick(patient)}
      className={`
        group cursor-pointer border-l-4 transition-colors duration-150
        ${borderColor}
        ${isSelected
          ? 'bg-blue-50/70'
          : idx % 2 === 0
            ? 'bg-white hover:bg-slate-50/80'
            : 'bg-gray-50/40 hover:bg-slate-50/80'
        }
      `}
    >
      <td className="pl-4 pr-3 py-3">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ring-1 ${STATUS_BADGE[patient.status] ?? 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
          {patient.slNo}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
          {patient.uhid}
        </span>
      </td>
      <td className="px-3 py-3">
        <p className="font-semibold text-gray-900 text-sm leading-tight">{patient.patientName}</p>
        {patient.status === 'RepeatCounselling' && (patient.followUpDate || patient.followUpReason) && (
          <p className="text-[10px] text-orange-600 mt-0.5">
            {patient.followUpDate && <span>📅 {new Date(patient.followUpDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
            {patient.followUpDate && patient.followUpReason && <span className="mx-1">·</span>}
            {patient.followUpReason && <span>{patient.followUpReason}</span>}
          </p>
        )}
      </td>
      <td className="px-3 py-3">
        {patient.eye
          ? <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              patient.eye === 'RE' ? 'bg-orange-100 text-orange-700'
                : patient.eye === 'LE' ? 'bg-purple-100 text-purple-700'
                : patient.eye === 'BE' ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600'
            }`}>{patient.eye}</span>
          : <span className="text-gray-300 text-xs">—</span>
        }
      </td>
      <td className="px-3 py-3">
        {patient.status === 'AddOnSurgery' && (patient.previousPackage || patient.newPackage) ? (
          <div>
            <p className="text-sm text-gray-700">{patient.newPackage || patient.surgeryName || '—'}</p>
            <p className="text-[10px] text-violet-600 mt-0.5 font-medium">
              ⬆ {patient.previousPackage} → {patient.newPackage}
              {patient.upgradeDiff != null && patient.upgradeDiff !== 0 && (
                <span className={patient.upgradeDiff > 0 ? 'text-violet-600' : 'text-orange-500'}>
                  {' '}({patient.upgradeDiff > 0 ? '+' : ''}₹{patient.upgradeDiff.toLocaleString('en-IN')})
                </span>
              )}
            </p>
          </div>
        ) : (
          <span className="text-sm text-gray-700">{patient.surgeryName || '—'}</span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
          patient.type === 'Surgery' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'
        }`}>
          {patient.type}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-gray-500">{patient.patientType}</td>
      <td className="px-3 py-3">
        <span className="text-xs font-medium text-gray-700">{patient.age}y</span>
      </td>
      <td className="px-3 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
          patient.gender?.toLowerCase() === 'male'
            ? 'bg-blue-50 text-blue-600'
            : patient.gender?.toLowerCase() === 'female'
            ? 'bg-pink-50 text-pink-600'
            : 'bg-gray-50 text-gray-500'
        }`}>
          {patient.gender || '—'}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{patient.doctor}</td>
      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{patient.time}</td>
      <td className="px-3 py-3 max-w-[130px]">
        {patient.remarks
          ? <p className="text-xs text-gray-400 truncate" title={patient.remarks}>{patient.remarks}</p>
          : <span className="text-gray-200 text-xs">—</span>
        }
      </td>
      <td className="px-3 py-3">
        {isInsurance ? (
          <div className="space-y-1">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
              {patient.paymentType}
            </span>
            {ccmsState && <PreAuthStateBadge state={ccmsState} />}
          </div>
        ) : (
          <span className="text-gray-200 text-xs">—</span>
        )}
      </td>
      <td className="px-3 py-3 pr-4">
        <div className="flex items-center justify-end gap-2">
          {isInsurance && (
            <button
              onClick={e => {
                e.stopPropagation();
                onPreAuth(patient.id);
              }}
              title="Start / View Pre-Authorization"
              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              Pre-Auth
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDemographics(patient); }}
            title="View patient demographics"
            className="p-1 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <User className="h-4 w-4" />
          </button>
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
        </div>
      </td>
    </tr>
  );
}

export const WaitingListRow = memo(WaitingListRowComponent);
