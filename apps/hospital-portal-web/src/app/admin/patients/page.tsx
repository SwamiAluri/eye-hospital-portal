'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildCanonicalAddPatientHref } from '@/lib/patients/canonical-add-patient';

// ============================================================================
// Types
// ============================================================================

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  status: string;
  lastVisit: string;
  nextAppointment?: string;
  primaryPhysician: string;
  insuranceProvider?: string;
  hasAllergies: boolean;
  hasMedicalAlerts: boolean;
  isVip: boolean;
}

interface PatientAllergy {
  id: string;
  allergen: string;
  severity: string;
  reaction: string;
}

interface PatientAlert {
  id: string;
  type: string;
  title: string;
  severity: string;
}

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    deceased: 'bg-black text-white',
    transferred: 'bg-blue-100 text-blue-700',
    archived: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.active}`}>
      {status}
    </span>
  );
}

function GenderBadge({ gender }: { gender: string }) {
  const colors: Record<string, string> = {
    male: 'bg-blue-100 text-blue-700',
    female: 'bg-pink-100 text-pink-700',
    other: 'bg-purple-100 text-purple-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[gender] || 'bg-gray-100 text-gray-700'}`}>
      {gender}
    </span>
  );
}

function MetricCard({ label, value, icon, color, trend }: { 
  label: string; 
  value: string | number; 
  icon: string; 
  color: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <span className="text-lg">{icon}</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-blue-100 flex items-center justify-center font-medium text-blue-600`}>
      {initials}
    </div>
  );
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    mild: 'bg-green-100 text-green-700',
    moderate: 'bg-yellow-100 text-yellow-700',
    severe: 'bg-orange-100 text-orange-700',
    life_threatening: 'bg-red-100 text-red-700',
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[severity] || 'bg-gray-100 text-gray-700'}`}>
      {severity.replace(/_/g, ' ')}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function PatientsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'list' | 'demographics'>('list');
  const [showPatientDetailModal, setShowPatientDetailModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Mock data
  const patients: Patient[] = [
    {
      id: '1',
      mrn: 'MRN-2026-001',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1985-03-15',
      gender: 'male',
      phone: '(555) 123-4567',
      email: 'john.smith@email.com',
      status: 'active',
      lastVisit: '2026-01-20',
      nextAppointment: '2026-02-05',
      primaryPhysician: 'Dr. Sarah Wilson',
      insuranceProvider: 'Blue Cross Blue Shield',
      hasAllergies: true,
      hasMedicalAlerts: false,
      isVip: false,
    },
    {
      id: '2',
      mrn: 'MRN-2026-015',
      firstName: 'Emily',
      lastName: 'Johnson',
      dateOfBirth: '1992-07-22',
      gender: 'female',
      phone: '(555) 234-5678',
      email: 'emily.johnson@email.com',
      status: 'active',
      lastVisit: '2026-01-18',
      primaryPhysician: 'Dr. Michael Chen',
      insuranceProvider: 'Aetna',
      hasAllergies: false,
      hasMedicalAlerts: true,
      isVip: true,
    },
    {
      id: '3',
      mrn: 'MRN-2026-022',
      firstName: 'Michael',
      lastName: 'Davis',
      dateOfBirth: '1978-11-08',
      gender: 'male',
      phone: '(555) 345-6789',
      email: 'michael.davis@email.com',
      status: 'active',
      lastVisit: '2026-01-15',
      nextAppointment: '2026-01-28',
      primaryPhysician: 'Dr. Lisa Anderson',
      insuranceProvider: 'United Healthcare',
      hasAllergies: true,
      hasMedicalAlerts: true,
      isVip: false,
    },
    {
      id: '4',
      mrn: 'MRN-2025-089',
      firstName: 'Sarah',
      lastName: 'Williams',
      dateOfBirth: '1965-05-30',
      gender: 'female',
      phone: '(555) 456-7890',
      email: 'sarah.williams@email.com',
      status: 'inactive',
      lastVisit: '2025-08-10',
      primaryPhysician: 'Dr. Sarah Wilson',
      hasAllergies: false,
      hasMedicalAlerts: false,
      isVip: false,
    },
    {
      id: '5',
      mrn: 'MRN-2026-031',
      firstName: 'Robert',
      lastName: 'Brown',
      dateOfBirth: '2015-09-12',
      gender: 'male',
      phone: '(555) 567-8901',
      email: 'parent.brown@email.com',
      status: 'active',
      lastVisit: '2026-01-22',
      nextAppointment: '2026-02-10',
      primaryPhysician: 'Dr. Jennifer Martinez',
      insuranceProvider: 'Cigna',
      hasAllergies: true,
      hasMedicalAlerts: false,
      isVip: false,
    },
  ];

  const mockAllergies: PatientAllergy[] = [
    { id: '1', allergen: 'Penicillin', severity: 'severe', reaction: 'Anaphylaxis' },
    { id: '2', allergen: 'Peanuts', severity: 'moderate', reaction: 'Hives, swelling' },
  ];

  const mockAlerts: PatientAlert[] = [
    { id: '1', type: 'fall_risk', title: 'Fall Risk', severity: 'high' },
    { id: '2', type: 'isolation', title: 'Contact Precautions', severity: 'medium' },
  ];

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = searchQuery === '' || 
      patient.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === '' || patient.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPatientDetailModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
          <p className="text-gray-500 mt-1">Manage patient records, demographics, and medical information</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <span>📥</span>
            Import
          </button>
          <button
            onClick={() => router.push(buildCanonicalAddPatientHref('/admin/patients'))}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>➕</span>
            New Patient
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'list', label: 'Patient List', icon: '👥' },
            { id: 'demographics', label: 'Demographics', icon: '📊' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Patient List Tab */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
              label="Total Patients" 
              value={1247} 
              icon="👥" 
              color="bg-blue-100"
            />
            <MetricCard 
              label="Active Patients" 
              value={1089} 
              icon="✅" 
              color="bg-green-100"
              trend={{ value: '3.2%', positive: true }}
            />
            <MetricCard 
              label="New This Month" 
              value={45} 
              icon="🆕" 
              color="bg-purple-100"
              trend={{ value: '12%', positive: true }}
            />
            <MetricCard 
              label="Appointments Today" 
              value={28} 
              icon="📅" 
              color="bg-yellow-100"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, MRN, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="transferred">Transferred</option>
              <option value="archived">Archived</option>
            </select>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              🔍 Advanced Search
            </button>
          </div>

          {/* Patient Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age/Gender</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Primary Physician</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Visit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alerts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${patient.firstName} ${patient.lastName}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </p>
                            {patient.isVip && (
                              <span className="text-yellow-500" title="VIP Patient">⭐</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{patient.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-mono text-blue-600">{patient.mrn}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{calculateAge(patient.dateOfBirth)} yrs</p>
                      <GenderBadge gender={patient.gender} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{patient.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{patient.primaryPhysician}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{patient.lastVisit}</p>
                      {patient.nextAppointment && (
                        <p className="text-xs text-green-600">Next: {patient.nextAppointment}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={patient.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {patient.hasAllergies && (
                          <span className="text-red-500" title="Has Allergies">⚠️</span>
                        )}
                        {patient.hasMedicalAlerts && (
                          <span className="text-orange-500" title="Medical Alerts">🔔</span>
                        )}
                        {!patient.hasAllergies && !patient.hasMedicalAlerts && (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleViewPatient(patient)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View
                        </button>
                        <button className="text-gray-600 hover:text-gray-800 text-sm">Edit</button>
                        <button className="text-green-600 hover:text-green-800 text-sm">Appt</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {filteredPatients.length} of {patients.length} patients
              </p>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
                  Previous
                </button>
                <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm">1</button>
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">2</button>
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">3</button>
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demographics Tab */}
      {activeTab === 'demographics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gender Distribution */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h3>
            <div className="space-y-4">
              {[
                { label: 'Male', count: 612, percentage: 49.1, color: 'bg-blue-500' },
                { label: 'Female', count: 623, percentage: 49.9, color: 'bg-pink-500' },
                { label: 'Other', count: 12, percentage: 1.0, color: 'bg-purple-500' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium text-gray-900">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${item.color}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Age Distribution */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Age Distribution</h3>
            <div className="space-y-4">
              {[
                { label: '0-17', count: 187, percentage: 15 },
                { label: '18-34', count: 312, percentage: 25 },
                { label: '35-49', count: 287, percentage: 23 },
                { label: '50-64', count: 262, percentage: 21 },
                { label: '65+', count: 199, percentage: 16 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label} years</span>
                    <span className="font-medium text-gray-900">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insurance Coverage */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Insurance Coverage</h3>
            <div className="space-y-3">
              {[
                { provider: 'Blue Cross Blue Shield', count: 345, color: 'bg-blue-100 text-blue-700' },
                { provider: 'Aetna', count: 234, color: 'bg-purple-100 text-purple-700' },
                { provider: 'United Healthcare', count: 198, color: 'bg-green-100 text-green-700' },
                { provider: 'Cigna', count: 156, color: 'bg-orange-100 text-orange-700' },
                { provider: 'Medicare', count: 145, color: 'bg-red-100 text-red-700' },
                { provider: 'Self-Pay', count: 89, color: 'bg-gray-100 text-gray-700' },
                { provider: 'Other', count: 80, color: 'bg-yellow-100 text-yellow-700' },
              ].map((item) => (
                <div key={item.provider} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <span className={`px-2 py-1 rounded text-sm ${item.color}`}>{item.provider}</span>
                  <span className="text-sm font-medium text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Patient Growth */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Patient Growth</h3>
            <div className="space-y-3">
              {[
                { month: 'January 2026', new: 45, total: 1247 },
                { month: 'December 2025', new: 38, total: 1202 },
                { month: 'November 2025', new: 42, total: 1164 },
                { month: 'October 2025', new: 35, total: 1122 },
                { month: 'September 2025', new: 41, total: 1087 },
              ].map((item) => (
                <div key={item.month} className="flex items-center justify-between p-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{item.month}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-green-600">+{item.new} new</span>
                    <span className="text-sm font-medium text-gray-900">{item.total} total</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* Patient Detail Modal */}
      {showPatientDetailModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Avatar name={`${selectedPatient.firstName} ${selectedPatient.lastName}`} size="lg" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </h2>
                      {selectedPatient.isVip && <span className="text-yellow-500">⭐</span>}
                      <StatusBadge status={selectedPatient.status} />
                    </div>
                    <p className="text-sm text-gray-500">MRN: {selectedPatient.mrn}</p>
                    <p className="text-sm text-gray-500">
                      {calculateAge(selectedPatient.dateOfBirth)} years old • {selectedPatient.gender} • DOB: {selectedPatient.dateOfBirth}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPatientDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Alerts Section */}
              {(selectedPatient.hasAllergies || selectedPatient.hasMedicalAlerts) && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-red-800 mb-2">⚠️ Medical Alerts</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedPatient.hasAllergies && (
                      <div>
                        <p className="text-xs text-red-600 font-medium mb-1">Allergies:</p>
                        <div className="space-y-1">
                          {mockAllergies.map((allergy) => (
                            <div key={allergy.id} className="flex items-center gap-2 text-sm">
                              <SeverityBadge severity={allergy.severity} />
                              <span className="text-gray-900">{allergy.allergen}</span>
                              <span className="text-gray-500">- {allergy.reaction}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedPatient.hasMedicalAlerts && (
                      <div>
                        <p className="text-xs text-red-600 font-medium mb-1">Alerts:</p>
                        <div className="space-y-1">
                          {mockAlerts.map((alert) => (
                            <div key={alert.id} className="flex items-center gap-2 text-sm">
                              <SeverityBadge severity={alert.severity} />
                              <span className="text-gray-900">{alert.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                {/* Contact Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">📞 Contact Info</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">Phone:</span> {selectedPatient.phone}</p>
                    <p><span className="text-gray-500">Email:</span> {selectedPatient.email}</p>
                  </div>
                </div>

                {/* Medical Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">🏥 Medical Info</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">Primary Physician:</span> {selectedPatient.primaryPhysician}</p>
                    <p><span className="text-gray-500">Last Visit:</span> {selectedPatient.lastVisit}</p>
                    {selectedPatient.nextAppointment && (
                      <p><span className="text-gray-500">Next Appt:</span> {selectedPatient.nextAppointment}</p>
                    )}
                  </div>
                </div>

                {/* Insurance */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">🛡️ Insurance</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">Provider:</span> {selectedPatient.insuranceProvider || 'Self-Pay'}</p>
                    <button className="text-blue-600 hover:text-blue-800 text-xs">Verify Eligibility →</button>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-3">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  📅 Schedule Appointment
                </button>
                <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  📋 View Medical Records
                </button>
                <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  💰 View Billing
                </button>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  ✏️ Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
