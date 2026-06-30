'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Users, Calendar, CheckCircle, Calculator, Eye } from 'lucide-react';
import { useHasPermission } from '@/hooks/use-permissions';
import { useSpecialtyClinicPatients } from '@/hooks/use-specialty-clinic-patients';
import { mapLookupToSpecialtyQueueRow } from '@/lib/specialty-clinics/lookup-queue-mappers';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { toast } from 'react-hot-toast';

function CataractClinicPageContent() {
  const router = useRouter();
  const lookupQuery = useSpecialtyClinicPatients('CATARACT');
  const loading = lookupQuery.isLoading;

  const canEdit = useHasPermission('CLINICAL:CATARACT:EDIT');

  const patients = useMemo(() => {
    if (lookupQuery.isError) {
      toast.error('Failed to load cataract queue');
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
        lensGradeOD: '—',
        lensGradeOS: '—',
        vaOD: '—',
        vaOS: '—',
        iolPowerOD: null as number | null,
        iolPowerOS: null as number | null,
        biometryDone: false,
        iolCalculated: false,
        surgeryDate: null as string | null,
        priority: base.priority,
        surgicalEye: '—',
        reasonForVisit: base.reasonForVisit,
      };
    });
  }, [lookupQuery.data?.items, lookupQuery.isError]);

  const stats = {
    totalPatients: patients.length,
    surgeryPending: patients.filter(p => !p.surgeryDate).length,
    iolCalculated: patients.filter(p => p.iolCalculated).length,
    biometryDone: patients.filter(p => p.biometryDone).length,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'bg-red-100 text-red-900 border-red-300';
      case 'Urgent': return 'bg-orange-100 text-orange-900 border-orange-300';
      case 'Routine': return 'bg-green-100 text-green-900 border-green-300';
      default: return 'bg-gray-100 text-gray-900 border-gray-300';
    }
  };

  const getSeverityColor = (grade: string) => {
    const noMatch = grade.match(/NO([\d.]+)/);
    const noValue = noMatch ? parseFloat(noMatch[1]) : 0;
    
    if (noValue >= 5.0) return 'text-red-900 bg-red-50 border-red-200';
    if (noValue >= 3.0) return 'text-orange-900 bg-orange-50 border-orange-200';
    if (noValue >= 2.0) return 'text-yellow-900 bg-yellow-50 border-yellow-200';
    return 'text-green-900 bg-green-50 border-green-200';
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
            <Layers className="w-7 h-7 mr-3 text-purple-600" />
            Cataract Clinic
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            LOCS III Grading, IOL Calculation & Surgery Management
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => router.push('/dashboard/patients?action=new')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
          >
            <span>New Patient</span>
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600 mb-1">Total Patients</p>
              <p className="text-3xl font-bold text-blue-900">{stats.totalPatients}</p>
            </div>
            <Users className="w-12 h-12 text-blue-400" />
          </div>
        </div>

        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-600 mb-1">Surgery Pending</p>
              <p className="text-3xl font-bold text-orange-900">{stats.surgeryPending}</p>
            </div>
            <Calendar className="w-12 h-12 text-orange-400" />
          </div>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-600 mb-1">IOL Calculated</p>
              <p className="text-3xl font-bold text-green-900">{stats.iolCalculated}</p>
            </div>
            <Calculator className="w-12 h-12 text-green-400" />
          </div>
        </div>

        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-600 mb-1">Biometry Done</p>
              <p className="text-3xl font-bold text-purple-900">{stats.biometryDone}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-4">
        <button className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg flex items-center justify-center space-x-3">
          <Calculator className="w-6 h-6" />
          <span className="font-semibold">IOL Calculator</span>
        </button>
        <button className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center space-x-3">
          <Calendar className="w-6 h-6" />
          <span className="font-semibold">Surgery Schedule</span>
        </button>
        <button className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg flex items-center justify-center space-x-3">
          <Eye className="w-6 h-6" />
          <span className="font-semibold">Biometry Queue</span>
        </button>
        <button className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg flex items-center justify-center space-x-3">
          <CheckCircle className="w-6 h-6" />
          <span className="font-semibold">Post-Op Reviews</span>
        </button>
      </div>

      {/* Patient Queue */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Patient Queue</h2>

        {patients.map((patient) => (
          <div
            key={patient.id}
            onClick={() => router.push(`/dashboard/specialty-clinics/cataract/${patient.id}`)}
            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer"
          >
            {/* Patient Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {patient.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{patient.name}</h3>
                  <p className="text-sm text-gray-600">
                    {patient.mrn} • {patient.age} {patient.gender[0]} • Surgical Eye: <span className="font-semibold">{patient.surgicalEye}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${getPriorityColor(patient.priority)}`}>
                  {patient.priority}
                </span>
                {patient.surgeryDate && (
                  <div className="bg-green-100 border-2 border-green-300 rounded-lg px-4 py-2">
                    <p className="text-xs text-green-700 font-semibold">Surgery Date</p>
                    <p className="text-sm font-bold text-green-900">
                      {new Date(patient.surgeryDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Clinical Summary Grid */}
            <div className="grid grid-cols-6 gap-3">
              {/* LOCS III Grade OD */}
              <div className={`rounded-md p-3 border-2 ${getSeverityColor(patient.lensGradeOD)}`}>
                <p className="text-xs font-semibold mb-1">LOCS III - OD</p>
                <p className="text-sm font-mono font-bold">{patient.lensGradeOD}</p>
              </div>

              {/* LOCS III Grade OS */}
              <div className={`rounded-md p-3 border-2 ${getSeverityColor(patient.lensGradeOS)}`}>
                <p className="text-xs font-semibold mb-1">LOCS III - OS</p>
                <p className="text-sm font-mono font-bold">{patient.lensGradeOS}</p>
              </div>

              {/* Visual Acuity */}
              <div className="bg-blue-50 rounded-md p-3 border-2 border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-1">Visual Acuity</p>
                <p className="text-sm font-mono font-bold text-blue-900">OD: {patient.vaOD}</p>
                <p className="text-sm font-mono font-bold text-blue-900">OS: {patient.vaOS}</p>
              </div>

              {/* IOL Power */}
              <div className={`rounded-md p-3 border-2 ${
                patient.iolCalculated ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-xs font-semibold mb-1 ${
                  patient.iolCalculated ? 'text-green-900' : 'text-gray-600'
                }`}>IOL Power</p>
                {patient.iolPowerOD !== null ? (
                  <>
                    <p className="text-sm font-mono font-bold text-green-900">OD: +{patient.iolPowerOD}D</p>
                    <p className="text-sm font-mono font-bold text-green-900">OS: +{patient.iolPowerOS}D</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Not calculated</p>
                )}
              </div>

              {/* Biometry */}
              <div className={`rounded-md p-3 border-2 ${
                patient.biometryDone ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-xs font-semibold mb-1 ${
                  patient.biometryDone ? 'text-purple-900' : 'text-gray-600'
                }`}>Biometry</p>
                <p className={`text-sm font-bold ${
                  patient.biometryDone ? 'text-green-700' : 'text-red-700'
                }`}>
                  {patient.biometryDone ? '✓ Done' : '⚠️ Pending'}
                </p>
              </div>

              {/* Surgery Readiness */}
              <div className={`rounded-md p-3 border-2 ${
                patient.biometryDone && patient.iolCalculated
                  ? 'bg-green-50 border-green-300'
                  : 'bg-orange-50 border-orange-300'
              }`}>
                <p className={`text-xs font-semibold mb-1 ${
                  patient.biometryDone && patient.iolCalculated
                    ? 'text-green-900'
                    : 'text-orange-900'
                }`}>Surgery Ready</p>
                <p className={`text-sm font-bold ${
                  patient.biometryDone && patient.iolCalculated
                    ? 'text-green-700'
                    : 'text-orange-700'
                }`}>
                  {patient.biometryDone && patient.iolCalculated ? '✓ Ready' : '⚠️ Incomplete'}
                </p>
              </div>
            </div>
          </div>
        ))}

        {patients.length === 0 && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <Layers className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 font-semibold">No patients in cataract queue</p>
            <p className="text-sm text-gray-500 mt-2">Add patients to start managing cataract surgeries</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CataractClinicPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:CATARACT:VIEW">
      <CataractClinicPageContent />
    </ProtectedRoute>
  );
}
