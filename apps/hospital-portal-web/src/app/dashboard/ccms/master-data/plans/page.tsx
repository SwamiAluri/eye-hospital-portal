'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  listCoveragePackages,
  listInsurancePayers,
  type CoveragePackage,
  type InsurancePayer,
} from '@/lib/api/ccms/ccms-master-data.api';
import { RefreshCw, AlertCircle, Package } from 'lucide-react';

export default function CoveragePlansPage() {
  const [packages, setPackages] = useState<CoveragePackage[]>([]);
  const [payers, setPayers] = useState<InsurancePayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payerFilter, setPayerFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([listCoveragePackages(payerFilter || undefined), listInsurancePayers()])
      .then(([pkgs, pays]) => { setPackages(pkgs); setPayers(pays); })
      .catch(e => setError(e?.message ?? 'Failed to load coverage packages'))
      .finally(() => setLoading(false));
  }, [payerFilter]);

  useEffect(load, [load]);

  const filtered = packages.filter(p =>
    !search || p.packageName.toLowerCase().includes(search.toLowerCase()) || p.packageCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Coverage Plans & Packages</h1>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search packages…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <select
            value={payerFilter}
            onChange={e => setPayerFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">All Payers</option>
            {payers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Package Name</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Payer</th>
                <th className="px-4 py-3 text-right">Coverage Limit (₹)</th>
                <th className="px-4 py-3 text-right">Co-pay %</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.length === 0
                  ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                          No coverage packages found.
                        </td>
                      </tr>
                    )
                  : filtered.map(pkg => (
                      <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{pkg.packageName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{pkg.packageCode ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{pkg.payerName ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {pkg.coverageLimit != null ? `₹${pkg.coverageLimit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {pkg.coPayPercent != null ? `${pkg.coPayPercent}%` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            pkg.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {pkg.status ?? 'unknown'}
                          </span>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
