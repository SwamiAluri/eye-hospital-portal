'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Calendar, Zap, Search, ArrowRight } from 'lucide-react';
import { getApi } from '@/lib/api';
import PatientFormModal from '@/components/patients/PatientFormModal';
import { useBranchContext } from '@/hooks/use-branch-context';
import { searchPatientsUnified } from '@/lib/patients/unified-patient-search';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  medicalRecordNumber: string;
  contactNumber: string;
  photoUrl?: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
}

interface Department {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialization?: string;
}

export default function WalkInRegistration() {
  const router = useRouter();
  const { branchId } = useBranchContext();
  
  // Patient Type Selection
  const [patientType, setPatientType] = useState<'existing' | 'new' | null>(null);
  
  // Existing Patient Flow
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searching, setSearching] = useState(false);
  
  // New Patient Flow
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [newPatientId, setNewPatientId] = useState<string | null>(null);
  
  // Booking Flow
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [booking, setBooking] = useState(false);

  // Search existing patient - Search across all fields internally
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      alert('Please enter search term');
      return;
    }
    if (!branchId) {
      alert('Select a branch before searching for patients.');
      return;
    }

    setSearching(true);
    setSearchResults([]);
    try {
      const hits = await searchPatientsUnified(branchId, searchTerm.trim(), 25);
      const allPatients: Patient[] = hits.map((hit) => ({
        id: hit.id,
        firstName: hit.firstName,
        lastName: hit.lastName,
        medicalRecordNumber: hit.mrn,
        contactNumber: hit.phone ?? '',
        dateOfBirth: hit.dateOfBirth ?? '',
        gender: hit.gender ?? '',
      }));

      if (allPatients.length > 0) {
        setSearchResults(allPatients);
        if (allPatients.length === 1) {
          setSelectedPatient(allPatients[0]);
          await loadDepartments();
        }
      } else {
        alert('No patient found. Please try different search criteria or register as new patient.');
        setSearchResults([]);
      }
    } catch (error: unknown) {
      console.error('Failed to search patient:', error);
      alert('Failed to search patient. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // Select patient from search results
  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    await loadDepartments();
  };

  // Load departments for booking
  const loadDepartments = async () => {
    setLoadingDepartments(true);
    try {
      const api = getApi();
      const response = await api.get('/departments');
      
      if (response.data) {
        setDepartments(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load departments:', error);
      alert('Failed to load departments');
    } finally {
      setLoadingDepartments(false);
    }
  };

  // Load doctors when department selected
  const handleDepartmentChange = async (departmentId: string) => {
    setSelectedDepartment(departmentId);
    setSelectedDoctor('');
    setDoctors([]);

    if (!departmentId) return;

    setLoadingDoctors(true);
    try {
      const api = getApi();
      const response = await api.get(`/users`, {
        params: {
          departmentId,
          userType: 'Doctor',
          status: 'Active',
        },
      });

      if (response.data) {
        setDoctors(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load doctors:', error);
      alert('Failed to load doctors');
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Quick Book - Auto-assign next available slot
  const handleQuickBook = async () => {
    const patientId = selectedPatient?.id || newPatientId;
    
    if (!patientId) {
      alert('No patient selected');
      return;
    }

    if (!selectedDepartment || !selectedDoctor) {
      alert('Please select department and doctor');
      return;
    }

    setBooking(true);
    try {
      const api = getApi();
      
      // Get next available slot
      const today = new Date().toISOString().split('T')[0];
      let nextSlot;
      
      try {
        const slotResponse = await api.get('/appointments/next-available-slot', {
          params: {
            doctorId: selectedDoctor,
            departmentId: selectedDepartment,
            date: today,
          },
        });
        nextSlot = slotResponse.data;
      } catch (error) {
        console.warn('Next available slot API not available, using default time');
        // Fallback to default time
        const now = new Date();
        const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
        now.setMinutes(roundedMinutes, 0, 0);
        
        nextSlot = {
          date: today,
          time: now.toTimeString().substring(0, 5), // HH:MM format
          doctorId: selectedDoctor,
        };
      }

      // Create appointment
      const appointmentResponse = await api.post('/appointments', {
        patientId,
        doctorId: selectedDoctor,
        departmentId: selectedDepartment,
        appointmentDate: nextSlot.date,
        startTime: nextSlot.time,
        appointmentType: 'walk-in',
        priority: 'normal',
        status: 'scheduled',
      });

      console.log('✅ Appointment created:', appointmentResponse.data);

      // Redirect to billing for payment
      const appointmentId = appointmentResponse.data.id;
      alert(`Appointment booked successfully!\nDate: ${nextSlot.date}\nTime: ${nextSlot.time}\n\nRedirecting to billing for payment...`);
      
      // Redirect to billing (you can customize this route)
      router.push(`/dashboard/billing/payment?appointmentId=${appointmentId}`);
    } catch (error: any) {
      console.error('❌ Quick booking failed:', error);
      alert('Failed to book appointment: ' + (error.response?.data?.message || error.message));
    } finally {
      setBooking(false);
    }
  };

  // Manual Booking - Choose time slot
  const handleManualBook = () => {
    const patientId = selectedPatient?.id || newPatientId;
    
    if (!patientId) {
      alert('No patient selected');
      return;
    }

    if (!selectedDepartment || !selectedDoctor) {
      alert('Please select department and doctor');
      return;
    }

    // Redirect to appointments page with pre-filled data
    router.push(`/dashboard/appointments?patientId=${patientId}&doctorId=${selectedDoctor}&departmentId=${selectedDepartment}&type=walk-in`);
  };

  // Handle new patient created
  const handlePatientCreated = async (patient: any) => {
    console.log('✅ New patient created:', patient);
    setNewPatientId(patient.id);
    setSelectedPatient({
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      medicalRecordNumber: patient.medicalRecordNumber,
      contactNumber: patient.contactNumber,
      photoUrl: patient.photoUrl,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      bloodGroup: patient.bloodGroup,
    });
    setShowPatientModal(false);
    await loadDepartments();
  };

  // Reset form
  const resetForm = () => {
    setPatientType(null);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedPatient(null);
    setNewPatientId(null);
    setDepartments([]);
    setDoctors([]);
    setSelectedDepartment('');
    setSelectedDoctor('');
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-[calc(100vh-180px)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Walk-In Registration</h1>
            <p className="text-sm text-slate-600">Quick registration and appointment booking for walk-in patients</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto flex-1">

        {/* Patient Type Selection */}
        {!patientType && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Select Patient Type</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPatientType('existing')}
                className="p-6 border border-slate-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
              >
                <Users className="w-12 h-12 text-slate-400 group-hover:text-emerald-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Existing Patient</h3>
                <p className="text-sm text-slate-600">Patient already registered in the system</p>
              </button>

              <button
                onClick={() => {
                  setPatientType('new');
                  setShowPatientModal(true);
                }}
                className="p-6 border border-slate-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
              >
                <UserPlus className="w-12 h-12 text-slate-400 group-hover:text-emerald-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 mb-1">New Patient</h3>
                <p className="text-sm text-slate-600">First time visiting our hospital</p>
              </button>
            </div>
          </div>
        )}

        {/* Existing Patient Search */}
        {patientType === 'existing' && !selectedPatient && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Search Existing Patient</h2>
              <button
                onClick={resetForm}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                ← Back
              </button>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name, MRN, mobile, or email..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-6 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 flex items-center gap-2 font-medium"
              >
                <Search className="w-4 h-4" />
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="font-medium text-slate-900">Search Results ({searchResults.length})</h3>
                {searchResults.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="p-3 border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-500 cursor-pointer flex items-center gap-3"
                  >
                    {patient.photoUrl ? (
                      <img
                        src={patient.photoUrl}
                        alt={`${patient.firstName} ${patient.lastName}`}
                        className="w-12 h-12 rounded-lg object-cover border-2 border-slate-300"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-300 flex items-center justify-center text-slate-600 text-xl">
                        👤
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-slate-600">MRN: {patient.medicalRecordNumber}</p>
                      <p className="text-sm text-slate-600">Mobile: {patient.contactNumber}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Patient & Booking Options */}
        {selectedPatient && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Patient Selected</h2>
              <button
                onClick={resetForm}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                ← Start Over
              </button>
            </div>

            {/* Patient Card */}
            <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
              <div className="flex items-start gap-4">
                {selectedPatient.photoUrl ? (
                  <img
                    src={selectedPatient.photoUrl}
                    alt={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                    className="w-20 h-20 rounded-lg object-cover border-2 border-emerald-300"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-emerald-200 flex items-center justify-center text-emerald-600 text-3xl">
                    👤
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-600">MRN:</span>{' '}
                      <span className="font-semibold">{selectedPatient.medicalRecordNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Mobile:</span>{' '}
                      <span className="font-semibold">{selectedPatient.contactNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Gender:</span>{' '}
                      <span className="font-semibold">{selectedPatient.gender}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Blood Group:</span>{' '}
                      <span className="font-semibold">{selectedPatient.bloodGroup || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Department & Doctor Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Select Department & Doctor</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    disabled={loadingDepartments}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">
                      {loadingDepartments ? 'Loading...' : 'Select Department'}
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Doctor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    disabled={!selectedDepartment || loadingDoctors}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">
                      {loadingDoctors ? 'Loading...' : 'Select Doctor'}
                    </option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        Dr. {doctor.firstName} {doctor.lastName}
                        {doctor.specialization && ` - ${doctor.specialization}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Booking Mode Selection */}
            {selectedDepartment && selectedDoctor && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Choose Booking Mode</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleQuickBook}
                    disabled={booking}
                    className="p-4 border-2 border-emerald-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Zap className="w-10 h-10 text-emerald-500 group-hover:text-emerald-600 mx-auto mb-2" />
                    <h4 className="text-base font-bold text-slate-900 mb-1">⚡ Quick Book</h4>
                    <p className="text-sm text-slate-600 mb-2">
                      Auto-assign next available time slot
                    </p>
                    <p className="text-xs text-emerald-700 font-medium">
                      Fastest option for urgent cases
                    </p>
                  </button>

                  <button
                    onClick={handleManualBook}
                    disabled={booking}
                    className="p-4 border-2 border-slate-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-10 h-10 text-slate-500 group-hover:text-emerald-600 mx-auto mb-2" />
                    <h4 className="text-base font-bold text-slate-900 mb-1">📅 Choose Time</h4>
                    <p className="text-sm text-slate-600 mb-2">
                      Select preferred date and time slot
                    </p>
                    <p className="text-xs text-slate-700 font-medium">
                      Best for non-urgent appointments
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Patient Modal */}
      {showPatientModal && (
        <PatientFormModal
          isOpen={showPatientModal}
          onClose={() => {
            setShowPatientModal(false);
            if (!newPatientId) {
              resetForm(); // Reset if patient creation was cancelled
            }
          }}
          onSave={handlePatientCreated}
        />
      )}
    </div>
  );
}
