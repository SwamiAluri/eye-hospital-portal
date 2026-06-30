'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const PatientHubPage = dynamic(
  () => import('@/components/patients/lookup/PatientHubPage'),
  { ssr: false },
);

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading patients…</div>}>
      <PatientHubPage />
    </Suspense>
  );
}
