'use client';

import React from 'react';
import {
  FileEdit, ClipboardList, CheckCircle2,
  Activity, Send, Landmark, XCircle, Check,
} from 'lucide-react';

const PHASES = [
  {
    key: 'intake',
    label: 'Intake',
    icon: FileEdit,
    color: 'indigo',
    bg: 'bg-indigo-600',
    ring: 'ring-indigo-200',
    text: 'text-indigo-700',
    light: 'bg-indigo-50',
    border: 'border-indigo-200',
    guidance: 'Verify patient eligibility, capture policy details and generate pre-auth.',
    states: ['DRAFT', 'ELIGIBILITY_PENDING', 'ELIGIBILITY_VERIFIED', 'POLICY_CAPTURED', 'AUTHORIZATION_REQUIRED'],
  },
  {
    key: 'preauth',
    label: 'Pre-Auth',
    icon: ClipboardList,
    color: 'amber',
    bg: 'bg-amber-500',
    ring: 'ring-amber-200',
    text: 'text-amber-700',
    light: 'bg-amber-50',
    border: 'border-amber-200',
    guidance: 'Submit pre-authorization to TPA and await approval decision.',
    states: ['PREAUTH_GENERATED', 'PREAUTH_SENT', 'WAITING_APPROVAL', 'CLARIFICATION_REQUIRED', 'RESUBMITTED'],
  },
  {
    key: 'approval',
    label: 'Approval',
    icon: CheckCircle2,
    color: 'emerald',
    bg: 'bg-emerald-600',
    ring: 'ring-emerald-200',
    text: 'text-emerald-700',
    light: 'bg-emerald-50',
    border: 'border-emerald-200',
    guidance: 'TPA approval received. Proceed with admission and clinical care.',
    states: ['APPROVED', 'PARTIAL_APPROVAL'],
  },
  {
    key: 'clinical',
    label: 'Clinical',
    icon: Activity,
    color: 'teal',
    bg: 'bg-teal-600',
    ring: 'ring-teal-200',
    text: 'text-teal-700',
    light: 'bg-teal-50',
    border: 'border-teal-200',
    guidance: 'Patient is admitted. Proceed through surgery/treatment and finalize bills.',
    states: ['ADMISSION_READY', 'ADMITTED', 'SURGERY_SCHEDULED', 'SURGERY_COMPLETED'],
  },
  {
    key: 'claims',
    label: 'Claims',
    icon: Send,
    color: 'blue',
    bg: 'bg-blue-600',
    ring: 'ring-blue-200',
    text: 'text-blue-700',
    light: 'bg-blue-50',
    border: 'border-blue-200',
    guidance: 'Allocate bill lines, generate claim packet and submit to insurer.',
    states: ['BILL_PENDING', 'BILL_FINALIZED', 'CLAIM_READY', 'CLAIM_SUBMITTED', 'CLAIM_IN_PROCESS'],
  },
  {
    key: 'settlement',
    label: 'Settlement',
    icon: Landmark,
    color: 'violet',
    bg: 'bg-violet-600',
    ring: 'ring-violet-200',
    text: 'text-violet-700',
    light: 'bg-violet-50',
    border: 'border-violet-200',
    guidance: 'Record insurer payment and reconcile to close the case.',
    states: ['SETTLEMENT_PENDING', 'PARTIAL_SETTLEMENT', 'FULL_SETTLEMENT', 'RECONCILED', 'CLOSED'],
  },
] as const;

const TERMINAL_STATES = new Set(['REJECTED', 'CANCELLED', 'EXPIRED', 'ABORTED']);

const STATE_SUBLABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ELIGIBILITY_PENDING: 'Verifying Eligibility',
  ELIGIBILITY_VERIFIED: 'Eligibility Confirmed',
  POLICY_CAPTURED: 'Policy Captured',
  AUTHORIZATION_REQUIRED: 'Auth Needed',
  PREAUTH_GENERATED: 'Pre-Auth Generated',
  PREAUTH_SENT: 'Sent to TPA',
  WAITING_APPROVAL: 'Awaiting TPA Decision',
  CLARIFICATION_REQUIRED: 'Clarification Requested',
  RESUBMITTED: 'Resubmitted to TPA',
  APPROVED: 'TPA Approved ✓',
  PARTIAL_APPROVAL: 'Partially Approved',
  ADMISSION_READY: 'Ready for Admission',
  ADMITTED: 'Patient Admitted',
  SURGERY_SCHEDULED: 'Surgery Scheduled',
  SURGERY_COMPLETED: 'Surgery Completed',
  BILL_PENDING: 'Generating Bill',
  BILL_FINALIZED: 'Bill Finalized',
  CLAIM_READY: 'Claim Ready',
  CLAIM_SUBMITTED: 'Claim Submitted',
  CLAIM_IN_PROCESS: 'Processing Claim',
  SETTLEMENT_PENDING: 'Awaiting Payment',
  PARTIAL_SETTLEMENT: 'Partial Payment Received',
  FULL_SETTLEMENT: 'Fully Settled',
  RECONCILED: 'Reconciled',
  CLOSED: 'Case Closed',
};

interface Props {
  currentState: string;
}

export function CaseWorkflowStepper({ currentState }: Props) {
  const isTerminal = TERMINAL_STATES.has(currentState);

  if (isTerminal) {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <XCircle className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-red-700">
            {STATE_SUBLABELS[currentState] ?? currentState.replace(/_/g, ' ')}
          </p>
          <p className="text-xs text-red-400 mt-0.5">This case has been terminated and requires no further action.</p>
        </div>
      </div>
    );
  }

  const activePhaseIdx = PHASES.findIndex(p => (p.states as readonly string[]).includes(currentState));
  const activePhase = activePhaseIdx >= 0 ? PHASES[activePhaseIdx] : null;
  const sublabel = STATE_SUBLABELS[currentState] ?? currentState.replace(/_/g, ' ');

  return (
    <div className="space-y-3">
      {/* Step track */}
      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
        <ol className="flex items-center">
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            const isDone    = i < activePhaseIdx;
            const isCurrent = i === activePhaseIdx;
            const isLast    = i === PHASES.length - 1;

            return (
              <React.Fragment key={phase.key}>
                <li className="flex flex-col items-center flex-shrink-0 min-w-0">
                  {/* Circle */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                      isDone
                        ? 'bg-emerald-500 shadow-sm'
                        : isCurrent
                        ? `${phase.bg} ring-4 ${phase.ring} shadow-md`
                        : 'bg-white border-2 border-gray-200'
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-4.5 h-4.5 text-white" />
                    ) : (
                      <Icon className={`w-4.5 h-4.5 ${isCurrent ? 'text-white' : 'text-gray-300'}`} />
                    )}
                  </div>

                  {/* Label */}
                  <p className={`text-[11px] font-semibold mt-1.5 text-center leading-tight max-w-[56px] ${
                    isCurrent ? phase.text :
                    isDone    ? 'text-emerald-600' : 'text-gray-300'
                  }`}>
                    {phase.label}
                  </p>

                  {/* Step number */}
                  <p className={`text-[9px] mt-0.5 ${
                    isCurrent ? phase.text + ' font-bold' :
                    isDone    ? 'text-emerald-500' : 'text-gray-200'
                  }`}>
                    {`0${i + 1}`}
                  </p>
                </li>

                {!isLast && (
                  <div className={`flex-1 h-1 mx-2 mb-7 rounded-full transition-colors ${
                    i < activePhaseIdx ? 'bg-emerald-400' : 'bg-gray-100'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </ol>
      </div>

      {/* Contextual guidance banner */}
      {activePhase && (
        <div className={`flex items-center gap-3 ${activePhase.light} border ${activePhase.border} rounded-xl px-4 py-3`}>
          <div className={`w-7 h-7 rounded-lg ${activePhase.bg} flex items-center justify-center flex-shrink-0`}>
            <activePhase.icon className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className={`text-xs font-bold ${activePhase.text}`}>
              {activePhase.label} Phase — {sublabel}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{activePhase.guidance}</p>
          </div>
        </div>
      )}
    </div>
  );
}
