'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { examinationApi } from '@/lib/api';
import { format } from 'date-fns';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

export function ExaminationsTab({ patientId }: { patientId: string }) {
  const [examinations, setExaminations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await examinationApi.getByPatient(patientId);
        const rows = response.data || [];
        if (!cancelled) setExaminations(rows);
      } catch {
        if (!cancelled) setExaminations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return <div className="flex justify-center py-12 text-sm text-gray-500">Loading examinations…</div>;
  }

  if (examinations.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No examinations found</p>
        <p className="text-sm text-gray-500 mt-2">Examination records will appear here once created</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Examination history</h3>
        <span className="text-sm text-gray-600">{examinations.length} examination(s)</span>
      </div>
      {examinations.map((exam) => (
        <div key={exam.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-medium text-gray-900">{exam.examinationType || 'Examination'}</h4>
              <p className="text-sm text-gray-600">
                {formatDate(exam.examinationDate || exam.createdAt)}
                {exam.doctorName ? ` · Dr. ${exam.doctorName}` : ''}
              </p>
            </div>
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                exam.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : exam.status === 'in-progress'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
              }`}
            >
              {exam.status || 'recorded'}
            </span>
          </div>
          {exam.diagnosis && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Diagnosis:</span> {exam.diagnosis}
            </p>
          )}
          {exam.treatment && (
            <p className="text-sm text-gray-700 mt-1">
              <span className="font-medium">Treatment:</span> {exam.treatment}
            </p>
          )}
          {exam.notes && (
            <p className="text-sm text-gray-600 mt-2">{exam.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}
