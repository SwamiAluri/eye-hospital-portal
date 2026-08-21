'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Phase 3 — Finance mock insurance routes redirect to CCMS Claims.
 * Bookmarks like /dashboard/finance/insurance/* must not open competing claim UI.
 */
export default function FinanceInsuranceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/ccms/claims');
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-gray-600">
      Coverage &amp; claims moved to CCMS. Redirecting…
    </div>
  );
}
