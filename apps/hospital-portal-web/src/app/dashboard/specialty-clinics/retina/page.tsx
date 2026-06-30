'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Activity,
  Calendar,
  Image,
  TrendingUp,
  AlertCircle,
  Users,
  Layers,
  FileText,
} from 'lucide-react';
import { useHasPermission } from '@/hooks/use-permissions';
import { useSpecialtyClinicPatients } from '@/hooks/use-specialty-clinic-patients';
import { mapLookupToSpecialtyQueueRow } from '@/lib/specialty-clinics/lookup-queue-mappers';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { toast } from 'react-hot-toast';

function RetinaClinicPageContent() {
  const router = useRouter();
  const lookupQuery = useSpecialtyClinicPatients('RETINA');
  const loading = lookupQuery.isLoading;

  const canEdit = useHasPermission('CLINICAL:RETINA:EDIT');

  const patientQueue = useMemo(() => {
    if (lookupQuery.isError) {
      toast.error('Failed to load retina queue');
      return [];
    }
    return (lookupQuery.data?.items ?? []).map((row) => {
      const base = mapLookupToSpecialtyQueueRow(row);
      return {
        id: base.id,
        name: base.name,
        mrn: base.mrn,
        age: base.age ?? 0,
        gender: base.gender || '—',
        diagnosis: base.reasonForVisit || '—',
        urgency: base.priority,
        lastVisit: base.lastVisitAt?.slice(0, 10) ?? '—',
        nextInjection: '—',
        drGrade: '—',
        visualAcuityOD: '—',
        visualAcuityOS: '—',
        hasCME: false,
      };
    });
  }, [lookupQuery.data?.items, lookupQuery.isError]);

  const statistics = useMemo(
    () => ({
      totalPatients: patientQueue.length,
      urgentCases: patientQueue.filter((p) => p.urgency === 'Urgent').length,
      injectionsToday: 0,
      newDR: 0,
    }),
    [patientQueue],
  );

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Emergency':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Urgent':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Eye className="w-7 h-7 mr-3 text-red-600" />
            Retina Clinic
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Diabetic Retinopathy, AMD, Retinal Detachment, Anti-VEGF Therapy
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/specialty-clinics/retina/new-patient')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Users className="w-5 h-5" />
          <span>New Patient</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-semibold mb-1">Total Patients</p>
              <p className="text-3xl font-bold text-blue-900">{statistics.totalPatients}</p>
            </div>
            <Users className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-semibold mb-1">Urgent Cases</p>
              <p className="text-3xl font-bold text-red-900">{statistics.urgentCases}</p>
            </div>
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>

        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-semibold mb-1">Injections Today</p>
              <p className="text-3xl font-bold text-purple-900">{statistics.injectionsToday}</p>
            </div>
            <Activity className="w-10 h-10 text-purple-600" />
          </div>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-semibold mb-1">New DR Cases</p>
              <p className="text-3xl font-bold text-green-900">{statistics.newDR}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={() => router.push('/dashboard/specialty-clinics/retina/injections')}
            className="bg-white border-2 border-purple-300 rounded-lg p-4 hover:bg-purple-50 transition-colors text-left"
          >
            <Activity className="w-6 h-6 text-purple-600 mb-2" />
            <p className="font-semibold text-gray-900">Anti-VEGF Schedule</p>
            <p className="text-xs text-gray-600 mt-1">View injection calendar</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/specialty-clinics/retina/imaging')}
            className="bg-white border-2 border-blue-300 rounded-lg p-4 hover:bg-blue-50 transition-colors text-left"
          >
            <Image className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-semibold text-gray-900">Fundus Gallery</p>
            <p className="text-xs text-gray-600 mt-1">Browse fundus images</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/specialty-clinics/retina/oct')}
            className="bg-white border-2 border-green-300 rounded-lg p-4 hover:bg-green-50 transition-colors text-left"
          >
            <Layers className="w-6 h-6 text-green-600 mb-2" />
            <p className="font-semibold text-gray-900">OCT Scans</p>
            <p className="text-xs text-gray-600 mt-1">View OCT images</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/specialty-clinics/retina/reports')}
            className="bg-white border-2 border-orange-300 rounded-lg p-4 hover:bg-orange-50 transition-colors text-left"
          >
            <FileText className="w-6 h-6 text-orange-600 mb-2" />
            <p className="font-semibold text-gray-900">DR Reports</p>
            <p className="text-xs text-gray-600 mt-1">Generate reports</p>
          </button>
        </div>
      </div>

      {/* Patient Queue */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-blue-600" />
          Today's Patient Queue
        </h3>

        <div className="space-y-4">
          {patientQueue.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No patients in queue</p>
            </div>
          ) : (
            patientQueue.map((patient) => (
              <div
                key={patient.id}
                onClick={() => router.push(`/dashboard/specialty-clinics/retina/${patient.id}`)}
                className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  {/* Patient Info */}
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-700 font-bold text-lg">
                        {patient.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{patient.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{patient.mrn}</span> • <span>{patient.age} years</span> •{' '}
                        <span>{patient.gender}</span>
                      </div>
                    </div>
                  </div>

                  {/* Urgency Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${getUrgencyColor(
                      patient.urgency
                    )}`}
                  >
                    {patient.urgency}
                  </span>
                </div>

                {/* Diagnosis */}
                <div className="mt-4 bg-purple-50 border border-purple-200 rounded-md p-3">
                  <p className="text-sm font-semibold text-purple-900 mb-1">Diagnosis:</p>
                  <p className="text-sm text-purple-800">{patient.diagnosis}</p>
                </div>

                {/* Clinical Summary Grid */}
                <div className="mt-4 grid grid-cols-5 gap-3">
                  {/* DR Grade */}
                  <div className="bg-orange-50 rounded-md p-3 border border-orange-200">
                    <p className="text-xs font-semibold text-orange-900 mb-1">DR Grade</p>
                    <p className="text-sm font-mono font-bold text-orange-900">{patient.drGrade}</p>
                  </div>

                  {/* Visual Acuity */}
                  <div className="bg-blue-50 rounded-md p-3 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Visual Acuity</p>
                    <p className="text-sm font-mono font-bold text-blue-900">
                      OD: {patient.visualAcuityOD}
                    </p>
                    <p className="text-sm font-mono font-bold text-blue-900">
                      OS: {patient.visualAcuityOS}
                    </p>
                  </div>

                  {/* CME Status */}
                  <div
                    className={`rounded-md p-3 border ${
                      patient.hasCME
                        ? 'bg-red-50 border-red-200'
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold mb-1 ${
                        patient.hasCME ? 'text-red-900' : 'text-green-900'
                      }`}
                    >
                      CME Status
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        patient.hasCME ? 'text-red-900' : 'text-green-900'
                      }`}
                    >
                      {patient.hasCME ? 'Present ⚠️' : 'Absent ✓'}
                    </p>
                  </div>

                  {/* Last Visit */}
                  <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-900 mb-1">Last Visit</p>
                    <p className="text-sm text-gray-900">
                      {new Date(patient.lastVisit).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Next Injection */}
                  <div className="bg-purple-50 rounded-md p-3 border border-purple-200">
                    <p className="text-xs font-semibold text-purple-900 mb-1">Next Injection</p>
                    <p className="text-sm font-bold text-purple-900">
                      {new Date(patient.nextInjection).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-4 flex justify-end">
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2">
                    <Eye className="w-4 h-4" />
                    <span>View Details</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function RetinaClinicPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:RETINA:VIEW">
      <RetinaClinicPageContent />
    </ProtectedRoute>
  );
}
