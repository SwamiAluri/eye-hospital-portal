'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getAgingReport, type AgingBucket } from '@/lib/api/ccms/ccms-settlements.api';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function CcmsSettlementPage() {
  const [aging, setAging] = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAgingReport()
      .then(setAging)
      .catch(e => setError(e?.message ?? 'Failed to load settlement data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Settlements & Reconciliation</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/ccms/settlement/reconciliation" className="text-xs text-indigo-600 hover:underline font-medium">
            Reconciliation →
          </Link>
          <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <h2 className="text-sm font-bold text-gray-700">Aging Report</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-24" />)}
          </div>
        ) : aging.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No aging data available.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {aging.map(b => (
              <div key={b.bucket} className={`rounded-xl p-4 ${
                b.bucket.includes('90') ? 'bg-red-50 text-red-800' :
                b.bucket.includes('60') ? 'bg-orange-50 text-orange-800' :
                b.bucket.includes('30') ? 'bg-yellow-50 text-yellow-800' :
                'bg-green-50 text-green-800'
              }`}>
                <p className="text-xs font-medium opacity-75">{b.bucket}</p>
                <p className="text-xl font-bold mt-1">{b.count}</p>
                <p className="text-xs opacity-60">₹{(b.totalAmount / 1000).toFixed(0)}K</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">View individual settlements in the case detail pages.</p>
          <Link href="/dashboard/ccms/cases" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
            Browse Cases →
          </Link>
        </div>
      </div>
    </div>
  );
}
