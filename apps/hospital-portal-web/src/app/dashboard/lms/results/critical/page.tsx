'use client';

import { CriticalWorkbench } from '@/components/lms/testing/CriticalWorkbench';

export default function Page() {
  return (
    <div className="p-4 md:p-6" data-testid="lms-critical-page">
      <CriticalWorkbench />
    </div>
  );
}
