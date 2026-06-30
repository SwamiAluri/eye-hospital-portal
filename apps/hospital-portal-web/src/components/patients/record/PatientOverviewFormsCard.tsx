'use client';

import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { patientConsentsApi, type PatientConsent } from '@/lib/api/patient-consents.api';
import type { PatientRecordTabKey } from '@/lib/patients/patient-record-tabs';
import { patientRecordTabLabel } from '@/lib/patients/patient-record-tabs';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

function formatAssignDate(consent: PatientConsent) {
  const raw = consent.grantedAt ?? consent.createdAt;
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleDateString();
  } catch {
    return '—';
  }
}

function statusLabel(consent: PatientConsent) {
  if (consent.status === 'revoked') return 'Revoked';
  if (consent.status === 'expired') return 'Expired';
  if (consent.isGranted) return 'Signed';
  return 'Pending';
}

export function PatientOverviewFormsCard({
  patientId,
  onOpenTab,
}: {
  patientId: string;
  onOpenTab?: (tab: PatientRecordTabKey) => void;
}) {
  const [consents, setConsents] = useState<PatientConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await patientConsentsApi.getByPatient(patientId);
        if (!cancelled) setConsents((response.data ?? []).slice(0, 5));
      } catch {
        if (!cancelled) {
          setConsents([]);
          setError('Could not load forms and consents.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4"
      data-testid={patientLookupTestIds.overviewFormsCard}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-emerald-600" />
          Forms
        </h3>
        {onOpenTab && (
          <button
            type="button"
            onClick={() => onOpenTab('consents')}
            className="text-xs text-emerald-700 hover:text-emerald-900"
          >
            {patientRecordTabLabel('consents')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-3 h-16 bg-gray-50 rounded-lg animate-pulse" />
      ) : error ? (
        <p className="mt-3 text-sm text-amber-700">{error}</p>
      ) : consents.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No forms or consents on file.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 pr-3 font-medium">Title</th>
                <th className="pb-2 pr-3 font-medium">Assigned</th>
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {consents.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 pr-3 text-gray-900">{c.consentName}</td>
                  <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">
                    {formatAssignDate(c)}
                  </td>
                  <td className="py-2 pr-3 text-gray-600 capitalize">
                    {c.consentType?.replace(/_/g, ' ') ?? '—'}
                  </td>
                  <td className="py-2 capitalize text-gray-700">{statusLabel(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
