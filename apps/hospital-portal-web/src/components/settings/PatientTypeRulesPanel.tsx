'use client';

import Link from 'next/link';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { usePatientTypeMaster } from '@/hooks/use-patient-type-master';

/**
 * Read-only view of patient payment type workflow rules (sourced from Master Data).
 * Edits happen in Master Data admin only.
 */
export function PatientTypeRulesPanel() {
  const { configs, loading, error } = usePatientTypeMaster();

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading patient type rules…
      </div>
    );
  }

  if (error || configs.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">No patient type rules available</p>
          <p className="text-xs mt-1 text-amber-700">
            Seed or configure <code className="font-mono">patient.patient_type</code> in Master Data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Patient Type Rules</h3>
          <p className="text-sm text-gray-500 mt-1">
            Workflow rules for counsellor payment-mode selection. Read-only here — edit in Master Data.
          </p>
        </div>
        <Link
          href="/dashboard/master-data/patient_setup"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
        >
          Edit in Master Data
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Category</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Advance</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Pre-approval</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Documents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {configs.map((c) => {
              const cfg = c.configuration;
              const advanceLabel = cfg.zeroAdvancePayment
                ? 'None (zero advance)'
                : cfg.requiresAdvancePayment
                  ? `${cfg.advancePercentage}%`
                  : '—';
              return (
                <tr key={c.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.displayName}</p>
                    <p className="text-xs text-gray-500">{c.description}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">
                    {c.configuration.category ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{advanceLabel}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {cfg.requiresPreApproval ? 'Yes' : 'No'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {cfg.requiredDocuments?.length
                      ? cfg.requiredDocuments.join(', ')
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
