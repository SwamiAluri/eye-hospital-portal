'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Compass, ExternalLink } from 'lucide-react';
import { getCcmsNextStep, type CcmsTabKey } from '@/lib/ccms/ccms-next-step';
import { getStateLabel } from '@/lib/api/ccms/ccms-state-labels';

interface Props {
  currentState: string;
  sessionId?: string | null;
  activeTab: CcmsTabKey;
  onGoToTab: (tab: CcmsTabKey) => void;
  isWorkflowAdmin?: boolean;
}

export function CaseNextStepPanel({ currentState, sessionId, activeTab, onGoToTab, isWorkflowAdmin }: Props) {
  const step = getCcmsNextStep(currentState);
  if (!step) return null;

  const onTargetTab = activeTab === step.tab;
  const counsellorHref = sessionId
    ? `/dashboard/counsellors-desk/${sessionId}?tab=coverage&subtab=preauth`
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Compass className="w-3.5 h-3.5 text-indigo-400" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Next Step</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
            {getStateLabel(currentState)}
          </p>
          <p className="text-sm font-bold text-indigo-900 mt-0.5">{step.title}</p>
        </div>
        <p className="text-xs text-indigo-800/90 leading-relaxed">{step.instruction}</p>
        {step.actionHint && (
          <p className="text-[11px] text-indigo-600/80 font-medium">{step.actionHint}</p>
        )}

        {!onTargetTab && step.tab !== 'overview' && (
          <button
            type="button"
            onClick={() => onGoToTab(step.tab)}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Go to {step.tabLabel} tab
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {onTargetTab && (
          <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            You&apos;re on the right tab — use the actions above.
          </p>
        )}

        {counsellorHref && ['DRAFT', 'ELIGIBILITY_PENDING', 'ELIGIBILITY_VERIFIED', 'POLICY_CAPTURED', 'AUTHORIZATION_REQUIRED'].includes(currentState) && (
          <Link
            href={counsellorHref}
            className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 py-1.5"
          >
            Open Counsellor Coverage tab
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      <p className="text-[10px] text-gray-400 leading-snug px-0.5">
        Actions run from workflow tabs, not the sidebar.
        {isWorkflowAdmin
          ? ' Expand Workflow Admin below for recovery transitions.'
          : ' Contact a workflow admin if the case needs a manual state override.'}
      </p>
    </div>
  );
}
