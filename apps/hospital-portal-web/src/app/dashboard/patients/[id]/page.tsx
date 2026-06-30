'use client';

import { useParams } from 'next/navigation';
import { PatientRecordPage } from '@/components/patients/record/PatientRecordPage';
import { PatientRecordProvider } from '@/components/patients/record/PatientRecordProvider';

export default function PatientDetailsPage() {
  const params = useParams();
  const patientId = params.id as string;

  return (
    <PatientRecordProvider patientId={patientId}>
      <PatientRecordPage />
    </PatientRecordProvider>
  );
}
