'use client';

import { useState } from 'react';
import { DepartmentClearancePanel } from '@/components/ip-management/department-clearance/DepartmentClearancePanel';
import { PreOpClearanceDetailDto } from '@/lib/api/ip-management.api';

interface PreOpTabProps {
  journeyId: string;
  clinicalState: string;
  paymentMode?: string;
  branchId?: string;
  isLocked?: boolean;
  /** Current user's department code — used to show dept-specific action buttons */
  currentUserDeptCode?: string;
}

export function PreOpTab({
  journeyId,
  clinicalState,
  paymentMode,
  isLocked,
  currentUserDeptCode,
}: PreOpTabProps) {
  const [, setDetail] = useState<PreOpClearanceDetailDto | null>(null);

  return (
    <div className="space-y-4">
      <DepartmentClearancePanel
        journeyId={journeyId}
        clinicalState={clinicalState}
        paymentMode={paymentMode}
        isLocked={isLocked}
        currentUserDeptCode={currentUserDeptCode}
        onDetailChange={setDetail}
      />
    </div>
  );
}
