'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Heart, Stethoscope } from 'lucide-react';
import { examinationApi, visitsApi } from '@/lib/api';

interface MedHistoryTabProps {
  patientId: string;
  patientData?: any;
}

export function MedHistoryTab({ patientId, patientData }: MedHistoryTabProps) {
  const [examinations, setExaminations] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [patientId]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const [examsRes, visitsRes] = await Promise.all([
        examinationApi.getByPatient(patientId).catch(() => ({ data: [] })),
        visitsApi.getByPatient(patientId).catch(() => ({ data: [] })),
      ]);
      setExaminations(examsRes.data || []);
      setVisits(visitsRes.data || []);
    } catch (err: any) {
      console.error('Error loading history:', err);
      setError('Failed to load medical history.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading medical history...</span>
      </div>
    );
  }

  // Extract unique diagnoses from examinations
  const diagnoses = [...new Set(
    examinations
      .filter(e => e.diagnosis)
      .map(e => e.diagnosis)
  )];

  // Extract conditions from patient data
  const conditions = patientData?.medicalConditions?.split(',').map((c: string) => c.trim()).filter(Boolean) || [];
  const medications = patientData?.medications?.split(',').map((m: string) => m.trim()).filter(Boolean) || [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{visits.length}</p>
          <p className="text-sm text-blue-600">Total Visits</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-purple-700">{examinations.length}</p>
          <p className="text-sm text-purple-600">Examinations</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-indigo-700">{diagnoses.length}</p>
          <p className="text-sm text-indigo-600">Diagnoses</p>
        </div>
      </div>

      {/* Known Conditions */}
      {conditions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" /> Chronic Conditions
          </h3>
          <div className="flex flex-wrap gap-2">
            {conditions.map((condition: string, i: number) => (
              <span key={i} className="px-3 py-1 bg-red-50 border border-red-200 text-red-800 rounded-full text-sm">
                {condition}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current Medications */}
      {medications.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Medications</h3>
          <div className="flex flex-wrap gap-2">
            {medications.map((med: string, i: number) => (
              <span key={i} className="px-3 py-1 bg-green-50 border border-green-200 text-green-800 rounded-full text-sm">
                {med}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Diagnoses History */}
      {diagnoses.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-indigo-500" /> Diagnosis History
          </h3>
          <div className="space-y-2">
            {diagnoses.map((dx, i) => {
              const exams = examinations.filter(e => e.diagnosis === dx);
              const latestExam = exams[0];
              return (
                <div key={i} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{dx}</h4>
                      <p className="text-xs text-gray-500">
                        {exams.length} occurrence{exams.length !== 1 ? 's' : ''}
                        {latestExam?.examinationDate ? ` | Last: ${new Date(latestExam.examinationDate).toLocaleDateString()}` : ''}
                        {latestExam?.doctorName ? ` | Dr. ${latestExam.doctorName}` : ''}
                      </p>
                    </div>
                  </div>
                  {latestExam?.treatment && (
                    <p className="mt-1 text-sm text-gray-600">Treatment: {latestExam.treatment}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Visit Timeline */}
      {visits.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Visits</h3>
          <div className="space-y-2">
            {visits.slice(0, 10).map((visit: any) => (
              <div key={visit.id} className="flex items-center gap-3 border rounded-lg p-3 bg-white">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Activity className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {visit.visitType || visit.purpose || 'Visit'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(visit.visitDate || visit.checkedInAt || visit.createdAt).toLocaleDateString()}
                    {visit.doctorName ? ` | ${visit.doctorName}` : ''}
                    {visit.departmentName ? ` | ${visit.departmentName}` : ''}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  visit.status === 'completed' ? 'bg-green-100 text-green-800' :
                  visit.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>{visit.status || 'completed'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {visits.length === 0 && examinations.length === 0 && conditions.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No medical history found for this patient.</p>
        </div>
      )}
    </div>
  );
}
