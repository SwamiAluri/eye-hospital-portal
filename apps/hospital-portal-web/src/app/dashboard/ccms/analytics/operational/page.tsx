'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getOperationalSummary,
  getCashFlowReport,
  getStateDistribution,
  type OperationalSummary,
  type CashFlowDataPoint,
  type StateDistributionItem,
} from '@/lib/api/ccms/ccms-dashboard.api';
import { RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';

export default function CcmsAnalyticsPage() {
  const [summary, setSummary] = useState<OperationalSummary | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowDataPoint[]>([]);
  const [distribution, setDistribution] = useState<StateDistributionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getOperationalSummary(), getCashFlowReport(), getStateDistribution()])
      .then(([s, cf, dist]) => { setSummary(s); setCashFlow(cf); setDistribution(dist); })
      .catch(e => setError(e?.message ?? 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Operational Analytics</h1>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* State Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4">Case State Distribution</h2>
          {loading
            ? <div className="animate-pulse bg-gray-100 rounded h-32" />
            : distribution.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">No data available.</p>
              : (
                  <div className="space-y-2">
                    {distribution.map(item => (
                      <div key={item.state} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-36 truncate">{item.state}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-8 text-right">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )
          }
        </div>

        {/* Cash Flow */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4">Cash Flow</h2>
          {loading
            ? <div className="animate-pulse bg-gray-100 rounded h-32" />
            : cashFlow.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">No cash flow data available.</p>
              : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-200">
                          <th className="pb-2 text-left font-medium">Period</th>
                          <th className="pb-2 text-right font-medium">Claimed (₹)</th>
                          <th className="pb-2 text-right font-medium">Settled (₹)</th>
                          <th className="pb-2 text-right font-medium">Pending (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cashFlow.map(row => (
                          <tr key={row.period}>
                            <td className="py-1.5 text-gray-700">{row.period}</td>
                            <td className="py-1.5 text-right text-gray-700">₹{row.claimed.toLocaleString('en-IN')}</td>
                            <td className="py-1.5 text-right text-green-700 font-medium">₹{row.settled.toLocaleString('en-IN')}</td>
                            <td className="py-1.5 text-right text-orange-600">₹{row.pending.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
          }
        </div>

        {/* KPI summary */}
        {!loading && summary && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-4">Key Metrics</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Avg Pre-Auth TAT</p>
                <p className="font-bold text-gray-800">{summary.avgPreAuthTurnaroundHours.toFixed(1)}h</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Rejection Rate</p>
                <p className={`font-bold ${summary.rejectionRatePct > 15 ? 'text-red-700' : 'text-green-700'}`}>
                  {summary.rejectionRatePct.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Approved MTD</p>
                <p className="font-bold text-gray-800">₹{summary.totalApprovedAmountMtd.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Settled MTD</p>
                <p className="font-bold text-green-700">₹{summary.totalSettledAmountMtd.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
