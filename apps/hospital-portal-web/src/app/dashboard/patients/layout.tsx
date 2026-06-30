'use client';

import { PatientWorkspaceProvider } from '@/components/patients/record/PatientWorkspaceProvider';

export default function PatientsLayout({ children }: { children: React.ReactNode }) {
  return <PatientWorkspaceProvider>{children}</PatientWorkspaceProvider>;
}
