'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { patientApi } from '@/lib/api/patients.api';
import RegistrationCardPreview from '@/components/patients/RegistrationCardPreview';
import { useMasterValues } from '@/hooks/use-master-values';
import { MasterValuesSelect } from '@/components/master-data/MasterValuesSelect';
import { X } from 'lucide-react';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PatientFormData {
  // Phase 6: Extended Demographics
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  occupation: string;
  maritalStatus: string;
  religion: string;
  languagePreference: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  bloodGroup: string;
  allergies: string;
  medicalHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  emergencyContactEmail: string;
  emergencyContactAddress: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceGroupNumber: string;
  insuranceValidFrom: string;
  insuranceValidTo: string;
  // Phase 2: Identity Documents
  healthId: string;
  aadhaarNumber: string;
  nationalId: string;
  passportNumber: string;
  drivingLicense: string;
  idProofType: string;
  // Phase 3: Guardian Information
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianAddress: string;
  guardianIdProof: string;
  // Phase 4: Enhanced Medical History
  chronicConditions: string;
  currentMedications: string;
  pastSurgeries: string;
  familyMedicalHistory: string;
  knownAllergiesDetails: string;
  immunizationRecords: string;
  disabilityStatus: string;
  specialNeeds: string;
  // Phase 8: Additional Medical/Lifestyle Fields
  exerciseHabits: string;
  dietType: string;
  smokingStatus: string;
  alcoholUse: string;
  lifestyleNotes: string;
  // Phase 7: Patient Photo
  photoFile: File | null;
  photoPreview: string | null;
  // Phase 5: Structured Address
  addressLine1: string;
  addressLine2: string;
  country: string;
  district: string;
  landmark: string;
  pinCode: string;
}

export default function NewPatientModal({ isOpen, onClose }: NewPatientModalProps) {
  const { options: insuranceProviderOptions } = useMasterValues('insurance.provider');

  const [formData, setFormData] = useState<PatientFormData>({
    // Phase 6: Extended Demographics
    title: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    occupation: '',
    maritalStatus: '',
    religion: '',
    languagePreference: '',
    gender: 'Male',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    bloodGroup: '',
    allergies: '',
    medicalHistory: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    emergencyContactEmail: '',
    emergencyContactAddress: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceGroupNumber: '',
    insuranceValidFrom: '',
    insuranceValidTo: '',
    // Phase 2: Identity Documents
    healthId: '',
    aadhaarNumber: '',
    nationalId: '',
    passportNumber: '',
    drivingLicense: '',
    idProofType: '',
    // Phase 3: Guardian Information
    guardianName: '',
    guardianRelationship: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianAddress: '',
    guardianIdProof: '',
    // Phase 4: Enhanced Medical History
    chronicConditions: '',
    currentMedications: '',
    pastSurgeries: '',
    familyMedicalHistory: '',
    knownAllergiesDetails: '',
    immunizationRecords: '',
    disabilityStatus: '',
    specialNeeds: '',
    // Phase 8: Additional Medical/Lifestyle Fields
    exerciseHabits: '',
    dietType: '',
    smokingStatus: '',
    alcoholUse: '',
    lifestyleNotes: '',
    // Phase 7: Patient Photo
    photoFile: null,
    photoPreview: null,
    // Phase 5: Structured Address
    addressLine1: '',
    addressLine2: '',
    country: '',
    district: '',
    landmark: '',
    pinCode: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PatientFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [calculatedAge, setCalculatedAge] = useState<string>('');
  const [savedPatient, setSavedPatient] = useState<any>(null);
  const [showRegistrationCard, setShowRegistrationCard] = useState(false);
  
  // Webcam state
  const [showWebcam, setShowWebcam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const calculateAge = (dob: string): string => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    
    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    const parts = [];
    if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    
    return parts.join(', ') || '0 days';
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof PatientFormData, string>> = {};

    if (step === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
      if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
      if (!formData.gender) newErrors.gender = 'Gender is required';
    }

    if (step === 2) {
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Invalid email format';
      }
      if (formData.phone && !/^\+?[\d\s()-]+$/.test(formData.phone)) {
        newErrors.phone = 'Invalid phone format';
      }
    }

    if (step === 3) {
      // Validate Aadhaar if provided
      if (formData.aadhaarNumber && !/^\d{12}$/.test(formData.aadhaarNumber)) {
        newErrors.aadhaarNumber = 'Aadhaar must be exactly 12 digits';
      }
    }

    if (step === 4) {
      // Validate guardian information for minors and seniors
      if (formData.dateOfBirth) {
        const age = new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear();
        const needsGuardian = age < 18 || age >= 65;
        const isMinor = age < 18;
        
        if (needsGuardian && isMinor) {
          // Mandatory for minors
          if (!formData.guardianName.trim()) {
            newErrors.guardianName = 'Guardian name is required for minors';
          }
          if (!formData.guardianPhone.trim()) {
            newErrors.guardianPhone = 'Guardian phone is required for minors';
          }
        }
      }
      // Validate guardian email if provided
      if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
        newErrors.guardianEmail = 'Invalid guardian email format';
      }
    }

    if (step === 6) {
      if (formData.emergencyContactName && !formData.emergencyContactPhone) {
        newErrors.emergencyContactPhone = 'Phone required if contact name provided';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      let nextStep = currentStep + 1;
      
      // Skip guardian step if not needed
      if (nextStep === 4) {
        const age = formData.dateOfBirth 
          ? new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear()
          : null;
        const needsGuardian = age !== null && (age < 18 || age >= 65);
        
        if (!needsGuardian) {
          nextStep = 5; // Skip to emergency contact
        }
      }
      
      setCurrentStep(Math.min(nextStep, 6));
    }
  };

  const handlePrevious = () => {
    let prevStep = currentStep - 1;
    
    // Skip guardian step if not needed when going backward
    if (currentStep === 5) {
      const age = formData.dateOfBirth 
        ? new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear()
        : null;
      const needsGuardian = age !== null && (age < 18 || age >= 65);
      
      if (!needsGuardian) {
        prevStep = 3; // Skip back to identity documents
      }
    }
    
    setCurrentStep(Math.max(prevStep, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(currentStep)) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Remove photo fields from payload (handled separately)
      const { photoFile, photoPreview, ...patientData } = formData;
      
      // Clean up empty strings - convert to null for optional fields to avoid validation errors
      const cleanPayload = Object.entries(patientData).reduce((acc, [key, value]) => {
        // Keep non-empty values, convert empty strings to null for email fields
        if (key === 'email' || key === 'guardianEmail') {
          acc[key] = value?.trim() || null;
        } else {
          acc[key] = value === '' ? null : value;
        }
        return acc;
      }, {} as any);
      
      const payload = {
        ...cleanPayload,
        status: 'Active'
      };

      const response = await patientApi.create(payload);
      const patientId = response.data.id;

      // Phase 7: Upload patient photo if provided
      // Upload photo if provided
      let photoUrl = formData.photoPreview;
      if (formData.photoFile && patientId) {
        try {
          const photoFormData = new FormData();
          photoFormData.append('photo', formData.photoFile);

          const photoResponse = await patientApi.uploadPhoto(patientId, photoFormData);
          console.log('✅ Photo upload response:', photoResponse.data);
          
          // Backend returns full URL in photoUrl field
          photoUrl = photoResponse.data?.photoUrl || photoResponse.data?.url || formData.photoPreview;
          console.log('✅ Photo URL set to:', photoUrl);
        } catch (photoErr: any) {
          console.error('⚠️ Failed to upload patient photo:', photoErr);
          console.error('⚠️ Error details:', photoErr.response?.data || photoErr.message);
          // Continue anyway - patient was created
        }
      }

      // Set saved patient data for success display
      const savedPatientData = {
        id: patientId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        contactNumber: formData.phone,
        bloodGroup: formData.bloodGroup,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        medicalRecordNumber: (response.data as any).medicalRecordNumber,
        photoUrl: photoUrl,
        address: formData.address
      };
      
      console.log('📦 Saved patient data:', savedPatientData);
      console.log('🖼️ Photo URL in saved patient:', savedPatientData.photoUrl);
      
      setSavedPatient(savedPatientData);

      // Don't close immediately - show success state first
    } catch (err: any) {
      alert('Failed to create patient: ' + (err.response?.data?.message || 'Unknown error'));
      console.error('Error creating patient:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Webcam Functions
  const startWebcam = async () => {
    try {
      setShowWebcam(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 } 
      });
      setStream(mediaStream);
      
      // Wait for next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing webcam:', error);
      alert('Could not access webcam. Please check permissions.');
      setShowWebcam(false);
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowWebcam(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `webcam-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const reader = new FileReader();
            reader.onloadend = () => {
              setFormData({
                ...formData,
                photoFile: file,
                photoPreview: reader.result as string
              });
            };
            reader.readAsDataURL(file);
            stopWebcam();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const steps = [
    { id: 1, title: 'Personal Info' },
    { id: 2, title: 'Contact' },
    { id: 3, title: 'Identity' },
    { id: 4, title: 'Guardian' },
    { id: 5, title: 'Emergency' },
    { id: 6, title: 'Insurance' }
  ];

  const renderStepTitle = () => {
    const titles = {
      1: 'Personal Information',
      2: 'Contact Information',
      3: 'Identity Documents',
      4: 'Guardian Information',
      5: 'Emergency Contact',
      6: 'Insurance Information'
    };
    return (
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        {titles[currentStep as keyof typeof titles]}
      </h2>
    );
  };

  // Handle modal open/close and ESC key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // Modal Backdrop
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Content */}
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 rounded-t-lg flex-shrink-0 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">Register New Patient</h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        {/* Main Content - Vertical Stepper + Form */}
        <div className="flex flex-row flex-1 overflow-hidden">
          {/* Vertical Stepper - Left Side - Evenly distributed like reference */}
          <div className="w-72 bg-gray-50 py-6 px-6 flex-shrink-0 border-r border-gray-200 flex items-center">
            <div className="relative h-full flex flex-col w-full">
              {/* Vertical connecting line - through all steps */}
              <div className="absolute left-[15px] top-[16px] bottom-[16px] w-0.5 bg-gray-300"></div>
              
              <div className="flex flex-col justify-between h-full relative">
                {steps.map((step, index) => (
                  <div key={step.id} className="relative flex items-start">
                    {/* Step Circle */}
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                          currentStep > step.id
                            ? 'bg-teal-500 text-white'
                            : currentStep === step.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border-2 border-gray-300 text-gray-400'
                        }`}
                      >
                        {currentStep > step.id ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          step.id
                        )}
                      </div>
                    </div>
                    
                    {/* Step Label */}
                    <div className="ml-4 flex-1">
                      <div
                        className={`text-base font-semibold ${
                          currentStep === step.id
                            ? 'text-gray-900'
                            : currentStep > step.id
                            ? 'text-gray-700'
                            : 'text-gray-500'
                        }`}
                      >
                        {step.title}
                      </div>
                      <div className="text-sm text-gray-400 mt-0.5">
                        {currentStep === step.id
                          ? 'Select type'
                          : currentStep > step.id
                          ? 'Completed'
                          : 'Pending'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form Content - Right Side - Fixed height with visible scrollbar */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto px-6 py-2">
              <style dangerouslySetInnerHTML={{ __html: `
                .compact-input { padding: 0.375rem 0.75rem !important; font-size: 0.875rem; }
                .compact-label { margin-bottom: 0.25rem !important; font-size: 0.875rem; }
                .compact-form select, .compact-form input, .compact-form textarea {
                  padding: 0.375rem 0.5rem !important;
                  font-size: 0.875rem !important;
                }
                .compact-form label {
                  margin-bottom: 0.25rem !important;
                }
              `}} />
            <form onSubmit={handleSubmit} className="space-y-2 compact-form">
              {renderStepTitle()}

              {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className="space-y-2">
              {/* Phase 6: Extended Demographics - Name Section */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <MasterValuesSelect
                    entityType="patient.title"
                    optionValue="label"
                    value={formData.title}
                    onChange={(v) => setFormData({ ...formData, title: v })}
                    placeholder="Select Title"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => {
                      setFormData({ ...formData, dateOfBirth: e.target.value });
                      setCalculatedAge(calculateAge(e.target.value));
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.dateOfBirth && (
                    <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Age (calculated)
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
                    {calculatedAge || 'Select DOB'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Gender</option>
                    {genderOptions.map((o) => (
                      <option key={o.value} value={o.label}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-center text-sm text-gray-600 my-2">OR</div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enter Age Directly (in years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    placeholder="e.g., 34 or 45"
                    onChange={(e) => {
                      const ageYears = parseInt(e.target.value);
                      if (!isNaN(ageYears) && ageYears > 0) {
                        const today = new Date();
                        const approxDOB = new Date(today.getFullYear() - ageYears, today.getMonth(), today.getDate());
                        const dobString = approxDOB.toISOString().split('T')[0];
                        setFormData({ ...formData, dateOfBirth: dobString });
                        setCalculatedAge(calculateAge(dobString));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Approximate DOB will be calculated from age
                  </p>
                </div>
              </div>

              {/* Phase 6: Extended Demographics Section */}
              <div className="space-y-4 border-t border-gray-200 pt-4 mt-6">
                <h4 className="text-sm font-semibold text-gray-700">Additional Demographics</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nationality
                    </label>
                    <MasterValuesSelect
                      entityType="patient.nationality"
                      optionValue="label"
                      value={formData.nationality}
                      onChange={(v) => setFormData({ ...formData, nationality: v })}
                      placeholder="Select Nationality"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Occupation
                    </label>
                    <MasterValuesSelect
                      entityType="patient.occupation"
                      optionValue="label"
                      value={formData.occupation}
                      onChange={(v) => setFormData({ ...formData, occupation: v })}
                      placeholder="Select Occupation"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marital Status
                    </label>
                    <MasterValuesSelect
                      entityType="patient.marital_status"
                      optionValue="label"
                      value={formData.maritalStatus}
                      onChange={(v) => setFormData({ ...formData, maritalStatus: v })}
                      placeholder="Select Status"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Religion
                    </label>
                    <MasterValuesSelect
                      entityType="patient.religion"
                      optionValue="label"
                      value={formData.religion}
                      onChange={(v) => setFormData({ ...formData, religion: v })}
                      placeholder="Select Religion (Optional)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Language
                  </label>
                  <select
                    value={formData.languagePreference}
                    onChange={(e) => setFormData({ ...formData, languagePreference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Language</option>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Phase 7: Patient Photo Upload */}
              <div className="space-y-3 border-t border-gray-200 pt-4 mt-6">
                <h4 className="text-sm font-semibold text-gray-700">Patient Photo (Optional)</h4>
                
                <div className="flex items-start space-x-4">
                  {/* Photo Preview */}
                  <div className="flex-shrink-0">
                    {formData.photoPreview ? (
                      <div className="relative">
                        <img
                          src={formData.photoPreview}
                          alt="Patient photo"
                          className="w-32 h-32 rounded-lg object-cover border-2 border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, photoFile: null, photoPreview: null });
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1">
                    <input
                      type="file"
                      id="patientPhoto"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Validate file size (10MB max)
                          if (file.size > 10 * 1024 * 1024) {
                            alert('File size must be less than 10MB');
                            e.target.value = '';
                            return;
                          }
                          
                          // Validate file type
                          const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                          if (!validTypes.includes(file.type)) {
                            alert('Only JPEG, PNG, and WEBP images are allowed');
                            e.target.value = '';
                            return;
                          }
                          
                          // Create preview
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData({
                              ...formData,
                              photoFile: file,
                              photoPreview: reader.result as string
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="patientPhoto"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Choose Photo
                    </label>
                    
                    {/* Webcam Capture Button */}
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="ml-3 inline-flex items-center px-4 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Capture Photo
                    </button>
                    
                    <p className="mt-2 text-xs text-gray-500">
                      JPEG, PNG, or WEBP • Max 10MB
                    </p>
                    {formData.photoFile && (
                      <p className="mt-1 text-sm text-green-600">
                        ✓ {formData.photoFile.name} ({(formData.photoFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Webcam Modal */}
                {showWebcam && (
                  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4">
                      <h3 className="text-lg font-semibold mb-4">Capture Patient Photo</h3>
                      <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-auto"
                          style={{ minHeight: '400px', objectFit: 'cover' }}
                        />
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                      <div className="mt-4 flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={stopWebcam}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Capture
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Group
                  </label>
                  <MasterValuesSelect
                    entityType="patient.blood_group"
                    optionValue="label"
                    value={formData.bloodGroup}
                    onChange={(v) => setFormData({ ...formData, bloodGroup: v })}
                    placeholder="Select Blood Group"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Disability Status
                  </label>
                  <select
                    value={formData.disabilityStatus}
                    onChange={(e) => setFormData({ ...formData, disabilityStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Disability Status</option>
                    <option value="None">None</option>
                    <option value="Visual Impairment">Visual Impairment</option>
                    <option value="Hearing Impairment">Hearing Impairment</option>
                    <option value="Mobility Impairment">Mobility Impairment</option>
                    <option value="Cognitive Disability">Cognitive Disability</option>
                    <option value="Speech Impairment">Speech Impairment</option>
                    <option value="Multiple Disabilities">Multiple Disabilities</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Information */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* Phase 5: Structured Address Fields */}
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-700">Address Details</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine1}
                      onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Street address"
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine2}
                      onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={200}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      District
                    </label>
                    <input
                      type="text"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="District/County"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Country</option>
                      <option value="United States">United States</option>
                      <option value="India">India</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      value={formData.pinCode}
                      onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="ZIP/Postal Code"
                      maxLength={20}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code (Legacy)
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Landmark
                  </label>
                  <input
                    type="text"
                    value={formData.landmark}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Address (Legacy)
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Identity Documents */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Provide at least one government-issued ID for verification and insurance claims
              </p>

              {/* Health ID is auto-generated, hidden from user */}
              <input type="hidden" value={formData.healthId} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Proof Type
                  </label>
                  <MasterValuesSelect
                    entityType="patient.id_proof_type"
                    value={formData.idProofType}
                    onChange={(v) => setFormData({ ...formData, idProofType: v })}
                    placeholder="Select Primary ID Type"
                  />
                </div>

                {/* Conditional ID Number Field */}
                {formData.idProofType === 'AADHAAR' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Aadhaar Number (India)
                    </label>
                    <input
                      type="text"
                      value={formData.aadhaarNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setFormData({ ...formData, aadhaarNumber: value });
                      }}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                        errors.aadhaarNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={12}
                    />
                    {errors.aadhaarNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.aadhaarNumber}</p>
                    )}
                    {formData.aadhaarNumber && formData.aadhaarNumber.length < 12 && (
                      <p className="mt-1 text-xs text-orange-600">
                        {12 - formData.aadhaarNumber.length} more digits required
                      </p>
                    )}
                  </div>
                )}

                {formData.idProofType === 'PAN' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      National ID Number
                    </label>
                    <input
                      type="text"
                      value={formData.nationalId}
                      onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={50}
                    />
                  </div>
                )}

                {formData.idProofType === 'PASSPORT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passport Number
                    </label>
                    <input
                      type="text"
                      value={formData.passportNumber}
                      onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={50}
                    />
                  </div>
                )}

                {formData.idProofType === 'DL' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Driving License Number
                    </label>
                    <input
                      type="text"
                      value={formData.drivingLicense}
                      onChange={(e) => setFormData({ ...formData, drivingLicense: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={50}
                    />
                  </div>
                )}
              </div>

              {/* ID Proof Upload Section */}
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload ID Proof <span className="text-gray-500">(Optional, JPG/PNG/PDF, max 5MB)</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Validate file type
                      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
                      if (!allowedTypes.includes(file.type)) {
                        alert('ID proof must be an image (JPG, PNG) or PDF file');
                        e.target.value = '';
                        return;
                      }
                      
                      // Validate file size (max 5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        alert('ID proof file size must be less than 5MB');
                        e.target.value = '';
                        return;
                      }
                      
                      console.log('ID Proof file selected:', file.name);
                      // You can store this file in state if needed for upload
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Accepted formats: JPG, PNG, PDF. Maximum file size: 5MB
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Guardian Information (for minors and seniors) */}
          {currentStep === 4 && (() => {
            const age = formData.dateOfBirth 
              ? new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear()
              : null;
            const needsGuardian = age !== null && (age < 18 || age >= 65);
            const isMinor = age !== null && age < 18;
            const isSenior = age !== null && age >= 65;

            // Don't render this step at all if guardian not needed
            if (!needsGuardian) {
              return null;
            }

            return (
              <div className="space-y-4">
                {isMinor && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <p className="text-sm text-yellow-700">
                      <strong>Required:</strong> Patient is a minor (age {age}). Guardian information is mandatory.
                    </p>
                  </div>
                )}

                {isSenior && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                    <p className="text-sm text-blue-700">
                      <strong>Recommended:</strong> Patient is a senior citizen (age {age}). Guardian information is recommended.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Guardian Name {isMinor && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={formData.guardianName}
                      onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                        errors.guardianName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={100}
                    />
                    {errors.guardianName && (
                      <p className="mt-1 text-sm text-red-600">{errors.guardianName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Relationship
                    </label>
                    <MasterValuesSelect
                      entityType="patient.relationship"
                      optionValue="label"
                      value={formData.guardianRelationship}
                      onChange={(v) => setFormData({ ...formData, guardianRelationship: v })}
                      placeholder="Select Relationship"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Guardian Phone {isMinor && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="tel"
                      value={formData.guardianPhone}
                      onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                        errors.guardianPhone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={20}
                    />
                    {errors.guardianPhone && (
                      <p className="mt-1 text-sm text-red-600">{errors.guardianPhone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Guardian Email
                    </label>
                    <input
                      type="email"
                      value={formData.guardianEmail}
                      onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                        errors.guardianEmail ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={100}
                    />
                    {errors.guardianEmail && (
                      <p className="mt-1 text-sm text-red-600">{errors.guardianEmail}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guardian Address
                  </label>
                  <textarea
                    value={formData.guardianAddress}
                    onChange={(e) => setFormData({ ...formData, guardianAddress: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Guardian ID Proof Type
                    </label>
                    <select
                      value={formData.guardianIdProof}
                      onChange={(e) => setFormData({ ...formData, guardianIdProof: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select ID Type</option>
                      <option value="Aadhaar">Aadhaar Card</option>
                      <option value="Passport">Passport</option>
                      <option value="DrivingLicense">Driving License</option>
                      <option value="VoterID">Voter ID</option>
                      <option value="NationalID">National ID</option>
                    </select>
                  </div>
                </div>

                {/* Guardian ID Upload - Always Visible When ID Type Selected */}
                {formData.guardianIdProof && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Guardian ID Proof
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
                          if (!allowedTypes.includes(file.type)) {
                            alert('Please upload JPG, PNG, or PDF file');
                            e.target.value = '';
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            alert('File size must be less than 5MB');
                            e.target.value = '';
                            return;
                          }
                          console.log('Guardian ID Proof uploaded:', file.name);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Step 5: Emergency Contact */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.emergencyContactPhone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.emergencyContactPhone && (
                    <p className="mt-1 text-sm text-red-600">{errors.emergencyContactPhone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Relationship
                  </label>
                  <MasterValuesSelect
                    entityType="patient.relationship"
                    optionValue="label"
                    value={formData.emergencyContactRelation}
                    onChange={(v) => setFormData({ ...formData, emergencyContactRelation: v })}
                    placeholder="Select Relationship"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.emergencyContactEmail}
                  onChange={(e) => setFormData({ ...formData, emergencyContactEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address (Optional)
                </label>
                <textarea
                  value={formData.emergencyContactAddress}
                  onChange={(e) => setFormData({ ...formData, emergencyContactAddress: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 6: Insurance Information */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insurance Provider
                </label>
                <select
                  value={formData.insuranceProvider}
                  onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Insurance Provider</option>
                  {insuranceProviderOptions.map((o) => (
                    <option key={o.value} value={o.label}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Number
                </label>
                <input
                  type="text"
                  value={formData.insurancePolicyNumber}
                  onChange={(e) => setFormData({ ...formData, insurancePolicyNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Number (Optional)
                </label>
                <input
                  type="text"
                  value={formData.insuranceGroupNumber}
                  onChange={(e) => setFormData({ ...formData, insuranceGroupNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid From (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.insuranceValidFrom}
                    onChange={(e) => setFormData({ ...formData, insuranceValidFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid To (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.insuranceValidTo}
                    onChange={(e) => setFormData({ ...formData, insuranceValidTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Review Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>{' '}
                    <span className="font-medium">{formData.firstName} {formData.lastName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">DOB:</span>{' '}
                    <span className="font-medium">{formData.dateOfBirth || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Gender:</span>{' '}
                    <span className="font-medium">{formData.gender}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Blood Group:</span>{' '}
                    <span className="font-medium">{formData.bloodGroup || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>{' '}
                    <span className="font-medium">{formData.phone || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>{' '}
                    <span className="font-medium">{formData.email || 'Not provided'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success State Modal - Show as popup after patient created */}
          {savedPatient?.medicalRecordNumber && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[80]" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
              <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full m-4">
                <div className="bg-green-50 p-8 rounded-t-lg border-b-4 border-green-500">
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-green-500 rounded-full p-3 mr-4">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-3xl font-bold text-green-900">
                      Patient Registered Successfully!
                    </h3>
                  </div>
                  <div className="text-center bg-white rounded-lg p-6 shadow-md">
                    <p className="text-lg text-gray-600 mb-2">Medical Record Number (MRN)</p>
                    <p className="text-4xl font-bold text-green-700 tracking-wider">
                      {savedPatient.medicalRecordNumber?.replace(/-/g, '') || savedPatient.medicalRecordNumber}
                    </p>
                  </div>
                </div>
                <div className="p-8">
                  <div className="flex gap-4 justify-center">
                    <button
                      type="button"
                      onClick={() => setShowRegistrationCard(true)}
                      className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-lg shadow-lg hover:shadow-xl transition-all"
                    >
                      🖨️ Print Registration Card
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                      }}
                      className="px-8 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium text-lg shadow-lg hover:shadow-xl transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons - Hide when success state is shown */}
          {!savedPatient && (
            <div className="flex justify-between mt-4 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className={`px-6 py-2 rounded-md ${
                  currentStep === 1
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                Previous
              </button>

              <div className="flex gap-2">
                {currentStep < 6 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e)}
                    disabled={isSubmitting}
                    className={`px-6 py-2 rounded-md ${
                      isSubmitting
                        ? 'bg-emerald-300 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    } text-white`}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Patient'}
                  </button>
                )}
              </div>
            </div>
          )}
        </form>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Card Preview Modal - Separate from form */}
      {showRegistrationCard && savedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[90]" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white rounded-lg p-6 max-w-2xl m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Registration Card Preview</h3>
              <button
                onClick={() => setShowRegistrationCard(false)}
                className="text-gray-500 hover:text-gray-700"
                type="button"
              >
                <X size={24} />
              </button>
            </div>
            <RegistrationCardPreview patient={savedPatient} />
          </div>
        </div>
      )}
    </div>
  );
}
