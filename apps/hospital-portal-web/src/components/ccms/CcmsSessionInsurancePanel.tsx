'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, ExternalLink, HeartPulse, AlertCircle, RefreshCw } from 'lucide-react';
import { getCaseBySessionId, type CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { getStateLabel } from '@/lib/api/ccms/ccms-state-labels';
import { VisitPolicyList } from './VisitPolicyList';
import { UnderwritingPanel } from './UnderwritingPanel';

interface Props {
  sessionId: string;
}

type Tab = 'policies' | 'underwriting';

const POLL_MS = 30_000;
const ACTIVE_STATES = new Set([
  'DRAFT', 'ELIGIBILITY_PENDING', 'ELIGIBILITY_VERIFIED', 'POLICY_CAPTURED',
  'AUTHORIZATION_REQUIRED', 'PREAUTH_GENERATED', 'PREAUTH_SENT',
  'WAITING_APPROVAL', 'CLARIFICATION_REQUIRED', 'RESUBMITTED',
]);

export function CcmsSessionInsurancePanel({ sessionId }: Props) {
  const [ccmsCase, setCcmsCase]     = useState<CoverageCase | null>(null);
  const [loading,  setLoading]      = useState(true);
  const [error,    setError]        = useState<string | null>(null);
  const [tab,      setTab]          = useState<Tab>('policies');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const c = await getCaseBySessionId(sessionId);
      setCcmsCase(c ?? null);
    } catch (e) {
      setError((e as Error)?.message ?? 'Could not load CCMS case');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const state = ccmsCase?.currentState;
    if (!ccmsCase || !state || !ACTIVE_STATES.has(state)) return;
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [ccmsCase?.id, ccmsCase?.currentState, load]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        <div className="h-5 bg-gray-100 rounded w-1/3" />
        <div className="h-16 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="border border-indigo-100 rounded-2xl overflow-hidden">
      {/* CCMS case header */}
      <div className="bg-indigo-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-500" />
          <div>
            <p className="text-xs font-bold text-indigo-900">
              {ccmsCase ? `CCMS Case: ${ccmsCase.caseNumber}` : 'Coverage & Claims (CCMS)'}
            </p>
            {ccmsCase && (
              <p className="text-[10px] text-indigo-600">
                State: {getStateLabel(ccmsCase.currentState)}
              </p>
            )}
          </div>
        </div>
        {ccmsCase ? (
          <Link href={`/dashboard/ccms/cases/${ccmsCase.id}`}
            className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800">
            Open Case <ExternalLink className="w-3 h-3" />
          </Link>
        ) : (
          <button type="button" onClick={() => load()} className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-amber-700 bg-amber-50">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-100 flex">
        {(['policies', 'underwriting'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
              tab === t
                ? 'border-b-2 border-indigo-500 text-indigo-700 bg-white'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-white'
            }`}
          >
            {t === 'policies'
              ? <><Shield className="w-3 h-3" />Policies</>
              : <><HeartPulse className="w-3 h-3" />Underwriting</>
            }
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === 'policies' && (
          ccmsCase
            ? <VisitPolicyList caseId={ccmsCase.id} />
            : (
              <div className="text-center py-6">
                <Shield className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">
                  Policies are captured once a CCMS case is created for this session.
                </p>
                <p className="text-[10px] text-gray-300 mt-1">
                  Complete payment mode selection to trigger CCMS case creation.
                </p>
              </div>
            )
        )}
        {tab === 'underwriting' && (
          ccmsCase
            ? <UnderwritingPanel caseId={ccmsCase.id} />
            : (
              <div className="text-center py-6">
                <HeartPulse className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">
                  Underwriting data is linked to the primary insurance policy in a CCMS case.
                </p>
              </div>
            )
        )}
      </div>
    </div>
  );
}
