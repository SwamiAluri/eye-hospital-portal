'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, ChevronDown, ChevronUp, User, Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi, mapDecision } from '@/lib/api/counselling-azure.api';
import { serviceCatalogApi, priceSuffix, flattenCatalog } from '@/lib/api/service-catalog.api';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import type { FullCatalogResponse, IolMasterDto, FlatVariantDto } from '@/lib/api/service-catalog.api';
import { useAuthStore } from '@/lib/auth-store';
import { usersApi } from '@/lib/api';
import { useConfirmation } from '@/components/common/ConfirmationDialog';
import { ScheduleSurgeryModal } from '@/components/counsellors-desk/ScheduleSurgeryModal';
import { SessionHistoryModal } from '@/components/counsellors-desk/SessionHistoryModal';
import type { CounsellingSession, ScheduleData, WaitingListStatus, SessionAuditEntry, DecisionType, MasterCatalogItem, InvestigationItem, CombinedPaymentType } from '@/types/counsellors-desk';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMasterValues } from '@/hooks/use-master-values';

const INSURANCE_COMPANY_FALLBACK = [
  'Star Health', 'HDFC Ergo', 'New India Assurance', 'United India',
  'Max Bupa', 'Care Health', 'SBI General', 'Oriental Insurance', 'ECHS', 'CGHS',
].map(name => ({ value: name, label: name }));
const PACKAGE_OPTIONS = ['Phaco Standard', 'Phaco Premium', 'LASIK Basic', 'LASIK Advanced', 'Retina Package', 'Cornea Package', 'Glaucoma Package'];
const INSURANCE_PAYMENT_TYPES: CombinedPaymentType[] = ['Insurance', 'CoPay', 'CGHS'];

function derivePaymentType(paymentMode: string, patientType: string): CombinedPaymentType | '' {
  const modeMap: Record<string, CombinedPaymentType> = {
    Cash: 'Cash', Card: 'Card', UPI: 'UPI',
    Insurance: 'Insurance', TPA: 'Insurance',
    Free: 'Free', Package: 'Package',
    CGHS: 'CGHS', SGHS: 'SGHS', ESH: 'ESH',
    Railway: 'Railway', Camp: 'Camp', Arograshree: 'Arograshree', CoPay: 'CoPay',
  };
  if (paymentMode && modeMap[paymentMode]) return modeMap[paymentMode];
  if (patientType === 'Staff') return 'Staff';
  if (patientType === 'Foreigner') return 'ForeignNational';
  return '';
}

interface NotesPanel {
  counsellor: boolean;
  patient: boolean;
  doctor: boolean;
}

// ── Coverage & Pre-Auth Panel ────────────────────────────────────────────────

function CoveragePreauthPanel({
  sessionId,
  paymentType,
  insuranceCompany,
  initialSubTab,
  refreshKey,
  patientId,
}: {
  sessionId: string;
  paymentType: string;
  insuranceCompany: string;
  initialSubTab?: 'eligibility' | 'preauth' | 'estimate' | 'status';
  refreshKey?: number;
  patientId?: string;
}) {
  const [activeSubTab, setActiveSubTab] = useState<'eligibility' | 'preauth' | 'estimate' | 'status'>(initialSubTab ?? 'eligibility');
  const [coverageCase, setCoverageCase] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');

  const loadCase = () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);
    import('@/lib/api/ccms/ccms-coverage-cases.api')
      .then(({ getCasesBySessionIds }) => getCasesBySessionIds([sessionId]))
      .then((list) => {
        setCoverageCase((list?.[0] as Record<string, unknown>) ?? null);
        setIsLoading(false);
      })
      .catch(e => { setError(String(e)); setIsLoading(false); });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCase(); }, [sessionId, refreshKey]);

  const handleCreateCase = async () => {
    if (!patientId) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const { createCoverageCase } = await import('@/lib/api/ccms/ccms-coverage-cases.api');
      await createCoverageCase({
        counselingSessionId: sessionId,
        patientId,
        payerType: paymentType,
        paymentType,
      });
      loadCase();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create coverage case — is CCMS running?');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEligibility = async (status: 'verified' | 'failed') => {
    if (!coverageCase) return;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const { recordEligibility } = await import('@/lib/api/ccms/ccms-coverage-cases.api');
      const updated = await recordEligibility(String(coverageCase.id), {
        eligibilityStatus: status,
        notes: verifyNotes || undefined,
      });
      setCoverageCase(updated as unknown as Record<string, unknown>);
      setVerifyNotes('');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setVerifyError(err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message ?? 'Failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const subTabs = [
    { key: 'eligibility' as const, label: 'Eligibility & Policy' },
    { key: 'preauth' as const,     label: 'Pre-Authorization' },
    { key: 'estimate' as const,    label: 'Coverage Estimate' },
    { key: 'status' as const,      label: 'Authorization Status' },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeSubTab === tab.key
                ? 'bg-indigo-100 text-indigo-700 border border-b-0 border-indigo-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading coverage details…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Could not connect to CCMS service. {error}
        </div>
      )}

      {!isLoading && !error && !coverageCase && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">No coverage case found for this session.</p>
          <p className="text-xs text-amber-600 mb-3">
            Save the session with an insurance/TPA payment type to auto-create a case, or create one manually below.
          </p>
          {createError && (
            <p className="text-xs text-red-600 mb-2">{createError}</p>
          )}
          <button
            type="button"
            onClick={handleCreateCase}
            disabled={isCreating || !patientId}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isCreating ? 'Creating…' : 'Create Coverage Case'}
          </button>
        </div>
      )}

      {!isLoading && !error && coverageCase && (
        <>
          {/* Case header */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-4 text-sm">
            <div>
              <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Case Number</p>
              <p className="font-bold text-indigo-900">{String(coverageCase.caseNumber ?? '—')}</p>
            </div>
            <div>
              <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">State</p>
              <p className="font-semibold text-indigo-900">{String(coverageCase.currentState ?? '—')}</p>
            </div>
            <div>
              <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Payer</p>
              <p className="font-semibold text-indigo-900">{paymentType || insuranceCompany || '—'}</p>
            </div>
            {coverageCase.approvedAmount && Number(coverageCase.approvedAmount) > 0 && (
              <div>
                <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Approved Amount</p>
                <p className="font-bold text-green-700">₹{Number(coverageCase.approvedAmount).toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>

          {/* Sub-tab content */}
          {activeSubTab === 'eligibility' && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 text-sm">
              <p className="font-semibold text-gray-800">Eligibility & Policy Details</p>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-gray-400">Payment Type:</span> <span className="font-medium ml-1">{paymentType}</span></div>
                <div><span className="text-gray-400">Insurance/TPA:</span> <span className="font-medium ml-1">{insuranceCompany || '—'}</span></div>
                <div><span className="text-gray-400">Policy No:</span> <span className="font-mono ml-1">{String((coverageCase as Record<string, unknown>).policyNumber ?? '—')}</span></div>
                <div><span className="text-gray-400">Membership ID:</span> <span className="font-mono ml-1">{String((coverageCase as Record<string, unknown>).membershipNumber ?? '—')}</span></div>
                <div><span className="text-gray-400">Case ID:</span> <span className="font-mono text-xs ml-1">{String(coverageCase.id ?? '—')}</span></div>
                <div><span className="text-gray-400">Financial Year:</span> <span className="font-medium ml-1">2025-26</span></div>
              </div>

              {/* ── STEP 1: DRAFT — initiate check ── */}
              {String(coverageCase.currentState) === 'DRAFT' && (
                <div className="border border-indigo-100 rounded-lg p-3 space-y-3 bg-indigo-50">
                  <p className="text-xs font-semibold text-indigo-800">Step 1 of 2 — Initiate Eligibility Check</p>
                  <p className="text-xs text-indigo-600">Contact the TPA/insurer to verify the patient's coverage. Once confirmed, record the outcome here.</p>
                  <textarea
                    className="w-full text-xs border border-indigo-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                    rows={2}
                    placeholder="Notes (optional)"
                    value={verifyNotes}
                    onChange={e => setVerifyNotes(e.target.value)}
                  />
                  {verifyError && <p className="text-xs text-red-600">{verifyError}</p>}
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleEligibility('verified')}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isVerifying ? 'Submitting…' : 'Send for Eligibility Check →'}
                  </button>
                </div>
              )}

              {/* ── STEP 2: ELIGIBILITY_PENDING — record TPA response ── */}
              {String(coverageCase.currentState) === 'ELIGIBILITY_PENDING' && (
                <div className="border border-amber-200 rounded-lg p-3 space-y-3 bg-amber-50">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-800">⏳ Awaiting TPA Response</span>
                    <span className="text-xs text-amber-700">Step 2 of 2 — Record the TPA's eligibility decision</span>
                  </div>
                  <textarea
                    className="w-full text-xs border border-amber-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                    rows={2}
                    placeholder="Notes (optional — e.g. TPA ref number, conditions)"
                    value={verifyNotes}
                    onChange={e => setVerifyNotes(e.target.value)}
                  />
                  {verifyError && <p className="text-xs text-red-600">{verifyError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleEligibility('verified')}
                      className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {isVerifying ? 'Saving…' : '✓ TPA Confirmed Eligible'}
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleEligibility('failed')}
                      className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {isVerifying ? 'Saving…' : '✕ TPA Declined / Ineligible'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Verified ── */}
              {String(coverageCase.currentState) === 'ELIGIBILITY_VERIFIED' && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <span className="text-lg">✓</span>
                  <div>
                    <p className="text-xs font-bold text-green-700">Eligibility Verified</p>
                    <p className="text-xs text-green-600 mt-0.5">Patient is eligible. Proceed to the <button type="button" className="underline font-semibold" onClick={() => setActiveSubTab('preauth')}>Pre-Authorization tab</button> to generate pre-auth.</p>
                  </div>
                </div>
              )}

              {/* ── Rejected ── */}
              {String(coverageCase.currentState) === 'REJECTED' && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <span className="text-lg">✕</span>
                  <div>
                    <p className="text-xs font-bold text-red-700">Eligibility Failed / Case Rejected</p>
                    <p className="text-xs text-red-600 mt-0.5">This case has been closed. Create a new coverage case if the patient wishes to re-apply.</p>
                  </div>
                </div>
              )}

              {/* ── Any other active state (past eligibility) ── */}
              {!['DRAFT','ELIGIBILITY_PENDING','ELIGIBILITY_VERIFIED','REJECTED'].includes(String(coverageCase.currentState)) && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">✓ Eligibility Verified</span>
                  <span className="text-xs text-gray-500">Case is now in <span className="font-semibold">{String(coverageCase.currentState)}</span> stage.</span>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'preauth' && (
            <PreAuthTab
              coverageCase={coverageCase}
              onStateChange={updated => setCoverageCase(updated as unknown as Record<string, unknown>)}
            />
          )}

          {activeSubTab === 'estimate' && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-800 mb-2">Coverage Estimate</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-gray-400">Approved Amount:</span>
                  <span className="font-bold text-green-700 ml-1">
                    ₹{Number(coverageCase.approvedAmount ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div><span className="text-gray-400">Room Class Approved:</span>
                  <span className="font-medium ml-1">{String(coverageCase.roomClassApproved ?? '—')}</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-400">Detailed billing allocation is computed when the final bill is generated.</p>
            </div>
          )}

          {activeSubTab === 'status' && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 text-sm">
              <p className="font-semibold text-gray-800">Authorization Status</p>

              {/* State + approval summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400">Current State:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                    String(coverageCase.currentState).includes('APPROVED') ? 'bg-green-100 text-green-700' :
                    String(coverageCase.currentState).includes('REJECT') ? 'bg-red-100 text-red-700' :
                    String(coverageCase.currentState).includes('WAITING') ? 'bg-amber-100 text-amber-700' :
                    String(coverageCase.currentState).includes('CLARIF') ? 'bg-orange-100 text-orange-700' :
                    String(coverageCase.currentState).includes('EXPIRED') ? 'bg-gray-200 text-gray-600' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {String(coverageCase.currentState ?? '—')}
                  </span>
                </div>
                <div><span className="text-gray-400">Pre-Auth No:</span> <span className="font-mono ml-1">{String((coverageCase as Record<string,unknown>).preAuthNumber ?? '—')}</span></div>
                <div><span className="text-gray-400">Approved Amount:</span>
                  <span className={`font-bold ml-1 ${
                    Number((coverageCase as Record<string,unknown>).approvedAmount ?? 0) > 0 ? 'text-green-700' : 'text-gray-500'
                  }`}>
                    {Number((coverageCase as Record<string,unknown>).approvedAmount ?? 0) > 0
                      ? `₹${Number((coverageCase as Record<string,unknown>).approvedAmount).toLocaleString('en-IN')}`
                      : '—'}
                  </span>
                </div>
                <div><span className="text-gray-400">Room Class:</span> <span className="font-medium ml-1">{String((coverageCase as Record<string,unknown>).roomClassApproved ?? '—')}</span></div>
                <div><span className="text-gray-400">Valid Until:</span>
                  <span className="font-medium ml-1">
                    {(coverageCase as Record<string,unknown>).preAuthExpiry
                      ? new Date(String((coverageCase as Record<string,unknown>).preAuthExpiry)).toLocaleDateString('en-IN')
                      : '—'}
                  </span>
                </div>
              </div>

              {/* State-specific guidance */}
              {String(coverageCase.currentState) === 'WAITING_APPROVAL' && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Pre-auth sent to TPA. Awaiting their decision. Record the TPA response in the CCMS Pre-Auth Queue once received.
                </p>
              )}
              {String(coverageCase.currentState) === 'CLARIFICATION_REQUIRED' && (
                <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
                  TPA has requested clarification. Provide the required documents/information and resubmit via the CCMS module.
                </p>
              )}
              {(String(coverageCase.currentState) === 'APPROVED' || String(coverageCase.currentState) === 'PARTIAL_APPROVAL') && (
                <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  Pre-authorization approved. Patient can be admitted. Admission will be validated against the approved amount.
                </p>
              )}
              {String(coverageCase.currentState) === 'REJECTED' && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  Pre-authorization rejected by TPA. Patient must self-pay or a new pre-auth must be initiated.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Pre-Authorization inline component ──────────────────────────────────────
// States that can generate a new pre-auth
const PRE_AUTH_ELIGIBLE_STATES = ['ELIGIBILITY_VERIFIED', 'POLICY_CAPTURED', 'AUTHORIZATION_REQUIRED'];
// States where pre-auth exists but hasn't been sent yet
const PRE_AUTH_GENERATED_STATES = ['PREAUTH_GENERATED'];
// States where pre-auth is sent / waiting
const PRE_AUTH_SENT_STATES = ['PREAUTH_SENT', 'WAITING_APPROVAL', 'CLARIFICATION_REQUIRED', 'RESUBMITTED'];
// Terminal approval states
const PRE_AUTH_TERMINAL_STATES = ['APPROVED', 'PARTIAL_APPROVAL', 'REJECTED', 'EXPIRED', 'CANCELLED', 'ABORTED', 'CLOSED'];

function PreAuthTab({
  coverageCase,
  onStateChange,
}: {
  coverageCase: Record<string, unknown>;
  onStateChange: (updated: Record<string, unknown>) => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tpaRef, setTpaRef] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');

  const state = String(coverageCase.currentState ?? '');
  const preAuthNumber = String(coverageCase.preAuthNumber ?? '');
  const approvedAmount = Number(coverageCase.approvedAmount ?? 0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenError(null);
    try {
      const { getCcmsApi } = await import('@/lib/api/ccms/ccms-base');
      const { data } = await getCcmsApi().post(`/ccms/coverage-cases/${String(coverageCase.id)}/authorization`, {
        requestedAmount: requestedAmount ? parseFloat(requestedAmount) : 0,
        roomClassRequested: null,
        diagnosisJson: null,
        proceduresJson: null,
      });
      // Re-fetch case to get updated state
      const { data: updated } = await getCcmsApi().get(`/ccms/coverage-cases/${String(coverageCase.id)}`);
      onStateChange(updated);
      void data; // suppress unused var
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setGenError(err?.response?.data?.error ?? err?.message ?? 'Failed to generate pre-auth');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const { getCcmsApi } = await import('@/lib/api/ccms/ccms-base');
      // Get the latest authorization for this case
      const { data: auths } = await getCcmsApi().get(`/ccms/coverage-cases/${String(coverageCase.id)}/authorization`);
      const latest = Array.isArray(auths) ? auths[0] : null;
      if (!latest?.id) throw new Error('No pre-authorization found for this case.');

      await getCcmsApi().post(`/ccms/authorizations/${String(latest.id)}/submit`, {
        tpaReferenceNumber: tpaRef || null,
      });
      const { data: updated } = await getCcmsApi().get(`/ccms/coverage-cases/${String(coverageCase.id)}`);
      onStateChange(updated);
      setTpaRef('');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setSubmitError(err?.response?.data?.error ?? err?.message ?? 'Failed to submit pre-auth');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 text-sm">
      <p className="font-semibold text-gray-800">Pre-Authorization</p>

      {/* ── Cannot start until eligibility verified ── */}
      {!PRE_AUTH_ELIGIBLE_STATES.includes(state) &&
       !PRE_AUTH_GENERATED_STATES.includes(state) &&
       !PRE_AUTH_SENT_STATES.includes(state) &&
       !PRE_AUTH_TERMINAL_STATES.includes(state) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500">
          Pre-authorization can only be generated after eligibility is verified.<br />
          Current state: <span className="font-semibold text-gray-700">{state || '—'}</span>
        </div>
      )}

      {/* ── Step 1: Generate pre-auth ── */}
      {PRE_AUTH_ELIGIBLE_STATES.includes(state) && (
        <div className="border border-indigo-100 rounded-lg p-3 space-y-3 bg-indigo-50">
          <p className="text-xs font-semibold text-indigo-800">Step 1 of 2 — Generate Pre-Authorization Document</p>
          <p className="text-xs text-indigo-600">This will generate a pre-auth request document for submission to the TPA/insurer.</p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Requested Amount (₹)</label>
            <input
              type="number"
              className="w-full text-xs border border-indigo-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
              placeholder="e.g. 85000"
              value={requestedAmount}
              onChange={e => setRequestedAmount(e.target.value)}
            />
          </div>
          {genError && <p className="text-xs text-red-600">{genError}</p>}
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? 'Generating…' : 'Generate Pre-Auth Document →'}
          </button>
        </div>
      )}

      {/* ── Step 2: Send to TPA ── */}
      {PRE_AUTH_GENERATED_STATES.includes(state) && (
        <div className="border border-amber-200 rounded-lg p-3 space-y-3 bg-amber-50">
          <p className="text-xs font-semibold text-amber-800">Step 2 of 2 — Send Pre-Auth to TPA</p>
          <p className="text-xs text-amber-700">Pre-auth document is ready. Submit it to the TPA/insurer (via portal, email, or in person).</p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">TPA Reference Number (optional)</label>
            <input
              type="text"
              className="w-full text-xs border border-amber-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
              placeholder="TPA portal ref / submission ID"
              value={tpaRef}
              onChange={e => setTpaRef(e.target.value)}
            />
          </div>
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Submitting…' : '✉ Mark as Sent to TPA'}
          </button>
        </div>
      )}

      {/* ── Sent / Waiting ── */}
      {PRE_AUTH_SENT_STATES.includes(state) && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <span className="text-lg">⏳</span>
            <div>
              <p className="text-xs font-bold text-amber-700">Pre-Auth Submitted — Awaiting TPA Decision</p>
              <p className="text-xs text-amber-600 mt-0.5">State: <span className="font-semibold">{state}</span></p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-gray-400">Pre-Auth No:</span> <span className="font-mono ml-1">{preAuthNumber || '—'}</span></div>
            <div><span className="text-gray-400">Approved Amount:</span> <span className="font-medium ml-1">{approvedAmount > 0 ? `₹${approvedAmount.toLocaleString('en-IN')}` : 'Pending'}</span></div>
          </div>
          <p className="text-xs text-gray-400">Once the TPA responds, record their decision in the CCMS → Approvals queue. The status here will update automatically.</p>
        </div>
      )}

      {/* ── Approved ── */}
      {(state === 'APPROVED' || state === 'PARTIAL_APPROVAL') && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <span className="text-lg">✓</span>
          <div>
            <p className="text-xs font-bold text-green-700">{state === 'APPROVED' ? 'Pre-Auth Approved' : 'Partial Approval Received'}</p>
            <div className="text-xs text-green-600 mt-1 space-y-0.5">
              {preAuthNumber && <p>Pre-Auth No: <span className="font-mono font-semibold">{preAuthNumber}</span></p>}
              {approvedAmount > 0 && <p>Approved Amount: <span className="font-semibold">₹{approvedAmount.toLocaleString('en-IN')}</span></p>}
              {(coverageCase as Record<string,unknown>).preAuthExpiry && (
                <p>Valid Until: <span className="font-semibold">{new Date(String((coverageCase as Record<string,unknown>).preAuthExpiry)).toLocaleDateString('en-IN')}</span></p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Rejected / Expired ── */}
      {(state === 'REJECTED' || state === 'EXPIRED') && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <span className="text-lg">✗</span>
          <div>
            <p className="text-xs font-bold text-red-700">{state === 'EXPIRED' ? 'Pre-Authorization Expired' : 'Pre-Authorization Rejected'}</p>
            <p className="text-xs text-red-600 mt-0.5">A new coverage case must be created to initiate a fresh pre-auth request.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status badge config (outside component, plain object to avoid SWC TSX ambiguity) ──
const STATUS_BADGE_MAP = {
  Pending:           { label: 'Pending',            cls: 'bg-yellow-400 text-yellow-900' },
  Processed:         { label: 'Processing',          cls: 'bg-sky-300 text-sky-900' },
  Done:              { label: 'Done',                cls: 'bg-green-400 text-green-900' },
  AddOnSurgery:      { label: 'Add-On Surgery',      cls: 'bg-purple-400 text-purple-900' },
  RepeatCounselling: { label: 'Repeat Counselling',  cls: 'bg-orange-400 text-orange-900' },
  SurgeryDone:       { label: 'Surgery Done',         cls: 'bg-teal-400 text-teal-900' },
} as const;

function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CounsellingSessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const { showConfirmation, ConfirmationComponent } = useConfirmation();

  // Insurance providers from master data (falls back to hardcoded list if API unavailable)
  const { options: insuranceProviderOptions } = useMasterValues('insurance.provider', INSURANCE_COMPANY_FALLBACK);

  const [session, setSession] = useState<CounsellingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Deep-link support: ?tab=coverage&subtab=preauth (e.g. from waiting-list "Start Pre-Auth" button)
  const tabParam = searchParams.get('tab') as 'counselling' | 'coverage' | null;
  const subtabParam = searchParams.get('subtab') as 'eligibility' | 'preauth' | 'estimate' | 'status' | null;
  const [activeMainTab, setActiveMainTab] = useState<'counselling' | 'coverage'>(tabParam ?? 'counselling');

  // Form state (mirrors CounsellingSession fields)
  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedEye, setSelectedEye] = useState<'RE' | 'LE' | 'BE'>('RE');
  const [paymentType, setPaymentType] = useState<CombinedPaymentType | ''>('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [freeSurgeryReason, setFreeSurgeryReason] = useState('');
  const [packageName, setPackageName] = useState('');
  const [packageRate, setPackageRate] = useState<number | ''>('');
  const [showPackageEdit, setShowPackageEdit] = useState(false);
  const savedSnapshotRef = useRef<Record<string, string>>({});
  const [decision, setDecision] = useState<DecisionType | ''>('');
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [counsellorNotes, setCounsellorNotes] = useState('');
  const [patientRemarks, setPatientRemarks] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [wantToSeeDoctor, setWantToSeeDoctor] = useState(false);
  const [interestedToUpgrade, setInterestedToUpgrade] = useState(false);
  const [notRequiredPreAuth, setNotRequiredPreAuth] = useState(false);

  // Investigations state
  const [masterCatalog, setMasterCatalog] = useState<{ imaging: MasterCatalogItem[]; scan: MasterCatalogItem[]; lab: MasterCatalogItem[] }>({ imaging: [], scan: [], lab: [] });
  const [selectedInvestigations, setSelectedInvestigations] = useState<Map<string, InvestigationItem>>(new Map());
  const [invTab, setInvTab] = useState<'imaging_orders' | 'required_investigations'>('imaging_orders');
  const [invExpanded, setInvExpanded] = useState(false);
  const [procExpanded, setProcExpanded] = useState(true);

  // Procedure Counseling state
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [catalog, setCatalog] = useState<FullCatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [selectedIolId, setSelectedIolId] = useState<string | null>(null);
  const [iolOptions, setIolOptions] = useState<IolMasterDto[]>([]);
  // Sub-option for the selected variant (staff-only, required when sub-options exist)
  const [variantSubOption, setVariantSubOption] = useState<string | null>(null);

  // Price override state
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [overridePrice, setOverridePrice] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideRemarks, setOverrideRemarks] = useState('');
  const [overrideRequesterType, setOverrideRequesterType] = useState<'SELF' | 'STAFF'>('SELF');
  const [overrideStaffName, setOverrideStaffName] = useState('');
  const [overrideStaffContact, setOverrideStaffContact] = useState('');
  const [staffList, setStaffList] = useState<{ id: string; firstName: string; lastName: string; email?: string; phoneNumber?: string }[]>([]);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState('');
  const [savedOverrides, setSavedOverrides] = useState<PriceOverrideRecord[]>([]);
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);

  // Required Investigations urgency mode
  const [urgencyMode, setUrgencyMode] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');

  // Search filters for procedures / imaging / investigations
  const [procSearch, setProcSearch] = useState('');
  const [imagingSearch, setImagingSearch] = useState('');
  const [labSearch, setLabSearch] = useState('');

  const [openNotes, setOpenNotes] = useState<NotesPanel>({ counsellor: false, patient: false, doctor: false });
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [coverageRefreshKey, setCoverageRefreshKey] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  // GAP 1 & 2: status visibility + lock
  const [queueStatus, setQueueStatus] = useState<WaitingListStatus>('Pending');
  // GAP 3: follow-up tracking
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  // GAP 5: package change detection
  const [originalPackageName, setOriginalPackageName] = useState<string | null>(null);
  // GAP 7: history modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<SessionAuditEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const historyBtnRef = useRef<HTMLButtonElement>(null);
  // Tracks whether this session had surgery done — used to skip lock/unlock and enforce read-only
  const isSurgeryDoneRef = useRef(false);
  // OT record for this session — fetched at load when Done, needed to call editOtScheduleSlot on re-save
  const [existingOtScheduleId, setExistingOtScheduleId] = useState<string | null>(null);

  // Track dirty state
  const markDirty = () => setIsDirty(true);

  // Computed grand total: variant price (or override) + IOL + imaging + lab.
  // Used as fallback for packageAmount when package_amount was never persisted to DB.
  const computedGrandTotal = useMemo(() => {
    const summaryVariant = catalog ? flattenCatalog(catalog).find(v => v.id === selectedVariantId) : null;
    const displayPrice = summaryVariant
      ? (savedOverrides.length > 0 ? savedOverrides[0].overriddenPrice : summaryVariant.price)
      : 0;
    const iolPrice = iolOptions.find(i => i.id === selectedIolId)?.price ?? 0;
    const allInv = Array.from(selectedInvestigations.values());
    const imagingTotal = allInv.filter(i => i.testType === 'Imaging' || i.testType === 'Scan').reduce((s, i) => s + i.price, 0);
    const labTotal    = allInv.filter(i => i.testType !== 'Imaging' && i.testType !== 'Scan').reduce((s, i) => s + i.price, 0);
    return displayPrice + iolPrice + imagingTotal + labTotal;
  }, [catalog, selectedVariantId, savedOverrides, iolOptions, selectedIolId, selectedInvestigations]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await counsellorsDeskApi.getSession(sessionId);
        setSession(data);
        // DEBUG — remove after confirming restore works
        console.log('[page load] data.selectedSurgeryId:', data.selectedSurgeryId);
        // Populate form from loaded session
        setSelectedSurgeryId(data.selectedSurgeryId ?? null);
        // Restore variantId + eye from saved surgeryId (format: "type-{variantId}-{eye}")
        if (data.selectedSurgeryId?.startsWith('type-')) {
          const withoutPrefix = data.selectedSurgeryId.slice(5);
          const eyeMatch = withoutPrefix.match(/-(RE|LE|BE)$/);
          if (eyeMatch) {
            const variantId = withoutPrefix.slice(0, -eyeMatch[0].length);
            console.log('[page load] parsed variantId:', variantId, 'eye:', eyeMatch[1]);
            setSelectedVariantId(variantId);
            setSelectedEye(eyeMatch[1] as 'RE' | 'LE' | 'BE');
          }
        } else if (data.restoredEye && data.restoredEye !== 'RE') {
          // No saved selection yet — still restore the correct eye axis from surgeryTentativeEye
          // so the catalog shows the right eye without the user having to switch manually.
          setSelectedEye(data.restoredEye as 'RE' | 'LE' | 'BE');
        }
        const derivedPT = derivePaymentType(data.paymentMode ?? '', data.patientType ?? '');
        setPaymentType(derivedPT);
        setInsuranceCompany(
          data.insuranceCompany ?? (INSURANCE_PAYMENT_TYPES.includes(derivedPT as CombinedPaymentType)
            ? (data.company ?? '') : '')
        );
        setFreeSurgeryReason(data.freeSurgeryReason);
        setVariantSubOption(data.variantSubOption ?? null);
        setPackageName(data.packageName);
        setPackageRate(data.packageRate);
        setDecision(data.decision);
        setSchedule(data.schedule);
        setCounsellorNotes(data.counsellorNotes);
        setPatientRemarks(data.patientRemarks);
        setDoctorNotes(data.doctorNotes);
        setWantToSeeDoctor(data.wantToSeeDoctor);
        setInterestedToUpgrade(data.interestedToUpgrade);
        setNotRequiredPreAuth(data.notRequiredPreAuth);
        // GAP 1: status from queue data
        setQueueStatus((data.status as WaitingListStatus) || 'Pending');
        setFollowUpReason(data.followUpReason ?? '');
        setFollowUpDate(data.followUpDate ?? '');
        setOriginalPackageName(data.packageName || null);
        // Pre-load existing OT record ID for Done sessions (needed to call editOtScheduleSlot on re-save)
        if ((data.status as string) === 'Done') {
          counsellorsDeskApi.getFinalizeList({ uhid: data.uhid })
            .then(otRecs => {
              const hit = otRecs.find(r => r.counsellingSessionId === sessionId);
              if (hit) setExistingOtScheduleId(hit.id);
            })
            .catch(() => { /* non-critical */ });
        }
        // Merge Azure counselling record: restores decision, schedule, package, variantId/eye,
        // and payment details for sessions where auth-service doesn't persist them.
        try {
          const azureRecord = await counsellingAzureApi.getRecord(sessionId);
          if (azureRecord) {
            // Restore decision only when auth-service didn't return one
            if (!data.decision && azureRecord.decisionType) {
              const uiDecision: DecisionType =
                azureRecord.decisionType === 'NotInterested' ? 'NotInterested'
                : azureRecord.decisionType === 'NeedsTime' ? 'NeedsTime'
                : 'DateForSurgery';
              setDecision(uiDecision);
            }
            // Restore scheduled date
            if (!data.schedule && azureRecord.scheduledDate) {
              setSchedule({ selectedDate: azureRecord.scheduledDate.split('T')[0], operationTheatre: '', doctor: '', surgeryStartTime: '', avoidTimeFrom: '', avoidTimeTo: '' });
            }
            // Restore fields packed in the packageDetails JSON blob
            if (azureRecord.packageDetails) {
              try {
                const pkg = JSON.parse(azureRecord.packageDetails);
                if (pkg.name && !data.packageName) setPackageName(pkg.name);
                if (pkg.rate && !data.packageRate) setPackageRate(Number(pkg.rate) || '');
                if (pkg.paymentType && !data.paymentMode) setPaymentType(pkg.paymentType as CombinedPaymentType);
                if (pkg.insuranceCompany && !data.insuranceCompany) setInsuranceCompany(pkg.insuranceCompany);
                if (pkg.variantId && !data.selectedSurgeryId) {
                  const eye = (pkg.eye ?? 'RE') as 'RE' | 'LE' | 'BE';
                  setSelectedVariantId(pkg.variantId);
                  setSelectedEye(eye);
                  setSelectedSurgeryId(`type-${pkg.variantId}-${eye}`);
                }
              } catch { /* ignore invalid packageDetails JSON */ }
            }
            // Fallback to top-level columns when blob doesn't carry them
            if (azureRecord.paymentType && !data.paymentMode) setPaymentType(azureRecord.paymentType as CombinedPaymentType);
            if (azureRecord.insuranceCompany && !data.insuranceCompany) setInsuranceCompany(azureRecord.insuranceCompany);
            // followUp fields from Azure only when auth-service returned empty
            if (azureRecord.followUpDate && !data.followUpDate) setFollowUpDate(azureRecord.followUpDate);
            if (azureRecord.followUpReason && !data.followUpReason) setFollowUpReason(azureRecord.followUpReason);
          }
        } catch { /* non-critical — Azure may be offline, session still loads */ }
        // Initialize saved snapshot for field-level diff tracking on save
        savedSnapshotRef.current = {
          paymentType: derivePaymentType(data.paymentMode ?? '', data.patientType ?? ''),
          insuranceCompany: data.insuranceCompany ?? (INSURANCE_PAYMENT_TYPES.includes(derivePaymentType(data.paymentMode ?? '', data.patientType ?? '') as CombinedPaymentType) ? (data.company ?? '') : ''),
          decision: data.decision ?? '',
          followUpReason: data.followUpReason ?? '',
          followUpDate: data.followUpDate ?? '',
          counsellorNotes: data.counsellorNotes ?? '',
          patientRemarks: data.patientRemarks ?? '',
          doctorNotes: data.doctorNotes ?? '',
          wantToSeeDoctor: String(data.wantToSeeDoctor ?? false),
          interestedToUpgrade: String(data.interestedToUpgrade ?? false),
          notRequiredPreAuth: String(data.notRequiredPreAuth ?? false),
          selectedSurgeryId: data.selectedSurgeryId ?? '',
          selectedEye: 'RE',
          packageName: data.packageName ?? '',
          packageRate: String(data.packageRate ?? ''),
          schedule: data.schedule?.selectedDate ?? '',
        };
        // GAP 10: auto-transition status Pending → Processed when the counsellor first opens.
        // Skip for Done / RepeatCounselling / AddOnSurgery — those need explicit intent.
        if (data.status === 'Pending') {
          counsellorsDeskApi.startSession(sessionId);
        }
        // GAP 2: acquire session lock — skip for SurgeryDone (permanently read-only)
        if ((data.status as string) !== 'SurgeryDone') {
          isSurgeryDoneRef.current = false;
          counsellingAzureApi.lock(sessionId);
        } else {
          isSurgeryDoneRef.current = true;
        }
        // Load existing price overrides for this session
        try {
          const overrides = await counsellingAzureApi.getPriceOverrides(sessionId);
          setSavedOverrides(overrides);
        } catch { /* non-critical */ }
      } catch {
        toast.error('Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [sessionId]);

  // Remove a saved price override (soft-delete)
  const handleRemoveOverride = async (overrideId: string) => {
    try {
      await counsellingAzureApi.removePriceOverride(sessionId, overrideId);
      setSavedOverrides(prev => prev.filter(o => o.id !== overrideId));
    } catch {
      toast.error('Failed to remove override');
    }
  };

  // Pre-fill the override form for editing an existing record
  const handleEditOverride = (ov: PriceOverrideRecord) => {
    setEditingOverrideId(ov.id);
    setOverridePrice(String(ov.overriddenPrice));
    setOverrideReason(ov.reason);
    setOverrideRemarks(ov.remarks ?? '');
    setShowOverridePanel(true);
    setOverrideError('');
  };

  // Load master catalog once
  useEffect(() => {
    counsellorsDeskApi.getMasterCatalog().then(setMasterCatalog);
  }, []);

  // Load service catalog for procedure filter chips
  const loadCatalog = () => {
    setCatalogLoading(true);
    setCatalogError(false);
    serviceCatalogApi.getFullCatalog()
      .then((data) => { setCatalog(data); setCatalogLoading(false); })
      .catch(() => { setCatalogLoading(false); setCatalogError(true); });
  };
  useEffect(() => { loadCatalog(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load IOL options when a variant with IOL options is selected
  useEffect(() => {
    if (!selectedVariantId || !catalog) { setIolOptions([]); return; }
    const variant = flattenCatalog(catalog).find((v) => v.id === selectedVariantId);
    if (!variant?.hasIolOptions) { setIolOptions([]); setSelectedIolId(null); return; }
    serviceCatalogApi.getVariantIolOptions(selectedVariantId).then(setIolOptions).catch(() => setIolOptions([]));
    setSelectedIolId(null);
  }, [selectedVariantId, catalog]);

  // Pre-populate investigations from session when it loads
  useEffect(() => {
    if (!session) return;
    const map = new Map<string, InvestigationItem>();
    if (session.investigations && session.investigations.length > 0) {
      // Build a name → catalogId lookup from masterCatalog to handle DB rows with null catalogId
      // (e.g. rows that were seeded or saved before catalogId tracking was added).
      const allCatalogItems = [...masterCatalog.imaging, ...masterCatalog.scan, ...masterCatalog.lab];
      const nameToId = new Map<string, string>(allCatalogItems.map(c => [c.name.toLowerCase().trim(), c.id]));
      session.investigations.forEach((inv) => {
        // Prefer explicit catalogId; fall back to name-based lookup; last resort: order row id
        const resolvedCatalogId = inv.catalogId
          ?? nameToId.get(inv.testName?.toLowerCase().trim() ?? '')
          ?? inv.id;
        if (resolvedCatalogId) map.set(resolvedCatalogId, { ...inv, catalogId: inv.catalogId ?? resolvedCatalogId });
      });
      setSelectedInvestigations(map);
      setInvExpanded(true);
    } else if (session.suggestedPreOpTests && session.suggestedPreOpTests.length > 0) {
      session.suggestedPreOpTests.forEach((item) => {
        map.set(item.id, {
          catalogId: item.id,
          testName: item.name,
          testCode: item.code,
          testType: item.testType,
          price: item.price,
          urgency: 'Routine',
          source: 'doctor',
        });
      });
      setSelectedInvestigations(map);
      setInvExpanded(true);
    }
  }, [session, masterCatalog]);

  // Unsaved changes guard
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  }, [isDirty]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  // Load staff list for price override requester dropdown
  useEffect(() => {
    usersApi.getAllWithDetails().then((res) => {
      const data = res.data as Array<{ id: string; firstName?: string; lastName?: string; email?: string; phoneNumber?: string }>;
      setStaffList((data ?? []).map((u) => ({
        id: u.id,
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        email: u.email,
        phoneNumber: u.phoneNumber,
      })));
    }).catch(() => { /* non-critical */ });
  }, []);

  // GAP 2: release lock on unmount — skip for SurgeryDone (no lock was acquired)
  useEffect(() => {
    return () => { if (!isSurgeryDoneRef.current) counsellingAzureApi.unlock(sessionId); };
  }, [sessionId]);

  const handleBack = () => {
    if (isDirty) {
      showConfirmation({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        variant: 'warning',
        confirmText: 'Leave',
        cancelText: 'Stay',
        onConfirm: () => router.back(),
      });
      return;
    }
    router.back();
  };

  // Done → Processed: re-opens the session so the counsellor can change the procedure
  const handleReEvaluate = () => {
    showConfirmation({
      title: 'Re-evaluate Session',
      message: 'Changing the procedure will restart the counselling process (Done → In Progress). Continue?',
      variant: 'warning',
      confirmText: 'Continue',
      onConfirm: async () => {
        try {
          await counsellingAzureApi.reEvaluate(sessionId);
          setQueueStatus('Processed');
          toast.success('Session reopened for re-evaluation');
        } catch {
          toast.error('Failed to re-open session');
        }
      },
    });
  };

  // RepeatCounselling → Processed: counsellor explicitly starts a fresh counselling round.
  // Calls startSession which transitions the queue item Completed → InProgress so the
  // waiting list shows "Processed" while the counsellor is actively working.
  const handleStartRepeatSession = async () => {
    try {
      await counsellorsDeskApi.startSession(sessionId);
      setQueueStatus('Processed');
      toast.success('Repeat counselling session started');
    } catch {
      toast.error('Failed to start repeat session');
    }
  };


  const toggleInvestigation = (item: MasterCatalogItem) => {
    setSelectedInvestigations((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        // Lab items inherit the currently active urgency mode
        const urgency = item.testType === 'Lab' ? urgencyMode : 'Routine';
        next.set(item.id, {
          catalogId: item.id,
          testName: item.name,
          testCode: item.code,
          testType: item.testType,
          price: item.price,
          urgency,
          source: 'counsellor',
          // Capture the active eye selection for Imaging/Scan items
          ...(item.testType !== 'Lab' ? { eye: selectedEye } : {}),
        });
      }
      return next;
    });
    markDirty();
  };

  const handleSave = async () => {
    // Warn (not block) if no procedure selected — allows saving decision/notes for repeat sessions
    if (!selectedSurgeryId) {
      toast('No procedure selected — saving decision and notes only', { icon: '⚠️' });
    }
    // If the selected variant has sub-options, one must be chosen before saving
    if (selectedVariantId && catalog) {
      const selVariant = flattenCatalog(catalog).find(v => v.id === selectedVariantId);
      if (selVariant?.subOptions?.length && !selVariant.hasIolOptions && !variantSubOption) {
        toast.error('Please select a sub-type for the selected procedure');
        return;
      }
    }
    if (!decision) {
      toast.error('Please select a decision (Date for Surgery / Interested / Not Interested)');
      return;
    }
    setIsSaving(true);
    // Compute field-level diff for audit trail before entering try block
    const currentSnapshot: Record<string, string> = {
      paymentType: paymentType ?? '',
      insuranceCompany: insuranceCompany ?? '',
      decision: decision ?? '',
      followUpReason: followUpReason ?? '',
      followUpDate: followUpDate ?? '',
      counsellorNotes: counsellorNotes ?? '',
      patientRemarks: patientRemarks ?? '',
      doctorNotes: doctorNotes ?? '',
      wantToSeeDoctor: String(wantToSeeDoctor),
      interestedToUpgrade: String(interestedToUpgrade),
      notRequiredPreAuth: String(notRequiredPreAuth),
      selectedSurgeryId: selectedSurgeryId ?? '',
      selectedEye: selectedEye ?? '',
      packageName: packageName ?? '',
      packageRate: String(packageRate ?? ''),
      schedule: schedule?.selectedDate ?? '',
    };
    const fieldChanges = Object.entries(currentSnapshot)
      .filter(([key, val]) => savedSnapshotRef.current[key] !== undefined && savedSnapshotRef.current[key] !== val)
      .map(([fieldName, newValue]) => ({ fieldName, oldValue: savedSnapshotRef.current[fieldName] ?? '', newValue }));

    try {
      // Compute agreed flag before save so patientAgreedToSurgery is written in the same request.
      // This is keyed by the waiting list to show Done (true) or RepeatCounselling (false).
      const agreedToSurgery = decision === 'DateForSurgery' || decision === 'Interested';

      // Detect package upgrade on a Done session → triggers AddOnSurgery workflow.
      const isPackageUpgrade = isDoneState && (
        packageName !== savedSnapshotRef.current.packageName ||
        String(packageRate) !== savedSnapshotRef.current.packageRate
      );

      const prevPackageName   = savedSnapshotRef.current.packageName || undefined;
      const prevPackageAmount = savedSnapshotRef.current.packageRate
        ? Number(savedSnapshotRef.current.packageRate)
        : undefined;

      await counsellorsDeskApi.saveSession(sessionId, {
        // ── Counsellor JSON blob ──────────────────────────────────────────────────
        // PackageAddonsJson is repurposed as a free-form store for counsellor-side data
        // (selectedSurgeryId, packageName, decision, paymentType, schedule, etc.).
        // getSession() reads this back on every load to restore the form.
        packageAddonsJson: JSON.stringify({
          selectedSurgeryId,
          packageName,
          variantId: selectedVariantId,
          eye: selectedEye,
          decision,
          paymentType,
          insuranceCompany,
          rate: typeof packageRate === 'number' ? packageRate : undefined,
          ...(followUpDate && { followUpDate }),
          // Store the full schedule object so OT room, doctor and time survive a page reload
          ...(schedule && { schedule }),
          // Notes — no dedicated DB columns; stored in the blob and restored by getSession()
          ...(patientRemarks && { patientRemarks }),
          ...(doctorNotes    && { doctorNotes }),
          // Additional-option checkboxes
          wantToSeeDoctor,
          interestedToUpgrade,
          notRequiredPreAuth,
          // AddOnSurgery upgrade tracking — populated so the waiting list can show diff
          ...(isPackageUpgrade && prevPackageName  && { previousPackageName:   prevPackageName  }),
          ...(isPackageUpgrade && prevPackageAmount && { previousPackageAmount: prevPackageAmount }),
        }),
        // ── Decision booleans — drive Done vs RepeatCounselling in the waiting list ─
        patientAgreedToSurgery: agreedToSurgery,
        pendingDecision: decision === 'NeedsTime',
        // ── Follow-up details ─────────────────────────────────────────────────────
        reasonsForDelay: followUpReason || undefined,
        decisionDate: followUpDate || undefined,
        // ── Tentative surgery date + time + eye ──────────────────────────────────────
        surgeryTentativeDate: schedule?.selectedDate || undefined,
        surgeryTentativeTimeSlot: schedule?.surgeryStartTime || undefined,
        surgeryTentativeEye: selectedEye || undefined,
        // ── Package financials ────────────────────────────────────────────────────
        // Prefer the explicitly-set packageRate; fall back to the live grand total
        // (variant price + IOL + investigations) so newly-created or legacy sessions
        // without a persisted package_amount always record the quoted amount.
        packageAmount: (typeof packageRate === 'number' && packageRate > 0)
          ? packageRate
          : (computedGrandTotal > 0 ? computedGrandTotal : undefined),
        // ── Session notes ─────────────────────────────────────────────────────────
        additionalNotes: counsellorNotes || undefined,
        // ── PatientType — only send values the backend accepts ────────────────────
        patientType: (['Cash', 'Insurance', 'CoPay', 'ESH', 'CGHS', 'Arograshree', 'SGHS', 'Camp'] as string[]).includes(paymentType ?? '')
          ? (paymentType as string) : undefined,
        // ── Misc ──────────────────────────────────────────────────────────────────
        freeSurgeryReason,
        variantSubOption,
        company: insuranceCompany,
        isFollowUpRequired: decision === 'NotInterested' || decision === 'NeedsTime',
        fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
      } as unknown as CounsellingSession);

      // Save investigation orders
      if (selectedInvestigations.size > 0) {
        await counsellorsDeskApi.saveInvestigations(sessionId, Array.from(selectedInvestigations.values()));
      }

      // Transition queue status based on session outcome:
      // • AddOnSurgery (package upgrade on Done):  queue → AddOnSurgery
      // • Normal save:                              queue → Completed (waiting list derives Done/RepeatCounselling)
      if (isPackageUpgrade) {
        counsellorsDeskApi.markAddOnSurgery(sessionId);
      } else {
        counsellorsDeskApi.completeSession(sessionId);
      }

      // ── Azure Functions state machine (non-blocking) ──────────────────────
      // Record the patient decision. From Done state, NotInterested/NeedsTime → RepeatCounselling.
      if (decision) {
        // Pass followUpDate/Reason for NotInterested and NeedsTime decisions
        const mappedDecision = mapDecision(decision);
        if (decision === 'NeedsTime') {
          counsellingAzureApi.decision(sessionId, 'NeedsTime', undefined, followUpDate || undefined, followUpReason || undefined);
        } else {
          counsellingAzureApi.decision(sessionId, mappedDecision, undefined, followUpDate || undefined, followUpReason || undefined);
        }
      }
      // Persist scheduled surgery date
      if (schedule?.selectedDate) {
        counsellingAzureApi.schedule(sessionId, schedule.selectedDate);
      }
      // Fire AddOnSurgery state transition in the Azure counselling service
      if (isPackageUpgrade) {
        counsellingAzureApi.addOnSurgery(sessionId, 'Package upgraded');
      }
      // Snapshot the selected package + payment details to Azure
      // variantId and eye are packed inside the JSON blob so we can restore them on load
      counsellingAzureApi.save(sessionId, {
        packageDetails: JSON.stringify({
          name: packageName,
          rate: (typeof packageRate === 'number' && packageRate > 0) ? packageRate : (computedGrandTotal || undefined),
          paymentType, insuranceCompany, variantId: selectedVariantId, eye: selectedEye,
        }),
        paymentType: paymentType || undefined,
        insuranceCompany: insuranceCompany || undefined,
      });
      // ─────────────────────────────────────────────────────────────────────

      // ── OT finalize trigger ────────────────────────────────────────────────────
      // Non-blocking: OT upsert/edit failure must not roll back the counselling save.
      if (!isPackageUpgrade && schedule?.selectedDate &&
          (decision === 'DateForSurgery' || decision === 'Interested')) {
        try {
          const startTimeIso = schedule.surgeryStartTime
            ? `${schedule.selectedDate}T${schedule.surgeryStartTime}:00`
            : schedule.selectedDate;
          if (isDoneState && existingOtScheduleId) {
            // Session already Done — edit the existing slot so OT status reverts to NotConfirmed + version++
            await counsellorsDeskApi.editOtScheduleSlot(existingOtScheduleId, {
              doctorName: schedule.doctor || '',
              theatreName: schedule.operationTheatre || '',
              startTime: startTimeIso,
            });
          } else {
            // First save (session transitioning to Done) — create/upsert the OT record
            await counsellorsDeskApi.upsertOtSchedule({
              patientId: session.patientId,
              uhid: session.uhid,
              patientName: session.patientName,
              surgeryName: session?.surgeries?.find(s => s.id === selectedSurgeryId)?.surgeryName
                || session?.surgeries?.find(s => s.isRecommended)?.surgeryName
                || packageName || '',
              eyes: selectedEye,
              patientType: paymentType || '',
              paymentMode: paymentType || '',
              surgeon: schedule.doctor || '',
              startTime: startTimeIso,
              theaterName: schedule.operationTheatre || '',
              packageName: packageName || '',
              packageRate: typeof packageRate === 'number' ? packageRate : undefined,
              counsellingSessionId: sessionId,
            });
          }
        } catch {
          // Non-fatal — OT entry will be created on next save if needed
        }
      }

      savedSnapshotRef.current = currentSnapshot;
      setIsDirty(false);
      // Update local status so header reflects the new state immediately
      const nextStatus: WaitingListStatus = isPackageUpgrade
        ? 'AddOnSurgery'
        : (decision === 'NotInterested' || decision === 'NeedsTime')
          ? 'RepeatCounselling'
          : 'Done';
      setQueueStatus(nextStatus);

      // ── Auto-create CCMS coverage case for insurance/TPA payment types ─────────
      // Only fires when: payment type requires coverage AND pre-auth is not explicitly waived.
      // Non-blocking: failure silently skipped so the counselling save always succeeds.
      const COVERAGE_PAYMENT_TYPES = ['Insurance', 'TPA', 'CoPay', 'CGHS', 'SGHS', 'GovernmentScheme'];
      if (COVERAGE_PAYMENT_TYPES.includes(paymentType as string) && !notRequiredPreAuth) {
        try {
          const { createCoverageCase } = await import('@/lib/api/ccms/ccms-coverage-cases.api');
          await createCoverageCase({
            counselingSessionId: sessionId,
            patientId:  session.patientId,
            payerType:  paymentType as string,
            paymentType: paymentType as string,
            estimatedAmount: (typeof packageRate === 'number' && packageRate > 0)
              ? packageRate
              : (computedGrandTotal > 0 ? computedGrandTotal : undefined),
          });
        } catch {
          // Case may already exist (409) or CCMS may be offline — either way, non-fatal
        }
      }
      // ──────────────────────────────────────────────────────────────────────────

      toast.success('Session saved successfully');
      // For insurance/TPA payments, switch to Coverage tab and refresh the panel
      if (COVERAGE_PAYMENT_TYPES.includes(paymentType as string) && !notRequiredPreAuth) {
        setCoverageRefreshKey(k => k + 1);
        setActiveMainTab('coverage');
      }
    } catch (err: unknown) {
      // Surface the actual backend error message so the user knows what went wrong
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ? `Save failed: ${msg}` : 'Failed to save session — check network tab for details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleSubmit = (data: ScheduleData) => {
    setSchedule(data);
    markDirty();
    toast.success('Schedule set successfully');
  };

  const handleOpenHistory = async () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      // Fetch all 3 sources in parallel — never block one on another
      const [azureResult, authResult, overridesResult] = await Promise.allSettled([
        counsellingAzureApi.getHistory(sessionId),
        counsellorsDeskApi.getSessionHistory(sessionId),
        counsellingAzureApi.getPriceOverrides(sessionId),
      ]);

      const azureEntries = azureResult.status === 'fulfilled' ? azureResult.value : [];
      const authEntries  = authResult.status  === 'fulfilled' ? authResult.value  : [];
      const priceOverrides: PriceOverrideRecord[] = overridesResult.status === 'fulfilled' ? overridesResult.value : [];

      // Filter noisy Lock/Unlock events from Azure
      const filtered = azureEntries.filter(e => e.changeType !== 'Lock' && e.changeType !== 'Unlock');

      // Deduplicate: drop auth-service FieldChanged entries that duplicate Azure FieldChanged
      // (same fieldName + changedBy within 5 seconds)
      const azureFieldChangedSet = new Set(
        filtered
          .filter(e => e.changeType === 'FieldChanged')
          .map(e => `${e.fieldName}|${e.changedBy}|${Math.floor(new Date(e.changedAt).getTime() / 5000)}`)
      );
      const dedupedAuth = authEntries.filter(e => {
        if (e.changeType !== 'FieldChanged') return true;
        const key = `${e.fieldName}|${e.changedBy}|${Math.floor(new Date(e.changedAt).getTime() / 5000)}`;
        return !azureFieldChangedSet.has(key);
      });

      // Merge and sort oldest-first for grouping logic
      const merged = [...filtered, ...dedupedAuth].sort(
        (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
      );

      // Enrich PriceOverride entries with ₹ amounts from the overrides list
      for (const entry of merged) {
        if (entry.changeType !== 'PriceOverride') continue;
        const entryTime = new Date(entry.changedAt).getTime();
        const match = priceOverrides.find(o => {
          const diff = Math.abs(new Date(o.createdAt).getTime() - entryTime);
          return diff <= 10_000;
        });
        if (match) {
          entry.priceBaseAmount       = match.basePrice;
          entry.priceOverriddenAmount = match.overriddenPrice;
          entry.priceVariantName      = match.variantName;
          entry.priceReason           = match.reason;
          entry.priceRequesterName    = match.requestedByName ?? null;
        }
      }

      // Group FieldChanged entries under their SaveCounselling parent
      const consumed = new Set<string>();
      for (const entry of merged) {
        if (entry.changeType !== 'SaveCounselling') continue;
        const saveTime = new Date(entry.changedAt).getTime();
        const children = merged.filter(e =>
          e.changeType === 'FieldChanged' &&
          e.changedBy === entry.changedBy &&
          Math.abs(new Date(e.changedAt).getTime() - saveTime) <= 5_000 &&
          !consumed.has(e.id)
        );
        if (children.length > 0) {
          entry.children = children;
          children.forEach(c => consumed.add(c.id));
        }
      }

      // Final list: remove consumed FieldChanged, show newest first
      const finalEntries = merged
        .filter(e => !consumed.has(e.id))
        .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

      setHistoryEntries(finalEntries);
    } catch {
      // silent — modal shows empty state
    } finally {
      setIsHistoryLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading session…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Session not found</p>
      </div>
    );
  }

  // GAP 11: Done state is now editable with branching — procedure change triggers re-evaluate,
  // price override triggers add-on surgery, decision change works via updated state machine.
  const isDoneState = queueStatus === 'Done';
  const isRepeatState = queueStatus === 'RepeatCounselling';
  const isSurgeryDoneState = queueStatus === 'SurgeryDone';
  // Read-only while in RepeatCounselling state — counsellor must click "Start Session" first
  // Also read-only when surgery is done — session is permanently closed
  const isReadOnly = isRepeatState || isSurgeryDoneState;

  // GAP 1: status badge config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const STATUS_BADGE = (STATUS_BADGE_MAP as any)[queueStatus] || { label: queueStatus, cls: 'bg-gray-300 text-gray-900' };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <ConfirmationComponent />
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 mb-4 shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="text-white/80 hover:text-white transition-colors flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="w-px h-6 bg-white/30" />
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {session.patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-semibold text-lg">{session.patientName}</h1>
                {isDirty && (
                  <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs rounded-full font-medium">Unsaved</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-blue-100 text-xs">{session.age} yrs · {session.gender}</span>
                <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-mono">{session.uhid}</span>
                {/* GAP 1: status badge */}
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE.cls}`}>
                  {STATUS_BADGE.label}
                </span>
                {/* GAP 2: lock indicator */}
                <span className="text-white/70 text-xs">🔒 You</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 text-blue-100 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Visit: {new Date(session.visitDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            {/* GAP 7: view history */}
            <button
              ref={historyBtnRef}
              onClick={handleOpenHistory}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/15 hover:bg-white/25 text-white text-xs rounded-lg transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />
              View History
            </button>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-4 pt-3 gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveMainTab('counselling')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeMainTab === 'counselling'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            Counselling
          </button>
          {(['Insurance', 'TPA', 'CoPay', 'CGHS', 'SGHS', 'GovernmentScheme'] as string[]).includes(paymentType as string) && (
            <button
              type="button"
              onClick={() => setActiveMainTab('coverage')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
                activeMainTab === 'coverage'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Coverage &amp; Pre-Auth
              {activeMainTab !== 'coverage' && (
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="Pre-auth required" />
              )}
            </button>
          )}
        </div>

        {/* Coverage & Pre-Auth Tab Panel */}
        {activeMainTab === 'coverage' && (
          <div className="flex-1 min-h-0 p-5 overflow-auto">
            <CoveragePreauthPanel sessionId={sessionId} paymentType={paymentType as string} insuranceCompany={insuranceCompany} initialSubTab={subtabParam ?? undefined} refreshKey={coverageRefreshKey} patientId={session?.patientId} />
          </div>
        )}

        {/* Counselling Tab Panel */}
        <div className={activeMainTab !== 'counselling' ? 'hidden' : 'flex-1 min-h-0 p-5 flex flex-col overflow-hidden'}>
            {/* Surgery Done read-only banner — replaces Done banner when surgery is completed */}
            {isSurgeryDoneState && (
              <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
                <span>🏥</span>
                <span className="flex-1">Surgery <strong>completed</strong>. This session is <strong>read-only</strong> — re-evaluation is not available after surgery.</span>
              </div>
            )}

            {/* GAP 11: Done-state edit-mode banner */}
            {isDoneState && (
              <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                <span>✅</span>
                <span className="flex-1">Session <strong>completed</strong>. You can update the package/price or reschedule below. To change the procedure, click <strong>Re-evaluate</strong> — this will reopen the session.</span>
                <button
                  type="button"
                  onClick={handleReEvaluate}
                  className="px-3 py-1 text-xs font-semibold bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors flex-shrink-0"
                >
                  Re-evaluate
                </button>
              </div>
            )}

            {/* Repeat-Counselling banner: patient needs another session */}
            {isRepeatState && (
              <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
                <span>🔄</span>
                <div className="flex-1">
                  <p className="font-semibold">Repeat Counselling Required</p>
                  <p className="text-xs text-orange-600 mt-0.5">Patient needs more time before deciding. Review the previous selection below and click <strong>Start Session</strong> when ready to begin counselling.</p>
                </div>
                <button
                  type="button"
                  onClick={handleStartRepeatSession}
                  className="px-3 py-1 text-xs font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex-shrink-0 whitespace-nowrap"
                >
                  Start Session
                </button>
              </div>
            )}

            {/* AddOnSurgery banner: package was upgraded on a previously Done session */}
            {queueStatus === 'AddOnSurgery' && (
              <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-800">
                <span>⬆️</span>
                <div className="flex-1">
                  <p className="font-semibold">Upgraded Case</p>
                  <p className="text-xs text-violet-600 mt-0.5">Package was upgraded on this completed session. Update the new package details and save to confirm the add-on surgery.</p>
                </div>
              </div>
            )}
            <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 lg:overflow-hidden overflow-y-auto">
              {/* LEFT: Surgery Selection */}
              <div className="w-full lg:w-1/3 flex-shrink-0 flex flex-col gap-3 lg:overflow-y-auto scrollbar-hide pb-4">
                <div className={`bg-gray-50 rounded-xl border border-gray-200 flex flex-col overflow-hidden ${procExpanded ? 'min-h-[360px]' : 'flex-shrink-0'}`}>
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => setProcExpanded(!procExpanded)}
                    className="w-full flex-shrink-0 flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
                      Procedures
                      {selectedSurgeryId && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">1</span>
                      )}
                    </h3>
                    {/* Eye selector in header row */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 mr-0.5">Eye:</span>
                        {(['RE', 'LE', 'BE'] as const).map((eye) => (
                          <button
                            key={eye}
                            type="button"
                            disabled={isReadOnly}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEye(eye);
                              // Update the eye badge on all Imaging/Scan investigation items
                              setSelectedInvestigations(prev => {
                                const next = new Map(prev);
                                next.forEach((inv, key) => {
                                  if (inv.testType !== 'Lab') {
                                    next.set(key, { ...inv, eye });
                                  }
                                });
                                return next;
                              });
                              if (selectedVariantId) {
                                setSelectedSurgeryId(`type-${selectedVariantId}-${eye}`);
                                markDirty();
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                            } ${
                              selectedEye === eye
                                ? eye === 'RE'
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : eye === 'LE'
                                  ? 'bg-purple-500 text-white border-purple-500'
                                  : 'bg-green-500 text-white border-green-500'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                          >
                            {eye === 'BE' ? 'Both' : eye}
                          </button>
                        ))}
                      </div>
                      {procExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>

                  {procExpanded && (
                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Sticky: category chips, search */}
                  <div className="flex-shrink-0 px-4 pb-2 pt-1">

                  {/* Category filter tabs (dynamic from service catalog) */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {['All', ...(catalog?.categories
                      .filter((c) => c.isActive && c.code !== 'DIAGNOSTICS' && c.code !== 'INVESTIGATIONS')
                      .map((c) => c.code) ?? [])
                    ].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setCategoryFilter(f)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          categoryFilter === f
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {f === 'All' ? 'All' : (catalog?.categories.find((c) => c.code === f)?.name ?? f)}
                      </button>
                    ))}
                  </div>

                  {/* Procedure search */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={procSearch}
                      onChange={(e) => setProcSearch(e.target.value)}
                      placeholder="Search procedures…"
                      className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    {procSearch && (
                      <button type="button" onClick={() => setProcSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Selection counter */}
                  {selectedSurgeryId && (
                    <p className="text-xs text-blue-700 font-semibold bg-blue-50 rounded-lg px-2.5 py-1 mb-3">
                      1 selected
                    </p>
                  )}
                  </div>{/* end sticky header */}
                  {/* Scrollable list */}
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pb-4 pt-1">
                  {/* Procedures: sourced directly from service catalog — one card per variant with eye selector */}
                  {(() => {
                    // ── Loading state ──────────────────────────────────────
                    if (catalogLoading) {
                      return (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                          <p className="text-xs text-gray-400">Loading procedures…</p>
                        </div>
                      );
                    }

                    // ── Error state ───────────────────────────────────────
                    if (catalogError || !catalog) {
                      return (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <p className="text-xs text-gray-500 text-center">Unable to load procedures.</p>
                          <button
                            type="button"
                            onClick={loadCatalog}
                            className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      );
                    }

                    // ── Full catalog loaded ────────────────────────────────
                    const EXCLUDED = new Set(['DIAGNOSTICS', 'INVESTIGATIONS']);
                    const allVariants: FlatVariantDto[] = flattenCatalog(catalog).filter((v) => !EXCLUDED.has(v.categoryCode));

                    // Doctor-recommended variantIds (from session if backend returned them)
                    const recommendedSet = new Set(
                      session.surgeries
                        .filter((s) => s.isRecommended && s.variantId)
                        .map((s) => s.variantId as string)
                    );

                    const filtered = allVariants.filter((v) =>
                      (categoryFilter === 'All' || v.categoryCode === categoryFilter) &&
                      (procSearch === '' || v.name.toLowerCase().includes(procSearch.toLowerCase()))
                    );

                    if (filtered.length === 0) {
                      return (
                        <p className="text-xs text-gray-400 text-center py-4">
                          {procSearch ? 'No procedures match your search' : 'No procedures match the selected filter'}
                        </p>
                      );
                    }

                    const recommended = filtered.filter((v) => recommendedSet.has(v.id));
                    const rest = filtered.filter((v) => !recommendedSet.has(v.id));

                    const grouped: Record<string, FlatVariantDto[]> = {};
                    rest.forEach((v) => {
                      const key = v.categoryName || 'Other';
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(v);
                    });
                    const categoryOrder = ['Cataract', 'Retina', 'Glaucoma', 'Cornea', 'IVT', 'Refractive', 'Other'];
                    const sortedKeys = Object.keys(grouped).sort((a, b) => {
                      const ai = categoryOrder.indexOf(a);
                      const bi = categoryOrder.indexOf(b);
                      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                    });

                    const VariantCard = ({ v, highlight }: { v: FlatVariantDto; highlight?: boolean }) => {
                      const isSelected = selectedVariantId === v.id;
                      const suffix = priceSuffix(v.priceType);
                      const eyeForVariant = v.priceType === 'BOTH_EYES' ? 'BE' : selectedEye;
                      const hasSubOpts = (v.subOptions?.length ?? 0) > 0;

                      const handleCardClick = () => {
                        if (isReadOnly) return;
                        // In Done state, clicking a different procedure reopens the session via re-evaluate
                        if (isDoneState && v.id !== selectedVariantId) {
                          handleReEvaluate();
                          return;
                        }
                        const eye = v.priceType === 'BOTH_EYES' ? 'BE' : selectedEye;
                        setSelectedVariantId(v.id);
                        setSelectedEye(eye);
                        setSelectedSurgeryId(`type-${v.id}-${eye}`);
                        setVariantSubOption(null);
                        markDirty();
                      };

                      return (
                        <div className={`text-left w-full rounded-lg border-2 overflow-hidden transition-all ${
                          isReadOnly ? 'opacity-60' : ''
                        } ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : highlight
                            ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}>
                          {/* Clickable card header */}
                          <div
                            role="button"
                            tabIndex={isReadOnly ? -1 : 0}
                            onClick={handleCardClick}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(); }}
                            className={`p-2.5 ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {/* Radio + name */}
                            <div className="flex items-start gap-1.5 mb-1">
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${
                                isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto" />}
                              </div>
                              <p className={`text-xs font-medium leading-tight ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
                                {sanitizeVariantName(v.name)}
                              </p>
                            </div>
                            {/* Price + selected-eye badge */}
                            <div className="flex items-center justify-between pl-5">
                              <p className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                ₹{v.price.toLocaleString('en-IN')}
                                {suffix && <span className="font-normal text-gray-400 ml-0.5">{suffix}</span>}
                              </p>
                              {isSelected && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  eyeForVariant === 'RE'
                                    ? 'bg-orange-100 text-orange-700'
                                    : eyeForVariant === 'LE'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {eyeForVariant === 'BE' ? 'Both' : eyeForVariant}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Inline sub-option picker (staff-only, shown only when selected, sub-options exist, and no IOL picker) */}
                          {isSelected && hasSubOpts && !v.hasIolOptions && (
                            <div className="px-2.5 pb-2.5 border-t border-blue-200 pt-2">
                              <p className="text-[10px] text-blue-600 font-semibold mb-1.5 pl-5">
                                Select type <span className="text-red-500">*</span>
                              </p>
                              <div className="flex flex-wrap gap-1 pl-5">
                                {v.subOptions!.map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVariantSubOption(opt);
                                      markDirty();
                                    }}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                                      variantSubOption === opt
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                                    } ${isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                              {!variantSubOption && (
                                <p className="text-[10px] text-amber-600 mt-1 pl-5">⚠ Required before saving</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        <div className="space-y-4 pr-0.5">
                          {/* ── Doctor's Recommendation ── */}
                          {recommended.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                <span>🩺</span> Doctor&apos;s Recommendation
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {recommended.map((v) => (
                                  <VariantCard key={v.id} v={v} highlight />
                                ))}
                              </div>
                              {rest.length > 0 && (
                                <div className="mt-3 border-t border-gray-200 pt-1">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">All Options</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Catalog variants grouped by category ── */}
                          {sortedKeys.map((cat) => (
                            <div key={cat}>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                {cat}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {grouped[cat].map((v) => (
                                  <VariantCard key={v.id} v={v} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {!selectedSurgeryId && (
                          <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-2">
                            ⚠ Select a procedure and eye (RE / LE / Both) to proceed
                          </p>
                        )}
                      </>
                    );
                  })()}

                  {/* IOL / Lens selector — shown when the selected procedure has lens options */}
                  {iolOptions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <span className="w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold">L</span>
                        Select IOL / Lens
                      </p>
                      <div className="space-y-1 pr-0.5">
                        {iolOptions.map((iol) => (
                          <button
                            key={iol.id}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => { setSelectedIolId(selectedIolId === iol.id ? null : iol.id); markDirty(); }}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                              selectedIolId === iol.id
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 text-gray-700'
                            } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-medium truncate block">{iol.modelName}</span>
                                <span className="text-gray-400 text-[10px]">{iol.brandManufacturer}</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {iol.isDefault && (
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-semibold">Default</span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                  iol.origin === 'Indian' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                }`}>{iol.origin}</span>
                                <span className="font-semibold text-gray-600">₹{iol.price.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>{/* end scrollable list */}
                    </div>
                  )}{/* end procExpanded */}
                </div>

                {/* ─────────────── Price Override Panel ─────────────── */}
                {selectedVariantId && (() => {
                  const selectedVariant = catalog ? flattenCatalog(catalog).find(v => v.id === selectedVariantId) : null;
                  if (!selectedVariant) return null;
                  const basePrice = selectedVariant.price;
                  const handleSaveOverride = async () => {
                    setOverrideError('');
                    const parsed = parseFloat(overridePrice);
                    if (!overridePrice || isNaN(parsed) || parsed <= 0) {
                      setOverrideError('Enter a valid price.');
                      return;
                    }
                    if (!overrideReason.trim()) {
                      setOverrideError('Reason is required.');
                      return;
                    }
                    setOverrideSaving(true);
                    try {
                      if (editingOverrideId) {
                        // ── Edit existing override ──
                        await counsellingAzureApi.updatePriceOverride(sessionId, editingOverrideId, {
                          overriddenPrice: parsed,
                          reason: overrideReason.trim(),
                          remarks: overrideRemarks.trim() || undefined,
                        });
                        // Refresh list from server to get updated data
                        const refreshed = await counsellingAzureApi.getPriceOverrides(sessionId);
                        setSavedOverrides(refreshed);
                        setEditingOverrideId(null);
                      } else {
                        // ── New override ──
                        await counsellingAzureApi.addPriceOverride(params.id as string, {
                          variantId: selectedVariant.id,
                          variantName: selectedVariant.name,
                          basePrice,
                          overriddenPrice: parsed,
                          priceType: selectedVariant.priceType,
                          reason: overrideReason.trim(),
                          remarks: overrideRemarks.trim() || undefined,
                          requestedByType: overrideRequesterType,
                          requestedByName: overrideRequesterType === 'STAFF' ? overrideStaffName : undefined,
                          requestedByContact: overrideRequesterType === 'STAFF' ? overrideStaffContact : undefined,
                          performedBy: 'counsellor',
                          tenantId: useAuthStore.getState().tenantId ?? '',
                        });
                        // Reload to get real IDs from server
                        const refreshed = await counsellingAzureApi.getPriceOverrides(sessionId);
                        setSavedOverrides(refreshed);
                        // Done → AddOnSurgery when a price override is saved from a completed session
                        if (isDoneState) {
                          counsellingAzureApi.addOnSurgery(sessionId, overrideReason.trim());
                          setQueueStatus('AddOnSurgery');
                          toast.success('Price override saved — session marked as Add-On Surgery');
                        }
                      }
                      setShowOverridePanel(false);
                      setOverridePrice('');
                      setOverrideReason('');
                      setOverrideRemarks('');
                      setOverrideStaffName('');
                      setOverrideStaffContact('');
                      setOverrideRequesterType('SELF');
                    } catch {
                      setOverrideError('Failed to save override. Please try again.');
                    } finally {
                      setOverrideSaving(false);
                    }
                  };
                  return (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-amber-800">Quoted Price</span>
                          <span className="text-xs font-bold text-amber-900">₹{basePrice.toLocaleString('en-IN')}</span>
                          {savedOverrides.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-full text-[9px] font-semibold">
                              {savedOverrides.length} override{savedOverrides.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              if (showOverridePanel) {
                                setShowOverridePanel(false);
                                setEditingOverrideId(null);
                                setOverridePrice('');
                                setOverrideReason('');
                                setOverrideRemarks('');
                                setOverrideError('');
                              } else {
                                setShowOverridePanel(true);
                              }
                            }}
                            className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 underline"
                          >
                            {showOverridePanel ? 'Cancel' : 'Modify Price'}
                          </button>
                        )}
                      </div>

                      {/* Saved overrides list with Edit / Remove */}
                      {savedOverrides.length > 0 && !showOverridePanel && (
                        <div className="space-y-1 mt-0.5">
                          {savedOverrides.map((ov) => (
                            <div key={ov.id} className="flex items-start justify-between gap-1 text-[10px] text-amber-700 bg-amber-100 rounded-lg px-2 py-1.5">
                              <span className="leading-snug">
                                <span className="font-semibold text-amber-900">₹{ov.overriddenPrice.toLocaleString('en-IN')}</span>
                                {' '}— {ov.reason}
                              </span>
                              {!isReadOnly && (
                                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleEditOverride(ov)}
                                    className="font-medium text-amber-700 hover:text-amber-900 underline"
                                  >
                                    Edit
                                  </button>
                                  <span className="opacity-30">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOverride(ov.id)}
                                    className="font-medium text-red-500 hover:text-red-700 underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Override form */}
                      {showOverridePanel && (
                        <div className="mt-2 space-y-2">
                          {editingOverrideId && (
                            <p className="text-[10px] font-semibold text-amber-700 bg-amber-100 rounded px-2 py-1">
                              Editing existing override
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-600 mb-0.5">New Price (₹) <span className="text-red-500">*</span></label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={overridePrice}
                                onChange={e => setOverridePrice(e.target.value)}
                                placeholder={String(basePrice)}
                                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-600 mb-0.5">Requester</label>
                              <select
                                value={overrideRequesterType}
                                onChange={e => setOverrideRequesterType(e.target.value as 'SELF' | 'STAFF')}
                                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                              >
                                <option value="SELF">Self (Counsellor)</option>
                                <option value="STAFF">Another Staff Member</option>
                              </select>
                            </div>
                          </div>

                          {overrideRequesterType === 'STAFF' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-gray-600 mb-0.5">Staff Member</label>
                                <select
                                  value={staffList.find(s => `${s.firstName} ${s.lastName}`.trim() === overrideStaffName)?.id ?? ''}
                                  onChange={e => {
                                    const staff = staffList.find(s => s.id === e.target.value);
                                    if (staff) {
                                      setOverrideStaffName(`${staff.firstName} ${staff.lastName}`.trim());
                                      setOverrideStaffContact(staff.phoneNumber || staff.email || '');
                                    } else {
                                      setOverrideStaffName('');
                                      setOverrideStaffContact('');
                                    }
                                  }}
                                  className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                >
                                  <option value="">— Select staff —</option>
                                  {staffList.map(s => (
                                    <option key={s.id} value={s.id}>
                                      {`${s.firstName} ${s.lastName}`.trim()}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-600 mb-0.5">Contact (phone / email)</label>
                                <input
                                  type="text"
                                  value={overrideStaffContact}
                                  onChange={e => setOverrideStaffContact(e.target.value)}
                                  placeholder="Auto-filled from staff record"
                                  className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] text-gray-600 mb-0.5">Reason <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              value={overrideReason}
                              onChange={e => setOverrideReason(e.target.value)}
                              placeholder="e.g. Doctor's discretion, financial hardship"
                              className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-gray-600 mb-0.5">Remarks (optional)</label>
                            <input
                              type="text"
                              value={overrideRemarks}
                              onChange={e => setOverrideRemarks(e.target.value)}
                              placeholder="Additional notes"
                              className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          {overrideError && (
                            <p className="text-[10px] text-red-600">{overrideError}</p>
                          )}

                          <button
                            type="button"
                            disabled={overrideSaving}
                            onClick={handleSaveOverride}
                            className="w-full text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg py-1.5 transition-colors disabled:opacity-60"
                          >
                            {overrideSaving ? 'Saving…' : editingOverrideId ? 'Update Override' : 'Save Price Override'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Investigations */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 flex-shrink-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setInvExpanded(!invExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-5 h-5 bg-teal-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                      Investigations
                      {selectedInvestigations.size > 0 && (
                        <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold">
                          {selectedInvestigations.size}
                        </span>
                      )}
                    </h3>
                    {invExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>

                  {invExpanded && (
                    <div className="flex flex-col overflow-hidden max-h-[22rem]">
                      {/* Sticky: tabs + search */}
                      <div className="flex-shrink-0 px-3 pt-1">
                      {/* Tabs */}
                      <div className="flex border-b border-gray-200 mb-0">
                        {([
                          { key: 'imaging_orders' as const, label: 'Imaging Orders' },
                          { key: 'required_investigations' as const, label: 'Required Investigations' },
                        ]).map(({ key, label }) => {
                          const items = key === 'imaging_orders'
                            ? [...masterCatalog.imaging, ...masterCatalog.scan]
                            : masterCatalog.lab;
                          const hasSelected = items.some((item) => selectedInvestigations.has(item.id));
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setInvTab(key)}
                              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                                invTab === key
                                  ? 'border-teal-500 text-teal-700'
                                  : 'border-transparent text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {label}
                              {hasSelected && (
                                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {/* Per-tab search (sticky) */}
                      {invTab === 'imaging_orders' && (
                        <div className="relative mt-2 mb-1">
                          <input type="text" value={imagingSearch} onChange={(e) => setImagingSearch(e.target.value)} placeholder="Search imaging & scans…" className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400" />
                          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          {imagingSearch && (<button type="button" onClick={() => setImagingSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={11} /></button>)}
                        </div>
                      )}
                      {invTab === 'required_investigations' && (
                        <div className="relative mt-2 mb-1">
                          <input type="text" value={labSearch} onChange={(e) => setLabSearch(e.target.value)} placeholder="Search investigations…" className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400" />
                          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          {labSearch && (<button type="button" onClick={() => setLabSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={11} /></button>)}
                        </div>
                      )}
                      </div>{/* end sticky header */}
                      {/* Scrollable list */}
                      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3 pt-1">
                      {/* ── Imaging Orders tab ── */}
                      {invTab === 'imaging_orders' && (() => {
                        const allImaging = [...masterCatalog.imaging, ...masterCatalog.scan];
                        const filteredImaging = imagingSearch
                          ? allImaging.filter((i) => i.name.toLowerCase().includes(imagingSearch.toLowerCase()))
                          : allImaging;
                        const categoryOrder = ['Consultation Charges', 'Diagnostic Scans', 'Laser Procedures', 'Minor Procedures'];
                        const grouped: Record<string, MasterCatalogItem[]> = {};
                        filteredImaging.forEach((item) => {
                          const cat = item.category ?? 'Other';
                          if (!grouped[cat]) grouped[cat] = [];
                          grouped[cat].push(item);
                        });
                        const sortedCats = [
                          ...categoryOrder.filter((c) => grouped[c]),
                          ...Object.keys(grouped).filter((c) => !categoryOrder.includes(c)),
                        ];

                        return (
                          <>
                            {sortedCats.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-3">
                                {imagingSearch ? 'No results match your search' : 'No imaging items available'}
                              </p>
                            ) : (
                              <div className="space-y-2">
                            {sortedCats.map((cat) => (
                              <div key={cat}>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 py-1 sticky top-0 bg-gray-50">
                                  {cat}
                                </p>
                                <div className="space-y-1">
                                  {grouped[cat].map((item) => {
                                    const isSelected = selectedInvestigations.has(item.id);
                                    const inv = selectedInvestigations.get(item.id);
                                    const isDoctorSuggested = inv?.source === 'doctor';
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => { if (!isReadOnly) toggleInvestigation(item); }}
                                        className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all ${
                                          isSelected
                                            ? 'bg-teal-50 border border-teal-300'
                                            : 'hover:bg-gray-100 border border-transparent'
                                        } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                            isSelected ? 'bg-teal-600 border-teal-600' : 'border-gray-400'
                                          }`}>
                                            {isSelected && <span className="text-white leading-none" style={{ fontSize: '8px' }}>✓</span>}
                                          </div>
                                          <span className={`truncate ${isSelected ? 'text-teal-800 font-medium' : 'text-gray-700'}`}>{item.name}</span>
                                          {isDoctorSuggested && (
                                            <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-semibold flex-shrink-0">🩺 Dr</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                                          <span className={`font-semibold ${isSelected ? 'text-teal-700' : 'text-gray-500'}`}>
                                            ₹{(item.price ?? 0).toLocaleString('en-IN')}
                                          </span>
                                          {['Diagnostic Scans', 'Laser Procedures', 'Minor Procedures'].includes(item.category ?? '') && (
                                            <span className="text-gray-400 text-[9px]">/eye</span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* ── Required Investigations tab ── */}
                      {invTab === 'required_investigations' && (() => {
                        const categoryOrder = ['General Investigations', 'Cardiac Investigations', 'Viral Markers', 'Pre-Operative Panel'];
                        const grouped: Record<string, MasterCatalogItem[]> = {};
                        const labQ = labSearch.toLowerCase();
                        masterCatalog.lab.forEach((item) => {
                          if (labQ && !item.name.toLowerCase().includes(labQ)) return;
                          const cat = item.category ?? 'Other';
                          if (!grouped[cat]) grouped[cat] = [];
                          grouped[cat].push(item);
                        });
                        // Append INVESTIGATIONS variants from service catalog into Pre-Operative Panel
                        const investigationVariants = catalog?.categories
                          .find(c => c.code === 'INVESTIGATIONS')
                          ?.services.flatMap(svc => svc.variants) ?? [];
                        investigationVariants.forEach((v) => {
                          if (labQ && !v.name.toLowerCase().includes(labQ)) return;
                          const cat = 'Pre-Operative Panel';
                          if (!grouped[cat]) grouped[cat] = [];
                          if (!grouped[cat].some(existing => existing.id === v.id)) {
                            grouped[cat].push({
                              id: v.id,
                              name: v.name,
                              code: v.code,
                              category: cat,
                              testType: 'Lab' as const,
                              price: v.price,
                            });
                          }
                        });
                        const sortedCats = [
                          ...categoryOrder.filter((c) => grouped[c]),
                          ...Object.keys(grouped).filter((c) => !categoryOrder.includes(c)),
                        ];

                        return (
                          <>
                            {sortedCats.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-3">
                                {labSearch ? 'No results match your search' : 'No lab items available'}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {sortedCats.map((cat) => (
                                  <div key={cat}>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 py-1 sticky top-0 bg-gray-50">
                                      {cat}
                                    </p>
                                    <div className="space-y-1">
                                      {grouped[cat].map((item) => {
                                        const isSelected = selectedInvestigations.has(item.id);
                                        const inv = selectedInvestigations.get(item.id);
                                        const isDoctorSuggested = inv?.source === 'doctor';
                                        const urgencyTag = inv?.urgency;
                                        return (
                                          <button
                                            key={item.id}
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => { if (!isReadOnly) toggleInvestigation(item); }}
                                            className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all ${
                                              isSelected
                                                ? 'bg-teal-50 border border-teal-300'
                                                : 'hover:bg-gray-100 border border-transparent'
                                            } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                                isSelected ? 'bg-teal-600 border-teal-600' : 'border-gray-400'
                                              }`}>
                                                {isSelected && <span className="text-white leading-none" style={{ fontSize: '8px' }}>✓</span>}
                                              </div>
                                              <span className={`truncate ${isSelected ? 'text-teal-800 font-medium' : 'text-gray-700'}`}>{item.name}</span>
                                              {isDoctorSuggested && (
                                                <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-semibold flex-shrink-0">🩺 Dr</span>
                                              )}
                                              {isSelected && urgencyTag && urgencyTag !== 'Routine' && (
                                                <span className={`px-1 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${
                                                  urgencyTag === 'STAT'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                  {urgencyTag}
                                                </span>
                                              )}
                                            </div>
                                            <span className={`font-semibold flex-shrink-0 ml-1 ${isSelected ? 'text-teal-700' : 'text-gray-500'}`}>
                                              ₹{(item.price ?? 0).toLocaleString('en-IN')}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Summary */}
                      {selectedInvestigations.size > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {Array.from(selectedInvestigations.values()).map((inv) => (
                              <span
                                key={inv.catalogId ?? inv.testName}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  inv.urgency === 'STAT'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : inv.urgency === 'Urgent'
                                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                                    : 'bg-teal-50 text-teal-700 border-teal-200'
                                }`}
                              >
                                {inv.testName}
                                {inv.urgency !== 'Routine' && (
                                  <span className="opacity-70"> · {inv.urgency}</span>
                                )}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500">
                            {selectedInvestigations.size} selected ·{' '}
                            <span className="text-teal-700 font-semibold">
                              ₹{Array.from(selectedInvestigations.values()).reduce((s, i) => s + i.price, 0).toLocaleString('en-IN')}
                            </span>
                          </p>
                        </div>
                      )}
                      </div>{/* end scrollable list */}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Form */}
              <div className="flex-1 min-w-0 overflow-y-auto scrollbar-hide space-y-4 pb-4">
                {/* Counselling Summary — always visible; shows placeholder when nothing is selected */}
                {(() => {
                  const summaryVariant = catalog ? flattenCatalog(catalog).find(v => v.id === selectedVariantId) : null;
                  const displayPrice: number | null = summaryVariant
                    ? (savedOverrides.length > 0 ? savedOverrides[0].overriddenPrice : summaryVariant.price)
                    : null;
                  const eyeForSummary = summaryVariant?.priceType === 'BOTH_EYES' ? 'BE' : selectedEye;
                  const summaryIol = iolOptions.find(i => i.id === selectedIolId) ?? null;

                  // Eye-specific imaging/scan IDs (charged per-eye)
                  const eyeSpecificInvIds = new Set<string>(
                    [...masterCatalog.imaging, ...masterCatalog.scan]
                      .filter(i => ['Diagnostic Scans', 'Laser Procedures', 'Minor Procedures'].includes(i.category ?? ''))
                      .map(i => i.id)
                  );

                  // Split investigations into imaging/scans vs lab
                  const allInvList = Array.from(selectedInvestigations.values());
                  const imagingList = allInvList.filter(inv => inv.testType === 'Imaging' || inv.testType === 'Scan');
                  const labList    = allInvList.filter(inv => inv.testType !== 'Imaging' && inv.testType !== 'Scan');
                  const imagingTotal = imagingList.reduce((s, i) => s + i.price, 0);
                  const labTotal     = labList.reduce((s, i) => s + i.price, 0);
                  const grandTotal   = (displayPrice ?? 0) + (summaryIol?.price ?? 0) + imagingTotal + labTotal;
                  const hasSurgery   = !!(summaryVariant || summaryIol);

                  if (!hasSurgery && allInvList.length === 0) return (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-xs flex items-center justify-center">✓</span>
                        Counselling Summary
                      </h3>
                      {(queueStatus === 'RepeatCounselling' || queueStatus === 'Processed' || queueStatus === 'Done') ? (
                        <div className="text-center py-3">
                          <p className="text-xs text-amber-600 font-medium">Previous procedure selection could not be restored.</p>
                          <p className="text-xs text-gray-400 mt-1">Select a procedure from the left panel and save to anchor the selection.</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-4">
                          Select a procedure or add investigations to see the cost breakdown.
                        </p>
                      )}
                    </div>
                  );

                  return (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                        <span className="w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] flex items-center justify-center">✓</span>
                        Counselling Summary
                      </h3>

                      {/* Entire summary is a 2-col grid: [label | price] — guarantees one shared price column */}
                      <div className="grid grid-cols-[1fr_minmax(6rem,auto)] gap-y-1.5 items-center">

                        {/* ── Surgery / Procedure ── */}
                        {hasSurgery && (
                          <>
                            <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1 pb-0.5">Surgery / Procedure</p>

                            {summaryVariant && displayPrice !== null && (
                              <>
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                  <span className="font-semibold text-sm text-gray-800 truncate">{sanitizeVariantName(summaryVariant.name)}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                                    eyeForSummary === 'RE' ? 'bg-orange-100 text-orange-700' :
                                    eyeForSummary === 'LE' ? 'bg-purple-100 text-purple-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>{eyeForSummary === 'BE' ? 'Both' : eyeForSummary}</span>
                                </div>
                                <span className="font-bold text-sm text-gray-900 text-right tabular-nums">
                                  ₹{displayPrice.toLocaleString('en-IN')}
                                  {priceSuffix(summaryVariant.priceType) && (
                                    <span className="font-normal text-gray-400 text-xs ml-0.5">{priceSuffix(summaryVariant.priceType)}</span>
                                  )}
                                </span>
                              </>
                            )}

                            {summaryIol && (
                              <>
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                  <span className="text-gray-400 text-[9px] font-bold uppercase flex-shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">IOL</span>
                                  <span className="font-semibold text-sm text-gray-700 truncate">{summaryIol.modelName}</span>
                                  <span className="text-gray-400 text-[10px] flex-shrink-0">{summaryIol.brandManufacturer}</span>
                                </div>
                                <span className="font-bold text-sm text-gray-700 text-right tabular-nums">₹{summaryIol.price.toLocaleString('en-IN')}</span>
                              </>
                            )}
                          </>
                        )}

                        {/* ── Imaging / Scans ── */}
                        {imagingList.length > 0 && (
                          <>
                            <div className="col-span-2 border-t border-gray-100 mt-1" />
                            <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1 pb-0.5">Imaging / Scans</p>

                            {imagingList.map(inv => (
                              <>
                                <div key={`name-${inv.catalogId ?? inv.testName}`} className="flex items-center gap-1 min-w-0 pl-2 pr-2">
                                  <span className="text-blue-400 flex-shrink-0" style={{ fontSize: 8 }}>●</span>
                                  <span className="text-sm text-gray-700 truncate">{inv.testName}</span>
                                  {inv.eye && (
                                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                                      inv.eye === 'RE' ? 'bg-orange-100 text-orange-700' :
                                      inv.eye === 'LE' ? 'bg-purple-100 text-purple-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>{inv.eye === 'BE' ? 'Both' : inv.eye}</span>
                                  )}
                                </div>
                                <span key={`price-${inv.catalogId ?? inv.testName}`} className="font-medium text-sm text-gray-800 text-right tabular-nums">₹{inv.price.toLocaleString('en-IN')}</span>
                              </>
                            ))}

                            {/* Imaging Subtotal */}
                            <div className="col-span-2 border-t border-dashed border-blue-100 mt-0.5" />
                            <span className="text-sm font-bold text-blue-600 pl-2">Imaging Total</span>
                            <span className="text-sm font-bold text-blue-700 text-right tabular-nums">₹{imagingTotal.toLocaleString('en-IN')}</span>
                          </>
                        )}

                        {/* ── Investigations (Lab) ── */}
                        {labList.length > 0 && (
                          <>
                            <div className="col-span-2 border-t border-gray-100 mt-1" />
                            <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1 pb-0.5">Investigations</p>

                            {labList.map(inv => (
                              <>
                                <div key={`name-${inv.catalogId ?? inv.testName}`} className="flex items-center gap-1 min-w-0 pl-2 pr-2">
                                  <span className="text-teal-400 flex-shrink-0" style={{ fontSize: 8 }}>●</span>
                                  <span className="text-sm text-gray-700 truncate">{inv.testName}</span>
                                </div>
                                <span key={`price-${inv.catalogId ?? inv.testName}`} className="font-medium text-sm text-gray-800 text-right tabular-nums">₹{inv.price.toLocaleString('en-IN')}</span>
                              </>
                            ))}

                            {/* Lab Subtotal */}
                            <div className="col-span-2 border-t border-dashed border-teal-100 mt-0.5" />
                            <span className="text-sm font-bold text-teal-600 pl-2">Lab Total</span>
                            <span className="text-sm font-bold text-teal-700 text-right tabular-nums">₹{labTotal.toLocaleString('en-IN')}</span>
                          </>
                        )}

                        {/* ── Grand Total ── */}
                        <div className="col-span-2 border-t-2 border-gray-300 mt-2" />
                        <span className="font-bold text-base text-gray-900">Grand Total</span>
                        <span className="font-extrabold text-lg text-indigo-700 text-right tabular-nums">₹{grandTotal.toLocaleString('en-IN')}</span>

                        {/* ── Package Quote (optional, inline editable) ── */}
                        {!showPackageEdit && (packageName || Number(packageRate) > 0) ? (
                          <>
                            <div className="col-span-2 border-t border-dashed border-indigo-200 mt-1" />
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-indigo-400 text-base flex-shrink-0">📦</span>
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block">Package Opted</span>
                                <span className="font-bold text-base text-indigo-700 truncate block">{packageName || '—'}</span>
                              </div>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => setShowPackageEdit(true)}
                                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                                >
                                  ✎ Edit
                                </button>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-semibold text-green-500 uppercase tracking-wider block">Best Price</span>
                              <span className="font-extrabold text-lg text-indigo-700 tabular-nums">
                                {Number(packageRate) > 0 ? `₹${Number(packageRate).toLocaleString('en-IN')}` : '—'}
                              </span>
                            </div>
                          </>
                        ) : !showPackageEdit && !isReadOnly ? (
                          <div className="col-span-2 pt-1">
                            <button type="button" onClick={() => setShowPackageEdit(true)} className="text-xs text-gray-400 hover:text-indigo-600 underline transition-colors">+ Add package quote</button>
                          </div>
                        ) : null}

                      </div>

                      {/* Package edit form (outside grid) */}
                      {showPackageEdit && (
                        <div className="pt-3 mt-2 border-t border-dashed border-indigo-200">
                          <div className="flex flex-wrap items-end gap-3">
                            {/* Package Name — Radix Select */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Package Name</label>
                              <Select
                                value={packageName || undefined}
                                onValueChange={(v) => { setPackageName(v); markDirty(); }}
                              >
                                <SelectTrigger className="w-auto min-w-[10rem] max-w-[18rem]">
                                  <SelectValue placeholder="Select package" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PACKAGE_OPTIONS.map(o => (
                                    <SelectItem key={o} value={o}>{o}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Package Rate */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Rate (₹)</label>
                              <input
                                type="number"
                                placeholder="0"
                                value={packageRate}
                                onChange={e => { setPackageRate(e.target.value ? Number(e.target.value) : ''); markDirty(); }}
                                className="h-10 w-28 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 tabular-nums"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end mt-3">
                            <button type="button" onClick={() => setShowPackageEdit(false)} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">Cancel</button>
                            <button type="button" onClick={() => { setShowPackageEdit(false); markDirty(); }} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Set</button>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })()}
                {/* Patient Info Form */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                    Patient & Payment Details
                  </h3>
                  <div className="space-y-3">
                    {/* Payment Type + Insurance Company side by side */}
                    <div className="flex flex-wrap items-end gap-3">
                      {/* Payment type */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type <span className="text-red-500">*</span></label>
                        <Select
                          value={paymentType || undefined}
                          onValueChange={(v) => { setPaymentType(v as CombinedPaymentType | ''); markDirty(); }}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className="w-auto min-w-[9rem] max-w-[16rem]">
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Self Pay</SelectLabel>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Card">Card</SelectItem>
                              <SelectItem value="UPI">UPI</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Insurance</SelectLabel>
                              <SelectItem value="Insurance">Insurance / TPA</SelectItem>
                              <SelectItem value="CoPay">Co-Pay</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Government Schemes</SelectLabel>
                              <SelectItem value="CGHS">CGHS</SelectItem>
                              <SelectItem value="ESH">ESH</SelectItem>
                              <SelectItem value="Arograshree">Arograshree</SelectItem>
                              <SelectItem value="SGHS">SGHS</SelectItem>
                              <SelectItem value="Railway">Railway / RELHS</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Special</SelectLabel>
                              <SelectItem value="Camp">Camp / Event</SelectItem>
                              <SelectItem value="Free">Free</SelectItem>
                              <SelectItem value="Staff">Staff</SelectItem>
                              <SelectItem value="ForeignNational">Foreign National</SelectItem>
                              <SelectItem value="Package">Custom Package</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Insurance company — shown inline when applicable */}
                      {INSURANCE_PAYMENT_TYPES.includes(paymentType as CombinedPaymentType) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Insurance Company</label>
                          <Select
                            value={insuranceCompany || undefined}
                            onValueChange={(v) => { setInsuranceCompany(v); markDirty(); }}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-auto min-w-[9rem] max-w-[16rem]">
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                            <SelectContent>
                              {insuranceProviderOptions.map(o => (
                                <SelectItem key={o.value} value={o.label}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    {/* Free surgery reason — shown only when type is Free */}
                    {paymentType === 'Free' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Free Surgery Reason</label>
                        <input
                          type="text"
                          placeholder="Enter reason"
                          value={freeSurgeryReason}
                          onChange={(e) => { setFreeSurgeryReason(e.target.value); markDirty(); }}
                          disabled={isReadOnly}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Decision */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
                    Decision
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {([
                      { value: 'DateForSurgery', label: 'Date for Surgery / Procedure' },
                      { value: 'Interested', label: 'Interested' },
                      { value: 'NotInterested', label: 'Not Interested' },
                      { value: 'NeedsTime', label: 'Needs Time / Follow-up' },
                    ] as const).map(({ value, label }) => (
                      <label key={value} className={`flex items-center gap-2 ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="radio"
                          name="decision"
                          value={value}
                          checked={decision === value}
                          onChange={() => { if (!isReadOnly) { setDecision(value); markDirty(); } }}
                          disabled={isReadOnly}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                  {/* GAP 3: follow-up fields for NeedsTime / NotInterested */}
                  {(decision === 'NotInterested' || decision === 'NeedsTime') && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold border border-yellow-300">
                          ⚠ Follow-up Required
                        </span>
                        <span className="text-xs text-gray-500">
                          {decision === 'NeedsTime' ? 'Patient needs more time before deciding' : 'Patient will be tagged for follow-up'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up Reason</label>
                          <select
                            value={followUpReason}
                            onChange={(e) => { setFollowUpReason(e.target.value); markDirty(); }}
                            disabled={isReadOnly}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          >
                            <option value="">Select reason…</option>
                            <option value="Discuss with Family">Discuss with Family</option>
                            <option value="Financial Planning">Financial Planning</option>
                            <option value="Fear of Surgery">Fear of Surgery</option>
                            <option value="Wants Second Opinion">Wants Second Opinion</option>
                            <option value="Travel Plans">Travel Plans</option>
                            <option value="Medical Hold">Medical Hold</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up Date</label>
                          <input
                            type="date"
                            value={followUpDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => { setFollowUpDate(e.target.value); markDirty(); }}
                            disabled={isReadOnly}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {/* GAP 4: schedule required hint */}
                  {(decision === 'DateForSurgery' || decision === 'Interested') && !schedule && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      ⚠ A surgery schedule is required for this decision — please complete step 4
                    </div>
                  )}
                </div>

                {/* Schedule */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">4</span>
                    Surgery Schedule
                  </h3>
                  {schedule ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-green-800">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {new Date(schedule.selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-green-800">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">{formatTime(schedule.surgeryStartTime)}</span>
                        </div>
                        <span className="text-xs text-green-700">{schedule.operationTheatre} · {schedule.doctor}</span>
                      </div>
                      <button
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="px-3 py-1.5 border border-green-400 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                      >
                        Update Schedule
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors w-full justify-center"
                    >
                      <Calendar className="h-4 w-4" />
                      Select a Schedule
                    </button>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">5</span>
                      Notes
                    </h3>
                  </div>
                  {([
                    { key: 'counsellor' as const, label: 'Counsellor Notes', value: counsellorNotes, set: (v: string) => { setCounsellorNotes(v); markDirty(); } },
                    { key: 'patient' as const, label: 'Patient Remarks', value: patientRemarks, set: (v: string) => { setPatientRemarks(v); markDirty(); } },
                    { key: 'doctor' as const, label: 'Doctor Notes', value: doctorNotes, set: (v: string) => { setDoctorNotes(v); markDirty(); } },
                  ]).map(({ key, label, value, set }) => (
                    <div key={key} className="border-b border-gray-100 last:border-b-0">
                      <button
                        onClick={() => setOpenNotes(n => ({ ...n, [key]: !n[key] }))}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        {openNotes[key] ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </button>
                      {openNotes[key] && (
                        <div className="px-4 pb-4">
                          <textarea
                            rows={3}
                            value={value}
                            readOnly={isReadOnly}
                            onChange={(e) => { if (!isReadOnly) set(e.target.value); }}
                            placeholder={`Enter ${label.toLowerCase()}…`}
                            className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${isReadOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Checkboxes */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">6</span>
                    Additional Options
                  </h3>
                  <div className="space-y-2">
                    {([
                      { label: 'Want To See Doctor Again', value: wantToSeeDoctor, set: (v: boolean) => { setWantToSeeDoctor(v); markDirty(); } },
                      { label: 'Interested to Upgrade', value: interestedToUpgrade, set: (v: boolean) => { setInterestedToUpgrade(v); markDirty(); } },
                      { label: 'Not Required Pre Authorization', value: notRequiredPreAuth, set: (v: boolean) => { setNotRequiredPreAuth(v); markDirty(); } },
                    ]).map(({ label, value, set }) => (
                      <label key={label} className={`flex items-center gap-3 ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer group'}`}>
                        <input
                          type="checkbox"
                          checked={value}
                          disabled={isReadOnly}
                          onChange={(e) => { if (!isReadOnly) set(e.target.checked); }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 disabled:cursor-not-allowed"
                        />
                        <span className={`text-sm text-gray-700 ${isReadOnly ? '' : 'group-hover:text-gray-900'}`}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 mt-4 bg-white border-t border-gray-200 rounded-xl shadow-lg px-6 py-3 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !decision || isReadOnly}
          className="flex items-center gap-2 px-8 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isSaving && (
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          Save Session
        </button>
      </div>

      {/* Schedule Modal */}
      <ScheduleSurgeryModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSubmit={handleScheduleSubmit}
        existingSchedule={schedule}
      />

      {/* GAP 7: History Modal */}
      <SessionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        entries={historyEntries}
        isLoading={isHistoryLoading}
        anchorRef={historyBtnRef}
      />
    </div>
  );
}
