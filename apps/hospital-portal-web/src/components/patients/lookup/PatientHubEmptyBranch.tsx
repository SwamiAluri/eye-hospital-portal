'use client';

import { Building2 } from 'lucide-react';
import { BranchSwitcher } from '@/components/patients/lookup/BranchSwitcher';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

export function PatientHubEmptyBranch() {
  return (
    <div
      className="flex flex-col items-center justify-center flex-1 p-8 text-center"
      data-testid={patientLookupTestIds.emptyBranch}
    >
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
        <Building2 className="w-7 h-7 text-emerald-600" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Select a branch to search patients</h2>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        Patient lookup is scoped to your active branch. Choose a branch below to load the patient list.
      </p>
      <BranchSwitcher className="scale-110" />
    </div>
  );
}
