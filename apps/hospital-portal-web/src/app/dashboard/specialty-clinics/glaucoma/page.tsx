'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Droplet,
  TrendingUp,
  AlertTriangle,
  Users,
  Activity,
  Grid,
  Target,
} from 'lucide-react';
import { useHasPermission } from '@/hooks/use-permissions';
import { useSpecialtyClinicPatients } from '@/hooks/use-specialty-clinic-patients';
import { mapLookupToSpecialtyQueueRow } from '@/lib/specialty-clinics/lookup-queue-mappers';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { toast } from 'react-hot-toast';

function GlaucomaClinicPageContent() {
  const router = useRouter();
  const lookupQuery = useSpecialtyClinicPatients('GLAUCOMA');
  const loading = lookupQuery.isLoading;

  const canEdit = useHasPermission('CLINICAL:GLAUCOMA:EDIT');

  const patientQueue = useMemo(() => {
    if (lookupQuery.isError) {
      toast.error('Failed to load glaucoma queue');
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
        iopOD: null as number | null,
        iopOS: null as number | null,
        targetIOP: null as number | null,
        cdRatioOD: null as number | null,
        cdRatioOS: null as number | null,
        mdOD: null as number | null,
        mdOS: null as number | null,
        lastVisit: base.lastVisitAt?.slice(0, 10) ?? '—',
        medications: 0,
      };
    });
  }, [lookupQuery.data?.items, lookupQuery.isError]);

  const statistics = useMemo(
    () => ({
      totalPatients: patientQueue.length,
      highIOP: patientQueue.filter((p) => p.urgency === 'Urgent').length,
      vfProgression: 0,
      newDiagnoses: 0,
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

  const getIOPColor = (iop: number, target: number) => {
    if (iop > target + 6) return 'text-red-900 bg-red-50';
    if (iop > target + 3) return 'text-orange-900 bg-orange-50';
    if (iop <= target) return 'text-green-900 bg-green-50';
    return 'text-yellow-900 bg-yellow-50';
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
            <Droplet className="w-7 h-7 mr-3 text-blue-600" />
            Glaucoma Clinic
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            IOP Management, Visual Field Analysis, Gonioscopy, OCT RNFL
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/specialty-clinics/glaucoma/new-patient')}
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
              <p className="text-sm text-red-600 font-semibold mb-1">High IOP ({'>'} 21)</p>
              <p className="text-3xl font-bold text-red-900">{statistics.highIOP}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
        </div>

        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-semibold mb-1">VF Progression</p>
              <p className="text-3xl font-bold text-orange-900">{statistics.vfProgression}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-orange-600" />
          </div>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-semibold mb-1">New Diagnoses</p>
              <p className="text-3xl font-bold text-green-900">{statistics.newDiagnoses}</p>
            </div>
            <Activity className="w-10 h-10 text-green-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={() => router.push('/dashboard/specialty-clinics/glaucoma/iop-trends')}
            className="bg-white border-2 border-blue-300 rounded-lg p-4 hover:bg-blue-50 transition-colors text-left"
          >
            <Droplet className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-semibold text-gray-900">IOP Trends</p>
            <p className="text-xs text-gray-600 mt-1">View IOP progression</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/specialty-clinics/glaucoma/visual-fields')}
            className="bg-white border-2 border-purple-300 rounded-lg p-4 hover:bg-purple-50 transition-colors text-left"
          >
            <Grid className="w-6 h-6 text-purple-600 mb-2" />
            <p className="font-semibold text-gray-900">Visual Fields</p>
            <p className="text-xs text-gray-600 mt-1">VF analysis & progression</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/specialty-clinics/glaucoma/gonioscopy')}
            className="bg-white border-2 border-green-300 rounded-lg p-4 hover:bg-green-50 transition-colors text-left"
          >
            <Eye className="w-6 h-6 text-green-600 mb-2" />
            <p className="font-semibold text-gray-900">Gonioscopy</p>
            <p className="text-xs text-gray-600 mt-1">Angle assessment</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/specialty-clinics/glaucoma/medications')}
            className="bg-white border-2 border-orange-300 rounded-lg p-4 hover:bg-orange-50 transition-colors text-left"
          >
            <Target className="w-6 h-6 text-orange-600 mb-2" />
            <p className="font-semibold text-gray-900">Medications</p>
            <p className="text-xs text-gray-600 mt-1">Treatment adherence</p>
          </button>
        </div>
      </div>

      {/* Patient Queue */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-blue-600" />
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
                onClick={() => router.push(`/dashboard/specialty-clinics/glaucoma/${patient.id}`)}
                className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  {/* Patient Info */}
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-bold text-lg">
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
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm font-semibold text-blue-900 mb-1">Diagnosis:</p>
                  <p className="text-sm text-blue-800">{patient.diagnosis}</p>
                </div>

                {/* Clinical Summary Grid */}
                <div className="mt-4 grid grid-cols-5 gap-3">
                  {patient.iopOD == null || patient.targetIOP == null ? (
                    <div className="col-span-5 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                      IOP, VF, and medication details load from the patient chart when documented.
                    </div>
                  ) : (
                    <>
                  {/* IOP */}
                  <div className={`rounded-md p-3 border ${getIOPColor(Math.max(patient.iopOD, patient.iopOS), patient.targetIOP)}`}>
                    <p className="text-xs font-semibold mb-1">IOP (mmHg)</p>
                    <p className="text-sm font-mono font-bold">
                      OD: {patient.iopOD}
                      {patient.iopOD > 21 && ' ⚠️'}
                    </p>
                    <p className="text-sm font-mono font-bold">
                      OS: {patient.iopOS}
                      {patient.iopOS > 21 && ' ⚠️'}
                    </p>
                  </div>

                  {/* Target IOP */}
                  <div className="bg-green-50 rounded-md p-3 border border-green-200">
                    <p className="text-xs font-semibold text-green-900 mb-1">Target IOP</p>
                    <p className="text-sm font-mono font-bold text-green-900">
                      ≤{patient.targetIOP} mmHg
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {Math.max(patient.iopOD, patient.iopOS) <= patient.targetIOP ? 'At goal ✓' : 'Above target'}
                    </p>
                  </div>

                  {/* C/D Ratio */}
                  <div className="bg-purple-50 rounded-md p-3 border border-purple-200">
                    <p className="text-xs font-semibold text-purple-900 mb-1">C/D Ratio</p>
                    <p className="text-sm font-mono font-bold text-purple-900">
                      OD: {patient.cdRatioOD}
                    </p>
                    <p className="text-sm font-mono font-bold text-purple-900">
                      OS: {patient.cdRatioOS}
                    </p>
                  </div>

                  {/* Mean Deviation */}
                  <div className="bg-orange-50 rounded-md p-3 border border-orange-200">
                    <p className="text-xs font-semibold text-orange-900 mb-1">MD (dB)</p>
                    <p className="text-sm font-mono font-bold text-orange-900">
                      OD: {patient.mdOD}
                    </p>
                    <p className="text-sm font-mono font-bold text-orange-900">
                      OS: {patient.mdOS}
                    </p>
                  </div>

                  {/* Medications */}
                  <div className="bg-yellow-50 rounded-md p-3 border border-yellow-200">
                    <p className="text-xs font-semibold text-yellow-900 mb-1">Medications</p>
                    <p className="text-2xl font-bold text-yellow-900">{patient.medications}</p>
                    <p className="text-xs text-yellow-700 mt-1">Active drugs</p>
                  </div>
                    </>
                  )}
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

export default function GlaucomaClinicPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:GLAUCOMA:VIEW">
      <GlaucomaClinicPageContent />
    </ProtectedRoute>
  );
}
