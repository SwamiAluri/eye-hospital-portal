'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getCashFlowReport,
  type CashFlowDataPoint,
} from '@/lib/api/ccms/ccms-dashboard.api';
import { RefreshCw, AlertCircle, DollarSign } from 'lucide-react';

type Granularity = 'daily' | 'weekly' | 'monthly';

export default function FinancialAnalyticsPage() {
  const [data, setData] = useState<CashFlowDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('monthly');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getCashFlowReport({ granularity })
      .then(setData)
      .catch(e => setError(e?.message ?? 'Failed to load financial data'))
      .finally(() => setLoading(false));
  }, [granularity]);

  useEffect(load, [load]);

  const totals = data.reduce(
    (acc, row) => ({
      claimed: acc.claimed + row.claimed,
      settled: acc.settled + row.settled,
      pending: acc.pending + row.pending,
    }),
    { claimed: 0, settled: 0, pending: 0 }
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Financial Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={granularity}
            onChange={e => setGranularity(e.target.value as Granularity)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
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

        {/* Summary KPIs */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Claimed', value: totals.claimed, color: 'text-gray-800' },
              { label: 'Total Settled', value: totals.settled, color: 'text-green-700' },
              { label: 'Total Pending', value: totals.pending, color: 'text-orange-600' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>
                  ₹{kpi.value.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Cash flow table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">Cash Flow — {granularity.charAt(0).toUpperCase() + granularity.slice(1)}</h2>
          </div>
          {loading
            ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="animate-pulse h-6 bg-gray-100 rounded" />)}
                </div>
              )
            : data.length === 0
              ? <p className="px-5 py-8 text-center text-sm text-gray-400">No data for selected period.</p>
              : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Period</th>
                        <th className="px-4 py-3 text-right">Claimed (₹)</th>
                        <th className="px-4 py-3 text-right">Settled (₹)</th>
                        <th className="px-4 py-3 text-right">Pending (₹)</th>
                        <th className="px-4 py-3 text-right">Recovery %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.map(row => {
                        const recovery = row.claimed > 0 ? ((row.settled / row.claimed) * 100).toFixed(1) : '—';
                        return (
                          <tr key={row.period} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-700 font-medium">{row.period}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">₹{row.claimed.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2.5 text-right text-green-700 font-medium">₹{row.settled.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2.5 text-right text-orange-600">₹{row.pending.toLocaleString('en-IN')}</td>
                            <td className={`px-4 py-2.5 text-right font-medium ${
                              recovery !== '—' && parseFloat(recovery) >= 80 ? 'text-green-700' : 'text-orange-600'
                            }`}>
                              {recovery === '—' ? '—' : `${recovery}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
          }
        </div>
      </div>
    </div>
  );
}
