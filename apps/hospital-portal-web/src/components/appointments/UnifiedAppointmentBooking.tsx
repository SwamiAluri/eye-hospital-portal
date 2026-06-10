'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, X, Upload, Camera, Send, UserPlus, CheckCircle, CreditCard } from 'lucide-react';
import { getApi } from '@/lib/api';
import { useMasterValues } from '@/hooks/use-master-values';
import { defaultMasterCode } from '@/lib/master-data/appointment-master';
import { useRouter } from 'next/navigation';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

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
  guardianName?: string;
  guardianMobile?: string;
  guardianRelationship?: string;
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

interface QuickRegistrationForm {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  guardianName: string;
  guardianMobile: string;
  guardianRelationship: string;
  photoUrl?: string;
}

interface UnifiedAppointmentBookingProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UnifiedAppointmentBooking({ onClose, onSuccess }: UnifiedAppointmentBookingProps) {
  const router = useRouter();
  const api = getApi();

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Quick registration state
  const [showQuickReg, setShowQuickReg] = useState(false);
  const [quickRegForm, setQuickRegForm] = useState<QuickRegistrationForm>({
    firstName: '',
    lastName: '',
    mobileNumber: '',
    dateOfBirth: '',
    age: '',
    gender: '',
    guardianName: '',
    guardianMobile: '',
    guardianRelationship: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);

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

  // Auto-calculate age from DOB
  useEffect(() => {
    if (quickRegForm.dateOfBirth.length === 10) {
      const age = calculateAge(quickRegForm.dateOfBirth);
      setQuickRegForm(prev => ({ ...prev, age: age.toString() }));
    }
  }, [quickRegForm.dateOfBirth]);

  // Auto-search after 3 characters
  useEffect(() => {
    if (searchTerm.trim().length >= 3) {
      const timeoutId = setTimeout(() => {
        handleSearch();
      }, 500); // Debounce for 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm]);

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
    if (term.length < 3) return;

    setSearching(true);
    setSearchResults([]);
    setShowQuickReg(false);

    try {
      // Search across all fields in parallel
      const searchPromises = [
        api.get('/patients/search', { params: { searchTerm: term, searchType: 'name' } }).catch(() => ({ data: [] })),
        api.get('/patients/search', { params: { searchTerm: term, searchType: 'mrn' } }).catch(() => ({ data: [] })),
        api.get('/patients/search', { params: { searchTerm: term, searchType: 'mobile' } }).catch(() => ({ data: [] })),
        api.get('/patients/search', { params: { searchTerm: term, searchType: 'email' } }).catch(() => ({ data: [] })),
      ];

      const results = await Promise.all(searchPromises);

      // Deduplicate results by patient ID
      const allPatients: Patient[] = [];
      const seenIds = new Set<string>();
      results.forEach(response => {
        if (response.data && Array.isArray(response.data)) {
          response.data.forEach((patient: Patient) => {
            if (!seenIds.has(patient.id)) {
              seenIds.add(patient.id);
              allPatients.push(patient);
            }
          });
        }
      });

      setSearchResults(allPatients);

      if (allPatients.length === 0) {
        // Pre-fill first name if search term looks like a name (alphabetic)
        if (/^[a-zA-Z]+$/.test(term)) {
          setQuickRegForm(prev => ({ 
            ...prev, 
            firstName: term.charAt(0).toUpperCase() + term.slice(1).toLowerCase() 
          }));
        }
        // Pre-fill mobile if search term looks like phone number
        else if (/^\d{10}$/.test(term)) {
          setQuickRegForm(prev => ({ ...prev, mobileNumber: term }));
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      setShowQuickReg(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setShowQuickReg(false);
  };

  const formatDOB = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as DD/MM/YYYY
    let formatted = digits;
    if (digits.length >= 2) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    }
    if (digits.length >= 4) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    }
    
    return formatted;
  };

  const handleDOBChange = (value: string) => {
    const formatted = formatDOB(value);
    setQuickRegForm(prev => ({ ...prev, dateOfBirth: formatted }));
  };

  const calculateAge = (dob: string): number => {
    const [day, month, year] = dob.split('/').map(Number);
    if (!day || !month || !year || year < 1900 || year > new Date().getFullYear()) return 0;
    
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const needsGuardian = (): boolean => {
    const age = parseInt(quickRegForm.age);
    return age < 18 || age > 60;
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setQuickRegForm(prev => ({ ...prev, photoUrl: reader.result as string }));
        setShowPhotoOptions(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWebcamCapture = () => {
    // TODO: Implement webcam capture modal
    alert('Webcam capture will be implemented');
    setShowPhotoOptions(false);
  };

  const handleSendToPatient = () => {
    // Phase 1: Manual process
    alert('Photo link sent to patient mobile number. Patient can upload photo which will appear here after refresh.');
    setShowPhotoOptions(false);
  };

  const handleSaveQuickRegistration = async () => {
    // Validation
    if (!quickRegForm.firstName.trim() || !quickRegForm.lastName.trim()) {
      alert('Please enter patient name');
      return;
    }
    if (!quickRegForm.mobileNumber.trim() || quickRegForm.mobileNumber.length < 10) {
      alert('Please enter valid mobile number');
      return;
    }
    if (quickRegForm.dateOfBirth.length !== 10) {
      alert('Please enter valid date of birth (DD/MM/YYYY)');
      return;
    }
    if (!quickRegForm.gender) {
      alert('Please select gender');
      return;
    }
    if (needsGuardian()) {
      if (!quickRegForm.guardianName.trim() || !quickRegForm.guardianMobile.trim() || !quickRegForm.guardianRelationship.trim()) {
        alert('Guardian details are mandatory for minors and senior citizens');
        return;
      }
    }

    setSavingPatient(true);

    try {
      // Convert DOB to YYYY-MM-DD format
      const [day, month, year] = quickRegForm.dateOfBirth.split('/');
      const dobISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      const patientData = {
        firstName: quickRegForm.firstName,
        lastName: quickRegForm.lastName,
        mobileNumber: quickRegForm.mobileNumber,
        dateOfBirth: dobISO,
        gender: quickRegForm.gender,
        guardianName: needsGuardian() ? quickRegForm.guardianName : undefined,
        guardianMobile: needsGuardian() ? quickRegForm.guardianMobile : undefined,
        guardianRelationship: needsGuardian() ? quickRegForm.guardianRelationship : undefined,
        photoUrl: quickRegForm.photoUrl,
      };

      const response = await api.post('/patients', patientData);
      
      const newPatient: Patient = {
        id: response.data.id,
        medicalRecordNumber: response.data.medicalRecordNumber,
        firstName: quickRegForm.firstName,
        lastName: quickRegForm.lastName,
        dateOfBirth: dobISO,
        gender: quickRegForm.gender,
        mobileNumber: quickRegForm.mobileNumber,
        photoUrl: quickRegForm.photoUrl,
        guardianName: quickRegForm.guardianName,
        guardianMobile: quickRegForm.guardianMobile,
        guardianRelationship: quickRegForm.guardianRelationship,
      };

      setSelectedPatient(newPatient);
      setShowQuickReg(false);
      
      // Reset form
      setQuickRegForm({
        firstName: '',
        lastName: '',
        mobileNumber: '',
        dateOfBirth: '',
        age: '',
        gender: '',
        guardianName: '',
        guardianMobile: '',
        guardianRelationship: '',
      });
      setPhotoPreview('');
    } catch (error: any) {
      console.error('Failed to save patient:', error);
      alert(error.response?.data?.message || 'Failed to save patient. Please try again.');
    } finally {
      setSavingPatient(false);
    }
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
          {!selectedPatient && !showQuickReg && (
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
              {searchTerm.trim().length >= 3 && searchResults.length === 0 && !searching && !showQuickReg && (
                <div className="mt-4 p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <div className="text-yellow-800 font-medium mb-4">
                    No patients found for "{searchTerm}"
                  </div>
                  <button
                    onClick={() => {
                      // Pre-fill first name from search term
                      const term = searchTerm.trim();
                      if (/^[a-zA-Z]+$/.test(term)) {
                        setQuickRegForm(prev => ({ 
                          ...prev, 
                          firstName: term.charAt(0).toUpperCase() + term.slice(1).toLowerCase() 
                        }));
                      } else if (/^\d{10}$/.test(term)) {
                        setQuickRegForm(prev => ({ ...prev, mobileNumber: term }));
                      }
                      setShowQuickReg(true);
                    }}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 mx-auto"
                  >
                    <UserPlus className="w-5 h-5" />
                    Register New Patient
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Registration Form */}
          {showQuickReg && !selectedPatient && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-blue-900 font-semibold">
                <UserPlus className="w-5 h-5" />
                Quick Patient Registration
              </div>

              {/* Photo Section */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Patient" className="w-24 h-24 rounded-lg object-cover border-2 border-gray-300" />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-gray-200 flex items-center justify-center">
                      <User className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    <Upload className="w-4 h-4" />
                    Upload Photo
                  </label>
                  <button onClick={handleWebcamCapture} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Capture Photo
                  </button>
                  <button onClick={handleSendToPatient} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Request Photo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={quickRegForm.firstName}
                    onChange={(e) => setQuickRegForm({ ...quickRegForm, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={quickRegForm.lastName}
                    onChange={(e) => setQuickRegForm({ ...quickRegForm, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                  <PhoneInput
                    country={'in'}
                    value={quickRegForm.mobileNumber}
                    onChange={(phone) => setQuickRegForm({ ...quickRegForm, mobileNumber: phone })}
                    containerClass="w-full"
                    inputClass="w-full"
                    buttonClass="border-gray-300"
                    inputStyle={{
                      width: '100%',
                      height: '42px',
                      fontSize: '14px',
                      paddingLeft: '48px',
                      borderRadius: '0.5rem',
                      border: '1px solid #d1d5db',
                    }}
                    buttonStyle={{
                      borderRadius: '0.5rem 0 0 0.5rem',
                      border: '1px solid #d1d5db',
                      backgroundColor: '#f9fafb',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select
                    value={quickRegForm.gender}
                    onChange={(e) => setQuickRegForm({ ...quickRegForm, gender: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value=""></option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={quickRegForm.dateOfBirth}
                    onChange={(e) => handleDOBChange(e.target.value)}
                    maxLength={10}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                  <input
                    type="text"
                    value={quickRegForm.age}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              {/* Guardian Details (show if age < 18 or > 60) */}
              {needsGuardian() && (
                <div className="border-t border-blue-300 pt-4 space-y-4">
                  <div className="text-sm font-medium text-blue-900">Guardian Details (Required)</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name *</label>
                      <input
                        type="text"
                        value={quickRegForm.guardianName}
                        onChange={(e) => setQuickRegForm({ ...quickRegForm, guardianName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Mobile *</label>
                      <PhoneInput
                        country={'in'}
                        value={quickRegForm.guardianMobile}
                        onChange={(phone) => setQuickRegForm({ ...quickRegForm, guardianMobile: phone })}
                        containerClass="w-full"
                        inputClass="w-full"
                        buttonClass="border-gray-300"
                        inputStyle={{
                          width: '100%',
                          height: '42px',
                          fontSize: '14px',
                          paddingLeft: '48px',
                          borderRadius: '0.5rem',
                          border: '1px solid #d1d5db',
                        }}
                        buttonStyle={{
                          borderRadius: '0.5rem 0 0 0.5rem',
                          border: '1px solid #d1d5db',
                          backgroundColor: '#f9fafb',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship *</label>
                    <input
                      type="text"
                      value={quickRegForm.guardianRelationship}
                      onChange={(e) => setQuickRegForm({ ...quickRegForm, guardianRelationship: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowQuickReg(false);
                    setQuickRegForm({
                      firstName: '',
                      lastName: '',
                      mobileNumber: '',
                      dateOfBirth: '',
                      age: '',
                      gender: '',
                      guardianName: '',
                      guardianMobile: '',
                      guardianRelationship: '',
                    });
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveQuickRegistration}
                  disabled={savingPatient}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                >
                  {savingPatient ? 'Saving Patient...' : 'Save & Continue to Booking'}
                </button>
              </div>
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
                        {doctor.consultationFee && ` - ₹${doctor.consultationFee}`}
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
                  <span className="text-lg font-bold text-blue-600">₹{bookedAppointment.consultationFee}</span>
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
