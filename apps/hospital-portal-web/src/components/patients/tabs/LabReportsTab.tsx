'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Beaker, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { labReportsApi, LabReport } from '@/lib/api/lab-reports.api';

interface LabReportsTabProps {
  patientId: string;
}

export function LabReportsTab({ patientId }: LabReportsTabProps) {
  const [reports, setReports] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    loadReports();
  }, [patientId, statusFilter, categoryFilter]);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await labReportsApi.getByPatient(patientId, {
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      });
      const rows = Array.isArray(response.data) ? response.data : [];
      setReports(rows);
    } catch (err: unknown) {
      console.error('Error loading lab reports:', err);
      setError('Lab reports are temporarily unavailable.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading lab reports...</span>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    ordered: 'bg-blue-100 text-blue-800',
    sample_collected: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    on_hold: 'bg-gray-100 text-gray-800',
  };

  const interpretationColors: Record<string, string> = {
    normal: 'text-green-600',
    abnormal: 'text-orange-600',
    critical: 'text-red-600 font-bold',
    high: 'text-orange-600',
    low: 'text-blue-600',
  };

  const categories = ['hematology', 'biochemistry', 'microbiology', 'pathology', 'ophthalmology'];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
          >
            <option value="">All Statuses</option>
            <option value="ordered">Ordered</option>
            <option value="sample_collected">Sample Collected</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {reports.map(report => (
          <div key={report.id} className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Beaker className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{report.testName}</h4>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    {report.testCode && <span>Code: {report.testCode}</span>}
                    <span className="capitalize">{report.testCategory}</span>
                    {report.priority && report.priority !== 'routine' && (
                      <span className="text-red-600 font-medium capitalize">{report.priority}</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[report.status] || 'bg-gray-100 text-gray-800'}`}>
                {report.status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Results */}
            {report.status === 'completed' && report.resultValue && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Result:</span>
                    <p className={`font-semibold ${interpretationColors[report.interpretation || ''] || 'text-gray-900'}`}>
                      {report.resultValue} {report.resultUnit}
                    </p>
                  </div>
                  {report.referenceRange && (
                    <div>
                      <span className="text-gray-500">Reference:</span>
                      <p className="text-gray-900">{report.referenceRange}</p>
                    </div>
                  )}
                  {report.interpretation && (
                    <div>
                      <span className="text-gray-500">Interpretation:</span>
                      <p className={`font-medium capitalize ${interpretationColors[report.interpretation] || ''}`}>
                        {report.interpretation === 'critical' && <AlertCircle className="w-3 h-3 inline mr-1" />}
                        {report.interpretation}
                      </p>
                    </div>
                  )}
                  {report.labName && (
                    <div>
                      <span className="text-gray-500">Lab:</span>
                      <p className="text-gray-900">{report.labName}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
              {report.orderedAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Ordered: {new Date(report.orderedAt).toLocaleDateString()}</span>}
              {report.sampleCollectedAt && <span>Collected: {new Date(report.sampleCollectedAt).toLocaleDateString()}</span>}
              {report.completedAt && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Completed: {new Date(report.completedAt).toLocaleDateString()}</span>}
              {report.orderedByName && <span>By: {report.orderedByName}</span>}
            </div>

            {report.notes && <p className="mt-2 text-sm text-gray-500 italic">{report.notes}</p>}
          </div>
        ))}
      </div>

      {reports.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No lab reports found for this patient.</p>
        </div>
      )}
    </div>
  );
}
