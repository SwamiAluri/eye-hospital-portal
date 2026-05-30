'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, CheckCircle2, XCircle, RefreshCw, ExternalLink, FileText,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import {
  createPolicyCapture,
  type CreatePolicyCaptureRequest,
} from '@/lib/api/ccms/ccms-eligibility.api';
import { parseCounsellorDraft } from '@/lib/api/ccms/parse-counsellor-draft';
import { VisitPolicyList } from '@/components/ccms/VisitPolicyList';
import { TabActionButton } from '@/components/ccms/TabActionButton';
import { useCcmsPermissions } from '@/hooks/useCcmsPermissions';
import { useCcmsCaseEligibilityChecks, useCcmsCasePolicyCapture } from '@/hooks/use-ccms-case';
const INTAKE_STATES = new Set([
  'DRAFT', 'ELIGIBILITY_PENDING', 'ELIGIBILITY_VERIFIED',
  'POLICY_CAPTURED', 'AUTHORIZATION_REQUIRED',
]);

interface Props {
  case_: CoverageCase;
  onRefresh: () => void;
  onVerifyEligibility: () => void;
}

export function CaseIntakePanel({ case_, onRefresh, onVerifyEligibility }: Props) {
  const perms = useCcmsPermissions();
  const draft = parseCounsellorDraft(case_.counsellorDraftJson);
  const intakeActive = INTAKE_STATES.has(case_.currentState);

  const checksQuery = useCcmsCaseEligibilityChecks(case_.id, intakeActive);
  const captureQuery = useCcmsCasePolicyCapture(case_.id, intakeActive);
  const checks = checksQuery.data ?? [];
  const checksLoading = checksQuery.isLoading;
  const capture = captureQuery.data ?? null;
  const captureLoading = captureQuery.isLoading;

  const [showCaptureForm, setShowCaptureForm] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);

  const [sumInsured, setSumInsured] = useState('');
  const [balanceSi, setBalanceSi] = useState('');
  const [roomEntitlement, setRoomEntitlement] = useState('');

  useEffect(() => {
    if (capture) {
      setSumInsured(String(capture.sumInsured ?? ''));
      setBalanceSi(String(capture.balanceSumInsured ?? ''));
      setRoomEntitlement(capture.roomEntitlement ?? '');
    } else {
      const si = draft?.sumInsured;
      if (si != null && si !== '') setSumInsured(String(si));
    }
  }, [capture, draft?.sumInsured]);
  if (!INTAKE_STATES.has(case_.currentState)) return null;

  const latestCheck = checks[0] ?? null;

  const canVerify = perms.can('ccms.eligibility.create') || perms.isWorkflowAdmin;
  const canCapture = perms.can('ccms.visit_policy.create') || perms.isWorkflowAdmin;
  const canManagePolicies = perms.canManagePolicies;

  const handlePolicyCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    const policyNumber = draft?.policyNumber?.trim();
    if (!policyNumber) {
      toast.error('Add a policy number (counsellor draft or visit policy) first');
      return;
    }
    const si = Number(sumInsured);
    const bal = Number(balanceSi);
    if (!si || si <= 0) {
      toast.error('Sum insured is required');
      return;
    }
    setCaptureBusy(true);
    try {
      const req: CreatePolicyCaptureRequest = {
        policyNumber,
        memberName: draft?.insuredName,
        sumInsured: si,
        balanceSumInsured: bal > 0 ? bal : si,
        cumulativeBonusAmount: 0,
        roomEntitlement: roomEntitlement || undefined,
      };
      await createPolicyCapture(case_.id, req);
      setShowCaptureForm(false);
      toast.success('Policy captured');
      onRefresh();    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to capture policy';
      toast.error(msg);
    } finally {
      setCaptureBusy(false);
    }
  };

  const inp = 'w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30';

  return (
    <div className="bg-white border border-indigo-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-indigo-50 bg-gradient-to-r from-indigo-50/80 to-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-500" />
          <div>
            <p className="text-sm font-bold text-gray-900">Intake</p>
            <p className="text-[10px] text-gray-400">Eligibility, policies, and coverage capture</p>
          </div>
        </div>
        {case_.sessionId && (
          <Link
            href={`/dashboard/counsellors-desk/${case_.sessionId}?tab=coverage`}
            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <ExternalLink className="w-3 h-3" /> Counsellor session
          </Link>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Eligibility */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Eligibility</p>
            {canVerify && (
              <TabActionButton onClick={onVerifyEligibility}>
                Verify Eligibility
              </TabActionButton>
            )}
          </div>
          {checksLoading ? (
            <div className="h-14 rounded-xl bg-gray-100 animate-pulse" />
          ) : latestCheck ? (
            <div className={`rounded-xl border p-3 flex items-start justify-between ${
              latestCheck.isEligible ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
            }`}>
              <div>
                <p className="text-xs font-semibold text-gray-800">{latestCheck.policyNumber}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {latestCheck.checkMethod} · {new Date(latestCheck.checkedAt).toLocaleString('en-IN')}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                latestCheck.isEligible ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}>
                {latestCheck.isEligible
                  ? <><CheckCircle2 className="w-3 h-3" /> Eligible</>
                  : <><XCircle className="w-3 h-3" /> Ineligible</>}
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic py-2">
              No eligibility check recorded. Use Verify Eligibility after policy details are on file.
            </p>
          )}
        </section>

        {/* Visit policies */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Visit Policies</p>
          <VisitPolicyList
            caseId={case_.id}
            sessionId={case_.sessionId}
            readOnly={!canManagePolicies}
            counsellorDraftJson={case_.counsellorDraftJson}
            onChanged={onRefresh}
          />
        </section>

        {/* Policy capture (sum insured) */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Policy Capture</p>
            {canCapture && !showCaptureForm && (
              <button
                type="button"
                onClick={() => setShowCaptureForm(true)}
                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {capture ? 'Update capture' : 'Capture policy'}
              </button>
            )}
          </div>
          {captureLoading ? (
            <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
          ) : capture && !showCaptureForm ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="text-xs"><span className="text-gray-500">Policy</span> <span className="font-semibold ml-1">{capture.policyNumber}</span></div>
              <div className="text-xs"><span className="text-gray-500">Sum insured</span> <span className="font-semibold ml-1">₹{capture.sumInsured.toLocaleString('en-IN')}</span></div>
              <div className="text-xs"><span className="text-gray-500">Balance SI</span> <span className="font-semibold ml-1">₹{capture.balanceSumInsured.toLocaleString('en-IN')}</span></div>
              {capture.roomEntitlement && (
                <div className="text-xs"><span className="text-gray-500">Room</span> <span className="font-semibold ml-1">{capture.roomEntitlement}</span></div>
              )}
            </div>
          ) : showCaptureForm ? (
            <form onSubmit={handlePolicyCapture} className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
              <p className="text-[10px] text-gray-500">Policy: <strong>{draft?.policyNumber ?? '—'}</strong></p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Sum Insured *</label>
                  <input value={sumInsured} onChange={e => setSumInsured(e.target.value)} className={inp} type="number" min="0" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Balance SI</label>
                  <input value={balanceSi} onChange={e => setBalanceSi(e.target.value)} className={inp} type="number" min="0" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Room entitlement</label>
                <input value={roomEntitlement} onChange={e => setRoomEntitlement(e.target.value)} className={inp} placeholder="e.g. Private" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCaptureForm(false)}
                  className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white text-gray-600">
                  Cancel
                </button>
                <button type="submit" disabled={captureBusy}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white disabled:opacity-50 flex items-center justify-center gap-1">
                  {captureBusy && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Save capture
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-gray-500 italic flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Record sum insured and balance after eligibility is verified.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
