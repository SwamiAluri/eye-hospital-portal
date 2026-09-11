'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, Mail, Calendar, Droplet, MapPin, Camera, FileText } from 'lucide-react';
import { patientApi, getApi } from '@/lib/api';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import PhotoCapture from '../shared/PhotoCapture';
import RegistrationCardPreview from './RegistrationCardPreview';
import DuplicatePatientWarningDialog from './DuplicatePatientWarningDialog';

interface Patient {
  id?: string;
  medicalRecordNumber?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  contactNumber?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  allergies?: string;
  medicalConditions?: string;
  medications?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  notes?: string;
  photoUrl?: string;
  idProofType?: string;
  idProofNumber?: string;
}

interface PatientFormModalProps {
  patient?: Patient;
  isOpen: boolean;
  onClose: () => void;
  onSave: (patient: Patient) => void;
}

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const genders = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function PatientFormModal({
  patient,
  isOpen,
  onClose,
  onSave
}: PatientFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [savedPatient, setSavedPatient] = useState<Patient | null>(null);
  const [showRegistrationCard, setShowRegistrationCard] = useState(false);
  
  {/* Duplicate detection state */}
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [proceedWithDuplicate, setProceedWithDuplicate] = useState(false);
  
  const [formData, setFormData] = useState<Patient>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    contactNumber: '',
    email: '',
    address: '',
    bloodGroup: '',
    emergencyContactName: '',
    emergencyContactNumber: '',
    allergies: '',
    medicalConditions: '',
    medications: '',
    insuranceProvider: '',
    insuranceNumber: '',
    notes: '',
    photoUrl: '',
    idProofType: '',
    idProofNumber: ''
  });

  useEffect(() => {
    if (patient) {
      setFormData({
        id: patient.id,
        medicalRecordNumber: patient.medicalRecordNumber,
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        dateOfBirth: patient.dateOfBirth || '',
        gender: patient.gender || '',
        contactNumber: patient.contactNumber || '',
        email: patient.email || '',
        address: patient.address || '',
        bloodGroup: patient.bloodGroup || '',
        emergencyContactName: patient.emergencyContactName || '',
        emergencyContactNumber: patient.emergencyContactNumber || '',
        allergies: patient.allergies || '',
        medicalConditions: patient.medicalConditions || '',
        medications: patient.medications || '',
        insuranceProvider: patient.insuranceProvider || '',
        insuranceNumber: patient.insuranceNumber || '',
        notes: patient.notes || '',
        photoUrl: patient.photoUrl || '',
        idProofType: patient.idProofType || '',
        idProofNumber: patient.idProofNumber || ''
      });
      setPhotoPreview(patient.photoUrl || null);
    } else {
      // Reset form for new patient
      setFormData({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        contactNumber: '',
        email: '',
        address: '',
        bloodGroup: '',
        emergencyContactName: '',
        emergencyContactNumber: '',
        allergies: '',
        medicalConditions: '',
        medications: '',
        insuranceProvider: '',
        insuranceNumber: '',
        notes: '',
        photoUrl: '',
        idProofType: '',
        idProofNumber: ''
      });
      setPhotoPreview(null);
      setPhotoFile(null);
      setIdProofFile(null);
      setSavedPatient(null);
    }
  }, [patient, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    if (!formData.dateOfBirth) {
      setError('Date of birth is required');
      return;
    }

    if (!formData.gender) {
      setError('Gender is required');
      return;
    }

    // Validate date of birth is not in the future
    const dob = new Date(formData.dateOfBirth);
    const today = new Date();
    if (dob > today) {
      setError('Date of birth cannot be in the future');
      return;
    }

    setLoading(true);
    setError('');

    {/* Check for duplicates BEFORE submission (only for new patients, unless user already confirmed) */}
    if (!proceedWithDuplicate && !patient?.id) {
      try {
        const api = getApi();
        const duplicateCheck = await api.post('/patients/check-duplicates', {
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          contactNumber: formData.contactNumber,
          email: formData.email
        });

        if (duplicateCheck.data.isDuplicate && duplicateCheck.data.matches.length > 0) {
          setDuplicateMatches(duplicateCheck.data.matches);
          setShowDuplicateWarning(true);
          setLoading(false);
          return; {/* Stop submission */}
        }
      } catch (duplicateError) {
        console.error('Duplicate check failed:', duplicateError);
        {/* Continue with submission if duplicate check fails (don't block patient registration) */}
      }
    }

    try {
      let response;
      if (patient?.id) {
        response = await patientApi.update(patient.id, formData);
      } else {
        response = await patientApi.create(formData);
      }
      
      const patientId = patient?.id || response.data.id;
      
      // Upload patient photo if provided
      if (photoFile && patientId) {
        try {
          const photoFormData = new FormData();
          photoFormData.append('photo', photoFile);
          await patientApi.uploadPhoto(patientId, photoFormData);
        } catch (photoErr) {
          console.error('Failed to upload photo:', photoErr);
        }
      }
      
      // Upload ID proof if provided (future enhancement)
      if (idProofFile && patientId) {
        console.log('ID proof upload not yet implemented');
      }
      
      // Set saved patient data for registration card
      const savedPatientData = {
        ...formData,
        id: patientId,
        medicalRecordNumber: response.data.medicalRecordNumber || patient?.medicalRecordNumber,
        photoUrl: photoPreview || undefined
      };
      setSavedPatient(savedPatientData);
      
      // Call onSave with patient data immediately for walk-in / counselling handoff
      onSave(savedPatientData);
      
      // Don't close modal yet - let user see success state and print card if needed
    } catch (err: any) {
      const { formatPatientApiError } = await import('@/lib/patients/patient-write-payload');
      setError(formatPatientApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Patient, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handlePhotoCapture = (file: File, preview: string) => {
    setPhotoFile(file);
    setPhotoPreview(preview);
  };
  
  const handleIdProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('ID proof must be an image (JPG, PNG) or PDF file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('ID proof file size must be less than 5MB');
        return;
      }
      
      setIdProofFile(file);
      setError('');
    }
  };

  // Duplicate warning dialog handlers
  const handleProceedWithDuplicate = () => {
    setProceedWithDuplicate(true);
    setShowDuplicateWarning(false);
    // Re-trigger form submission by calling handleSubmit
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  const handleSelectExistingPatient = (patientId: string) => {
    setShowDuplicateWarning(false);
    // Navigate to existing patient or close modal
    const selectedDuplicate = duplicateMatches.find((m: any) => m.id === patientId);
    if (selectedDuplicate) {
      // Close modal and potentially navigate to patient details
      onClose();
      // You could also emit an event to navigate to the patient
      window.location.href = `/dashboard/patients?id=${patientId}`;
    }
  };

  const handleCloseDuplicateWarning = () => {
    setShowDuplicateWarning(false);
    setProceedWithDuplicate(false);
    setLoading(false);
  };


  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-3 min-[1600px]:p-4"
      data-testid="patient-form-modal-overlay"
    >
      <div
        className="flex max-h-[min(92dvh,calc(100dvh-1rem))] w-full max-w-[min(56rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-lg bg-white shadow-xl min-[1600px]:max-h-[min(90vh,calc(100dvh-2rem))] min-[1600px]:max-w-4xl"
        role="dialog"
        aria-modal="true"
        data-testid="patient-form-modal"
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-3 sm:px-5 min-[1600px]:p-6"
          data-testid="patient-form-modal-header"
        >
          <h2 className="text-lg font-bold text-gray-900 min-[1600px]:text-2xl">
            {patient ? 'Edit Patient' : 'Add New Patient'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            type="button"
            aria-label="Close"
            data-testid="patient-form-modal-close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form — scroll body + sticky footer (same workflow, viewport-fit) */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            data-testid="patient-form-modal-body"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:space-y-4 sm:p-4 min-[1600px]:space-y-6 min-[1600px]:p-6"
          >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="bg-gray-50 p-3 rounded-lg min-[1600px]:p-4">
            <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center min-[1600px]:mb-4 min-[1600px]:text-lg">
              <User className="w-5 h-5 mr-2" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 min-[1600px]:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender *
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Gender</option>
                  {genders.map(gender => (
                    <option key={gender} value={gender}>{gender}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Blood Group
                </label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select Blood Group</option>
                  {bloodGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Patient Photo */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Camera className="w-5 h-5 mr-2" />
              Patient Photo
            </h3>
            <PhotoCapture 
              onPhotoCapture={handlePhotoCapture}
              currentPreview={photoPreview}
              optional={true}
              label="Patient Photo"
            />
          </div>

          {/* ID Proof */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Identity Documents
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Proof Type <span className="text-gray-500">(Optional)</span>
                </label>
                <select
                  value={formData.idProofType}
                  onChange={(e) => handleInputChange('idProofType', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select ID Type</option>
                  <option value="Aadhaar">Aadhaar Card</option>
                  <option value="PAN">PAN Card</option>
                  <option value="Passport">Passport</option>
                  <option value="DrivingLicense">Driving License</option>
                  <option value="VoterID">Voter ID</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Number <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.idProofNumber}
                  onChange={(e) => handleInputChange('idProofNumber', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter ID number"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload ID Proof <span className="text-gray-500">(Optional, JPG/PNG/PDF, max 5MB)</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleIdProofUpload}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {idProofFile && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ File selected: {idProofFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* MRN Display (after patient saved) */}
          {savedPatient?.medicalRecordNumber && (
            <div className="bg-green-50 p-4 rounded-lg border-2 border-green-500">
              <h3 className="text-lg font-medium text-green-900 mb-2 flex items-center">
                ✅ Patient Registered Successfully
              </h3>
              <p className="text-xl font-bold text-green-700 mb-4">
                Medical Record Number (MRN): {savedPatient.medicalRecordNumber}
              </p>
              <button
                type="button"
                onClick={() => setShowRegistrationCard(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                🖨️ Print Registration Card
              </button>
            </div>
          )}
          
          {/* Registration Card Preview Modal */}
          {showRegistrationCard && savedPatient && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-lg p-6 max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Registration Card Preview</h3>
                  <button
                    onClick={() => setShowRegistrationCard(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>
                <RegistrationCardPreview patient={savedPatient} />
              </div>
            </div>
          )}

          {/* Contact Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Phone className="w-5 h-5 mr-2" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <PhoneInput
                  country={'us'}
                  value={formData.contactNumber}
                  onChange={(phone) => handleInputChange('contactNumber', phone)}
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
                  dropdownStyle={{
                    borderRadius: '0.5rem',
                  }}
                  enableSearch
                  searchPlaceholder="Search country"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="patient@example.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder="Street address, city, state, zip code"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Phone className="w-5 h-5 mr-2" />
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Full name of emergency contact"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Phone
                </label>
                <PhoneInput
                  country={'us'}
                  value={formData.emergencyContactNumber}
                  onChange={(phone) => handleInputChange('emergencyContactNumber', phone)}
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
                  dropdownStyle={{
                    borderRadius: '0.5rem',
                  }}
                  enableSearch
                  searchPlaceholder="Search country"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Medical Information section removed per requirements */}

          {/* Insurance Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Insurance Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Insurance Provider
                </label>
                <input
                  type="text"
                  value={formData.insuranceProvider}
                  onChange={(e) => handleInputChange('insuranceProvider', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Insurance company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Insurance Number
                </label>
                <input
                  type="text"
                  value={formData.insuranceNumber}
                  onChange={(e) => handleInputChange('insuranceNumber', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Policy or member ID number"
                />
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Notes</h3>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
              placeholder="Any additional notes or special instructions"
            />
          </div>
          </div>

          {/* Actions — sticky footer */}
          <div
            className="flex shrink-0 justify-end gap-3 border-t bg-white px-4 py-3 sm:px-6 sm:py-4"
            data-testid="patient-form-modal-footer"
          >
            <button
              type="button"
              onClick={() => {
                onClose();
                if (savedPatient) {
                  onSave(); // Trigger refresh when closing after successful save
                }
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              {savedPatient ? 'Close' : 'Cancel'}
            </button>
            {!savedPatient && (
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Saving...' : (patient ? 'Update Patient' : 'Create Patient')}
              </button>
            )}
          </div>
        </form>
      </div>
      
      {/* Duplicate Patient Warning Dialog */}
      <DuplicatePatientWarningDialog
        isOpen={showDuplicateWarning}
        onClose={handleCloseDuplicateWarning}
        onProceedAnyway={handleProceedWithDuplicate}
        onSelectExisting={handleSelectExistingPatient}
        duplicates={duplicateMatches}
        newPatientData={{
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          contactNumber: formData.contactNumber,
          email: formData.email
        }}
      />
    </div>,
    document.body,
  );
}