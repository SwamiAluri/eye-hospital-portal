'use client';

import React from 'react';
import PostOpFollowUpWidget from '@/components/widgets/PostOpFollowUpWidget';
import MedicationScheduleWidget from '@/components/widgets/MedicationScheduleWidget';
import EducationLibraryWidget from '@/components/widgets/EducationLibraryWidget';
import AppointmentReminderWidget from '@/components/widgets/AppointmentReminderWidget';
import VitalsMonitoringWidget from '@/components/widgets/VitalsMonitoringWidget';
import MedicalHistoryTimelineWidget from '@/components/widgets/MedicalHistoryTimelineWidget';
import SmartWorkflowAssistantWidget from '@/components/widgets/SmartWorkflowAssistantWidget';
import LabTestIntegrationWidget from '@/components/widgets/LabTestIntegrationWidget';
import ImagingViewerWidget from '@/components/widgets/ImagingViewerWidget';
import BillingPaymentPlanWidget from '@/components/widgets/BillingPaymentPlanWidget';
import ReferralManagementWidget from '@/components/widgets/ReferralManagementWidget';
import PatientFeedbackWidget from '@/components/widgets/PatientFeedbackWidget';
import TelemedicineConsultationWidget from '@/components/widgets/TelemedicineConsultationWidget';
import TreatmentPlanComparisonWidget from '@/components/widgets/TreatmentPlanComparisonWidget';
import Link from 'next/link';

export default function WidgetGalleryPage() {
  // Mock IDs for testing
  const mockPatientId = 'test-patient-123';
  const mockSessionId = 'test-session-456';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Widget Gallery</h1>
          <p className="text-gray-600">
            Demo surface for widgets. Deprecated insurance mock widgets have been removed —
            production coverage &amp; claims use{' '}
            <Link href="/dashboard/ccms/cases" className="text-indigo-700 underline">
              CCMS
            </Link>
            .
          </p>
        </div>

        {/* Post-Operative Care Widgets */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">
            📋 Post-Operative Care (2 widgets)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-4 h-[400px] lg:h-[500px] xl:h-[600px]">
              <PostOpFollowUpWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 h-[400px] lg:h-[500px] xl:h-[600px]">
              <MedicationScheduleWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
          </div>
        </section>

        {/* Patient Education Widgets */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-green-500">
            📚 Patient Education (2 widgets)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-4 h-[350px] lg:h-[420px] xl:h-[500px]">
              <EducationLibraryWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 h-[350px] lg:h-[420px] xl:h-[500px]">
              <AppointmentReminderWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
          </div>
        </section>

        {/* Enhanced Clinical Widgets */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-purple-500">
            🏥 Enhanced Clinical (4 widgets)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-4 h-[350px] lg:h-[420px] xl:h-[500px]">
              <VitalsMonitoringWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 h-[350px] lg:h-[420px] xl:h-[500px]">
              <MedicalHistoryTimelineWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 h-[350px] lg:h-[420px] xl:h-[500px]">
              <LabTestIntegrationWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 h-[350px] lg:h-[420px] xl:h-[500px]">
              <ImagingViewerWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
          </div>
        </section>

        {/* Financial & Admin Widgets */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-yellow-500">
            💰 Financial & Admin (3 widgets)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-4 h-[400px] lg:h-[500px] xl:h-[600px]">
              <BillingPaymentPlanWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 h-[350px] lg:h-[420px] xl:h-[500px]">
              <ReferralManagementWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 h-[400px] lg:h-[500px] xl:h-[600px]">
              <PatientFeedbackWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
          </div>
        </section>

        {/* Advanced Features Widgets */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-red-500">
            🚀 Advanced Features (3 widgets)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-4 h-[400px] lg:h-[500px] xl:h-[600px]">
              <TelemedicineConsultationWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 h-[400px] lg:h-[500px] xl:h-[600px]">
              <TreatmentPlanComparisonWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 h-[350px] lg:h-[420px] xl:h-[500px]">
              <SmartWorkflowAssistantWidget patientId={mockPatientId} sessionId={mockSessionId} />
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
          <h3 className="text-xl font-bold text-blue-900 mb-3">✅ Widget Testing Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">15</div>
              <div className="text-sm text-gray-600">Total Widgets</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">2</div>
              <div className="text-sm text-gray-600">Post-Op</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">4</div>
              <div className="text-sm text-gray-600">Clinical</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-yellow-600">4</div>
              <div className="text-sm text-gray-600">Financial</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-600">3</div>
              <div className="text-sm text-gray-600">Advanced</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
