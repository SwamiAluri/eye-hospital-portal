'use client';

import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { visitsApi } from '@/lib/api';

export function VisitsTab({ patientId }: { patientId: string }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await visitsApi.getByPatient(patientId);
        const rows = response.data?.items ?? response.data ?? [];
        if (!cancelled) setVisits(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setVisits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return <div className="flex justify-center py-12 text-sm text-gray-500">Loading visits…</div>;
  }

  if (visits.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No visits recorded</h3>
        <p className="text-gray-600">This patient has not had any visits yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Visit history</h3>
        <span className="text-sm text-gray-600">{visits.length} visit(s)</span>
      </div>
      {visits.map((visit, idx) => (
        <div
          key={visit.id || idx}
          className="bg-white border-l-4 border-indigo-500 rounded-r-lg p-5 shadow-sm"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="font-semibold text-gray-900">
                {visit.checkedInAt
                  ? new Date(visit.checkedInAt).toLocaleDateString()
                  : visit.visitDate
                    ? new Date(visit.visitDate).toLocaleDateString()
                    : 'Visit'}
              </h4>
              <p className="text-sm text-gray-600">
                {visit.visitType || 'General'}
                {visit.departmentName ? ` · ${visit.departmentName}` : ''}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
              {visit.status || 'unknown'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Token</p>
              <p className="font-medium">{visit.tokenNumber ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Doctor</p>
              <p className="font-medium">{visit.consultantName || visit.doctorName || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Station</p>
              <p className="font-medium">{visit.currentStation || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Bill</p>
              <p className="font-medium">{visit.billNumber || '—'}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
