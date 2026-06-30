'use client';

import { AdmissionsTab } from '@/components/patients/tabs/AdmissionsTab';
import { AllergiesTab } from '@/components/patients/tabs/AllergiesTab';
import { BillingTab } from '@/components/patients/tabs/BillingTab';
import { CommunicationsTab } from '@/components/patients/tabs/CommunicationsTab';
import { ConsentsTab } from '@/components/patients/tabs/ConsentsTab';
import { CounselingTab } from '@/components/patients/tabs/CounselingTab';
import { DiagnosesTab } from '@/components/patients/tabs/DiagnosesTab';
import { DocumentsTab } from '@/components/patients/tabs/DocumentsTab';
import { ExaminationsTab } from '@/components/patients/tabs/ExaminationsTab';
import { EyeHistoryTab } from '@/components/patients/tabs/EyeHistoryTab';
import { FeedbackTab } from '@/components/patients/tabs/FeedbackTab';
import { ImagingTab } from '@/components/patients/tabs/ImagingTab';
import { InsuranceTab } from '@/components/patients/tabs/InsuranceTab';
import { LabReportsTab } from '@/components/patients/tabs/LabReportsTab';
import { MedHistoryTab } from '@/components/patients/tabs/MedHistoryTab';
import { NotesTab } from '@/components/patients/tabs/NotesTab';
import { OpticalTab } from '@/components/patients/tabs/OpticalTab';
import { PharmacyTab } from '@/components/patients/tabs/PharmacyTab';
import { PortalAccessTab } from '@/components/patients/tabs/PortalAccessTab';
import { PreOpTab } from '@/components/patients/tabs/PreOpTab';
import { PrescriptionsTab } from '@/components/patients/tabs/PrescriptionsTab';
import { ProceduresTab } from '@/components/patients/tabs/ProceduresTab';
import { QueueStatusTab } from '@/components/patients/tabs/QueueStatusTab';
import { ReferralsTab } from '@/components/patients/tabs/ReferralsTab';
import { SurgeryTab } from '@/components/patients/tabs/SurgeryTab';
import { TimelineTab } from '@/components/patients/tabs/TimelineTab';
import { VisitsTab } from '@/components/patients/tabs/VisitsTab';
import { VitalsFlowsheetTab } from '@/components/patients/tabs/VitalsFlowsheetTab';
import { BlockedTabContent } from '@/components/patients/tabs/BlockedTabContent';
import type { PatientSummary } from '@/types/patient-lookup';
import { checkInGateLabel } from '@/lib/patients/patient-record-gate';
import type { PatientRecordTabKey } from '@/lib/patients/patient-record-tabs';
import { PatientRecordOverview } from './PatientRecordOverview';
import { PatientSchedulingTab } from './PatientSchedulingTab';

function summaryToPatientData(summary: PatientSummary) {
  return {
    allergies: summary.allergies,
    medicalConditions: summary.allergies,
    medications: '',
    insuranceProvider: summary.insuranceProvider,
    insuranceNumber: summary.insurancePolicyNumber,
  };
}

export function PatientRecordTabContent({
  tab,
  patientId,
  summary,
  onOpenTab,
  isCheckedIn,
  canOverride,
  isTabAccessible,
  onRequestOverride,
}: {
  tab: PatientRecordTabKey;
  patientId: string;
  summary: PatientSummary;
  onOpenTab?: (tab: PatientRecordTabKey) => void;
  isCheckedIn: boolean;
  canOverride: boolean;
  isTabAccessible: (tab: PatientRecordTabKey) => boolean;
  onRequestOverride: (tab: PatientRecordTabKey) => void;
}) {
  if (!isTabAccessible(tab)) {
    return (
      <BlockedTabContent
        tabName={checkInGateLabel(tab)}
        isCheckedIn={isCheckedIn}
        canOverride={canOverride}
        onOverrideClick={() => onRequestOverride(tab)}
      />
    );
  }

  switch (tab) {
    case 'overview':
      return <PatientRecordOverview onOpenTab={onOpenTab} />;
    case 'vitals':
      return <VitalsFlowsheetTab patientId={patientId} />;
    case 'medical_records':
      return (
        <MedHistoryTab patientId={patientId} patientData={summaryToPatientData(summary)} />
      );
    case 'allergies':
      return <AllergiesTab patientId={patientId} />;
    case 'medications':
      return <PharmacyTab patientId={patientId} />;
    case 'prescriptions':
      return <PrescriptionsTab patientId={patientId} />;
    case 'lab_results':
      return <LabReportsTab patientId={patientId} />;
    case 'examinations':
      return <ExaminationsTab patientId={patientId} />;
    case 'diagnoses':
      return <DiagnosesTab patientId={patientId} />;
    case 'eye_history':
      return <EyeHistoryTab patientId={patientId} />;
    case 'imaging':
      return <ImagingTab patientId={patientId} />;
    case 'documents':
      return <DocumentsTab patientId={patientId} />;
    case 'encounters':
      return <TimelineTab patientId={patientId} />;
    case 'visits':
      return <VisitsTab patientId={patientId} />;
    case 'scheduling':
      return <PatientSchedulingTab patientId={patientId} />;
    case 'billing':
      return <BillingTab patientId={patientId} />;
    case 'insurance':
      return (
        <InsuranceTab
          patientId={patientId}
          profileInsurance={{
            provider: summary.insuranceProvider,
            policyNumber: summary.insurancePolicyNumber,
          }}
        />
      );
    case 'admissions':
      return <AdmissionsTab patientId={patientId} />;
    case 'counseling':
      return <CounselingTab patientId={patientId} />;
    case 'surgery':
      return <SurgeryTab patientId={patientId} />;
    case 'preop':
      return <PreOpTab patientId={patientId} />;
    case 'procedures':
      return <ProceduresTab patientId={patientId} />;
    case 'optical':
      return <OpticalTab patientId={patientId} />;
    case 'consents':
      return <ConsentsTab patientId={patientId} />;
    case 'communications':
      return <CommunicationsTab patientId={patientId} />;
    case 'referrals':
      return <ReferralsTab patientId={patientId} />;
    case 'notes':
      return <NotesTab patientId={patientId} />;
    case 'queue':
      return <QueueStatusTab patientId={patientId} />;
    case 'feedback':
      return <FeedbackTab patientId={patientId} />;
    case 'portal_access':
      return <PortalAccessTab patientId={patientId} />;
    default:
      return null;
  }
}
