'use client';

import { useEffect, useState } from 'react';
import { Pill } from 'lucide-react';
import { prescriptionsApi } from '@/lib/api';
import { format } from 'date-fns';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

export function PrescriptionsTab({ patientId }: { patientId: string }) {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await prescriptionsApi.getByPatient(patientId);
        const rows = response.data?.items ?? response.data ?? [];
        if (!cancelled) setPrescriptions(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setPrescriptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-sm text-gray-500">Loading prescriptions…</div>
    );
  }

  if (prescriptions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Pill className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">No prescriptions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Prescription history</h3>
        <span className="text-sm text-gray-600">{prescriptions.length} prescription(s)</span>
      </div>
      {prescriptions.map((rx) => (
        <div key={rx.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium text-gray-900">
                {rx.medicationName || rx.drugName || 'Prescription'}
              </h4>
              <p className="text-sm text-gray-600">
                {formatDate(rx.prescribedDate || rx.createdAt)}
                {rx.prescribedBy || rx.doctorName
                  ? ` · ${rx.prescribedBy || rx.doctorName}`
                  : ''}
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-800 capitalize">
              {rx.status || 'active'}
            </span>
          </div>
          {(rx.dosage || rx.frequency || rx.duration) && (
            <p className="text-sm text-gray-700 mt-2">
              {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(' · ')}
            </p>
          )}
          {rx.instructions && <p className="text-sm text-gray-600 mt-1">{rx.instructions}</p>}
        </div>
      ))}
    </div>
  );
}
