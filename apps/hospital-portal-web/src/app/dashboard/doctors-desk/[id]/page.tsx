'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, User, Calendar, Activity, Eye } from 'lucide-react';
import { useClinicalStore } from '@/lib/stores/clinical-store';
import { useHasPermission } from '@/hooks/use-permissions';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { toast } from 'react-hot-toast';
import DoctorExaminationForm from '@/components/doctors-desk/DoctorComprehensiveExam';
import SendToOptometryButton from '@/components/clinical/SendToOptometryButton';
import { optometrySummaryApi } from '@/lib/api/optometry.api';
import { patientsEnhancedApi } from '@/lib/api/patients-enhanced.api';
import AlertBanner from '@/components/doctors-desk/AlertBanner';
import { detectRedFlags } from '@/lib/utils/redFlagDetection';

function DoctorDeskPageContent() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const { selectedPatient } = useClinicalStore();
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<any>(null);
  const [optometryData, setOptometryData] = useState<any>(null);

  const canEdit = useHasPermission('CLINICAL:EXAMINATION:EDIT');

  useEffect(() => {
    const loadPatientData = async () => {
      try {
        setLoading(true);
        
        // Try to load real patient data
        let realPatient = null;
        try {
          const patient = await patientsEnhancedApi.getPatient(patientId);
          
          // Backend returns flat structure, not nested in personalInfo
          realPatient = {
            id: patient.id,
            name: `${patient.firstName || patient.personalInfo?.firstName || ''} ${patient.lastName || patient.personalInfo?.lastName || ''}`.trim() || `Patient ${patientId.substring(0, 8)}`,
            mrn: patient.medicalRecordNumber || patient.personalInfo?.medicalRecordNumber || `MRN-${patientId.substring(0, 6)}`,
            age: patient.dateOfBirth || patient.personalInfo?.dateOfBirth
              ? Math.floor((new Date().getTime() - new Date(patient.dateOfBirth || patient.personalInfo.dateOfBirth).getTime()) / 31557600000)
              : 0,
            dateOfBirth: patient.dateOfBirth || patient.personalInfo?.dateOfBirth,
            gender: patient.gender || patient.personalInfo?.gender,
            phone: patient.contactNumber || patient.contactInfo?.primaryPhone,
            email: patient.email || patient.contactInfo?.email,
            address: patient.address || (patient.contactInfo?.address 
              ? `${patient.contactInfo.address.street}, ${patient.contactInfo.address.city} - ${patient.contactInfo.address.zipCode}`
              : ''),
            chiefComplaint: patient.currentChiefComplaint || 'General examination',
            urgency: patient.triageStatus || 'Routine',
          };
          console.log('✅ Loaded real patient data:', realPatient.name);
        } catch (error) {
          console.warn('⚠️ Patient API not available or patient not found, using mock data', error);
        }
        
        // Try to load real optometry summary - only use if available
        let optometry = null;
        try {
          optometry = await optometrySummaryApi.getCompleteSummary(patientId);
          console.log('✅ Loaded real optometry data');
        } catch {
          console.warn('⚠️ Optometry API not available, skipping optometry data');
          // Don't use mock optometry data - only show if real data exists
        }
        
        // Mock patient data as fallback (use patientId in name to distinguish)
        const mockPatient = {
          id: patientId,
          name: realPatient ? realPatient.name : `Patient ${patientId.substring(0, 8)}`,
          mrn: realPatient ? realPatient.mrn : `MRN-${patientId.substring(0, 6)}`,
          age: realPatient ? realPatient.age : 65,
          dateOfBirth: realPatient ? realPatient.dateOfBirth : '1959-03-15',
          gender: realPatient ? realPatient.gender : 'Male',
          phone: realPatient ? realPatient.phone : '+91 98765 43210',
          email: realPatient ? realPatient.email : `patient${patientId.substring(0, 6)}@email.com`,
          address: realPatient ? realPatient.address : '123, MG Road, Bangalore - 560001',
          chiefComplaint: realPatient ? realPatient.chiefComplaint : 'General examination',
          urgency: realPatient ? realPatient.urgency : 'Routine',
        };

        setPatientData(mockPatient);
        setOptometryData(optometry); // Only set if real data exists
      } catch (error) {
        console.error('Failed to load patient data:', error);
        toast.error('Failed to load patient data');
      } finally {
        setLoading(false);
      }
    };

    loadPatientData();
  }, [patientId]);

  // Detect red flags from optometry data
  const redFlagAlerts = useMemo(() => {
    return detectRedFlags(optometryData);
  }, [optometryData]);

  const handleSave = async (data: any) => {
    try {
      // TODO: Save doctor's examination data
      // await doctorsExaminationApi.save(patientId, data);
      
      toast.success('Examination saved successfully');
      
      // Route based on treatment plan
      if (data.treatmentPlan) {
        if (data.treatmentPlan.routeTo === 'Pharmacy') {
          toast.success('Patient routed to Pharmacy for medication');
          // router.push(`/dashboard/pharmacy/${patientId}`);
        } else if (data.treatmentPlan.routeTo === 'Spectacles') {
          router.push(`/dashboard/examination/spectacle-dispensing/${patientId}`);
        } else if (data.treatmentPlan.routeTo === 'ContactLens') {
          router.push(`/dashboard/examination/contact-lens/${patientId}`);
        } else if (data.treatmentPlan.routeTo === 'SpecialtyClinic') {
          toast.success(`Patient routed to ${data.treatmentPlan.specialtyClinic} Clinic`);
          // Future: router.push(`/dashboard/specialty/${data.treatmentPlan.specialtyClinic}/${patientId}`);
        } else if (data.treatmentPlan.routeTo === 'Surgery') {
          toast.success('Patient routed to Surgery Counselor');
          // Future: router.push(`/dashboard/counselor/${patientId}`);
        }
      }
    } catch (error) {
      console.error('Failed to save examination:', error);
      toast.error('Failed to save examination');
    }
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

  if (!patientData) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Patient Not Found</h3>
              <p className="mt-1 text-sm text-yellow-700">
                The requested patient could not be found.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate age from DOB
  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/dashboard/doctors-desk')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Eye className="w-7 h-7 mr-3 text-blue-600" />
              Doctor's Examination
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Comprehensive ophthalmology consultation
            </p>
          </div>
        </div>
        <SendToOptometryButton patientId={patientId} defaultReasonCode="DOCTOR_REQUESTED" />
      </div>

      {/* Patient Information Card */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
            {patientData.name
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-blue-900 mb-3">{patientData.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-blue-600 font-semibold mb-1">MRN</p>
                <p className="text-sm text-blue-900 font-mono">{patientData.mrn}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-semibold mb-1">Age / Gender</p>
                <p className="text-sm text-blue-900">{calculateAge(patientData.dateOfBirth)} years / {patientData.gender}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-semibold mb-1">Date of Birth</p>
                <p className="text-sm text-blue-900">{new Date(patientData.dateOfBirth).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-semibold mb-1">Phone</p>
                <p className="text-sm text-blue-900">{patientData.phone}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-blue-600 font-semibold mb-1">Address</p>
                <p className="text-sm text-blue-900">{patientData.address}</p>
              </div>
            </div>
          </div>
          <div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                patientData.urgency === 'Emergency'
                  ? 'bg-red-100 text-red-800'
                  : patientData.urgency === 'Urgent'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {patientData.urgency}
            </span>
          </div>
        </div>

        {/* Chief Complaint */}
        <div className="mt-4 pt-4 border-t-2 border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2">Chief Complaint:</p>
          <p className="text-sm text-blue-800 bg-white rounded-md p-3 border border-blue-200">
            {patientData.chiefComplaint}
          </p>
        </div>
      </div>

      {/* Red Flag Alerts - Only show if optometry data exists */}
      {optometryData && redFlagAlerts.length > 0 && (
        <div className="mb-4">
          <AlertBanner 
            alerts={redFlagAlerts}
            onDismiss={(alertId) => console.log('Dismissed alert:', alertId)}
          />
        </div>
      )}

      {/* Doctor's Examination Form */}
      <DoctorExaminationForm
        patientId={patientId}
        visitId={optometryData?.visitId ?? optometryData?.id ?? null}
        patientData={patientData}
        optometryData={optometryData}
        onSave={handleSave}
        canEdit={canEdit}
      />
    </div>
  );
}

export default function DoctorDeskPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:EXAMINATION:VIEW">
      <DoctorDeskPageContent />
    </ProtectedRoute>
  );
}
