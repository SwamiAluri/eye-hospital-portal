'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { listCoverageCases, type CoverageCase, type CcmsState } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { PreAuthStatusBadge } from '@/components/ccms/PreAuthStatusBadge';
import { Search, RefreshCw, Plus, AlertCircle } from 'lucide-react';

const STATES: { value: string; label: string }[] = [
  { value: '', label: 'All States' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ELIGIBILITY_VERIFIED', label: 'Verified' },
  { value: 'PREAUTH_GENERATED', label: 'Pre-Auth Sent' },
  { value: 'WAITING_APPROVAL', label: 'Waiting Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PARTIAL_APPROVAL', label: 'Partial Approval' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function CcmsCasesPage() {
  const [cases, setCases] = useState<CoverageCase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listCoverageCases({ pageNumber: page, pageSize: 20, state: state || undefined })
      .then(r => { setCases(r.cases ?? []); setTotal(r.totalCount ?? 0); })
      .catch(e => setError(e?.message ?? 'Failed to load cases'))
      .finally(() => setLoading(false));
  }, [page, state]);

  useEffect(load, [load]);

  const filtered = search.trim()
    ? cases.filter(c =>
        c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
        c.payerType.toLowerCase().includes(search.toLowerCase()),
      )
    : cases;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Coverage Cases</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-100">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cases…"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <select
          value={state}
          onChange={e => { setState(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{total} total</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium">Case #</th>
                <th className="px-4 py-3 text-left font-medium">Payer Type</th>
                <th className="px-4 py-3 text-left font-medium">State</th>
                <th className="px-4 py-3 text-right font-medium">Estimated</th>
                <th className="px-4 py-3 text-right font-medium">Approved</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded-full" /></td>
                      ))}
                    </tr>
                  ))
                : filtered.length === 0
                  ? <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">No cases found.</td></tr>
                  : filtered.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/ccms/cases/${c.id}`} className="text-indigo-600 hover:underline font-medium">
                            {c.caseNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.payerType}</td>
                        <td className="px-4 py-3"><PreAuthStatusBadge state={c.currentState} /></td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {c.estimatedAmount != null ? `₹${c.estimatedAmount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-700">
                          {c.approvedAmount != null && c.approvedAmount > 0 ? `₹${c.approvedAmount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(c.createdAt).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between mt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Previous
            </button>
            <span className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total || loading}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
