'use client';

import { useEffect, useState } from 'react';
import { validateAdmission, type AdmissionValidation } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { formatCounsellingCcmsStatus } from '@/lib/counsellors-desk/format-counselling-ccms-status';
import { coverageTestIds } from '@/lib/counsellors-desk/coverage-test-ids';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';

/** Compact coverage status strip — no Open CCMS link; status title only. */
export function CounsellingCcmsStatusStrip({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<AdmissionValidation | null>(null);

  useEffect(() => {
    let active = true;
    void validateAdmission({ sessionId })
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch(() => {
        if (active) setStatus(null);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const blocked = status && !status.allowed;
  const warn = status?.decision === 'WARN';

  return (
    <div
      data-testid={coverageTestIds.counsellingCcmsStatus}
      className={`rounded-lg border px-3 py-2 text-xs ${
        blocked
          ? 'border-red-200 bg-red-50 text-red-900'
          : warn
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : 'border-indigo-100 bg-indigo-50/70 text-indigo-950'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{counsellingCopy.coverageStatus}</p>
      <p className="mt-0.5 font-medium">{formatCounsellingCcmsStatus(status)}</p>
    </div>
  );
}
