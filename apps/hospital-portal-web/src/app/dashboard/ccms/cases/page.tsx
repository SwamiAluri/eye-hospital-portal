'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { listCoverageCases, type CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { PreAuthStatusBadge } from '@/components/ccms/PreAuthStatusBadge';
import {
  Search, RefreshCw, AlertCircle, Building2, User,
  ChevronRight, Plus, Filter, Folder,
} from 'lucide-react';
import { useInsuranceTypeMaster } from '@/hooks/use-insurance-masters';

const PAGE_SIZE = 25;

// Map each state to a phase label + color accent for the row border
const STATE_PHASE: Record<string, { label: string; border: string; text: string; bg: string }> = {
  DRAFT:                   { label: 'Intake',     border: 'border-l-indigo-400',  text: 'text-indigo-700',  bg: 'bg-indigo-50' },
  ELIGIBILITY_PENDING:     { label: 'Intake',     border: 'border-l-indigo-400',  text: 'text-indigo-700',  bg: 'bg-indigo-50' },
  ELIGIBILITY_VERIFIED:    { label: 'Intake',     border: 'border-l-indigo-400',  text: 'text-indigo-700',  bg: 'bg-indigo-50' },
  POLICY_CAPTURED:         { label: 'Intake',     border: 'border-l-indigo-400',  text: 'text-indigo-700',  bg: 'bg-indigo-50' },
  AUTHORIZATION_REQUIRED:  { label: 'Intake',     border: 'border-l-indigo-400',  text: 'text-indigo-700',  bg: 'bg-indigo-50' },
  PREAUTH_GENERATED:       { label: 'Pre-Auth',   border: 'border-l-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  PREAUTH_SENT:            { label: 'Pre-Auth',   border: 'border-l-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  WAITING_APPROVAL:        { label: 'Pre-Auth',   border: 'border-l-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  CLARIFICATION_REQUIRED:  { label: 'Pre-Auth',   border: 'border-l-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  RESUBMITTED:             { label: 'Pre-Auth',   border: 'border-l-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  APPROVED:                { label: 'Approval',   border: 'border-l-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  PARTIAL_APPROVAL:        { label: 'Approval',   border: 'border-l-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  ADMISSION_READY:         { label: 'Clinical',   border: 'border-l-teal-400',    text: 'text-teal-700',    bg: 'bg-teal-50' },
  ADMITTED:                { label: 'Clinical',   border: 'border-l-teal-400',    text: 'text-teal-700',    bg: 'bg-teal-50' },
  SURGERY_SCHEDULED:       { label: 'Clinical',   border: 'border-l-teal-400',    text: 'text-teal-700',    bg: 'bg-teal-50' },
  SURGERY_COMPLETED:       { label: 'Clinical',   border: 'border-l-teal-400',    text: 'text-teal-700',    bg: 'bg-teal-50' },
  BILL_PENDING:            { label: 'Claims',     border: 'border-l-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50' },
  BILL_FINALIZED:          { label: 'Claims',     border: 'border-l-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50' },
  CLAIM_READY:             { label: 'Claims',     border: 'border-l-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50' },
  CLAIM_SUBMITTED:         { label: 'Claims',     border: 'border-l-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50' },
  CLAIM_IN_PROCESS:        { label: 'Claims',     border: 'border-l-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50' },
  SETTLEMENT_PENDING:      { label: 'Settlement', border: 'border-l-violet-400',  text: 'text-violet-700',  bg: 'bg-violet-50' },
  PARTIAL_SETTLEMENT:      { label: 'Settlement', border: 'border-l-violet-400',  text: 'text-violet-700',  bg: 'bg-violet-50' },
  FULL_SETTLEMENT:         { label: 'Settlement', border: 'border-l-violet-400',  text: 'text-violet-700',  bg: 'bg-violet-50' },
  RECONCILED:              { label: 'Settlement', border: 'border-l-violet-400',  text: 'text-violet-700',  bg: 'bg-violet-50' },
  CLOSED:                  { label: 'Closed',     border: 'border-l-gray-300',    text: 'text-gray-500',    bg: 'bg-gray-50' },
  REJECTED:                { label: 'Rejected',   border: 'border-l-red-400',     text: 'text-red-700',     bg: 'bg-red-50' },
  CANCELLED:               { label: 'Cancelled',  border: 'border-l-red-400',     text: 'text-red-700',     bg: 'bg-red-50' },
};

const STATES = [
  { value: '',                        label: 'All States' },
  { value: 'DRAFT',                   label: 'Draft' },
  { value: 'ELIGIBILITY_PENDING',     label: 'Eligibility Pending' },
  { value: 'ELIGIBILITY_VERIFIED',    label: 'Eligibility Verified' },
  { value: 'POLICY_CAPTURED',         label: 'Policy Captured' },
  { value: 'AUTHORIZATION_REQUIRED',  label: 'Auth Required' },
  { value: 'PREAUTH_GENERATED',       label: 'Pre-Auth Generated' },
  { value: 'PREAUTH_SENT',            label: 'Sent to TPA' },
  { value: 'WAITING_APPROVAL',        label: 'Waiting Approval' },
  { value: 'CLARIFICATION_REQUIRED',  label: 'Clarification Required' },
  { value: 'APPROVED',                label: 'Approved' },
  { value: 'PARTIAL_APPROVAL',        label: 'Partial Approval' },
  { value: 'ADMITTED',                label: 'Admitted' },
  { value: 'SURGERY_COMPLETED',       label: 'Surgery Completed' },
  { value: 'BILL_PENDING',            label: 'Bill Pending' },
  { value: 'CLAIM_SUBMITTED',         label: 'Claim Submitted' },
  { value: 'CLAIM_IN_PROCESS',        label: 'Claim Processing' },
  { value: 'SETTLEMENT_PENDING',      label: 'Settlement Pending' },
  { value: 'PARTIAL_SETTLEMENT',      label: 'Partial Settlement' },
  { value: 'FULL_SETTLEMENT',         label: 'Full Settlement' },
  { value: 'RECONCILED',              label: 'Reconciled' },
  { value: 'CLOSED',                  label: 'Closed' },
  { value: 'REJECTED',                label: 'Rejected' },
];

const PAYER_FILTER_BY_INSURANCE_CODE: Record<string, string> = {
  MEDICLAIM: 'insurance',
  CASHLESS: 'cashless',
  REIMBURSEMENT: 'insurance',
  COPAY: 'copay',
  GOVT: 'govt',
};

const FALLBACK_PAYER_TYPES = [
  { value: '',          label: 'All Payer Types' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'tpa',       label: 'TPA' },
  { value: 'govt',      label: 'Govt Scheme' },
  { value: 'cashless',  label: 'Cashless' },
];

function inr(n: number | null | undefined) {
  if (n == null || n === 0) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 border-l-2 border-l-gray-200">
      {Array.from({ length: 9 }).map((_, j) => (
        <td key={j} className="px-4 py-3.5">
          <div className={`h-3 bg-gray-100 rounded-full animate-pulse ${j === 0 ? 'w-24' : j === 1 ? 'w-36' : j === 2 ? 'w-16' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  );
}

export default function CcmsCasesPage() {
  const { options: insuranceTypeOptions } = useInsuranceTypeMaster();
  const payerTypes = useMemo(() => {
    if (insuranceTypeOptions.length === 0) return FALLBACK_PAYER_TYPES;
    return [
      { value: '', label: 'All Payer Types' },
      ...insuranceTypeOptions.map((o) => ({
        value: PAYER_FILTER_BY_INSURANCE_CODE[o.value] ?? o.value.toLowerCase(),
        label: o.label,
      })),
    ];
  }, [insuranceTypeOptions]);

  const [cases,   setCases]   = useState<CoverageCase[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [state,   setState]   = useState('');
  const [payerType, setPayerType] = useState('');
  const [search,  setSearch]  = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listCoverageCases({
      pageNumber: page,
      pageSize:   PAGE_SIZE,
      state:      state     || undefined,
      payerType:  payerType || undefined,
      search:     debouncedSearch || undefined,
    })
      .then(r => { setCases(r.cases ?? []); setTotal(r.totalCount ?? 0); })
      .catch(e => setError((e as Error)?.message ?? 'Failed to load cases'))
      .finally(() => setLoading(false));
  }, [page, state, payerType, debouncedSearch]);

  useEffect(load, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(search || state || payerType);

  return (
    <div className="flex flex-col h-full bg-gray-50/60">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 font-medium">CCMS</span>
            <span className="text-gray-300">/</span>
            <span className="text-[11px] text-gray-600 font-semibold">Cases</span>
          </div>
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-500" />
            Coverage Cases
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} case${total !== 1 ? 's' : ''}${hasFilters ? ' (filtered)' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 disabled:opacity-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2.5 px-5 py-3 bg-white border-b border-gray-100 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search case #, patient, insurer…"
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-gray-50 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl bg-gray-50 px-2 py-1">
          <Filter className="w-3 h-3 text-gray-400" />
          <select
            value={state}
            onChange={e => { setState(e.target.value); setPage(1); }}
            className="text-xs bg-transparent focus:outline-none text-gray-700 cursor-pointer pr-1"
          >
            {STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl bg-gray-50 px-2 py-1">
          <Building2 className="w-3 h-3 text-gray-400" />
          <select
            value={payerType}
            onChange={e => { setPayerType(e.target.value); setPage(1); }}
            className="text-xs bg-transparent focus:outline-none text-gray-700 cursor-pointer pr-1"
          >
            {payerTypes.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setState(''); setPayerType(''); setPage(1); }}
            className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={load} className="ml-auto font-semibold hover:underline">Retry</button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">Case #</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Patient / Insurer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Phase</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Estimated</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Approved</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Pt. Pays</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Created</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : cases.length === 0
                    ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                              <Folder className="w-6 h-6 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-600">
                                {hasFilters ? 'No cases match your filters' : 'No cases yet'}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {hasFilters
                                  ? 'Try adjusting the state or payer filter.'
                                  : 'Cases appear once a counsellor submits to the insurance cell.'}
                              </p>
                            </div>
                            {hasFilters && (
                              <button
                                onClick={() => { setSearch(''); setState(''); setPayerType(''); }}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                              >
                                Clear all filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                    : cases.map((c) => {
                      const phase = STATE_PHASE[c.currentState];
                      return (
                      <tr
                        key={c.id}
                        className={`border-b border-gray-100 hover:bg-indigo-50/20 transition-colors group cursor-pointer border-l-2 ${phase?.border ?? 'border-l-gray-200'}`}
                      >
                        {/* Case # */}
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/dashboard/ccms/cases/${c.id}`}
                            className="font-bold font-mono text-indigo-600 hover:text-indigo-800 transition-colors text-xs"
                          >
                            {c.caseNumber}
                          </Link>
                        </td>

                        {/* Patient / Insurer combined */}
                        <td className="px-4 py-3.5 max-w-[180px]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-indigo-600">
                              {c.patientName ? c.patientName.split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase() : <User className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{c.patientName ?? '—'}</p>
                              <p className="text-[10px] text-gray-400 truncate">{c.insurerName ?? c.payerType}</p>
                            </div>
                          </div>
                        </td>

                        {/* Phase */}
                        <td className="px-4 py-3.5">
                          {phase && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${phase.bg} ${phase.text}`}>
                              {phase.label}
                            </span>
                          )}
                        </td>

                        {/* State */}
                        <td className="px-4 py-3.5">
                          <PreAuthStatusBadge state={c.currentState} />
                        </td>

                        {/* Estimated */}
                        <td className="px-4 py-3.5 text-right text-gray-500 tabular-nums">
                          {inr(c.estimatedAmount)}
                        </td>

                        {/* Approved */}
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className={c.approvedAmount && c.approvedAmount > 0 ? 'font-bold text-green-700' : 'text-gray-300'}>
                            {inr(c.approvedAmount)}
                          </span>
                        </td>

                        {/* Patient payable */}
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className={c.patientPayableAmount && c.patientPayableAmount > 0 ? 'font-bold text-rose-600' : 'text-gray-300'}>
                            {inr(c.patientPayableAmount)}
                          </span>
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap">
                          {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>

                        {/* Arrow */}
                        <td className="px-4 py-3.5">
                          <Link href={`/dashboard/ccms/cases/${c.id}`}>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                          </Link>
                        </td>
                      </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && cases.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of <span className="font-semibold text-gray-600">{total.toLocaleString('en-IN')}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-1 text-[11px] font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white hover:border-indigo-300 transition-colors"
                >
                  Prev
                </button>
                <span className="text-[11px] text-gray-500 px-2">
                  {page} / {totalPages || 1}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1 text-[11px] font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white hover:border-indigo-300 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
