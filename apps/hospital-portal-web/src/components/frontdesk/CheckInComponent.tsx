'use client';

import { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { Search, UserCheck, AlertCircle, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { getApi } from '@/lib/api';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  medicalRecordNumber: string;
  contactNumber: string;
  photoUrl?: string;
  dateOfBirth: string;
  bloodGroup?: string;
}

interface CheckInValidation {
  hasAppointmentToday: boolean;
  appointmentId?: string;
  consultationFeePaid: boolean;
  outstandingBills: number;
  canCheckIn: boolean;
  errorMessage?: string;
}

interface EmergencyOverride {
  enabled: boolean;
  approvedBy: string;
  approverName: string;
  reason: string;
}

export default function CheckInComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [validation, setValidation] = useState<CheckInValidation | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [emergencyOverride, setEmergencyOverride] = useState<EmergencyOverride>({
    enabled: false,
    approvedBy: '',
    approverName: '',
    reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showTokenDisplay, setShowTokenDisplay] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<any>(null);

  // Auto-search when user types 3+ characters
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm.trim().length >= 3) {
        handleSearch();
      } else if (searchTerm.trim().length === 0) {
        // Clear results when search is cleared
        setPatient(null);
        setValidation(null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  // Search patient - Search across all fields
  const handleSearch = async () => {
    if (!searchTerm.trim() || searchTerm.trim().length < 3) return;

    setLoading(true);
    setPatient(null);
    setValidation(null);
    
    try {
      const api = getApi();
      const term = searchTerm.trim();
      
      // Try multiple search strategies
      const searchPromises = [
        api.get(`/patients/search`, { params: { searchTerm: term, searchType: 'mrn' } }).catch(() => ({ data: [] })),
        api.get(`/patients/search`, { params: { searchTerm: term, searchType: 'mobile' } }).catch(() => ({ data: [] })),
        api.get(`/patients/search`, { params: { searchTerm: term, searchType: 'name' } }).catch(() => ({ data: [] })),
        api.get(`/patients/search`, { params: { searchTerm: term, searchType: 'email' } }).catch(() => ({ data: [] }))
      ];
      
      const results = await Promise.all(searchPromises);
      
      // Find first non-empty result
      let foundPatient = null;
      for (const response of results) {
        if (response.data && response.data.length > 0) {
          foundPatient = response.data[0];
          break;
        }
      }

      if (foundPatient) {
        setPatient(foundPatient);
        
        // Validate check-in eligibility
        await validateCheckIn(foundPatient.id);
      } else {
        alert('Patient not found');
        setPatient(null);
        setValidation(null);
      }
    } catch (error: any) {
      console.error('Failed to search patient:', error);
      alert('Failed to search patient: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Validate check-in eligibility (DUAL HARD GATE)
  const validateCheckIn = async (patientId: string) => {
    try {
      const api = getApi();
      
      // GATE 1: Check if appointment exists for today
      const today = new Date().toISOString().split('T')[0];
      const appointmentResponse = await api.get(`/appointments/patient/${patientId}`, {
        params: { date: today },
      });

      const hasAppointment = appointmentResponse.data && appointmentResponse.data.length > 0;
      const appointment = hasAppointment ? appointmentResponse.data[0] : null;

      if (!hasAppointment) {
        setValidation({
          hasAppointmentToday: false,
          consultationFeePaid: false,
          outstandingBills: 0,
          canCheckIn: false,
          errorMessage: 'No appointment booked for today',
        });
        return;
      }

      // GATE 2: Check consultation fee payment status
      let consultationFeePaid = false;
      try {
        const paymentResponse = await api.get(`/billing/payment-status/${appointment.id}`);
        consultationFeePaid = paymentResponse.data?.paid === true;
      } catch (error) {
        console.warn('Payment status API not available, assuming fee not paid');
        consultationFeePaid = false;
      }

      // GATE 3: Check outstanding bills
      let outstandingBills = 0;
      try {
        const billsResponse = await api.get(`/opdbills/outstanding/${patientId}`);
        outstandingBills = billsResponse.data?.totalOutstanding || 0;
      } catch (error) {
        console.warn('Outstanding bills API error:', error);
        outstandingBills = 0;
      }

      // Determine if can check in
      const canCheckIn = consultationFeePaid && outstandingBills === 0;

      let errorMessage = '';
      if (!consultationFeePaid) {
        errorMessage = 'Consultation fee not paid - Please pay at billing counter';
      } else if (outstandingBills > 0) {
        errorMessage = `Outstanding bills: ₹${outstandingBills.toLocaleString()} - Please clear previous dues`;
      }

      setValidation({
        hasAppointmentToday: true,
        appointmentId: appointment.id,
        consultationFeePaid,
        outstandingBills,
        canCheckIn,
        errorMessage,
      });
    } catch (error: any) {
      console.error('Failed to validate check-in:', error);
      setValidation({
        hasAppointmentToday: false,
        consultationFeePaid: false,
        outstandingBills: 0,
        canCheckIn: false,
        errorMessage: 'Failed to validate check-in eligibility',
      });
    }
  };

  // Handle check-in
  const handleCheckIn = async () => {
    if (!patient || !validation) return;

    // Validate chief complaint
    if (!chiefComplaint.trim() || chiefComplaint.trim().length < 10) {
      alert('Please enter chief complaint (minimum 10 characters)');
      return;
    }

    // Check if emergency override is enabled but incomplete
    if (emergencyOverride.enabled) {
      if (!emergencyOverride.approvedBy || !emergencyOverride.approverName) {
        alert('Please select approver for emergency override');
        return;
      }
      if (!emergencyOverride.reason || emergencyOverride.reason.length < 20) {
        alert('Please enter reason for emergency override (minimum 20 characters)');
        return;
      }
    }

    // Check if can check in (normal validation or emergency override)
    if (!validation.canCheckIn && !emergencyOverride.enabled) {
      alert(validation.errorMessage || 'Cannot check in - validation failed');
      return;
    }

    setCheckingIn(true);
    try {
      const api = getApi();

      let appointmentId = validation?.appointmentId;

      // For emergency override without appointment, create a walk-in appointment first
      if (emergencyOverride.enabled && !appointmentId) {
        try {
          console.log('Creating emergency walk-in appointment...');
          const today = new Date();
          const dateStr = today.toISOString().split('T')[0];
          let timeStr = today.toTimeString().split(' ')[0].substring(0, 5);
          
          // Get a valid doctor ID - try multiple approaches
          let doctorId = null;
          
          // Try 1: Search for users by role
          try {
            const usersResponse = await api.get('/users?role=Doctor');
            console.log('Users response:', usersResponse.data);
            if (usersResponse.data && usersResponse.data.length > 0) {
              // Get first available user
              const firstUser = Array.isArray(usersResponse.data) ? usersResponse.data[0] : usersResponse.data;
              doctorId = firstUser.id || firstUser.userId;
              console.log('Found doctor via role search:', doctorId);
            }
          } catch (error) {
            console.warn('Role search failed:', error);
          }
          
          // Try 2: Get all users and find one with doctor-related email/name
          if (!doctorId) {
            try {
              const allUsersResponse = await api.get('/users');
              console.log('All users response:', allUsersResponse.data);
              if (allUsersResponse.data && allUsersResponse.data.length > 0) {
                // Find doctor user (look for doctor in email or name)
                const doctorUser = allUsersResponse.data.find((u: any) => 
                  (u.email && (u.email.toLowerCase().includes('doctor') || u.email.toLowerCase().includes('dr'))) ||
                  (u.name && (u.name.toLowerCase().includes('doctor') || u.name.toLowerCase().includes('dr'))) ||
                  (u.userName && (u.userName.toLowerCase().includes('doctor') || u.userName.toLowerCase().includes('dr')))
                );
                if (doctorUser) {
                  doctorId = doctorUser.id || doctorUser.userId;
                  console.log('Found doctor via name/email:', doctorId);
                }
              }
            } catch (error) {
              console.warn('All users fetch failed:', error);
            }
          }
          
          // If still no doctor, cannot create appointment
          if (!doctorId) {
            alert('Cannot create emergency appointment: No doctors available in the system. Please contact system administrator.');
            setCheckingIn(false);
            return;
          }
          
          // Create emergency walk-in appointment (backend will skip availability check for Emergency priority)
          const appointmentPayload: any = {
            patientId: patient.id,
            doctorId: doctorId,
            appointmentDate: dateStr,
            appointmentTime: timeStr,
            durationMinutes: 30,
            departmentId: '00000000-0000-0000-0000-000000000001',
            appointmentType: 'Walk-In',
            status: 'Scheduled',
            priority: 'Emergency', // This will bypass availability check in backend
            notes: `Emergency Override - Approver: ${emergencyOverride.approverName}, Reason: ${emergencyOverride.reason}`,
          };
          
          console.log('Creating emergency appointment:', appointmentPayload);
          const walkInResponse = await api.post('/appointments', appointmentPayload);
          appointmentId = walkInResponse.data.id || walkInResponse.data.appointmentId;
          console.log('Created walk-in appointment:', appointmentId);
        } catch (error: any) {
          console.error('Failed to create walk-in appointment:', error);
          alert('Failed to create emergency appointment: ' + (error.response?.data?.message || error.message));
          setCheckingIn(false);
          return;
        }
      }

      // Check-in requires appointment ID
      if (!appointmentId) {
        alert('Cannot check in: No appointment found');
        setCheckingIn(false);
        return;
      }

      // Perform check-in with proper DTO structure
      const checkInPayload = {
        appointmentId: appointmentId,
        isEmergency: emergencyOverride.enabled,
        emergencyReason: emergencyOverride.enabled ? emergencyOverride.reason : undefined,
        notes: chiefComplaint.trim(),
      };

      console.log('Check-in payload:', checkInPayload);
      const checkInResponse = await api.post('/visits/check-in', checkInPayload);

      console.log('Check-in successful:', checkInResponse.data);

      const visitId = checkInResponse.data?.visit?.id ?? checkInResponse.data?.Visit?.id;
      if (visitId) {
        try {
          await api.post('/visits/send-to', {
            visitId,
            station: 'optometrist',
            reasonCode: 'INITIAL_REFRACTION',
            reason: chiefComplaint.trim() || 'New OPD visit',
          });
        } catch (routeErr) {
          console.warn('Auto route to optometry failed:', routeErr);
        }
      }

      // Show token display
      setGeneratedToken(checkInResponse.data);
      setShowTokenDisplay(true);

      // Auto-close token display after 10 seconds
      setTimeout(() => {
        resetForm();
      }, 10000);
    } catch (error: any) {
      console.error('Check-in failed:', error);
      alert('Check-in failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setCheckingIn(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSearchTerm('');
    setPatient(null);
    setValidation(null);
    setChiefComplaint('');
    setEmergencyOverride({
      enabled: false,
      approvedBy: '',
      approverName: '',
      reason: '',
    });
    setShowTokenDisplay(false);
    setGeneratedToken(null);
  };

  // Token Display Modal
  if (showTokenDisplay && generatedToken) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-1">Check-In Successful</h2>
            <p className="text-sm text-slate-600">Patient has been checked in</p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 mb-6">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Token Number</p>
            <p className="text-5xl font-bold text-emerald-600 mb-3">
              {generatedToken.tokenNumber || 'N/A'}
            </p>
            <p className="text-base text-slate-700 font-medium">{patient?.firstName} {patient?.lastName}</p>
          </div>

          <button
            onClick={resetForm}
            className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
          >
            Close
          </button>

          <p className="text-xs text-slate-500 mt-3">Window closes automatically in 10 seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-[calc(100vh-180px)] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Patient Check-In</h1>
              <p className="text-sm text-slate-600">Search and verify patient for check-in</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Search Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Search Patient
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by MRN, mobile, name, or email..."
                className="w-full pl-10 pr-12 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={loading}
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {/* Patient Details */}
          {patient && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-start gap-4">
                {/* Patient Photo */}
                {patient.photoUrl ? (
                  <img
                    src={patient.photoUrl}
                    alt={`${patient.firstName} ${patient.lastName}`}
                    className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-slate-200 flex items-center justify-center text-2xl">
                    👤
                  </div>
                )}

                {/* Patient Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {patient.firstName} {patient.lastName}
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-slate-600">MRN:</span>{' '}
                      <span className="font-medium text-slate-900">{patient.medicalRecordNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Mobile:</span>{' '}
                      <span className="font-medium text-slate-900">{patient.contactNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">DOB:</span>{' '}
                      <span className="font-medium text-slate-900">
                        {new Date(patient.dateOfBirth).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600">Blood Group:</span>{' '}
                      <span className="font-medium text-slate-900">{patient.bloodGroup || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Gates */}
          {validation && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Check-In Validation</h3>

              {/* Gate 1: Appointment */}
              <div className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                {validation.hasAppointmentToday ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">Appointment Booked for Today</p>
                  <p className="text-xs text-slate-600">
                    {validation.hasAppointmentToday ? 'Valid appointment found' : 'No appointment for today'}
                  </p>
                </div>
              </div>

              {/* Gate 2: Consultation Fee */}
              {validation.hasAppointmentToday && (
                <div className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                  {validation.consultationFeePaid ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">Consultation Fee Paid</p>
                    <p className="text-xs text-slate-600">
                      {validation.consultationFeePaid
                        ? 'Payment confirmed'
                        : 'Please pay at billing counter'}
                    </p>
                  </div>
                </div>
              )}

              {/* Gate 3: Outstanding Bills */}
              {validation.hasAppointmentToday && (
                <div className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                  {validation.outstandingBills === 0 ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">No Outstanding Bills</p>
                    <p className="text-xs text-slate-600">
                      {validation.outstandingBills === 0
                        ? 'No outstanding dues'
                        : `Outstanding: ₹${validation.outstandingBills.toLocaleString()}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {!validation.canCheckIn && validation.errorMessage && !emergencyOverride.enabled && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-900">Cannot Check In</p>
                    <p className="text-xs text-red-700">{validation.errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chief Complaint */}
          {patient && (validation?.hasAppointmentToday || emergencyOverride.enabled) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Chief Complaint <span className="text-red-600">*</span>
              </label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="Enter patient's chief complaint (minimum 10 characters)..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                {chiefComplaint.length} characters (minimum 10 required)
              </p>
            </div>
          )}

          {/* Emergency Override */}
          {patient && validation && !validation.canCheckIn && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <input
                  type="checkbox"
                  id="emergency-override"
                  checked={emergencyOverride.enabled}
                  onChange={(e) =>
                    setEmergencyOverride({ ...emergencyOverride, enabled: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-slate-300"
                />
                <label htmlFor="emergency-override" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-semibold text-slate-900">Emergency Case - Override Payment Validation</p>
                  </div>
                  <p className="text-xs text-slate-600">
                    Enable this to bypass payment validation for emergency cases (requires approval)
                  </p>
                </label>
              </div>

              {emergencyOverride.enabled && (
                <div className="space-y-3 pl-7">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Approver <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={emergencyOverride.approvedBy}
                      onChange={(e) => {
                        const value = e.target.value;
                        const name = e.target.selectedOptions[0].text;
                        setEmergencyOverride({
                          ...emergencyOverride,
                          approvedBy: value,
                          approverName: name,
                        });
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value="">Select Approver</option>
                      <option value="senior-doctor-1">Senior Doctor - Dr. Smith</option>
                      <option value="admin-1">Admin - John Admin</option>
                      <option value="dept-head-1">Department Head - Dr. Kumar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Reason <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      value={emergencyOverride.reason}
                      onChange={(e) =>
                        setEmergencyOverride({ ...emergencyOverride, reason: e.target.value })
                      }
                      placeholder="Enter detailed reason for emergency override (minimum 20 characters)..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {emergencyOverride.reason.length} characters (minimum 20 required)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {patient && (validation?.hasAppointmentToday || emergencyOverride.enabled) && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCheckIn}
                disabled={
                  checkingIn ||
                  (!emergencyOverride.enabled && (!validation?.canCheckIn)) ||
                  chiefComplaint.trim().length < 10 ||
                  (emergencyOverride.enabled && (!emergencyOverride.approvedBy || emergencyOverride.reason.length < 20))
                }
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {checkingIn ? 'Checking In...' : emergencyOverride.enabled ? 'Emergency Check-In (Override)' : 'Check In Patient'}
              </button>
              <button
                onClick={resetForm}
                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
  );
}
