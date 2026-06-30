'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  TrendingUp,
  Activity,
  AlertTriangle,
  Search,
  FileText,
  Users,
  AlertCircle,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useSpecialtyClinicPatients } from '@/hooks/use-specialty-clinic-patients';
import { mapLookupToSpecialtyQueueRow } from '@/lib/specialty-clinics/lookup-queue-mappers';
import { toast } from 'react-hot-toast';

interface CorneaPatient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  visitReason: string;
  priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  topographyStatus: 'Done' | 'Pending' | 'Scheduled';
  keratoconusStage: string | null;
  cornealCondition: string;
  lastVisit: string;
  nextAction: string;
  OD: {
    keratometry: { K1: number; K2: number };
    pachymetry: number;
    status: string;
  };
  OS: {
    keratometry: { K1: number; K2: number };
    pachymetry: number;
    status: string;
  };
}

function CorneaClinicPageContent() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const lookupQuery = useSpecialtyClinicPatients('CORNEA');

  const patients: CorneaPatient[] = useMemo(() => {
    if (lookupQuery.isError) {
      toast.error('Failed to load cornea queue');
      return [];
    }
    return (lookupQuery.data?.items ?? []).map((row) => {
      const base = mapLookupToSpecialtyQueueRow(row);
      const priority =
        base.priority === 'Urgent'
          ? ('URGENT' as const)
          : ('ROUTINE' as const);
      return {
        id: base.id,
        name: base.name,
        mrn: base.mrn,
        age: base.age ?? 0,
        gender: base.gender?.[0]?.toUpperCase() ?? '—',
        visitReason: base.reasonForVisit || 'Cornea clinic visit',
        priority,
        topographyStatus: 'Pending' as const,
        keratoconusStage: null,
        cornealCondition: 'See patient chart',
        lastVisit: base.lastVisitAt?.slice(0, 10) ?? '—',
        nextAction: 'Open chart',
        OD: {
          keratometry: { K1: 0, K2: 0 },
          pachymetry: 0,
          status: '—',
        },
        OS: {
          keratometry: { K1: 0, K2: 0 },
          pachymetry: 0,
          status: '—',
        },
      };
    });
  }, [lookupQuery.data?.items, lookupQuery.isError]);

  const loading = lookupQuery.isLoading;

  const filteredPatients = patients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.mrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalPatients: patients.length,
    keratoconusCases: patients.filter((p) => p.keratoconusStage).length,
    topographyPending: patients.filter((p) => p.topographyStatus === 'Pending').length,
    urgentCases: patients.filter((p) => p.priority === 'URGENT' || p.priority === 'EMERGENCY')
      .length,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'URGENT':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getTopographyStatusColor = (status: string) => {
    switch (status) {
      case 'Done':
        return 'text-green-600';
      case 'Pending':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cornea Clinic</h1>
        <p className="text-gray-600 mt-2">
          Corneal topography, keratoconus management, and keratoplasty planning
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Patients</p>
              <p className="text-4xl font-bold mt-2">{stats.totalPatients}</p>
            </div>
            <Users className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Keratoconus Cases</p>
              <p className="text-4xl font-bold mt-2">{stats.keratoconusCases}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Topography Pending</p>
              <p className="text-4xl font-bold mt-2">{stats.topographyPending}</p>
            </div>
            <Layers className="w-12 h-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Urgent Cases</p>
              <p className="text-4xl font-bold mt-2">{stats.urgentCases}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md flex items-center justify-center space-x-2">
          <Layers className="w-5 h-5" />
          <span>Topography Queue</span>
        </button>
        <button className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all shadow-md flex items-center justify-center space-x-2">
          <TrendingUp className="w-5 h-5" />
          <span>Keratoconus Tracker</span>
        </button>
        <button className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-md flex items-center justify-center space-x-2">
          <Activity className="w-5 h-5" />
          <span>CXL Schedule</span>
        </button>
        <button className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md flex items-center justify-center space-x-2">
          <FileText className="w-5 h-5" />
          <span>PKP Planning</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by patient name or MRN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Patient Queue */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Patient Queue</h2>
        {filteredPatients.map((patient) => (
          <div
            key={patient.id}
            onClick={() => router.push(`/dashboard/specialty-clinics/cornea/${patient.id}`)}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-300"
          >
            {/* Patient Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-bold text-gray-900">{patient.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(
                      patient.priority
                    )}`}
                  >
                    {patient.priority}
                  </span>
                </div>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <span>
                    <strong>MRN:</strong> {patient.mrn}
                  </span>
                  <span>
                    <strong>Age:</strong> {patient.age}
                  </span>
                  <span>
                    <strong>Gender:</strong> {patient.gender}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-2">
                  <strong>Visit Reason:</strong> {patient.visitReason}
                </p>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>

            {/* Corneal Condition Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Corneal Condition</p>
                  <p className="font-bold text-gray-900">{patient.cornealCondition}</p>
                </div>
                {patient.keratoconusStage && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Keratoconus Stage</p>
                    <p className="font-bold text-orange-700">{patient.keratoconusStage}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 mb-1">Topography Status</p>
                  <p className={`font-bold ${getTopographyStatusColor(patient.topographyStatus)}`}>
                    {patient.topographyStatus}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Next Action</p>
                  <p className="font-bold text-purple-700">{patient.nextAction}</p>
                </div>
              </div>
            </div>

            {/* Clinical Summary - Both Eyes */}
            <div className="grid grid-cols-2 gap-4">
              {/* OD (Right Eye) */}
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-blue-900">OD (Right Eye)</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Keratometry:</span>
                    <span className="font-semibold text-gray-900">
                      {patient.OD.keratometry.K1.toFixed(2)} / {patient.OD.keratometry.K2.toFixed(2)} D
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pachymetry:</span>
                    <span
                      className={`font-semibold ${
                        patient.OD.pachymetry < 500 ? 'text-orange-700' : 'text-green-700'
                      }`}
                    >
                      {patient.OD.pachymetry} μm
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-blue-300">
                    <p className="text-gray-700 font-medium">{patient.OD.status}</p>
                  </div>
                </div>
              </div>

              {/* OS (Left Eye) */}
              <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-green-900">OS (Left Eye)</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Keratometry:</span>
                    <span className="font-semibold text-gray-900">
                      {patient.OS.keratometry.K1.toFixed(2)} / {patient.OS.keratometry.K2.toFixed(2)} D
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pachymetry:</span>
                    <span
                      className={`font-semibold ${
                        patient.OS.pachymetry < 500 ? 'text-orange-700' : 'text-green-700'
                      }`}
                    >
                      {patient.OS.pachymetry} μm
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-green-300">
                    <p className="text-gray-700 font-medium">{patient.OS.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-sm text-gray-600">
              <span>
                <strong>Last Visit:</strong> {patient.lastVisit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredPatients.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No patients found matching your search</p>
        </div>
      )}
    </div>
  );
}

export default function CorneaClinicPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:CORNEA:VIEW">
      <CorneaClinicPageContent />
    </ProtectedRoute>
  );
}
