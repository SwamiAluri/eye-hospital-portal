'use client';

import React, { useState, useEffect } from 'react';
import { Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { examinationApi } from '@/lib/api';

interface EyeHistoryTabProps {
  patientId: string;
}

export function EyeHistoryTab({ patientId }: EyeHistoryTabProps) {
  const [examinations, setExaminations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEyeHistory();
  }, [patientId]);

  const loadEyeHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await examinationApi.getByPatient(patientId);
      const exams = response.data || [];
      // Filter eye-related examinations and sort by date
      setExaminations(exams.sort((a: any, b: any) =>
        new Date(b.examinationDate || b.createdAt).getTime() - new Date(a.examinationDate || a.createdAt).getTime()
      ));
    } catch (err: any) {
      console.error('Error loading eye history:', err);
      setError('Failed to load eye examination history.');
      setExaminations([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading eye history...</span>
      </div>
    );
  }

  // Extract visual acuity data for chart
  const vaData = examinations.slice(0, 10).reverse().map(exam => ({
    date: new Date(exam.examinationDate || exam.createdAt).toLocaleDateString(),
    od: exam.visualAcuityRight || exam.vaRight || null,
    os: exam.visualAcuityLeft || exam.vaLeft || null,
    iop_od: exam.iopRight || null,
    iop_os: exam.iopLeft || null,
  }));

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      {/* VA Summary */}
      {vaData.length > 0 && (
       <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Visual Acuity Trend</h3>
        <div className="bg-white border rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase">
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-center">VA OD (Right)</th>
                  <th className="py-2 text-center">VA OS (Left)</th>
                  <th className="py-2 text-center">IOP OD</th>
                  <th className="py-2 text-center">IOP OS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vaData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-2 text-gray-700">{row.date}</td>
                    <td className="py-2 text-center font-medium">{row.od || '-'}</td>
                    <td className="py-2 text-center font-medium">{row.os || '-'}</td>
                    <td className="py-2 text-center">{row.iop_od ? `${row.iop_od} mmHg` : '-'}</td>
                    <td className="py-2 text-center">{row.iop_os ? `${row.iop_os} mmHg` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
       </div>
      )}

      {/* Examination History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Eye Examination History</h3>
        <div className="space-y-3">
          {examinations.map(exam => (
            <div key={exam.id} className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Eye className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{exam.examinationType || 'Eye Examination'}</h4>
                    <p className="text-sm text-gray-500">
                      {new Date(exam.examinationDate || exam.createdAt).toLocaleDateString()}
                      {exam.doctorName ? ` | Dr. ${exam.doctorName}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  exam.status === 'completed' ? 'bg-green-100 text-green-800' :
                  exam.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {exam.status || 'completed'}
                </span>
              </div>

              {/* Eye-specific findings */}
              <div className="mt-3 grid grid-cols-2 gap-4">
                {(exam.visualAcuityRight || exam.vaRight || exam.visualAcuityLeft || exam.vaLeft) && (
                  <div className="p-2 bg-blue-50 rounded">
                    <h5 className="text-xs font-medium text-blue-700 mb-1">Visual Acuity</h5>
                    <p className="text-sm">OD: {exam.visualAcuityRight || exam.vaRight || '-'}</p>
                    <p className="text-sm">OS: {exam.visualAcuityLeft || exam.vaLeft || '-'}</p>
                  </div>
                )}
                {(exam.iopRight || exam.iopLeft) && (
                  <div className="p-2 bg-green-50 rounded">
                    <h5 className="text-xs font-medium text-green-700 mb-1">IOP</h5>
                    <p className="text-sm">OD: {exam.iopRight ? `${exam.iopRight} mmHg` : '-'}</p>
                    <p className="text-sm">OS: {exam.iopLeft ? `${exam.iopLeft} mmHg` : '-'}</p>
                  </div>
                )}
              </div>

              {exam.diagnosis && (
                <p className="mt-2 text-sm"><strong>Diagnosis:</strong> {exam.diagnosis}</p>
              )}
              {exam.treatment && (
                <p className="mt-1 text-sm text-gray-600"><strong>Treatment:</strong> {exam.treatment}</p>
              )}
              {exam.notes && (
                <p className="mt-1 text-sm text-gray-500 italic">{exam.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {examinations.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500">
          <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No eye examination history found for this patient.</p>
        </div>
      )}
    </div>
  );
}
