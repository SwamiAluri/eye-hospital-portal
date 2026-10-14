'use client';

import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PatientRecordPage } from '@/components/patients/record/PatientRecordPage';
import { PatientRecordProvider } from '@/components/patients/record/PatientRecordProvider';

export default function PatientDetailsPage() {
  const params = useParams();
  const patientId = params.id as string;

  return (
    <ProtectedRoute requiredPermission="patient.view">
      <PatientRecordProvider patientId={patientId}>
        <PatientRecordPage />
      </PatientRecordProvider>
    </ProtectedRoute>
  );
}
