'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, X, Send, UserPlus, CheckCircle, CreditCard } from 'lucide-react';
import { getApi } from '@/lib/api';
import { useBranchContext } from '@/hooks/use-branch-context';
import {
  searchPatientsUnified,
  unifiedHitToPatient,
} from '@/lib/patients/unified-patient-search';
import { useMasterValues } from '@/hooks/use-master-values';
import { defaultMasterCode } from '@/lib/master-data/appointment-master';
import { useRouter, usePathname } from 'next/navigation';
import {
  bookingAddPatientReturnPath,
  buildCanonicalAddPatientHref,
} from '@/lib/patients/canonical-add-patient';

interface Patient {
  id: string;
  medicalRecordNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  mobileNumber: string;
  email?: string;
  photoUrl?: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface Doctor {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  specialization?: string;
  departmentId: string;
  consultationFee?: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface UnifiedAppointmentBookingProps {
  onClose: () => void;
  onSuccess?: () => void;
  /** Existing patient.id returned from the canonical Add Patient wizard. */
  resumePatientId?: string | null;
  /** Render the booking panel without the built-in overlay so a Dialog can host it. */
  embedded?: boolean;
}

export default function UnifiedAppointmentBooking({ onClose, onSuccess, resumePatientId, embedded = false }: UnifiedAppointmentBookingProps) {
  const router = useRouter();
  const pathname = usePathname();
  const api = getApi();
  const { branchId } = useBranchContext();

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Booking state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const { options: appointmentTypeOptions } = useMasterValues('appointment.type');
  const { options: consultationTypeOptions } = useMasterValues('appointment.consultation_type');
  const [appointmentType, setAppointmentType] = useState('');
  const [consultationType, setConsultationType] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingAppointment, setBookingAppointment] = useState(false);
  
  // Modal states for success
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState<any>(null);

  // Load all doctors on mount
  useEffect(() => {
    loadAllDoctors();
  }, []);

  useEffect(() => {
    if (!appointmentType && appointmentTypeOptions.length > 0) {
      setAppointmentType(defaultMasterCode(appointmentTypeOptions, 'OPD'));
    }
    if (!consultationType && consultationTypeOptions.length > 0) {
      setConsultationType(defaultMasterCode(consultationTypeOptions, 'FIRST_VISIT'));
    }
  }, [appointmentType, appointmentTypeOptions, consultationType, consultationTypeOptions]);

  useEffect(() => {
    const id = resumePatientId?.trim();
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await getApi().get(`/patients/${id}`);
        const row = response.data;
        if (cancelled || !row?.id) return;
        setSelectedPatient({
          id: row.id,
          medicalRecordNumber: row.medicalRecordNumber ?? '',
          firstName: row.firstName ?? '',
          lastName: row.lastName ?? '',
          dateOfBirth: row.dateOfBirth ?? '',
          gender: row.gender ?? '',
          mobileNumber: row.contactNumber ?? '',
          email: row.email,
          photoUrl: row.photoUrl,
        });
      } catch {
        // Leave patient search empty. Do not create a patient from booking.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumePatientId]);

  // Auto-search after 2 characters
  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        handleSearch();
      }, 500); // Debounce for 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, branchId]);

  const loadAllDoctors = async () => {
    try {
      console.log('Loading doctors...');
      const response = await api.get('/users/with-details');
      console.log('API Response:', response.data);
      
      // Filter for doctors (users with UserType = 'Doctor' or specialization)
      const allUsers = response.data || [];
      console.log('Total users:', allUsers.length);
      
      const doctorsOnly = allUsers.filter((user: any) => {
        const isDoctor = user.userType === 'Doctor' || 
                        user.userType === 'doctor' ||
                        !!user.specialization || 
                        !!user.licenseNumber;
        console.log(`User ${user.firstName} ${user.lastName}: userType=${user.userType}, specialization=${user.specialization}, isDoctor=${isDoctor}`);
        return isDoctor;
      });
      
      console.log('Doctors filtered:', doctorsOnly.length);
      setDoctors(doctorsOnly);
      
      if (doctorsOnly.length === 0) {
        console.warn('No doctors found. Creating sample doctor data for testing...');
        // If no doctors found, use all users as fallback for testing
        setDoctors(allUsers.slice(0, 5));
      }
    } catch (error: any) {
      console.error('Failed to load doctors:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (term.length < 2) return;
    if (!branchId) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const hits = await searchPatientsUnified(branchId, term, 20);
      const allPatients: Patient[] = hits.map((hit) => {
        const mapped = unifiedHitToPatient(hit);
        return {
          id: mapped.id,
          medicalRecordNumber: mapped.medicalRecordNumber,
          firstName: mapped.firstName,
          lastName: mapped.lastName,
          dateOfBirth: mapped.dateOfBirth,
          gender: mapped.gender,
          mobileNumber: mapped.contactNumber || mapped.phone || '',
          email: mapped.email,
          photoUrl: mapped.photoUrl,
        };
      });

      setSearchResults(allPatients);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
  };

  const handleDoctorChange = (doctorId: string) => {
    setSelectedDoctor(doctorId);
    // Auto-fill department from selected doctor
    const doctor = doctors.find(d => d.id === doctorId);
    if (doctor) {
      setSelectedDepartment(doctor.departmentId);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedTime('');
    generateTimeSlots(date);
  };

  const generateTimeSlots = (date: string) => {
    const slots: TimeSlot[] = [];
    const startHour = 9;
    const endHour = 17;
    const interval = 30;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({ time, available: true });
      }
    }

    setTimeSlots(slots);
  };

  const handleBookAppointment = async () => {
    console.log('=== BOOKING APPOINTMENT ===');
    console.log('Selected Patient:', selectedPatient);
    console.log('Selected Doctor:', selectedDoctor);
    console.log('Selected Date:', selectedDate);
    console.log('Selected Time:', selectedTime);
    console.log('Selected Department:', selectedDepartment);
    console.log('Appointment Type:', appointmentType);
    
    if (!selectedPatient) {
      alert('Please select or register a patient');
      return;
    }
    if (!selectedDoctor || !selectedDate || !selectedTime) {
      alert('Please select doctor, date, and time slot');
      return;
    }
    
    // Auto-fill department from doctor if not set
    const doctor = doctors.find(d => d.id === selectedDoctor);
    console.log('Doctor found:', doctor);
    
    const deptId = selectedDepartment || (doctor ? doctor.departmentId : '');
    console.log('Department ID to use:', deptId);

    setBookingAppointment(true);

    try {
      // Determine duration based on appointment type
      let durationMinutes = 30;
      const typeKey = appointmentType.toUpperCase();
      if (typeKey === 'REVIEW' || typeKey === 'FOLLOW_UP') durationMinutes = 20;
      else if (typeKey === 'EMERGENCY' || typeKey === 'TELECONSULT') durationMinutes = 45;
      else if (typeKey === 'SURGERY') durationMinutes = 60;
      
      const appointmentData = {
        patientId: selectedPatient.id,
        doctorId: selectedDoctor,
        departmentId: deptId || undefined, // Send undefined if no department
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        durationMinutes: durationMinutes, // Required field
        appointmentType,
        consultationType: consultationType || undefined,
        notes,
        status: 'Scheduled', // Changed from 'scheduled' to 'Scheduled' (capital S)
      };

      console.log('Appointment Data being sent:', appointmentData);
      const response = await api.post('/appointments', appointmentData);
      console.log('Appointment created successfully:', response.data);
      
      // Store appointment details and show success modal
      setBookedAppointment({
        ...response.data,
        doctorName: `Dr. ${doctor?.firstName} ${doctor?.lastName}`,
        durationMinutes,
        consultationFee: doctor?.consultationFee || 500, // Default if not set
      });
      onSuccess?.();
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Failed to book appointment:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Validation errors:', JSON.stringify(error.response?.data?.errors, null, 2));
      
      // Extract validation errors
      const validationErrors = error.response?.data?.errors;
      let errorMessage = 'Failed to book appointment:\n';
      
      if (validationErrors) {
        Object.keys(validationErrors).forEach(key => {
          const messages = validationErrors[key];
          if (Array.isArray(messages)) {
            errorMessage += `\n${key}: ${messages.join(', ')}`;
          } else {
            errorMessage += `\n${key}: ${messages}`;
          }
        });
      } else {
        errorMessage = error.response?.data?.message || 
                      error.response?.data?.title ||
                      'Failed to book appointment. Please try again.';
      }
      
      alert(errorMessage);
    } finally {
      setBookingAppointment(false);
    }
  };

  return (
    <div className={embedded ? 'flex max-h-[min(80vh,40rem)] flex-col' : 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4'}>
      <div className={embedded ? 'flex min-h-0 flex-1 flex-col overflow-y-auto' : 'max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl'}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Book Appointment</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient Search Section */}
          {!selectedPatient && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Patient
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, MRN, Mobile, Email"
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-4 border border-gray-200 rounded-lg divide-y">
                  {searchResults.map(patient => (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-4"
                    >
                      {patient.photoUrl && (
                        <img src={patient.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {patient.firstName} {patient.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          MRN: {patient.medicalRecordNumber} | Mobile: {patient.mobileNumber}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No Results Found */}
              {searchTerm.trim().length >= 3 && searchResults.length === 0 && !searching && (
                <div className="mt-4 p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <div className="text-yellow-800 font-medium mb-4">
                    No patients found for "{searchTerm}"
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(buildCanonicalAddPatientHref(bookingAddPatientReturnPath(pathname)))}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 mx-auto"
                  >
                    <UserPlus className="w-5 h-5" />
                    Register New Patient
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Selected Patient Display */}
          {selectedPatient && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-4">
              {selectedPatient.photoUrl && (
                <img src={selectedPatient.photoUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
              )}
              <div className="flex-1">
                <div className="font-semibold text-gray-900">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </div>
                <div className="text-sm text-gray-600">
                  MRN: {selectedPatient.medicalRecordNumber} | Mobile: {selectedPatient.mobileNumber}
                </div>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Change Patient
              </button>
            </div>
          )}

          {/* Appointment Booking Section */}
          {selectedPatient && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Appointment Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Doctor *</label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => handleDoctorChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Doctor</option>
                    {doctors.map(doctor => (
                      <option key={doctor.id} value={doctor.id}>
                        Dr. {doctor.firstName} {doctor.lastName}
                        {doctor.specialization && ` (${doctor.specialization})`}
                        {doctor.consultationFee && ` - â‚¹${doctor.consultationFee}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Appointment Type</label>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{appointmentTypeOptions.length === 0 ? 'No types configured' : 'Select type'}</option>
                    {appointmentTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Consultation Type</label>
                <select
                  value={consultationType}
                  onChange={(e) => setConsultationType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{consultationTypeOptions.length === 0 ? 'No types configured' : 'Select consultation type'}</option>
                  {consultationTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Appointment Date *</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Time Slot *</label>
                  <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                    {timeSlots.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedTime(slot.time)}
                        disabled={!slot.available}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedTime === slot.time
                            ? 'bg-blue-600 text-white'
                            : slot.available
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional notes or symptoms..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedPatient && (
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleBookAppointment}
              disabled={bookingAppointment || !selectedDoctor || !selectedDate || !selectedTime}
              className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {bookingAppointment ? 'Booking...' : 'Book Appointment & Proceed to Billing'}
            </button>
          </div>
        )}
      </div>

      {/* Success Modal - Appointment Booked */}
      {showSuccessModal && bookedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked Successfully!</h3>
              <div className="mt-4 space-y-2 text-left bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Date:</span>
                  <span className="text-sm font-medium text-gray-900">{bookedAppointment.appointmentDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Time:</span>
                  <span className="text-sm font-medium text-gray-900">{bookedAppointment.appointmentTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Doctor:</span>
                  <span className="text-sm font-medium text-gray-900">{bookedAppointment.doctorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Duration:</span>
                  <span className="text-sm font-medium text-gray-900">{bookedAppointment.durationMinutes} minutes</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                  <span className="text-sm font-semibold text-gray-900">Consultation Fee:</span>
                  <span className="text-lg font-bold text-blue-600">â‚¹{bookedAppointment.consultationFee}</span>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    onClose();
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    // Redirect to OPD billing page
                    router.push(`/dashboard/billing/opd/create?patientId=${selectedPatient?.id}&patientName=${encodeURIComponent(selectedPatient?.firstName + ' ' + selectedPatient?.lastName)}&appointmentId=${bookedAppointment.id}`);
                    onClose();
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-5 w-5" />
                  Proceed to Bill Payment & Check-in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
