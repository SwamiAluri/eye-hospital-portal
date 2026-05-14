'use client';

import { useEffect, useState } from 'react';
import {
  listInsurancePayers,
  listTpaOrganizations,
  listGovernmentSchemes,
  type InsurancePayer,
  type TpaOrganization,
  type GovernmentScheme,
} from '@/lib/api/ccms/ccms-master-data.api';
import { RefreshCw, AlertCircle } from 'lucide-react';

type Tab = 'payers' | 'tpa' | 'schemes';

export default function CcmsMasterDataPayersPage() {
  const [tab, setTab] = useState<Tab>('payers');
  const [payers, setPayers] = useState<InsurancePayer[]>([]);
  const [tpa, setTpa] = useState<TpaOrganization[]>([]);
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([listInsurancePayers(), listTpaOrganizations(), listGovernmentSchemes()])
      .then(([p, t, s]) => { setPayers(p); setTpa(t); setSchemes(s); })
      .catch(e => setError(e?.message ?? 'Failed to load master data'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Payers, TPA & Schemes</h1>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6 gap-1">
        {(['payers', 'tpa', 'schemes'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'payers' ? 'Insurance Payers' : t === 'tpa' ? 'TPA Organizations' : 'Govt. Schemes'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {tab === 'payers' && (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 4 }).map((__, j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded-full" /></td>)}
                      </tr>
                    ))
                  : payers.length === 0
                    ? <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">No payers configured.</td></tr>
                    : payers.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{p.shortCode ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{p.contactEmail ?? '—'}</td>
                          <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span></td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          )}

          {tab === 'tpa' && (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 4 }).map((__, j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded-full" /></td>)}
                      </tr>
                    ))
                  : tpa.length === 0
                    ? <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">No TPA organizations configured.</td></tr>
                    : tpa.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{t.shortCode ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{t.contactEmail ?? '—'}</td>
                          <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{t.status}</span></td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          )}

          {tab === 'schemes' && (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium">Scheme Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">State</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 4 }).map((__, j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded-full" /></td>)}
                      </tr>
                    ))
                  : schemes.length === 0
                    ? <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">No government schemes configured.</td></tr>
                    : schemes.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{s.schemeName}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{s.schemeCode}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{s.stateCode ?? 'National'}</td>
                          <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span></td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
