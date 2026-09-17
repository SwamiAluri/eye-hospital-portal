'use client';

import { Building2 } from 'lucide-react';
import { BranchSwitcher } from '@/components/patients/lookup/BranchSwitcher';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

export function PatientHubEmptyBranch({
  reason = 'select',
}: {
  /** select = multi-branch needs choice; none = no authorized branch assigned */
  reason?: 'select' | 'none';
}) {
  const title =
    reason === 'none'
      ? 'No authorized branch assigned'
      : 'Select a branch to search patients';
  const body =
    reason === 'none'
      ? 'Your account has no authorized branch for patient lookup. Ask an administrator to assign a branch, then refresh.'
      : 'You are authorized for more than one branch. Choose a branch below to load the patient list.';

  return (
    <div
      className="flex flex-col items-center justify-center flex-1 p-8 text-center"
      data-testid={patientLookupTestIds.emptyBranch}
    >
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
        <Building2 className="w-7 h-7 text-emerald-600" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 max-w-md mb-6">{body}</p>
      {reason === 'select' && <BranchSwitcher className="scale-110" />}
    </div>
  );
}
